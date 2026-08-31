-- =====================================================================
-- PARTE 3/4 — Tabelas filhas: M2M, despesas, leads e contratos
-- Rode APÓS confirmar sucesso das Partes 1 e 2.
-- =====================================================================

-- Associação Imóveis <> Cotistas (Muitos-para-Muitos)
CREATE TABLE IF NOT EXISTS public.imovel_cotistas (
    imovel_id       TEXT REFERENCES public.imoveis(id) ON DELETE CASCADE,
    cotista_id      INTEGER REFERENCES public.cotistas(id) ON DELETE CASCADE,
    percentual_cota NUMERIC(5,2) NOT NULL CHECK (percentual_cota > 0 AND percentual_cota <= 100),
    data_entrada    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (imovel_id, cotista_id)
);

-- Despesas (controle financeiro por imóvel)
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
CREATE INDEX IF NOT EXISTS idx_despesas_paga   ON public.despesas(paga);

-- Leads (captura via portal FlipLink)
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
CREATE INDEX IF NOT EXISTS idx_leads_email  ON public.leads(email);

-- Contratos (assinatura digital / SPE / Gaveta)
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

CREATE INDEX IF NOT EXISTS idx_contratos_imovel   ON public.contratos(imovel_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cotista  ON public.contratos(cotista_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status   ON public.contratos(status_assinatura);
