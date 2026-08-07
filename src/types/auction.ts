export type AcquisitionType = 'Leilão Judicial' | 'Leilão Extrajudicial' | 'Venda Direta Banco' | 'REO';
export type OccupancyStatus = 'Ocupado' | 'Desocupado' | 'Em Desocupação' | 'Desconhecido';
export type ProvenanceType = 'CONFIRMADO' | 'DADO OFICIAL' | 'ESTIMATIVA IA' | 'DADO DE MERCADO' | 'REQUER VALIDAÇÃO';
export type LifecycleStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // 1: Cadastro, 2: Escolha, 3: Edital, 4: Habilitação, 5: Lance, 6: Arrematação, 7: Posse/Reforma, 8: Venda/Locação

export interface ComparableProperty {
  id: string;
  title: string;
  area: number;
  price: number;
  pricePerM2: number;
  distanceMeters: number;
  bedrooms: number;
  source: string;
  listingUrl?: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  date: string;
  verificationStatus: 'CONFIRMED' | 'UNVERIFIED' | 'USER_REPORT';
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface Property {
  id: string;
  code: string;
  title: string;
  description: string;
  category: 'Apartamento' | 'Casa' | 'Terreno' | 'Comercial' | 'Galpão';
  acquisitionType: AcquisitionType;
  occupancyStatus: OccupancyStatus;
  
  // Endereço e Geolocalização
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  };

  // Valores do Leilão
  appraisalValue: number; // Valor de avaliação oficial
  firstAuctionPrice: number;
  firstAuctionDate: string;
  secondAuctionPrice: number; // Mínimo no 2º leilão
  secondAuctionDate: string;
  currentBid?: number;
  
  // Características Físicas
  area: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floor?: number;
  
  // Leiloeiro e Antifraude
  auctioneerName: string;
  auctioneerSite: string;
  isAuctioneerVerified: boolean;
  bankName?: string;
  processNumber?: string;
  courtName?: string;
  
  // Passivos e Débitos
  debts: {
    iptu: number;
    condominium: number;
    legalDebts: number;
    utilityDebts: number;
    isBuyerResponsible: boolean;
  };
  
  // Inteligência de Mercado e Preço/m²
  estimatedMarketPrice: number;
  askingPricePerM2Range: [number, number];
  estimatedMarketPricePerM2: number;
  acquisitionPricePerM2: number;
  apparentDiscountPercentage: number;
  
  // Scores
  opportunityScore: number;
  riskScore: number;
  liquidityScore: number;
  locationScore: number;
  legalComplexityScore: number;
  renovationEstimate: number;
  
  // Inteligência Geográfica e de Entorno
  safetyIndex: {
    level: 'Baixo Risco' | 'Risco Moderado' | 'Atenção Estatística';
    score: number; // 0 a 10
    recentIncidentsCount: number;
    summary: string;
    provenance: ProvenanceType;
  };
  floodRisk: {
    level: 'Mínimo' | 'Moderado' | 'Elevado';
    distanceToRiskZoneMeters: number;
    summary: string;
  };
  noiseIndex: {
    level: 'Silencioso' | 'Moderado' | 'Intenso (Vida Noturna/Vias)';
    sources: string[];
    summary: string;
  };
  urbanAmenities: {
    walkabilityScore: number;
    schoolsNearby: number;
    hospitalsNearby: number;
    supermarketsNearby: number;
    publicTransportNearby: number;
  };
  
  // Notícias e Comparáveis
  newsIntelligence: NewsItem[];
  comparables: ComparableProperty[];
  
  // Mídia e Documentos
  images: string[];
  editalUrl: string;
  matriculaUrl: string;
  
  // Estágio no Funil
  lifecycleStep: LifecycleStep;
  
  // Financiabilidade
  isFinancable: boolean;
  minDownPaymentPercentage: number;
}

export interface LedgerEntry {
  id: string;
  propertyId: string;
  category: 'Arrematação' | 'Comissão Leiloeiro' | 'ITBI' | 'Escritura & Cartório' | 'Honorários Advocatícios' | 'Mão de Obra Reforma' | 'Materiais Reforma' | 'Desocupação' | 'IPTU / Condomínio' | 'Outros';
  amount: number;
  date: string;
  supplier: string;
  description: string;
  provenance: 'VOICE_REGISTERED' | 'DOCUMENT_EXTRACTED' | 'MANUAL';
  invoiceUrl?: string;
}

export interface Partner {
  id: string;
  name: string;
  role: 'Advogado Especialista' | 'Despachante Imobiliário' | 'Mestre de Obras / Empreiteiro' | 'Pedreiro' | 'Corretor de Imóveis' | 'Leiloeiro Homologado' | 'Engenheiro Civil';
  city: string;
  state: string;
  rating: number;
  completedJobsCount: number;
  onTimeRate: number;
  trustScore: number; // 0-100
  phone: string;
  avatar: string;
  specialty: string;
}

export interface InvestmentScenario {
  name: 'Pessimista' | 'Base' | 'Otimista';
  salePrice: number;
  renovationCost: number;
  holdingTimeMonths: number;
  netProfit: number;
  roi: number;
  irrAnnual: number;
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'Investidor Iniciante' | 'Flipper Profissional' | 'Family Office' | 'Operador G2';
  totalCapital: number;
  allocatedCapital: number;
  activeInvestmentsCount: number;
  targetRoi: number;
  targetIrr: number;
}
