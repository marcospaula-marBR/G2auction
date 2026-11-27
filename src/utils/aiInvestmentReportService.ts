import { supabase } from '../lib/supabaseClient';

export type AiReportStrategy = 'FLIPPING' | 'RENTAL' | 'LIVING';
export type AiPaymentMode = 'CASH' | 'FINANCED';
export type AiVerdict = 'COMPRAR' | 'ESTUDAR_COM_RESSALVAS' | 'EVITAR';

export interface AiScenarioMetrics {
  bidPrice: number;
  expectedResalePrice: number;
  auctioneerFee: number;
  itbiCost: number;
  registryCost: number;
  renovationCost: number;
  evictionAndLegalCost: number;
  holdingCostTotal: number;
  brokerageCost: number;
  capitalGainTax: number;
  totalInvested: number;
  netProfit: number;
  roiPct: number;
  irrAnnualPct: number;
  cdiPeriodPct: number;
  spreadVsCdiPct: number;
  holdingMonths: number;
}

export interface AiPropertyFinancialBlock {
  effectiveBid: number;
  appraisalValue: number;
  assumedMarketValue: number;
  areaM2: number | null;
  bidPerM2: number | null;
  appraisalPerM2: number | null;
  marketPerM2: number | null;
  itbiRatePct: number;
  auctioneerRatePct: number;
  maxSafeBid: number;
  bidHeadroomBrl: number;
  estimatedMonthlyRent: number;
  grossRentalYieldAnnualPct: number;
  scenarios: {
    conservative: AiScenarioMetrics;
    base: AiScenarioMetrics;
    optimistic: AiScenarioMetrics;
  };
}

export interface AiPropertyAnalysis {
  propertyId: string;
  source: string;
  sourcePropertyId: string;
  title: string;
  propertyType: string;
  saleModality: string;
  city: string;
  state: string;
  neighborhood: string | null;
  address: string | null;
  sourceUrl: string | null;
  mainPhotoUrl: string | null;
  occupancyStatus: string;
  acceptsFinancing: boolean | null;
  rank: number;
  verdict: AiVerdict;
  aiScore: number;
  estimatedMarketPricePerM2: number | null;
  estimatedMarketValue: number;
  estimatedMonthlyRent: number;
  estimatedResaleMonths: number;
  falseDiscountAlert: {
    flagged: boolean;
    reason: string;
  };
  marketComparisonSummary: string;
  pros: string[];
  cons: string[];
  legalDiligenceChecklist: string[];
  biddingStrategy: string;
  financial: AiPropertyFinancialBlock;
  bankAppraisalFinancial: AiPropertyFinancialBlock;
  comparables: {
    cityActiveCount: number;
    cityAvgAppraisalPerM2: number | null;
    cityAvgSalePerM2: number | null;
    neighborhoodActiveCount: number;
    neighborhoodAvgAppraisalPerM2: number | null;
    neighborhoodAvgSalePerM2: number | null;
    sameStreetOrCondoCount: number;
  };
  ibge: {
    city: string;
    uf: string;
    ibgeCode: string | null;
    population: number | null;
    microrregiao: string | null;
    mesorregiao: string | null;
    regiaoImediata: string | null;
  } | null;
  portalLinks: {
    zapUrl: string;
    vivaRealUrl: string;
    quintoAndarUrl: string;
    olxUrl: string;
    mapsUrl: string;
  };
}

export interface AiRegionAnalysis {
  city: string;
  uf: string;
  macroOverview: string;
  economicDrivers: string[];
  neighborhoodInsights: string;
  liquidityRating: 'ALTA' | 'MEDIA' | 'BAIXA';
  pricePerM2RangeBrl: {
    min: number;
    avg: number;
    max: number;
  };
  marketTrends: string;
  regionalRisks: string[];
}

export interface AiInvestmentReport {
  ok: boolean;
  generatedAt: string;
  elapsedMs: number;
  aiMode: 'GEMINI_LIVE' | 'DETERMINISTIC_FALLBACK';
  modelUsed: string;
  usedWebGrounding: boolean;
  webSources: { title: string; url: string }[];
  webQueries: string[];
  parameters: {
    strategy: AiReportStrategy;
    paymentMode: AiPaymentMode;
    targetRoiPct: number;
    holdingMonths: number;
    customNotes: string | null;
  };
  bcbBenchmark: {
    cdiAnnualPct: number;
    ipca12mPct: number;
    referenceDate: string;
    source: string;
    isFallback: boolean;
  };
  executiveSummary: {
    headline: string;
    bestPickId: string | null;
    bestPickReason: string;
    committeeOverview: string;
    portfolioRecommendation: string;
  };
  regionAnalyses: AiRegionAnalysis[];
  properties: AiPropertyAnalysis[];
}

export interface SavedAiReportRecord {
  id: string;
  title: string;
  strategy: AiReportStrategy;
  payment_mode: AiPaymentMode;
  target_roi_pct: number;
  properties_count: number;
  model_used: string | null;
  used_web_grounding: boolean;
  created_at: string;
  report_payload: AiInvestmentReport;
}

const LOCAL_REPORTS_KEY = 'g2_ai_reports_history_v1';

function isValidUuid(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

export async function generateAiInvestmentReport(params: {
  properties: any[];
  strategy: AiReportStrategy;
  paymentMode: AiPaymentMode;
  targetRoiPct: number;
  holdingMonths: number;
  customNotes?: string;
}): Promise<AiInvestmentReport> {
  const resp = await fetch('/api/ai-investment-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await resp.json();
  if (!resp.ok || !data?.ok) {
    throw new Error(data?.error || `Falha HTTP ${resp.status} ao gerar relatório IA.`);
  }
  return data as AiInvestmentReport;
}

function readLocalHistory(): SavedAiReportRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(list: SavedAiReportRecord[]): void {
  try {
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(list.slice(0, 15)));
  } catch {
    // ignore quota errors
  }
}

export async function saveAiReportToHistory(
  report: AiInvestmentReport,
  userId?: string,
  tenantId?: string,
  isDemoSession?: boolean
): Promise<SavedAiReportRecord> {
  const title =
    report.executiveSummary?.headline ||
    `Relatório Comparativo (${report.properties.length} imóveis)`;
  const localId = `ai-rep-${Date.now()}`;

  const record: SavedAiReportRecord = {
    id: localId,
    title,
    strategy: report.parameters.strategy,
    payment_mode: report.parameters.paymentMode,
    target_roi_pct: report.parameters.targetRoiPct,
    properties_count: report.properties.length,
    model_used: report.modelUsed,
    used_web_grounding: report.usedWebGrounding,
    created_at: report.generatedAt || new Date().toISOString(),
    report_payload: report,
  };

  if (supabase && userId && !isDemoSession && isValidUuid(userId)) {
    try {
      const { data, error } = await supabase
        .from('ai_investment_reports')
        .insert([
          {
            user_id: userId,
            tenant_id: isValidUuid(tenantId) ? tenantId : null,
            title,
            strategy: report.parameters.strategy,
            payment_mode: report.parameters.paymentMode,
            target_roi_pct: report.parameters.targetRoiPct,
            properties_count: report.properties.length,
            property_ids: report.properties.map((p) => p.sourcePropertyId || p.propertyId),
            report_payload: report,
            model_used: report.modelUsed,
            used_web_grounding: report.usedWebGrounding,
          },
        ])
        .select('id, title, strategy, payment_mode, target_roi_pct, properties_count, model_used, used_web_grounding, created_at, report_payload')
        .single();

      if (!error && data) {
        const saved = data as SavedAiReportRecord;
        const current = readLocalHistory().filter((r) => r.id !== saved.id);
        writeLocalHistory([saved, ...current]);
        return saved;
      }
    } catch (err: any) {
      console.warn('[AI Report Save Supabase Warning]', err?.message);
    }
  }

  const current = readLocalHistory();
  writeLocalHistory([record, ...current]);
  return record;
}

export async function loadAiReportsHistory(
  userId?: string,
  isDemoSession?: boolean
): Promise<SavedAiReportRecord[]> {
  const localList = readLocalHistory();

  if (supabase && userId && !isDemoSession && isValidUuid(userId)) {
    try {
      const { data, error } = await supabase
        .from('ai_investment_reports')
        .select('id, title, strategy, payment_mode, target_roi_pct, properties_count, model_used, used_web_grounding, created_at, report_payload')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && Array.isArray(data)) {
        const remote = data as SavedAiReportRecord[];
        const remoteIds = new Set(remote.map((r) => r.id));
        const merged = [...remote, ...localList.filter((l) => !remoteIds.has(l.id))].slice(0, 20);
        return merged;
      }
    } catch (err: any) {
      console.warn('[AI Report Load History Warning]', err?.message);
    }
  }

  return localList;
}

export async function deleteAiReportFromHistory(
  reportId: string,
  userId?: string,
  isDemoSession?: boolean
): Promise<void> {
  const filteredLocal = readLocalHistory().filter((r) => r.id !== reportId);
  writeLocalHistory(filteredLocal);

  if (supabase && userId && !isDemoSession && isValidUuid(userId) && isValidUuid(reportId)) {
    try {
      await supabase.from('ai_investment_reports').delete().eq('id', reportId);
    } catch (err: any) {
      console.warn('[AI Report Delete Warning]', err?.message);
    }
  }
}
