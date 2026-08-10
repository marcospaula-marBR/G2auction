import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Code2,
  Upload,
  Check,
  Terminal,
  Activity,
  FileCheck,
  Lock,
} from 'lucide-react';

import {
  buildCaixaFeedUrl,
  parseCaixaCsv,
  type CaixaFeedMetadata,
  type CaixaFeedRowParsed,
} from '../utils/caixaListImporter';

import { formatCurrencyBRL } from '../utils/financial';
import {
  upsertPropertyToSupabase,
  verifySavedPropertyInSupabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient';

const ALL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const CaixaFeedAdminTestPage: React.FC = () => {
  // Configurações de Filtro e Teste (Seção 4, 24)
  const [selectedUf, setSelectedUf] = useState('SP');
  const [testLimit, setTestLimit] = useState<number>(1);
  const [save, setSave] = useState(false);

  // Estados de Execução, Logs e Diagnóstico
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [techLogs, setTechLogs] = useState<string[]>([]);

  // Arquivo Carregado e Parsing
  const [fileName, setFileName] = useState<string | null>(null);
  const [feedMetadata, setFeedMetadata] = useState<CaixaFeedMetadata | null>(null);
  const [selectedRow, setSelectedRow] = useState<CaixaFeedRowParsed | null>(null);
  const [savedVerification, setSavedVerification] = useState<any | null>(null);

  // Expansão de Elementos Visuais
  const [isRawJsonOpen, setIsRawJsonOpen] = useState(true);
  const [isSavedRecordOpen, setIsSavedRecordOpen] = useState(true);

  const addLog = (msg: string) => {
    setTechLogs((prev) => [...prev, `[${prev.length + 1}] ${msg}`]);
  };

  /**
   * BOTÃO 1: [ ABRIR CSV OFICIAL DA CAIXA ] (Seção 3 & 4)
   * Abre a URL oficial no navegador do administrador (sem passar pela Edge Function).
   */
  const handleOpenOfficialCsv = () => {
    const url = buildCaixaFeedUrl(selectedUf);
    addLog(`Abrindo URL pública do CSV no navegador do administrador: ${url}`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  /**
   * BOTÃO 2: [ IMPORTAR CSV CAIXA ] (Seção 4, 7, 8, 9, 23)
   * Upload manual e acionamento do parser central parseCaixaCsv().
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    setTechLogs([]);
    setSavedVerification(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;

      try {
        addLog(`[1] Arquivo recebido: ${file.name} (${file.size.toLocaleString()} bytes)`);

        const parseResult = parseCaixaCsv(content, selectedUf, file.name);

        addLog(`[2] Encoding e Delimitador processados: ${parseResult.metadata.encoding} (separador '${parseResult.metadata.delimiter}')`);
        addLog(`[3] Cabeçalho oficial identificado com sucesso`);
        addLog(`[4] Data de geração da base CAIXA: ${parseResult.metadata.source_generated_at || 'Não identificada'}`);
        addLog(`[5] Registros totais encontrados: ${parseResult.metadata.total_records_found.toLocaleString()}`);
        addLog(`[6] Registros válidos lidos: ${parseResult.metadata.valid_records_count.toLocaleString()}`);
        addLog(`[7] Registros inválidos descartados: ${parseResult.metadata.invalid_records_count}`);
        addLog(`[8] Divergências ID x Link rejeitadas: ${parseResult.metadata.rejected_mismatch_count}`);

        setFeedMetadata(parseResult.metadata);

        if (parseResult.rows.length === 0) {
          throw new Error('Nenhum imóvel válido foi encontrado no arquivo importado.');
        }

        const firstRow = parseResult.rows[0];
        setSelectedRow(firstRow);
        addLog(`[9] Preview gerado para o 1º imóvel real: ID TEXT "${firstRow.source_property_id}"`);

        if (save) {
          await executeSupabaseSave(firstRow, parseResult.metadata);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao importar arquivo CSV da CAIXA');
        addLog(`[ERRO PARSING] ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    // Leitura com fallback de encoding Windows-1252 / ISO-8859-1
    reader.readAsText(file, 'iso-8859-1');
  };

  /**
   * BOTÃO 3: [ TESTAR E SALVAR NO SUPABASE ] (Seção 26, 27, 29, 30)
   * Executa o UPSERT no Supabase com os dados que JÁ foram importados.
   */
  const handleSaveToSupabaseClick = async () => {
    if (!selectedRow || !feedMetadata) {
      setErrorMsg('Importe um arquivo CSV primeiro antes de salvar no Supabase.');
      return;
    }
    await executeSupabaseSave(selectedRow, feedMetadata);
  };

  /**
   * Executa UPSERT + SELECT no Supabase
   */
  const executeSupabaseSave = async (row: CaixaFeedRowParsed, metadata: CaixaFeedMetadata) => {
    setSaving(true);
    setSave(true);

    try {
      addLog(`[10] Iniciando UPSERT no Supabase em public.properties para source="CAIXA" e source_property_id="${row.source_property_id}"...`);

      const propertyPayload = {
        source: 'CAIXA',
        source_property_id: row.source_property_id,
        title: row.address ? `${row.property_type || 'Imóvel'} - ${row.city}` : `Imóvel CAIXA nº ${row.source_property_id}`,
        property_type: row.property_type || null,
        sale_modality: row.sale_modality || null,
        state: row.state || null,
        city: row.city || null,
        neighborhood: row.neighborhood || null,
        address: row.address || null,
        zipcode: null,

        appraisal_value: row.appraisal_value,
        sale_value: row.sale_value,
        current_minimum_value: row.sale_value,
        discount_percentage: row.discount_percentage,
        calculated_discount_percentage: row.calculated_discount_percentage,

        bedrooms: row.bedrooms ?? null,
        parking_spaces: null,
        total_area: row.total_area ?? null,
        private_area: row.private_area ?? null,
        land_area: row.land_area ?? null,

        description: row.description || null,
        accepts_financing: row.accepts_financing,

        source_url: row.source_url,
        main_photo_url: null,

        source_generated_at: metadata.source_generated_at,
        source_fetched_at: metadata.source_fetched_at,
        source_file_url: metadata.source_file_url,
        source_file_hash: metadata.source_file_hash,
        source_hash: row.source_hash,

        enrichment_status: 'PENDING',
        status: 'ACTIVE',
        raw_list_data: row.raw_list_data,
      };

      const result = await upsertPropertyToSupabase(propertyPayload, [], []);

      if (!result.success) {
        throw new Error(result.error || 'Falha no UPSERT do imóvel no Supabase');
      }

      addLog(`[11] [UPSERT SUCESSO] UUID Interno: ${result.propertyId} ${result.isMemoryFallback ? '(Store Local)' : '(Supabase Postgres)'}`);

      addLog(`[12] Executando SELECT de verificação para o imóvel ${row.source_property_id}...`);
      const verifyRes = await verifySavedPropertyInSupabase('CAIXA', row.source_property_id);

      if (verifyRes.success) {
        addLog(`[13] [VERIFICAÇÃO OK] Registro confirmado no Supabase com id: ${verifyRes.record.id}`);
        setSavedVerification(verifyRes);
      } else {
        throw new Error('Não foi possível verificar o registro salvo no banco.');
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao salvar no Supabase: ${err.message}`);
      addLog(`[ERRO SAVE] ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // JSON Canônico Conforme Seção 22
  const canonicalResponseJson = selectedRow
    ? {
        source: 'CAIXA',
        source_property_id: selectedRow.source_property_id,
        state: selectedRow.state,
        city: selectedRow.city,
        neighborhood: selectedRow.neighborhood,
        address: selectedRow.address,
        sale_value: selectedRow.sale_value,
        appraisal_value: selectedRow.appraisal_value,
        discount_percentage: selectedRow.discount_percentage,
        calculated_discount_percentage: selectedRow.calculated_discount_percentage,
        accepts_financing: selectedRow.accepts_financing,
        description: selectedRow.description,
        sale_modality: selectedRow.sale_modality,
        source_url: selectedRow.source_url,
        source_generated_at: feedMetadata?.source_generated_at || null,
        source_fetched_at: feedMetadata?.source_fetched_at || null,
        enrichment_status: 'PENDING',
        status: 'ACTIVE',
        raw_list_data: selectedRow.raw_list_data,
      }
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 font-sans">
      
      {/* CABEÇALHO DA INTERFACE ADMINISTRATIVA: INTEGRAÇÃO CAIXA (Seção 4) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="bg-orange-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider">
              Integração CAIXA
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Fonte Oficial da CAIXA
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
            Importação & Sincronização de Imóveis CAIXA
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-3xl mt-1">
            Nenhum imóvel é inventado ou simulado. Aquisição dos dados oficiais via importação de CSV com UPSERT no Supabase.
          </p>
        </div>
      </div>

      {/* ÁREA DE DIAGNÓSTICO DE CONECTIVIDADE DO RUNTIME (Seção 58) */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl border border-slate-800 space-y-3 shadow-md">
        <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" /> CONECTIVIDADE CAIXA (Status do Runtime)
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[10px] block font-bold">Último Diagnóstico:</span>
            <span className="text-slate-200 font-bold">10/08/2026</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[10px] block font-bold">Runtime Supabase → CAIXA:</span>
            <span className="text-red-400 font-extrabold flex items-center gap-1">
              🔴 403 FORBIDDEN
            </span>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[10px] block font-bold">Aquisição Ativa:</span>
            <span className="text-emerald-400 font-bold">MANUAL_CSV</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
            <span className="text-slate-500 text-[10px] block font-bold">Enriquecimento Automático:</span>
            <span className="text-amber-400 font-bold">PENDING_EXTERNAL_PROVIDER</span>
          </div>
        </div>
      </div>

      {/* PAINEL DE CONTROLE DE PARÂMETROS E INDICADORES (Seção 4, 6) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-b border-slate-100 pb-6">
          
          {/* Seleção de Estado (UF) */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
              ESTADO (UF)
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

          {/* Limite de Imóveis (Seção 4, 23) */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
              LIMITE DE IMÓVEIS
            </label>
            <select
              value={testLimit}
              onChange={(e) => setTestLimit(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              <option value={1}>1 imóvel (Provar cadeia)</option>
              <option value={10}>10 imóveis</option>
              <option value={100}>100 imóveis</option>
              <option value={999999}>Todos os imóveis</option>
            </select>
          </div>

          {/* Indicadores de Status Exigidos na Seção 4 */}
          <div className="md:col-span-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Aquisição automática server-side:</span>
              <span className="font-extrabold text-red-600 flex items-center gap-1">
                🔴 Indisponível no runtime atual
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
              <span className="font-bold text-slate-700">Importação CSV:</span>
              <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                🟢 Disponível
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
              <span className="font-bold text-slate-700">Enriquecimento automático:</span>
              <span className="font-extrabold text-red-600 flex items-center gap-1">
                🔴 Indisponível no runtime atual
              </span>
            </div>
          </div>

        </div>

        {/* CONTROLE DE ENRIQUECIMENTO DESABILITADO (Seção 6) */}
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start space-x-3 text-xs text-amber-900">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <label className="flex items-center space-x-2 font-black cursor-not-allowed opacity-60">
              <input type="checkbox" disabled checked={false} className="rounded text-amber-600" />
              <span>ENRIQUECER (Desabilitado)</span>
            </label>
            <p className="text-[11px] text-amber-800">
              Enriquecimento requer acesso server-side à ficha individual da CAIXA. O runtime atual recebe HTTP 403 da fonte. A importação via CSV funciona normalmente.
            </p>
          </div>
        </div>

        {/* OS TRÊS BOTÕES SOLICITADOS NA SEÇÃO 4 DA ESPECIFICAÇÃO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* BOTÃO 1: [ ABRIR CSV OFICIAL DA CAIXA ] (Abre a URL oficial no navegador) */}
          <button
            onClick={handleOpenOfficialCsv}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition-all transform active:scale-95"
          >
            <ExternalLink className="w-4 h-4 text-orange-400" />
            <span>[ ABRIR CSV OFICIAL DA CAIXA ]</span>
          </button>

          {/* BOTÃO 2: [ IMPORTAR CSV CAIXA ] (Faz o upload manual do arquivo baixado) */}
          <label className={`bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all transform active:scale-95 ${loading ? 'opacity-70 cursor-wait' : ''}`}>
            <Upload className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'PROCESSANDO CSV...' : '[ IMPORTAR CSV CAIXA ]'}</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>

          {/* BOTÃO 3: [ TESTAR E SALVAR NO SUPABASE ] (Executa UPSERT + SELECT) */}
          <button
            onClick={handleSaveToSupabaseClick}
            disabled={!selectedRow || saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50"
          >
            <Database className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            <span>[ TESTAR E SALVAR NO SUPABASE ]</span>
          </button>

        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

      </div>

      {/* PAINEL DE METADADOS DO ARQUIVO CAIXA IMPORTADO (Seção 12, 23) */}
      {feedMetadata && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-500" /> ARQUIVO CAIXA IMPORTADO ({fileName || 'Lista_imoveis.csv'})
            </span>
            <span className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-mono text-slate-600 font-bold">
              SHA-256 Hash: {feedMetadata.source_file_hash}
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">UF DA BASE:</span>
              <span className="font-black text-slate-900 text-sm">{feedMetadata.uf}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">DATA DE GERAÇÃO DA BASE:</span>
              <span className="font-black text-orange-600 text-sm">{feedMetadata.source_generated_at || 'DD/MM/YYYY'}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">LINHAS ENCONTRADAS:</span>
              <span className="font-black text-slate-900 text-sm">{feedMetadata.total_records_found.toLocaleString()}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">REGISTROS VÁLIDOS:</span>
              <span className="font-black text-emerald-600 text-sm">{feedMetadata.valid_records_count.toLocaleString()}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">INVÁLIDOS / MISMATCH:</span>
              <span className="font-black text-red-600 text-sm">
                {feedMetadata.invalid_records_count + feedMetadata.rejected_mismatch_count}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CARD DO PRIMEIRO IMÓVEL REAL OBTIDO DO CSV (Seção 24, 25) */}
      {selectedRow && (
        <div className="space-y-8">
          
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="p-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> PRIMEIRO IMÓVEL REAL DO ARQUIVO CSV
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-extrabold font-mono">
                ID TEXT: {selectedRow.source_property_id}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              <div className="lg:col-span-5 space-y-3">
                <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                  <Lock className="w-10 h-10 stroke-1 text-slate-400 mb-2" />
                  <span className="text-xs font-bold text-slate-600">Foto ainda não carregada</span>
                  <span className="text-[10px] text-slate-400 mt-1 max-w-xs">
                    (Enriquecimento automático de foto suspenso devido a bloqueio 403 server-side)
                  </span>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-extrabold text-orange-600 uppercase tracking-wider mb-1">
                    <span>{selectedRow.property_type || 'Imóvel CAIXA'}</span>
                    <span>•</span>
                    <span>{selectedRow.city} / {selectedRow.state}</span>
                  </div>

                  <h2 className="text-xl font-black text-slate-900 leading-snug">
                    {selectedRow.address || `Imóvel CAIXA nº ${selectedRow.source_property_id}`}
                  </h2>

                  {selectedRow.neighborhood && (
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      Bairro: {selectedRow.neighborhood}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">PREÇO CAIXA:</span>
                    <span className="text-lg font-black text-emerald-600">
                      {selectedRow.sale_value ? formatCurrencyBRL(selectedRow.sale_value) : 'Sob Consulta'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">AVALIAÇÃO:</span>
                    <span className="text-sm font-extrabold text-slate-700 line-through">
                      {selectedRow.appraisal_value ? formatCurrencyBRL(selectedRow.appraisal_value) : 'N/I'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">DESCONTO:</span>
                    <span className="text-sm font-extrabold text-orange-600">
                      {selectedRow.discount_percentage !== null ? `${selectedRow.discount_percentage}%` : 'N/I'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">ÁREA PRIVATIVA:</span>
                    <span className="font-extrabold text-slate-900">
                      {selectedRow.private_area ? `${selectedRow.private_area} m²` : 'N/I'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">QUARTOS:</span>
                    <span className="font-extrabold text-slate-900">
                      {selectedRow.bedrooms !== null ? selectedRow.bedrooms : 'N/I'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">FINANCIAMENTO:</span>
                    <span className="font-extrabold text-slate-900">
                      {selectedRow.accepts_financing ? 'Sim' : selectedRow.accepts_financing === false ? 'Não' : 'N/I'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">MODALIDADE:</span>
                    <span className="font-extrabold text-slate-900 truncate block">
                      {selectedRow.sale_modality || 'Venda Direta'}
                    </span>
                  </div>
                </div>

                {selectedRow.description && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <span className="text-slate-400 font-bold block text-[10px] uppercase">Descrição Oficial do CSV:</span>
                    <p className="text-slate-700 font-medium leading-relaxed">{selectedRow.description}</p>
                  </div>
                )}

                {/* BOTÕES DE AÇÃO DO CARD DA SEÇÃO 24 */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={selectedRow.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-colors shadow-md"
                  >
                    <span>[ ABRIR NA CAIXA ]</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={handleSaveToSupabaseClick}
                    disabled={saving}
                    className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-colors shadow-md"
                  >
                    <Database className="w-4 h-4" />
                    <span>[ SALVAR NO SUPABASE ]</span>
                  </button>
                </div>

              </div>

            </div>
          </div>

          {/* EXIBIÇÃO DO JSON CANÔNICO (Seção 22, 24) */}
          {canonicalResponseJson && (
            <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
              <button
                onClick={() => setIsRawJsonOpen(!isRawJsonOpen)}
                className="w-full p-5 bg-slate-900 hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs font-black text-slate-200"
              >
                <div className="flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-orange-400" />
                  <span>[ VER JSON CANÔNICO DA SEÇÃO 22 ]</span>
                </div>
                <span className="text-emerald-400 font-mono text-[10px]">
                  {isRawJsonOpen ? 'Ocultar JSON' : 'Ver JSON'}
                </span>
              </button>

              {isRawJsonOpen && (
                <pre className="overflow-x-auto p-6 bg-slate-950 border-t border-slate-800 text-[11px] leading-relaxed text-emerald-400 font-mono max-h-96">
                  {JSON.stringify(canonicalResponseJson, null, 2)}
                </pre>
              )}
            </div>
          )}

        </div>
      )}

      {/* REGISTRO SALVO E CONFIRMADO NO SUPABASE APÓS UPSERT + SELECT (Seção 29) */}
      {savedVerification && (
        <div className="bg-emerald-950/40 text-white p-6 rounded-3xl border border-emerald-500/40 shadow-2xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-black text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>REGISTRO SALVO NO SUPABASE</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-500/40">
              {savedVerification.isMemoryFallback ? 'Store Local OK' : 'Supabase Postgres OK'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-300 text-[11px]">
            <div>
              <span className="text-emerald-400 font-bold block">UUID:</span>
              <span className="font-mono text-white">{savedVerification.record?.id}</span>
            </div>

            <div>
              <span className="text-emerald-400 font-bold block">Número CAIXA:</span>
              <span className="font-mono text-white">{savedVerification.record?.source_property_id}</span>
            </div>

            <div>
              <span className="text-emerald-400 font-bold block">Preço:</span>
              <span className="font-mono text-white">
                {savedVerification.record?.sale_value ? formatCurrencyBRL(savedVerification.record.sale_value) : 'N/I'}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsSavedRecordOpen(!isSavedRecordOpen)}
              className="text-xs font-bold text-emerald-400 hover:underline flex items-center space-x-1"
            >
              <span>{isSavedRecordOpen ? 'Ocultar registro do banco' : 'Ver registro completo recuperado via SELECT'}</span>
            </button>

            {isSavedRecordOpen && (
              <pre className="mt-3 p-4 bg-slate-950 text-emerald-300 rounded-2xl overflow-x-auto text-[10px] leading-relaxed border border-emerald-500/30 max-h-80">
                {JSON.stringify(savedVerification.record, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* LOG TÉCNICO DE PROCESSAMENTO (Seção 35) */}
      {techLogs.length > 0 && (
        <div className="bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-black">
            <span className="text-orange-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> LOG DO PROCESSO (SEÇÃO 35)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {techLogs.length} etapas registradas
            </span>
          </div>

          <div className="p-4 font-mono text-[11px] leading-relaxed text-slate-300 max-h-60 overflow-y-auto space-y-1">
            {techLogs.map((log, idx) => (
              <div key={idx} className={log.includes('[ERRO') ? 'text-red-400 font-bold' : log.includes('[UPSERT') || log.includes('[VERIFICAÇÃO') ? 'text-emerald-400 font-bold' : ''}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
