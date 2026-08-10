-- Migration: 001_create_properties_schema.sql
-- Descrição: Criação das tabelas unificadas public.properties, public.property_photos e public.property_documents com campos de metadados da base da CAIXA (source_generated_at, source_fetched_at, source_file_url, source_file_hash)

-- 1. TABELA PRINCIPAL DE IMÓVEIS
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL DEFAULT 'CAIXA',
    source_property_id TEXT NOT NULL,
    title TEXT,
    property_type TEXT,
    sale_modality TEXT,
    state TEXT,
    city TEXT,
    neighborhood TEXT,
    address TEXT,
    zipcode TEXT,
    appraisal_value NUMERIC(14,2),
    sale_value NUMERIC(14,2),
    current_minimum_value NUMERIC(14,2),
    first_auction_value NUMERIC(14,2),
    second_auction_value NUMERIC(14,2),
    discount_percentage NUMERIC(8,2),
    bedrooms INTEGER,
    parking_spaces INTEGER,
    total_area NUMERIC(12,2),
    private_area NUMERIC(12,2),
    useful_area NUMERIC(12,2),
    land_area NUMERIC(12,2),
    registration_number TEXT,
    district TEXT,
    registry_office TEXT,
    municipal_registration TEXT,
    description TEXT,
    accepts_financing BOOLEAN,
    accepts_fgts BOOLEAN,
    occupied BOOLEAN,
    condominium_notes TEXT,
    tax_notes TEXT,
    auction_notice_number TEXT,
    auction_notice_item TEXT,
    auctioneer TEXT,
    first_auction_date TIMESTAMPTZ,
    second_auction_date TIMESTAMPTZ,
    source_url TEXT,
    main_photo_url TEXT,
    status TEXT DEFAULT 'ACTIVE',
    source_hash TEXT,
    source_generated_at DATE,
    source_fetched_at TIMESTAMPTZ,
    source_file_url TEXT,
    source_file_hash TEXT,
    enrichment_status TEXT DEFAULT 'PENDING',
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    enriched_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    raw_list_data JSONB,
    raw_detail_data JSONB,
    CONSTRAINT properties_source_property_id_key UNIQUE (source, source_property_id)
);

-- Indexação para busca rápida por origem, UF e status
CREATE INDEX IF NOT EXISTS idx_properties_source_id ON public.properties(source, source_property_id);
CREATE INDEX IF NOT EXISTS idx_properties_state_city ON public.properties(state, city);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);

-- 2. TABELA DE FOTOS
CREATE TABLE IF NOT EXISTS public.property_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    is_main BOOLEAN DEFAULT FALSE,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT property_photos_property_url_key UNIQUE (property_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_photos_property_id ON public.property_photos(property_id);

-- 3. TABELA DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.property_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    document_type TEXT,
    title TEXT,
    source_url TEXT NOT NULL,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT property_documents_property_url_key UNIQUE (property_id, source_url)
);

CREATE INDEX IF NOT EXISTS idx_documents_property_id ON public.property_documents(property_id);
