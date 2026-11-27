import type { TenantConfig } from '../config/tenant';
import { getTenantIconUrl } from './brandingIcons';
import { formatCurrencyBRL } from './financial';
import type { AiInvestmentReport } from './aiInvestmentReportService';

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function verdictBadgeHtml(verdict: string): string {
  if (verdict === 'COMPRAR') {
    return '<span style="background:#dcfce7;color:#166534;border:1px solid #86efac;padding:2px 8px;border-radius:999px;font-weight:800;font-size:9px;">COMPRAR</span>';
  }
  if (verdict === 'EVITAR') {
    return '<span style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;padding:2px 8px;border-radius:999px;font-weight:800;font-size:9px;">EVITAR</span>';
  }
  return '<span style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:2px 8px;border-radius:999px;font-weight:800;font-size:9px;">ESTUDAR COM RESSALVAS</span>';
}

export function openAiInvestmentReportPdf(report: AiInvestmentReport, tenant: TenantConfig): void {
  const logoSrc =
    tenant.showLogo && tenant.logoUrl
      ? tenant.logoUrl.startsWith('/')
        ? `${window.location.origin}${tenant.logoUrl}`
        : tenant.logoUrl
      : getTenantIconUrl(tenant);

  const strategyLabel =
    report.parameters.strategy === 'RENTAL'
      ? 'Renda / Aluguel'
      : report.parameters.strategy === 'LIVING'
      ? 'Moradia / Patrimônio'
      : 'Flipping / Revenda';

  const summaryRows = report.properties
    .map((p) => {
      const base = p.financial.scenarios.base;
      return `
      <tr>
        <td><strong>#${p.rank}</strong></td>
        <td>
          <strong>${escapeHtml(p.title)}</strong><br/>
          <small style="color:#64748b">${escapeHtml(p.source)} · ${escapeHtml(p.city)}/${escapeHtml(p.state)}${
        p.neighborhood ? ` · ${escapeHtml(p.neighborhood)}` : ''
      }</small>
        </td>
        <td>${verdictBadgeHtml(p.verdict)}<br/><small>Score ${p.aiScore}/100</small></td>
        <td style="text-align:right">${escapeHtml(formatCurrencyBRL(p.financial.effectiveBid))}</td>
        <td style="text-align:right"><strong>${escapeHtml(formatCurrencyBRL(p.financial.maxSafeBid))}</strong></td>
        <td style="text-align:right">${escapeHtml(formatCurrencyBRL(p.estimatedMarketValue))}</td>
        <td style="text-align:right;color:${base.roiPct >= 0 ? '#059669' : '#dc2626'}"><strong>${base.roiPct}%</strong><br/><small>TIR ${base.irrAnnualPct}% a.a.</small></td>
        <td style="text-align:right;color:${base.spreadVsCdiPct >= 0 ? '#059669' : '#dc2626'}">${
        base.spreadVsCdiPct >= 0 ? '+' : ''
      }${base.spreadVsCdiPct} p.p.</td>
      </tr>`;
    })
    .join('');

  const regionsHtml = (report.regionAnalyses || [])
    .map(
      (reg) => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong>${escapeHtml(reg.city)} / ${escapeHtml(reg.uf)}</strong>
          <span class="pill">Liquidez: ${escapeHtml(reg.liquidityRating)} · Faixa m²: R$ ${Number(
        reg.pricePerM2RangeBrl?.min || 0
      ).toLocaleString('pt-BR')} – R$ ${Number(reg.pricePerM2RangeBrl?.max || 0).toLocaleString('pt-BR')}</span>
        </div>
        <p>${escapeHtml(reg.macroOverview)}</p>
        <p><strong>Bairros & Demanda:</strong> ${escapeHtml(reg.neighborhoodInsights)}</p>
        <p><strong>Tendência:</strong> ${escapeHtml(reg.marketTrends)}</p>
      </div>`
    )
    .join('');

  const propertyDetailsHtml = report.properties
    .map((p) => {
      const { conservative, base, optimistic } = p.financial.scenarios;
      return `
      <div class="card" style="page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
          <div>
            <div style="font-size:10px;color:#64748b;font-weight:700;">#${p.rank} · ${escapeHtml(p.source)} · ID ${escapeHtml(p.sourcePropertyId)}</div>
            <strong style="font-size:13px;">${escapeHtml(p.title)}</strong>
            <div style="font-size:10px;color:#475569;">${escapeHtml(p.address || '')} · ${escapeHtml(p.city)}/${escapeHtml(p.state)}</div>
          </div>
          <div style="text-align:right;">
            ${verdictBadgeHtml(p.verdict)}
            <div style="font-size:10px;font-weight:800;margin-top:3px;">Score IA: ${p.aiScore}/100</div>
          </div>
        </div>

        ${
          p.falseDiscountAlert?.flagged
            ? `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:7px 9px;border-radius:8px;margin-bottom:8px;font-size:10px;">
                <strong>⚠️ Alerta de Falso Deságio:</strong> ${escapeHtml(p.falseDiscountAlert.reason)}
              </div>`
            : ''
        }

        <p style="margin:4px 0 8px;"><strong>Comparativo de Mercado:</strong> ${escapeHtml(p.marketComparisonSummary)}</p>

        <table>
          <thead>
            <tr>
              <th>Cenário</th>
              <th style="text-align:right">Revenda Est.</th>
              <th style="text-align:right">Capital Total</th>
              <th style="text-align:right">Lucro Líquido</th>
              <th style="text-align:right">ROI Líquido</th>
              <th style="text-align:right">TIR Anual</th>
              <th style="text-align:right">Prazo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Conservador</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(conservative.expectedResalePrice))}</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(conservative.totalInvested))}</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(conservative.netProfit))}</td>
              <td style="text-align:right">${conservative.roiPct}%</td>
              <td style="text-align:right">${conservative.irrAnnualPct}%</td>
              <td style="text-align:right">${conservative.holdingMonths}m</td>
            </tr>
            <tr style="background:#f8fafc;font-weight:700;">
              <td>Base</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(base.expectedResalePrice))}</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(base.totalInvested))}</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(base.netProfit))}</td>
              <td style="text-align:right">${base.roiPct}%</td>
              <td style="text-align:right">${base.irrAnnualPct}%</td>
              <td style="text-align:right">${base.holdingMonths}m</td>
            </tr>
            <tr>
              <td>Otimista</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(optimistic.expectedResalePrice))}</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(optimistic.totalInvested))}</td>
              <td style="text-align:right">${escapeHtml(formatCurrencyBRL(optimistic.netProfit))}</td>
              <td style="text-align:right">${optimistic.roiPct}%</td>
              <td style="text-align:right">${optimistic.irrAnnualPct}%</td>
              <td style="text-align:right">${optimistic.holdingMonths}m</td>
            </tr>
          </tbody>
        </table>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;">
          <div>
            <strong>Pontos Fortes</strong>
            <ul style="margin:4px 0;padding-left:16px;">${p.pros.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
          </div>
          <div>
            <strong>Riscos / Atenção</strong>
            <ul style="margin:4px 0;padding-left:16px;">${p.cons.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
          </div>
        </div>
        <div style="margin-top:6px;">
          <strong>Estratégia de Lance:</strong> ${escapeHtml(p.biddingStrategy)}
        </div>
        <div style="margin-top:6px;">
          <strong>Checklist Pré-Lance:</strong> ${p.legalDiligenceChecklist.map((c) => escapeHtml(c)).join(' · ')}
        </div>
      </div>`;
    })
    .join('');

  const sourcesHtml =
    report.webSources && report.webSources.length > 0
      ? `<h2>Fontes Web Consultadas pela IA (Google Search Grounding)</h2>
         <ul style="padding-left:16px;">${report.webSources
           .map((s) => `<li>${escapeHtml(s.title)} — <span style="color:#2563eb">${escapeHtml(s.url)}</span></li>`)
           .join('')}</ul>`
      : '';

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório de Inteligência IA — ${escapeHtml(tenant.brandName)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; margin: 0; font-size: 10.5px; line-height: 1.45; }
    .topbar { height: 6px; background: ${escapeHtml(tenant.primaryColor)}; border-radius: 4px; margin-bottom: 12px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 12px; gap: 14px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .brand img { height: 42px; width: 42px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; padding: 2px; }
    h1 { font-size: 15px; margin: 0; font-weight: 900; }
    h2 { font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: #334155; margin: 14px 0 7px; border-left: 3px solid ${escapeHtml(tenant.primaryColor)}; padding-left: 8px; }
    .pill { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 999px; padding: 2px 8px; font-size: 9px; font-weight: 700; color: #0f172a; }
    .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px; margin-bottom: 12px; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; margin-bottom: 10px; background: #fff; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 5px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-size: 9px; text-transform: uppercase; color: #475569; font-weight: 800; }
    .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 9px; color: #64748b; }
  </style>
</head>
<body>
  <div class="topbar"></div>
  <div class="header">
    <div class="brand">
      <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(tenant.brandName)}" />
      <div>
        <h1>${escapeHtml(tenant.brandName)} — Relatório Comparativo de Inteligência IA</h1>
        <div style="color:#64748b;font-size:10px;">Estratégia: ${escapeHtml(strategyLabel)} · ROI Alvo: ${report.parameters.targetRoiPct}% · CDI BCB: ${report.bcbBenchmark.cdiAnnualPct}% a.a.</div>
        <span class="pill">${report.usedWebGrounding ? 'Pesquisa Web ao Vivo (Gemini + Google Search)' : `Motor ${escapeHtml(report.modelUsed)}`}</span>
      </div>
    </div>
    <div style="text-align:right;font-size:9.5px;color:#475569;">
      <div><strong>Imóveis Analisados:</strong> ${report.properties.length}</div>
      <div>Emissão: ${new Date(report.generatedAt).toLocaleString('pt-BR')}</div>
    </div>
  </div>

  <div class="summary-box">
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:${escapeHtml(tenant.primaryColor)};">Veredito do Comitê IA</div>
    <div style="font-size:13px;font-weight:900;margin:3px 0;">${escapeHtml(report.executiveSummary?.headline || '')}</div>
    <p style="margin:4px 0;"><strong>Melhor Escolha:</strong> ${escapeHtml(report.executiveSummary?.bestPickReason || '')}</p>
    <p style="margin:4px 0;">${escapeHtml(report.executiveSummary?.committeeOverview || '')}</p>
    <p style="margin:4px 0 0;"><strong>Recomendação:</strong> ${escapeHtml(report.executiveSummary?.portfolioRecommendation || '')}</p>
  </div>

  <h2>Quadro Comparativo Multi-Imóveis (Cenário Base)</h2>
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Imóvel / Origem</th>
        <th>Veredito</th>
        <th style="text-align:right">Lance Mín.</th>
        <th style="text-align:right">Lance Máx. Seguro</th>
        <th style="text-align:right">Mercado Est.</th>
        <th style="text-align:right">ROI / TIR</th>
        <th style="text-align:right">vs CDI</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
  </table>

  <h2>Análise de Cidade & Microrregião</h2>
  ${regionsHtml}

  <h2>Fichas Individuais, 3 Cenários & Diligência</h2>
  ${propertyDetailsHtml}

  ${sourcesHtml}

  <div class="footer">
    <strong>Aviso Técnico:</strong> Este relatório combina simulações financeiras determinísticas, indicadores oficiais (IBGE/BCB) e inteligência de mercado para apoio à decisão. Valide sempre a matrícula atualizada no CRI e o edital oficial antes de ofertar lances.
  </div>
  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1024,height=780');
  if (!win) {
    window.alert('Libere pop-ups no navegador para gerar e imprimir o Relatório PDF.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
