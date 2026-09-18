import { useState, useMemo } from 'react';
import {
  X,
  Calculator,
  Home,
  TrendingDown,
  DollarSign,
  Calendar,
  Info,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

interface FinanciamentoCaixaModalProps {
  property: any;
  onClose: () => void;
}

// Taxas referenciais CAIXA (setembro 2026)
const TAXA_POUPANCA = 0.0695;    // 6.95% a.a. (SFH com poupança)
const TAXA_SFI      = 0.1199;    // 11.99% a.a. (SFI – acima do limite SFH)
const LIMITE_SFH    = 1_500_000; // Limite avaliação SFH

type Sistema = 'SAC' | 'PRICE';

function calcularFinanciamento(
  valorImovel: number,
  entradaVal: number,
  prazoMeses: number,
  taxaAnual: number,
  sistema: Sistema
) {
  const saldo = valorImovel - entradaVal;
  if (saldo <= 0 || prazoMeses <= 0) return null;

  const taxaMensal = Math.pow(1 + taxaAnual, 1 / 12) - 1;

  if (sistema === 'PRICE') {
    const coef = (taxaMensal * Math.pow(1 + taxaMensal, prazoMeses)) /
                 (Math.pow(1 + taxaMensal, prazoMeses) - 1);
    const parcela   = saldo * coef;
    const totalPago = parcela * prazoMeses;
    return { parcela1: parcela, parcelaUltima: parcela, totalPago, totalJuros: totalPago - saldo, saldoFinanciado: saldo };
  }

  // SAC
  const amortizacao   = saldo / prazoMeses;
  const jurosMes1     = saldo * taxaMensal;
  const parcela1      = amortizacao + jurosMes1;
  const jurosMesN     = amortizacao * taxaMensal;
  const parcelaUltima = amortizacao + jurosMesN;
  const totalJuros    = ((jurosMes1 + jurosMesN) / 2) * prazoMeses;
  const totalPago     = saldo + totalJuros;
  return { parcela1, parcelaUltima, totalPago, totalJuros, saldoFinanciado: saldo };
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtNumber(v: number): string {
  return Math.round(v).toLocaleString('pt-BR');
}

function fmtPctNumber(v: number): string {
  if (Math.abs(v - Math.round(v)) < 0.05) {
    return String(Math.round(v));
  }
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Converte entradas livres de usuário em número válido de moeda:
 * Exemplos aceitos: "40000", "40.000", "40.000,00", "40k", "40 mil", "R$ 40.000"
 */
function parseCurrencyInput(raw: string): number {
  if (!raw) return NaN;
  let s = raw.trim().toLowerCase().replace(/^r\$\s*/, '').trim();
  let multiplier = 1;

  if (s.endsWith('k')) {
    multiplier = 1000;
    s = s.slice(0, -1).trim();
  } else if (s.includes('mil')) {
    multiplier = 1000;
    s = s.replace('mil', '').trim();
  }

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // 40.000,00 -> pontos são milhares, vírgula é decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // 40,000.00
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, '');
    }
  }

  const clean = s.replace(/[^\d.]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? NaN : val * multiplier;
}

function parsePctInput(raw: string): number {
  if (!raw) return NaN;
  const s = raw.trim().replace('%', '').replace(',', '.').replace(/[^\d.]/g, '');
  const val = parseFloat(s);
  return isNaN(val) ? NaN : val;
}

// ── Modal principal ────────────────────────────────────────────────────────────
export function FinanciamentoCaixaModal({ property, onClose }: FinanciamentoCaixaModalProps) {
  const valorImovel =
    property?.secondAuctionPrice ||
    property?.current_minimum_value ||
    property?.sale_value ||
    property?.preco_minimo ||
    property?.price ||
    300_000;

  const avaliacaoImovel =
    property?.appraisalValue ||
    property?.evaluation_value ||
    property?.preco_avaliacao ||
    valorImovel * 1.5;

  // Se o imóvel aceita financiamento do lance, entrada mínima é 5% (regra CEF leilões)
  const aceitaFinanciamento = property?.isFinancable ?? property?.accepts_financing ?? false;
  const isSFH               = avaliacaoImovel <= LIMITE_SFH;
  const entradaPctMin       = aceitaFinanciamento ? 5 : (isSFH ? 20 : 30);
  const prazoMax            = isSFH ? 35 : 30;

  // Estado da Entrada: o valor em R$ é a fonte de verdade para evitar arredondamento forçado
  const entradaMinReais = Math.round(valorImovel * (entradaPctMin / 100));
  const [entradaVal, setEntradaVal] = useState<number>(() => entradaMinReais);

  // Estados locais para digitação livre e sem travamento nos inputs de Entrada
  const [reaisStr, setReaisStr]         = useState('');
  const [reaisFocused, setReaisFocused] = useState(false);
  const [pctStr, setPctStr]             = useState('');
  const [pctFocused, setPctFocused]     = useState(false);

  // Estados de Prazo
  const [prazoAnos, setPrazoAnos]         = useState(30);
  const [anosStr, setAnosStr]             = useState('');
  const [anosFocused, setAnosFocused]     = useState(false);
  const [mesesStr, setMesesStr]           = useState('');
  const [mesesFocused, setMesesFocused]   = useState(false);

  // Outros estados
  const [sistema, setSistema]   = useState<Sistema>('SAC');
  const [useFGTS, setUseFGTS]   = useState(false);
  const [fgtsVal, setFgtsVal]   = useState(50_000);
  const [fgtsStr, setFgtsStr]   = useState('');
  const [fgtsFocused, setFgtsFocused] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const taxaAnual  = avaliacaoImovel > LIMITE_SFH ? TAXA_SFI : TAXA_POUPANCA;
  const prazoMeses = Math.min(prazoAnos * 12, isSFH ? 420 : 360);

  // Percentual exato derivado do valor da entrada (mantém casas decimais se necessário)
  const entradaPct = valorImovel > 0 ? (entradaVal / valorImovel) * 100 : entradaPctMin;
  const entradaOk  = entradaVal >= entradaMinReais - 1;

  const fgtsAplicado   = useFGTS && isSFH ? Math.min(fgtsVal, entradaVal * 0.8) : 0;
  const entradaEfetiva = Math.max(entradaVal - fgtsAplicado, 0);

  const resultado = useMemo(
    () => calcularFinanciamento(valorImovel, entradaVal, prazoMeses, taxaAnual, sistema),
    [valorImovel, entradaVal, prazoMeses, taxaAnual, sistema]
  );

  // Commit da entrada em R$ (preserva o valor exato digitado pelo usuário, e.g. R$ 40.000)
  const commitReais = () => {
    setReaisFocused(false);
    const parsed = parseCurrencyInput(reaisStr);
    if (!isNaN(parsed) && parsed > 0) {
      setEntradaVal(parsed);
    }
  };

  // Commit da entrada em % (converte para R$ sem perder a intenção)
  const commitPct = () => {
    setPctFocused(false);
    const parsed = parsePctInput(pctStr);
    if (!isNaN(parsed) && parsed > 0) {
      const clampedPct = Math.min(80, Math.max(1, parsed));
      setEntradaVal(Math.round(valorImovel * (clampedPct / 100)));
    }
  };

  // Commit de Prazo em Anos
  const commitAnos = () => {
    setAnosFocused(false);
    const a = parseInt(anosStr.replace(/\D/g, ''), 10);
    if (!isNaN(a) && a > 0) {
      setPrazoAnos(Math.min(prazoMax, Math.max(5, a)));
    }
  };

  // Commit de Prazo em Meses
  const commitMeses = () => {
    setMesesFocused(false);
    const m = parseInt(mesesStr.replace(/\D/g, ''), 10);
    if (!isNaN(m) && m > 0) {
      const clampedMeses = Math.min(prazoMax * 12, Math.max(60, m));
      setPrazoAnos(Math.round(clampedMeses / 12));
    }
  };

  // Commit de FGTS
  const commitFgts = () => {
    setFgtsFocused(false);
    const parsed = parseCurrencyInput(fgtsStr);
    if (!isNaN(parsed) && parsed >= 0) {
      setFgtsVal(Math.min(200_000, parsed));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-700 to-blue-500 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-base leading-tight">Simulador de Financiamento</h2>
              <p className="text-blue-100 text-[11px] font-medium">Parâmetros CAIXA Habitação · {isSFH ? 'SFH' : 'SFI'}</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Dados do imóvel ─────────────────────────────────────────────── */}
        <div className="mx-6 mt-5 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 min-w-[150px]">
            <Home className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Preço mínimo</p>
              <p className="text-blue-900 font-black text-sm">{fmt(valorImovel)}</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-blue-200" />
          <div className="flex items-center gap-2 min-w-[150px]">
            <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide">Avaliação</p>
              <p className="text-emerald-800 font-black text-sm">{fmt(avaliacaoImovel)}</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-8 bg-blue-200" />
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-orange-600 shrink-0" />
            <div>
              <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-wide">Taxa referencial</p>
              <p className="text-orange-800 font-black text-sm">{(taxaAnual * 100).toFixed(2)}% a.a.</p>
            </div>
          </div>
        </div>

        {/* Badge: financiamento do lance */}
        {aceitaFinanciamento && (
          <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Financiamento do lance liberado pela CAIXA — entrada mínima de <b>5% do valor de arrematação</b></span>
          </div>
        )}

        {/* Badge SFH/SFI */}
        <div className="mx-6 mt-3">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${isSFH ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {isSFH ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {isSFH
              ? 'SFH — Taxa poupança 6,95% a.a. · Prazo até 35 anos · Aceita FGTS'
              : 'SFI — Avaliação acima de R$ 1,5 mi · 11,99% a.a. · Sem FGTS · Prazo até 30 anos'}
          </div>
        </div>

        {/* ── Controles ────────────────────────────────────────────────────── */}
        <div className="px-6 mt-5 space-y-5">

          {/* Bloco 1: Entrada (R$ e % sincronizados com precisão decimal completa) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-800">Entrada do Financiamento</span>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                aceitaFinanciamento ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}>
                Mínimo: {entradaPctMin}% ({fmt(entradaMinReais)})
              </span>
            </div>

            {/* Inputs lado a lado: Valor R$ e Percentual % */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {/* Campo R$ */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Valor em Dinheiro (R$)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-black text-slate-400 pointer-events-none">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={reaisFocused ? reaisStr : fmtNumber(entradaVal)}
                    onFocus={(e) => {
                      setReaisFocused(true);
                      setReaisStr(String(entradaVal));
                      e.target.select();
                    }}
                    onChange={(e) => setReaisStr(e.target.value)}
                    onBlur={commitReais}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitReais();
                      if (e.key === 'Escape') setReaisFocused(false);
                    }}
                    placeholder="Ex: 40.000"
                    title="Digite o valor desejado em R$. Pressione Enter ou clique fora para aplicar."
                    className="w-full text-right text-sm font-black text-blue-900 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl py-2 pl-9 pr-3 outline-none transition-all shadow-xs"
                  />
                </div>
              </div>

              {/* Campo % */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Percentual (%)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pctFocused ? pctStr : fmtPctNumber(entradaPct)}
                    onFocus={(e) => {
                      setPctFocused(true);
                      setPctStr(Number(entradaPct.toFixed(1)).toString().replace('.', ','));
                      e.target.select();
                    }}
                    onChange={(e) => setPctStr(e.target.value)}
                    onBlur={commitPct}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitPct();
                      if (e.key === 'Escape') setPctFocused(false);
                    }}
                    placeholder="Ex: 23,4"
                    title="Digite a porcentagem desejada. Pressione Enter ou clique fora para aplicar."
                    className="w-full text-right text-sm font-black text-blue-900 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl py-2 pl-3 pr-8 outline-none transition-all shadow-xs"
                  />
                  <span className="absolute right-3 text-xs font-black text-slate-400 pointer-events-none">%</span>
                </div>
              </div>
            </div>

            {/* Slider de % */}
            <div className="pt-1">
              <input
                type="range"
                min={entradaPctMin}
                max={80}
                step={0.1}
                value={Math.min(80, Math.max(entradaPctMin, Number(entradaPct.toFixed(1))))}
                onChange={(e) => {
                  const p = parseFloat(e.target.value);
                  setEntradaVal(Math.round(valorImovel * (p / 100)));
                }}
                className="w-full h-2 accent-blue-600 cursor-pointer rounded-full"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{entradaPctMin}% ({fmt(entradaMinReais)})</span>
                <span className="font-bold text-blue-600">{fmtPctNumber(entradaPct)}% = {fmt(entradaVal)}</span>
                <span>80% ({fmt(Math.round(valorImovel * 0.8))})</span>
              </div>
            </div>

            {/* Alerta caso esteja abaixo do mínimo */}
            {!entradaOk && (
              <div className="mt-3 flex items-center justify-between text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                <span>⚠️ Entrada abaixo do mínimo exigido de {entradaPctMin}% ({fmt(entradaMinReais)})</span>
                <button
                  type="button"
                  onClick={() => setEntradaVal(entradaMinReais)}
                  className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold hover:bg-red-700 transition-colors shrink-0 ml-2"
                >
                  Ajustar para o mínimo
                </button>
              </div>
            )}
          </div>

          {/* Bloco 2: FGTS (SFH apenas) */}
          {isSFH && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useFGTS}
                  onChange={(e) => setUseFGTS(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
                />
                <div>
                  <span className="text-xs font-black text-emerald-900 block">Usar FGTS na entrada</span>
                  <span className="text-[10px] text-emerald-700">Permite abater até 80% do valor da entrada com saldo FGTS</span>
                </div>
              </label>

              {useFGTS && (
                <div className="mt-4 pt-3 border-t border-emerald-200/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                      Saldo FGTS Disponível
                    </label>
                    <span className="text-[11px] font-black text-emerald-700">
                      {fmt(fgtsVal)}
                    </span>
                  </div>

                  {/* Input manual FGTS */}
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-black text-emerald-500 pointer-events-none">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={fgtsFocused ? fgtsStr : fmtNumber(fgtsVal)}
                      onFocus={(e) => {
                        setFgtsFocused(true);
                        setFgtsStr(String(fgtsVal));
                        e.target.select();
                      }}
                      onChange={(e) => setFgtsStr(e.target.value)}
                      onBlur={commitFgts}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitFgts();
                        if (e.key === 'Escape') setFgtsFocused(false);
                      }}
                      placeholder="Ex: 50.000"
                      className="w-full text-right text-sm font-black text-emerald-900 bg-white border-2 border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl py-2 pl-9 pr-3 outline-none transition-all shadow-xs"
                    />
                  </div>

                  {/* Slider FGTS */}
                  <div>
                    <input
                      type="range"
                      min={1_000}
                      max={200_000}
                      step={1_000}
                      value={fgtsVal}
                      onChange={(e) => setFgtsVal(Number(e.target.value))}
                      className="w-full h-2 accent-emerald-600 cursor-pointer rounded-full"
                    />
                    <div className="flex justify-between text-[10px] text-emerald-600/80 mt-1">
                      <span>{fmt(1_000)}</span>
                      <span>{fmt(100_000)}</span>
                      <span>{fmt(200_000)}</span>
                    </div>
                  </div>

                  {/* Resumo do impacto do FGTS */}
                  <div className="bg-white/80 border border-emerald-200 rounded-xl p-2.5 text-[11px] space-y-1">
                    <div className="flex justify-between text-emerald-800">
                      <span>FGTS aplicado na entrada:</span>
                      <span className="font-black">{fmt(fgtsAplicado)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-900 font-bold">
                      <span>Entrada em recursos próprios:</span>
                      <span className="font-black text-emerald-700">{fmt(entradaEfetiva)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bloco 3: Prazo de Financiamento */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-black text-slate-800">Prazo de Financiamento</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800">
                Até {prazoMax} anos ({prazoMax * 12} meses)
              </span>
            </div>

            {/* Inputs lado a lado: Anos e Meses */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {/* Campo Anos */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Prazo em Anos
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={anosFocused ? anosStr : `${prazoAnos}`}
                    onFocus={(e) => {
                      setAnosFocused(true);
                      setAnosStr(String(prazoAnos));
                      e.target.select();
                    }}
                    onChange={(e) => setAnosStr(e.target.value)}
                    onBlur={commitAnos}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitAnos();
                      if (e.key === 'Escape') setAnosFocused(false);
                    }}
                    placeholder={`5 a ${prazoMax}`}
                    className="w-full text-right text-sm font-black text-blue-900 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl py-2 pl-3 pr-14 outline-none transition-all shadow-xs"
                  />
                  <span className="absolute right-3 text-xs font-black text-slate-400 pointer-events-none">anos</span>
                </div>
              </div>

              {/* Campo Meses */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Prazo em Meses
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={mesesFocused ? mesesStr : `${prazoMeses}`}
                    onFocus={(e) => {
                      setMesesFocused(true);
                      setMesesStr(String(prazoMeses));
                      e.target.select();
                    }}
                    onChange={(e) => setMesesStr(e.target.value)}
                    onBlur={commitMeses}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitMeses();
                      if (e.key === 'Escape') setMesesFocused(false);
                    }}
                    placeholder={`60 a ${prazoMax * 12}`}
                    className="w-full text-right text-sm font-black text-blue-900 bg-white border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl py-2 pl-3 pr-16 outline-none transition-all shadow-xs"
                  />
                  <span className="absolute right-3 text-xs font-black text-slate-400 pointer-events-none">meses</span>
                </div>
              </div>
            </div>

            {/* Slider de Anos */}
            <div className="pt-1">
              <input
                type="range"
                min={5}
                max={prazoMax}
                step={1}
                value={prazoAnos}
                onChange={(e) => {
                  const anos = parseInt(e.target.value, 10);
                  setPrazoAnos(anos);
                }}
                className="w-full h-2 accent-blue-600 cursor-pointer rounded-full"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>5 anos (60 meses)</span>
                <span className="font-bold text-blue-600">{prazoAnos} anos ({prazoMeses} meses)</span>
                <span>{prazoMax} anos ({prazoMax * 12} meses)</span>
              </div>
            </div>
          </div>

          {/* Bloco 4: Sistema de Amortização */}
          <div>
            <p className="text-xs font-black text-slate-700 mb-2">Sistema de Amortização</p>
            <div className="grid grid-cols-2 gap-2">
              {(['SAC', 'PRICE'] as Sistema[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSistema(s)}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all border ${
                    sistema === s
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {s === 'SAC' ? '📉 SAC (decrescentes)' : '📊 PRICE (fixas)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Resultado ────────────────────────────────────────────────────── */}
        {resultado && entradaOk ? (
          <div className="mx-6 mt-6 bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl p-5 text-white">
            <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest mb-3">Resultado da Simulação · {sistema}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-blue-200 text-[10px] font-semibold">1ª Parcela</p>
                <p className="text-white font-black text-xl">{fmt(resultado.parcela1)}</p>
              </div>
              {sistema === 'SAC' && (
                <div>
                  <p className="text-blue-200 text-[10px] font-semibold">Última Parcela</p>
                  <p className="text-white font-black text-xl">{fmt(resultado.parcelaUltima)}</p>
                </div>
              )}
              <div>
                <p className="text-blue-200 text-[10px] font-semibold">Saldo Financiado</p>
                <p className="text-white font-black text-lg">{fmt(resultado.saldoFinanciado)}</p>
              </div>
              <div>
                <p className="text-blue-200 text-[10px] font-semibold">Total de Juros</p>
                <p className="text-orange-300 font-black text-lg">{fmt(resultado.totalJuros)}</p>
              </div>
              <div className="col-span-2 border-t border-blue-500/40 pt-3">
                <p className="text-blue-200 text-[10px] font-semibold">Total Pago no Prazo</p>
                <p className="text-white font-black text-2xl">{fmt(resultado.totalPago)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Entrada Total', val: fmt(entradaVal), color: 'bg-blue-600/60' },
                {
                  label: useFGTS && isSFH ? 'FGTS Usado' : 'Financiado',
                  val: useFGTS && isSFH ? fmt(fgtsAplicado) : fmt(resultado.saldoFinanciado),
                  color: 'bg-emerald-600/60',
                },
                {
                  label: 'Custo Juros',
                  val: `${((resultado.totalJuros / resultado.saldoFinanciado) * 100).toFixed(0)}%`,
                  color: 'bg-orange-600/60',
                },
              ].map(({ label, val, color }) => (
                <div key={label} className={`${color} rounded-xl p-2 text-center`}>
                  <p className="text-[9px] text-white/70 font-semibold">{label}</p>
                  <p className="text-white font-black text-[11px]">{val}</p>
                </div>
              ))}
            </div>
          </div>
        ) : !entradaOk ? (
          <div className="mx-6 mt-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-700 text-xs font-bold">
              Entrada mínima para {isSFH ? 'SFH' : 'SFI'}: {entradaPctMin}% · {fmt(entradaMinReais)}
            </p>
          </div>
        ) : null}

        {/* ── Info colapsável ──────────────────────────────────────────────── */}
        <div className="px-6 mt-4">
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className="w-full flex items-center justify-between text-[11px] text-slate-500 font-semibold py-2 border-t border-slate-100 cursor-pointer"
          >
            <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Taxas e regras utilizadas</span>
            {showInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showInfo && (
            <div className="text-[10px] text-slate-500 leading-relaxed pb-3 space-y-1">
              <p>• <b>SFH:</b> avaliação ≤ R$ 1,5 mi · Taxa poupança 6,95% a.a. · Prazo até 35 anos · Aceita FGTS</p>
              <p>• <b>SFI:</b> avaliação {'>'} R$ 1,5 mi · 11,99% a.a. · Prazo até 30 anos · Sem FGTS</p>
              <p>• <b>SAC:</b> amortização constante, parcelas decrescentes. <b>PRICE:</b> parcelas fixas.</p>
              <p>• Campos manuais com seleção rápida ao clicar: digite qualquer valor ou use atalhos como "40k" ou "40 mil".</p>
              <p>• Simulação meramente informativa. Valores sujeitos à análise de crédito da CAIXA.</p>
              <p>• Taxas referenciais vigentes. Consulte a CAIXA para condições oficiais personalizadas.</p>
            </div>
          )}
        </div>

        {/* ── Rodapé ───────────────────────────────────────────────────────── */}
        <div className="px-6 pb-6 pt-2 flex flex-wrap gap-3 justify-between items-center border-t border-slate-100 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
          <a
            href="https://simuladorhabitacao.caixa.gov.br/home"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-colors shadow-md"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Simulador Oficial CAIXA
          </a>
        </div>

      </div>
    </div>
  );
}
