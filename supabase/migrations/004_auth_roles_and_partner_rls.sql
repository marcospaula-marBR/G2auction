-- Migration: 004_auth_roles_and_partner_rls.sql
-- Separação segura entre Investidores e Parceiros no Supabase Auth + RLS

-- =====================================================================
-- 1. TENANT_MEMBERS: auto-cadastro seguro apenas como 'investor' ou 'partner'
-- =====================================================================
DROP POLICY IF EXISTS "user_read_own_membership" ON public.tenant_members;
CREATE POLICY "user_read_own_membership" ON public.tenant_members
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_self_register_role" ON public.tenant_members;
CREATE POLICY "user_self_register_role" ON public.tenant_members
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND role IN ('investor', 'partner')
    );

DROP POLICY IF EXISTS "user_update_own_non_admin_role" ON public.tenant_members;
CREATE POLICY "user_update_own_non_admin_role" ON public.tenant_members
    FOR UPDATE
    USING (auth.uid() = user_id AND role IN ('investor', 'partner'))
    WITH CHECK (auth.uid() = user_id AND role IN ('investor', 'partner'));

-- =====================================================================
-- 2. PARTNERS: especialista autenticado pode consultar/submeter o próprio cadastro
-- =====================================================================
DROP POLICY IF EXISTS "partner_read_own_profile" ON public.partners;
CREATE POLICY "partner_read_own_profile" ON public.partners
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "partner_insert_own_profile" ON public.partners;
CREATE POLICY "partner_insert_own_profile" ON public.partners
    FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND approval_status = 'PENDING'
    );

DROP POLICY IF EXISTS "partner_update_own_profile" ON public.partners;
CREATE POLICY "partner_update_own_profile" ON public.partners
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
