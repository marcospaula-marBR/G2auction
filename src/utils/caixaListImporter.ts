export interface CaixaFeedMetadata {
  source: 'CAIXA';
  uf: string;
  source_file_url: string;
  source_generated_at: string | null;
  source_fetched_at: string;
  source_file_hash: string;
  encoding: string;
  delimiter: string;
  total_records_found: number;
  valid_records_count: number;
  invalid_records_count: number;
  rejected_mismatch_count: number;
}

export interface CaixaFeedRowParsed {
  source: 'CAIXA';
  source_property_id: string;
  state: string;
  city: string;
  neighborhood: string | null;
  address: string | null;
  sale_value: number | null;
  current_minimum_value: number | null;
  appraisal_value: number | null;
  discount_percentage: number | null;
  calculated_discount_percentage: number | null;
  accepts_financing: boolean | null;
  occupancy_status: 'OCCUPIED' | 'VACANT' | 'UNKNOWN';
  description: string | null;
  sale_modality: string | null;
  source_url: string;
  
  property_type: string | null;
  total_area: number | null;
  private_area: number | null;
  land_area: number | null;
  bedrooms: number | null;
  parking_spaces: number | null;

  source_hash: string;
  raw_list_data: Record<string, string>;
}

export interface CaixaCsvParseResult {
  metadata: CaixaFeedMetadata;
  rows: CaixaFeedRowParsed[];
  invalid_rows_count: number;
}

/**
 * Constrói a URL oficial de acesso ao CSV por UF da CAIXA.
 */
export function buildCaixaFeedUrl(uf: string): string {
  const cleanUf = (uf || 'SP').trim().toUpperCase();
  return `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${cleanUf}.csv`;
}

/**
 * Extrai o parâmetro hdnimovel de uma URL do Link de acesso.
 */
export function extractHdnImovelFromUrl(urlStr: string): string | null {
  if (!urlStr) return null;
  try {
    const match = urlStr.match(/hdnimovel=(\d{10,15})/i);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Normaliza o ID para fins de comparação segura (removendo caracteres não numéricos).
 */
export function normalizeCaixaId(idStr: string | null | undefined): string {
  if (!idStr) return '';
  return String(idStr).replace(/\D/g, '');
}

/**
 * Parser Robustíssimo de Números Brasileiros / Decimais / Monetários e Porcentagens.
 * Trata corretamente: "300.600,00", "501.000", "40,00", "40.00", "171.43", "171,43", "40%".
 */
export function parseBrazilianNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  let clean = String(text).replace(/R\$\s*/gi, '').replace(/%/g, '').trim();
  if (!clean) return null;

  // 1. Se contém tanto ponto quanto vírgula (ex: "300.600,00" ou "1.714,43")
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } 
  // 2. Se contém apenas vírgula (ex: "40,00" ou "171,43") -> substitui vírgula por ponto
  else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  } 
  // 3. Se contém apenas ponto (ex: "40.00", "171.43", "300.600")
  else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length > 2) {
      // Múltiplos pontos (ex: "1.000.000") -> milhares
      clean = parts.join('');
    } else {
      // Um único ponto
      const intPart = parts[0];
      const decPart = parts[1];

      if (decPart.length === 3 && intPart.length <= 3 && !decPart.endsWith('00')) {
        // Formato milhar sem centavos (ex: "300.600" -> 300600)
        clean = parts.join('');
      } else if (decPart.length > 2 && decPart.endsWith('00')) {
        // Formato com zeros extras (ex: "40.0000" -> 40.00)
        clean = `${intPart}.${decPart.substring(0, 2)}`;
      } else {
        // Decimal padrão (ex: "171.43" -> 171.43, "40.00" -> 40.00)
        // Preserva o ponto decimal original
      }
    }
  }

  const val = parseFloat(clean);
  return isNaN(val) ? null : Number(val.toFixed(2));
}

/**
 * Alias de compatibilidade para valores monetários
 */
export function parseBrazilianMoney(text: string | null | undefined): number | null {
  return parseBrazilianNumber(text);
}

/**
 * Simples gerador de HASH determinístico SHA-256/FNV-1a para string
 */
export function calculateSimpleHash(content: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Parser de CSV consciente de aspas, delimitadores escapados e novas linhas.
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
 * Parser Determinístico do Texto da Descrição do Imóvel.
 * Extrai tipo, áreas (privativa, total, terreno), quartos e vagas sem remover decimais.
 */
export function parseCaixaDescription(description: string): {
  property_type: string | null;
  total_area: number | null;
  private_area: number | null;
  land_area: number | null;
  bedrooms: number | null;
  parking_spaces: number | null;
} {
  if (!description) {
    return {
      property_type: null,
      total_area: null,
      private_area: null,
      land_area: null,
      bedrooms: null,
      parking_spaces: null,
    };
  }

  // 1. Tipo do Imóvel
  let property_type: string | null = null;
  const typeMatch = description.match(/^(Apartamento|Casa|Terreno|Sobrado|Galpão|Prédio|Loja|Sala|Comercial|Chácara|Sítio|Fazenda)/i);
  if (typeMatch) {
    const rawType = typeMatch[1].toLowerCase();
    if (rawType === 'apartamento') property_type = 'Apartamento';
    else if (rawType === 'casa' || rawType === 'sobrado') property_type = 'Casa';
    else if (rawType === 'terreno' || rawType === 'chácara' || rawType === 'sítio' || rawType === 'fazenda') property_type = 'Terreno';
    else if (rawType === 'loja') property_type = 'Loja';
    else if (rawType === 'sala') property_type = 'Sala';
    else if (rawType === 'galpão') property_type = 'Galpão';
    else if (rawType === 'prédio') property_type = 'Prédio';
    else property_type = 'Comercial';
  }

  // 2. Áreas em m² (utilizando parseBrazilianNumber)
  const parseAreaMatch = (match: RegExpMatchArray | null): number | null => {
    if (!match) return null;
    return parseBrazilianNumber(match[1]);
  };

  const total_area = parseAreaMatch(description.match(/([\d.,]+)\s*de\s*área\s*total/i));
  const private_area = parseAreaMatch(description.match(/([\d.,]+)\s*de\s*área\s*privativa/i));
  const land_area = parseAreaMatch(description.match(/([\d.,]+)\s*de\s*área\s*(?:do\s*)?terreno/i));

  // 3. Quartos
  let bedrooms: number | null = null;
  const bedMatch = description.match(/(\d+)\s*qto\(s\)/i) || description.match(/(\d+)\s*quarto\(s\)/i) || description.match(/(\d+)\s*dorms?/i);
  if (bedMatch) {
    bedrooms = parseInt(bedMatch[1], 10);
  }

  // 4. Vagas de Garagem (Somente se quantidade for explícita)
  let parking_spaces: number | null = null;
  const parkMatch = description.match(/(\d+)\s*vaga\(s\)/i) || description.match(/(\d+)\s*vagas?/i);
  if (parkMatch) {
    parking_spaces = parseInt(parkMatch[1], 10);
  }

  return { property_type, total_area, private_area, land_area, bedrooms, parking_spaces };
}

export const parseDescriptionFields = parseCaixaDescription;

/**
 * FUNÇÃO CENTRAL ÚNICA: parseCaixaCsv()
 */
export function parseCaixaCsv(
  fileContent: string,
  uf: string = 'SP',
  sourceFileUrl?: string
): CaixaCsvParseResult {
  const sourceFetchedAt = new Date().toISOString();
  const sourceFileHash = calculateSimpleHash(fileContent || '');
  const urlUsed = sourceFileUrl || buildCaixaFeedUrl(uf);

  if (!fileContent || fileContent.trim().length === 0) {
    return {
      metadata: {
        source: 'CAIXA',
        uf: uf.toUpperCase(),
        source_file_url: urlUsed,
        source_generated_at: null,
        source_fetched_at: sourceFetchedAt,
        source_file_hash: sourceFileHash,
        encoding: 'UTF-8 / Windows-1252',
        delimiter: ';',
        total_records_found: 0,
        valid_records_count: 0,
        invalid_records_count: 0,
        rejected_mismatch_count: 0,
      },
      rows: [],
      invalid_rows_count: 0,
    };
  }

  let sourceGeneratedAt: string | null = null;
  const genDateMatch = fileContent.match(/Data\s*de\s*geração:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (genDateMatch) {
    const [, day, month, year] = genDateMatch;
    sourceGeneratedAt = `${year}-${month}-${day}`;
  }

  const rawLines = fileContent.split(/\r?\n/);
  let delimiter = ';';
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(rawLines.length, 35); i++) {
    const line = rawLines[i];
    if (!line || !line.trim()) continue;

    if (line.includes(';')) delimiter = ';';
    else if (line.includes(',')) delimiter = ',';

    const cols = parseCsvLine(line, delimiter);
    const lineLower = cols.map((c) => c.toLowerCase());

    const hasIdCol = lineLower.some((c) => c.includes('n° do imóvel') || c.includes('nº do imóvel') || c.includes('num_imovel') || c.includes('imóvel'));
    const hasLinkCol = lineLower.some((c) => c.includes('link de acesso') || c.includes('link') || c.includes('url'));

    if (hasIdCol && hasLinkCol) {
      headerIndex = i;
      headers = cols;
      break;
    }
  }

  if (headerIndex === -1) {
    for (let i = 0; i < Math.min(rawLines.length, 20); i++) {
      if (rawLines[i] && (rawLines[i].includes('N° do imóvel') || rawLines[i].includes('Link de acesso'))) {
        headerIndex = i;
        headers = parseCsvLine(rawLines[i], delimiter);
        break;
      }
    }
  }

  if (headerIndex === -1 && rawLines.length > 0) {
    headerIndex = 0;
    headers = parseCsvLine(rawLines[0], delimiter);
  }

  const findColIndex = (terms: string[]): number => {
    return headers.findIndex((h) => terms.some((t) => h.toLowerCase().includes(t.toLowerCase())));
  };

  const idxId = findColIndex(['n° do imóvel', 'nº do imóvel', 'num_imovel', 'imóvel']);
  const idxUf = findColIndex(['uf', 'estado']);
  const idxCity = findColIndex(['cidade']);
  const idxNeigh = findColIndex(['bairro']);
  const idxAddr = findColIndex(['endereço', 'endereco']);
  const idxPrice = findColIndex(['preço', 'preco', 'valor de venda']);
  const idxAppraisal = findColIndex(['valor de avaliação', 'avaliacao', 'avaliação']);
  const idxDiscount = findColIndex(['desconto']);
  const idxFinancing = findColIndex(['financiamento']);
  const idxDesc = findColIndex(['descrição', 'descricao']);
  const idxModality = findColIndex(['modalidade de venda', 'modalidade']);
  const idxLink = findColIndex(['link de acesso', 'link']);

  const rows: CaixaFeedRowParsed[] = [];
  let rejectedMismatchCount = 0;
  let invalidRowsCount = 0;

  for (let i = headerIndex + 1; i < rawLines.length; i++) {
    const lineStr = rawLines[i];
    if (!lineStr || !lineStr.trim()) continue;

    const cols = parseCsvLine(lineStr, delimiter);
    if (cols.length < 3) continue;

    const rawIdStr = idxId !== -1 ? cols[idxId] : cols[0];
    if (!rawIdStr) {
      invalidRowsCount++;
      continue;
    }

    const source_property_id = rawIdStr.trim();
    if (!source_property_id || !/^\d{5,15}$/.test(normalizeCaixaId(source_property_id))) {
      invalidRowsCount++;
      continue;
    }

    const rawLink = idxLink !== -1 ? cols[idxLink] : '';
    const source_url = rawLink && rawLink.startsWith('http')
      ? rawLink.trim()
      : `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${source_property_id}`;

    const hdnImovelInLink = extractHdnImovelFromUrl(source_url);
    if (hdnImovelInLink) {
      if (normalizeCaixaId(source_property_id) !== normalizeCaixaId(hdnImovelInLink)) {
        rejectedMismatchCount++;
        invalidRowsCount++;
        continue;
      }
    }

    const state = (idxUf !== -1 ? cols[idxUf] : uf).trim().toUpperCase();
    const city = idxCity !== -1 ? cols[idxCity].trim() : '';
    const neighborhood = idxNeigh !== -1 && cols[idxNeigh] ? cols[idxNeigh].trim() : null;
    const address = idxAddr !== -1 && cols[idxAddr] ? cols[idxAddr].trim() : null;

    const sale_value = idxPrice !== -1 ? parseBrazilianNumber(cols[idxPrice]) : null;
    const appraisal_value = idxAppraisal !== -1 ? parseBrazilianNumber(cols[idxAppraisal]) : null;
    let discount_percentage = idxDiscount !== -1 ? parseBrazilianNumber(cols[idxDiscount]) : null;

    let calculated_discount_percentage: number | null = null;
    if (appraisal_value !== null && sale_value !== null && appraisal_value > 0) {
      calculated_discount_percentage = Number((((appraisal_value - sale_value) / appraisal_value) * 100).toFixed(2));
      // Se desconto for nulo, for > 100 (ex: erro de formato 4000) ou for < 0, usar o calculado real
      if (discount_percentage === null || discount_percentage > 100 || discount_percentage < 0) {
        discount_percentage = calculated_discount_percentage;
      }
    }

    let accepts_financing: boolean | null = null;
    if (idxFinancing !== -1 && cols[idxFinancing]) {
      const finStr = cols[idxFinancing].toLowerCase().trim();
      if (finStr.includes('sim') || finStr === 'true') accepts_financing = true;
      else if (finStr.includes('não') || finStr.includes('nao') || finStr === 'false') accepts_financing = false;
    }

    const description = idxDesc !== -1 && cols[idxDesc] ? cols[idxDesc].trim() : null;
    const sale_modality = idxModality !== -1 && cols[idxModality] ? cols[idxModality].trim() : null;

    const parsedDesc = parseCaixaDescription(description || '');

    const raw_list_data: Record<string, string> = {};
    headers.forEach((h, colIdx) => {
      if (cols[colIdx] !== undefined) {
        raw_list_data[h] = cols[colIdx];
      }
    });

    const source_hash = calculateSimpleHash(
      `${source_property_id}|${sale_value}|${appraisal_value}|${discount_percentage}|${sale_modality}|${address}|${description}|${source_url}`
    );

    const rowObj: CaixaFeedRowParsed = {
      source: 'CAIXA',
      source_property_id,
      state,
      city,
      neighborhood,
      address,
      sale_value,
      current_minimum_value: sale_value,
      appraisal_value,
      discount_percentage,
      calculated_discount_percentage,
      accepts_financing,
      occupancy_status: 'UNKNOWN',
      description,
      sale_modality,
      source_url,
      property_type: parsedDesc.property_type,
      total_area: parsedDesc.total_area,
      private_area: parsedDesc.private_area,
      land_area: parsedDesc.land_area,
      bedrooms: parsedDesc.bedrooms,
      parking_spaces: parsedDesc.parking_spaces,
      source_hash,
      raw_list_data,
    };

    rows.push(rowObj);
  }

  return {
    metadata: {
      source: 'CAIXA',
      uf: uf.toUpperCase(),
      source_file_url: urlUsed,
      source_generated_at: sourceGeneratedAt,
      source_fetched_at: sourceFetchedAt,
      source_file_hash: sourceFileHash,
      encoding: 'UTF-8 / Windows-1252',
      delimiter,
      total_records_found: rows.length + rejectedMismatchCount + invalidRowsCount,
      valid_records_count: rows.length,
      invalid_records_count: invalidRowsCount,
      rejected_mismatch_count: rejectedMismatchCount,
    },
    rows,
    invalid_rows_count: invalidRowsCount,
  };
}

export const parseCaixaCsvFeed = parseCaixaCsv;

export function parseCaixaList(fileContent: string, uf: string = 'SP') {
  const res = parseCaixaCsv(fileContent, uf);
  return {
    encoding: res.metadata.encoding,
    separator: res.metadata.delimiter,
    totalRows: res.metadata.valid_records_count,
    rows: res.rows,
    headers: ['N° do imóvel', 'UF', 'Cidade', 'Bairro', 'Endereço', 'Preço', 'Valor de avaliação', 'Desconto', 'Financiamento', 'Descrição', 'Modalidade de venda', 'Link de acesso'],
    metadata: res.metadata,
  };
}

export type CaixaListRowParsed = CaixaFeedRowParsed;
export type CanonicalProperty = any;

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
    current_minimum_value: listRow.sale_value,
    discount_percentage: listRow.discount_percentage,
    calculated_discount_percentage: listRow.calculated_discount_percentage,
    bedrooms: listRow.bedrooms,
    parking_spaces: detailParsed?.property?.parking_spaces || listRow.parking_spaces || null,
    total_area: listRow.total_area,
    private_area: listRow.private_area,
    land_area: listRow.land_area,
    occupancy_status: listRow.occupancy_status || 'UNKNOWN',
    description: listRow.description,
    accepts_financing: listRow.accepts_financing,
    main_photo_url: detailParsed?.main_photo_url || null,
    photos: detailParsed?.photos || [],
    documents: detailParsed?.documents?.list || [],
    raw_list_data: listRow.raw_list_data || {},
    raw_detail_data: detailParsed?.debug || {},
  };
}
