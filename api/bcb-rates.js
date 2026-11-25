function formatDateBr(isoDate) {
  const parts = String(isoDate || '').trim().split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function addMonthsIso(dateObj, monthsDelta) {
  const d = new Date(dateObj.getTime());
  d.setMonth(d.getMonth() + monthsDelta);
  return d.toISOString().slice(0, 10);
}

async function fetchBcbSeries(seriesId, startIso, endIso, lastN) {
  let url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados`;
  if (startIso && endIso) {
    const startBr = encodeURIComponent(formatDateBr(startIso));
    const endBr = encodeURIComponent(formatDateBr(endIso));
    url += `?formato=json&dataInicial=${startBr}&dataFinal=${endBr}`;
  } else if (lastN) {
    url += `/ultimos/${lastN}?formato=json`;
  } else {
    url += `/ultimos/1?formato=json`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'G2Auction/3.15',
      },
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`BCB SGS ${seriesId} HTTP ${resp.status}`);
    }
    const json = await resp.json();
    return Array.isArray(json) ? json : [];
  } finally {
    clearTimeout(timeout);
  }
}

function roundPct(n, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

export default async function handler(req, res) {
  const host = req.headers?.host || 'localhost';
  const urlObj = new URL(req.url || '/api/bcb-rates', `http://${host}`);
  const startDate = urlObj.searchParams.get('startDate');
  const endDate = urlObj.searchParams.get('endDate');

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=43200, stale-while-revalidate=86400');

  if (startDate && endDate) {
    try {
      const [cdiDailyRows, ipcaRows] = await Promise.all([
        fetchBcbSeries(12, startDate, endDate),
        fetchBcbSeries(433, startDate, endDate),
      ]);

      let cdiFactor = 1;
      for (const row of cdiDailyRows) {
        const val = parseFloat(String(row.valor || '0').replace(',', '.'));
        if (Number.isFinite(val)) {
          cdiFactor *= 1 + val / 100;
        }
      }
      const periodCdiPct = roundPct((cdiFactor - 1) * 100, 4);

      let ipcaFactor = 1;
      for (const row of ipcaRows) {
        const val = parseFloat(String(row.valor || '0').replace(',', '.'));
        if (Number.isFinite(val)) {
          ipcaFactor *= 1 + val / 100;
        }
      }
      const periodIpcaPct = roundPct((ipcaFactor - 1) * 100, 4);

      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();
      const elapsedDays = Math.max(1, Math.round((endMs - startMs) / 86400000));
      const realPlus6Factor = Math.pow(1.06, elapsedDays / 365);
      const periodIpcaPlus6Pct = roundPct((ipcaFactor * realPlus6Factor - 1) * 100, 4);

      return res.status(200).json({
        startDate,
        endDate,
        businessDays: cdiDailyRows.length,
        elapsedDays,
        periodCdiPct,
        periodIpcaPct,
        periodIpcaPlus6Pct,
        source: 'Banco Central do Brasil (SGS Séries 12 e 433)',
        isFallback: cdiDailyRows.length === 0,
      });
    } catch (err) {
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();
      const elapsedDays = Math.max(1, Math.round((endMs - startMs) / 86400000));
      const estCdi = roundPct((Math.pow(1.1365, elapsedDays / 365) - 1) * 100, 4);
      const estIpca6 = roundPct((Math.pow(1.1077, elapsedDays / 365) - 1) * 100, 4);
      return res.status(200).json({
        startDate,
        endDate,
        businessDays: Math.round(elapsedDays * (252 / 365)),
        elapsedDays,
        periodCdiPct: estCdi,
        periodIpcaPct: roundPct((Math.pow(1.045, elapsedDays / 365) - 1) * 100, 4),
        periodIpcaPlus6Pct: estIpca6,
        source: `Fallback estimado (${err?.message || 'BCB indisponível'})`,
        isFallback: true,
      });
    }
  }

  try {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const start13mIso = addMonthsIso(today, -13);

    const [cdiRows, ipcaRows] = await Promise.all([
      fetchBcbSeries(4389, null, null, 1),
      fetchBcbSeries(433, start13mIso, todayIso),
    ]);

    const latestCdi = cdiRows[cdiRows.length - 1];
    const cdiAnnualPct = latestCdi
      ? roundPct(parseFloat(String(latestCdi.valor || '13.65').replace(',', '.')), 2)
      : 13.65;

    const last12Ipca = ipcaRows.slice(-12);
    let ipcaFactor = 1;
    for (const row of last12Ipca) {
      const val = parseFloat(String(row.valor || '0').replace(',', '.'));
      if (Number.isFinite(val)) {
        ipcaFactor *= 1 + val / 100;
      }
    }
    const ipca12mPct = last12Ipca.length > 0 ? roundPct((ipcaFactor - 1) * 100, 2) : 4.5;
    const ipcaPlus6AnnualPct = roundPct(((1 + ipca12mPct / 100) * 1.06 - 1) * 100, 2);

    return res.status(200).json({
      cdiAnnualPct,
      ipca12mPct,
      ipcaPlus6AnnualPct,
      referenceDate: latestCdi?.data || formatDateBr(todayIso),
      source: 'Banco Central do Brasil (SGS 4389 / 433)',
      isFallback: false,
    });
  } catch (err) {
    return res.status(200).json({
      cdiAnnualPct: 13.65,
      ipca12mPct: 4.5,
      ipcaPlus6AnnualPct: 10.77,
      referenceDate: formatDateBr(new Date().toISOString().slice(0, 10)),
      source: `Referência local (${err?.message || 'BCB indisponível'})`,
      isFallback: true,
    });
  }
}
