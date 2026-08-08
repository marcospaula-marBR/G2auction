import type { Property } from '../types/auction';

export const mockProperties: Property[] = [
  {
    id: 'prop-1',
    code: 'CX-CMP-8492',
    title: 'Apartamento 3 Dorms no Cambuí - Venda Direta Extrajudicial Caixa',
    description: 'Imóvel de propriedade da Caixa Econômica Federal (Contrato nº 8.7732.0192837-1). Apartamento no bairro nobre Cambuí em Campinas com suíte, varanda gourmet e 2 vagas de garagem. Imóvel elegível para uso do FGTS e Financiamento Habitação Caixa em até 95%. A Caixa entrega o imóvel com IPTU e condomínio quitados até a data do contrato.',
    category: 'Apartamento',
    acquisitionType: 'Venda Direta Banco',
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
    secondAuctionPrice: 345600, // 52% de desconto no valor de avaliação
    secondAuctionDate: '2026-08-28',
    area: 98,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpaces: 2,
    floor: 7,
    auctioneerName: 'Venda Direta Caixa (Portal Oficial CEF)',
    auctioneerSite: 'https://venda-imoveis.caixa.gov.br',
    isAuctioneerVerified: true,
    bankName: 'Caixa Econômica Federal',
    originBank: 'Caixa Econômica Federal',
    caixaModalidad: 'Venda Direta Extrajudicial Caixa',
    acceptsFGTS: true,
    acceptsBankFinancing: true,
    caixaContractNumber: '8.7732.0192837-1',
    processNumber: 'Matrícula 48.912 - 1º CRI de Campinas',
    debts: {
      iptu: 0,
      condominium: 0,
      legalDebts: 0,
      utilityDebts: 0,
      isBuyerResponsible: false, // Responsabilidade da Caixa até a contratação
    },
    estimatedMarketPrice: 720000,
    askingPricePerM2Range: [7100, 7800],
    estimatedMarketPricePerM2: 7346,
    acquisitionPricePerM2: 3526,
    apparentDiscountPercentage: 52.0,
    opportunityScore: 9.8,
    riskScore: 2.1,
    liquidityScore: 9.7,
    locationScore: 9.9,
    legalComplexityScore: 2.1,
    renovationEstimate: 35000,
    safetyIndex: {
      level: 'Baixo Risco',
      score: 9.3,
      recentIncidentsCount: 2,
      summary: 'Bairro nobre de Campinas com patrulhamento ostensivo e segurança privada homologada.',
      provenance: 'DADO OFICIAL'
    },
    floodRisk: {
      level: 'Mínimo',
      distanceToRiskZoneMeters: 1850,
      summary: 'Topo de cota topográfica no Cambuí sem histórico de alagamentos.'
    },
    noiseIndex: {
      level: 'Moderado',
      sources: ['Restaurantes executivos', 'Tráfego residencial local'],
      summary: 'Região valorizada e tranquila no miolo do Cambuí.'
    },
    urbanAmenities: {
      walkabilityScore: 97,
      schoolsNearby: 8,
      hospitalsNearby: 3,
      supermarketsNearby: 5,
      publicTransportNearby: 12
    },
    newsIntelligence: [
      {
        id: 'news-1',
        headline: 'Caixa lança programa especial de Venda Direta com financiamento de até 95%',
        summary: 'Imóveis adjudicados pela Caixa contam com isenção de débitos anteriores e uso liberado do FGTS.',
        source: 'Assessoria de Imprensa Caixa Econômica Federal',
        date: '2026-08-01',
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
      }
    ],
    images: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
    ],
    editalUrl: 'https://venda-imoveis.caixa.gov.br/editais/edital-caixa-cambui-8492.pdf',
    matriculaUrl: 'https://venda-imoveis.caixa.gov.br/matriculas/matricula-caixa-cambui-8492.pdf',
    lifecycleStep: 2,
    isFinancable: true,
    minDownPaymentPercentage: 5
  },

  {
    id: 'prop-2',
    code: 'CX-SPO-3910',
    title: 'Casa em Condomínio no Alto da Boa Vista - 2º Leilão Caixa',
    description: 'Sobrado de leilão extrajudicial da Caixa Econômica Federal (Contrato CEF nº 8.4410.0384712-9). 4 suítes, piscina privativa e 4 vagas. Imóvel desocupado por liminar de reintegração de posse expedida em favor da Caixa. Aceita financiamento bancário Caixa e uso do saldo FGTS.',
    category: 'Casa',
    acquisitionType: 'Venda Direta Banco',
    occupancyStatus: 'Desocupado',
    address: {
      street: 'Rua Alexandre Dumas',
      number: '450',
      neighborhood: 'Alto da Boa Vista',
      city: 'São Paulo',
      state: 'SP',
      zip: '04717-002',
      lat: -23.6331,
      lng: -46.7029,
    },
    appraisalValue: 1850000,
    firstAuctionPrice: 1850000,
    firstAuctionDate: '2026-08-10',
    secondAuctionPrice: 999000, // 46% de desconto
    secondAuctionDate: '2026-08-22',
    area: 280,
    bedrooms: 4,
    bathrooms: 5,
    parkingSpaces: 4,
    auctioneerName: 'Zukerman Leilões (Homologado Caixa)',
    auctioneerSite: 'https://www.zukerman.com.br',
    isAuctioneerVerified: true,
    bankName: 'Caixa Econômica Federal',
    originBank: 'Caixa Econômica Federal',
    caixaModalidad: '2º Leilão Caixa (Deságio Mínimo)',
    acceptsFGTS: true,
    acceptsBankFinancing: true,
    caixaContractNumber: '8.4410.0384712-9',
    processNumber: 'Matrícula 194.810 - 11º CRI de São Paulo',
    debts: {
      iptu: 0,
      condominium: 0,
      legalDebts: 0,
      utilityDebts: 0,
      isBuyerResponsible: false, // Débitos anteriores sob responsabilidade da Caixa
    },
    estimatedMarketPrice: 1900000,
    askingPricePerM2Range: [6500, 7200],
    estimatedMarketPricePerM2: 6785,
    acquisitionPricePerM2: 3567,
    apparentDiscountPercentage: 46.0,
    opportunityScore: 9.7,
    riskScore: 1.8,
    liquidityScore: 9.1,
    locationScore: 9.5,
    legalComplexityScore: 2.2,
    renovationEstimate: 60000,
    safetyIndex: {
      level: 'Baixo Risco',
      score: 9.6,
      recentIncidentsCount: 1,
      summary: 'Condomínio fechado de alto padrão com portaria 24h e biometria.',
      provenance: 'DADO OFICIAL'
    },
    floodRisk: {
      level: 'Mínimo',
      distanceToRiskZoneMeters: 2400,
      summary: 'Excelente drenagem urbana no Alto da Boa Vista.'
    },
    noiseIndex: {
      level: 'Silencioso',
      sources: ['Rua estritamente residencial'],
      summary: 'Tranquilidade e privacidade total.'
    },
    urbanAmenities: {
      walkabilityScore: 85,
      schoolsNearby: 6,
      hospitalsNearby: 4,
      supermarketsNearby: 3,
      publicTransportNearby: 9
    },
    newsIntelligence: [
      {
        id: 'news-2',
        headline: 'Caixa bate recorde de liquidação de imóveis retidos em leilões em SP',
        summary: 'Deságios médios superam 45% com atratividade no financiamento imobiliário.',
        source: 'Valor Econômico',
        date: '2026-07-29',
        verificationStatus: 'CONFIRMED',
        impact: 'POSITIVE'
      }
    ],
    comparables: [
      {
        id: 'comp-2',
        title: 'Casa 290m² Condomínio Alexandre Dumas',
        area: 290,
        price: 1950000,
        pricePerM2: 6724,
        distanceMeters: 50,
        bedrooms: 4,
        source: 'Lopes Imóveis'
      }
    ],
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'
    ],
    editalUrl: 'https://venda-imoveis.caixa.gov.br/editais/edital-caixa-santoamaro-3910.pdf',
    matriculaUrl: 'https://venda-imoveis.caixa.gov.br/matriculas/matricula-caixa-santoamaro-3910.pdf',
    lifecycleStep: 3,
    isFinancable: true,
    minDownPaymentPercentage: 10
  },

  {
    id: 'prop-3',
    code: 'CX-SAN-1102',
    title: 'Apartamento Vista Mar no Gonzaga - Licitação Aberta Caixa',
    description: 'Imóvel residencial adjudicado pela Caixa Econômica Federal (Contrato nº 8.1102.0492811-3). Frente para o mar no bairro Gonzaga em Santos. 2 dormitórios reformados com vista panorâmica. Imóvel desocupado, com escritura imediata e elegível para FGTS + Financiamento Caixa.',
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
    secondAuctionPrice: 278400, // 52% de deságio
    secondAuctionDate: '2026-08-15',
    area: 76,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    floor: 11,
    auctioneerName: 'Superbid (Credenciado Caixa)',
    auctioneerSite: 'https://www.superbid.net',
    isAuctioneerVerified: true,
    bankName: 'Caixa Econômica Federal',
    originBank: 'Caixa Econômica Federal',
    caixaModalidad: 'Licitação Aberta Caixa',
    acceptsFGTS: true,
    acceptsBankFinancing: true,
    caixaContractNumber: '8.1102.0492811-3',
    processNumber: 'Matrícula 89.201 - 2º CRI de Santos',
    debts: {
      iptu: 0,
      condominium: 0,
      legalDebts: 0,
      utilityDebts: 0,
      isBuyerResponsible: false, // Caixa entrega imóvel 100% livre e desembaraçado
    },
    estimatedMarketPrice: 580000,
    askingPricePerM2Range: [7400, 8200],
    estimatedMarketPricePerM2: 7631,
    acquisitionPricePerM2: 3663,
    apparentDiscountPercentage: 52.0,
    opportunityScore: 9.9,
    riskScore: 1.2,
    liquidityScore: 9.9,
    locationScore: 9.9,
    legalComplexityScore: 1.1,
    renovationEstimate: 15000,
    safetyIndex: {
      level: 'Baixo Risco',
      score: 9.4,
      recentIncidentsCount: 1,
      summary: 'Orla do Gonzaga iluminada e monitorada pela Guarda Municipal de Santos.',
      provenance: 'DADO OFICIAL'
    },
    floodRisk: {
      level: 'Moderado',
      distanceToRiskZoneMeters: 450,
      summary: 'Proximidade com a praia. 11º andar imune a qualquer evento de maré.'
    },
    noiseIndex: {
      level: 'Moderado',
      sources: ['Avenida turística de Santos'],
      summary: 'Alta rentabilidade para locação por temporada (Airbnb).'
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
        id: 'news-3',
        headline: 'Caixa simplifica aquisição de imóveis de leilão em Santos via Aplicativo Habitação',
        summary: 'Processo de proposta e aprovação de crédito passou a ser 100% digital.',
        source: 'A Tribuna de Santos',
        date: '2026-08-03',
        verificationStatus: 'CONFIRMED',
        impact: 'POSITIVE'
      }
    ],
    comparables: [
      {
        id: 'comp-3',
        title: 'Apto 78m² Ana Costa vista lateral',
        area: 78,
        price: 590000,
        pricePerM2: 7564,
        distanceMeters: 80,
        bedrooms: 2,
        source: 'ZapImóveis'
      }
    ],
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
    ],
    editalUrl: 'https://venda-imoveis.caixa.gov.br/editais/edital-caixa-gonzaga-1102.pdf',
    matriculaUrl: 'https://venda-imoveis.caixa.gov.br/matriculas/matricula-caixa-gonzaga-1102.pdf',
    lifecycleStep: 2,
    isFinancable: true,
    minDownPaymentPercentage: 5
  },

  {
    id: 'prop-4',
    code: 'BB-SPO-4481',
    title: 'Apartamento 2 Dorms em Pinheiros - Venda Direta Banco do Brasil',
    description: 'Imóvel de propriedade do Banco do Brasil. Localizado no coração de Pinheiros, São Paulo. 2 dormitórios, varanda e 1 vaga. Imóvel desocupado, com quitação total de IPTU e condomínio assumida pelo Banco do Brasil até a lavratura da escritura público.',
    category: 'Apartamento',
    acquisitionType: 'Venda Direta Banco',
    occupancyStatus: 'Desocupado',
    address: {
      street: 'Rua dos Pinheiros',
      number: '890',
      neighborhood: 'Pinheiros',
      city: 'São Paulo',
      state: 'SP',
      zip: '05422-001',
      lat: -23.5671,
      lng: -46.6854,
    },
    appraisalValue: 850000,
    firstAuctionPrice: 850000,
    firstAuctionDate: '2026-07-20',
    secondAuctionPrice: 467500, // 45% de deságio
    secondAuctionDate: '2026-08-14',
    area: 68,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    floor: 5,
    auctioneerName: 'Reserva Leilões (Banco do Brasil)',
    auctioneerSite: 'https://www.seuimovelbb.com.br',
    isAuctioneerVerified: true,
    bankName: 'Banco do Brasil',
    originBank: 'Banco do Brasil',
    caixaModalidad: 'Leilão Extrajudicial Banco',
    acceptsFGTS: false,
    acceptsBankFinancing: true,
    processNumber: 'Matrícula 112.482 - 13º CRI de São Paulo',
    debts: {
      iptu: 0,
      condominium: 0,
      legalDebts: 0,
      utilityDebts: 0,
      isBuyerResponsible: false,
    },
    estimatedMarketPrice: 860000,
    askingPricePerM2Range: [12000, 13500],
    estimatedMarketPricePerM2: 12647,
    acquisitionPricePerM2: 6875,
    apparentDiscountPercentage: 45.0,
    opportunityScore: 9.5,
    riskScore: 1.9,
    liquidityScore: 9.8,
    locationScore: 9.9,
    legalComplexityScore: 1.8,
    renovationEstimate: 28000,
    safetyIndex: {
      level: 'Baixo Risco',
      score: 9.1,
      recentIncidentsCount: 3,
      summary: 'Região gastronômica nobre de Pinheiros com intenso policiamento comunitário.',
      provenance: 'DADO OFICIAL'
    },
    floodRisk: {
      level: 'Mínimo',
      distanceToRiskZoneMeters: 1900,
      summary: 'Elevado nível topográfico de Pinheiros.'
    },
    noiseIndex: {
      level: 'Intenso (Vida Noturna/Vias)',
      sources: ['Comércio e bares de Pinheiros'],
      summary: 'Bairro cosmopolita com alta demanda de jovens executivos.'
    },
    urbanAmenities: {
      walkabilityScore: 98,
      schoolsNearby: 7,
      hospitalsNearby: 5,
      supermarketsNearby: 8,
      publicTransportNearby: 18
    },
    newsIntelligence: [],
    comparables: [],
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'
    ],
    editalUrl: 'https://www.seuimovelbb.com.br/editais/edital-pinheiros-4481.pdf',
    matriculaUrl: 'https://www.seuimovelbb.com.br/matriculas/matricula-pinheiros-4481.pdf',
    lifecycleStep: 2,
    isFinancable: true,
    minDownPaymentPercentage: 20
  }
];
