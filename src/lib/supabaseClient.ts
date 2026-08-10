import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const memoryStore = {
  properties: new Map<string, any>(),
  photos: new Map<string, any[]>(),
  documents: new Map<string, any[]>(),
  imports: new Array<any>(),
};

export interface PropertyUpsertPayload {
  source: string;
  source_property_id: string;
  title?: string | null;
  property_type?: string | null;
  sale_modality?: string | null;
  state?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  zipcode?: string | null;
  appraisal_value?: number | null;
  sale_value?: number | null;
  current_minimum_value?: number | null;
  first_auction_value?: number | null;
  second_auction_value?: number | null;
  discount_percentage?: number | null;
  calculated_discount_percentage?: number | null;
  bedrooms?: number | null;
  parking_spaces?: number | null;
  total_area?: number | null;
  private_area?: number | null;
  useful_area?: number | null;
  land_area?: number | null;
  occupancy_status?: string | null;
  registration_number?: string | null;
  district?: string | null;
  registry_office?: string | null;
  municipal_registration?: string | null;
  description?: string | null;
  accepts_financing?: boolean | null;
  accepts_fgts?: boolean | null;
  occupied?: boolean | null;
  condominium_notes?: string | null;
  tax_notes?: string | null;
  auction_notice_number?: string | null;
  auction_notice_item?: string | null;
  auctioneer?: string | null;
  first_auction_date?: string | null;
  second_auction_date?: string | null;
  source_url?: string | null;
  main_photo_url?: string | null;
  status?: string;
  source_hash?: string | null;
  source_generated_at?: string | null;
  source_fetched_at?: string | null;
  source_file_url?: string | null;
  source_file_hash?: string | null;
  enrichment_status?: string;
  raw_list_data?: any;
  raw_detail_data?: any;
}

export interface PhotoUpsertPayload {
  source_url: string;
  position: number;
  is_main: boolean;
}

export interface DocumentUpsertPayload {
  document_type: string | null;
  title: string | null;
  source_url: string;
}

export async function upsertPropertyToSupabase(
  propertyData: PropertyUpsertPayload,
  photos: PhotoUpsertPayload[] = [],
  documents: DocumentUpsertPayload[] = []
): Promise<{ success: boolean; propertyId: string; record: any; isMemoryFallback: boolean; error?: string }> {
  const compositeKey = `${propertyData.source}_${propertyData.source_property_id}`;
  
  if (supabase) {
    try {
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .upsert(propertyData, {
          onConflict: 'source,source_property_id',
        })
        .select()
        .single();

      if (propError) throw propError;
      const internalId = propData.id;

      if (photos.length > 0) {
        const photoRecords = photos.map((p) => ({
          property_id: internalId,
          source_url: p.source_url,
          position: p.position,
          is_main: p.is_main,
        }));

        await supabase.from('property_photos').upsert(photoRecords, {
          onConflict: 'property_id,source_url',
        });
      }

      if (documents.length > 0) {
        const docRecords = documents.map((d) => ({
          property_id: internalId,
          document_type: d.document_type,
          title: d.title,
          source_url: d.source_url,
        }));

        await supabase.from('property_documents').upsert(docRecords, {
          onConflict: 'property_id,source_url',
        });
      }

      return {
        success: true,
        propertyId: internalId,
        record: propData,
        isMemoryFallback: false,
      };
    } catch (err: any) {
      console.warn('[Supabase Client] Falha ao gravar no Supabase, alternando para store de teste:', err.message);
    }
  }

  const mockId = `sb-uuid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const existing = memoryStore.properties.get(compositeKey);
  const internalId = existing?.id || mockId;

  const fullRecord = {
    id: internalId,
    ...propertyData,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };

  memoryStore.properties.set(compositeKey, fullRecord);
  memoryStore.photos.set(internalId, photos);
  memoryStore.documents.set(internalId, documents);

  return {
    success: true,
    propertyId: internalId,
    record: fullRecord,
    isMemoryFallback: true,
  };
}

/**
 * UPSERT EM LOTES (Batches de 250 registros) conforme Seções 13 e 14.
 */
export async function batchUpsertPropertiesToSupabase(
  propertiesPayload: PropertyUpsertPayload[],
  batchSize: number = 250
): Promise<{
  success: boolean;
  totalProcessed: number;
  inserted: number;
  updated: number;
  errors: number;
  isMemoryFallback: boolean;
  errorMessages: string[];
}> {
  let totalProcessed = 0;
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  let isMemoryFallback = false;
  const errorMessages: string[] = [];

  for (let i = 0; i < propertiesPayload.length; i += batchSize) {
    const chunk = propertiesPayload.slice(i, i + batchSize);

    if (supabase) {
      try {
        const { error } = await supabase
          .from('properties')
          .upsert(chunk, { onConflict: 'source,source_property_id' });

        if (error) {
          errors += chunk.length;
          errorMessages.push(`Lote ${Math.floor(i / batchSize) + 1} falhou: ${error.message}`);
        } else {
          totalProcessed += chunk.length;
          // Estimativa de alteração com base no lote
          updated += chunk.length;
        }
      } catch (err: any) {
        errors += chunk.length;
        errorMessages.push(`Lote ${Math.floor(i / batchSize) + 1} exceção: ${err.message}`);
      }
    } else {
      isMemoryFallback = true;
      chunk.forEach((p) => {
        const compositeKey = `${p.source}_${p.source_property_id}`;
        const existing = memoryStore.properties.get(compositeKey);
        const internalId = existing?.id || `sb-mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        
        memoryStore.properties.set(compositeKey, {
          id: internalId,
          ...p,
          created_at: existing?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (existing) updated++;
        else inserted++;
        totalProcessed++;
      });
    }
  }

  return {
    success: errors === 0,
    totalProcessed,
    inserted,
    updated,
    errors,
    isMemoryFallback,
    errorMessages,
  };
}

/**
 * RECONCILIAÇÃO DE IMÓVEIS DA UF (Seções 15 & 46)
 * Marca imóveis do estado importado não presentes no CSV atual como 'POSSIBLY_REMOVED'.
 */
export async function reconcileMissingPropertiesByState(
  uf: string,
  currentImportedPropertyIds: Set<string>
): Promise<{ success: boolean; countPossiblyRemoved: number }> {
  const ufUpper = (uf || '').trim().toUpperCase();
  let countPossiblyRemoved = 0;

  if (supabase) {
    try {
      // Buscar todos os imóveis ativos do estado no banco
      const { data: existingActive, error } = await supabase
        .from('properties')
        .select('id, source_property_id')
        .eq('source', 'CAIXA')
        .eq('state', ufUpper)
        .eq('status', 'ACTIVE');

      if (!error && existingActive) {
        const missingIds = existingActive
          .filter((p) => !currentImportedPropertyIds.has(p.source_property_id))
          .map((p) => p.id);

        if (missingIds.length > 0) {
          const { error: updateErr } = await supabase
            .from('properties')
            .update({ status: 'POSSIBLY_REMOVED', updated_at: new Date().toISOString() })
            .in('id', missingIds);

          if (!updateErr) {
            countPossiblyRemoved = missingIds.length;
          }
        }
      }
    } catch (err: any) {
      console.warn('[Reconcile Error]', err.message);
    }
  } else {
    // Memory store fallback
    memoryStore.properties.forEach((prop) => {
      if (prop.source === 'CAIXA' && prop.state === ufUpper && prop.status === 'ACTIVE') {
        if (!currentImportedPropertyIds.has(prop.source_property_id)) {
          prop.status = 'POSSIBLY_REMOVED';
          countPossiblyRemoved++;
        }
      }
    });
  }

  return { success: true, countPossiblyRemoved };
}

/**
 * REGISTRO DE LOG NA TABELA caixa_imports (Seção 34)
 */
export async function recordCaixaImportLog(logData: {
  uf: string;
  source_generated_at: string | null;
  source_file_hash: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  inserted: number;
  updated: number;
  unchanged: number;
  possibly_removed: number;
  errors: number;
  execution_time_seconds: number;
}): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('caixa_imports').insert([logData]);
    } catch (err: any) {
      console.warn('[Import Log Error]', err.message);
    }
  } else {
    memoryStore.imports.push({
      id: `imp-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...logData,
    });
  }
}

export async function verifySavedPropertyInSupabase(
  source: string,
  sourcePropertyId: string
): Promise<{ success: boolean; record: any; photos: any[]; documents: any[]; isMemoryFallback: boolean }> {
  const compositeKey = `${source}_${sourcePropertyId}`;

  if (supabase) {
    try {
      const { data: prop, error: propErr } = await supabase
        .from('properties')
        .select('*')
        .eq('source', source)
        .eq('source_property_id', sourcePropertyId)
        .single();

      if (propErr) throw propErr;

      const { data: photos } = await supabase
        .from('property_photos')
        .select('*')
        .eq('property_id', prop.id)
        .order('position', { ascending: true });

      const { data: documents } = await supabase
        .from('property_documents')
        .select('*')
        .eq('property_id', prop.id);

      return {
        success: true,
        record: prop,
        photos: photos || [],
        documents: documents || [],
        isMemoryFallback: false,
      };
    } catch (e: any) {
      console.warn('[Supabase Verify] Falha ao consultar Supabase diretamente:', e.message);
    }
  }

  const record = memoryStore.properties.get(compositeKey) || null;
  const internalId = record?.id;
  const photos = internalId ? memoryStore.photos.get(internalId) || [] : [];
  const documents = internalId ? memoryStore.documents.get(internalId) || [] : [];

  return {
    success: Boolean(record),
    record,
    photos,
    documents,
    isMemoryFallback: true,
  };
}

/**
 * PARÂMETROS DO FILTRO DO CATÁLOGO DE IMÓVEIS (Seção 18 a 33)
 */
export interface PropertyFilterParams {
  state?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  appraisalMin?: number;
  appraisalMax?: number;
  discountMin?: number;
  financing?: boolean | null;
  occupancy?: 'OCCUPIED' | 'VACANT' | 'UNKNOWN' | null;
  areaType?: 'private_area' | 'total_area' | 'land_area';
  areaMin?: number;
  areaMax?: number;
  propertyType?: string;
  saleModality?: string;

  sortBy?: 'discount_desc' | 'price_asc' | 'appraisal_desc' | 'area_desc' | 'recent_desc';
  page?: number;
  pageSize?: number;
}

/**
 * CONSULTA DINÂMICA AO SUPABASE / BANCO DE DADOS (Seções 30, 31, 32, 33)
 */
export async function queryPropertiesFromSupabase(
  filters: PropertyFilterParams
): Promise<{
  data: any[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isMemoryFallback: boolean;
}> {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 24;
  const fromIndex = (page - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  if (supabase) {
    try {
      let query = supabase
        .from('properties')
        .select('*', { count: 'exact' })
        .eq('source', 'CAIXA')
        .eq('status', 'ACTIVE');

      // Aplicação combinada de filtros (AND logic - Seção 30)
      if (filters.state) query = query.eq('state', filters.state.toUpperCase());
      if (filters.city) query = query.ilike('city', filters.city.trim());

      if (filters.priceMin !== undefined && filters.priceMin !== null) query = query.gte('current_minimum_value', filters.priceMin);
      if (filters.priceMax !== undefined && filters.priceMax !== null) query = query.lte('current_minimum_value', filters.priceMax);

      if (filters.appraisalMin !== undefined && filters.appraisalMin !== null) query = query.gte('appraisal_value', filters.appraisalMin);
      if (filters.appraisalMax !== undefined && filters.appraisalMax !== null) query = query.lte('appraisal_value', filters.appraisalMax);

      if (filters.discountMin !== undefined && filters.discountMin !== null) query = query.gte('discount_percentage', filters.discountMin);

      if (filters.financing !== undefined && filters.financing !== null) query = query.eq('accepts_financing', filters.financing);

      if (filters.occupancy) query = query.eq('occupancy_status', filters.occupancy);

      // Filtro de área via allowlist segura (Seção 26 & 31)
      const allowedAreaCols = ['private_area', 'total_area', 'land_area'];
      const areaCol = filters.areaType && allowedAreaCols.includes(filters.areaType) ? filters.areaType : 'private_area';

      if (filters.areaMin !== undefined && filters.areaMin !== null) query = query.gte(areaCol, filters.areaMin);
      if (filters.areaMax !== undefined && filters.areaMax !== null) query = query.lte(areaCol, filters.areaMax);

      if (filters.propertyType && filters.propertyType !== 'Todos') query = query.eq('property_type', filters.propertyType);
      if (filters.saleModality && filters.saleModality !== 'Todas') query = query.eq('sale_modality', filters.saleModality);

      // Ordenação (Seção 32)
      switch (filters.sortBy) {
        case 'price_asc':
          query = query.order('current_minimum_value', { ascending: true, nullsFirst: false });
          break;
        case 'appraisal_desc':
          query = query.order('appraisal_value', { ascending: false, nullsFirst: false });
          break;
        case 'area_desc':
          query = query.order(areaCol, { ascending: false, nullsFirst: false });
          break;
        case 'recent_desc':
          query = query.order('first_seen_at', { ascending: false });
          break;
        case 'discount_desc':
        default:
          query = query.order('discount_percentage', { ascending: false, nullsFirst: false });
          break;
      }

      query = query.range(fromIndex, toIndex);

      const { data, count, error } = await query;

      if (!error && data) {
        const total = count || data.length;
        return {
          data,
          totalCount: total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
          isMemoryFallback: false,
        };
      }
    } catch (e: any) {
      console.warn('[Catalog Query Error]', e.message);
    }
  }

  // Fallback para memory store
  let filtered = Array.from(memoryStore.properties.values()).filter((p) => p.source === 'CAIXA' && p.status !== 'REMOVED');

  if (filters.state) filtered = filtered.filter((p) => p.state === filters.state?.toUpperCase());
  if (filters.city) filtered = filtered.filter((p) => p.city?.toLowerCase().includes(filters.city!.toLowerCase()));

  if (filters.priceMin !== undefined && filters.priceMin !== null) filtered = filtered.filter((p) => (p.current_minimum_value || p.sale_value || 0) >= filters.priceMin!);
  if (filters.priceMax !== undefined && filters.priceMax !== null) filtered = filtered.filter((p) => (p.current_minimum_value || p.sale_value || 0) <= filters.priceMax!);

  if (filters.appraisalMin !== undefined && filters.appraisalMin !== null) filtered = filtered.filter((p) => (p.appraisal_value || 0) >= filters.appraisalMin!);
  if (filters.appraisalMax !== undefined && filters.appraisalMax !== null) filtered = filtered.filter((p) => (p.appraisal_value || 0) <= filters.appraisalMax!);

  if (filters.discountMin !== undefined && filters.discountMin !== null) filtered = filtered.filter((p) => (p.discount_percentage || 0) >= filters.discountMin!);

  if (filters.financing !== undefined && filters.financing !== null) filtered = filtered.filter((p) => p.accepts_financing === filters.financing);
  if (filters.occupancy) filtered = filtered.filter((p) => (p.occupancy_status || 'UNKNOWN') === filters.occupancy);

  if (filters.propertyType && filters.propertyType !== 'Todos') filtered = filtered.filter((p) => p.property_type === filters.propertyType);
  if (filters.saleModality && filters.saleModality !== 'Todas') filtered = filtered.filter((p) => p.sale_modality === filters.saleModality);

  // Ordenação memory store
  const areaCol = filters.areaType || 'private_area';
  filtered.sort((a, b) => {
    if (filters.sortBy === 'price_asc') return (a.sale_value || 0) - (b.sale_value || 0);
    if (filters.sortBy === 'appraisal_desc') return (b.appraisal_value || 0) - (a.appraisal_value || 0);
    if (filters.sortBy === 'area_desc') return (b[areaCol] || 0) - (a[areaCol] || 0);
    if (filters.sortBy === 'recent_desc') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    return (b.discount_percentage || 0) - (a.discount_percentage || 0);
  });

  const total = filtered.length;
  const pagedData = filtered.slice(fromIndex, fromIndex + pageSize);

  return {
    data: pagedData,
    totalCount: total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    isMemoryFallback: true,
  };
}

/**
 * BUSCAR ESTADOS EXISTENTES NO BANCO (Seção 19)
 */
export async function fetchDistinctStatesFromSupabase(): Promise<string[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('state')
        .eq('source', 'CAIXA')
        .eq('status', 'ACTIVE');

      if (!error && data) {
        const ufs = Array.from(new Set(data.map((d) => d.state).filter(Boolean))).sort();
        if (ufs.length > 0) return ufs;
      }
    } catch (e: any) {
      console.warn('[Fetch States Error]', e.message);
    }
  }

  const ufs = Array.from(new Set(Array.from(memoryStore.properties.values()).map((p) => p.state).filter(Boolean))).sort();
  return ufs.length > 0 ? ufs : ['SP', 'RJ', 'MG', 'DF', 'PR', 'SC', 'RS', 'BA', 'CE', 'PE'];
}

/**
 * BUSCAR CIDADES DEPENDENTES DO ESTADO NO BANCO (Seção 20)
 */
export async function fetchDistinctCitiesByStateFromSupabase(uf: string): Promise<string[]> {
  const ufUpper = (uf || '').trim().toUpperCase();
  if (!ufUpper) return [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('city')
        .eq('source', 'CAIXA')
        .eq('state', ufUpper)
        .eq('status', 'ACTIVE');

      if (!error && data) {
        const cities = Array.from(new Set(data.map((d) => d.city).filter(Boolean))).sort();
        if (cities.length > 0) return cities;
      }
    } catch (e: any) {
      console.warn('[Fetch Cities Error]', e.message);
    }
  }

  const cities = Array.from(
    new Set(
      Array.from(memoryStore.properties.values())
        .filter((p) => p.state === ufUpper)
        .map((p) => p.city)
        .filter(Boolean)
    )
  ).sort();

  return cities;
}

/**
 * BUSCAR TIPOS DE IMÓVEIS EXISTENTES (Seção 27)
 */
export async function fetchDistinctPropertyTypesFromSupabase(): Promise<string[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('property_type')
        .eq('source', 'CAIXA')
        .eq('status', 'ACTIVE');

      if (!error && data) {
        const types = Array.from(new Set(data.map((d) => d.property_type).filter(Boolean))).sort();
        if (types.length > 0) return types;
      }
    } catch (e: any) {
      console.warn('[Fetch Types Error]', e.message);
    }
  }

  return ['Apartamento', 'Casa', 'Terreno', 'Comercial', 'Sala', 'Loja', 'Galpão', 'Prédio'];
}

/**
 * BUSCAR MODALIDADES DE VENDA EXISTENTES (Seção 28)
 */
export async function fetchDistinctSaleModalitiesFromSupabase(): Promise<string[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('sale_modality')
        .eq('source', 'CAIXA')
        .eq('status', 'ACTIVE');

      if (!error && data) {
        const mods = Array.from(new Set(data.map((d) => d.sale_modality).filter(Boolean))).sort();
        if (mods.length > 0) return mods;
      }
    } catch (e: any) {
      console.warn('[Fetch Modalities Error]', e.message);
    }
  }

  return ['Leilão SFI - Edital Único', '1º Leilão Caixa', '2º Leilão Caixa', 'Venda Direta Online', 'Licitação Aberta'];
}

/**
 * ESTATÍSTICAS RESUMIDAS DA BASE PARA O CABEÇALHO DO CATÁLOGO (Seção 17 & 45)
 */
export async function fetchCatalogSummaryStatsFromSupabase(): Promise<{
  totalActiveCount: number;
  lastImportDate: string | null;
  lastImportGeneratedAt: string | null;
}> {
  if (supabase) {
    try {
      const { count } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'CAIXA')
        .eq('status', 'ACTIVE');

      const { data: lastLog } = await supabase
        .from('caixa_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        totalActiveCount: count || 0,
        lastImportDate: lastLog?.created_at || null,
        lastImportGeneratedAt: lastLog?.source_generated_at || null,
      };
    } catch (e: any) {
      console.warn('[Summary Stats Error]', e.message);
    }
  }

  return {
    totalActiveCount: memoryStore.properties.size,
    lastImportDate: new Date().toISOString(),
    lastImportGeneratedAt: '2026-08-07',
  };
}
