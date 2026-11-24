-- Migration: 003_whitelabel_multitenant_partners.sql
-- Fundação Multi-Tenant (White-Label), Radar IA + Notificações e Marketplace de Parceiros com Split Payment

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- 1. TENANTS (WHITE-LABEL MULTI-TENANT)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug              TEXT UNIQUE NOT NULL,
    custom_domain     TEXT UNIQUE,
    brand_name        TEXT NOT NULL,
    tagline           TEXT,
    logo_url          TEXT,
    show_logo         BOOLEAN NOT NULL DEFAULT FALSE,
    primary_color     TEXT NOT NULL DEFAULT '#0f172a',
    accent_color      TEXT NOT NULL DEFAULT '#2563eb',
    support_email     TEXT,
    show_intro_splash BOOLEAN NOT NULL DEFAULT FALSE,
    platform_fee_pct  NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (platform_fee_pct >= 0 AND platform_fee_pct <= 50),
    tenant_fee_pct    NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (tenant_fee_pct >= 0 AND tenant_fee_pct <= 30),
    features          JSONB NOT NULL DEFAULT '{
        "map": true,
        "journey": true,
        "partners": true,
        "ledger": true,
        "renovation": true,
        "portfolio": true,
        "copilot": true,
        "adminSync": false
    }'::jsonb,
    plan              TEXT NOT NULL DEFAULT 'STARTER' CHECK (plan IN ('STARTER', 'PRO', 'ENTERPRISE')),
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    role        TEXT NOT NULL DEFAULT 'investor' CHECK (role IN ('superadmin', 'tenant_admin', 'partner', 'investor')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id)
);

-- =====================================================================
-- 2. RADAR IA DO USUÁRIO + CANAIS DE NOTIFICAÇÃO (PWA PUSH / TELEGRAM / EMAIL / WHATSAPP)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_alert_profiles (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id               UUID NOT NULL,
    name                  TEXT NOT NULL DEFAULT 'Meu Radar Principal',
    states                TEXT[] DEFAULT ARRAY['SP'],
    cities                TEXT[] DEFAULT ARRAY[]::TEXT[],
    property_types        TEXT[] DEFAULT ARRAY[]::TEXT[],
    banks                 TEXT[] DEFAULT ARRAY[]::TEXT[],
    max_price             NUMERIC(14,2),
    min_discount_pct      NUMERIC(5,2) DEFAULT 30.00,
    require_financing     BOOLEAN DEFAULT FALSE,
    accept_occupied       BOOLEAN DEFAULT TRUE,
    price_tolerance_pct   NUMERIC(5,2) DEFAULT 15.00,
    discount_tolerance_pp NUMERIC(5,2) DEFAULT 5.00,
    notify_pwa_push       BOOLEAN NOT NULL DEFAULT TRUE,
    notify_telegram       BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_chat_id      TEXT,
    notify_email          BOOLEAN NOT NULL DEFAULT TRUE,
    notify_whatsapp_pro   BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_phone        TEXT,
    frequency             TEXT NOT NULL DEFAULT 'IMMEDIATE' CHECK (frequency IN ('IMMEDIATE', 'DAILY', 'WEEKLY')),
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    user_agent  TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_property_alerts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL,
    tenant_id         UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    property_id       UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    alert_profile_id  UUID REFERENCES public.user_alert_profiles(id) ON DELETE SET NULL,
    match_score       NUMERIC(5,2) NOT NULL,
    match_type        TEXT NOT NULL CHECK (match_type IN ('EXACT', 'NEAR')),
    ai_summary        TEXT,
    notified_channels TEXT[] DEFAULT ARRAY[]::TEXT[],
    last_notified_price NUMERIC(14,2),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, property_id)
);

-- =====================================================================
-- 3. MARKETPLACE DE PARCEIROS + SPLIT PAYMENT
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.partners (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id              UUID,
    name                 TEXT NOT NULL,
    category             TEXT NOT NULL CHECK (category IN (
                             'CORRETOR', 'ADVOGADO', 'ADMINISTRADOR',
                             'DESPACHANTE', 'PEDREIRO_REFORMA', 'ENGENHEIRO_ARQUITETO', 'AVALIADOR'
                         )),
    registration_code    TEXT,
    city                 TEXT NOT NULL,
    state                TEXT NOT NULL CHECK (char_length(state) = 2),
    phone                TEXT,
    email                TEXT,
    specialty            TEXT,
    trust_score          NUMERIC(5,2) NOT NULL DEFAULT 85.00,
    rating               NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    completed_jobs_count INTEGER NOT NULL DEFAULT 0,
    split_provider       TEXT DEFAULT 'ASAAS' CHECK (split_provider IN ('ASAAS', 'PAGARME', 'STRIPE_CONNECT')),
    split_account_id     TEXT,
    pix_key              TEXT,
    approval_status      TEXT NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'SUSPENDED')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id      UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(14,2) NOT NULL CHECK (price > 0),
    billing_model   TEXT NOT NULL DEFAULT 'FIXED' CHECK (billing_model IN ('FIXED', 'PER_SQM', 'COMMISSION_PCT', 'HOURLY')),
    turnaround_days INTEGER NOT NULL DEFAULT 3,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_orders (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    buyer_user_id        UUID NOT NULL,
    partner_id           UUID NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
    service_id           UUID REFERENCES public.partner_services(id) ON DELETE SET NULL,
    property_id          UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    service_title        TEXT NOT NULL,
    gross_amount         NUMERIC(14,2) NOT NULL CHECK (gross_amount > 0),
    platform_fee_pct     NUMERIC(5,2) NOT NULL,
    platform_fee_amount  NUMERIC(14,2) NOT NULL,
    tenant_fee_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
    tenant_fee_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    partner_net_amount   NUMERIC(14,2) NOT NULL,
    split_provider       TEXT NOT NULL DEFAULT 'ASAAS',
    split_external_id    TEXT,
    status               TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT' CHECK (status IN (
                             'AWAITING_PAYMENT', 'ESCROW_HELD', 'IN_PROGRESS',
                             'COMPLETED_RELEASED', 'DISPUTED', 'REFUNDED', 'CANCELLED'
                         )),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at          TIMESTAMPTZ
);

-- =====================================================================
-- 4. ÍNDICES E ROW LEVEL SECURITY (RLS)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants(custom_domain);
CREATE INDEX IF NOT EXISTS idx_alert_profiles_user ON public.user_alert_profiles(user_id, active);
CREATE INDEX IF NOT EXISTS idx_property_alerts_user ON public.user_property_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partners_category_uf ON public.partners(category, state, approval_status);
CREATE INDEX IF NOT EXISTS idx_service_orders_buyer ON public.service_orders(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_partner ON public.service_orders(partner_id, status);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alert_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_property_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para usuários autenticados (Supabase Auth) — idempotentes
DROP POLICY IF EXISTS "user_own_alert_profiles" ON public.user_alert_profiles;
CREATE POLICY "user_own_alert_profiles" ON public.user_alert_profiles
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_own_push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "user_own_push_subscriptions" ON public.push_subscriptions
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_own_property_alerts" ON public.user_property_alerts;
CREATE POLICY "user_own_property_alerts" ON public.user_property_alerts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "public_read_approved_partners" ON public.partners;
CREATE POLICY "public_read_approved_partners" ON public.partners
    FOR SELECT USING (approval_status = 'APPROVED');

DROP POLICY IF EXISTS "public_read_active_partner_services" ON public.partner_services;
CREATE POLICY "public_read_active_partner_services" ON public.partner_services
    FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "buyer_read_own_orders" ON public.service_orders;
CREATE POLICY "buyer_read_own_orders" ON public.service_orders
    FOR SELECT USING (auth.uid() = buyer_user_id);

DROP POLICY IF EXISTS "public_read_active_tenants" ON public.tenants;
CREATE POLICY "public_read_active_tenants" ON public.tenants
    FOR SELECT USING (active = TRUE);

-- =====================================================================
-- 5. COLUNAS ESTENDIDAS EM public.properties + SEED DE TENANTS PADRÃO
-- =====================================================================
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS zipcode TEXT,
    ADD COLUMN IF NOT EXISTS useful_area NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS first_auction_value NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS second_auction_value NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS first_auction_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS second_auction_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auction_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS registration_number TEXT,
    ADD COLUMN IF NOT EXISTS district TEXT,
    ADD COLUMN IF NOT EXISTS registry_office TEXT,
    ADD COLUMN IF NOT EXISTS municipal_registration TEXT,
    ADD COLUMN IF NOT EXISTS accepts_fgts BOOLEAN,
    ADD COLUMN IF NOT EXISTS occupied BOOLEAN,
    ADD COLUMN IF NOT EXISTS condominium_notes TEXT,
    ADD COLUMN IF NOT EXISTS tax_notes TEXT,
    ADD COLUMN IF NOT EXISTS auction_notice_number TEXT,
    ADD COLUMN IF NOT EXISTS auction_notice_item TEXT,
    ADD COLUMN IF NOT EXISTS auctioneer TEXT,
    ADD COLUMN IF NOT EXISTS payment_conditions TEXT,
    ADD COLUMN IF NOT EXISTS max_installments INTEGER,
    ADD COLUMN IF NOT EXISTS min_down_payment NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS min_installment_value NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS raw_detail_data JSONB;

INSERT INTO public.tenants (
    id, slug, brand_name, tagline, logo_url, show_logo,
    primary_color, accent_color, support_email, show_intro_splash,
    platform_fee_pct, tenant_fee_pct
) VALUES
(
    '00000000-0000-4000-8000-000000000001',
    'whitelabel',
    'Auction OS',
    'Inteligência em Leilões Imobiliários',
    NULL,
    FALSE,
    '#0f172a',
    '#2563eb',
    'suporte@suaempresa.com.br',
    FALSE,
    10.00,
    3.00
),
(
    '00000000-0000-4000-8000-000000000002',
    'g2',
    'G2 AUCTION',
    'O passo a passo para arrematar seu imóvel',
    '/logo/logo.jpeg',
    TRUE,
    '#ea580c',
    '#dc2626',
    'contato@g2auction.com.br',
    TRUE,
    10.00,
    0.00
)
ON CONFLICT (slug) DO NOTHING;
