"""
Router: Gerenciador de Imóveis
Despesas (com rateio por cotistas) e Calendário de Leilões.
"""
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from smart_leiloes_api.models import ImovelModel, DespesaModel, CotistaModel, ApiKeyModel, imovel_cotista_association
from smart_leiloes_api.schemas import DespesaCreate, DespesaResponse
from smart_leiloes_api.dependencies import get_db, verify_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/gerenciador", tags=["Gerenciador"])


# ── Despesas ────────────────────────────────────────────────────────────────

@router.post(
    "/imoveis/{imovel_id}/despesas",
    status_code=status.HTTP_201_CREATED,
    summary="Adicionar despesa ao imóvel",
)
def adicionar_despesa(
    imovel_id: str,
    despesa:   DespesaCreate,
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """
    Registra uma despesa (IPTU, condomínio, reforma, honorários) vinculada ao imóvel.
    Despesas recorrentes são marcadas para controle de caixa mensal.
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    nova = DespesaModel(
        imovel_id=imovel.id,
        descricao=despesa.descricao,
        categoria=despesa.categoria,
        valor=despesa.valor,
        data_vencimento=despesa.data_vencimento,
        recorrente=despesa.recorrente,
    )
    db.add(nova)
    db.commit()
    db.refresh(nova)
    return {"status": "criada", "despesa_id": nova.id, "descricao": nova.descricao, "valor": float(nova.valor)}


@router.get(
    "/imoveis/{imovel_id}/despesas",
    response_model=list[DespesaResponse],
    summary="Listar despesas do imóvel",
)
def listar_despesas(
    imovel_id: str,
    apenas_pendentes: bool = Query(False),
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """Lista todas as despesas registradas para o imóvel."""
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    query = db.query(DespesaModel).filter(DespesaModel.imovel_id == imovel_id)
    if apenas_pendentes:
        query = query.filter(DespesaModel.paga == False)
    return query.order_by(DespesaModel.data_vencimento).all()


@router.put(
    "/despesas/{despesa_id}/pagar",
    summary="Marcar despesa como paga",
)
def marcar_despesa_paga(
    despesa_id: int,
    db:         Session     = Depends(get_db),
    api_info:   ApiKeyModel = Depends(verify_api_key),
):
    despesa = db.query(DespesaModel).filter(DespesaModel.id == despesa_id).first()
    if not despesa:
        raise HTTPException(status_code=404, detail="Despesa não encontrada.")

    despesa.paga = True
    db.commit()
    return {"status": "paga", "despesa_id": despesa.id}


@router.get(
    "/imoveis/{imovel_id}/rateio",
    summary="Ratear despesa entre cotistas do imóvel",
)
def ratear_despesa(
    imovel_id:    str,
    valor_despesa: float = Query(..., gt=0),
    descricao:    str   = Query("Despesa avulsa"),
    db:           Session     = Depends(get_db),
    api_info:     ApiKeyModel = Depends(verify_api_key),
):
    """
    Calcula a divisão proporcional de uma despesa entre os cotistas do imóvel,
    baseando-se nos percentuais registrados na tabela de associação.
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    # Busca cotistas associados via tabela M2M
    associacoes = db.execute(
        imovel_cotista_association.select().where(
            imovel_cotista_association.c.imovel_id == imovel_id
        )
    ).fetchall()

    if not associacoes:
        raise HTTPException(
            status_code=400,
            detail="Este imóvel não possui cotistas registrados para rateio. "
                   "Associe cotistas em /api/v3/smartmatch/imoveis/{id}/cotistas primeiro.",
        )

    rateio = []
    for assoc in associacoes:
        cotista = db.query(CotistaModel).filter(CotistaModel.id == assoc.cotista_id).first()
        if cotista:
            valor_proporcional = valor_despesa * (assoc.percentual_cota / 100.0)
            rateio.append({
                "cotista_id":       cotista.id,
                "cotista_nome":     cotista.nome,
                "cotista_email":    cotista.email,
                "percentual_cota":  f"{assoc.percentual_cota}%",
                "valor_a_pagar":    round(valor_proporcional, 2),
            })

    return {
        "imovel_id":            imovel_id,
        "descricao_despesa":    descricao,
        "valor_total":          valor_despesa,
        "divisao_entre_cotistas": rateio,
    }


# ── Calendário de Leilões ───────────────────────────────────────────────────

@router.get(
    "/calendario",
    summary="Calendário geral de leilões programados",
)
def ver_calendario(
    estado:    Optional[str] = Query(None, min_length=2, max_length=2),
    db:        Session       = Depends(get_db),
    api_info:  ApiKeyModel   = Depends(verify_api_key),
):
    """
    Lista todos os leilões futuros com data definida, ordenados cronologicamente.
    Filtrável por UF para agenda regional.
    """
    agora = datetime.utcnow()

    query = db.query(ImovelModel).filter(
        ImovelModel.ativo == True,
        (ImovelModel.data_leilao_1 != None) | (ImovelModel.data_leilao_2 != None),
    )

    if estado:
        query = query.filter(ImovelModel.estado == estado.upper())

    imoveis = query.all()

    eventos = []
    for imovel in imoveis:
        if imovel.data_leilao_1 and imovel.data_leilao_1 >= agora:
            eventos.append({
                "imovel_id":    imovel.id,
                "titulo":       imovel.titulo,
                "estado":       imovel.estado,
                "cidade":       imovel.cidade,
                "evento":       "1º Leilão",
                "data":         imovel.data_leilao_1,
                "preco":        float(imovel.preco_avaliacao) if imovel.preco_avaliacao else None,
                "link_edital":  imovel.link_edital,
            })
        if imovel.data_leilao_2 and imovel.data_leilao_2 >= agora:
            eventos.append({
                "imovel_id":    imovel.id,
                "titulo":       imovel.titulo,
                "estado":       imovel.estado,
                "cidade":       imovel.cidade,
                "evento":       "2º Leilão (Lance Mínimo)",
                "data":         imovel.data_leilao_2,
                "preco":        float(imovel.preco_minimo),
                "link_edital":  imovel.link_edital,
            })

    eventos_ordenados = sorted(eventos, key=lambda x: x["data"])
    return {
        "total_eventos":  len(eventos_ordenados),
        "agenda_leiloes": eventos_ordenados,
    }
