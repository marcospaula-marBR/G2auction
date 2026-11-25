import type { TenantConfig } from '../config/tenant';
import { getTenantIconUrl } from './brandingIcons';
import { formatCurrencyBRL } from './financial';
import type { OfficialBcbRates } from './bcbRatesService';
import type { CapitalCall } from './investorService';
import {
  computeOwnershipPct,
  computeProRataAmount,
  convertQuotasToBrl,
  formatQuotas,
  type InvestmentVehicle,
  type QuotaLedgerEvent,
  type QuotaSubscriptionIntent,
} from './quotaEngine';

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openInvestorDossierPdf(params: {
  tenant: TenantConfig;
  investorName: string;
  investorEmail: string;
  vehicles: InvestmentVehicle[];
  quotasByVehicle: Record<string, number>;
  ledgerEvents: QuotaLedgerEvent[];
  intents: QuotaSubscriptionIntent[];
  capitalCalls: CapitalCall[];
  bcbRates: OfficialBcbRates | null;
}) {
  const {
    tenant,
    investorName,
    investorEmail,
    vehicles,
    quotasByVehicle,
    ledgerEvents,
    intents,
    capitalCalls,
    bcbRates,
  } = params;

  const vehiclesById: Record<string, InvestmentVehicle> = {};
  for (const v of vehicles) vehiclesById[v.id] = v;

  let totalQuotas = 0;
  let totalNavBrl = 0;
  const activePositions = vehicles
    .map((v) => {
      const q = quotasByVehicle[v.id] || 0;
      if (q <= 0) return null;
      const valBrl = convertQuotasToBrl(q, v.current_nav_per_quota);
      const sharePct = computeOwnershipPct(q, v.total_quotas_issued);
      totalQuotas += q;
      totalNavBrl += valBrl;
      return { vehicle: v, quotas: q, valBrl, sharePct };
    })
    .filter(Boolean) as {
    vehicle: InvestmentVehicle;
    quotas: number;
    valBrl: number;
    sharePct: number;
  }[];

  const openIntents = intents.filter((i) => i.status === 'PENDING' || i.status === 'APPROVED');
  const reservedBrl = openIntents.reduce((acc, i) => acc + i.amount_brl, 0);
  const openCalls = capitalCalls.filter((c) => c.status === 'OPEN');

  const logoSrc =
    tenant.showLogo && tenant.logoUrl
      ? tenant.logoUrl.startsWith('/')
        ? `${window.location.origin}${tenant.logoUrl}`
        : tenant.logoUrl
      : getTenantIconUrl(tenant);

  const bcbBadge = bcbRates
    ? `CDI Vigente (BCB): ${bcbRates.cdiAnnualPct.toFixed(2).replace('.', ',')}% a.a. • IPCA+6%: ${bcbRates.ipcaPlus6AnnualPct.toFixed(2).replace('.', ',')}% a.a. (Ref. ${escapeHtml(bcbRates.referenceDate)})`
    : 'Referência BCB SGS';

  const positionsRows = activePositions.length
    ? activePositions
        .map(
          (pos) => `
          <tr>
            <td><strong>${escapeHtml(pos.vehicle.name)}</strong><br/><small>${escapeHtml(pos.vehicle.legal_structure)} • ${escapeHtml(pos.vehicle.stage)}</small></td>
            <td style="text-align:right">${escapeHtml(formatQuotas(pos.quotas, 4))}</td>
            <td style="text-align:right">${pos.sharePct.toFixed(2)}%</td>
            <td style="text-align:right">${escapeHtml(formatCurrencyBRL(pos.vehicle.current_nav_per_quota))}</td>
            <td style="text-align:right"><strong>${escapeHtml(formatCurrencyBRL(pos.valBrl))}</strong></td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:14px;">Nenhuma cota integralizada no livro-razão até a data de emissão.</td></tr>`;

  const callsSection = openCalls.length
    ? `
      <h2>Chamadas de Capital em Aberto</h2>
      <table>
        <thead><tr><th>Chamada</th><th>Operação</th><th>Vencimento</th><th style="text-align:right">Total</th><th style="text-align:right">Sua Fração</th></tr></thead>
        <tbody>
          ${openCalls
            .map((c) => {
              const v = vehiclesById[c.vehicle_id];
              const q = quotasByVehicle[c.vehicle_id] || 0;
              const share = v ? computeOwnershipPct(q, v.total_quotas_issued) : 0;
              const due = computeProRataAmount(c.total_call_brl, share);
              return `<tr>
                <td><strong>${escapeHtml(c.title)}</strong></td>
                <td>${escapeHtml(v?.name || c.vehicle_id)}</td>
                <td>${escapeHtml(new Date(c.due_date).toLocaleDateString('pt-BR'))}</td>
                <td style="text-align:right">${escapeHtml(formatCurrencyBRL(c.total_call_brl))}</td>
                <td style="text-align:right"><strong>${escapeHtml(formatCurrencyBRL(due))}</strong> (${share.toFixed(2)}%)</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`
    : '';

  const ledgerRows = ledgerEvents.length
    ? ledgerEvents
        .slice(0, 60)
        .map(
          (ev) => `
          <tr>
            <td>${escapeHtml(ev.event_date)}</td>
            <td>${escapeHtml(vehiclesById[ev.vehicle_id]?.name || ev.vehicle_id)}</td>
            <td>${escapeHtml(ev.event_type)}</td>
            <td>${escapeHtml(ev.description)}</td>
            <td style="text-align:right">${ev.quotas_delta !== 0 ? escapeHtml(formatQuotas(ev.quotas_delta, 4)) : '—'}</td>
            <td style="text-align:right"><strong>${escapeHtml(formatCurrencyBRL(ev.amount_brl))}</strong></td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:14px;">Sem eventos registrados no livro-razão.</td></tr>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Dossiê do Cotista — ${escapeHtml(tenant.brandName)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; font-size: 11px; line-height: 1.45; }
    .topbar { height: 6px; background: ${escapeHtml(tenant.primaryColor)}; border-radius: 4px; margin-bottom: 14px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 14px; gap: 16px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { height: 44px; width: 44px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; padding: 2px; }
    h1 { font-size: 16px; margin: 0; font-weight: 800; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #334155; margin: 16px 0 8px; border-left: 3px solid ${escapeHtml(tenant.primaryColor)}; padding-left: 8px; }
    .meta { text-align: right; font-size: 10px; color: #475569; }
    .pill { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 999px; padding: 3px 9px; font-size: 10px; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #f8fafc; }
    .kpi span { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; }
    .kpi strong { font-size: 13px; color: #0f172a; display: block; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 6px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-size: 9px; text-transform: uppercase; color: #475569; font-weight: 800; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #cbd5e1; font-size: 9px; color: #64748b; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="topbar"></div>
  <div class="header">
    <div class="brand">
      <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(tenant.brandName)}" />
      <div>
        <h1>${escapeHtml(tenant.brandName)} — Dossiê & Extrato do Cotista</h1>
        <div style="color:#64748b;font-size:10px;">${escapeHtml(tenant.tagline)}</div>
        <span class="pill">${bcbBadge}</span>
      </div>
    </div>
    <div class="meta">
      <div><strong>Cotista:</strong> ${escapeHtml(investorName)}</div>
      <div>${escapeHtml(investorEmail)}</div>
      <div>Emissão: ${new Date().toLocaleString('pt-BR')}</div>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><span>Cotas Integralizadas</span><strong>${escapeHtml(formatQuotas(totalQuotas, 4))}</strong></div>
    <div class="kpi"><span>Patrimônio Atual (NAV)</span><strong>${escapeHtml(formatCurrencyBRL(totalNavBrl))}</strong></div>
    <div class="kpi"><span>Reservas em Aberto</span><strong>${escapeHtml(formatCurrencyBRL(reservedBrl))}</strong></div>
    <div class="kpi"><span>Operações Ativas</span><strong>${activePositions.length} veículo(s)</strong></div>
  </div>

  <h2>Posição Consolidada em Cotas</h2>
  <table>
    <thead><tr><th>Operação / Veículo</th><th style="text-align:right">Cotas</th><th style="text-align:right">Participação</th><th style="text-align:right">Cota NAV</th><th style="text-align:right">Valor Atual</th></tr></thead>
    <tbody>${positionsRows}</tbody>
  </table>

  ${callsSection}

  <h2>Extrato Cronológico Auditável (Livro-Razão)</h2>
  <table>
    <thead><tr><th>Data</th><th>Operação</th><th>Evento</th><th>Descrição</th><th style="text-align:right">Cotas</th><th style="text-align:right">Valor (R$)</th></tr></thead>
    <tbody>${ledgerRows}</tbody>
  </table>

  <div class="footer">
    <strong>Governança & Imposto de Renda:</strong> Documento emitido automaticamente para conferência privada de cotistas (SCP/SPE). Ganhos de capital auferidos na liquidação/venda estão sujeitos à alíquota vigente de IR (referência 15% PF) e devem ser confrontados com o Informe de Rendimentos anual. Taxa de performance incide somente na liquidação efetiva sobre o retorno excedente ao benchmark contratado.
  </div>
  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=980,height=760');
  if (!win) {
    window.alert('Libere pop-ups para gerar e imprimir o Dossiê PDF do Investidor.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
