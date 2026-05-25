import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Goal, User, Product, Store } from '@/src/types';
import { Edit, Trash2, Calendar, Target, Users, Store as StoreIcon, Star } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GoalViewProps {
  user: User;
  stores: Store[];
}

export default function GoalView({ user, stores }: GoalViewProps) {
  const isAdmin = user.profile === 'Administrador';
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedProfile, setSelectedProfile] = useState<'Líder' | 'Especialista Santander'>('Líder');
  const [selectedStoreId, setSelectedStoreId] = useState<string>(isAdmin ? 'all' : (user.store_id || 'all'));
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, [selectedMonth, selectedProfile, selectedStoreId]);

  async function fetchGoals() {
    setLoading(true);
    try {
      let query = supabase.from('goals')
        .select('*')
        .eq('month', selectedMonth)
        .eq('profile', selectedProfile);

      if (selectedStoreId !== 'all') {
        query = query.eq('store_id', selectedStoreId);
      } else if (!isAdmin) {
        // Fallback for security if not admin and store is 'all'
        const storeId = user.store_id || ((user as any).store?.id || (user as any).stores?.id);
        if (storeId) {
          query = query.eq('store_id', storeId);
        }
      }

      const { data } = await query;
      if (data) setGoals(data);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  }

  const months = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, 'yyyy-MM');
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1" /> Período (Mês/Ano)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select 
                value={selectedMonth.split('-')[1]}
                onChange={(e) => {
                  const [y] = selectedMonth.split('-');
                  setSelectedMonth(`${y}-${e.target.value}`);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-red-600 transition-all shadow-sm"
              >
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                  <option key={m} value={m}>{format(new Date(2024, parseInt(m)-1, 1), 'MMMM', { locale: ptBR })}</option>
                ))}
              </select>
              <select 
                value={selectedMonth.split('-')[0]}
                onChange={(e) => {
                  const [_, m] = selectedMonth.split('-');
                  setSelectedMonth(`${e.target.value}-${m}`);
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-red-600 transition-all shadow-sm"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 flex items-center">
                <StoreIcon className="w-3 h-3 mr-1" /> Unidade
              </label>
              <select 
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm text-slate-700 outline-none focus:border-red-600 transition-all shadow-sm"
              >
                <option value="all">Todas as Unidades</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setSelectedProfile('Líder')}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-black rounded-lg transition-all uppercase flex items-center justify-center space-x-2",
              selectedProfile === 'Líder' ? "bg-white text-red-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Users className="w-3 h-3" />
            <span>Líder</span>
          </button>
          <button
            onClick={() => setSelectedProfile('Especialista Santander')}
            className={cn(
              "flex-1 py-2.5 text-[10px] font-black rounded-lg transition-all uppercase flex items-center justify-center space-x-2",
              selectedProfile === 'Especialista Santander' ? "bg-white text-red-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Target className="w-3 h-3" />
            <span>Especialista Santander</span>
          </button>
        </div>
      </div>

      {/* Goals Display */}
      <div className="space-y-6">
        <div className="flex items-center justify-between ml-2">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Metas Atuais ({selectedProfile})</h4>
          <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-lg uppercase">
            {goals.length} {goals.length === 1 ? 'Meta' : 'Metas'}
          </span>
        </div>
        
        {loading ? (
          <div className="py-10 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-red-600 border-t-transparent rounded-full" /></div>
        ) : goals.length > 0 ? (
          <div className="space-y-6">
            {['Créditos', 'Comissões', 'Conquista'].map(block => {
              const blockGoals = goals.filter(g => g.block === block);
              if (blockGoals.length === 0) return null;

              return (
                <div key={block} className="space-y-3">
                  <div className="flex items-center space-x-2 ml-2">
                    <div className={cn(
                      "w-1 h-3 rounded-full",
                      block === 'Créditos' ? "bg-blue-500" :
                      block === 'Comissões' ? "bg-green-500" :
                      "bg-orange-500"
                    )} />
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{block}</h5>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {blockGoals.map(g => (
                      <div key={g.id} className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex justify-between items-center group animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {g.is_focus && (
                              <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[8px] font-black uppercase flex items-center">
                                <Star className="w-2.5 h-2.5 mr-1 fill-yellow-500" /> FOCO
                              </span>
                            )}
                            {isAdmin && (
                              <span className="text-[8px] font-bold text-slate-400 uppercase">
                                UNIDADE: {stores.find(s => s.id === g.store_id)?.name || 'N/A'}
                              </span>
                            )}
                          </div>
                          <p className="text-2xl font-black text-slate-800 italic">
                            R$ {g.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-[32px] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
            <Target className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold text-sm">Nenhuma meta cadastrada para este perfil e período.</p>
          </div>
        )}
      </div>
    </div>
  );
}
