"""
Orquestra o fluxo completo, fonte por fonte:
1. Coleta bruta (CSV da Caixa / publicações do DJEN)
2. Para registros que vieram só com link de edital (sem dados estruturados
   suficientes), baixa o PDF e extrai os campos
3. Geocodifica o endereço e monta os links de Street View
4. Salva/atualiza no banco

Esta é a função chamada pelo botão "Atualizar" da interface (app.py).
"""
import traceback

from db import init_db, upsert_imovel, registrar_execucao, finalizar_execucao
from fetch_caixa import coletar_caixa
from fetch_djen import coletar_djen
from extract import extrair_dados_edital, campos_faltando
from geocode import enriquecer_com_geo


def _completar_com_edital(registro: dict) -> dict:
    """Se faltam campos essenciais e há um link de edital, baixa e extrai."""
    if campos_faltando(registro) and registro.get("edital_url"):
        extraidos = extrair_dados_edital(registro["edital_url"])
        # não sobrescreve o que já veio confiável do CSV/API de origem
        for chave, valor in extraidos.items():
            registro.setdefault(chave, valor)
    return registro


def _processar_lote(registros: list[dict], fonte: str) -> dict:
    novos, atualizados, erros = 0, 0, 0

    for registro in registros:
        try:
            registro = _completar_com_edital(registro)
            registro = enriquecer_com_geo(registro)

            # remove chaves que não existem na tabela (ex: campos temporários)
            registro = {k: v for k, v in registro.items() if v is not None}

            resultado = upsert_imovel(registro)
            if resultado == "inserido":
                novos += 1
            else:
                atualizados += 1
        except Exception as e:
            erros += 1
            print(f"[pipeline] erro processando registro de {fonte}: {e}")
            traceback.print_exc()

    return {"novos": novos, "atualizados": atualizados, "erros": erros}


def atualizar_caixa(ufs: list[str] | None = None) -> dict:
    exec_id = registrar_execucao(fonte="caixa", status="em_andamento")
    try:
        registros = coletar_caixa(ufs)
        resultado = _processar_lote(registros, "caixa")
        finalizar_execucao(exec_id, status="ok", **resultado,
                            mensagem=f"{len(registros)} registros brutos coletados")
        return resultado
    except Exception as e:
        finalizar_execucao(exec_id, status="erro", mensagem=str(e))
        raise


def atualizar_djen() -> dict:
    exec_id = registrar_execucao(fonte="djen", status="em_andamento")
    try:
        registros = coletar_djen()
        resultado = _processar_lote(registros, "djen")
        finalizar_execucao(exec_id, status="ok", **resultado,
                            mensagem=f"{len(registros)} registros brutos coletados")
        return resultado
    except Exception as e:
        finalizar_execucao(exec_id, status="erro", mensagem=str(e))
        raise


def atualizar_tudo(ufs: list[str] | None = None) -> dict:
    """Roda todas as fontes em sequência. É isso que o botão 'Atualizar' chama."""
    init_db()
    resultado_caixa = atualizar_caixa(ufs)
    resultado_djen = atualizar_djen()
    return {"caixa": resultado_caixa, "djen": resultado_djen}


if __name__ == "__main__":
    # Uso manual: python pipeline.py
    print(atualizar_tudo())
