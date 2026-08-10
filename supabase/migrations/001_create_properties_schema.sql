-- Migration: 001_create_properties_schema.sql
-- FASE 2: Schema completo para catálogo de imóveis CAIXA + Supabase

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),

  source text not null default 'CAIXA',
  source_property_id text not null,

  state text,
  city text,
  neighborhood text,
  address text,

  property_type text,

  sale_value numeric(14,2),
  current_minimum_value numeric(14,2),
  appraisal_value numeric(14,2),

  discount_percentage numeric(8,2),
  calculated_discount_percentage numeric(8,2),

  accepts_financing boolean,
  occupancy_status text default 'UNKNOWN',

  description text,
  sale_modality text,

  source_url text,

  total_area numeric(12,2),
  private_area numeric(12,2),
  land_area numeric(12,2),

  bedrooms integer,
  parking_spaces integer,

  main_photo_url text,

  source_generated_at date,
  source_fetched_at timestamptz default now(),

  source_file_url text,
  source_file_hash text,
  source_hash text,

  enrichment_status text default 'PENDING',
  status text default 'ACTIVE',

  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  updated_at timestamptz default now(),
  enriched_at timestamptz,

  raw_list_data jsonb,

  unique(source, source_property_id)
);

-- Tabela de Histórico de Importações da CAIXA (Seção 34 da especificação)
create table if not exists public.caixa_imports (
  id uuid primary key default gen_random_uuid(),

  uf text not null,

  source_generated_at date,
  source_fetched_at timestamptz default now(),

  source_file_hash text,
  filename text,

  status text default 'SUCCESS',

  total_rows integer default 0,
  valid_rows integer default 0,
  invalid_rows integer default 0,
  inserted integer default 0,
  updated integer default 0,
  unchanged integer default 0,
  possibly_removed integer default 0,
  errors integer default 0,
  execution_time_seconds numeric(8,2),

  created_at timestamptz default now()
);

-- Tabela de Fotos (Seção 45)
create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),

  property_id uuid not null
    references public.properties(id)
    on delete cascade,

  source_url text not null,

  position integer default 0,
  is_main boolean default false,

  first_seen_at timestamptz default now(),
  last_verified_at timestamptz default now(),

  unique(property_id, source_url)
);

-- Tabela de Documentos (Seção 46)
create table if not exists public.property_documents (
  id uuid primary key default gen_random_uuid(),

  property_id uuid not null
    references public.properties(id)
    on delete cascade,

  document_type text,
  title text,
  source_url text not null,

  first_seen_at timestamptz default now(),

  unique(property_id, source_url)
);

-- Índices de Alta Performance para o Catálogo e Filtros (Seção 39 & 40)
create index if not exists idx_properties_source_status on public.properties(source, status);
create index if not exists idx_properties_state_city on public.properties(state, city);
create index if not exists idx_properties_current_minimum_value on public.properties(current_minimum_value);
create index if not exists idx_properties_appraisal_value on public.properties(appraisal_value);
create index if not exists idx_properties_discount on public.properties(discount_percentage);
create index if not exists idx_properties_financing on public.properties(accepts_financing);
create index if not exists idx_properties_occupancy on public.properties(occupancy_status);
create index if not exists idx_properties_private_area on public.properties(private_area);
create index if not exists idx_properties_property_type on public.properties(property_type);
create index if not exists idx_properties_sale_modality on public.properties(sale_modality);
