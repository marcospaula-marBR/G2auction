"""
Schemas Pydantic da Smart Leilões API v3.

Separação clara entre schemas de entrada (Create/Update) e saída (Response),
evitando o anti-pattern de herança que expõe campos internos.
"""
from __future__ import annotations
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum

from pydantic import BaseModel, HttpUrl, EmailStr, Field, field_validator


# ═══════════════════════════════════════════════════════════════════════════
# ENUMS — Garantia de dados válidos
# ═══════════════════════════════════════════════════════════════════════════

class UF(str, Enum):
    AC="AC"; AL="AL"; AP="AP"; AM="AM"; BA="BA"; CE="CE"; DF="DF"
    ES="ES"; GO="GO"; MA="MA"; MT="MT"; MS="MS"; MG="MG"; PA="PA"
    PB="PB"; PR="PR"; PE="PE"; PI="PI"; RJ="RJ"; RN="RN"; RS="RS"
    RO="RO"; RR="RR"; SC="SC"; SP="SP"; SE="SE"; TO="TO"


class EtapaKanban(str, Enum):
    estoque            = "estoque"
    triagem_financeira = "triagem_financeira"
    triagem_juridica   = "triagem_juridica"
    decisao            = "decisao"
    leilao             = "leilao"
    registro           = "registro"
    desocupacao        = "desocupacao"
    reforma            = "reforma"
    venda              = "venda"


class PlanoAPI(str, Enum):
    FREE         = "FREE"
    STARTER      = "STARTER"
    PROFESSIONAL = "PROFESSIONAL"
    ENTERPRISE   = "ENTERPRISE"


class PerfilRisco(str, Enum):
    CONSERVADOR = "CONSERVADOR"
    ARROJADO    = "ARROJADO"


class SistemaAmortizacao(str, Enum):
    SAC   = "SAC"
    PRICE = "PRICE"


class TipoContrato(str, Enum):
    SPE      = "SPE"
    GAVETA   = "GAVETA"
    PERMUTA  = "PERMUTA"
    MANDATO  = "MANDATO"


class StatusAssinatura(str, Enum):
    pendente  = "pendente"
    assinado  = "assinado"
    cancelado = "cancelado"
    expirado  = "expirado"


class OcupacaoImovel(str, Enum):
    OCUPADO      = "OCUPADO"
    DESOCUPADO   = "DESOCUPADO"
    DESCONHECIDA = "DESCONHECIDA"


# ═══════════════════════════════════════════════════════════════════════════
# IMÓVEIS
# ═══════════════════════════════════════════════════════════════════════════

class ImovelCreate(BaseModel):
    """Schema de entrada para importação de um imóvel."""
    comitente:            str             = Field(..., min_length=1, max_length=100, examples=["CAIXA"])
    titulo:               str             = Field(..., min_length=3, max_length=500)
    estado:               UF
    cidade:               str             = Field(..., min_length=2, max_length=200)
    bairro:               Optional[str]   = Field(None, max_length=200)
    endereco:             Optional[str]   = Field(None, max_length=500)
    tipo_imovel:          Optional[str]   = Field(None, examples=["apartamento", "casa", "terreno"])
    preco_avaliacao:      Optional[float] = Field(None, gt=0)
    preco_minimo:         float           = Field(..., gt=0)
    link_origem:          HttpUrl
    link_edital:          Optional[HttpUrl] = None
    link_matricula:       Optional[HttpUrl] = None
    foto_principal:       Optional[HttpUrl] = None
    descricao:            Optional[str]   = None
    data_leilao_1:        Optional[datetime] = None
    data_leilao_2:        Optional[datetime] = None
    aceita_financiamento: Optional[bool]  = None
    ocupacao:             Optional[OcupacaoImovel] = OcupacaoImovel.DESCONHECIDA
    area_total:           Optional[float] = Field(None, gt=0)
    area_privativa:       Optional[float] = Field(None, gt=0)
    quartos:              Optional[int]   = Field(None, ge=0)
    vagas_garagem:        Optional[int]   = Field(None, ge=0)
    source_property_id:   Optional[str]  = None

    @field_validator("comitente")
    @classmethod
    def upper_comitente(cls, v: str) -> str:
        return v.strip().upper()


class ImovelResponse(BaseModel):
    """Schema de saída — somente o que o consumidor da API precisa ver."""
    id:                   str
    comitente:            str
    titulo:               str
    estado:               str
    cidade:               Optional[str]
    bairro:               Optional[str]
    endereco:             Optional[str]
    tipo_imovel:          Optional[str]
    preco_avaliacao:      Optional[float]
    preco_minimo:         float
    desconto_percentual:  Optional[float]
    link_origem:          str
    link_edital:          Optional[str]
    link_matricula:       Optional[str]
    foto_principal:       Optional[str]
    data_leilao_1:        Optional[datetime]
    data_leilao_2:        Optional[datetime]
    etapa_kanban:         str
    ativo:                bool
    data_captura:         datetime
    fliplink_ativo:       bool
    fliplink_slug:        Optional[str]
    aceita_financiamento: Optional[bool]
    ocupacao:             Optional[str]
    area_privativa:       Optional[float]
    quartos:              Optional[int]

    model_config = {"from_attributes": True}


class ImovelListResponse(BaseModel):
    """Wrapper paginado para listagem de imóveis."""
    total:    int
    page:     int
    limit:    int
    pages:    int
    imoveis:  List[ImovelResponse]


# ═══════════════════════════════════════════════════════════════════════════
# LEADS / FLIPLINK
# ═══════════════════════════════════════════════════════════════════════════

class LeadCreate(BaseModel):
    nome:        str           = Field(..., min_length=2, max_length=200)
    email:       EmailStr
    telefone:    str           = Field(..., min_length=8, max_length=20)
    mensagem:    Optional[str] = Field(None, max_length=1000)
    origem_lead: Optional[str] = "fliplink"


class FlipLinkAtivar(BaseModel):
    preco_venda: float = Field(..., gt=0)


# ═══════════════════════════════════════════════════════════════════════════
# DESPESAS
# ═══════════════════════════════════════════════════════════════════════════

class DespesaCreate(BaseModel):
    descricao:       str           = Field(..., min_length=3, max_length=300)
    categoria:       Optional[str] = Field(None, examples=["condominio", "iptu", "reforma"])
    valor:           float         = Field(..., gt=0)
    data_vencimento: date
    recorrente:      Optional[bool] = False


class DespesaResponse(BaseModel):
    id:              int
    descricao:       str
    categoria:       Optional[str]
    valor:           float
    data_vencimento: date
    paga:            bool
    recorrente:      bool

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════
# COTISTAS / SMARTMATCH
# ═══════════════════════════════════════════════════════════════════════════

class CotistaCreate(BaseModel):
    nome:             str           = Field(..., min_length=2, max_length=200)
    email:            EmailStr
    telefone:         Optional[str] = Field(None, max_length=20)
    regiao_interesse: Optional[UF]  = None
    perfil_risco:     Optional[PerfilRisco] = PerfilRisco.CONSERVADOR


class CotistaResponse(BaseModel):
    id:               int
    nome:             str
    email:            str
    telefone:         Optional[str]
    regiao_interesse: Optional[str]
    perfil_risco:     str

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════
# CONTRATOS / ASSINATURA DIGITAL
# ═══════════════════════════════════════════════════════════════════════════

class ContratoCreate(BaseModel):
    titulo_contrato: str          = Field(..., min_length=5, max_length=300)
    tipo_contrato:   TipoContrato = TipoContrato.SPE
    cotista_id:      int          = Field(..., description="ID do cotista responsável pela assinatura")


class AssinaturaRequest(BaseModel):
    """Body seguro para assinatura — dados biométricos nunca em query params."""
    foto_b64_prova_de_vida: str  = Field(..., min_length=100,
                                          description="Foto do signatário codificada em base64 (prova de vida)")
    cotista_email:          str  = Field(..., description="E-mail do cotista para validação cruzada")


# ═══════════════════════════════════════════════════════════════════════════
# CALCULADORA
# ═══════════════════════════════════════════════════════════════════════════

class SimulacaoFinanciamento(BaseModel):
    usar_financiamento:  bool                  = False
    valor_entrada:       float                 = Field(0.0, ge=0)
    taxa_juros_anual:    float                 = Field(10.5, ge=0, le=100)
    prazo_meses:         int                   = Field(240, ge=12, le=420)
    sistema_amortizacao: SistemaAmortizacao    = SistemaAmortizacao.SAC


# ═══════════════════════════════════════════════════════════════════════════
# API KEYS / ADMIN
# ═══════════════════════════════════════════════════════════════════════════

class ApiKeyCreate(BaseModel):
    owner_email: EmailStr
    plano:       PlanoAPI = PlanoAPI.FREE


class ApiKeyResponse(BaseModel):
    owner_email:   str
    api_key:       str
    plano:         str
    monthly_limit: int
    requests_count: int
    active:        bool

    model_config = {"from_attributes": True}


class RegistroClienteRequest(BaseModel):
    """Auto-registro SaaS — cria conta e retorna API Key."""
    nome:  str      = Field(..., min_length=2)
    email: EmailStr
    plano: PlanoAPI = PlanoAPI.FREE
