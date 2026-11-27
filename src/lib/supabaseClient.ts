import { createClient } from '@supabase/supabase-js';
import { parseCaixaCsv } from '../utils/caixaListImporter';
import {
  savePropertiesToIndexedDB,
  replacePropertiesInIndexedDB,
  loadPropertiesFromIndexedDB,
} from '../utils/indexedDbStore';
import { stripAccents, formatCityDisplayName } from '../utils/textUtils';
import { getPropertyFilterPrice, formatStandardPropertyId } from '../utils/propertyAuctionHelper';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const CATALOG_LEAN_COLUMNS = [
  'id',
  'source',
  'source_property_id',
  'title',
  'state',
  'city',
  'neighborhood',
  'address',
  'property_type',
  'sale_modality',
  'appraisal_value',
  'sale_value',
  'current_minimum_value',
  'first_auction_value',
  'second_auction_value',
  'discount_percentage',
  'calculated_discount_percentage',
  'private_area',
  'total_area',
  'land_area',
  'useful_area',
  'bedrooms',
  'parking_spaces',
  'accepts_financing',
  'accepts_fgts',
  'occupancy_status',
  'occupied',
  'description',
  'source_url',
  'main_photo_url',
  'first_auction_date',
  'second_auction_date',
  'auction_date',
  'auctioneer',
  'payment_conditions',
  'registration_number',
  'status',
  'first_seen_at',
  'last_seen_at',
  'source_generated_at',
  'updated_at',
].join(',');

function getCanonicalPropertyKey(p: any): string {
  const source = String(p?.source || 'CAIXA').trim().toUpperCase();
  const stdId = formatStandardPropertyId(source, p?.source_property_id || p?.id, p);
  return `${source}__${stdId}`;
}

function deduplicateProperties(list: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of list) {
    if (!item) continue;
    const key = getCanonicalPropertyKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

const DROPDOWN_CACHE_TTL_MS = 5 * 60 * 1000;
const dropdownCache = new Map<string, { data: any; expiresAt: number }>();

export function clearCatalogCaches(): void {
  dropdownCache.clear();
}

function getCachedDropdown<T>(key: string): T | null {
  const entry = dropdownCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  return null;
}

function setCachedDropdown<T>(key: string, data: T): T {
  dropdownCache.set(key, { data, expiresAt: Date.now() + DROPDOWN_CACHE_TTL_MS });
  return data;
}

const CACHE_KEY_PROPERTIES = 'g2_caixa_properties_store_v1';

const memoryStore = {
  properties: new Map<string, any>(),
  photos: new Map<string, any[]>(),
  documents: new Map<string, any[]>(),
  imports: new Array<any>(),
};

let seedPromise: Promise<void> | null = null;

export async function autoSeedDefaultCsvFromPublic(): Promise<void> {
  const hasCaixaProperties = Array.from(memoryStore.properties.values()).some((p) => p?.source === 'CAIXA');
  if (hasCaixaProperties && memoryStore.properties.size >= 1000) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const res = await fetch('/Lista_imoveis_SP.csv');
      if (res.ok) {
        const csvText = await res.text();
        const parseResult = parseCaixaCsv(csvText, 'SP', '/Lista_imoveis_SP.csv');
        if (parseResult.rows && parseResult.rows.length > 0) {
          parseResult.rows.forEach((p) => {
            const compositeKey = getCanonicalPropertyKey(p);
            memoryStore.properties.set(compositeKey, {
              id: `sb-seed-${p.source_property_id}`,
              ...p,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          });
          saveMemoryStoreToLocalStorage(true);
          console.log(`[Auto-Seed SP] ${parseResult.rows.length} imóveis e cidades populados de /Lista_imoveis_SP.csv.`);
        }
      }
    } catch (err: any) {
      console.warn('[Auto-Seed SP Error]', err.message);
    } finally {
      seedPromise = null;
    }
  })();

  return seedPromise;
}

export function saveMemoryStoreToLocalStorage(replaceStore: boolean = false) {
  // Salva no IndexedDB (sem limite de 5MB)
  if (replaceStore) {
    replacePropertiesInIndexedDB(memoryStore.properties);
  } else {
    savePropertiesToIndexedDB(memoryStore.properties);
  }

  // Fallback rápido no localStorage para listas pequenas
  try {
    if (memoryStore.properties.size <= 500) {
      const arrayData = Array.from(memoryStore.properties.entries());
      localStorage.setItem(CACHE_KEY_PROPERTIES, JSON.stringify(arrayData));
    }
  } catch (e: any) {
    console.warn('[LocalStorage Save Error]', e);
  }
}

export async function loadMemoryStoreFromLocalStorage() {
  const sanitizeProperty = (p: any) => {
    const minVal = p.current_minimum_value || p.sale_value || 0;
    if (minVal <= 0 || (p.discount_percentage && p.discount_percentage >= 100)) {
      p.discount_percentage = null;
      p.calculated_discount_percentage = null;
    }
    return p;
  };

  let hadDuplicates = false;

  // 1. Tenta carregar do IndexedDB primeiro (deduplicando chaves legadas)
  const idbMap = await loadPropertiesFromIndexedDB();
  if (idbMap.size > 0) {
    idbMap.forEach((v) => {
      const clean = sanitizeProperty(v);
      const canonicalKey = getCanonicalPropertyKey(clean);
      if (memoryStore.properties.has(canonicalKey)) {
        hadDuplicates = true;
      }
      memoryStore.properties.set(canonicalKey, clean);
    });
    if (hadDuplicates || memoryStore.properties.size !== idbMap.size) {
      replacePropertiesInIndexedDB(memoryStore.properties);
    }
    console.log(`[IndexedDB Load] ${memoryStore.properties.size} imóveis únicos carregados com sucesso.`);
  }

  // 2. Fallback para localStorage
  try {
    const raw = localStorage.getItem(CACHE_KEY_PROPERTIES);
    if (raw) {
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) {
        entries.forEach(([, v]: [string, any]) => {
          const clean = sanitizeProperty(v);
          const canonicalKey = getCanonicalPropertyKey(clean);
          memoryStore.properties.set(canonicalKey, clean);
        });
      }
    }
  } catch (e: any) {
    console.warn('[LocalStorage Load Error]', e);
  }

  const hasCaixa = Array.from(memoryStore.properties.values()).some((p) => p?.source === 'CAIXA');
  if (!hasCaixa || memoryStore.properties.size < 1000) {
    await autoSeedDefaultCsvFromPublic();
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
  auction_date?: string | null;
  source_url?: string | null;
  main_photo_url?: string | null;
  status?: string;
  source_hash?: string | null;
  source_generated_at?: string | null;
  source_fetched_at?: string | null;
  source_file_url?: string | null;
  source_file_hash?: string | null;
  enrichment_status?: string;
  payment_conditions?: string | null;
  max_installments?: number | null;
  min_down_payment?: number | null;
  min_installment_value?: number | null;
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
  const compositeKey = getCanonicalPropertyKey(propertyData);

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

  const uniquePayloads = deduplicateProperties(propertiesPayload);

  // 1. Gravação obrigatória no MemoryStore local (garante que os filtros nunca fiquem vazios no frontend)
  uniquePayloads.forEach((p) => {
    const minVal = p.current_minimum_value || p.sale_value || 0;
    if (minVal <= 0 || (p.discount_percentage !== null && p.discount_percentage !== undefined && p.discount_percentage >= 100)) {
      p.discount_percentage = null;
      p.calculated_discount_percentage = null;
    }

    const compositeKey = getCanonicalPropertyKey(p);
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

  // Salvar a memória no armazenamento do navegador (substituindo chaves antigas duplicadas)
  saveMemoryStoreToLocalStorage(true);

  // 2. Gravação no Supabase Postgres (se configurado)
  if (supabase) {
    for (let i = 0; i < uniquePayloads.length; i += batchSize) {
      const chunk = uniquePayloads.slice(i, i + batchSize);
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
      const existingActive: { id: string; source_property_id: string }[] = [];
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('properties')
          .select('id, source_property_id')
          .eq('source', 'CAIXA')
          .eq('state', ufUpper)
          .eq('status', 'ACTIVE')
          .range(from, from + pageSize - 1);

        if (error || !data || data.length === 0) break;
        existingActive.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      if (existingActive.length > 0) {
        const missingIds = existingActive
          .filter((p) => !currentImportedPropertyIds.has(p.source_property_id))
          .map((p) => p.id);

        const nowIso = new Date().toISOString();
        for (let i = 0; i < missingIds.length; i += 200) {
          const chunk = missingIds.slice(i, i + 200);
          await supabase
            .from('properties')
            .update({ status: 'POSSIBLY_REMOVED', updated_at: nowIso })
            .in('id', chunk);
        }
        countPossiblyRemoved = Math.max(countPossiblyRemoved, missingIds.length);
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
  neighborhood?: string;
  street?: string;
  condominium?: string;
  source?: string; // 'ALL' | 'CAIXA' | 'SANTANDER' | 'BRADESCO'
  sources?: string[]; // Suporte a múltiplos bancos selecionados
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

  sortBy?: 'discount_desc' | 'price_asc' | 'appraisal_desc' | 'area_desc' | 'recent_desc' | 'neighborhood_asc' | 'address_asc';
  page?: number;
  pageSize?: number;
}

function sanitizeOrIlikeTerm(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/[,()%*]+/g, ' ')
    .replace(/\s+/g, '%')
    .replace(/^%+|%+$/g, '');
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
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 24;
  const fromIndex = (page - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;

  if (supabase) {
    try {
      let query = supabase
        .from('properties')
        .select(CATALOG_LEAN_COLUMNS, { count: 'exact' })
        .eq('status', 'ACTIVE');

      // Filtro de Múltiplos Bancos / Origens
      if (filters.sources && filters.sources.length > 0) {
        query = query.in('source', filters.sources);
      } else if (filters.source && filters.source !== 'ALL') {
        query = query.eq('source', filters.source);
      }

      if (filters.state) query = query.eq('state', filters.state.toUpperCase());
      if (filters.city) query = query.ilike('city', `%${filters.city.trim()}%`);
      if (filters.neighborhood) query = query.ilike('neighborhood', `%${filters.neighborhood.trim()}%`);
      if (filters.street) query = query.ilike('address', `%${filters.street.trim()}%`);
      if (filters.condominium) {
        const condoTerm = sanitizeOrIlikeTerm(filters.condominium);
        if (condoTerm) {
          query = query.or(
            `address.ilike.%${condoTerm}%,title.ilike.%${condoTerm}%,neighborhood.ilike.%${condoTerm}%,description.ilike.%${condoTerm}%`
          );
        }
      }

      if (filters.priceMin !== undefined && filters.priceMin !== null) query = query.gte('current_minimum_value', filters.priceMin);
      if (filters.priceMax !== undefined && filters.priceMax !== null) query = query.lte('current_minimum_value', filters.priceMax);

      if (filters.appraisalMin !== undefined && filters.appraisalMin !== null) query = query.gte('appraisal_value', filters.appraisalMin);
      if (filters.appraisalMax !== undefined && filters.appraisalMax !== null) query = query.lte('appraisal_value', filters.appraisalMax);

      if (filters.discountMin !== undefined && filters.discountMin !== null) {
        query = query.gte('discount_percentage', filters.discountMin).lt('discount_percentage', 100);
      }

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
        case 'neighborhood_asc':
          query = query.order('neighborhood', { ascending: true, nullsFirst: false }).order('address', { ascending: true, nullsFirst: false });
          break;
        case 'address_asc':
          query = query.order('address', { ascending: true, nullsFirst: false });
          break;
        case 'discount_desc':
        default:
          query = query
            .or('discount_percentage.is.null,discount_percentage.lt.100')
            .order('discount_percentage', { ascending: false, nullsFirst: false });
          break;
      }

      query = query.range(fromIndex, toIndex);

      const { data, count, error } = await query;

      if (error) {
        console.warn('[Catalog Query Error]', error.message);
      }

      if (!error && data && data.length > 0) {
        const deduped = deduplicateProperties(data);
        const total = count || deduped.length;
        return {
          data: deduped,
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

  // Fallback para memory store (Múltiplos Bancos)
  const hasCaixa = Array.from(memoryStore.properties.values()).some((p) => p?.source === 'CAIXA');
  if (!hasCaixa || memoryStore.properties.size < 1000) {
    await autoSeedDefaultCsvFromPublic();
  }
  let filtered = deduplicateProperties(
    Array.from(memoryStore.properties.values()).filter((p) => !p.status || p.status === 'ACTIVE' || p.status === 'active')
  );

  if (filters.sources && filters.sources.length > 0) {
    filtered = filtered.filter((p) => filters.sources!.includes(p.source));
  } else if (filters.source && filters.source !== 'ALL') {
    filtered = filtered.filter((p) => p.source === filters.source);
  }

  if (filters.state) filtered = filtered.filter((p) => (p.state || '').toUpperCase() === filters.state?.toUpperCase());
  if (filters.city) {
    const targetNormCity = stripAccents(filters.city);
    filtered = filtered.filter((p) => stripAccents(p.city).includes(targetNormCity));
  }
  if (filters.neighborhood) {
    const targetNormNeigh = stripAccents(filters.neighborhood);
    filtered = filtered.filter((p) => stripAccents(p.neighborhood).includes(targetNormNeigh));
  }
  if (filters.street) {
    const targetNormStreet = stripAccents(filters.street);
    filtered = filtered.filter((p) => stripAccents(p.address).includes(targetNormStreet));
  }
  if (filters.condominium) {
    const targetNormCondo = stripAccents(filters.condominium);
    filtered = filtered.filter((p) => {
      const hay = stripAccents(`${p.address || ''} ${p.title || ''} ${p.neighborhood || ''} ${p.description || ''}`);
      return hay.includes(targetNormCondo);
    });
  }

  // Quando houver ainda constando 1º e 2º leilões, utilizar o maior valor para efeitos de filtros
  if (filters.priceMin !== undefined && filters.priceMin !== null) {
    filtered = filtered.filter((p) => getPropertyFilterPrice(p) >= filters.priceMin!);
  }
  if (filters.priceMax !== undefined && filters.priceMax !== null) {
    filtered = filtered.filter((p) => getPropertyFilterPrice(p) <= filters.priceMax!);
  }

  if (filters.appraisalMin !== undefined && filters.appraisalMin !== null) filtered = filtered.filter((p) => (p.appraisal_value || 0) >= filters.appraisalMin!);
  if (filters.appraisalMax !== undefined && filters.appraisalMax !== null) filtered = filtered.filter((p) => (p.appraisal_value || 0) <= filters.appraisalMax!);

  if (filters.discountMin !== undefined && filters.discountMin !== null) {
    filtered = filtered.filter((p) => {
      const minVal = p.current_minimum_value || p.sale_value || 0;
      if (minVal <= 0) return false;
      const d = p.discount_percentage || 0;
      return d > 0 && d < 100 && d >= filters.discountMin!;
    });
  }

  if (filters.financing !== undefined && filters.financing !== null) filtered = filtered.filter((p) => p.accepts_financing === filters.financing);
  if (filters.occupancy) filtered = filtered.filter((p) => (p.occupancy_status || 'UNKNOWN') === filters.occupancy);

  if (filters.propertyType && filters.propertyType !== 'Todos') filtered = filtered.filter((p) => p.property_type === filters.propertyType);
  if (filters.saleModality && filters.saleModality !== 'Todas') filtered = filtered.filter((p) => p.sale_modality === filters.saleModality);

  const areaCol = filters.areaType || 'private_area';
  filtered.sort((a, b) => {
    if (filters.sortBy === 'price_asc') return getPropertyFilterPrice(a) - getPropertyFilterPrice(b);
    if (filters.sortBy === 'appraisal_desc') return (b.appraisal_value || 0) - (a.appraisal_value || 0);
    if (filters.sortBy === 'area_desc') return (b[areaCol] || 0) - (a[areaCol] || 0);
    if (filters.sortBy === 'recent_desc') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    if (filters.sortBy === 'neighborhood_asc') {
      const nComp = (a.neighborhood || '').localeCompare(b.neighborhood || '', 'pt-BR');
      if (nComp !== 0) return nComp;
      return (a.address || '').localeCompare(b.address || '', 'pt-BR');
    }
    if (filters.sortBy === 'address_asc') {
      return (a.address || '').localeCompare(b.address || '', 'pt-BR');
    }
    const getDisc = (p: any) => {
      const minVal = p.current_minimum_value || p.sale_value || 0;
      if (minVal <= 0) return -1;
      const d = p.discount_percentage || 0;
      return d > 0 && d < 100 ? d : -1;
    };
    return getDisc(b) - getDisc(a);
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
  const cached = getCachedDropdown<string[]>('states');
  if (cached) return cached;

  const activeStates = new Set<string>();

  if (supabase) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_distinct_states');
      if (!rpcErr && Array.isArray(rpcData)) {
        rpcData.forEach((d: any) => {
          if (d?.state) activeStates.add(String(d.state).toUpperCase());
        });
      } else {
        const { data } = await supabase
          .from('properties')
          .select('state')
          .eq('status', 'ACTIVE')
          .limit(2000);
        if (data) {
          data.forEach((d) => { if (d.state) activeStates.add(d.state.toUpperCase()); });
        }
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

  return setCachedDropdown('states', sorted);
}

/**
 * BUSCAR CIDADES DEPENDENTES DO ESTADO (RPC DISTINCT no Postgres + cache)
 */
export async function fetchDistinctCitiesByStateFromSupabase(uf: string): Promise<string[]> {
  const ufUpper = (uf || '').trim().toUpperCase();
  if (!ufUpper) return [];

  const cached = getCachedDropdown<string[]>(`cities:${ufUpper}`);
  if (cached) return cached;

  const cityMap = new Map<string, string>(); // normKey -> displayString

  if (supabase) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_distinct_cities', {
        p_uf: ufUpper,
      });
      if (!rpcErr && Array.isArray(rpcData)) {
        rpcData.forEach((d: any) => {
          if (d?.city && String(d.city).trim()) {
            const clean = String(d.city).trim();
            const norm = stripAccents(clean);
            if (!cityMap.has(norm)) {
              cityMap.set(norm, formatCityDisplayName(clean));
            }
          }
        });
        return setCachedDropdown(
          `cities:${ufUpper}`,
          Array.from(cityMap.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        );
      }
    } catch (e: any) {
      console.warn('[Fetch Cities RPC Error]', e.message);
    }
  }

  const hasCaixa = Array.from(memoryStore.properties.keys()).some(k => k.startsWith('CAIXA_'));
  if (!hasCaixa || memoryStore.properties.size < 1000) {
    await autoSeedDefaultCsvFromPublic();
  }

  memoryStore.properties.forEach((p) => {
    if ((p.state || '').toUpperCase() === ufUpper && p.city && p.status === 'ACTIVE') {
      const clean = p.city.trim();
      const norm = stripAccents(clean);
      if (!cityMap.has(norm)) {
        cityMap.set(norm, formatCityDisplayName(clean));
      }
    }
  });

  return setCachedDropdown(
    `cities:${ufUpper}`,
    Array.from(cityMap.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  );
}

/**
 * BUSCAR BAIRROS POR UF / CIDADE PARA AUTOCOMPLETE
 */
export async function fetchDistinctNeighborhoodsFromSupabase(uf: string, city?: string): Promise<string[]> {
  const ufUpper = (uf || '').trim().toUpperCase();
  if (!ufUpper) return [];
  const cityClean = (city || '').trim();
  const cacheKey = `neighborhoods:${ufUpper}:${stripAccents(cityClean)}`;
  const cached = getCachedDropdown<string[]>(cacheKey);
  if (cached) return cached;

  const neighMap = new Map<string, string>();
  const addNeigh = (raw?: string | null) => {
    const clean = String(raw || '').trim();
    if (!clean || clean.toLowerCase() === 'n/i') return;
    const norm = stripAccents(clean);
    if (norm && !neighMap.has(norm)) {
      neighMap.set(norm, formatCityDisplayName(clean));
    }
  };

  if (supabase) {
    try {
      let query = supabase
        .from('properties')
        .select('neighborhood')
        .eq('status', 'ACTIVE')
        .eq('state', ufUpper)
        .not('neighborhood', 'is', null)
        .limit(2000);
      if (cityClean) {
        query = query.ilike('city', `%${cityClean}%`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        data.forEach((d: any) => addNeigh(d?.neighborhood));
        return setCachedDropdown(
          cacheKey,
          Array.from(neighMap.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
        );
      }
    } catch (e: any) {
      console.warn('[Fetch Neighborhoods Error]', e.message);
    }
  }

  const normTargetCity = stripAccents(cityClean);
  memoryStore.properties.forEach((p) => {
    if ((p.state || '').toUpperCase() === ufUpper && (!p.status || p.status === 'ACTIVE')) {
      if (!normTargetCity || stripAccents(p.city).includes(normTargetCity)) {
        addNeigh(p.neighborhood);
      }
    }
  });

  return setCachedDropdown(
    cacheKey,
    Array.from(neighMap.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  );
}

/**
 * BUSCAR TIPOS DE IMÓVEIS (RPC DISTINCT no Postgres + cache)
 */
export async function fetchDistinctPropertyTypesFromSupabase(): Promise<string[]> {
  const cached = getCachedDropdown<string[]>('property_types');
  if (cached) return cached;

  const defaultTypes = ['Apartamento', 'Casa', 'Terreno', 'Comercial', 'Sala', 'Loja', 'Galpão', 'Prédio'];
  const typeSet = new Set<string>(defaultTypes);

  if (supabase) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_distinct_property_types');
      if (!rpcErr && Array.isArray(rpcData)) {
        rpcData.forEach((d: any) => {
          if (d?.property_type) typeSet.add(d.property_type);
        });
      }
    } catch (e: any) {
      console.warn('[Fetch Types Error]', e.message);
    }
  }

  memoryStore.properties.forEach((p) => {
    if (p.property_type && p.status === 'ACTIVE') typeSet.add(p.property_type);
  });

  return setCachedDropdown('property_types', Array.from(typeSet).sort());
}

/**
 * BUSCAR MODALIDADES DE VENDA (RPC DISTINCT no Postgres + cache)
 */
export async function fetchDistinctSaleModalitiesFromSupabase(): Promise<string[]> {
  const cached = getCachedDropdown<string[]>('sale_modalities');
  if (cached) return cached;

  const defaultMods = [
    'Leilão SFI - Edital Único',
    '1º Leilão Caixa',
    '2º Leilão Caixa',
    'Venda Direta Online',
    'Licitação Aberta',
    'Leilão Santander Oficial',
    'Leilão Bradesco Oficial',
  ];
  const modSet = new Set<string>(defaultMods);

  if (supabase) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_distinct_sale_modalities');
      if (!rpcErr && Array.isArray(rpcData)) {
        rpcData.forEach((d: any) => {
          if (d?.sale_modality) modSet.add(d.sale_modality);
        });
      }
    } catch (e: any) {
      console.warn('[Fetch Modalities Error]', e.message);
    }
  }

  memoryStore.properties.forEach((p) => {
    if (p.sale_modality && p.status === 'ACTIVE') modSet.add(p.sale_modality);
  });

  return setCachedDropdown('sale_modalities', Array.from(modSet).sort());
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

export interface BankFreshnessInfo {
  source: string;
  activeCount: number;
  lastSyncedAt: string | null;
  sourceGeneratedAt: string | null;
}

/**
 * FREQUÊNCIA E ATUALIZAÇÃO REAL POR BANCO NO SUPABASE
 */
export async function fetchBankFreshnessFromSupabase(): Promise<BankFreshnessInfo[]> {
  const cached = getCachedDropdown<BankFreshnessInfo[]>('bank_freshness');
  if (cached) return cached;

  const sources = ['CAIXA', 'BRADESCO', 'SANTANDER', 'ITAU', 'BB', 'JUDICIAL', 'ZUK', 'MEGA'];

  if (supabase) {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_bank_freshness');
      if (!rpcErr && Array.isArray(rpcData)) {
        const bySource = new Map<string, any>();
        rpcData.forEach((row: any) => {
          if (row?.source) bySource.set(String(row.source).toUpperCase(), row);
        });
        return setCachedDropdown(
          'bank_freshness',
          sources.map((source) => {
            const r = bySource.get(source);
            return {
              source,
              activeCount: Number(r?.active_count ?? 0),
              lastSyncedAt: r?.last_synced_at || null,
              sourceGeneratedAt: r?.source_generated_at || null,
            };
          })
        );
      }
    } catch (e: any) {
      console.warn('[Bank Freshness RPC Error]', e.message);
    }
  }

  return sources.map((source) => {
    const matching = Array.from(memoryStore.properties.values()).filter(
      (p) => (p.source || 'CAIXA') === source && (!p.status || p.status === 'ACTIVE')
    );
    return {
      source,
      activeCount: matching.length,
      lastSyncedAt: matching[0]?.updated_at || null,
      sourceGeneratedAt: matching[0]?.source_generated_at || null,
    };
  });
}

export interface LatestCaixaImportStatus {
  uf: string;
  status: string;
  source_generated_at: string | null;
  created_at: string;
  valid_rows: number;
}

export async function fetchLatestCaixaImportStatusByUf(uf: string): Promise<LatestCaixaImportStatus | null> {
  const ufUpper = (uf || '').trim().toUpperCase();
  if (!ufUpper || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('caixa_imports')
      .select('uf, status, source_generated_at, created_at, valid_rows')
      .eq('uf', ufUpper)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      uf: data.uf,
      status: data.status || 'UNKNOWN',
      source_generated_at: data.source_generated_at || null,
      created_at: data.created_at,
      valid_rows: Number(data.valid_rows || 0),
    };
  } catch (e: any) {
    console.warn('[Latest Caixa Import Status Error]', e.message);
    return null;
  }
}
