import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { Goal, User, Product, Store, BlockType, UserProfile } from '@/src/types';
import { Save, Plus, Trash2, Edit, Calendar, Target, Users, Store as StoreIcon, Star, RefreshCcw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GoalManagementProps {
  user: User;
  stores: Store[];
  products: Product[];
  onRefresh: () => void;
}

export default function GoalManagement({ user, stores, products, onRefresh }: GoalManagementProps) {
  const [subTab, setSubTab] = useState<'create' | 'copy'>('create');
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    fetchGoals();
  }, [currentMonth]);

  async function fetchGoals() {
    setLoading(true);
    try {
      const userStoreId = user.store_id || ((user as any).store?.id || (user as any).stores?.id);
      const isAdmin = user.profile === 'Administrador';
      
      let query = supabase.from('goals')
        .select('*')
        .eq('month', currentMonth);
      
      if (!isAdmin && userStoreId) {
        query = query.eq('store_id', userStoreId);
      }

      const { data } = await query;
      if (data) setGoals(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sub tabs switch */}
      <div className="bg-white p-1 rounded-2xl border border-slate-100 flex shadow-sm">
        <button
          onClick={() => setSubTab('create')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase flex items-center justify-center space-x-2",
            subTab === 'create' ? "bg-red-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"
          )}
        >
          <Target className="w-4 h-4" />
          <span>Gerenciar Metas</span>
        </button>
        <button
          onClick={() => setSubTab('copy')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase flex items-center justify-center space-x-2",
            subTab === 'copy' ? "bg-red-600 text-white shadow-lg" : "text-slate-400 hover:bg-slate-50"
          )}
        >
          <RefreshCcw className="w-4 h-4" />
          <span>Manter Metas</span>
        </button>
      </div>

      {subTab === 'create' ? (
        <GoalForm 
          user={user} 
          stores={stores} 
          products={products} 
          onRefresh={() => { fetchGoals(); onRefresh(); }} 
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          goals={goals}
        />
      ) : (
        <MaintainGoals 
          user={user} 
          stores={stores} 
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          onRefresh={() => { fetchGoals(); onRefresh(); }}
        />
      )}
    </div>
  );
}

function GoalForm({ user, stores, products, onRefresh, month, onMonthChange, goals }: any) {
  const isAdmin = user.profile === 'Administrador';
  const userStoreId = user.store_id || ((user as any).store?.id || (user as any).stores?.id);
  
  const [form, setForm] = useState<Partial<Goal>>({ 
    profile: 'Líder', 
    block: 'Créditos', 
    value: 0, 
    is_focus: false, 
    month: month,
    store_id: isAdmin ? '' : userStoreId
  });
  
  const [loading, setLoading] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [filterStoreId, setFilterStoreId] = useState<string>(isAdmin ? 'all' : userStoreId);

  useEffect(() => {
    setForm(prev => ({ ...prev, month }));
  }, [month]);

  const handleSave = async () => {
    if (!form.profile || !form.block || !form.month || !form.store_id) {
       alert('Preencha Perfil, Bloco, Unidade e Valor.');
       return;
    }
    
    setLoading(true);
    try {
      if (editingGoal) {
        const { error } = await supabase.from('goals').update({ 
          value: form.value, 
          profile: form.profile, 
          block: form.block,
          is_focus: !!form.is_focus,
          month: form.month,
          store_id: form.store_id
        }).eq('id', editingGoal.id);
        
        if (error) throw error;
      } else {
        // Check for existing before insert (only if not editing)
        const { data: existing } = await supabase.from('goals')
          .select('id')
          .eq('profile', form.profile)
          .eq('block', form.block)
          .eq('is_focus', !!form.is_focus)
          .eq('month', form.month)
          .eq('store_id', form.store_id)
          .maybeSingle();
        
        if (existing) {
          const { error } = await supabase.from('goals').update({ value: form.value }).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('goals').insert([{
            profile: form.profile as UserProfile,
            block: form.block as BlockType,
            value: form.value,
            is_focus: !!form.is_focus,
            month: form.month,
            store_id: form.store_id
          }]);
          if (error) throw error;
        }
      }
      
      alert('Meta salva com sucesso!');
      setEditingGoal(null);
      setForm({ 
        profile: 'Líder', 
        block: 'Créditos', 
        value: 0, 
        is_focus: false, 
        month: month,
        store_id: isAdmin ? '' : userStoreId
      });
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar meta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (g: Goal) => {
    setEditingGoal(g);
    setForm({ 
      profile: g.profile, 
      block: g.block, 
      value: g.value, 
      is_focus: g.is_focus, 
      month: g.month,
      store_id: g.store_id
    });
  };

  const handleDelete = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setLoading(true);
    try {
      await supabase.from('goals').delete().eq('id', id);
      setConfirmingId(null);
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir meta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredGoals = goals.filter((g: Goal) => {
    if (filterStoreId === 'all') return true;
    return g.store_id === filterStoreId;
  });

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            {editingGoal ? 'Editar Meta' : 'Configurar Meta'}
          </h3>
          {editingGoal && (
            <button 
              onClick={() => {
                setEditingGoal(null);
                setForm({ profile: 'Líder', block: 'Créditos', value: 0, is_focus: false, month: month, store_id: isAdmin ? '' : userStoreId });
              }}
              className="text-[10px] font-black text-red-600 uppercase"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mês de Referência</label>
            <div className="grid grid-cols-2 gap-2">
              <select 
                className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:border-red-600 outline-none transition-all shadow-inner"
                value={month.split('-')[1]}
                onChange={(e) => {
                  const [y] = month.split('-');
                  onMonthChange(`${y}-${e.target.value}`);
                }}
              >
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                   <option key={m} value={m}>{format(new Date(2024, parseInt(m)-1, 1), 'MMMM', { locale: ptBR })}</option>
                ))}
              </select>
              <select 
                className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:border-red-600 outline-none transition-all shadow-inner"
                value={month.split('-')[0]}
                onChange={(e) => {
                  const [_, m] = month.split('-');
                  onMonthChange(`${e.target.value}-${m}`);
                }}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Unidade</label>
             <select 
                disabled={!isAdmin}
                className={cn(
                  "w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none transition-all shadow-inner",
                  isAdmin ? "focus:border-red-600" : "opacity-70"
                )}
                value={form.store_id || ''}
                onChange={(e) => setForm({...form, store_id: e.target.value})}
             >
                <option value="">Selecione a loja...</option>
                {stores.map((s: any) => <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>)}
             </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Perfil Profissional</label>
             <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:border-red-600 outline-none transition-all shadow-inner"
                value={form.profile}
                onChange={(e) => setForm({...form, profile: e.target.value as any})}
             >
                <option value="Líder">Líder</option>
                <option value="Especialista Santander">Especialista Santander</option>
                <option value="Especialista de loja">Especialista de loja</option>
             </select>
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bloco de Produção</label>
             <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:border-red-600 outline-none transition-all shadow-inner"
                value={form.block}
                onChange={(e) => setForm({...form, block: e.target.value as any})}
             >
                <option value="Créditos">Créditos</option>
                <option value="Comissões">Comissões</option>
                <option value="Conquista">Conquista</option>
             </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           <div className="space-y-1">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Valor Financeiro</label>
             <input 
              type="number"
              step="0.01"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-lg font-black italic text-red-600 outline-none focus:border-red-600 transition-all shadow-inner"
              value={isNaN(form.value ?? 0) ? 0 : form.value}
              onChange={(e) => setForm({...form, value: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
             />
           </div>
           <div className="flex items-center">
             <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner w-full mt-4">
               <input 
                type="checkbox" 
                id="goal_focus"
                className="w-5 h-5 text-red-600 border-slate-300 rounded focus:ring-red-500"
                checked={form.is_focus || false}
                onChange={(e) => setForm({...form, is_focus: e.target.checked})}
               />
               <label htmlFor="goal_focus" className="text-[10px] font-black text-slate-600 uppercase flex items-center cursor-pointer">
                 <Star className={cn("w-4 h-4 mr-2", form.is_focus ? "fill-red-600 text-red-600" : "text-slate-300")} />
                 Meta de Produtos Foco do Mês
               </label>
             </div>
           </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg border-b-4 border-red-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : editingGoal ? <Edit className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          <span>{editingGoal ? 'ATUALIZAR META' : 'SALVAR E PUBLICAR META'}</span>
        </button>
      </div>

      {/* List Card */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Metas Cadastradas</h3>
          {isAdmin && (
            <select 
              className="text-[10px] font-black bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 uppercase"
              value={filterStoreId}
              onChange={(e) => setFilterStoreId(e.target.value)}
            >
              <option value="all">Todas Unidades</option>
              {stores.map(s => <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>)}
            </select>
          )}
        </div>

        <div className="space-y-3">
          {filteredGoals.map((g: Goal) => (
            <div key={g.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between group">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={cn(
                    "text-[8px] font-black px-2 py-0.5 rounded-full uppercase",
                    g.block === 'Créditos' ? "bg-blue-100 text-blue-600" :
                    g.block === 'Comissões' ? "bg-green-100 text-green-600" :
                    "bg-orange-100 text-orange-600"
                  )}>
                    {g.block}
                  </span>
                  {g.is_focus && (
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-yellow-400 text-white">FOCO</span>
                  )}
                  {isAdmin && (
                    <span className="text-[8px] font-bold text-slate-400 uppercase">
                      [{stores.find(s => s.id === g.store_id)?.code}]
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-700 text-sm">{g.profile}</h4>
                <p className="text-lg font-black text-red-600 italic">
                  R$ {g.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => handleEdit(g)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                   <Edit className="w-4 h-4" />
                 </button>
                 <button onClick={() => handleDelete(g.id)} className={cn(
                   "p-2 rounded-xl transition-all",
                   confirmingId === g.id ? "bg-red-600 text-white" : "text-slate-400 hover:text-red-600"
                 )}>
                   {confirmingId === g.id ? 'OK' : <Trash2 className="w-4 h-4" />}
                 </button>
              </div>
            </div>
          ))}
          {filteredGoals.length === 0 && (
             <div className="py-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest italic opacity-40">
               Nenhuma meta cadastrada {filterStoreId !== 'all' ? 'nesta unidade' : ''}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MaintainGoals({ user, stores, month, onMonthChange, onRefresh }: any) {
  const [loading, setLoading] = useState(false);
  const [prevGoals, setPrevGoals] = useState<Goal[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const isAdmin = user.profile === 'Administrador';
  const userStoreId = user.store_id || ((user as any).store?.id || (user as any).stores?.id);

  const prevMonth = (() => {
    const [y, mm] = month.split('-').map(Number);
    const d = new Date(y, mm - 2, 1);
    return format(d, 'yyyy-MM');
  })();

  useEffect(() => {
    fetchPrevGoals();
  }, [month]);

  const fetchPrevGoals = async () => {
    setLoading(true);
    try {
      let query = supabase.from('goals').select('*').eq('month', prevMonth);
      if (!isAdmin && userStoreId) {
        query = query.eq('store_id', userStoreId);
      }
      const { data } = await query;
      if (data) setPrevGoals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(prevGoals.map(g => g.id));
    }
    setIsAllSelected(!isAllSelected);
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleEfetivar = async () => {
    if (selectedIds.length === 0) return alert('Selecione ao menos uma meta para manter.');
    
    setLoading(true);
    try {
      const goalsToCopy = prevGoals.filter(g => selectedIds.includes(g.id));
      
      const upserts = goalsToCopy.map(g => ({
        profile: g.profile,
        block: g.block,
        value: g.value,
        is_focus: g.is_focus,
        month: month,
        store_id: g.store_id
      }));

      for (const item of upserts) {
        const { data: existing } = await supabase.from('goals')
          .select('id')
          .eq('profile', item.profile)
          .eq('block', item.block)
          .eq('month', item.month)
          .eq('store_id', item.store_id)
          .eq('is_focus', item.is_focus)
          .maybeSingle();

        if (existing) {
          await supabase.from('goals').update({ value: item.value }).eq('id', existing.id);
        } else {
          await supabase.from('goals').insert([item]);
        }
      }

      alert(`${selectedIds.length} metas transportadas para ${month} com sucesso!`);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao efetivar metas: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-6">
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Portabilidade de Metas</h3>
          <p className="text-xs text-slate-500 font-medium text-center italic">
            Selecione as metas do mês anterior ({prevMonth}) para replicar no mês selecionado ({month}).
          </p>
          
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Metas Disponíveis ({prevMonth})</span>
              <span className="text-[8px] font-bold text-slate-400 italic">Clique para marcar as metas que deseja manter</span>
            </div>
            <button 
              onClick={toggleAll}
              className="px-3 py-1 bg-slate-50 text-[10px] font-black text-blue-600 uppercase rounded-lg border border-slate-100"
            >
              {isAllSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto px-1">
          {prevGoals.map(g => (
            <div 
              key={g.id} 
              onClick={() => toggleOne(g.id)}
              className={cn(
                "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between",
                selectedIds.includes(g.id) 
                  ? "bg-blue-50 border-blue-200 ring-2 ring-blue-500/10" 
                  : "bg-white border-slate-100 hover:border-slate-300"
              )}
            >
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                  selectedIds.includes(g.id) ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 bg-white"
                )}>
                  {selectedIds.includes(g.id) && <Save className="w-3 h-3" />}
                </div>
                <div>
                   <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                     {g.profile} • {g.block}
                     {g.is_focus && <span className="ml-2 text-[7px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded">FOCO</span>}
                   </p>
                   {isAdmin && (
                     <p className="text-[8px] font-bold text-slate-400 uppercase">
                       Unidade: {stores.find(s => s.id === g.store_id)?.name || 'N/A'}
                     </p>
                   )}
                </div>
              </div>
              <p className="text-sm font-black text-slate-700">
                R$ {g.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          ))}
          {prevGoals.length === 0 && !loading && (
             <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
               <RefreshCcw className="w-12 h-12 text-slate-300 mb-2" />
               <p className="text-xs font-black uppercase">Nenhuma meta em {prevMonth}</p>
             </div>
          )}
        </div>

        <button 
          onClick={handleEfetivar}
          disabled={loading || selectedIds.length === 0}
          className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl border-b-4 border-red-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span>EFETIVAR {selectedIds.length} METAS EM {month}</span>
        </button>
      </div>
    </div>
  );
}
