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
import re
import smtplib
import ssl
import sys
import unicodedata
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
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


def normalize_text(val: str | None) -> str:
    if not val:
        return ""
    nfd = unicodedata.normalize("NFD", str(val))
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn").lower().strip()


def expand_cities(raw_cities: list[str] | None) -> list[str]:
    result: list[str] = []
    for item in raw_cities or []:
        if not item:
            continue
        for part in re.split(r"[,;|\n]+", str(item)):
            norm = normalize_text(part)
            if norm:
                result.append(norm)
    return result


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

    cities = expand_cities(profile.get("cities") or [])
    prop_city = normalize_text(prop.get("city"))
    if cities and not any(c in prop_city for c in cities):
        return None

    if profile.get("require_financing") and not prop.get("accepts_financing"):
        return None

    if not profile.get("accept_occupied", True) and prop.get("occupancy_status") == "OCCUPIED":
        return None

    banks = [b.upper() for b in (profile.get("banks") or []) if b]
    if banks and (prop.get("source") or "").upper() not in banks:
        return None

    ptypes = [normalize_text(t) for t in (profile.get("property_types") or []) if t]
    prop_type_norm = normalize_text(prop.get("property_type"))
    if ptypes and not any(t in prop_type_norm for t in ptypes):
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


def is_email_configured() -> bool:
    has_smtp = bool(os.getenv("SMTP_USER", "").strip() and os.getenv("SMTP_PASS", "").strip())
    has_resend = bool(os.getenv("RESEND_API_KEY", "").strip())
    return has_smtp or has_resend


def build_matches_html(matches: list[dict[str, Any]]) -> tuple[str, str]:
    items = []
    for m in matches[:8]:
        p = m["prop"]
        url_link = p.get("source_url") or ""
        link_html = (
            f' · <a href="{url_link}" target="_blank" rel="noopener">Ver edital/imóvel</a>'
            if url_link
            else ""
        )
        items.append(
            f"<li style='margin-bottom:10px;'><strong>{p.get('source')} • {p.get('property_type')} em {p.get('city')}/{p.get('state')}</strong> — "
            f"{format_brl(float(p.get('current_minimum_value') or 0))} ({p.get('discount_percentage')}% desc.) "
            f"[Score {m['score']}/100]{link_html}<br/><small>{m['summary']}</small></li>"
        )
    items_html = "".join(items)
    subject = f"Radar IA: {len(matches)} novas oportunidades para o seu perfil"
    html = f"<h2>Radar IA — Novas Oportunidades Compatíveis</h2><ul>{items_html}</ul>"
    return subject, html


def send_smtp_email(to_email: str, subject: str, html: str, text_fallback: str = "") -> tuple[bool, str]:
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip() or "smtp.gmail.com"
    smtp_port = int((os.getenv("SMTP_PORT", "587") or "587").strip())
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = "".join(os.getenv("SMTP_PASS", "").split())
    from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user).strip() or smtp_user
    from_name = os.getenv("SMTP_FROM_NAME", "G2 Auction • Radar IA").strip() or "G2 Auction • Radar IA"

    if not smtp_user or not smtp_pass or not to_email:
        return False, "SMTP_USER ou SMTP_PASS não configurado no .env."

    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = to_email
    msg["Subject"] = subject

    plain = text_fallback or "Novas oportunidades do Radar IA G2 Auction. Abra a versão HTML deste e-mail para ver os detalhes."
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    context = ssl.create_default_context()
    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=15) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [to_email], msg.as_string())
        return True, f"E-mail enviado via {smtp_host}:{smtp_port} para {to_email}"
    except smtplib.SMTPAuthenticationError as exc:
        err = (
            "Falha de autenticação SMTP no Google/Gmail. Verifique se a Verificação em 2 etapas está ativa "
            f"e se SMTP_PASS usa uma Senha de App de 16 caracteres (não a senha normal). Detalhe: {exc}"
        )
        print(f"[Radar SMTP Erro] {err}")
        return False, err
    except Exception as exc:
        err = f"Erro SMTP ({smtp_host}:{smtp_port}): {exc}"
        print(f"[Radar SMTP Erro] {err}")
        return False, err


def send_resend_email(to_email: str, matches: list[dict[str, Any]]) -> bool:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    from_email = os.getenv("RESEND_FROM_EMAIL", "Radar IA <onboarding@resend.dev>").strip()
    if not api_key or not to_email:
        return False

    subject, html = build_matches_html(matches)

    payload = json.dumps({
        "from": from_email,
        "to": [to_email],
        "subject": subject,
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


def send_alert_email(to_email: str, matches: list[dict[str, Any]]) -> bool:
    if os.getenv("SMTP_USER", "").strip() and os.getenv("SMTP_PASS", "").strip():
        subject, html = build_matches_html(matches)
        plain_lines = [
            f"- {m['prop'].get('source')} | {m['prop'].get('city')}/{m['prop'].get('state')} "
            f"({format_brl(float(m['prop'].get('current_minimum_value') or 0))}, "
            f"{m['prop'].get('discount_percentage')}% desc.): {m['summary']}"
            for m in matches[:8]
        ]
        ok, _ = send_smtp_email(to_email, subject, html, text_fallback="\n".join(plain_lines))
        return ok
    if os.getenv("RESEND_API_KEY", "").strip():
        return send_resend_email(to_email, matches)
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

        for prof in profiles:
            user_id = str(prof["user_id"])
            states = [s.upper() for s in (prof.get("states") or []) if s]
            max_price = float(prof.get("max_price") or 0)
            price_tol_pct = float(prof.get("price_tolerance_pct") or 0)
            max_price_tol = max_price * (1 + price_tol_pct / 100.0) if max_price > 0 else 0
            min_disc = float(prof.get("min_discount_pct") or 0)
            disc_tol_pp = float(prof.get("discount_tolerance_pp") or 0)
            min_disc_tol = max(0.0, min_disc - disc_tol_pp)

            where_clauses = ["status = 'ACTIVE'"]
            params: list[Any] = []
            if states:
                where_clauses.append("upper(state) = ANY(%s)")
                params.append(states)
            if max_price_tol > 0:
                where_clauses.append("coalesce(current_minimum_value, sale_value, 0) > 0")
                where_clauses.append("coalesce(current_minimum_value, sale_value, 0) <= %s")
                params.append(max_price_tol)
            if min_disc_tol > 0:
                where_clauses.append("coalesce(discount_percentage, 0) >= %s")
                params.append(min_disc_tol)

            sql = f"""
                SELECT id, source, source_property_id, title, state, city, property_type,
                       current_minimum_value, sale_value, appraisal_value, discount_percentage,
                       accepts_financing, occupancy_status, source_url
                FROM public.properties
                WHERE {' AND '.join(where_clauses)}
                ORDER BY discount_percentage DESC NULLS LAST
                LIMIT 5000;
            """
            cur.execute(sql, tuple(params))
            active_props = cur.fetchall()

            cur.execute(
                "SELECT property_id::text, last_notified_price FROM public.user_property_alerts WHERE user_id = %s;",
                (user_id,),
            )
            already_alerted = {row["property_id"]: float(row["last_notified_price"] or 0) for row in cur.fetchall()}

            matched_batch = []
            for prop in active_props:
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

            # Busca e-mail do auth.users caso SMTP (Gmail) ou Resend esteja configurado
            if prof.get("notify_email") and is_email_configured():
                cur.execute("SELECT email FROM auth.users WHERE id = %s;", (user_id,))
                u_row = cur.fetchone()
                if u_row and u_row.get("email"):
                    if send_alert_email(u_row["email"], top_matches):
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


def notify_open_quota_alerts() -> dict[str, int]:
    """Dispara alertas por Gmail SMTP sobre chamadas de capital abertas para cotistas."""
    conn = get_pg_connection()
    stats = {"calls_checked": 0, "emails_sent": 0}
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT cc.id, cc.vehicle_id, cc.title, cc.total_call_brl, cc.due_date,
                   iv.name AS vehicle_name
            FROM public.capital_calls cc
            JOIN public.investment_vehicles iv ON iv.id = cc.vehicle_id
            WHERE cc.status = 'OPEN'
            ORDER BY cc.created_at DESC;
        """)
        calls = cur.fetchall()
        stats["calls_checked"] = len(calls)
        if not calls or not (os.getenv("SMTP_USER", "").strip() and os.getenv("SMTP_PASS", "").strip()):
            print(f"[Quota Alerts] {stats}")
            return stats

        for call in calls:
            cur.execute("""
                SELECT DISTINCT u.email
                FROM (
                    SELECT user_id FROM public.quota_ledger_events
                    WHERE vehicle_id = %s AND user_id IS NOT NULL
                    UNION
                    SELECT user_id FROM public.quota_subscription_intents
                    WHERE vehicle_id = %s AND status IN ('PENDING', 'APPROVED', 'CONVERTED')
                ) ids
                JOIN auth.users u ON u.id = ids.user_id
                WHERE u.email IS NOT NULL;
            """, (str(call["vehicle_id"]), str(call["vehicle_id"])))
            recipients = [r["email"] for r in cur.fetchall()]
            for email in recipients:
                subject = f"Chamada de Capital: {call['vehicle_name']} — {call['title']}"
                html = (
                    f"<h2>Chamada de Capital Aberta — G2 Auction</h2>"
                    f"<p><strong>Operação:</strong> {call['vehicle_name']}</p>"
                    f"<p><strong>Descrição:</strong> {call['title']}</p>"
                    f"<p><strong>Valor Total:</strong> {format_brl(float(call['total_call_brl']))} "
                    f"(rateado conforme suas cotas)</p>"
                    f"<p><strong>Vencimento:</strong> {call['due_date']}</p>"
                    f"<p>Acesse a aba <em>Área do Investidor → Extrato & Rateio</em> para conferir sua fração exata.</p>"
                )
                ok, _ = send_smtp_email(email, subject, html)
                if ok:
                    stats["emails_sent"] += 1
        print(f"[Quota Alerts] {stats}")
        return stats
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Executar Radar IA e disparos de alertas.")
    parser.add_argument("--dry-run", action="store_true", help="Simula sem gravar nem enviar mensagens.")
    parser.add_argument(
        "--notify-quota-alerts",
        action="store_true",
        help="Notifica cotistas sobre chamadas de capital abertas via Gmail SMTP.",
    )
    parser.add_argument(
        "--test-email",
        type=str,
        default=None,
        help="Envia um e-mail de teste via SMTP/Resend configurado no .env e encerra.",
    )
    args = parser.parse_args()
    if args.notify_quota_alerts:
        notify_open_quota_alerts()
        sys.exit(0)
    if args.test_email:
        load_dotenv(BASE_DIR / ".env")
        if os.getenv("SMTP_USER", "").strip() and os.getenv("SMTP_PASS", "").strip():
            ok, detail = send_smtp_email(
                args.test_email.strip(),
                "Teste G2 Auction • Radar IA (Gmail SMTP)",
                (
                    "<h2>Conexão Gmail SMTP funcionando!</h2>"
                    "<p>O envio centralizado de notificações do <strong>Radar IA (G2 Auction)</strong> está ativo.</p>"
                ),
                text_fallback="Conexão Gmail SMTP funcionando! O envio de notificações do Radar IA (G2 Auction) está ativo.",
            )
            print(f"[Teste E-mail] {'OK' if ok else 'FALHA'} — {detail}")
            sys.exit(0 if ok else 1)
        elif os.getenv("RESEND_API_KEY", "").strip():
            ok = send_resend_email(
                args.test_email.strip(),
                [
                    {
                        "prop": {
                            "source": "CAIXA",
                            "city": "Teste",
                            "state": "SP",
                            "current_minimum_value": 250000,
                            "discount_percentage": 40,
                        },
                        "score": 95.0,
                        "summary": "Teste de disparo via Resend API.",
                    }
                ],
            )
            print(f"[Teste E-mail Resend] {'OK' if ok else 'FALHA'}")
            sys.exit(0 if ok else 1)
        else:
            print("[Teste E-mail] FALHA — Defina SMTP_USER e SMTP_PASS (ou RESEND_API_KEY) no .env.")
            sys.exit(1)
    run_radar_matcher(dry_run=args.dry_run)
