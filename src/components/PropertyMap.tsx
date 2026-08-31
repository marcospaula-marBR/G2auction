import React, { useEffect, useRef } from 'react';
import type { Property } from '../types/auction';
import { Layers, Shield, Droplets, Volume2, DollarSign, Target, Maximize2, Box, Map } from 'lucide-react';
import L from 'leaflet';
import { getCityCoordinates } from '../utils/cityCoordinates';

// Mapbox GL import (loaded only in 3D mode)
let mapboxgl: typeof import('mapbox-gl') | null = null;

const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';

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

  const getRiskLabel = (p: Property): string => {
    const s = p.riskScore ?? 5;
    if (s <= 3) return '🟢 Baixo';
    if (s <= 6) return '🟡 Moderado';
    return '🔴 Alto';
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

      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 ${
              isSelected
                ? 'bg-red-600 ring-4 ring-orange-400 scale-125 z-50'
                : 'bg-orange-500 hover:bg-orange-600'
            } rounded-full text-white font-extrabold text-xs flex items-center justify-center shadow-lg cursor-pointer transition-all">
              ${p.apparentDiscountPercentage || (p as any).discount_percentage || 0}%
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div class="p-2 max-w-xs font-sans">
          <span class="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 block mb-1">
            ${p.acquisitionType || (p as any).sale_modality || 'Imóvel'} • ${p.occupancyStatus || 'CAIXA'}
          </span>
          <h4 class="font-bold text-xs text-slate-900 leading-tight mb-1">${p.title || p.address?.street || 'Imóvel'}</h4>
          <p class="text-xs font-extrabold text-emerald-700">Preço: R$ ${(p.secondAuctionPrice || p.estimatedMarketPrice || (p as any).sale_value || 0).toLocaleString('pt-BR')}</p>
          <p class="text-[11px] text-slate-500">Avaliado: R$ ${(p.appraisalValue || (p as any).appraisal_value || 0).toLocaleString('pt-BR')}</p>
          <p class="text-[11px] text-slate-500">Risco: ${getRiskLabel(p)}</p>
          <div class="mt-2 flex gap-1">
            <span class="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">${p.address?.city || (p as any).city} / ${p.address?.state || (p as any).state}</span>
          </div>
        </div>
      `);

      marker.on('click', () => onSelectProperty(p));

      if (activeLayer === 'flood' && p.floodRisk?.level && p.floodRisk.level !== 'Mínimo') {
        L.circle([coords.lat, coords.lng], { color: '#0284c7', fillColor: '#38bdf8', fillOpacity: 0.35, radius: 600 }).addTo(map);
      }
      if (activeLayer === 'noise' && p.noiseIndex?.level?.includes('Intenso')) {
        L.circle([coords.lat, coords.lng], { color: '#f97316', fillColor: '#fdba74', fillOpacity: 0.35, radius: 500 }).addTo(map);
      }
    });

    if (selectedProperty) {
      const c = getPropertyCoords(selectedProperty);
      map.flyTo([c.lat, c.lng], 15, { duration: 1.2 });
    } else if (bounds.isValid() && properties.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [properties, selectedProperty, activeLayer, is3D]);

  // ── MAPBOX 3D ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!is3D || !mapboxContainerRef.current) return;

    const init3DMap = async () => {
      // Lazy-load mapbox-gl only when 3D mode is activated
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

      // Clear previous popups
      popupsRef.current.forEach(p => p.remove());
      popupsRef.current = [];

      const center = selectedProperty
        ? getPropertyCoords(selectedProperty)
        : properties.length > 0 ? getPropertyCoords(properties[0])
        : { lat: -23.5505, lng: -46.6333 };

      const token = MAPBOX_TOKEN;
      (mapboxgl as any).accessToken = token || 'pk.eyJ1IjoiZzJhdWN0aW9uIiwiYSI6ImRlbW9rZXkifQ.demo';

      const map = new (mapboxgl as any).Map({
        container: mapboxContainerRef.current!,
        style: token
          ? 'mapbox://styles/mapbox/satellite-streets-v12'
          : 'mapbox://styles/mapbox/streets-v12',
        center: [center.lng, center.lat],
        zoom: 14,
        pitch: 55,
        bearing: -20,
        antialias: true,
      });

      mapboxInstanceRef.current = map;

      map.on('load', () => {
        // 3D buildings layer (if token available)
        if (token && map.getLayer) {
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
                  0, '#1e293b', 50, '#334155', 100, '#475569',
                ],
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, ['get', 'height']],
                'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, ['get', 'min_height']],
                'fill-extrusion-opacity': 0.75,
              },
            });
          } catch { /* buildings layer may not be available */ }
        }

        // Add KPI balloons for each property
        properties.forEach(p => {
          const coords = getPropertyCoords(p);
          const price = (p.secondAuctionPrice || p.estimatedMarketPrice || (p as any).sale_value || 0)
            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
          const discount = p.apparentDiscountPercentage || (p as any).discount_percentage || 0;
          const area = p.area || (p as any).area_m2 || '—';
          const risk = getRiskLabel(p);
          const title = p.title || p.address?.neighborhood || 'Imóvel';
          const isSelected = selectedProperty?.id === p.id;

          const el = document.createElement('div');
          el.innerHTML = `
            <div style="
              background: ${isSelected ? '#1e293b' : 'white'};
              color: ${isSelected ? 'white' : '#1e293b'};
              border: 2px solid ${isSelected ? '#f97316' : '#e2e8f0'};
              border-radius: 14px;
              padding: 8px 10px;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 11px;
              font-weight: 700;
              box-shadow: 0 8px 24px rgba(0,0,0,0.25);
              min-width: 140px;
              cursor: pointer;
              transition: all 0.2s;
              position: relative;
            ">
              <div style="font-size:10px; opacity:0.65; margin-bottom:2px; font-weight:800; text-transform:uppercase; letter-spacing:0.04em;">
                🏠 ${title.substring(0, 22)}${title.length > 22 ? '…' : ''}
              </div>
              <div style="font-size:13px; font-weight:900; color:${isSelected ? '#fb923c' : '#059669'}; margin-bottom:3px;">
                ${price}
              </div>
              <div style="display:flex; gap:8px; font-size:10px; opacity:0.8;">
                <span>📉 ${discount}%</span>
                <span>📐 ${area}m²</span>
              </div>
              <div style="font-size:10px; margin-top:2px;">${risk}</div>
              <div style="
                position:absolute; bottom:-8px; left:50%; transform:translateX(-50%);
                width:0; height:0;
                border-left:8px solid transparent;
                border-right:8px solid transparent;
                border-top:8px solid ${isSelected ? '#f97316' : '#e2e8f0'};
              "/>
            </div>
          `;
          el.style.cursor = 'pointer';
          el.addEventListener('click', () => onSelectProperty(p));

          const popup = new (mapboxgl as any).Marker({ element: el, anchor: 'bottom', offset: [0, -4] })
            .setLngLat([coords.lng, coords.lat])
            .addTo(map);

          popupsRef.current.push(popup);
        });

        // Fly to selected property
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

  const layerButtons = [
    { id: 'default' as const, label: 'Padrão 2D', icon: Map, active: 'bg-slate-900 text-white' },
    { id: 'price' as const, label: 'Preço/m²', icon: DollarSign, active: 'bg-orange-500 text-white' },
    { id: 'flood' as const, label: 'Enchente', icon: Droplets, active: 'bg-sky-600 text-white' },
    { id: 'safety' as const, label: 'Segurança', icon: Shield, active: 'bg-emerald-600 text-white' },
    { id: 'noise' as const, label: 'Ruído', icon: Volume2, active: 'bg-amber-600 text-white' },
    { id: '3d' as const, label: 'Mapa 3D 🆕', icon: Box, active: 'bg-purple-600 text-white' },
  ];

  return (
    <div className="relative w-full h-[550px] rounded-3xl overflow-hidden shadow-md border border-slate-200">

      {/* Leaflet 2D Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0 absolute inset-0"
        style={{ display: is3D ? 'none' : 'block' }}
      />

      {/* Mapbox 3D Container */}
      <div
        ref={mapboxContainerRef}
        className="w-full h-full z-0 absolute inset-0"
        style={{ display: is3D ? 'block' : 'none' }}
      />

      {/* 3D Mode banner */}
      {is3D && !MAPBOX_TOKEN && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 shadow-lg max-w-sm text-center">
          <p className="text-xs font-bold text-amber-800">⚠️ Token Mapbox não configurado</p>
          <p className="text-[10px] text-amber-700 mt-1">
            Defina <code className="bg-amber-100 px-1 rounded">VITE_MAPBOX_TOKEN</code> no <code>.env</code> para ativar o mapa 3D completo com edificações e satélite.
            <br/>O mapa 3D funciona em modo básico sem token.
          </p>
        </div>
      )}

      {/* 3D Mode overlay indicator */}
      {is3D && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-purple-900/80 backdrop-blur text-white text-[10px] font-black px-3 py-1.5 rounded-full border border-purple-500/40 flex items-center gap-1.5">
          <Box className="w-3 h-3 text-purple-300" />
          Mapa 3D — Balões de KPI
        </div>
      )}

      {/* Camera/Focus buttons */}
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
          <span>Ver Todos</span>
        </button>
      </div>

      {/* Layer Control */}
      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-slate-200 flex flex-col space-y-1">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center gap-1">
          <Layers className="w-3 h-3 text-orange-500" /> Camadas
        </span>

        {layerButtons.map(lb => {
          const Icon = lb.icon;
          const isActive = activeLayer === lb.id;
          return (
            <button
              key={lb.id}
              onClick={() => setActiveLayer(lb.id)}
              className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-xl font-bold transition-all text-left ${
                isActive ? lb.active : 'text-slate-700 hover:bg-slate-100'
              } ${lb.id === '3d' ? 'border border-purple-200' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{lb.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
