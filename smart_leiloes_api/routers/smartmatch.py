"""
Router: SmartMatch
Cadastro de cotistas e matching de co-investidores por região.
Inclui associação de cotistas a imóveis específicos (endpoint que faltava na v3 original).
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import insert

from smart_leiloes_api.models import CotistaModel, ImovelModel, ApiKeyModel, imovel_cotista_association
from smart_leiloes_api.schemas import CotistaCreate, CotistaResponse, UF
from smart_leiloes_api.dependencies import get_db, verify_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/smartmatch", tags=["SmartMatch & Cotistas"])


@router.post(
    "/cotistas",
    status_code=status.HTTP_201_CREATED,
    response_model=CotistaResponse,
    summary="Cadastrar investidor cotista",
)
def cadastrar_cotista(
    cotista:  CotistaCreate,
    db:       Session     = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key),
):
    """Registra um novo investidor na plataforma SmartMatch."""
    existente = db.query(CotistaModel).filter(CotistaModel.email == cotista.email).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"Cotista com e-mail '{cotista.email}' já está registrado.",
        )

    novo = CotistaModel(
        nome=cotista.nome,
        email=cotista.email,
        telefone=cotista.telefone,
        regiao_interesse=cotista.regiao_interesse.value if cotista.regiao_interesse else None,
        perfil_risco=cotista.perfil_risco.value if cotista.perfil_risco else "CONSERVADOR",
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    logger.info("Cotista cadastrado: %s (%s)", novo.nome, novo.email)
    return novo


@router.get(
    "/cotistas",
    response_model=list[CotistaResponse],
    summary="Listar todos os cotistas",
)
def listar_cotistas(
    regiao: UF | None = Query(None, description="Filtrar por UF de interesse"),
    db:     Session     = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key),
):
    query = db.query(CotistaModel).filter(CotistaModel.ativo == True)
    if regiao:
        query = query.filter(CotistaModel.regiao_interesse == regiao.value)
    return query.all()


@router.get(
    "/parceiros",
    summary="Buscar co-investidores por região (SmartMatch)",
)
def buscar_parceiros(
    estado:   UF,
    db:       Session     = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key),
):
    """
    SmartMatch Engine: encontra investidores cadastrados interessados
    na mesma UF para formação de grupos de arrematação coletiva.
    """
    parceiros = db.query(CotistaModel).filter(
        CotistaModel.regiao_interesse == estado.value,
        CotistaModel.ativo == True,
    ).all()

    return {
        "regiao_pesquisada":              estado.value,
        "total_parceiros":                len(parceiros),
        "parceiros": [
            {
                "id":           p.id,
                "nome":         p.nome,
                "email":        p.email,
                "telefone":     p.telefone,
                "perfil_risco": p.perfil_risco,
            }
            for p in parceiros
        ],
    }


@router.post(
    "/imoveis/{imovel_id}/cotistas",
    status_code=status.HTTP_201_CREATED,
    summary="Associar cotista a um imóvel (SPE / consórcio)",
)
def associar_cotista_imovel(
    imovel_id:       str,
    cotista_id:      int   = Query(..., description="ID do cotista a associar"),
    percentual_cota: float = Query(..., gt=0, le=100, description="Percentual de participação (ex: 50.0)"),
    db:              Session     = Depends(get_db),
    api_info:        ApiKeyModel = Depends(verify_api_key),
):
    """
    Associa um cotista a um imóvel com percentual de participação definido.
    Este endpoint estava **ausente na v3 original** apesar da tabela M2M existir.
    Valida que a soma das cotas não ultrapasse 100%.
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    cotista = db.query(CotistaModel).filter(CotistaModel.id == cotista_id).first()
    if not cotista:
        raise HTTPException(status_code=404, detail="Cotista não encontrado.")

    # Verifica associação existente
    associacao_existente = db.execute(
        imovel_cotista_association.select().where(
            imovel_cotista_association.c.imovel_id == imovel_id,
            imovel_cotista_association.c.cotista_id == cotista_id,
        )
    ).first()
    if associacao_existente:
        raise HTTPException(status_code=400, detail="Cotista já associado a este imóvel.")

    # Valida soma de cotas
    cotas_atuais = db.execute(
        imovel_cotista_association.select().where(
            imovel_cotista_association.c.imovel_id == imovel_id
        )
    ).fetchall()
    soma_atual = sum(c.percentual_cota for c in cotas_atuais)

    if soma_atual + percentual_cota > 100.0:
        raise HTTPException(
            status_code=400,
            detail=f"Cota inválida. Já há {soma_atual:.1f}% alocados. "
                   f"Disponível: {100.0 - soma_atual:.1f}%.",
        )

    db.execute(
        imovel_cotista_association.insert().values(
            imovel_id=imovel_id,
            cotista_id=cotista_id,
            percentual_cota=percentual_cota,
        )
    )
    db.commit()

    return {
        "message":         "Cotista associado com sucesso.",
        "imovel_id":       imovel_id,
        "cotista_id":      cotista_id,
        "cotista_nome":    cotista.nome,
        "percentual_cota": percentual_cota,
        "soma_cotas_total": soma_atual + percentual_cota,
    }


@router.get(
    "/imoveis/{imovel_id}/cotistas",
    summary="Listar cotistas associados ao imóvel",
)
def listar_cotistas_imovel(
    imovel_id: str,
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    associacoes = db.execute(
        imovel_cotista_association.select().where(
            imovel_cotista_association.c.imovel_id == imovel_id
        )
    ).fetchall()

    resultado = []
    for assoc in associacoes:
        cotista = db.query(CotistaModel).filter(CotistaModel.id == assoc.cotista_id).first()
        if cotista:
            resultado.append({
                "cotista_id":       cotista.id,
                "nome":             cotista.nome,
                "email":            cotista.email,
                "percentual_cota":  assoc.percentual_cota,
                "data_entrada":     assoc.data_entrada,
            })

    soma_total = sum(r["percentual_cota"] for r in resultado)
    return {
        "imovel_id":    imovel_id,
        "cotistas":     resultado,
        "soma_cotas":   soma_total,
        "cota_livre":   round(100.0 - soma_total, 2),
    }
