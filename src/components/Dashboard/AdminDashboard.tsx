import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, Store, Product, Goal, AppSettings } from '@/src/types';
import { 
  Settings, Users, Store as StoreIcon, Package, Target, LogOut, 
  Trash2, Edit, Plus, Image as ImageIcon, Save, Check, Star, TrendingUp, BarChart3
} from 'lucide-react';
import { cn, isCurrencyProduct } from '@/src/lib/utils';
import { format } from 'date-fns';
import IndicatorManager from './IndicatorManager';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'users' | 'stores' | 'products' | 'goals' | 'goals_focus' | 'productions' | 'settings' | 'indicators';

export default function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [productions, setProductions] = useState<any[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (confirmingId) {
      const timer = setTimeout(() => setConfirmingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingId]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data } = await supabase.from('users')
          .select('*, stores(name, code)')
          .order('name');
        if (data) setUsers(data as any);
      } else if (activeTab === 'stores') {
        const { data } = await supabase.from('stores').select('*').order('code');
        if (data) setStores(data);
      } else if (activeTab === 'products') {
        const { data } = await supabase.from('products').select('*').order('block');
        if (data) setProducts(data);
      } else if (activeTab === 'goals' || activeTab === 'goals_focus') {
        const { data } = await supabase.from('goals').select('*');
        if (data) setGoals(data);
      } else if (activeTab === 'productions') {
        const { data } = await supabase.from('productions')
          .select('*, product:products(*), user:users(*)')
          .order('created_at', { ascending: false })
          .limit(100);
        if (data) setProductions(data);
      } else if (activeTab === 'settings') {
        const { data } = await supabase.from('settings').select('*').single();
        if (data) setSettings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (id === user.id) return alert('Você não pode excluir a si mesmo');
    
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }

    try {
      setLoading(true);
      await supabase.from('users').delete().eq('id', id);
      setConfirmingId(null);
      await fetchData();
    } catch (err: any) {
      alert('Erro ao excluir usuário: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduction = async (id: string) => {
    console.log('Attempting to delete production:', id);
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    
    try {
      setLoading(true);
      const { error } = await supabase.from('productions').delete().eq('id', id);
      if (error) {
        console.error('Supabase error deleting production:', error);
        throw error;
      }
      console.log('Production deleted successfully');
      alert('Lançamento excluído!');
      setConfirmingId(null);
      await fetchData();
    } catch (err: any) {
      console.error('Catch error deleting production:', err);
      alert('Erro ao excluir: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f8f8]">
      {/* Header */}
      <header className="bg-ferrari text-white p-4 flex items-center justify-between shadow-xl border-b-4 border-ferrari-dark">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
            <span className="text-ferrari font-black italic text-sm">S3</span>
          </div>
          <div>
            <h2 className="brand-title text-sm block">ADMIN PAINEL</h2>
            <p className="text-[10px] opacity-80 font-bold uppercase">{user.name}</p>
          </div>
        </div>
        <button onClick={onLogout} className="p-2 hover:bg-ferrari-dark rounded-full transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap justify-center bg-white border-b border-slate-200">
        {[
          { id: 'users', label: 'Usuários', icon: Users },
          { id: 'stores', label: 'Lojas', icon: StoreIcon },
          { id: 'products', label: 'Produtos', icon: Package },
          { id: 'goals', label: 'Metas', icon: Target },
          { id: 'goals_focus', label: 'Metas Foco', icon: Star },
          { id: 'productions', label: 'Produções', icon: TrendingUp },
          { id: 'indicators', label: 'Indicadores', icon: TrendingUp },
          { id: 'settings', label: 'Config', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center sm:space-x-2 p-2 sm:px-4 sm:py-3 text-[9px] sm:text-xs font-bold transition-all border-b-2 basis-1/4 sm:basis-auto",
              activeTab === tab.id 
                ? "text-red-600 border-red-600 bg-red-50/50" 
                : "text-slate-500 border-transparent"
            )}
          >
            <tab.icon className="w-4 h-4 sm:w-4 sm:h-4 shrink-0" />
            <span className="text-center sm:text-left leading-tight">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="max-w-md mx-auto space-y-4">
            {activeTab === 'users' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800">Gerenciar Usuários</h3>
                </div>
                {users.map(u => (
                  <div key={u.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-700">{u.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">
                        {u.matricula} • {u.profile}
                      </p>
                      {(u as any).stores ? (
                        <p className="text-[10px] text-red-600 font-bold mt-0.5 flex items-center">
                          <StoreIcon className="w-3 h-3 mr-1" />
                          [{(u as any).stores.code}] {(u as any).stores.name}
                        </p>
                      ) : (
                        <div className="mt-1">
                          <select 
                            className="text-[10px] p-1 bg-slate-50 border rounded font-bold text-slate-500"
                            onChange={async (e) => {
                              const storeId = e.target.value;
                              if (storeId) {
                                await supabase.from('users').update({ store_id: storeId }).eq('id', u.id);
                                fetchData();
                              }
                            }}
                          >
                            <option value="">Vincular Loja</option>
                            {stores.map(s => <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                       <button 
                        onClick={() => handleDeleteUser(u.id)} 
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          confirmingId === u.id ? "bg-red-600 text-white font-bold text-[10px]" : "text-slate-400 hover:text-red-500"
                        )}
                      >
                        {confirmingId === u.id ? "CONFIRMAR" : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'stores' && (
              <StoreManager stores={stores} onRefresh={fetchData} />
            )}

            {activeTab === 'products' && (
              <ProductManager products={products} onRefresh={fetchData} />
            )}

            {activeTab === 'goals' && (
              <GoalManager goals={goals.filter(g => !g.is_focus)} onRefresh={() => { fetchData(); }} focusMode={false} />
            )}

            {activeTab === 'goals_focus' && (
              <GoalManager goals={goals.filter(g => g.is_focus)} onRefresh={() => { fetchData(); }} focusMode={true} />
            )}

            {activeTab === 'productions' && (
              <div className="space-y-2">
                <h3 className="font-bold text-slate-800 mb-2">Últimos 100 Lançamentos</h3>
                {productions.map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 text-xs">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-red-600">{p.user?.name}</span>
                      <span className="text-slate-400">{format(new Date(p.created_at), 'dd/MM HH:mm')}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <div>
                        <p className="font-bold">{p.product?.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{p.product?.block} • {format(new Date(p.date), 'dd/MM/yyyy')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black">
                          {isCurrencyProduct(p.product?.name, p.product?.block, p.product?.segment) 
                            ? `R$ ${p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : `${p.amount} un.`}
                        </p>
                        <p className="text-[9px] text-slate-400">ID: {p.id.substring(0,8)}</p>
                      </div>
                    </div>
                    <div className="flex justify-end mt-2 pt-2 border-t border-slate-50">
                      <button 
                        onClick={() => handleDeleteProduction(p.id)}
                        disabled={loading}
                        className={cn(
                          "flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-all font-bold text-[10px] uppercase font-black",
                          loading ? "bg-slate-100 text-slate-400 cursor-not-allowed" : 
                          confirmingId === p.id ? "bg-red-600 text-white animate-pulse" : "bg-red-50 text-red-600 hover:bg-red-100"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>
                          {loading ? 'Excluindo...' : confirmingId === p.id ? 'CLIQUE PARA CONFIRMAR EXCLUSÃO' : 'Excluir Lançamento'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
                {productions.length === 0 && <p className="text-center py-10 text-slate-400">Nenhuma produção encontrada.</p>}
              </div>
            )}

            {activeTab === 'settings' && (
              <SettingsManager settings={settings} onRefresh={fetchData} />
            )}

            {activeTab === 'indicators' && (
              <IndicatorManager />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StoreManager({ stores, onRefresh }: { stores: Store[], onRefresh: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!name || code.length !== 4) {
      alert('Nome da loja é obrigatório e o código deve ter 4 números.');
      return;
    }
    setLoading(true);
    try {
      await supabase.from('stores').insert([{ name, code }]);
      setName('');
      setCode('');
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao adicionar loja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    
    setLoading(true);
    try {
      await supabase.from('stores').delete().eq('id', id);
      setConfirmingId(null);
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao excluir loja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-3 text-xs uppercase tracking-widest">Nova Loja</h3>
        <div className="flex flex-col space-y-2">
          <div className="flex space-x-2">
            <input 
              type="text" 
              placeholder="0000" 
              maxLength={4}
              className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-center"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <input 
              type="text" 
              placeholder="Nome da loja" 
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button 
              onClick={handleAdd}
              disabled={loading || !name || code.length !== 4}
              className={cn(
                "p-2 rounded-lg transition-all",
                (loading || !name || code.length !== 4) ? "bg-slate-300" : "bg-red-600 text-white"
              )}
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      {stores.map(s => (
        <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-mono font-bold text-slate-600 border border-slate-200">{s.code}</span>
            <span className="font-bold text-slate-700">{s.name}</span>
          </div>
          <button 
            onClick={() => handleDelete(s.id)} 
            disabled={loading}
            className={cn(
              "p-2 rounded-lg transition-all font-black uppercase text-[10px]",
              loading ? "opacity-50" : 
              confirmingId === s.id ? "bg-red-600 text-white px-3" : "text-slate-400 hover:text-red-500 bg-slate-50"
            )}
          >
            {loading && confirmingId === s.id ? "Excluindo..." : confirmingId === s.id ? "CONFIRMAR" : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      ))}
    </div>
  );
}

function ProductManager({ products, onRefresh }: { products: Product[], onRefresh: () => void }) {
  const [form, setForm] = useState<Partial<Product>>({ 
    block: 'Créditos', 
    multiplier: 0, 
    specialist_rate: 0,
    leader_rate: 0, 
    segment: '',
    is_focus: false 
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterBlock, setFilterBlock] = useState<'Todos' | 'Créditos' | 'Comissões' | 'Conquista'>('Todos');

  const handleSave = async () => {
    if (!form.name || !form.block) {
      alert('Preencha o nome e o bloco do produto.');
      return;
    }
    
    if (form.block === 'Conquista' && !form.segment) {
      alert('Selecione um segmento para este bloco.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        segment: (form.block === 'Conquista') ? form.segment : null,
        is_focus: !!form.is_focus,
        specialist_rate: form.specialist_rate || 0,
        leader_rate: form.leader_rate || 0
      };
      
      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert([payload]);
        if (error) throw error;
      }
      
      setForm({ block: 'Créditos', multiplier: 0, specialist_rate: 0, leader_rate: 0, segment: '', is_focus: false });
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar produto: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (p: Product) => {
    setForm(p);
    setEditingId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setForm({ block: 'Créditos', multiplier: 0, specialist_rate: 0, leader_rate: 0, segment: '', is_focus: false });
    setEditingId(null);
  };

  const filteredProducts = products.filter(p => filterBlock === 'Todos' || p.block === filterBlock);

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-tighter italic">
            {editingId ? 'Editar Produto' : 'Cadastrar Novo Produto'}
          </h3>
          {editingId && (
            <button onClick={cancelEdit} className="text-[10px] font-black text-gray-400 hover:text-ferrari uppercase">
              Cancelar Edição
            </button>
          )}
        </div>
        
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Bloco de Produção</label>
          <select 
            className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-ferrari outline-none transition-all"
            value={form.block}
            onChange={(e) => setForm({...form, block: e.target.value as any, segment: ''})}
          >
            <option value="Créditos">Créditos</option>
            <option value="Comissões">Comissões</option>
            <option value="Conquista">Conquista</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nome do Produto / Serviço</label>
          <input 
            type="text" 
            placeholder="Ex: Abertura de Conta" 
            className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-ferrari outline-none transition-all"
            value={form.name || ''}
            onChange={(e) => setForm({...form, name: e.target.value})}
          />
        </div>

        <div className="flex items-center space-x-2 bg-yellow-50 p-3 rounded-xl border border-yellow-100">
          <input 
            type="checkbox" 
            id="is_focus"
            className="w-5 h-5 text-ferrari rounded focus:ring-ferrari border-gray-300"
            checked={form.is_focus || false}
            onChange={(e) => setForm({...form, is_focus: e.target.checked})}
          />
          <label htmlFor="is_focus" className="text-xs font-black text-yellow-700 uppercase flex items-center">
            <Star className={cn("w-4 h-4 mr-1", form.is_focus ? "fill-yellow-500" : "")} />
            Marcar Produto como FOCO do Mês
          </label>
        </div>

        {(form.block === 'Conquista') && (
          <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-black text-ferrari uppercase ml-1">Segmento do Cliente (Obrigatório)</label>
            <input 
              type="text" 
              list="segments-list"
              className="w-full px-3 py-3 bg-red-50 border border-red-100 rounded-xl text-sm font-bold focus:border-ferrari outline-none transition-all text-ferrari"
              value={form.segment || ''}
              onChange={(e) => setForm({...form, segment: e.target.value})}
              placeholder="Digite ou selecione o segmento"
              required
            />
            <datalist id="segments-list">
              {Array.from(new Set(products.map(p => p.segment).filter(Boolean))).map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Multiplicador</label>
            <input 
              type="number" 
              placeholder="0.000" 
              step="0.001"
              className="w-full px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:border-ferrari outline-none transition-all"
              value={isNaN(form.multiplier ?? 0) ? 0 : form.multiplier}
              onChange={(e) => setForm({...form, multiplier: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
            />
          </div>
          <div className="space-y-1">
            {/* Empty space or additional field */}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-blue-600 uppercase ml-1">Remuneração Esp. Std.</label>
            <input 
              type="number" 
              placeholder="0.00%" 
              step="0.01"
              className="w-full px-3 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold focus:border-ferrari outline-none transition-all text-blue-700"
              value={isNaN(form.specialist_rate ?? 0) ? 0 : form.specialist_rate}
              onChange={(e) => setForm({...form, specialist_rate: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-green-600 uppercase ml-1">Remuneração Líder</label>
            <input 
              type="number" 
              placeholder="0.00%" 
              step="0.01"
              className="w-full px-3 py-3 bg-green-50 border border-green-100 rounded-xl text-sm font-bold focus:border-ferrari outline-none transition-all text-green-700"
              value={isNaN(form.leader_rate ?? 0) ? 0 : form.leader_rate}
              onChange={(e) => setForm({...form, leader_rate: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
            />
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-ferrari text-white py-4 rounded-xl font-black uppercase text-xs shadow-lg border-b-4 border-ferrari-dark hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? 'SALVANDO...' : <><Save className="w-4 h-4 mr-2" /> {editingId ? 'ATUALIZAR PRODUTO' : 'ADICIONAR PRODUTO'}</>}
        </button>

        <div className="flex bg-slate-50 p-1 rounded-xl gap-1 border border-slate-100">
          {['Todos', 'Créditos', 'Comissões', 'Conquista'].map((b) => (
            <button
              key={b}
              onClick={() => setFilterBlock(b as any)}
              className={cn(
                "flex-1 py-2 text-[8px] font-black rounded-lg transition-all",
                filterBlock === b ? "bg-white text-ferrari shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {b.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Produtos Cadastrados ({filterBlock === 'Todos' ? products.length : filteredProducts.length})</h3>
        {filteredProducts.map(p => (
          <div key={p.id} className={cn(
            "bg-white p-4 rounded-2xl shadow-sm border flex items-center justify-between group",
            p.is_focus ? "border-yellow-200 ring-2 ring-yellow-400/20" : "border-slate-100"
          )}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-[8px] font-black px-2 py-0.5 rounded-full uppercase",
                  p.block === 'Conquista' ? "bg-orange-100 text-orange-600" :
                  p.block === 'Comissões' ? "bg-green-100 text-green-600" :
                  "bg-blue-100 text-blue-600"
                )}>
                  {p.block}
                </span>
                {p.segment && (
                  <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-gray-800 text-white">
                    {p.segment}
                  </span>
                )}
                {p.is_focus && (
                  <span className="text-[8px] font-black px-2 py-0.5 rounded-full uppercase bg-yellow-400 text-white flex items-center">
                    <Star className="w-2.5 h-2.5 mr-0.5 fill-white" />
                    FOCO
                  </span>
                )}
              </div>
              <h4 className="font-black text-gray-800 text-sm mt-1 flex items-center">
                {p.name}
              </h4>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                <p className="text-[10px] text-gray-400 font-bold">MULT: {p.multiplier}</p>
                <p className="text-[10px] text-blue-500 font-bold uppercase">Esp: {p.specialist_rate}%</p>
                <p className="text-[10px] text-green-500 font-bold uppercase">Líder: {p.leader_rate}%</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => startEdit(p)}
                disabled={loading}
                className="p-2 text-gray-200 hover:text-blue-500 transition-colors disabled:opacity-30"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={async () => {
                if (confirmingId !== p.id) {
                  setConfirmingId(p.id);
                  return;
                }
                setLoading(true);
                try {
                  await supabase.from('products').delete().eq('id', p.id);
                  setConfirmingId(null);
                  await onRefresh();
                } catch (err: any) {
                  alert('Erro ao excluir: ' + err.message);
                } finally {
                  setLoading(false);
                }
              }} disabled={loading} className={cn(
                "p-2 rounded-lg transition-all font-black uppercase text-[10px]",
                loading && confirmingId === p.id ? "bg-red-100 text-red-600" :
                confirmingId === p.id ? "bg-red-600 text-white px-3" : "text-gray-200 hover:text-ferrari bg-slate-50"
              )}>
                {loading && confirmingId === p.id ? "Excluindo..." : confirmingId === p.id ? "CONFIRMAR" : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalManager({ goals, onRefresh, focusMode = false }: { goals: Goal[], onRefresh: () => void | Promise<void>, focusMode?: boolean }) {
  const [form, setForm] = useState<Partial<Goal>>({ profile: 'Especialista Santander', block: 'Créditos', value: 0, is_focus: focusMode });
  const [filterProfile, setFilterProfile] = useState<'Líder' | 'Especialista'>('Líder');

  // Update form if focusMode changes
  useEffect(() => {
    setForm(prev => ({ ...prev, is_focus: focusMode }));
  }, [focusMode]);
  const [loading, setLoading] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.profile || !form.block) return;
    setLoading(true);
    try {
      if (editingGoal) {
        const { error } = await supabase.from('goals').update({ 
          value: form.value, 
          profile: form.profile, 
          block: form.block,
          is_focus: !!form.is_focus 
        }).eq('id', editingGoal.id);
        
        if (error) throw error;
      } else {
        const { data: existing, error: selectError } = await supabase.from('goals')
          .select('*')
          .eq('profile', form.profile)
          .eq('block', form.block)
          .eq('is_focus', !!form.is_focus)
          .maybeSingle(); 
        
        if (selectError) {
          throw selectError;
        }
        
        if (existing) {
          const { error: updateError } = await supabase.from('goals').update({ 
            value: form.value,
            profile: form.profile,
            block: form.block,
            is_focus: !!form.is_focus
          }).eq('id', existing.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from('goals').insert([{
            profile: form.profile,
            block: form.block,
            value: form.value,
            is_focus: !!form.is_focus
          }]);
          if (insertError) {
            throw insertError;
          }
        }
      }
      alert('Meta salva com sucesso!');
      setEditingGoal(null);
      setForm({ profile: 'Especialista Santander', block: 'Créditos', value: 0, is_focus: focusMode });
      await onRefresh();
    } catch (err: any) {
      console.error('Goal saving error:', err);
      // More descriptive error for constraints
      if (err.code === '23505') {
        alert('Erro: Já existe uma meta cadastrada para este perfil e bloco. Tente editar a meta existente.');
      } else {
        alert('Erro ao salvar meta: ' + (err.message || 'Erro desconhecido.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (g: Goal) => {
    setEditingGoal(g);
    setForm({ profile: g.profile, block: g.block, value: g.value, is_focus: g.is_focus });
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

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-bold text-slate-800">
            {editingGoal ? 'Editar Meta' : focusMode ? 'Configurar Metas FOCO' : 'Configurar Metas'}
          </h3>
          {editingGoal && (
            <button 
              onClick={() => {
                setEditingGoal(null);
                setForm({ profile: 'Especialista Santander', block: 'Créditos', value: 0, is_focus: focusMode });
              }}
              className="text-[10px] font-bold text-red-600 uppercase"
            >
              Cancelar
            </button>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Perfil</label>
          <select 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
            value={form.profile}
            onChange={(e) => setForm({...form, profile: e.target.value as any})}
          >
            <option value="Líder">Líder</option>
            <option value="Especialista Santander">Especialista Santander</option>
            <option value="Especialista de loja">Especialista de loja</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Bloco</label>
          <select 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
            value={form.block}
            onChange={(e) => setForm({...form, block: e.target.value as any})}
          >
            <option value="Créditos">Créditos</option>
            <option value="Comissões">Comissões</option>
            <option value="Conquista">Conquista</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Valor da Meta</label>
          <input 
            type="number" 
            placeholder="Valor da Meta" 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold"
            value={isNaN(form.value ?? 0) ? 0 : form.value}
            onChange={(e) => setForm({...form, value: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
          />
        </div>
        {/* Removed redundant focus checkbox because of tab separation */}
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-red-600 text-white py-3 rounded-lg font-black uppercase text-xs shadow-md border-b-4 border-red-800 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'SALVANDO...' : editingGoal ? 'Atualizar Meta' : 'Salvar Meta'}
        </button>

        <div className="flex bg-slate-50 p-1 rounded-xl gap-1 border border-slate-100">
          <button
            onClick={() => setFilterProfile('Líder')}
            className={cn(
              "flex-1 py-2 text-[10px] font-black rounded-lg transition-all",
              filterProfile === 'Líder' ? "bg-white text-ferrari shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
            )}
          >
            LÍDER
          </button>
          <button
            onClick={() => setFilterProfile('Especialista')}
            className={cn(
              "flex-1 py-2 text-[10px] font-black rounded-lg transition-all",
              filterProfile === 'Especialista' ? "bg-white text-ferrari shadow-sm border border-slate-100" : "text-slate-400 hover:text-slate-600"
            )}
          >
            ESPECIALISTAS
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Metas Atuais ({filterProfile === 'Líder' ? 'Líder' : 'Especialistas'})</h4>
        {goals
          .filter(g => filterProfile === 'Líder' ? g.profile === 'Líder' : g.profile.includes('Especialista'))
          .map(g => (
          <div key={g.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center text-xs">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <p className="font-bold text-slate-700">{g.profile}</p>
                {g.is_focus && (
                  <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">FOCO</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">{g.block}</p>
              <p className="font-black text-red-600 mt-0.5">R$ {g.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="flex space-x-1">
              <button 
                onClick={() => handleEdit(g)}
                className="p-2 text-slate-400 hover:text-blue-500 bg-slate-50 rounded-lg transition-colors"
                title="Editar"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => handleDelete(g.id)}
                className={cn(
                  "p-2 rounded-lg transition-all font-black uppercase text-[10px]",
                  confirmingId === g.id ? "bg-red-600 text-white px-3" : "text-slate-400 hover:text-red-600 bg-slate-50"
                )}
                title="Excluir"
              >
                {confirmingId === g.id ? "CONFIRMAR" : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
        {goals.length === 0 && <p className="text-center py-6 text-slate-400 text-xs italic">Nenhuma meta configurada.</p>}
      </div>
    </div>
  );
}

function SettingsManager({ settings, onRefresh }: { settings: AppSettings | null, onRefresh: () => void }) {
  const [url, setUrl] = useState(settings?.logo_url || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (settings) {
        await supabase.from('settings').update({ logo_url: url }).eq('id', settings.id);
      } else {
        await supabase.from('settings').insert([{ logo_url: url }]);
      }
      await onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar configurações: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-4">
      <h3 className="font-bold text-slate-800">Aparência do APP</h3>
      <div className="flex flex-col items-center space-y-3">
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50">
          {url ? <img src={url} className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-300" />}
        </div>
        <div className="w-full space-y-2">
          <label className="text-xs font-bold text-slate-600 ml-1">URL do Logo (Empresa)</label>
          <input 
            type="text" 
            placeholder="https://exemplo.com/logo.png" 
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-red-600 text-white py-2 rounded-lg font-bold flex items-center justify-center disabled:opacity-50"
        >
          {loading ? 'SALVANDO...' : <><Save className="w-4 h-4 mr-2" /> Salvar Configurações</>}
        </button>
      </div>
    </div>
  );
}
