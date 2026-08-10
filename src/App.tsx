import { useState } from 'react';
import { Header } from './components/Header';
import { LifecycleTimeline } from './components/LifecycleTimeline';
import { AICopilot } from './components/AICopilot';
import { PropertyDiscovery } from './components/PropertyDiscovery';
import { PropertyMap } from './components/PropertyMap';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { MaxBidCalculator } from './components/MaxBidCalculator';
import { InvestmentLedger } from './components/InvestmentLedger';
import { RenovationManager } from './components/RenovationManager';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import { PartnerNetwork } from './components/PartnerNetwork';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { PropertyReportModal } from './components/PropertyReportModal';
import { IntroSplash } from './components/IntroSplash';
import { CaixaFeedAdminTestPage } from './components/CaixaFeedAdminTestPage';

import { mockProperties } from './data/mockProperties';
import { mockParceiros } from './data/mockParceiros';
import type { Property, LedgerEntry, UserProfile, LifecycleStep } from './types/auction';
import { Search, Wallet, Wrench, Users, PieChart, Layers, Bot, TestTube2 } from 'lucide-react';

export function App() {
  const APP_VERSION = 'v1.8.0';
  const [properties] = useState<Property[]>(mockProperties);
  const [selectedProperty, setSelectedProperty] = useState<Property | undefined>(mockProperties[0]);
  const [currentLifecycleStep, setCurrentLifecycleStep] = useState<LifecycleStep>(2);

  const [isIntroVisible, setIsIntroVisible] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<'discovery' | 'detail' | 'ledger' | 'renovation' | 'partners' | 'portfolio' | 'caixa-test'>('caixa-test');
  const [viewMode, setViewMode] = useState<'grid' | 'map' | 'split'>('split');
  const [activeMapLayer, setActiveMapLayer] = useState<'default' | 'price' | 'flood' | 'safety' | 'noise'>('default');

  // Modais
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMaxBidOpen, setIsMaxBidOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Livro Caixa
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([
    {
      id: 'l-1',
      propertyId: 'prop-1',
      category: 'Arrematação',
      amount: 446400,
      date: '2026-08-01',
      supplier: 'Caixa / Mega Leilões',
      description: 'Pagamento de arrematação do imóvel no Cambuí',
      provenance: 'DOCUMENT_EXTRACTED',
    },
    {
      id: 'l-2',
      propertyId: 'prop-1',
      category: 'Comissão Leiloeiro',
      amount: 22320,
      date: '2026-08-01',
      supplier: 'Mega Leilões Oficial',
      description: 'Comissão de 5% sobre arrematação',
      provenance: 'DOCUMENT_EXTRACTED',
    },
    {
      id: 'l-3',
      propertyId: 'prop-1',
      category: 'Mão de Obra Reforma',
      amount: 2300,
      date: '2026-08-05',
      supplier: 'Pedreiro Silva',
      description: 'Primeira etapa demolição e pintura',
      provenance: 'VOICE_REGISTERED',
    },
  ]);

  // Perfil do Usuário
  const [userProfile, setUserProfile] = useState<UserProfile>({
    id: 'usr-1',
    name: 'Roberto Miranda',
    role: 'Flipper Profissional',
    totalCapital: 2500000,
    allocatedCapital: 1240000,
    activeInvestmentsCount: 3,
    targetRoi: 30,
    targetIrr: 34.2,
  });

  const handleAddLedgerEntry = (entry: Omit<LedgerEntry, 'id'>) => {
    const newEntry: LedgerEntry = {
      ...entry,
      id: Date.now().toString(),
    };
    setLedgerEntries((prev) => [newEntry, ...prev]);
  };

  const handleRegisterVoiceExpense = (voiceText: string) => {
    // Processamento de voz simulado para adição automática no Livro Caixa
    handleAddLedgerEntry({
      propertyId: selectedProperty?.id || properties[0].id,
      category: 'Mão de Obra Reforma',
      amount: 2300,
      date: new Date().toISOString().split('T')[0],
      supplier: 'Pedreiro Lançado por Voz',
      description: `Lançamento por Voz: "${voiceText}"`,
      provenance: 'VOICE_REGISTERED',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      
      {/* Intro Splash Mobile-First (Logotipo Flutuante & Slogan) */}
      {isIntroVisible && (
        <IntroSplash
          version={APP_VERSION}
          onComplete={() => setIsIntroVisible(false)}
        />
      )}

      {/* Header com slogan oficial G2 AUCTION e Versionamento v1.2.0 */}
      <Header
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenWhatsApp={() => setIsWhatsAppOpen(true)}
        onReplayIntro={() => setIsIntroVisible(true)}
        unreadNotifications={2}
        version={APP_VERSION}
      />

      {/* Stepper Metáfora dos 6 Passos de Arrematação */}
      <LifecycleTimeline
        currentStep={currentLifecycleStep}
        onSelectStep={(step) => setCurrentLifecycleStep(step)}
      />

      {/* Main Navigation Sub-Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto scrollbar-none gap-2">
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveMainTab('discovery')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                activeMainTab === 'discovery'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Search className="w-4 h-4 text-orange-500" />
              <span>Descoberta & Mapa</span>
            </button>

            <button
              onClick={() => {
                setActiveMainTab('detail');
                if (selectedProperty) setIsDetailModalOpen(true);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                activeMainTab === 'detail'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4 text-sky-500" />
              <span>Ficha 360° do Imóvel</span>
            </button>

            <button
              onClick={() => setActiveMainTab('ledger')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                activeMainTab === 'ledger'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wallet className="w-4 h-4 text-emerald-500" />
              <span>Livro Caixa & Controladoria</span>
            </button>

            <button
              onClick={() => setActiveMainTab('renovation')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                activeMainTab === 'renovation'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-4 h-4 text-amber-500" />
              <span>Modo de Campo & Obra</span>
            </button>

            <button
              onClick={() => setActiveMainTab('partners')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                activeMainTab === 'partners'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4 text-purple-500" />
              <span>Rede de Parceiros</span>
            </button>

            <button
              onClick={() => setActiveMainTab('portfolio')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center space-x-2 ${
                activeMainTab === 'portfolio'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <PieChart className="w-4 h-4 text-red-500" />
              <span>Carteira & Aprendizado</span>
            </button>

            <button
              onClick={() => setActiveMainTab('caixa-test')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 ${
                activeMainTab === 'caixa-test'
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
              }`}
            >
              <TestTube2 className="w-4 h-4 text-orange-400" />
              <span>🧪 Teste Imóvel CAIXA</span>
            </button>
          </div>

          {/* Toggle de Modo de Visão no Mapa/Grid */}
          {activeMainTab === 'discovery' && (
            <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'split' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Dividido (Mapa+Grid)
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'map' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Mapa Tela Cheia
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Main Body View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* VISTA 1: DESCOBERTA & MAPA */}
        {activeMainTab === 'discovery' && (
          <div className="space-y-6">
            
            {/* Se visão dividida ou mapa apenas */}
            {(viewMode === 'split' || viewMode === 'map') && (
              <PropertyMap
                properties={properties}
                selectedProperty={selectedProperty}
                onSelectProperty={(p) => {
                  setSelectedProperty(p);
                  setIsDetailModalOpen(true);
                }}
                activeLayer={activeMapLayer}
                setActiveLayer={setActiveMapLayer}
              />
            )}

            {/* Se visão dividida ou grid apenas */}
            {(viewMode === 'split' || viewMode === 'grid') && (
              <PropertyDiscovery
                properties={properties}
                onSelectProperty={(p) => {
                  setSelectedProperty(p);
                  setIsDetailModalOpen(true);
                }}
                onOpenMaxBid={(p) => {
                  setSelectedProperty(p);
                  setIsMaxBidOpen(true);
                }}
              />
            )}

          </div>
        )}

        {/* VISTA 2: FICHA 360° DO IMÓVEL */}
        {activeMainTab === 'detail' && selectedProperty && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900">{selectedProperty.title}</h2>
                <p className="text-xs text-slate-500">{selectedProperty.address.street}, {selectedProperty.address.neighborhood} - {selectedProperty.address.city}</p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(true)}
                className="bg-orange-600 text-white font-bold text-xs px-4 py-2 rounded-xl"
              >
                Abrir Modal 360°
              </button>
            </div>
          </div>
        )}

        {/* VISTA 3: LIVRO CAIXA & CONTROLADORIA */}
        {activeMainTab === 'ledger' && selectedProperty && (
          <InvestmentLedger
            property={selectedProperty}
            entries={ledgerEntries}
            onAddEntry={handleAddLedgerEntry}
            onOpenVoiceModal={() => setIsCopilotOpen(true)}
          />
        )}

        {/* VISTA 4: MODO DE CAMPO & OBRA */}
        {activeMainTab === 'renovation' && selectedProperty && (
          <RenovationManager property={selectedProperty} />
        )}

        {/* VISTA 5: REDE DE PARCEIROS */}
        {activeMainTab === 'partners' && (
          <PartnerNetwork partners={mockParceiros} />
        )}

        {/* VISTA 6: PORTFÓLIO & APRENDIZADO */}
        {activeMainTab === 'portfolio' && (
          <PortfolioDashboard
            userProfile={userProfile}
            properties={properties}
            onSelectProperty={(p) => {
              setSelectedProperty(p);
              setIsDetailModalOpen(true);
            }}
          />
        )}

        {/* Teste do Feed Oficial CSV da CAIXA (/listaweb/Lista_imoveis_{UF}.csv) */}
        {activeMainTab === 'caixa-test' && (
          <CaixaFeedAdminTestPage />
        )}

      </main>

      {/* Floating Action Button Copilot IA */}
      <button
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-orange-500 to-red-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center space-x-2 border-2 border-white"
        title="Pergunte ao Copilot de IA por Voz"
      >
        <Bot className="w-6 h-6 animate-pulse" />
        <span className="hidden sm:inline font-bold text-xs">Pergunte ao G2</span>
      </button>

      {/* Modais Globais */}
      {isCopilotOpen && (
        <AICopilot
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          properties={properties}
          onSelectProperty={(p) => {
            setSelectedProperty(p);
            setIsDetailModalOpen(true);
          }}
          onRegisterVoiceExpense={handleRegisterVoiceExpense}
        />
      )}

      {isWhatsAppOpen && (
        <WhatsAppSimulator
          isOpen={isWhatsAppOpen}
          onClose={() => setIsWhatsAppOpen(false)}
          properties={properties}
          onSelectProperty={(p) => {
            setSelectedProperty(p);
            setIsDetailModalOpen(true);
          }}
        />
      )}

      {isDetailModalOpen && selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setIsDetailModalOpen(false)}
          onOpenMaxBid={() => setIsMaxBidOpen(true)}
          onOpenReport={() => setIsReportOpen(true)}
        />
      )}

      {isMaxBidOpen && selectedProperty && (
        <MaxBidCalculator
          property={selectedProperty}
          onClose={() => setIsMaxBidOpen(false)}
        />
      )}

      {isReportOpen && selectedProperty && (
        <PropertyReportModal
          property={selectedProperty}
          onClose={() => setIsReportOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 font-bold text-slate-800">
            <img src="/logo/logo.jpeg" alt="G2 AUCTION" className="h-8 w-auto object-contain" />
            <span>— O passo a passo para arrematar seu imóvel</span>
          </div>
          <p>© 2026 G2 AUCTION. Sistema Operacional de Leilões Imobiliários. Conteúdo 100% em Português (pt-BR).</p>
        </div>
      </footer>

    </div>
  );
}

export default App;
