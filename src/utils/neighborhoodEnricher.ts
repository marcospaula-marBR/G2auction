/**
 * G2 AUCTION - Robô de Conferência e Enriquecimento Postal de Bairros
 * 
 * Permite checar automaticamente se o bairro importado dos bancos (Santander, Bradesco, Caixa)
 * está correto, comparando com a base oficial de logradouros (ViaCEP / Correios)
 * e corrigindo automaticamente bairros faltantes, genéricos ou incorretos.
 */

export interface NeighborhoodVerificationResult {
  verified: boolean;
  corrected: boolean;
  originalNeighborhood: string;
  verifiedNeighborhood: string;
  cep?: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  source: 'VIACEP' | 'HEURISTIC' | 'CACHE' | 'ORIGINAL';
  note?: string;
}

// Cache local em memória para evitar chamadas duplicadas
const neighborhoodCache = new Map<string, { bairro: string; cep: string }>();

/**
 * Higieniza o endereço para extrair o nome do logradouro puro para busca na API postal.
 * Remove prefixos (Rua, Av), números, lotes, quadras e complementos.
 */
export function cleanStreetForPostalSearch(rawAddress?: string | null): string {
  if (!rawAddress || !rawAddress.trim()) return '';

  let s = rawAddress.trim();

  // 1. Remove tipos de logradouro no início
  s = s.replace(/^(Rua|R\.|R\s+|Avenida|Av\.|Av\s+|Alameda|Al\.|Al\s+|Travessa|Tv\.|Tv\s+|Praça|Pç\.|Pca\.|Rodovia|Rod\.|Estrada|Est\.)\s+/i, '');

  // 2. Quebra antes de vírgulas, número, quadra, lote, apto, etc.
  s = s.split(/,|\s+n[º°\.]|\s+n\s+|\s+numero\s+|\s+no\s+|\s+qd|\s+lt|\s+lote|\s+quadra|\s+apto|\s+bloco|\s+andar|\s+casa|\s+edif/i)[0].trim();

  // 3. Remove dígitos soltos no final
  s = s.replace(/\s+\d+.*$/, '').trim();

  // 4. Remove caracteres especiais residuais
  s = s.replace(/[#\-\/]/g, ' ').replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Consulta a API oficial do ViaCEP pelo logradouro na UF e Cidade especificadas.
 */
export async function queryViaCepStreet(
  uf: string,
  city: string,
  street: string
): Promise<Array<{ bairro: string; cep: string; logradouro: string }>> {
  const cleanUf = (uf || '').trim().toUpperCase();
  const cleanCity = (city || '').trim();
  const cleanStreet = cleanStreetForPostalSearch(street);

  if (!cleanUf || !cleanCity || cleanStreet.length < 3) {
    return [];
  }

  const cacheKey = `${cleanUf}_${cleanCity.toLowerCase()}_${cleanStreet.toLowerCase()}`;
  if (neighborhoodCache.has(cacheKey)) {
    const cached = neighborhoodCache.get(cacheKey)!;
    return [{ bairro: cached.bairro, cep: cached.cep, logradouro: cleanStreet }];
  }

  try {
    const url = `https://viacep.com.br/ws/${encodeURIComponent(cleanUf)}/${encodeURIComponent(cleanCity)}/${encodeURIComponent(cleanStreet)}/json/`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return [];

    const results = data
      .filter((item: any) => item && item.bairro && item.bairro.trim())
      .map((item: any) => ({
        bairro: item.bairro.trim(),
        cep: item.cep || '',
        logradouro: item.logradouro || '',
      }));

    if (results.length > 0) {
      neighborhoodCache.set(cacheKey, { bairro: results[0].bairro, cep: results[0].cep });
    }

    return results;
  } catch (err: any) {
    console.warn('[NeighborhoodEnricher] Erro ao consultar ViaCEP:', err.message);
    return [];
  }
}

/**
 * Verifica e enriquece o bairro de um imóvel individual.
 */
export async function verifyAndEnrichNeighborhood(property: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
}): Promise<NeighborhoodVerificationResult> {
  const orig = (property.neighborhood || '').trim();
  const city = (property.city || '').trim();
  const state = (property.state || '').trim().toUpperCase();
  const address = (property.address || '').trim();

  // Se já tiver bairro plausível e não tiver endereço para conferir
  if (!address && orig) {
    return {
      verified: true,
      corrected: false,
      originalNeighborhood: orig,
      verifiedNeighborhood: orig,
      confidence: 'MEDIUM',
      source: 'ORIGINAL',
    };
  }

  // Tenta extrair primeiro via Regex no endereço (ex: "Bairro Jardim Paulista" ou "Vila Haro")
  const regexMatch = address.match(/(?:bairro|b\.|jd\.|jardim|vl\.|vila|pq\.|parque)\s+([^,-]+)/i);
  let heuristicBairro = '';
  if (regexMatch && regexMatch[1]) {
    heuristicBairro = regexMatch[0].trim();
  }

  // Consulta o robô postal (ViaCEP)
  const streetName = cleanStreetForPostalSearch(address);
  if (streetName && streetName.length >= 3 && city && state) {
    const postalResults = await queryViaCepStreet(state, city, streetName);

    if (postalResults.length > 0) {
      const best = postalResults[0];
      const postalBairro = best.bairro;

      const isSame = orig && orig.toLowerCase() === postalBairro.toLowerCase();

      return {
        verified: true,
        corrected: !isSame,
        originalNeighborhood: orig || 'Não informado',
        verifiedNeighborhood: postalBairro,
        cep: best.cep,
        confidence: 'HIGH',
        source: 'VIACEP',
        note: isSame ? 'Bairro confirmado pelos Correios (ViaCEP)' : `Bairro corrigido para "${postalBairro}" pelos Correios`,
      };
    }
  }

  // Se o ViaCEP não encontrou, mas o endereço tinha padrão heurístico evidente
  if (heuristicBairro && (!orig || orig.toLowerCase() === 'centro')) {
    return {
      verified: true,
      corrected: true,
      originalNeighborhood: orig || 'Não informado',
      verifiedNeighborhood: heuristicBairro,
      confidence: 'MEDIUM',
      source: 'HEURISTIC',
      note: `Bairro identificado no logradouro: "${heuristicBairro}"`,
    };
  }

  // Fallback: mantém o original
  return {
    verified: Boolean(orig),
    corrected: false,
    originalNeighborhood: orig || 'Não informado',
    verifiedNeighborhood: orig || 'Centro',
    confidence: orig ? 'LOW' : 'NONE',
    source: 'ORIGINAL',
    note: orig ? 'Mantido bairro original informado pelo banco' : 'Não foi possível confirmar bairro oficial',
  };
}

/**
 * Validação e Enriquecimento em Lote (com limite de requisições concorrentes)
 */
export async function batchVerifyNeighborhoods<T extends { address?: string; city?: string; state?: string; neighborhood?: string }>(
  items: T[],
  onProgress?: (done: number, total: number) => void
): Promise<Array<T & { neighborhoodVerification?: NeighborhoodVerificationResult }>> {
  const enriched: Array<T & { neighborhoodVerification?: NeighborhoodVerificationResult }> = [];
  const total = items.length;

  // Processa em blocos de 5 requisições simultâneas para respeitar limites de taxa
  const chunkSize = 5;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        const res = await verifyAndEnrichNeighborhood({
          address: item.address,
          city: item.city,
          state: item.state,
          neighborhood: item.neighborhood,
        });

        return {
          ...item,
          neighborhood: res.verifiedNeighborhood || item.neighborhood,
          neighborhoodVerification: res,
        };
      })
    );

    enriched.push(...chunkResults);
    onProgress?.(enriched.length, total);

    // Pequena pausa para gentileza com o serviço dos Correios
    if (i + chunkSize < items.length) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  return enriched;
}
