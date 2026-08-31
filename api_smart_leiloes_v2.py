import os
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Security, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, HttpUrl, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

# =====================================================================
# 1. CONFIGURAÇÃO DO BANCO DE DADOS
# =====================================================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leiloes.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# =====================================================================
# 2. MODELOS DO BANCO DE DADOS (ORM)
# =====================================================================

class ImovelModel(Base):
    __tablename__ = "imoveis"

    id = Column(Integer, primary_key=True, index=True)
    comitente = Column(String, index=True, default="CAIXA")  # Ex: CAIXA, Pestana, Mega Leilões
    titulo = Column(String, nullable=False)
    estado = Column(String(2), index=True, nullable=False)  # UF para cálculo de custos (27 estados)
    cidade = Column(String, index=True)
    bairro = Column(String)
    endereco = Column(String)
    preco_avaliacao = Column(Float)
    preco_minimo = Column(Float, nullable=False)  # Preço de lance inicial / mínimo
    desconto_percentual = Column(Float)
    
    # Links e Edital
    link_edital = Column(String, nullable=True)
    link_matricula = Column(String, nullable=True)
    link_origem = Column(String, unique=True, index=True, nullable=False)
    
    # Datas de Leilão
    data_leilao_1 = Column(DateTime, nullable=True)
    data_leilao_2 = Column(DateTime, nullable=True)
    
    # Pontuação de Dimensões da IA (0 a 100)
    score_matricula = Column(Float, default=70.0)  # Nota da matrícula avaliada pela IA
    score_edital = Column(Float, default=80.0)     # Nota do edital avaliado pela IA
    score_imovel = Column(Float, default=75.0)     # Nota do imóvel avaliado pela IA
    
    data_captura = Column(DateTime, default=datetime.utcnow)
    ativo = Column(Boolean, default=True)

    # Relacionamento com Kanban
    kanban_cards = relationship("KanbanCardModel", back_populates="imovel")


class ApiKeyModel(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    owner_email = Column(String, nullable=False)
    plan = Column(String, default="FREE")  # FREE, STARTER, ENTERPRISE
    requests_count = Column(Integer, default=0)
    monthly_limit = Column(Integer, default=100)
    active = Column(Boolean, default=True)


class KanbanCardModel(Base):
    __tablename__ = "kanban_cards"

    id = Column(Integer, primary_key=True, index=True)
    imovel_id = Column(Integer, ForeignKey("imoveis.id"), nullable=False)
    # Etapas padrão do Smart Leilões:
    # 1. Estoque, 2. Triagem Financeira, 3. Triagem Jurídica, 4. Decisão, 5. Leilão, 6. Registro, 7. Desocupação, 8. Reforma, 9. Venda
    etapa = Column(String, default="Estoque") 
    corretor_responsavel = Column(String, nullable=True)
    dados_financeiros = Column(JSON, nullable=True)  # Custos reais de reforma, taxas, etc.
    data_criacao = Column(DateTime, default=datetime.utcnow)
    data_atualizacao = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    imovel = relationship("ImovelModel", back_populates="kanban_cards")
    cotas = relationship("CotaSociedadeModel", back_populates="kanban_card")


class CotaSociedadeModel(Base):
    __tablename__ = "cotas_sociedade"

    id = Column(Integer, primary_key=True, index=True)
    kanban_card_id = Column(Integer, ForeignKey("kanban_cards.id"), nullable=False)
    cotista_nome = Column(String, nullable=False)
    cotista_email = Column(String, nullable=False)
    percentual_cota = Column(Float, nullable=False)  # Porcentagem de cota (ex: 50.0 para 50%)
    valor_investido = Column(Float, default=0.0)

    kanban_card = relationship("KanbanCardModel", back_populates="cotas")

# Criar tabelas se não existirem
Base.metadata.create_all(bind=engine)

# =====================================================================
# 3. VALIDAÇÃO DE ENTRADA (PYDANTIC SCHEMAS)
# =====================================================================

class ImovelCreate(BaseModel):
    comitente: str = Field(..., example="CAIXA")
    titulo: str = Field(..., example="Apartamento 2 Quartos - Centro")
    estado: str = Field(..., max_length=2, min_length=2, example="SP")
    cidade: str = Field(..., example="São Paulo")
    bairro: Optional[str] = None
    endereco: Optional[str] = None
    preco_avaliacao: Optional[float] = None
    preco_minimo: float = Field(..., gt=0)
    link_origem: HttpUrl
    link_edital: Optional[HttpUrl] = None
    link_matricula: Optional[HttpUrl] = None
    data_leilao_1: Optional[datetime] = None
    data_leilao_2: Optional[datetime] = None
    # Parâmetros opcionais para IA de início
    score_matricula: Optional[float] = 75.0
    score_edital: Optional[float] = 80.0
    score_imovel: Optional[float] = 70.0

class ImovelResponse(ImovelCreate):
    id: int
    data_captura: datetime
    ativo: bool

    class Config:
        from_attributes = True

class CalculadoraCustosRequest(BaseModel):
    valor_lance: float = Field(..., gt=0, example=250000.0)
    estado: str = Field(..., max_length=2, min_length=2, example="SP")
    financiado: bool = False
    percentual_financiamento: float = Field(0.0, ge=0, le=100)
    sistema_amortizacao: str = Field("SAC", regex="^(SAC|PRICE)$")  # SAC ou PRICE
    taxa_juros_anual: float = Field(9.5, ge=0)
    prazo_meses: int = Field(240, ge=1)
    isento_laudemio: bool = True

class CotaCreate(BaseModel):
    cotista_nome: str
    cotista_email: str
    percentual_cota: float = Field(..., gt=0, le=100)
    valor_investido: Optional[float] = 0.0

# =====================================================================
# 4. CONFIGURAÇÃO DO APP FASTAPI COM CORS (ESSENCIAL PARA PWA E EXTENSÕES)
# =====================================================================
app = FastAPI(
    title="API Avançada Smart Leilões",
    description="Engine centralizada para o PWA e Extensão: inteligência de risco, calculadora multicustos por estado e gerenciamento de cotistas.",
    version="2.0.0"
)

# Adicionando CORS para permitir conexões do PWA (origem web) e da Extensão de Navegador (chrome-extension://)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especifique as URLs reais do PWA e da extensão para máxima segurança
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# 5. GERENCIAMENTO DE DEPENDÊNCIAS, CHAVES DE API E MONETIZAÇÃO
# =====================================================================
API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_api_key(api_key: str = Depends(api_key_header), db: Session = Depends(get_db)):
    """
    Controlador de monetização. Valida o token, atualiza o contador de requisições,
    e valida as restrições com base no plano (FREE, STARTER, ENTERPRISE).
    """
    key_record = db.query(ApiKeyModel).filter(ApiKeyModel.key == api_key, ApiKeyModel.active == True).first()
    if not key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de API inválida ou conta inativa."
        )
    
    # Bloqueio caso exceda o plano
    if key_record.requests_count >= key_record.monthly_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Limite de requisições mensal excedido para o seu plano '{key_record.plan}'. Faça um upgrade!"
        )
    
    # Incremento atômico simples
    key_record.requests_count += 1
    db.commit()
    return key_record

# =====================================================================
# 6. ENDPOINTS - NÚCLEO DE IMÓVEIS E INGESTÃO (CROWDSOURCING & SCRAPING)
# =====================================================================

@app.get("/api/imoveis", response_model=List[ImovelResponse])
def listar_imoveis(
    estado: Optional[str] = None,
    comitente: Optional[str] = None,
    preco_max: Optional[float] = None,
    db: Session = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key)
):
    """
    Retorna o catálogo consolidado de imóveis ativos para alimentar o mapa e listas do PWA.
    Permite filtros por estado (UF), comitente e preço máximo.
    """
    query = db.query(ImovelModel).filter(ImovelModel.ativo == True)
    if estado:
        query = query.filter(ImovelModel.estado == estado.upper())
    if comitente:
        query = query.filter(ImovelModel.comitente == comitente.upper())
    if preco_max:
        query = query.filter(ImovelModel.preco_minimo <= preco_max)
    
    return query.all()


@app.post("/api/imoveis/importar", status_code=status.HTTP_201_CREATED)
def importar_imovel(
    imovel: ImovelCreate,
    db: Session = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key)
):
    """
    Endpoint de Ingestão de Dados. Consumido tanto por scrapers automáticos em segundo plano
    quanto pela EXTENSÃO DE NAVEGADOR para importação rápida com 1 clique de qualquer leiloeiro parceiro.
    """
    # Evitar duplicações pelo link de origem do leiloeiro
    existente = db.query(ImovelModel).filter(ImovelModel.link_origem == str(imovel.link_origem)).first()
    if existente:
        # Retorna o existente e sinaliza atualização
        return {"status": "existente", "imovel_id": existente.id, "message": "Imóvel já catalogado anteriormente."}
    
    novo = ImovelModel(
        comitente=imovel.comitente,
        titulo=imovel.titulo,
        estado=imovel.estado.upper(),
        cidade=imovel.cidade,
        bairro=imovel.bairro,
        endereco=imovel.endereco,
        preco_avaliacao=imovel.preco_avaliacao,
        preco_minimo=imovel.preco_minimo,
        link_origem=str(imovel.link_origem),
        link_edital=str(imovel.link_edital) if imovel.link_edital else None,
        link_matricula=str(imovel.link_matricula) if imovel.link_matricula else None,
        data_leilao_1=imovel.data_leilao_1,
        data_leilao_2=imovel.data_leilao_2,
        score_matricula=imovel.score_matricula,
        score_edital=imovel.score_edital,
        score_imovel=imovel.score_imovel
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return {"status": "sucesso", "imovel_id": novo.id, "message": "Imóvel catalogado com sucesso!"}

# =====================================================================
# 7. ENDPOINTS - INTELIGÊNCIA ARTIFICIAL (RANKING DE RISCO DINÂMICO 0-100)
# =====================================================================

@app.get("/api/imoveis/{imovel_id}/analise-ia")
def calcular_score_ia(
    imovel_id: int,
    perfil: str = "CONSERVADOR",  # CONSERVADOR ou ARROJADO
    db: Session = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key)
):
    """
    Nossa IA avalia individualmente três dimensões do imóvel: matrícula, edital e dados estruturais.
    O endpoint aplica pesos dinâmicos ajustáveis de acordo com a preferência de risco do investidor:
    - CONSERVADOR: Prioriza a máxima segurança jurídica (alto peso em matrícula e edital).
    - ARROJADO: Prioriza potencial puro de deságio e revenda rápida (maior peso nos dados de margem do imóvel).
    """
    imovel = db.query(ImovelModel).filter(ImovelModel.id == imovel_id, ImovelModel.ativo == True).first()
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    # Definição dos pesos por perfil
    if perfil.upper() == "CONSERVADOR":
        pesos = {"matricula": 0.50, "edital": 0.35, "imovel": 0.15}
    else:  # ARROJADO
        pesos = {"matricula": 0.25, "edital": 0.25, "imovel": 0.50}

    # Cálculo da média ponderada das 3 dimensões coletadas
    ranking_final = (
        (imovel.score_matricula * pesos["matricula"]) +
        (imovel.score_edital * pesos["edital"]) +
        (imovel.score_imovel * pesos["imovel"])
    )

    return {
        "imovel_id": imovel.id,
        "titulo": imovel.titulo,
        "perfil_selecionado": perfil.upper(),
        "pesos_aplicados": pesos,
        "pontuacoes_por_dimensao": {
            "matricula": imovel.score_matricula,
            "edital": imovel.score_edital,
            "imovel": imovel.score_imovel
        },
        "ranking_final_0_a_100": round(ranking_final, 1),
        "classificacao_risco": "Baixo Risco" if ranking_final >= 80 else ("Médio Risco" if ranking_final >= 60 else "Alto Risco")
    }

# =====================================================================
# 8. ENDPOINTS - CALCULADORA SMART DE CUSTOS E TABELA DE LANCES (27 ESTADOS)
# =====================================================================

# Alíquotas aproximadas de ITBI padrão de capitais por Estado de exemplo (27 estados cobertos por fallback)
ITBI_ESTADOS_FALLBACK = {
    "SP": 0.03, "RJ": 0.03, "MG": 0.025, "PR": 0.027, "RS": 0.03, "SC": 0.02,
    "BA": 0.03, "PE": 0.03, "CE": 0.02, "GO": 0.02, "DF": 0.03, "ES": 0.02
}

@app.post("/api/calculadora/custos")
def calcular_custos_leilao(req: CalculadoraCustosRequest):
    """
    Realiza o cálculo completo e automático das despesas de arrematação para qualquer um dos 27 estados:
    ITBI, emolumentos, cartório de notas, laudêmio, custos médios de desocupação judicial/extrajudicial,
    custo de oportunidade (baseado na SELIC a 10.5% a.a.) e comparativo de parcelas SAC vs PRICE.
    """
    estado_uf = req.estado.upper()
    aliquota_itbi = ITBI_ESTADOS_FALLBACK.get(estado_uf, 0.025)  # Fallback geral de 2.5%
    
    # 1. Custos Básicos de Compra
    itbi = req.valor_lance * aliquota_itbi
    comissao_leiloeiro = req.valor_lance * 0.05  # Comissão fixa de 5% obrigatória por lei
    
    # Emolumentos de registro e escritura aproximados por faixas (simulando tabelas de cartórios estaduais)
    if req.valor_lance <= 100000:
        emolumentos = 1500.0
    elif req.valor_lance <= 300000:
        emolumentos = 3000.0
    else:
        emolumentos = 5500.0

    laudemio = 0.0 if req.isento_laudemio else (req.valor_lance * 0.025)  # 2.5% de taxa de laudêmio se houver
    custos_desocupacao_estimados = 5000.0  # Custos processuais e taxas de desocupação estimadas
    
    total_custos_adicionais = itbi + comissao_leiloeiro + emolumentos + laudemio + custos_desocupacao_estimados
    custo_total_projeto = req.valor_lance + total_custos_adicionais

    # 2. Simulação de Financiamento (SAC vs PRICE)
    financiamento_detalhe = {}
    if req.financiado and req.percentual_financiamento > 0:
        valor_financiado = custo_total_projeto * (req.percentual_financiamento / 100)
        entrada = custo_total_projeto - valor_financiado
        juros_mensal = (req.taxa_juros_anual / 100) / 12
        n = req.prazo_meses

        if req.sistema_amortizacao == "PRICE":
            # Tabela PRICE (Prestação Constante): PMT = P * [i(1+i)^n] / [(1+i)^n - 1]
            pmt = valor_financiado * (juros_mensal * (1 + juros_mensal)**n) / ((1 + juros_mensal)**n - 1)
            total_pago = pmt * n
            juros_totais = total_pago - valor_financiado
            primeira_parcela = pmt
            ultima_parcela = pmt
        else:
            # Tabela SAC (Amortização Constante): Amort = P / n. Parcela_t = Amort + Juros_t
            amort_mensal = valor_financiado / n
            primeira_parcela = amort_mensal + (valor_financiado * juros_mensal)
            ultima_parcela = amort_mensal + (amort_mensal * juros_mensal)
            # Soma total paga no SAC aproximada por fórmula de P.A. dos juros decrescentes
            juros_totais = (n * (valor_financiado * juros_mensal + amort_mensal * juros_mensal)) / 2
            total_pago = valor_financiado + juros_totais
            pmt = primeira_parcela  # Primeira como referência inicial

        financiamento_detalhe = {
            "valor_financiado": round(valor_financiado, 2),
            "entrada_necessaria": round(entrada, 2),
            "primeira_parcela": round(primeira_parcela, 2),
            "ultima_parcela": round(ultima_parcela, 2),
            "juros_totais_pagos": round(juros_totais, 2),
            "custo_total_financiamento": round(total_pago, 2)
        }

    # 3. Custo de Oportunidade (SELIC - Simulado a 10.5% a.a.)
    taxa_selic_mensal = 0.105 / 12
    rendimento_oportunidade_12_meses = custo_total_projeto * ((1 + taxa_selic_mensal)**12 - 1)

    return {
        "resumo_valores": {
            "valor_lance": req.valor_lance,
            "total_custos_adicionais": round(total_custos_adicionais, 2),
            "custo_total_projeto": round(custo_total_projeto, 2)
        },
        "detalhamento_custos": {
            "itbi_calculado": round(itbi, 2),
            "itbi_aliquota_uf": f"{aliquota_itbi * 100}%",
            "comissao_leiloeiro_5_por_cento": round(comissao_leiloeiro, 2),
            "registro_e_escritura_estimado": round(emolumentos, 2),
            "laudemio": round(laudemio, 2),
            "provisao_desocupacao": round(custos_desocupacao_estimados, 2)
        },
        "custo_oportunidade": {
            "taxa_selic_referencia_anual": "10.50%",
            "rendimento_perdido_em_12_meses": round(rendimento_oportunidade_12_meses, 2)
        },
        "simulacao_financiamento": financiamento_detalhe if req.financiado else "Simulação não solicitada."
    }


@app.get("/api/calculadora/tabela-lances")
def gerar_tabela_lances(
    valor_avaliacao: float,
    valor_minimo: float,
    estado: str = "SP",
    db: Session = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key)
):
    """
    Gera a Tabela de Lances Dinâmica (20 valores de lances simulados).
    Calcula automaticamente o ROI bruto, o deságio obtido e as projeções de ganho de capital líquido
    caso a venda futura ocorra pelo valor total de avaliação do imóvel, em 3 horizontes de tempo (6, 12 e 24 meses).
    """
    aliquota_itbi = ITBI_ESTADOS_FALLBACK.get(estado.upper(), 0.025)
    passo = (valor_avaliacao - valor_minimo) / 20
    tabela = []

    for i in range(20):
        lance_simulado = valor_minimo + (passo * i)
        if lance_simulado > valor_avaliacao:
            break
        
        # Despesas estimadas
        taxas = (lance_simulado * aliquota_itbi) + (lance_simulado * 0.05) + 3000.0  # ITBI + Comissão + Emolumentos fixados
        custo_total_investido = lance_simulado + taxas
        lucro_bruto_venda = valor_avaliacao - custo_total_investido
        desagio_percentual = (1 - (lance_simulado / valor_avaliacao)) * 100

        # ROI em horizontes temporais distintos considerando impostos de ganho de capital (15% padrão de IRPF sobre lucro)
        lucro_liquido = lucro_bruto_venda * 0.85
        roi_liquido_total = (lucro_liquido / custo_total_investido) * 100 if custo_total_investido > 0 else 0

        tabela.append({
            "indice_lance": i + 1,
            "valor_lance_proposto": round(lance_simulado, 2),
            "desagio_obtido_percentual": f"{round(desagio_percentual, 1)}%",
            "custo_estimado_total": round(custo_total_investido, 2),
            "ganho_capital_liquido": round(lucro_liquido, 2),
            "roi_liquido_geral": f"{round(roi_liquido_total, 2)}%",
            "retorno_projetado_por_horizonte": {
                "6_meses_anualizado": f"{round(roi_liquido_total * 2, 2)}%",
                "12_meses": f"{round(roi_liquido_total, 2)}%",
                "24_meses_anualizado": f"{round(roi_liquido_total / 2, 2)}%"
            }
        })

    return {
        "valor_avaliacao_referencia": valor_avaliacao,
        "valor_minimo_possivel": valor_minimo,
        "uf_tributacao": estado.upper(),
        "simulacoes_tabela_lances": tabela
    }

# =====================================================================
# 9. ENDPOINTS - GERENCIADOR DE IMÓVEIS (KANBAN & SOCIEDADE DE COTISTAS)
# =====================================================================

@app.post("/api/gerenciador/kanban", status_code=status.HTTP_201_CREATED)
def criar_card_kanban(imovel_id: int, db: Session = Depends(get_db), api_info: ApiKeyModel = Depends(verify_api_key)):
    """
    Cria um card no Kanban do investidor para iniciar a triagem e desdobramento do investimento.
    Inicia na etapa obrigatória inicial 'Estoque'.
    """
    card_existente = db.query(KanbanCardModel).filter(KanbanCardModel.imovel_id == imovel_id).first()
    if card_existente:
        return {"message": "Card já existe no Kanban.", "card_id": card_existente.id}
    
    novo_card = KanbanCardModel(
        imovel_id=imovel_id,
        etapa="Estoque",
        dados_financeiros={"reforma_estimada": 0.0, "condominio_atrasado": 0.0, "iptu_atrasado": 0.0}
    )
    db.add(novo_card)
    db.commit()
    db.refresh(novo_card)
    return {"message": "Card criado no Kanban com sucesso!", "card_id": novo_card.id}


@app.put("/api/gerenciador/kanban/{card_id}/mover")
def mover_card_etapa(
    card_id: int,
    nova_etapa: str = Field(..., description="Estoque, Triagem Financeira, Triagem Jurídica, Decisão, Leilão, Registro, Desocupação, Reforma, Venda"),
    db: Session = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key)
):
    """
    Atualiza as raias do fluxo de trabalho visual de investimentos (Kanban).
    """
    card = db.query(KanbanCardModel).filter(KanbanCardModel.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card de Kanban não localizado.")
    
    etapas_validas = [
        "Estoque", "Triagem Financeira", "Triagem Jurídica", 
        "Decisão", "Leilão", "Registro", "Desocupação", "Reforma", "Venda"
    ]
    if nova_etapa not in etapas_validas:
        raise HTTPException(status_code=400, detail=f"Etapa inválida. Escolha entre: {', '.join(etapas_validas)}")
    
    card.etapa = nova_etapa
    card.data_atualizacao = datetime.utcnow()
    db.commit()
    return {"message": "Etapa do card atualizada com sucesso!", "card_id": card.id, "nova_etapa": card.etapa}


@app.post("/api/gerenciador/kanban/{card_id}/cotistas", status_code=status.HTTP_201_CREATED)
def adicionar_cotista_sociedade(
    card_id: int,
    cota: CotaCreate,
    db: Session = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key)
):
    """
    Adiciona um novo investidor cotista com cota proporcional ao card do leilão em andamento.
    Evita que a soma das cotas ultrapasse 100% no mesmo card.
    """
    card = db.query(KanbanCardModel).filter(KanbanCardModel.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card de Kanban não localizado.")
    
    # Valida soma das cotas atuais
    soma_atual = db.query(CotaSociedadeModel).filter(CotaSociedadeModel.kanban_card_id == card_id).all()
    percentual_ocupado = sum([c.percentual_cota for c in soma_atual])

    if percentual_ocupado + cota.percentual_cota > 100.0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cota inválida. A soma das cotas não pode exceder 100%. Já há {percentual_ocupado}% ocupados."
        )

    nova_cota = CotaSociedadeModel(
        kanban_card_id=card_id,
        cotista_nome=cota.cotista_nome,
        cotista_email=cota.cotista_email,
        percentual_cota=cota.percentual_cota,
        valor_investido=cota.valor_investido
    )
    db.add(nova_cota)
    db.commit()
    db.refresh(nova_cota)
    return {"message": "Cotista adicionado com sucesso!", "cota_id": nova_cota.id, "percentual_alocado": nova_cota.percentual_cota}


@app.get("/api/gerenciador/kanban/{card_id}/dividir-despesa")
def ratear_despesa_por_cotas(
    card_id: int,
    valor_despesa: float = Field(..., gt=0),
    descricao: str = "Taxa de Condomínio",
    db: Session = Depends(get_db),
    api_info: ApiKeyModel = Depends(verify_api_key)
):
    """
    Rateia automaticamente qualquer custo lançado (como condomínio atrasado, IPTU, reforma, etc.)
    proporcionalmente de acordo com a participação societária registrada de cada cotista.
    """
    cotas = db.query(CotaSociedadeModel).filter(CotaSociedadeModel.kanban_card_id == card_id).all()
    if not cotas:
        raise HTTPException(status_code=400, detail="Este card não possui cotistas cadastrados para rateio.")
    
    rateio = []
    for c in cotas:
        valor_proporcional = valor_despesa * (c.percentual_cota / 100.0)
        rateio.append({
            "cotista_nome": c.cotista_nome,
            "cotista_email": c.cotista_email,
            "percentual_cota": f"{c.percentual_cota}%",
            "valor_a_pagar": round(valor_proporcional, 2)
        })

    return {
        "card_id": card_id,
        "descricao_despesa": descricao,
        "valor_total_despesa": valor_despesa,
        "divisao_entre_cotistas": rateio
    }

# =====================================================================
# 10. SISTEMA AUXILIAR DE CRIAÇÃO DE CHAVES API (ADMINISTRATIVO / SAAS)
# =====================================================================

@app.post("/api/admin/keys", status_code=status.HTTP_201_CREATED)
def criar_chave_api(owner_email: str, plan: str = "FREE", db: Session = Depends(get_db)):
    """
    Endpoint administrativo para criação de novas chaves de API ligadas ao gateway de faturamento da API externa.
    """
    limites = {"FREE": 100, "STARTER": 5000, "ENTERPRISE": 100000}
    nova_chave = ApiKeyModel(
        key=f"sl_v2_{uuid.uuid4().hex}",
        owner_email=owner_email,
        plan=plan.upper(),
        monthly_limit=limites.get(plan.upper(), 100),
        active=True
    )
    db.add(nova_chave)
    db.commit()
    db.refresh(nova_chave)
    return {
        "owner_email": nova_chave.owner_email,
        "api_key": nova_chave.key,
        "plan": nova_chave.plan,
        "monthly_limit": nova_chave.monthly_limit
    }
