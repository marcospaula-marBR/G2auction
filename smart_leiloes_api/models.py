"""
Modelos ORM (SQLAlchemy) da Smart Leilões API v3.

Schema adaptado ao Supabase existente (tabela `properties`) + tabelas novas
para funcionalidades exclusivas da API (api_keys, cotistas, despesas,
leads, fliplink, contratos).

IMPORTANTE: A tabela `properties` (imóveis) usa UUID como PK para ser
compatível com o schema Supabase já em produção (migration 001).
As tabelas novas da API usam Integer autoincrement por simplicidade de join.
"""
import uuid
from datetime import datetime, date
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime, Date,
    Boolean, ForeignKey, Table, Text, Numeric, Index
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.sql import func

from smart_leiloes_api.config import get_settings

settings = get_settings()

# ── Engine ─────────────────────────────────────────────────────────────────
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.is_sqlite else {},
    pool_pre_ping=True,          # reconecta automaticamente após idle
    pool_recycle=300,            # recicla conexões a cada 5 min
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Tabela de Associação M2M: Imóvel ↔ Cotistas ────────────────────────────
imovel_cotista_association = Table(
    "imovel_cotistas",
    Base.metadata,
    Column("imovel_id", String, ForeignKey("imoveis.id", ondelete="CASCADE"), primary_key=True),
    Column("cotista_id", Integer, ForeignKey("cotistas.id", ondelete="CASCADE"), primary_key=True),
    Column("percentual_cota", Float, nullable=False, comment="Ex: 50.0 para 50%"),
    Column("data_entrada", DateTime, default=datetime.utcnow),
)


# ═══════════════════════════════════════════════════════════════════════════
# MODELO PRINCIPAL DE IMÓVEL
# Compatível com a tabela `properties` já existente no Supabase
# (migration 001_create_properties_schema.sql)
# ═══════════════════════════════════════════════════════════════════════════
class ImovelModel(Base):
    """
    Mapeado para a tabela `imoveis` — alias configurável.
    Em produção (Supabase) esta tabela se chama `properties`.
    """
    __tablename__ = "imoveis"

    # PK como string UUID — compatível com gen_random_uuid() do Supabase
    id = Column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    # ── Identificação e Fonte ────────────────────────────────────────────
    comitente        = Column(String(100), index=True, default="CAIXA",
                              comment="CAIXA, Pestana, Zukerman, Mega Leilões, etc.")
    source_property_id = Column(String(50), nullable=True, index=True,
                                comment="ID interno do leiloeiro de origem (ex: caixa_id)")
    titulo           = Column(String(500), nullable=False)
    tipo_imovel      = Column(String(50), nullable=True,
                              comment="apartamento, casa, terreno, comercial, rural")

    # ── Localização ──────────────────────────────────────────────────────
    estado           = Column(String(2), index=True, nullable=False,
                              comment="UF — 27 estados suportados")
    cidade           = Column(String(200), index=True)
    bairro           = Column(String(200))
    endereco         = Column(String(500))
    lat              = Column(Float, nullable=True)
    lng              = Column(Float, nullable=True)

    # ── Valores ──────────────────────────────────────────────────────────
    preco_avaliacao  = Column(Numeric(14, 2), nullable=True)
    preco_minimo     = Column(Numeric(14, 2), nullable=False,
                              comment="Lance mínimo / preço de venda direta")
    desconto_percentual = Column(Numeric(8, 2), nullable=True)

    # ── Características ──────────────────────────────────────────────────
    area_total       = Column(Numeric(12, 2), nullable=True)
    area_privativa   = Column(Numeric(12, 2), nullable=True)
    quartos          = Column(Integer, nullable=True)
    vagas_garagem    = Column(Integer, nullable=True)
    aceita_financiamento = Column(Boolean, nullable=True)
    ocupacao         = Column(String(50), default="DESCONHECIDA",
                              comment="OCUPADO, DESOCUPADO, DESCONHECIDA")

    # ── Datas de Leilão ───────────────────────────────────────────────────
    data_leilao_1    = Column(DateTime, nullable=True)
    data_leilao_2    = Column(DateTime, nullable=True)

    # ── Documentação ─────────────────────────────────────────────────────
    link_edital      = Column(String(1000), nullable=True)
    link_matricula   = Column(String(1000), nullable=True)
    link_origem      = Column(String(1000), unique=True, index=True, nullable=False,
                              comment="URL única da página do leiloeiro — chave de deduplicação")
    foto_principal   = Column(String(1000), nullable=True)
    descricao        = Column(Text, nullable=True)

    # ── Kanban (etapas do funil de investimento) ─────────────────────────
    etapa_kanban     = Column(String(50), default="estoque", index=True,
                              comment="estoque | triagem_financeira | triagem_juridica | "
                                      "decisao | leilao | registro | desocupacao | reforma | venda")

    # ── Controle ─────────────────────────────────────────────────────────
    ativo            = Column(Boolean, default=True, index=True)
    data_captura     = Column(DateTime, default=datetime.utcnow)
    data_atualizacao = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── FlipLink (portal de revenda próprio) ─────────────────────────────
    fliplink_ativo   = Column(Boolean, default=False)
    fliplink_slug    = Column(String(100), unique=True, index=True, nullable=True)
    preco_venda_fliplink = Column(Numeric(14, 2), nullable=True)

    # ── Relacionamentos ───────────────────────────────────────────────────
    leads    = relationship("LeadModel",    back_populates="imovel", cascade="all, delete-orphan")
    despesas = relationship("DespesaModel", back_populates="imovel", cascade="all, delete-orphan")
    contratos = relationship("ContratoAssinaturaModel", back_populates="imovel", cascade="all, delete-orphan")
    cotistas  = relationship("CotistaModel", secondary=imovel_cotista_association, back_populates="imoveis")

    __table_args__ = (
        Index("idx_imoveis_estado_cidade", "estado", "cidade"),
        Index("idx_imoveis_preco_min", "preco_minimo"),
        Index("idx_imoveis_comitente_ativo", "comitente", "ativo"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# API KEYS — Monetização / Rate Limiting
# ═══════════════════════════════════════════════════════════════════════════
class ApiKeyModel(Base):
    __tablename__ = "api_keys"

    id              = Column(Integer, primary_key=True, index=True)
    key             = Column(String(80), unique=True, index=True, nullable=False)
    owner_email     = Column(String(320), nullable=False, index=True)
    plan            = Column(String(20), default="FREE",
                             comment="FREE | STARTER | PROFESSIONAL | ENTERPRISE")
    requests_count  = Column(Integer, default=0)
    monthly_limit   = Column(Integer, default=100)
    active          = Column(Boolean, default=True)
    last_reset_at   = Column(DateTime, default=datetime.utcnow,
                             comment="Data do último reset mensal de cota")
    created_at      = Column(DateTime, default=datetime.utcnow)


# ═══════════════════════════════════════════════════════════════════════════
# COTISTAS — Investidores para co-investimento e SmartMatch
# ═══════════════════════════════════════════════════════════════════════════
class CotistaModel(Base):
    __tablename__ = "cotistas"

    id                = Column(Integer, primary_key=True, index=True)
    nome              = Column(String(200), nullable=False)
    email             = Column(String(320), unique=True, index=True, nullable=False)
    telefone          = Column(String(20), nullable=True)
    regiao_interesse  = Column(String(2), nullable=True, index=True,
                               comment="UF de preferência para SmartMatch")
    perfil_risco      = Column(String(20), default="CONSERVADOR",
                               comment="CONSERVADOR | ARROJADO")
    ativo             = Column(Boolean, default=True)
    criado_em         = Column(DateTime, default=datetime.utcnow)

    imoveis = relationship("ImovelModel", secondary=imovel_cotista_association, back_populates="cotistas")


# ═══════════════════════════════════════════════════════════════════════════
# DESPESAS — Controle financeiro por imóvel (rateio entre cotistas)
# ═══════════════════════════════════════════════════════════════════════════
class DespesaModel(Base):
    __tablename__ = "despesas"

    id               = Column(Integer, primary_key=True, index=True)
    imovel_id        = Column(String(36), ForeignKey("imoveis.id", ondelete="CASCADE"), nullable=False)
    descricao        = Column(String(300), nullable=False)
    categoria        = Column(String(50), nullable=True,
                              comment="condominio | iptu | reforma | honorarios | outros")
    valor            = Column(Numeric(14, 2), nullable=False)
    data_vencimento  = Column(Date, nullable=False)
    paga             = Column(Boolean, default=False)
    recorrente       = Column(Boolean, default=False,
                              comment="Despesas recorrentes (ex: condomínio mensal)")
    criado_em        = Column(DateTime, default=datetime.utcnow)

    imovel = relationship("ImovelModel", back_populates="despesas")


# ═══════════════════════════════════════════════════════════════════════════
# LEADS — Contatos de interessados no FlipLink
# ═══════════════════════════════════════════════════════════════════════════
class LeadModel(Base):
    __tablename__ = "leads"

    id               = Column(Integer, primary_key=True, index=True)
    imovel_id        = Column(String(36), ForeignKey("imoveis.id", ondelete="CASCADE"), nullable=False)
    nome             = Column(String(200), nullable=False)
    email            = Column(String(320), nullable=False)
    telefone         = Column(String(20), nullable=False)
    mensagem         = Column(Text, nullable=True)
    origem_lead      = Column(String(50), default="fliplink",
                              comment="fliplink | zap | olx | vivareal | direto")
    data_recebimento = Column(DateTime, default=datetime.utcnow)

    imovel = relationship("ImovelModel", back_populates="leads")


# ═══════════════════════════════════════════════════════════════════════════
# CONTRATOS — Assinatura Digital / SPE
# ═══════════════════════════════════════════════════════════════════════════
class ContratoAssinaturaModel(Base):
    __tablename__ = "contratos"

    id                          = Column(Integer, primary_key=True, index=True)
    imovel_id                   = Column(String(36), ForeignKey("imoveis.id", ondelete="CASCADE"), nullable=False)
    cotista_id                  = Column(Integer, ForeignKey("cotistas.id", ondelete="SET NULL"), nullable=True,
                                         comment="Cotista que irá assinar — obrigatório na v3")
    titulo_contrato             = Column(String(300), nullable=False)
    tipo_contrato               = Column(String(50), default="SPE",
                                         comment="SPE | GAVETA | PERMUTA | MANDATO")
    status_assinatura           = Column(String(20), default="pendente",
                                         comment="pendente | assinado | cancelado | expirado")
    verificacao_facial_concluida = Column(Boolean, default=False)
    hash_documento               = Column(String(64), nullable=True,
                                         comment="SHA-256 do documento PDF antes de assinar")
    data_criacao                = Column(DateTime, default=datetime.utcnow)
    data_assinatura             = Column(DateTime, nullable=True)
    data_expiracao              = Column(DateTime, nullable=True,
                                        comment="Prazo limite para assinar")

    imovel   = relationship("ImovelModel",  back_populates="contratos")
    cotista  = relationship("CotistaModel")


# ── Criar tabelas que não existem (SQLite dev / primeira vez) ───────────────
def init_db():
    """
    Cria todas as tabelas no banco configurado.
    Em produção (Supabase/PostgreSQL), use Alembic migrations.
    """
    Base.metadata.create_all(bind=engine)
