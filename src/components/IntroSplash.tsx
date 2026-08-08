import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

interface IntroSplashProps {
  onComplete: () => void;
  version?: string;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete, version = 'v1.2.0' }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animação de progresso suave de 3 segundos (3000ms)
    const startTime = Date.now();
    const duration = 3000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(currentProgress);

      if (elapsed >= duration) {
        clearInterval(interval);
        onComplete();
      }
    }, 30);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none font-sans overflow-hidden">
      
      {/* Background Subtle Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] bg-orange-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:28px_28px] opacity-10" />
      </div>

      {/* Top Header Tag */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-md mx-auto">
        <div className="flex items-center space-x-2">
          <span className="bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[11px] font-black px-3 py-1 rounded-full backdrop-blur-md">
            G2 AUCTION
          </span>
          <span className="bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-md">
            {version}
          </span>
        </div>

        <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3" /> Mobile-First
        </span>
      </div>

      {/* Centerpiece: Logotipo + Slogan Gigante em Destaque */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center my-auto space-y-8 max-w-xl mx-auto w-full">
        
        {/* Logotipo Oficial com Animação de Entrada */}
        <div className="relative animate-in fade-in zoom-in-90 duration-700">
          <div className="absolute -inset-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-3xl blur-lg opacity-40 animate-pulse" />
          <div className="relative bg-white p-4 sm:p-6 rounded-3xl shadow-2xl border-2 border-white/90">
            <img
              src="/logo/logo.jpeg"
              alt="G2 AUCTION"
              className="w-48 sm:w-64 h-auto object-contain"
            />
          </div>
        </div>

        {/* Slogan Oficial Ocupando Boa Parte da Tela */}
        <div className="space-y-4 px-2">
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-orange-400 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Posicionamento Estratégico
          </p>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight sm:leading-snug bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            "O passo a passo para arrematar seu imóvel"
          </h1>
        </div>

      </div>

      {/* Bottom Progress Bar de 3 Segundos & Botão de Pular */}
      <div className="relative z-10 w-full max-w-md mx-auto space-y-4">
        
        {/* Barra de Progresso de 3 Segundos */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            <span>Carregando Inteligência G2...</span>
            <span className="text-orange-400 font-black">{progress}%</span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden p-0.5 border border-slate-700">
            <div
              className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full transition-all duration-75 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Botão de Pular Animação */}
        <button
          onClick={onComplete}
          className="w-full py-2.5 text-xs font-bold text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
        >
          <span>Acessar Plataforma Agora</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

      </div>

    </div>
  );
};
