import React, { useEffect, useState } from 'react';
import { ChevronDown, ShieldCheck, Sparkles } from 'lucide-react';

interface IntroSplashProps {
  onComplete: () => void;
  version?: string;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete, version = 'v1.2.0' }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animação de progresso de 3 segundos
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
    <div
      onClick={onComplete}
      className="fixed inset-0 z-50 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none font-sans overflow-hidden cursor-pointer"
    >
      
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] bg-orange-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:28px_28px] opacity-10" />
      </div>

      {/* Top Header Bar */}
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

      {/* Centerpiece: Imagem Flutuante do Logo & Slogan Gigante */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center my-auto space-y-8 max-w-xl mx-auto w-full">
        
        {/* LOGO FLUTUANTE (Efeito Levitação animate-float) */}
        <div className="relative animate-float">
          <div className="absolute -inset-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-3xl blur-xl opacity-50 animate-pulse" />
          <div className="relative bg-white p-5 sm:p-7 rounded-3xl shadow-2xl border-4 border-white/90">
            <img
              src="/logo/logo.jpeg"
              alt="G2 AUCTION"
              className="w-52 sm:w-72 h-auto object-contain"
            />
          </div>
        </div>

        {/* Slogan Oficial em Destaque Mobile-First */}
        <div className="space-y-3 px-2">
          <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-orange-400 flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Posicionamento Estratégico
          </p>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight sm:leading-snug">
            "O passo a passo para arrematar seu imóvel"
          </h1>
        </div>

      </div>

      {/* Seta Discreta Animada no Rodapé para Seguir */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-3 max-w-md mx-auto w-full">
        
        {/* Barra de Progresso Discreta */}
        <div className="w-48 bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700">
          <div
            className="bg-gradient-to-r from-orange-500 to-emerald-400 h-full rounded-full transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Seta Discreta para Prosseguir */}
        <div className="flex flex-col items-center text-slate-400 hover:text-white transition-colors group">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 group-hover:text-orange-400">
            Toque para Acessar
          </span>
          <ChevronDown className="w-6 h-6 text-orange-500 animate-bounce mt-0.5" />
        </div>

      </div>

    </div>
  );
};
