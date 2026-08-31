"""
Dependências injetáveis da Smart Leilões API v3.

Inclui:
- get_db: sessão de banco de dados
- verify_api_key: autenticação + rate limiting atômico (sem race condition)
- verify_admin: proteção de endpoints administrativos
"""
import logging
from datetime import datetime

from fastapi import Depends, HTTPException, Header, status
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from sqlalchemy import update

from smart_leiloes_api.models import SessionLocal, ApiKeyModel
from smart_leiloes_api.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

API_KEY_HEADER_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=True)


# ── Sessão de Banco de Dados ────────────────────────────────────────────────
def get_db():
    """Gerador de sessão SQLAlchemy com fechamento garantido."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Autenticação e Rate Limiting ────────────────────────────────────────────
def verify_api_key(
    api_key: str = Depends(api_key_header),
    db: Session = Depends(get_db),
) -> ApiKeyModel:
    """
    Valida a API Key e aplica rate limiting.

    Correções aplicadas vs v2/v3 originais:
    1. Incremento atômico via UPDATE SQL — sem race condition em múltiplos workers.
    2. Reset automático se a chave está num novo mês (evita bloqueio permanente).
    3. Log de acesso negado para auditoria.
    """
    key_record = (
        db.query(ApiKeyModel)
        .filter(ApiKeyModel.key == api_key, ApiKeyModel.active == True)
        .first()
    )

    if not key_record:
        logger.warning("Tentativa de acesso com API Key inválida: %s...", api_key[:8])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key inválida ou inativa. Registre-se em POST /api/v3/admin/register",
        )

    # ── Reset automático mensal ─────────────────────────────────────────────
    now = datetime.utcnow()
    if (
        key_record.last_reset_at is None
        or key_record.last_reset_at.month != now.month
        or key_record.last_reset_at.year != now.year
    ):
        db.execute(
            update(ApiKeyModel)
            .where(ApiKeyModel.id == key_record.id)
            .values(requests_count=0, last_reset_at=now)
        )
        db.commit()
        db.refresh(key_record)

    # ── Verificação de limite ───────────────────────────────────────────────
    if key_record.requests_count >= key_record.monthly_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Limite mensal de {key_record.monthly_limit} requisições atingido "
                f"para o plano {key_record.plan}. "
                "Faça upgrade em g2auction.com.br/planos"
            ),
            headers={"X-RateLimit-Plan": key_record.plan,
                     "X-RateLimit-Limit": str(key_record.monthly_limit),
                     "X-RateLimit-Remaining": "0"},
        )

    # ── Incremento atômico (sem race condition) ─────────────────────────────
    db.execute(
        update(ApiKeyModel)
        .where(ApiKeyModel.id == key_record.id)
        .values(requests_count=ApiKeyModel.requests_count + 1)
    )
    db.commit()
    db.refresh(key_record)

    return key_record


# ── Autenticação Administrativa ─────────────────────────────────────────────
def verify_admin(
    x_admin_key: str = Header(..., alias="X-Admin-Key"),
) -> bool:
    """
    Protege endpoints administrativos (criação de keys, sync de scrapers).
    Usa header dedicado para não confundir com a API Key de usuário.
    """
    admin_secret = settings.admin_secret_key
    if not admin_secret or x_admin_key != admin_secret:
        logger.warning("Tentativa de acesso admin não autorizado.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso administrativo não autorizado.",
        )
    return True
