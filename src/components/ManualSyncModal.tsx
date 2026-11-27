import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Upload,
  ShieldCheck,
  Database,
} from 'lucide-react';
import {
  ALL_BRAZILIAN_UFS,
  clearCatalogCaches,
  batchUpsertPropertiesToSupabase,
  reconcileMissingPropertiesByState,
  recordCaixaImportLog,
  fetchLatestCaixaImportStatusByUf,
  type LatestCaixaImportStatus,
  type PropertyUpsertPayload,
} from '../lib/supabaseClient';
import { buildCaixaFeedUrl, parseCaixaCsv } from '../utils/caixaListImporter';
import { useTenant } from '../config/tenant';

type SyncBankKey = 'caixa' | 'bradesco' | 'mega' | 'zuk';
type UfScope = 'current' | 'main' | 'custom';

interface StepLog {
  id: string;
  bank: string;
  uf: string;
  state: 'pending' | 'running' | 'success' | 'captcha' | 'error';
  message: string;
  written?: number;
  removed?: number;
}

interface ManualSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUf?: string;
  onSyncCompleted?: () => void;
}

const MAIN_UFS = ['SP', 'RJ', 'MG', 'PR', 'RS', 'SC'];

const BANK_OPTIONS: { id: SyncBankKey; label: string; desc: string }[] = [
  { id: 'caixa', label: 'CAIXA Econômica', desc: 'Feed CSV oficial por UF' },
  { id: 'bradesco', label: 'Bradesco', desc: 'Vitrine oficial (API)' },
  { id: 'mega', label: 'Mega Leilões', desc: 'Itaú, Santander, Judiciais, Mega' },
  { id: 'zuk', label: 'Portal Zuk', desc: 'Santander, Itaú, BB, Bradesco, Zuk' },
];

export const ManualSyncModal: React.FC<ManualSyncModalProps> = ({
  isOpen,
  onClose,
  defaultUf = 'SP',
  onSyncCompleted,
}) => {
  const { tenant } = useTenant();
  const [ufScope, setUfScope] = useState<UfScope>('current');
  const [customUf, setCustomUf] = useState<string>(defaultUf || 'SP');
  const [selectedBanks, setSelectedBanks] = useState<SyncBankKey[]>(['caixa', 'bradesco', 'mega', 'zuk']);
  const [isRunning, setIsRunning] = useState(false);
  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const [summaryBanner, setSummaryBanner] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);
  const [captchaBlockedUfs, setCaptchaBlockedUfs] = useState<string[]>([]);
  const [uploadingCsvUf, setUploadingCsvUf] = useState<string | null>(null);
  const [latestCaixaStatus, setLatestCaixaStatus] = useState<LatestCaixaImportStatus | null>(null);

  const effectivePreviewUf = ufScope === 'custom' ? customUf : defaultUf || 'SP';

  useEffect(() => {
    if (!isOpen) return;
    setCustomUf(defaultUf || 'SP');
    fetchLatestCaixaImportStatusByUf(defaultUf || 'SP').then(setLatestCaixaStatus);
  }, [isOpen, defaultUf]);

  useEffect(() => {
    if (!isOpen) return;
    fetchLatestCaixaImportStatusByUf(effectivePreviewUf).then(setLatestCaixaStatus);
  }, [isOpen, effectivePreviewUf]);

  if (!isOpen) return null;

  const toggleBank = (id: SyncBankKey) => {
    if (isRunning) return;
    setSelectedBanks((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const resolveTargetUfs = (): string[] => {
    if (ufScope === 'main') return MAIN_UFS;
    if (ufScope === 'custom') return [customUf || 'SP'];
    return [defaultUf || 'SP'];
  };

  const handleRunSync = async () => {
    if (selectedBanks.length === 0 || isRunning) return;
    const targetUfs = resolveTargetUfs();

    const initialSteps: StepLog[] = [];
    for (const uf of targetUfs) {
      for (const bank of selectedBanks) {
        initialSteps.push({
          id: `${bank}-${uf}`,
          bank: bank.toUpperCase(),
          uf,
          state: 'pending',
          message: 'Aguardando...',
        });
      }
    }
    initialSteps.push({
      id: 'cleanup',
      bank: 'LIMPEZA',
      uf: targetUfs.length === 1 ? targetUfs[0] : 'ALL',
      state: 'pending',
      message: 'Aguardando conclusão das coletas...',
    });

    setStepLogs(initialSteps);
    setSummaryBanner(null);
    setCaptchaBlockedUfs([]);
    setIsRunning(true);

    let totalWritten = 0;
    let totalRemoved = 0;
    let hasAnySuccess = false;
    const blockedCaixaUfs: string[] = [];

    const updateStep = (id: string, patch: Partial<StepLog>) => {
      setStepLogs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    };

    try {
      for (const uf of targetUfs) {
        for (const bank of selectedBanks) {
          const stepId = `${bank}-${uf}`;
          updateStep(stepId, { state: 'running', message: `Consultando ${bank.toUpperCase()} (${uf})...` });
          try {
            const resp = await fetch(`/api/sync-banks?bank=${encodeURIComponent(bank)}&uf=${encodeURIComponent(uf)}`, {
              method: 'POST',
            });
            const data = await resp.json();

            if (data?.status === 'CAPTCHA_BLOCKED') {
              blockedCaixaUfs.push(uf);
              updateStep(stepId, {
                state: 'captcha',
                message: data.message || 'CAIXA exigiu CAPTCHA (Radware) no servidor.',
                written: 0,
                removed: 0,
              });
            } else if (resp.ok && (data?.ok || data?.written > 0 || data?.status === 'SUCCESS')) {
              hasAnySuccess = true;
              const written = Number(data?.written || 0);
              const removed = Number(data?.removed || 0);
              totalWritten += written;
              totalRemoved += removed;
              updateStep(stepId, {
                state: 'success',
                message: data?.message || `${written} sincronizados`,
                written,
                removed,
              });
            } else {
              updateStep(stepId, {
                state: 'error',
                message: data?.message || `Falha HTTP ${resp.status}`,
              });
            }
          } catch (err: any) {
            updateStep(stepId, {
              state: 'error',
              message: err?.message || 'Erro de rede na chamada /api/sync-banks',
            });
          }
        }
      }

      // Limpeza de expirados & deduplicação cruzada
      const cleanupUf = targetUfs.length === 1 ? targetUfs[0] : 'ALL';
      updateStep('cleanup', { state: 'running', message: 'Encerrando leilões vencidos e deduplicando...' });
      try {
        const cleanResp = await fetch(`/api/sync-banks?bank=cleanup&uf=${encodeURIComponent(cleanupUf)}`, {
          method: 'POST',
        });
        const cleanData = await cleanResp.json();
        const cleanRemoved = Number(cleanData?.removed || 0);
        totalRemoved += cleanRemoved;
        updateStep('cleanup', {
          state: cleanResp.ok ? 'success' : 'error',
          message: cleanData?.message || 'Limpeza executada.',
          removed: cleanRemoved,
        });
      } catch (err: any) {
        updateStep('cleanup', {
          state: 'error',
          message: err?.message || 'Erro na limpeza final.',
        });
      }

      setCaptchaBlockedUfs(blockedCaixaUfs);
      clearCatalogCaches();
      onSyncCompleted?.();

      setSummaryBanner({
        type: blockedCaixaUfs.length > 0 && !hasAnySuccess ? 'warning' : 'success',
        text: `Sincronização concluída: ${totalWritten.toLocaleString('pt-BR')} imóveis atualizados e ${totalRemoved.toLocaleString('pt-BR')} encerrados/deduplicados.${
          blockedCaixaUfs.length > 0
            ? ` Atenção: CAIXA bloqueada por CAPTCHA em ${blockedCaixaUfs.join(', ')} (use o upload manual abaixo se desejar atualizar agora).`
            : ''
        }`,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleManualCaixaCsvUpload = (uf: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCsvUf(uf);
    const t0 = Date.now();
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = String(evt.target?.result || '');
        const parseResult = parseCaixaCsv(content, uf, file.name);
        if (!parseResult.rows || parseResult.rows.length === 0) {
          throw new Error('Nenhum registro válido encontrado no CSV.');
        }
        const payload: PropertyUpsertPayload[] = parseResult.rows.map((row) => ({
          source: 'CAIXA',
          source_property_id: row.source_property_id,
          title: `${row.property_type || 'Imóvel'} - ${row.city}`,
          property_type: row.property_type,
          sale_modality: row.sale_modality,
          state: row.state,
          city: row.city,
          neighborhood: row.neighborhood,
          address: row.address,
          sale_value: row.sale_value,
          current_minimum_value: row.current_minimum_value,
          appraisal_value: row.appraisal_value,
          discount_percentage: row.discount_percentage,
          calculated_discount_percentage: row.calculated_discount_percentage,
          accepts_financing: row.accepts_financing,
          occupancy_status: row.occupancy_status,
          description: row.description,
          total_area: row.total_area,
          private_area: row.private_area,
          land_area: row.land_area,
          bedrooms: row.bedrooms,
          parking_spaces: row.parking_spaces,
          source_url: row.source_url,
          source_generated_at: parseResult.metadata.source_generated_at,
          source_fetched_at: parseResult.metadata.source_fetched_at,
          source_file_url: parseResult.metadata.source_file_url,
          source_file_hash: parseResult.metadata.source_file_hash,
          source_hash: row.source_hash,
          enrichment_status: 'PENDING',
          status: 'ACTIVE',
          raw_list_data: row.raw_list_data,
        }));

        const upsertRes = await batchUpsertPropertiesToSupabase(payload, 250);
        const reconcileRes = await reconcileMissingPropertiesByState(
          uf,
          new Set(parseResult.rows.map((r) => r.source_property_id))
        );
        await recordCaixaImportLog({
          uf,
          source_generated_at: parseResult.metadata.source_generated_at,
          source_file_hash: parseResult.metadata.source_file_hash,
          filename: file.name,
          total_rows: parseResult.metadata.total_records_found,
          valid_rows: parseResult.metadata.valid_records_count,
          invalid_rows: parseResult.metadata.invalid_records_count,
          inserted: upsertRes.inserted,
          updated: upsertRes.updated,
          unchanged: Math.max(0, upsertRes.totalProcessed - upsertRes.inserted - upsertRes.updated),
          possibly_removed: reconcileRes.countPossiblyRemoved,
          errors: upsertRes.errors,
          execution_time_seconds: Number(((Date.now() - t0) / 1000).toFixed(1)),
        });

        setStepLogs((prev) =>
          prev.map((s) =>
            s.id === `caixa-${uf}`
              ? {
                  ...s,
                  state: 'success',
                  written: upsertRes.totalProcessed,
                  removed: reconcileRes.countPossiblyRemoved,
                  message: `CSV oficial importado manualmente (${upsertRes.totalProcessed} ativos, ${reconcileRes.countPossiblyRemoved} removidos).`,
                }
              : s
          )
        );
        clearCatalogCaches();
        onSyncCompleted?.();
        setSummaryBanner({
          type: 'success',
          text: `CAIXA ${uf} atualizada via CSV oficial (${upsertRes.totalProcessed.toLocaleString('pt-BR')} imóveis, ${reconcileRes.countPossiblyRemoved} removidos).`,
        });
      } catch (err: any) {
        setSummaryBanner({
          type: 'warning',
          text: `Erro ao importar CSV da CAIXA (${uf}): ${err?.message || 'arquivo inválido'}`,
        });
      } finally {
        setUploadingCsvUf(null);
      }
    };
    reader.readAsText(file, 'iso-8859-1');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <RefreshCw className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Sincronização Sob Demanda dos Bancos
              </h2>
              <p className="text-xs text-slate-300">
                Atualize os dados reais diretamente das fontes oficiais a qualquer momento.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          {/* Escopo de UF */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
              1. Escopo Geográfico (UF)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setUfScope('current')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  ufScope === 'current'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-black block">UF Atual ({defaultUf || 'SP'})</span>
                <span className={`text-[10px] ${ufScope === 'current' ? 'text-slate-300' : 'text-slate-500'}`}>
                  Rápido (~5–15s)
                </span>
              </button>

              <button
                type="button"
                disabled={isRunning}
                onClick={() => setUfScope('main')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  ufScope === 'main'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-black block">Principais (6 UFs)</span>
                <span className={`text-[10px] ${ufScope === 'main' ? 'text-slate-300' : 'text-slate-500'}`}>
                  SP, RJ, MG, PR, RS, SC
                </span>
              </button>

              <div
                onClick={() => !isRunning && setUfScope('custom')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  ufScope === 'custom'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="font-black block mb-1">Outra UF</span>
                <select
                  value={customUf}
                  disabled={isRunning}
                  onChange={(e) => {
                    setUfScope('custom');
                    setCustomUf(e.target.value);
                  }}
                  className="w-full rounded-lg px-2 py-1 text-xs font-bold bg-white text-slate-900 border border-slate-300"
                >
                  {ALL_BRAZILIAN_UFS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {latestCaixaStatus && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    Último registro CAIXA ({latestCaixaStatus.uf}):{' '}
                    <strong className="text-slate-900">{latestCaixaStatus.status}</strong>
                    {latestCaixaStatus.source_generated_at
                      ? ` · Base ${latestCaixaStatus.source_generated_at.split('-').reverse().join('/')}`
                      : ''}
                  </span>
                </span>
                <span>
                  {new Date(latestCaixaStatus.created_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Fontes */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
              2. Fontes e Leiloeiros para Sincronizar
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BANK_OPTIONS.map((bank) => {
                const checked = selectedBanks.includes(bank.id);
                return (
                  <label
                    key={bank.id}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                      checked
                        ? 'bg-emerald-50/70 border-emerald-300 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isRunning}
                      onChange={() => toggleBank(bank.id)}
                      className="mt-0.5 rounded accent-emerald-600"
                    />
                    <div>
                      <span className="font-black block">{bank.label}</span>
                      <span className="text-[10px] text-slate-500">{bank.desc}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Progresso */}
          {stepLogs.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                Progresso da Execução
              </span>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl divide-y divide-slate-200 max-h-60 overflow-y-auto">
                {stepLogs.map((step) => (
                  <div key={step.id} className="px-3.5 py-2.5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      {step.state === 'running' && (
                        <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0 mt-0.5" />
                      )}
                      {step.state === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      )}
                      {step.state === 'captcha' && (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      {step.state === 'error' && (
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      )}
                      {step.state === 'pending' && (
                        <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0 mt-1.5 ml-1 mr-1" />
                      )}
                      <div className="min-w-0">
                        <span className="font-black text-slate-900">
                          {step.bank} ({step.uf})
                        </span>
                        <p className="text-[11px] text-slate-600 leading-snug">{step.message}</p>
                      </div>
                    </div>
                    {typeof step.written === 'number' && step.state === 'success' && (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                        +{step.written}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fallback legítimo para CAIXA quando CAPTCHA bloquear */}
          {captchaBlockedUfs.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-amber-950 block">
                    Download manual oficial da CAIXA ({captchaBlockedUfs.join(', ')})
                  </span>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    O WAF da CAIXA exigiu verificação humana (Radware CAPTCHA) para requisições do servidor nestas UFs. Baixe o CSV oficial no seu navegador e envie abaixo:
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {captchaBlockedUfs.map((blockedUf) => (
                  <div key={blockedUf} className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-xl p-1.5">
                    <a
                      href={buildCaixaFeedUrl(blockedUf)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Baixar {blockedUf}</span>
                    </a>
                    <label className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-black text-[11px] flex items-center gap-1 cursor-pointer">
                      {uploadingCsvUf === blockedUf ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      <span>Importar CSV {blockedUf}</span>
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        disabled={uploadingCsvUf !== null}
                        onChange={(e) => handleManualCaixaCsvUpload(blockedUf, e)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summaryBanner && (
            <div
              className={`p-3.5 rounded-2xl border font-bold flex items-start gap-2 ${
                summaryBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {summaryBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <span>{summaryBanner.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs disabled:opacity-50"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={handleRunSync}
            disabled={isRunning || selectedBanks.length === 0}
            className="px-5 py-2.5 rounded-xl text-white font-black text-xs shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
            }}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Sincronizar Agora</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
