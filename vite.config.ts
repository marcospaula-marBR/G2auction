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
          const uf = urlObj.searchParams.get('uf') || 'SP';
          const id = urlObj.searchParams.get('id');
          const photoUrl = urlObj.searchParams.get('url');

          res.setHeader('Content-Type', 'application/json; charset=utf-8');

          try {
            // AÇÃO 1: BAIXAR A RELAÇÃO OFICIAL DE IMÓVEIS DA CAIXA (download-lista.asp)
            if (action === 'download_list') {
              const downloadPageUrl = 'https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp';
              const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9',
              };

              // 1. Fetch da página inicial para obter os campos do formulário
              await fetch(downloadPageUrl, { headers });

              // 2. Submissão HTTP do formulário oficial com a UF selecionada
              const targetListUrl = `https://venda-imoveis.caixa.gov.br/sistema/download-lista-imoveis.asp?hdnEstado=${uf.toUpperCase()}`;
              const listRes = await fetch(targetListUrl, { headers });

              const listStatus = listRes.status;
              const listBuffer = await listRes.arrayBuffer();
              
              // Decodificação Latin1 / UTF-8
              const decoder = new TextDecoder('iso-8859-1');
              const listContent = decoder.decode(listBuffer);

              res.statusCode = 200;
              return res.end(
                JSON.stringify({
                  status: listStatus,
                  downloadPageUrl,
                  submittedUrl: targetListUrl,
                  uf,
                  formAction: 'download-lista-imoveis.asp',
                  formMethod: 'POST/GET',
                  ufFieldName: 'hdnEstado',
                  contentLength: listContent.length,
                  fileContent: listContent,
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
            const cleanId = id ? String(id).replace(/\D/g, '') : '1444411844663';
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
                error: 'Não foi possível consultar a fonte oficial da CAIXA.',
                details: err.message,
              })
            );
          }
        });
      },
    },
  ],
});
