import type { InvestmentScenario, Property } from '../types/auction';

/**
 * Calculador Determinístico do Lance Máximo Racional
 */
export interface MaxBidParams {
  expectedMarketValue: number;
  renovationEstimate: number;
  debtsToPay: number;
  auctioneerFeePercent?: number; // Padrão: 5%
  itbiAndRegistryPercent?: number; // Padrão: 4%
  lawyerAndLegalCosts?: number; // Padrão: R$ 5.000 ou 2%
  expectedSaleCommissionPercent?: number; // Padrão: 5%
  targetRoiPercent: number; // Ex: 30%
  holdingMonths: number;
  monthlyHoldingCost?: number; // Condomínio + IPTU enquanto segura (ex: R$ 800/mês)
}

export interface MaxBidResult {
  maxBidPrice: number;
  totalInvestment: number;
  expectedGrossProfit: number;
  expectedNetProfit: number;
  actualRoi: number;
  actualIrrAnnual: number;
  breakdown: {
    bidPrice: number;
    auctioneerFee: number;
    itbiAndRegistry: number;
    legalCosts: number;
    renovation: number;
    debts: number;
    holdingCosts: number;
    saleCommission: number;
  };
}

export function calculateMaxBid(params: MaxBidParams): MaxBidResult {
  const auctioneerRate = (params.auctioneerFeePercent ?? 5) / 100;
  const itbiRate = (params.itbiAndRegistryPercent ?? 4) / 100;
  const legalCosts = params.lawyerAndLegalCosts ?? 5000;
  const commissionRate = (params.expectedSaleCommissionPercent ?? 5) / 100;
  const totalHoldingCost = (params.monthlyHoldingCost ?? 800) * params.holdingMonths;
  
  // Fórmula determinística:
  // Venda Líquida = PreçoVenda * (1 - comissão)
  // Capital Necessário = Venda Líquida / (1 + ROI_Alvo)
  // Custos Fixos = Reforma + Débitos + Legal + Manutenção
  // Capital Restante para Lance e Impostos = Capital Necessário - Custos Fixos
  // Como LanceTotal = Lance * (1 + Leiloeiro + ITBI), então:
  // LanceMáximo = CapitalRestante / (1 + Leiloeiro + ITBI)
  
  const netSaleValue = params.expectedMarketValue * (1 - commissionRate);
  const targetTotalCapital = netSaleValue / (1 + params.targetRoiPercent / 100);
  const fixedCosts = params.renovationEstimate + params.debtsToPay + legalCosts + totalHoldingCost;
  
  const capitalForAcquisition = Math.max(0, targetTotalCapital - fixedCosts);
  const maxBidPrice = capitalForAcquisition / (1 + auctioneerRate + itbiRate);
  
  const auctioneerFee = maxBidPrice * auctioneerRate;
  const itbiAndRegistry = maxBidPrice * itbiRate;
  const totalInvestment = maxBidPrice + auctioneerFee + itbiAndRegistry + fixedCosts;
  const saleCommission = params.expectedMarketValue * commissionRate;
  const expectedNetProfit = netSaleValue - totalInvestment;
  const actualRoi = totalInvestment > 0 ? (expectedNetProfit / totalInvestment) * 100 : 0;
  
  // Aproximação de TIR Anual baseada no tempo de permanência em meses
  const holdingYears = params.holdingMonths / 12;
  const actualIrrAnnual = holdingYears > 0 ? (Math.pow((1 + actualRoi / 100), (1 / holdingYears)) - 1) * 100 : actualRoi;

  return {
    maxBidPrice: Math.round(maxBidPrice),
    totalInvestment: Math.round(totalInvestment),
    expectedGrossProfit: Math.round(params.expectedMarketValue - maxBidPrice),
    expectedNetProfit: Math.round(expectedNetProfit),
    actualRoi: Number(actualRoi.toFixed(1)),
    actualIrrAnnual: Number(actualIrrAnnual.toFixed(1)),
    breakdown: {
      bidPrice: Math.round(maxBidPrice),
      auctioneerFee: Math.round(auctioneerFee),
      itbiAndRegistry: Math.round(itbiAndRegistry),
      legalCosts: Math.round(legalCosts),
      renovation: Math.round(params.renovationEstimate),
      debts: Math.round(params.debtsToPay),
      holdingCosts: Math.round(totalHoldingCost),
      saleCommission: Math.round(saleCommission),
    }
  };
}

export function generateScenarios(property: Property, customBidPrice?: number): InvestmentScenario[] {
  const acquisitionPrice = customBidPrice || property.secondAuctionPrice;
  const auctioneerFee = acquisitionPrice * 0.05;
  const itbiRegistry = acquisitionPrice * 0.04;
  const debts = property.debts.iptu + property.debts.condominium + property.debts.legalDebts;
  const baseRenovation = property.renovationEstimate;
  
  // Scenario 1: Base Case
  const baseSale = property.estimatedMarketPrice;
  const baseInvestment = acquisitionPrice + auctioneerFee + itbiRegistry + debts + baseRenovation + 5000 + 4800;
  const baseProfit = baseSale * 0.95 - baseInvestment;
  const baseRoi = (baseProfit / baseInvestment) * 100;
  const baseIrr = (Math.pow((1 + baseRoi / 100), (12 / 10)) - 1) * 100;

  // Scenario 2: Pessimista
  const pessSale = property.estimatedMarketPrice * 0.90; // Venda 10% abaixo do mercado
  const pessRenovation = baseRenovation * 1.30; // Reforma 30% mais cara
  const pessInvestment = acquisitionPrice + auctioneerFee + itbiRegistry + debts + pessRenovation + 8000 + 9600; // 12 meses
  const pessProfit = pessSale * 0.94 - pessInvestment;
  const pessRoi = (pessProfit / pessInvestment) * 100;
  const pessIrr = (Math.pow(Math.max(0.01, (1 + pessRoi / 100)), (12 / 14)) - 1) * 100;

  // Scenario 3: Otimista
  const optSale = property.estimatedMarketPrice * 1.05; // Venda 5% acima
  const optRenovation = baseRenovation * 0.90;
  const optInvestment = acquisitionPrice + auctioneerFee + itbiRegistry + debts + optRenovation + 4000 + 3200; // 4 meses
  const optProfit = optSale * 0.95 - optInvestment;
  const optRoi = (optProfit / optInvestment) * 100;
  const optIrr = (Math.pow((1 + optRoi / 100), (12 / 6)) - 1) * 100;

  return [
    {
      name: 'Pessimista',
      salePrice: Math.round(pessSale),
      renovationCost: Math.round(pessRenovation),
      holdingTimeMonths: 14,
      netProfit: Math.round(pessProfit),
      roi: Number(pessRoi.toFixed(1)),
      irrAnnual: Number(pessIrr.toFixed(1))
    },
    {
      name: 'Base',
      salePrice: Math.round(baseSale),
      renovationCost: Math.round(baseRenovation),
      holdingTimeMonths: 10,
      netProfit: Math.round(baseProfit),
      roi: Number(baseRoi.toFixed(1)),
      irrAnnual: Number(baseIrr.toFixed(1))
    },
    {
      name: 'Otimista',
      salePrice: Math.round(optSale),
      renovationCost: Math.round(optRenovation),
      holdingTimeMonths: 6,
      netProfit: Math.round(optProfit),
      roi: Number(optRoi.toFixed(1)),
      irrAnnual: Number(optIrr.toFixed(1))
    }
  ];
}

/**
 * Calculador de Benchmark de Rendimento Financeiro Tradicional
 * Comparativo com CDI (10.5% a.a.), CDB (100% CDI), IPCA + 6%, Selic (10.5%), Poupança (6.17%) e Ibovespa (~12%)
 */
export function calculateBenchmarkReturns(initialCapital: number, months: number) {
  const years = months / 12;
  
  // Taxas anuais estimadas para o mercado brasileiro
  const cdiAnnualRate = 0.105;
  const ipcaPlusRate = 0.055 + 0.06; // IPCA (5.5%) + 6%
  const poupancaRate = 0.0617;
  const ibovespaEstimatedRate = 0.12;

  const cdiTotal = initialCapital * Math.pow((1 + cdiAnnualRate), years);
  const ipcaTotal = initialCapital * Math.pow((1 + ipcaPlusRate), years);
  const poupancaTotal = initialCapital * Math.pow((1 + poupancaRate), years);
  const ibovTotal = initialCapital * Math.pow((1 + ibovespaEstimatedRate), years);

  return [
    { name: 'Poupança', finalValue: Math.round(poupancaTotal), profit: Math.round(poupancaTotal - initialCapital), roiPercent: Number(((poupancaTotal / initialCapital - 1) * 100).toFixed(1)) },
    { name: 'CDB 100% CDI', finalValue: Math.round(cdiTotal), profit: Math.round(cdiTotal - initialCapital), roiPercent: Number(((cdiTotal / initialCapital - 1) * 100).toFixed(1)) },
    { name: 'IPCA + 6%', finalValue: Math.round(ipcaTotal), profit: Math.round(ipcaTotal - initialCapital), roiPercent: Number(((ipcaTotal / initialCapital - 1) * 100).toFixed(1)) },
    { name: 'Ibovespa (Méd.)', finalValue: Math.round(ibovTotal), profit: Math.round(ibovTotal - initialCapital), roiPercent: Number(((ibovTotal / initialCapital - 1) * 100).toFixed(1)) },
  ];
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(value);
}
