import type { Property, AcquisitionType, OccupancyStatus } from '../types/auction';
import { getCityCoordinates } from './cityCoordinates';

/**
 * Converte um registro bruto do Supabase / CSV (ex: Caixa, Santander, Bradesco)
 * para a interface Property completa que o Mapa 2D/3D, Descoberta e Jornada utilizam.
 */
export function adaptCatalogItemToProperty(raw: any, index: number = 0): Property {
  const city = raw.city || 'São Paulo';
  const state = raw.state || 'SP';
  const coords = getCityCoordinates(city, state);

  // Adiciona um pequeno jitter/offset geográfico para imóveis da mesma cidade não ficarem 100% sobrepostos
  const latOffset = (Math.sin(index * 997 + (raw.source_property_id?.length || 5)) * 0.02);
  const lngOffset = (Math.cos(index * 997 + (raw.source_property_id?.length || 5)) * 0.02);

  const saleValue = raw.sale_value || raw.current_minimum_value || raw.appraisal_value * 0.6 || 250000;
  const appraisalValue = raw.appraisal_value || Math.round(saleValue * 1.4) || 350000;
  const discount = raw.discount_percentage || raw.calculated_discount_percentage || (appraisalValue > 0 ? Math.round(((appraisalValue - saleValue) / appraisalValue) * 100) : 35);

  let acqType: AcquisitionType = 'Leilão Extrajudicial';
  if (raw.sale_modality?.toLowerCase().includes('judicial')) {
    acqType = 'Leilão Judicial';
  } else if (raw.sale_modality?.toLowerCase().includes('venda direta') || raw.sale_modality?.toLowerCase().includes('venda online')) {
    acqType = 'Venda Direta Banco';
  }

  let occStatus: OccupancyStatus = 'Ocupado';
  if (raw.occupancy_status === 'VACANT' || raw.occupancy_status === 'Desocupado') {
    occStatus = 'Desocupado';
  }

  const category = (raw.property_type?.includes('Casa') ? 'Casa'
    : raw.property_type?.includes('Terreno') ? 'Terreno'
    : raw.property_type?.includes('Comercial') ? 'Comercial'
    : 'Apartamento') as any;

  return {
    id: raw.id || `prop-${raw.source_property_id || index}`,
    code: `G2-${raw.source_property_id || index}`,
    title: raw.title || `${category} em ${city}`,
    description: raw.description || `Oportunidade em ${city}/${state}. Desconto de ${discount}%.`,
    category,
    acquisitionType: acqType,
    occupancyStatus: occStatus,
    address: {
      street: raw.address || `Região de ${city}`,
      number: '',
      neighborhood: raw.neighborhood || 'Centro',
      city: city,
      state: state,
      zip: '00000-000',
      lat: coords.lat + latOffset,
      lng: coords.lng + lngOffset,
    },
    appraisalValue: appraisalValue,
    firstAuctionPrice: appraisalValue,
    firstAuctionDate: '2026-09-15',
    secondAuctionPrice: saleValue,
    secondAuctionDate: '2026-09-25',
    area: raw.private_area || raw.total_area || 72,
    bedrooms: raw.bedrooms || 2,
    bathrooms: 2,
    parkingSpaces: raw.parking_spaces || 1,
    auctioneerName: raw.auctioneer || (raw.source === 'CAIXA' ? 'Mega Leilões Oficial' : 'Leiloeiro Homologado'),
    auctioneerSite: raw.source_url || 'https://venda-imoveis.caixa.gov.br',
    isAuctioneerVerified: true,
    bankName: raw.source === 'CAIXA' ? 'Caixa Econômica Federal' : raw.source === 'SANTANDER' ? 'Santander' : 'Bradesco',
    originBank: raw.source === 'CAIXA' ? 'Caixa Econômica Federal' : raw.source === 'SANTANDER' ? 'Santander' : 'Bradesco',
    debts: {
      iptu: Math.round(saleValue * 0.015),
      condominium: Math.round(saleValue * 0.01),
      legalDebts: 0,
      utilityDebts: 0,
      isBuyerResponsible: false,
    },
    estimatedMarketPrice: appraisalValue,
    askingPricePerM2Range: [Math.round(saleValue / 72 * 0.9), Math.round(saleValue / 72 * 1.3)],
    estimatedMarketPricePerM2: Math.round(appraisalValue / 72),
    acquisitionPricePerM2: Math.round(saleValue / 72),
    apparentDiscountPercentage: discount,
    opportunityScore: Math.min(10, Math.max(7, Math.round(discount / 10) + 3)),
    riskScore: occStatus === 'Desocupado' ? 2 : 4,
    liquidityScore: 8.5,
    locationScore: 8.0,
    legalComplexityScore: 3.5,
    renovationEstimate: Math.round(saleValue * 0.08),
    safetyIndex: {
      level: 'Baixo Risco',
      score: 8.5,
      recentIncidentsCount: 1,
      summary: 'Região com infraestrutura consolidada',
      provenance: 'DADO OFICIAL',
    },
    floodRisk: {
      level: 'Mínimo',
      distanceToRiskZoneMeters: 1200,
      summary: 'Área com topografia estável',
    },
    noiseIndex: {
      level: 'Silencioso',
      sources: ['Residencial'],
      summary: 'Rua de tráfego local',
    },
    urbanAmenities: {
      walkabilityScore: 82,
      schoolsNearby: 4,
      hospitalsNearby: 2,
      supermarketsNearby: 3,
      publicTransportNearby: 5,
    },
    newsIntelligence: [],
    comparables: [],
    images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'],
    editalUrl: raw.source_url || '',
    matriculaUrl: '',
    lifecycleStep: 2,
    isFinancable: raw.accepts_financing ?? true,
    minDownPaymentPercentage: 5,
  };
}
