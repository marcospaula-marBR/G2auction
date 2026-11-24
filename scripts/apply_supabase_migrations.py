"""
Script seguro e idempotente para aplicar as migrations SQL no Supabase PostgreSQL.
Uso:
    python scripts/apply_supabase_migrations.py --check
    python scripts/apply_supabase_migrations.py
"""
import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import psycopg2
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = BASE_DIR / "supabase" / "migrations"

MIGRATION_FILES = [
    "001_create_properties_schema.sql",
    "002a_api_keys_cotistas.sql",
    "002b_imoveis.sql",
    "002c_tabelas_filhas.sql",
    "002d_rls_trigger.sql",
    "003_whitelabel_multitenant_partners.sql",
]


def mask_dsn(dsn: str) -> str:
    parsed = urlparse(dsn)
    host = parsed.hostname or "?"
    port = parsed.port or 5432
    user = parsed.username or "?"
    return f"{parsed.scheme}://{user}:***@{host}:{port}{parsed.path}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Aplicar migrations do projeto no Supabase.")
    parser.add_argument("--check", action="store_true", help="Apenas testa conexão e lista tabelas.")
    args = parser.parse_args()

    load_dotenv(BASE_DIR / ".env")
    dsn = (os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL") or "").strip()

    if not dsn or dsn.startswith("sqlite"):
        print("[ERRO] DATABASE_URL no .env não aponta para um banco PostgreSQL/Supabase.")
        return 1

    print(f"[INFO] Conectando em: {mask_dsn(dsn)}")
    try:
        conn = psycopg2.connect(dsn, connect_timeout=10)
    except Exception as exc:
        print(f"[FALHA DE CONEXAO] {exc}")
        print(
            "\n[ACAO NECESSARIA]\n"
            "1. No painel do Supabase ativo, clique em 'Connect' -> 'Session pooler' (IPv4) e copie a URI.\n"
            "2. Atualize DATABASE_URL no .env com essa URI.\n"
            "3. Adicione também VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (Settings -> API) no .env.\n"
        )
        return 2

    try:
        cur = conn.cursor()
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
        existing_tables = [r[0] for r in cur.fetchall()]
        print(f"[OK] Conectado! Tabelas atuais em public: {existing_tables}")

        if args.check:
            return 0

        for filename in MIGRATION_FILES:
            file_path = MIGRATIONS_DIR / filename
            if not file_path.exists():
                print(f"[AVISO] Migration não encontrada: {file_path}")
                continue

            sql_content = file_path.read_text(encoding="utf-8")
            print(f"[APLICANDO] {filename} ...")
            try:
                cur.execute(sql_content)
                conn.commit()
                print(f"[OK] {filename} aplicada com sucesso.")
            except Exception as sql_err:
                conn.rollback()
                print(f"[ERRO] Falha em {filename}: {sql_err}")
                return 3

        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
        final_tables = [r[0] for r in cur.fetchall()]
        print(f"[CONCLUIDO] Tabelas em public após migrations: {final_tables}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
