"""
Router: Imóveis
Endpoints de listagem paginada e ingestão (importação) de imóveis.
Consumido pelo PWA, extensão de navegador e scrapers automatizados.
"""
import uuid
import math
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from smart_leiloes_api.models import ImovelModel, ApiKeyModel
from smart_leiloes_api.schemas import (
    ImovelCreate, ImovelResponse, ImovelListResponse, EtapaKanban
)
from smart_leiloes_api.dependencies import get_db, verify_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/imoveis", tags=["Imóveis"])


@router.get(
    "",
    response_model=ImovelListResponse,
    summary="Listar imóveis com filtros e paginação",
)
def listar_imoveis(
    # ── Filtros ────────────────────────────────────────────────────────────
    estado:        Optional[str]  = Query(None, min_length=2, max_length=2,
                                          description="Sigla do estado (UF) — ex: SP, RJ"),
    cidade:        Optional[str]  = Query(None, description="Nome da cidade (busca parcial)"),
    comitente:     Optional[str]  = Query(None, description="Ex: CAIXA, PESTANA"),
    tipo_imovel:   Optional[str]  = Query(None, description="apartamento | casa | terreno | comercial"),
    preco_min:     Optional[float] = Query(None, ge=0, description="Lance mínimo em R$"),
    preco_max:     Optional[float] = Query(None, ge=0, description="Lance máximo em R$"),
    etapa_kanban:  Optional[EtapaKanban] = Query(None),
    aceita_financiamento: Optional[bool] = Query(None),
    # ── Paginação ──────────────────────────────────────────────────────────
    page:          int  = Query(1,  ge=1,   description="Página (começa em 1)"),
    limit:         int  = Query(20, ge=1, le=100, description="Registros por página (máx 100)"),
    # ── Auth ───────────────────────────────────────────────────────────────
    db:            Session     = Depends(get_db),
    api_info:      ApiKeyModel = Depends(verify_api_key),
):
    """
    Retorna o catálogo consolidado de imóveis ativos.
    Suporta filtros por UF, cidade, comitente, tipo, faixa de preço e etapa do Kanban.
    Resultados paginados para evitar payloads gigantes.
    """
    query = db.query(ImovelModel).filter(ImovelModel.ativo == True)

    if estado:
        query = query.filter(ImovelModel.estado == estado.strip().upper())
    if cidade:
        query = query.filter(ImovelModel.cidade.ilike(f"%{cidade.strip()}%"))
    if comitente:
        query = query.filter(ImovelModel.comitente == comitente.strip().upper())
    if tipo_imovel:
        query = query.filter(ImovelModel.tipo_imovel.ilike(f"%{tipo_imovel.strip()}%"))
    if preco_min is not None:
        query = query.filter(ImovelModel.preco_minimo >= preco_min)
    if preco_max is not None:
        query = query.filter(ImovelModel.preco_minimo <= preco_max)
    if etapa_kanban:
        query = query.filter(ImovelModel.etapa_kanban == etapa_kanban.value)
    if aceita_financiamento is not None:
        query = query.filter(ImovelModel.aceita_financiamento == aceita_financiamento)

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit

    imoveis = query.order_by(ImovelModel.data_captura.desc()).offset(offset).limit(limit).all()

    return ImovelListResponse(
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        imoveis=imoveis,
    )


@router.get(
    "/{imovel_id}",
    response_model=ImovelResponse,
    summary="Detalhe de um imóvel",
)
def detalhe_imovel(
    imovel_id:  str,
    db:         Session     = Depends(get_db),
    api_info:   ApiKeyModel = Depends(verify_api_key),
):
    """Retorna todos os dados de um imóvel específico pelo seu ID (UUID)."""
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")
    return imovel


@router.post(
    "/importar",
    status_code=status.HTTP_201_CREATED,
    summary="Importar / ingerir um imóvel",
)
def importar_imovel(
    imovel:    ImovelCreate,
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """
    Endpoint de ingestão de dados consumido pela Extensão de Navegador
    e por scrapers automatizados.

    Garante integridade via `link_origem` (chave de deduplicação):
    - Se já existir: atualiza campos relevantes e retorna `"status": "atualizado"`
    - Se for novo:   cria e retorna `"status": "criado"`
    """
    link_str = str(imovel.link_origem)

    existente = db.query(ImovelModel).filter(ImovelModel.link_origem == link_str).first()
    if existente:
        # Atualiza campos que podem mudar (preços, datas de leilão, status)
        existente.preco_minimo = imovel.preco_minimo
        if imovel.preco_avaliacao:
            existente.preco_avaliacao = imovel.preco_avaliacao
        if imovel.data_leilao_1:
            existente.data_leilao_1 = imovel.data_leilao_1
        if imovel.data_leilao_2:
            existente.data_leilao_2 = imovel.data_leilao_2
        db.commit()
        logger.info("Imóvel atualizado: %s", existente.id)
        return {"status": "atualizado", "imovel_id": existente.id}

    # Calcula desconto automaticamente
    desconto = None
    if imovel.preco_avaliacao and imovel.preco_avaliacao > 0:
        desconto = round(
            ((imovel.preco_avaliacao - imovel.preco_minimo) / imovel.preco_avaliacao) * 100, 2
        )

    novo_imovel = ImovelModel(
        id=str(uuid.uuid4()),
        comitente=imovel.comitente,
        titulo=imovel.titulo,
        estado=imovel.estado.value,
        cidade=imovel.cidade,
        bairro=imovel.bairro,
        endereco=imovel.endereco,
        tipo_imovel=imovel.tipo_imovel,
        preco_avaliacao=imovel.preco_avaliacao,
        preco_minimo=imovel.preco_minimo,
        desconto_percentual=desconto,
        link_origem=link_str,
        link_edital=str(imovel.link_edital) if imovel.link_edital else None,
        link_matricula=str(imovel.link_matricula) if imovel.link_matricula else None,
        foto_principal=str(imovel.foto_principal) if imovel.foto_principal else None,
        descricao=imovel.descricao,
        data_leilao_1=imovel.data_leilao_1,
        data_leilao_2=imovel.data_leilao_2,
        aceita_financiamento=imovel.aceita_financiamento,
        ocupacao=imovel.ocupacao.value if imovel.ocupacao else "DESCONHECIDA",
        area_total=imovel.area_total,
        area_privativa=imovel.area_privativa,
        quartos=imovel.quartos,
        vagas_garagem=imovel.vagas_garagem,
        source_property_id=imovel.source_property_id,
        etapa_kanban="estoque",
    )
    db.add(novo_imovel)
    db.commit()
    db.refresh(novo_imovel)
    logger.info("Imóvel criado: %s (%s)", novo_imovel.id, imovel.titulo[:50])
    return {"status": "criado", "imovel_id": novo_imovel.id}


@router.put(
    "/{imovel_id}/kanban",
    summary="Mover imóvel no Kanban",
)
def atualizar_etapa_kanban(
    imovel_id:  str,
    nova_etapa: EtapaKanban,
    db:         Session     = Depends(get_db),
    api_info:   ApiKeyModel = Depends(verify_api_key),
):
    """Move o imóvel para uma nova etapa do funil Kanban."""
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    imovel.etapa_kanban = nova_etapa.value
    db.commit()
    return {
        "message":    "Etapa Kanban atualizada.",
        "imovel_id":  imovel.id,
        "nova_etapa": imovel.etapa_kanban,
    }
