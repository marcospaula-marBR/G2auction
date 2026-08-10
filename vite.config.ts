import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'caixa-proxy-dev-middleware',
      configureServer(server) {
        server.middlewares.use('/api/caixa-proxy', async (req, res) => {
          const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          const action = urlObj.searchParams.get('action') || 'fetch_detail';
          const uf = (urlObj.searchParams.get('uf') || 'SP').toUpperCase();
          const id = urlObj.searchParams.get('id');
          const photoUrl = urlObj.searchParams.get('url');

          res.setHeader('Content-Type', 'application/json; charset=utf-8');

          try {
            // AÇÃO DIAGNÓSTICO HTTP SERVER-SIDE (4 REQUISIÇÕES INDEPENDENTES COM HEADERS MÍNIMOS)
            if (action === 'diagnose') {
              const runTest = async (targetUrl: string, acceptHeader: string) => {
                const startTime = Date.now();
                let status = 0;
                let finalUrl = targetUrl;
                let contentType = '';
                let contentLength = '';
                let location = '';
                let serverHeader = '';
                let bytesReceived = 0;
                let snippet = '';

                try {
                  const fetchRes = await fetch(targetUrl, {
                    method: 'GET',
                    redirect: 'follow',
                    headers: {
                      'Accept': acceptHeader,
                    },
                  });

                  status = fetchRes.status;
                  finalUrl = fetchRes.url || targetUrl;
                  contentType = fetchRes.headers.get('content-type') || '';
                  contentLength = fetchRes.headers.get('content-length') || '';
                  location = fetchRes.headers.get('location') || '';
                  serverHeader = fetchRes.headers.get('server') || '';

                  const textContent = await fetchRes.text();
                  bytesReceived = new TextEncoder().encode(textContent).length;

                  if (contentType.includes('text') || contentType.includes('html') || contentType.includes('json') || contentType.includes('csv') || contentType.includes('xml')) {
                    snippet = textContent.substring(0, 300);
                  }

                  return {
                    url: targetUrl,
                    status,
                    finalUrl,
                    contentType,
                    contentLength: contentLength || null,
                    bytesReceived,
                    location: location || null,
                    server: serverHeader || null,
                    snippet,
                    responseTimeMs: Date.now() - startTime,
                    fullText: textContent,
                  };
                } catch (err: any) {
                  return {
                    url: targetUrl,
                    status: 500,
                    finalUrl: targetUrl,
                    contentType: '',
                    contentLength: null,
                    bytesReceived: 0,
                    location: null,
                    server: null,
                    snippet: `Error: ${err.message}`,
                    responseTimeMs: Date.now() - startTime,
                    fullText: '',
                  };
                }
              };

              // Execução paralela/independente das 4 requisições server-side
              const [testA, testB, testC, testD] = await Promise.all([
                runTest('https://venda-imoveis.caixa.gov.br/', 'text/html,application/xhtml+xml'),
                runTest('https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp', 'text/html,application/xhtml+xml'),
                runTest(`https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${uf}.csv`, '*/*'),
                runTest(`https://venda-imoveis.caixa.gov.br/sistema/busca-imovel.asp?hdnEstado=${uf}&hdnLocalidade=9859&hdnNumTipoVenda=33&hdnOrigem=banner`, 'text/html,application/xhtml+xml'),
              ]);

              // Inspecção do Formulário em TESTE B (download-lista.asp)
              const formDebug: any = {};
              if (testB.status === 200 && testB.fullText) {
                const actionMatch = testB.fullText.match(/<form[^>]*action=["']([^"']+)["']/i);
                const methodMatch = testB.fullText.match(/<form[^>]*method=["']([^"']+)["']/i);
                const ufSelectMatch = testB.fullText.match(/<select[^>]*name=["']([^"']+)["']/i);

                formDebug.action = actionMatch ? actionMatch[1] : null;
                formDebug.method = methodMatch ? methodMatch[1] : 'POST';
                formDebug.selectUfName = ufSelectMatch ? ufSelectMatch[1] : 'hdnEstado';

                const hiddenInputs: Record<string, string> = {};
                const hiddenRegex = /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi;
                let hMatch: RegExpExecArray | null;
                while ((hMatch = hiddenRegex.exec(testB.fullText)) !== null) {
                  hiddenInputs[hMatch[1]] = hMatch[2];
                }
                formDebug.hiddenInputs = hiddenInputs;
              }

              // Inspecção de Imóveis em TESTE D (busca-imovel.asp)
              let containsRealProperties = false;
              const samplePropertyIds: string[] = [];
              if (testD.status === 200 && testD.fullText) {
                containsRealProperties = testD.fullText.includes('Foram encontrados') || testD.fullText.includes('Número do imóvel:');
                const idRegex = /hdnimovel=["']?(\d{10,15})/gi;
                let idMatch: RegExpExecArray | null;
                while ((idMatch = idRegex.exec(testD.fullText)) !== null) {
                  if (!samplePropertyIds.includes(idMatch[1]) && samplePropertyIds.length < 3) {
                    samplePropertyIds.push(idMatch[1]);
                  }
                }
              }

              // Lógica de Classificação Automática dos Cenários
              let classification = 'UNKNOWN';
              let recommendedIngestionMethod = 'EXTERNAL_OR_MANUAL_IMPORT';

              if (testA.status === 200 && testB.status === 200 && testC.status === 403 && testD.status === 200) {
                classification = 'CENARIO_1_CSV_DIRECT_BLOCKED';
                recommendedIngestionMethod = 'OFFICIAL_HTML_SEARCH';
              } else if (testA.status === 403 && testB.status === 403 && testC.status === 403 && testD.status === 403) {
                classification = 'CENARIO_2_CAIXA_BLOCKS_SERVER_ORIGIN';
                recommendedIngestionMethod = 'EXTERNAL_OR_MANUAL_IMPORT';
              } else if (testB.status === 200 && testC.status === 403) {
                classification = 'CENARIO_3_FORM_AVAILABLE_CSV_BLOCKED';
                recommendedIngestionMethod = 'OFFICIAL_FORM_DOWNLOAD';
              } else if (testC.status === 200) {
                classification = 'CENARIO_4_DIRECT_CSV_AVAILABLE';
                recommendedIngestionMethod = 'DIRECT_CSV_FEED';
              } else if (testD.status === 200 && containsRealProperties) {
                classification = 'CENARIO_5_SEARCH_PAGE_AVAILABLE';
                recommendedIngestionMethod = 'OFFICIAL_HTML_SEARCH';
              }

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  classification,
                  recommended_ingestion_method: recommendedIngestionMethod,
                  official_search_available: containsRealProperties,
                  sample_property_ids: samplePropertyIds,
                  form_debug: Object.keys(formDebug).length > 0 ? formDebug : null,
                  tests: {
                    root: {
                      name: 'Domínio',
                      url: testA.url,
                      status: testA.status,
                      finalUrl: testA.finalUrl,
                      contentType: testA.contentType,
                      contentLength: testA.contentLength,
                      bytesReceived: testA.bytesReceived,
                      location: testA.location,
                      server: testA.server,
                      snippet: testA.snippet,
                      responseTimeMs: testA.responseTimeMs,
                    },
                    download_page: {
                      name: 'Página download',
                      url: testB.url,
                      status: testB.status,
                      finalUrl: testB.finalUrl,
                      contentType: testB.contentType,
                      contentLength: testB.contentLength,
                      bytesReceived: testB.bytesReceived,
                      location: testB.location,
                      server: testB.server,
                      snippet: testB.snippet,
                      responseTimeMs: testB.responseTimeMs,
                    },
                    direct_csv: {
                      name: 'CSV SP',
                      url: testC.url,
                      status: testC.status,
                      finalUrl: testC.finalUrl,
                      contentType: testC.contentType,
                      contentLength: testC.contentLength,
                      bytesReceived: testC.bytesReceived,
                      location: testC.location,
                      server: testC.server,
                      snippet: testC.snippet,
                      responseTimeMs: testC.responseTimeMs,
                    },
                    public_search: {
                      name: 'Busca pública SP',
                      url: testD.url,
                      status: testD.status,
                      finalUrl: testD.finalUrl,
                      contentType: testD.contentType,
                      contentLength: testD.contentLength,
                      bytesReceived: testD.bytesReceived,
                      location: testD.location,
                      server: testD.server,
                      snippet: testD.snippet,
                      responseTimeMs: testD.responseTimeMs,
                      contains_real_properties: containsRealProperties,
                    },
                  },
                })
              );
            }

            // AÇÃO 1: DOWNLOAD DO FEED CSV OFICIAL POR UF (/listaweb/Lista_imoveis_{UF}.csv)
            if (action === 'download_feed' || action === 'download_list') {
              const targetFeedUrl = `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${uf}.csv`;
              const headers = {
                'Accept': '*/*',
              };

              const feedRes = await fetch(targetFeedUrl, { headers });
              const feedStatus = feedRes.status;
              const contentType = feedRes.headers.get('content-type') || 'application/octet-stream';

              if (feedStatus !== 200) {
                res.statusCode = feedStatus;
                return res.end(
                  JSON.stringify({
                    status: feedStatus,
                    error: 'FEED_HTTP_ERROR',
                    targetFeedUrl,
                    uf,
                  })
                );
              }

              const arrayBuf = await feedRes.arrayBuffer();
              const decoder = new TextDecoder('windows-1252');
              const fileContent = decoder.decode(arrayBuf);

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  status: feedStatus,
                  contentType,
                  targetFeedUrl,
                  uf,
                  contentLength: fileContent.length,
                  fileContent,
                })
              );
            }

            // AÇÃO 2: VALIDAR FOTOGRAFIA VIA HTTP HEAD/GET
            if (action === 'validate_photo') {
              if (!photoUrl) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'URL da foto não informada' }));
              }

              let photoRes = await fetch(photoUrl, { method: 'HEAD', headers: { 'Accept': '*/*' } });
              if (photoRes.status !== 200) {
                photoRes = await fetch(photoUrl, { method: 'GET', headers: { 'Accept': '*/*' } });
              }

              const contentType = photoRes.headers.get('content-type') || '';
              const isValidImage = photoRes.status === 200 && (contentType.includes('image') || contentType.includes('application/octet-stream'));

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  status: photoRes.status,
                  contentType,
                  isValid: isValidImage,
                  url: photoUrl,
                })
              );
            }

            // AÇÃO 3: BUSCAR FICHA INDIVIDUAL DE UM IMÓVEL
            const cleanId = id ? String(id).replace(/\D/g, '') : '1444408501866';
            const targetUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${cleanId}`;

            const fetchRes = await fetch(targetUrl, {
              headers: {
                'Accept': 'text/html,application/xhtml+xml',
              },
            });

            const status = fetchRes.status;
            const html = await fetchRes.text();

            res.statusCode = 200;
            return res.end(JSON.stringify({ status, targetUrl, html }));
          } catch (err: any) {
            res.statusCode = 500;
            return res.end(
              JSON.stringify({
                error: 'FEED_HTTP_ERROR',
                details: err.message,
              })
            );
          }
        });
      },
    },
  ],
});
