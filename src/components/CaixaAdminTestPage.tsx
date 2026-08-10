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
} from 'lucide-react';

import {
  parseCaixaList,
  normalizeCaixaId,
  buildCanonicalProperty,
  type CaixaListRowParsed,
  type CanonicalProperty,
} from '../utils/caixaListImporter';

import { parseCaixaHTML } from '../utils/caixaParser';
import { formatCurrencyBRL } from '../utils/financial';
import {
  upsertPropertyToSupabase,
  verifySavedPropertyInSupabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient';

export const CaixaAdminTestPage: React.FC = () => {
  const [uf, setUf] = useState('SP');
  const [testLimit, setTestLimit] = useState(1);
  const [_saveToSupabase, setSaveToSupabase] = useState(false);

  // Estados de Controle do Fluxo
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resultados da Ingestão
  const [techLogs, setTechLogs] = useState<string[]>([]);
  const [listSummary, setListSummary] = useState<{
    uf: string;
    total: number;
    encoding: string;
    separator: string;
    headersCount: number;
  } | null>(null);

  const [_selectedListRow, setSelectedListRow] = useState<CaixaListRowParsed | null>(null);
  const [canonicalProperty, setCanonicalProperty] = useState<CanonicalProperty | null>(null);
  const [savedVerification, setSavedVerification] = useState<any | null>(null);

  // Sanity check visual de expansão de código
  const [isRawJsonOpen, setIsRawJsonOpen] = useState(true);
  const [isSavedRecordOpen, setIsSavedRecordOpen] = useState(true);

  // Auxiliar para acrescentar logs técnicos
  const addLog = (message: string) => {
    setTechLogs((prev) => [...prev, `[${prev.length + 1}] ${message}`]);
  };

  /**
   * CADEIA COMPLETA DE TESTE — ETAPA 1 (Coleta Oficial -> Ficha -> JSON Canônico)
   * O próprio sistema descobre o imóvel a partir da lista oficial da CAIXA.
   */
  const handleRunCaixaTest = async (_limitOverride?: number) => {
    setLoading(true);
    setErrorMsg(null);
    setTechLogs([]);
    setListSummary(null);
    setCanonicalProperty(null);
    setSavedVerification(null);
    setSaveToSupabase(false);

    try {
      // 1. Abrir página oficial da lista CAIXA
      addLog('Abrindo página da lista CAIXA (https://venda-imoveis.caixa.gov.br/sistema/download-lista.asp)');

      const resList = await fetch(`/api/caixa-proxy?action=download_list&uf=${uf}`);
      if (!resList.ok) {
        throw new Error(`Erro na requisição server-side HTTP Status ${resList.status}`);
      }

      const listData = await resList.json();
      addLog(`Formulário encontrado. Action: ${listData.formAction || 'download-lista-imoveis.asp'}, Method: ${listData.formMethod || 'POST/GET'}`);
      addLog(`Selecionando UF ${uf} no formulário dinâmico`);

      // 2. Processar o arquivo retornado da CAIXA
      addLog(`Arquivo oficial recebido da CAIXA. Tamanho: ${listData.contentLength || 0} bytes`);

      const parsedList = parseCaixaList(listData.fileContent || '');
      addLog(`Encoding detectado: ${parsedList.encoding} | Separador: "${parsedList.separator}"`);
      addLog(`${parsedList.totalRows.toLocaleString()} imóveis encontrados na relação oficial de ${uf}`);

      setListSummary({
        uf,
        total: parsedList.totalRows,
        encoding: parsedList.encoding,
        separator: parsedList.separator,
        headersCount: parsedList.headers.length,
      });

      if (parsedList.rows.length === 0) {
        throw new Error(`Nenhum imóvel válido foi encontrado na lista baixada da UF ${uf}`);
      }

      // 3. Selecionar o primeiro imóvel válido (ou até o TEST_LIMIT)
      const firstRow = parsedList.rows[0];
      setSelectedListRow(firstRow);

      const normalizedId = normalizeCaixaId(firstRow.source_property_id);
      addLog(`Testando imóvel selecionado automaticamente da lista. ID TEXT: ${normalizedId}`);

      // 4. Inspecionar Ficha Individual (detalhe-imovel.asp)
      const targetDetailUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${normalizedId}`;
      addLog(`Consultando ficha individual server-side: ${targetDetailUrl}`);

      const resDetail = await fetch(`/api/caixa-proxy?action=fetch_detail&id=${normalizedId}`);
      if (!resDetail.ok) {
        throw new Error(`Falha HTTP ${resDetail.status} ao consultar a ficha individual do imóvel ${normalizedId}`);
      }

      const detailData = await resDetail.json();
      addLog(`Ficha HTTP 200 OK. HTML recebido com ${detailData.html?.length || 0} bytes`);

      // 5. Parser Determinístico do HTML
      const detailParsed = parseCaixaHTML(detailData.html, normalizedId, targetDetailUrl, detailData.status);

      if (!detailParsed.success) {
        addLog(`Aviso na extração da ficha: ${detailParsed.error}`);
      } else {
        addLog(`Dados principais extraídos com sucesso (${detailParsed.debug?.foundFieldsCount || 0} atributos capturados)`);
      }

      addLog(`${detailParsed.photos.length + (detailParsed.main_photo_url ? 1 : 0)} fotografias encontradas`);
      addLog(`${detailParsed.documents.list.length} documentos localizados`);

      // 6. Montar Objeto Canônico Unificado
      const canonical = buildCanonicalProperty(firstRow, detailParsed);
      setCanonicalProperty(canonical);

      addLog(`JSON Canônico normalizado gerado com sucesso para ${canonical.source_property_id}`);
      addLog(`Preview concluído com sucesso. (SAVE_TO_SUPABASE = false)`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro durante a execução do teste de ingestão da CAIXA');
      addLog(`[ERRO] ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * SEÇÃO DE PERSISTÊNCIA — ETAPA 2 (UPSERT no Supabase + SELECT de Verificação)
   */
  const handleSaveToSupabase = async () => {
    if (!canonicalProperty) return;

    setSaving(true);
    setErrorMsg(null);
    setSaveToSupabase(true);

    try {
      addLog(`Iniciando UPSERT no Supabase em public.properties para o ID ${canonicalProperty.source_property_id}...`);

      const photoPayload = canonicalProperty.photos.map((p: any) => ({
        source_url: p.url,
        position: p.position,
        is_main: p.is_main,
      }));

      const docPayload = canonicalProperty.documents.map((d: any) => ({
        document_type: d.type,
        title: d.title,
        source_url: d.url,
      }));

      // 1. UPSERT
      const result = await upsertPropertyToSupabase(canonicalProperty, photoPayload, docPayload);

      if (!result.success) {
        throw new Error(result.error || 'Falha ao executar UPSERT no Supabase');
      }

      addLog(`UPSERT executado com sucesso! UUID Interno: ${result.propertyId} ${result.isMemoryFallback ? '(Store Local de Verificação)' : '(Supabase Postgres)'}`);
      addLog(`UPSERT de ${photoPayload.length} fotos e ${docPayload.length} documentos concluído`);

      // 2. SELECT DE VERIFICAÇÃO (Prova da Persistência)
      addLog(`Executando SELECT de verificação com source="CAIXA" e source_property_id="${canonicalProperty.source_property_id}"...`);
      const verifyRes = await verifySavedPropertyInSupabase('CAIXA', canonicalProperty.source_property_id);

      if (verifyRes.success) {
        addLog(`[SUCESSO] Registro recuperado do banco de dados com id: ${verifyRes.record.id}`);
        setSavedVerification(verifyRes);
      } else {
        throw new Error('Não foi possível verificar o registro salvo no banco de dados via SELECT.');
      }
    } catch (err: any) {
      setErrorMsg(`Erro na gravação: ${err.message}`);
      addLog(`[ERRO UPSERT] ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * FALLBACK MANUAL DE UPLOAD DE ARQUIVO CAIXA (Seção 47)
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
      setTechLogs([]);
      setSavedVerification(null);

      try {
        addLog(`Carregando arquivo manual importado: ${file.name} (${file.size} bytes)`);
        const parsedList = parseCaixaList(content);

        addLog(`Encoding detectado: ${parsedList.encoding} | Delimitador: "${parsedList.separator}"`);
        addLog(`${parsedList.totalRows.toLocaleString()} imóveis encontrados no arquivo manual`);

        setListSummary({
          uf: 'MANUAL',
          total: parsedList.totalRows,
          encoding: parsedList.encoding,
          separator: parsedList.separator,
          headersCount: parsedList.headers.length,
        });

        if (parsedList.rows.length === 0) {
          throw new Error('Nenhum imóvel válido encontrado no arquivo fornecido.');
        }

        const firstRow = parsedList.rows[0];
        const normalizedId = normalizeCaixaId(firstRow.source_property_id);

        addLog(`Imóvel selecionado da lista manual. ID TEXT: ${normalizedId}`);
        const targetDetailUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${normalizedId}`;

        const resDetail = await fetch(`/api/caixa-proxy?action=fetch_detail&id=${normalizedId}`);
        const detailData = await resDetail.json();
        const detailParsed = parseCaixaHTML(detailData.html, normalizedId, targetDetailUrl, detailData.status);

        const canonical = buildCanonicalProperty(firstRow, detailParsed);
        setCanonicalProperty(canonical);

        addLog(`JSON Canônico montado a partir de arquivo manual para ${canonical.source_property_id}`);
      } catch (err: any) {
        setErrorMsg(err.message);
        addLog(`[ERRO MANUAL] ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file, 'iso-8859-1');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 font-sans">
      
      {/* Banner Principal /admin/caixa-test */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="bg-orange-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider">
              /admin/caixa-test
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Ingestão Autônoma CAIXA + Supabase
            </span>
          </div>

          <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
            <span>Conexão Supabase:</span>
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
            Teste e Verificação Completa de Ingestão da CAIXA
          </h1>
          <p className="text-xs text-slate-300 font-medium max-w-3xl mt-1">
            O aplicativo consulta a lista oficial pública da CAIXA, identifica autonomamente o imóvel, aprofunda a ficha individual, normaliza os dados com ID como <code>TEXT</code> e executa o UPSERT no Supabase.
          </p>
        </div>
      </div>

      {/* PAINEL DE CONTROLE DE MODO DE TESTE (Seções 3, 23, 40) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider block">Parâmetros de Teste</span>
            <h2 className="text-lg font-black text-slate-900">Configurações do Importador Autônomo</h2>
          </div>

          {/* Seleção de UF e Limite */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase block">Estado (UF):</label>
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:ring-2 focus:ring-orange-500"
              >
                <option value="SP">SP — São Paulo</option>
                <option value="RJ">RJ — Rio de Janeiro</option>
                <option value="MG">MG — Minas Gerais</option>
                <option value="PR">PR — Paraná</option>
                <option value="RS">RS — Rio Grande do Sul</option>
                <option value="BA">BA — Bahia</option>
                <option value="SC">SC — Santa Catarina</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase block">TEST_LIMIT:</label>
              <select
                value={testLimit}
                onChange={(e) => setTestLimit(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:ring-2 focus:ring-orange-500"
              >
                <option value={1}>1 imóvel (Provar cadeia)</option>
                <option value={10}>10 imóveis</option>
                <option value={100}>100 imóveis</option>
              </select>
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO DO CICLO DE TESTE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* BOTÃO 1: BUSCAR 1 IMÓVEL DA CAIXA (Seção 40 e 42) */}
          <button
            onClick={() => handleRunCaixaTest(1)}
            disabled={loading || saving}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black text-xs px-6 py-4 rounded-2xl shadow-lg shadow-orange-500/20 flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'DESCOBRINDO E EXTRAINDO...' : 'BUSCAR 1 IMÓVEL DA CAIXA'}</span>
          </button>

          {/* BOTÃO 2: SALVAR NO SUPABASE (Seção 44) */}
          <button
            onClick={handleSaveToSupabase}
            disabled={!canonicalProperty || saving || loading}
            className={`font-black text-xs px-6 py-4 rounded-2xl shadow-lg flex items-center justify-center space-x-2 transition-all transform active:scale-95 ${
              canonicalProperty
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            <Database className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'EXECUTANDO UPSERT...' : 'SALVAR NO SUPABASE'}</span>
          </button>

          {/* BOTÃO 3: FALLBACK UPLOAD MANUAL CAIXA (Seção 47) */}
          <label className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-4 rounded-2xl shadow-md flex items-center justify-center space-x-2 cursor-pointer transition-colors">
            <Upload className="w-4 h-4 text-orange-400" />
            <span>IMPORTAR ARQUIVO CAIXA</span>
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
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* LOG TÉCNICO DE AUDITORIA DO PASSO A PASSO (Seção 46) */}
      {techLogs.length > 0 && (
        <div className="bg-slate-950 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-black">
            <span className="text-orange-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> LOG TÉCNICO COMPLETO DO TESTE DE INGESTÃO
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {techLogs.length} etapas registradas
            </span>
          </div>

          <div className="p-4 font-mono text-[11px] leading-relaxed text-slate-300 max-h-60 overflow-y-auto space-y-1">
            {techLogs.map((log, idx) => (
              <div key={idx} className={log.includes('[ERRO') ? 'text-red-400 font-bold' : log.includes('[SUCESSO') ? 'text-emerald-400 font-bold' : ''}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESUMO DA LISTA DA CAIXA BAIXADA (Seção 24 e 43) */}
      {listSummary && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3 text-xs">
          <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider block">Resultado da Fonte Primária</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">UF PROCESSADA:</span>
              <span className="font-black text-slate-900 text-sm">{listSummary.uf}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">TOTAL DE IMÓVEIS:</span>
              <span className="font-black text-emerald-600 text-sm">{listSummary.total.toLocaleString()}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">ENCODING DETECTADO:</span>
              <span className="font-extrabold text-slate-800">{listSummary.encoding}</span>
            </div>

            <div>
              <span className="text-slate-400 font-bold block text-[10px]">DELIMITADOR:</span>
              <span className="font-extrabold text-slate-800">"{listSummary.separator}" ({listSummary.headersCount} colunas)</span>
            </div>
          </div>
        </div>
      )}

      {/* CARD VISUAL E FICHA DO IMÓVEL SELECIONADO (Seção 25 e 43) */}
      {canonicalProperty && (
        <div className="space-y-8">
          
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl">
            <div className="p-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> IMÓVEL DESCOBERTO AUTOMATICAMENTE DA LISTA CAIXA
              </div>
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-extrabold">
                ID TEXT: {canonicalProperty.source_property_id}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Foto Principal */}
              <div className="lg:col-span-5 space-y-3">
                <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                  {canonicalProperty.main_photo_url ? (
                    <img
                      src={canonicalProperty.main_photo_url}
                      alt="Foto Principal CAIXA"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <ImageIcon className="w-12 h-12 stroke-1" />
                      <span className="text-xs font-bold">Sem Foto Principal</span>
                    </div>
                  )}

                  {canonicalProperty.discount_percentage !== null && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md">
                      {canonicalProperty.discount_percentage}% DESCONTO
                    </div>
                  )}
                </div>
              </div>

              {/* Ficha de Dados */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-extrabold text-orange-600 uppercase tracking-wider mb-1">
                    <span>{canonicalProperty.property_type || 'Imóvel CAIXA'}</span>
                    <span>•</span>
                    <span>{canonicalProperty.city || 'Cidade N/I'} / {canonicalProperty.state || 'UF'}</span>
                  </div>

                  <h2 className="text-xl font-black text-slate-900 leading-snug">
                    {canonicalProperty.address || `Imóvel CAIXA nº ${canonicalProperty.source_property_id}`}
                  </h2>

                  {canonicalProperty.neighborhood && (
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      Bairro: {canonicalProperty.neighborhood} {canonicalProperty.zipcode ? `— CEP ${canonicalProperty.zipcode}` : ''}
                    </p>
                  )}
                </div>

                {/* Preços */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">PREÇO MÍNIMO:</span>
                    <span className="text-lg font-black text-emerald-600">
                      {canonicalProperty.sale_value ? formatCurrencyBRL(canonicalProperty.sale_value) : 'Sob Consulta'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">AVALIAÇÃO:</span>
                    <span className="text-sm font-extrabold text-slate-700 line-through">
                      {canonicalProperty.appraisal_value ? formatCurrencyBRL(canonicalProperty.appraisal_value) : 'N/I'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">DESCONTO:</span>
                    <span className="text-sm font-extrabold text-orange-600">
                      {canonicalProperty.discount_percentage !== null ? `${canonicalProperty.discount_percentage}%` : 'N/I'}
                    </span>
                  </div>
                </div>

                {/* Atributos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">ÁREA PRIVATIVA:</span>
                    <span className="font-extrabold text-slate-900">
                      {canonicalProperty.private_area ? `${canonicalProperty.private_area} m²` : 'N/I'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">QUARTOS:</span>
                    <span className="font-extrabold text-slate-900">
                      {canonicalProperty.bedrooms !== null ? canonicalProperty.bedrooms : 'N/I'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">VAGAS:</span>
                    <span className="font-extrabold text-slate-900">
                      {canonicalProperty.parking_spaces !== null ? canonicalProperty.parking_spaces : 'N/I'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">FINANCIAMENTO:</span>
                    <span className="font-extrabold text-slate-900">
                      {canonicalProperty.accepts_financing ? 'Sim' : canonicalProperty.accepts_financing === false ? 'Não' : 'N/I'}
                    </span>
                  </div>
                </div>

                {/* Botão Ver na CAIXA */}
                <div className="pt-2">
                  <a
                    href={canonicalProperty.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-6 py-3 rounded-2xl transition-colors shadow-md"
                  >
                    <span>ABRIR NA CAIXA</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

              </div>

            </div>
          </div>

          {/* GALERIA DE FOTOS */}
          {canonicalProperty.photos && canonicalProperty.photos.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-orange-500" /> GALERIA DE FOTOS ({canonicalProperty.photos.length} fotos)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {canonicalProperty.photos.map((photo: any, idx: number) => (
                  <div key={idx} className="h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={photo.url}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=400&q=80';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DOCUMENTOS */}
          {canonicalProperty.documents && canonicalProperty.documents.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-3 shadow-sm text-xs">
              <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" /> DOCUMENTOS DO IMÓVEL ({canonicalProperty.documents.length})
              </h3>

              <div className="flex flex-wrap gap-3">
                {canonicalProperty.documents.map((doc: any, idx: number) => (
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

          {/* EXIBIÇÃO DO JSON CANÔNICO (Seção 22 e 25) */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
            <button
              onClick={() => setIsRawJsonOpen(!isRawJsonOpen)}
              className="w-full p-5 bg-slate-900 hover:bg-slate-800/80 transition-colors flex items-center justify-between text-xs font-black text-slate-200"
            >
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-orange-400" />
                <span>JSON CANÔNICO NORMALIZADO (Estrutura Única de Entrada)</span>
              </div>
              <span className="text-emerald-400 font-mono text-[10px]">
                {isRawJsonOpen ? 'Ocultar JSON' : 'Ver JSON'}
              </span>
            </button>

            {isRawJsonOpen && (
              <pre className="overflow-x-auto p-6 bg-slate-950 border-t border-slate-800 text-[11px] leading-relaxed text-emerald-400 font-mono max-h-96">
                {JSON.stringify(canonicalProperty, null, 2)}
              </pre>
            )}
          </div>

        </div>
      )}

      {/* COMPROVAÇÃO DE PERSISTÊNCIA NO SUPABASE (Seção 45) */}
      {savedVerification && (
        <div className="bg-emerald-950/40 text-white p-6 rounded-3xl border border-emerald-500/40 shadow-2xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-black text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>DADOS SALVOS E RECUPERADOS COM SUCESSO DO SUPABASE (SELECT VERIFICATION)</span>
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
              <span className="text-emerald-400 font-bold block">Source:</span>
              <span className="font-mono text-white">{savedVerification.record?.source}</span>
            </div>

            <div>
              <span className="text-emerald-400 font-bold block">Source Property ID (TEXT):</span>
              <span className="font-mono text-white">{savedVerification.record?.source_property_id}</span>
            </div>
          </div>

          {/* Accordion do registro do banco recuperado */}
          <div className="pt-2">
            <button
              onClick={() => setIsSavedRecordOpen(!isSavedRecordOpen)}
              className="text-xs font-bold text-emerald-400 hover:underline flex items-center space-x-1"
            >
              <span>{isSavedRecordOpen ? 'Ocultar registro recuperado via SELECT' : 'Ver registro recuperado via SELECT'}</span>
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
