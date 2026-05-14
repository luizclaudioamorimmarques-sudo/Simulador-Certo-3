import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, Product, Production, Goal, Reminder } from '@/src/types';
import { 
  LogOut, Plus, Search, Calendar, Package, ArrowUpRight, 
  TrendingUp, Wallet, Clock, Bell, Trash2, Star, Edit
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  getCurrentRioDate, getBusinessDaysInMonth, 
  getElapsedBusinessDays, getRemainingBusinessDays 
} from '@/src/lib/calendar';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'home' | 'productions' | 'report' | 'variable';

export default function SpecialistStoreDashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [productions, setProductions] = useState<(Production & { product: Product })[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editingProduction, setEditingProduction] = useState<(Production & { product: Product }) | null>(null);
  const [loading, setLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>({
    Créditos: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
    Comissões: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
    Conquista: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
  });

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (confirmingId) {
      const timer = setTimeout(() => setConfirmingId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmingId]);

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedMonth]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: pData, error: pErr } = await supabase.from('products').select('*');
      if (pErr) throw pErr;
      if (pData) setProducts(pData);

      const { data: gData, error: gErr } = await supabase.from('goals').select('*').eq('profile', user.profile);
      if (gErr) throw gErr;
      if (gData) setGoals(gData);

      const startDate = `${selectedMonth}-01`;
      // Use a more reliable way to get the last day of the month
      const [year, month] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`;

      console.log('Fetching productions for:', { userId: user.id, startDate, endDate });

      const { data: prodData, error: prodErr } = await supabase
        .from('productions')
        .select('*, product:products(*)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      
      if (prodErr) throw prodErr;
      console.log('Productions found:', prodData?.length);
      if (prodData) {
        setProductions(prodData);
        const newStats = {
          Créditos: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
          Comissões: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
          Conquista: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
        };

        gData?.forEach(g => {
          if (newStats[g.block as keyof typeof newStats]) {
            if (g.is_focus) {
              newStats[g.block as keyof typeof newStats].meta_foco = g.value;
            } else {
              newStats[g.block as keyof typeof newStats].meta = g.value;
            }
          }
        });

        // Fetch NPS Multiplier
        const { data: npsData } = await supabase
          .from('indicators')
          .select('value')
          .eq('name', 'NPS')
          .eq('month', selectedMonth)
          .maybeSingle();
        const npsValue = npsData?.value || 0;
        
        const { data: rulesData } = await supabase.from('indicator_rules').select('*').eq('indicator_name', 'NPS');
        let npsMultiplier = 1;
        if (rulesData) {
          const applicableRule = rulesData.find(r => npsValue >= r.min_value && npsValue <= r.max_value);
          if (applicableRule) npsMultiplier = applicableRule.multiplier;
        }

        prodData.forEach(p => {
          if (p.product) {
            const amount = parseFloat(p.amount?.toString() || '0');
            const multiplier = parseFloat(p.product.multiplier?.toString() || '0');
            const faturamento = amount * multiplier;
            
            const rate = p.product.specialist_rate ?? p.product.variable_rate ?? 0;
            // Apply NPS Multiplier here
            const rem_var = (faturamento * (rate / 100)) * npsMultiplier;
            
            if (newStats[p.product.block as keyof typeof newStats]) {
              newStats[p.product.block as keyof typeof newStats].faturamento += faturamento;
              if (p.product.is_focus) {
                newStats[p.product.block as keyof typeof newStats].faturamento_foco += faturamento;
              }
              newStats[p.product.block as keyof typeof newStats].remuneração += rem_var;
            }
          }
        });
        setStats(newStats);
      }

      const { data: rData } = await supabase
        .from('reminders')
        .select('*')
        .eq('to_user_id', user.id)
        .eq('read', false);
      if (rData) setReminders(rData);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteProduction = async (id: string) => {
    console.log('Specialist Dashboard: Deleting production', id);
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    
    try {
      setLoading(true);
      const { error } = await supabase.from('productions').delete().eq('id', id);
      if (error) throw error;
      console.log('Production deleted');
      alert('Lançamento excluído com sucesso!');
      setConfirmingId(null);
      await fetchData();
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Erro ao excluir: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalFaturamento = stats.Créditos.faturamento + stats.Comissões.faturamento + stats.Conquista.faturamento;
  const totalRemuneração = stats.Créditos.remuneração + stats.Comissões.remuneração + stats.Conquista.remuneração;
  const totalMeta = stats.Créditos.meta + stats.Comissões.meta + stats.Conquista.meta;
  const atingimento = totalMeta > 0 ? (totalFaturamento / totalMeta) * 100 : 0;

  // Use the selected month for calendar calculations
  const displayDate = new Date(selectedMonth + '-01T12:00:00');
  const totalDays = getBusinessDaysInMonth(displayDate);
  const elapsedDays = selectedMonth === format(new Date(), 'yyyy-MM') ? getElapsedBusinessDays(getCurrentRioDate()) : totalDays;
  const remainingDays = selectedMonth === format(new Date(), 'yyyy-MM') ? getRemainingBusinessDays(getCurrentRioDate()) : 0;
  
  const months = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, 'yyyy-MM');
  });

  return (
    <div className="flex flex-col h-full bg-[#f8f8f8]">
      {/* Profile Header */}
      <div className="p-4 flex items-center gap-3 border-b bg-white shadow-sm">
        <div className="w-12 h-12 rounded-full border-2 border-ferrari overflow-hidden bg-gray-200 shadow-inner">
          <div className="w-full h-full bg-gradient-to-tr from-gray-300 to-gray-100 flex items-center justify-center font-black text-gray-500 uppercase">
            {user.name.substring(0, 2)}
          </div>
        </div>
        <div className="flex-1">
          <p className="font-black text-sm leading-tight text-gray-800 tracking-tight">{user.name}</p>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
            {user.profile}
          </p>
          {((user as any).store || (user as any).stores) && (
            <p className="text-[10px] text-red-600 font-bold mt-0.5">
              [{(user as any).store?.code || (user as any).stores?.code}] {(user as any).store?.name || (user as any).stores?.name}
            </p>
          )}
        </div>
        <button onClick={onLogout} className="p-2 text-gray-300 hover:text-ferrari transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {/* Month Selector */}
        <div className="px-4 pt-4">
          <div className="bg-white p-2 rounded-2xl flex items-center justify-between border border-gray-100 shadow-sm">
            <span className="text-[10px] font-black text-gray-400 uppercase ml-2">Período de Referência</span>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-gray-50 border-none text-xs font-black text-ferrari rounded-xl px-4 py-2 focus:ring-0 appearance-none cursor-pointer"
            >
              {months.map(m => (
                <option key={m} value={m}>
                  {format(new Date(m + '-01T12:00:00'), 'MMMM / yyyy', { locale: ptBR }).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ferrari"></div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {activeTab === 'home' && (
              <>
                {/* Gauge Section */}
                <div className="bg-white p-6 rounded-[32px] text-center shadow-sm border border-gray-100 italic">
                  <div className="relative w-40 h-40 mx-auto">
                    <svg viewBox="0 0 36 36" className="w-full h-full">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#eee" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#D40000" strokeWidth="3" strokeDasharray={`${Math.min(atingimento, 100)}, 100`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-gray-800">{atingimento.toFixed(0)}%</span>
                      <span className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">Produção/Mês</span>
                    </div>
                  </div>
                  <div className="mt-4 bg-gray-50 p-3 rounded-2xl flex justify-between border border-gray-100">
                    <div className="text-center px-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase">DIAS ÚTEIS</p>
                      <p className="text-sm font-black">{elapsedDays} / {totalDays}</p>
                    </div>
                    <div className="w-[1px] bg-gray-200"></div>
                    <div className="text-center px-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase">RESTANTE</p>
                      <p className="text-sm font-black">{remainingDays}</p>
                    </div>
                  </div>
                </div>

                {/* Remuneration & Blocks */}
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">REMUNERRAÇÃO VARIÁVEL TOTAL</p>
                    <p className="text-2xl font-black text-ferrari italic">R$ {totalRemuneração.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border-l-[6px] border-blue-500 shadow-sm">
                      <span className="text-xs font-black text-gray-600">CRÉDITOS</span>
                      <span className="text-sm font-black italic">R$ {stats.Créditos.faturamento.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border-l-[6px] border-green-500 shadow-sm">
                      <span className="text-xs font-black text-gray-600">COMISSÕES</span>
                      <span className="text-sm font-black italic">R$ {stats.Comissões.faturamento.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white p-4 rounded-xl border-l-[6px] border-orange-500 shadow-sm">
                      <span className="text-xs font-black text-gray-600">CONQUISTA</span>
                      <span className="text-sm font-black italic">R$ {stats.Conquista.faturamento.toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </div>

                {/* Faturamento Produtos Foco */}
                <div className="bg-orange-50/50 p-5 rounded-[32px] border border-orange-100 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                    <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Faturamento Produtos Foco</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.keys(stats).map(k => {
                      const focusFat = (stats as any)[k].faturamento_foco || 0;
                      const focusGoal = (stats as any)[k].meta_foco || 0;
                      const focusPercent = focusGoal > 0 ? Math.min((focusFat / focusGoal) * 100, 100) : 0;
                      const focusDisplayPercent = focusGoal > 0 ? Math.round((focusFat / focusGoal) * 100) : 0;

                      return (
                        <div key={`${k}-focus`} className="space-y-1">
                          <div className="flex justify-between items-end">
                            <span className="text-[9px] font-bold text-orange-400 uppercase">{k}</span>
                            <div className="text-right">
                              <span className="text-[10px] font-black text-slate-800">R$ {focusFat.toLocaleString('pt-BR')}</span>
                              {focusGoal > 0 && (
                                <span className={cn(
                                  "ml-2 text-[10px] font-black",
                                  focusDisplayPercent >= 100 ? "text-green-600" : "text-orange-600"
                                )}>
                                  {focusDisplayPercent}%
                                </span>
                              )}
                            </div>
                          </div>
                          {focusGoal > 0 && (
                            <div className="h-1 w-full bg-orange-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                                style={{ width: `${focusPercent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reminders */}
                {reminders.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Lembretes do Líder</h4>
                    {reminders.map(r => (
                      <div key={r.id} className="bg-ferrari text-white p-4 rounded-2xl shadow-lg flex items-start space-x-3">
                        <Bell className="w-5 h-5 opacity-50 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-bold leading-tight">{r.message}</p>
                          <button 
                            onClick={async () => {
                              await supabase.from('reminders').update({ read: true }).eq('id', r.id);
                              fetchData();
                            }}
                            className="text-[10px] bg-white/20 px-2 py-1 rounded mt-2 font-black uppercase hover:bg-white/30 transition-colors"
                          >
                            Entendido
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'productions' && (
              <ProductionForm 
                products={products} 
                user={user} 
                editingData={editingProduction}
                onRefresh={() => { 
                  setActiveTab('report'); 
                  setEditingProduction(null);
                  fetchData(); 
                }} 
              />
            )}

            {activeTab === 'report' && (
              <div className="space-y-2">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Histórico Recente</h3>
                {productions.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-[9px] font-black text-ferrari uppercase flex items-center gap-1">
                        {p.product?.block}
                        {p.product?.is_focus && <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />}
                      </p>
                      <h4 className="font-black text-gray-800 text-sm tracking-tight">
                        {p.product?.name}
                      </h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">{format(new Date(p.date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right flex items-center space-x-2">
                      <div className="mr-2">
                        <p className="font-black text-gray-900 leading-none">
                          {p.product?.block === 'Conquista' ? `${p.amount} un.` : `R$ ${p.amount.toLocaleString()}`}
                        </p>
                        <p className="text-[10px] text-gray-400">Fat: R$ {(p.amount * (p.product?.multiplier || 0)).toFixed(2)}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingProduction(p);
                          setActiveTab('productions');
                        }}
                        className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduction(p.id)} 
                        disabled={loading}
                        className={cn(
                          "p-2 rounded-lg transition-all font-black uppercase text-[10px]",
                          loading && confirmingId === p.id ? "bg-red-100 text-red-600" :
                          confirmingId === p.id ? "bg-ferrari text-white px-4 animate-pulse" : "text-gray-300 hover:text-ferrari bg-slate-50"
                        )}
                      >
                         {loading && confirmingId === p.id ? "..." : confirmingId === p.id ? "CONFIRME A EXCLUSÃO" : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'variable' && (
              <div className="space-y-4">
                <div className="bg-ferrari text-white p-8 rounded-[40px] shadow-2xl border-b-[8px] border-ferrari-dark flex flex-col items-center text-center">
                  <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mb-2">Remuneração Acumulada</p>
                  <h3 className="text-4xl font-black italic tracking-tighter">R$ {totalRemuneração.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                  <Wallet className="w-12 h-12 opacity-20 mt-4" />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Nav */}
      <div className="bg-white border-t flex justify-around p-3 pb-6 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        {[
          { id: 'home', label: 'INÍCIO', icon: '🏠' },
          { id: 'report', label: 'HISTÓRIA', icon: '📊' },
          { id: 'productions', label: 'PRODUZIR', icon: '➕' },
          { id: 'variable', label: 'GANHOS', icon: '💰' },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              "flex flex-col items-center transition-all",
              activeTab === tab.id ? "text-ferrari scale-110" : "text-gray-300 hover:text-gray-400"
            )}
          >
            <span className="text-xl mb-1">{tab.icon}</span>
            <span className="text-[8px] font-black uppercase">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductionForm({ products, user, onRefresh, editingData }: { products: Product[], user: User, onRefresh: () => void, editingData?: (Production & { product: Product }) | null }) {
  const [date, setDate] = useState(editingData ? format(new Date(editingData.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [block, setBlock] = useState(editingData?.product.block || '');
  const [segment, setSegment] = useState(editingData?.product.segment || '');
  const [productId, setProductId] = useState(editingData?.product_id || '');
  const [amount, setAmount] = useState(editingData?.amount.toString() || '');
  const [loading, setLoading] = useState(false);

  // Set values when editingData changes
  useEffect(() => {
    if (editingData) {
      setDate(format(new Date(editingData.date), 'yyyy-MM-dd'));
      setBlock(editingData.product.block);
      setSegment(editingData.product.segment || '');
      setProductId(editingData.product_id);
      setAmount(editingData.amount.toString());
    }
  }, [editingData]);

  // Clear sub-fields when parent selection changes, but ONLY if NOT initializing from editingData
  useEffect(() => {
    if (!editingData || editingData.product.block !== block) {
      setProductId('');
      if (block !== 'Conquista') setSegment('');
    }
  }, [block]);

  useEffect(() => {
    if (!editingData || (editingData.product.block === 'Conquista' && editingData.product.segment !== segment)) {
      setProductId('');
    }
  }, [segment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || amount === '') return;
    setLoading(true);
    
    try {
      if (!productId) {
        alert('Por favor, selecione um produto.');
        setLoading(false);
        return;
      }
      if (amount === '' || parseFloat(amount) <= 0) {
        alert('Por favor, insira uma quantidade ou valor válido.');
        setLoading(false);
        return;
      }

      const payload = {
        user_id: user.id,
        date,
        product_id: productId,
        amount: parseFloat(amount)
      };

      let res;
      if (editingData) {
        res = await supabase.from('productions').update(payload).eq('id', editingData.id);
      } else {
        res = await supabase.from('productions').insert([payload]);
      }
      
      if (res.error) throw res.error;
      
      alert('Produção salva com sucesso!');
      onRefresh();
    } catch (err: any) {
      console.error('Error saving production:', err);
      alert('Erro ao salvar produção: ' + (err.message || 'Verifique sua conexão e tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === productId);
  
  // Filter products based on block and segment
  const filteredProducts = products.filter(p => {
    if (!block) return false;
    if (p.block !== block) return false;
    if (block === 'Conquista') {
      if (!segment) return false;
      return p.segment === segment;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const conquistaSegments = Array.from(new Set(products
    .filter(p => p.block === 'Conquista' && p.segment)
    .map(p => p.segment as string)
  )).sort();

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-slate-800">{editingData ? 'Editar Produção' : 'Lançar Produção'}</h3>
        {editingData && (
          <button 
            type="button"
            onClick={() => onRefresh()}
            className="text-[10px] font-black text-slate-400 uppercase hover:text-ferrari"
          >
            Cancelar Edição
          </button>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data</label>
        <div className="relative">
          <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="date" 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bloco de Produção</label>
        <div className="relative">
          <Package className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <select 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none font-bold"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            required
          >
            <option value="">Selecione o bloco</option>
            <option value="Créditos">Créditos</option>
            <option value="Comissões">Comissões</option>
            <option value="Conquista">Conquista</option>
          </select>
        </div>
      </div>

      {block === 'Conquista' && (
        <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="text-[10px] font-bold text-orange-500 uppercase ml-1">Segmento do Cliente</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-orange-400" />
            <select
              className="w-full pl-10 pr-4 py-2 bg-orange-50 border border-orange-200 rounded-xl text-sm appearance-none font-bold text-orange-700"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              required
            >
              <option value="">Selecione o segmento</option>
              {conquistaSegments.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Produto</label>
        <div className="relative">
          <Package className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <select 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            disabled={!block || (block === 'Conquista' && !segment)}
          >
            <option value="">
              {!block ? 'Selecione o bloco primeiro' : (block === 'Conquista' && !segment) ? 'Selecione o segmento primeiro' : 'Selecione o produto'}
            </option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.is_focus ? '⭐ ' : ''}{p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
          {block === 'Conquista' ? 'Quantidade (Unidades)' : 'Valor da Produção'}
        </label>
        <div className="relative">
          <TrendingUp className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="number"
            step={block === 'Conquista' ? "1" : "0.01"}
            placeholder={block === 'Conquista' ? "0" : "0,00"}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
      </div>

      {selectedProduct && (
        <div className="bg-slate-100 p-3 rounded-2xl flex justify-between items-center text-xs">
          <div>
            <p className="text-slate-500 font-bold uppercase text-[9px]">Faturamento estimado</p>
            <p className="text-slate-800 font-black">R$ {(parseFloat(amount || '0') * selectedProduct.multiplier).toLocaleString()}</p>
          </div>
          <ArrowUpRight className="text-green-600 w-5 h-5" />
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !productId}
        className={cn(
          "w-full py-3 rounded-2xl font-black text-white shadow-lg transition-all",
          loading || !productId ? "bg-slate-300 cursor-not-allowed" : "bg-[#FF0000] hover:bg-red-700 active:scale-95"
        )}
      >
        {loading ? "Processando..." : editingData ? "ATUALIZAR PRODUÇÃO" : "INCLUIR PRODUÇÃO"}
      </button>
    </form>
  );
}

function Check({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
}
