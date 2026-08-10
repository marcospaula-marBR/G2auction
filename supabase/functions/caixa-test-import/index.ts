import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { uf = 'SP', limit = 1, save: _save = false } = await req.json().catch(() => ({}));

    // 1. Obter a página da lista oficial por UF
    const listUrl = `https://venda-imoveis.caixa.gov.br/sistema/download-lista-imoveis.asp?hdnEstado=${String(uf).toUpperCase()}`;
    const listRes = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const buffer = await listRes.arrayBuffer();
    const decoder = new TextDecoder('iso-8859-1');
    const textContent = decoder.decode(buffer);

    const lines = textContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

    // Mapeamento simples de ID
    const extractedProperties: any[] = [];
    let count = 0;

    for (const line of lines) {
      if (count >= limit) break;
      const cols = line.split(';').map((c) => c.replace(/^["']|["']$/g, '').trim());
      const rawId = cols.find((c) => /^\d{10,14}$/.test(c.replace(/\D/g, '')));
      if (!rawId) continue;

      const cleanId = rawId.replace(/\D/g, ''); // String TEXT preservando zeros
      if (!cleanId) continue;

      // Consultar ficha individual
      const detailUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${cleanId}`;
      const detailRes = await fetch(detailUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const detailHtml = await detailRes.text();

      extractedProperties.push({
        source: 'CAIXA',
        source_property_id: cleanId,
        source_url: detailUrl,
        uf: String(uf).toUpperCase(),
        html_length: detailHtml.length,
      });

      count++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        list: {
          uf: String(uf).toUpperCase(),
          total: lines.length,
        },
        properties: extractedProperties,
      }),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
});
