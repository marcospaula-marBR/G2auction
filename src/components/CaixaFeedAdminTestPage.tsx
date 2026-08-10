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
  Building2,
  Save,
} from 'lucide-react';

import {
  buildCaixaFeedUrl,
  parseCaixaCsv,
  type CaixaFeedRowParsed,
} from '../utils/caixaListImporter';

import {
  batchUpsertPropertiesToSupabase,
  upsertPropertyToSupabase,
  reconcileMissingPropertiesByState,
  recordCaixaImportLog,
  fetchCatalogSummaryStatsFromSupabase,
  isSupabaseConfigured,
  ALL_BRAZILIAN_UFS,
  type PropertyUpsertPayload,
} from '../lib/supabaseClient';

import { formatCurrencyBRL } from '../utils/financial';

interface CaixaFeedAdminTestPageProps {
  onGoToCatalog?: () => void;
}

export const CaixaFeedAdminTestPage: React.FC<CaixaFeedAdminTestPageProps> = ({ onGoToCatalog }) => {
  // Parâmetros de Seleção do Administrador
  const [selectedUf, setSelectedUf] = useState('SP');

  // Estados de Processamento e Pre visualização
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [techLogs, setTechLogs] = useState<string[]>([]);
  const [showAuditArea, setShowAuditArea] = useState(false);

  // Amostra / Preview do CSV Carregado (Seção 1, 2, 3)
  const [parsedPreviewRows, setParsedPreviewRows] = useState<CaixaFeedRowParsed[]>([]);
  const [previewMetadata, setPreviewMetadata] = useState<any | null>(null);

  // Metadados e Relatório Final da Importação
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

  // Estatísticas do Banco de Dados
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
   * BOTÃO 1: [ 1. BAIXAR CSV OFICIAL ]
   */
  const handleDownloadCsvInBrowser = () => {
    const url = buildCaixaFeedUrl(selectedUf);
    addLog(`Abrindo URL oficial do CSV no navegador do administrador: ${url}`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * BOTÃO EXPLÍCITO: [ SALVAR IMÓVEL INDIVIDUAL NO SUPABASE ]
   */
  const handleSaveSinglePropertyToDb = async (row: CaixaFeedRowParsed) => {
    setIsProcessing(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const payload: PropertyUpsertPayload = {
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
        source_hash: row.source_hash,
        enrichment_status: 'PENDING',
        status: 'ACTIVE',
        raw_list_data: row.raw_list_data,
      };

      const res = await upsertPropertyToSupabase(payload);
      if (res.success) {
        setSaveSuccessMsg(`Imóvel CAIXA ID ${row.source_property_id} salvo com sucesso no Banco de Dados!`);
        addLog(`[SALVAR MANUAL] Imóvel ${row.source_property_id} salvo no DB.`);
        await loadStats();
      } else {
        throw new Error(res.error || 'Falha ao salvar no Supabase');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar no Supabase');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * SELEÇÃO DE ARQUIVO E PIPELINE DE ATUALIZAÇÃO AUTOMÁTICA DA BASE
   */
  const handleAutoImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setSaveSuccessMsg(null);
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

        const parseResult = parseCaixaCsv(content, selectedUf, file.name);

        setParsedPreviewRows(parseResult.rows.slice(0, 5));
        setPreviewMetadata(parseResult.metadata);

        addLog(`[2] Decodificação e delimitador validados: ${parseResult.metadata.encoding}`);
        addLog(`[3] Data de geração da base: ${parseResult.metadata.source_generated_at || 'não informada'}`);
        addLog(`[4] Total de registros encontrados: ${parseResult.metadata.total_records_found.toLocaleString()}`);
        addLog(`[5] Registros válidos extraídos: ${parseResult.rows.length.toLocaleString()}`);

        if (parseResult.rows.length === 0) {
          throw new Error('Nenhum imóvel válido foi encontrado no CSV selecionado.');
        }

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

        addLog(`[6] Executando UPSERT e salvando ${propertiesPayload.length.toLocaleString()} imóveis no Banco de Dados...`);
        const upsertRes = await batchUpsertPropertiesToSupabase(propertiesPayload, 250);

        if (!upsertRes.success && upsertRes.errors > 0) {
          addLog(`[AVISO UPSERT] ${upsertRes.errors} falhas no envio: ${upsertRes.errorMessages.join('; ')}`);
        } else {
          addLog(`[7] [UPSERT SUCESSO] ${upsertRes.totalProcessed.toLocaleString()} imóveis salvos no Banco de Dados!`);
        }

        addLog(`[8] Executando reconciliação de imóveis ativos para o estado ${selectedUf}...`);
        const currentPropertyIds = new Set(parseResult.rows.map((r) => r.source_property_id));
        const reconcileRes = await reconcileMissingPropertiesByState(selectedUf, currentPropertyIds);

        const executionTimeSeconds = Number(((Date.now() - startTime) / 1000).toFixed(1));

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
          unchanged: Math.max(0, upsertRes.totalProcessed - upsertRes.inserted - upsertRes.updated),
          possibly_removed: reconcileRes.countPossiblyRemoved,
          errors: upsertRes.errors,
          execution_time_seconds: executionTimeSeconds,
        });

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

        setSaveSuccessMsg(`Base do estado ${selectedUf} atualizada com sucesso! Total de ${upsertRes.totalProcessed.toLocaleString()} imóveis prontos para busca e filtro.`);

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
      
      {/* CABEÇALHO PRINCIPAL DA TELA DE ATUALIZAÇÃO */}
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
            Sincronização & Salvar no Banco de Dados
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-3xl mt-1">
            Importação e armazenamento direto na tabela <code>properties</code> do Supabase Postgres por estado. Os filtros do catálogo serão atualizados instantaneamente.
          </p>
        </div>
      </div>

      {/* MÉTRICAS GERAIS DA BASE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 font-bold text-[10px] uppercase block">Última base importada:</span>
          <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-orange-500" />
            {stats.lastImportDate ? new Date(stats.lastImportDate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nenhuma ainda'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 font-bold text-[10px] uppercase block">Data de Geração da Base:</span>
          <span className="text-sm font-black text-orange-600">
            {stats.lastImportGeneratedAt ? new Date(stats.lastImportGeneratedAt).toLocaleDateString('pt-BR') : 'não informada'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 font-bold text-[10px] uppercase block">Imóveis Ativos no DB:</span>
          <span className="text-lg font-black text-emerald-600">
            {stats.totalActiveCount.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-slate-400 font-bold text-[10px] uppercase block">Status no DB:</span>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full inline-block">
            {stats.totalActiveCount > 0 ? 'Base Atualizada' : 'Atualização Necessária'}
          </span>
        </div>
      </div>

      {/* PAINEL DE CONTROLE DE IMPORTAÇÃO E SALVAMENTO */}
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
              {ALL_BRAZILIAN_UFS.map((ufCode) => (
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

          {/* BOTÃO 2: IMPORTAR E SALVAR NO BANCO DE DADOS */}
          <div className="md:col-span-4 pt-4 md:pt-0">
            <label className={`w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all transform active:scale-95 ${isProcessing ? 'opacity-70 cursor-wait' : ''}`}>
              <Upload className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'SALVANDO NO BANCO...' : '[ 2. IMPORTAR E SALVAR NO DB ]'}</span>
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

        {/* FEEDBACKS VISUAIS DE SUCESSO OU ERRO */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>

            {onGoToCatalog && (
              <button
                onClick={onGoToCatalog}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
              >
                [ IR PARA O CATÁLOGO E FILTRAR ]
              </button>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

      </div>

      {/* PREVIEW DO 1º IMÓVEL PARSEADO COM BOTÃO DE SALVAR MANUALMENTE */}
      {parsedPreviewRows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-black text-slate-900">
                PRÉ-VISUALIZAÇÃO DO 1º IMÓVEL EXTRAÍDO DO CSV ({previewMetadata?.total_records_found?.toLocaleString()} encontrados)
              </h3>
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              Validado sem Simulação
            </span>
          </div>

          {parsedPreviewRows.slice(0, 1).map((row) => (
            <div key={row.source_property_id} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-orange-600 font-mono">
                    ID CAIXA TEXT: {row.source_property_id}
                  </span>
                  <h4 className="text-base font-black text-slate-900">
                    {row.property_type || 'Imóvel'} — {row.city} / {row.state}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">{row.address || 'Endereço informado'}</p>
                </div>

                {/* BOTÃO EXPLÍCITO DE SALVAR NO DB */}
                <button
                  onClick={() => handleSaveSinglePropertyToDb(row)}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-2xl shadow-md flex items-center space-x-2 transition-transform active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>[ SALVAR ESTE IMÓVEL NO SUPABASE ]</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">PREÇO MÍNIMO:</span>
                  <span className="text-emerald-600 font-black">{row.current_minimum_value ? formatCurrencyBRL(row.current_minimum_value) : 'N/I'}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">AVALIAÇÃO:</span>
                  <span className="text-slate-800 font-bold">{row.appraisal_value ? formatCurrencyBRL(row.appraisal_value) : 'N/I'}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">DESCONTO:</span>
                  <span className="text-orange-600 font-black">{row.discount_percentage !== null ? `${row.discount_percentage}%` : 'N/I'}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[9px] uppercase font-bold">ÁREA PRIVATIVA:</span>
                  <span className="text-slate-800 font-bold">{row.private_area !== null ? `${row.private_area} m²` : 'N/I'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RELATÓRIO FINAL DA IMPORTAÇÃO */}
      {importSummary && (
        <div className="bg-emerald-950/40 text-white p-6 rounded-3xl border border-emerald-500/40 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">BASE DE IMÓVEIS SALVA NO BANCO DE DADOS</h2>
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
                <span>[ VER IMÓVEIS NO CATÁLOGO ]</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 text-xs font-mono">
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">ENCONTRADOS:</span>
              <span className="text-lg font-black text-white">{importSummary.totalRecordsFound.toLocaleString()}</span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-emerald-500/20">
              <span className="text-slate-400 text-[10px] font-bold block">SALVOS NO DB:</span>
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

      {/* ÁREA COLLAPSÁVEL DE AUDITORIA E DEBUG TÉCNICO */}
      <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <button
          onClick={() => setShowAuditArea(!showAuditArea)}
          className="w-full p-5 bg-slate-900 hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs font-black text-slate-200"
        >
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-orange-400" />
            <span>AUDITORIA TÉCNICA E LOGS DA BASE DE DADOS</span>
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
