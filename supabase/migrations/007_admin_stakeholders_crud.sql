-- Migration: 007_admin_stakeholders_crud.sql
-- Definição explícita de Superadmin + RLS e RPCs de Gestão (Edição/Exclusão) de Stakeholders

-- =====================================================================
-- 1. GARANTIR MARCOS PAULA COMO SUPERADMIN NA TENANT_MEMBERS
-- =====================================================================
INSERT INTO public.tenant_members (tenant_id, user_id, role)
SELECT
    '00000000-0000-4000-8000-000000000002'::uuid,
    u.id,
    'superadmin'
FROM auth.users u
WHERE lower(u.email) = 'marcos.paula@marbr.com.br'
ON CONFLICT (tenant_id, user_id)
DO UPDATE SET role = 'superadmin';

-- =====================================================================
-- 2. POLÍTICAS RLS DE ADMINISTRADOR (STAKEHOLDERS)
-- =====================================================================
-- Partners: admin gerencia tudo; qualquer visitante/usuário lê parceiros aprovados
DROP POLICY IF EXISTS "manager_all_partners" ON public.partners;
CREATE POLICY "manager_all_partners" ON public.partners
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());

DROP POLICY IF EXISTS "public_read_approved_partners" ON public.partners;
CREATE POLICY "public_read_approved_partners" ON public.partners
    FOR SELECT
    USING (approval_status = 'APPROVED');

-- Partner Services
DROP POLICY IF EXISTS "manager_all_partner_services" ON public.partner_services;
CREATE POLICY "manager_all_partner_services" ON public.partner_services
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());

-- Tenants (Empresas Contratantes / White-Label)
DROP POLICY IF EXISTS "manager_all_tenants" ON public.tenants;
CREATE POLICY "manager_all_tenants" ON public.tenants
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());

-- Tenant Members
DROP POLICY IF EXISTS "manager_all_tenant_members" ON public.tenant_members;
CREATE POLICY "manager_all_tenant_members" ON public.tenant_members
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());

-- Cotistas (tabela legada, se existir)
DO $$
BEGIN
    IF to_regclass('public.cotistas') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.cotistas ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "manager_all_cotistas" ON public.cotistas';
        EXECUTE 'CREATE POLICY "manager_all_cotistas" ON public.cotistas FOR ALL USING (public.is_platform_manager()) WITH CHECK (public.is_platform_manager())';
    END IF;
END $$;

-- =====================================================================
-- 3. RPCs SEGURAS (SECURITY DEFINER) PARA GESTÃO DE USUÁRIOS / PAPÉIS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.admin_list_stakeholders()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    full_name TEXT,
    account_type TEXT,
    member_role TEXT,
    tenant_id UUID,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    intents_count BIGINT,
    ledger_events_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_platform_manager() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores.';
    END IF;

    RETURN QUERY
    SELECT
        u.id AS user_id,
        u.email::text AS email,
        COALESCE(
            NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
            NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
            split_part(u.email, '@', 1)
        )::text AS full_name,
        COALESCE(u.raw_user_meta_data->>'account_type', 'investor')::text AS account_type,
        COALESCE(tm.role, COALESCE(u.raw_user_meta_data->>'account_type', 'investor'))::text AS member_role,
        tm.tenant_id AS tenant_id,
        u.created_at,
        u.last_sign_in_at,
        (SELECT count(*) FROM public.quota_subscription_intents qi WHERE qi.user_id = u.id)::bigint AS intents_count,
        (SELECT count(*) FROM public.quota_ledger_events ql WHERE ql.user_id = u.id)::bigint AS ledger_events_count
    FROM auth.users u
    LEFT JOIN LATERAL (
        SELECT m.tenant_id, m.role
        FROM public.tenant_members m
        WHERE m.user_id = u.id
        ORDER BY
            CASE m.role
                WHEN 'superadmin' THEN 1
                WHEN 'tenant_admin' THEN 2
                WHEN 'partner' THEN 3
                ELSE 4
            END
        LIMIT 1
    ) tm ON TRUE
    ORDER BY
        CASE COALESCE(tm.role, 'investor')
            WHEN 'superadmin' THEN 1
            WHEN 'tenant_admin' THEN 2
            WHEN 'partner' THEN 3
            ELSE 4
        END,
        u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_stakeholder(
    p_user_id UUID,
    p_role TEXT,
    p_full_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_default_tenant UUID := '00000000-0000-4000-8000-000000000002'::uuid;
    v_account_type TEXT;
BEGIN
    IF NOT public.is_platform_manager() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores.';
    END IF;

    IF p_role NOT IN ('superadmin', 'tenant_admin', 'partner', 'investor') THEN
        RAISE EXCEPTION 'Papel inválido: %', p_role;
    END IF;

    IF p_user_id = auth.uid() AND p_role NOT IN ('superadmin', 'tenant_admin') THEN
        RAISE EXCEPTION 'Não é permitido remover seu próprio acesso de administrador.';
    END IF;

    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (v_default_tenant, p_user_id, p_role)
    ON CONFLICT (tenant_id, user_id)
    DO UPDATE SET role = EXCLUDED.role;

    v_account_type := CASE WHEN p_role = 'partner' THEN 'partner' ELSE 'investor' END;

    UPDATE auth.users u
    SET raw_user_meta_data =
        COALESCE(u.raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('account_type', v_account_type)
        || CASE
            WHEN p_full_name IS NOT NULL AND trim(p_full_name) <> '' THEN
                jsonb_build_object('full_name', trim(p_full_name))
            ELSE '{}'::jsonb
        END
    WHERE u.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_stakeholder_membership(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_platform_manager() THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores.';
    END IF;

    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Não é permitido excluir o seu próprio acesso de administrador.';
    END IF;

    DELETE FROM public.tenant_members WHERE user_id = p_user_id;
    DELETE FROM public.partners WHERE user_id = p_user_id;

    IF to_regclass('public.user_alert_profiles') IS NOT NULL THEN
        UPDATE public.user_alert_profiles SET active = FALSE WHERE user_id = p_user_id;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_stakeholders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_stakeholder(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_stakeholder_membership(UUID) TO authenticated;
