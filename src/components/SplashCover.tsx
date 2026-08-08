import React from 'react';
import { Gavel, Building, Users, ArrowRight, ShieldCheck, Wallet, Wrench } from 'lucide-react';

interface SplashCoverProps {
  onSelectOption: (option: 'arrematar' | 'imoveis' | 'parceiros' | 'ledger' | 'renovation') => void;
}

export const SplashCover: React.FC<SplashCoverProps> = ({ onSelectOption }) => {

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* Background Glow Spheres & Subtle Hexagonal Grid (Fundo Clean & Elegante) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-orange-600/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-slate-800/40 rounded-full blur-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:36px_36px] opacity-10" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 p-6 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center space-x-3">
          <span className="bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-black px-3.5 py-1.5 rounded-full backdrop-blur-md">
            G2 AUCTION
          </span>
          <span className="text-xs text-slate-400 font-bold hidden sm:inline">
            O passo a passo para arrematar seu imóvel
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Plataforma AI-First
          </span>
        </div>
      </header>

      {/* Main Orbital Hero Section - Logotipo Protagonista no Centro */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-4 py-2 flex-1 flex flex-col items-center justify-center text-center my-auto">
        
        {/* Orbital System Container */}
        <div className="relative w-full max-w-3xl h-[480px] sm:h-[540px] flex items-center justify-center">
          
          {/* Orbital Glowing Rings */}
          <div className="absolute w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] rounded-full border border-orange-500/20 animate-[spin_60s_linear_infinite]" />
          <div className="absolute w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] rounded-full border border-slate-700/60 stroke-dasharray" />

          {/* CENTRAL PROTAGONIST LOGO */}
          <div className="relative z-20 flex flex-col items-center justify-center p-4">
            <div className="relative group cursor-pointer" onClick={() => onSelectOption('imoveis')}>
              <div className="absolute -inset-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-3xl blur-xl opacity-40 group-hover:opacity-75 transition duration-500" />
              
              <div className="relative bg-white p-5 sm:p-7 rounded-3xl shadow-2xl border-4 border-white/80 transition-transform duration-300 transform group-hover:scale-105">
                <img
                  src="/logo/logo.jpeg"
                  alt="G2 AUCTION - Logotipo Oficial"
                  className="w-48 sm:w-64 h-auto object-contain"
                />
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm font-black tracking-widest text-slate-300 uppercase">
              O passo a passo para arrematar seu imóvel
            </p>
          </div>

          {/* ORBITAL NODE 1: ARREMATAR (Top Left / 10 o'clock) */}
          <div
            onClick={() => onSelectOption('arrematar')}
            className="absolute top-2 sm:top-6 left-2 sm:left-12 z-30 group cursor-pointer"
          >
            <div className="bg-slate-900/90 hover:bg-slate-800 border-2 border-orange-500/40 hover:border-orange-500 p-4 sm:p-5 rounded-2xl backdrop-blur-xl shadow-2xl transition-all duration-300 flex items-center space-x-3 transform hover:scale-110 hover:-translate-y-1 max-w-[220px] sm:max-w-[260px]">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-black shadow-md flex-shrink-0">
                <Gavel className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-[9px] font-black uppercase text-orange-400 block tracking-wider">Motor de IA</span>
                <h3 className="text-base font-black text-white group-hover:text-orange-400 transition-colors">Arrematar</h3>
                <p className="text-[10px] text-slate-400 font-medium leading-tight">Lance Máximo & Edital</p>
              </div>
            </div>
          </div>

          {/* ORBITAL NODE 2: IMÓVEIS DISPONÍVEIS (Top Right / 2 o'clock) */}
          <div
            onClick={() => onSelectOption('imoveis')}
            className="absolute top-2 sm:top-6 right-2 sm:right-12 z-30 group cursor-pointer"
          >
            <div className="bg-slate-900/90 hover:bg-slate-800 border-2 border-sky-500/40 hover:border-sky-500 p-4 sm:p-5 rounded-2xl backdrop-blur-xl shadow-2xl transition-all duration-300 flex items-center space-x-3 transform hover:scale-110 hover:-translate-y-1 max-w-[220px] sm:max-w-[260px]">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-black shadow-md flex-shrink-0">
                <Building className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-[9px] font-black uppercase text-sky-400 block tracking-wider">Geointeligência</span>
                <h3 className="text-base font-black text-white group-hover:text-sky-400 transition-colors">Imóveis Disponíveis</h3>
                <p className="text-[10px] text-slate-400 font-medium leading-tight">Deságio até 50% & Mapa</p>
              </div>
            </div>
          </div>

          {/* ORBITAL NODE 3: PARCEIROS (Bottom / 6 o'clock) */}
          <div
            onClick={() => onSelectOption('parceiros')}
            className="absolute bottom-0 sm:bottom-4 z-30 group cursor-pointer"
          >
            <div className="bg-slate-900/90 hover:bg-slate-800 border-2 border-purple-500/40 hover:border-purple-500 p-4 sm:p-5 rounded-2xl backdrop-blur-xl shadow-2xl transition-all duration-300 flex items-center space-x-3 transform hover:scale-110 hover:translate-y-1 max-w-[240px] sm:max-w-[280px]">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-md flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-[9px] font-black uppercase text-purple-400 block tracking-wider">Ecossistema</span>
                <h3 className="text-base font-black text-white group-hover:text-purple-400 transition-colors">Parceiros Credenciados</h3>
                <p className="text-[10px] text-slate-400 font-medium leading-tight">Advogados, Pedreiros & Cartório</p>
              </div>
            </div>
          </div>

          {/* SATELLITE NODE LEFT: LIVRO CAIXA */}
          <div
            onClick={() => onSelectOption('ledger')}
            className="hidden md:flex absolute bottom-16 left-4 z-20 items-center space-x-2 bg-slate-900/70 border border-slate-700 hover:border-emerald-500 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-emerald-400 cursor-pointer backdrop-blur-md transition-all hover:scale-105"
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Livro Caixa & Benchmark</span>
          </div>

          {/* SATELLITE NODE RIGHT: REFORMA */}
          <div
            onClick={() => onSelectOption('renovation')}
            className="hidden md:flex absolute bottom-16 right-4 z-20 items-center space-x-2 bg-slate-900/70 border border-slate-700 hover:border-amber-500 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-amber-400 cursor-pointer backdrop-blur-md transition-all hover:scale-105"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>Modo de Campo & Obra</span>
          </div>

        </div>

        {/* Action Prompt */}
        <div className="mt-4">
          <button
            onClick={() => onSelectOption('imoveis')}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-extrabold text-sm px-6 py-3 rounded-2xl shadow-xl shadow-orange-500/25 flex items-center space-x-2 transition-all transform active:scale-95 mx-auto"
          >
            <span>Entrar na Plataforma Completa G2</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 p-5 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/80 max-w-7xl w-full mx-auto text-xs text-slate-400 font-medium">
        <div className="flex items-center space-x-2">
          <span>G2 AUCTION © 2026</span>
          <span>•</span>
          <span>Conteúdo e Voz 100% em Português (pt-BR)</span>
        </div>

        <span className="text-slate-500 text-[11px] mt-1 sm:mt-0">
          Clique no logotipo central ou em qualquer opção para navegar
        </span>
      </footer>

    </div>
  );
};
