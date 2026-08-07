import type { Property } from '../types/auction';

export const mockProperties: Property[] = [
  {
    id: 'prop-1',
    code: 'G2-CMP-8492',
    title: 'Apartamento 3 Dormitórios no Cambuí - leilão Extrajudicial Caixa',
    description: 'Excelente apartamento residencial localizado no bairro Cambuí em Campinas. Possui suíte, varanda gourmet, 2 vagas de garagem demarcadas e lazer completo no condomínio. Excelente oportunidade para arrematação com deságio de 38%.',
    category: 'Apartamento',
    acquisitionType: 'Leilão Extrajudicial',
    occupancyStatus: 'Ocupado',
    address: {
      street: 'Rua Maria Monteiro',
      number: '1240',
      neighborhood: 'Cambuí',
      city: 'Campinas',
      state: 'SP',
      zip: '13025-151',
      lat: -22.8984,
      lng: -47.0521,
    },
    appraisalValue: 720000,
    firstAuctionPrice: 720000,
    firstAuctionDate: '2026-08-18',
    secondAuctionPrice: 446400,
    secondAuctionDate: '2026-08-28',
    area: 98,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    floor: 7,
    auctioneerName: 'Mega Leilões (Homologado Juiz/Caixa)',
    auctioneerSite: 'https://www.megaleiloes.com.br',
    isAuctioneerVerified: true,
    bankName: 'Caixa Econômica Federal',
    processNumber: '1004839-42.2025.8.26.0114',
    debts: {
      iptu: 8400,
      condominium: 16200,
      legalDebts: 0,
      utilityDebts: 1200,
      isBuyerResponsible: false, // Caixa assume débitos anteriores no edital
    },
    estimatedMarketPrice: 720000,
    askingPricePerM2Range: [7100, 7800],
    estimatedMarketPricePerM2: 7346,
    acquisitionPricePerM2: 4555,
    apparentDiscountPercentage: 38.0,
    opportunityScore: 9.2,
    riskScore: 3.4,
    liquidityScore: 9.5,
    locationScore: 9.8,
    legalComplexityScore: 3.8,
    renovationEstimate: 45000,
    safetyIndex: {
      level: 'Baixo Risco',
      score: 9.1,
      recentIncidentsCount: 3,
      summary: 'Área nobre de Campinas com excelente monitoramento privado e baixa incidência de ocorrências de rua.',
      provenance: 'DADO OFICIAL'
    },
    floodRisk: {
      level: 'Mínimo',
      distanceToRiskZoneMeters: 1850,
      summary: 'Imóvel situado em topo de cota topográfica no Cambuí sem histórico de drenagem deficiente.'
    },
    noiseIndex: {
      level: 'Moderado',
      sources: ['Restaurantes executivos', 'Tráfego local moderado'],
      summary: 'Bairro gastronômico. Movimento social moderado até às 23h nos finais de semana.'
    },
    urbanAmenities: {
      walkabilityScore: 96,
      schoolsNearby: 8,
      hospitalsNearby: 3,
      supermarketsNearby: 5,
      publicTransportNearby: 12
    },
    newsIntelligence: [
      {
        id: 'news-1',
        headline: 'Prefeitura anuncia nova ciclofaixa e recapeamento na Rua Maria Monteiro',
        summary: 'Obras de infraestrutura viária e revitalização do bairro Cambuí devem aumentar valorização residencial.',
        source: 'Correio Popular de Campinas',
        date: '2026-07-20',
        verificationStatus: 'CONFIRMED',
        impact: 'POSITIVE'
      },
      {
        id: 'news-2',
        headline: 'Cambuí lidera ranking de liquidez para locação residencial de alto padrão',
        summary: 'Tempo médio de vacância para 3 dormitórios no bairro caiu para 24 dias.',
        source: 'Relatório Secovi-SP',
        date: '2026-06-15',
        verificationStatus: 'CONFIRMED',
        impact: 'POSITIVE'
      }
    ],
    comparables: [
      {
        id: 'comp-1',
        title: 'Apto 95m² Maria Monteiro reformado',
        area: 95,
        price: 740000,
        pricePerM2: 7789,
        distanceMeters: 120,
        bedrooms: 3,
        source: 'VivaReal'
      },
      {
        id: 'comp-2',
        title: 'Apto 100m² Rua Coronel Quirino',
        area: 100,
        price: 710000,
        pricePerM2: 7100,
        distanceMeters: 340,
        bedrooms: 3,
        source: 'ZapImóveis'
      },
      {
        id: 'comp-3',
        title: 'Apto 92m² Rua Sampainho',
        area: 92,
        price: 680000,
        pricePerM2: 7391,
        distanceMeters: 450,
        bedrooms: 3,
        source: 'Imovelweb'
      }
    ],
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'
    ],
    editalUrl: 'https://exemplo.g2auction.com.br/editais/edital-cambui-8492.pdf',
    matriculaUrl: 'https://exemplo.g2auction.com.br/matriculas/matricula-cambui-8492.pdf',
    lifecycleStep: 2,
    isFinancable: true,
    minDownPaymentPercentage: 20
  },

  {
    id: 'prop-2',
    code: 'G2-SPO-3910',
    title: 'Casa Residencial em Condomínio Fechado - Leilão Judicial 2ª Praça',
    description: 'Sobrado em condomínio fechado no Alto da Boa Vista, São Paulo. 4 suítes, piscina privativa, escritório e 4 vagas. Imóvel desocupado por liminar concedida na 4ª Vara Cível.',
    category: 'Casa',
    acquisitionType: 'Leilão Judicial',
    occupancyStatus: 'Desocupado',
    address: {
      street: 'Rua Alexandre Dumas',
      number: '450',
      neighborhood: 'Santo Amaro / Alto da Boa Vista',
      city: 'São Paulo',
      state: 'SP',
      zip: '04717-002',
      lat: -23.6331,
      lng: -46.7029,
    },
    appraisalValue: 1850000,
    firstAuctionPrice: 1850000,
    firstAuctionDate: '2026-08-10',
    secondAuctionPrice: 1110000,
    secondAuctionDate: '2026-08-22',
    area: 280,
    bedrooms: 4,
    bathrooms: 5,
    parkingSpaces: 4,
    auctioneerName: 'Zukerman Leilões',
    auctioneerSite: 'https://www.zukerman.com.br',
    isAuctioneerVerified: true,
    courtName: '4ª Vara Cível do Foro Regional de Santo Amaro',
    processNumber: '1084920-11.2024.8.26.0002',
    debts: {
      iptu: 14500,
      condominium: 38000,
      legalDebts: 12000,
      utilityDebts: 0,
      isBuyerResponsible: true, // Arrematante deve quitar sub-rogado no preço ou abater do lance
    },
    estimatedMarketPrice: 1900000,
    askingPricePerM2Range: [6500, 7200],
    estimatedMarketPricePerM2: 6785,
    acquisitionPricePerM2: 3964,
    apparentDiscountPercentage: 40.0,
    opportunityScore: 9.6,
    riskScore: 2.8,
    liquidityScore: 8.8,
    locationScore: 9.2,
    legalComplexityScore: 4.2,
    renovationEstimate: 85000,
    safetyIndex: {
      level: 'Baixo Risco',
      score: 9.5,
      recentIncidentsCount: 1,
      summary: 'Condomínio fechado com portaria blindada 24h e controle estrito de acesso.',
      provenance: 'DADO OFICIAL'
    },
    floodRisk: {
      level: 'Mínimo',
      distanceToRiskZoneMeters: 2400,
      summary: 'Terreno elevado e drenagem urbana subterrânea de alta capacidade.'
    },
    noiseIndex: {
      level: 'Silencioso',
      sources: ['Residencial isolado'],
      summary: 'Rua estritamente residencial com tráfego exclusivo de moradores.'
    },
    urbanAmenities: {
      walkabilityScore: 82,
      schoolsNearby: 6,
      hospitalsNearby: 4,
      supermarketsNearby: 3,
      publicTransportNearby: 9
    },
    newsIntelligence: [
      {
        id: 'news-3',
        headline: 'Expansão da Linha 17-Ouro do Metrô valoriza eixo Santo Amaro-Berrini',
        summary: 'Proximidade com a estação e eixos corporativos atrai famílias e executivos.',
        source: 'Folha de S.Paulo',
        date: '2026-07-02',
        verificationStatus: 'CONFIRMED',
        impact: 'POSITIVE'
      }
    ],
    comparables: [
      {
        id: 'comp-4',
        title: 'Casa 290m² Condomínio Alexandre Dumas',
        area: 290,
        price: 1950000,
        pricePerM2: 6724,
        distanceMeters: 50,
        bedrooms: 4,
        source: 'Lopes Imóveis'
      },
      {
        id: 'comp-5',
        title: 'Sobrado 260m² Alto da Boa Vista',
        area: 260,
        price: 1800000,
        pricePerM2: 6923,
        distanceMeters: 300,
        bedrooms: 4,
        source: 'Coelho da Fonseca'
      }
    ],
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80'
    ],
    editalUrl: 'https://exemplo.g2auction.com.br/editais/edital-santoamaro-3910.pdf',
    matriculaUrl: 'https://exemplo.g2auction.com.br/matriculas/matricula-santoamaro-3910.pdf',
    lifecycleStep: 3,
    isFinancable: true,
    minDownPaymentPercentage: 30
  },

  {
    id: 'prop-3',
    code: 'G2-SAN-1102',
    title: 'Apartamento Vista Mar no Gonzaga - Venda Direta Banco Santander',
    description: 'Apartamento frente ao mar no bairro Gonzaga em Santos. 2 dormitórios com dependência completa, reformado e pronto para morar ou aluguel de temporada (Airbnb / Booking).',
    category: 'Apartamento',
    acquisitionType: 'Venda Direta Banco',
    occupancyStatus: 'Desocupado',
    address: {
      street: 'Avenida Ana Costa',
      number: '520',
      neighborhood: 'Gonzaga',
      city: 'Santos',
      state: 'SP',
      zip: '11060-002',
      lat: -23.9678,
      lng: -46.3331,
    },
    appraisalValue: 580000,
    firstAuctionPrice: 580000,
    firstAuctionDate: '2026-07-30',
    secondAuctionPrice: 365000,
    secondAuctionDate: '2026-08-15',
    area: 76,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    floor: 11,
    auctioneerName: 'Superbid Exchange',
    auctioneerSite: 'https://www.superbid.net',
    isAuctioneerVerified: true,
    bankName: 'Banco Santander Brasil',
    debts: {
      iptu: 0,
      condominium: 0,
      legalDebts: 0,
      utilityDebts: 0,
      isBuyerResponsible: false, // Santander entrega imóvel quitado de débitos
    },
    estimatedMarketPrice: 580000,
    askingPricePerM2Range: [7400, 8200],
    estimatedMarketPricePerM2: 7631,
    acquisitionPricePerM2: 4802,
    apparentDiscountPercentage: 37.0,
    opportunityScore: 9.4,
    riskScore: 1.5,
    liquidityScore: 9.9,
    locationScore: 9.9,
    legalComplexityScore: 1.5,
    renovationEstimate: 20000,
    safetyIndex: {
      level: 'Baixo Risco',
      score: 9.2,
      recentIncidentsCount: 2,
      summary: 'Orla do Gonzaga com câmera da Guarda Municipal e iluminação LED de última geração.',
      provenance: 'DADO OFICIAL'
    },
    floodRisk: {
      level: 'Moderado',
      distanceToRiskZoneMeters: 450,
      summary: 'Proximidade com a praia exige verificação de maré de ressaca extrema no piso térreo/garagem.'
    },
    noiseIndex: {
      level: 'Intenso (Vida Noturna/Vias)',
      sources: ['Avenida turística', 'Comércio e quiosques da praia'],
      summary: 'Excelente para rentabilidade de locação por temporada; ruído moderado em finais de semana de verão.'
    },
    urbanAmenities: {
      walkabilityScore: 99,
      schoolsNearby: 5,
      hospitalsNearby: 2,
      supermarketsNearby: 6,
      publicTransportNearby: 15
    },
    newsIntelligence: [
      {
        id: 'news-4',
        headline: 'Turismo em Santos bate recorde de ocupação em flats e imóveis de temporada no Gonzaga',
        summary: 'Demanda por locação de curta temporada subiu 22% no último trimestre.',
        source: 'A Tribuna de Santos',
        date: '2026-07-28',
        verificationStatus: 'CONFIRMED',
        impact: 'POSITIVE'
      }
    ],
    comparables: [
      {
        id: 'comp-6',
        title: 'Apto 78m² Ana Costa vista lateral',
        area: 78,
        price: 590000,
        pricePerM2: 7564,
        distanceMeters: 80,
        bedrooms: 2,
        source: 'Olx Brasil'
      }
    ],
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
    ],
    editalUrl: 'https://exemplo.g2auction.com.br/editais/edital-gonzaga-1102.pdf',
    matriculaUrl: 'https://exemplo.g2auction.com.br/matriculas/matricula-gonzaga-1102.pdf',
    lifecycleStep: 4,
    isFinancable: true,
    minDownPaymentPercentage: 20
  }
];
