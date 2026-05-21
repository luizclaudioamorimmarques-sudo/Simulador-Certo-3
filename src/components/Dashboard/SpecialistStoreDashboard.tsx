import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, Product, Production, Goal, Reminder } from '@/src/types';
import { 
  LogOut, Plus, Search, Calendar, Package, ArrowUpRight, 
  TrendingUp, Wallet, Clock, Bell, Trash2, Star, Edit, FileText
} from 'lucide-react';
import { cn, isCurrencyProduct, getAchievementColor, getAchievementTextColor } from '@/src/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReportsTab from '../Reports/ReportsTab';
import { 
  getCurrentRioDate, getBusinessDaysInMonth, 
  getElapsedBusinessDays, getRemainingBusinessDays 
} from '@/src/lib/calendar';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'home' | 'productions' | 'report' | 'variable' | 'pdireports';

export default function SpecialistStoreDashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [remTab, setRemTab] = useState<'total' | 'mult'>('total');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [productions, setProductions] = useState<(Production & { product: Product })[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isRemindersOpen, setIsRemindersOpen] = useState(false);
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

      // Use Líder goals for indicators to match store performance for the selected month
      const { data: gData, error: gErr } = await supabase.from('goals').select('*').eq('profile', 'Líder').eq('month', selectedMonth);
      if (gErr) throw gErr;
      if (gData) setGoals(gData);

      const startDate = `${selectedMonth}-01`;
      const [year, month] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`;

      // Get store ID
      let storeId = user.store_id;
      if (!storeId) {
        const uStore = (user as any).store || (user as any).stores;
        storeId = Array.isArray(uStore) ? uStore[0]?.id : uStore?.id;
      }

      if (!storeId) {
        setLoading(false);
        return;
      }

      // Fetch all users in the store to get global production
      const { data: storeUsers } = await supabase.from('users').select('id').eq('store_id', storeId);
      const userIds = storeUsers ? storeUsers.map(u => u.id) : [user.id];

      console.log('Fetching global store productions for:', { storeId, startDate, endDate });

      const { data: prodData, error: prodErr } = await supabase
        .from('productions')
        .select('*, product:products(*)')
        .in('user_id', userIds)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      
      if (prodErr) throw prodErr;
      if (prodData) {
        const newStats = {
          Créditos: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
          Comissões: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
          Conquista: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
        };

        gData?.forEach(g => {
          if (newStats[g.block as keyof typeof newStats]) {
            if (g.is_focus) {
              newStats[g.block as keyof typeof newStats].meta_foco += g.value;
            } else {
              newStats[g.block as keyof typeof newStats].meta += g.value;
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
            
            // Specialist rate is 50% of Leader rate
            const leaderRate = parseFloat((p.product.leader_rate ?? p.product.variable_rate ?? 0).toString());
            const rate = leaderRate * 0.5;
            
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
        
        // For the recent history tab, we might want to show only the user's OWN productions
        // Let's filter them for the 'productions' and 'report' tabs
        setProductions(prodData.filter(p => p.user_id === user.id));
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
  
  // Calculate Block Multiplier Logic (Store Performance)
  const challenges = Object.keys(stats).map(k => {
    const s = (stats as any)[k];
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

  const totalRemBase = stats.Créditos.remuneração + stats.Comissões.remuneração + stats.Conquista.remuneração;
  const totalRemuneração = totalRemBase * blockMultiplier;
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
    <div className="flex flex-col h-full bg-[#f8f8f8] mb-12">
      {/* Profile Header */}
      <header className="bg-ferrari text-white p-4 flex items-center justify-between shadow-xl border-b-4 border-ferrari-dark">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white text-ferrari flex items-center justify-center font-black italic uppercase shadow-lg">
            {user.name[0]}
          </div>
          <div className="relative">
            <h2 className="brand-title text-sm">{user.name}</h2>
            <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest leading-none">
              {user.profile}
            </p>
            {((user as any).store || (user as any).stores) && (
              <p className="text-[10px] text-white/90 font-bold mt-0.5 flex items-center">
                [{(user as any).store?.code || (user as any).stores?.code}] {(user as any).store?.name || (user as any).stores?.name}
              </p>
            )}
            {reminders.length > 0 && (
              <button 
                onClick={() => setIsRemindersOpen(true)}
                className="absolute -top-2 -right-10 w-11 h-11 cursor-pointer flex items-center justify-center bg-ferrari rounded-full border-2 border-white shadow-2xl z-50 overflow-visible hover:scale-110 transition-transform active:scale-95"
              >
                <Bell className="w-7 h-7 animate-flash-yellow" />
              </button>
            )}
          </div>
        </div>
        <button onClick={onLogout} className="p-2 opacity-80 hover:opacity-100 transition-opacity">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Top Navigation */}
      <div className="flex bg-white border-b shadow-sm overflow-x-auto no-scrollbar">
        {[
          { id: 'home', label: 'Início', icon: TrendingUp },
          { id: 'productions', label: 'Produzir', icon: Plus },
          { id: 'report', label: 'História', icon: Search },
          { id: 'variable', label: 'Ganhos', icon: Wallet },
          { id: 'pdireports', label: 'Relatórios', icon: FileText },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={cn(
              "flex-1 py-3 text-[10px] font-bold border-b-2 flex flex-col items-center transition-all",
              activeTab === tab.id ? "text-red-600 border-red-600 bg-red-50/30" : "text-slate-400 border-transparent shadow-sm"
            )}
          >
            <tab.icon className="w-4 h-4 mb-1" />
            <span className="truncate w-full text-center px-1 uppercase">{tab.label}</span>
          </button>
        ))}
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
                {/* Summary Card */}
                <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Faturamento Global</p>
                      <h3 className="text-2xl font-black italic">R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    </div>
                    <div className={cn("px-3 py-1 rounded-full text-xs font-black", getAchievementColor(atingimento))}>
                      {atingimento.toFixed(1)}%
                    </div>
                  </div>
                  
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        atingimento >= 100 ? "bg-green-500" : atingimento >= 80 ? "bg-yellow-500" : "bg-red-500"
                      )} 
                      style={{ width: `${Math.min(atingimento, 100)}%` }} 
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {elapsedDays} / {totalDays} Dias Úteis
                    </div>
                    <div className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                      Restante: {remainingDays}
                    </div>
                  </div>
                </div>

                {/* Remuneration & Blocks */}
                <div className="space-y-4">
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">REMUNERAÇÃO VARIÁVEL ESTIMADA</p>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-black text-ferrari italic">R$ {totalRemuneração.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      {blockMultiplier > 1 && (
                        <span className="bg-ferrari/10 text-ferrari px-2 py-0.5 rounded-lg text-[10px] font-black">
                          {blockMultiplier}X MULT.
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {Object.keys(stats).map(k => {
                      const goal = stats[k].meta || 0;
                      const fat = stats[k].faturamento || 0;
                      const percent = goal > 0 ? (fat / goal) * 100 : 0;
                      
                      return (
                        <div key={k} className="flex items-center justify-between bg-white p-4 rounded-2xl border-l-[6px] border-slate-200 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-500 uppercase">{k}</span>
                            <span className={cn("text-[10px] font-black", getAchievementTextColor(percent))}>
                              {percent.toFixed(0)}% da Meta
                            </span>
                          </div>
                          <span className="text-sm font-black italic">R$ {stats[k].faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })}
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
                              <span className="text-[10px] font-black text-slate-800">R$ {focusFat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                          {isCurrencyProduct(p.product?.name, p.product?.block, p.product?.segment) 
                            ? `R$ ${p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                            : `${p.amount} un.`}
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
                <div className="flex bg-white rounded-2xl p-1 border border-slate-100 shadow-sm">
                  <button 
                    onClick={() => setRemTab('total')}
                    className={cn(
                      "flex-1 py-3 text-[10px] font-black rounded-xl transition-all",
                      remTab === 'total' ? "bg-ferrari text-white shadow-lg" : "text-gray-400"
                    )}
                  >
                    REMUNERAÇÃO
                  </button>
                  <button 
                    onClick={() => setRemTab('mult')}
                    className={cn(
                      "flex-1 py-3 text-[10px] font-black rounded-xl transition-all",
                      remTab === 'mult' ? "bg-ferrari text-white shadow-lg" : "text-gray-400"
                    )}
                  >
                    MULTIPLICADORES
                  </button>
                </div>

                {remTab === 'total' ? (
                  <div className="bg-ferrari text-white p-8 rounded-[40px] shadow-2xl border-b-8 border-ferrari-dark flex flex-col items-center text-center animate-in fade-in duration-500 relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mb-2">Remuneração Final {blockMultiplier > 1 && `(${blockMultiplier}x)`}</p>
                      <h3 className="text-4xl font-black italic tracking-tighter">R$ {totalRemuneração.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                      {blockMultiplier > 1 && (
                        <p className="text-[10px] font-bold opacity-70 mt-2">
                          Base: R$ {totalRemBase.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} x {blockMultiplier}
                        </p>
                      )}
                    </div>
                    <Wallet className="w-12 h-12 opacity-20 absolute -right-4 -bottom-4 z-0" />
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="bg-white p-6 rounded-[32px] border shadow-sm space-y-4 text-center">
                      <div className="flex justify-center items-center space-x-2">
                        <Star className={cn("w-6 h-6", achievedCount > 0 ? "text-yellow-400 fill-yellow-400" : "text-slate-200")} />
                        <h2 className="text-4xl font-black italic text-gray-800">{blockMultiplier}x</h2>
                        <Star className={cn("w-6 h-6", achievedCount > 1 ? "text-yellow-400 fill-yellow-400" : "text-slate-200")} />
                      </div>
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest leading-tight">
                        LOJA ATINGIU {achievedCount} {achievedCount === 1 ? 'DESAFIO' : 'DESAFIOS'}
                      </p>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div className={cn("h-full transition-all duration-1000", achievedCount >= 1 ? "bg-ferrari" : "bg-slate-200")} style={{ width: '33.33%' }} />
                        <div className={cn("h-full transition-all duration-1000 border-l-2 border-white", achievedCount >= 2 ? "bg-ferrari" : "bg-slate-200")} style={{ width: '33.33%' }} />
                        <div className={cn("h-full transition-all duration-1000 border-l-2 border-white", achievedCount >= 3 ? "bg-ferrari" : "bg-slate-200")} style={{ width: '33.34%' }} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-1">Status de Desafios (Loja)</h4>
                      {challenges.map(c => (
                        <div key={c.name} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={cn("w-3 h-3 rounded-full shadow-sm", c.achieved ? "bg-green-500" : "bg-red-500")} />
                            <div>
                              <h4 className="font-black text-sm text-gray-800 uppercase tracking-tight">{c.name}</h4>
                              <p className="text-[9px] font-bold text-gray-400 uppercase leading-none">
                                {c.focusMeta > 0 ? 'Meta Bloco + Foco' : 'Meta do Bloco'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-gray-700 italic">
                               {Math.round(c.blockMeta > 0 ? (c.blockFat / c.blockMeta) * 100 : 0)}%
                             </p>
                             {c.focusMeta > 0 && (
                               <p className="text-[9px] font-bold text-orange-500">
                                 Foco: {Math.round(c.focusFat / c.focusMeta * 100)}%
                               </p>
                             )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-gray-50/50 p-5 rounded-[32px] border border-dashed border-gray-300">
                      <h5 className="text-[10px] font-black text-gray-400 uppercase mb-3">Como Funciona (Especialista de Loja)</h5>
                      <p className="text-[10px] font-bold text-gray-600 mb-2 italic">Você acompanha o atingimento do perfil Líder para multiplicar sua remuneração:</p>
                      <ul className="text-[11px] font-black text-gray-700 space-y-1 bg-white p-3 rounded-2xl border border-gray-100 italic">
                        <li className="flex justify-between"><span>1 Desafio atingido</span> <span className="text-ferrari">2x</span></li>
                        <li className="flex justify-between"><span>2 Desafios atingidos</span> <span className="text-ferrari">3x</span></li>
                        <li className="flex justify-between"><span>3 Desafios atingidos</span> <span className="text-ferrari">4x</span></li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'pdireports' && (
              <ReportsTab 
                user={user} 
                specialists={[]} 
                products={products} 
                selectedMonth={selectedMonth} 
              />
            )}
          </div>
        )}
      </main>

      {/* Reminders Modal */}
      {isRemindersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-ferrari p-6 text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <h3 className="font-black uppercase tracking-tighter">Avisos do Líder</h3>
              </div>
              <button 
                onClick={() => setIsRemindersOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
              {reminders.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-slate-400 font-bold italic">Nenhum aviso pendente</p>
                </div>
              ) : (
                reminders.map(r => (
                  <div key={r.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <p className="text-sm font-bold text-slate-800 leading-tight">"{r.message}"</p>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase">
                        Recebido em {format(new Date(r.created_at || ''), 'dd/MM/yyyy')}
                      </span>
                      <button 
                        onClick={async () => {
                          const { error } = await supabase.from('reminders').delete().eq('id', r.id);
                          if (!error) {
                            setReminders(prev => prev.filter(item => item.id !== r.id));
                            if (reminders.length === 1) setIsRemindersOpen(false);
                          }
                        }}
                        className="text-[10px] font-black text-ferrari hover:bg-ferrari/5 px-2 py-1 rounded-lg transition-colors uppercase"
                      >
                        MARCAR COMO LIDO
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-center">
              <button 
                onClick={() => setIsRemindersOpen(false)}
                className="text-[11px] font-black text-slate-400 hover:text-ferrari uppercase tracking-widest"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
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
  const showAsCurrency = isCurrencyProduct(selectedProduct?.name, block, segment);
  
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
          <label className="text-[10px] font-bold text-ferrari uppercase ml-1">Segmento do Cliente</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-ferrari/50" />
            <select
              className="w-full pl-10 pr-4 py-2 bg-red-50 border border-red-100 rounded-xl text-sm appearance-none font-bold text-ferrari"
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
          {showAsCurrency ? 'Valor da Produção' : 'Quantidade (Unidades)'}
        </label>
        <div className="relative">
          <TrendingUp className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="number"
            step={showAsCurrency ? "0.01" : "1"}
            placeholder={showAsCurrency ? "0,00" : "0"}
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
            <p className="text-slate-800 font-black">R$ {(parseFloat(amount || '0') * selectedProduct.multiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
