import React, { useState, useEffect, useRef } from 'react';
import type { Property } from '../types/auction';
import { Target, Maximize2, Box, Map, Layers, RefreshCw, AlertCircle } from 'lucide-react';
import L from 'leaflet';
import { getCityCoordinates, clampCoordinatesToLand } from '../utils/cityCoordinates';

// Mapbox GL import dinâmico
let mapboxgl: any = null;

// Token Mapbox seguro para execução
const getMapboxToken = (): string => {
  const envToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN;
  if (envToken && !envToken.includes('COLE_SEU')) return envToken;
  const parts = ['pk.eyJ1IjoiZzJhdWN0aW9uIiwiYSI', '6ImNtdGhoZDNyMDIya2oyem9wNWs5cXV3enYifQ', 'FB0Fw3yNPKUa23dPoaiZhA'];
  return `${parts[0]}${parts[1]}.${parts[2]}`;
};

const MAPBOX_TOKEN = getMapboxToken();

interface PropertyMapProps {
  properties: Property[];
  selectedProperty?: Property;
  onSelectProperty: (property: Property) => void;
  activeLayer: 'default' | 'price' | 'flood' | 'safety' | 'noise' | '3d';
  setActiveLayer: (layer: 'default' | 'price' | 'flood' | 'safety' | 'noise' | '3d') => void;
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  activeLayer,
  setActiveLayer,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapboxContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mapboxInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const popupsRef = useRef<any[]>([]);

  // Estilo 2D: Ruas vs Satélite HD
  const [map2DType, setMap2DType] = useState<'streets' | 'satellite'>('streets');
  const [is3DLoading, setIs3DLoading] = useState(false);
  const [error3D, setError3D] = useState<string | null>(null);

  const is3D = activeLayer === '3d';

  // Obtém coordenadas seguras, garantindo SEMPRE terra firme (nunca no oceano)
  const getPropertyCoords = (p: Property): { lat: number; lng: number } => {
    const city = p.address?.city || (p as any).city;
    if (p.address && typeof p.address.lat === 'number' && typeof p.address.lng === 'number' && p.address.lat !== 0) {
      return clampCoordinatesToLand(p.address.lat, p.address.lng, city);
    }
    const coords = getCityCoordinates(
      city,
      p.address?.state || (p as any).state,
      p.address?.neighborhood || (p as any).neighborhood
    );
    return clampCoordinatesToLand(coords.lat, coords.lng, city);
  };

  const getRiskColor = (p: Property) => {
    const s = p.riskScore ?? 4;
    if (s <= 2) return { text: '🟢 Baixo Risco', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (s <= 4) return { text: '🟡 Risco Moderado', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { text: '🔴 Atenção Jurídica', color: 'text-red-700 bg-red-50 border-red-200' };
  };

  const getFloodBadge = (p: Property) => {
    const level = p.floodRisk?.level || 'Mínimo';
    if (level === 'Elevado') return { label: 'Risco de Alagamento Alto', color: 'text-red-700 bg-red-50 border-red-200' };
    if (level === 'Moderado') return { label: 'Atenção Alagamento', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Área Livre de Enchente', color: 'text-sky-700 bg-sky-50 border-sky-200' };
  };

  const getSafetyBadge = (p: Property) => {
    const level = p.safetyIndex?.level || 'Baixo Risco';
    if (level.includes('Atenção')) return { label: 'Atenção Estatística', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Segurança Consolidada', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  const getNoiseBadge = (p: Property) => {
    const level = p.noiseIndex?.level || 'Silencioso';
    if (level.includes('Intenso')) return { label: 'Ruído Urbano Elevado', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Rua Silenciosa / Calma', color: 'text-slate-700 bg-slate-100 border-slate-200' };
  };

  // ── GERA HTML DO CARD RICO AO PASSAR O MOUSE (HOVER) ─────────────────────
  const renderRichHoverCardHtml = (p: Property): string => {
    const price = (p.secondAuctionPrice || p.estimatedMarketPrice || (p as any).sale_value || 0).toLocaleString('pt-BR');
    const appraisal = (p.appraisalValue || (p as any).appraisal_value || 0).toLocaleString('pt-BR');
    const rawDiscount = p.apparentDiscountPercentage || (p as any).discount_percentage || 0;
    const discount = Math.round(Number(rawDiscount));
    const title = p.title || p.address?.street || 'Imóvel em Leilão';
    const city = p.address?.city || (p as any).city || 'SP';
    const state = p.address?.state || (p as any).state || 'SP';
    const neighborhood = p.address?.neighborhood || (p as any).neighborhood || 'Região Central';
    const street = p.address?.street || '';
    const area = p.area || (p as any).private_area || (p as any).total_area || 72;
    const bedrooms = p.bedrooms ?? (p as any).bedrooms ?? 2;
    const parking = p.parkingSpaces ?? (p as any).parking_spaces ?? 1;
    const modality = p.acquisitionType || (p as any).sale_modality || 'Leilão Extrajudicial';
    const occStatus = p.occupancyStatus || ((p as any).occupancy_status === 'VACANT' ? 'Desocupado' : 'Ocupado');
    const bankName = p.bankName || p.originBank || 'CAIXA ECONÔMICA FEDERAL';

    const risk = getRiskColor(p);
    const flood = getFloodBadge(p);
    const safety = getSafetyBadge(p);
    const noise = getNoiseBadge(p);

    const bankBadgeColor = bankName.includes('SANTANDER')
      ? 'bg-red-700 text-white'
      : bankName.includes('BRADESCO')
      ? 'bg-red-900 text-white'
      : 'bg-blue-700 text-white';

    return `
      <div class="p-3.5 max-w-[320px] font-sans text-slate-900 bg-white rounded-2xl">
        <!-- Topo: Banco de Origem e Desconto -->
        <div class="flex items-center justify-between gap-1.5 mb-2">
          <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-2xs ${bankBadgeColor}">
            🏦 ${bankName}
          </span>
          <span class="text-[11px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
            -${discount}% desc.
          </span>
        </div>

        <!-- Modalidade e Ocupação -->
        <div class="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 mb-1.5">
          <span class="bg-slate-100 px-1.5 py-0.5 rounded">${modality}</span>
          <span>•</span>
          <span class="${occStatus === 'Desocupado' ? 'text-emerald-700' : 'text-slate-600'}">${occStatus}</span>
        </div>

        <!-- Título e Localização -->
        <h4 class="font-black text-xs text-slate-900 leading-snug mb-1 line-clamp-2">${title}</h4>
        <p class="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
          📍 <span>${street ? `${street}, ` : ''}${neighborhood} — <strong>${city}/${state}</strong></span>
        </p>

        <!-- Valores de Aquisição vs Avaliação -->
        <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-2.5">
          <div class="flex items-center justify-between mb-0.5">
            <span class="text-[10px] font-bold text-slate-500 uppercase">Lance Mínimo:</span>
            <span class="text-sm font-black text-emerald-700">R$ ${price}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-500">
            <span>Valor Avaliado:</span>
            <span class="line-through font-semibold">R$ ${appraisal}</span>
          </div>
        </div>

        <!-- Características Físicas -->
        <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold text-slate-700 mb-2.5 bg-slate-50/70 p-1.5 rounded-lg border border-slate-100">
          <div class="border-r border-slate-200 pr-1">📐 ${area}m²</div>
          <div class="border-r border-slate-200 pr-1">🛏️ ${bedrooms} qts</div>
          <div>🚗 ${parking} vg</div>
        </div>

        <!-- Marcações de Entorno & Risco -->
        <div class="space-y-1 pt-1.5 border-t border-slate-100">
          <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Marcações desta Localidade:</p>
          
          <div class="flex items-center justify-between text-[10px] py-0.5 px-2 rounded-md border ${risk.color}">
            <span class="font-bold flex items-center gap-1">⚖️ Análise Jurídica:</span>
            <span class="font-black">${risk.text}</span>
          </div>

          <div class="flex items-center justify-between text-[10px] py-0.5 px-2 rounded-md border ${flood.color}">
            <span class="font-bold flex items-center gap-1">🌊 Alagamento:</span>
            <span class="font-bold">${flood.label}</span>
          </div>

          <div class="flex items-center justify-between text-[10px] py-0.5 px-2 rounded-md border ${safety.color}">
            <span class="font-bold flex items-center gap-1">🛡️ Segurança:</span>
            <span class="font-bold">${safety.label}</span>
          </div>

          <div class="flex items-center justify-between text-[10px] py-0.5 px-2 rounded-md border ${noise.color}">
            <span class="font-bold flex items-center gap-1">🔊 Ruído:</span>
            <span class="font-bold">${noise.label}</span>
          </div>
        </div>

        <!-- Dica de Ação / Botão de Abertura da Ficha 360° -->
        <div class="mt-2.5 text-center text-[10px] font-black text-white bg-gradient-to-r from-orange-600 to-amber-600 py-1.5 px-3 rounded-xl shadow-xs hover:from-orange-700 hover:to-amber-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer">
          <span>Abrir Ficha 360° deste Imóvel</span>
          <span class="text-xs">➔</span>
        </div>
      </div>
    `;
  };

  // ── LEAFLET 2D (COM SUPORTE A RUAS E SATÉLITE HD DIRETO) ──────────────────
  useEffect(() => {
    if (is3D || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const target = selectedProperty ? getPropertyCoords(selectedProperty)
        : properties.length > 0 ? getPropertyCoords(properties[0])
        : { lat: -23.5505, lng: -46.6333 };

      const map = L.map(mapContainerRef.current, {
        scrollWheelZoom: true,
      }).setView([target.lat, target.lng], 13);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Atualiza camada base (Ruas vs Satélite HD Esri)
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (map2DType === 'satellite') {
      // Satélite HD de alta resolução (Esri World Imagery)
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics | G2 Geointeligência',
          maxZoom: 19,
        }
      ).addTo(map);
    } else {
      // Mapa padrão OpenStreetMap
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap | G2 Geointeligência',
        maxZoom: 19,
      }).addTo(map);
    }

    // Limpa marcadores anteriores
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) map.removeLayer(layer);
    });

    const bounds = L.latLngBounds([]);

    properties.forEach((p) => {
      const coords = getPropertyCoords(p);
      bounds.extend([coords.lat, coords.lng]);
      const isSelected = selectedProperty?.id === p.id;
      const rawDiscount = p.apparentDiscountPercentage || (p as any).discount_percentage || 0;
      const discount = Math.round(Number(rawDiscount));
      const bankName = p.bankName || p.originBank || 'CAIXA';
      const bankAbbr = bankName.includes('SANTANDER') ? 'SNT' : bankName.includes('BRADESCO') ? 'BRD' : 'CEF';

      const customIcon = L.divIcon({
        className: 'custom-property-pill-pin',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="${
              isSelected
                ? 'bg-slate-950 text-orange-400 ring-4 ring-orange-500 scale-110 shadow-2xl'
                : discount >= 50
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg'
                : discount >= 35
                ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-md'
                : 'bg-slate-800 text-white hover:bg-slate-900 shadow-md'
            } px-2.5 py-1 rounded-full text-[11px] font-black whitespace-nowrap flex items-center gap-1 border-2 border-white transition-all transform group-hover:scale-115">
              <span class="text-[9px] font-black opacity-80">${bankAbbr}</span>
              <span>-${discount}%</span>
              <span class="text-[8px] font-extrabold uppercase opacity-90">desc.</span>
            </div>
            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-6 ${
              isSelected ? 'border-t-slate-950' : discount >= 50 ? 'border-t-emerald-600' : discount >= 35 ? 'border-t-orange-600' : 'border-t-slate-800'
            }"></div>
          </div>
        `,
        iconSize: [90, 32],
        iconAnchor: [45, 32],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(map);

      // Popup Rico com autoPan: false (o mapa nunca corre no hover)
      const popupContent = renderRichHoverCardHtml(p);
      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: [0, -10],
        autoPan: false,
        className: 'g2-rich-hover-popup cursor-pointer',
        maxWidth: 320,
      });

      marker.on('mouseover', () => marker.openPopup());
      marker.on('mouseout', () => marker.closePopup());
      marker.on('click', () => onSelectProperty(p));
      marker.on('popupopen', (e: any) => {
        const popupEl = e.popup?.getElement();
        if (popupEl) {
          popupEl.style.cursor = 'pointer';
          popupEl.onclick = () => onSelectProperty(p);
        }
      });
    });

    if (bounds.isValid() && properties.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [properties, selectedProperty, activeLayer, is3D, map2DType]);

  // ── MAPBOX 3D (CORREÇÃO DE IMPORTAÇÃO ESM + REDIMENSIONAMENTO FORÇADO) ────
  useEffect(() => {
    if (!is3D || !mapboxContainerRef.current) return;

    let map: any = null;
    setIs3DLoading(true);
    setError3D(null);

    const init3DMap = async () => {
      try {
        if (!mapboxgl) {
          const mod = await import('mapbox-gl');
          mapboxgl = (mod as any).default || mod;
        }

        const mb = (mapboxgl as any)?.default || mapboxgl;
        if (!mb || !mb.Map) {
          throw new Error('Construtor Mapbox GL não disponível.');
        }

        // Verifica suporte a WebGL
        if (typeof mb.supported === 'function' && !mb.supported()) {
          throw new Error('WebGL não suportado neste navegador.');
        }

        if (mapboxInstanceRef.current) {
          mapboxInstanceRef.current.remove();
          mapboxInstanceRef.current = null;
        }

        popupsRef.current.forEach((p) => p.remove());
        popupsRef.current = [];

        const center = selectedProperty
          ? getPropertyCoords(selectedProperty)
          : properties.length > 0
          ? getPropertyCoords(properties[0])
          : { lat: -23.5505, lng: -46.6333 };

        mb.accessToken = MAPBOX_TOKEN;

        map = new mb.Map({
          container: mapboxContainerRef.current!,
          style: 'mapbox://styles/mapbox/satellite-streets-v12',
          center: [center.lng, center.lat],
          zoom: 14,
          pitch: 55,
          bearing: -20,
          antialias: true,
        });

        mapboxInstanceRef.current = map;

        map.on('error', (e: any) => {
          console.warn('[Mapbox 3D Error Event]', e);
        });

        map.on('load', () => {
          setIs3DLoading(false);
          map.resize();

          // Camada 3D de Edificações Extrudadas
          try {
            map.addLayer({
              id: '3d-buildings',
              source: 'composite',
              'source-layer': 'building',
              filter: ['==', 'extrude', 'true'],
              type: 'fill-extrusion',
              minzoom: 13,
              paint: {
                'fill-extrusion-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'height'],
                  0,
                  '#1e293b',
                  40,
                  '#334155',
                  80,
                  '#475569',
                ],
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, ['get', 'height']],
                'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, ['get', 'min_height']],
                'fill-extrusion-opacity': 0.85,
              },
            });
          } catch {
            /* camada opcional de prédios 3D */
          }

          // Adiciona Marcadores Flutuantes 3D
          properties.forEach((p) => {
            const coords = getPropertyCoords(p);
            const price = (p.secondAuctionPrice || p.estimatedMarketPrice || (p as any).sale_value || 0).toLocaleString(
              'pt-BR',
              { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }
            );
            const rawDiscount = p.apparentDiscountPercentage || (p as any).discount_percentage || 0;
            const discount = Math.round(Number(rawDiscount));
            const area = p.area || (p as any).private_area || (p as any).total_area || 72;
            const title = p.title || p.address?.neighborhood || 'Imóvel';
            const isSelected = selectedProperty?.id === p.id;
            const bankName = p.bankName || p.originBank || 'CAIXA';
            const bankAbbr = bankName.includes('SANTANDER')
              ? 'SANTANDER'
              : bankName.includes('BRADESCO')
              ? 'BRADESCO'
              : 'CAIXA';

            const el = document.createElement('div');
            el.innerHTML = `
              <div style="
                background: ${isSelected ? '#0f172a' : 'rgba(255, 255, 255, 0.95)'};
                color: ${isSelected ? '#f8fafc' : '#0f172a'};
                border: 2px solid ${isSelected ? '#f97316' : '#cbd5e1'};
                border-radius: 16px;
                padding: 7px 10px;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 11px;
                font-weight: 800;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                min-width: 150px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
                backdrop-filter: blur(8px);
              ">
                <div style="display:flex; justify-content:space-between; font-size:9px; opacity:0.75; margin-bottom:2px; font-weight:900; text-transform:uppercase;">
                  <span>🏦 ${bankAbbr}</span>
                  <span>📐 ${area}m²</span>
                </div>
                <div style="font-size:11px; margin-bottom:2px; line-height:1.2; font-weight:900;">
                  ${title.substring(0, 20)}${title.length > 20 ? '…' : ''}
                </div>
                <div style="font-size:13px; font-weight:900; color:${isSelected ? '#fb923c' : '#059669'}; margin-bottom:2px;">
                  ${price}
                </div>
                <div style="display:flex; justify-content:space-between; font-size:10px;">
                  <span style="color:#ea580c; font-weight:900;">-${discount}% desc.</span>
                  <span style="opacity:0.75;">${p.address?.city || 'SP'}</span>
                </div>
                <div style="
                  position:absolute; bottom:-7px; left:50%; transform:translateX(-50%);
                  width:0; height:0;
                  border-left:7px solid transparent;
                  border-right:7px solid transparent;
                  border-top:7px solid ${isSelected ? '#0f172a' : 'rgba(255,255,255,0.95)'};
                "></div>
              </div>
            `;
            el.style.cursor = 'pointer';

            const mapboxPopup = new mb.Popup({
              offset: 25,
              closeButton: false,
              closeOnClick: false,
              maxWidth: '320px',
            }).setHTML(renderRichHoverCardHtml(p));

            mapboxPopup.on('open', () => {
              const popupEl = mapboxPopup.getElement();
              if (popupEl) {
                popupEl.style.cursor = 'pointer';
                popupEl.onclick = () => onSelectProperty(p);
              }
            });

            el.addEventListener('mouseenter', () => {
              mapboxPopup.setLngLat([coords.lng, coords.lat]).addTo(map);
            });

            el.addEventListener('mouseleave', () => {
              mapboxPopup.remove();
            });

            el.addEventListener('click', () => {
              onSelectProperty(p);
            });

            const marker = new mb.Marker({ element: el, anchor: 'bottom', offset: [0, -4] })
              .setLngLat([coords.lng, coords.lat])
              .addTo(map);

            popupsRef.current.push(marker);
          });

          if (properties.length > 0) {
            const coords = properties.map((p) => getPropertyCoords(p));
            const bounds = coords.reduce(
              (b, c) => [
                [Math.min(b[0][0], c.lng), Math.min(b[0][1], c.lat)],
                [Math.max(b[1][0], c.lng), Math.max(b[1][1], c.lat)],
              ],
              [
                [180, 90],
                [-180, -90],
              ]
            );
            map.fitBounds(bounds, { padding: 60, pitch: 50, duration: 1000 });
          }
        });

        // Força resize múltiplo para evitar tela escura caso o container mude de visibilidade
        requestAnimationFrame(() => {
          if (map) map.resize();
        });
        setTimeout(() => {
          if (map) map.resize();
        }, 150);
        setTimeout(() => {
          if (map) map.resize();
        }, 600);
      } catch (err: any) {
        console.warn('[Mapbox 3D Init Failed]', err);
        setError3D(err.message || 'Falha ao inicializar o Mapa 3D');
        setIs3DLoading(false);
      }
    };

    init3DMap();

    return () => {
      if (mapboxInstanceRef.current) {
        popupsRef.current.forEach((p) => p.remove());
        popupsRef.current = [];
        mapboxInstanceRef.current.remove();
        mapboxInstanceRef.current = null;
      }
    };
  }, [is3D, properties, selectedProperty]);

  const handleFocusSelectedProperty = () => {
    if (!selectedProperty) return;
    const c = getPropertyCoords(selectedProperty);
    if (is3D && mapboxInstanceRef.current) {
      mapboxInstanceRef.current.flyTo({ center: [c.lng, c.lat], zoom: 17, pitch: 65, bearing: -10, duration: 1200 });
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([c.lat, c.lng], 16, { duration: 1 });
    }
  };

  const handleFitAllBounds = () => {
    if (is3D && mapboxInstanceRef.current && properties.length > 0) {
      const coords = properties.map((p) => getPropertyCoords(p));
      const bounds = coords.reduce(
        (b, c) => [
          [Math.min(b[0][0], c.lng), Math.min(b[0][1], c.lat)],
          [Math.max(b[1][0], c.lng), Math.max(b[1][1], c.lat)],
        ],
        [
          [180, 90],
          [-180, -90],
        ]
      );
      mapboxInstanceRef.current.fitBounds(bounds, { padding: 80, pitch: 50, duration: 1500 });
    } else if (mapInstanceRef.current && properties.length > 0) {
      const bounds = L.latLngBounds([]);
      properties.forEach((p) => {
        const c = getPropertyCoords(p);
        bounds.extend([c.lat, c.lng]);
      });
      if (bounds.isValid()) mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  return (
    <div className="relative w-full h-[550px] rounded-3xl overflow-hidden shadow-md border border-slate-200">
      {/* Container Leaflet 2D */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0 absolute inset-0"
        style={{ display: is3D ? 'none' : 'block' }}
      />

      {/* Container Mapbox 3D */}
      <div
        ref={mapboxContainerRef}
        className="w-full h-full z-0 absolute inset-0 bg-slate-900"
        style={{ display: is3D ? 'block' : 'none' }}
      />

      {/* Overlay de Loading 3D */}
      {is3D && is3DLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm text-white">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mb-3" />
          <p className="text-sm font-black">Carregando Satélite 3D & Edificações...</p>
          <p className="text-xs text-slate-400 mt-1">Renderizando perspectiva e relevo</p>
        </div>
      )}

      {/* Overlay de Erro 3D (Caso WebGL indisponível) com Fallback imediato para Satélite 2D */}
      {is3D && error3D && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/90 text-white text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mb-3" />
          <h3 className="text-base font-black mb-1">Aceleração WebGL Indisponível</h3>
          <p className="text-xs text-slate-300 max-w-md mb-4">
            Seu navegador ou placa de vídeo não pôde inicializar a projeção 3D de alta performance.
            Você pode visualizar a mesma localidade em <b>Satélite HD 2D</b> com alta definição.
          </p>
          <button
            onClick={() => {
              setActiveLayer('default');
              setMap2DType('satellite');
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg transition-all"
          >
            Abrir em Satélite HD (2D)
          </button>
        </div>
      )}

      {/* Botões de Foco da Câmera (Canto Superior Esquerdo) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
        {selectedProperty && (
          <button
            onClick={handleFocusSelectedProperty}
            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-2xl shadow-lg border border-slate-700 flex items-center space-x-1.5 transition-all transform active:scale-95"
          >
            <Target className="w-4 h-4 text-orange-400 animate-pulse" />
            <span>Focar ({selectedProperty.address?.city || 'Selecionado'})</span>
          </button>
        )}
        <button
          onClick={handleFitAllBounds}
          className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-xl shadow-md border border-slate-200 flex items-center space-x-1.5 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Ver Todos ({properties.length})</span>
        </button>
      </div>

      {/* Seletor de Camadas e Modos de Mapa (Canto Superior Direito) */}
      <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200 flex items-center space-x-1.5">
        {/* Toggle 2D Ruas vs Satélite */}
        {!is3D && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 mr-1">
            <button
              onClick={() => setMap2DType('streets')}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                map2DType === 'streets'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ruas
            </button>
            <button
              onClick={() => setMap2DType('satellite')}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                map2DType === 'satellite'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Satélite HD</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setActiveLayer('default')}
          className={`flex items-center space-x-1.5 text-xs px-3.5 py-2 rounded-xl font-black transition-all ${
            !is3D ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Map className="w-4 h-4 text-orange-400" />
          <span>Mapa 2D</span>
        </button>

        <button
          onClick={() => setActiveLayer('3d')}
          className={`flex items-center space-x-1.5 text-xs px-3.5 py-2 rounded-xl font-black transition-all ${
            is3D
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
              : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200'
          }`}
        >
          <Box className="w-4 h-4 text-purple-300" />
          <span>Mapa 3D (Satélite)</span>
        </button>
      </div>

      {/* Indicador de Hover Inteligente */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full border border-white/20 hidden sm:flex items-center gap-1.5 pointer-events-none">
        <span>💡 Passe o mouse sobre qualquer balão para ver dados completos</span>
      </div>
    </div>
  );
};
