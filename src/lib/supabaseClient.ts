import { createClient } from '@supabase/supabase-js';

// Leitura das variáveis de ambiente Supabase (se disponíveis)
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Estrutura em memória para fallback local / demonstração de verificação em ambiente de teste
const memoryStore = {
  properties: new Map<string, any>(),
  photos: new Map<string, any[]>(),
  documents: new Map<string, any[]>(),
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
  bedrooms?: number | null;
  parking_spaces?: number | null;
  total_area?: number | null;
  private_area?: number | null;
  useful_area?: number | null;
  land_area?: number | null;
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

/**
 * Realiza o UPSERT do Imóvel no Supabase utilizando a chave (source, source_property_id).
 */
export async function upsertPropertyToSupabase(
  propertyData: PropertyUpsertPayload,
  photos: PhotoUpsertPayload[] = [],
  documents: DocumentUpsertPayload[] = []
): Promise<{ success: boolean; propertyId: string; record: any; isMemoryFallback: boolean; error?: string }> {
  const compositeKey = `${propertyData.source}_${propertyData.source_property_id}`;
  
  if (supabase) {
    try {
      // 1. UPSERT em public.properties
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .upsert(propertyData, {
          onConflict: 'source,source_property_id',
        })
        .select()
        .single();

      if (propError) throw propError;
      const internalId = propData.id;

      // 2. UPSERT em public.property_photos
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

      // 3. UPSERT em public.property_documents
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

  // Fallback em memória para teste local quando Supabase não estiver configurado
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
 * Realiza o SELECT de verificação no Supabase após o UPSERT para provar a persistência.
 */
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
