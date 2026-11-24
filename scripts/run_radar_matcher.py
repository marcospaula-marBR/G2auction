"""
Motor Automatizado do Radar IA + Disparo de Notificações (Etapa 3)
Lê perfis ativos de `public.user_alert_profiles`, pontua imóveis recém-sincronizados
(match exato + match próximo), gera resumo com Gemini Flash (se GEMINI_API_KEY
estiver configurada) ou heurística determinística gratuita, grava em
`public.user_property_alerts` evitando duplicatas e dispara canais configurados.

Uso:
    python scripts/run_radar_matcher.py
    python scripts/run_radar_matcher.py --dry-run
"""
import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path
from typing import Any

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent


def get_pg_connection():
    load_dotenv(BASE_DIR / ".env")
    dsn = (os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL") or "").strip()
    if not dsn or dsn.startswith("sqlite"):
        raise RuntimeError("DIRECT_URL ou DATABASE_URL PostgreSQL não configurada no .env")
    return psycopg2.connect(dsn, connect_timeout=15)


def format_brl(value: float | None) -> str:
    if value is None:
        return "Sob consulta"
    s = f"{value:,.0f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def generate_ai_summary_gemini(profile: dict[str, Any], prop: dict[str, Any], match_type: str, score: float) -> str | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    prompt = (
        f"Você é um analista de leilões imobiliários no Brasil. Escreva NO MÁXIMO 2 frases curtas e objetivas em pt-BR "
        f"explicando por que este imóvel é relevante para o investidor.\n"
        f"Perfil: teto {format_brl(float(profile.get('max_price') or 0))}, desconto alvo {profile.get('min_discount_pct')}%, "
        f"tipo match: {'Exato' if match_type == 'EXACT' else 'Próximo do alvo'}, score: {score}/100.\n"
        f"Imóvel: {prop.get('title') or prop.get('property_type')} em {prop.get('city')}/{prop.get('state')}, "
        f"lance mínimo {format_brl(float(prop.get('current_minimum_value') or 0))}, avaliação {format_brl(float(prop.get('appraisal_value') or 0))}, "
        f"desconto {prop.get('discount_percentage')}%, financiamento: {prop.get('accepts_financing')}, ocupação: {prop.get('occupancy_status')}."
    )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 120, "temperature": 0.3},
    }).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return text[:400] if text else None
    except Exception:
        return None


def build_summary(profile: dict[str, Any], prop: dict[str, Any], match_type: str, score: float) -> str:
    ai_text = generate_ai_summary_gemini(profile, prop, match_type, score)
    if ai_text:
        return ai_text

    price = float(prop.get("current_minimum_value") or prop.get("sale_value") or 0)
    appraisal = float(prop.get("appraisal_value") or 0)
    disc = float(prop.get("discount_percentage") or 0)
    city = prop.get("city") or ""
    uf = prop.get("state") or ""
    if match_type == "EXACT":
        return (
            f"Match direto em {city}/{uf}: lance mínimo de {format_brl(price)} "
            f"({disc:.0f}% abaixo da avaliação de {format_brl(appraisal)})."
        )
    return (
        f"Oportunidade próxima do seu radar em {city}/{uf}: {format_brl(price)} "
        f"com {disc:.0f}% de deságio — dentro da sua margem de tolerância."
    )


def score_candidate(profile: dict[str, Any], prop: dict[str, Any]) -> tuple[float, str] | None:
    price = float(prop.get("current_minimum_value") or prop.get("sale_value") or 0)
    if price <= 0:
        return None

    max_price = float(profile.get("max_price") or 0)
    price_tol_pct = float(profile.get("price_tolerance_pct") or 0)
    max_price_tol = max_price * (1 + price_tol_pct / 100.0) if max_price > 0 else float("inf")
    if price > max_price_tol:
        return None

    min_disc = float(profile.get("min_discount_pct") or 0)
    disc_tol_pp = float(profile.get("discount_tolerance_pp") or 0)
    disc = float(prop.get("discount_percentage") or 0)
    if disc < max(0.0, min_disc - disc_tol_pp):
        return None

    cities = [c.strip().lower() for c in (profile.get("cities") or []) if c and c.strip()]
    prop_city = (prop.get("city") or "").lower()
    if cities and not any(c in prop_city for c in cities):
        return None

    if profile.get("require_financing") and not prop.get("accepts_financing"):
        return None

    if not profile.get("accept_occupied", True) and prop.get("occupancy_status") == "OCCUPIED":
        return None

    banks = [b.upper() for b in (profile.get("banks") or []) if b]
    if banks and (prop.get("source") or "").upper() not in banks:
        return None

    ptypes = [t.lower() for t in (profile.get("property_types") or []) if t]
    if ptypes and not any(t in (prop.get("property_type") or "").lower() for t in ptypes):
        return None

    price_exact = max_price <= 0 or price <= max_price
    disc_exact = disc >= min_disc
    match_type = "EXACT" if (price_exact and disc_exact) else "NEAR"

    score = 88.0
    if price_exact:
        score += 6.0
    else:
        over_pct = ((price - max_price) / max_price) * 100.0
        score -= min(18.0, over_pct)

    if disc_exact:
        score += min(6.0, (disc - min_disc) // 5.0)
    else:
        score -= min(12.0, (min_disc - disc) * 2.0)

    if prop.get("occupancy_status") == "VACANT":
        score += 2.0

    return round(max(60.0, min(99.0, score)), 1), match_type


def send_telegram_alert(chat_id: str, matches: list[dict[str, Any]]) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not token or not chat_id:
        return False

    lines = ["🏠 *Radar IA — Novas Oportunidades*", ""]
    for m in matches[:5]:
        p = m["prop"]
        price = format_brl(float(p.get("current_minimum_value") or 0))
        lines.append(
            f"• *{p.get('source')}* | {p.get('city')}/{p.get('state')} — {price} "
            f"({p.get('discount_percentage')}% desc.) [Score {m['score']}]\n  _{m['summary']}_"
        )
    text = "\n".join(lines)

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}).encode("utf-8")
    try:
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as exc:
        print(f"[Radar Telegram Erro] {exc}")
        return False


def send_resend_email(to_email: str, matches: list[dict[str, Any]]) -> bool:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    from_email = os.getenv("RESEND_FROM_EMAIL", "Radar IA <onboarding@resend.dev>").strip()
    if not api_key or not to_email:
        return False

    items_html = "".join(
        f"<li><strong>{m['prop'].get('source')} • {m['prop'].get('city')}/{m['prop'].get('state')}</strong> — "
        f"{format_brl(float(m['prop'].get('current_minimum_value') or 0))} ({m['prop'].get('discount_percentage')}% desc.) "
        f"[Score {m['score']}/100]<br/><small>{m['summary']}</small></li>"
        for m in matches[:8]
    )
    html = f"<h2>Radar IA — Novas Oportunidades Compatíveis</h2><ul>{items_html}</ul>"

    payload = json.dumps({
        "from": from_email,
        "to": [to_email],
        "subject": f"Radar IA: {len(matches)} novas oportunidades para o seu perfil",
        "html": html,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as exc:
        print(f"[Radar Email Erro] {exc}")
        return False


def run_radar_matcher(dry_run: bool = False) -> dict[str, int]:
    conn = get_pg_connection()
    stats = {"profiles_checked": 0, "new_alerts": 0, "telegram_sent": 0, "emails_sent": 0}

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM public.user_alert_profiles WHERE active = TRUE;")
        profiles = cur.fetchall()
        stats["profiles_checked"] = len(profiles)

        if not profiles:
            print("[Radar IA] Nenhum perfil ativo em public.user_alert_profiles ainda.")
            return stats

        cur.execute("""
            SELECT id, source, source_property_id, title, state, city, property_type,
                   current_minimum_value, sale_value, appraisal_value, discount_percentage,
                   accepts_financing, occupancy_status, source_url
            FROM public.properties
            WHERE status = 'ACTIVE'
            ORDER BY discount_percentage DESC NULLS LAST
            LIMIT 3000;
        """)
        active_props = cur.fetchall()

        for prof in profiles:
            user_id = str(prof["user_id"])
            states = [s.upper() for s in (prof.get("states") or []) if s]

            cur.execute(
                "SELECT property_id::text, last_notified_price FROM public.user_property_alerts WHERE user_id = %s;",
                (user_id,),
            )
            already_alerted = {row["property_id"]: float(row["last_notified_price"] or 0) for row in cur.fetchall()}

            matched_batch = []
            for prop in active_props:
                if states and (prop.get("state") or "").upper() not in states:
                    continue

                pid = str(prop["id"])
                cur_price = float(prop.get("current_minimum_value") or prop.get("sale_value") or 0)
                prev_price = already_alerted.get(pid)
                # Só re-notifica se ainda não foi notificado ou caiu >= 5% de preço
                if prev_price is not None and (prev_price <= 0 or cur_price > prev_price * 0.95):
                    continue

                scored = score_candidate(prof, prop)
                if not scored:
                    continue

                score, match_type = scored
                matched_batch.append({
                    "prop": prop,
                    "score": score,
                    "match_type": match_type,
                })

            matched_batch.sort(key=lambda x: x["score"], reverse=True)
            top_matches = matched_batch[:5]
            if not top_matches:
                continue

            for m in top_matches:
                m["summary"] = build_summary(prof, m["prop"], m["match_type"], m["score"])

            if dry_run:
                print(f"[Radar DRY-RUN] Perfil {prof['name']} ({user_id}): {len(top_matches)} matches.")
                stats["new_alerts"] += len(top_matches)
                continue

            dispatched_channels: list[str] = []
            if prof.get("notify_telegram") and prof.get("telegram_chat_id"):
                if send_telegram_alert(prof["telegram_chat_id"], top_matches):
                    dispatched_channels.append("TELEGRAM")
                    stats["telegram_sent"] += 1

            # Busca e-mail do auth.users caso Resend esteja configurado
            if prof.get("notify_email") and os.getenv("RESEND_API_KEY"):
                cur.execute("SELECT email FROM auth.users WHERE id = %s;", (user_id,))
                u_row = cur.fetchone()
                if u_row and u_row.get("email"):
                    if send_resend_email(u_row["email"], top_matches):
                        dispatched_channels.append("EMAIL")
                        stats["emails_sent"] += 1

            for m in top_matches:
                prop = m["prop"]
                cur_price = float(prop.get("current_minimum_value") or prop.get("sale_value") or 0)
                cur.execute(
                    """
                    INSERT INTO public.user_property_alerts (
                        user_id, tenant_id, property_id, alert_profile_id,
                        match_score, match_type, ai_summary, notified_channels, last_notified_price
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, property_id) DO UPDATE SET
                        match_score = EXCLUDED.match_score,
                        match_type = EXCLUDED.match_type,
                        ai_summary = EXCLUDED.ai_summary,
                        notified_channels = EXCLUDED.notified_channels,
                        last_notified_price = EXCLUDED.last_notified_price,
                        created_at = NOW();
                    """,
                    (
                        user_id,
                        prof.get("tenant_id"),
                        str(prop["id"]),
                        str(prof["id"]),
                        m["score"],
                        m["match_type"],
                        m["summary"],
                        dispatched_channels,
                        cur_price,
                    ),
                )
                stats["new_alerts"] += 1

        conn.commit()
        print(f"[Radar IA Concluído] {stats}")
        return stats
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Executar Radar IA e disparos de alertas.")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar nem enviar mensagens.")
    args = parser.parse_args()
    run_radar_matcher(dry_run=args.dry_run)
