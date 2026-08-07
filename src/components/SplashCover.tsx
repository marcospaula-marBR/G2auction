import React, { useState } from 'react';
import { Gavel, Users, Sparkles, ArrowRight, ShieldCheck, ChevronRight, Building } from 'lucide-react';

interface SplashCoverProps {
  onSelectOption: (option: 'arrematar' | 'imoveis' | 'parceiros') => void;
}

export const SplashCover: React.FC<SplashCoverProps> = ({ onSelectOption }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    // Normalizar de -1 a 1
    const x = (clientX / innerWidth - 0.5) * 2;
    const y = (clientY / innerHeight - 0.5) * 2;
    setMousePos({ x, y });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between overflow-hidden select-none font-sans"
    >
      {/* Dynamic 3D Glowing Particles & Hexagon Grid Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Glow Spheres */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 bg-orange-600/30 rounded-full blur-3xl transition-transform duration-700 ease-out"
          style={{
            transform: `translate(${mousePos.x * 40}px, ${mousePos.y * 40}px)`,
          }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-red-600/20 rounded-full blur-3xl transition-transform duration-700 ease-out"
          style={{
            transform: `translate(${mousePos.x * -50}px, ${mousePos.y * -50}px)`,
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-amber-500/10 rounded-full blur-3xl transition-transform duration-1000 ease-out"
          style={{
            transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px)`,
          }}
        />

        {/* Geometric Grid Lines */}
        <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:32px_32px] opacity-15" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 p-6 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center space-x-4">
          <img
            src="/logo/logo.jpeg"
            alt="G2 AUCTION"
            className="h-14 w-auto object-contain rounded-2xl bg-white p-2 shadow-xl shadow-orange-500/10"
          />
          <div>
            <p className="text-xs text-slate-300 font-bold tracking-wide">O passo a passo para arrematar seu imóvel</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-extrabold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Plataforma AI-First Homologada
          </span>
        </div>
      </header>

      {/* Central 3D Dynamic Content Section */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-6 py-4 flex flex-col items-center justify-center text-center space-y-10 my-auto">
        
        {/* Title & Tagline with 3D Parallax */}
        <div
          className="space-y-4 transition-transform duration-300 ease-out"
          style={{
            transform: `perspective(1000px) rotateX(${mousePos.y * -8}deg) rotateY(${mousePos.x * 8}deg)`,
          }}
        >
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40 px-4 py-1.5 rounded-full backdrop-blur-md">
            <Sparkles className="w-4 h-4 text-orange-400 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest text-orange-300">
              Sistema Operacional de Leilões Imobiliários
            </span>
          </div>

          <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight max-w-4xl">
            Sua jornada inteligente de <span className="bg-gradient-to-r from-orange-400 via-red-500 to-amber-400 bg-clip-text text-transparent">investimento imobiliário</span> começa aqui.
          </h2>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Selecione por onde deseja começar para que nossa inteligência artificial direcione sua experiência com métricas determinísticas e precisão de mercado.
          </p>
        </div>

        {/* 3D Interactive Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          
          {/* OPTION 1: ARREMATAR */}
          <div
            onClick={() => onSelectOption('arrematar')}
            style={{
              transform: `perspective(1000px) rotateX(${mousePos.y * -12}deg) rotateY(${mousePos.x * 12}deg) translateZ(20px)`,
            }}
            className="group relative bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-orange-500/30 hover:border-orange-500 p-8 rounded-3xl backdrop-blur-xl shadow-2xl transition-all duration-500 hover:shadow-orange-500/20 cursor-pointer flex flex-col justify-between text-left transform hover:-translate-y-2"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-bl-full group-hover:bg-orange-500/20 transition-all" />
            
            <div>
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/40 mb-6 group-hover:scale-110 transition-transform">
                <Gavel className="w-8 h-8" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 block mb-1">
                Motor Racional & IA
              </span>
              <h3 className="text-2xl font-black text-white group-hover:text-orange-400 transition-colors">
                Arrematar
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Calcule o Lance Máximo Racional com TIR e ROI determinísticos, analise editais automaticamente e execute arrematações com segurança antifraude.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between text-xs font-bold text-orange-400 group-hover:text-orange-300 pt-4 border-t border-slate-800">
              <span>Iniciar Análise de Lance</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </div>
          </div>

          {/* OPTION 2: IMÓVEIS DISPONÍVEIS */}
          <div
            onClick={() => onSelectOption('imoveis')}
            style={{
              transform: `perspective(1000px) rotateX(${mousePos.y * -12}deg) rotateY(${mousePos.x * 12}deg) translateZ(40px)`,
            }}
            className="group relative bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-sky-500/30 hover:border-sky-500 p-8 rounded-3xl backdrop-blur-xl shadow-2xl transition-all duration-500 hover:shadow-sky-500/20 cursor-pointer flex flex-col justify-between text-left transform hover:-translate-y-2"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-bl-full group-hover:bg-sky-500/20 transition-all" />
            
            <div>
              <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/40 mb-6 group-hover:scale-110 transition-transform">
                <Building className="w-8 h-8" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-sky-400 block mb-1">
                Descoberta Geointeligente
              </span>
              <h3 className="text-2xl font-black text-white group-hover:text-sky-400 transition-colors">
                Imóveis Disponíveis
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Explore oportunidades com deságio até 50%, preço/m² do entorno, mapa interativo de riscos e comparáveis reais em Campinas, SP e Santos.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between text-xs font-bold text-sky-400 group-hover:text-sky-300 pt-4 border-t border-slate-800">
              <span>Explorar Oportunidades</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </div>
          </div>

          {/* OPTION 3: PARCEIROS */}
          <div
            onClick={() => onSelectOption('parceiros')}
            style={{
              transform: `perspective(1000px) rotateX(${mousePos.y * -12}deg) rotateY(${mousePos.x * 12}deg) translateZ(20px)`,
            }}
            className="group relative bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-purple-500/30 hover:border-purple-500 p-8 rounded-3xl backdrop-blur-xl shadow-2xl transition-all duration-500 hover:shadow-purple-500/20 cursor-pointer flex flex-col justify-between text-left transform hover:-translate-y-2"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full group-hover:bg-purple-500/20 transition-all" />
            
            <div>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/40 mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8" />
              </div>

              <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block mb-1">
                Ecossistema Homologado
              </span>
              <h3 className="text-2xl font-black text-white group-hover:text-purple-400 transition-colors">
                Parceiros
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Conecte-se com advogados especialistas em imissão na posse, despachantes, empreiteiros e corretores auditados pelo Partner Trust Score.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between text-xs font-bold text-purple-400 group-hover:text-purple-300 pt-4 border-t border-slate-800">
              <span>Ver Rede de Especialistas</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </div>
          </div>

        </div>

      </main>

      {/* Footer Bottom Bar */}
      <footer className="relative z-10 p-6 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/80 max-w-7xl w-full mx-auto text-xs text-slate-400 font-medium">
        <div className="flex items-center space-x-2">
          <span>G2 AUCTION © 2026</span>
          <span>•</span>
          <span>Conteúdo e Voz 100% em Português (pt-BR)</span>
        </div>

        <button
          onClick={() => onSelectOption('imoveis')}
          className="mt-2 sm:mt-0 text-slate-300 hover:text-white font-bold flex items-center gap-1 transition-colors"
        >
          <span>Entrar Direto na Plataforma Completa</span>
          <ChevronRight className="w-4 h-4 text-orange-500" />
        </button>
      </footer>
    </div>
  );
};
