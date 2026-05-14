import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, Product, Production, Goal, Reminder, UserProfile } from '@/src/types';
import { LogOut, Send, Search, TrendingUp, Wallet, Users, Trash2, Check, Plus, Calendar, Package, ArrowUpRight, Star, Edit, BarChart3 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import IndicatorManager from './IndicatorManager';

export default function LeaderDashboard({ user, onLogout }: { user: User, onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('home');
  const [viewSubTab, setViewSubTab] = useState<'month' | 'day'>('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [specialists, setSpecialists] = useState<User[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingProduction, setEditingProduction] = useState<any | null>(null);
  const [stats, setStats] = useState<any>({
    Créditos: { faturamento: 0, remuneração: 0, meta: 0 },
    Comissões: { faturamento: 0, remuneração: 0, meta: 0 },
    Conquista: { faturamento: 0, remuneração: 0, meta: 0 },
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

      // Try several ways to identify the store ID
      let leaderStoreId = user.store_id;
      
      if (!leaderStoreId) {
        const uStore = (user as any).store || (user as any).stores;
        leaderStoreId = Array.isArray(uStore) ? uStore[0]?.id : uStore?.id;
      }

      console.log("LeaderDashboard - Fetching for store:", leaderStoreId);

      if (!leaderStoreId) {
        console.warn("Líder sem store_id identificado.");
        setLoading(false);
        return;
      }

      // Fetch products for individual recording
      const { data: pData } = await supabase.from('products').select('*');
      if (pData) setProducts(pData);

      // Fetch all users in this store
      const { data: sData, error: sError } = await supabase
        .from('users')
        .select('*, stores(name, code)')
        .eq('store_id', leaderStoreId);
      
      if (sError) console.error("Erro busca membros:", sError);

      if (sData) {
        const team = sData.filter(s => s.profile !== 'Administrador');
        setSpecialists(team);
        console.log("Membros da equipe identificados:", team.length);
      }

      // Fetch goals for Leader profile
      const { data: gData } = await supabase.from('goals').select('*').eq('profile', 'Líder');
      if (gData) setGoals(gData);

      // Ensure leader.id is included in the production sum list
      let userIdsInStore = sData ? sData.map(s => s.id) : [];
      if (!userIdsInStore.includes(user.id)) {
        userIdsInStore.push(user.id);
      }

      // Fetch ALL productions from the team
      const { data: allProd, error: pError } = await supabase
        .from('productions')
        .select('*, product:products(*)')
        .in('user_id', userIdsInStore)
        .gte('date', startDate)
        .lte('date', endDate);
      
      if (pError) console.error("Erro busca produções:", pError);

      const newStats: any = {
        Créditos: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
        Comissões: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
        Conquista: { faturamento: 0, remuneração: 0, meta: 0, faturamento_foco: 0, meta_foco: 0 },
      };
      
      // Map Goals
      gData?.forEach(g => { 
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

      allProd?.forEach(p => {
        if (p.product) {
          const amount = parseFloat(p.amount?.toString() || '0');
          const multiplier = parseFloat(p.product.multiplier?.toString() || '0');
          const fat = amount * multiplier;
          
          const block = p.product.block;
          if (newStats[block]) {
            newStats[block].faturamento += fat;
            if (p.product.is_focus) {
              newStats[block].faturamento_foco += fat;
            }
            
            // Leader's override rate or product variable rate
            const rate = parseFloat((p.product.leader_rate ?? p.product.variable_rate ?? 0).toString());
            // Apply NPS Multiplier here
            newStats[block].remuneração += (fat * (rate / 100)) * npsMultiplier;
          }
        }
      });
      
      setStats(newStats);
      console.log("Stats calculados final:", newStats);
    } catch (err) { 
      console.error("Erro fatal fetchData Leader:", err); 
    } finally { 
      setLoading(false); 
    }
  }


  const handleDeleteProduction = async (id: string) => {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    
    try {
      setLoading(true);
      const { error } = await supabase.from('productions').delete().eq('id', id);
      if (error) throw error;
      setConfirmingId(null);
      await fetchData();
      alert('Lançamento excluído com sucesso!');
    } catch (err: any) {
      alert('Erro ao excluir produção: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalFat = Object.values(stats).reduce((a: any, b: any) => a + b.faturamento, 0) as number;
  const totalRem = Object.values(stats).reduce((a: any, b: any) => a + b.remuneração, 0) as number;

  const months = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, 'yyyy-MM');
  });

  return (
    <div className="flex flex-col h-full bg-[#f8f8f8] mb-12">
      <header className="bg-ferrari text-white p-4 flex items-center justify-between shadow-xl border-b-4 border-ferrari-dark">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-white text-ferrari flex items-center justify-center font-black italic uppercase shadow-lg">{user.name[0]}</div>
          <div>
             <h2 className="brand-title text-sm">{user.name}</h2>
             <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest leading-none">
               {user.profile}
             </p>
             {((user as any).store || (user as any).stores) && (
               <p className="text-[10px] text-white/90 font-bold mt-0.5 flex items-center">
                 [{(user as any).store?.code || (user as any).stores?.code}] {(user as any).store?.name || (user as any).stores?.name}
               </p>
             )}
          </div>
        </div>
        <button onClick={onLogout}><LogOut className="w-5 h-5" /></button>
      </header>

      <div className="flex flex-wrap justify-center bg-white border-b shadow-sm">
        {[
          ['home', 'Início', TrendingUp], 
          ['add', 'Lançar', Plus],
          ['view', 'Equipe', Search], 
          ['rem', 'Ganhos', Wallet], 
          ['msg', 'Aviso', Send],
          ['ind', 'Indicadores', BarChart3]
        ].map(([id, label, Icon]: any) => (
          <button 
            key={id} 
            onClick={() => setActiveTab(id)} 
            className={cn(
              "basis-1/4 sm:flex-1 py-3 text-[10px] font-bold border-b-2 flex flex-col items-center transition-all", 
              activeTab === id ? "text-red-600 border-red-600 bg-red-50/30" : "text-slate-400 border-transparent shadow-sm"
            )}
          >
            <Icon className="w-4 h-4 mb-1" />
            <span className="truncate w-full text-center px-1">{label}</span>
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
              className="bg-slate-100 border-none text-[10px] font-black text-red-600 rounded-xl px-3 py-2 uppercase"
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
              <div className="bg-white p-5 rounded-3xl border space-y-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Faturamento Global</h3>
                    <p className="text-[9px] text-slate-300 font-bold uppercase">(Equipe + Individual)</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 italic">R$ {totalFat.toLocaleString('pt-BR')}</h2>
                
                {/* Atingimento Total */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atingimento Total</h4>
                      <p className="text-lg font-black text-slate-800">
                        {(() => {
                          const totalGoal = Object.values(stats || {}).reduce((acc: number, s: any) => acc + (s.meta || 0), 0) as number;
                          const totalAchieved = Object.values(stats || {}).reduce((acc: number, s: any) => acc + (s.faturamento || 0), 0) as number;
                          const percent = totalGoal > 0 ? Math.round((totalAchieved / totalGoal) * 100) : 0;
                          return percent;
                        })()}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Meta Total</p>
                      <p className="text-xs font-bold text-slate-600">
                        R$ {(Object.values(stats || {}).reduce((acc: number, s: any) => acc + (s.meta || 0), 0) as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                    {(() => {
                      const totalGoal = Object.values(stats || {}).reduce((acc: number, s: any) => acc + (s.meta || 0), 0) as number;
                      const totalAchieved = Object.values(stats || {}).reduce((acc: number, s: any) => acc + (s.faturamento || 0), 0) as number;
                      const percent = totalGoal > 0 ? (totalAchieved / totalGoal) * 100 : 0;
                      const cappedPercent = Math.min(percent, 100);
                      
                      return (
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            percent >= 100 ? "bg-green-500" : percent >= 50 ? "bg-blue-500" : "bg-red-500"
                          )}
                          style={{ width: `${cappedPercent}%` }}
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Faturamento Produtos Foco */}
                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                    <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Faturamento Produtos Foco</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.keys(stats).map(k => {
                      const focusFat = stats[k].faturamento_foco || 0;
                      const focusGoal = stats[k].meta_foco || 0;
                      const focusPercent = focusGoal > 0 ? Math.min((focusFat / focusGoal) * 100, 100) : 0;
                      const focusDisplayPercent = focusGoal > 0 ? Math.round((focusFat / focusGoal) * 100) : 0;

                      if (focusFat === 0 && focusGoal === 0) return null;

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

                <div className="grid grid-cols-1 gap-4 mt-4">
                  {Object.keys(stats).map(k => {
                    const goal = stats[k].meta || 0;
                    const achieved = stats[k].faturamento || 0;
                    const percent = goal > 0 ? Math.min((achieved / goal) * 100, 100) : 0;
                    const displayPercent = goal > 0 ? Math.round((achieved / goal) * 100) : 0;

                    return (
                      <div key={k} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight block">{k}</span>
                            <span className="font-black text-slate-800 text-sm">R$ {achieved.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="text-right">
                            <span className={cn(
                              "text-sm font-black italic",
                              displayPercent >= 100 ? "text-green-600" : displayPercent >= 50 ? "text-blue-600" : "text-red-600"
                            )}>
                              {displayPercent}%
                            </span>
                            <p className="text-[8px] text-slate-400 font-bold uppercase">Meta: R$ {goal.toLocaleString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              displayPercent >= 100 ? "bg-green-500" : displayPercent >= 50 ? "bg-blue-500" : "bg-red-500"
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'add' && (
              <div className="space-y-4 pb-12">
                <ProductionForm 
                  products={products} 
                  user={user} 
                  editingData={editingProduction}
                  onRefresh={() => { 
                    setEditingProduction(null);
                    fetchData(); 
                    setActiveTab('home');
                  }} 
                />
              </div>
            )}

            {activeTab === 'view' && (
              <TeamPerformanceView 
                user={user}
                specialists={specialists}
                selectedMonth={selectedMonth}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                subTab={viewSubTab}
                setSubTab={setViewSubTab}
                onEditProduction={(p: any) => {
                  setEditingProduction(p);
                  setActiveTab('add');
                }}
                onDeleteProduction={handleDeleteProduction}
                loading={loading}
              />
            )}

            {activeTab === 'rem' && (
              <div className="bg-white p-4 rounded-3xl border shadow-sm">
                 <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Remuneração Variável Líder</h3>
                 <div className="bg-red-600 text-white p-6 rounded-2xl mb-4">
                    <p className="text-xs opacity-80 uppercase font-bold">Total a receber</p>
                    <h2 className="text-3xl font-black italic">R$ {totalRem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                 </div>
              </div>
            )}

            {activeTab === 'msg' && (
              <ReminderForm specialists={specialists} user={user} />
            )}

            {activeTab === 'ind' && (
              <IndicatorManager />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function TeamPerformanceView({ 
  user, 
  specialists, 
  selectedMonth, 
  selectedDay, 
  setSelectedDay,
  subTab, 
  setSubTab,
  onEditProduction,
  onDeleteProduction,
  loading
}: any) {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [productions, setProductions] = useState<any[]>([]);
  const [storeTotalDay, setStoreTotalDay] = useState(0);
  const [memberStats, setMemberStats] = useState({ faturamento: 0, remuneração: 0 });
  const [npsMultiplier, setNpsMultiplier] = useState(1);

  useEffect(() => {
    fetchData();
  }, [subTab, selectedMonth, selectedDay, selectedMemberId]);

  async function fetchData() {
    // 1. Fetch current NPS Multiplier for the month
    let currentNpsMultiplier = 1;
    const { data: npsData } = await supabase.from('indicators').select('value').eq('name', 'NPS').eq('month', selectedMonth).maybeSingle();
    const npsValue = npsData?.value || 0;
    const { data: rulesData } = await supabase.from('indicator_rules').select('*').eq('indicator_name', 'NPS');
    if (rulesData) {
      const rule = rulesData.find(r => npsValue >= r.min_value && npsValue <= r.max_value);
      if (rule) currentNpsMultiplier = rule.multiplier;
    }
    setNpsMultiplier(currentNpsMultiplier);

    // Member list includes leader
    const memberIds = [user.id, ...specialists.map((s: any) => s.id)];

    // Fetch Day Total for Store
    if (subTab === 'day') {
      const { data: dayStoreProd } = await supabase
        .from('productions')
        .select('*, product:products(*)')
        .in('user_id', memberIds)
        .eq('date', selectedDay);
      
      const total = dayStoreProd?.reduce((acc, p) => acc + (p.amount * (p.product?.multiplier || 0)), 0) || 0;
      setStoreTotalDay(total);
    }

    if (!selectedMemberId) {
      setProductions([]);
      setMemberStats({ faturamento: 0, remuneração: 0 });
      return;
    }

    // Fetch specifics for member
    const query = supabase.from('productions').select('*, product:products(*)').eq('user_id', selectedMemberId);
    
    if (subTab === 'month') {
      const startDate = `${selectedMonth}-01`;
      const [year, month] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${lastDay.toString().padStart(2, '0')}`;
      query.gte('date', startDate).lte('date', endDate);
    } else {
      query.eq('date', selectedDay);
    }

    const { data } = await query;
    setProductions(data || []);

    // Determine profile of selected member
    const isLeaderSelected = selectedMemberId === user.id;
    const selectedMember = specialists.find((s: any) => s.id === selectedMemberId);
    const memberProfile = isLeaderSelected ? 'Líder' : selectedMember?.profile;

    // Calculate Member Stats
    let fat = 0;
    let rem = 0;
    data?.forEach(p => {
      const pFat = p.amount * (p.product?.multiplier || 0);
      fat += pFat;
      
      let rate = 0;
      if (memberProfile === 'Líder') {
        rate = parseFloat((p.product?.leader_rate ?? p.product?.variable_rate ?? 0).toString());
      } else {
        rate = parseFloat((p.product?.specialist_rate ?? p.product?.variable_rate ?? 0).toString());
      }
      
      rem += (pFat * (rate / 100)) * currentNpsMultiplier;
    });
    setMemberStats({ faturamento: fat, remuneração: rem });
  }

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex bg-white rounded-2xl p-1 border border-slate-100 shadow-sm">
        <button 
          onClick={() => setSubTab('month')}
          className={cn(
            "flex-1 py-3 text-xs font-black rounded-xl transition-all",
            subTab === 'month' ? "bg-red-600 text-white shadow-lg" : "text-slate-400"
          )}
        >
          MÊS
        </button>
        <button 
          onClick={() => setSubTab('day')}
          className={cn(
            "flex-1 py-3 text-xs font-black rounded-xl transition-all",
            subTab === 'day' ? "bg-red-600 text-white shadow-lg" : "text-slate-400"
          )}
        >
          DIA
        </button>
      </div>

      {subTab === 'day' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest mb-2 block">Selecionar Data</label>
            <input 
              type="date" 
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm shadow-inner"
            />
          </div>

          <div className="bg-slate-800 p-6 rounded-3xl shadow-xl text-white">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturamento da Loja (Dia)</h3>
            <p className="text-3xl font-black italic">R$ {storeTotalDay.toLocaleString('pt-BR')}</p>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
          {subTab === 'month' ? 'Performance Mensal' : 'Performance Diária'} - Membro
        </label>
        <select 
          className="w-full p-4 bg-white border border-slate-100 rounded-2xl font-bold text-sm shadow-sm" 
          value={selectedMemberId}
          onChange={(e) => setSelectedMemberId(e.target.value)}
        >
          <option value="">Selecione um membro da equipe</option>
          <option value={user.id}>{user.name} (Líder)</option>
          <hr />
          {specialists.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name} ({s.profile})</option>
          ))}
        </select>
      </div>

      {selectedMemberId && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Faturamento</p>
              <p className="text-lg font-black text-slate-800 italic">R$ {memberStats.faturamento.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Remuneração</p>
              <p className="text-lg font-black text-green-600 italic">R$ {memberStats.remuneração.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border shadow-sm space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Lista de Produção</h4>
            <div className="space-y-0 text-xs">
              {productions.map(p => (
                <div key={p.id} className="flex justify-between items-center py-3 border-b last:border-0 border-slate-50 group">
                  <div className="flex-1">
                    <div className="flex items-center space-x-1 mb-0.5">
                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">
                        {p.product?.block}
                      </span>
                      {subTab === 'month' && (
                        <span className="text-[8px] font-bold text-slate-400">
                          {format(new Date(p.date), 'dd/MM')}
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-800 text-xs">{p.product?.name}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                       <p className="font-black italic text-slate-900">R$ {p.amount.toLocaleString()}</p>
                       <p className="text-[8px] text-slate-400 font-bold">Fat: R$ {(p.amount * (p.product?.multiplier || 0)).toLocaleString()}</p>
                    </div>
                    <div className="flex space-x-1 ml-2">
                       <button onClick={() => onEditProduction(p)} className="p-1.5 text-slate-300 hover:text-blue-500"><Edit className="w-3.5 h-3.5" /></button>
                       <button onClick={() => onDeleteProduction(p.id)} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {productions.length === 0 && <p className="text-slate-400 text-xs italic text-center py-4">Nenhuma produção encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderForm({ specialists, user }: any) {
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  const team = specialists.filter((s: any) => s.id !== user.id);

  const send = async () => {
    if (!to || !msg) return;
    await supabase.from('reminders').insert([{ from_user_id: user.id, to_user_id: to, message: msg }]);
    setMsg('');
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 space-y-4 shadow-sm">
      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Enviar Lembrete</h3>
      <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold shadow-inner" value={to} onChange={e => setTo(e.target.value)}>
        <option value="">Selecione o destinatário...</option>
        {team.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.profile})</option>)}
      </select>
      <textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium shadow-inner" rows={4} placeholder="Digite a mensagem para o especialista..." value={msg} onChange={e => setMsg(e.target.value)} />
      <button onClick={send} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg flex items-center justify-center space-x-2 border-b-4 border-red-800 active:scale-95 transition-all">
        {sent ? <Check className="w-5 h-5" /> : <Send className="w-4 h-4" />}
        <span>{sent ? "ENVIADO COM SUCESSO" : "ENVIAR AVISO"}</span>
      </button>
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

  useEffect(() => {
    if (editingData) {
      setDate(format(new Date(editingData.date), 'yyyy-MM-dd'));
      setBlock(editingData.product.block);
      setSegment(editingData.product.segment || '');
      setProductId(editingData.product_id);
      setAmount(editingData.amount.toString());
    }
  }, [editingData]);

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
      const payload = {
        user_id: user.id,
        date,
        product_id: productId,
        amount: parseFloat(amount)
      };

      if (editingData) {
        await supabase.from('productions').update(payload).eq('id', editingData.id);
      } else {
        await supabase.from('productions').insert([payload]);
      }
      
      alert('Produção salva com sucesso!');
      onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar produção: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === productId);
  const filteredProducts = products.filter(p => {
    if (!block) return false;
    if (p.block !== block) return false;
    if (block === 'Conquista') return p.segment === segment;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const conquistaSegments = Array.from(new Set(products
    .filter(p => p.block === 'Conquista' && p.segment)
    .map(p => p.segment as string)
  )).sort();

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{editingData ? 'Editar Produção Individual' : 'Lançar Minha Produção'}</h3>
      </div>
      
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Data</label>
        <div className="relative">
          <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input type="date" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Bloco</label>
        <div className="relative">
          <Package className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <select className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner appearance-none" value={block} onChange={(e) => setBlock(e.target.value)} required>
            <option value="">Selecione o bloco</option>
            <option value="Créditos">Créditos</option>
            <option value="Comissões">Comissões</option>
            <option value="Conquista">Conquista</option>
          </select>
        </div>
      </div>

      {block === 'Conquista' && (
        <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
          <label className="text-[10px] font-black text-orange-500 uppercase ml-1">Segmento</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-orange-400" />
            <select className="w-full pl-10 pr-4 py-3 bg-orange-50 border border-orange-100 rounded-2xl text-sm font-bold text-orange-700 shadow-inner appearance-none" value={segment} onChange={(e) => setSegment(e.target.value)} required>
              <option value="">Selecione o segmento</option>
              {conquistaSegments.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Produto</label>
        <div className="relative">
          <Package className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <select className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner appearance-none" value={productId} onChange={(e) => setProductId(e.target.value)} required disabled={!block || (block === 'Conquista' && !segment)}>
            <option value="">{filterPlaceholder(block, segment)}</option>
            {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.is_focus ? '⭐ ' : ''}{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{block === 'Conquista' ? 'Quantidade' : 'Valor'}</label>
        <div className="relative">
          <TrendingUp className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input type="number" step={block === 'Conquista' ? "1" : "0.01"} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold shadow-inner" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      </div>

      {selectedProduct && (
        <div className="bg-slate-100 p-4 rounded-2xl flex justify-between items-center">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase">Faturamento estimado</p>
            <p className="text-slate-800 font-black italic text-lg">R$ {(parseFloat(amount || '0') * selectedProduct.multiplier).toLocaleString()}</p>
          </div>
          <ArrowUpRight className="text-green-600 w-6 h-6" />
        </div>
      )}

      <button type="submit" disabled={loading || !productId} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg border-b-4 border-red-800 active:scale-95 transition-all disabled:opacity-50">
        {loading ? "PROCESSANDO..." : editingData ? "ATUALIZAR MEU LANÇAMENTO" : "CONFIRMAR MEU LANÇAMENTO"}
      </button>
    </form>
  );
}

function filterPlaceholder(block: string, segment: string) {
  if (!block) return 'Selecione o bloco primeiro';
  if (block === 'Conquista' && !segment) return 'Selecione o segmento primeiro';
  return 'Selecione o produto';
}
