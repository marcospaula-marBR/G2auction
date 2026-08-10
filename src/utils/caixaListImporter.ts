/**
 * Módulo: caixaListImporter (Feed Oficial CSV por UF)
 * Responsável por:
 * 1. buildCaixaFeedUrl(uf) -> https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_{UF}.csv
 * 2. parseCaixaCsvFeed(fileContent)
 * 3. normalizeCaixaId(value)
 * 4. Validação ID x Link (source_property_id === hdnimovel)
 * 5. Extraction de metadados (source_generated_at)
 * 6. Deterministic description parser (property_type, áreas, quartos)
 */

import { parseBrazilianMoney } from './caixaParser';

export interface CaixaFeedMetadata {
  source: 'CAIXA';
  uf: string;
  source_file_url: string;
  source_generated_at: string | null; // ISO YYYY-MM-DD ex: "2026-08-07"
  source_fetched_at: string; // ISO Timestamptz
  source_file_hash: string;
  encoding: string;
  delimiter: string;
  total_records_found: number;
  valid_records_count: number;
  rejected_mismatch_count: number;
}

export interface CaixaFeedRowParsed {
  source_property_id: string; // TEXT preservando zeros ex: "1444408501866"
  state: string;
  city: string;
  neighborhood: string;
  address: string;
  sale_value: number | null;
  appraisal_value: number | null;
  discount_percentage: number | null;
  accepts_financing: boolean | null;
  description: string;
  sale_modality: string;
  source_url: string; // URL do Link de acesso do CSV!
  
  // Dados determinísticos extraídos da descrição (auxiliares)
  property_type: string | null;
  total_area: number | null;
  private_area: number | null;
  land_area: number | null;
  bedrooms: number | null;

  raw_list_data: Record<string, string>;
  validation_error?: string | null;
}

/**
 * Gera a URL oficial do feed CSV público por UF da CAIXA.
 */
export function buildCaixaFeedUrl(uf: string): string {
  const cleanUf = String(uf || 'SP').trim().toUpperCase();
  return `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${cleanUf}.csv`;
}

/**
 * Normaliza o ID do Imóvel da CAIXA.
 * REGRA CRÍTICA: Manter estritamente como STRING/TEXT. NUNCA converter para Integer.
 */
export function normalizeCaixaId(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const strVal = String(value).trim();
  return strVal.replace(/\D/g, ''); // String TEXT sem alterar zeros ou tamanho
}

/**
 * Extrai o parâmetro hdnimovel da URL do Link de acesso.
 */
export function extractHdnImovelFromUrl(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const match = url.match(/[?&]hdnimovel=([^&]+)/i) || url.match(/\/(\d{10,15})/);
    return match ? normalizeCaixaId(match[1]) : '';
  } catch {
    return '';
  }
}

/**
 * Parser de Linha CSV considerando delimitador `;` e aspas escapadas.
 */
export function parseCsvLine(line: string, delimiter: string = ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      if (inQuotes && line[i + 1] === char) {
        current += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((c) => c.replace(/^["']|["']$/g, '').trim());
}

/**
 * Parser Determinístico do Texto da Descrição do Imóvel (sem usar IA).
 */
export function parseDescriptionFields(description: string): {
  property_type: string | null;
  total_area: number | null;
  private_area: number | null;
  land_area: number | null;
  bedrooms: number | null;
} {
  if (!description) {
    return { property_type: null, total_area: null, private_area: null, land_area: null, bedrooms: null };
  }

  // 1. Tipo do Imóvel (primeira palavra ex: "Casa", "Apartamento", "Terreno", "Sobrado", "Galpão")
  let property_type: string | null = null;
  const typeMatch = description.match(/^(Apartamento|Casa|Terreno|Sobrado|Galpão|Prédio|Loja|Comercial|Chácara|Sítio|Fazenda)/i);
  if (typeMatch) {
    property_type = typeMatch[1];
  }

  // 2. Áreas (m²)
  let total_area: number | null = null;
  let private_area: number | null = null;
  let land_area: number | null = null;

  const parseAreaMatch = (match: RegExpMatchArray | null) => {
    if (!match) return null;
    const cleanStr = match[1].replace(/\./g, '').replace(',', '.');
    const val = parseFloat(cleanStr);
    return isNaN(val) ? null : val;
  };

  total_area = parseAreaMatch(description.match(/([\d.,]+)\s*de\s*área\s*total/i));
  private_area = parseAreaMatch(description.match(/([\d.,]+)\s*de\s*área\s*privativa/i));
  land_area = parseAreaMatch(description.match(/([\d.,]+)\s*de\s*área\s*do\s*terreno/i));

  // 3. Quartos
  let bedrooms: number | null = null;
  const bedMatch = description.match(/(\d+)\s*qto\(s\)/i) || description.match(/(\d+)\s*quarto\(s\)/i);
  if (bedMatch) {
    bedrooms = parseInt(bedMatch[1], 10);
  }

  return { property_type, total_area, private_area, land_area, bedrooms };
}

/**
 * Parser Oficial do Feed CSV da CAIXA por UF.
 */
export function parseCaixaCsvFeed(
  fileContent: string,
  uf: string,
  sourceFileUrl: string
): {
  metadata: CaixaFeedMetadata;
  rows: CaixaFeedRowParsed[];
} {
  const sourceFetchedAt = new Date().toISOString();
  const delimiter = ';';

  if (!fileContent || !fileContent.trim()) {
    return {
      metadata: {
        source: 'CAIXA',
        uf: uf.toUpperCase(),
        source_file_url: sourceFileUrl,
        source_generated_at: null,
        source_fetched_at: sourceFetchedAt,
        source_file_hash: '',
        encoding: 'UTF-8',
        delimiter,
        total_records_found: 0,
        valid_records_count: 0,
        rejected_mismatch_count: 0,
      },
      rows: [],
    };
  }

  // Cálculo de Hash SHA-256 / Simples do conteúdo bruto
  let hashVal = 0;
  for (let i = 0; i < fileContent.length; i++) {
    hashVal = (hashVal << 5) - hashVal + fileContent.charCodeAt(i);
    hashVal |= 0;
  }
  const sourceFileHash = Math.abs(hashVal).toString(16);

  const rawLines = fileContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 1. Extração da Data de geração da base do cabeçalho (ex: "Data de geração: 07/08/2026")
  let sourceGeneratedAt: string | null = null;
  for (let i = 0; i < Math.min(5, rawLines.length); i++) {
    const dateMatch = rawLines[i].match(/Data\s*de\s*geração:\s*;?\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (dateMatch) {
      const parts = dateMatch[1].split('/');
      if (parts.length === 3) {
        sourceGeneratedAt = `${parts[2]}-${parts[1]}-${parts[0]}`; // ISO YYYY-MM-DD
      }
      break;
    }
  }

  // 2. Localizar a linha do cabeçalho das colunas (contendo "N° do imóvel" e "Link de acesso")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const l = rawLines[i].toLowerCase();
    if ((l.includes('n° do imóvel') || l.includes('imóvel') || l.includes('imovel')) && l.includes('link de acesso')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    headerIndex = rawLines.findIndex((l) => l.includes(';') && (l.toLowerCase().includes('cidade') || l.toLowerCase().includes('preço')));
  }

  if (headerIndex === -1) {
    headerIndex = 0;
  }

  const headers = parseCsvLine(rawLines[headerIndex], delimiter);
  const headersLower = headers.map((h) => h.toLowerCase());

  const findIdx = (terms: string[]) => headersLower.findIndex((h) => terms.some((t) => h.includes(t)));

  const idxId = findIdx(['imóvel', 'imovel', 'n°', 'numero']);
  const idxUf = findIdx(['uf', 'estado']);
  const idxCidade = findIdx(['cidade']);
  const idxBairro = findIdx(['bairro']);
  const idxEndereco = findIdx(['endereço', 'endereco']);
  const idxPreco = findIdx(['preço', 'preco']);
  const idxAval = findIdx(['avaliação', 'avaliacao']);
  const idxDesc = findIdx(['desconto']);
  const idxFinanc = findIdx(['financiamento']);
  const idxDescricao = findIdx(['descrição', 'descricao']);
  const idxMod = findIdx(['modalidade']);
  const idxLink = findIdx(['link de acesso', 'link']);

  const rows: CaixaFeedRowParsed[] = [];
  let rejectedMismatchCount = 0;

  for (let i = headerIndex + 1; i < rawLines.length; i++) {
    const cols = parseCsvLine(rawLines[i], delimiter);
    if (cols.length < 3) continue;

    const rawId = idxId >= 0 && idxId < cols.length ? cols[idxId] : cols[0];
    const source_property_id = normalizeCaixaId(rawId);

    if (!source_property_id) continue;

    const rawLink = idxLink >= 0 && idxLink < cols.length ? cols[idxLink] : '';
    const hdnImovel = extractHdnImovelFromUrl(rawLink);

    // REGRA DE VALIDAÇÃO CRÍTICA: ID x Link de acesso
    if (hdnImovel && source_property_id !== hdnImovel) {
      rejectedMismatchCount++;
      continue; // REJEITAR A LINHA (SOURCE_ID_URL_MISMATCH)
    }

    const raw_list_data: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      raw_list_data[h || `col_${colIdx}`] = cols[colIdx] || '';
    });

    const precoStr = idxPreco >= 0 && idxPreco < cols.length ? cols[idxPreco] : '';
    const avalStr = idxAval >= 0 && idxAval < cols.length ? cols[idxAval] : '';
    const descStr = idxDesc >= 0 && idxDesc < cols.length ? cols[idxDesc] : '';
    const financStr = idxFinanc >= 0 && idxFinanc < cols.length ? cols[idxFinanc] : '';
    const descricaoStr = idxDescricao >= 0 && idxDescricao < cols.length ? cols[idxDescricao] : '';

    const sale_value = parseBrazilianMoney(precoStr);
    const appraisal_value = parseBrazilianMoney(avalStr);

    let discount_percentage: number | null = null;
    if (descStr) {
      const parsedDesc = parseFloat(descStr.replace(',', '.'));
      if (!isNaN(parsedDesc)) discount_percentage = parsedDesc;
    }

    if (discount_percentage === null && appraisal_value && sale_value && appraisal_value > 0) {
      discount_percentage = Number((((appraisal_value - sale_value) / appraisal_value) * 100).toFixed(2));
    }

    let accepts_financing: boolean | null = null;
    if (/sim/i.test(financStr)) accepts_financing = true;
    else if (/não|nao/i.test(financStr)) accepts_financing = false;

    // Parser determinístico da descrição
    const parsedDesc = parseDescriptionFields(descricaoStr);

    const rowObj: CaixaFeedRowParsed = {
      source_property_id, // TEXT preservando zeros!
      state: idxUf >= 0 && idxUf < cols.length ? cols[idxUf] : uf.toUpperCase(),
      city: idxCidade >= 0 && idxCidade < cols.length ? cols[idxCidade] : '',
      neighborhood: idxBairro >= 0 && idxBairro < cols.length ? cols[idxBairro] : '',
      address: idxEndereco >= 0 && idxEndereco < cols.length ? cols[idxEndereco] : '',
      sale_value,
      appraisal_value,
      discount_percentage,
      accepts_financing,
      description: descricaoStr,
      sale_modality: idxMod >= 0 && idxMod < cols.length ? cols[idxMod] : 'Venda Direta Caixa',
      source_url: rawLink || `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=${source_property_id}`,
      
      property_type: parsedDesc.property_type,
      total_area: parsedDesc.total_area,
      private_area: parsedDesc.private_area,
      land_area: parsedDesc.land_area,
      bedrooms: parsedDesc.bedrooms,

      raw_list_data,
    };

    rows.push(rowObj);
  }

  return {
    metadata: {
      source: 'CAIXA',
      uf: uf.toUpperCase(),
      source_file_url: sourceFileUrl,
      source_generated_at: sourceGeneratedAt,
      source_fetched_at: sourceFetchedAt,
      source_file_hash: sourceFileHash,
      encoding: 'windows-1252',
      delimiter,
      total_records_found: rows.length + rejectedMismatchCount,
      valid_records_count: rows.length,
      rejected_mismatch_count: rejectedMismatchCount,
    },
    rows,
  };
}

// Compatibilidade legada
export type CaixaListRowParsed = CaixaFeedRowParsed;
export type CanonicalProperty = any;

export function parseCaixaList(fileContent: string) {
  const result = parseCaixaCsvFeed(fileContent, 'SP', 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_SP.csv');
  return {
    encoding: result.metadata.encoding,
    separator: result.metadata.delimiter,
    totalRows: result.metadata.valid_records_count,
    rows: result.rows,
    headers: [],
  };
}

export function buildCanonicalProperty(listRow: any, detailParsed: any) {
  return {
    source: 'CAIXA',
    source_property_id: listRow.source_property_id,
    source_url: listRow.source_url || detailParsed?.source_url || '',
    title: `${listRow.property_type || 'Imóvel'} - ${listRow.city}`,
    property_type: listRow.property_type,
    sale_modality: listRow.sale_modality,
    state: listRow.state,
    city: listRow.city,
    neighborhood: listRow.neighborhood,
    address: listRow.address,
    appraisal_value: listRow.appraisal_value,
    sale_value: listRow.sale_value,
    discount_percentage: listRow.discount_percentage,
    bedrooms: listRow.bedrooms,
    parking_spaces: detailParsed?.property?.parking_spaces || null,
    total_area: listRow.total_area,
    private_area: listRow.private_area,
    land_area: listRow.land_area,
    description: listRow.description,
    accepts_financing: listRow.accepts_financing,
    main_photo_url: detailParsed?.main_photo_url || null,
    photos: detailParsed?.photos || [],
    documents: detailParsed?.documents?.list || [],
    raw_list_data: listRow.raw_list_data || {},
    raw_detail_data: detailParsed?.debug || {},
  };
}

