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
            // AÇÃO 1: DOWNLOAD DO FEED CSV OFICIAL POR UF (/listaweb/Lista_imoveis_{UF}.csv)
            if (action === 'download_feed' || action === 'download_list') {
              const targetFeedUrl = `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${uf}.csv`;
              const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml,application/octet-stream,text/csv,text/plain;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9',
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
              
              // Decodificação Windows-1252 / ISO-8859-1 para preservar acentuação em Reais e nomes brasileiros
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

              let photoRes = await fetch(photoUrl, { method: 'HEAD' });
              if (photoRes.status !== 200) {
                photoRes = await fetch(photoUrl, { method: 'GET' });
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
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
