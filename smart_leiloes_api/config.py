"""
Configurações centrais da Smart Leilões API v3.
Lê variáveis de ambiente via pydantic-settings, com fallbacks seguros.
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Banco de Dados ────────────────────────────────────────────────────────
    # Em produção: postgresql://user:pass@host.supabase.co:5432/postgres
    # Em desenvolvimento: sqlite:///./leiloes_v3.db
    database_url: str = "sqlite:///./leiloes_v3.db"

    # ── Supabase (opcional para Auth/Storage futuros) ─────────────────────────
    supabase_url: str = ""
    supabase_service_key: str = ""

    # ── Segurança ─────────────────────────────────────────────────────────────
    admin_secret_key: str = "troque_antes_de_ir_para_producao"

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Em produção: "https://g2auction.com.br,https://fliplink.smartleiloes.com.br"
    cors_origins: str = "*"

    # ── Ambiente ──────────────────────────────────────────────────────────────
    environment: str = "development"       # development | production
    api_version: str = "3.0.0"
    log_level: str = "INFO"

    # ── Calculadora (atualizável sem deploy) ──────────────────────────────────
    selic_rate_annual: float = 10.75       # % a.a. — atualizar conforme BACEN
    comissao_leiloeiro_pct: float = 5.0    # % obrigatório por lei
    ir_ganho_capital_pct: float = 15.0     # % alíquota simplificada

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    plan_limits: dict = {
        "FREE": 100,
        "STARTER": 5_000,
        "PROFESSIONAL": 25_000,
        "ENTERPRISE": 999_999_999,
    }

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if self.cors_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.database_url.lower()


@lru_cache()
def get_settings() -> Settings:
    """Singleton cacheado — uma única instância durante toda a vida da app."""
    return Settings()
