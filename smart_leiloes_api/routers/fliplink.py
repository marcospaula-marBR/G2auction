"""
Router: FlipLink
Portal próprio de revenda com captura de leads (endpoint público sem auth).
"""
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from smart_leiloes_api.models import ImovelModel, LeadModel, ApiKeyModel
from smart_leiloes_api.schemas import FlipLinkAtivar, LeadCreate
from smart_leiloes_api.dependencies import get_db, verify_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/fliplink", tags=["FlipLink"])

PORTAIS_SINCRONIZADOS = ["ZAP Imóveis", "OLX", "Viva Real", "Chaves na Mão"]


@router.post(
    "/imoveis/{imovel_id}/ativar",
    summary="Ativar portal FlipLink de revenda",
)
def ativar_fliplink(
    imovel_id: str,
    body:      FlipLinkAtivar,            # preço de venda no body (não em query param)
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """
    Ativa o portal próprio de revenda (FlipLink) para o imóvel.
    Gera slug único e simula sincronização com portais imobiliários.
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    if imovel.fliplink_ativo:
        return {
            "message":   "FlipLink já está ativo.",
            "portal_url": f"https://fliplink.smartleiloes.com.br/venda/{imovel.fliplink_slug}",
            "preco_venda": float(imovel.preco_venda_fliplink),
        }

    imovel.fliplink_ativo        = True
    imovel.fliplink_slug         = f"imovel-{imovel.estado.lower()}-{uuid.uuid4().hex[:8]}"
    imovel.preco_venda_fliplink  = body.preco_venda
    db.commit()

    logger.info("FlipLink ativado: %s → slug=%s", imovel.id, imovel.fliplink_slug)

    return {
        "message":                  "FlipLink ativado com sucesso!",
        "portal_url":               f"https://fliplink.smartleiloes.com.br/venda/{imovel.fliplink_slug}",
        "preco_venda":              body.preco_venda,
        "distribuidores_sincronizados": PORTAIS_SINCRONIZADOS,
    }


@router.delete(
    "/imoveis/{imovel_id}/desativar",
    summary="Desativar FlipLink",
)
def desativar_fliplink(
    imovel_id: str,
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    imovel.fliplink_ativo = False
    db.commit()
    return {"message": "FlipLink desativado.", "imovel_id": imovel_id}


@router.post(
    "/{slug}/lead",
    status_code=status.HTTP_201_CREATED,
    summary="Capturar lead (público — sem API Key)",
)
def cadastrar_lead(
    slug: str,
    lead: LeadCreate,
    db:   Session = Depends(get_db),
    # SEM verify_api_key — endpoint público para o portal de revenda
):
    """
    Endpoint público (sem autenticação) para captar contatos de interessados
    via portal FlipLink. Qualquer visitante do portal pode enviar contato.
    """
    imovel = db.query(ImovelModel).filter(
        ImovelModel.fliplink_slug  == slug,
        ImovelModel.fliplink_ativo == True,
    ).first()

    if not imovel:
        raise HTTPException(
            status_code=404,
            detail="Portal FlipLink inativo ou não encontrado para este anúncio.",
        )

    novo_lead = LeadModel(
        imovel_id    = imovel.id,
        nome         = lead.nome,
        email        = lead.email,
        telefone     = lead.telefone,
        mensagem     = lead.mensagem,
        origem_lead  = lead.origem_lead or "fliplink",
    )
    db.add(novo_lead)
    db.commit()

    logger.info("Novo lead recebido: %s → imóvel %s", lead.email, imovel.id)
    return {
        "message": "Contato enviado com sucesso! "
                   "O responsável pelo imóvel entrará em contato em breve.",
    }


@router.get(
    "/imoveis/{imovel_id}/leads",
    summary="Listar leads recebidos pelo FlipLink",
)
def listar_leads(
    imovel_id: str,
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """Retorna todos os leads capturados pelo portal FlipLink do imóvel."""
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    leads = db.query(LeadModel).filter(LeadModel.imovel_id == imovel_id).all()
    return {
        "imovel_id":     imovel_id,
        "total_leads":   len(leads),
        "leads":         [
            {
                "id":              l.id,
                "nome":            l.nome,
                "email":           l.email,
                "telefone":        l.telefone,
                "mensagem":        l.mensagem,
                "origem":          l.origem_lead,
                "data_recebimento": l.data_recebimento,
            }
            for l in leads
        ],
    }
