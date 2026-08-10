import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Upload,
  Check,
  Terminal,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import {
  buildCaixaFeedUrl,
  parseCaixaCsv,
} from '../utils/caixaListImporter';

import {
  batchUpsertPropertiesToSupabase,
  reconcileMissingPropertiesByState,
  recordCaixaImportLog,
  fetchCatalogSummaryStatsFromSupabase,
  isSupabaseConfigured,
  type PropertyUpsertPayload,
} from '../lib/supabaseClient';

const ALL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface CaixaFeedAdminTestPageProps {
  onGoToCatalog?: () => void;
}

export const CaixaFeedAdminTestPage: React.FC<CaixaFeedAdminTestPageProps> = ({ onGoToCatalog }) => {
  // Parâmetros de Seleção do Administrador (Seção 3)
  const [selectedUf, setSelectedUf] = useState('SP');

  // Estados de Processamento Automático
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [techLogs, setTechLogs] = useState<string[]>([]);
  const [showAuditArea, setShowAuditArea] = useState(false);

  // Metadados e Relatório Final da Importação (Seção 16)
  const [importSummary, setImportSummary] = useState<{
    uf: string;
    fileName: string;
    sourceGeneratedAt: string | null;
    totalRecordsFound: number;
    processed: number;
    inserted: number;
    updated: number;
    unchanged: number;
    invalid: number;
    possiblyRemoved: number;
    executionTimeSeconds: number;
  } | null>(null);

  // Estatísticas do Banco de Dados (Seção 3 & 45)
  const [stats, setStats] = useState<{
    totalActiveCount: number;
    lastImportDate: string | null;
    lastImportGeneratedAt: string | null;
  }>({
    totalActiveCount: 0,
    lastImportDate: null,
    lastImportGeneratedAt: null,
  });

  const addLog = (msg: string) => {
    setTechLogs((prev) => [...prev, `[${prev.length + 1}] ${msg}`]);
  };

  const loadStats = async () => {
    const s = await fetchCatalogSummaryStatsFromSupabase();
    setStats(s);
  };

  useEffect(() => {
    loadStats();
  }, []);

  /**
   * BOTÃO 1: [ 1. BAIXAR CSV OFICIAL ] (Seção 3)
   * Abre no navegador do administrador a URL https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_{UF}.csv
   */
  const handleDownloadCsvInBrowser = () => {
    const url = buildCaixaFeedUrl(selectedUf);
    addLog(`Abrindo URL oficial do CSV no navegador do administrador: ${url}`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * BOTÃO 2: [ 2. IMPORTAR E ATUALIZAR BASE ] (Seção 3, 13, 14, 15, 16)
   * Fluxo Automático Completo: parse -> validate -> normalize -> extractDerivedFields -> batch upsert -> reconciliation -> resultado
   */
  const handleAutoImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setTechLogs([]);
    setImportSummary(null);

    const startTime = Date.now();

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) {
        setIsProcessing(false);
        return;
      }

      try {
        addLog(`[1] Arquivo selecionado: ${file.name} (${file.size.toLocaleString()} bytes)`);

        // 1. Parsing central único com extração determinística de áreas e tipo (Seção 8, 9, 10)
        const parseResult = parseCaixaCsv(content, selectedUf, file.name);

        addLog(`[2] Decodificação e delimitador validados: ${parseResult.metadata.encoding}`);
        addLog(`[3] Cabeçalho oficial detectado | Data de geração da base: ${parseResult.metadata.source_generated_at || 'não informada'}`);
        addLog(`[4] Total de registros encontrados: ${parseResult.metadata.total_records_found.toLocaleString()}`);
        addLog(`[5] Registros válidos extraídos: ${parseResult.rows.length.toLocaleString()}`);

        if (parseResult.rows.length === 0) {
          throw new Error('Nenhum imóvel válido foi encontrado no CSV selecionado.');
        }

        // 2. Montagem do payload de propriedades para batch UPSERT
        const propertiesPayload: PropertyUpsertPayload[] = parseResult.rows.map((row) => ({
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

        // 3. Batch UPSERT automático em lotes de 250 (Seções 13 & 14)
        addLog(`[6] Executando UPSERT em lotes de 250 no Supabase...`);
        const upsertRes = await batchUpsertPropertiesToSupabase(propertiesPayload, 250);

        if (!upsertRes.success && upsertRes.errors > 0) {
          addLog(`[AVISO UPSERT] ${upsertRes.errors} falhas no envio: ${upsertRes.errorMessages.join('; ')}`);
        } else {
          addLog(`[7] [UPSERT SUCESSO] ${upsertRes.totalProcessed.toLocaleString()} imóveis processados com sucesso`);
        }

        // 4. Reconciliação dos imóveis da UF (Seção 15 & 46)
        addLog(`[8] Executando reconciliação de imóveis ativos para o estado ${selectedUf}...`);
        const currentPropertyIds = new Set(parseResult.rows.map((r) => r.source_property_id));
        const reconcileRes = await reconcileMissingPropertiesByState(selectedUf, currentPropertyIds);

        if (reconcileRes.countPossiblyRemoved > 0) {
          addLog(`[9] [RECONCILIAÇÃO] ${reconcileRes.countPossiblyRemoved} imóveis anteriores de ${selectedUf} marcados como POSSIBLY_REMOVED`);
        } else {
          addLog(`[9] [RECONCILIAÇÃO] Nenhum imóvel do estado foi removido da base oficial`);
        }

        const executionTimeSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));

        // 5. Gravação de log histórico na tabela caixa_imports (Seção 34)
        await recordCaixaImportLog({
          uf: selectedUf,
          source_generated_at: parseResult.metadata.source_generated_at,
          source_file_hash: parseResult.metadata.source_file_hash,
          filename: file.name,
          total_rows: parseResult.metadata.total_records_found,
          valid_rows: parseResult.metadata.valid_records_count,
          invalid_rows: parseResult.metadata.invalid_records_count,
          inserted: upsertRes.inserted,
          updated: upsertRes.updated,
          unchanged: upsertRes.totalProcessed - upsertRes.inserted - upsertRes.updated,
          possibly_removed: reconcileRes.countPossiblyRemoved,
          errors: upsertRes.errors,
          execution_time_seconds: executionTimeSeconds,
        });

        // 6. Montagem do relatório final da importação (Seção 16)
        setImportSummary({
          uf: selectedUf,
          fileName: file.name,
          sourceGeneratedAt: parseResult.metadata.source_generated_at,
          totalRecordsFound: parseResult.metadata.total_records_found,
          processed: upsertRes.totalProcessed,
          inserted: upsertRes.inserted,
          updated: upsertRes.updated,
          unchanged: Math.max(0, upsertRes.totalProcessed - upsertRes.inserted - upsertRes.updated),
          invalid: parseResult.metadata.invalid_records_count + parseResult.metadata.rejected_mismatch_count,
          possiblyRemoved: reconcileRes.countPossiblyRemoved,
          executionTimeSeconds,
        });

        await loadStats();
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao processar arquivo da CAIXA');
        addLog(`[ERRO IMPORTAÇÃO] ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsText(file, 'iso-8859-1');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 font-sans">
      
      {/* CABEÇALHO PRINCIPAL DA TELA DE ATUALIZAÇÃO (Seção 3 & 45) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="bg-orange-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider">
              BASE DE IMÓVEIS CAIXA
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Fonte Oficial CAIXA
            </span>
          </div>

          <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
            <span>Supabase status:</span>
            {isSupabaseConfigured ? (
              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Postgres Conectado
              </span>
            ) : (
              <span className="text-amber-400 font-extrabold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Store Local Ativo
              </span>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Sincronização & Atualização do Catálogo Nacional
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-3xl mt-1">
            Importação direta da fonte pública oficial da CAIXA por estado. Atualiza a tabela <code>properties</code> do Supabase para buscas e filtros instantâneos.
          </p>
        </div>
      </div>

      {/* METRICAS GERAIS DA BASE (Seção 3 & 45) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 font-bold text-[10px] uppercase block">Última base importada:</span>
          <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-orange-500" />
            {stats.lastImportDate ? new Date(stats.lastImportDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nenhuma ainda'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 font-bold text-[10px] uppercase block">Data de Geração do Arquivo:</span>
          <span className="text-sm font-black text-orange-600">
            {stats.lastImportGeneratedAt ? new Date(stats.lastImportGeneratedAt).toLocaleDateString('pt-BR') : 'não informada'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 font-bold text-[10px] uppercase block">Imóveis Ativos no Banco:</span>
          <span className="text-lg font-black text-emerald-600">
            {stats.totalActiveCount.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 font-bold text-[10px] uppercase block">Status da Base:</span>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full inline-block">
            {stats.totalActiveCount > 0 ? 'Atualizado' : 'Atualização necessária'}
          </span>
        </div>
      </div>

      {/* PAINEL SIMPLIFICADO DE ATUALIZAÇÃO (Seção 3) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          
          {/* Seleção do Estado */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Estado para atualização:
            </label>
            <select
              value={selectedUf}
              onChange={(e) => setSelectedUf(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              {ALL_UFS.map((ufCode) => (
                <option key={ufCode} value={ufCode}>
                  {ufCode} — {ufCode === 'SP' ? 'São Paulo' : ufCode === 'RJ' ? 'Rio de Janeiro' : ufCode === 'MG' ? 'Minas Gerais' : ufCode === 'DF' ? 'Distrito Federal' : ufCode}
                </option>
              ))}
            </select>
          </div>

          {/* BOTÃO 1: BAIXAR CSV OFICIAL DA CAIXA */}
          <div className="md:col-span-4 pt-4 md:pt-0">
            <button
              onClick={handleDownloadCsvInBrowser}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition-all transform active:scale-95"
            >
              <ExternalLink className="w-4 h-4 text-orange-400" />
              <span>[ 1. BAIXAR CSV OFICIAL ]</span>
            </button>
          </div>

          {/* BOTÃO 2: IMPORTAR E ATUALIZAR BASE */}
          <div className="md:col-span-4 pt-4 md:pt-0">
            <label className={`w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all transform active:scale-95 ${isProcessing ? 'opacity-70 cursor-wait' : ''}`}>
              <Upload className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'ATUALIZANDO BASE...' : '[ 2. IMPORTAR E ATUALIZAR BASE ]'}</span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleAutoImportCsv}
                disabled={isProcessing}
                className="hidden"
              />
            </label>
          </div>

        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

      </div>

      {/* RELATÓRIO FINAL DA IMPORTAÇÃO DA BASE (Seção 16) */}
      {importSummary && (
        <div className="bg-emerald-950/40 text-white p-6 rounded-3xl border border-emerald-500/40 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">BASE CAIXA ATUALIZADA COM SUCESSO</h2>
                <p className="text-xs text-emerald-300 font-mono">
                  Estado: {importSummary.uf} • Arquivo: {importSummary.fileName} • Tempo: {importSummary.executionTimeSeconds}s
                </p>
              </div>
            </div>

            {onGoToCatalog && (
              <button
                onClick={onGoToCatalog}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-6 py-3 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center space-x-2"
              >
                <Layers className="w-4 h-4" />
                <span>[ VER IMÓVEIS ]</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-xs font-mono">
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">ENCONTRADOS:</span>
              <span className="text-lg font-black text-white">{importSummary.totalRecordsFound.toLocaleString()}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">PROCESSADOS:</span>
              <span className="text-lg font-black text-emerald-400">{importSummary.processed.toLocaleString()}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">INSERIDOS:</span>
              <span className="text-lg font-black text-emerald-300">{importSummary.inserted.toLocaleString()}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">ATUALIZADOS:</span>
              <span className="text-lg font-black text-orange-400">{importSummary.updated.toLocaleString()}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">SEM MUDANÇA:</span>
              <span className="text-lg font-black text-slate-300">{importSummary.unchanged.toLocaleString()}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">INVÁLIDOS:</span>
              <span className="text-lg font-black text-red-400">{importSummary.invalid}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">REMOVIDOS (UF):</span>
              <span className="text-lg font-black text-amber-400">{importSummary.possiblyRemoved}</span>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA COLLAPSÁVEL DE AUDITORIA E DEBUG TÉCNICO (Seção 44) */}
      <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <button
          onClick={() => setShowAuditArea(!showAuditArea)}
          className="w-full p-5 bg-slate-900 hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs font-black text-slate-200"
        >
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-orange-400" />
            <span>AUDITORIA TÉCNICA E LOGS DA BASE (SEÇÃO 44)</span>
          </div>
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-[10px]">
            <span>{showAuditArea ? 'Ocultar Auditoria' : 'Exibir Auditoria'}</span>
            {showAuditArea ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAuditArea && (
          <div className="p-6 bg-slate-950 border-t border-slate-800 space-y-4 font-mono text-[11px]">
            <div className="flex items-center justify-between text-xs text-orange-400 font-bold border-b border-slate-800 pb-2">
              <span>LOGS DETALHADOS DE EXECUÇÃO ({techLogs.length} etapas)</span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 text-slate-300 leading-relaxed">
              {techLogs.length === 0 ? (
                <span className="text-slate-500">Nenhum log de auditoria registrado no momento.</span>
              ) : (
                techLogs.map((l, idx) => (
                  <div key={idx} className={l.includes('[ERRO') ? 'text-red-400' : l.includes('[UPSERT') ? 'text-emerald-400' : ''}>
                    {l}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
