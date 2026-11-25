export type VehicleType = 'SINGLE_ASSET' | 'MULTI_ASSET_POOL';
export type LegalStructure = 'SCP' | 'SPE' | 'CONDOMINIO' | 'CLUBE_PRIVADO';
export type VehicleStage =
  | 'CAPTACAO'
  | 'ARREMATACAO'
  | 'DESOCUPACAO'
  | 'REFORMA'
  | 'VENDA'
  | 'ENCERRADO';
export type AdminFeeMode = 'ON_EXIT_ACCRUED' | 'PERIODIC';
export type HurdleType = 'CDI' | 'IPCA_PLUS_6' | 'FIXED_ANNUAL' | 'NONE';

export type QuotaLedgerEventType =
  | 'SUBSCRIPTION'
  | 'CAPITAL_CALL'
  | 'EXPENSE'
  | 'VALUATION_MARK'
  | 'RENT_INCOME'
  | 'EXIT_SALE'
  | 'DISTRIBUTION'
  | 'REDEMPTION';

export type IntentStatus = 'PENDING' | 'APPROVED' | 'CONVERTED' | 'CANCELLED';

export interface InvestmentVehicle {
  id: string;
  tenant_id: string | null;
  slug: string;
  name: string;
  vehicle_type: VehicleType;
  legal_structure: LegalStructure;
  property_id: string | null;
  property_summary: string | null;
  city: string | null;
  state: string | null;
  stage: VehicleStage;
  initial_quota_value: number;
  current_nav_per_quota: number;
  target_capital: number;
  raised_capital: number;
  total_quotas_issued: number;
  min_investment_brl: number;
  estimated_exit_months: number;
  projected_roi_pct: number;
  admin_fee_annual_pct: number;
  admin_fee_mode: AdminFeeMode;
  performance_fee_pct: number;
  performance_hurdle_type: HurdleType;
  performance_hurdle_annual_pct: number;
  performance_on_exit_only: boolean;
  active: boolean;
  is_reference_template: boolean;
  created_at?: string;
}

export interface QuotaLedgerEvent {
  id: string;
  tenant_id: string | null;
  vehicle_id: string;
  user_id: string | null;
  event_type: QuotaLedgerEventType;
  amount_brl: number;
  quotas_delta: number;
  quota_price_at_event: number;
  category: string | null;
  description: string;
  receipt_url: string | null;
  event_date: string;
  created_at?: string;
}

export interface QuotaSubscriptionIntent {
  id: string;
  tenant_id: string | null;
  vehicle_id: string;
  user_id: string;
  investor_name: string | null;
  investor_email: string;
  amount_brl: number;
  estimated_quotas: number;
  quota_price_snapshot: number;
  notes: string | null;
  status: IntentStatus;
  created_at: string;
}

export interface VehicleDocument {
  id: string;
  tenant_id: string | null;
  vehicle_id: string;
  user_id: string | null;
  doc_type:
    | 'CONTRATO_SCP'
    | 'CONTRATO_SPE'
    | 'EDITAL'
    | 'MATRICULA'
    | 'COMPROVANTE_APORTE'
    | 'INFORME_IR'
    | 'LAUDO_REFORMA';
  title: string;
  file_url: string | null;
  sha256_hash: string | null;
  created_at: string;
}

export interface FeeWaterfallInput {
  investedCapital: number;
  grossProfitBrl: number;
  holdingMonths: number;
  adminFeeAnnualPct: number;
  performanceFeePct: number;
  hurdleType: HurdleType;
  hurdleAnnualPct: number;
  overrideHurdlePeriodPct?: number | null;
  irTaxPct?: number;
}

export interface FeeWaterfallResult {
  investedCapital: number;
  grossFinalAmountBrl: number;
  grossProfitBrl: number;
  adminFeeBrl: number;
  profitAfterAdminBrl: number;
  hurdleBenchmarkBrl: number;
  excessAboveHurdleBrl: number;
  performanceFeeBrl: number;
  preTaxNetProfitBrl: number;
  estimatedIrBrl: number;
  netInvestorProfitBrl: number;
  netFinalAmountBrl: number;
  netRoiPct: number;
  annualizedIrrPct: number;
  moic: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round6(n: number): number {
  return Math.round((n + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function convertBrlToQuotas(amountBrl: number, navPerQuota: number): number {
  if (!Number.isFinite(amountBrl) || !Number.isFinite(navPerQuota) || amountBrl <= 0 || navPerQuota <= 0) {
    return 0;
  }
  return round6(amountBrl / navPerQuota);
}

export function convertQuotasToBrl(quotas: number, navPerQuota: number): number {
  if (!Number.isFinite(quotas) || !Number.isFinite(navPerQuota) || quotas <= 0 || navPerQuota <= 0) {
    return 0;
  }
  return round2(quotas * navPerQuota);
}

export function computeOwnershipPct(investorQuotas: number, totalQuotas: number): number {
  if (investorQuotas <= 0 || totalQuotas <= 0) return 0;
  return Math.min(100, round6((investorQuotas / totalQuotas) * 100));
}

export function computeProRataAmount(totalAmountBrl: number, ownershipPct: number): number {
  if (!Number.isFinite(totalAmountBrl) || !Number.isFinite(ownershipPct) || ownershipPct <= 0) {
    return 0;
  }
  return round2(totalAmountBrl * (ownershipPct / 100));
}

export function computeNavPerQuota(
  cashBrl: number,
  assetsFairValueBrl: number,
  liabilitiesBrl: number,
  totalQuotas: number,
  fallbackInitialValue: number
): number {
  if (totalQuotas <= 0) return fallbackInitialValue;
  const netEquity = cashBrl + assetsFairValueBrl - liabilitiesBrl;
  if (netEquity <= 0) return 0;
  return Math.round(((netEquity / totalQuotas) + Number.EPSILON) * 10_000) / 10_000;
}

export function computeExitFeeWaterfall(input: FeeWaterfallInput): FeeWaterfallResult {
  const invested = Math.max(0, Number(input.investedCapital) || 0);
  const grossProfit = Number(input.grossProfitBrl) || 0;
  const months = Math.max(1, Number(input.holdingMonths) || 1);
  const adminPct = Math.max(0, Number(input.adminFeeAnnualPct) || 0);
  const perfPct = Math.max(0, Number(input.performanceFeePct) || 0);
  const hurdleAnnualPct = Math.max(0, Number(input.hurdleAnnualPct) || 0);
  const irPct = input.irTaxPct === undefined ? 15 : Math.max(0, Number(input.irTaxPct) || 0);

  const adminFeeBrl = round2(invested * (adminPct / 100) * (months / 12));
  const profitAfterAdminBrl = round2(grossProfit - adminFeeBrl);

  const hurdleBenchmarkBrl =
    input.hurdleType === 'NONE'
      ? 0
      : typeof input.overrideHurdlePeriodPct === 'number' && input.overrideHurdlePeriodPct > 0
      ? round2(invested * (input.overrideHurdlePeriodPct / 100))
      : round2(invested * (Math.pow(1 + hurdleAnnualPct / 100, months / 12) - 1));

  const excessAboveHurdleBrl = Math.max(0, round2(profitAfterAdminBrl - hurdleBenchmarkBrl));
  const performanceFeeBrl =
    excessAboveHurdleBrl > 0 ? round2(excessAboveHurdleBrl * (perfPct / 100)) : 0;

  const preTaxNetProfitBrl = round2(profitAfterAdminBrl - performanceFeeBrl);
  const estimatedIrBrl = preTaxNetProfitBrl > 0 ? round2(preTaxNetProfitBrl * (irPct / 100)) : 0;
  const netInvestorProfitBrl = round2(preTaxNetProfitBrl - estimatedIrBrl);
  const netFinalAmountBrl = round2(invested + netInvestorProfitBrl);
  const netRoiPct = invested > 0 ? round2((netInvestorProfitBrl / invested) * 100) : 0;

  let annualizedIrrPct = 0;
  if (invested > 0 && netFinalAmountBrl > 0) {
    annualizedIrrPct = round2((Math.pow(netFinalAmountBrl / invested, 12 / months) - 1) * 100);
  }

  const moic = invested > 0 ? round2(netFinalAmountBrl / invested) : 0;

  return {
    investedCapital: round2(invested),
    grossFinalAmountBrl: round2(invested + grossProfit),
    grossProfitBrl: round2(grossProfit),
    adminFeeBrl,
    profitAfterAdminBrl,
    hurdleBenchmarkBrl,
    excessAboveHurdleBrl,
    performanceFeeBrl,
    preTaxNetProfitBrl,
    estimatedIrBrl,
    netInvestorProfitBrl,
    netFinalAmountBrl,
    netRoiPct,
    annualizedIrrPct,
    moic,
  };
}

export function computeXirr(cashflows: { date: string; amount: number }[]): number | null {
  if (!cashflows || cashflows.length < 2) return null;
  const hasPos = cashflows.some((c) => c.amount > 0);
  const hasNeg = cashflows.some((c) => c.amount < 0);
  if (!hasPos || !hasNeg) return null;

  const sorted = [...cashflows].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const t0 = new Date(sorted[0].date).getTime();
  const points = sorted.map((c) => ({
    years: (new Date(c.date).getTime() - t0) / (365 * 24 * 3600 * 1000),
    amount: c.amount,
  }));

  let rate = 0.2;
  for (let iter = 0; iter < 50; iter++) {
    let f = 0;
    let df = 0;
    for (const pt of points) {
      const base = Math.max(1e-6, 1 + rate);
      f += pt.amount * Math.pow(base, -pt.years);
      df -= pt.years * pt.amount * Math.pow(base, -pt.years - 1);
    }
    if (Math.abs(f) < 1e-6) {
      return round2(rate * 100);
    }
    if (Math.abs(df) < 1e-9) break;
    const nextRate = rate - f / df;
    if (!Number.isFinite(nextRate) || nextRate <= -0.99 || nextRate > 10) break;
    rate = nextRate;
  }
  return null;
}

export function formatQuotas(quotas: number, decimals = 4): string {
  const val = Number.isFinite(quotas) ? quotas : 0;
  return `${val.toLocaleString('pt-BR', {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  })} cotas`;
}

export function getHurdleLabel(hurdleType: HurdleType, annualPct: number): string {
  const pctStr = `${annualPct.toFixed(2).replace('.', ',')}% a.a.`;
  if (hurdleType === 'CDI') return `100% do CDI (${pctStr})`;
  if (hurdleType === 'IPCA_PLUS_6') return `IPCA + 6% (${pctStr})`;
  if (hurdleType === 'FIXED_ANNUAL') return `Taxa Mínima ${pctStr}`;
  return 'Sem Hurdle (qualquer lucro)';
}
