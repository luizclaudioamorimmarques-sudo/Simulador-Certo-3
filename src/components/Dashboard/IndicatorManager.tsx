import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, Indicator, IndicatorRule } from '@/src/types';
import { Save, Plus, Trash2, Edit, TrendingUp, Info, Calendar, Lock } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function IndicatorManager({ user }: { user?: User }) {
  const [stores, setStores] = useState<any[]>([]);
  const isAdmin = user?.profile === 'Administrador';
  const userStoreId = user?.store_id || ((user as any)?.store?.id || (user as any)?.stores?.id);
  const [rules, setRules] = useState<IndicatorRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<IndicatorRule | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [ruleForm, setRuleForm] = useState<Partial<IndicatorRule>>({
    min_value: 0,
    max_value: 100,
    multiplier: 1,
    description: ''
  });
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch stores for NPS
      let query = supabase.from('stores').select('*').order('code');
      
      if (!isAdmin && userStoreId) {
        query = query.eq('id', userStoreId);
      }

      const { data: storesData } = await query;
      
      if (storesData) {
        setStores(storesData);
        if (storesData.length > 0 && !selectedStoreId) {
          setSelectedStoreId(storesData[0].id);
        }
      }

      const { data: ruleData } = await supabase.from('indicator_rules').select('*').eq('indicator_name', 'NPS').order('min_value', { ascending: false });
      if (ruleData && ruleData.length > 0) {
        setRules(ruleData);
      } else {
        // Create default NPS rules if empty
        const defaultRules = [
          { indicator_name: 'NPS', min_value: 95.01, max_value: 999, multiplier: 1.3, description: 'NPS > 95' },
          { indicator_name: 'NPS', min_value: 85.01, max_value: 95, multiplier: 1.15, description: '85 < NPS <= 95' },
          { indicator_name: 'NPS', min_value: 75.01, max_value: 85, multiplier: 1, description: '75 < NPS <= 85' },
          { indicator_name: 'NPS', min_value: 65.01, max_value: 75, multiplier: 0.85, description: '65 < NPS <= 75' },
          { indicator_name: 'NPS', min_value: 0, max_value: 65, multiplier: 0.5, description: 'NPS <= 65' },
        ];
        await supabase.from('indicator_rules').insert(defaultRules);
        const { data: reFetchRules } = await supabase.from('indicator_rules').select('*').eq('indicator_name', 'NPS').order('min_value', { ascending: false });
        if (reFetchRules) setRules(reFetchRules);
      }
    } catch (err) {
      console.error('Error fetching indicators:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateStoreNps = async (storeId: string, value: number) => {
    setLoading(true);
    try {
      await supabase.from('stores').update({ 
        nps: value,
        nps_updated_at: new Date().toISOString()
      }).eq('id', storeId);
      
      setEditingStoreId(null);
      await fetchData();
      // No alert here to keep flow fast
    } catch (err: any) {
      alert('Erro ao atualizar NPS: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async () => {
    setLoading(true);
    try {
      const payload = {
        indicator_name: 'NPS',
        min_value: ruleForm.min_value,
        max_value: ruleForm.max_value,
        multiplier: ruleForm.multiplier,
        description: ruleForm.description
      };

      if (editingRule) {
        await supabase.from('indicator_rules').update(payload).eq('id', editingRule.id);
      } else {
        await supabase.from('indicator_rules').insert([payload]);
      }

      setEditingRule(null);
      setRuleForm({ min_value: 0, max_value: 100, multiplier: 1, description: '' });
      fetchData();
      alert('Regra salva com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar regra: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta regra?')) return;
    setLoading(true);
    try {
      await supabase.from('indicator_rules').delete().eq('id', id);
      fetchData();
    } catch (err: any) {
      alert('Erro ao excluir regra: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-red-600" />
          <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">Período de Apuração</h3>
        </div>
        <input 
          type="month" 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:border-red-600 transition-all"
        />
      </div>

      {/* NPS Per Store Section */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">NPS por Loja</h3>
          </div>
          
          <div className="w-full sm:w-64">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1">
              {isAdmin ? 'Selecionar Unidade' : 'Sua Unidade'}
            </label>
            <select 
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              disabled={!isAdmin}
              className={cn(
                "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-700 outline-none transition-all shadow-sm",
                isAdmin ? "focus:border-red-600" : "opacity-70 bg-slate-100 cursor-not-allowed"
              )}
            >
              {!isAdmin && stores.length === 0 && <option value="">Carregando unidade...</option>}
              {stores.map(s => (
                <option key={s.id} value={s.id}>
                  [{s.code}] {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          {selectedStoreId ? (
            (() => {
              const s = stores.find(st => st.id === selectedStoreId);
              if (!s) return null;
              return (
                <div key={s.id} className="p-8 rounded-[40px] bg-slate-50 border border-slate-200 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center mb-6">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] leading-none block mb-2">Loja {s.code}</span>
                    <h4 className="font-black text-slate-800 text-xl italic">{s.name}</h4>
                  </div>
                  
                  <div className="bg-white p-8 rounded-[35px] border-2 border-slate-100 shadow-xl text-center mb-8 relative w-full group overflow-hidden">
                    <div className="absolute inset-0 bg-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] font-black text-slate-400 block mb-2 tracking-widest">PONTOS ATUAIS</span>
                    <p className="text-7xl font-black text-red-600 tracking-tighter italic">
                      {s.nps || 0}
                    </p>
                  </div>

                  {editingStoreId === s.id ? (
                    <div className="w-full space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="space-y-1 text-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novo Valor do NPS</label>
                        <input 
                          type="number"
                          className="w-full px-6 py-4 bg-white border-2 border-red-200 rounded-[25px] text-3xl font-black text-center shadow-lg focus:ring-4 focus:ring-red-600/10 outline-none transition-all"
                          defaultValue={s.nps || 0}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateStoreNps(s.id, parseFloat((e.target as HTMLInputElement).value));
                            if (e.key === 'Escape') setEditingStoreId(null);
                          }}
                          onBlur={(e) => handleUpdateStoreNps(s.id, parseFloat(e.target.value))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingStoreId(null)}
                          className="flex-1 py-3 bg-white border border-slate-200 text-slate-400 font-bold rounded-2xl hover:bg-slate-100 transition-all uppercase text-xs"
                        >
                          Efetivar alteração
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setEditingStoreId(s.id)}
                      className="w-full py-5 bg-red-600 text-white font-black text-sm uppercase rounded-[25px] hover:bg-red-700 active:scale-95 transition-all shadow-lg border-b-4 border-red-800 flex items-center justify-center space-x-2"
                    >
                      <Edit className="w-5 h-5" />
                      <span>Alterar Pontuação</span>
                    </button>
                  )}

                  {s.nps_updated_at && (
                    <p className="mt-6 text-[10px] font-bold text-slate-400 uppercase flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Última atualização: {new Date(s.nps_updated_at).toLocaleDateString('pt-BR')} 
                      {' às '}
                      {new Date(s.nps_updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-[35px] flex items-center justify-center mx-auto mb-4 border border-slate-200">
                <TrendingUp className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-400 font-black italic uppercase text-xs tracking-widest">
                Selecione uma loja para gerenciar o NPS
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Rules Section - Only for Admin */}
      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rules List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Faixas de Aceleração / Redução</h3>
              <Info className="w-4 h-4 text-slate-300" />
            </div>
            
            <div className="space-y-2">
              {rules.map(rule => (
                <div key={rule.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between group">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={cn(
                        "text-[10px] font-black px-2 py-0.5 rounded-full uppercase",
                        rule.multiplier > 1 ? "bg-green-100 text-green-600" :
                        rule.multiplier < 1 ? "bg-red-100 text-red-600" :
                        "bg-blue-100 text-blue-600"
                      )}>
                        {rule.multiplier > 1 ? `Acelera ${(rule.multiplier - 1) * 100}%` :
                         rule.multiplier < 1 ? `Reduz ${(1 - rule.multiplier) * 100}%` :
                         "Sem alteração"}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        MULT: {rule.multiplier.toFixed(2)}x
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-700 text-sm">{rule.description}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                      Mín: {rule.min_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Máx: {rule.max_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingRule(rule);
                        setRuleForm(rule);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rule Form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 h-fit sticky top-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
              {editingRule ? 'Editar Faixa' : 'Adicionar Nova Faixa'}
            </h3>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descrição</label>
              <input 
                type="text" 
                value={ruleForm.description}
                onChange={(e) => setRuleForm({...ruleForm, description: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner"
                placeholder="Ex: NPS > 95"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor Mínimo</label>
                <input 
                  type="number" 
                  value={isNaN(ruleForm.min_value ?? 0) ? 0 : ruleForm.min_value}
                  onChange={(e) => setRuleForm({...ruleForm, min_value: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor Máximo</label>
                <input 
                  type="number" 
                  value={isNaN(ruleForm.max_value ?? 0) ? 0 : ruleForm.max_value}
                  onChange={(e) => setRuleForm({...ruleForm, max_value: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Multiplicador (Ex: 1.3 para +30%, 0.85 para -15%)</label>
              <input 
                type="number" 
                step="0.01"
                value={isNaN(ruleForm.multiplier ?? 0) ? 1 : ruleForm.multiplier}
                onChange={(e) => setRuleForm({...ruleForm, multiplier: e.target.value === '' ? 1 : parseFloat(e.target.value)})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner"
              />
            </div>

            <div className="flex flex-col space-y-2 pt-2">
              <button 
                onClick={handleSaveRule}
                disabled={loading}
                className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>{editingRule ? 'ATUALIZAR FAIXA' : 'ADICIONAR FAIXA'}</span>
              </button>
              {editingRule && (
                <button 
                  onClick={() => {
                    setEditingRule(null);
                    setRuleForm({ min_value: 0, max_value: 100, multiplier: 1, description: '' });
                  }}
                  className="w-full py-2 text-[10px] font-black text-slate-400 uppercase"
                >
                  Cancelar Edição
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-200 text-center">
          <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
            <Lock className="w-8 h-8 text-slate-300" />
          </div>
          <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-2">Gerenciamento de Regras Restrito</h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto font-medium">As regras de cálculo de NPS são definidas globalmente pelo departamento administrativo e não podem ser alteradas por líderes de unidade.</p>
        </div>
      )}
    </div>
  );
}
