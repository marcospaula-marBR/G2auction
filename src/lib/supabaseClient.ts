import { createClient } from '@supabase/supabase-js';
import { parseCaixaCsv } from '../utils/caixaListImporter';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const CACHE_KEY_PROPERTIES = 'g2_caixa_properties_store_v1';

const memoryStore = {
  properties: new Map<string, any>(),
  photos: new Map<string, any[]>(),
  documents: new Map<string, any[]>(),
  imports: new Array<any>(),
};

let seedPromise: Promise<void> | null = null;

export async function autoSeedDefaultCsvFromPublic(): Promise<void> {
  if (memoryStore.properties.size > 0) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const res = await fetch('/Lista_imoveis_SP.csv');
      if (res.ok) {
        const csvText = await res.text();
        const parseResult = parseCaixaCsv(csvText, 'SP', '/Lista_imoveis_SP.csv');
        if (parseResult.rows && parseResult.rows.length > 0) {
          parseResult.rows.forEach((p) => {
            const compositeKey = `${p.source}_${p.source_property_id}`;
            if (!memoryStore.properties.has(compositeKey)) {
              memoryStore.properties.set(compositeKey, {
                id: `sb-seed-${p.source_property_id}`,
                ...p,
                status: 'ACTIVE',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          });
          saveMemoryStoreToLocalStorage();
          console.log(`[Auto-Seed SP] ${parseResult.rows.length} imóveis e cidades populados de /Lista_imoveis_SP.csv.`);
        }
      }
    } catch (err: any) {
      console.warn('[Auto-Seed SP Error]', err.message);
    }
  })();

  return seedPromise;
}

export function saveMemoryStoreToLocalStorage() {
  try {
    const arrayData = Array.from(memoryStore.properties.entries());
    localStorage.setItem(CACHE_KEY_PROPERTIES, JSON.stringify(arrayData));
  } catch (e: any) {
    console.warn('[LocalStorage Save Error]', e);
  }
}

export function loadMemoryStoreFromLocalStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PROPERTIES);
    if (raw) {
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        entries.forEach(([k, v]: [string, any]) => {
          memoryStore.properties.set(k, v);
        });
      }
    }
  } catch (e: any) {
    console.warn('[LocalStorage Load Error]', e);
  }

  if (memoryStore.properties.size === 0) {
    autoSeedDefaultCsvFromPublic();
  }
}

// Carregar do armazenamento persistente local ao iniciar
loadMemoryStoreFromLocalStorage();

export const ALL_BRAZILIAN_UFS = [
  'SP', 'RJ', 'MG', 'DF', 'BA', 'CE', 'PR', 'RS', 'SC', 'GO',
  'PE', 'PA', 'MA', 'ES', 'PB', 'RN', 'MT', 'MS', 'AM', 'PI',
  'AL', 'SE', 'RO', 'TO', 'AC', 'AP', 'RR'
];

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

  // Sempre armazena no memoryStore local para garantia imediata de filtros no frontend
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

  if (supabase) {
    try {
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .upsert(propertyData, {
          onConflict: 'source,source_property_id',
        })
        .select()
        .single();

      if (!propError && propData) {
        return {
          success: true,
          propertyId: propData.id,
          record: propData,
          isMemoryFallback: false,
        };
      }
    } catch (err: any) {
      console.warn('[Supabase Client] Exceção ao gravar no Supabase:', err.message);
    }
  }

  return {
    success: true,
    propertyId: internalId,
    record: fullRecord,
    isMemoryFallback: true,
  };
}

/**
 * UPSERT EM LOTES (Batches de 250 registros)
 * Armazena SIMULTANEAMENTE no memoryStore e no Supabase Postgres.
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

  // 1. Gravação obrigatória no MemoryStore local (garante que os filtros nunca fiquem vazios no frontend)
  propertiesPayload.forEach((p) => {
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

  // Salvar a memória no armazenamento do navegador
  saveMemoryStoreToLocalStorage();

  // 2. Gravação no Supabase Postgres (se configurado)
  if (supabase) {
    for (let i = 0; i < propertiesPayload.length; i += batchSize) {
      const chunk = propertiesPayload.slice(i, i + batchSize);
      try {
        const { error } = await supabase
          .from('properties')
          .upsert(chunk, { onConflict: 'source,source_property_id' });

        if (error) {
          errors += chunk.length;
          errorMessages.push(`Lote ${Math.floor(i / batchSize) + 1} falhou no Supabase: ${error.message}`);
        }
      } catch (err: any) {
        errors += chunk.length;
        errorMessages.push(`Lote ${Math.floor(i / batchSize) + 1} exceção: ${err.message}`);
      }
    }
  } else {
    isMemoryFallback = true;
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

  // Atualizar MemoryStore local
  memoryStore.properties.forEach((prop) => {
    if (prop.source === 'CAIXA' && prop.state === ufUpper && prop.status === 'ACTIVE') {
      if (!currentImportedPropertyIds.has(prop.source_property_id)) {
        prop.status = 'POSSIBLY_REMOVED';
        countPossiblyRemoved++;
      }
    }
  });

  saveMemoryStoreToLocalStorage();

  if (supabase) {
    try {
      const { data: existingActive } = await supabase
        .from('properties')
        .select('id, source_property_id')
        .eq('source', 'CAIXA')
        .eq('state', ufUpper)
        .eq('status', 'ACTIVE');

      if (existingActive) {
        const missingIds = existingActive
          .filter((p) => !currentImportedPropertyIds.has(p.source_property_id))
          .map((p) => p.id);

        if (missingIds.length > 0) {
          await supabase
            .from('properties')
            .update({ status: 'POSSIBLY_REMOVED', updated_at: new Date().toISOString() })
            .in('id', missingIds);
        }
      }
    } catch (err: any) {
      console.warn('[Reconcile Error]', err.message);
    }
  }

  return { success: true, countPossiblyRemoved };
}

/**
 * REGISTRO DE LOG NA TABELA caixa_imports
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
  memoryStore.imports.push({
    id: `imp-${Date.now()}`,
    created_at: new Date().toISOString(),
    ...logData,
  });

  if (supabase) {
    try {
      await supabase.from('caixa_imports').insert([logData]);
    } catch (err: any) {
      console.warn('[Import Log Error]', err.message);
    }
  }
}

export async function verifySavedPropertyInSupabase(
  source: string,
  sourcePropertyId: string
): Promise<{ success: boolean; record: any; photos: any[]; documents: any[]; isMemoryFallback: boolean }> {
  const compositeKey = `${source}_${sourcePropertyId}`;

  if (supabase) {
    try {
      const { data: prop } = await supabase
        .from('properties')
        .select('*')
        .eq('source', source)
        .eq('source_property_id', sourcePropertyId)
        .single();

      if (prop) {
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
      }
    } catch (e: any) {
      console.warn('[Supabase Verify] Exceção:', e.message);
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
 * CONSULTA AO CATÁLOGO DE IMÓVEIS (Tenta Supabase primeiro; se retornar 0 imóveis ou falhar, consulta o MemoryStore local)
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
  if (memoryStore.properties.size === 0) {
    await autoSeedDefaultCsvFromPublic();
  }

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

      if (filters.state) query = query.eq('state', filters.state.toUpperCase());
      if (filters.city) query = query.ilike('city', `%${filters.city.trim()}%`);

      if (filters.priceMin !== undefined && filters.priceMin !== null) query = query.gte('current_minimum_value', filters.priceMin);
      if (filters.priceMax !== undefined && filters.priceMax !== null) query = query.lte('current_minimum_value', filters.priceMax);

      if (filters.appraisalMin !== undefined && filters.appraisalMin !== null) query = query.gte('appraisal_value', filters.appraisalMin);
      if (filters.appraisalMax !== undefined && filters.appraisalMax !== null) query = query.lte('appraisal_value', filters.appraisalMax);

      if (filters.discountMin !== undefined && filters.discountMin !== null) query = query.gte('discount_percentage', filters.discountMin);

      if (filters.financing !== undefined && filters.financing !== null) query = query.eq('accepts_financing', filters.financing);

      if (filters.occupancy) query = query.eq('occupancy_status', filters.occupancy);

      const allowedAreaCols = ['private_area', 'total_area', 'land_area'];
      const areaCol = filters.areaType && allowedAreaCols.includes(filters.areaType) ? filters.areaType : 'private_area';

      if (filters.areaMin !== undefined && filters.areaMin !== null) query = query.gte(areaCol, filters.areaMin);
      if (filters.areaMax !== undefined && filters.areaMax !== null) query = query.lte(areaCol, filters.areaMax);

      if (filters.propertyType && filters.propertyType !== 'Todos') query = query.eq('property_type', filters.propertyType);
      if (filters.saleModality && filters.saleModality !== 'Todas') query = query.eq('sale_modality', filters.saleModality);

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

      if (!error && data && data.length > 0) {
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
  let filtered = Array.from(memoryStore.properties.values()).filter((p) => p.source === 'CAIXA' && p.status === 'ACTIVE');

  if (filters.state) filtered = filtered.filter((p) => (p.state || '').toUpperCase() === filters.state?.toUpperCase());
  if (filters.city) filtered = filtered.filter((p) => (p.city || '').toLowerCase().includes(filters.city!.toLowerCase()));

  if (filters.priceMin !== undefined && filters.priceMin !== null) filtered = filtered.filter((p) => (p.current_minimum_value || p.sale_value || 0) >= filters.priceMin!);
  if (filters.priceMax !== undefined && filters.priceMax !== null) filtered = filtered.filter((p) => (p.current_minimum_value || p.sale_value || 0) <= filters.priceMax!);

  if (filters.appraisalMin !== undefined && filters.appraisalMin !== null) filtered = filtered.filter((p) => (p.appraisal_value || 0) >= filters.appraisalMin!);
  if (filters.appraisalMax !== undefined && filters.appraisalMax !== null) filtered = filtered.filter((p) => (p.appraisal_value || 0) <= filters.appraisalMax!);

  if (filters.discountMin !== undefined && filters.discountMin !== null) filtered = filtered.filter((p) => (p.discount_percentage || 0) >= filters.discountMin!);

  if (filters.financing !== undefined && filters.financing !== null) filtered = filtered.filter((p) => p.accepts_financing === filters.financing);
  if (filters.occupancy) filtered = filtered.filter((p) => (p.occupancy_status || 'UNKNOWN') === filters.occupancy);

  if (filters.propertyType && filters.propertyType !== 'Todos') filtered = filtered.filter((p) => p.property_type === filters.propertyType);
  if (filters.saleModality && filters.saleModality !== 'Todas') filtered = filtered.filter((p) => p.sale_modality === filters.saleModality);

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
 * BUSCAR ESTADOS (Garante SEMPRE a presença de todas as 27 UFs brasileiras no select)
 */
export async function fetchDistinctStatesFromSupabase(): Promise<string[]> {
  const activeStates = new Set<string>();

  if (supabase) {
    try {
      const { data } = await supabase
        .from('properties')
        .select('state')
        .eq('source', 'CAIXA')
        .eq('status', 'ACTIVE');

      if (data) {
        data.forEach((d) => { if (d.state) activeStates.add(d.state.toUpperCase()); });
      }
    } catch (e: any) {
      console.warn('[Fetch States Error]', e.message);
    }
  }

  memoryStore.properties.forEach((p) => {
    if (p.state && p.status === 'ACTIVE') activeStates.add(p.state.toUpperCase());
  });

  // Retorna todas as UFs brasileiras, garantindo que as UFs com imóveis fiquem no topo
  const sorted = Array.from(ALL_BRAZILIAN_UFS).sort((a, b) => {
    const hasA = activeStates.has(a);
    const hasB = activeStates.has(b);
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    return a.localeCompare(b);
  });

  return sorted;
}

/**
 * BUSCAR CIDADES DEPENDENTES DO ESTADO (Combina Supabase com limit(10000) + MemoryStore)
 */
export async function fetchDistinctCitiesByStateFromSupabase(uf: string): Promise<string[]> {
  const ufUpper = (uf || '').trim().toUpperCase();
  if (!ufUpper) return [];

  if (memoryStore.properties.size === 0) {
    await autoSeedDefaultCsvFromPublic();
  }

  const citySet = new Set<string>();

  if (supabase) {
    try {
      const { data } = await supabase
        .from('properties')
        .select('city')
        .eq('source', 'CAIXA')
        .eq('state', ufUpper)
        .eq('status', 'ACTIVE')
        .limit(10000);

      if (data) {
        data.forEach((d) => {
          if (d.city && d.city.trim()) {
            citySet.add(d.city.trim());
          }
        });
      }
    } catch (e: any) {
      console.warn('[Fetch Cities Error]', e.message);
    }
  }

  memoryStore.properties.forEach((p) => {
    if ((p.state || '').toUpperCase() === ufUpper && p.city && p.status === 'ACTIVE') {
      citySet.add(p.city.trim());
    }
  });

  if (citySet.size === 0) {
    const fallbackCitiesMap: Record<string, string[]> = {
      SP: ['São Paulo', 'Campinas', 'Santos', 'Ribeirão Preto', 'Sorocaba', 'Adamantina', 'Guarulhos', 'São José dos Campos', 'Piracicaba', 'Bauru', 'Americana', 'Araçatuba', 'Araraquara', 'Barueri', 'Botucatu', 'Cotia', 'Franca', 'Indaiatuba', 'Itu', 'Jundiaí', 'Limeira', 'Marília', 'Mogi das Cruzes', 'Osasco', 'Presidente Prudente', 'Santo André', 'São Bernardo do Campo', 'São José do Rio Preto', 'Taubaté'],
      RJ: ['Rio de Janeiro', 'Niterói', 'Petrópolis', 'Duque de Caxias', 'Nova Iguaçu', 'Campos dos Goytacazes', 'Cabo Frio', 'Volta Redonda', 'Angra dos Reis', 'Macaé', 'Teresópolis', 'Maricá', 'Nova Friburgo', 'Resende', 'Barra Mansa'],
      MG: ['Belo Horizonte', 'Uberlândia', 'Juiz de Fora', 'Contagem', 'Montes Claros', 'Uberaba', 'Ipatinga', 'Poços de Caldas', 'Divinópolis', 'Governador Valadares', 'Patos de Minas', 'Pouso Alegre', 'Varginha'],
      DF: ['Brasília', 'Taguatinga', 'Ceilândia', 'Águas Claras', 'Samambaia', 'Gama', 'Sobradinho'],
      PR: ['Curitiba', 'Londrina', 'Maringá', 'Ponta Grossa', 'Cascavel', 'Foz do Iguaçu', 'São José dos Pinhais', 'Guarapuava', 'Paranaguá', 'Toledo'],
      SC: ['Florianópolis', 'Joinville', 'Blumenau', 'São José', 'Chapecó', 'Criciúma', 'Itajaí', 'Balneário Camboriú', 'Jaraguá do Sul', 'Palhoça'],
      RS: ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Santa Maria', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Passo Fundo'],
      BA: ['Salvador', 'Feira de Santana', 'Vitória da Conquista', 'Camaçari', 'Juazeiro', 'Itabuna', 'Lauro de Freitas', 'Ilhéus', 'Jequié', 'Barreiras'],
    };
    const fallbacks = fallbackCitiesMap[ufUpper] || [];
    fallbacks.forEach((c) => citySet.add(c));
  }

  return Array.from(citySet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * BUSCAR TIPOS DE IMÓVEIS (Garante os tipos padrão + os presentes na base)
 */
export async function fetchDistinctPropertyTypesFromSupabase(): Promise<string[]> {
  const defaultTypes = ['Apartamento', 'Casa', 'Terreno', 'Comercial', 'Sala', 'Loja', 'Galpão', 'Prédio'];
  const typeSet = new Set<string>(defaultTypes);

  if (supabase) {
    try {
      const { data } = await supabase
        .from('properties')
        .select('property_type')
        .eq('source', 'CAIXA')
        .eq('status', 'ACTIVE');

      if (data) {
        data.forEach((d) => { if (d.property_type) typeSet.add(d.property_type); });
      }
    } catch (e: any) {
      console.warn('[Fetch Types Error]', e.message);
    }
  }

  memoryStore.properties.forEach((p) => {
    if (p.property_type && p.status === 'ACTIVE') typeSet.add(p.property_type);
  });

  return Array.from(typeSet).sort();
}

/**
 * BUSCAR MODALIDADES DE VENDA
 */
export async function fetchDistinctSaleModalitiesFromSupabase(): Promise<string[]> {
  const defaultMods = ['Leilão SFI - Edital Único', '1º Leilão Caixa', '2º Leilão Caixa', 'Venda Direta Online', 'Licitação Aberta'];
  const modSet = new Set<string>(defaultMods);

  if (supabase) {
    try {
      const { data } = await supabase
        .from('properties')
        .select('sale_modality')
        .eq('source', 'CAIXA')
        .eq('status', 'ACTIVE');

      if (data) {
        data.forEach((d) => { if (d.sale_modality) modSet.add(d.sale_modality); });
      }
    } catch (e: any) {
      console.warn('[Fetch Modalities Error]', e.message);
    }
  }

  memoryStore.properties.forEach((p) => {
    if (p.sale_modality && p.status === 'ACTIVE') modSet.add(p.sale_modality);
  });

  return Array.from(modSet).sort();
}

/**
 * ESTATÍSTICAS RESUMIDAS DA BASE
 */
export async function fetchCatalogSummaryStatsFromSupabase(): Promise<{
  totalActiveCount: number;
  lastImportDate: string | null;
  lastImportGeneratedAt: string | null;
}> {
  let activeCount = memoryStore.properties.size;
  let lastDate: string | null = new Date().toISOString();
  let lastGenDate: string | null = null;

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

      if (count !== null && count > 0) activeCount = count;
      if (lastLog?.created_at) lastDate = lastLog.created_at;
      if (lastLog?.source_generated_at) lastGenDate = lastLog.source_generated_at;
    } catch (e: any) {
      console.warn('[Summary Stats Error]', e.message);
    }
  }

  return {
    totalActiveCount: activeCount,
    lastImportDate: lastDate,
    lastImportGeneratedAt: lastGenDate || '2026-08-07',
  };
}
