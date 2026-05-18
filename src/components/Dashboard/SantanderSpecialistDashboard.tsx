import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, Product, Production, Goal, Reminder } from '@/src/types';
import { LogOut, Plus, Search, TrendingUp, Wallet, Bell, Check, Star, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SantanderSpecialistDashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('home');
  const [remTab, setRemTab] = useState<'total' | 'mult'>('total');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [productions, setProductions] = useState<(Production & { product: Product })[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editingProduction, setEditingProduction] = useState<(Production & { product: Product }) | null>(null);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => { fetchData(); }, [activeTab, selectedMonth]);

  async function fetchData() {
    setLoading(true);
    try {
      const startDate = `${selectedMonth}-01`;
      const [year, month] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`;

      console.log('Fetching Santander productions for:', { userId: user.id, startDate, endDate });

      const [pRes, gRes, prodRes, rRes] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('goals').select('*').eq('profile', user.profile),
        supabase.from('productions')
          .select('*, product:products(*)')
          .eq('user_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        supabase.from('reminders').select('*').eq('to_user_id', user.id).eq('read', false)
      ]);

      console.log('Santander Productions found:', prodRes.data?.length);

      if (pRes.error) throw pRes.error;
      if (gRes.error) throw gRes.error;
      if (prodRes.error) throw prodRes.error;
      if (rRes.error) throw rRes.error;

      if (pRes.data) setProducts(pRes.data);
      if (gRes.data) setGoals(gRes.data);
      if (prodRes.data) setProductions(prodRes.data);
      if (rRes.data) setReminders(rRes.data);

      const newStats: any = {
        Créditos: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
        Comissões: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
        Conquista: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
      };
      
      gRes.data?.forEach(g => { 
        if (newStats[g.block]) {
          if (g.is_focus) {
            newStats[g.block].meta_foco = parseFloat(g.value?.toString() || '0');
          } else {
            newStats[g.block].meta = parseFloat(g.value?.toString() || '0');
          }
        }
      });

      // Calculate Production
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

      prodRes.data?.forEach(p => {
        if (p.product) {
          const amount = parseFloat(p.amount?.toString() || '0');
          const multiplier = parseFloat(p.product.multiplier?.toString() || '0');
          const fat = amount * multiplier;
          
          const rate = p.product.specialist_rate ?? p.product.variable_rate ?? 0;
          newStats[p.product.block].faturamento += fat;
          if (p.product.is_focus) {
            newStats[p.product.block].faturamento_foco += fat;
          }
          // Apply NPS Multiplier here
          newStats[p.product.block].remuneração += (fat * (rate / 100)) * npsMultiplier;
        }
      });
      setStats(newStats);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  const handleDeleteProduction = async (id: string) => {
    console.log('Santander Dashboard: Deleting production', id);
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    
    try {
      setLoading(true);
      const { error } = await supabase.from('productions').delete().eq('id', id);
      if (error) throw error;
      console.log('Santander production deleted');
      alert('Lançamento excluído com sucesso!');
      setConfirmingId(null);
      await fetchData();
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Erro ao excluir produção: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalFat = Object.values(stats).reduce((a: any, b: any) => a + b.faturamento, 0) as number;
  
  // Calculate Block Multiplier Logic
  const challenges = Object.keys(stats).map(k => {
    const s = stats[k];
    const blockMeta = s.meta || 0;
    const focusMeta = s.meta_foco || 0;
    const blockFat = s.faturamento || 0;
    const focusFat = s.faturamento_foco || 0;

    const blockAchieved = blockMeta > 0 ? (blockFat >= blockMeta) : false;
    const focusAchieved = focusMeta > 0 ? (focusFat >= focusMeta) : true;

    return {
      name: k,
      achieved: blockAchieved && focusAchieved,
      blockMeta,
      focusMeta,
      blockFat,
      focusFat
    };
  });

  const achievedCount = challenges.filter(c => c.achieved).length;
  const blockMultiplier = achievedCount === 3 ? 4 : achievedCount === 2 ? 3 : achievedCount === 1 ? 2 : 1;

  const totalRemBase = Object.values(stats).reduce((a: any, b: any) => a + b.remuneração, 0) as number;
  const totalRem = totalRemBase * blockMultiplier;
  const totalMeta = Object.values(stats).reduce((a: any, b: any) => a + b.meta, 0) as number;
  const atingimento = totalMeta > 0 ? (totalFat / totalMeta) * 100 : 0;

  const months = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, 'yyyy-MM');
  });

  return (
    <div className="flex flex-col h-full bg-[#f8f8f8] mb-12">
      <header className="bg-ferrari text-white p-4 flex items-center justify-between shadow-xl border-b-4 border-ferrari-dark">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white text-ferrari flex items-center justify-center font-black italic shadow-lg">{user.name[0]}</div>
          <div className="relative">
            <h2 className="brand-title text-sm">{user.name}</h2>
            <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">
              {user.profile}
            </p>
            {((user as any).store || (user as any).stores) && (
              <p className="text-[10px] text-white/90 font-bold mt-0.5">
                [{(user as any).store?.code || (user as any).stores?.code}] {(user as any).store?.name || (user as any).stores?.name}
              </p>
            )}
            {reminders.length > 0 && <Bell className="absolute -top-1 -right-4 w-3 h-3 text-yellow-300 animate-bounce" />}
          </div>
        </div>
        <button onClick={onLogout}><LogOut className="w-5 h-5 opacity-80" /></button>
      </header>

      <div className="flex bg-white border-b overflow-x-auto no-scrollbar">
        {[['home', 'Início', TrendingUp], ['prod', 'Produção', Plus], ['list', 'Resumo', Search], ['var', 'Ganhos', Wallet]].map(([id, label, Icon]: any) => (
          <button key={id} onClick={() => setActiveTab(id)} className={cn("flex-1 py-3 text-[10px] font-bold border-b-2 flex flex-col items-center", activeTab === id ? "text-red-600 border-red-600" : "text-slate-400 border-transparent")}>
            <Icon className="w-4 h-4 mb-1" />{label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        {/* Month Selector */}
        <div className="max-w-md mx-auto mb-4">
          <div className="bg-white p-2 rounded-2xl flex items-center justify-between border border-slate-100 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase ml-2">Mês de Referência</span>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border-none text-[10px] font-black text-red-600 rounded-xl px-3 py-2 uppercase"
            >
              {months.map(m => (
                <option key={m} value={m}>
                  {format(new Date(m + '-01T12:00:00'), 'MMMM / yyyy', { locale: ptBR }).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <div className="flex justify-center p-10"><div className="animate-spin h-8 w-8 border-t-2 border-red-600 rounded-full" /></div> : (
          <div className="max-w-md mx-auto space-y-4">
            {activeTab === 'home' && (
              <>
                <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-4">
                  <div className="flex justify-between items-end">
                    <div><p className="text-[10px] font-bold text-slate-400 uppercase">Faturamento</p><h3 className="text-2xl font-black">R$ {totalFat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3></div>
                    <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">{atingimento.toFixed(1)}%</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.keys(stats).map(k => (
                      <div key={k} className="bg-slate-50 p-2 rounded-xl text-center">
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{k}</p>
                        <p className="text-[10px] font-black">R$ {stats[k].faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Faturamento Produtos Foco */}
                <div className="bg-orange-50/50 p-4 rounded-3xl border border-orange-100 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                    <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Faturamento Produtos Foco</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.keys(stats).map(k => {
                      const focusFat = stats[k].faturamento_foco || 0;
                      const focusGoal = stats[k].meta_foco || 0;
                      const focusDisplayPercent = focusGoal > 0 ? Math.round((focusFat / focusGoal) * 100) : 0;

                      return (
                        <div key={`${k}-focus`} className="bg-white/50 p-2 rounded-xl text-center border border-orange-100">
                          <p className="text-[8px] font-bold text-orange-400 uppercase">{k}</p>
                          <p className="text-[10px] font-black text-slate-800">R$ {focusFat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          {focusGoal > 0 && (
                            <p className={cn(
                              "text-[8px] font-black mt-1",
                              focusDisplayPercent >= 100 ? "text-green-600" : "text-orange-600"
                            )}>
                              {focusDisplayPercent}%
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {reminders.map(r => (
                  <div key={r.id} className="bg-red-50 p-3 rounded-2xl flex items-center space-x-3 border border-red-100">
                    <Bell className="w-4 h-4 text-red-500" /><p className="flex-1 text-sm font-medium">{r.message}</p>
                    <button onClick={async () => { await supabase.from('reminders').update({ read: true }).eq('id', r.id); fetchData(); }}><Check className="w-4 h-4 text-red-500" /></button>
                  </div>
                ))}
              </>
            )}

            {activeTab === 'prod' && (
              <ProductionForm 
                products={products} 
                user={user} 
                editingData={editingProduction}
                onRefresh={() => { 
                  setActiveTab('list'); 
                  setEditingProduction(null);
                  fetchData(); 
                }} 
              />
            )}

            {activeTab === 'list' && (
              <div className="space-y-2">
                {productions.map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-2xl border flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-[10px] font-bold text-red-600 flex items-center gap-1">
                        {p.product?.block}
                        {p.product?.is_focus && <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />}
                      </p>
                      <h4 className="font-bold text-sm">{p.product?.name}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{format(new Date(p.date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <p className="font-black text-sm mr-2">
                        {p.product?.block === 'Conquista' ? `${p.amount} un.` : `R$ ${p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </p>
                      <button 
                        onClick={() => {
                          setEditingProduction(p);
                          setActiveTab('prod');
                        }}
                        className="p-1 text-slate-300 hover:text-blue-500"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduction(p.id)}
                        disabled={loading}
                        className={cn(
                          "p-2 rounded-lg transition-all font-black uppercase text-[10px]",
                          loading && confirmingId === p.id ? "bg-red-100 text-red-600" :
                          confirmingId === p.id ? "bg-red-600 text-white px-3" : "text-slate-300 hover:text-red-500 bg-slate-50"
                        )}
                      >
                        {loading && confirmingId === p.id ? "..." : confirmingId === p.id ? "CONFIRMAR" : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'var' && (
              <div className="space-y-4">
                <div className="flex bg-white rounded-2xl p-1 border border-slate-100 shadow-sm">
                  <button 
                    onClick={() => setRemTab('total')}
                    className={cn(
                      "flex-1 py-3 text-[10px] font-black rounded-xl transition-all",
                      remTab === 'total' ? "bg-red-600 text-white shadow-lg" : "text-slate-400"
                    )}
                  >
                    REMUNERAÇÃO
                  </button>
                  <button 
                    onClick={() => setRemTab('mult')}
                    className={cn(
                      "flex-1 py-3 text-[10px] font-black rounded-xl transition-all",
                      remTab === 'mult' ? "bg-red-600 text-white shadow-lg" : "text-slate-400"
                    )}
                  >
                    MULTIPLICADORES
                  </button>
                </div>

                {remTab === 'total' ? (
                  <div className="bg-[#FF0000] text-white p-6 rounded-3xl shadow-lg flex justify-between items-center relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-xs font-bold opacity-80 uppercase">Remuneração Final {blockMultiplier > 1 && `(${blockMultiplier}x)`}</p>
                      <h3 className="text-3xl font-black italic">R$ {totalRem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                      {blockMultiplier > 1 && (
                        <p className="text-[10px] font-bold opacity-70 mt-1">
                          Base: R$ {totalRemBase.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x {blockMultiplier}
                        </p>
                      )}
                    </div>
                    <Wallet className="w-16 h-16 opacity-20 absolute -right-4 -bottom-4 z-0" />
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4 text-center">
                      <div className="flex justify-center items-center space-x-2">
                        <Star className={cn("w-6 h-6", achievedCount > 0 ? "text-yellow-400 fill-yellow-400" : "text-slate-200")} />
                        <h2 className="text-4xl font-black italic text-slate-800">{blockMultiplier}x</h2>
                        <Star className={cn("w-6 h-6", achievedCount > 1 ? "text-yellow-400 fill-yellow-400" : "text-slate-200")} />
                      </div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                        {achievedCount} {achievedCount === 1 ? 'BLOCO ATINGIDO' : 'BLOCOS ATINGIDOS'}
                      </p>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div className={cn("h-full transition-all duration-1000", achievedCount >= 1 ? "bg-green-500" : "bg-slate-200")} style={{ width: '33.33%' }} />
                        <div className={cn("h-full transition-all duration-1000 border-l border-white", achievedCount >= 2 ? "bg-green-500" : "bg-slate-200")} style={{ width: '33.33%' }} />
                        <div className={cn("h-full transition-all duration-1000 border-l border-white", achievedCount >= 3 ? "bg-green-500" : "bg-slate-200")} style={{ width: '33.34%' }} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1">Desafios dos Blocos</h4>
                      {challenges.map(c => (
                        <div key={c.name} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={cn("w-3 h-3 rounded-full shadow-sm", c.achieved ? "bg-green-500" : "bg-red-500")} />
                            <div>
                              <h4 className="font-black text-sm text-slate-800 uppercase tracking-tight">{c.name}</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">
                                {c.focusMeta > 0 ? 'Meta Bloco + Meta Foco' : 'Meta do Bloco'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-700 italic">
                               {Math.round(c.blockMeta > 0 ? (c.blockFat / c.blockMeta) * 100 : 0)}% Bloco
                             </p>
                             {c.focusMeta > 0 && (
                               <p className="text-[10px] font-black text-slate-700 italic">
                                 {Math.round(c.focusFat / c.focusMeta * 100)}% Foco
                               </p>
                             )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-300">
                      <h5 className="text-[9px] font-black text-slate-400 uppercase mb-2">Regras do Multiplicador</h5>
                      <ul className="text-[10px] font-bold text-slate-600 space-y-1">
                        <li className="flex justify-between"><span>1 Bloco atingido</span> <span className="text-red-600">2x</span></li>
                        <li className="flex justify-between"><span>2 Blocos atingidos</span> <span className="text-red-600">3x</span></li>
                        <li className="flex justify-between"><span>3 Blocos atingidos</span> <span className="text-red-600">4x</span></li>
                      </ul>
                      <p className="text-[8px] text-slate-400 mt-3 leading-tight italic">
                        * Atingimento = 100% ou mais da meta do bloco + 100% ou mais da meta dos produtos foco.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ProductionForm({ products, user, onRefresh, editingData }: any) {
  const [date, setDate] = useState(editingData ? format(new Date(editingData.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  const [block, setBlock] = useState(editingData?.product.block || '');
  const [segment, setSegment] = useState(editingData?.product.segment || '');
  const [pId, setPId] = useState(editingData?.product_id || '');
  const [amt, setAmt] = useState(editingData?.amount.toString() || '');
  const [loading, setLoading] = useState(false);

  // Set values when editingData changes
  useEffect(() => {
    if (editingData) {
      setDate(format(new Date(editingData.date), 'yyyy-MM-dd'));
      setBlock(editingData.product.block);
      setSegment(editingData.product.segment || '');
      setPId(editingData.product_id);
      setAmt(editingData.amount.toString());
    }
  }, [editingData]);

  // Clear sub-fields when parent selection changes, but ONLY if NOT initializing from editingData
  useEffect(() => {
    if (!editingData || editingData.product.block !== block) {
      setPId('');
      if (block !== 'Conquista') setSegment('');
    }
  }, [block]);

  useEffect(() => {
    if (!editingData || (editingData.product.block === 'Conquista' && editingData.product.segment !== segment)) {
      setPId('');
    }
  }, [segment]);
  
  const submit = async (e: any) => {
    e.preventDefault();
    if (!pId || amt === '') return;
    setLoading(true);
    
    try {
      if (!pId) {
        alert('Por favor, selecione um produto.');
        setLoading(false);
        return;
      }
      if (amt === '' || parseFloat(amt) <= 0) {
        alert('Por favor, insira uma quantidade ou valor válido.');
        setLoading(false);
        return;
      }

      const payload = { 
        user_id: user.id, 
        date, 
        product_id: pId, 
        amount: parseFloat(amt) 
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

  const filteredProducts = products.filter((p: Product) => {
    if (!block) return false;
    if (p.block !== block) return false;
    if (block === 'Conquista') {
      if (!segment) return false;
      return p.segment === segment;
    }
    return true;
  }).sort((a: any, b: any) => a.name.localeCompare(b.name));

  const conquistaSegments = Array.from(new Set(products
    .filter((p: any) => p.block === 'Conquista' && p.segment)
    .map((p: any) => p.segment)
  )).sort();

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded-3xl border space-y-4 shadow-sm">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">{editingData ? 'Editar Produção' : 'Lançar Produção'}</h3>
        {editingData && (
          <button 
            type="button" 
            onClick={() => onRefresh()}
            className="text-[10px] font-black text-slate-400 uppercase hover:text-red-500"
          >
            Cancelar Edição
          </button>
        )}
      </div>
      
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Data</label>
        <input type="date" className="w-full p-2 bg-slate-50 border rounded-xl text-sm" value={date} onChange={e => setDate(e.target.value)} required />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bloco</label>
        <select 
          className="w-full p-2 bg-slate-50 border rounded-xl text-sm font-bold" 
          value={block} 
          onChange={e => setBlock(e.target.value)} 
          required
        >
          <option value="">Selecione o Bloco</option>
          <option value="Créditos">Créditos</option>
          <option value="Comissões">Comissões</option>
          <option value="Conquista">Conquista</option>
        </select>
      </div>

      {block === 'Conquista' && (
        <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
          <label className="text-[10px] font-bold text-red-500 uppercase ml-1">Segmento</label>
          <select 
            className="w-full p-2 bg-red-50 border-red-100 border rounded-xl text-sm font-bold text-red-700" 
            value={segment} 
            onChange={e => setSegment(e.target.value)} 
            required
          >
            <option value="">Selecione o Segmento</option>
            {conquistaSegments.map((s: any) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Produto</label>
        <select 
          className="w-full p-2 bg-slate-50 border rounded-xl text-sm font-bold" 
          value={pId} 
          onChange={e => setPId(e.target.value)} 
          required
          disabled={!block || (block === 'Conquista' && !segment)}
        >
          <option value="">
            {!block ? 'Selecione o bloco' : (block === 'Conquista' && !segment) ? 'Selecione o segmento' : 'Selecione o Produto'}
          </option>
          {filteredProducts.map((p: Product) => (
            <option key={p.id} value={p.id}>
              {p.is_focus ? '⭐ ' : ''}{p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
          {block === 'Conquista' ? 'Quantidade (Unidades)' : 'Valor'}
        </label>
        <input 
          type="number" 
          step={block === 'Conquista' ? "1" : "0.01"} 
          className="w-full p-2 bg-slate-50 border rounded-xl text-sm font-black" 
          placeholder={block === 'Conquista' ? "0" : "0,00"} 
          value={amt} 
          onChange={e => setAmt(e.target.value)} 
          required 
        />
      </div>

      <button 
        type="submit"
        disabled={loading || !pId}
        className={cn(
          "w-full py-3 rounded-2xl bg-red-600 text-white font-black transition-all",
          (loading || !pId) && "opacity-50 cursor-not-allowed"
        )}
      >
        {loading ? 'PROCESSANDO...' : editingData ? 'ATUALIZAR' : 'INCLUIR'}
      </button>
    </form>
  );
}
