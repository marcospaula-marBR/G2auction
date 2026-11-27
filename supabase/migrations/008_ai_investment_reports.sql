-- Migration: 008_ai_investment_reports.sql
-- Histórico de Relatórios Comparativos de Inteligência IA Multi-Imóveis

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.ai_investment_reports (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID,
    tenant_id          UUID,
    title              TEXT NOT NULL,
    strategy           TEXT NOT NULL DEFAULT 'FLIPPING',
    payment_mode       TEXT NOT NULL DEFAULT 'CASH',
    target_roi_pct     NUMERIC(6,2) DEFAULT 30,
    properties_count   INTEGER NOT NULL DEFAULT 1,
    property_ids       JSONB NOT NULL DEFAULT '[]'::jsonb,
    report_payload     JSONB NOT NULL,
    model_used         TEXT,
    used_web_grounding BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_reports_user_created
    ON public.ai_investment_reports(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_reports_created
    ON public.ai_investment_reports(created_at DESC);

ALTER TABLE public.ai_investment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_select_own_ai_reports" ON public.ai_investment_reports;
CREATE POLICY "user_select_own_ai_reports" ON public.ai_investment_reports
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_insert_own_ai_reports" ON public.ai_investment_reports;
CREATE POLICY "user_insert_own_ai_reports" ON public.ai_investment_reports
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_delete_own_ai_reports" ON public.ai_investment_reports;
CREATE POLICY "user_delete_own_ai_reports" ON public.ai_investment_reports
    FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "manager_select_all_ai_reports" ON public.ai_investment_reports;
CREATE POLICY "manager_select_all_ai_reports" ON public.ai_investment_reports
    FOR SELECT
    USING (public.is_platform_manager());
