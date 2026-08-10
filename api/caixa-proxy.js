export default async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = urlObj.searchParams.get('action') || 'fetch_detail';
  const uf = (urlObj.searchParams.get('uf') || 'SP').toUpperCase();
  const id = urlObj.searchParams.get('id');
  const photoUrl = urlObj.searchParams.get('url');

  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    // 1. Download do Feed CSV Oficial por UF
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
        return res.status(feedStatus).json({
          status: feedStatus,
          error: 'FEED_HTTP_ERROR',
          targetFeedUrl,
          uf,
        });
      }

      const arrayBuf = await feedRes.arrayBuffer();
      const decoder = new TextDecoder('windows-1252');
      const fileContent = decoder.decode(arrayBuf);

      return res.status(200).json({
        status: feedStatus,
        contentType,
        targetFeedUrl,
        uf,
        contentLength: fileContent.length,
        fileContent,
      });
    }

    // 2. Validação de Fotografia
    if (action === 'validate_photo') {
      if (!photoUrl) {
        return res.status(400).json({ error: 'URL da foto não informada' });
      }

      let photoRes = await fetch(photoUrl, { method: 'HEAD' });
      if (photoRes.status !== 200) {
        photoRes = await fetch(photoUrl, { method: 'GET' });
      }

      const contentType = photoRes.headers.get('content-type') || '';
      const isValidImage = photoRes.status === 200 && (contentType.includes('image') || contentType.includes('application/octet-stream'));

      return res.status(200).json({
        status: photoRes.status,
        contentType,
        isValid: isValidImage,
        url: photoUrl,
      });
    }

    // 3. Ficha Individual
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

    return res.status(200).json({
      status,
      targetUrl,
      html,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'FEED_HTTP_ERROR',
      details: err.message,
    });
  }
}
