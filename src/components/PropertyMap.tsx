import React, { useEffect, useRef } from 'react';
import type { Property } from '../types/auction';
import { Layers, Shield, Droplets, Volume2, DollarSign } from 'lucide-react';
import L from 'leaflet';

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

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Centro padrão em Campinas/SP
      const map = L.map(mapContainerRef.current).setView([-22.8984, -47.0521], 11);

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

    // Adicionar marcadores dos imóveis
    properties.forEach((p) => {
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-8 h-8 ${
              selectedProperty?.id === p.id
                ? 'bg-red-600 ring-4 ring-orange-400 scale-125'
                : 'bg-orange-500 hover:bg-orange-600'
            } rounded-full text-white font-extrabold text-xs flex items-center justify-center shadow-lg cursor-pointer transition-all">
              ${p.apparentDiscountPercentage}%
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([p.address.lat, p.address.lng], { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div class="p-2 max-w-xs font-sans">
          <span class="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 block mb-1">
            ${p.acquisitionType} • ${p.occupancyStatus}
          </span>
          <h4 class="font-bold text-xs text-slate-900 leading-tight mb-1">${p.title}</h4>
          <p class="text-xs font-extrabold text-emerald-700">Mínimo 2ª Praça: R$ ${p.secondAuctionPrice.toLocaleString('pt-BR')}</p>
          <p class="text-[11px] text-slate-500">Avaliado: R$ ${p.appraisalValue.toLocaleString('pt-BR')} (${p.apparentDiscountPercentage}% deságio)</p>
          <div class="mt-2 flex gap-1">
            <span class="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">${p.area}m²</span>
            <span class="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">${p.bedrooms} dorms</span>
          </div>
        </div>
      `);

      marker.on('click', () => {
        onSelectProperty(p);
      });

      // Camadas visuais especiais
      if (activeLayer === 'flood' && p.floodRisk.level !== 'Mínimo') {
        L.circle([p.address.lat, p.address.lng], {
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.35,
          radius: 600,
        }).addTo(map);
      }

      if (activeLayer === 'noise' && p.noiseIndex.level.includes('Intenso')) {
        L.circle([p.address.lat, p.address.lng], {
          color: '#f97316',
          fillColor: '#fdba74',
          fillOpacity: 0.35,
          radius: 500,
        }).addTo(map);
      }
    });

    if (selectedProperty) {
      map.flyTo([selectedProperty.address.lat, selectedProperty.address.lng], 14, { duration: 1.2 });
    }
  }, [properties, selectedProperty, activeLayer]);

  return (
    <div className="relative w-full h-[550px] rounded-3xl overflow-hidden shadow-md border border-slate-200">
      
      {/* Container Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

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
