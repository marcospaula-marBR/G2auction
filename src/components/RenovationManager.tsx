import React, { useState } from 'react';
import type { Property } from '../types/auction';
import { Camera, Plus } from 'lucide-react';
import { formatCurrencyBRL } from '../utils/financial';

interface RenovationItem {
  id: string;
  category: string;
  task: string;
  estimatedCost: number;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  assignedContractor: string;
}

interface RenovationManagerProps {
  property: Property;
}

export const RenovationManager: React.FC<RenovationManagerProps> = ({ property }) => {
  const [items, setItems] = useState<RenovationItem[]>([
    { id: '1', category: 'Pintura', task: 'Pintura total das paredes internas em tinta acrílica Premium fosco', estimatedCost: 8500, status: 'Em Andamento', assignedContractor: 'Eng. Ricardo Silveira' },
    { id: '2', category: 'Elétrica', task: 'Troca de fiação antiga e substituição do quadro de disjuntores por padrão moderno', estimatedCost: 6200, status: 'Pendente', assignedContractor: 'Eng. Ricardo Silveira' },
    { id: '3', category: 'Banheiro', task: 'Troca de louças, metais, box de vidro temperado e rejunte', estimatedCost: 12400, status: 'Concluído', assignedContractor: 'Empreiteiro Mendes' },
    { id: '4', category: 'Piso', task: 'Instalação de piso vinílico de alta resistência na sala e dormitórios', estimatedCost: 14500, status: 'Pendente', assignedContractor: 'Empreiteiro Mendes' },
  ]);

  const completedCount = items.filter((i) => i.status === 'Concluído').length;
  const progressPercent = Math.round((completedCount / items.length) * 100);
  const totalCost = items.reduce((acc, curr) => acc + curr.estimatedCost, 0);

  const toggleStatus = (id: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          const nextStatus = i.status === 'Pendente' ? 'Em Andamento' : i.status === 'Em Andamento' ? 'Concluído' : 'Pendente';
          return { ...i, status: nextStatus };
        }
        return i;
      })
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header com Progresso da Reforma */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
            Modo de Campo & Gestão de Obra
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-2">Cronograma de Reforma Express - {property.address.neighborhood}</h2>
          <p className="text-xs text-slate-500 mt-0.5">Acompanhamento físico-financeiro para otimização de tempo de permanência (Holding Period).</p>
        </div>

        <div className="w-full md:w-64 space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center text-xs font-bold text-slate-800">
            <span>Progresso da Obra:</span>
            <span className="text-orange-600 font-extrabold">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 to-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
            <span>Orçamento Obra: {formatCurrencyBRL(totalCost)}</span>
            <span>{completedCount}/{items.length} tarefas</span>
          </div>
        </div>
      </div>

      {/* Galeria de Fotos Antes vs Depois */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-orange-600" />
            <h3 className="font-extrabold text-sm text-slate-900">Vistoria de Campo & Fotos Antes/Depois</h3>
          </div>
          <button className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
            <Plus className="w-3.5 h-3.5" /> Nova Foto da Obra
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 group">
            <img src={property.images[0]} alt="Antes da reforma" className="w-full h-40 object-cover" />
            <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              SALA - ANTES
            </span>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 group">
            <img src={property.images[1]} alt="Em andamento" className="w-full h-40 object-cover" />
            <span className="absolute top-2 left-2 bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              COZINHA - EM REFORMA
            </span>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 group">
            <img src={property.images[2]} alt="Depois projetado" className="w-full h-40 object-cover" />
            <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              SUÍTE - PROJETO 3D
            </span>
          </div>
        </div>
      </div>

      {/* Tabela de Tarefas */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700">
          <span>Checklist de Obras & Empreiteiros</span>
          <span className="text-slate-500">Clique para atualizar status</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleStatus(item.id)}
              className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-start space-x-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center font-bold text-xs ${
                    item.status === 'Concluído'
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : item.status === 'Em Andamento'
                      ? 'bg-orange-500 border-orange-600 text-white'
                      : 'bg-white border-slate-300 text-transparent'
                  }`}
                >
                  ✓
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-900">{item.task}</span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">Responsável: {item.assignedContractor}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4 self-end sm:self-auto">
                <span className="font-black text-slate-900">{formatCurrencyBRL(item.estimatedCost)}</span>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                    item.status === 'Concluído'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.status === 'Em Andamento'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
