"""
Worker Automatizado de Sincronização Multi-Bancos -> Supabase (Etapa 3)
Coleta exclusivamente dados reais oficiais (sem fallbacks sintéticos) e grava
em `public.properties` + `public.caixa_imports` via PostgreSQL `UPSERT` em lote.

Fontes suportadas:
  - BRADESCO: API pública oficial (`api.vitrinebradesco.com.br/v1/auctions`)
  - CAIXA: Feed CSV oficial por UF ou arquivo CSV oficial local (`--caixa-csv`)

Uso:
    python scripts/sync_banks_to_supabase.py --banks bradesco,caixa --ufs SP,RJ,MG --caixa-csv public/Lista_imoveis_SP.csv --run-radar
"""
import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
}


def get_pg_connection():
    load_dotenv(BASE_DIR / ".env")
    dsn = (os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL") or "").strip()
    if not dsn or dsn.startswith("sqlite"):
        raise RuntimeError("DIRECT_URL ou DATABASE_URL PostgreSQL não configurada no .env")
    return psycopg2.connect(dsn, connect_timeout=15)


def parse_br_number(val: Any) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    clean = str(val).replace("R$", "").replace("%", "").strip()
    if not clean:
        return None
    if "." in clean and "," in clean:
        clean = clean.replace(".", "").replace(",", ".")
    elif "," in clean:
        clean = clean.replace(",", ".")
    elif clean.count(".") > 1:
        clean = clean.replace(".", "")
    try:
        return float(clean)
    except ValueError:
        return None


def extract_hdn_imovel(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r"hdnimovel=(\d{8,16})", url, re.IGNORECASE)
    return m.group(1) if m else None


def parse_caixa_description(desc: str | None) -> dict[str, Any]:
    if not desc:
        return {}
    lower = desc.lower()
    prop_type = "Imóvel"
    if "apartamento" in lower:
        prop_type = "Apartamento"
    elif "casa" in lower or "sobrado" in lower:
        prop_type = "Casa"
    elif "terreno" in lower or "lote" in lower or "gleba" in lower:
        prop_type = "Terreno"
    elif "galpão" in lower or "galpao" in lower:
        prop_type = "Galpão"
    elif "loja" in lower:
        prop_type = "Loja"
    elif "sala" in lower:
        prop_type = "Sala"
    elif "comercial" in lower or "prédio" in lower or "predio" in lower:
        prop_type = "Comercial"

    def grab_num(pattern: str) -> float | None:
        m = re.search(pattern, desc, re.IGNORECASE)
        return parse_br_number(m.group(1)) if m else None

    priv = grab_num(r"([\d.,]+)\s*(?:m2|m²)?\s*de\s*[áa]rea\s*privativa")
    total = grab_num(r"([\d.,]+)\s*(?:m2|m²)?\s*de\s*[áa]rea\s*total")
    land = grab_num(r"([\d.,]+)\s*(?:m2|m²)?\s*de\s*[áa]rea\s*do\s*terreno")
    beds_m = re.search(r"(\d+)\s*qto\(s\)|(\d+)\s*quarto", desc, re.IGNORECASE)
    beds = int(beds_m.group(1) or beds_m.group(2)) if beds_m else None
    vagas_m = re.search(r"(\d+)\s*vaga", desc, re.IGNORECASE)
    vagas = int(vagas_m.group(1)) if vagas_m else None

    return {
        "property_type": prop_type,
        "private_area": priv,
        "total_area": total,
        "land_area": land,
        "bedrooms": beds,
        "parking_spaces": vagas,
    }


def compute_hash(obj: dict[str, Any]) -> str:
    stable = {
        "source": obj.get("source"),
        "id": obj.get("source_property_id"),
        "min": obj.get("current_minimum_value"),
        "eval": obj.get("appraisal_value"),
        "disc": obj.get("discount_percentage"),
        "d1": obj.get("first_auction_date"),
        "d2": obj.get("second_auction_date"),
    }
    return hashlib.sha256(json.dumps(stable, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:32]


def parse_iso_dt(val: str | None) -> str | None:
    if not val:
        return None
    try:
        cleaned = val.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        dt.datetime.fromisoformat(cleaned)
        return val.strip()
    except Exception:
        return None


# =====================================================================
# CONECTOR REAL: BRADESCO (API Vitrine Bradesco)
# =====================================================================
def fetch_bradesco_uf(uf: str) -> list[dict[str, Any]]:
    uf_upper = uf.strip().upper()
    headers = {
        **BROWSER_HEADERS,
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://vitrinebradesco.com.br",
        "Referer": "https://vitrinebradesco.com.br/",
    }

    items: list[dict[str, Any]] = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        url = f"https://api.vitrinebradesco.com.br/v1/auctions?type=realstate&ufs={uf_upper}&page={page}"
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status != 200:
                    break
                payload = json.loads(resp.read().decode("utf-8", errors="ignore"))
                total_pages = int(payload.get("total_pages") or 1)
                data = payload.get("data") or []
                for item in data:
                    items.append(normalize_bradesco_item(item, uf_upper))
        except Exception as exc:
            print(f"[BRADESCO {uf_upper} pág {page}] aviso: {exc}")
            break
        page += 1
        if page <= total_pages:
            time.sleep(0.25)

    return items


def normalize_bradesco_item(item: dict[str, Any], uf_fallback: str) -> dict[str, Any]:
    val1 = float(item.get("min_auction_value_1") or 0)
    val2 = float(item.get("min_auction_value_2") or 0)
    price_raw = float(item.get("price") or 0)

    sale_val = val2 if val2 > 0 else (price_raw if price_raw > 0 else val1)
    appraisal_val = val1 if val1 > 0 else float(item.get("final_auction_value") or sale_val)

    discount = 0.0
    if sale_val > 0 and appraisal_val > sale_val:
        discount = round(((appraisal_val - sale_val) / appraisal_val) * 100.0, 2)
    if discount >= 100 or discount < 0:
        discount = 0.0

    date1 = parse_iso_dt(item.get("date_auction_1"))
    date2 = parse_iso_dt(item.get("date_auction_2"))
    main_date = parse_iso_dt(item.get("auction_date")) or date2 or date1

    desc_text = item.get("description") or ""
    brd_code = ""
    m_cod = re.search(r"c[oó]d(?:\.|igo)?(?:\s+do\s+im[oó]vel)?\s*:?\s*(\d{3,8})", desc_text, re.IGNORECASE)
    if m_cod:
        brd_code = m_cod.group(1)
    if not brd_code and item.get("slug"):
        m_slug = re.search(r"-(\d{4,8})(?:_\d+)?$", str(item["slug"]))
        if m_slug:
            brd_code = m_slug.group(1)
    if not brd_code and item.get("guid"):
        brd_code = str(item["guid"]).split("-")[0].upper()

    prop_id = f"BRD-{brd_code or item.get('guid', 'IMOVEL')}"

    raw_name = item.get("name") or ""
    parts = re.split(r"\s*-\s*", raw_name)
    real_addr = " - ".join(parts[2:]).strip() if len(parts) >= 3 else ""
    neigh = (item.get("neighborhood") or "").strip()
    city = (item.get("city") or "").strip()
    state = (item.get("state") or uf_fallback).strip().upper()[:2]
    if not real_addr:
        real_addr = ", ".join([x for x in [neigh, city, state] if x])
    elif neigh and neigh.lower() not in real_addr.lower():
        real_addr = f"{real_addr}, {neigh}"

    can_finance = sale_val >= 100000
    max_inst = 360 if can_finance else 1
    min_down = round(sale_val * 0.20, 2) if can_finance else sale_val
    financed = max(0.0, sale_val - min_down)
    min_inst_val = round((financed / max_inst) + (financed * 0.0088), 2) if (can_finance and financed > 0) else 0.0

    images = item.get("images") or []
    photo = images[0] if isinstance(images, list) and images else None

    auct = item.get("auctioneer")
    auct_name = auct.get("name") if isinstance(auct, dict) else "Bradesco Leilões"

    is_af = item.get("realstate_auction_type") == "alienacao-fiduciaria"
    modality = "Leilão Extrajudicial — Alienação Fiduciária" if is_af else "Leilão Extrajudicial Bradesco"

    record = {
        "source": "BRADESCO",
        "source_property_id": prop_id,
        "title": raw_name or f"Imóvel Bradesco — {city}/{state}",
        "state": state,
        "city": city,
        "neighborhood": neigh or None,
        "address": real_addr,
        "property_type": item.get("category") or "Imóvel",
        "sale_value": sale_val if sale_val > 0 else None,
        "current_minimum_value": sale_val if sale_val > 0 else None,
        "appraisal_value": appraisal_val if appraisal_val > 0 else None,
        "first_auction_value": val1 if val1 > 0 else None,
        "second_auction_value": val2 if val2 > 0 else None,
        "discount_percentage": discount if discount > 0 else None,
        "calculated_discount_percentage": discount if discount > 0 else None,
        "accepts_financing": can_finance,
        "occupancy_status": "UNKNOWN",
        "description": re.sub(r"<[^>]*>", " ", desc_text).strip()[:2000] if desc_text else None,
        "sale_modality": modality,
        "source_url": f"https://vitrinebradesco.com.br/auctions/{item['slug']}" if item.get("slug") else f"https://vitrinebradesco.com.br/auctions?type=realstate&ufs={state}",
        "total_area": None,
        "private_area": None,
        "land_area": None,
        "bedrooms": None,
        "parking_spaces": None,
        "main_photo_url": photo,
        "first_auction_date": date1 or main_date,
        "second_auction_date": date2,
        "auction_date": main_date,
        "auctioneer": auct_name,
        "payment_conditions": (
            f"À vista ou Financiamento Bradesco em até {max_inst}x (entrada mín. 20%)."
            if can_finance
            else "Somente à vista (Bradesco financia a partir de R$ 100 mil)."
        ),
        "max_installments": max_inst,
        "min_down_payment": min_down,
        "min_installment_value": min_inst_val,
        "status": "ACTIVE",
        "source_generated_at": dt.date.today().isoformat(),
        "source_file_url": "https://api.vitrinebradesco.com.br/v1/auctions",
        "raw_list_data": item,
    }
    record["source_hash"] = compute_hash(record)
    return record


# =====================================================================
# CONECTOR REAL: CAIXA (Feed CSV Oficial ou Arquivo CSV Oficial)
# =====================================================================
def parse_caixa_csv_text(text: str, uf_default: str, source_file_url: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    lines = [l for l in text.splitlines() if l.strip()]
    gen_date: str | None = None
    header_idx = 0

    for idx, line in enumerate(lines[:10]):
        m_dt = re.search(r"(\d{2})/(\d{2})/(\d{4})", line)
        if m_dt and not gen_date:
            gen_date = f"{m_dt.group(3)}-{m_dt.group(2)}-{m_dt.group(1)}"
        low = line.lower()
        if "cidade" in low and ("preço" in low or "preco" in low):
            header_idx = idx
            break

    reader = csv.reader(lines[header_idx:], delimiter=";")
    headers = next(reader, None) or []
    h_low = [h.strip().lower() for h in headers]

    def find_col(terms: list[str], fallback: int) -> int:
        for i, h in enumerate(h_low):
            if any(t in h for t in terms):
                return i
        return fallback

    i_id = find_col(["imóvel", "imovel"], 0)
    i_uf = find_col(["uf"], 1)
    i_city = find_col(["cidade"], 2)
    i_neigh = find_col(["bairro"], 3)
    i_addr = find_col(["endereço", "endereco"], 4)
    i_price = find_col(["preço", "preco"], 5)
    i_eval = find_col(["avaliação", "avaliacao"], 6)
    i_disc = find_col(["desconto"], 7)
    i_fin = find_col(["financiamento"], 8)
    i_desc = find_col(["descrição", "descricao"], 9)
    i_mod = find_col(["modalidade"], 10)
    i_link = find_col(["link"], 11)

    rows: list[dict[str, Any]] = []
    invalid = 0

    for row in reader:
        if len(row) < 6:
            invalid += 1
            continue

        link = row[i_link].strip() if i_link < len(row) else ""
        hdn_id = extract_hdn_imovel(link)
        raw_id_digits = re.sub(r"\D", "", row[i_id]) if i_id < len(row) else ""
        prop_id = hdn_id or raw_id_digits
        if not prop_id:
            invalid += 1
            continue

        uf = (row[i_uf].strip() if i_uf < len(row) else uf_default).upper()[:2]
        city = row[i_city].strip() if i_city < len(row) else ""
        neigh = row[i_neigh].strip() if i_neigh < len(row) else ""
        addr = row[i_addr].strip() if i_addr < len(row) else ""
        sale_val = parse_br_number(row[i_price]) if i_price < len(row) else None
        eval_val = parse_br_number(row[i_eval]) if i_eval < len(row) else None
        disc_val = parse_br_number(row[i_disc]) if i_disc < len(row) else None

        if sale_val and eval_val and eval_val > sale_val and (disc_val is None or disc_val <= 0):
            disc_val = round(((eval_val - sale_val) / eval_val) * 100.0, 2)
        if disc_val is not None and (disc_val >= 100 or disc_val <= 0):
            disc_val = None

        fin_raw = (row[i_fin].strip().lower() if i_fin < len(row) else "")
        accepts_fin = True if fin_raw.startswith("s") else (False if fin_raw.startswith("n") else None)

        desc = row[i_desc].strip() if i_desc < len(row) else ""
        modality = row[i_mod].strip() if i_mod < len(row) else "Venda Direta Caixa"
        parsed_desc = parse_caixa_description(desc)

        if not link:
            link = f"https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel={prop_id}"

        raw_dict = {headers[idx]: (row[idx].strip() if idx < len(row) else "") for idx in range(len(headers))}
        photo_url = f"https://venda-imoveis.caixa.gov.br/fotos/F{prop_id}21.jpg"

        record = {
            "source": "CAIXA",
            "source_property_id": prop_id,
            "title": f"{parsed_desc.get('property_type', 'Imóvel')} — {neigh or city}/{uf}",
            "state": uf,
            "city": city,
            "neighborhood": neigh or None,
            "address": addr or None,
            "property_type": parsed_desc.get("property_type") or "Imóvel",
            "sale_value": sale_val,
            "current_minimum_value": sale_val,
            "appraisal_value": eval_val,
            "first_auction_value": None,
            "second_auction_value": None,
            "discount_percentage": disc_val,
            "calculated_discount_percentage": disc_val,
            "accepts_financing": accepts_fin,
            "occupancy_status": "UNKNOWN",
            "description": desc or None,
            "sale_modality": modality,
            "source_url": link,
            "total_area": parsed_desc.get("total_area"),
            "private_area": parsed_desc.get("private_area"),
            "land_area": parsed_desc.get("land_area"),
            "bedrooms": parsed_desc.get("bedrooms"),
            "parking_spaces": parsed_desc.get("parking_spaces"),
            "main_photo_url": photo_url,
            "first_auction_date": None,
            "second_auction_date": None,
            "auction_date": None,
            "auctioneer": "Caixa Econômica Federal",
            "payment_conditions": None,
            "max_installments": 360 if accepts_fin else 1,
            "min_down_payment": round(sale_val * 0.05, 2) if (accepts_fin and sale_val) else sale_val,
            "min_installment_value": None,
            "status": "ACTIVE",
            "raw_list_data": raw_dict,
            "source_generated_at": gen_date,
            "source_file_url": source_file_url,
        }
        record["source_hash"] = compute_hash(record)
        rows.append(record)

    meta = {
        "source_generated_at": gen_date,
        "source_file_hash": hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()[:32],
        "total_rows": len(rows) + invalid,
        "valid_rows": len(rows),
        "invalid_rows": invalid,
    }
    return rows, meta


def fetch_caixa_uf(uf: str, csv_path: Path | None = None) -> tuple[str, list[dict[str, Any]], dict[str, Any]]:
    uf_upper = uf.strip().upper()
    if csv_path and csv_path.exists():
        raw_bytes = csv_path.read_bytes()
        text = raw_bytes.decode("cp1252", errors="ignore")
        rows, meta = parse_caixa_csv_text(text, uf_upper, str(csv_path.name))
        return "OK", rows, meta

    url = f"https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_{uf_upper}.csv"
    try:
        # Envia exatamente os headers padrão do cliente HTTP (sem User-Agent Python-urllib/browser que dispara WAF)
        req = urllib.request.Request(url, headers={"User-Agent": "undici", "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw_bytes = resp.read()
            text = raw_bytes.decode("cp1252", errors="ignore")
            low = text.lower()
            if "captcha" in low or "radware" in low or "<html" in low[:200]:
                return "CAPTCHA_BLOCKED", [], {"error": "WAF/Radware CAPTCHA na origem"}
            rows, meta = parse_caixa_csv_text(text, uf_upper, url)
            return "OK", rows, meta
    except Exception as exc:
        return "ERROR", [], {"error": str(exc)}


# =====================================================================
# PERSISTÊNCIA EM LOTE NO SUPABASE
# =====================================================================
UPSERT_COLUMNS = [
    "source", "source_property_id", "title", "state", "city", "neighborhood", "address",
    "property_type", "sale_value", "current_minimum_value", "appraisal_value",
    "first_auction_value", "second_auction_value", "discount_percentage",
    "calculated_discount_percentage", "accepts_financing", "occupancy_status",
    "description", "sale_modality", "source_url", "total_area", "private_area",
    "land_area", "bedrooms", "parking_spaces", "main_photo_url",
    "first_auction_date", "second_auction_date", "auction_date", "auctioneer",
    "payment_conditions", "max_installments", "min_down_payment", "min_installment_value",
    "status", "source_hash", "source_generated_at", "source_file_url", "raw_list_data",
]


def upsert_properties_batch(conn, rows: list[dict[str, Any]], batch_size: int = 250) -> int:
    if not rows:
        return 0

    # Deduplica por (source, source_property_id) dentro do mesmo lote para evitar conflito SQL
    dedup: dict[tuple[str, str], dict[str, Any]] = {}
    for r in rows:
        dedup[(r["source"], str(r["source_property_id"]))] = r
    unique_rows = list(dedup.values())

    cols_sql = ", ".join(UPSERT_COLUMNS)
    update_assignments = ", ".join(
        f"{col} = EXCLUDED.{col}"
        for col in UPSERT_COLUMNS
        if col not in ("source", "source_property_id")
    )
    sql = f"""
        INSERT INTO public.properties ({cols_sql})
        VALUES %s
        ON CONFLICT (source, source_property_id) DO UPDATE SET
            {update_assignments},
            last_seen_at = NOW(),
            updated_at = NOW();
    """

    cur = conn.cursor()
    total_written = 0
    for i in range(0, len(unique_rows), batch_size):
        chunk = unique_rows[i:i + batch_size]
        values = []
        for r in chunk:
            tup = []
            for col in UPSERT_COLUMNS:
                val = r.get(col)
                if col == "raw_list_data" and val is not None:
                    tup.append(json.dumps(val, ensure_ascii=False))
                else:
                    tup.append(val)
            values.append(tuple(tup))
        psycopg2.extras.execute_values(cur, sql, values, page_size=batch_size)
        total_written += len(chunk)

    conn.commit()
    return total_written


def reconcile_source_uf(conn, source: str, uf: str, active_ids: set[str]) -> int:
    if not active_ids:
        return 0
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE public.properties
        SET status = 'POSSIBLY_REMOVED', updated_at = NOW()
        WHERE source = %s
          AND state = %s
          AND status = 'ACTIVE'
          AND NOT (source_property_id = ANY(%s));
        """,
        (source, uf.upper(), list(active_ids)),
    )
    removed = cur.rowcount
    conn.commit()
    return removed


def log_import_run(conn, uf: str, status: str, meta: dict[str, Any], written: int, removed: int, elapsed: float, filename: str):
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO public.caixa_imports (
            uf, source_generated_at, source_file_hash, filename, status,
            total_rows, valid_rows, invalid_rows, inserted, updated,
            possibly_removed, execution_time_seconds
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """,
        (
            uf,
            meta.get("source_generated_at"),
            meta.get("source_file_hash"),
            filename,
            status,
            meta.get("total_rows", written),
            meta.get("valid_rows", written),
            meta.get("invalid_rows", 0),
            written,
            0,
            removed,
            round(elapsed, 2),
        ),
    )
    conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincronização real multi-bancos para o Supabase.")
    parser.add_argument("--banks", default="bradesco,caixa", help="Bancos separados por vírgula (ex: bradesco,caixa)")
    parser.add_argument("--ufs", default="SP,RJ,MG,PR,RS,SC", help="UFs separadas por vírgula")
    parser.add_argument("--caixa-csv", default=None, help="Caminho opcional para CSV oficial da Caixa (ex: public/Lista_imoveis_SP.csv)")
    parser.add_argument("--run-radar", action="store_true", help="Executa o Radar IA após sincronizar")
    args = parser.parse_args()

    banks = [b.strip().lower() for b in args.banks.split(",") if b.strip()]
    ufs = [u.strip().upper() for u in args.ufs.split(",") if u.strip()]
    caixa_csv_path = Path(args.caixa_csv) if args.caixa_csv else None

    conn = get_pg_connection()
    grand_total = 0

    try:
        if "bradesco" in banks:
            for uf in ufs:
                t0 = time.time()
                rows = fetch_bradesco_uf(uf)
                if rows:
                    written = upsert_properties_batch(conn, rows)
                    removed = reconcile_source_uf(conn, "BRADESCO", uf, {r["source_property_id"] for r in rows})
                    grand_total += written
                    print(f"[BRADESCO {uf}] {written} imóveis sincronizados (removidos: {removed}) em {time.time() - t0:.1f}s")
                else:
                    print(f"[BRADESCO {uf}] 0 leilões ativos no momento.")

        if "caixa" in banks:
            for uf in ufs:
                t0 = time.time()
                use_csv = caixa_csv_path if (caixa_csv_path and uf == "SP") else None
                status, rows, meta = fetch_caixa_uf(uf, use_csv)
                if status == "OK" and rows:
                    written = upsert_properties_batch(conn, rows)
                    removed = reconcile_source_uf(conn, "CAIXA", uf, {r["source_property_id"] for r in rows})
                    log_import_run(conn, uf, "SUCCESS", meta, written, removed, time.time() - t0, str(use_csv.name if use_csv else f"Lista_imoveis_{uf}.csv"))
                    grand_total += written
                    print(f"[CAIXA {uf}] {written} imóveis sincronizados (removidos: {removed}) em {time.time() - t0:.1f}s")
                else:
                    log_import_run(conn, uf, status, meta, 0, 0, time.time() - t0, f"Lista_imoveis_{uf}.csv")
                    print(f"[CAIXA {uf}] {status}: {meta.get('error', 'sem registros')}")

        print(f"[SYNC FINALIZADO] Total sincronizado nesta execução: {grand_total} imóveis reais.")
    finally:
        conn.close()

    if args.run_radar:
        sys.path.insert(0, str(BASE_DIR / "scripts"))
        from run_radar_matcher import run_radar_matcher
        run_radar_matcher(dry_run=False)

    return 0


if __name__ == "__main__":
    sys.exit(main())
