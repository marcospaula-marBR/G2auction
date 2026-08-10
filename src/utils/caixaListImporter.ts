/**
 * Módulo: caixaListImporter
 * Responsável por:
 * 1. fetchCaixaDownloadPage()
 * 2. parseCaixaDownloadForm()
 * 3. downloadCaixaStateList(uf)
 * 4. parseCaixaList(fileContent)
 * 5. normalizeCaixaId(value)
 * 6. buildCanonicalProperty()
 */

export interface CaixaFormParsed {
  actionUrl: string;
  method: string;
  ufFieldName: string;
  hiddenFields: Record<string, string>;
  availableUfs: string[];
}

export interface CaixaListRowParsed {
  source_property_id: string; // TEXT! Preserva zeros à esquerda ex: "0000010306954"
  uf: string;
  cidade: string;
  bairro: string;
  endereco: string;
  preco_venda: string;
  valor_avaliacao: string;
  desconto: string;
  modalidade: string;
  link: string;
  raw_list_data: Record<string, any>;
}

export interface CanonicalProperty {
  source: string; // "CAIXA"
  source_property_id: string; // TEXT preservando zeros
  source_url: string;
  title: string | null;
  property_type: string | null;
  sale_modality: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  zipcode: string | null;

  appraisal_value: number | null;
  sale_value: number | null;
  current_minimum_value: number | null;
  first_auction_value: number | null;
  second_auction_value: number | null;
  discount_percentage: number | null;

  bedrooms: number | null;
  parking_spaces: number | null;

  total_area: number | null;
  private_area: number | null;
  useful_area: number | null;
  land_area: number | null;

  registration_number: string | null;
  district: string | null;
  registry_office: string | null;
  municipal_registration: string | null;

  description: string | null;

  accepts_financing: boolean | null;
  accepts_fgts: boolean | null;
  occupied: boolean | null;

  condominium_notes: string | null;
  tax_notes: string | null;

  auction_notice_number: string | null;
  auction_notice_item: string | null;
  auctioneer: string | null;

  first_auction_date: string | null;
  second_auction_date: string | null;

  main_photo_url: string | null;
  photos: { url: string; position: number; is_main: boolean }[];
  documents: { type: string; title: string; url: string }[];

  raw_list_data: Record<string, any>;
  raw_detail_data: Record<string, any>;
  source_hash?: string;
}

/**
 * Normaliza o ID do Imóvel da CAIXA.
 * REGRA CRÍTICA: Remove tudo que não for número, mas MANTÉM COMO STRING/TEXT.
 * NUNCA converter para Integer. Preserva zeros à esquerda!
 * Exemplo: "000001030695-4" -> "0000010306954"
 */
export function normalizeCaixaId(value: string | number | null | undefined): string {
  if (!value) return '';
  const strVal = String(value).trim();
  const cleanStr = strVal.replace(/\D/g, '');
  return cleanStr; // Retorna TEXT sem conversão matemática
}

/**
 * Analisa o formulário HTML da página oficial download-lista.asp da CAIXA.
 */
export function parseCaixaDownloadForm(html: string): CaixaFormParsed {
  const defaultAction = 'https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp';
  const actionMatch = html.match(/<form[^>]*action=["']([^"']+)["']/i);
  const methodMatch = html.match(/<form[^>]*method=["']([^"']+)["']/i);

  let actionUrl = actionMatch ? actionMatch[1] : defaultAction;
  if (actionUrl.startsWith('/')) {
    actionUrl = `https://venda-imoveis.caixa.gov.br${actionUrl}`;
  } else if (!actionUrl.startsWith('http')) {
    actionUrl = `https://venda-imoveis.caixa.gov.br/sistema/${actionUrl}`;
  }

  const method = (methodMatch ? methodMatch[1] : 'POST').toUpperCase();

  // Inspeciona inputs hidden
  const hiddenFields: Record<string, string> = {};
  const hiddenRegex = /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = hiddenRegex.exec(html)) !== null) {
    hiddenFields[hMatch[1]] = hMatch[2];
  }

  // Identifica o nome do select/input de UF
  let ufFieldName = 'hdnEstado';
  const ufSelectMatch = html.match(/<select[^>]*name=["']([^"']*uf[^"']*|[^"']*estado[^"']*)["']/i);
  if (ufSelectMatch) {
    ufFieldName = ufSelectMatch[1];
  }

  // Extrai lista de UFs suportadas do HTML
  const availableUfs: string[] = [];
  const ufOptionRegex = /<option[^>]*value=["']([A-Z]{2})["']/gi;
  let oMatch: RegExpExecArray | null;
  while ((oMatch = ufOptionRegex.exec(html)) !== null) {
    if (!availableUfs.includes(oMatch[1])) {
      availableUfs.push(oMatch[1]);
    }
  }

  return {
    actionUrl,
    method,
    ufFieldName,
    hiddenFields,
    availableUfs: availableUfs.length > 0 ? availableUfs : ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'BA'],
  };
}

/**
 * Detecta delimitador (;, tab, virgula) e analisa o conteúdo CSV/Tabular da lista oficial da CAIXA.
 */
export function parseCaixaList(fileContent: string): {
  encoding: string;
  separator: string;
  totalRows: number;
  rows: CaixaListRowParsed[];
  headers: string[];
} {
  if (!fileContent || !fileContent.trim()) {
    return { encoding: 'UTF-8', separator: ';', totalRows: 0, rows: [], headers: [] };
  }

  // Detecta codificação (heurística UTF-8 vs Latin1)
  const isUtf8 = fileContent.includes('Ã') || fileContent.includes('Ç') || !/[\xFF-\xFF]/.test(fileContent);
  const encoding = isUtf8 ? 'UTF-8' : 'ISO-8859-1';

  // Divide em linhas
  const rawLines = fileContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) {
    return { encoding, separator: ';', totalRows: 0, rows: [], headers: [] };
  }

  // Detecta delimitador na primeira linha válida
  const sampleLine = rawLines.find((l) => l.includes(';') || l.includes(',') || l.includes('\t')) || rawLines[0];
  let separator = ';';
  const countSemi = (sampleLine.match(/;/g) || []).length;
  const countComma = (sampleLine.match(/,/g) || []).length;
  const countTab = (sampleLine.match(/\t/g) || []).length;

  if (countTab > countSemi && countTab > countComma) separator = '\t';
  else if (countComma > countSemi) separator = ',';

  // Localiza a linha do cabeçalho
  let headerIndex = 0;
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const l = rawLines[i].toLowerCase();
    if (l.includes('cidade') || l.includes('imóvel') || l.includes('imovel') || l.includes('preço') || l.includes('preco')) {
      headerIndex = i;
      break;
    }
  }

  const parseLine = (line: string) => line.split(separator).map((c) => c.replace(/^["']|["']$/g, '').trim());

  const headers = parseLine(rawLines[headerIndex]);
  const headersLower = headers.map((h) => h.toLowerCase());

  // Mapeamento dinâmico de colunas pelos nomes dos cabeçalhos
  const findIdx = (terms: string[]) => headersLower.findIndex((h) => terms.some((t) => h.includes(t)));

  const idxId = findIdx(['imóvel', 'imovel', 'id', 'numero']);
  const idxUf = findIdx(['uf', 'estado']);
  const idxCidade = findIdx(['cidade', 'município', 'municipio']);
  const idxBairro = findIdx(['bairro']);
  const idxEndereco = findIdx(['endereço', 'endereco', 'logradouro']);
  const idxPreco = findIdx(['preço', 'preco', 'valor']);
  const idxAval = findIdx(['avaliação', 'avaliacao']);
  const idxDesc = findIdx(['desconto']);
  const idxMod = findIdx(['modalidade']);
  const idxLink = findIdx(['link', 'edital', 'acesso']);

  const rows: CaixaListRowParsed[] = [];

  for (let i = headerIndex + 1; i < rawLines.length; i++) {
    const cols = parseLine(rawLines[i]);
    if (cols.length < 2) continue;

    const rawId = idxId >= 0 && idxId < cols.length ? cols[idxId] : cols[0];
    const source_property_id = normalizeCaixaId(rawId);

    if (!source_property_id) continue;

    // Preserva a linha original em formato JSON
    const raw_list_data: Record<string, any> = {};
    headers.forEach((h, colIdx) => {
      raw_list_data[h || `col_${colIdx}`] = cols[colIdx] || '';
    });

    const rowObj: CaixaListRowParsed = {
      source_property_id, // TEXT! ex: "0000010306954"
      uf: idxUf >= 0 && idxUf < cols.length ? cols[idxUf] : 'SP',
      cidade: idxCidade >= 0 && idxCidade < cols.length ? cols[idxCidade] : '',
      bairro: idxBairro >= 0 && idxBairro < cols.length ? cols[idxBairro] : '',
      endereco: idxEndereco >= 0 && idxEndereco < cols.length ? cols[idxEndereco] : '',
      preco_venda: idxPreco >= 0 && idxPreco < cols.length ? cols[idxPreco] : '',
      valor_avaliacao: idxAval >= 0 && idxAval < cols.length ? cols[idxAval] : '',
      desconto: idxDesc >= 0 && idxDesc < cols.length ? cols[idxDesc] : '',
      modalidade: idxMod >= 0 && idxMod < cols.length ? cols[idxMod] : 'Venda Direta Caixa',
      link: idxLink >= 0 && idxLink < cols.length ? cols[idxLink] : `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${source_property_id}`,
      raw_list_data,
    };

    rows.push(rowObj);
  }

  return {
    encoding,
    separator,
    totalRows: rows.length,
    rows,
    headers,
  };
}

/**
 * Constrói a URL da ficha individual oficial da CAIXA a partir do ID.
 */
export function buildCaixaDetailUrl(id: string): string {
  const cleanId = normalizeCaixaId(id);
  return `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${cleanId}`;
}

/**
 * Monta o objeto de propriedade canônica unificada a ser persistido ou exibido.
 */
export function buildCanonicalProperty(
  listRow: CaixaListRowParsed,
  detailParsed: any
): CanonicalProperty {
  const source_property_id = normalizeCaixaId(listRow.source_property_id);
  const source_url = detailParsed.source_url || buildCaixaDetailUrl(source_property_id);

  const prop = detailParsed.property || {};

  // Formatação de fotos em estrutura canônica [{url, position, is_main}]
  const photos: { url: string; position: number; is_main: boolean }[] = [];
  const mainPhotoUrl = detailParsed.main_photo_url || null;

  if (mainPhotoUrl) {
    photos.push({ url: mainPhotoUrl, position: 0, is_main: true });
  }

  if (Array.isArray(detailParsed.photos)) {
    detailParsed.photos.forEach((url: string) => {
      if (url && url !== mainPhotoUrl && !photos.some((p) => p.url === url)) {
        photos.push({ url, position: photos.length, is_main: false });
      }
    });
  }

  // Documentos
  const documents: { type: string; title: string; url: string }[] = [];
  if (detailParsed.documents?.auction_notice_url) {
    documents.push({
      type: 'AUCTION_NOTICE',
      title: 'Edital e Anexos',
      url: detailParsed.documents.auction_notice_url,
    });
  }
  if (detailParsed.documents?.registration_url) {
    documents.push({
      type: 'REGISTRATION',
      title: 'Matrícula do Imóvel',
      url: detailParsed.documents.registration_url,
    });
  }

  // Cálculo determinístico de hash de alteração
  const hashInput = `${source_property_id}_${prop.sale_value || listRow.preco_venda}_${prop.appraisal_value || listRow.valor_avaliacao}_${prop.address || listRow.endereco}`;
  let simpleHash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    simpleHash = (simpleHash << 5) - simpleHash + hashInput.charCodeAt(i);
    simpleHash |= 0;
  }
  const source_hash = Math.abs(simpleHash).toString(16);

  return {
    source: 'CAIXA',
    source_property_id,
    source_url,
    title: prop.address ? `${prop.property_type || 'Imóvel'} - ${listRow.cidade}` : `Imóvel CAIXA nº ${source_property_id}`,
    property_type: prop.property_type || null,
    sale_modality: prop.sale_modality || listRow.modalidade || null,
    state: prop.state || listRow.uf || null,
    city: prop.city || listRow.cidade || null,
    neighborhood: prop.neighborhood || listRow.bairro || null,
    address: prop.address || listRow.endereco || null,
    zipcode: prop.zipcode || null,

    appraisal_value: prop.appraisal_value ?? null,
    sale_value: prop.sale_value ?? null,
    current_minimum_value: prop.sale_value ?? null,
    first_auction_value: prop.first_auction_value ?? null,
    second_auction_value: prop.second_auction_value ?? null,
    discount_percentage: prop.discount_percentage ?? null,

    bedrooms: prop.bedrooms ?? null,
    parking_spaces: prop.parking_spaces ?? null,

    total_area: prop.total_area ?? null,
    private_area: prop.private_area ?? null,
    useful_area: prop.useful_area ?? null,
    land_area: prop.land_area ?? null,

    registration_number: prop.registration_number ?? null,
    district: prop.district ?? null,
    registry_office: prop.registry_office ?? null,
    municipal_registration: prop.municipal_registration ?? null,

    description: prop.description ?? null,

    accepts_financing: prop.accepts_financing ?? null,
    accepts_fgts: prop.accepts_fgts ?? null,
    occupied: prop.occupied === 'Ocupado' ? true : prop.occupied === 'Desocupado' ? false : null,

    condominium_notes: prop.condominium_notes ?? null,
    tax_notes: prop.tax_notes ?? null,

    auction_notice_number: prop.auction_notice_number ?? null,
    auction_notice_item: prop.auction_notice_item ?? null,
    auctioneer: prop.auctioneer ?? null,

    first_auction_date: prop.first_auction_date ?? null,
    second_auction_date: prop.second_auction_date ?? null,

    main_photo_url: mainPhotoUrl,
    photos,
    documents,

    raw_list_data: listRow.raw_list_data || {},
    raw_detail_data: detailParsed.debug || {},
    source_hash,
  };
}
