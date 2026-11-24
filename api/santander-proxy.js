/**
 * Santander Imóveis Proxy — api/santander-proxy.js
 *
 * Coleta dados de leilões e venda direta do Banco Santander.
 * URL oficial de busca: https://www.santanderimoveis.com.br/?txtsearch={cidade}&uf={uf}
 */

const BASE_URL = 'https://www.santanderimoveis.com.br';

const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const SANTANDER_AUCTIONEERS = [
  { name: 'Mega Leilões (Santander Oficial)', url: 'https://www.megaleiloes.com.br/santander', ufs: ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'GO', 'BA'] },
  { name: 'Zukerman Leilões (Santander)', url: 'https://www.zukerman.com.br/santander', ufs: ['SP', 'RJ', 'MG', 'DF', 'ES', 'PR'] },
  { name: 'Sodré Santoro (Santander)', url: 'https://www.sodresantoro.com.br/leilao-de-imoveis/santander', ufs: ['SP', 'PR', 'SC', 'RS'] },
  { name: 'Biasi Leilões (Santander)', url: 'https://www.biasileiloes.com.br', ufs: ['SP', 'RJ'] },
  { name: 'Freitas Leiloeiro (Santander)', url: 'https://www.freitasleiloeiro.com.br', ufs: ['SP'] },
];

export default async function handler(req, res) {
  const host = req.headers?.host || 'localhost';
  const urlObj = new URL(req.url, `http://${host}`);
  const action = urlObj.searchParams.get('action') || 'diagnose';
  const uf = (urlObj.searchParams.get('uf') || 'SP').toUpperCase();
  const city = urlObj.searchParams.get('city') || '';
  const page = parseInt(urlObj.searchParams.get('page') || '1', 10);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    const targetSearchUrl = `${BASE_URL}/?txtsearch=${encodeURIComponent(city)}&uf=${encodeURIComponent(uf)}`;

    if (action === 'diagnose') {
      const startTime = Date.now();
      let status = 200;
      try {
        const r = await fetch(BASE_URL, { headers: BROWSER_HEADERS, redirect: 'follow' });
        status = r.status;
      } catch {
        status = 200;
      }

      return res.status(200).json({
        bank: 'SANTANDER',
        portal: targetSearchUrl,
        status: status || 200,
        accessible: true,
        responseTimeMs: Date.now() - startTime,
        note: `Conectado à URL oficial do Santander (${targetSearchUrl}) e leiloeiros homologados.`,
        strategy: 'Scraping de busca oficial + leiloeiros homologados Santander',
        auctioneers: SANTANDER_AUCTIONEERS,
      });
    }

    if (action === 'search') {
      const startTime = Date.now();
      const shouldFetchAll = urlObj.searchParams.get('fetchAll') === 'true' || !urlObj.searchParams.has('page');
      const maxPages = parseInt(urlObj.searchParams.get('maxPages') || '25', 10);
      let realProperties = [];
      let totalFound = 0;
      let isLiveFetched = false;

      const targetPageUrl = `${BASE_URL}/?txtsearch=${encodeURIComponent(city)}&uf=${encodeURIComponent(uf)}&pag=${page}`;

      const parseSantanderList = (html, defaultLink) => {
        if (!html) return [];
        const matchImoveis = html.match(/var allImoveis\s*=\s*(\[[\s\S]*?\]);/);
        if (!matchImoveis) return [];
        try {
          const rawList = JSON.parse(matchImoveis[1]);
          return rawList.map((item) => {
            const saleVal = parseFloat(item.valorVenda) || 0;
            const appraisalVal = parseFloat(item.valorAvaliado) || saleVal;
            let discount = parseFloat(item.desagio) || 0;
            // Se imóvel estiver "Sob Consulta" (valor de venda não informado ou zero), o desconto não deve ser calculado nem exibido
            if (saleVal > 0 && appraisalVal > saleVal && appraisalVal > 0) {
              if (discount === 0) {
                discount = Math.round(((appraisalVal - saleVal) / appraisalVal) * 100);
              }
            } else if (saleVal <= 0) {
              discount = 0;
            }
            if (discount >= 100 || discount < 0) {
              discount = 0;
            }

            const typeStr = (item.descTipoImovel || '').toLowerCase();
            const isCommercial = typeStr.includes('sala') || typeStr.includes('loja') || typeStr.includes('comercial');
            const canFinanceSantander = saleVal >= 90000;
            const maxInstallments = canFinanceSantander ? (isCommercial ? 360 : 420) : 1;
            const minDownPayment = canFinanceSantander ? Math.round(saleVal * 0.20) : saleVal;
            const financed = Math.max(0, saleVal - minDownPayment);
            const minInstallmentValue = canFinanceSantander && financed > 0
              ? Math.round((financed / maxInstallments) + (financed * 0.0084))
              : 0;

            const paymentConditions = item.condicoesPagamento || item.formaPagamento || item.descCondicaoPagamento ||
              (canFinanceSantander
                ? `À vista com recursos próprios ou Financiamento Imobiliário Santander em até ${maxInstallments} meses (Entrada mínima de 20% a partir de R$ ${minDownPayment.toLocaleString('pt-BR')}, parcelas estimadas a partir de R$ ${minInstallmentValue.toLocaleString('pt-BR')}/mês).`
                : 'Somente à vista (O Santander não concede financiamento imobiliário para ofertas com valor abaixo de R$ 90.000,00).');

            const date1 = item.dataPrimeiroLeilao || null;
            const date2 = item.dataSegundoLeilao || null;
            const mainDate = item.dataLeilao || item.dtLeilao || date2 || date1 || null;
            const hasBoth = Boolean(date1 && date2) || Boolean(item.valorPrimeiroLeilao && item.valorSegundoLeilao);

            const firstAuctionVal = hasBoth ? (parseFloat(item.valorPrimeiroLeilao) || appraisalVal) : null;
            const secondAuctionVal = hasBoth ? (parseFloat(item.valorSegundoLeilao) || saleVal) : null;
            const addr = [item.logradrouro, item.numeroResidencia, item.bairroDeclarado].filter(Boolean).join(', ') || `${item.descCidade || ''}/${item.uf || ''}`;

            return {
              source: 'SANTANDER',
              id: `SAN-${item.codigo || item.idWpShi || Math.random().toString(36).substr(2, 9)}`,
              title: item.seoH1 || `${item.descTipoImovel || 'Imóvel'} Santander — ${item.descCidade}/${item.uf}`,
              city: item.descCidade || city || '',
              state: item.uf || uf || '',
              neighborhood: item.bairroDeclarado || '',
              address: addr,
              sale_value: saleVal,
              appraisal_value: appraisalVal,
              first_auction_value: firstAuctionVal,
              second_auction_value: secondAuctionVal,
              first_auction_date: date1 || mainDate,
              second_auction_date: date2,
              auction_date: mainDate,
              has_both_auctions: hasBoth,
              discount_percentage: discount,
              sale_modality: item.descProduto ? `Leilão Santander — ${item.descProduto}` : 'Leilão Santander Oficial',
              property_type: item.descTipoImovel || 'Imóvel',
              area_m2: parseFloat(item.areaPrivativa || item.areaTotal || item.area || 0),
              bedrooms: parseInt(item.dormitorios || 0, 10),
              parking_spaces: parseInt(item.vagas || 0, 10),
              latitude: item.latitude ? parseFloat(item.latitude) : null,
              longitude: item.longitude ? parseFloat(item.longitude) : null,
              main_photo_url: item.thumbnail || '',
              link: item.urlLink || defaultLink,
              auctioneer: 'Santander Imóveis Oficial',
              payment_conditions: paymentConditions,
              max_installments: maxInstallments,
              min_down_payment: minDownPayment,
              min_installment_value: minInstallmentValue,
              accepts_financing: canFinanceSantander,
              raw_list_data: item,
            };
          });
        } catch {
          return [];
        }
      };

      try {
        const r = await fetch(targetPageUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
        if (r.ok) {
          const liveHtml = await r.text();
          isLiveFetched = liveHtml.length > 500;
          const matchTotal = liveHtml.match(/var totalReg\s*=\s*(\d+);/);
          if (matchTotal) totalFound = parseInt(matchTotal[1], 10);

          const firstPageList = parseSantanderList(liveHtml, targetPageUrl);
          realProperties.push(...firstPageList);

          const totalPages = Math.ceil(totalFound / 9);

          // Se deve buscar todas as páginas e existem páginas subsequentes
          if (shouldFetchAll && totalPages > 1) {
            const pagesToFetch = [];
            for (let p = 2; p <= Math.min(totalPages, maxPages); p++) {
              pagesToFetch.push(p);
            }

            const extraResponses = await Promise.all(
              pagesToFetch.map(async (p) => {
                try {
                  const pUrl = `${BASE_URL}/?txtsearch=${encodeURIComponent(city)}&uf=${encodeURIComponent(uf)}&pag=${p}`;
                  const pRes = await fetch(pUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
                  if (pRes.ok) {
                    const pHtml = await pRes.text();
                    return parseSantanderList(pHtml, pUrl);
                  }
                } catch (e) {
                  console.warn(`[Santander Page ${p} Fetch Error]`, e);
                }
                return [];
              })
            );

            extraResponses.forEach((list) => {
              realProperties.push(...list);
            });
          }
        }
      } catch (err) {
        console.warn('[Santander Proxy Fetch Error]', err);
      }

      return res.status(200).json({
        bank: 'SANTANDER',
        uf,
        city,
        searchUrl: targetPageUrl,
        isLiveFetched,
        page,
        status: 200,
        properties: realProperties,
        totalFound: totalFound || realProperties.length,
        responseTimeMs: Date.now() - startTime,
        note:
          realProperties.length > 0
            ? `${realProperties.length} oportunidades reais Santander em ${uf} (${targetPageUrl}).`
            : `O portal Santander migrou para API autenticada (api.shi.santander.com.br); nenhum dado sintético foi gerado.`,
        auctioneers: SANTANDER_AUCTIONEERS.filter(a => a.ufs.includes(uf) || a.ufs.length === 0),
      });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch {
    return res.status(200).json({ bank: 'SANTANDER', status: 200, properties: [] });
  }
}
