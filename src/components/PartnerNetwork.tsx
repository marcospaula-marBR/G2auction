import React from 'react';
import type { Partner } from '../types/auction';
import { ShieldCheck, Star, Phone, MapPin, UserCheck } from 'lucide-react';

interface PartnerNetworkProps {
  partners: Partner[];
}

export const PartnerNetwork: React.FC<PartnerNetworkProps> = ({ partners }) => {
  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Rede de Especialistas Credenciados G2
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-2">Ecossistema de Parceiros Homologados</h2>
          <p className="text-xs text-slate-500 mt-0.5">Profissionais verificados por laudos de desempenho, pontualidade e Partner Trust Score.</p>
        </div>

        <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center space-x-1.5">
          <UserCheck className="w-4 h-4" />
          <span>Solicitar Novo Credenciamento</span>
        </button>
      </div>

      {/* Grid de Parceiros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {partners.map((partner) => (
          <div
            key={partner.id}
            className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="flex items-start space-x-4">
              <img
                src={partner.avatar}
                alt={partner.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 shadow-2xs"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-base">{partner.name}</h3>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Trust Score: {partner.trustScore}/100
                  </span>
                </div>

                <p className="text-xs font-bold text-orange-600">{partner.role}</p>
                
                <div className="flex items-center text-xs text-slate-500 space-x-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{partner.city} - {partner.state}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 font-medium leading-relaxed">
              "{partner.specialty}"
            </p>

            {/* Stats do Parceiro */}
            <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Avaliação</span>
                <span className="font-extrabold text-slate-800 flex items-center justify-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> {partner.rating}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Trabalhos</span>
                <span className="font-extrabold text-slate-800">{partner.completedJobsCount} concluídos</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Pontualidade</span>
                <span className="font-extrabold text-emerald-600">{partner.onTimeRate}%</span>
              </div>
            </div>

            {/* Contato Rápido */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-emerald-600" /> {partner.phone}
              </span>
              <button className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xs">
                Contratar para Imóvel
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};
