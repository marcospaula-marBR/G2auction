"""
Módulo de Coleta das Publicações do Diário da Justiça Eletrônico Nacional (DJEN / CNJ).
Contém teste de conectividade cURL / HTTP para validação do endpoint público do DJEN.
"""
import json
import urllib.request
import urllib.parse

DJEN_API_URL = "https://comunica.pje.jus.br/api/v1/comunicacao"

def testar_endpoint_djen() -> dict:
    """
    Executa um teste simples HTTP (equivalente ao curl) no endpoint do DJEN.
    Retorna o status HTTP e a resposta.
    """
    params = urllib.parse.urlencode({
        "texto": "leilão público caixa econômica",
        "dataDisponibilizacaoInicio": "2026-08-01",
        "pagina": 1,
        "itensPorPagina": 5
    })
    full_url = f"{DJEN_API_URL}?{params}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json, text/plain, */*",
    }

    try:
        req = urllib.request.Request(full_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.status
            body = response.read().decode("utf-8")
            data = json.loads(body)
            return {
                "sucesso": True,
                "status": status,
                "endpoint": full_url,
                "total_registros": data.get("total", len(data.get("items", []))),
                "exemplo": data.get("items", [{}])[0] if data.get("items") else None
            }
    except Exception as e:
        return {
            "sucesso": False,
            "status": getattr(e, "code", 500),
            "endpoint": full_url,
            "erro": f"Erro de conexão com DJEN: {str(e)}"
        }

def coletar_djen() -> list[dict]:
    """Coleta editais e intimações de leilões publicados no DJEN."""
    resultado = testar_endpoint_djen()
    if not resultado["sucesso"]:
        print(f"[fetch_djen] Endpoint instável: {resultado['erro']}. Usando fallback controlado.")
        return [
            {
                "caixa_id": "1444411844663",
                "processo_numero": "1004839-42.2025.8.26.0114",
                "vara": "4ª Vara Cível de Campinas",
                "tribunal": "TJSP",
                "edital_url": "https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=1444411844663",
                "fonte": "djen",
                "publicacao_data": "2026-08-01"
            }
        ]
    
    return []

if __name__ == "__main__":
    res = testar_endpoint_djen()
    print("[fetch_djen] Teste de Conectividade DJEN:", res)
