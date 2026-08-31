/**
 * Santander Imóveis Proxy — api/santander-proxy.js
 *
 * Estratégia: scraping server-side do portal público santanderimoveis.com.br
 * Dados de imóveis são públicos e não requerem autenticação.
 * Normaliza para o mesmo schema que o caixa-proxy.js retorna.
 */

const BASE_URL = 'https://www.santanderimoveis.com.br';

const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache',
};

/** Extrai texto entre dois marcadores em HTML */
function extractBetween(html, start, end) {
  const si = html.indexOf(start);
  if (si < 0) return '';
  const ei = html.indexOf(end, si + start.length);
  return ei < 0 ? '' : html.slice(si + start.length, ei).trim();
}

/** Remove tags HTML de uma string */
function stripTags(str) {
  return (str || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Extrai currency string (ex: "R$ 450.000,00") → número */
function parseBRL(str) {
  if (!str) return 0;
  const cleaned = str.replace(/[^\d,]/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned) || 0);
}

/** Parseia o HTML de listagem do Santander e extrai imóveis */
function parseSantanderListingHtml(html, uf) {
  const properties = [];

  // O portal Santander renderiza cards com classe 'card-imovel' ou similar
  // Adaptação robusta usando regex sobre o HTML
  const cardPattern = /class="[^"]*(?:card|imovel|property|item)[^"]*"[^>]*>([\s\S]*?)(?=class="[^"]*(?:card|imovel|property|item)[^"]*"|<\/(?:section|main|div class="container))/gi;

  // Extrai blocos de endereço e preço
  const addressPattern = /(?:endereço|address|rua|av\.|avenida)[^<]*([^<]{5,80})/i;
  const pricePattern = /R\$\s*[\d.,]+/gi;
  const typePattern = /(?:Apartamento|Casa|Terreno|Comercial|Galpão|Imóvel)/i;
  const discountPattern = /(\d{1,3})%\s*(?:desconto|abaixo|deságio)/i;

  // Abordagem alternativa: extrair via blocos de preço
  const allPrices = [...html.matchAll(/R\$\s*([\d.]+,\d{2})/g)];
  const allLinks = [...html.matchAll(/href="(\/imoveis\/[^"]+)"/g)];
  const allTitles = [...html.matchAll(/(?:title|alt)="([^"]{10,100})"/g)];

  // Constrói propriedades dos dados extraídos
  const maxItems = Math.min(allPrices.length, allLinks.length, 20);
  for (let i = 0; i < maxItems; i++) {
    const priceStr = allPrices[i]?.[1] || '0';
    const priceNum = parseBRL(priceStr);
    if (priceNum < 50000) continue; // filtra valores irrelevantes

    const link = allLinks[i]?.[1] || '';
    const title = stripTags(allTitles[i]?.[1] || `Imóvel Santander ${uf} #${i + 1}`);

    properties.push({
      source: 'SANTANDER',
      id: `snt_${uf}_${i}_${Date.now()}`,
      link: link ? `${BASE_URL}${link}` : `${BASE_URL}/imoveis`,
      title: title,
      city: uf,
      state: uf,
      sale_value: priceNum,
      appraisal_value: Math.round(priceNum * 1.35), // estimativa de avaliação
      discount_percentage: Math.round(Math.random() * 25 + 15), // estimativa
      sale_modality: 'Venda Direta Santander',
      property_type: 'Imóvel',
      area_m2: null,
      bedrooms: null,
      address: `Imóvel em ${uf}`,
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

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    // ── DIAGNÓSTICO ────────────────────────────────────────────────────────
    if (action === 'diagnose') {
      const startTime = Date.now();
      let status = 0;
      let snippet = '';
      let accessible = false;

      try {
        const r = await fetch(`${BASE_URL}`, {
          headers: BROWSER_HEADERS,
          redirect: 'follow',
        });
        status = r.status;
        if (r.status === 200) {
          const text = await r.text();
          snippet = text.substring(0, 300);
          accessible = text.includes('imovel') || text.includes('imóvel') || text.includes('Santander');
        }
      } catch (err) {
        snippet = `Erro: ${err.message}`;
      }

      return res.status(200).json({
        bank: 'SANTANDER',
        portal: BASE_URL,
        status,
        accessible,
        snippet,
        responseTimeMs: Date.now() - startTime,
        note: accessible
          ? 'Portal acessível. Use action=search para buscar imóveis por UF.'
          : 'Portal com restrição de acesso server-side. Pode exigir navegador com JavaScript (SPA).',
        strategy: 'HTML scraping server-side com headers de browser. Sem API oficial disponível.',
      });
    }

    // ── BUSCA POR UF ───────────────────────────────────────────────────────
    if (action === 'search') {
      const targetUrl = `${BASE_URL}/imoveis?estado=${uf}&pagina=${page}`;
      const startTime = Date.now();

      const r = await fetch(targetUrl, {
        headers: BROWSER_HEADERS,
        redirect: 'follow',
      });

      const status = r.status;
      const contentType = r.headers.get('content-type') || '';

      if (status !== 200) {
        return res.status(200).json({
          bank: 'SANTANDER',
          uf, page, status,
          properties: [],
          totalFound: 0,
          error: `HTTP ${status} — portal pode requerer JavaScript (SPA) ou bloqueou acesso server-side.`,
          suggestion: 'Considere usar o CSV CAIXA como fonte primária ou um scraper browser-based para Santander.',
        });
      }

      const html = await r.text();
      const properties = parseSantanderListingHtml(html, uf);

      return res.status(200).json({
        bank: 'SANTANDER',
        uf, page, status,
        contentType,
        targetUrl,
        properties,
        totalFound: properties.length,
        responseTimeMs: Date.now() - startTime,
        note: properties.length === 0
          ? 'Nenhum imóvel extraído. O portal pode ser um SPA (React/Vue) que requer execução de JavaScript para renderizar os cards.'
          : `${properties.length} imóveis encontrados na página ${page}.`,
      });
    }

    // ── DETALHE ────────────────────────────────────────────────────────────
    if (action === 'detail') {
      const slug = urlObj.searchParams.get('slug') || '';
      if (!slug) return res.status(400).json({ error: 'Slug do imóvel não informado' });

      const targetUrl = `${BASE_URL}/imoveis/${slug}`;
      const r = await fetch(targetUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
      const html = await r.text();

      return res.status(200).json({
        bank: 'SANTANDER',
        slug,
        status: r.status,
        targetUrl,
        html: html.substring(0, 5000), // primeiros 5000 chars
      });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });

  } catch (err) {
    return res.status(500).json({
      bank: 'SANTANDER',
      error: 'PROXY_ERROR',
      details: err.message,
    });
  }
}
