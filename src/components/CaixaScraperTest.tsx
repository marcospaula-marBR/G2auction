import React, { useState } from 'react';
import { Search, ExternalLink, ShieldCheck, ChevronDown, ChevronUp, Image as ImageIcon, Code2, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { parseCaixaHTML, type CaixaPropertyDebugJSON } from '../utils/caixaParser';
import { formatCurrencyBRL } from '../utils/financial';

export const CaixaScraperTest: React.FC = () => {
  const [caixaInput, setCaixaInput] = useState('1444411844663');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<CaixaPropertyDebugJSON | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(true);
  const [isRawHtmlOpen, setIsRawHtmlOpen] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const cleanId = caixaInput.replace(/\D/g, '');
    if (!cleanId) {
      setErrorMsg('Por favor informe um número de imóvel CAIXA válido.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    const targetUrl = `https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel=${cleanId}`;

    try {
      // Tenta consultar via API Server-side (Vite dev middleware ou Vercel API)
      let fetchRes = await fetch(`/api/caixa-proxy?id=${cleanId}`);
      let data: any = null;

      if (fetchRes.ok) {
        data = await fetchRes.json();
      } else {
        // Fallback CORS Proxy se o servidor proxy local não responder
        const fallbackProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        const fallbackRes = await fetch(fallbackProxyUrl);
        if (fallbackRes.ok) {
          const htmlText = await fallbackRes.text();
          data = {
            status: fallbackRes.status,
            targetUrl,
            html: htmlText,
          };
        } else {
          throw new Error(`HTTP Error ${fallbackRes.status}`);
        }
      }

      if (!data || !data.html) {
        throw new Error(`HTTP Status ${data?.status || 500}`);
      }

      if (data.status !== 200) {
        setErrorMsg(`Não foi possível consultar automaticamente este imóvel. Status HTTP ${data.status}`);
        setLoading(false);
        return;
      }

      // ETAPA 2 — EXTRAIR OS DADOS COM PARSER DETERMINÍSTICO
      const parsedResult = parseCaixaHTML(data.html, cleanId, targetUrl, data.status);
      setResult(parsedResult);

    } catch (err: any) {
      setErrorMsg(`Não foi possível consultar automaticamente este imóvel. (${err.message || 'Erro de conexão'})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 font-sans">
      
      {/* Banner de Identificação do Teste Isolado */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-2">
        <div className="flex items-center space-x-3">
          <span className="bg-orange-500 text-slate-950 font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider">
            Teste Isolado
          </span>
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Sem Persistência / Sem Banco
          </span>
        </div>
        
        <h1 className="text-2xl font-black text-white tracking-tight">
          Teste de Imóvel CAIXA (Consulta Server-Side & Parser Determinístico)
        </h1>
        <p className="text-xs text-slate-300 font-medium">
          Ferramenta isolada para validação de extração direta de dados, fotos e documentos do portal oficial da Caixa Econômica Federal.
        </p>
      </div>

      {/* INTERFACE DE BUSCA POR ID CAIXA */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                Número do imóvel CAIXA:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={caixaInput}
                  onChange={(e) => setCaixaInput(e.target.value)}
                  placeholder="Ex: 1444411844663 ou 144441184466-3"
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3.5 text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono tracking-wide"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black text-sm px-8 py-4 rounded-2xl shadow-lg shadow-orange-500/25 flex items-center justify-center space-x-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'CONSULTANDO CAIXA...' : 'BUSCAR IMÓVEL'}</span>
            </button>

          </div>

          <p className="text-xs text-slate-500 font-medium">
            💡 Aceita números formatados com hífen (ex: <code>144441184466-3</code>). Sanitização automática ativa.
          </p>
        </form>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-xs font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* SE O RESULTADO ESTIVER DISPONÍVEL */}
      {result && (
        <div className="space-y-8">
          
          {/* ETAPA 4 — RETORNAR JSON DE DEBUG */}
          <div className="bg-slate-900 text-slate-100 p-6 rounded-3xl border border-slate-800 space-y-3 font-mono text-xs shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-extrabold text-orange-400 flex items-center gap-2">
                <Code2 className="w-4 h-4" /> ETAPA 4 — JSON DE DEBUG BRUTO (DADOS EXTRAÍDOS)
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                success: true
              </span>
            </div>

            <pre className="overflow-x-auto p-4 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] leading-relaxed text-emerald-400 max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>

          {/* ETAPA 6 — CARD VISUAL DO IMÓVEL */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl space-y-0">
            <div className="p-4 bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> ETAPA 6 — VISUALIZAÇÃO DO IMÓVEL CAIXA
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Foto Principal (Etapa 3) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                  {result.main_photo_url ? (
                    <img
                      src={result.main_photo_url}
                      alt="Foto Principal do Imóvel CAIXA"
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

                  {result.property.discount_percentage !== null && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow-md">
                      {result.property.discount_percentage}% DESCONTO
                    </div>
                  )}
                </div>
              </div>

              {/* Ficha e Características do Imóvel */}
              <div className="lg:col-span-7 space-y-5">
                <div>
                  <div className="flex items-center space-x-2 text-xs font-extrabold text-orange-600 uppercase tracking-wider mb-1">
                    <span>{result.property.property_type || 'Imóvel CAIXA'}</span>
                    <span>•</span>
                    <span>{result.property.city || 'Cidade N/I'} / {result.property.state || 'UF'}</span>
                  </div>

                  <h2 className="text-xl font-black text-slate-900 leading-snug">
                    {result.property.address || `Imóvel CAIXA nº ${result.caixa_id}`}
                  </h2>

                  {result.property.neighborhood && (
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      Bairro: {result.property.neighborhood} {result.property.zipcode ? `— CEP ${result.property.zipcode}` : ''}
                    </p>
                  )}
                </div>

                {/* Preços e Avaliação */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">PREÇO CAIXA:</span>
                    <span className="text-lg font-black text-emerald-600">
                      {result.property.sale_value ? formatCurrencyBRL(result.property.sale_value) : 'Sob Consulta'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">AVALIAÇÃO:</span>
                    <span className="text-sm font-extrabold text-slate-700 line-through">
                      {result.property.appraisal_value ? formatCurrencyBRL(result.property.appraisal_value) : 'N/I'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block text-[10px]">DESCONTO:</span>
                    <span className="text-sm font-extrabold text-orange-600">
                      {result.property.discount_percentage !== null ? `${result.property.discount_percentage}%` : 'N/I'}
                    </span>
                  </div>
                </div>

                {/* Grid de Atributos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">ÁREA PRIVATIVA:</span>
                    <span className="font-extrabold text-slate-900">
                      {result.property.private_area ? `${result.property.private_area} m²` : 'Não informada'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">QUARTOS:</span>
                    <span className="font-extrabold text-slate-900">
                      {result.property.bedrooms !== null ? result.property.bedrooms : 'Não informado'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">VAGAS:</span>
                    <span className="font-extrabold text-slate-900">
                      {result.property.parking_spaces !== null ? result.property.parking_spaces : 'Não informado'}
                    </span>
                  </div>

                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 font-bold block text-[10px]">SITUAÇÃO:</span>
                    <span className="font-extrabold text-slate-900">
                      {result.property.occupied || 'Não informado'}
                    </span>
                  </div>
                </div>

                {/* Condições de Pagamento */}
                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                  <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-xl border border-slate-200">
                    Modalidade: <strong>{result.property.sale_modality || 'Venda Direta Caixa'}</strong>
                  </span>
                  <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-xl border border-slate-200">
                    Financiamento: <strong>{result.property.accepts_financing ? 'Sim' : result.property.accepts_financing === false ? 'Não' : 'Não informado'}</strong>
                  </span>
                  <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-xl border border-slate-200">
                    FGTS: <strong>{result.property.accepts_fgts ? 'Sim' : result.property.accepts_fgts === false ? 'Não' : 'Não informado'}</strong>
                  </span>
                </div>

                {/* Botão Ver Página Oficial */}
                <div className="pt-2">
                  <a
                    href={result.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-colors shadow-md"
                  >
                    <span>VER PÁGINA OFICIAL CAIXA</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

              </div>

            </div>
          </div>

          {/* ETAPA 7 — GALERIA DE FOTOS */}
          {result.photos && result.photos.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-orange-500" /> ETAPA 7 — GALERIA DE FOTOS DO IMÓVEL ({result.photos.length} adicionais)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {result.photos.map((photoUrl, idx) => (
                  <div key={idx} className="h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img
                      src={photoUrl}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=400&q=80';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ETAPA 8 — SEÇÃO DE DEBUG TÉCNICO RECOLHÍVEL */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <button
              onClick={() => setIsDebugOpen(!isDebugOpen)}
              className="w-full p-5 bg-slate-100 hover:bg-slate-200/80 transition-colors flex items-center justify-between text-xs font-black text-slate-800"
            >
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-orange-600" />
                <span>ETAPA 8 — DADOS TÉCNICOS / DEBUG</span>
              </div>
              {isDebugOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isDebugOpen && (
              <div className="p-6 space-y-4 text-xs font-mono border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-bold block">URL Consultada:</span>
                    <span className="text-slate-900 break-all">{result.source_url}</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-bold block">Status HTTP:</span>
                    <span className="text-emerald-600 font-black">{result.debug?.httpStatus || 200} OK</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-bold block">Tamanho do HTML Recebido:</span>
                    <span className="text-slate-900">{result.debug?.htmlLength || 0} bytes</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-bold block">Fotos Encontradas / Válidas:</span>
                    <span className="text-slate-900">{result.debug?.foundPhotosCount || 0} encontradas / {result.debug?.validPhotosCount || 0} válidas</span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-bold block">Campos Encontrados / Não Encontrados:</span>
                    <span className="text-slate-900">{result.debug?.foundFieldsCount || 0} encontrados / {result.debug?.missingFieldsCount || 0} nulos</span>
                  </div>
                </div>

                {/* Accordion HTML Bruto */}
                <div className="pt-2">
                  <button
                    onClick={() => setIsRawHtmlOpen(!isRawHtmlOpen)}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center space-x-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{isRawHtmlOpen ? 'Ocultar HTML bruto' : 'Ver HTML bruto'}</span>
                  </button>

                  {isRawHtmlOpen && (
                    <pre className="mt-3 p-4 bg-slate-950 text-slate-300 rounded-2xl overflow-x-auto text-[10px] leading-relaxed max-h-80 border border-slate-800">
                      {result.debug?.rawHtmlSnippet}
                    </pre>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
