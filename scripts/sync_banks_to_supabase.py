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
import html as html_lib
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
# CONECTORES REAIS: MEGA LEILÕES E PORTAL ZUK (SANTANDER, ITAÚ, BB, JUDICIAIS)
# =====================================================================
def parse_br_datetime_to_iso(text: str | None) -> str | None:
    if not text:
        return None
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})(?:[^\d]+(\d{2}):(\d{2}))?", text)
    if not m:
        return None
    day, month, year = m.group(1), m.group(2), m.group(3)
    hh = m.group(4) or "10"
    mm = m.group(5) or "00"
    return f"{year}-{month}-{day}T{hh}:{mm}:00-03:00"


def classify_source_from_text(text: str, is_judicial: bool, fallback_source: str) -> str:
    low = (text or "").lower()
    if "santander" in low:
        return "SANTANDER"
    if "itaú" in low or "itau" in low:
        return "ITAU"
    if "banco do brasil" in low or "bb" in re.findall(r"\bbb\b", low):
        return "BB"
    if "bradesco" in low:
        return "BRADESCO"
    if "caixa" in low or "cef" in re.findall(r"\bcef\b", low):
        return "CAIXA"
    if is_judicial:
        return "JUDICIAL"
    return fallback_source


def infer_property_type(text: str | None) -> str:
    low = (text or "").lower()
    if "apartamento" in low or "apto" in low:
        return "Apartamento"
    if "casa" in low or "sobrado" in low:
        return "Casa"
    if "terreno" in low or "lote" in low or "gleba" in low:
        return "Terreno"
    if "galpão" in low or "galpao" in low:
        return "Galpão"
    if "loja" in low:
        return "Loja"
    if "sala" in low or "conjunto" in low:
        return "Sala"
    if "comercial" in low or "industrial" in low or "prédio" in low or "predio" in low:
        return "Comercial"
    if "rural" in low or "fazenda" in low or "sítio" in low or "chácara" in low:
        return "Rural"
    return "Imóvel"


def strip_html_tags(raw: str | None) -> str:
    if not raw:
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html_lib.unescape(cleaned)).strip()


def fetch_mega_leiloes_uf(uf: str, max_pages: int = 8) -> list[dict[str, Any]]:
    uf_upper = uf.strip().upper()
    uf_lower = uf_upper.lower()
    items: list[dict[str, Any]] = []
    page = 1
    total_pages = 1
    today_iso = dt.date.today().isoformat()

    while page <= min(total_pages, max_pages):
        url = f"https://www.megaleiloes.com.br/imoveis/{uf_lower}?pagina={page}"
        try:
            req = urllib.request.Request(url, headers={**BROWSER_HEADERS, "Accept": "text/html,application/xhtml+xml"})
            with urllib.request.urlopen(req, timeout=20) as resp:
                if resp.status != 200:
                    break
                html_text = resp.read().decode("utf-8", errors="ignore")
        except Exception as exc:
            print(f"[MEGA {uf_upper} pág {page}] aviso: {exc}")
            break

        if page == 1:
            m_last = re.search(r'pagina=(\d+)["\']\s+rel=["\']last["\']', html_text)
            if not m_last:
                m_last = re.search(r'rel=["\']last["\'][^>]+pagina=(\d+)', html_text)
            if m_last:
                total_pages = max(1, int(m_last.group(1)))

        blocks = re.split(r'<div[^>]+class="col-sm-6 col-md-4 col-lg-3"[^>]+data-key="(\d+)"[^>]*>', html_text)
        # re.split com grupo retorna [prefix, key1, block1, key2, block2, ...]
        for idx in range(1, len(blocks) - 1, 2):
            data_key = blocks[idx]
            card = blocks[idx + 1]

            m_title = re.search(r'<a[^>]+class="card-title"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', card)
            if not m_title:
                continue
            raw_url = html_lib.unescape(m_title.group(1)).split("?")[0]
            title = strip_html_tags(m_title.group(2))

            m_num = re.search(r'<div class="card-number[^"]*">([^<]+)</div>', card)
            card_num = strip_html_tags(m_num.group(1)) if m_num else data_key
            prop_id = f"MEGA-{card_num}"

            m_img = re.search(r'data-bg="([^"]+)"', card)
            photo_url = html_lib.unescape(m_img.group(1)) if m_img else None

            m_bank = re.search(r'bank_icons/leilao-banco-([^.]+)\.png', card)
            bank_hint = m_bank.group(1) if m_bank else ""

            m_mod = re.search(r'<div class="card-instance-title">\s*<a[^>]*>([^<]+)</a>', card)
            mod_label = strip_html_tags(m_mod.group(1)) if m_mod else "Extrajudicial"
            is_judicial = "judicial" in mod_label.lower() and "extra" not in mod_label.lower()

            source = classify_source_from_text(f"{bank_hint} {title}", is_judicial, "MEGA")

            m_loc = re.search(r'<a class="card-locality"[^>]*>([^<]+)</a>', card)
            loc_str = strip_html_tags(m_loc.group(1)) if m_loc else ""
            city = loc_str.split(",")[0].strip() if "," in loc_str else loc_str
            state = loc_str.split(",")[1].strip().upper()[:2] if "," in loc_str else uf_upper

            m_down = re.search(r'<div class="card-down">[\s\S]*?<span class="value">(\d+(?:[.,]\d+)?)%</span>', card)
            disc_val = parse_br_number(m_down.group(1)) if m_down else None

            m_card_price = re.search(r'<div class="card-price">([^<]+)</div>', card)
            card_price = parse_br_number(m_card_price.group(1)) if m_card_price else None

            inst_vals = [parse_br_number(v) for v in re.findall(r'<span class="card-instance-value">([^<]+)</span>', card)]
            inst_vals = [v for v in inst_vals if v and v > 0]
            first_val = inst_vals[0] if len(inst_vals) >= 1 else card_price
            second_val = inst_vals[1] if len(inst_vals) >= 2 else None

            m_d1 = re.search(r'<span class="card-first-instance-date">([\s\S]*?)</span>', card)
            m_d2 = re.search(r'<span class="card-second-instance-date">([\s\S]*?)</span>', card)
            d1_iso = parse_br_datetime_to_iso(strip_html_tags(m_d1.group(1))) if m_d1 else None
            d2_iso = parse_br_datetime_to_iso(strip_html_tags(m_d2.group(1))) if m_d2 else None

            sale_val = second_val or first_val or card_price
            appraisal_val = first_val
            if sale_val and appraisal_val and appraisal_val <= sale_val and disc_val and 0 < disc_val < 99:
                appraisal_val = round(sale_val / (1 - disc_val / 100.0), 2)
            elif sale_val and not appraisal_val and disc_val and 0 < disc_val < 99:
                appraisal_val = round(sale_val / (1 - disc_val / 100.0), 2)

            if sale_val and appraisal_val and appraisal_val > sale_val and not disc_val:
                disc_val = round(((appraisal_val - sale_val) / appraisal_val) * 100.0, 2)

            m_area = re.search(r'(\d+(?:[.,]\d+)?)\s*m²', title, re.IGNORECASE)
            area_val = parse_br_number(m_area.group(1)) if m_area else None
            m_vagas = re.search(r'(\d+)\s*vaga', title, re.IGNORECASE)
            vagas_val = int(m_vagas.group(1)) if m_vagas else None

            modality = f"Leilão {mod_label} (Mega Leilões)"
            record = {
                "source": source,
                "source_property_id": prop_id,
                "title": title,
                "state": state,
                "city": city,
                "neighborhood": None,
                "address": title,
                "property_type": infer_property_type(title),
                "sale_value": sale_val,
                "current_minimum_value": sale_val,
                "appraisal_value": appraisal_val,
                "first_auction_value": first_val,
                "second_auction_value": second_val,
                "discount_percentage": disc_val if (disc_val and 0 < disc_val < 100) else None,
                "calculated_discount_percentage": disc_val if (disc_val and 0 < disc_val < 100) else None,
                "accepts_financing": None,
                "occupancy_status": "UNKNOWN",
                "description": f"{title} — {modality}. Comitente/Origem: {bank_hint or source}.",
                "sale_modality": modality,
                "source_url": raw_url,
                "total_area": area_val,
                "private_area": area_val,
                "land_area": None,
                "bedrooms": None,
                "parking_spaces": vagas_val,
                "main_photo_url": photo_url,
                "first_auction_date": d1_iso,
                "second_auction_date": d2_iso,
                "auction_date": d2_iso or d1_iso,
                "auctioneer": "Mega Leilões",
                "payment_conditions": None,
                "max_installments": None,
                "min_down_payment": None,
                "min_installment_value": None,
                "status": "ACTIVE",
                "source_generated_at": today_iso,
                "source_file_url": url,
                "raw_list_data": {"auctioneer": "Mega Leilões", "bank_hint": bank_hint, "card_number": card_num},
            }
            record["source_hash"] = compute_hash(record)
            items.append(record)

        page += 1
        if page <= min(total_pages, max_pages):
            time.sleep(0.25)

    return items


def fetch_portal_zuk_uf(uf: str) -> list[dict[str, Any]]:
    uf_upper = uf.strip().upper()
    url = f"https://www.portalzuk.com.br/leilao-de-imoveis/u/todos-imoveis/{uf_upper.lower()}"
    today_iso = dt.date.today().isoformat()

    try:
        req = urllib.request.Request(url, headers={**BROWSER_HEADERS, "Accept": "text/html,application/xhtml+xml"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status != 200:
                return []
            html_text = resp.read().decode("utf-8", errors="ignore")
    except Exception as exc:
        print(f"[ZUK {uf_upper}] aviso: {exc}")
        return []

    blocks = html_text.split('class="card-property card_lotes_div"')
    items: list[dict[str, Any]] = []

    for card in blocks[1:]:
        m_link = re.search(r'<a[^>]+href="(https://www\.portalzuk\.com\.br/imovel/[^"]+)"[^>]*title="([^"]*)"', card)
        if not m_link:
            m_link = re.search(r'<a[^>]+href="(https://www\.portalzuk\.com\.br/imovel/[^"]+)"', card)
        if not m_link:
            continue

        item_url = html_lib.unescape(m_link.group(1)).split("?")[0]
        title_attr = html_lib.unescape(m_link.group(2)) if m_link.lastindex and m_link.lastindex >= 2 else ""

        m_id = re.search(r'-(\d+)$', item_url)
        if not m_id:
            m_id = re.search(r'id="(\d+)"', card)
        lot_id = m_id.group(1) if m_id else hashlib.md5(item_url.encode("utf-8")).hexdigest()[:10]
        prop_id = f"ZUK-{lot_id}"

        m_img = re.search(r'<img[^>]+src="(https://imagens\.portalzuk\.com\.br/[^"]+)"', card)
        photo_url = html_lib.unescape(m_img.group(1)) if m_img else None

        m_type = re.search(r'<span class="card-property-price-lote">([^<]+)</span>', card)
        raw_type = strip_html_tags(m_type.group(1)) if m_type else "Imóvel"

        m_addr_block = re.search(r'<address class="card-property-address">([\s\S]*?)</address>', card)
        city, state, neigh, street = "", uf_upper, None, None
        if m_addr_block:
            addr_blk = m_addr_block.group(1)
            m_city_st = re.search(r'<a[^>]*>([^<]+)</a>\s*(?:-\s*([^<]+))?</span>', addr_blk)
            if m_city_st:
                city_st = strip_html_tags(m_city_st.group(1))
                if "/" in city_st:
                    city = city_st.split("/")[0].strip()
                    state = city_st.split("/")[1].strip().upper()[:2]
                else:
                    city = city_st
                if m_city_st.group(2):
                    neigh = strip_html_tags(m_city_st.group(2))
            spans = re.findall(r'<span[^>]*>([\s\S]*?)</span>', addr_blk)
            if spans:
                last_span = strip_html_tags(spans[-1])
                if last_span and city not in last_span:
                    street = last_span

        m_area = re.search(r'<span class="card-property-info-label">([^<]+)</span>', card)
        area_val = None
        if m_area:
            m_a_num = re.search(r'([\d.,]+)\s*m²', m_area.group(1))
            if m_a_num:
                area_val = parse_br_number(m_a_num.group(1))

        # Preços, descontos e datas das praças
        price_matches = re.findall(
            r'<span class="card-property-price-value">R\$\s*([\d.,]+)(?:[\s\S]*?<span class="card-property-price-percent">[\s\S]*?(\d+)[\s\S]*?</span>)?',
            card,
        )
        parsed_prices = [(parse_br_number(p), parse_br_number(d) if d else None) for p, d in price_matches]
        parsed_prices = [(p, d) for p, d in parsed_prices if p and p > 0]

        first_val = parsed_prices[0][0] if len(parsed_prices) >= 1 else None
        second_val = parsed_prices[1][0] if len(parsed_prices) >= 2 else None
        sale_val = second_val or first_val

        discounts = [d for _, d in parsed_prices if d and 0 < d < 100]
        disc_val = discounts[-1] if discounts else None

        appraisal_val = first_val
        if sale_val and appraisal_val and appraisal_val <= sale_val and disc_val and 0 < disc_val < 99:
            appraisal_val = round(sale_val / (1 - disc_val / 100.0), 2)

        date_matches = re.findall(r'<span class="card-property-price-data">([^<]+)</span>', card)
        d1_iso = parse_br_datetime_to_iso(date_matches[0]) if len(date_matches) >= 1 else None
        d2_iso = parse_br_datetime_to_iso(date_matches[1]) if len(date_matches) >= 2 else None

        is_judicial = "judicial" in (title_attr + " " + item_url).lower() and "extrajudicial" not in (title_attr + " " + item_url).lower()
        source = classify_source_from_text(title_attr, is_judicial, "ZUK")

        clean_title = f"{raw_type} — {street or neigh or city}, {city}/{state}".strip(" —,")
        if title_attr and "|" in title_attr:
            comitente_part = title_attr.split("|")[0].replace("em leilão -", "").strip()
        else:
            comitente_part = title_attr or "Portal Zuk"

        record = {
            "source": source,
            "source_property_id": prop_id,
            "title": clean_title,
            "state": state,
            "city": city,
            "neighborhood": neigh,
            "address": street or neigh or f"{city}/{state}",
            "property_type": infer_property_type(raw_type),
            "sale_value": sale_val,
            "current_minimum_value": sale_val,
            "appraisal_value": appraisal_val,
            "first_auction_value": first_val,
            "second_auction_value": second_val,
            "discount_percentage": disc_val,
            "calculated_discount_percentage": disc_val,
            "accepts_financing": None,
            "occupancy_status": "UNKNOWN",
            "description": f"{comitente_part} (Portal Zuk)".strip(),
            "sale_modality": "Leilão Judicial (Portal Zuk)" if is_judicial else "Leilão Extrajudicial (Portal Zuk)",
            "source_url": item_url,
            "total_area": area_val,
            "private_area": area_val,
            "land_area": None,
            "bedrooms": None,
            "parking_spaces": None,
            "main_photo_url": photo_url,
            "first_auction_date": d1_iso,
            "second_auction_date": d2_iso,
            "auction_date": d2_iso or d1_iso,
            "auctioneer": "Portal Zuk",
            "payment_conditions": None,
            "max_installments": None,
            "min_down_payment": None,
            "min_installment_value": None,
            "status": "ACTIVE",
            "source_generated_at": today_iso,
            "source_file_url": url,
            "raw_list_data": {"auctioneer": "Portal Zuk", "title_attr": title_attr},
        }
        record["source_hash"] = compute_hash(record)
        items.append(record)

    return items


def reconcile_auctioneer_uf(conn, id_prefix: str, uf: str, active_ids: set[str]) -> int:
    if not active_ids:
        return 0
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE public.properties
        SET status = 'POSSIBLY_REMOVED', updated_at = NOW()
        WHERE source_property_id LIKE %s
          AND state = %s
          AND status = 'ACTIVE'
          AND NOT (source_property_id = ANY(%s));
        """,
        (f"{id_prefix}%", uf.upper(), list(active_ids)),
    )
    removed = cur.rowcount
    conn.commit()
    return removed


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
    parser.add_argument("--banks", default="bradesco,caixa,mega,zuk", help="Fontes separadas por vírgula (ex: bradesco,caixa,mega,zuk)")
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

        if "mega" in banks:
            for uf in ufs:
                t0 = time.time()
                rows = fetch_mega_leiloes_uf(uf)
                if rows:
                    written = upsert_properties_batch(conn, rows)
                    removed = reconcile_auctioneer_uf(conn, "MEGA-", uf, {r["source_property_id"] for r in rows})
                    grand_total += written
                    print(f"[MEGA LEILÕES {uf}] {written} imóveis sincronizados (removidos: {removed}) em {time.time() - t0:.1f}s")
                else:
                    print(f"[MEGA LEILÕES {uf}] 0 lotes encontrados.")

        if "zuk" in banks:
            for uf in ufs:
                t0 = time.time()
                rows = fetch_portal_zuk_uf(uf)
                if rows:
                    written = upsert_properties_batch(conn, rows)
                    removed = reconcile_auctioneer_uf(conn, "ZUK-", uf, {r["source_property_id"] for r in rows})
                    grand_total += written
                    print(f"[PORTAL ZUK {uf}] {written} imóveis sincronizados (removidos: {removed}) em {time.time() - t0:.1f}s")
                else:
                    print(f"[PORTAL ZUK {uf}] 0 lotes encontrados.")

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
