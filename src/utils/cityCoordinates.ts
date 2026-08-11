/**
 * Utilitário de Geocodificação de Cidades e Estados Brasileiros.
 * Mapeia latitude e longitude de todas as cidades principais do Brasil para garantir que
 * o mapa NUNCA abra na localização padrão (Campinas) quando o imóvel for de outra cidade.
 */

import { stripAccents } from './textUtils';

export interface GeoCoords {
  lat: number;
  lng: number;
}

const CITY_COORDINATES_MAP: Record<string, GeoCoords> = {
  // SÃO PAULO (SP)
  'SAO PAULO': { lat: -23.5505, lng: -46.6333 },
  'CAMPINAS': { lat: -22.8984, lng: -47.0521 },
  'SANTOS': { lat: -23.9678, lng: -46.3331 },
  'RIBEIRAO PRETO': { lat: -21.1704, lng: -47.8103 },
  'SAO JOSE DO RIO PRETO': { lat: -20.8113, lng: -49.3758 },
  'SAO JOSE DOS CAMPOS': { lat: -23.1791, lng: -45.8872 },
  'SOROCABA': { lat: -23.5015, lng: -47.4526 },
  'BAURU': { lat: -22.3147, lng: -49.0606 },
  'ARARAQUARA': { lat: -21.7944, lng: -48.1756 },
  'PIRACICABA': { lat: -22.7253, lng: -47.6492 },
  'COTIA': { lat: -23.6039, lng: -46.9192 },
  'PRAIA GRANDE': { lat: -24.0058, lng: -46.4028 },
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
  'BARUERI': { lat: -23.5111, lng: -46.8761 },
  'INDAIATUBA': { lat: -23.0903, lng: -47.2181 },
  'BOTUCATU': { lat: -22.8858, lng: -48.4450 },
  'TAUBATE': { lat: -23.0264, lng: -45.5553 },
  'PRESIDENTE PRUDENTE': { lat: -22.1256, lng: -51.3889 },
  'ADAMANTINA': { lat: -21.6853, lng: -51.0733 },

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
 * Obtém coordenadas reais de uma cidade / estado.
 */
export function getCityCoordinates(city?: string | null, state?: string | null): GeoCoords {
  if (city) {
    const normCity = stripAccents(city);
    if (CITY_COORDINATES_MAP[normCity]) {
      return CITY_COORDINATES_MAP[normCity];
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
