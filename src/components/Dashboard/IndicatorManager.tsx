import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Indicator, IndicatorRule } from '@/src/types';
import { Save, Plus, Trash2, Edit, TrendingUp, Info, Calendar } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export default function IndicatorManager() {
  const [indicator, setIndicator] = useState<Indicator | null>(null);
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
  const [npsValue, setNpsValue] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: indData } = await supabase
        .from('indicators')
        .select('*')
        .eq('name', 'NPS')
        .eq('month', selectedMonth)
        .maybeSingle();

      if (indData) {
        setIndicator(indData);
        setNpsValue(indData.value);
      } else {
        // Prepare to create or just show zero
        setIndicator(null);
        setNpsValue(0);
      }

      const { data: ruleData } = await supabase.from('indicator_rules').select('*').eq('indicator_name', 'NPS').order('min_value', { ascending: false });
      if (ruleData && ruleData.length > 0) {
        setRules(ruleData);
      } else {
        // Create default NPS rules if empty (only once)
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

  const handleUpdateNps = async () => {
    setLoading(true);
    try {
      if (indicator) {
        await supabase.from('indicators').update({ value: npsValue, updated_at: new Date().toISOString() }).eq('id', indicator.id);
      } else {
        await supabase.from('indicators').insert([{ 
          name: 'NPS', 
          value: npsValue, 
          month: selectedMonth, 
          updated_at: new Date().toISOString() 
        }]);
      }
      alert('NPS atualizado com sucesso!');
      fetchData();
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

      {/* NPS Current Value Card */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Valor Atual do NPS</h3>
        <div className="relative mb-6">
          <div className="text-6xl font-black italic text-red-600 tracking-tighter">
            {npsValue}
          </div>
          <div className="absolute -top-2 -right-6 bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded-full border border-red-200">
            PONTOS
          </div>
        </div>
        
        <div className="w-full max-w-xs space-y-3">
          <input 
            type="number" 
            value={isNaN(npsValue) ? 0 : npsValue}
            onChange={(e) => setNpsValue(e.target.value === '' ? 0 : parseFloat(e.target.value))}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-center font-black text-xl text-slate-700 shadow-inner outline-none focus:border-red-600 transition-all"
            placeholder="00"
          />
          <button 
            onClick={handleUpdateNps}
            disabled={loading}
            className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg border-b-4 border-red-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>ATUALIZAR NPS</span>
          </button>
        </div>
      </div>

      {/* Rules Section */}
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
                    Mín: {rule.min_value} | Máx: {rule.max_value}
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
    </div>
  );
}
