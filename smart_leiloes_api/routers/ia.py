"""
Router: Análise de Risco por IA
Rating adaptativo 0-100 com pesos dinâmicos por perfil de investidor.
Preparado para integração real com Gemini API (análise de PDFs).
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from smart_leiloes_api.models import ImovelModel, ApiKeyModel
from smart_leiloes_api.schemas import PerfilRisco
from smart_leiloes_api.dependencies import get_db, verify_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/ia", tags=["Inteligência Artificial"])


# Perfis de peso para o scoring
PESOS_PERFIL = {
    PerfilRisco.CONSERVADOR: {
        "matricula": 0.50,   # Prioriza segurança jurídica
        "edital":    0.35,
        "imovel":    0.15,
    },
    PerfilRisco.ARROJADO: {
        "matricula": 0.25,   # Prioriza margem financeira
        "edital":    0.25,
        "imovel":    0.50,
    },
}


def _classificar_risco(score: float) -> dict:
    """Converte score numérico em classificação semântica com cor."""
    if score >= 80:
        return {"nivel": "BAIXO",  "cor": "VERDE",    "emoji": "🟢"}
    elif score >= 55:
        return {"nivel": "MÉDIO",  "cor": "AMARELO",  "emoji": "🟡"}
    else:
        return {"nivel": "ALTO",   "cor": "VERMELHO", "emoji": "🔴"}


def _score_imovel_estrutural(imovel: ImovelModel) -> float:
    """
    Calcula score estrutural do imóvel com base nos dados disponíveis.
    Substitui as notas hardcoded (85, 90, 75) da versão original.
    Pontuação: 0–100 baseada em dados reais do imóvel.

    TODO (Fase 4): integrar Gemini API para análise real de PDFs de matrícula/edital.
    """
    score = 50.0  # Base neutra

    # Bônus por desconto (quanto maior o deságio, maior a oportunidade)
    if imovel.desconto_percentual:
        d = float(imovel.desconto_percentual)
        if d >= 50:     score += 25
        elif d >= 35:   score += 15
        elif d >= 20:   score += 8

    # Bônus por documentação disponível
    if imovel.link_matricula:   score += 8
    if imovel.link_edital:      score += 7

    # Bônus por imóvel desocupado (reduz risco de desocupação)
    if imovel.ocupacao == "DESOCUPADO":   score += 10
    elif imovel.ocupacao == "OCUPADO":    score -= 10

    # Bônus por aceitar financiamento (maior liquidez de saída)
    if imovel.aceita_financiamento:  score += 5

    return round(min(max(score, 0.0), 100.0), 1)


def _score_edital(imovel: ImovelModel) -> float:
    """
    Score do edital baseado em dados estruturais disponíveis.
    TODO (Fase 4): análise real de cláusulas via NLP (Gemini).
    """
    score = 70.0
    if imovel.link_edital:          score += 10  # Edital acessível
    if imovel.data_leilao_1:        score += 10  # Data clara
    if imovel.data_leilao_2:        score += 5   # 2ª chance de leilão
    if imovel.aceita_financiamento: score += 5   # Facilita saída
    return round(min(score, 100.0), 1)


def _score_matricula(imovel: ImovelModel) -> float:
    """
    Score da matrícula baseado em presença de documentação.
    TODO (Fase 4): OCR + análise de ônus/penhoras via Gemini.
    """
    score = 60.0
    if imovel.link_matricula:  score += 30  # Matrícula disponível
    if imovel.link_edital:     score += 10  # Edital confirma regularidade básica
    return round(min(score, 100.0), 1)


@router.get(
    "/imoveis/{imovel_id}/analise",
    summary="Análise de risco IA com perfil de investidor",
)
def analisar_imovel(
    imovel_id: str,
    perfil:    PerfilRisco = Query(PerfilRisco.CONSERVADOR),
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """
    Calcula o ranking de risco (0 a 100) cruzando 3 dimensões:
    - **Matrícula**: regularidade jurídica e ausência de ônus
    - **Edital**: transparência e cláusulas contratuais
    - **Imóvel**: deságio, ocupação e liquidez

    Os pesos variam conforme o perfil escolhido:
    - **CONSERVADOR**: máxima segurança jurídica (50% matrícula)
    - **ARROJADO**: foco em margem financeira (50% imóvel)
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    pesos = PESOS_PERFIL[perfil]

    nota_matricula = _score_matricula(imovel)
    nota_edital    = _score_edital(imovel)
    nota_imovel    = _score_imovel_estrutural(imovel)

    ranking = round(
        nota_matricula * pesos["matricula"]
        + nota_edital  * pesos["edital"]
        + nota_imovel  * pesos["imovel"],
        1,
    )

    classificacao = _classificar_risco(ranking)

    return {
        "imovel_id":        imovel.id,
        "titulo":           imovel.titulo,
        "perfil_utilizado": perfil.value,
        "pesos_aplicados":  pesos,
        "scores": {
            "matricula": nota_matricula,
            "edital":    nota_edital,
            "imovel":    nota_imovel,
        },
        "ranking_score":     ranking,
        "classificacao_risco": classificacao,
        "analise_textual": _gerar_analise_textual(imovel, ranking, classificacao),
        "nota": "Scores calculados com base em dados estruturais disponíveis. "
                "Integração com Gemini para análise real de PDFs disponível na Fase 4.",
    }


def _gerar_analise_textual(imovel: ImovelModel, score: float, classificacao: dict) -> str:
    partes = []

    if classificacao["nivel"] == "BAIXO":
        partes.append("Imóvel com boa relação risco/retorno.")
    elif classificacao["nivel"] == "MÉDIO":
        partes.append("Imóvel com risco moderado — recomenda-se análise documental adicional.")
    else:
        partes.append("Imóvel com fatores de risco elevados — due diligence rigorosa necessária.")

    if imovel.desconto_percentual and float(imovel.desconto_percentual) >= 35:
        partes.append(f"Deságio de {imovel.desconto_percentual:.1f}% representa oportunidade significativa.")

    if imovel.ocupacao == "DESOCUPADO":
        partes.append("Imóvel desocupado — sem custo de desocupação previsto.")
    elif imovel.ocupacao == "OCUPADO":
        partes.append("Imóvel ocupado — prever custos jurídicos de desocupação.")

    if not imovel.link_matricula:
        partes.append("Matrícula não disponível publicamente — solicite ao leiloeiro antes de arrematar.")

    return " ".join(partes)
