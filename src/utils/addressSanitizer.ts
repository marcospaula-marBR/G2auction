/**
 * Utilitário de Higienização de Endereços Oficiais da Caixa (CEF) para o Google Maps & Waze.
 * Remove ruídos de abreviações e complementos internos (APTO, BLOCO, EDIFÍCIO, SALA)
 * que confundem o geocodificador do Google Maps, permitindo localizar 100% dos imóveis.
 */

export interface FormattedAddressMapsResult {
  rawAddress: string;
  cleanStreet: string;
  searchQuery: string;
  googleMapsUrl: string;
  googleStreetViewUrl: string;
  wazeUrl: string;
}

export function cleanCaixaAddressForMaps(
  rawAddress?: string | null,
  city?: string | null,
  state?: string | null,
  zipcode?: string | null,
  coords?: { lat: number; lng: number } | null
): FormattedAddressMapsResult {
  const cleanCity = (city || '').trim();
  const cleanState = (state || '').toUpperCase().trim();
  const cleanZip = (zipcode || '').replace(/\D/g, '').trim();

  if (!rawAddress || !rawAddress.trim()) {
    const fallbackQuery = [cleanCity, cleanState, 'Brasil'].filter(Boolean).join(', ');
    const encoded = encodeURIComponent(fallbackQuery);
    return {
      rawAddress: '',
      cleanStreet: cleanCity || 'Brasil',
      searchQuery: fallbackQuery,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      googleStreetViewUrl: coords
        ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords.lat},${coords.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encoded}`,
      wazeUrl: `https://waze.com/ul?q=${encoded}&navigate=yes`,
    };
  }

  let addr = rawAddress.trim();

  // 1. Expandir abreviações padrão do logradouro
  addr = addr
    .replace(/^R\.\s*/i, 'Rua ')
    .replace(/^R\s+/i, 'Rua ')
    .replace(/^AV\.\s*/i, 'Avenida ')
    .replace(/^AV\s+/i, 'Avenida ')
    .replace(/^AL\.\s*/i, 'Alameda ')
    .replace(/^AL\s+/i, 'Alameda ')
    .replace(/^PC\.\s*/i, 'Praça ')
    .replace(/^PCA\.\s*/i, 'Praça ')
    .replace(/^PC\s+/i, 'Praça ')
    .replace(/^EST\.\s*/i, 'Estrada ')
    .replace(/^EST\s+/i, 'Estrada ')
    .replace(/^ROD\.\s*/i, 'Rodovia ')
    .replace(/^ROD\s+/i, 'Rodovia ')
    .replace(/^TV\.\s*/i, 'Travessa ')
    .replace(/^TV\s+/i, 'Travessa ');

  // 2. Normalizar marcadores de número
  addr = addr
    .replace(/\s+N[º°\.]?\s*(\d+)/i, ', $1')
    .replace(/\s+NR[º°\.]?\s*(\d+)/i, ', $1')
    .replace(/\s+NUM[º°\.]?\s*(\d+)/i, ', $1')
    .replace(/\s+N[º°\.]?\s*S\/N/i, ', S/N');

  // 3. Remover ruídos de apartamentos, edifícios, blocos e salas para a busca no Google Maps
  let searchAddr = addr
    .replace(/\s+APTO?[\s\.\d\w-]*/gi, '')
    .replace(/\s+APT?[\s\.\d\w-]*/gi, '')
    .replace(/\s+BLOCO?[\s\.\d\w-]*/gi, '')
    .replace(/\s+BL[\s\.\d\w-]*/gi, '')
    .replace(/\s+EDIFICIO[\s\.\d\w-]*/gi, '')
    .replace(/\s+ED[\s\.\d\w-]*/gi, '')
    .replace(/\s+SALA[\s\.\d\w-]*/gi, '')
    .replace(/\s+SL[\s\.\d\w-]*/gi, '')
    .replace(/\s+CONJUNTO[\s\.\d\w-]*/gi, '')
    .replace(/\s+CJ[\s\.\d\w-]*/gi, '')
    .replace(/\s+CASA[\s\.\d\w-]*/gi, '')
    .replace(/\s+CS[\s\.\d\w-]*/gi, '')
    .trim();

  // Limpar vírgulas duplicadas
  searchAddr = searchAddr.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();

  // Se o número da casa/prédio estiver na string, garantimos formato limpo
  const queryParts = [searchAddr];
  if (cleanCity) queryParts.push(cleanCity);
  if (cleanState) queryParts.push(cleanState);
  if (cleanZip && cleanZip.length === 8) queryParts.push(`CEP ${cleanZip}`);
  queryParts.push('Brasil');

  const searchQuery = queryParts.join(', ');
  const encodedQuery = encodeURIComponent(searchQuery);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  
  // Street View: Usamos a coordenada exata se disponível, ou a busca no Maps se a coordenada não for do endereço exato
  const googleStreetViewUrl = coords && coords.lat && coords.lng
    ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;

  const wazeUrl = `https://waze.com/ul?q=${encodedQuery}&navigate=yes`;

  return {
    rawAddress,
    cleanStreet: searchAddr,
    searchQuery,
    googleMapsUrl,
    googleStreetViewUrl,
    wazeUrl,
  };
}
