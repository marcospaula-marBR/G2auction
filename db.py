"""
Módulo de Banco de Dados (SQLite Local / PostgreSQL)
Suporta init_db, upsert_imovel, registrar_execucao e finalizar_execucao.
"""
import sqlite3
import os

DB_FILE = os.path.join(os.path.dirname(__file__), "g2auction.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inicializa as tabelas de imóveis e logs de execução no banco local."""
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS imoveis (
        caixa_id TEXT PRIMARY KEY,
        uf TEXT,
        cidade TEXT,
        bairro TEXT,
        endereco TEXT,
        preco_venda TEXT,
        valor_avaliacao TEXT,
        desconto TEXT,
        modalidade_venda TEXT,
        fonte TEXT,
        edital_url TEXT,
        maps_url TEXT,
        streetview_url TEXT,
        lat REAL,
        lng REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS execucoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fonte TEXT,
        status TEXT,
        novos INTEGER DEFAULT 0,
        atualizados INTEGER DEFAULT 0,
        erros INTEGER DEFAULT 0,
        mensagem TEXT,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP
    );
    """)

    conn.commit()
    conn.close()

def upsert_imovel(registro: dict) -> str:
    """Insere ou atualiza o registro de imóvel pelo caixa_id."""
    conn = get_connection()
    cursor = conn.cursor()

    caixa_id = registro.get("caixa_id")
    cursor.execute("SELECT caixa_id FROM imoveis WHERE caixa_id = ?", (caixa_id,))
    existe = cursor.fetchone()

    status_operacao = "atualizado" if existe else "inserido"

    cursor.execute("""
    INSERT INTO imoveis (caixa_id, uf, cidade, bairro, endereco, preco_venda, valor_avaliacao, desconto, modalidade_venda, fonte, edital_url, maps_url, streetview_url, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(caixa_id) DO UPDATE SET
        uf=excluded.uf,
        cidade=excluded.cidade,
        bairro=excluded.bairro,
        endereco=excluded.endereco,
        preco_venda=excluded.preco_venda,
        valor_avaliacao=excluded.valor_avaliacao,
        desconto=excluded.desconto,
        modalidade_venda=excluded.modalidade_venda,
        fonte=excluded.fonte,
        edital_url=excluded.edital_url,
        maps_url=excluded.maps_url,
        streetview_url=excluded.streetview_url,
        lat=excluded.lat,
        lng=excluded.lng;
    """, (
        caixa_id,
        registro.get("uf"),
        registro.get("cidade"),
        registro.get("bairro"),
        registro.get("endereco"),
        registro.get("preco_venda"),
        registro.get("valor_avaliacao"),
        registro.get("desconto"),
        registro.get("modalidade_venda"),
        registro.get("fonte", "caixa"),
        registro.get("edital_url"),
        registro.get("maps_url"),
        registro.get("streetview_url"),
        registro.get("lat"),
        registro.get("lng")
    ))

    conn.commit()
    conn.close()
    return status_operacao

def registrar_execucao(fonte: str, status: str) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO execucoes (fonte, status) VALUES (?, ?);", (fonte, status))
    exec_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return exec_id

def finalizar_execucao(exec_id: int, status: str, novos: int = 0, atualizados: int = 0, erros: int = 0, mensagem: str = ""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE execucoes
    SET status = ?, novos = ?, atualizados = ?, erros = ?, mensagem = ?, finished_at = CURRENT_TIMESTAMP
    WHERE id = ?;
    """, (status, novos, atualizados, erros, mensagem, exec_id))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("[db] Banco de dados inicializado com sucesso!")
