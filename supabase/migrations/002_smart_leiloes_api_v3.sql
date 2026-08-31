-- =====================================================================
-- ATENÇÃO: Este arquivo monolítico causou timeout no Supabase SQL Editor.
-- Use os arquivos divididos na seguinte ORDEM:
--
--   1. 002a_api_keys_cotistas.sql  → tabelas api_keys e cotistas
--   2. 002b_imoveis.sql            → tabela imoveis + índices
--   3. 002c_tabelas_filhas.sql     → M2M, despesas, leads, contratos
--   4. 002d_rls_trigger.sql        → RLS + trigger updated_at
--
-- Cole cada arquivo individualmente no SQL Editor e aguarde "Success".
-- =====================================================================
--
-- Arquivo original mantido abaixo como referência completa:
-- =====================================================================

-- ── Habilitar extensão de UUID (já habilitada no Supabase por padrão) ───
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── API Keys (Monetização / Rate Limiting) ──────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_api_keys_key ON public.api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_email ON public.api_keys(owner_email);

-- ── Cotistas (Investidores para SmartMatch e co-investimento) ────────────
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

CREATE INDEX IF NOT EXISTS idx_cotistas_email ON public.cotistas(email);
CREATE INDEX IF NOT EXISTS idx_cotistas_regiao ON public.cotistas(regiao_interesse);

-- ── Imóveis da API v3 (tabela própria — coexiste com public.properties) ──
-- Nota: esta tabela é usada pela API v3 internamente.
-- Os imóveis da Caixa ficam em public.properties (migration 001).
CREATE TABLE IF NOT EXISTS public.imoveis (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    comitente            TEXT DEFAULT 'CAIXA',
    source_property_id   TEXT,
    titulo               TEXT NOT NULL,
    tipo_imovel          TEXT,
    estado               TEXT NOT NULL CHECK (char_length(estado) = 2),
    cidade               TEXT,
    bairro               TEXT,
    endereco             TEXT,
    lat                  DOUBLE PRECISION,
    lng                  DOUBLE PRECISION,
    preco_avaliacao      NUMERIC(14,2),
    preco_minimo         NUMERIC(14,2) NOT NULL,
    desconto_percentual  NUMERIC(8,2),
    area_total           NUMERIC(12,2),
    area_privativa       NUMERIC(12,2),
    quartos              INTEGER,
    vagas_garagem        INTEGER,
    aceita_financiamento BOOLEAN,
    ocupacao             TEXT DEFAULT 'DESCONHECIDA'
                         CHECK (ocupacao IN ('OCUPADO', 'DESOCUPADO', 'DESCONHECIDA')),
    data_leilao_1        TIMESTAMPTZ,
    data_leilao_2        TIMESTAMPTZ,
    link_edital          TEXT,
    link_matricula       TEXT,
    link_origem          TEXT UNIQUE NOT NULL,
    foto_principal       TEXT,
    descricao            TEXT,
    etapa_kanban         TEXT DEFAULT 'estoque'
                         CHECK (etapa_kanban IN (
                             'estoque','triagem_financeira','triagem_juridica',
                             'decisao','leilao','registro','desocupacao','reforma','venda'
                         )),
    ativo                BOOLEAN DEFAULT TRUE,
    data_captura         TIMESTAMPTZ DEFAULT NOW(),
    data_atualizacao     TIMESTAMPTZ DEFAULT NOW(),
    fliplink_ativo       BOOLEAN DEFAULT FALSE,
    fliplink_slug        TEXT UNIQUE,
    preco_venda_fliplink NUMERIC(14,2)
);

CREATE INDEX IF NOT EXISTS idx_imoveis_estado_cidade ON public.imoveis(estado, cidade);
CREATE INDEX IF NOT EXISTS idx_imoveis_preco_min ON public.imoveis(preco_minimo);
CREATE INDEX IF NOT EXISTS idx_imoveis_comitente ON public.imoveis(comitente);
CREATE INDEX IF NOT EXISTS idx_imoveis_etapa ON public.imoveis(etapa_kanban);
CREATE INDEX IF NOT EXISTS idx_imoveis_ativo ON public.imoveis(ativo);
CREATE INDEX IF NOT EXISTS idx_imoveis_fliplink_slug ON public.imoveis(fliplink_slug);

-- ── Cotistas <> Imóveis (M2M) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.imovel_cotistas (
    imovel_id       TEXT REFERENCES public.imoveis(id) ON DELETE CASCADE,
    cotista_id      INTEGER REFERENCES public.cotistas(id) ON DELETE CASCADE,
    percentual_cota NUMERIC(5,2) NOT NULL CHECK (percentual_cota > 0 AND percentual_cota <= 100),
    data_entrada    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (imovel_id, cotista_id)
);

-- ── Despesas (controle financeiro por imóvel) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.despesas (
    id              SERIAL PRIMARY KEY,
    imovel_id       TEXT REFERENCES public.imoveis(id) ON DELETE CASCADE,
    descricao       TEXT NOT NULL,
    categoria       TEXT CHECK (categoria IN ('condominio','iptu','reforma','honorarios','outros')),
    valor           NUMERIC(14,2) NOT NULL CHECK (valor > 0),
    data_vencimento DATE NOT NULL,
    paga            BOOLEAN DEFAULT FALSE,
    recorrente      BOOLEAN DEFAULT FALSE,
    criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_despesas_imovel ON public.despesas(imovel_id);
CREATE INDEX IF NOT EXISTS idx_despesas_paga ON public.despesas(paga);

-- ── Leads (captura FlipLink) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
    id               SERIAL PRIMARY KEY,
    imovel_id        TEXT REFERENCES public.imoveis(id) ON DELETE CASCADE,
    nome             TEXT NOT NULL,
    email            TEXT NOT NULL,
    telefone         TEXT NOT NULL,
    mensagem         TEXT,
    origem_lead      TEXT DEFAULT 'fliplink',
    data_recebimento TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_imovel ON public.leads(imovel_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);

-- ── Contratos (assinatura digital / SPE) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contratos (
    id                           SERIAL PRIMARY KEY,
    imovel_id                    TEXT REFERENCES public.imoveis(id) ON DELETE CASCADE,
    cotista_id                   INTEGER REFERENCES public.cotistas(id) ON DELETE SET NULL,
    titulo_contrato              TEXT NOT NULL,
    tipo_contrato                TEXT DEFAULT 'SPE'
                                 CHECK (tipo_contrato IN ('SPE','GAVETA','PERMUTA','MANDATO')),
    status_assinatura            TEXT DEFAULT 'pendente'
                                 CHECK (status_assinatura IN ('pendente','assinado','cancelado','expirado')),
    verificacao_facial_concluida BOOLEAN DEFAULT FALSE,
    hash_documento               TEXT,
    data_criacao                 TIMESTAMPTZ DEFAULT NOW(),
    data_assinatura              TIMESTAMPTZ,
    data_expiracao               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contratos_imovel ON public.contratos(imovel_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cotista ON public.contratos(cotista_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON public.contratos(status_assinatura);

-- ── RLS (Row Level Security) básico para Supabase ────────────────────────
-- Habilita RLS mas permite acesso total para service_role (a API usa service_role)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- Service role bypassa RLS por padrão no Supabase — sem políticas extras necessárias
-- para acesso pela API backend. Adicionar políticas de usuário final conforme necessário.

-- ── Trigger: atualizar data_atualizacao automaticamente ──────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_imoveis_updated_at
    BEFORE UPDATE ON public.imoveis
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
