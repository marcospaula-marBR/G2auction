"""
Smart Leilões API v3 — Main Application
Engine unificada de alta performance para inteligência, finanças,
captação e gestão de leilões de imóveis no Brasil.

Uso:
    uvicorn smart_leiloes_api.main:app --reload --port 8000
"""
import logging
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from smart_leiloes_api.config import get_settings
from smart_leiloes_api.models import init_db
from smart_leiloes_api.routers import (
    imoveis, calculadora, ia, gerenciador, fliplink, smartmatch, contratos, admin
)

# ── Logging estruturado ────────────────────────────────────────────────────
settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Inicializa banco (SQLite dev / Supabase PostgreSQL produção) ─────────────
init_db()
logger.info("Banco de dados inicializado. URL: %s", settings.database_url[:30] + "...")

# ═══════════════════════════════════════════════════════════════════════════
# APLICAÇÃO FASTAPI
# ═══════════════════════════════════════════════════════════════════════════
app = FastAPI(
    title="G2 Auction Intelligence API",
    description="""
## 🏛️ G2 Auction Intelligence API v3

Engine oficial de alta performance e inteligência analítica para leilões de imóveis no Brasil.

### Módulos disponíveis
- **Imóveis** — Catálogo paginado com filtros avançados, ingestão por scraper/extensão
- **Calculadora Smart** — Custos por UF (27 estados), financiamento SAC/PRICE, tabela de lances com ROI
- **Análise de Risco IA** — Rating 0-100 adaptativo por perfil de investidor
- **Gerenciador** — Kanban de investimento, despesas com rateio por cotistas
- **FlipLink** — Portal de revenda com captura de leads
- **SmartMatch** — Matching de co-investidores por região
- **Contratos** — Assinatura digital com verificação facial
- **Admin** — Gestão de API Keys e sincronização de scrapers

### Autenticação
Use o header `X-API-Key` em todas as requisições (exceto endpoints públicos marcados).
Registre-se em `POST /api/v3/admin/register` para obter sua chave gratuitamente.

### Planos
| Plano | Req/mês | Funcionalidades |
|-------|---------|-----------------|
| FREE | 100 | Listagem, calculadora básica |
| STARTER | 5.000 | + IA, FlipLink, SmartMatch |
| PROFESSIONAL | 25.000 | + Contratos, alertas, sync |
| ENTERPRISE | Ilimitado | Tudo + suporte dedicado |
""",
    version=settings.api_version,
    contact={
        "name":  "G2 Auction",
        "url":   "https://g2auction.com.br",
        "email": "contato@g2auction.com.br",
    },
    license_info={
        "name": "Proprietário — G2 Auction Group",
    },
    openapi_tags=[
        {"name": "Imóveis",              "description": "Catálogo e importação de imóveis"},
        {"name": "Calculadora Smart",     "description": "Custos, financiamento e tabela de lances"},
        {"name": "Inteligência Artificial", "description": "Rating de risco adaptativo"},
        {"name": "Gerenciador",           "description": "Kanban, despesas e calendário"},
        {"name": "FlipLink",              "description": "Portal de revenda e leads"},
        {"name": "SmartMatch & Cotistas", "description": "Co-investimento e matching"},
        {"name": "Contratos & Assinatura Digital", "description": "SPE, Gaveta e assinatura facial"},
        {"name": "Admin (Protegido)",     "description": "API Keys e sincronização (requer X-Admin-Key)"},
    ],
)

# ── CORS — configurável por ambiente via .env ─────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────
app.include_router(imoveis.router)
app.include_router(calculadora.router)
app.include_router(ia.router)
app.include_router(gerenciador.router)
app.include_router(fliplink.router)
app.include_router(smartmatch.router)
app.include_router(contratos.router)
app.include_router(admin.router)


# ── Health & Status ────────────────────────────────────────────────────────
@app.get("/health", tags=["Status"])
def health_check():
    """Endpoint de saúde para monitoramento e load balancers."""
    return {
        "status":      "ok",
        "version":     settings.api_version,
        "environment": settings.environment,
        "timestamp":   datetime.utcnow().isoformat() + "Z",
    }


@app.get("/", tags=["Status"])
def root():
    return {
        "message":  "Smart Leilões API v3 — Online",
        "docs":     "/docs",
        "redoc":    "/redoc",
        "health":   "/health",
        "registro": "/api/v3/admin/register",
    }
