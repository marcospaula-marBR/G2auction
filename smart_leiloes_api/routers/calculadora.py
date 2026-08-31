"""
Router: Calculadora Smart
Cálculo completo de custos de aquisição, financiamento SAC/PRICE e
tabela de lances simulados com ROI real — cobrindo todos os 27 estados.
"""
import math
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from smart_leiloes_api.models import ImovelModel, ApiKeyModel
from smart_leiloes_api.schemas import SistemaAmortizacao
from smart_leiloes_api.dependencies import get_db, verify_api_key
from smart_leiloes_api.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/calculadora", tags=["Calculadora Smart"])
settings = get_settings()

# ═══════════════════════════════════════════════════════════════════════════
# TABELA COMPLETA: 27 ESTADOS BRASILEIROS
# ITBI (alíquota %), emolumentos fixos estimados e laudêmio (se houver)
# Fonte: tabelas oficiais de cartórios e legislação municipal predominante
# ═══════════════════════════════════════════════════════════════════════════
TABELA_CUSTOS_ESTADOS: dict = {
    # Sul
    "PR": {"itbi": 2.0,  "emolumentos": 950.0,   "laudemio": 0.0},
    "SC": {"itbi": 2.0,  "emolumentos": 900.0,   "laudemio": 0.0},
    "RS": {"itbi": 3.0,  "emolumentos": 1_000.0, "laudemio": 0.0},
    # Sudeste
    "SP": {"itbi": 3.0,  "emolumentos": 1_200.0, "laudemio": 0.0},
    "RJ": {"itbi": 3.0,  "emolumentos": 1_500.0, "laudemio": 2.5},  # laudêmio p/ terrenos da União
    "MG": {"itbi": 2.5,  "emolumentos": 1_100.0, "laudemio": 0.0},
    "ES": {"itbi": 2.0,  "emolumentos": 950.0,   "laudemio": 0.0},
    # Centro-Oeste
    "DF": {"itbi": 3.0,  "emolumentos": 1_600.0, "laudemio": 0.0},
    "GO": {"itbi": 2.0,  "emolumentos": 900.0,   "laudemio": 0.0},
    "MT": {"itbi": 2.0,  "emolumentos": 850.0,   "laudemio": 0.0},
    "MS": {"itbi": 2.0,  "emolumentos": 850.0,   "laudemio": 0.0},
    # Nordeste
    "BA": {"itbi": 3.0,  "emolumentos": 1_300.0, "laudemio": 0.0},
    "PE": {"itbi": 3.0,  "emolumentos": 1_150.0, "laudemio": 5.0},  # laudêmio em Recife/Olinda
    "CE": {"itbi": 2.0,  "emolumentos": 900.0,   "laudemio": 0.0},
    "MA": {"itbi": 2.0,  "emolumentos": 800.0,   "laudemio": 0.0},
    "PI": {"itbi": 2.0,  "emolumentos": 800.0,   "laudemio": 0.0},
    "RN": {"itbi": 3.0,  "emolumentos": 900.0,   "laudemio": 0.0},
    "PB": {"itbi": 2.0,  "emolumentos": 800.0,   "laudemio": 0.0},
    "AL": {"itbi": 2.0,  "emolumentos": 800.0,   "laudemio": 0.0},
    "SE": {"itbi": 2.0,  "emolumentos": 800.0,   "laudemio": 0.0},
    # Norte
    "AM": {"itbi": 2.0,  "emolumentos": 800.0,   "laudemio": 0.0},
    "PA": {"itbi": 2.0,  "emolumentos": 800.0,   "laudemio": 0.0},
    "AC": {"itbi": 2.0,  "emolumentos": 750.0,   "laudemio": 0.0},
    "RO": {"itbi": 2.0,  "emolumentos": 750.0,   "laudemio": 0.0},
    "RR": {"itbi": 2.0,  "emolumentos": 750.0,   "laudemio": 0.0},
    "AP": {"itbi": 2.0,  "emolumentos": 750.0,   "laudemio": 0.0},
    "TO": {"itbi": 2.0,  "emolumentos": 800.0,   "laudemio": 0.0},
    # Fallback para UF desconhecida (nunca deve ocorrer com enum validado)
    "DEFAULT": {"itbi": 2.5, "emolumentos": 1_000.0, "laudemio": 0.0},
}


def _calcular_custos_base(lance: float, uf: str) -> dict:
    """Centraliza o cálculo de custos de aquisição para reutilização."""
    regras = TABELA_CUSTOS_ESTADOS.get(uf, TABELA_CUSTOS_ESTADOS["DEFAULT"])
    itbi                = (regras["itbi"] / 100) * lance
    emolumentos         = regras["emolumentos"]
    comissao_leiloeiro  = lance * (settings.comissao_leiloeiro_pct / 100)
    laudemio            = (regras["laudemio"] / 100) * lance if regras["laudemio"] > 0 else 0.0
    registro_escritura  = 2_500.0
    provisao_desocupacao = 5_000.0
    total = itbi + emolumentos + comissao_leiloeiro + laudemio + registro_escritura + provisao_desocupacao
    return {
        "itbi":               round(itbi, 2),
        "itbi_aliquota_pct":  regras["itbi"],
        "comissao_leiloeiro": round(comissao_leiloeiro, 2),
        "emolumentos":        round(emolumentos, 2),
        "laudemio":           round(laudemio, 2),
        "registro_escritura": registro_escritura,
        "provisao_desocupacao": provisao_desocupacao,
        "total_custos_adicionais": round(total, 2),
    }


def _simular_financiamento(saldo: float, taxa_anual: float, prazo: int, sistema: str) -> dict:
    """Calcula parcelas SAC ou PRICE sobre o saldo devedor."""
    juros_mensal = (taxa_anual / 100) / 12

    if sistema == "PRICE":
        fator = (1 + juros_mensal) ** prazo
        pmt = saldo * (juros_mensal * fator) / (fator - 1)
        total_pago = pmt * prazo
        ultima_parcela = pmt
    else:  # SAC
        amort = saldo / prazo
        pmt = amort + (saldo * juros_mensal)       # primeira parcela
        ultima_parcela = amort + (amort * juros_mensal)
        # Soma exata de P.A. decrescente
        soma_juros = juros_mensal * saldo * prazo - juros_mensal * amort * (prazo * (prazo - 1)) / 2
        total_pago = saldo + soma_juros

    return {
        "sistema":           sistema,
        "saldo_financiado":  round(saldo, 2),
        "primeira_parcela":  round(pmt, 2),
        "ultima_parcela":    round(ultima_parcela, 2),
        "juros_acumulados":  round(total_pago - saldo, 2),
        "custo_total":       round(total_pago, 2),
    }


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/custos", summary="Calcular custos completos de aquisição")
def calcular_custos_e_financiamento(
    imovel_id:           str,
    lance_proposto:      float = Query(..., gt=0),
    usar_financiamento:  bool  = Query(False),
    valor_entrada:       float = Query(0.0, ge=0),
    taxa_juros_anual:    float = Query(10.5, ge=0, le=100),
    prazo_meses:         int   = Query(240, ge=12, le=420),
    sistema_amortizacao: SistemaAmortizacao = Query(SistemaAmortizacao.SAC),
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """
    Projeção financeira completa:
    - Custos de aquisição detalhados por UF (ITBI, emolumentos, laudêmio, comissão)
    - Simulação de financiamento SAC ou PRICE (se solicitado)
    - Custo de oportunidade vs SELIC configurável
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    uf = imovel.estado.upper()
    custos = _calcular_custos_base(lance_proposto, uf)
    custo_total_projeto = lance_proposto + custos["total_custos_adicionais"]

    # Financiamento
    financiamento = None
    if usar_financiamento:
        saldo = lance_proposto - valor_entrada
        if saldo <= 0:
            raise HTTPException(
                status_code=400,
                detail="O valor de entrada deve ser menor que o lance proposto.",
            )
        financiamento = _simular_financiamento(
            saldo, taxa_juros_anual, prazo_meses, sistema_amortizacao.value
        )

    # Custo de oportunidade (SELIC configurável via .env)
    selic_mensal = (settings.selic_rate_annual / 100) / 12
    custo_oportunidade_12m = custo_total_projeto * ((1 + selic_mensal) ** 12 - 1)

    return {
        "imovel_id":                    imovel.id,
        "titulo":                       imovel.titulo,
        "uf":                           uf,
        "lance_proposto":               lance_proposto,
        "custos_aquisicao_detalhados":  custos,
        "custo_total_projeto":          round(custo_total_projeto, 2),
        "financiamento_simulado":       financiamento,
        "custo_oportunidade_selic": {
            "taxa_selic_anual_pct":  settings.selic_rate_annual,
            "rendimento_12_meses":   round(custo_oportunidade_12m, 2),
        },
    }


@router.get("/tabela-lances", summary="Tabela de 20 lances simulados com ROI")
def gerar_tabela_lances(
    imovel_id: str,
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """
    Gera 20 simulações de lance entre o mínimo e o valor de avaliação.
    Para cada lance calcula: custo total, lucro líquido (deduzido IR 15%)
    e ROI em 3 horizontes com custo de carregamento real (1% a.m.).
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    preco_min  = float(imovel.preco_minimo)
    preco_aval = float(imovel.preco_avaliacao) if imovel.preco_avaliacao else None

    # ── Fix: null-safe validation ──────────────────────────────────────────
    if not preco_aval or preco_aval <= preco_min:
        raise HTTPException(
            status_code=400,
            detail="Imóvel sem valor de avaliação válido cadastrado. "
                   "Cadastre o preço de avaliação para usar a tabela de lances.",
        )

    uf = imovel.estado.upper()
    passo = (preco_aval - preco_min) / 20

    # Taxa de carregamento: IPTU + condomínio estimados (1% a.m. sobre o lance)
    taxa_carregamento_mensal = 0.01

    simulacoes = []
    for i in range(1, 21):
        lance = preco_min + (passo * i)
        if lance > preco_aval:
            break

        custos_base = _calcular_custos_base(lance, uf)
        custo_total = lance + custos_base["total_custos_adicionais"]

        lucro_bruto   = preco_aval - custo_total
        ir             = lucro_bruto * (settings.ir_ganho_capital_pct / 100) if lucro_bruto > 0 else 0.0
        lucro_liquido  = lucro_bruto - ir
        roi_base       = (lucro_liquido / custo_total) * 100 if custo_total > 0 else 0.0
        desagio        = ((preco_aval - lance) / preco_aval) * 100

        # ROI por horizonte considerando custo de carregamento real
        carregamento_6m  = custo_total * taxa_carregamento_mensal * 6
        carregamento_12m = custo_total * taxa_carregamento_mensal * 12
        carregamento_24m = custo_total * taxa_carregamento_mensal * 24

        roi_6m  = ((lucro_liquido - carregamento_6m)  / custo_total) * 100
        roi_12m = ((lucro_liquido - carregamento_12m) / custo_total) * 100
        roi_24m = ((lucro_liquido - carregamento_24m) / custo_total) * 100

        simulacoes.append({
            "indice":              i,
            "lance_simulado":      round(lance, 2),
            "desagio_pct":         round(desagio, 1),
            "custo_total":         round(custo_total, 2),
            "lucro_bruto":         round(lucro_bruto, 2),
            "ir_ganho_capital":    round(ir, 2),
            "lucro_liquido":       round(lucro_liquido, 2),
            "roi_liquido_total_pct": round(roi_base, 1),
            "roi_por_horizonte": {
                "6_meses":  f"{round(roi_6m, 1)}%",
                "12_meses": f"{round(roi_12m, 1)}%",
                "24_meses": f"{round(roi_24m, 1)}%",
            },
        })

    return {
        "imovel_id":              imovel.id,
        "titulo":                 imovel.titulo,
        "valor_avaliacao":        preco_aval,
        "lance_minimo":           preco_min,
        "uf":                     uf,
        "tabela_lances_simulados": simulacoes,
    }


@router.get("/estados", summary="Tabela de custos por estado (todos os 27)")
def listar_custos_por_estado():
    """
    Retorna a tabela completa de custos de ITBI, emolumentos e laudêmio
    para todos os 27 estados brasileiros. Útil para comparação de custo de aquisição.
    """
    return {
        "estados": [
            {"uf": uf, **dados}
            for uf, dados in TABELA_CUSTOS_ESTADOS.items()
            if uf != "DEFAULT"
        ]
    }
