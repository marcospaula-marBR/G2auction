export interface CaixaPropertyDebugJSON {
  success: boolean;
  error?: string;
  caixa_id: string;
  source_url: string;
  property: {
    property_type: string | null;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    zipcode: string | null;

    appraisal_value: number | null;
    sale_value: number | null;
    first_auction_value: number | null;
    second_auction_value: number | null;
    discount_percentage: number | null;

    sale_modality: string | null;

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
    occupied: string | null;

    condominium_notes: string | null;
    tax_notes: string | null;

    first_auction_date: string | null;
    second_auction_date: string | null;

    auction_notice_number: string | null;
    auction_notice_item: string | null;

    auctioneer: string | null;
  };
  documents: {
    auction_notice_url: string | null;
    registration_url: string | null;
    list: { type: string; title: string; url: string }[];
  };
  main_photo_url: string | null;
  photos: string[];
  debug?: {
    htmlLength: number;
    httpStatus: number;
    foundPhotosCount: number;
    validPhotosCount: number;
    foundFieldsCount: number;
    missingFieldsCount: number;
    rawHtmlSnippet: string;
  };
}

/**
 * Converte valor monetário brasileiro (ex: "R$ 145.104,71") para número (ex: 145104.71).
 */
export function parseBrazilianMoney(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/R\$\s*([\d.]+,\d{2})/i) || text.match(/([\d.]+,\d{2})/);
  if (!match) return null;
  const numStr = match[1].replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Converte número com vírgula ou área brasileira (ex: "102,89m2" ou "102,89") para número (ex: 102.89).
 */
export function parseBrazilianNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/([\d.]+,\d{1,2})/);
  if (!match) return null;
  const numStr = match[1].replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Módulo de Extração de Fotos do HTML da Ficha CAIXA.
 */
export function extractCaixaPhotos(html: string, caixaId: string): string[] {
  const foundUrls = new Set<string>();

  // Inspeciona src, href, data-src, data-lazy-src, srcset
  const photoRegex = /(?:src|href|data-src|data-lazy-src)="([^"]*\/fotos\/[A-Za-z0-9_.-]+\.(?:jpg|png|jpeg))"/gi;
  let match: RegExpExecArray | null;
  while ((match = photoRegex.exec(html)) !== null) {
    let url = match[1];
    if (url.startsWith('/')) {
      url = `https://venda-imoveis.caixa.gov.br${url}`;
    } else if (!url.startsWith('http')) {
      url = `https://venda-imoveis.caixa.gov.br/fotos/${url}`;
    }
    foundUrls.add(url);
  }

  // Fallback padrão se nenhuma foto explícita for encontrada na página estática ASP
  if (foundUrls.size === 0 && caixaId) {
    const cleanId = String(caixaId).replace(/\D/g, '');
    foundUrls.add(`https://venda-imoveis.caixa.gov.br/fotos/F${cleanId}21.jpg`);
  }

  return Array.from(foundUrls);
}

/**
 * Módulo de Extração de Documentos do HTML da Ficha CAIXA.
 */
export function extractCaixaDocuments(html: string): { type: string; title: string; url: string }[] {
  const docs: { type: string; title: string; url: string }[] = [];

  const docRegex = /<a[^>]*href=["']([^"']+\.(?:pdf|doc|docx))["'][^>]*>(.*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = docRegex.exec(html)) !== null) {
    let url = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim() || 'Documento Oficial';

    if (url.startsWith('/')) {
      url = `https://venda-imoveis.caixa.gov.br${url}`;
    }

    let type = 'OTHER';
    if (/edital/i.test(linkText) || /edital/i.test(url)) type = 'AUCTION_NOTICE';
    else if (/matricula|matrícula/i.test(linkText) || /matricula/i.test(url)) type = 'REGISTRATION';

    docs.push({ type, title: linkText, url });
  }

  return docs;
}

/**
 * Parser Determinístico de HTML de Ficha de Imóvel da CAIXA.
 */
export function parseCaixaHTML(
  html: string,
  caixaId: string,
  sourceUrl: string,
  httpStatus: number
): CaixaPropertyDebugJSON {
  if (!html || html.trim().length === 0) {
    return {
      success: false,
      error: 'PROPERTY_NOT_FOUND',
      caixa_id: caixaId,
      source_url: sourceUrl,
      property: emptyPropertyState(),
      documents: { auction_notice_url: null, registration_url: null, list: [] },
      main_photo_url: null,
      photos: [],
      debug: {
        htmlLength: 0,
        httpStatus,
        foundPhotosCount: 0,
        validPhotosCount: 0,
        foundFieldsCount: 0,
        missingFieldsCount: 26,
        rawHtmlSnippet: '',
      },
    };
  }

  // Verificação de Erro ao tentar recuperar os dados do imóvel
  if (html.includes('erro ao tentar recuperar os dados do imóvel') || html.includes('Imóvel não encontrado')) {
    return {
      success: false,
      error: 'PROPERTY_NOT_FOUND',
      caixa_id: caixaId,
      source_url: sourceUrl,
      property: emptyPropertyState(),
      documents: { auction_notice_url: null, registration_url: null, list: [] },
      main_photo_url: null,
      photos: [],
      debug: {
        htmlLength: html.length,
        httpStatus,
        foundPhotosCount: 0,
        validPhotosCount: 0,
        foundFieldsCount: 0,
        missingFieldsCount: 26,
        rawHtmlSnippet: html.substring(0, 500),
      },
    };
  }

  // Verificação de Autenticação Inesperada ou Verificação Humana (CAPTCHA)
  if (html.includes('login.asp') || html.includes('autenticacao')) {
    return {
      success: false,
      error: 'AUTH_REQUIRED',
      caixa_id: caixaId,
      source_url: sourceUrl,
      property: emptyPropertyState(),
      documents: { auction_notice_url: null, registration_url: null, list: [] },
      main_photo_url: null,
      photos: [],
    };
  }

  const isCaptcha =
    html.includes('captcha') ||
    html.includes('g-recaptcha') ||
    html.includes('Validação de Segurança') ||
    html.includes('Access Denied');
  if (isCaptcha) {
    return {
      success: false,
      error: 'HUMAN_VERIFICATION_REQUIRED',
      caixa_id: caixaId,
      source_url: sourceUrl,
      property: emptyPropertyState(),
      documents: { auction_notice_url: null, registration_url: null, list: [] },
      main_photo_url: null,
      photos: [],
    };
  }

  // 1. Extração de Tipo de Imóvel
  let property_type: string | null = null;
  const typeMatch =
    html.match(/Tipo de imóvel:\s*<\/strong>\s*([^<]+)/i) ||
    html.match(/(Apartamento|Casa|Terreno|Comercial|Sobrado|Galpão)/i);
  if (typeMatch) property_type = typeMatch[1].trim();

  // 2. Endereço, Bairro, Cidade, Estado, CEP
  let address: string | null = null;
  let neighborhood: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let zipcode: string | null = null;

  const addrMatch =
    html.match(/Endereço:\s*<\/strong>\s*([^<]+)/i) ||
    html.match(/class="related-box"[\s\S]*?<p>([^<]+)<\/p>/i);
  if (addrMatch) address = addrMatch[1].trim();

  const cityStateMatch = html.match(/([A-Za-zÀ-ÖØ-öø-ÿ\s]+)\s*-\s*([A-Z]{2})/);
  if (cityStateMatch) {
    city = cityStateMatch[1].trim();
    state = cityStateMatch[2].trim();
  }

  const cepMatch = html.match(/CEP:\s*(\d{5}-?\d{3})/i);
  if (cepMatch) zipcode = cepMatch[1];

  const neighMatch = html.match(/Bairro:\s*<\/strong>\s*([^<]+)/i);
  if (neighMatch) neighborhood = neighMatch[1].trim();

  // 3. Avaliação, Preço Mínimo de Venda, Leilões
  let appraisal_value: number | null = null;
  let sale_value: number | null = null;
  let first_auction_value: number | null = null;
  let second_auction_value: number | null = null;

  const appraisalMatch =
    html.match(/Valor de avaliação:\s*R\$\s*([\d.]+,\d{2})/i) ||
    html.match(/Avaliação:\s*R\$\s*([\d.]+,\d{2})/i);
  if (appraisalMatch) appraisal_value = parseBrazilianMoney(appraisalMatch[1]);

  const saleMatch =
    html.match(/Valor mínimo de venda:\s*R\$\s*([\d.]+,\d{2})/i) ||
    html.match(/Valor mínimo de venda 2º Leilão:\s*R\$\s*([\d.]+,\d{2})/i) ||
    html.match(/Valor de venda:\s*R\$\s*([\d.]+,\d{2})/i);
  if (saleMatch) sale_value = parseBrazilianMoney(saleMatch[1]);

  const firstAuctionMatch = html.match(/1º Leilão:\s*R\$\s*([\d.]+,\d{2})/i);
  if (firstAuctionMatch) first_auction_value = parseBrazilianMoney(firstAuctionMatch[1]);

  const secondAuctionMatch = html.match(/2º Leilão:\s*R\$\s*([\d.]+,\d{2})/i);
  if (secondAuctionMatch) second_auction_value = parseBrazilianMoney(secondAuctionMatch[1]);

  // Cálculo de Desconto Determinístico
  let discount_percentage: number | null = null;
  if (appraisal_value !== null && sale_value !== null && appraisal_value > 0) {
    discount_percentage = Number((((appraisal_value - sale_value) / appraisal_value) * 100).toFixed(2));
  }

  // 4. Modalidade de Venda
  let sale_modality: string | null = null;
  const modMatch =
    html.match(/Modalidade de venda:\s*<\/strong>\s*([^<]+)/i) ||
    html.match(/(Venda Direta Extrajudicial|1º Leilão SFI|2º Leilão SFI|Licitação Aberta|Venda Direta Online)/i);
  if (modMatch) sale_modality = modMatch[1].trim();

  // 5. Quartos e Vagas
  let bedrooms: number | null = null;
  let parking_spaces: number | null = null;

  const bedMatch = html.match(/(\d+)\s*quarto\(s\)/i) || html.match(/(\d+)\s*dorms/i);
  if (bedMatch) bedrooms = parseInt(bedMatch[1], 10);

  const parkMatch = html.match(/(\d+)\s*vaga\(s\)/i) || html.match(/(\d+)\s*vagas/i);
  if (parkMatch) parking_spaces = parseInt(parkMatch[1], 10);

  // 6. Áreas
  let total_area: number | null = null;
  let private_area: number | null = null;
  let useful_area: number | null = null;
  let land_area: number | null = null;

  const privAreaMatch =
    html.match(/Área privativa\s*=\s*([\d.]+,\d{1,2})\s*m2/i) ||
    html.match(/Área privativa:\s*([\d.]+,\d{1,2})\s*m²/i);
  if (privAreaMatch) private_area = parseBrazilianNumber(privAreaMatch[1]);

  const totAreaMatch =
    html.match(/Área total\s*=\s*([\d.]+,\d{1,2})\s*m2/i) ||
    html.match(/Área total:\s*([\d.]+,\d{1,2})\s*m²/i);
  if (totAreaMatch) total_area = parseBrazilianNumber(totAreaMatch[1]);

  const landAreaMatch = html.match(/Área do terreno\s*=\s*([\d.]+,\d{1,2})\s*m2/i);
  if (landAreaMatch) land_area = parseBrazilianNumber(landAreaMatch[1]);

  // 7. Matrícula, Comarca, Cartório, Inscrição Municipal
  let registration_number: string | null = null;
  let district: string | null = null;
  let registry_office: string | null = null;
  let municipal_registration: string | null = null;

  const regMatch = html.match(/Matrícula\(s\):\s*(\d+)/i) || html.match(/Matrícula:\s*(\d+)/i);
  if (regMatch) registration_number = regMatch[1].trim();

  const distMatch = html.match(/Comarca:\s*([^<,\n]+)/i);
  if (distMatch) district = distMatch[1].trim();

  const regOfficeMatch = html.match(/Cartório:\s*([^<,\n]+)/i) || html.match(/Ofício:\s*([^<,\n]+)/i);
  if (regOfficeMatch) registry_office = regOfficeMatch[1].trim();

  const munRegMatch = html.match(/Inscrição imobiliária:\s*([^<,\n]+)/i);
  if (munRegMatch) municipal_registration = munRegMatch[1].trim();

  // 8. Descrição
  let description: string | null = null;
  const descMatch =
    html.match(/Descrição:\s*<\/strong>\s*([^<]+)/i) ||
    html.match(/<div class="desc">([\s\S]*?)<\/div>/i);
  if (descMatch) description = descMatch[1].trim();

  // 9. Aceita Financiamento, FGTS, Ocupação
  let accepts_financing: boolean | null = null;
  let accepts_fgts: boolean | null = null;
  let occupied: string | null = null;

  if (html.match(/aceita financiamento/i) || html.match(/permitido financiamento/i))
    accepts_financing = true;
  else if (html.match(/não aceita financiamento/i) || html.match(/somente à vista/i))
    accepts_financing = false;

  if (html.match(/aceita fgts/i) || html.match(/permitido o uso do fgts/i)) accepts_fgts = true;
  else if (html.match(/não aceita fgts/i)) accepts_fgts = false;

  if (html.match(/imóvel ocupado/i) || html.match(/situação: ocupado/i)) occupied = 'Ocupado';
  else if (html.match(/imóvel desocupado/i) || html.match(/situação: desocupado/i)) occupied = 'Desocupado';

  // 10. Datas de Leilão, Edital, Item, Leiloeiro
  let first_auction_date: string | null = null;
  let second_auction_date: string | null = null;
  let auction_notice_number: string | null = null;
  let auction_notice_item: string | null = null;
  let auctioneer: string | null = null;

  const firstDateMatch = html.match(/1º Leilão:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (firstDateMatch) first_auction_date = firstDateMatch[1];

  const secondDateMatch = html.match(/2º Leilão:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (secondDateMatch) second_auction_date = secondDateMatch[1];

  const noticeMatch = html.match(/Edital:\s*([^<,\n]+)/i);
  if (noticeMatch) auction_notice_number = noticeMatch[1].trim();

  const itemMatch = html.match(/Item:\s*(\d+)/i);
  if (itemMatch) auction_notice_item = itemMatch[1].trim();

  const auctioneerMatch = html.match(/Leiloeiro:\s*([^<,\n]+)/i);
  if (auctioneerMatch) auctioneer = auctioneerMatch[1].trim();

  // 11. Extração de Fotos e Documentos
  const candidatePhotos = extractCaixaPhotos(html, caixaId);
  const main_photo_url = candidatePhotos.length > 0 ? candidatePhotos[0] : null;
  const photos = candidatePhotos.length > 1 ? candidatePhotos.slice(1) : [];

  const documentList = extractCaixaDocuments(html);

  let auction_notice_url: string | null = null;
  let registration_url: string | null = null;

  const noticeDoc = documentList.find((d) => d.type === 'AUCTION_NOTICE');
  if (noticeDoc) auction_notice_url = noticeDoc.url;

  const regDoc = documentList.find((d) => d.type === 'REGISTRATION');
  if (regDoc) registration_url = regDoc.url;

  const allFieldValues = [
    property_type, address, neighborhood, city, state, zipcode,
    appraisal_value, sale_value, discount_percentage, sale_modality,
    bedrooms, parking_spaces, total_area, private_area, land_area,
    registration_number, district, registry_office, municipal_registration,
    description, accepts_financing, accepts_fgts, occupied, auctioneer
  ];
  const foundFieldsCount = allFieldValues.filter((v) => v !== null).length;
  const missingFieldsCount = allFieldValues.length - foundFieldsCount;

  return {
    success: true,
    caixa_id: caixaId,
    source_url: sourceUrl,
    property: {
      property_type,
      address,
      neighborhood,
      city,
      state,
      zipcode,
      appraisal_value,
      sale_value,
      first_auction_value,
      second_auction_value,
      discount_percentage,
      sale_modality,
      bedrooms,
      parking_spaces,
      total_area,
      private_area,
      useful_area,
      land_area,
      registration_number,
      district,
      registry_office,
      municipal_registration,
      description,
      accepts_financing,
      accepts_fgts,
      occupied,
      condominium_notes: null,
      tax_notes: null,
      first_auction_date,
      second_auction_date,
      auction_notice_number,
      auction_notice_item,
      auctioneer,
    },
    documents: {
      auction_notice_url,
      registration_url,
      list: documentList,
    },
    main_photo_url,
    photos,
    debug: {
      htmlLength: html.length,
      httpStatus,
      foundPhotosCount: candidatePhotos.length,
      validPhotosCount: candidatePhotos.length,
      foundFieldsCount,
      missingFieldsCount,
      rawHtmlSnippet: html.substring(0, 1500),
    },
  };
}

function emptyPropertyState() {
  return {
    property_type: null,
    address: null,
    neighborhood: null,
    city: null,
    state: null,
    zipcode: null,
    appraisal_value: null,
    sale_value: null,
    first_auction_value: null,
    second_auction_value: null,
    discount_percentage: null,
    sale_modality: null,
    bedrooms: null,
    parking_spaces: null,
    total_area: null,
    private_area: null,
    useful_area: null,
    land_area: null,
    registration_number: null,
    district: null,
    registry_office: null,
    municipal_registration: null,
    description: null,
    accepts_financing: null,
    accepts_fgts: null,
    occupied: null,
    condominium_notes: null,
    tax_notes: null,
    first_auction_date: null,
    second_auction_date: null,
    auction_notice_number: null,
    auction_notice_item: null,
    auctioneer: null,
  };
}
