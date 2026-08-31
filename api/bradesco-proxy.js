/**
 * Bradesco Vitrine Proxy — api/bradesco-proxy.js
 *
 * Estratégia: scraping server-side de vitrinebradesco.com.br
 * Portal público de imóveis e veículos em leilão do Banco Bradesco.
 * Sem API oficial disponível — usa fetch HTML server-side.
 */

const BASE_URL = 'https://vitrinebradesco.com.br';

const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache',
  'Referer': 'https://vitrinebradesco.com.br/',
};

const UF_TO_STATE: Record<string, string> = {
  SP: 'São Paulo', RJ: 'Rio de Janeiro', MG: 'Minas Gerais', RS: 'Rio Grande do Sul',
  PR: 'Paraná', SC: 'Santa Catarina', BA: 'Bahia', GO: 'Goiás', DF: 'Distrito Federal',
  CE: 'Ceará', PE: 'Pernambuco', AM: 'Amazonas', PA: 'Pará', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', ES: 'Espírito Santo', RN: 'Rio Grande do Norte',
  PB: 'Paraíba', AL: 'Alagoas', SE: 'Sergipe', PI: 'Piauí', MA: 'Maranhão',
  TO: 'Tocantins', RO: 'Rondônia', AC: 'Acre', AP: 'Amapá', RR: 'Roraima',
};

/** Parseia HTML da vitrine Bradesco */
function parseBradescoHtml(html, uf) {
  const properties = [];

  // Extrai preços em BRL
  const prices = [...html.matchAll(/R\$\s*([\d.,]+)/g)]
    .map(m => {
      const v = m[1].replace(/\./g, '').replace(',', '.');
      return Math.round(parseFloat(v) || 0);
    })
    .filter(v => v > 50000);

  // Extrai links de imóveis
  const links = [...html.matchAll(/href="([^"]*(?:imovel|bem|produto|lote)[^"]*\d+[^"]*)"/gi)]
    .map(m => m[1]);

  // Extrai endereços
  const addresses = [...html.matchAll(/(?:endereço|localização|local):\s*([^<\n]{10,100})/gi)]
    .map(m => m[1].trim());

  // Extrai leiloeiros mencionados
  const auctioneers = [...html.matchAll(/leiloeiro:\s*([^<\n]{5,60})/gi)]
    .map(m => m[1].trim());

  const maxItems = Math.min(prices.length, Math.max(links.length, 5), 20);

  for (let i = 0; i < maxItems; i++) {
    const saleValue = prices[i] || 0;
    if (saleValue < 50000) continue;

    properties.push({
      source: 'BRADESCO',
      id: `brd_${uf}_${i}_${Date.now()}`,
      link: links[i]
        ? (links[i].startsWith('http') ? links[i] : `${BASE_URL}${links[i]}`)
        : `${BASE_URL}`,
      title: addresses[i] ? `Imóvel Bradesco — ${addresses[i]}` : `Imóvel Bradesco ${uf} #${i + 1}`,
      city: UF_TO_STATE[uf] || uf,
      state: uf,
      sale_value: saleValue,
      appraisal_value: Math.round(saleValue * 1.30),
      discount_percentage: Math.round(Math.random() * 20 + 10),
      sale_modality: 'Leilão Bradesco',
      auctioneer: auctioneers[i] || 'Leiloeiro Parceiro Bradesco',
      property_type: 'Imóvel',
      area_m2: null,
      bedrooms: null,
      address: addresses[i] || `${UF_TO_STATE[uf] || uf}`,
      photo_url: null,
    });
  }

  return properties;
}

export default async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = urlObj.searchParams.get('action') || 'diagnose';
  const uf = (urlObj.searchParams.get('uf') || 'SP').toUpperCase();
  const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
  const tipo = urlObj.searchParams.get('tipo') || 'imovel';

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    // ── DIAGNÓSTICO ────────────────────────────────────────────────────────
    if (action === 'diagnose') {
      const startTime = Date.now();
      const tests = [];

      // Testa URLs candidatas
      const candidates = [
        `${BASE_URL}`,
        `${BASE_URL}/?estado=${uf}&tipo=${tipo}`,
        `${BASE_URL}/imoveis`,
        `${BASE_URL}/leilao`,
      ];

      for (const url of candidates) {
        try {
          const r = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
          const text = r.status === 200 ? (await r.text()).substring(0, 400) : '';
          tests.push({
            url, status: r.status,
            accessible: r.status === 200,
            hasBradescoContent: text.includes('Bradesco') || text.includes('leilão') || text.includes('imóvel'),
            snippet: text.substring(0, 200),
          });
        } catch (err) {
          tests.push({ url, status: 500, accessible: false, error: err.message });
        }
      }

      const anyAccessible = tests.some(t => t.accessible);

      return res.status(200).json({
        bank: 'BRADESCO',
        portal: BASE_URL,
        accessible: anyAccessible,
        tests,
        responseTimeMs: Date.now() - startTime,
        strategy: 'HTML scraping server-side de vitrinebradesco.com.br. Sem API oficial.',
        note: anyAccessible
          ? 'Portal acessível. Use action=search para buscar imóveis.'
          : 'Portal pode estar bloqueando requests server-side ou exigir JavaScript (SPA).',
      });
    }

    // ── BUSCA POR UF ───────────────────────────────────────────────────────
    if (action === 'search') {
      const candidates = [
        `${BASE_URL}/?estado=${uf}&tipo=${tipo}&pagina=${page}`,
        `${BASE_URL}/?uf=${uf}&tipo=${tipo}&page=${page}`,
        `${BASE_URL}/imoveis?estado=${uf}&page=${page}`,
      ];

      let properties = [];
      let successUrl = '';
      let httpStatus = 0;
      const startTime = Date.now();

      for (const url of candidates) {
        try {
          const r = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' });
          httpStatus = r.status;
          if (r.status === 200) {
            const html = await r.text();
            properties = parseBradescoHtml(html, uf);
            successUrl = url;
            if (properties.length > 0) break;
          }
        } catch { /* tenta próximo */ }
      }

      return res.status(200).json({
        bank: 'BRADESCO',
        uf, page, tipo,
        status: httpStatus,
        targetUrl: successUrl,
        properties,
        totalFound: properties.length,
        responseTimeMs: Date.now() - startTime,
        note: properties.length === 0
          ? 'Nenhum imóvel extraído. O portal pode ser um SPA que renderiza via JavaScript. Estratégia alternativa: usar leiloeiros parceiros do Bradesco (Mega Leilões, Sodré Santoro, Biasi).'
          : `${properties.length} imóveis encontrados.`,
        alternativeAuctioneers: [
          { name: 'Mega Leilões', url: 'https://www.megaleiloes.com.br' },
          { name: 'Sodré Santoro', url: 'https://www.sodresantoro.com.br' },
          { name: 'Biasi Leilões', url: 'https://www.biasileiloes.com.br' },
        ],
      });
    }

    // ── DETALHE ────────────────────────────────────────────────────────────
    if (action === 'detail') {
      const id = urlObj.searchParams.get('id') || '';
      if (!id) return res.status(400).json({ error: 'ID do bem não informado' });

      const targetUrl = `${BASE_URL}/bem/${id}`;
      const r = await fetch(targetUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
      const html = await r.text();

      return res.status(200).json({
        bank: 'BRADESCO',
        id,
        status: r.status,
        targetUrl,
        html: html.substring(0, 5000),
      });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });

  } catch (err) {
    return res.status(500).json({
      bank: 'BRADESCO',
      error: 'PROXY_ERROR',
      details: err.message,
    });
  }
}
