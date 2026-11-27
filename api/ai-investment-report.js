/**
 * Endpoint Serverless: Comitê de Investimento IA — Relatório Comparativo Multi-Imóveis
 * POST /api/ai-investment-report
 *
 * Combina:
 *  1) Google Gemini (gemini-2.5-flash / fallback gemini-2.0-flash) com Google Search Grounding ao vivo
 *  2) IBGE API (população e microrregião oficial do município)
 *  3) Banco Central SGS (CDI e IPCA oficiais)
 *  4) Comparáveis internos da base G2Auction no Supabase
 *  5) Motor financeiro determinístico em 3 cenários (Conservador / Base / Otimista)
 */
import { createClient } from '@supabase/supabase-js';

const ITBI_BY_UF = {
  SP: 0.03,
  RJ: 0.03,
  RS: 0.03,
  BA: 0.03,
  PE: 0.03,
  DF: 0.03,
  PR: 0.027,
  MG: 0.025,
  SC: 0.02,
  CE: 0.02,
  GO: 0.02,
  ES: 0.02,
};

const IBGE_UF_CACHE = new Map();
const IBGE_CITY_CACHE = new Map();

function getSupabaseClient() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function stripAccents(str) {
  return String(str || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugifyPortal(str) {
  return stripAccents(str)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// =====================================================================
// 1. BCB BENCHMARK (CDI + IPCA)
// =====================================================================
async function fetchBcbBenchmark() {
  try {
    const today = new Date();
    const start13m = new Date(today.getTime());
    start13m.setMonth(start13m.getMonth() - 13);
    const fmt = (d) =>
      `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

    const [cdiRes, ipcaRes] = await Promise.all([
      fetchWithTimeout(
        'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json',
        { headers: { Accept: 'application/json', 'User-Agent': 'G2Auction/3.19' } },
        4000
      ),
      fetchWithTimeout(
        `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=${encodeURIComponent(
          fmt(start13m)
        )}&dataFinal=${encodeURIComponent(fmt(today))}`,
        { headers: { Accept: 'application/json', 'User-Agent': 'G2Auction/3.19' } },
        4000
      ),
    ]);

    let cdiAnnualPct = 13.65;
    let referenceDate = fmt(today);
    if (cdiRes.ok) {
      const cdiRows = await cdiRes.json();
      const last = Array.isArray(cdiRows) ? cdiRows[cdiRows.length - 1] : null;
      if (last?.valor) {
        cdiAnnualPct = Math.round(parseFloat(String(last.valor).replace(',', '.')) * 100) / 100;
      }
      if (last?.data) referenceDate = last.data;
    }

    let ipca12mPct = 4.5;
    if (ipcaRes.ok) {
      const ipcaRows = await ipcaRes.json();
      if (Array.isArray(ipcaRows) && ipcaRows.length > 0) {
        const last12 = ipcaRows.slice(-12);
        let factor = 1;
        for (const r of last12) {
          const v = parseFloat(String(r.valor || '0').replace(',', '.'));
          if (Number.isFinite(v)) factor *= 1 + v / 100;
        }
        ipca12mPct = Math.round((factor - 1) * 10000) / 100;
      }
    }

    return {
      cdiAnnualPct,
      ipca12mPct,
      referenceDate,
      source: 'Banco Central do Brasil (SGS 4389 / 433)',
      isFallback: false,
    };
  } catch {
    return {
      cdiAnnualPct: 13.65,
      ipca12mPct: 4.5,
      referenceDate: new Date().toLocaleDateString('pt-BR'),
      source: 'Referência BCB local (fallback)',
      isFallback: true,
    };
  }
}

// =====================================================================
// 2. IBGE CONTEXTO DO MUNICÍPIO
// =====================================================================
async function fetchIbgeCityContext(city, uf) {
  const ufUpper = String(uf || 'SP').trim().toUpperCase().slice(0, 2);
  const normCity = stripAccents(city);
  const cacheKey = `${ufUpper}:${normCity}`;
  if (IBGE_CITY_CACHE.has(cacheKey)) return IBGE_CITY_CACHE.get(cacheKey);

  const fallback = {
    city: city || 'Não informado',
    uf: ufUpper,
    ibgeCode: null,
    population: null,
    microrregiao: null,
    mesorregiao: null,
    regiaoImediata: null,
  };

  if (!normCity) return fallback;

  try {
    let municipios = IBGE_UF_CACHE.get(ufUpper);
    if (!municipios) {
      const munResp = await fetchWithTimeout(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(ufUpper)}/municipios`,
        { headers: { Accept: 'application/json' } },
        4500
      );
      if (munResp.ok) {
        municipios = await munResp.json();
        IBGE_UF_CACHE.set(ufUpper, municipios);
      }
    }

    if (!Array.isArray(municipios)) return fallback;

    const matched =
      municipios.find((m) => stripAccents(m.nome) === normCity) ||
      municipios.find((m) => stripAccents(m.nome).includes(normCity) || normCity.includes(stripAccents(m.nome)));

    if (!matched) return fallback;

    let population = null;
    try {
      const popResp = await fetchWithTimeout(
        `https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/-1/variaveis/93?localidades=N6[${matched.id}]`,
        { headers: { Accept: 'application/json' } },
        4000
      );
      if (popResp.ok) {
        const popJson = await popResp.json();
        const valStr = popJson?.[0]?.resultados?.[0]?.series?.[0]?.serie;
        if (valStr && typeof valStr === 'object') {
          const firstVal = Object.values(valStr)[0];
          const parsedPop = Number(firstVal);
          if (Number.isFinite(parsedPop) && parsedPop > 0) population = parsedPop;
        }
      }
    } catch {
      // população opcional
    }

    const res = {
      city: matched.nome,
      uf: ufUpper,
      ibgeCode: String(matched.id),
      population,
      microrregiao: matched.microrregiao?.nome || null,
      mesorregiao: matched.microrregiao?.mesorregiao?.nome || null,
      regiaoImediata: matched['regiao-imediata']?.nome || null,
    };
    IBGE_CITY_CACHE.set(cacheKey, res);
    return res;
  } catch {
    return fallback;
  }
}

// =====================================================================
// 3. COMPARÁVEIS INTERNOS NO SUPABASE
// =====================================================================
async function fetchInternalComparables(supabase, prop) {
  const empty = {
    cityActiveCount: 0,
    cityAvgAppraisalPerM2: null,
    cityAvgSalePerM2: null,
    neighborhoodActiveCount: 0,
    neighborhoodAvgAppraisalPerM2: null,
    neighborhoodAvgSalePerM2: null,
    sameStreetOrCondoCount: 0,
  };
  if (!supabase || !prop?.state || !prop?.city) return empty;

  try {
    const ufUpper = String(prop.state).trim().toUpperCase().slice(0, 2);
    const cityClean = String(prop.city).trim();
    const { data, error } = await supabase
      .from('properties')
      .select('source_property_id, neighborhood, address, property_type, appraisal_value, current_minimum_value, sale_value, private_area, total_area')
      .eq('status', 'ACTIVE')
      .eq('state', ufUpper)
      .ilike('city', `%${cityClean}%`)
      .limit(350);

    if (error || !Array.isArray(data) || data.length === 0) return empty;

    const normNeigh = stripAccents(prop.neighborhood || '');
    const streetToken = stripAccents(String(prop.address || '').split(',')[0] || '').slice(0, 24);
    const selfId = String(prop.source_property_id || prop.id || '');

    const calcMetrics = (rows) => {
      const evalPerM2 = [];
      const salePerM2 = [];
      for (const r of rows) {
        const rawArea = Number(r.private_area || r.total_area || 0);
        const area = rawArea > 10000 && Number.isInteger(rawArea) ? rawArea / 100 : rawArea;
        if (area < 12 || area > 5000) continue;
        const ev = Number(r.appraisal_value || 0);
        const sv = Number(r.current_minimum_value || r.sale_value || 0);
        if (ev > 10000) evalPerM2.push(ev / area);
        if (sv > 10000) salePerM2.push(sv / area);
      }
      const avg = (arr) =>
        arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
      return {
        avgEvalM2: avg(evalPerM2),
        avgSaleM2: avg(salePerM2),
      };
    };

    const cityMetrics = calcMetrics(data);
    const neighRows = normNeigh
      ? data.filter((r) => stripAccents(r.neighborhood || '').includes(normNeigh))
      : [];
    const neighMetrics = calcMetrics(neighRows);
    const streetRows =
      streetToken.length >= 6
        ? data.filter(
            (r) =>
              String(r.source_property_id || '') !== selfId &&
              stripAccents(r.address || '').includes(streetToken)
          )
        : [];

    return {
      cityActiveCount: data.length,
      cityAvgAppraisalPerM2: cityMetrics.avgEvalM2,
      cityAvgSalePerM2: cityMetrics.avgSaleM2,
      neighborhoodActiveCount: neighRows.length,
      neighborhoodAvgAppraisalPerM2: neighMetrics.avgEvalM2,
      neighborhoodAvgSalePerM2: neighMetrics.avgSaleM2,
      sameStreetOrCondoCount: streetRows.length,
    };
  } catch {
    return empty;
  }
}

// =====================================================================
// 4. DEEP LINKS PARA PORTAIS & MOTOR FINANCEIRO DETERMINÍSTICO
// =====================================================================
function buildPortalDeepLinks(prop) {
  const uf = String(prop.state || 'sp').trim().toLowerCase();
  const citySlug = slugifyPortal(prop.city || 'sao-paulo');
  const neighSlug = slugifyPortal(prop.neighborhood || '');
  const rawType = stripAccents(prop.property_type || '');
  const zapType = rawType.includes('casa')
    ? 'casas'
    : rawType.includes('terreno')
    ? 'terrenos-lotes-comerciais'
    : rawType.includes('comercial') || rawType.includes('sala') || rawType.includes('loja')
    ? 'imoveis-comerciais'
    : 'apartamentos';

  const zapLocation = neighSlug ? `${uf}+${citySlug}++${neighSlug}` : `${uf}+${citySlug}`;
  const zapUrl = `https://www.zapimoveis.com.br/venda/${zapType}/${zapLocation}/`;
  const vivaRealUrl = neighSlug
    ? `https://www.vivareal.com.br/venda/${uf}/${citySlug}/${neighSlug}/`
    : `https://www.vivareal.com.br/venda/${uf}/${citySlug}/`;
  const quintoAndarUrl = `https://www.quintoandar.com.br/comprar/imovel/${citySlug}-${uf}`;
  const olxUrl = `https://www.olx.com.br/imoveis/venda/estado-${uf}?q=${encodeURIComponent(
    [prop.neighborhood, prop.city].filter(Boolean).join(' ')
  )}`;
  const mapsQuery = [prop.address, prop.neighborhood, prop.city, prop.state, 'Brasil'].filter(Boolean).join(', ');
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;

  return { zapUrl, vivaRealUrl, quintoAndarUrl, olxUrl, mapsUrl };
}

function normalizeAreaM2(prop) {
  const raw = Number(prop.private_area || prop.total_area || prop.area_m2 || prop.area || 0);
  if (raw > 10000 && Number.isInteger(raw)) return raw / 100;
  return raw > 0 ? raw : 0;
}

function computeScenarioForMarket(params) {
  const {
    bidPrice,
    expectedResalePrice,
    auctioneerRate,
    itbiRate,
    registryCost,
    renovationCost,
    evictionAndLegalCost,
    monthlyHoldingCost,
    holdingMonths,
    brokerageRate,
    cdiAnnualPct,
  } = params;

  const auctioneerFee = bidPrice * auctioneerRate;
  const itbiCost = bidPrice * itbiRate;
  const holdingCostTotal = monthlyHoldingCost * holdingMonths;
  const totalInvested =
    bidPrice + auctioneerFee + itbiCost + registryCost + renovationCost + evictionAndLegalCost + holdingCostTotal;

  const grossSale = expectedResalePrice;
  const brokerageCost = grossSale * brokerageRate;
  const netBeforeTax = grossSale - brokerageCost;
  const grossGain = netBeforeTax - totalInvested;
  const capitalGainTax = grossGain > 0 ? grossGain * 0.15 : 0;
  const netProfit = grossGain - capitalGainTax;
  const roiPct = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;
  const years = Math.max(0.25, holdingMonths / 12);
  const irrAnnualPct =
    roiPct <= -99 ? -99 : (Math.pow(Math.max(0.01, 1 + roiPct / 100), 1 / years) - 1) * 100;
  const cdiPeriodPct = (Math.pow(1 + cdiAnnualPct / 100, years) - 1) * 100;
  const spreadVsCdiPct = roiPct - cdiPeriodPct;

  return {
    bidPrice: Math.round(bidPrice),
    expectedResalePrice: Math.round(grossSale),
    auctioneerFee: Math.round(auctioneerFee),
    itbiCost: Math.round(itbiCost),
    registryCost: Math.round(registryCost),
    renovationCost: Math.round(renovationCost),
    evictionAndLegalCost: Math.round(evictionAndLegalCost),
    holdingCostTotal: Math.round(holdingCostTotal),
    brokerageCost: Math.round(brokerageCost),
    capitalGainTax: Math.round(capitalGainTax),
    totalInvested: Math.round(totalInvested),
    netProfit: Math.round(netProfit),
    roiPct: Math.round(roiPct * 10) / 10,
    irrAnnualPct: Math.round(irrAnnualPct * 10) / 10,
    cdiPeriodPct: Math.round(cdiPeriodPct * 10) / 10,
    spreadVsCdiPct: Math.round(spreadVsCdiPct * 10) / 10,
    holdingMonths,
  };
}

function computeFinancialAnalysis(prop, options, bcbBenchmark, marketOverride = null) {
  const uf = String(prop.state || 'SP').trim().toUpperCase().slice(0, 2);
  const saleVal = Number(prop.current_minimum_value || prop.sale_value || prop.second_auction_value || 0);
  const appraisalVal = Number(prop.appraisal_value || prop.first_auction_value || saleVal || 0);
  const effectiveBid = saleVal > 0 ? saleVal : appraisalVal;
  const baseMarket = marketOverride && marketOverride > 0 ? marketOverride : appraisalVal > 0 ? appraisalVal : effectiveBid * 1.35;

  const modalityLower = String(prop.sale_modality || '').toLowerCase();
  const isCaixaDirect =
    String(prop.source || '').toUpperCase() === 'CAIXA' &&
    (modalityLower.includes('venda direta') || modalityLower.includes('venda online'));

  const auctioneerRate = isCaixaDirect ? 0 : 0.05;
  const itbiRate = ITBI_BY_UF[uf] ?? 0.025;
  const registryCost = effectiveBid <= 120000 ? 1800 : effectiveBid <= 350000 ? 3200 : 5500;

  const occ = String(prop.occupancy_status || 'UNKNOWN').toUpperCase();
  const evictionAndLegalCost = occ === 'VACANT' || occ === 'DESOCUPADO' ? 1500 : 6500;

  const baseRenovation = Math.max(8000, Math.round(baseMarket * 0.07));
  const monthlyHolding = Math.max(450, Math.round(baseMarket * 0.0008));
  const targetHoldingMonths = Number(options.holdingMonths || 10);
  const targetRoiPct = Number(options.targetRoiPct || 30);
  const cdiAnnualPct = Number(bcbBenchmark?.cdiAnnualPct || 13.65);

  const conservative = computeScenarioForMarket({
    bidPrice: effectiveBid,
    expectedResalePrice: baseMarket * 0.88,
    auctioneerRate,
    itbiRate,
    registryCost,
    renovationCost: Math.round(baseRenovation * 1.25),
    evictionAndLegalCost: evictionAndLegalCost + 2500,
    monthlyHoldingCost: monthlyHolding,
    holdingMonths: targetHoldingMonths + 4,
    brokerageRate: 0.06,
    cdiAnnualPct,
  });

  const base = computeScenarioForMarket({
    bidPrice: effectiveBid,
    expectedResalePrice: baseMarket,
    auctioneerRate,
    itbiRate,
    registryCost,
    renovationCost: baseRenovation,
    evictionAndLegalCost,
    monthlyHoldingCost: monthlyHolding,
    holdingMonths: targetHoldingMonths,
    brokerageRate: 0.06,
    cdiAnnualPct,
  });

  const optimistic = computeScenarioForMarket({
    bidPrice: effectiveBid,
    expectedResalePrice: baseMarket * 1.07,
    auctioneerRate,
    itbiRate,
    registryCost,
    renovationCost: Math.round(baseRenovation * 0.85),
    evictionAndLegalCost: Math.round(evictionAndLegalCost * 0.6),
    monthlyHoldingCost: monthlyHolding,
    holdingMonths: Math.max(4, targetHoldingMonths - 3),
    brokerageRate: 0.05,
    cdiAnnualPct,
  });

  // Lance máximo seguro para atingir o ROI líquido desejado no cenário Base (com 6% corretagem + 15% IR aproximado)
  const netSaleFactor = 1 - 0.06;
  const fixedNonBidCosts = registryCost + baseRenovation + evictionAndLegalCost + monthlyHolding * targetHoldingMonths;
  // Aproximação fechada considerando IR 15% sobre lucro:
  // netProfit = (gross*0.94 - totalInv)*0.85 >= targetRoi * totalInv
  // => totalInv <= gross*0.94*0.85 / (targetRoi + 0.85)
  const maxTotalCapital = (baseMarket * netSaleFactor * 0.85) / (targetRoiPct / 100 + 0.85);
  const maxSafeBid = Math.max(
    0,
    Math.round((maxTotalCapital - fixedNonBidCosts) / (1 + auctioneerRate + itbiRate))
  );

  const areaM2 = normalizeAreaM2(prop);
  const bidPerM2 = areaM2 > 0 && effectiveBid > 0 ? Math.round(effectiveBid / areaM2) : null;
  const appraisalPerM2 = areaM2 > 0 && appraisalVal > 0 ? Math.round(appraisalVal / areaM2) : null;
  const marketPerM2 = areaM2 > 0 && baseMarket > 0 ? Math.round(baseMarket / areaM2) : null;

  const estimatedMonthlyRent = Math.round(baseMarket * 0.0048);
  const grossRentalYieldAnnualPct =
    base.totalInvested > 0 ? Math.round(((estimatedMonthlyRent * 12) / base.totalInvested) * 1000) / 10 : 0;

  return {
    effectiveBid: Math.round(effectiveBid),
    appraisalValue: Math.round(appraisalVal),
    assumedMarketValue: Math.round(baseMarket),
    areaM2: areaM2 > 0 ? Math.round(areaM2 * 10) / 10 : null,
    bidPerM2,
    appraisalPerM2,
    marketPerM2,
    itbiRatePct: Math.round(itbiRate * 1000) / 10,
    auctioneerRatePct: Math.round(auctioneerRate * 1000) / 10,
    maxSafeBid,
    bidHeadroomBrl: Math.round(maxSafeBid - effectiveBid),
    estimatedMonthlyRent,
    grossRentalYieldAnnualPct,
    scenarios: { conservative, base, optimistic },
  };
}

// =====================================================================
// 5. INTEGRAÇÃO GOOGLE GEMINI COM GOOGLE SEARCH GROUNDING
// =====================================================================
function extractJsonFromGeminiText(rawText) {
  if (!rawText) return null;
  const fenced = rawText.match(/```json\s*([\s\S]*?)```/i) || rawText.match(/```\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : rawText.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callGeminiCommittee({
  apiKey,
  propertiesContext,
  regionsContext,
  strategy,
  paymentMode,
  targetRoiPct,
  holdingMonths,
  bcbBenchmark,
  customNotes,
}) {
  const modelsToTry = [
    process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];

  const prompt = `Você é o Comitê Sênior de Investimentos em Leilões Imobiliários no Brasil (G2 Auction AI).
Analise os imóveis reais abaixo e produza um relatório comparativo técnico, direto e altamente acionável em Português (BR).

USE A FERRAMENTA DE BUSCA (Google Search) para pesquisar em tempo real:
1. Preço real de venda por m² e valor de aluguel mensal de imóveis comparáveis nas mesmas cidades/bairros/condomínios (ZAP Imóveis, VivaReal, QuintoAndar, FipeZAP, imobiliárias locais).
2. Perfil econômico da cidade e microrregião, liquidez do bairro, vetores de valorização e riscos locais.
3. Verifique se a "Avaliação do Banco" está compatível com o mercado real ou se há risco de FALSO DESÁGIO (banco avaliou acima do valor de revenda real).

PARÂMETROS DA OPERAÇÃO:
- Estratégia principal: ${strategy} (FLIPPING = revenda rápida, RENTAL = renda/aluguel, LIVING = moradia/patrimônio)
- Forma de pagamento: ${paymentMode} (CASH = à vista, FINANCED = financiado)
- ROI Líquido Alvo: ${targetRoiPct}% | Holding base: ${holdingMonths} meses
- CDI Oficial BCB vigente: ${bcbBenchmark.cdiAnnualPct}% a.a. | IPCA 12m: ${bcbBenchmark.ipca12mPct}% a.a.
${customNotes ? `- Observação/pergunta específica do investidor: ${customNotes}` : ''}

DADOS IBGE + COMPARÁVEIS INTERNOS POR CIDADE:
${JSON.stringify(regionsContext, null, 2)}

IMÓVEIS SELECIONADOS PARA COMPARAÇÃO:
${JSON.stringify(propertiesContext, null, 2)}

RETORNE APENAS UM BLOCO JSON VÁLIDO (\`\`\`json ... \`\`\`) seguindo EXATAMENTE esta estrutura:
{
  "executiveSummary": {
    "headline": "Título curto com a principal conclusão comparativa",
    "bestPickId": "id do melhor imóvel conforme strategy",
    "bestPickReason": "Explicação objetiva de 2-3 frases do porquê ele vence os demais",
    "committeeOverview": "Análise executiva consolidada comparando os imóveis, liquidez regional e risco-retorno vs CDI",
    "portfolioRecommendation": "Recomendação tática de alocação e próximos passos pré-leilão"
  },
  "regionAnalyses": [
    {
      "city": "Nome da Cidade",
      "uf": "UF",
      "macroOverview": "Análise macroeconômica e imobiliária da cidade/microrregião baseada em dados reais e IBGE",
      "economicDrivers": ["vetor 1", "vetor 2", "vetor 3"],
      "neighborhoodInsights": "Análise detalhada dos bairros/ruas dos imóveis nessa cidade (demanda, liquidez, infraestrutura)",
      "liquidityRating": "ALTA | MEDIA | BAIXA",
      "pricePerM2RangeBrl": { "min": 4500, "avg": 6200, "max": 8500 },
      "marketTrends": "Tendência atual de preços/aluguel e tempo médio de absorção",
      "regionalRisks": ["risco regional 1", "risco regional 2"]
    }
  ],
  "propertyAssessments": [
    {
      "propertyId": "id exato do imóvel enviado",
      "rank": 1,
      "verdict": "COMPRAR | ESTUDAR_COM_RESSALVAS | EVITAR",
      "aiScore": 84,
      "estimatedMarketPricePerM2": 6500,
      "estimatedMarketValue": 420000,
      "estimatedMonthlyRent": 2100,
      "estimatedResaleMonths": 9,
      "falseDiscountAlert": {
        "flagged": false,
        "reason": "Explicar se a avaliação do banco está aderente ao mercado web ou inflada"
      },
      "marketComparisonSummary": "Comparativo claro entre preço/m² do lance, avaliação do banco e anúncios reais da região",
      "pros": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
      "cons": ["ponto de atenção 1", "ponto de atenção 2"],
      "legalDiligenceChecklist": ["item edital/matrícula/débito/ocupação específico 1", "item 2", "item 3"],
      "biddingStrategy": "Estratégia prática de lance, teto recomendado e forma de pagamento"
    }
  ]
}`;

  for (const model of modelsToTry) {
    for (const useSearch of [true, false]) {
      try {
        const body = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 8192,
          },
          ...(useSearch ? { tools: [{ google_search: {} }] } : {}),
        };

        const resp = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
            model
          )}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
          45000
        );

        if (!resp.ok) {
          continue;
        }

        const data = await resp.json();
        const candidate = data?.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        const rawText = parts.map((p) => p?.text || '').join('\n').trim();
        const parsed = extractJsonFromGeminiText(rawText);

        if (!parsed || !Array.isArray(parsed.propertyAssessments)) {
          continue;
        }

        const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
        const webQueries = candidate?.groundingMetadata?.webSearchQueries || [];
        const seenUrls = new Set();
        const webSources = [];
        for (const ch of groundingChunks) {
          const uri = ch?.web?.uri;
          const title = ch?.web?.title || uri;
          if (uri && !seenUrls.has(uri)) {
            seenUrls.add(uri);
            webSources.push({ title, url: uri });
          }
        }

        return {
          parsed,
          modelUsed: model,
          usedWebGrounding: useSearch && (webSources.length > 0 || webQueries.length > 0),
          webSources: webSources.slice(0, 15),
          webQueries,
        };
      } catch {
        // tenta próxima combinação
      }
    }
  }

  return null;
}

// =====================================================================
// 6. FALLBACK DETERMINÍSTICO (QUANDO SEM CHAVE GEMINI LOCAL)
// =====================================================================
function buildDeterministicFallbackReport({
  enrichedProperties,
  regionsContext,
  strategy,
  bcbBenchmark,
}) {
  const scored = enrichedProperties
    .map((ep) => {
      const baseRoi = ep.financial.scenarios.base.roiPct;
      const spread = ep.financial.scenarios.base.spreadVsCdiPct;
      const yieldPct = ep.financial.grossRentalYieldAnnualPct;
      const occBonus = String(ep.raw.occupancy_status || '').toUpperCase() === 'VACANT' ? 8 : 0;
      const finBonus = ep.raw.accepts_financing ? 5 : 0;
      const rawScore =
        strategy === 'RENTAL'
          ? Math.min(96, Math.max(35, Math.round(45 + yieldPct * 4 + occBonus + finBonus)))
          : Math.min(96, Math.max(35, Math.round(45 + baseRoi * 0.65 + (spread > 0 ? 8 : -5) + occBonus + finBonus)));
      return { ep, rawScore };
    })
    .sort((a, b) => b.rawScore - a.rawScore);

  const best = scored[0]?.ep;

  const regionAnalyses = regionsContext.map((reg) => {
    const avgM2 = reg.comparables.cityAvgAppraisalPerM2 || reg.comparables.cityAvgSalePerM2 || 5500;
    return {
      city: reg.city,
      uf: reg.uf,
      macroOverview: `${reg.city}/${reg.uf}${
        reg.ibge?.population ? ` possui população estimada de ${reg.ibge.population.toLocaleString('pt-BR')} habitantes (IBGE)` : ''
      }${reg.ibge?.microrregiao ? ` na microrregião de ${reg.ibge.microrregiao}` : ''}. Base G2Auction registra ${
        reg.comparables.cityActiveCount
      } oportunidade(s) ativa(s) na cidade.`,
      economicDrivers: [
        'Demanda habitacional local e giro de imóveis retomados',
        `Benchmark CDI vigente em ${bcbBenchmark.cdiAnnualPct}% a.a.`,
        'Comparativo direto por preço/m² na base multi-bancos',
      ],
      neighborhoodInsights:
        'Use os botões ZAP Imóveis, VivaReal e QuintoAndar em cada ficha para validar anúncios ativos no mesmo bairro/condomínio.',
      liquidityRating: reg.comparables.cityActiveCount >= 20 ? 'ALTA' : reg.comparables.cityActiveCount >= 5 ? 'MEDIA' : 'BAIXA',
      pricePerM2RangeBrl: {
        min: Math.round(avgM2 * 0.78),
        avg: Math.round(avgM2),
        max: Math.round(avgM2 * 1.25),
      },
      marketTrends: 'Análise executada com motor determinístico local (configure GEMINI_API_KEY para pesquisa web ao vivo).',
      regionalRisks: [
        'Validar anúncios reais em portais para confirmar ausência de sobreavaliação bancária',
        'Conferir prazo de desocupação e despesas condominiais em aberto no edital',
      ],
    };
  });

  const propertyAssessments = scored.map(({ ep, rawScore }, idx) => {
    const base = ep.financial.scenarios.base;
    const verdict =
      rawScore >= 72 && base.spreadVsCdiPct > 0
        ? 'COMPRAR'
        : rawScore >= 52
        ? 'ESTUDAR_COM_RESSALVAS'
        : 'EVITAR';
    const isCashOnly = ep.raw.accepts_financing === false;
    const isOccupied = String(ep.raw.occupancy_status || '').toUpperCase() === 'OCCUPIED';

    return {
      propertyId: ep.propertyId,
      rank: idx + 1,
      verdict,
      aiScore: rawScore,
      estimatedMarketPricePerM2: ep.financial.appraisalPerM2 || ep.financial.marketPerM2,
      estimatedMarketValue: ep.financial.assumedMarketValue,
      estimatedMonthlyRent: ep.financial.estimatedMonthlyRent,
      estimatedResaleMonths: base.holdingMonths,
      falseDiscountAlert: {
        flagged: ep.financial.appraisalValue > 0 && ep.financial.effectiveBid >= ep.financial.appraisalValue * 0.92,
        reason:
          ep.financial.effectiveBid >= ep.financial.appraisalValue * 0.92
            ? 'Deságio aparente reduzido (<8% abaixo da avaliação); risco elevado de margem apertada após custos de arrematação e revenda.'
            : 'Deságio inicial atrativo frente à avaliação do banco; recomenda-se validar com comparáveis ativos nos portais.',
      },
      marketComparisonSummary: `Lance de ${
        ep.financial.bidPerM2 ? `R$ ${ep.financial.bidPerM2.toLocaleString('pt-BR')}/m²` : 'valor total'
      } frente à avaliação bancária${
        ep.financial.appraisalPerM2 ? ` de R$ ${ep.financial.appraisalPerM2.toLocaleString('pt-BR')}/m²` : ''
      }.`,
      pros: [
        `ROI líquido projetado (cenário Base) de ${base.roiPct}% (${base.spreadVsCdiPct >= 0 ? '+' : ''}${base.spreadVsCdiPct} p.p. vs CDI)`,
        `Lance máximo seguro calculado em R$ ${ep.financial.maxSafeBid.toLocaleString('pt-BR')}`,
        ep.raw.accepts_financing ? 'Aceita financiamento habitacional (maior alavancagem)' : 'Aquisição direta sem juros de obra',
      ],
      cons: [
        isOccupied ? 'Imóvel consta ocupado (prever prazo e custos de imissão na posse)' : 'Confirmar situação física de ocupação in loco',
        isCashOnly ? 'Exige pagamento integral à vista' : 'Sujeito à aprovação de crédito/engenharia',
      ],
      legalDiligenceChecklist: [
        'Baixar matrícula atualizada no CRI e conferir ônus, penhoras ou indisponibilidades',
        'Ler edital completo verificando responsabilidade sobre IPTU e condomínio atrasados',
        'Validar 3 a 5 anúncios equivalentes no mesmo bairro/condomínio antes do lance',
      ],
      biddingStrategy: `Respeitar teto de lance seguro de R$ ${ep.financial.maxSafeBid.toLocaleString('pt-BR')} para preservar margem líquida.`,
    };
  });

  return {
    executiveSummary: {
      headline: best
        ? `Melhor relação risco-retorno: ${best.raw.title || best.propertyId} (${best.raw.city}/${best.raw.state})`
        : 'Relatório Comparativo Multi-Imóveis G2',
      bestPickId: best?.propertyId || null,
      bestPickReason: best
        ? `Maior equilíbrio entre margem líquida (${best.financial.scenarios.base.roiPct}% no cenário base), spread sobre o CDI (${best.financial.scenarios.base.spreadVsCdiPct} p.p.) e folga até o lance máximo seguro.`
        : 'Análise consolidada concluída.',
      committeeOverview:
        'Comparativo gerado pelo motor financeiro determinístico com dados reais do BCB (CDI/IPCA), IBGE e comparáveis internos da base G2Auction.',
      portfolioRecommendation:
        'Priorize os ativos classificados como COMPRAR após checar matrícula atualizada e comparáveis nos links diretos de ZAP/VivaReal.',
    },
    regionAnalyses,
    propertyAssessments,
  };
}

// =====================================================================
// HANDLER PRINCIPAL
// =====================================================================
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Use POST com lista de imóveis.' });
  }

  const t0 = Date.now();

  try {
    const body = await readJsonBody(req);
    const rawProps = Array.isArray(body?.properties) ? body.properties.slice(0, 6) : [];
    if (rawProps.length === 0) {
      return res.status(400).json({ ok: false, error: 'Selecione pelo menos 1 imóvel (máximo 6).' });
    }

    const strategy = ['FLIPPING', 'RENTAL', 'LIVING'].includes(String(body?.strategy || '').toUpperCase())
      ? String(body.strategy).toUpperCase()
      : 'FLIPPING';
    const paymentMode = String(body?.paymentMode || '').toUpperCase() === 'FINANCED' ? 'FINANCED' : 'CASH';
    const targetRoiPct = Math.min(120, Math.max(5, Number(body?.targetRoiPct || 30)));
    const holdingMonths = Math.min(60, Math.max(3, Number(body?.holdingMonths || 10)));
    const customNotes = String(body?.customNotes || '').trim().slice(0, 600);

    const supabase = getSupabaseClient();
    const bcbBenchmark = await fetchBcbBenchmark();

    // Regiões únicas (Cidade + UF)
    const uniqueRegionsMap = new Map();
    for (const p of rawProps) {
      const uf = String(p.state || 'SP').trim().toUpperCase().slice(0, 2);
      const city = String(p.city || 'São Paulo').trim();
      const key = `${uf}:${stripAccents(city)}`;
      if (!uniqueRegionsMap.has(key)) {
        uniqueRegionsMap.set(key, { city, uf, sampleProp: p });
      }
    }

    // Coleta paralela de IBGE + comparáveis internos por imóvel
    const [regionPairs, comparablesPerProp] = await Promise.all([
      Promise.all(
        Array.from(uniqueRegionsMap.entries()).map(async ([key, reg]) => {
          const [ibge, comps] = await Promise.all([
            fetchIbgeCityContext(reg.city, reg.uf),
            fetchInternalComparables(supabase, reg.sampleProp),
          ]);
          return [key, { city: reg.city, uf: reg.uf, ibge, comparables: comps }];
        })
      ),
      Promise.all(rawProps.map((p) => fetchInternalComparables(supabase, p))),
    ]);

    const regionsByKey = new Map(regionPairs);
    const regionsContext = Array.from(regionsByKey.values());

    const enrichedProperties = rawProps.map((p, idx) => {
      const propertyId = String(p.id || p.source_property_id || `prop-${idx + 1}`);
      const financial = computeFinancialAnalysis(
        p,
        { holdingMonths, targetRoiPct, paymentMode },
        bcbBenchmark
      );
      const portalLinks = buildPortalDeepLinks(p);
      const comparables = comparablesPerProp[idx];
      const regKey = `${String(p.state || 'SP').trim().toUpperCase().slice(0, 2)}:${stripAccents(p.city || '')}`;
      const regionInfo = regionsByKey.get(regKey);

      return {
        propertyId,
        raw: p,
        financial,
        portalLinks,
        comparables,
        ibge: regionInfo?.ibge || null,
      };
    });

    const propertiesContextForAi = enrichedProperties.map((ep) => ({
      propertyId: ep.propertyId,
      source: ep.raw.source || 'CAIXA',
      sourcePropertyId: ep.raw.source_property_id || ep.propertyId,
      title: ep.raw.title || `${ep.raw.property_type || 'Imóvel'} em ${ep.raw.city}`,
      propertyType: ep.raw.property_type || 'Imóvel',
      saleModality: ep.raw.sale_modality || 'Leilão',
      state: ep.raw.state,
      city: ep.raw.city,
      neighborhood: ep.raw.neighborhood || null,
      address: ep.raw.address || null,
      areaM2: ep.financial.areaM2,
      bedrooms: ep.raw.bedrooms ?? null,
      parkingSpaces: ep.raw.parking_spaces ?? null,
      occupancyStatus: ep.raw.occupancy_status || 'UNKNOWN',
      acceptsFinancing: ep.raw.accepts_financing ?? null,
      description: String(ep.raw.description || '').slice(0, 600),
      effectiveBidBrl: ep.financial.effectiveBid,
      bankAppraisalBrl: ep.financial.appraisalValue,
      bidPerM2Brl: ep.financial.bidPerM2,
      bankAppraisalPerM2Brl: ep.financial.appraisalPerM2,
      internalComparables: ep.comparables,
      deterministicBaseRoiPct: ep.financial.scenarios.base.roiPct,
      maxSafeBidBrl: ep.financial.maxSafeBid,
    }));

    const geminiApiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      ''
    ).trim();

    let aiResult = null;
    if (geminiApiKey) {
      aiResult = await callGeminiCommittee({
        apiKey: geminiApiKey,
        propertiesContext: propertiesContextForAi,
        regionsContext,
        strategy,
        paymentMode,
        targetRoiPct,
        holdingMonths,
        bcbBenchmark,
        customNotes,
      });
    }

    const aiMode = aiResult ? 'GEMINI_LIVE' : 'DETERMINISTIC_FALLBACK';
    const aiData = aiResult
      ? aiResult.parsed
      : buildDeterministicFallbackReport({
          enrichedProperties,
          regionsContext,
          strategy,
          bcbBenchmark,
        });

    // Mesclar cada imóvel com o parecer da IA e recalcular cenário ajustado ao mercado real
    const assessmentMap = new Map();
    for (const a of aiData.propertyAssessments || []) {
      assessmentMap.set(String(a.propertyId), a);
    }

    const propertiesReport = enrichedProperties
      .map((ep, idx) => {
        const aiAssess = assessmentMap.get(ep.propertyId) || {};
        const aiMarketVal = Number(aiAssess.estimatedMarketValue || 0);
        const aiMarketPerM2 = Number(aiAssess.estimatedMarketPricePerM2 || 0);
        const effectiveAiMarketValue =
          aiMarketVal > 0
            ? aiMarketVal
            : aiMarketPerM2 > 0 && ep.financial.areaM2
            ? Math.round(aiMarketPerM2 * ep.financial.areaM2)
            : ep.financial.assumedMarketValue;

        const marketAdjustedFinancial =
          effectiveAiMarketValue > 0 && effectiveAiMarketValue !== ep.financial.assumedMarketValue
            ? computeFinancialAnalysis(
                ep.raw,
                { holdingMonths, targetRoiPct, paymentMode },
                bcbBenchmark,
                effectiveAiMarketValue
              )
            : ep.financial;

        return {
          propertyId: ep.propertyId,
          source: ep.raw.source || 'CAIXA',
          sourcePropertyId: ep.raw.source_property_id || ep.propertyId,
          title: ep.raw.title || `${ep.raw.property_type || 'Imóvel'} — ${ep.raw.city}/${ep.raw.state}`,
          propertyType: ep.raw.property_type || 'Imóvel',
          saleModality: ep.raw.sale_modality || 'Leilão',
          city: ep.raw.city,
          state: ep.raw.state,
          neighborhood: ep.raw.neighborhood || null,
          address: ep.raw.address || null,
          sourceUrl: ep.raw.source_url || null,
          mainPhotoUrl: ep.raw.main_photo_url || null,
          occupancyStatus: ep.raw.occupancy_status || 'UNKNOWN',
          acceptsFinancing: ep.raw.accepts_financing ?? null,
          rank: Number(aiAssess.rank || idx + 1),
          verdict: aiAssess.verdict || 'ESTUDAR_COM_RESSALVAS',
          aiScore: Number(aiAssess.aiScore || 65),
          estimatedMarketPricePerM2:
            aiMarketPerM2 || marketAdjustedFinancial.marketPerM2 || ep.financial.appraisalPerM2,
          estimatedMarketValue: effectiveAiMarketValue,
          estimatedMonthlyRent: Number(
            aiAssess.estimatedMonthlyRent || marketAdjustedFinancial.estimatedMonthlyRent
          ),
          estimatedResaleMonths: Number(aiAssess.estimatedResaleMonths || holdingMonths),
          falseDiscountAlert: aiAssess.falseDiscountAlert || {
            flagged: false,
            reason: 'Avaliação compatível com a faixa observada.',
          },
          marketComparisonSummary:
            aiAssess.marketComparisonSummary || 'Comparativo calculado sobre avaliação e base interna.',
          pros: Array.isArray(aiAssess.pros) ? aiAssess.pros : [],
          cons: Array.isArray(aiAssess.cons) ? aiAssess.cons : [],
          legalDiligenceChecklist: Array.isArray(aiAssess.legalDiligenceChecklist)
            ? aiAssess.legalDiligenceChecklist
            : [],
          biddingStrategy: aiAssess.biddingStrategy || '',
          financial: marketAdjustedFinancial,
          bankAppraisalFinancial: ep.financial,
          comparables: ep.comparables,
          ibge: ep.ibge,
          portalLinks: ep.portalLinks,
        };
      })
      .sort((a, b) => a.rank - b.rank);

    return res.status(200).json({
      ok: true,
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - t0,
      aiMode,
      modelUsed: aiResult?.modelUsed || 'deterministic-v1',
      usedWebGrounding: Boolean(aiResult?.usedWebGrounding),
      webSources: aiResult?.webSources || [],
      webQueries: aiResult?.webQueries || [],
      parameters: {
        strategy,
        paymentMode,
        targetRoiPct,
        holdingMonths,
        customNotes: customNotes || null,
      },
      bcbBenchmark,
      executiveSummary: aiData.executiveSummary || {},
      regionAnalyses: aiData.regionAnalyses || [],
      properties: propertiesReport,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Erro ao gerar relatório de inteligência IA.',
      elapsedMs: Date.now() - t0,
    });
  }
}
