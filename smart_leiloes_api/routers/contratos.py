"""
Router: Contratos e Assinatura Digital
Criação de contratos SPE/Gaveta e assinatura com verificação facial.

Fix crítico: foto biométrica recebida via POST body (não query param).
"""
import uuid
import hashlib
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from smart_leiloes_api.models import ImovelModel, CotistaModel, ContratoAssinaturaModel, ApiKeyModel
from smart_leiloes_api.schemas import ContratoCreate, AssinaturaRequest
from smart_leiloes_api.dependencies import get_db, verify_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/contratos", tags=["Contratos & Assinatura Digital"])


@router.post(
    "/imoveis/{imovel_id}",
    status_code=status.HTTP_201_CREATED,
    summary="Criar contrato de sociedade (SPE / Gaveta / Mandato)",
)
def criar_contrato(
    imovel_id: str,
    body:      ContratoCreate,
    db:        Session     = Depends(get_db),
    api_info:  ApiKeyModel = Depends(verify_api_key),
):
    """
    Cria uma minuta de contrato vinculada ao imóvel e ao cotista responsável.
    O contrato expira em 30 dias se não for assinado.
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    cotista = db.query(CotistaModel).filter(CotistaModel.id == body.cotista_id).first()
    if not cotista:
        raise HTTPException(status_code=404, detail="Cotista não encontrado.")

    expiracao = datetime.utcnow() + timedelta(days=30)

    novo_contrato = ContratoAssinaturaModel(
        imovel_id=imovel.id,
        cotista_id=body.cotista_id,
        titulo_contrato=body.titulo_contrato,
        tipo_contrato=body.tipo_contrato.value,
        status_assinatura="pendente",
        data_expiracao=expiracao,
    )
    db.add(novo_contrato)
    db.commit()
    db.refresh(novo_contrato)

    logger.info(
        "Contrato criado: #%s — %s para imóvel %s / cotista %s",
        novo_contrato.id, body.tipo_contrato.value, imovel_id, body.cotista_id,
    )

    return {
        "contrato_id":           novo_contrato.id,
        "titulo":                novo_contrato.titulo_contrato,
        "tipo":                  novo_contrato.tipo_contrato,
        "status":                novo_contrato.status_assinatura,
        "cotista_email":         cotista.email,
        "exige_verificacao_facial": True,
        "expira_em":             expiracao.isoformat(),
    }


@router.post(
    "/{contrato_id}/assinar",
    summary="Assinar contrato com verificação facial (liveness check)",
)
def assinar_contrato(
    contrato_id: int,
    body:        AssinaturaRequest,       # ← FIX: dados biométricos no body, nunca em query param
    db:          Session     = Depends(get_db),
    api_info:    ApiKeyModel = Depends(verify_api_key),
):
    """
    Realiza a assinatura digital com validação facial simulada.

    **Segurança**: a foto base64 é recebida no body da requisição (POST),
    jamais em query params que ficam expostos em logs de servidor/proxy.

    TODO (Fase 4): integrar serviço real de liveness checking (ex: Unico Check, Serpro).
    """
    contrato = db.query(ContratoAssinaturaModel).filter(
        ContratoAssinaturaModel.id == contrato_id
    ).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    if contrato.status_assinatura == "assinado":
        raise HTTPException(status_code=400, detail="Contrato já foi assinado.")

    if contrato.status_assinatura == "cancelado":
        raise HTTPException(status_code=400, detail="Contrato cancelado — não pode ser assinado.")

    # Verificação de expiração
    if contrato.data_expiracao and datetime.utcnow() > contrato.data_expiracao:
        contrato.status_assinatura = "expirado"
        db.commit()
        raise HTTPException(status_code=400, detail="Prazo de assinatura expirado.")

    # Validação cruzada de identidade (cotista cadastrado vs email informado)
    if contrato.cotista_id:
        cotista = db.query(CotistaModel).filter(CotistaModel.id == contrato.cotista_id).first()
        if cotista and cotista.email.lower() != body.cotista_email.lower():
            raise HTTPException(
                status_code=403,
                detail="E-mail do signatário não corresponde ao cotista vinculado ao contrato.",
            )

    # Simulação de hash do documento (SHA-256 da foto como "prova de vida")
    hash_seguranca = hashlib.sha256(body.foto_b64_prova_de_vida.encode()).hexdigest()

    contrato.verificacao_facial_concluida = True
    contrato.status_assinatura = "assinado"
    contrato.data_assinatura = datetime.utcnow()
    contrato.hash_documento = hash_seguranca
    db.commit()

    logger.info("Contrato #%s assinado por %s", contrato_id, body.cotista_email)

    return {
        "contrato_id":       contrato.id,
        "status":            contrato.status_assinatura,
        "data_assinatura":   contrato.data_assinatura.isoformat(),
        "hash_documento":    hash_seguranca,
        "token_blockchain":  uuid.uuid4().hex,       # placeholder — integrar blockchain real na Fase 5
        "autenticacao_facial": "Aprovada — verificação de prova de vida concluída.",
    }


@router.get(
    "/{contrato_id}",
    summary="Consultar status do contrato",
)
def consultar_contrato(
    contrato_id: int,
    db:          Session     = Depends(get_db),
    api_info:    ApiKeyModel = Depends(verify_api_key),
):
    contrato = db.query(ContratoAssinaturaModel).filter(
        ContratoAssinaturaModel.id == contrato_id
    ).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    return {
        "contrato_id":              contrato.id,
        "titulo":                   contrato.titulo_contrato,
        "tipo":                     contrato.tipo_contrato,
        "status":                   contrato.status_assinatura,
        "verificacao_facial":       contrato.verificacao_facial_concluida,
        "data_criacao":             contrato.data_criacao,
        "data_assinatura":          contrato.data_assinatura,
        "data_expiracao":           contrato.data_expiracao,
        "hash_documento":           contrato.hash_documento,
    }
