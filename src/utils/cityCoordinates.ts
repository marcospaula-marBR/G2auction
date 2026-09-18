/**
 * Utilitário de Geocodificação de Cidades, Bairros e Estados Brasileiros.
 * Mapeia latitude e longitude de cidades e bairros com calibração precisa em terra firme,
 * evitando absolutamente marcações em oceanos/mares ou sobreposições cegas.
 */

import { stripAccents } from './textUtils';

export interface GeoCoords {
  lat: number;
  lng: number;
}

// ── MAPEAMENTO DE BAIRROS DE PRAIA GRANDE (SP) ──────────────────────────────
// Coordenadas calibradas precisamente na malha urbana em terra firme (OSM / Nominatim)
const PRAIA_GRANDE_NEIGHBORHOODS: Record<string, GeoCoords> = {
  'CANTO DO FORTE': { lat: -24.0090, lng: -46.4120 },
  'FORTE': { lat: -24.0090, lng: -46.4120 },
  'BOQUEIRAO': { lat: -24.0112, lng: -46.4210 },
  'CENTRO': { lat: -24.0112, lng: -46.4210 },
  'GUILHERMINA': { lat: -24.0123, lng: -46.4320 },
  'AVIACAO': { lat: -24.0169, lng: -46.4510 },
  'TUPI': { lat: -24.0218, lng: -46.4680 },
  'VILA TUPI': { lat: -24.0218, lng: -46.4680 },
  'OCIAN': { lat: -24.0272, lng: -46.4830 },
  'CIDADE OCIAN': { lat: -24.0272, lng: -46.4830 },
  'MIRIM': { lat: -24.0375, lng: -46.4950 },
  'VILA MIRIM': { lat: -24.0375, lng: -46.4950 },
  'NOVA MIRIM': { lat: -24.0250, lng: -46.4980 },
  'MARACANA': { lat: -24.0376, lng: -46.5160 },
  'BALNEARIO MARACANA': { lat: -24.0376, lng: -46.5160 },
  'BALNEARIO MARACANA MIRIM': { lat: -24.0410, lng: -46.5180 },
  'CAICARA': { lat: -24.0481, lng: -46.5380 },
  'VILA CAICARA': { lat: -24.0481, lng: -46.5380 },
  'REAL': { lat: -24.0675, lng: -46.5650 },
  'BALNEARIO REAL': { lat: -24.0675, lng: -46.5650 },
  'FLORIDA': { lat: -24.0780, lng: -46.5900 },
  'BALNEARIO FLORIDA': { lat: -24.0780, lng: -46.5900 },
  'SOLEMAR': { lat: -24.0950, lng: -46.6250 },
  'BALNEARIO SOLEMAR': { lat: -24.0950, lng: -46.6250 },
  'VILA SONIA': { lat: -24.0027, lng: -46.4472 },
  'ANTARTICA': { lat: -24.0104, lng: -46.4531 },
  'SITIO DO CAMPO': { lat: -23.9973, lng: -46.4228 },
  'JARDIM GLORIA': { lat: -24.0080, lng: -46.4370 },
  'GLORIA': { lat: -24.0080, lng: -46.4370 },
  'QUIETUDE': { lat: -24.0185, lng: -46.4740 },
  'TUPIRY': { lat: -24.0205, lng: -46.4670 },
  'SAMAMBAIA': { lat: -24.0342, lng: -46.5265 },
  'ESMERALDA': { lat: -24.0291, lng: -46.5200 },
  'MELVI': { lat: -24.0375, lng: -46.5310 },
  'RIBEIROPOLIS': { lat: -24.0228, lng: -46.5170 },
  'PRINCESA': { lat: -24.0593, lng: -46.5624 },
  'ANHANGUERA': { lat: -24.0160, lng: -46.4800 },
  'VILA SAO JORGE': { lat: -24.0010, lng: -46.4240 },
  'VILA NOGUEIRA': { lat: -24.0035, lng: -46.4270 },
  'VILA RIOMAR': { lat: -24.0065, lng: -46.4350 },
  'VILA BALNEARIA': { lat: -24.0115, lng: -46.4350 },
  'VILA ASSUNCAO': { lat: -24.0215, lng: -46.4600 },
  'JARDIM PRAIA GRANDE': { lat: -24.0350, lng: -46.4880 },
  'JARDIM SILMARA': { lat: -24.0400, lng: -46.5220 },
  'JARDIM ACLIMACAO': { lat: -24.0220, lng: -46.4700 },
  'JARDIM TREVO': { lat: -24.0420, lng: -46.5150 },
  'BALNEARIO ABC': { lat: -24.0350, lng: -46.5200 },
  'BALNEARIO JOIA': { lat: -24.0320, lng: -46.5180 },
  'BALNEARIO MIRANTE': { lat: -24.0550, lng: -46.5500 },
  'CALIPAL': { lat: -24.0420, lng: -46.5180 },
  'PARQUE DAS AMERICAS': { lat: -24.0125, lng: -46.4450 },
  'SITIO SAO SEBASTIAO': { lat: -24.0000, lng: -46.4300 },
  'SITIO CAIUBURA': { lat: -23.9950, lng: -46.4200 },
};

// ── MAPEAMENTO DE BAIRROS DE SANTOS (SP) ───────────────────────────────────
const SANTOS_NEIGHBORHOODS: Record<string, GeoCoords> = {
  'GONZAGA': { lat: -23.9660, lng: -46.3330 },
  'BOQUEIRAO': { lat: -23.9680, lng: -46.3240 },
  'EMBARE': { lat: -23.9710, lng: -46.3150 },
  'APARECIDA': { lat: -23.9740, lng: -46.3070 },
  'PONTA DA PRAIA': { lat: -23.9850, lng: -46.3020 },
  'POMPEIA': { lat: -23.9640, lng: -46.3420 },
  'JOSE MENINO': { lat: -23.9650, lng: -46.3500 },
  'CENTRO': { lat: -23.9340, lng: -46.3260 },
  'VILA MATHIAS': { lat: -23.9480, lng: -46.3310 },
  'MARAPE': { lat: -23.9550, lng: -46.3450 },
  'CAMPO GRANDE': { lat: -23.9520, lng: -46.3380 },
  'ENCRUZILHADA': { lat: -23.9450, lng: -46.3300 },
  'MACUCO': { lat: -23.9520, lng: -46.3180 },
};

// ── MAPEAMENTO DE BAIRROS DE SÃO VICENTE (SP) ──────────────────────────────
const SAO_VICENTE_NEIGHBORHOODS: Record<string, GeoCoords> = {
  'ITARARE': { lat: -23.9700, lng: -46.3750 },
  'CENTRO': { lat: -23.9640, lng: -46.3880 },
  'BOA VISTA': { lat: -23.9680, lng: -46.3820 },
  'GONZAGUINHA': { lat: -23.9720, lng: -46.3850 },
  'CIDADE NAUTICA': { lat: -23.9450, lng: -46.3950 },
  'PARQUE DAS BANDEIRAS': { lat: -23.9850, lng: -46.4250 },
  'JAPUI': { lat: -23.9880, lng: -46.3980 },
  'VILA MARGARIDA': { lat: -23.9520, lng: -46.4020 },
};

// ── MAPEAMENTO DE BAIRROS DE GUARUJÁ (SP) ──────────────────────────────────
const GUARUJA_NEIGHBORHOODS: Record<string, GeoCoords> = {
  'PITANGUEIRAS': { lat: -23.9960, lng: -46.2570 },
  'ASTURIAS': { lat: -24.0040, lng: -46.2680 },
  'TOMBO': { lat: -24.0090, lng: -46.2750 },
  'ENSEADA': { lat: -23.9850, lng: -46.2350 },
  'CENTRO': { lat: -23.9940, lng: -46.2580 },
  'VICENTE DE CARVALHO': { lat: -23.9450, lng: -46.3050 },
  'JARDIM BOA ESPERANCA': { lat: -23.9550, lng: -46.3100 },
};

const CITY_COORDINATES_MAP: Record<string, GeoCoords> = {
  // SÃO PAULO (SP)
  'SAO PAULO': { lat: -23.5505, lng: -46.6333 },
  'CAMPINAS': { lat: -22.8984, lng: -47.0521 },
  // Calibração segura em terra firme para cidades litorâneas
  'PRAIA GRANDE': { lat: -24.0150, lng: -46.4450 }, // Paço Municipal / Vila Mirim (terra firme)
  'SANTOS': { lat: -23.9610, lng: -46.3350 },
  'SAO VICENTE': { lat: -23.9680, lng: -46.3880 },
  'GUARUJA': { lat: -23.9930, lng: -46.2580 },
  'ITANHAEM': { lat: -24.1830, lng: -46.7950 },
  'MONGAGUA': { lat: -24.0930, lng: -46.6280 },
  'PERUIBE': { lat: -24.3200, lng: -46.9990 },
  'BERTIOGA': { lat: -23.8540, lng: -46.1420 },
  'CARAGUATATUBA': { lat: -23.6220, lng: -45.4180 },
  'UBATUBA': { lat: -23.4330, lng: -45.0880 },
  'SAO SEBASTIAO': { lat: -23.8050, lng: -45.4080 },
  'ILHABELA': { lat: -23.7780, lng: -45.3620 },
  'ILHA COMPRIDA': { lat: -24.7300, lng: -47.5350 },
  'IGUAPE': { lat: -24.7080, lng: -47.5550 },
  'CANANEIA': { lat: -25.0140, lng: -47.9260 },

  // Cidades do Interior & Região Metropolitana de SP
  'RIBEIRAO PRETO': { lat: -21.1704, lng: -47.8103 },
  'SAO JOSE DO RIO PRETO': { lat: -20.8113, lng: -49.3758 },
  'SAO JOSE DOS CAMPOS': { lat: -23.1791, lng: -45.8872 },
  'SOROCABA': { lat: -23.5015, lng: -47.4526 },
  'BAURU': { lat: -22.3147, lng: -49.0606 },
  'ARARAQUARA': { lat: -21.7944, lng: -48.1756 },
  'PIRACICABA': { lat: -22.7253, lng: -47.6492 },
  'COTIA': { lat: -23.6039, lng: -46.9192 },
  'JABOTICABAL': { lat: -21.2547, lng: -48.3228 },
  'MARILIA': { lat: -22.2139, lng: -49.9458 },
  'ARACATUBA': { lat: -21.2089, lng: -50.4403 },
  'GUARULHOS': { lat: -23.4542, lng: -46.5337 },
  'SANTA BARBARA DOESTE': { lat: -22.7558, lng: -47.4150 },
  'SANTA BARBARA D OESTE': { lat: -22.7558, lng: -47.4150 },
  'JUNDIAI': { lat: -23.1857, lng: -46.8978 },
  'FRANCA': { lat: -20.5386, lng: -47.4008 },
  'AMERICANA': { lat: -22.7392, lng: -47.3314 },
  'OSASCO': { lat: -23.5329, lng: -46.7917 },
  'SANTO ANDRE': { lat: -23.6639, lng: -46.5383 },
  'SAO BERNARDO DO CAMPO': { lat: -23.6939, lng: -46.5650 },
  'SAO CAETANO DO SUL': { lat: -23.6228, lng: -46.5544 },
  'DIADEMA': { lat: -23.6865, lng: -46.6234 },
  'MAUA': { lat: -23.6678, lng: -46.4614 },
  'RIBEIRAO PIRES': { lat: -23.7142, lng: -46.4131 },
  'BARUERI': { lat: -23.5111, lng: -46.8761 },
  'CARAPICUIBA': { lat: -23.5222, lng: -46.8356 },
  'ITAPEVI': { lat: -23.5489, lng: -46.9328 },
  'JANDIRA': { lat: -23.5275, lng: -46.9028 },
  'SANTANA DE PARNAIBA': { lat: -23.4442, lng: -46.9189 },
  'SUZANO': { lat: -23.5425, lng: -46.3108 },
  'MOGI DAS CRUZES': { lat: -23.5206, lng: -46.1854 },
  'ITAQUAQUECETUBA': { lat: -23.4861, lng: -46.3483 },
  'FERRAZ DE VASCONCELOS': { lat: -23.5408, lng: -46.3686 },
  'POA': { lat: -23.5208, lng: -46.3450 },
  'TABOAO DA SERRA': { lat: -23.6261, lng: -46.7589 },
  'EMBU DAS ARTES': { lat: -23.6489, lng: -46.8522 },
  'ITAPECERICA DA SERRA': { lat: -23.7172, lng: -46.8492 },
  'FRANCO DA ROCHA': { lat: -23.3283, lng: -46.7269 },
  'CAIEIRAS': { lat: -23.3644, lng: -46.7408 },
  'CAJAMAR': { lat: -23.3556, lng: -46.8764 },
  'INDAIATUBA': { lat: -23.0903, lng: -47.2181 },
  'HORTOLANDIA': { lat: -22.8583, lng: -47.2200 },
  'SUMARE': { lat: -22.8208, lng: -47.2667 },
  'PAULINIA': { lat: -22.7608, lng: -47.1506 },
  'VALINHOS': { lat: -22.9706, lng: -46.9958 },
  'VINHEDO': { lat: -23.0297, lng: -46.9747 },
  'LIMEIRA': { lat: -22.5647, lng: -47.4017 },
  'RIO CLARO': { lat: -22.4114, lng: -47.5614 },
  'SAO CARLOS': { lat: -22.0175, lng: -47.8908 },
  'ARARAS': { lat: -22.3572, lng: -47.3842 },
  'LEME': { lat: -22.1844, lng: -47.3889 },
  'MOGI GUACU': { lat: -22.3708, lng: -46.9428 },
  'MOGI MIRIM': { lat: -22.4319, lng: -46.9578 },
  'ITAPIRA': { lat: -22.4339, lng: -46.8228 },
  'ATIBAIA': { lat: -23.1169, lng: -46.5503 },
  'BRAGANCA PAULISTA': { lat: -22.9525, lng: -46.5419 },
  'ITU': { lat: -23.2642, lng: -47.2992 },
  'SALTO': { lat: -23.2008, lng: -47.2869 },
  'VOTORANTIM': { lat: -23.5414, lng: -47.4383 },
  'TATUI': { lat: -23.3556, lng: -47.8569 },
  'ITAPETININGA': { lat: -23.5889, lng: -48.0531 },
  'BOTUCATU': { lat: -22.8858, lng: -48.4450 },
  'JAU': { lat: -22.2964, lng: -48.5586 },
  'LENCOIS PAULISTA': { lat: -22.5989, lng: -48.8003 },
  'OURINHOS': { lat: -22.9789, lng: -49.8706 },
  'ASSIS': { lat: -22.6617, lng: -50.4189 },
  'PRESIDENTE PRUDENTE': { lat: -22.1256, lng: -51.3889 },
  'ADAMANTINA': { lat: -21.6853, lng: -51.0733 },
  'VOTUPORANGA': { lat: -20.4231, lng: -49.9728 },
  'FERNANDOPOLIS': { lat: -20.2831, lng: -50.2464 },
  'JALES': { lat: -20.2689, lng: -50.5458 },
  'BARRETOS': { lat: -20.5572, lng: -48.5678 },
  'BEBEDOURO': { lat: -20.9497, lng: -48.4794 },
  'CATANDUVA': { lat: -21.1378, lng: -48.9733 },
  'SERTAOZINHO': { lat: -21.1339, lng: -47.9897 },
  'JACAREI': { lat: -23.3056, lng: -45.9658 },
  'TAUBATE': { lat: -23.0264, lng: -45.5553 },
  'PINDAMONHANGABA': { lat: -22.9244, lng: -45.4614 },
  'GUARATINGUETA': { lat: -22.8156, lng: -45.1928 },
  'LORENA': { lat: -22.7317, lng: -45.1239 },
  'CRUZEIRO': { lat: -22.5739, lng: -44.9633 },

  // RIO DE JANEIRO (RJ)
  'RIO DE JANEIRO': { lat: -22.9068, lng: -43.1729 },
  'NITEROI': { lat: -22.8833, lng: -43.1036 },
  'PETROPOLIS': { lat: -22.5050, lng: -43.1789 },
  'DUQUE DE CAXIAS': { lat: -22.7856, lng: -43.3117 },
  'NOVA IGUACU': { lat: -22.7592, lng: -43.4511 },
  'CABO FRIO': { lat: -22.8789, lng: -42.0186 },
  'VOLTA REDONDA': { lat: -22.5231, lng: -44.1042 },
  'CAMPOS DOS GOYTACAZES': { lat: -21.7544, lng: -41.3244 },

  // MINAS GERAIS (MG)
  'BELO HORIZONTE': { lat: -19.9167, lng: -43.9345 },
  'UBERLANDIA': { lat: -18.9186, lng: -48.2772 },
  'JUIZ DE FORA': { lat: -21.7642, lng: -43.3503 },
  'CONTAGEM': { lat: -19.9317, lng: -44.0536 },
  'POCOS DE CALDAS': { lat: -21.7878, lng: -46.5614 },

  // PARANÁ (PR)
  'CURITIBA': { lat: -25.4284, lng: -49.2733 },
  'LONDRINA': { lat: -23.3045, lng: -51.1696 },
  'MARINGA': { lat: -23.4273, lng: -51.9375 },
  'FOZ DO IGUACU': { lat: -25.5469, lng: -54.5882 },

  // SANTA CATARINA (SC)
  'FLORIANOPOLIS': { lat: -27.5954, lng: -48.5480 },
  'JOINVILLE': { lat: -26.3045, lng: -48.8487 },
  'BLUMENAU': { lat: -26.9194, lng: -49.0661 },
  'BALNEARIO CAMBORIU': { lat: -26.9926, lng: -48.6353 },

  // RIO GRANDE DO SUL (RS)
  'PORTO ALEGRE': { lat: -30.0346, lng: -51.2177 },
  'CAXIAS DO SUL': { lat: -29.1678, lng: -51.1794 },
  'PELOTAS': { lat: -31.7654, lng: -52.3376 },

  // DISTRITO FEDERAL (DF)
  'BRASILIA': { lat: -15.7975, lng: -47.8919 },
  'TAGUATINGA': { lat: -15.8333, lng: -48.0567 },
  'AGUAS CLARAS': { lat: -15.8364, lng: -48.0294 },

  // BAHIA (BA)
  'SALVADOR': { lat: -12.9777, lng: -38.5016 },
  'FEIRA DE SANTANA': { lat: -12.2664, lng: -38.9664 },
  'VITORIA DA CONQUISTA': { lat: -14.8661, lng: -40.8394 },

  // GOIÁS (GO)
  'GOIANIA': { lat: -16.6869, lng: -49.2648 },
  'APARECIDA DE GOIANIA': { lat: -16.8228, lng: -49.2472 },
};

const STATE_CENTER_MAP: Record<string, GeoCoords> = {
  SP: { lat: -23.5505, lng: -46.6333 },
  RJ: { lat: -22.9068, lng: -43.1729 },
  MG: { lat: -19.9167, lng: -43.9345 },
  PR: { lat: -25.4284, lng: -49.2733 },
  SC: { lat: -27.5954, lng: -48.5480 },
  RS: { lat: -30.0346, lng: -51.2177 },
  DF: { lat: -15.7975, lng: -47.8919 },
  BA: { lat: -12.9777, lng: -38.5016 },
  GO: { lat: -16.6869, lng: -49.2648 },
  PE: { lat: -8.0476, lng: -34.8770 },
  CE: { lat: -3.7319, lng: -38.5267 },
  PA: { lat: -1.4558, lng: -48.4902 },
  ES: { lat: -20.3155, lng: -40.3128 },
};

/**
 * Busca coordenada específica de um Bairro para cidades calibradas.
 */
export function getNeighborhoodCoordinates(
  city?: string | null,
  neighborhood?: string | null
): GeoCoords | null {
  if (!city || !neighborhood) return null;
  const normCity = stripAccents(city).trim().toUpperCase();
  const normNeigh = stripAccents(neighborhood).trim().toUpperCase();

  if (normCity.includes('PRAIA GRANDE')) {
    if (PRAIA_GRANDE_NEIGHBORHOODS[normNeigh]) {
      return PRAIA_GRANDE_NEIGHBORHOODS[normNeigh];
    }
    // Busca parcial
    for (const [key, coords] of Object.entries(PRAIA_GRANDE_NEIGHBORHOODS)) {
      if (normNeigh.includes(key) || key.includes(normNeigh)) {
        return coords;
      }
    }
  }

  if (normCity === 'SANTOS') {
    if (SANTOS_NEIGHBORHOODS[normNeigh]) return SANTOS_NEIGHBORHOODS[normNeigh];
    for (const [key, coords] of Object.entries(SANTOS_NEIGHBORHOODS)) {
      if (normNeigh.includes(key) || key.includes(normNeigh)) return coords;
    }
  }

  if (normCity.includes('SAO VICENTE')) {
    if (SAO_VICENTE_NEIGHBORHOODS[normNeigh]) return SAO_VICENTE_NEIGHBORHOODS[normNeigh];
    for (const [key, coords] of Object.entries(SAO_VICENTE_NEIGHBORHOODS)) {
      if (normNeigh.includes(key) || key.includes(normNeigh)) return coords;
    }
  }

  if (normCity.includes('GUARUJA')) {
    if (GUARUJA_NEIGHBORHOODS[normNeigh]) return GUARUJA_NEIGHBORHOODS[normNeigh];
    for (const [key, coords] of Object.entries(GUARUJA_NEIGHBORHOODS)) {
      if (normNeigh.includes(key) || key.includes(normNeigh)) return coords;
    }
  }

  return null;
}

/**
 * Trava de segurança geográfica:
 * NUNCA permite que nenhum marcador caia no Oceano Atlântico em cidades costeiras.
 * Calibra a latitude/longitude para mantê-las firmemente na faixa urbana continental.
 */
export function clampCoordinatesToLand(
  lat: number,
  lng: number,
  city?: string | null
): GeoCoords {
  if (!city) return { lat, lng };
  const normCity = stripAccents(city).trim().toUpperCase();

  // 1. PRAIA GRANDE: A linha costeira vai de Canto do Forte (-24.007, -46.408) a Solemar (-24.105, -46.680).
  // A interpolação por segmentos reais garante que os marcadores fiquem a pelo menos 400m-500m da areia/mar.
  if (normCity.includes('PRAIA GRANDE')) {
    const safeLat = Math.min(-23.990, Math.max(-24.110, lat));
    const segments = [
      { lat: -24.005, lng: -46.408 },
      { lat: -24.011, lng: -46.415 },
      { lat: -24.018, lng: -46.438 },
      { lat: -24.025, lng: -46.460 },
      { lat: -24.032, lng: -46.482 },
      { lat: -24.040, lng: -46.508 },
      { lat: -24.048, lng: -46.532 },
      { lat: -24.058, lng: -46.562 },
      { lat: -24.072, lng: -46.600 },
      { lat: -24.088, lng: -46.640 },
      { lat: -24.105, lng: -46.680 },
    ];
    let maxLandLng = -46.415 - 0.005;
    for (let i = 0; i < segments.length - 1; i++) {
      const p1 = segments[i];
      const p2 = segments[i + 1];
      if (safeLat <= p1.lat && safeLat >= p2.lat) {
        const t = (safeLat - p1.lat) / (p2.lat - p1.lat);
        const beachLng = p1.lng + t * (p2.lng - p1.lng);
        // Margem de segurança de ~500m para dentro do continente (afasta da praia e água)
        maxLandLng = beachLng - 0.005;
        break;
      }
    }
    const safeLng = Math.min(maxLandLng, Math.max(-46.650, lng));
    return { lat: safeLat, lng: safeLng };
  }

  // 2. SANTOS: Limites da ilha de Santos
  if (normCity === 'SANTOS') {
    const safeLat = Math.min(-23.930, Math.max(-23.978, lat));
    const safeLng = Math.min(-46.300, Math.max(-46.360, lng));
    return { lat: safeLat, lng: safeLng };
  }

  // 3. SÃO VICENTE
  if (normCity.includes('SAO VICENTE')) {
    const safeLat = Math.min(-23.930, Math.max(-23.985, lat));
    const safeLng = Math.min(-46.370, Math.max(-46.430, lng));
    return { lat: safeLat, lng: safeLng };
  }

  // 4. GUARUJÁ
  if (normCity.includes('GUARUJA')) {
    const safeLat = Math.min(-23.920, Math.max(-24.010, lat));
    const safeLng = Math.min(-46.210, Math.max(-46.310, lng));
    return { lat: safeLat, lng: safeLng };
  }

  // 5. ITANHAÉM
  if (normCity.includes('ITANHAEM')) {
    const safeLat = Math.min(-24.150, Math.max(-24.230, lat));
    const coastLng = -46.785 - ((-24.180 - safeLat) * 1.5);
    const safeLng = Math.min(coastLng - 0.003, Math.max(-46.860, lng));
    return { lat: safeLat, lng: safeLng };
  }

  // 6. MONGAGUÁ
  if (normCity.includes('MONGAGUA')) {
    const safeLat = Math.min(-24.070, Math.max(-24.130, lat));
    const coastLng = -46.615 - ((-24.090 - safeLat) * 1.8);
    const safeLng = Math.min(coastLng - 0.003, Math.max(-46.680, lng));
    return { lat: safeLat, lng: safeLng };
  }

  return { lat, lng };
}

/**
 * Obtém coordenadas reais de uma cidade / estado / bairro.
 */
export function getCityCoordinates(
  city?: string | null,
  state?: string | null,
  neighborhood?: string | null
): GeoCoords {
  if (city) {
    // 1. Tenta bairro primeiro se informado
    if (neighborhood) {
      const neighCoords = getNeighborhoodCoordinates(city, neighborhood);
      if (neighCoords) {
        return clampCoordinatesToLand(neighCoords.lat, neighCoords.lng, city);
      }
    }

    const normCity = stripAccents(city).trim().toUpperCase();
    if (CITY_COORDINATES_MAP[normCity]) {
      const c = CITY_COORDINATES_MAP[normCity];
      return clampCoordinatesToLand(c.lat, c.lng, city);
    }
  }

  if (state) {
    const st = state.trim().toUpperCase();
    if (STATE_CENTER_MAP[st]) {
      return STATE_CENTER_MAP[st];
    }
  }

  // Fallback padrão em São Paulo Capital
  return { lat: -23.5505, lng: -46.6333 };
}
