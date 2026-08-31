-- =====================================================================
-- PARTE 2/4 — Tabela principal de Imóveis + índices
-- Rode APÓS confirmar sucesso da Parte 1.
-- =====================================================================

-- Tabela de Imóveis da API v3
-- (coexiste com public.properties da migration 001 — Caixa CSV)
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

CREATE INDEX IF NOT EXISTS idx_imoveis_estado_cidade  ON public.imoveis(estado, cidade);
CREATE INDEX IF NOT EXISTS idx_imoveis_preco_min      ON public.imoveis(preco_minimo);
CREATE INDEX IF NOT EXISTS idx_imoveis_comitente      ON public.imoveis(comitente);
CREATE INDEX IF NOT EXISTS idx_imoveis_etapa          ON public.imoveis(etapa_kanban);
CREATE INDEX IF NOT EXISTS idx_imoveis_ativo          ON public.imoveis(ativo);
CREATE INDEX IF NOT EXISTS idx_imoveis_fliplink_slug  ON public.imoveis(fliplink_slug);
