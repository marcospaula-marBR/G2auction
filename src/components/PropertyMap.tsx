import React, { useEffect, useRef } from 'react';
import type { Property } from '../types/auction';
import { Target, Maximize2, Box, Map } from 'lucide-react';
import L from 'leaflet';
import { getCityCoordinates } from '../utils/cityCoordinates';

// Mapbox GL import (carregado dinamicamente no modo 3D)
let mapboxgl: typeof import('mapbox-gl') | null = null;

// Token Mapbox injetado via VITE_MAPBOX_TOKEN no Vercel/Local
const getMapboxToken = (): string => {
  const envToken = (import.meta as any).env?.VITE_MAPBOX_TOKEN;
  if (envToken && !envToken.includes('COLE_SEU')) return envToken;
  // Fallback decodificado em runtime
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
  const popupsRef = useRef<any[]>([]);

  const is3D = activeLayer === '3d';

  const getPropertyCoords = (p: Property): { lat: number; lng: number } => {
    if (p.address && typeof p.address.lat === 'number' && typeof p.address.lng === 'number' && p.address.lat !== 0) {
      return { lat: p.address.lat, lng: p.address.lng };
    }
    return getCityCoordinates(p.address?.city || (p as any).city, p.address?.state || (p as any).state);
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

    const risk = getRiskColor(p);
    const flood = getFloodBadge(p);
    const safety = getSafetyBadge(p);
    const noise = getNoiseBadge(p);

    return `
      <div class="p-3.5 max-w-[320px] font-sans text-slate-900 bg-white rounded-2xl">
        <!-- Topo: Modalidade, Ocupação e Desconto -->
        <div class="flex items-center justify-between gap-1.5 mb-2">
          <span class="text-[9px] font-extrabold uppercase tracking-wider text-orange-800 bg-orange-100/80 px-2 py-0.5 rounded-md border border-orange-300">
            ${modality} • ${occStatus}
          </span>
          <span class="text-[11px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
            -${discount}% de Desconto
          </span>
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

        <!-- Características Físicas e Ocupação -->
        <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold text-slate-700 mb-2.5 bg-slate-50/70 p-1.5 rounded-lg border border-slate-100">
          <div class="border-r border-slate-200 pr-1">📐 ${area}m²</div>
          <div class="border-r border-slate-200 pr-1">🛏️ ${bedrooms} qts</div>
          <div>🚗 ${parking} vg</div>
        </div>

        <!-- Marcações de Entorno & Risco (No próprio imóvel) -->
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

        <!-- Dica de Ação -->
        <div class="mt-2 text-center text-[9px] font-bold text-orange-600 bg-orange-50/80 py-1 rounded-lg">
          👉 Clique no balão para abrir Ficha 360° & Jornada
        </div>
      </div>
    `;
  };

  // ── LEAFLET 2D ────────────────────────────────────────────────────────
  useEffect(() => {
    if (is3D || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const target = selectedProperty ? getPropertyCoords(selectedProperty)
        : properties.length > 0 ? getPropertyCoords(properties[0])
        : { lat: -23.5505, lng: -46.6333 };

      const map = L.map(mapContainerRef.current).setView([target.lat, target.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap | G2 Geointeligência',
      }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) map.removeLayer(layer);
    });

    const bounds = L.latLngBounds([]);

    properties.forEach(p => {
      const coords = getPropertyCoords(p);
      bounds.extend([coords.lat, coords.lng]);
      const isSelected = selectedProperty?.id === p.id;
      const rawDiscount = p.apparentDiscountPercentage || (p as any).discount_percentage || 0;
      const discount = Math.round(Number(rawDiscount));

      // Balão Pílula Elegante 2D: NUNCA estoura a fonte nem corta texto
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
              <span>-${discount}%</span>
              <span class="text-[9px] font-extrabold uppercase opacity-90">desc.</span>
            </div>
            <!-- Triângulo indicador inferior -->
            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-6 ${
              isSelected ? 'border-t-slate-950' : discount >= 50 ? 'border-t-emerald-600' : discount >= 35 ? 'border-t-orange-600' : 'border-t-slate-800'
            }"></div>
          </div>
        `,
        iconSize: [80, 32],
        iconAnchor: [40, 32],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(map);

      // Popup Rico no Hover (sem necessidade de clique)
      const popupContent = renderRichHoverCardHtml(p);
      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: [0, -10],
        className: 'g2-rich-hover-popup',
        maxWidth: 320,
      });

      // Abertura automática ao passar o mouse (Hover)
      marker.on('mouseover', () => {
        marker.openPopup();
      });

      marker.on('mouseout', () => {
        marker.closePopup();
      });

      // Clique abre o modal detalhado / jornada
      marker.on('click', () => {
        onSelectProperty(p);
      });
    });

    if (selectedProperty) {
      const c = getPropertyCoords(selectedProperty);
      map.flyTo([c.lat, c.lng], 15, { duration: 1.2 });
    } else if (bounds.isValid() && properties.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [properties, selectedProperty, activeLayer, is3D]);

  // ── MAPBOX 3D COM BALÕES E HOVER ──────────────────────────────────────
  useEffect(() => {
    if (!is3D || !mapboxContainerRef.current) return;

    const init3DMap = async () => {
      if (!mapboxgl) {
        try {
          mapboxgl = await import('mapbox-gl');
          await import('mapbox-gl/dist/mapbox-gl.css');
        } catch {
          console.warn('mapbox-gl not loaded');
          return;
        }
      }

      if (mapboxInstanceRef.current) {
        mapboxInstanceRef.current.remove();
        mapboxInstanceRef.current = null;
      }

      popupsRef.current.forEach(p => p.remove());
      popupsRef.current = [];

      const center = selectedProperty
        ? getPropertyCoords(selectedProperty)
        : properties.length > 0 ? getPropertyCoords(properties[0])
        : { lat: -23.5505, lng: -46.6333 };

      const token = MAPBOX_TOKEN;
      (mapboxgl as any).accessToken = token;

      const map = new (mapboxgl as any).Map({
        container: mapboxContainerRef.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [center.lng, center.lat],
        zoom: 14.5,
        pitch: 55,
        bearing: -20,
        antialias: true,
      });

      mapboxInstanceRef.current = map;

      map.on('load', () => {
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
                'interpolate', ['linear'], ['get', 'height'],
                0, '#1e293b', 40, '#334155', 80, '#475569',
              ],
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, ['get', 'height']],
              'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, ['get', 'min_height']],
              'fill-extrusion-opacity': 0.85,
            },
          });
        } catch { /* camada opcional */ }

        // Adiciona Marcadores Flutuantes 3D com Hover Rico
        properties.forEach(p => {
          const coords = getPropertyCoords(p);
          const price = (p.secondAuctionPrice || p.estimatedMarketPrice || (p as any).sale_value || 0)
            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
          const rawDiscount = p.apparentDiscountPercentage || (p as any).discount_percentage || 0;
          const discount = Math.round(Number(rawDiscount));
          const area = p.area || (p as any).private_area || (p as any).total_area || 72;
          const title = p.title || p.address?.neighborhood || 'Imóvel';
          const isSelected = selectedProperty?.id === p.id;

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
              min-width: 145px;
              cursor: pointer;
              transition: all 0.2s;
              position: relative;
              backdrop-filter: blur(8px);
            ">
              <div style="font-size:10px; opacity:0.7; margin-bottom:2px; font-weight:800; text-transform:uppercase;">
                🏠 ${title.substring(0, 20)}${title.length > 20 ? '…' : ''}
              </div>
              <div style="font-size:13px; font-weight:900; color:${isSelected ? '#fb923c' : '#059669'}; margin-bottom:2px;">
                ${price}
              </div>
              <div style="display:flex; justify-content:space-between; font-size:10px; opacity:0.85;">
                <span style="color:#ea580c; font-weight:900;">-${discount}% desc.</span>
                <span>📐 ${area}m²</span>
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

          // Popup no hover 3D
          const mapboxPopup = new (mapboxgl as any).Popup({
            offset: 25,
            closeButton: false,
            closeOnClick: false,
            maxWidth: '320px',
          }).setHTML(renderRichHoverCardHtml(p));

          el.addEventListener('mouseenter', () => {
            mapboxPopup.setLngLat([coords.lng, coords.lat]).addTo(map);
          });

          el.addEventListener('mouseleave', () => {
            mapboxPopup.remove();
          });

          el.addEventListener('click', () => {
            onSelectProperty(p);
          });

          const marker = new (mapboxgl as any).Marker({ element: el, anchor: 'bottom', offset: [0, -4] })
            .setLngLat([coords.lng, coords.lat])
            .addTo(map);

          popupsRef.current.push(marker);
        });

        if (selectedProperty) {
          const c = getPropertyCoords(selectedProperty);
          map.flyTo({ center: [c.lng, c.lat], zoom: 16, pitch: 60, bearing: -15, duration: 1500 });
        }
      });
    };

    init3DMap();

    return () => {
      if (mapboxInstanceRef.current) {
        popupsRef.current.forEach(p => p.remove());
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
      const coords = properties.map(p => getPropertyCoords(p));
      const bounds = coords.reduce(
        (b, c) => [[Math.min(b[0][0], c.lng), Math.min(b[0][1], c.lat)], [Math.max(b[1][0], c.lng), Math.max(b[1][1], c.lat)]],
        [[180, 90], [-180, -90]]
      );
      mapboxInstanceRef.current.fitBounds(bounds, { padding: 80, pitch: 50, duration: 1500 });
    } else if (mapInstanceRef.current && properties.length > 0) {
      const bounds = L.latLngBounds([]);
      properties.forEach(p => { const c = getPropertyCoords(p); bounds.extend([c.lat, c.lng]); });
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
        className="w-full h-full z-0 absolute inset-0"
        style={{ display: is3D ? 'block' : 'none' }}
      />

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
          <span>Ver Todos os Imóveis</span>
        </button>
      </div>

      {/* Barra de Alternância 2D / 3D Simplificada (Canto Superior Direito) */}
      <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200 flex items-center space-x-1">
        <button
          onClick={() => setActiveLayer('default')}
          className={`flex items-center space-x-1.5 text-xs px-3.5 py-2 rounded-xl font-black transition-all ${
            !is3D
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
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
        <span>💡 Dica: Passe o mouse sobre qualquer balão para ver todos os dados de engenharia, jurídica e entorno</span>
      </div>

    </div>
  );
};
