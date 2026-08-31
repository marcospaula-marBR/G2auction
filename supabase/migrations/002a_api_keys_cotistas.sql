-- =====================================================================
-- PARTE 1/4 — Tabelas de apoio: api_keys e cotistas
-- Cole este bloco no SQL Editor do Supabase e clique em RUN.
-- Aguarde confirmar "Success" antes de rodar a Parte 2.
-- =====================================================================

-- Tabela de API Keys para monetização e rate limiting
CREATE TABLE IF NOT EXISTS public.api_keys (
    id              SERIAL PRIMARY KEY,
    key             TEXT UNIQUE NOT NULL,
    owner_email     TEXT NOT NULL,
    plan            TEXT DEFAULT 'FREE'
                    CHECK (plan IN ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE')),
    requests_count  INTEGER DEFAULT 0,
    monthly_limit   INTEGER DEFAULT 100,
    active          BOOLEAN DEFAULT TRUE,
    last_reset_at   TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key   ON public.api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_email ON public.api_keys(owner_email);

-- Tabela de Cotistas (Investidores para SmartMatch e co-investimento)
CREATE TABLE IF NOT EXISTS public.cotistas (
    id                  SERIAL PRIMARY KEY,
    nome                TEXT NOT NULL,
    email               TEXT UNIQUE NOT NULL,
    telefone            TEXT,
    regiao_interesse    TEXT CHECK (regiao_interesse IN (
                            'AC','AL','AP','AM','BA','CE','DF','ES','GO',
                            'MA','MT','MS','MG','PA','PB','PR','PE','PI',
                            'RJ','RN','RS','RO','RR','SC','SP','SE','TO'
                        )),
    perfil_risco        TEXT DEFAULT 'CONSERVADOR'
                        CHECK (perfil_risco IN ('CONSERVADOR', 'ARROJADO')),
    ativo               BOOLEAN DEFAULT TRUE,
    criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotistas_email  ON public.cotistas(email);
CREATE INDEX IF NOT EXISTS idx_cotistas_regiao ON public.cotistas(regiao_interesse);
