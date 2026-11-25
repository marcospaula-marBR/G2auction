-- Migration: 005_investor_quotas_architecture.sql
-- Área do Investidor centralizada em cotas (Imóvel Individual SPE/SCP + Pool Multi-Imóveis),
-- livro-razão imutável, registro de intenções de aporte e waterfall de taxas (Adm + Performance sobre Hurdle).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. VEÍCULOS DE INVESTIMENTO EM COTAS (SINGLE_ASSET & MULTI_ASSET_POOL)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.investment_vehicles (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                     UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    slug                          TEXT UNIQUE NOT NULL,
    name                          TEXT NOT NULL,
    vehicle_type                  TEXT NOT NULL CHECK (vehicle_type IN ('SINGLE_ASSET', 'MULTI_ASSET_POOL')),
    legal_structure               TEXT NOT NULL DEFAULT 'SCP'
                                  CHECK (legal_structure IN ('SCP', 'SPE', 'CONDOMINIO', 'CLUBE_PRIVADO')),
    property_id                   UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    property_summary              TEXT,
    city                          TEXT,
    state                         TEXT,
    stage                         TEXT NOT NULL DEFAULT 'CAPTACAO'
                                  CHECK (stage IN ('CAPTACAO', 'ARREMATACAO', 'DESOCUPACAO', 'REFORMA', 'VENDA', 'ENCERRADO')),
    initial_quota_value           NUMERIC(14,4) NOT NULL CHECK (initial_quota_value > 0),
    current_nav_per_quota         NUMERIC(14,4) NOT NULL CHECK (current_nav_per_quota > 0),
    target_capital                NUMERIC(14,2) NOT NULL CHECK (target_capital > 0),
    raised_capital                NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_quotas_issued           NUMERIC(18,6) NOT NULL DEFAULT 0,
    min_investment_brl            NUMERIC(14,2) NOT NULL DEFAULT 1000.00,
    estimated_exit_months         INTEGER NOT NULL DEFAULT 10,
    projected_roi_pct             NUMERIC(6,2) NOT NULL DEFAULT 28.00,
    admin_fee_annual_pct          NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (admin_fee_annual_pct >= 0 AND admin_fee_annual_pct <= 15),
    admin_fee_mode                TEXT NOT NULL DEFAULT 'ON_EXIT_ACCRUED'
                                  CHECK (admin_fee_mode IN ('ON_EXIT_ACCRUED', 'PERIODIC')),
    performance_fee_pct           NUMERIC(5,2) NOT NULL DEFAULT 20.00 CHECK (performance_fee_pct >= 0 AND performance_fee_pct <= 50),
    performance_hurdle_type       TEXT NOT NULL DEFAULT 'CDI'
                                  CHECK (performance_hurdle_type IN ('CDI', 'IPCA_PLUS_6', 'FIXED_ANNUAL', 'NONE')),
    performance_hurdle_annual_pct NUMERIC(6,2) NOT NULL DEFAULT 10.75,
    performance_on_exit_only      BOOLEAN NOT NULL DEFAULT TRUE,
    active                        BOOLEAN NOT NULL DEFAULT TRUE,
    is_reference_template         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 2. LIVRO-RAZÃO IMUTÁVEL DE COTAS (APPEND-ONLY LEDGER)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.quota_ledger_events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    vehicle_id           UUID NOT NULL REFERENCES public.investment_vehicles(id) ON DELETE CASCADE,
    user_id              UUID,
    event_type           TEXT NOT NULL CHECK (event_type IN (
                             'SUBSCRIPTION', 'CAPITAL_CALL', 'EXPENSE', 'VALUATION_MARK',
                             'RENT_INCOME', 'EXIT_SALE', 'DISTRIBUTION', 'REDEMPTION'
                         )),
    amount_brl           NUMERIC(14,2) NOT NULL,
    quotas_delta         NUMERIC(18,6) NOT NULL DEFAULT 0,
    quota_price_at_event NUMERIC(14,4) NOT NULL,
    category             TEXT,
    description          TEXT NOT NULL,
    receipt_url          TEXT,
    event_date           DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 3. REGISTRO DE INTENÇÃO DE APORTE / RESERVA DE COTAS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.quota_subscription_intents (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    vehicle_id           UUID NOT NULL REFERENCES public.investment_vehicles(id) ON DELETE CASCADE,
    user_id              UUID NOT NULL,
    investor_name        TEXT,
    investor_email       TEXT NOT NULL,
    amount_brl           NUMERIC(14,2) NOT NULL CHECK (amount_brl > 0),
    estimated_quotas     NUMERIC(18,6) NOT NULL CHECK (estimated_quotas > 0),
    quota_price_snapshot NUMERIC(14,4) NOT NULL CHECK (quota_price_snapshot > 0),
    notes                TEXT,
    status               TEXT NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING', 'APPROVED', 'CONVERTED', 'CANCELLED')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 4. DOCUMENTOS & GOVERNANÇA DO VEÍCULO / COTISTA
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    vehicle_id  UUID NOT NULL REFERENCES public.investment_vehicles(id) ON DELETE CASCADE,
    user_id     UUID,
    doc_type    TEXT NOT NULL CHECK (doc_type IN (
                    'CONTRATO_SCP', 'CONTRATO_SPE', 'EDITAL', 'MATRICULA',
                    'COMPROVANTE_APORTE', 'INFORME_IR', 'LAUDO_REFORMA'
                )),
    title       TEXT NOT NULL,
    file_url    TEXT,
    sha256_hash TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 5. ÍNDICES E ROW LEVEL SECURITY (RLS)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON public.investment_vehicles(active, vehicle_type);
CREATE INDEX IF NOT EXISTS idx_quota_ledger_vehicle_user ON public.quota_ledger_events(vehicle_id, user_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_quota_intents_user ON public.quota_subscription_intents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_docs_vehicle ON public.vehicle_documents(vehicle_id, user_id);

ALTER TABLE public.investment_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_ledger_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quota_subscription_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_vehicles" ON public.investment_vehicles;
CREATE POLICY "public_read_active_vehicles" ON public.investment_vehicles
    FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "user_read_own_or_vehicle_ledger" ON public.quota_ledger_events;
CREATE POLICY "user_read_own_or_vehicle_ledger" ON public.quota_ledger_events
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "user_manage_own_quota_intents" ON public.quota_subscription_intents;
CREATE POLICY "user_manage_own_quota_intents" ON public.quota_subscription_intents
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_read_vehicle_documents" ON public.vehicle_documents;
CREATE POLICY "user_read_vehicle_documents" ON public.vehicle_documents
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- =====================================================================
-- 6. OPERAÇÕES-MODELO DE REFERÊNCIA (BOTH SINGLE_ASSET & MULTI_ASSET_POOL)
-- =====================================================================
INSERT INTO public.investment_vehicles (
    tenant_id, slug, name, vehicle_type, legal_structure, property_summary,
    city, state, stage, initial_quota_value, current_nav_per_quota,
    target_capital, raised_capital, total_quotas_issued, min_investment_brl,
    estimated_exit_months, projected_roi_pct,
    admin_fee_annual_pct, admin_fee_mode, performance_fee_pct,
    performance_hurdle_type, performance_hurdle_annual_pct, performance_on_exit_only,
    active, is_reference_template
) VALUES
(
    NULL,
    'scp-flip-sp-01',
    'Operação Individual #01 · Apartamento Desocupado SP',
    'SINGLE_ASSET',
    'SCP',
    'Modelo Deal-by-Deal (1 imóvel isolado via SCP). Cota nominal de R$ 1.000,00, sem taxa de administração fixa e taxa de performance apenas na venda acima de 100% do CDI.',
    'São Paulo',
    'SP',
    'CAPTACAO',
    1000.0000,
    1000.0000,
    350000.00,
    140000.00,
    140.000000,
    5000.00,
    10,
    32.00,
    0.00,
    'ON_EXIT_ACCRUED',
    20.00,
    'CDI',
    10.75,
    TRUE,
    TRUE,
    TRUE
),
(
    NULL,
    'clube-multiativo-g2-01',
    'Clube Multi-Imóveis Brasil · Fundo de Arremates',
    'MULTI_ASSET_POOL',
    'SCP',
    'Modelo Pool/Clube diversificado em múltiplos imóveis de leilão (SP/PR/MG). Cota inicial R$ 100,00 valorizada conforme NAV da carteira, taxa de gestão 1,5% a.a. na saída + 20% acima de IPCA+6%.',
    'São Paulo / Curitiba',
    'SP',
    'REFORMA',
    100.0000,
    108.4000,
    1000000.00,
    433600.00,
    4000.000000,
    2500.00,
    14,
    36.00,
    1.50,
    'ON_EXIT_ACCRUED',
    20.00,
    'IPCA_PLUS_6',
    10.50,
    TRUE,
    TRUE,
    TRUE
)
ON CONFLICT (slug) DO NOTHING;
