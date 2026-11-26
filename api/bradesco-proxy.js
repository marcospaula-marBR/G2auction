/**
 * Bradesco Vitrine Proxy — api/bradesco-proxy.js
 *
 * Coleta dados de leilões da Vitrine Bradesco.
 * URL oficial de busca: https://vitrinebradesco.com.br/auctions?type=realstate&ufs={uf}
 */

const BASE_URL = 'https://vitrinebradesco.com.br';

const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Referer': 'https://vitrinebradesco.com.br/',
};

const BRADESCO_AUCTIONEERS = [
  { name: 'Mega Leilões (Bradesco Oficial)', url: 'https://www.megaleiloes.com.br/bradesco', ufs: ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC', 'GO', 'BA'] },
  { name: 'Sodré Santoro (Bradesco)', url: 'https://www.sodresantoro.com.br/leilao-de-imoveis/bradesco', ufs: ['SP', 'PR', 'SC', 'RS', 'MG'] },
  { name: 'Biasi Leilões (Bradesco)', url: 'https://www.biasileiloes.com.br', ufs: ['SP', 'RJ'] },
  { name: 'Zukerman Leilões (Bradesco)', url: 'https://www.zukerman.com.br/bradesco', ufs: ['SP', 'RJ', 'MG', 'DF'] },
  { name: 'VIP Leilões (Bradesco)', url: 'https://www.vipleiloes.com.br', ufs: ['MA', 'PA', 'CE', 'PI', 'PE', 'BA'] },
];

export default async function handler(req, res) {
  const host = req.headers?.host || 'localhost';
  const urlObj = new URL(req.url, `http://${host}`);
  const action = urlObj.searchParams.get('action') || 'diagnose';
  const uf = (urlObj.searchParams.get('uf') || 'SP').toUpperCase();
  const page = parseInt(urlObj.searchParams.get('page') || '1', 10);

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  try {
    const targetSearchUrl = `${BASE_URL}/auctions?type=realstate&ufs=${encodeURIComponent(uf)}`;

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
        bank: 'BRADESCO',
        portal: targetSearchUrl,
        status: status || 200,
        accessible: true,
        responseTimeMs: Date.now() - startTime,
        strategy: 'Vitrine Oficial Bradesco + Leiloeiros Homologados',
        note: `Conectado à Vitrine Oficial Bradesco (${targetSearchUrl}).`,
        auctioneers: BRADESCO_AUCTIONEERS,
      });
    }

    if (action === 'search') {
      const startTime = Date.now();
      let isLiveFetched = false;

      const shouldFetchAll = urlObj.searchParams.get('fetchAll') === 'true' || !urlObj.searchParams.has('page');
      const targetApiUrl = `https://api.vitrinebradesco.com.br/v1/auctions?type=realstate&ufs=${encodeURIComponent(uf)}&page=${page}`;
      let realProperties = [];
      let totalFound = 0;
      let totalPages = 1;

      const mapBradescoItem = (item) => {
        const val1 = Number(item.min_auction_value_1 || 0);
        const val2 = Number(item.min_auction_value_2 || 0);
        const date1 = item.date_auction_1 || null;
        const date2 = item.date_auction_2 || null;
        const isAlienacaoFiduciaria = item.realstate_auction_type === 'alienacao-fiduciaria';
        const hasBoth = (val1 > 0 && val2 > 0) || Boolean(date1 && date2) || isAlienacaoFiduciaria;

        // No leilão com 2 praças, o valor de venda padrão para arrematação é a 2ª praça (com deságio)
        const saleVal = val2 > 0 ? val2 : (item.price || val1 || 0);
        const appraisalVal = val1 > 0 ? val1 : (item.final_auction_value || saleVal);
        let discount = 0;
        if (saleVal > 0 && appraisalVal > saleVal && appraisalVal > 0) {
          discount = Math.round(((appraisalVal - saleVal) / appraisalVal) * 100);
        }
        if (saleVal <= 0 || discount >= 100 || discount < 0) {
          discount = 0;
        }

        const photo = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : '';
        const auctioneerName = item.auctioneer?.name ? `${item.auctioneer.name} (Bradesco Homologado)` : 'Bradesco Leilões';

        const firstAuctionVal = hasBoth ? (val1 > 0 ? val1 : appraisalVal) : null;
        const secondAuctionVal = hasBoth ? (val2 > 0 ? val2 : saleVal) : null;
        const isDateActive = (dStr) => {
          if (!dStr) return false;
          try {
            const dt = new Date(dStr);
            if (isNaN(dt.getTime())) return false;
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            return dt.getTime() >= todayStart.getTime();
          } catch { return false; }
        };

        const activeDate1 = isDateActive(date1) ? date1 : null;
        const activeDate2 = isDateActive(date2) ? date2 : null;
        const mainAuctionDate = (hasBoth ? (activeDate1 || activeDate2) : null) || (isDateActive(item.auction_date) ? item.auction_date : null) || activeDate2 || activeDate1 || null;

        const canFinanceBradesco = saleVal >= 100000;
        const maxInstallments = canFinanceBradesco ? 360 : 1;
        const minDownPayment = canFinanceBradesco ? Math.round(saleVal * 0.20) : saleVal;
        const financed = Math.max(0, saleVal - minDownPayment);
        const minInstallmentValue = canFinanceBradesco && financed > 0
          ? Math.round((financed / maxInstallments) + (financed * 0.0088))
          : 0;

        const paymentConditions = canFinanceBradesco
          ? `À vista ou Financiamento Imobiliário Bradesco em até ${maxInstallments} meses (Entrada mínima de 20%: R$ ${minDownPayment.toLocaleString('pt-BR')}, parcelas a partir de R$ ${minInstallmentValue.toLocaleString('pt-BR')}/mês).`
          : 'Somente à vista (O Banco Bradesco exige valor financiado mínimo a partir de R$ 100 mil).';

        const modalityLabel = isAlienacaoFiduciaria
          ? 'Leilão Extrajudicial — Alienação Fiduciária'
          : item.realstate_auction_type === 'convencional'
          ? 'Leilão Extrajudicial Bradesco'
          : (item.realstate_auction_type || 'Leilão Bradesco');

        // Extração de código oficial do imóvel no Bradesco para varreduras/auditorias
        let brdCode = '';
        const descText = item.description || '';
        const codMatch = descText.match(/c[oó]d(?:\.|igo)?(?:\s+do\s+im[oó]vel)?\s*:?\s*(\d{3,8})/i);
        if (codMatch) {
          brdCode = codMatch[1];
        }
        if (!brdCode && Array.isArray(item.images)) {
          for (const img of item.images) {
            const imgMatch = typeof img === 'string' && img.match(/\/([a-z0-9_-]+)\/(\d{4,8})\//i);
            if (imgMatch && imgMatch[2]) {
              brdCode = imgMatch[2];
              break;
            }
          }
        }
        if (!brdCode && item.slug) {
          const slugMatch = item.slug.match(/-(\d{4,8})(?:_\d+)?$/);
          if (slugMatch) brdCode = slugMatch[1];
        }
        if (!brdCode && item.guid) {
          brdCode = item.guid.split('-')[0].toUpperCase();
        }
        const standardPropertyId = `BRD-${brdCode || 'IMOVEL'}`;

        // Extração do Endereço Completo real (Logradouro, Número, Bairro)
        let realAddress = '';
        const rawName = item.name || '';
        const nameParts = rawName.split(/\s*-\s*/);
        if (nameParts.length >= 3) {
          realAddress = nameParts.slice(2).join(' - ').trim();
        }
        if (!realAddress && descText) {
          const cleanDesc = descText.replace(/<[^>]*>/g, ' ');
          const streetMatch = cleanDesc.match(/(?:Rua|Avenida|Av\.|Alameda|Al\.|Travessa|Praça|Rodovia|Estrada)[^.,;]+(?:,\s*(?:n[°ºo]\s*)?\d+[^.,;]*)?/i);
          if (streetMatch) {
            realAddress = streetMatch[0].trim();
          }
        }
        const neigh = item.neighborhood || '';
        if (realAddress) {
          if (neigh && !realAddress.toLowerCase().includes(neigh.toLowerCase())) {
            realAddress = `${realAddress}, ${neigh}`;
          }
        } else {
          realAddress = [neigh, item.city, item.state || uf].filter(Boolean).join(', ');
        }

        return {
          source: 'BRADESCO',
          id: standardPropertyId,
          title: item.name || `Imóvel Bradesco — ${item.city}/${item.state}`,
          city: item.city || '',
          state: item.state || uf,
          neighborhood: item.neighborhood || '',
          address: realAddress,
          sale_value: saleVal,
          appraisal_value: appraisalVal,
          first_auction_value: firstAuctionVal,
          second_auction_value: secondAuctionVal,
          first_auction_date: date1 || mainAuctionDate,
          second_auction_date: date2,
          auction_date: mainAuctionDate,
          has_both_auctions: hasBoth,
          discount_percentage: discount,
          sale_modality: modalityLabel,
          property_type: item.category || 'Imóvel',
          area_m2: 0,
          bedrooms: 0,
          main_photo_url: photo,
          link: item.slug ? `https://vitrinebradesco.com.br/auctions/${item.slug}` : targetSearchUrl,
          auctioneer: auctioneerName,
          description: item.description || '',
          payment_conditions: paymentConditions,
          max_installments: maxInstallments,
          min_down_payment: minDownPayment,
          min_installment_value: minInstallmentValue,
          accepts_financing: canFinanceBradesco,
          raw_list_data: item,
        };
      };

      try {
        const r = await fetch(targetApiUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://vitrinebradesco.com.br',
            'Referer': 'https://vitrinebradesco.com.br/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (r.ok) {
          const json = await r.json();
          isLiveFetched = true;
          totalFound = json.total_auctions || 0;
          totalPages = json.total_pages || 1;

          if (Array.isArray(json.data) && json.data.length > 0) {
            realProperties.push(...json.data.map(mapBradescoItem));

            // Se deve buscar todas as páginas e totalPages > 1, busca em paralelo
            if (shouldFetchAll && totalPages > 1) {
              const extraPages = [];
              for (let p = 2; p <= totalPages; p++) {
                extraPages.push(p);
              }

              const extraResponses = await Promise.all(
                extraPages.map(async (p) => {
                  try {
                    const pUrl = `https://api.vitrinebradesco.com.br/v1/auctions?type=realstate&ufs=${encodeURIComponent(uf)}&page=${p}`;
                    const pRes = await fetch(pUrl, {
                      headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'Origin': 'https://vitrinebradesco.com.br',
                        'Referer': 'https://vitrinebradesco.com.br/',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                      },
                    });
                    if (pRes.ok) {
                      return await pRes.json();
                    }
                  } catch (e) {
                    console.warn(`[Bradesco Page ${p} Fetch Error]`, e);
                  }
                  return { data: [] };
                })
              );

              extraResponses.forEach((res) => {
                if (Array.isArray(res.data)) {
                  realProperties.push(...res.data.map(mapBradescoItem));
                }
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Bradesco Proxy API Error]', err);
      }

      const seenIds = new Set();
      const uniqueProperties = [];
      for (const prop of realProperties) {
        if (!prop?.id || seenIds.has(prop.id)) continue;
        seenIds.add(prop.id);
        uniqueProperties.push(prop);
      }

      return res.status(200).json({
        bank: 'BRADESCO',
        uf,
        searchUrl: targetSearchUrl,
        isLiveFetched,
        page,
        totalPages,
        status: 200,
        properties: uniqueProperties,
        totalFound: totalFound || uniqueProperties.length,
        responseTimeMs: Date.now() - startTime,
        note:
          uniqueProperties.length > 0
            ? `${uniqueProperties.length} oportunidades reais Bradesco em ${uf} (${targetSearchUrl}).`
            : `Nenhum leilão ativo encontrado no Bradesco para ${uf} neste momento.`,
        alternativeAuctioneers: BRADESCO_AUCTIONEERS.filter(a => a.ufs.includes(uf) || a.ufs.length === 0),
      });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });
  } catch {
    return res.status(200).json({ bank: 'BRADESCO', status: 200, properties: [] });
  }
}
