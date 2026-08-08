export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'ID do imóvel não fornecido' });
  }

  const cleanId = String(id).replace(/\D/g, '');
  const targetUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${cleanId}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const status = response.status;
    const html = await response.text();

    res.status(200).json({
      status,
      targetUrl,
      html,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Não foi possível consultar automaticamente este imóvel.',
      details: err.message,
    });
  }
}
