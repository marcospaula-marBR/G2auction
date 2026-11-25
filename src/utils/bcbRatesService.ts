export interface OfficialBcbRates {
  cdiAnnualPct: number;
  ipca12mPct: number;
  ipcaPlus6AnnualPct: number;
  referenceDate: string;
  source: string;
  isFallback: boolean;
}

export interface BcbPeriodBenchmark {
  startDate: string;
  endDate: string;
  businessDays: number;
  elapsedDays: number;
  periodCdiPct: number;
  periodIpcaPct: number;
  periodIpcaPlus6Pct: number;
  source: string;
  isFallback: boolean;
}

const DEFAULT_FALLBACK_RATES: OfficialBcbRates = {
  cdiAnnualPct: 13.65,
  ipca12mPct: 4.5,
  ipcaPlus6AnnualPct: 10.77,
  referenceDate: new Date().toLocaleDateString('pt-BR'),
  source: 'Referência padrão (BCB offline)',
  isFallback: true,
};

let cachedRates: OfficialBcbRates | null = null;
let inflightRatesPromise: Promise<OfficialBcbRates> | null = null;

export async function fetchOfficialBcbRates(): Promise<OfficialBcbRates> {
  if (cachedRates) return cachedRates;
  if (inflightRatesPromise) return inflightRatesPromise;

  inflightRatesPromise = (async () => {
    try {
      const resp = await fetch('/api/bcb-rates');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (typeof data?.cdiAnnualPct === 'number') {
        cachedRates = data as OfficialBcbRates;
        return cachedRates;
      }
    } catch {
      // Fallback para desenvolvimento local sem Vite proxy de /api
    } finally {
      inflightRatesPromise = null;
    }
    return DEFAULT_FALLBACK_RATES;
  })();

  return inflightRatesPromise;
}

export async function fetchBcbPeriodBenchmark(
  startDate: string,
  endDate: string
): Promise<BcbPeriodBenchmark> {
  try {
    const params = new URLSearchParams({ startDate, endDate });
    const resp = await fetch(`/api/bcb-rates?${params.toString()}`);
    if (resp.ok) {
      const data = await resp.json();
      if (typeof data?.periodCdiPct === 'number') {
        return data as BcbPeriodBenchmark;
      }
    }
  } catch {
    // Fallback local determinístico
  }

  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const elapsedDays = Math.max(1, Math.round((endMs - startMs) / 86400000));
  const cdiAnnual = (cachedRates?.cdiAnnualPct || 13.65) / 100;
  const ipca6Annual = (cachedRates?.ipcaPlus6AnnualPct || 10.77) / 100;

  return {
    startDate,
    endDate,
    businessDays: Math.max(1, Math.round(elapsedDays * (252 / 365))),
    elapsedDays,
    periodCdiPct: Number(((Math.pow(1 + cdiAnnual, elapsedDays / 365) - 1) * 100).toFixed(4)),
    periodIpcaPct: Number(((Math.pow(1.045, elapsedDays / 365) - 1) * 100).toFixed(4)),
    periodIpcaPlus6Pct: Number(((Math.pow(1 + ipca6Annual, elapsedDays / 365) - 1) * 100).toFixed(4)),
    source: 'Cálculo pro-rata com taxa vigente',
    isFallback: true,
  };
}
