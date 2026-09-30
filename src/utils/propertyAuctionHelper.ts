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
  mainAuctionDate?: string | null;
  formattedMainAuctionDate?: string | null;
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
 * Formata datas de leilões e prazos para o padrão brasileiro (DD/MM/AAAA às HH:mm)
 */
export function formatAuctionDate(rawDate?: string | null): string {
  if (!rawDate) return '';
  try {
    const cleanStr = String(rawDate).trim();
    if (!cleanStr) return '';

    // Se já estiver formatado como DD/MM/AAAA
    if (/^\d{2}\/\d{2}\/\d{4}/.test(cleanStr)) {
      return cleanStr;
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
  const date1 = prop.first_auction_date || prop.date_auction_1 || prop.dataPrimeiroLeilao;
  const date2 = prop.second_auction_date || prop.date_auction_2 || prop.dataSegundoLeilao;
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
    // Se há duas datas OU se a modalidade indica Alienação Fiduciária / 1º e 2º Leilão
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
 * calculando o MAIOR VALOR obrigatório para efeitos de filtros de preço.
 */
export function getAuctionValues(prop: any): AuctionValuesResult {
  const appraisal = Number(prop.appraisal_value || prop.appraisalValue || 0);
  const saleVal = Number(prop.sale_value || prop.current_minimum_value || prop.price || prop.secondAuctionPrice || 0);

  const isBoth = hasBothAuctions(prop);

  // Extrai datas
  const rawDate1 = prop.first_auction_date || prop.date_auction_1 || prop.dataPrimeiroLeilao || null;
  const rawDate2 = prop.second_auction_date || prop.date_auction_2 || prop.dataSegundoLeilao || null;
  const rawMainDate = prop.auction_date || prop.final_date_auction || prop.dataLeilao || prop.dtLeilao || rawDate2 || rawDate1 || null;

  if (isBoth) {
    const rawFirst = Number(prop.min_auction_value_1 || prop.first_auction_value || prop.firstAuctionPrice || appraisal || 0);
    const rawSecond = Number(prop.min_auction_value_2 || prop.second_auction_value || prop.secondAuctionPrice || saleVal || 0);

    let firstAuctionValue = rawFirst > 0 ? rawFirst : appraisal > 0 ? appraisal : saleVal;
    let secondAuctionValue = rawSecond > 0 ? rawSecond : saleVal > 0 ? saleVal : appraisal;

    // 1º Leilão é a 1ª praça (maior valor / avaliação), 2º leilão é a 2ª praça (menor valor / deságio)
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
      firstAuctionDate: rawDate1,
      secondAuctionDate: rawDate2,
      formattedFirstAuctionDate: formatAuctionDate(rawDate1),
      formattedSecondAuctionDate: formatAuctionDate(rawDate2),
      mainAuctionDate: rawMainDate,
      formattedMainAuctionDate: formatAuctionDate(rawMainDate),
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
    mainAuctionDate: rawMainDate,
    formattedMainAuctionDate: formatAuctionDate(rawMainDate),
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
