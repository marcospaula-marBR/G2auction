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
const TAXA_POUPANCA = 0.0695;   // 6.95% a.a. (SFH com poupança)
const TAXA_SFI      = 0.1199;   // 11.99% a.a. (SFI – acima do limite SFH)
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
    const parcela = saldo * coef;
    const totalPago = parcela * prazoMeses;
    return {
      parcela1: parcela,
      parcelaUltima: parcela,
      totalPago,
      totalJuros: totalPago - saldo,
      saldoFinanciado: saldo,
    };
  }

  // SAC
  const amortizacao = saldo / prazoMeses;
  const jurosMes1   = saldo * taxaMensal;
  const parcela1    = amortizacao + jurosMes1;
  const jurosMesN   = amortizacao * taxaMensal;
  const parcelaUltima = amortizacao + jurosMesN;
  const totalJuros  = ((jurosMes1 + jurosMesN) / 2) * prazoMeses;
  const totalPago   = saldo + totalJuros;
  return {
    parcela1,
    parcelaUltima,
    totalPago,
    totalJuros,
    saldoFinanciado: saldo,
  };
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function FinanciamentoCaixaModal({ property, onClose }: FinanciamentoCaixaModalProps) {
  const valorImovel     = property?.secondAuctionPrice || property?.sale_value || property?.preco_minimo || 300_000;
  const avaliacaoImovel = property?.appraisalValue || property?.preco_avaliacao || valorImovel * 1.5;

  // Se o imóvel aceita financiamento do lance, entrada mínima é 5% (regra CEF leilões)
  const aceitaFinanciamento = property?.isFinancable ?? property?.accepts_financing ?? false;
  const isSFH               = avaliacaoImovel <= LIMITE_SFH;
  // Entrada mínima: 5% se financiamento liberado, senão 20% (SFH) ou 30% (SFI)
  const entradaPctMin       = aceitaFinanciamento ? 5 : (isSFH ? 20 : 30);

  const [entradaPct, setEntradaPct] = useState(() => entradaPctMin);
  const [prazoAnos, setPrazoAnos]   = useState(30);
  const [sistema, setSistema]       = useState<Sistema>('SAC');
  const [useFGTS, setUseFGTS]       = useState(false);
  const [fgtsVal, setFgtsVal]       = useState(50_000);
  const [showInfo, setShowInfo]     = useState(false);

  const taxaAnual  = avaliacaoImovel > LIMITE_SFH ? TAXA_SFI : TAXA_POUPANCA;
  const prazoMeses = Math.min(prazoAnos * 12, isSFH ? 420 : 360);

  const entradaVal     = useMemo(() => Math.round(valorImovel * (entradaPct / 100)), [valorImovel, entradaPct]);
  const fgtsAplicado   = useFGTS ? Math.min(fgtsVal, entradaVal * 0.8) : 0;
  const entradaEfetiva = Math.max(entradaVal - fgtsAplicado, 0);
  const entradaOk      = entradaPct >= entradaPctMin;

  const resultado = useMemo(
    () => calcularFinanciamento(valorImovel, entradaVal, prazoMeses, taxaAnual, sistema),
    [valorImovel, entradaVal, prazoMeses, taxaAnual, sistema]
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">

        {/* Header */}
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

        {/* Dados do imóvel */}
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

        {/* Badge financiamento do lance */}
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

        {/* Controles */}
        <div className="px-6 mt-5 space-y-5">

          {/* Entrada */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs font-black text-slate-700">Entrada</label>
              <span className={`text-xs font-black ${!entradaOk ? 'text-red-500' : 'text-blue-700'}`}>
                {entradaPct}% · {fmt(entradaVal)}
                {!entradaOk && <span className="ml-1">(mín. {entradaPctMin}%)</span>}
              </span>
            </div>
            <input type="range" min={entradaPctMin} max={80} value={entradaPct}
              onChange={(e) => setEntradaPct(Number(e.target.value))}
              className="w-full h-2 accent-blue-600 cursor-pointer" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>{entradaPctMin}%</span><span>80%</span>
            </div>
          </div>

          {/* FGTS */}
          {isSFH && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useFGTS} onChange={(e) => setUseFGTS(e.target.checked)}
                  className="accent-emerald-600 w-4 h-4" />
                <span className="text-xs font-black text-emerald-800">Usar FGTS na entrada</span>
              </label>
              {useFGTS && (
                <div className="mt-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-emerald-700 font-semibold">Saldo FGTS disponível</span>
                    <span className="text-[11px] font-black text-emerald-800">{fmt(fgtsVal)}</span>
                  </div>
                  <input type="range" min={1000} max={200_000} step={1000} value={fgtsVal}
                    onChange={(e) => setFgtsVal(Number(e.target.value))}
                    className="w-full h-2 accent-emerald-600 cursor-pointer" />
                  <p className="text-[10px] text-emerald-600 mt-1">
                    FGTS aplicado: {fmt(fgtsAplicado)} · Entrada em dinheiro: {fmt(entradaEfetiva)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Prazo */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-xs font-black text-slate-700">Prazo</label>
              <span className="text-xs font-black text-blue-700">
                <Calendar className="w-3 h-3 inline mr-1" />
                {prazoAnos} anos ({prazoMeses} meses)
              </span>
            </div>
            <input type="range" min={5} max={isSFH ? 35 : 30} value={prazoAnos}
              onChange={(e) => setPrazoAnos(Number(e.target.value))}
              className="w-full h-2 accent-blue-600 cursor-pointer" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>5 anos</span><span>{isSFH ? '35' : '30'} anos</span>
            </div>
          </div>

          {/* Sistema */}
          <div>
            <p className="text-xs font-black text-slate-700 mb-2">Sistema de Amortização</p>
            <div className="grid grid-cols-2 gap-2">
              {(['SAC', 'PRICE'] as Sistema[]).map((s) => (
                <button key={s} onClick={() => setSistema(s)}
                  className={`py-2.5 rounded-xl text-xs font-black transition-all border ${sistema === s ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                  {s === 'SAC' ? '📉 SAC (decrescentes)' : '📊 PRICE (fixas)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado */}
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
                { label: 'Entrada', val: fmt(entradaVal), color: 'bg-blue-600/60' },
                { label: useFGTS && isSFH ? 'FGTS' : 'Financiado', val: useFGTS && isSFH ? fmt(fgtsAplicado) : fmt(resultado.saldoFinanciado), color: 'bg-emerald-600/60' },
                { label: 'Custo total', val: `${((resultado.totalJuros / resultado.saldoFinanciado) * 100).toFixed(0)}% juros`, color: 'bg-orange-600/60' },
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
              Entrada mínima para {isSFH ? 'SFH' : 'SFI'}: {entradaPctMin}% · {fmt(valorImovel * entradaPctMin / 100)}
            </p>
          </div>
        ) : null}

        {/* Info colapsável */}
        <div className="px-6 mt-4">
          <button onClick={() => setShowInfo(!showInfo)}
            className="w-full flex items-center justify-between text-[11px] text-slate-500 font-semibold py-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Taxas e regras utilizadas</span>
            {showInfo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showInfo && (
            <div className="text-[10px] text-slate-500 leading-relaxed pb-3 space-y-1">
              <p>• <b>SFH:</b> avaliação ≤ R$ 1,5 mi · Taxa poupança 6,95% a.a. · Prazo até 35 anos · Aceita FGTS</p>
              <p>• <b>SFI:</b> avaliação {'>'} R$ 1,5 mi · 11,99% a.a. · Prazo até 30 anos · Sem FGTS</p>
              <p>• <b>SAC:</b> amortização constante, parcelas decrescentes. <b>PRICE:</b> parcelas fixas.</p>
              <p>• Simulação meramente informativa. Valores sujeitos à análise de crédito da CAIXA.</p>
              <p>• Taxas referenciais de setembro/2026. Consulte a CAIXA para condições oficiais.</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 pb-6 pt-2 flex flex-wrap gap-3 justify-between items-center border-t border-slate-100 mt-2">
          <button onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-xl">
            Fechar
          </button>
          <a href="https://www.caixa.gov.br/voce/habitacao/simulador-habitacional/Paginas/default.aspx"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
            Simulador Oficial CAIXA
          </a>
        </div>

      </div>
    </div>
  );
}
