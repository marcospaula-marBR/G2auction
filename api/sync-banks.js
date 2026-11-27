/**
 * Endpoint Serverless de Sincronização Sob Demanda — api/sync-banks.js
 *
 * Permite acionar a sincronização real multi-bancos -> Supabase a qualquer momento:
 *   GET/POST /api/sync-banks?bank=bradesco|caixa|mega|zuk|cleanup&uf=SP
 */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function getSupabaseAdminClient() {
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

function parseBrNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  let clean = String(val).replace(/R\$/gi, '').replace(/%/g, '').trim();
  if (!clean) return null;
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  } else if (clean.split('.').length > 2) {
    clean = clean.replace(/\./g, '');
  }
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function stripHtmlTags(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAccentsLower(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseIsoDt(val) {
  if (!val) return null;
  const cleaned = String(val).trim();
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : cleaned;
}

function parseBrDatetimeToIso(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{2})\/(\d{2})\/(\d{4})(?:[^\d]+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, day, month, year, hh, mm] = m;
  return `${year}-${month}-${day}T${hh || '10'}:${mm || '00'}:00-03:00`;
}

function chooseActiveAuctionDate(...candidates) {
  const valid = [];
  for (const c of candidates) {
    if (!c) continue;
    const d = new Date(c);
    if (!Number.isNaN(d.getTime())) valid.push({ raw: c, ms: d.getTime() });
  }
  if (valid.length === 0) return null;

  // Início do dia atual em BRT (-03:00)
  const now = new Date();
  const brtOffsetMs = -3 * 3600 * 1000;
  const brtNow = new Date(now.getTime() + brtOffsetMs);
  const todayStartBrtMs =
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 0, 0, 0, 0) - brtOffsetMs;

  for (const item of valid) {
    if (item.ms >= todayStartBrtMs) return item.raw;
  }
  return valid[valid.length - 1].raw;
}

function computeHash(obj) {
  const stable = {
    source: obj.source,
    id: obj.source_property_id,
    min: obj.current_minimum_value,
    eval: obj.appraisal_value,
    disc: obj.discount_percentage,
    d1: obj.first_auction_date,
    d2: obj.second_auction_date,
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 32);
}

function classifySourceFromText(text, isJudicial, fallbackSource) {
  const low = (text || '').toLowerCase();
  if (low.includes('santander')) return 'SANTANDER';
  if (low.includes('itaú') || low.includes('itau')) return 'ITAU';
  if (low.includes('banco do brasil') || /\bbb\b/.test(low)) return 'BB';
  if (low.includes('bradesco')) return 'BRADESCO';
  if (low.includes('caixa') || /\bcef\b/.test(low)) return 'CAIXA';
  if (isJudicial) return 'JUDICIAL';
  return fallbackSource;
}

function inferPropertyType(text) {
  const low = (text || '').toLowerCase();
  if (low.includes('apartamento') || low.includes('apto')) return 'Apartamento';
  if (low.includes('casa') || low.includes('sobrado')) return 'Casa';
  if (low.includes('terreno') || low.includes('lote') || low.includes('gleba')) return 'Terreno';
  if (low.includes('galpão') || low.includes('galpao')) return 'Galpão';
  if (low.includes('loja')) return 'Loja';
  if (low.includes('sala') || low.includes('conjunto')) return 'Sala';
  if (low.includes('comercial') || low.includes('industrial') || low.includes('prédio') || low.includes('predio')) {
    return 'Comercial';
  }
  if (low.includes('rural') || low.includes('fazenda') || low.includes('sítio') || low.includes('chácara')) {
    return 'Rural';
  }
  return 'Imóvel';
}

function parseCaixaDescription(desc) {
  if (!desc) return {};
  const lower = desc.toLowerCase();
  let property_type = 'Imóvel';
  if (lower.includes('apartamento')) property_type = 'Apartamento';
  else if (lower.includes('casa') || lower.includes('sobrado')) property_type = 'Casa';
  else if (lower.includes('terreno') || lower.includes('lote') || lower.includes('gleba')) property_type = 'Terreno';
  else if (lower.includes('galpão') || lower.includes('galpao')) property_type = 'Galpão';
  else if (lower.includes('loja')) property_type = 'Loja';
  else if (lower.includes('sala')) property_type = 'Sala';
  else if (lower.includes('comercial') || lower.includes('prédio') || lower.includes('predio')) property_type = 'Comercial';

  const grabNum = (re) => {
    const m = desc.match(re);
    return m ? parseBrNumber(m[1]) : null;
  };
  const bedsM = desc.match(/(\d+)\s*qto\(s\)|(\d+)\s*quarto/i);
  const vagasM = desc.match(/(\d+)\s*vaga/i);

  return {
    property_type,
    private_area: grabNum(/([\d.,]+)\s*(?:m2|m²)?\s*de\s*[áa]rea\s*privativa/i),
    total_area: grabNum(/([\d.,]+)\s*(?:m2|m²)?\s*de\s*[áa]rea\s*total/i),
    land_area: grabNum(/([\d.,]+)\s*(?:m2|m²)?\s*de\s*[áa]rea\s*do\s*terreno/i),
    bedrooms: bedsM ? Number(bedsM[1] || bedsM[2]) : null,
    parking_spaces: vagasM ? Number(vagasM[1]) : null,
  };
}

function parseCsvLine(line, delimiter = ';') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' || ch === "'") {
      if (inQuotes && line[i + 1] === ch) {
        current += ch;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result.map((c) => c.replace(/^["']|["']$/g, '').trim());
}

// =====================================================================
// PERSISTÊNCIA & RECONCILIAÇÃO SUPABASE
// =====================================================================
async function batchUpsertSupabase(supabase, rows, batchSize = 200) {
  if (!rows || rows.length === 0) return 0;
  const dedup = new Map();
  for (const r of rows) {
    dedup.set(`${r.source}__${r.source_property_id}`, r);
  }
  const nowIso = new Date().toISOString();
  const uniqueRows = Array.from(dedup.values()).map((r) => ({
    ...r,
    last_seen_at: nowIso,
    updated_at: nowIso,
  }));

  let written = 0;
  for (let i = 0; i < uniqueRows.length; i += batchSize) {
    const chunk = uniqueRows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('properties')
      .upsert(chunk, { onConflict: 'source,source_property_id' });
    if (error) {
      throw new Error(`Upsert falhou no lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
    }
    written += chunk.length;
  }
  return written;
}

async function reconcileByPrefixUf(supabase, idPrefix, uf, activeIds) {
  if (!activeIds || activeIds.size === 0) return 0;
  const ufUpper = uf.toUpperCase();
  const existing = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('properties')
      .select('id, source_property_id')
      .like('source_property_id', `${idPrefix}%`)
      .eq('state', ufUpper)
      .eq('status', 'ACTIVE')
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    existing.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const missingIds = existing
    .filter((row) => !activeIds.has(String(row.source_property_id)))
    .map((row) => row.id);

  const nowIso = new Date().toISOString();
  for (let i = 0; i < missingIds.length; i += 200) {
    const chunk = missingIds.slice(i, i + 200);
    await supabase
      .from('properties')
      .update({ status: 'POSSIBLY_REMOVED', updated_at: nowIso })
      .in('id', chunk);
  }
  return missingIds.length;
}

async function reconcileCaixaUf(supabase, uf, activeIds) {
  if (!activeIds || activeIds.size === 0) return 0;
  const ufUpper = uf.toUpperCase();
  const existing = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('properties')
      .select('id, source_property_id')
      .eq('source', 'CAIXA')
      .eq('state', ufUpper)
      .eq('status', 'ACTIVE')
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    existing.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const missingIds = existing
    .filter((row) => !activeIds.has(String(row.source_property_id)))
    .map((row) => row.id);

  const nowIso = new Date().toISOString();
  for (let i = 0; i < missingIds.length; i += 200) {
    const chunk = missingIds.slice(i, i + 200);
    await supabase
      .from('properties')
      .update({ status: 'POSSIBLY_REMOVED', updated_at: nowIso })
      .in('id', chunk);
  }
  return missingIds.length;
}

// =====================================================================
// COLETORES REAIS POR FONTE
// =====================================================================
async function syncBradesco(supabase, uf) {
  const ufUpper = uf.toUpperCase();
  const headers = {
    ...BROWSER_HEADERS,
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://vitrinebradesco.com.br',
    Referer: 'https://vitrinebradesco.com.br/',
  };

  const todayIso = new Date().toISOString().split('T')[0];
  const rows = [];
  let page = 1;
  let totalPages = 1;
  let completedAll = true;

  while (page <= totalPages) {
    const url = `https://api.vitrinebradesco.com.br/v1/auctions?type=realstate&ufs=${encodeURIComponent(ufUpper)}&page=${page}`;
    let payload = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(url, { headers });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        payload = await resp.json();
        break;
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (!payload) {
      completedAll = false;
      break;
    }

    totalPages = Number(payload.total_pages || 1);
    const data = Array.isArray(payload.data) ? payload.data : [];

    for (const item of data) {
      const val1 = Number(item.min_auction_value_1 || 0);
      const val2 = Number(item.min_auction_value_2 || 0);
      const priceRaw = Number(item.price || 0);
      const finalVal = Number(item.final_auction_value || 0);

      const saleVal = val2 > 0 ? val2 : priceRaw > 0 ? priceRaw : val1 > 0 ? val1 : finalVal;
      const appraisalVal = val1 > 0 ? val1 : finalVal > 0 ? finalVal : saleVal;

      let discount = 0;
      if (saleVal > 0 && appraisalVal > saleVal) {
        discount = Math.round(((appraisalVal - saleVal) / appraisalVal) * 10000) / 100;
      }
      if (discount >= 100 || discount <= 0) discount = 0;

      const date1 = parseIsoDt(item.date_auction_1);
      const date2 = parseIsoDt(item.date_auction_2);
      const finalDate = parseIsoDt(item.final_date_auction);
      const rawMainDate = parseIsoDt(item.auction_date);
      const mainDate = chooseActiveAuctionDate(date1, date2, finalDate, rawMainDate);

      const descText = item.description || '';
      const images = Array.isArray(item.images) ? item.images : [];
      let brdCode = '';
      const mCod = descText.match(/c[oó]d(?:\.|igo)?(?:\s+do\s+im[oó]vel)?\s*:?\s*(\d{3,8})/i);
      if (mCod) brdCode = mCod[1];
      if (!brdCode) {
        for (const img of images) {
          if (typeof img === 'string') {
            const mImg = img.match(/\/([a-z0-9_-]+)\/(\d{4,8})\//i);
            if (mImg) {
              brdCode = mImg[2];
              break;
            }
          }
        }
      }
      if (!brdCode && item.slug) {
        const mSlug = String(item.slug).match(/-(\d{4,8})(?:_\d+)?$/);
        if (mSlug) brdCode = mSlug[1];
      }
      if (!brdCode && item.guid) {
        brdCode = String(item.guid).split('-')[0].toUpperCase();
      }

      const propId = `BRD-${brdCode || item.guid || 'IMOVEL'}`;
      const rawName = item.name || '';
      const parts = rawName.split(/\s*-\s*/);
      let realAddr = parts.length >= 3 ? parts.slice(2).join(' - ').trim() : '';
      const neigh = (item.neighborhood || '').trim();
      const city = (item.city || '').trim();
      const state = (item.state || ufUpper).trim().toUpperCase().slice(0, 2);

      if (!realAddr) {
        realAddr = [neigh, city, state].filter(Boolean).join(', ');
      } else if (neigh && !realAddr.toLowerCase().includes(neigh.toLowerCase())) {
        realAddr = `${realAddr}, ${neigh}`;
      }

      const canFinance = saleVal >= 100000;
      const maxInst = canFinance ? 360 : 1;
      const minDown = canFinance ? Math.round(saleVal * 0.2 * 100) / 100 : saleVal;
      const financed = Math.max(0, saleVal - minDown);
      const minInstVal = canFinance && financed > 0 ? Math.round((financed / maxInst + financed * 0.0088) * 100) / 100 : 0;
      const auctName = item.auctioneer && typeof item.auctioneer === 'object' ? item.auctioneer.name : 'Bradesco Leilões';
      const isAf = item.realstate_auction_type === 'alienacao-fiduciaria';

      const record = {
        source: 'BRADESCO',
        source_property_id: propId,
        title: rawName || `Imóvel Bradesco — ${city}/${state}`,
        state,
        city,
        neighborhood: neigh || null,
        address: realAddr,
        property_type: item.category || 'Imóvel',
        sale_value: saleVal > 0 ? saleVal : null,
        current_minimum_value: saleVal > 0 ? saleVal : null,
        appraisal_value: appraisalVal > 0 ? appraisalVal : null,
        first_auction_value: val1 > 0 ? val1 : null,
        second_auction_value: val2 > 0 ? val2 : null,
        discount_percentage: discount > 0 ? discount : null,
        calculated_discount_percentage: discount > 0 ? discount : null,
        accepts_financing: canFinance,
        occupancy_status: 'UNKNOWN',
        description: descText ? stripHtmlTags(descText).slice(0, 2000) : null,
        sale_modality: isAf ? 'Leilão Extrajudicial — Alienação Fiduciária' : 'Leilão Extrajudicial Bradesco',
        source_url: item.slug
          ? `https://vitrinebradesco.com.br/auctions/${item.slug}`
          : `https://vitrinebradesco.com.br/auctions?type=realstate&ufs=${state}`,
        total_area: null,
        private_area: null,
        land_area: null,
        bedrooms: null,
        parking_spaces: null,
        main_photo_url: images.length > 0 ? images[0] : null,
        first_auction_date: date1 || mainDate,
        second_auction_date: date2,
        auction_date: mainDate,
        auctioneer: auctName,
        payment_conditions: canFinance
          ? `À vista ou Financiamento Bradesco em até ${maxInst}x (entrada mín. 20%).`
          : 'Somente à vista (Bradesco financia a partir de R$ 100 mil).',
        max_installments: maxInst,
        min_down_payment: minDown,
        min_installment_value: minInstVal,
        status: 'ACTIVE',
        source_generated_at: todayIso,
        source_file_url: 'https://api.vitrinebradesco.com.br/v1/auctions',
        raw_list_data: item,
      };
      record.source_hash = computeHash(record);
      rows.push(record);
    }

    page++;
  }

  let written = 0;
  let removed = 0;
  if (rows.length > 0) {
    written = await batchUpsertSupabase(supabase, rows);
    if (completedAll) {
      removed = await reconcileByPrefixUf(supabase, 'BRD-', ufUpper, new Set(rows.map((r) => r.source_property_id)));
    }
  }

  return {
    ok: completedAll,
    bank: 'BRADESCO',
    uf: ufUpper,
    status: completedAll ? 'SUCCESS' : 'PARTIAL',
    fetched: rows.length,
    written,
    removed,
    sourceGeneratedAt: todayIso,
    message: `${written} imóveis Bradesco sincronizados em ${ufUpper} (${removed} removidos).`,
  };
}

async function syncCaixa(supabase, uf) {
  const ufUpper = uf.toUpperCase();
  const targetUrl = `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${ufUpper}.csv`;
  const t0 = Date.now();

  const resp = await fetch(targetUrl, {
    headers: { 'User-Agent': 'undici', Accept: '*/*' },
  });

  if (!resp.ok) {
    await supabase.from('caixa_imports').insert([
      {
        uf: ufUpper,
        filename: `Lista_imoveis_${ufUpper}.csv`,
        status: 'ERROR',
        total_rows: 0,
        valid_rows: 0,
        invalid_rows: 0,
        inserted: 0,
        updated: 0,
        possibly_removed: 0,
        execution_time_seconds: Number(((Date.now() - t0) / 1000).toFixed(2)),
      },
    ]);
    return {
      ok: false,
      bank: 'CAIXA',
      uf: ufUpper,
      status: 'ERROR',
      fetched: 0,
      written: 0,
      removed: 0,
      sourceGeneratedAt: null,
      message: `A CAIXA retornou HTTP ${resp.status} para ${ufUpper}.`,
    };
  }

  const buf = await resp.arrayBuffer();
  const text = new TextDecoder('windows-1252').decode(buf);
  const low = text.toLowerCase();

  if (low.includes('captcha') || low.includes('radware') || low.slice(0, 200).includes('<html')) {
    await supabase.from('caixa_imports').insert([
      {
        uf: ufUpper,
        filename: `Lista_imoveis_${ufUpper}.csv`,
        status: 'CAPTCHA_BLOCKED',
        total_rows: 0,
        valid_rows: 0,
        invalid_rows: 0,
        inserted: 0,
        updated: 0,
        possibly_removed: 0,
        execution_time_seconds: Number(((Date.now() - t0) / 1000).toFixed(2)),
      },
    ]);
    return {
      ok: false,
      bank: 'CAIXA',
      uf: ufUpper,
      status: 'CAPTCHA_BLOCKED',
      fetched: 0,
      written: 0,
      removed: 0,
      sourceGeneratedAt: null,
      message: `A CAIXA exigiu verificação CAPTCHA (Radware) para ${ufUpper} no servidor. Baixe o CSV oficial pelo navegador e importe manualmente.`,
    };
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  let genDate = null;
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const mDt = lines[i].match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (mDt && !genDate) genDate = `${mDt[3]}-${mDt[2]}-${mDt[1]}`;
    const lineLow = lines[i].toLowerCase();
    if (lineLow.includes('cidade') && (lineLow.includes('preço') || lineLow.includes('preco'))) {
      headerIdx = i;
      break;
    }
  }

  const headers = parseCsvLine(lines[headerIdx] || '', ';');
  const hLow = headers.map((h) => h.toLowerCase());
  const findCol = (terms, fallback) => {
    const idx = hLow.findIndex((h) => terms.some((t) => h.includes(t)));
    return idx !== -1 ? idx : fallback;
  };

  const iId = findCol(['imóvel', 'imovel'], 0);
  const iUf = findCol(['uf'], 1);
  const iCity = findCol(['cidade'], 2);
  const iNeigh = findCol(['bairro'], 3);
  const iAddr = findCol(['endereço', 'endereco'], 4);
  const iPrice = findCol(['preço', 'preco'], 5);
  const iEval = findCol(['avaliação', 'avaliacao'], 6);
  const iDisc = findCol(['desconto'], 7);
  const iFin = findCol(['financiamento'], 8);
  const iDesc = findCol(['descrição', 'descricao'], 9);
  const iMod = findCol(['modalidade'], 10);
  const iLink = findCol(['link'], 11);

  const rows = [];
  let invalid = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], ';');
    if (cols.length < 6) {
      invalid++;
      continue;
    }
    const rawLink = cols[iLink] || '';
    const mHdn = rawLink.match(/hdnimovel=(\d{8,16})/i);
    const rawIdDigits = String(cols[iId] || '').replace(/\D/g, '');
    const propId = mHdn ? mHdn[1] : rawIdDigits;
    if (!propId) {
      invalid++;
      continue;
    }

    const rowUf = (cols[iUf] || ufUpper).trim().toUpperCase().slice(0, 2);
    const city = (cols[iCity] || '').trim();
    const neigh = (cols[iNeigh] || '').trim();
    const addr = (cols[iAddr] || '').trim();
    const saleVal = parseBrNumber(cols[iPrice]);
    const evalVal = parseBrNumber(cols[iEval]);
    let discVal = parseBrNumber(cols[iDisc]);

    if (saleVal && evalVal && evalVal > saleVal && (!discVal || discVal <= 0)) {
      discVal = Math.round(((evalVal - saleVal) / evalVal) * 10000) / 100;
    }
    if (discVal !== null && (discVal >= 100 || discVal <= 0)) discVal = null;

    const finRaw = (cols[iFin] || '').trim().toLowerCase();
    const acceptsFin = finRaw.startsWith('s') ? true : finRaw.startsWith('n') ? false : null;
    const desc = (cols[iDesc] || '').trim();
    const modality = (cols[iMod] || '').trim() || 'Venda Direta Caixa';
    const parsedDesc = parseCaixaDescription(desc);
    const link =
      rawLink || `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${propId}`;

    const rawDict = {};
    headers.forEach((h, idx) => {
      rawDict[h] = cols[idx] || '';
    });

    const record = {
      source: 'CAIXA',
      source_property_id: propId,
      title: `${parsedDesc.property_type || 'Imóvel'} — ${neigh || city}/${rowUf}`,
      state: rowUf,
      city,
      neighborhood: neigh || null,
      address: addr || null,
      property_type: parsedDesc.property_type || 'Imóvel',
      sale_value: saleVal,
      current_minimum_value: saleVal,
      appraisal_value: evalVal,
      first_auction_value: null,
      second_auction_value: null,
      discount_percentage: discVal,
      calculated_discount_percentage: discVal,
      accepts_financing: acceptsFin,
      occupancy_status: 'UNKNOWN',
      description: desc || null,
      sale_modality: modality,
      source_url: link,
      total_area: parsedDesc.total_area,
      private_area: parsedDesc.private_area,
      land_area: parsedDesc.land_area,
      bedrooms: parsedDesc.bedrooms,
      parking_spaces: parsedDesc.parking_spaces,
      main_photo_url: `https://venda-imoveis.caixa.gov.br/fotos/F${propId}21.jpg`,
      first_auction_date: null,
      second_auction_date: null,
      auction_date: null,
      auctioneer: 'Caixa Econômica Federal',
      payment_conditions: null,
      max_installments: acceptsFin ? 360 : 1,
      min_down_payment: acceptsFin && saleVal ? Math.round(saleVal * 0.05 * 100) / 100 : saleVal,
      min_installment_value: null,
      status: 'ACTIVE',
      raw_list_data: rawDict,
      source_generated_at: genDate,
      source_file_url: targetUrl,
    };
    record.source_hash = computeHash(record);
    rows.push(record);
  }

  let written = 0;
  let removed = 0;
  const fileHash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);

  if (rows.length > 0) {
    written = await batchUpsertSupabase(supabase, rows);
    removed = await reconcileCaixaUf(supabase, ufUpper, new Set(rows.map((r) => r.source_property_id)));
  }

  await supabase.from('caixa_imports').insert([
    {
      uf: ufUpper,
      source_generated_at: genDate,
      source_file_hash: fileHash,
      filename: `Lista_imoveis_${ufUpper}.csv`,
      status: rows.length > 0 ? 'SUCCESS' : 'EMPTY',
      total_rows: rows.length + invalid,
      valid_rows: rows.length,
      invalid_rows: invalid,
      inserted: written,
      updated: 0,
      possibly_removed: removed,
      execution_time_seconds: Number(((Date.now() - t0) / 1000).toFixed(2)),
    },
  ]);

  return {
    ok: rows.length > 0,
    bank: 'CAIXA',
    uf: ufUpper,
    status: rows.length > 0 ? 'SUCCESS' : 'EMPTY',
    fetched: rows.length,
    written,
    removed,
    sourceGeneratedAt: genDate,
    message: `${written} imóveis CAIXA (${ufUpper}, base ${genDate || 'atual'}) sincronizados e ${removed} encerrados.`,
  };
}

async function syncMega(supabase, uf, maxPages = 12) {
  const ufUpper = uf.toUpperCase();
  const ufLower = ufUpper.toLowerCase();
  const todayIso = new Date().toISOString().split('T')[0];
  const rows = [];
  let page = 1;
  let totalPages = 1;
  let completedAll = true;

  while (page <= Math.min(totalPages, maxPages)) {
    const url = `https://www.megaleiloes.com.br/imoveis/${ufLower}?pagina=${page}`;
    let htmlText = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(url, {
          headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml' },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        htmlText = await resp.text();
        break;
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (!htmlText) {
      completedAll = false;
      break;
    }

    if (page === 1) {
      const mLast =
        htmlText.match(/pagina=(\d+)["']\s+rel=["']last["']/) ||
        htmlText.match(/rel=["']last["'][^>]+pagina=(\d+)/);
      if (mLast) totalPages = Math.max(1, Number(mLast[1]));
    }

    const blocks = htmlText.split(/<div[^>]+class="col-sm-6 col-md-4 col-lg-3"[^>]+data-key="(\d+)"[^>]*>/);
    for (let idx = 1; idx < blocks.length - 1; idx += 2) {
      const dataKey = blocks[idx];
      const card = blocks[idx + 1];

      const mTitle = card.match(/<a[^>]+class="card-title"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!mTitle) continue;
      const rawUrl = stripHtmlTags(mTitle[1]).split('?')[0];
      const title = stripHtmlTags(mTitle[2]);

      const mNum = card.match(/<div class="card-number[^"]*">([^<]+)<\/div>/);
      const cardNum = mNum ? stripHtmlTags(mNum[1]) : dataKey;
      const propId = `MEGA-${cardNum}`;

      const mImg = card.match(/data-bg="([^"]+)"/);
      const photoUrl = mImg ? mImg[1] : null;

      const mBank = card.match(/bank_icons\/leilao-banco-([^.]+)\.png/);
      const bankHint = mBank ? mBank[1] : '';

      const mMod = card.match(/<div class="card-instance-title">\s*<a[^>]*>([^<]+)<\/a>/);
      const modLabel = mMod ? stripHtmlTags(mMod[1]) : 'Extrajudicial';
      const isJudicial = modLabel.toLowerCase().includes('judicial') && !modLabel.toLowerCase().includes('extra');
      const source = classifySourceFromText(`${bankHint} ${title}`, isJudicial, 'MEGA');

      const mLoc = card.match(/<a class="card-locality"[^>]*>([^<]+)<\/a>/);
      const locStr = mLoc ? stripHtmlTags(mLoc[1]) : '';
      const city = locStr.includes(',') ? locStr.split(',')[0].trim() : locStr;
      const state = locStr.includes(',') ? locStr.split(',')[1].trim().toUpperCase().slice(0, 2) : ufUpper;

      const mDown = card.match(/<div class="card-down">[\s\S]*?<span class="value">(\d+(?:[.,]\d+)?)%<\/span>/);
      let discVal = mDown ? parseBrNumber(mDown[1]) : null;

      const mCardPrice = card.match(/<div class="card-price">([^<]+)<\/div>/);
      const cardPrice = mCardPrice ? parseBrNumber(mCardPrice[1]) : null;

      const instVals = Array.from(card.matchAll(/<span class="card-instance-value">([^<]+)<\/span>/g))
        .map((m) => parseBrNumber(m[1]))
        .filter((v) => v && v > 0);
      const firstVal = instVals[0] || cardPrice;
      const secondVal = instVals[1] || null;

      const mD1 = card.match(/<span class="card-first-instance-date">([\s\S]*?)<\/span>/);
      const mD2 = card.match(/<span class="card-second-instance-date">([\s\S]*?)<\/span>/);
      const d1Iso = mD1 ? parseBrDatetimeToIso(stripHtmlTags(mD1[1])) : null;
      const d2Iso = mD2 ? parseBrDatetimeToIso(stripHtmlTags(mD2[1])) : null;

      const saleVal = secondVal || firstVal || cardPrice;
      let appraisalVal = firstVal;
      if (saleVal && appraisalVal && appraisalVal <= saleVal && discVal && discVal > 0 && discVal < 99) {
        appraisalVal = Math.round((saleVal / (1 - discVal / 100)) * 100) / 100;
      } else if (saleVal && !appraisalVal && discVal && discVal > 0 && discVal < 99) {
        appraisalVal = Math.round((saleVal / (1 - discVal / 100)) * 100) / 100;
      }
      if (saleVal && appraisalVal && appraisalVal > saleVal && !discVal) {
        discVal = Math.round(((appraisalVal - saleVal) / appraisalVal) * 10000) / 100;
      }

      const mArea = title.match(/(\d+(?:[.,]\d+)?)\s*m²/i);
      const areaVal = mArea ? parseBrNumber(mArea[1]) : null;
      const mVagas = title.match(/(\d+)\s*vaga/i);
      const vagasVal = mVagas ? Number(mVagas[1]) : null;
      const modality = `Leilão ${modLabel} (Mega Leilões)`;

      const record = {
        source,
        source_property_id: propId,
        title,
        state,
        city,
        neighborhood: null,
        address: title,
        property_type: inferPropertyType(title),
        sale_value: saleVal,
        current_minimum_value: saleVal,
        appraisal_value: appraisalVal,
        first_auction_value: firstVal,
        second_auction_value: secondVal,
        discount_percentage: discVal && discVal > 0 && discVal < 100 ? discVal : null,
        calculated_discount_percentage: discVal && discVal > 0 && discVal < 100 ? discVal : null,
        accepts_financing: null,
        occupancy_status: 'UNKNOWN',
        description: `${title} — ${modality}. Comitente/Origem: ${bankHint || source}.`,
        sale_modality: modality,
        source_url: rawUrl,
        total_area: areaVal,
        private_area: areaVal,
        land_area: null,
        bedrooms: null,
        parking_spaces: vagasVal,
        main_photo_url: photoUrl,
        first_auction_date: d1Iso,
        second_auction_date: d2Iso,
        auction_date: chooseActiveAuctionDate(d1Iso, d2Iso),
        auctioneer: 'Mega Leilões',
        payment_conditions: null,
        max_installments: null,
        min_down_payment: null,
        min_installment_value: null,
        status: 'ACTIVE',
        source_generated_at: todayIso,
        source_file_url: url,
        raw_list_data: { auctioneer: 'Mega Leilões', bank_hint: bankHint, card_number: cardNum },
      };
      record.source_hash = computeHash(record);
      rows.push(record);
    }

    page++;
  }

  if (totalPages > maxPages) completedAll = false;

  let written = 0;
  let removed = 0;
  if (rows.length > 0) {
    written = await batchUpsertSupabase(supabase, rows);
    if (completedAll) {
      removed = await reconcileByPrefixUf(supabase, 'MEGA-', ufUpper, new Set(rows.map((r) => r.source_property_id)));
    }
  }

  const breakdownBySource = {};
  rows.forEach((r) => {
    breakdownBySource[r.source] = (breakdownBySource[r.source] || 0) + 1;
  });

  return {
    ok: completedAll,
    bank: 'MEGA',
    uf: ufUpper,
    status: completedAll ? 'SUCCESS' : 'PARTIAL',
    fetched: rows.length,
    written,
    removed,
    sourceGeneratedAt: todayIso,
    breakdownBySource,
    message: `${written} lotes Mega Leilões sincronizados em ${ufUpper} (${removed} removidos).`,
  };
}

function parseZukCardsJs(htmlText, ufUpper, sourceUrl, todayIso) {
  const blocks = htmlText.split('class="card-property card_lotes_div"');
  const items = [];

  for (let idx = 1; idx < blocks.length; idx++) {
    const card = blocks[idx];
    const mLink =
      card.match(/<a[^>]+href="(https:\/\/www\.portalzuk\.com\.br\/imovel\/[^"]+)"[^>]*title="([^"]*)"/) ||
      card.match(/<a[^>]+href="(https:\/\/www\.portalzuk\.com\.br\/imovel\/[^"]+)"/);
    if (!mLink) continue;

    const itemUrl = mLink[1].split('?')[0];
    const titleAttr = mLink[2] ? stripHtmlTags(mLink[2]) : '';

    const mId = itemUrl.match(/-(\d+)$/) || card.match(/id="(\d+)"/);
    const lotId = mId ? mId[1] : crypto.createHash('md5').update(itemUrl).digest('hex').slice(0, 10);
    const propId = `ZUK-${lotId}`;

    const mImg = card.match(/<img[^>]+src="(https:\/\/imagens\.portalzuk\.com\.br\/[^"]+)"/);
    const photoUrl = mImg ? mImg[1] : null;

    const mType = card.match(/<span class="card-property-price-lote">([^<]+)<\/span>/);
    const rawType = mType ? stripHtmlTags(mType[1]) : 'Imóvel';

    const mAddr = card.match(/<address class="card-property-address">([\s\S]*?)<\/address>/);
    let city = '';
    let state = ufUpper;
    let neigh = null;
    let street = null;
    if (mAddr) {
      const addrBlk = mAddr[1];
      const mCitySt = addrBlk.match(/<a[^>]*>([^<]+)<\/a>\s*(?:-\s*([^<]+))?<\/span>/);
      if (mCitySt) {
        const citySt = stripHtmlTags(mCitySt[1]);
        if (citySt.includes('/')) {
          city = citySt.split('/')[0].trim();
          state = citySt.split('/')[1].trim().toUpperCase().slice(0, 2);
        } else {
          city = citySt;
        }
        if (mCitySt[2]) neigh = stripHtmlTags(mCitySt[2]);
      }
      const spans = Array.from(addrBlk.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g));
      if (spans.length > 0) {
        const lastSpan = stripHtmlTags(spans[spans.length - 1][1]);
        if (lastSpan && !lastSpan.includes(city)) street = lastSpan;
      }
    }

    const mArea = card.match(/<span class="card-property-info-label">([^<]+)<\/span>/);
    let areaVal = null;
    if (mArea) {
      const mANum = mArea[1].match(/([\d.,]+)\s*m²/i);
      if (mANum) areaVal = parseBrNumber(mANum[1]);
    }

    const priceMatches = Array.from(
      card.matchAll(
        /<span class="card-property-price-value">R\$\s*([\d.,]+)(?:[\s\S]*?<span class="card-property-price-percent">[\s\S]*?(\d+)[\s\S]*?<\/span>)?/g
      )
    );
    const parsedPrices = priceMatches
      .map((m) => [parseBrNumber(m[1]), m[2] ? parseBrNumber(m[2]) : null])
      .filter(([p]) => p && p > 0);

    const firstVal = parsedPrices[0]?.[0] || null;
    const secondVal = parsedPrices[1]?.[0] || null;
    const saleVal = secondVal || firstVal;
    const discounts = parsedPrices.map(([, d]) => d).filter((d) => d && d > 0 && d < 100);
    const discVal = discounts.length > 0 ? discounts[discounts.length - 1] : null;

    let appraisalVal = firstVal;
    if (saleVal && appraisalVal && appraisalVal <= saleVal && discVal && discVal > 0 && discVal < 99) {
      appraisalVal = Math.round((saleVal / (1 - discVal / 100)) * 100) / 100;
    }

    const dateMatches = Array.from(card.matchAll(/<span class="card-property-price-data">([^<]+)/g));
    const d1Iso = dateMatches[0] ? parseBrDatetimeToIso(dateMatches[0][1]) : null;
    const d2Iso = dateMatches[1] ? parseBrDatetimeToIso(dateMatches[1][1]) : null;

    const isJudicial =
      `${titleAttr} ${itemUrl}`.toLowerCase().includes('judicial') &&
      !`${titleAttr} ${itemUrl}`.toLowerCase().includes('extrajudicial');
    const source = classifySourceFromText(titleAttr, isJudicial, 'ZUK');

    const cleanTitle = `${rawType} — ${street || neigh || city}, ${city}/${state}`.replace(/^[ —,]+|[ —,]+$/g, '');
    const comitentePart = titleAttr.includes('|')
      ? titleAttr.split('|')[0].replace(/em leilão -/i, '').trim()
      : titleAttr || 'Portal Zuk';

    const record = {
      source,
      source_property_id: propId,
      title: cleanTitle,
      state,
      city,
      neighborhood: neigh,
      address: street || neigh || `${city}/${state}`,
      property_type: inferPropertyType(rawType),
      sale_value: saleVal,
      current_minimum_value: saleVal,
      appraisal_value: appraisalVal,
      first_auction_value: firstVal,
      second_auction_value: secondVal,
      discount_percentage: discVal,
      calculated_discount_percentage: discVal,
      accepts_financing: null,
      occupancy_status: 'UNKNOWN',
      description: `${comitentePart} (Portal Zuk)`.trim(),
      sale_modality: isJudicial ? 'Leilão Judicial (Portal Zuk)' : 'Leilão Extrajudicial (Portal Zuk)',
      source_url: itemUrl,
      total_area: areaVal,
      private_area: areaVal,
      land_area: null,
      bedrooms: null,
      parking_spaces: null,
      main_photo_url: photoUrl,
      first_auction_date: d1Iso,
      second_auction_date: d2Iso,
      auction_date: chooseActiveAuctionDate(d1Iso, d2Iso),
      auctioneer: 'Portal Zuk',
      payment_conditions: null,
      max_installments: null,
      min_down_payment: null,
      min_installment_value: null,
      status: 'ACTIVE',
      source_generated_at: todayIso,
      source_file_url: sourceUrl,
      raw_list_data: { auctioneer: 'Portal Zuk', title_attr: titleAttr },
    };
    record.source_hash = computeHash(record);
    items.push(record);
  }
  return items;
}

async function syncZuk(supabase, uf, maxItems = 350) {
  const ufUpper = uf.toUpperCase();
  const url = `https://www.portalzuk.com.br/leilao-de-imoveis/u/todos-imoveis/${ufUpper.toLowerCase()}`;
  const todayIso = new Date().toISOString().split('T')[0];

  const resp = await fetch(url, {
    headers: { ...BROWSER_HEADERS, Accept: 'text/html,application/xhtml+xml' },
  });
  if (!resp.ok) {
    return {
      ok: false,
      bank: 'ZUK',
      uf: ufUpper,
      status: 'ERROR',
      fetched: 0,
      written: 0,
      removed: 0,
      sourceGeneratedAt: todayIso,
      message: `Portal Zuk retornou HTTP ${resp.status} para ${ufUpper}.`,
    };
  }

  const rawCookies = typeof resp.headers.getSetCookie === 'function' ? resp.headers.getSetCookie() : [];
  const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');
  const htmlText = await resp.text();

  const itemsById = new Map();
  const p1 = parseZukCardsJs(htmlText, ufUpper, url, todayIso);
  p1.forEach((it) => itemsById.set(it.source_property_id, it));

  const mClo = htmlText.match(/_clo\s*=\s*Number\(\s*["'](\d+)["']\s*\)/) || htmlText.match(/_clo\s*=\s*(\d+)/);
  const totalClo = mClo ? Number(mClo[1]) : p1.length;

  const mZukCnt = htmlText.match(/count_lotes_zuk\s*=\s*["']?(\d+)/);
  const countZuk = mZukCnt ? Number(mZukCnt[1]) : p1.length;

  const mTok =
    htmlText.match(/name="_token"\s+value="([^"]+)"/) ||
    htmlText.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/);
  const csrfToken = mTok ? mTok[1] : '';

  let completedAll = true;
  const targetLimit = totalClo > 0 ? Math.min(totalClo, maxItems) : p1.length;

  if (csrfToken && itemsById.size < targetLimit && p1.length > 0) {
    let loadedDomCount = p1.length;
    let parceiroDivCount = (htmlText.match(/id="list-items-parceiro-carregar-mais"/g) || []).length;

    for (let step = 0; step < 15; step++) {
      if (itemsById.size >= targetLimit) break;
      const formBody = new URLSearchParams({
        limit: String(loadedDomCount),
        count_imovel_zuk: String(countZuk),
        path: url,
        order: 'relevancia',
        div_parceiro_count: String(parceiroDivCount),
        _token: csrfToken,
      });

      try {
        const postResp = await fetch('https://www.portalzuk.com.br/leilao-de-imoveis/mais', {
          method: 'POST',
          headers: {
            ...BROWSER_HEADERS,
            Accept: '*/*',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            Origin: 'https://www.portalzuk.com.br',
            Referer: url,
            'X-Requested-With': 'XMLHttpRequest',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: formBody.toString(),
        });
        if (!postResp.ok) {
          completedAll = false;
          break;
        }
        const chunkHtml = await postResp.text();
        const newCards = parseZukCardsJs(chunkHtml, ufUpper, url, todayIso);
        if (newCards.length === 0) break;

        let addedNew = 0;
        for (const it of newCards) {
          if (!itemsById.has(it.source_property_id)) {
            itemsById.set(it.source_property_id, it);
            addedNew++;
          }
        }
        loadedDomCount += newCards.length;
        parceiroDivCount += (chunkHtml.match(/id="list-items-parceiro-carregar-mais"/g) || []).length;
        if (addedNew === 0) break;
      } catch {
        completedAll = false;
        break;
      }
    }
  }

  if (totalClo > maxItems && itemsById.size < totalClo) {
    completedAll = false;
  }

  const rows = Array.from(itemsById.values());
  let written = 0;
  let removed = 0;
  if (rows.length > 0) {
    written = await batchUpsertSupabase(supabase, rows);
    if (completedAll) {
      removed = await reconcileByPrefixUf(supabase, 'ZUK-', ufUpper, new Set(rows.map((r) => r.source_property_id)));
    }
  }

  const breakdownBySource = {};
  rows.forEach((r) => {
    breakdownBySource[r.source] = (breakdownBySource[r.source] || 0) + 1;
  });

  return {
    ok: completedAll,
    bank: 'ZUK',
    uf: ufUpper,
    status: completedAll ? 'SUCCESS' : 'PARTIAL',
    fetched: rows.length,
    written,
    removed,
    sourceGeneratedAt: todayIso,
    breakdownBySource,
    message: `${written} lotes Portal Zuk sincronizados em ${ufUpper} (${removed} removidos).`,
  };
}

async function runCleanup(supabase, uf) {
  const ufUpper = uf && uf !== 'ALL' ? uf.toUpperCase() : null;
  const activeRows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    let q = supabase
      .from('properties')
      .select(
        'id, source, source_property_id, state, city, current_minimum_value, appraisal_value, private_area, total_area, parking_spaces, first_auction_date, second_auction_date, auction_date'
      )
      .eq('status', 'ACTIVE')
      .neq('source', 'CAIXA');
    if (ufUpper) q = q.eq('state', ufUpper);
    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    activeRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // 1. Expiração de leilões vencidos (> 2 dias)
  const cutoffMs = Date.now() - 2 * 86400 * 1000;
  const expiredIds = [];
  const remaining = [];

  for (const r of activeRows) {
    const dates = [r.first_auction_date, r.second_auction_date, r.auction_date]
      .filter(Boolean)
      .map((d) => new Date(d).getTime())
      .filter((ms) => !Number.isNaN(ms));
    if (dates.length > 0 && Math.max(...dates) < cutoffMs) {
      expiredIds.push(r.id);
    } else {
      remaining.push(r);
    }
  }

  const nowIso = new Date().toISOString();
  for (let i = 0; i < expiredIds.length; i += 200) {
    await supabase
      .from('properties')
      .update({ status: 'POSSIBLY_REMOVED', updated_at: nowIso })
      .in('id', expiredIds.slice(i, i + 200));
  }

  // 2. Deduplicação cruzada (BRD > ZUK > MEGA)
  const priority = (spid) => {
    const s = String(spid || '');
    if (s.startsWith('BRD-')) return 0;
    if (s.startsWith('ZUK-')) return 1;
    if (s.startsWith('MEGA-')) return 2;
    return 3;
  };
  const kind = (spid) => {
    const s = String(spid || '');
    if (s.startsWith('BRD-')) return 'BRD';
    if (s.startsWith('ZUK-')) return 'ZUK';
    if (s.startsWith('MEGA-')) return 'MEGA';
    return 'OTHER';
  };

  const groups = new Map();
  for (const r of remaining) {
    if (!r.current_minimum_value || r.current_minimum_value <= 0 || !r.appraisal_value || r.appraisal_value <= 0) {
      continue;
    }
    const key = [
      String(r.source || '').toUpperCase(),
      String(r.state || '').toUpperCase(),
      stripAccentsLower(r.city),
      Math.round(Number(r.current_minimum_value) / 10),
      Math.round(Number(r.appraisal_value) / 10),
    ].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const dupIds = [];
  for (const items of groups.values()) {
    if (items.length <= 1) continue;
    const kinds = new Set(items.map((it) => kind(it.source_property_id)));
    if (kinds.size <= 1) continue;
    items.sort((a, b) => priority(a.source_property_id) - priority(b.source_property_id));
    for (let i = 1; i < items.length; i++) {
      dupIds.push(items[i].id);
    }
  }

  for (let i = 0; i < dupIds.length; i += 200) {
    await supabase
      .from('properties')
      .update({ status: 'DUPLICATE', updated_at: nowIso })
      .in('id', dupIds.slice(i, i + 200));
  }

  return {
    ok: true,
    bank: 'CLEANUP',
    uf: ufUpper || 'ALL',
    status: 'SUCCESS',
    fetched: activeRows.length,
    written: 0,
    removed: expiredIds.length + dupIds.length,
    sourceGeneratedAt: null,
    message: `Limpeza concluída (${expiredIds.length} vencidos encerrados, ${dupIds.length} duplicados removidos).`,
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error: 'SUPABASE_NOT_CONFIGURED',
      message: 'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas no ambiente.',
    });
  }

  const host = req.headers?.host || 'localhost';
  const urlObj = new URL(req.url || '/', `http://${host}`);

  let bodyData = {};
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    bodyData = req.body;
  }

  const bank = String(urlObj.searchParams.get('bank') || bodyData.bank || '').trim().toLowerCase();
  const uf = String(urlObj.searchParams.get('uf') || bodyData.uf || 'SP').trim().toUpperCase().slice(0, 3);

  const t0 = Date.now();

  try {
    let result;
    if (bank === 'bradesco') {
      result = await syncBradesco(supabase, uf);
    } else if (bank === 'caixa') {
      result = await syncCaixa(supabase, uf);
    } else if (bank === 'mega') {
      result = await syncMega(supabase, uf);
    } else if (bank === 'zuk') {
      result = await syncZuk(supabase, uf);
    } else if (bank === 'cleanup') {
      result = await runCleanup(supabase, uf);
    } else {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_BANK',
        message: 'Informe ?bank=bradesco|caixa|mega|zuk|cleanup e ?uf=SP',
      });
    }

    return res.status(200).json({
      ...result,
      elapsedMs: Date.now() - t0,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      bank: bank.toUpperCase(),
      uf,
      status: 'ERROR',
      elapsedMs: Date.now() - t0,
      message: err?.message || 'Erro interno ao sincronizar banco.',
    });
  }
}
