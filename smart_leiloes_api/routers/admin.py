"""
Router: Admin
Criação de API Keys e triggers manuais de scraping.
TODOS os endpoints exigem X-Admin-Key no header.
"""
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from smart_leiloes_api.models import ApiKeyModel, init_db
from smart_leiloes_api.schemas import ApiKeyCreate, ApiKeyResponse, RegistroClienteRequest, PlanoAPI
from smart_leiloes_api.dependencies import get_db, verify_admin
from smart_leiloes_api.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v3/admin", tags=["Admin (Protegido)"])
settings = get_settings()

LIMITES_PLANOS = {
    PlanoAPI.FREE:         100,
    PlanoAPI.STARTER:      5_000,
    PlanoAPI.PROFESSIONAL: 25_000,
    PlanoAPI.ENTERPRISE:   999_999_999,
}


@router.post(
    "/keys",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiKeyResponse,
    summary="Criar API Key para cliente",
)
def criar_chave_api(
    body:      ApiKeyCreate,
    db:        Session = Depends(get_db),
    _admin:    bool    = Depends(verify_admin),   # ← Fix: protegido por X-Admin-Key
):
    """
    Cria uma nova API Key para um cliente.
    Exige header `X-Admin-Key` com o segredo administrativo.
    """
    existente = db.query(ApiKeyModel).filter(ApiKeyModel.owner_email == body.owner_email).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"Já existe uma API Key ativa para '{body.owner_email}'.",
        )

    nova_key = ApiKeyModel(
        key=f"sl_v3_{uuid.uuid4().hex}",
        owner_email=body.owner_email,
        plan=body.plano.value,
        monthly_limit=LIMITES_PLANOS[body.plano],
        active=True,
    )
    db.add(nova_key)
    db.commit()
    db.refresh(nova_key)

    logger.info("API Key criada: %s — plano %s", body.owner_email, body.plano.value)

    return {
        "owner_email":    nova_key.owner_email,
        "api_key":        nova_key.key,
        "plano":          nova_key.plan,
        "monthly_limit":  nova_key.monthly_limit,
        "requests_count": nova_key.requests_count,
        "active":         nova_key.active,
    }


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    summary="Auto-registro SaaS de cliente (público)",
)
def registrar_cliente(
    body: RegistroClienteRequest,
    db:   Session = Depends(get_db),
    # SEM verify_admin — este é o endpoint público de auto-cadastro
):
    """
    Endpoint público para auto-registro de novos clientes SaaS.
    Cria automaticamente uma conta + API Key no plano selecionado.
    TODO: enviar API Key por e-mail (integrar SendGrid/Resend na Fase 5).
    """
    existente = db.query(ApiKeyModel).filter(ApiKeyModel.owner_email == body.email).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail="E-mail já registrado.",
        )

    nova_key = ApiKeyModel(
        key=f"sl_v3_{uuid.uuid4().hex}",
        owner_email=body.email,
        plan=body.plano.value,
        monthly_limit=LIMITES_PLANOS[body.plano],
        active=True,
    )
    db.add(nova_key)
    db.commit()
    db.refresh(nova_key)

    logger.info("Novo cliente registrado: %s (%s) — plano %s", body.nome, body.email, body.plano.value)

    return {
        "message":     f"Bem-vindo(a), {body.nome}! Sua API Key foi gerada.",
        "api_key":     nova_key.key,
        "plano":       nova_key.plan,
        "limite_mensal": nova_key.monthly_limit,
        "docs_url":    "http://127.0.0.1:8001/docs",
        "aviso":       "Guarde sua API Key com segurança. "
                       "Use o header X-API-Key em todas as requisições.",
    }


@router.post(
    "/sync/caixa",
    summary="Disparar sincronização do scraper da Caixa",
)
def sincronizar_caixa(
    ufs:              list[str]     = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db:               Session       = Depends(get_db),
    _admin:           bool          = Depends(verify_admin),
):
    """
    Dispara manualmente o scraper da Caixa Econômica Federal em background.
    Os imóveis coletados são importados via ORM da API v3.
    Exige X-Admin-Key.
    """
    if not ufs:
        ufs = ["SP", "RJ", "MG", "PR", "RS", "SC", "BA"]

    ufs_upper = [u.strip().upper() for u in ufs]

    def _rodar_scraper(estados: list[str]):
        """Executa o pipeline existente em background."""
        try:
            import sys
            import os
            # Adiciona o root do projeto ao path para importar os módulos existentes
            root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            if root not in sys.path:
                sys.path.insert(0, root)

            from fetch_caixa import coletar_caixa
            registros = coletar_caixa(estados)
            logger.info("[sync/caixa] %d registros coletados para UFs: %s", len(registros), estados)

            # Import via endpoint interno da própria API
            # (evita duplicação de lógica de deduplicação)
            from smart_leiloes_api.models import ImovelModel, SessionLocal
            import uuid as _uuid

            session = SessionLocal()
            novos, atualizados = 0, 0
            for reg in registros:
                link = reg.get("edital_url", "")
                if not link:
                    continue
                existente = session.query(ImovelModel).filter(ImovelModel.link_origem == link).first()
                if existente:
                    atualizados += 1
                    continue
                novo = ImovelModel(
                    id=str(_uuid.uuid4()),
                    comitente="CAIXA",
                    titulo=f"Imóvel {reg.get('modalidade_venda', 'Caixa')} — {reg.get('cidade', '')}",
                    estado=reg.get("uf", "SP"),
                    cidade=reg.get("cidade", ""),
                    bairro=reg.get("bairro", ""),
                    endereco=reg.get("endereco", ""),
                    preco_minimo=float(
                        reg.get("preco_venda", "0")
                        .replace("R$", "").replace(".", "").replace(",", ".").strip() or 0
                    ),
                    link_origem=link,
                    source_property_id=reg.get("caixa_id"),
                    etapa_kanban="estoque",
                )
                session.add(novo)
                novos += 1
            session.commit()
            session.close()
            logger.info("[sync/caixa] Concluído: %d novos, %d atualizados", novos, atualizados)
        except Exception as e:
            logger.error("[sync/caixa] Erro na sincronização: %s", e, exc_info=True)

    background_tasks.add_task(_rodar_scraper, ufs_upper)

    return {
        "message":   f"Sincronização da Caixa disparada em background para: {ufs_upper}",
        "status":    "em_andamento",
    }


@router.post(
    "/reset-quotas",
    summary="Reset manual de quotas mensais (emergência)",
)
def reset_quotas_manual(
    db:     Session = Depends(get_db),
    _admin: bool    = Depends(verify_admin),
):
    """Reset de emergência de todas as quotas. Normalmente feito pelo job automático."""
    from sqlalchemy import update
    from smart_leiloes_api.models import ApiKeyModel as AKM
    from datetime import datetime as dt

    resultado = db.execute(
        update(AKM).values(requests_count=0, last_reset_at=dt.utcnow())
    )
    db.commit()
    logger.warning("Reset manual de quotas executado por admin.")
    return {"message": "Quotas resetadas.", "chaves_atualizadas": resultado.rowcount}
