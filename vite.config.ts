import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'caixa-proxy-dev-middleware',
      configureServer(server) {
        server.middlewares.use('/api/caixa-proxy', async (req, res) => {
          const urlParams = new URLSearchParams(req.url?.split('?')[1]);
          const id = urlParams.get('id');

          if (!id) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({ error: 'ID do imóvel não fornecido' }));
          }

          const cleanId = id.replace(/\D/g, '');
          const targetUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${cleanId}`;

          try {
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
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({ status, targetUrl, html }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(
              JSON.stringify({
                error: 'Não foi possível consultar automaticamente este imóvel.',
                details: err.message,
              })
            );
          }
        });
      },
    },
  ],
});
