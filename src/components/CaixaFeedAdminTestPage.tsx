import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Code2,
  Upload,
  RefreshCw,
  Check,
  Terminal,
  Activity,
  Search,
} from 'lucide-react';

import {
  buildCaixaFeedUrl,
  parseCaixaCsvFeed,
  type CaixaFeedMetadata,
  type CaixaFeedRowParsed,
} from '../utils/caixaListImporter';

import { parseCaixaHTML, type CaixaErrorCode } from '../utils/caixaParser';
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

export interface DiagnosticTestResult {
  classification: string;
  recommended_ingestion_method: string;
  official_search_available: boolean;
  sample_property_ids: string[];
  form_debug: {
    action?: string;
    method?: string;
    selectUfName?: string;
    hiddenInputs?: Record<string, string>;
  } | null;
  tests: {
    root: TestItem;
    download_page: TestItem;
    direct_csv: TestItem;
    public_search: TestItem;
  };
}

export interface TestItem {
  name: string;
  url: string;
  status: number;
  finalUrl: string;
  contentType: string;
  contentLength: string | null;
  bytesReceived: number;
  location: string | null;
  server: string | null;
  snippet: string;
  responseTimeMs: number;
  contains_real_properties?: boolean;
}

export const CaixaFeedAdminTestPage: React.FC = () => {
  // Parâmetros de Entrada de Teste
  const [selectedUf, setSelectedUf] = useState('SP');
  const [testLimit, setTestLimit] = useState(1);
  const [enrich, setEnrich] = useState(false);
  const [save, setSave] = useState(false);

  // Estados de Execução e Logs
  const [loading, setLoading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<CaixaErrorCode | null>(null);
  const [techLogs, setTechLogs] = useState<string[]>([]);

  // Dados Retornados
  const [feedMetadata, setFeedMetadata] = useState<CaixaFeedMetadata | null>(null);
  const [selectedRow, setSelectedRow] = useState<CaixaFeedRowParsed | null>(null);
  const [detailParsedResult, setDetailParsedResult] = useState<any | null>(null);
  const [savedVerification, setSavedVerification] = useState<any | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticTestResult | null>(null);

  // Sanity check visual de expansão de código
  const [isRawJsonOpen, setIsRawJsonOpen] = useState(true);
  const [isSavedRecordOpen, setIsSavedRecordOpen] = useState(true);
  const [isDiagJsonOpen, setIsDiagJsonOpen] = useState(true);

  const addLog = (msg: string) => {
    setTechLogs((prev) => [...prev, `[${prev.length + 1}] ${msg}`]);
  };

  /**
   * EXECUTAR DIAGNÓSTICO HTTP SERVER-SIDE DAS 4 REQUISIÇÕES INDEPENDENTES
   */
  const handleRunDiagnostic = async () => {
    setDiagnosing(true);
    setErrorMsg(null);
    setDiagnosticResult(null);
    setTechLogs([]);

    try {
      addLog(`Iniciando diagnóstico HTTP server-side para o domínio da CAIXA (UF ${selectedUf})...`);
      addLog(`Enviando requisição server-side sem contorno anti-bot / com headers mínimos padrão...`);

      const res = await fetch(`/api/caixa-proxy?action=diagnose&uf=${selectedUf}`);
      if (!res.ok) {
        throw new Error(`Erro na resposta do diagnóstico HTTP Status ${res.status}`);
      }

      const diagData: DiagnosticTestResult = await res.json();
      setDiagnosticResult(diagData);

      addLog(`Diagnóstico concluído com classificação: ${diagData.classification}`);
      addLog(`Método de Ingestão Recomendado: ${diagData.recommended_ingestion_method}`);
      addLog(`Teste A (Domínio): Status ${diagData.tests.root.status}`);
      addLog(`Teste B (Página download): Status ${diagData.tests.download_page.status}`);
      addLog(`Teste C (CSV direto SP): Status ${diagData.tests.direct_csv.status}`);
      addLog(`Teste D (Busca pública SP): Status ${diagData.tests.public_search.status} (${diagData.official_search_available ? 'Imóveis Reais Detectados' : 'Sem imóveis detectados'})`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao executar o diagnóstico de acesso');
      addLog(`[ERRO DIAGNÓSTICO] ${err.message}`);
    } finally {
      setDiagnosing(false);
    }
  };

  /**
   * FLUXO PRINCIPAL: TESTE DO FEED OFICIAL CSV (/listaweb/Lista_imoveis_{UF}.csv)
   */
  const handleRunFeedTest = async (enrichOverride?: boolean, saveOverride?: boolean) => {
    const isEnrichActive = enrichOverride !== undefined ? enrichOverride : enrich;
    const isSaveActive = saveOverride !== undefined ? saveOverride : save;

    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);
    setTechLogs([]);
    setFeedMetadata(null);
    setSelectedRow(null);
    setDetailParsedResult(null);
    setSavedVerification(null);

    const feedUrl = buildCaixaFeedUrl(selectedUf);

    try {
      addLog(`Consultando feed oficial da CAIXA: ${feedUrl}`);

      const resFeed = await fetch(`/api/caixa-proxy?action=download_feed&uf=${selectedUf}`);
      if (!resFeed.ok) {
        setErrorCode('FEED_HTTP_ERROR');
        throw new Error(`FEED_HTTP_ERROR: Status HTTP ${resFeed.status} ao baixar ${feedUrl}`);
      }

      const feedData = await resFeed.json();
      addLog(`Status HTTP 200 OK | Content-Type: ${feedData.contentType || 'application/octet-stream'}`);
      addLog(`Tamanho retornado: ${feedData.contentLength || 0} bytes`);

      const parsedFeed = parseCaixaCsvFeed(feedData.fileContent || '', selectedUf, feedUrl);
      setFeedMetadata(parsedFeed.metadata);

      addLog(`Data de geração da base CAIXA: ${parsedFeed.metadata.source_generated_at || 'Não identificada no cabeçalho'}`);
      addLog(`Horário de download (fetch): ${parsedFeed.metadata.source_fetched_at}`);
      addLog(`Registros encontrados: ${parsedFeed.rows.length.toLocaleString()} imóveis válidos (${parsedFeed.metadata.rejected_mismatch_count} rejeitados por divergência ID x Link)`);

      if (parsedFeed.rows.length === 0) {
        setErrorCode('FEED_EMPTY');
        throw new Error(`FEED_EMPTY: Nenhum imóvel válido foi encontrado no feed de ${selectedUf}`);
      }

      const firstRow = parsedFeed.rows[0];
      setSelectedRow(firstRow);
      addLog(`Imóvel real selecionado da base: ID TEXT "${firstRow.source_property_id}"`);
      addLog(`Link oficial do CSV: ${firstRow.source_url}`);

      let enrichedDetail: any = null;
      if (isEnrichActive) {
        addLog(`[ENRIQUECIMENTO] Solicitando ficha individual oficial em: ${firstRow.source_url}`);

        const resDetail = await fetch(`/api/caixa-proxy?action=fetch_detail&id=${firstRow.source_property_id}`);
        if (!resDetail.ok) {
          addLog(`Aviso no enriquecimento: HTTP ${resDetail.status}`);
        } else {
          const detailData = await resDetail.json();
          enrichedDetail = parseCaixaHTML(detailData.html, firstRow.source_property_id, firstRow.source_url, detailData.status);

          if (!enrichedDetail.success) {
            addLog(`Aviso na verificação da ficha: Código de erro ${enrichedDetail.error}`);
          } else {
            addLog(`Ficha individual validada! ${enrichedDetail.photos.length + (enrichedDetail.main_photo_url ? 1 : 0)} fotos e ${enrichedDetail.documents.list.length} documentos extraídos.`);
          }

          setDetailParsedResult(enrichedDetail);
        }
      }

      if (isSaveActive) {
        await executeSupabaseSave(firstRow, enrichedDetail, parsedFeed.metadata);
      } else {
        addLog(`Teste concluído em modo PREVIEW (save = false). Nenhuma alteração gravada no banco.`);
      }

      setErrorCode('SUCCESS');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao executar o teste do feed oficial da CAIXA');
      addLog(`[ERRO] ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Executa o UPSERT no Supabase e o SELECT de confirmação
   */
  const executeSupabaseSave = async (
    row: CaixaFeedRowParsed,
    enrichedDetail: any,
    metadata: CaixaFeedMetadata
  ) => {
    setSaving(true);
    setSave(true);

    try {
      addLog(`Iniciando UPSERT no Supabase em public.properties para source="CAIXA" e source_property_id="${row.source_property_id}"...`);

      const photosPayload: any[] = [];
      const mainPhoto = enrichedDetail?.main_photo_url || null;

      if (mainPhoto) {
        photosPayload.push({ source_url: mainPhoto, position: 0, is_main: true });
      }

      if (Array.isArray(enrichedDetail?.photos)) {
        enrichedDetail.photos.forEach((url: string) => {
          if (url && url !== mainPhoto && !photosPayload.some((p) => p.source_url === url)) {
            photosPayload.push({ source_url: url, position: photosPayload.length, is_main: false });
          }
        });
      }

      const docsPayload: any[] = [];
      if (Array.isArray(enrichedDetail?.documents?.list)) {
        enrichedDetail.documents.list.forEach((d: any) => {
          docsPayload.push({
            document_type: d.type,
            title: d.title,
            source_url: d.url,
          });
        });
      }

      const propertyPayload = {
        source: 'CAIXA',
        source_property_id: row.source_property_id,
        title: row.address ? `${row.property_type || 'Imóvel'} - ${row.city}` : `Imóvel CAIXA nº ${row.source_property_id}`,
        property_type: enrichedDetail?.property?.property_type || row.property_type || null,
        sale_modality: row.sale_modality || null,
        state: row.state || null,
        city: row.city || null,
        neighborhood: row.neighborhood || null,
        address: row.address || null,
        zipcode: enrichedDetail?.property?.zipcode || null,

        appraisal_value: row.appraisal_value,
        sale_value: row.sale_value,
        current_minimum_value: row.sale_value,
        discount_percentage: row.discount_percentage,

        bedrooms: enrichedDetail?.property?.bedrooms ?? row.bedrooms ?? null,
        parking_spaces: enrichedDetail?.property?.parking_spaces ?? null,

        total_area: enrichedDetail?.property?.total_area ?? row.total_area ?? null,
        private_area: enrichedDetail?.property?.private_area ?? row.private_area ?? null,
        land_area: enrichedDetail?.property?.land_area ?? row.land_area ?? null,

        description: row.description || null,
        accepts_financing: row.accepts_financing,

        source_url: row.source_url,
        main_photo_url: mainPhoto,

        source_generated_at: metadata.source_generated_at,
        source_fetched_at: metadata.source_fetched_at,
        source_file_url: metadata.source_file_url,
        source_file_hash: metadata.source_file_hash,

        enrichment_status: enrichedDetail?.success ? 'COMPLETE' : 'PENDING',
        raw_list_data: row.raw_list_data,
        raw_detail_data: enrichedDetail?.debug || {},
      };

      const result = await upsertPropertyToSupabase(propertyPayload, photosPayload, docsPayload);

      if (!result.success) {
        throw new Error(result.error || 'Falha no UPSERT');
      }

      addLog(`[UPSERT SUCESSO] UUID Interno: ${result.propertyId} ${result.isMemoryFallback ? '(Store Local de Verificação)' : '(Supabase Postgres)'}`);

      addLog(`Executando SELECT de verificação para o imóvel ${row.source_property_id}...`);
      const verifyRes = await verifySavedPropertyInSupabase('CAIXA', row.source_property_id);

      if (verifyRes.success) {
        addLog(`[VERIFICAÇÃO OK] Registro recuperado do Supabase com id: ${verifyRes.record.id}`);
        setSavedVerification(verifyRes);
      } else {
        throw new Error('Não foi possível verificar o registro salvo via SELECT.');
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao salvar no Supabase: ${err.message}`);
      addLog(`[ERRO SAVE] ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * FALLBACK MANUAL DE UPLOAD DE CSV CAIXA
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;

      setLoading(true);
      setErrorMsg(null);
      setErrorCode(null);
      setTechLogs([]);
      setSavedVerification(null);

      try {
        addLog(`Carregando arquivo manual de feed CSV: ${file.name} (${file.size} bytes)`);

        const parsedFeed = parseCaixaCsvFeed(content, selectedUf, file.name);
        setFeedMetadata(parsedFeed.metadata);

        addLog(`Data de geração da base: ${parsedFeed.metadata.source_generated_at || 'Não identificada'}`);
        addLog(`${parsedFeed.rows.length.toLocaleString()} imóveis válidos lidos do arquivo manual`);

        if (parsedFeed.rows.length === 0) {
          setErrorCode('FEED_EMPTY');
          throw new Error('FEED_EMPTY: Nenhum imóvel válido encontrado no arquivo fornecido');
        }

        const firstRow = parsedFeed.rows[0];
        setSelectedRow(firstRow);

        let enrichedDetail = null;
        if (enrich) {
          const resDetail = await fetch(`/api/caixa-proxy?action=fetch_detail&id=${firstRow.source_property_id}`);
          const detailData = await resDetail.json();
          enrichedDetail = parseCaixaHTML(detailData.html, firstRow.source_property_id, firstRow.source_url, detailData.status);
          setDetailParsedResult(enrichedDetail);
        }

        if (save) {
          await executeSupabaseSave(firstRow, enrichedDetail, parsedFeed.metadata);
        }
      } catch (err: any) {
        setErrorMsg(err.message);
        addLog(`[ERRO MANUAL] ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file, 'iso-8859-1');
  };

  const canonicalResponseJson = selectedRow
    ? {
        success: true,
        feed: {
          source: 'CAIXA',
          uf: selectedUf,
          url: feedMetadata?.source_file_url || buildCaixaFeedUrl(selectedUf),
          http_status: 200,
          content_type: 'application/octet-stream',
          source_generated_at: feedMetadata?.source_generated_at || null,
          source_fetched_at: feedMetadata?.source_fetched_at || null,
          records_found: feedMetadata?.total_records_found || 0,
        },
        property: {
          source: 'CAIXA',
          source_property_id: selectedRow.source_property_id,
          state: selectedRow.state,
          city: selectedRow.city,
          neighborhood: selectedRow.neighborhood,
          address: selectedRow.address,
          sale_value: selectedRow.sale_value,
          appraisal_value: selectedRow.appraisal_value,
          discount_percentage: selectedRow.discount_percentage,
          accepts_financing: selectedRow.accepts_financing,
          description: selectedRow.description,
          sale_modality: selectedRow.sale_modality,
          source_url: selectedRow.source_url,
          main_photo_url: detailParsedResult?.main_photo_url || null,
          photos: detailParsedResult?.photos || [],
          documents: detailParsedResult?.documents?.list || [],
        },
      }
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 font-sans">
      
      {/* BANNER PRINCIPAL DO TESTE DO FEED OFICIAL */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="bg-orange-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider">
              /admin/caixa-feed-test
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Ingestão Autônoma CAIXA + Supabase
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
            Diagnóstico de Acesso HTTP & Ingestão CAIXA
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-3xl mt-1">
            Diagnostique o status HTTP 403 e a acessibilidade das 4 URLs oficiais da CAIXA server-side sem tentar contornar anti-bot ou simular humano.
          </p>
        </div>
      </div>

      {/* PAINEL DE AÇÃO DIAGNÓSTICA ESPECIAL */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border border-orange-500/30 p-6 rounded-3xl space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider block">Diagnóstico de Conectividade</span>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-500" /> Diagnosticar Acesso HTTP da CAIXA
            </h2>
            <p className="text-xs text-slate-600">
              Executa 4 requisições GET server-side independentes com headers padrão mínimos (sem cookies nem simulador anti-bot).
            </p>
          </div>

          {/* BOTÃO PRINCIPAL SOLICITADO: [ DIAGNOSTICAR ACESSO CAIXA ] */}
          <button
            onClick={handleRunDiagnostic}
            disabled={diagnosing || loading}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            <Activity className={`w-4 h-4 text-orange-400 ${diagnosing ? 'animate-spin' : ''}`} />
            <span>{diagnosing ? 'EXECUTANDO DIAGNÓSTICO...' : '[ DIAGNOSTICAR ACESSO CAIXA ]'}</span>
          </button>
        </div>
      </div>

      {/* RESULTADO DO DIAGNÓSTICO EM TABELA E CLASSIFICAÇÃO AUTOMÁTICA */}
      {diagnosticResult && (
        <div className="space-y-6">
          
          {/* Card de Classificação do Cenário */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 space-y-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 text-xs font-bold uppercase">Classificação Automática:</span>
                <span className="bg-orange-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase font-mono">
                  {diagnosticResult.classification}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-400 font-bold">Ingestão Recomendada:</span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-0.5 rounded-full font-extrabold font-mono">
                  {diagnosticResult.recommended_ingestion_method}
                </span>
              </div>
            </div>

            {/* Descrição Didática do Cenário */}
            <p className="text-xs text-slate-300 font-medium">
              {diagnosticResult.classification.includes('CENARIO_1') && (
                <strong className="text-amber-400">CENÁRIO 1 (CSV_DIRECT_BLOCKED): O caminho direto /listaweb está retornando 403, porém as páginas HTML oficiais continuam retornando 200 OK. Estratégia recomendada: Ingestão pelas páginas públicas oficiais (OFFICIAL_HTML_SEARCH).</strong>
              )}
              {diagnosticResult.classification.includes('CENARIO_2') && (
                <strong className="text-red-400">CENÁRIO 2 (CAIXA_BLOCKS_SERVER_ORIGIN): O IP / runtime do servidor está bloqueado no domínio (403 em todas as URLs). Manter a opção de upload manual de CSV e preparar ingestão autorizada externa.</strong>
              )}
              {diagnosticResult.classification.includes('CENARIO_3') && (
                <strong className="text-amber-400">CENÁRIO 3 (FORM_AVAILABLE_CSV_BLOCKED): A página de formulário oficial download-lista.asp respondeu 200 OK, mas a URL direta do CSV retornou 403.</strong>
              )}
              {diagnosticResult.classification.includes('CENARIO_4') && (
                <strong className="text-emerald-400">CENÁRIO 4 (DIRECT_CSV_AVAILABLE): A URL do CSV direto respondeu HTTP 200 OK! O feed CSV oficial por UF pode continuar sendo consumido.</strong>
              )}
              {diagnosticResult.classification.includes('CENARIO_5') && (
                <strong className="text-emerald-400">CENÁRIO 5 (SEARCH_PAGE_AVAILABLE): A busca pública oficial respondeu 200 OK e contém imóveis reais listados.</strong>
              )}
            </p>
          </div>

          {/* TABELA DE DIAGNÓSTICO EXIGIDA NO ESPECIFICADO */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Resultados das Requisições HTTP Server-Side</span>
            
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 font-black text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">RECURSO</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3">CONTENT-TYPE</th>
                    <th className="p-3">BYTES</th>
                    <th className="p-3 text-right">TEMPO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {Object.values(diagnosticResult.tests).map((test) => (
                    <tr key={test.name} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{test.name}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-xs block font-mono">{test.url}</span>
                      </td>

                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                          test.status === 200 ? 'bg-emerald-100 text-emerald-800' : test.status === 403 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {test.status} {test.status === 200 ? 'OK' : test.status === 403 ? 'FORBIDDEN' : ''}
                        </span>
                      </td>

                      <td className="p-3 text-slate-600 truncate max-w-[200px]">
                        {test.contentType || 'N/I'}
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        {test.bytesReceived.toLocaleString()} B
                      </td>

                      <td className="p-3 text-right font-extrabold text-slate-600">
                        {test.responseTimeMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DADOS DO FORMULÁRIO (CENÁRIO 3 / FORM DEBUG) */}
          {diagnosticResult.form_debug && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 text-xs font-mono">
              <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider block">Campos do Formulário HTML (download-lista.asp)</span>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div><strong>Form Action:</strong> {diagnosticResult.form_debug.action || 'N/I'}</div>
                <div><strong>Form Method:</strong> {diagnosticResult.form_debug.method || 'POST'}</div>
                <div><strong>UF Select Name:</strong> {diagnosticResult.form_debug.selectUfName || 'hdnEstado'}</div>
                {diagnosticResult.form_debug.hiddenInputs && (
                  <div>
                    <strong>Inputs Hidden:</strong>
                    <pre className="mt-1 text-[10px] bg-slate-100 p-2 rounded-xl">
                      {JSON.stringify(diagnosticResult.form_debug.hiddenInputs, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DADOS DA BUSCA PÚBLICA (CENÁRIO 5 / IDs REAIS DETECTADOS) */}
          {diagnosticResult.sample_property_ids && diagnosticResult.sample_property_ids.length > 0 && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 p-6 rounded-3xl space-y-3 text-xs font-mono">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block flex items-center gap-1">
                <Search className="w-3.5 h-3.5" /> Amostra de IDs Reais Encontrados na Busca Pública Oficial
              </span>
              <div className="flex flex-wrap gap-2">
                {diagnosticResult.sample_property_ids.map((idStr) => (
                  <span key={idStr} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-xl font-black">
                    ID CAIXA: {idStr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* JSON COMPLETO DO RESULTADO DO DIAGNÓSTICO */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <button
              onClick={() => setIsDiagJsonOpen(!isDiagJsonOpen)}
              className="w-full p-5 bg-slate-900 hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs font-black text-slate-200"
            >
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-orange-400" />
                <span>JSON BRUTO DO RESULTADO DO DIAGNÓSTICO</span>
              </div>
              <span className="text-emerald-400 font-mono text-[10px]">
                {isDiagJsonOpen ? 'Ocultar JSON' : 'Ver JSON'}
              </span>
            </button>

            {isDiagJsonOpen && (
              <pre className="overflow-x-auto p-6 bg-slate-950 border-t border-slate-800 text-[11px] leading-relaxed text-emerald-400 font-mono max-h-96">
                {JSON.stringify(diagnosticResult, null, 2)}
              </pre>
            )}
          </div>

        </div>
      )}

      {/* PAINEL DE CONTROLE DA INGESTÃO */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end border-b border-slate-100 pb-6">
          
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Estado (UF):
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

          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
              Limite de Imóveis:
            </label>
            <select
              value={testLimit}
              onChange={(e) => setTestLimit(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-black text-slate-800 focus:ring-2 focus:ring-orange-500"
            >
              <option value={1}>1 imóvel (Provar cadeia)</option>
              <option value={10}>10 imóveis</option>
              <option value={100}>100 imóveis</option>
            </select>
          </div>

          <div className="md:col-span-6 flex flex-wrap items-center gap-6 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <label className="flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
              <input
                type="checkbox"
                checked={enrich}
                onChange={(e) => setEnrich(e.target.checked)}
                className="w-4 h-4 text-orange-600 rounded-md focus:ring-orange-500"
              />
              <span>ENRIQUECER (enrich = true)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-800 select-none">
              <input
                type="checkbox"
                checked={save}
                onChange={(e) => setSave(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500"
              />
              <span>SALVAR SUPABASE (save = true)</span>
            </label>
          </div>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <button
            onClick={() => handleRunFeedTest()}
            disabled={loading || saving || diagnosing}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'CONSULTANDO FEED CAIXA...' : `BAIXAR LISTA REAL DE ${selectedUf}`}</span>
          </button>

          <button
            onClick={() => handleRunFeedTest(true, true)}
            disabled={loading || saving || diagnosing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50"
          >
            <Database className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            <span>TESTAR E SALVAR NO SUPABASE</span>
          </button>

          <label className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-4 rounded-2xl shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-orange-400" />
            <span>IMPORTAR CSV CAIXA</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>[{errorCode || 'ERRO'}] {errorMsg}</span>
          </div>
        )}

      </div>

      {/* LOG TÉCNICO COMPLETO */}
      {techLogs.length > 0 && (
        <div className="bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-black">
            <span className="text-orange-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> LOG TÉCNICO DE AUDITORIA DO FEED
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {techLogs.length} etapas registradas
            </span>
          </div>

          <div className="p-4 font-mono text-[11px] leading-relaxed text-slate-300 max-h-60 overflow-y-auto space-y-1">
            {techLogs.map((log, idx) => (
              <div key={idx} className={log.includes('[ERRO') ? 'text-red-400 font-bold' : log.includes('[SUCESSO') || log.includes('[UPSERT') ? 'text-emerald-400 font-bold' : ''}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* METADADOS OFICIAIS DO FEED CSV */}
      {feedMetadata && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 text-xs">
          <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider block">Metadados Oficiais Extraídos do CSV</span>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">FONTE OFICIAL:</span>
              <span className="font-black text-slate-900 text-sm">{feedMetadata.source}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">ARQUIVO CSV:</span>
              <span className="font-extrabold text-slate-800 truncate block">Lista_imoveis_{feedMetadata.uf}.csv</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">DATA DA BASE CAIXA:</span>
              <span className="font-black text-orange-600 text-sm">{feedMetadata.source_generated_at || 'DD/MM/YYYY'}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">REGISTROS ENCONTRADOS:</span>
              <span className="font-black text-emerald-600 text-sm">{feedMetadata.valid_records_count.toLocaleString()} válidos</span>
            </div>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-600 break-all">
            URL do Feed: <strong>{feedMetadata.source_file_url}</strong>
          </div>
        </div>
      )}

      {/* CARD DO PRIMEIRA IMÓVEL REAL OBTIDO DO CSV */}
      {selectedRow && (
        <div className="space-y-8">
          
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="p-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> PRIMEIRO IMÓVEL REAL DA LISTA CAIXA
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-extrabold font-mono">
                ID TEXT: {selectedRow.source_property_id}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              <div className="lg:col-span-5 space-y-3">
                <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                  {detailParsedResult?.main_photo_url ? (
                    <img
                      src={detailParsedResult.main_photo_url}
                      alt="Foto Principal"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-2 p-4 text-center">
                      <ImageIcon className="w-12 h-12 stroke-1" />
                      <span className="text-xs font-bold">
                        {enrich ? 'Foto não disponível na fonte' : 'Foto disponível no modo ENRIQUECER (enrich = true)'}
                      </span>
                    </div>
                  )}

                  {selectedRow.discount_percentage !== null && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md">
                      {selectedRow.discount_percentage}% DESCONTO
                    </div>
                  )}
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

                <div className="pt-2">
                  <a
                    href={selectedRow.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-colors shadow-md"
                  >
                    <span>ABRIR NA CAIXA (LINK DO CSV)</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

              </div>

            </div>
          </div>

          {detailParsedResult?.documents?.list && detailParsedResult.documents.list.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-3 shadow-sm text-xs">
              <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" /> DOCUMENTOS DO IMÓVEL ({detailParsedResult.documents.list.length})
              </h3>

              <div className="flex flex-wrap gap-3">
                {detailParsedResult.documents.list.map((doc: any, idx: number) => (
                  <a
                    key={idx}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>{doc.title}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {canonicalResponseJson && (
            <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
              <button
                onClick={() => setIsRawJsonOpen(!isRawJsonOpen)}
                className="w-full p-5 bg-slate-900 hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs font-black text-slate-200"
              >
                <div className="flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-orange-400" />
                  <span>RESPOSTA JSON CANÔNICA DO FEED</span>
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

      {savedVerification && (
        <div className="bg-emerald-950/40 text-white p-6 rounded-3xl border border-emerald-500/40 shadow-2xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-black text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>REGISTRO SALVO E CONFIRMADO VIA SELECT NO SUPABASE</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-[10px] font-bold border border-emerald-500/40">
              {savedVerification.isMemoryFallback ? 'Store Local OK' : 'Supabase Postgres OK'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-slate-300 text-[11px]">
            <div>
              <span className="text-emerald-400 font-bold block">UUID Interno:</span>
              <span className="font-mono text-white">{savedVerification.record?.id}</span>
            </div>

            <div>
              <span className="text-emerald-400 font-bold block">Data da Base CAIXA:</span>
              <span className="font-mono text-white">{savedVerification.record?.source_generated_at || 'N/I'}</span>
            </div>

            <div>
              <span className="text-emerald-400 font-bold block">Source Property ID (TEXT):</span>
              <span className="font-mono text-white">{savedVerification.record?.source_property_id}</span>
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

    </div>
  );
};
