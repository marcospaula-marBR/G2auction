import React, { useEffect, useRef } from 'react';
import type { Property } from '../types/auction';
import { Layers, Shield, Droplets, Volume2, DollarSign, Target, Maximize2 } from 'lucide-react';
import L from 'leaflet';
import { getCityCoordinates } from '../utils/cityCoordinates';

interface PropertyMapProps {
  properties: Property[];
  selectedProperty?: Property;
  onSelectProperty: (property: Property) => void;
  activeLayer: 'default' | 'price' | 'flood' | 'safety' | 'noise';
  setActiveLayer: (layer: 'default' | 'price' | 'flood' | 'safety' | 'noise') => void;
}

export const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  selectedProperty,
  onSelectProperty,
  activeLayer,
  setActiveLayer,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Obtém coordenadas válidas de um imóvel (usando fallback por cidade/estado se lat/lng forem genéricos)
  const getPropertyCoords = (p: Property): { lat: number; lng: number } => {
    if (p.address && typeof p.address.lat === 'number' && typeof p.address.lng === 'number' && p.address.lat !== 0) {
      // Se tiver lat/lng válida
      return { lat: p.address.lat, lng: p.address.lng };
    }
    return getCityCoordinates(p.address?.city || (p as any).city, p.address?.state || (p as any).state);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Determina o centro inicial baseado no imóvel selecionado ou na primeira propriedade
    const initialTarget = selectedProperty
      ? getPropertyCoords(selectedProperty)
      : properties.length > 0
      ? getPropertyCoords(properties[0])
      : { lat: -23.5505, lng: -46.6333 };

    if (!mapInstanceRef.current) {
      // Inicializa o mapa diretamente nas coordenadas reais do imóvel (não mais em Campinas)
      const map = L.map(mapContainerRef.current).setView([initialTarget.lat, initialTarget.lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | G2 Geointeligência',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Limpar marcadores anteriores
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        map.removeLayer(layer);
      }
    });

    const bounds = L.latLngBounds([]);

    // Adicionar marcadores dos imóveis
    properties.forEach((p) => {
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
            ${p.acquisitionType || (p as any).sale_modality || 'Imóvel CAIXA'} • ${p.occupancyStatus || 'CAIXA'}
          </span>
          <h4 class="font-bold text-xs text-slate-900 leading-tight mb-1">${p.title || p.address?.street || 'Imóvel CAIXA'}</h4>
          <p class="text-xs font-extrabold text-emerald-700">Preço: R$ ${(p.secondAuctionPrice || p.estimatedMarketPrice || (p as any).sale_value || 0).toLocaleString('pt-BR')}</p>
          <p class="text-[11px] text-slate-500">Avaliado: R$ ${(p.appraisalValue || (p as any).appraisal_value || 0).toLocaleString('pt-BR')}</p>
          <div class="mt-2 flex gap-1">
            <span class="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">${p.address?.city || (p as any).city} / ${p.address?.state || (p as any).state}</span>
          </div>
        </div>
      `);

      marker.on('click', () => {
        onSelectProperty(p);
      });

      // Camadas visuais especiais
      if (activeLayer === 'flood' && p.floodRisk?.level && p.floodRisk.level !== 'Mínimo') {
        L.circle([coords.lat, coords.lng], {
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.35,
          radius: 600,
        }).addTo(map);
      }

      if (activeLayer === 'noise' && p.noiseIndex?.level?.includes('Intenso')) {
        L.circle([coords.lat, coords.lng], {
          color: '#f97316',
          fillColor: '#fdba74',
          fillOpacity: 0.35,
          radius: 500,
        }).addTo(map);
      }
    });

    // POSICIONAMENTO DINÂMICO E PRECISO DO MAPA:
    if (selectedProperty) {
      // Se houver imóvel selecionado, voa diretamente para as coordenadas dele com zoom aproximado 15
      const selectedCoords = getPropertyCoords(selectedProperty);
      map.flyTo([selectedCoords.lat, selectedCoords.lng], 15, { duration: 1.2 });
    } else if (bounds.isValid() && properties.length > 0) {
      // Se não houver imóvel selecionado, enquadra todos os imóveis da cidade/filtro
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [properties, selectedProperty, activeLayer]);

  const handleFocusSelectedProperty = () => {
    if (selectedProperty && mapInstanceRef.current) {
      const coords = getPropertyCoords(selectedProperty);
      mapInstanceRef.current.flyTo([coords.lat, coords.lng], 16, { duration: 1 });
    }
  };

  const handleFitAllBounds = () => {
    if (mapInstanceRef.current && properties.length > 0) {
      const bounds = L.latLngBounds([]);
      properties.forEach((p) => {
        const coords = getPropertyCoords(p);
        bounds.extend([coords.lat, coords.lng]);
      });
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    }
  };

  return (
    <div className="relative w-full h-[550px] rounded-3xl overflow-hidden shadow-md border border-slate-200">
      
      {/* Container Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Botões de Ação de Câmera/Foco no Canto Superior Esquerdo */}
      <div className="absolute top-4 left-4 z-10 flex flex-col space-y-2">
        {selectedProperty && (
          <button
            onClick={handleFocusSelectedProperty}
            className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2 rounded-2xl shadow-lg border border-slate-700 flex items-center space-x-1.5 transition-all transform active:scale-95"
            title="Focar mapa nas coordenadas exatas do imóvel selecionado"
          >
            <Target className="w-4 h-4 text-orange-400 animate-pulse" />
            <span>Focar no Imóvel ({selectedProperty.address?.city || 'Selecionado'})</span>
          </button>
        )}

        <button
          onClick={handleFitAllBounds}
          className="bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-xl shadow-md border border-slate-200 flex items-center space-x-1.5 transition-colors"
          title="Ver todos os imóveis no mapa"
        >
          <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Visão Geral do Mapa</span>
        </button>
      </div>

      {/* Controler de Camadas Flutuante */}
      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-slate-200 flex flex-col space-y-1">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center gap-1">
          <Layers className="w-3 h-3 text-orange-500" /> Camadas Geointeligentes
        </span>

        <button
          onClick={() => setActiveLayer('default')}
          className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-xl font-bold transition-all text-left ${
            activeLayer === 'default'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Visão Padrão</span>
        </button>

        <button
          onClick={() => setActiveLayer('price')}
          className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-xl font-bold transition-all text-left ${
            activeLayer === 'price'
              ? 'bg-orange-500 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>Preço/m² Entorno</span>
        </button>

        <button
          onClick={() => setActiveLayer('flood')}
          className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-xl font-bold transition-all text-left ${
            activeLayer === 'flood'
              ? 'bg-sky-600 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Droplets className="w-3.5 h-3.5 text-sky-400" />
          <span>Risco de Enchente</span>
        </button>

        <button
          onClick={() => setActiveLayer('safety')}
          className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-xl font-bold transition-all text-left ${
            activeLayer === 'safety'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-emerald-300" />
          <span>Segurança Pública</span>
        </button>

        <button
          onClick={() => setActiveLayer('noise')}
          className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-xl font-bold transition-all text-left ${
            activeLayer === 'noise'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 text-amber-300" />
          <span>Densidade de Ruído</span>
        </button>
      </div>

    </div>
  );
};
