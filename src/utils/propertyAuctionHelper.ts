/**
 * Utilitários para Leilões em 1ª e 2ª Praça e Condições de Pagamento / Financiamento Bancário
 * Suporta Caixa, Santander, Bradesco e leiloeiros oficiais.
 */

export interface AuctionValuesResult {
  hasBothAuctions: boolean;
  hasBoth: boolean;
  firstAuctionValue: number | null;
  secondAuctionValue: number | null;
  firstAuctionDate?: string | null;
  secondAuctionDate?: string | null;
  formattedFirstAuctionDate?: string | null;
  formattedSecondAuctionDate?: string | null;
  firstAuctionExpired?: boolean;
  mainAuctionDate?: string | null;
  formattedMainAuctionDate?: string | null;
  activeAuctionNotice?: string | null;
  higherPriceForFilter: number;
  lowestPrice: number;
  singleAuctionPrice: number;
}

export interface PaymentConditionsResult {
  canFinance: boolean;
  paymentConditionsText: string;
  officialConditionText: string;
  isSantander: boolean;
  maxInstallments: number;
  minDownPayment: number;
  minInstallmentValue: number;
  ruleNote: string;
}

/**
 * Converte qualquer string de data em um objeto Date local seguro contra desvios de fuso horário.
 */
export function parseAuctionDateSafely(rawDate?: string | null): Date | null {
  if (!rawDate) return null;
  const cleanStr = String(rawDate).trim();
  if (!cleanStr) return null;

  // 1. Formato brasileiro DD/MM/AAAA ou DD/MM/AAAA às HH:mm (ou DD/MM/AAAA HH:mm)
  const brMatch = cleanStr.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s*(?:às|-)?\s*(\d{2}):(\d{2}))?/i);
  if (brMatch) {
    const d = parseInt(brMatch[1], 10);
    const m = parseInt(brMatch[2], 10) - 1;
    const y = parseInt(brMatch[3], 10);
    const hh = brMatch[4] ? parseInt(brMatch[4], 10) : 23;
    const mm = brMatch[5] ? parseInt(brMatch[5], 10) : 59;
    return new Date(y, m, d, hh, mm, 59);
  }

  // 2. Formato ISO YYYY-MM-DD com ou sem hora local
  const isoMatch = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    // Se explicitamente tiver 'Z' ou offset UTC (+00:00 / -03:00)
    if (cleanStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(cleanStr)) {
      const d = new Date(cleanStr);
      return isNaN(d.getTime()) ? null : d;
    }
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const hh = isoMatch[4] ? parseInt(isoMatch[4], 10) : 23;
    const mm = isoMatch[5] ? parseInt(isoMatch[5], 10) : 59;
    const ss = isoMatch[6] ? parseInt(isoMatch[6], 10) : 59;
    return new Date(y, m, d, hh, mm, ss);
  }

  const fallback = new Date(cleanStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Valida se uma data de leilão é válida e NÃO é anterior ao dia de hoje (zero horas de hoje).
 * Qualquer data estritamente anterior ao hoje (ex: ontem ou datas passadas) é sempre desconsiderada.
 */
export function isAuctionDateActive(rawDate?: string | null): boolean {
  if (!rawDate) return false;
  try {
    const targetDate = parseAuctionDateSafely(rawDate);
    if (!targetDate) return false;

    // "Hoje" no início do dia local (00:00:00)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    return targetDate.getTime() >= todayStart.getTime();
  } catch {
    return false;
  }
}

/**
 * Formata datas de leilões e prazos para o padrão brasileiro (DD/MM/AAAA às HH:mm).
 * Por padrão, desconsidera e retorna vazio se a data for anterior ao Hoje.
 */
export function formatAuctionDate(rawDate?: string | null, allowPast = false): string {
  if (!rawDate) return '';
  if (!allowPast && !isAuctionDateActive(rawDate)) {
    return '';
  }
  try {
    const cleanStr = String(rawDate).trim();
    if (!cleanStr) return '';

    // Se já estiver formatado como DD/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}/.test(cleanStr)) {
      return cleanStr;
    }

    // Se for formato ISO local YYYY-MM-DD
    const isoMatch = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
    if (isoMatch && !cleanStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(cleanStr)) {
      const [, y, m, d, hh, mm] = isoMatch;
      if (hh && mm && !(hh === '00' && mm === '00')) {
        return `${d}/${m}/${y} às ${hh}:${mm}`;
      }
      return `${d}/${m}/${y}`;
    }

    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) {
      return cleanStr;
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    const hasTime = cleanStr.includes('T') || cleanStr.includes(':');
    if (hasTime) {
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      if (hours === '00' && mins === '00' && !cleanStr.includes('00:00:00')) {
        return `${day}/${month}/${year}`;
      }
      return `${day}/${month}/${year} às ${hours}:${mins}`;
    }

    return `${day}/${month}/${year}`;
  } catch {
    return String(rawDate);
  }
}

/**
 * Verifica se um imóvel ainda possui 1º e 2º leilões constando de forma autêntica.
 * Evita o falso positivo de assumir que toda avaliação é um 1º leilão.
 */
export function hasBothAuctions(prop: any): boolean {
  if (!prop) return false;

  // 1. Flag explícita do backend/proxy
  if (prop.has_both_auctions === true || prop.hasBothAuctions === true) {
    return true;
  }

  // 2. Datas distintas de 1º e 2º Leilão explicitamente presentes
  const date1 = prop.first_auction_date || prop.firstAuctionDate || prop.date_auction_1 || prop.dataPrimeiroLeilao;
  const date2 = prop.second_auction_date || prop.secondAuctionDate || prop.date_auction_2 || prop.dataSegundoLeilao;
  if (date1 && date2 && String(date1).trim() !== String(date2).trim()) {
    return true;
  }

  // 3. Chaves Bradesco Vitrine API (min_auction_value_1 e min_auction_value_2)
  const brdVal1 = Number(prop.min_auction_value_1 || 0);
  const brdVal2 = Number(prop.min_auction_value_2 || 0);
  if (brdVal1 > 0 && brdVal2 > 0 && brdVal1 !== brdVal2) {
    return true;
  }

  // 4. Valores de 1º e 2º Leilão explícitos e distintos
  const firstVal = Number(prop.first_auction_value || prop.firstAuctionPrice || 0);
  const secondVal = Number(prop.second_auction_value || prop.secondAuctionPrice || 0);
  if (firstVal > 0 && secondVal > 0 && firstVal !== secondVal) {
    const modality = (prop.sale_modality || prop.realstate_auction_type || '').toLowerCase();
    const isExplicitMultiAuction =
      modality.includes('1º e 2º') ||
      modality.includes('1ª e 2ª') ||
      modality.includes('alienacao') ||
      modality.includes('alienação') ||
      modality.includes('fiduciária') ||
      modality.includes('fiduciaria') ||
      modality.includes('sfi') ||
      Boolean(date1 || date2);

    if (isExplicitMultiAuction) {
      return true;
    }
  }

  return false;
}

/**
 * Extrai os valores e datas do 1º e 2º Leilão,
 * calculando o MAIOR VALOR obrigatório para efeitos de filtros de preço
 * e DESCONSIDERANDO datas de leilões que sejam anteriores ao Hoje (base desatualizada).
 */
export function getAuctionValues(prop: any): AuctionValuesResult {
  const appraisal = Number(prop.appraisal_value || prop.appraisalValue || 0);
  const saleVal = Number(prop.sale_value || prop.current_minimum_value || prop.price || prop.secondAuctionPrice || 0);

  const isBoth = hasBothAuctions(prop);

  // Extrai datas de todas as variações de nomes possíveis
  const rawDate1 =
    prop.first_auction_date ||
    prop.firstAuctionDate ||
    prop.date_auction_1 ||
    prop.dataPrimeiroLeilao ||
    prop.data_primeiro_leilao ||
    prop.raw_list_data?.first_auction_date ||
    prop.raw_list_data?.dataPrimeiroLeilao ||
    prop.raw_detail_data?.first_auction_date ||
    null;

  const rawDate2 =
    prop.second_auction_date ||
    prop.secondAuctionDate ||
    prop.date_auction_2 ||
    prop.dataSegundoLeilao ||
    prop.data_segundo_leilao ||
    prop.raw_list_data?.second_auction_date ||
    prop.raw_list_data?.dataSegundoLeilao ||
    prop.raw_detail_data?.second_auction_date ||
    null;

  const rawMainDate =
    prop.auction_date ||
    prop.auctionDate ||
    prop.main_auction_date ||
    prop.mainAuctionDate ||
    prop.dataLeilao ||
    prop.data_leilao ||
    prop.dtLeilao ||
    prop.final_date_auction ||
    prop.finalDateAuction ||
    prop.raw_list_data?.auction_date ||
    prop.raw_list_data?.dataLeilao ||
    prop.raw_detail_data?.auction_date ||
    rawDate2 ||
    rawDate1 ||
    null;

  // Validação estrita: Desconsiderar datas anteriores ao Hoje
  const isDate1Active = isAuctionDateActive(rawDate1);
  const isDate2Active = isAuctionDateActive(rawDate2);
  const isMainDateActive = isAuctionDateActive(rawMainDate);

  const activeDate1 = isDate1Active ? rawDate1 : null;
  const activeDate2 = isDate2Active ? rawDate2 : null;

  // Verifica se o 1º leilão é anterior ao hoje mas o 2º leilão é futuro/ativo
  const firstAuctionExpired = !isDate1Active && Boolean(rawDate1) && isDate2Active;

  // Determina a data do leilão ativo mais próximo (>= Hoje)
  let activeMainDate: string | null = null;
  if (isBoth) {
    if (isDate1Active) {
      activeMainDate = activeDate1;
    } else if (isDate2Active) {
      activeMainDate = activeDate2;
    } else if (isMainDateActive) {
      activeMainDate = rawMainDate;
    }
  } else {
    if (isMainDateActive) {
      activeMainDate = rawMainDate;
    } else if (isDate1Active) {
      activeMainDate = activeDate1;
    } else if (isDate2Active) {
      activeMainDate = activeDate2;
    }
  }

  const formattedMain = formatAuctionDate(activeMainDate);

  if (isBoth) {
    const rawFirst = Number(prop.min_auction_value_1 || prop.first_auction_value || prop.firstAuctionPrice || appraisal || 0);
    const rawSecond = Number(prop.min_auction_value_2 || prop.second_auction_value || prop.secondAuctionPrice || saleVal || 0);

    let firstAuctionValue = rawFirst > 0 ? rawFirst : appraisal > 0 ? appraisal : saleVal;
    let secondAuctionValue = rawSecond > 0 ? rawSecond : saleVal > 0 ? saleVal : appraisal;

    if (firstAuctionValue < secondAuctionValue && firstAuctionValue > 0) {
      const temp = firstAuctionValue;
      firstAuctionValue = secondAuctionValue;
      secondAuctionValue = temp;
    }

    const higherPriceForFilter = Math.max(firstAuctionValue, secondAuctionValue);
    const lowestPrice = Math.min(firstAuctionValue, secondAuctionValue);

    return {
      hasBothAuctions: true,
      hasBoth: true,
      firstAuctionValue,
      secondAuctionValue,
      firstAuctionDate: activeDate1,
      secondAuctionDate: activeDate2,
      formattedFirstAuctionDate: formatAuctionDate(activeDate1),
      formattedSecondAuctionDate: formatAuctionDate(activeDate2),
      firstAuctionExpired,
      mainAuctionDate: activeMainDate,
      formattedMainAuctionDate: formattedMain,
      activeAuctionNotice: firstAuctionExpired ? '2º Leilão Ativo (1ª Praça já encerrada)' : null,
      higherPriceForFilter,
      lowestPrice,
      singleAuctionPrice: secondAuctionValue,
    };
  }

  // Apenas 1 Leilão ou Venda Direta com deságio
  const singlePrice = saleVal > 0 ? saleVal : appraisal;
  return {
    hasBothAuctions: false,
    hasBoth: false,
    firstAuctionValue: null,
    secondAuctionValue: null,
    firstAuctionDate: null,
    secondAuctionDate: null,
    formattedFirstAuctionDate: null,
    formattedSecondAuctionDate: null,
    firstAuctionExpired: false,
    mainAuctionDate: activeMainDate,
    formattedMainAuctionDate: formatAuctionDate(activeMainDate),
    activeAuctionNotice: null,
    higherPriceForFilter: singlePrice,
    lowestPrice: singlePrice,
    singleAuctionPrice: singlePrice,
  };
}

/**
 * Retorna o preço efetivo a ser considerado na filtragem (priceMin / priceMax)
 * Se constar 1º e 2º leilões, UTILIZA O MAIOR conforme regra de negócio.
 */
export function getPropertyFilterPrice(prop: any): number {
  if (!prop) return 0;
  const values = getAuctionValues(prop);
  return values.higherPriceForFilter;
}

/**
 * Extrai e calcula as Condições de Pagamento e Financiamento Bancário:
 * - Santander: Exige valor mínimo de R$ 90 mil para financiar; até 420x (residencial) ou 360x (comercial)
 * - Caixa: Financia até 420x (35 anos) com entrada de 5% a 20%
 * - Bradesco: Financia a partir de R$ 100 mil em até 360x
 */
export function getPaymentConditions(prop: any): PaymentConditionsResult {
  const bank = String(prop.source || prop.bankName || prop.originBank || 'CAIXA').toUpperCase();
  const saleVal = Number(prop.sale_value || prop.current_minimum_value || prop.price || prop.secondAuctionPrice || 0);
  const propType = (prop.property_type || prop.category || '').toLowerCase();
  const isSantander = bank.includes('SANTANDER');

  const isCommercial = propType.includes('sala') || propType.includes('comercial') || propType.includes('loja') || propType.includes('prédio') || propType.includes('galpão');

  // 1. SANTANDER
  if (isSantander) {
    // Regra oficial Santander: financia apenas a partir de R$ 90.000
    if (saleVal < 90000 && saleVal > 0) {
      const condText = prop.payment_conditions || 'À vista com recursos próprios. O Santander não concede financiamento para ofertas com valor inferior a R$ 90.000,00.';
      return {
        canFinance: false,
        maxInstallments: 1,
        minDownPayment: saleVal,
        minInstallmentValue: 0,
        paymentConditionsText: condText,
        officialConditionText: condText,
        isSantander: true,
        ruleNote: 'Santander: Somente à vista (mínimo R$ 90 mil para financiar)',
      };
    }

    const maxInstallments = prop.max_installments || (isCommercial ? 360 : 420);
    const minDownPayment = prop.min_down_payment || Math.round(saleVal * 0.20);
    const financed = Math.max(0, saleVal - minDownPayment);
    // Taxa referencial bancária média para parcela inicial SAC/Price
    const minInstallmentValue = prop.min_installment_value || (financed > 0 ? Math.round((financed / maxInstallments) + (financed * 0.0084)) : 0);

    const paymentText = prop.payment_conditions ||
      `À vista com recursos próprios ou Financiamento Imobiliário Santander em até ${maxInstallments} meses (Entrada mínima de 20%: R$ ${minDownPayment.toLocaleString('pt-BR')}, parcelas a partir de R$ ${minInstallmentValue.toLocaleString('pt-BR')}/mês).`;

    return {
      canFinance: saleVal >= 90000,
      maxInstallments,
      minDownPayment,
      minInstallmentValue,
      paymentConditionsText: paymentText,
      officialConditionText: paymentText,
      isSantander: true,
      ruleNote: `Financiável Santander: Entrada 20% | até ${maxInstallments}x`,
    };
  }

  // 2. BRADESCO
  if (bank.includes('BRADESCO')) {
    if (saleVal < 100000 && saleVal > 0) {
      const condText = prop.payment_conditions || 'À vista com recursos próprios. O Banco Bradesco exige valor mínimo de R$ 100.000,00 para operações de crédito imobiliário em leilões.';
      return {
        canFinance: false,
        maxInstallments: 1,
        minDownPayment: saleVal,
        minInstallmentValue: 0,
        paymentConditionsText: condText,
        officialConditionText: condText,
        isSantander: false,
        ruleNote: 'Bradesco: Somente à vista (mínimo R$ 100 mil para financiar)',
      };
    }

    const maxInstallments = prop.max_installments || 360;
    const minDownPayment = prop.min_down_payment || Math.round(saleVal * 0.20);
    const financed = Math.max(0, saleVal - minDownPayment);
    const minInstallmentValue = prop.min_installment_value || (financed > 0 ? Math.round((financed / maxInstallments) + (financed * 0.0088)) : 0);

    const paymentText = prop.payment_conditions ||
      `À vista ou Financiamento Bradesco em até ${maxInstallments} meses (Entrada mínima de 20%: R$ ${minDownPayment.toLocaleString('pt-BR')}).`;

    return {
      canFinance: saleVal >= 100000,
      maxInstallments,
      minDownPayment,
      minInstallmentValue,
      paymentConditionsText: paymentText,
      officialConditionText: paymentText,
      isSantander: false,
      ruleNote: `Financiável Bradesco: Entrada 20% | até ${maxInstallments}x`,
    };
  }

  // 3. CAIXA ECONÔMICA FEDERAL (PADRÃO)
  const acceptsFinancing = prop.accepts_financing !== false && prop.acceptsBankFinancing !== false;
  const maxInstallments = acceptsFinancing ? (prop.max_installments || 420) : 1;
  const minDownPayment = acceptsFinancing ? Math.round(saleVal * 0.05) : saleVal;
  const financed = Math.max(0, saleVal - minDownPayment);
  const minInstallmentValue = acceptsFinancing && financed > 0 ? Math.round((financed / maxInstallments) + (financed * 0.0075)) : 0;

  const paymentText = prop.payment_conditions ||
    (acceptsFinancing
      ? `À vista com recursos próprios, Financiamento Habitacional CAIXA em até 420 meses e/ou utilização de FGTS (conforme edital regulamentar).`
      : 'Venda exclusiva à vista com recursos próprios. Este imóvel não admite financiamento bancário nem parcelamento.');

  return {
    canFinance: acceptsFinancing && saleVal > 0,
    maxInstallments,
    minDownPayment,
    minInstallmentValue,
    paymentConditionsText: paymentText,
    officialConditionText: paymentText,
    isSantander: false,
    ruleNote: acceptsFinancing ? 'Financiável CAIXA: até 420x parcelas' : 'CAIXA: Somente à vista',
  };
}

/**
 * Cria um ID Padrão para Auditoria e Varredura Rastreável:
 * Identifica o banco e utiliza o código real dele no banco.
 * Exemplos:
 * - Santander: SAN-436833
 * - Bradesco: BRD-484406 ou BRD-27019
 * - Caixa: CXA-844440012345
 */
export function formatStandardPropertyId(source?: string | null, rawId?: string | number | null, prop?: any): string {
  const bank = String(source || prop?.source || prop?.bankName || 'CAIXA').toUpperCase();
  const idStr = String(rawId || prop?.id || prop?.source_property_id || '').trim();

  // 1. SANTANDER
  if (bank.includes('SANTANDER')) {
    let code = prop?.codigo || prop?.raw_list_data?.codigo || '';
    if (!code) {
      const match = idStr.match(/(?:snt_|san_|santander_)?(\d{4,10})/i);
      if (match) code = match[1];
    }
    if (!code && prop?.idExterno) code = String(prop.idExterno).replace(/[^a-zA-Z0-9]/g, '');
    if (!code) code = idStr.replace(/^snt_/i, '').replace(/^san-/i, '');
    return `SAN-${code || 'IMOVEL'}`;
  }

  // 2. BRADESCO
  if (bank.includes('BRADESCO')) {
    let code = '';
    const desc = String(prop?.description || prop?.raw_list_data?.description || '');
    // Tenta pegar "Cód. do imóvel 27019" ou "Cód. 27019"
    const codMatch = desc.match(/c[oó]d(?:\.|igo)?(?:\s+do\s+im[oó]vel)?\s*:?\s*(\d{3,8})/i);
    if (codMatch) {
      code = codMatch[1];
    }

    // Tenta pegar lote na URL da imagem oficial (ex: milan_leiloes/484406/)
    if (!code) {
      const images = prop?.images || prop?.raw_list_data?.images || (prop?.main_photo_url ? [prop.main_photo_url] : []);
      if (Array.isArray(images)) {
        for (const img of images) {
          const imgMatch = typeof img === 'string' && img.match(/\/([a-z0-9_-]+)\/(\d{4,8})\//i);
          if (imgMatch && imgMatch[2]) {
            code = imgMatch[2];
            break;
          }
        }
      }
    }

    // Tenta pegar código do slug (ex: ...-5_2 ou ...-27019)
    if (!code && (prop?.slug || prop?.raw_list_data?.slug)) {
      const slug = String(prop?.slug || prop?.raw_list_data?.slug);
      const slugMatch = slug.match(/-(\d{4,8})(?:_\d+)?$/);
      if (slugMatch) code = slugMatch[1];
    }

    // Se ainda não achou, se for UUID longo (ex: brd_7bdbc6e7-dbfb-49e4...)
    if (!code && idStr) {
      const clean = idStr.replace(/^brd_/i, '').replace(/^bradesco_/i, '');
      const parts = clean.split('-');
      code = parts[0].toUpperCase();
    }

    return `BRD-${code || 'IMOVEL'}`;
  }

  // 3. CAIXA
  if (bank.includes('CAIXA')) {
    let code = idStr.replace(/^cxa_/i, '').replace(/^cx_/i, '').replace(/^caixa_/i, '');
    const numMatch = code.match(/\d{5,16}/);
    if (numMatch) code = numMatch[0];
    return `CXA-${code || 'IMOVEL'}`;
  }

  // 4. BANCO DO BRASIL
  if (bank.includes('BRASIL') || bank.includes('BB')) {
    const code = idStr.replace(/^bb_/i, '').replace(/^brasil_/i, '');
    return `BB-${code || 'IMOVEL'}`;
  }

  // 5. ITAU
  if (bank.includes('ITAU') || bank.includes('ITAÚ')) {
    const code = idStr.replace(/^itau_/i, '');
    return `ITAU-${code || 'IMOVEL'}`;
  }

  // Genérico padrão: BANCO-CODIGO
  const prefix = bank.slice(0, 3).toUpperCase();
  const cleanId = idStr.replace(/^[a-z]+_/i, '');
  return `${prefix}-${cleanId || 'IMOVEL'}`;
}

/**
 * Extrai o Endereço Completo do imóvel (Logradouro, Número, Bairro)
 * padronizando todos os bancos para seguir o mesmo padrão do primeiro card (Santander).
 */
export function extractCleanPropertyAddress(prop: any): string {
  if (!prop) return '';

  const rawAddress = (prop.address || '').trim();
  const rawTitle = (prop.title || prop.name || '').trim();
  const rawDesc = (prop.description || '').replace(/<[^>]*>/g, ' ').trim();
  const neighborhood = (prop.neighborhood || '').trim();
  const city = (prop.city || '').trim();
  const state = (prop.state || '').trim();

  // Verifica se rawAddress já contém logradouro explícito ou número
  const hasStreetIndicator = /\b(rua|r\.|avenida|av\.|alameda|al\.|travessa|trav\.|pra[çc]a|pc\.|rodovia|rod\.|estrada|est\.|quadra|qd\.|lote|lt\.|condom[ií]nio|cond\.)\b/i.test(rawAddress) ||
    /\b\d+\b/.test(rawAddress);

  const isGenericAddress = !hasStreetIndicator ||
    rawAddress === `${city} - ${state}` ||
    rawAddress === `${neighborhood}, ${city} - ${state}` ||
    rawAddress === `${neighborhood} - ${city}` ||
    rawAddress === `${city}/${state}`;

  // Se o endereço for genérico mas o título contiver a rua (padrão Bradesco: "Tipo - Cidade/UF - Rua...")
  if (isGenericAddress && rawTitle) {
    const parts = rawTitle.split(/\s*-\s*/);
    if (parts.length >= 3) {
      const streetPart = parts.slice(2).join(' - ').trim();
      if (streetPart && /\b(rua|r\.|avenida|av\.|alameda|al\.|travessa|pra[çc]a|rodovia|estrada|\d+)\b/i.test(streetPart)) {
        if (neighborhood && !streetPart.toLowerCase().includes(neighborhood.toLowerCase())) {
          return `${streetPart}, ${neighborhood}`;
        }
        return streetPart;
      }
    }
  }

  // Se ainda for genérico, tenta extrair da descrição
  if (isGenericAddress && rawDesc) {
    const streetMatch = rawDesc.match(/(?:Rua|Avenida|Av\.|Alameda|Al\.|Travessa|Praça|Rodovia|Estrada)[^.,;]+(?:,\s*(?:n[°ºo]\s*)?\d+[^.,;]*)?/i);
    if (streetMatch) {
      const street = streetMatch[0].trim();
      if (neighborhood && !street.toLowerCase().includes(neighborhood.toLowerCase())) {
        return `${street}, ${neighborhood}`;
      }
      return street;
    }
  }

  // Se rawAddress já for completo e detalhado, utiliza ele
  if (rawAddress && !isGenericAddress) {
    return rawAddress;
  }

  return rawAddress || rawTitle || `${city} - ${state}`;
}

