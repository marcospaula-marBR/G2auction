-- Migration: 006_egress_rpcs_and_manager_quotas.sql
-- 1) RPCs DISTINCT no Postgres para cortar ~85% do Egress do catálogo
-- 2) Tabela capital_calls + políticas RLS para o Gestor da Plataforma (Fase 3)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. RPCs OTIMIZADAS PARA DROPDOWNS E FRESCOR POR BANCO (BAIXO EGRESS)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_distinct_states()
RETURNS TABLE(state TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT DISTINCT upper(trim(p.state))::text AS state
    FROM public.properties p
    WHERE p.status = 'ACTIVE'
      AND p.state IS NOT NULL
      AND trim(p.state) <> ''
    ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_distinct_cities(p_uf TEXT)
RETURNS TABLE(city TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT DISTINCT trim(p.city)::text AS city
    FROM public.properties p
    WHERE p.status = 'ACTIVE'
      AND upper(trim(p.state)) = upper(trim(p_uf))
      AND p.city IS NOT NULL
      AND trim(p.city) <> ''
    ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_distinct_property_types()
RETURNS TABLE(property_type TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT DISTINCT trim(p.property_type)::text AS property_type
    FROM public.properties p
    WHERE p.status = 'ACTIVE'
      AND p.property_type IS NOT NULL
      AND trim(p.property_type) <> ''
    ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_distinct_sale_modalities()
RETURNS TABLE(sale_modality TEXT)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT DISTINCT trim(p.sale_modality)::text AS sale_modality
    FROM public.properties p
    WHERE p.status = 'ACTIVE'
      AND p.sale_modality IS NOT NULL
      AND trim(p.sale_modality) <> ''
    ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.get_bank_freshness()
RETURNS TABLE(
    source TEXT,
    active_count BIGINT,
    last_synced_at TIMESTAMPTZ,
    source_generated_at TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        p.source::text,
        count(*)::bigint AS active_count,
        max(p.last_seen_at) AS last_synced_at,
        max(p.source_generated_at)::text AS source_generated_at
    FROM public.properties p
    WHERE p.status = 'ACTIVE'
      AND p.source IS NOT NULL
    GROUP BY p.source;
$$;

GRANT EXECUTE ON FUNCTION public.get_distinct_states() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_cities(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_property_types() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_sale_modalities() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_bank_freshness() TO anon, authenticated;

-- =====================================================================
-- 2. CHAMADAS DE CAPITAL (CAPITAL CALLS) & GESTOR DE COTAS (FASE 3)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.capital_calls (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    vehicle_id     UUID NOT NULL REFERENCES public.investment_vehicles(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    description    TEXT,
    total_call_brl NUMERIC(14,2) NOT NULL CHECK (total_call_brl > 0),
    due_date       DATE NOT NULL,
    status         TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    created_by     UUID,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capital_calls_vehicle ON public.capital_calls(vehicle_id, status, due_date);

ALTER TABLE public.capital_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_read_capital_calls" ON public.capital_calls;
CREATE POLICY "user_read_capital_calls" ON public.capital_calls
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.is_platform_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.tenant_members tm
        WHERE tm.user_id = auth.uid()
          AND tm.role IN ('superadmin', 'tenant_admin')
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_manager() TO authenticated;

DROP POLICY IF EXISTS "manager_all_investment_vehicles" ON public.investment_vehicles;
CREATE POLICY "manager_all_investment_vehicles" ON public.investment_vehicles
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());

DROP POLICY IF EXISTS "manager_all_quota_ledger" ON public.quota_ledger_events;
CREATE POLICY "manager_all_quota_ledger" ON public.quota_ledger_events
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());

DROP POLICY IF EXISTS "manager_all_quota_intents" ON public.quota_subscription_intents;
CREATE POLICY "manager_all_quota_intents" ON public.quota_subscription_intents
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());

DROP POLICY IF EXISTS "manager_all_capital_calls" ON public.capital_calls;
CREATE POLICY "manager_all_capital_calls" ON public.capital_calls
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());

DROP POLICY IF EXISTS "manager_all_vehicle_documents" ON public.vehicle_documents;
CREATE POLICY "manager_all_vehicle_documents" ON public.vehicle_documents
    FOR ALL
    USING (public.is_platform_manager())
    WITH CHECK (public.is_platform_manager());
