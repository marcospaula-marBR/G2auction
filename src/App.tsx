import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AICopilot } from './components/AICopilot';
import { PropertyDiscovery } from './components/PropertyDiscovery';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { MaxBidCalculator } from './components/MaxBidCalculator';
import { InvestmentLedger } from './components/InvestmentLedger';
import { RenovationManager } from './components/RenovationManager';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import { PartnerNetwork } from './components/PartnerNetwork';
import { PortfolioDashboard } from './components/PortfolioDashboard';
import { PropertyReportModal } from './components/PropertyReportModal';
import { IntroSplash } from './components/IntroSplash';
import { PropertyCatalogPage } from './components/PropertyCatalogPage';
import { BancosAdminPage } from './components/BancosAdminPage';
import { JourneyPage } from './components/JourneyPage';

import { mockProperties } from './data/mockProperties';
import { mockParceiros } from './data/mockParceiros';
import type { Property, LedgerEntry, UserProfile } from './types/auction';
import { queryPropertiesFromSupabase, autoSeedDefaultCsvFromPublic } from './lib/supabaseClient';
import { adaptCatalogItemToProperty } from './utils/propertyAdapter';
import {
  Search, Wallet, Wrench, Users, PieChart, Layers, Bot,
  Building2, Route, Landmark,
} from 'lucide-react';

export function App() {
  const APP_VERSION = 'v3.5.4';
  const [properties, setProperties] = useState<Property[]>(mockProperties);
  const [selectedProperty, setSelectedProperty] = useState<Property | undefined>(mockProperties[0]);

  // Carrega a base real de imóveis do Supabase / IndexedDB / CSV para o Mapa e Descoberta
  useEffect(() => {
    async function loadRealPropertiesForMap() {
      try {
        await autoSeedDefaultCsvFromPublic();
        const res = await queryPropertiesFromSupabase({ pageSize: 1000, state: 'SP' });
        if (res && res.data && res.data.length > 0) {
          const adapted = res.data.map((p: any, idx: number) => adaptCatalogItemToProperty(p, idx));
          setProperties(adapted);
          setSelectedProperty(adapted[0]);
          console.log(`[G2 Map & Discovery] ${adapted.length} imóveis reais carregados para o Mapa e Descoberta.`);
        }
      } catch (err: any) {
        console.warn('[G2 Map Load]', err.message);
      }
    }
    loadRealPropertiesForMap();
  }, []);

  const [isIntroVisible, setIsIntroVisible] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<
    'imoveis' | 'discovery' | 'detail' | 'ledger' | 'renovation' | 'partners' | 'portfolio' | 'banco-admin' | 'jornada'
  >('imoveis');
  const [viewMode, setViewMode] = useState<'grid' | 'map' | 'split'>('split');
  const [activeMapLayer, setActiveMapLayer] = useState<'default' | 'price' | 'flood' | 'safety' | 'noise' | '3d'>('default');

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
    const newEntry: LedgerEntry = { ...entry, id: Date.now().toString() };
    setLedgerEntries(prev => [newEntry, ...prev]);
  };

  const handleRegisterVoiceExpense = (voiceText: string) => {
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

  type MainTab = typeof activeMainTab;

  const navItems: { id: MainTab; label: string; icon: React.ElementType; iconColor: string; highlight?: boolean }[] = [
    { id: 'imoveis', label: 'Imóveis CAIXA', icon: Building2, iconColor: 'text-orange-200' },
    { id: 'jornada', label: 'Minha Jornada 🗺️', icon: Route, iconColor: 'text-emerald-400', highlight: true },
    { id: 'discovery', label: 'Descoberta & Mapa', icon: Search, iconColor: 'text-orange-500' },
    { id: 'detail', label: 'Ficha 360°', icon: Layers, iconColor: 'text-sky-500' },
    { id: 'ledger', label: 'Livro Caixa', icon: Wallet, iconColor: 'text-emerald-500' },
    { id: 'renovation', label: 'Campo & Obra', icon: Wrench, iconColor: 'text-amber-500' },
    { id: 'partners', label: 'Parceiros', icon: Users, iconColor: 'text-purple-500' },
    { id: 'portfolio', label: 'Carteira', icon: PieChart, iconColor: 'text-red-500' },
    { id: 'banco-admin', label: 'Multi-Bancos 🏦', icon: Landmark, iconColor: 'text-orange-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-orange-500 selection:text-white">

      {/* Intro Splash */}
      {isIntroVisible && (
        <IntroSplash
          version={APP_VERSION}
          onComplete={() => setIsIntroVisible(false)}
        />
      )}

      {/* Header */}
      <Header
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenWhatsApp={() => setIsWhatsAppOpen(true)}
        onReplayIntro={() => setIsIntroVisible(true)}
        unreadNotifications={2}
        version={APP_VERSION}
      />

      {/* Navigation Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto scrollbar-none gap-2">
          <div className="flex items-center space-x-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeMainTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveMainTab(item.id);
                    if (item.id === 'detail' && selectedProperty) setIsDetailModalOpen(true);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 flex-shrink-0 ${
                    isActive
                      ? item.highlight
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                        : 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md'
                      : item.highlight
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white/80' : item.iconColor}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* View mode toggle (only on discovery tab) */}
          {activeMainTab === 'discovery' && (
            <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold flex-shrink-0">
              {(['grid', 'split', 'map'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg transition-all capitalize ${
                    viewMode === mode ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {mode === 'split' ? 'Mapa+Grid' : mode === 'map' ? 'Mapa' : 'Grid'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Catálogo CAIXA */}
        {activeMainTab === 'imoveis' && (
          <PropertyCatalogPage
            onOpenAdmin={() => setActiveMainTab('banco-admin')}
          />
        )}

        {/* Jornada do Arrematante */}
        {activeMainTab === 'jornada' && selectedProperty && (
          <JourneyPage
            property={selectedProperty}
            onOpenMaxBid={(p) => { setSelectedProperty(p); setIsMaxBidOpen(true); }}
          />
        )}
        {activeMainTab === 'jornada' && !selectedProperty && (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
            <Route className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-black text-slate-700 text-lg mb-1">Selecione um Imóvel</h3>
            <p className="text-sm text-slate-500">Acesse a aba "Imóveis CAIXA" e selecione um imóvel para iniciar sua jornada.</p>
            <button
              onClick={() => setActiveMainTab('imoveis')}
              className="mt-4 px-5 py-2.5 bg-orange-500 text-white font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors"
            >
              Ver Catálogo
            </button>
          </div>
        )}

        {/* Descoberta & Mapa com Filtros Unificados */}
        {activeMainTab === 'discovery' && (
          <PropertyDiscovery
            properties={properties}
            selectedProperty={selectedProperty}
            onSelectProperty={p => { setSelectedProperty(p); setIsDetailModalOpen(true); }}
            onOpenMaxBid={p => { setSelectedProperty(p); setIsMaxBidOpen(true); }}
            viewMode={viewMode}
            activeMapLayer={activeMapLayer}
            setActiveMapLayer={setActiveMapLayer}
          />
        )}

        {/* Ficha 360° */}
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

        {/* Livro Caixa */}
        {activeMainTab === 'ledger' && selectedProperty && (
          <InvestmentLedger
            property={selectedProperty}
            entries={ledgerEntries}
            onAddEntry={handleAddLedgerEntry}
            onOpenVoiceModal={() => setIsCopilotOpen(true)}
          />
        )}

        {/* Campo & Obra */}
        {activeMainTab === 'renovation' && selectedProperty && (
          <RenovationManager property={selectedProperty} />
        )}

        {/* Rede de Parceiros */}
        {activeMainTab === 'partners' && (
          <PartnerNetwork partners={mockParceiros} />
        )}

        {/* Portfólio */}
        {activeMainTab === 'portfolio' && (
          <PortfolioDashboard
            userProfile={userProfile}
            properties={properties}
            onSelectProperty={p => { setSelectedProperty(p); setIsDetailModalOpen(true); }}
          />
        )}

        {/* Multi-Bancos */}
        {activeMainTab === 'banco-admin' && (
          <BancosAdminPage onGoToCatalog={() => setActiveMainTab('imoveis')} />
        )}

      </main>

      {/* FAB Copilot */}
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
          onSelectProperty={p => { setSelectedProperty(p); setIsDetailModalOpen(true); }}
          onRegisterVoiceExpense={handleRegisterVoiceExpense}
        />
      )}

      {isWhatsAppOpen && (
        <WhatsAppSimulator
          isOpen={isWhatsAppOpen}
          onClose={() => setIsWhatsAppOpen(false)}
          properties={properties}
          onSelectProperty={p => { setSelectedProperty(p); setIsDetailModalOpen(true); }}
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
            <span>— Jornada Segura do Arrematante</span>
          </div>
          <p>© 2026 G2 AUCTION {APP_VERSION}. Plataforma de Leilões Imobiliários. Conteúdo 100% em Português (pt-BR).</p>
        </div>
      </footer>

    </div>
  );
}

export default App;
