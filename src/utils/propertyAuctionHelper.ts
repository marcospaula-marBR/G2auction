/**
 * Utilitários para Leilões em 1ª e 2ª Praça e Condições de Pagamento / Financiamento Bancário
 * Suporta Caixa, Santander, Bradesco e leiloeiros oficiais.
 */

export interface AuctionValuesResult {
  hasBothAuctions: boolean;
  hasBoth: boolean;
  firstAuctionValue: number;
  secondAuctionValue: number;
  firstAuctionDate?: string | null;
  secondAuctionDate?: string | null;
  higherPriceForFilter: number;
  lowestPrice: number;
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
 * Verifica se um imóvel ainda possui 1º e 2º leilões constando
 */
export function hasBothAuctions(prop: any): boolean {
  if (!prop) return false;

  const firstVal = Number(prop.first_auction_value || prop.firstAuctionPrice || 0);
  const secondVal = Number(prop.second_auction_value || prop.secondAuctionPrice || 0);
  if (firstVal > 0 && secondVal > 0 && firstVal !== secondVal) {
    return true;
  }

  if (prop.first_auction_date && prop.second_auction_date) {
    return true;
  }

  const appraisal = Number(prop.appraisal_value || prop.appraisalValue || 0);
  const saleVal = Number(prop.sale_value || prop.current_minimum_value || prop.secondAuctionPrice || 0);
  const modality = (prop.sale_modality || prop.caixaModalidad || '').toLowerCase();

  const isAuctionModality =
    modality.includes('1º e 2º') ||
    modality.includes('1º leilão') ||
    modality.includes('2º leilão') ||
    modality.includes('1ª e 2ª') ||
    modality.includes('praça') ||
    modality.includes('praca') ||
    modality.includes('sfi') ||
    modality.includes('leilão') ||
    modality.includes('leilao');

  if (isAuctionModality && appraisal > 0 && saleVal > 0 && appraisal > saleVal) {
    return true;
  }

  return false;
}

/**
 * Extrai os valores e datas do 1º e 2º Leilão,
 * calculando o MAIOR VALOR obrigatório para efeitos de filtros de preço.
 */
export function getAuctionValues(prop: any): AuctionValuesResult {
  const appraisal = Number(prop.appraisal_value || prop.appraisalValue || 0);
  const saleVal = Number(prop.sale_value || prop.current_minimum_value || prop.secondAuctionPrice || 0);

  const rawFirst = Number(prop.first_auction_value || prop.firstAuctionPrice || 0);
  const rawSecond = Number(prop.second_auction_value || prop.secondAuctionPrice || 0);

  let firstAuctionValue = rawFirst > 0 ? rawFirst : appraisal > 0 ? appraisal : saleVal;
  let secondAuctionValue = rawSecond > 0 ? rawSecond : saleVal > 0 ? saleVal : appraisal;

  // Garante ordenação lógica se ambos existirem (1º leilão é o valor integral/maior, 2º leilão é o com deságio)
  if (firstAuctionValue < secondAuctionValue && firstAuctionValue > 0) {
    const temp = firstAuctionValue;
    firstAuctionValue = secondAuctionValue;
    secondAuctionValue = temp;
  }

  const isBoth = hasBothAuctions(prop);
  const higherPriceForFilter = isBoth
    ? Math.max(firstAuctionValue, secondAuctionValue)
    : (saleVal || appraisal || 0);

  const lowestPrice = secondAuctionValue > 0 ? secondAuctionValue : (saleVal || appraisal || 0);

  return {
    hasBothAuctions: isBoth,
    hasBoth: isBoth,
    firstAuctionValue,
    secondAuctionValue,
    firstAuctionDate: prop.first_auction_date || prop.firstAuctionDate || null,
    secondAuctionDate: prop.second_auction_date || prop.secondAuctionDate || null,
    higherPriceForFilter,
    lowestPrice,
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
  const saleVal = Number(prop.sale_value || prop.current_minimum_value || prop.secondAuctionPrice || 0);
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
