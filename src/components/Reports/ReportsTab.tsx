import React, { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, Product } from '@/src/types';
import { FileText, Clock, Calendar, RefreshCcw } from 'lucide-react';
import { cn, isCurrencyProduct } from '@/src/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsTabProps {
  user: User;
  specialists: User[];
  products: Product[];
  selectedMonth: string;
}

export default function ReportsTab({ user, specialists, products, selectedMonth }: ReportsTabProps) {
  const isLeader = user.profile === 'Líder' || user.profile === 'Administrador';
  
  const [reportMonth, setReportMonth] = useState(selectedMonth);
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportTarget, setReportTarget] = useState<string>(isLeader ? 'store' : user.id); // 'store' or member ID
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('monthly');
  const [loading, setLoading] = useState(false);

  const months = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, 'yyyy-MM');
  });

  const members = isLeader ? [user, ...specialists.filter(s => s.id !== user.id)] : [user];

  const generateReport = async () => {
    setLoading(true);
    try {
      const startDate = reportType === 'monthly' ? `${reportMonth}-01` : reportDate;
      const [year, monthNum] = reportMonth.split('-').map(Number);
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = reportType === 'monthly' ? `${reportMonth}-${String(lastDay).padStart(2, '0')}` : reportDate;

      // Filter whose productions to fetch
      const targetUserIds = reportTarget === 'store' 
        ? [user.id, ...specialists.map(s => s.id)]
        : [reportTarget];

      const { data: productions } = await supabase
        .from('productions')
        .select('*, product:products(*), user:users(*)')
        .in('user_id', targetUserIds)
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: goals } = await supabase
        .from('goals')
        .select('*')
        .eq('month', reportMonth);

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const storeInfo = (user as any).store || (user as any).stores;
      const isIndividual = reportTarget !== 'store';
      const targetUser = members.find(m => m.id === reportTarget) || user;
      const targetName = isIndividual ? targetUser.name : 'GERAL DA LOJA';
      
      // Header
      doc.setFillColor(220, 0, 0);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(isIndividual ? 'RELATÓRIO INDIVIDUAL' : 'RESUMO DE PRODUTIVIDADE', 15, 20);
      
      doc.setFontSize(10);
      doc.text(`LOJA: [${storeInfo?.code || ''}] ${storeInfo?.name || ''}`.toUpperCase(), 15, 28);
      doc.text(`ALVO: ${targetName}`.toUpperCase(), 15, 34);
      doc.text(`PERÍODO: ${reportType === 'monthly' ? format(new Date(reportMonth + '-01T12:00:00'), 'MMMM yyyy', { locale: ptBR }) : format(new Date(reportDate + 'T12:00:00'), 'dd/MM/yyyy')}`.toUpperCase(), 130, 34);
      
      let currentY = 50;

      // GLOBAL SUMMARY DATA
      const blocks = ['Créditos', 'Comissões', 'Conquista'];
      
      const calculateGlobalStats = () => {
        let totalRevenue = 0;
        let totalGoal = 0;
        let focusRevenue = 0;
        let focusGoal = 0;

        if (reportTarget === 'store') {
          totalGoal = goals?.filter(g => !g.is_focus && g.profile === 'Líder').reduce((acc, g) => acc + g.value, 0) || 0;
          focusGoal = goals?.filter(g => g.is_focus && g.profile === 'Líder').reduce((acc, g) => acc + g.value, 0) || 0;
        } else {
          const m = targetUser;
          const profileToUse = m.profile === 'Líder' || m.profile === 'Administrador' ? 'Líder' : 'Especialista Santander';
          totalGoal = goals?.filter(g => !g.is_focus && g.profile === profileToUse).reduce((acc, g) => acc + g.value, 0) || 0;
          focusGoal = goals?.filter(g => g.is_focus && g.profile === profileToUse).reduce((acc, g) => acc + g.value, 0) || 0;
        }

        totalRevenue = productions?.reduce((acc, p) => acc + (p.amount * (p.product?.multiplier || 0)), 0) || 0;
        focusRevenue = productions?.filter(p => p.product?.is_focus).reduce((acc, p) => acc + (p.amount * (p.product?.multiplier || 0)), 0) || 0;

        return {
          totalRevenue,
          totalGoal,
          focusRevenue,
          focusGoal,
          totalAchievement: totalGoal > 0 ? Math.round((totalRevenue / totalGoal) * 100) : 0,
          focusAchievement: focusGoal > 0 ? Math.round((focusRevenue / focusGoal) * 100) : 0
        };
      };

      const stats = calculateGlobalStats();

      // RENDER GLOBAL HIGHLIGHTS
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(15, currentY, pageWidth - 30, 20, 3, 3, 'F');
      
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(isIndividual ? 'FATURAMENTO DO FUNCIONÁRIO' : 'FATURAMENTO GLOBAL', 25, currentY + 8);
      
      if (reportType === 'monthly') {
        doc.text(isIndividual ? 'ATINGIMENTO GERAL' : 'PRODUTIVIDADE GERAL', 115, currentY + 8);
      }

      doc.setTextColor(180, 0, 0);
      doc.setFontSize(14);
      doc.text(`R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, currentY + 15);
      
      if (reportType === 'monthly') {
        doc.text(`${stats.totalAchievement}%`, 115, currentY + 15);
      }
      
      currentY += 30;

      if (reportTarget === 'store') {
        // 1. BLOCK PERFORMANCE (REORDERED TO BE FIRST)
        doc.setTextColor(180, 0, 0);
        doc.setFontSize(11);
        doc.text('DESEMPENHO CONSOLIDADO DA LOJA POR BLOCO', 15, currentY);
        currentY += 6;

        const blockSummary = blocks.map(block => {
          const blockGoal = goals?.filter(g => g.block === block && !g.is_focus && g.profile === 'Líder').reduce((acc, g) => acc + g.value, 0) || 0;
          const blockProd = productions?.filter(p => p.product?.block === block).reduce((acc, p) => acc + (p.amount * (p.product?.multiplier || 0)), 0) || 0;
          
          if (reportType === 'daily') {
            return [
              block.toUpperCase(),
              `R$ ${blockProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ];
          }

          return [
            block.toUpperCase(),
            `R$ ${blockGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${blockProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `${blockGoal > 0 ? Math.round((blockProd / blockGoal) * 100) : 0}%`
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [reportType === 'daily' ? ['BLOCO', 'PRODUÇÃO DO DIA'] : ['BLOCO', 'META GLOBAL', 'PRODUÇÃO TOTAL', 'ATINGIMENTO TOTAL']],
          body: blockSummary,
          theme: 'striped',
          headStyles: { fillColor: [180, 0, 0] },
          styles: { fontSize: 9 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;

        // 2. FOCUS DETAILS (REORDERED TO SECOND)
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(11);
        doc.text('DETALHAMENTO PRODUTOS FOCO POR BLOCO', 15, currentY);
        currentY += 6;

        const focusByBlockData = blocks.map(block => {
          const profileToUse = 'Líder';
          const fGoal = goals?.filter(g => g.block === block && g.is_focus && g.profile === profileToUse).reduce((acc, g) => acc + g.value, 0) || 0;
          const fProd = productions?.filter(p => p.product?.block === block && p.product?.is_focus).reduce((acc, p) => acc + (p.amount * (p.product?.multiplier || 0)), 0) || 0;
          
          if (reportType === 'daily') {
            return [
              block.toUpperCase(),
              `R$ ${fProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ];
          }

          return [
            block.toUpperCase(),
            `R$ ${fGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${fProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            fGoal > 0 ? `${Math.round((fProd / fGoal) * 100)}%` : '0%'
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [reportType === 'daily' ? ['BLOCO', 'PRODUÇÃO FOCO DIA'] : ['BLOCO', 'META FOCO', 'PRODUÇÃO FOCO', 'ATINGIMENTO FOCO']],
          body: focusByBlockData,
          theme: 'striped',
          headStyles: { fillColor: [200, 100, 0] },
          styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;

        // 3. PRODUCTION EXTRACT (STORE CONSOLIDATED)
        doc.setFontSize(11);
        doc.setTextColor(180, 0, 0);
        doc.text('EXTRATO DE PRODUÇÃO', 15, currentY);
        currentY += 8;

        blocks.forEach(block => {
          const blockProds = products.filter(pr => pr.block === block && productions?.some(p => p.product_id === pr.id));
          if (blockProds.length === 0) return;

          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.setFont('helvetica', 'bold');
          doc.text(`BLOCO: ${block.toUpperCase()}`, 15, currentY);
          currentY += 4;

          const data = blockProds.map(pr => {
            const count = productions?.filter(p => p.product_id === pr.id).reduce((acc, p) => acc + p.amount, 0) || 0;
            const fat = productions?.filter(p => p.product_id === pr.id).reduce((acc, p) => acc + (p.amount * (p.product?.multiplier || 0)), 0) || 0;
            return [
              pr.name,
              `${count} ${isCurrencyProduct(pr.name, pr.block, pr.segment) ? '' : 'un.'}`,
              `R$ ${fat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ];
          });

          autoTable(doc, {
            startY: currentY,
            head: [['PRODUTO', 'QUANTIDADE TOTAL', 'FATURAMENTO TOTAL']],
            body: data,
            theme: 'grid',
            headStyles: { fillColor: [60, 60, 60] },
            styles: { fontSize: 8 },
            margin: { left: 15 },
          });

          currentY = (doc as any).lastAutoTable.finalY + 8;
          if (currentY > 260) {
            doc.addPage();
            currentY = 20;
          }
        });

      } else {
        // Individual Report
        const m = targetUser;
        const mProd = productions?.filter(p => p.user_id === m.id);

        // 1. INDIVIDUAL BLOCK PERFORMANCE (REORDERED TO FIRST)
        doc.setTextColor(180, 0, 0);
        doc.setFontSize(12);
        doc.text('DESEMPENHO INDIVIDUAL POR BLOCO', 15, currentY);
        currentY += 6;

        const mSummary = blocks.map(block => {
           const profileToUse = m.profile === 'Líder' || m.profile === 'Administrador' ? 'Líder' : 'Especialista Santander';
           const mGoal = goals?.filter(g => g.block === block && !g.is_focus && g.profile === profileToUse).reduce((acc, g) => acc + g.value, 0) || 0;
           const totalFat = mProd?.filter(p => p.product?.block === block).reduce((acc, p) => acc + (p.amount * (p.product?.multiplier || 0)), 0) || 0;

           if (reportType === 'daily') {
             return [
               block.toUpperCase(),
               `R$ ${totalFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
             ];
           }

           return [
             block.toUpperCase(),
             `R$ ${mGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
             `R$ ${totalFat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
             `${mGoal > 0 ? Math.round((totalFat / mGoal) * 100) : 0}%`
           ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [reportType === 'daily' ? ['BLOCO', 'PRODUÇÃO INDIV. DIA'] : ['BLOCO', 'META INDIV.', 'PRODUÇÃO INDIV.', 'ATINGIMENTO INDIV.']],
          body: mSummary,
          theme: 'striped',
          headStyles: { fillColor: [180, 0, 0] },
          styles: { fontSize: 9 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;

        // 2. FOCUS DETAILS (REORDERED TO SECOND)
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(11);
        doc.text('DETALHAMENTO PRODUTOS FOCO POR BLOCO', 15, currentY);
        currentY += 6;

        const focusByBlockData = blocks.map(block => {
          const profileToUse = m.profile === 'Líder' || m.profile === 'Administrador' ? 'Líder' : 'Especialista Santander';
          const fGoal = goals?.filter(g => g.block === block && g.is_focus && g.profile === profileToUse).reduce((acc, g) => acc + g.value, 0) || 0;
          const fProd = mProd?.filter(p => p.product?.block === block && p.product?.is_focus).reduce((acc, p) => acc + (p.amount * (p.product?.multiplier || 0)), 0) || 0;
          
          if (reportType === 'daily') {
            return [
              block.toUpperCase(),
              `R$ ${fProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            ];
          }

          return [
            block.toUpperCase(),
            `R$ ${fGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${fProd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            fGoal > 0 ? `${Math.round((fProd / fGoal) * 100)}%` : '0%'
          ];
        });

        autoTable(doc, {
          startY: currentY,
          head: [reportType === 'daily' ? ['BLOCO', 'PRODUÇÃO FOCO DIA'] : ['BLOCO', 'META FOCO', 'PRODUÇÃO FOCO', 'ATINGIMENTO FOCO']],
          body: focusByBlockData,
          theme: 'striped',
          headStyles: { fillColor: [200, 100, 0] },
          styles: { fontSize: 8 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;

        // 3. PRODUCTION EXTRACT (INDIVIDUAL)
        doc.setFontSize(11);
        doc.setTextColor(180, 0, 0);
        doc.text('EXTRATO DE PRODUÇÃO', 15, currentY);
        currentY += 8;

        if (mProd && mProd.length > 0) {
          blocks.forEach(block => {
            const blockSales = mProd.filter(p => p.product?.block === block);
            if (blockSales.length === 0) return;

            doc.setFontSize(9);
            doc.setTextColor(60, 60, 60);
          doc.setFont('helvetica', 'bold');
            doc.text(`BLOCO: ${block.toUpperCase()}`, 15, currentY);
            currentY += 4;

            // Group by product name
            const productAggregated: Record<string, { count: number, fat: number, is_focus: boolean }> = {};
            blockSales.forEach(s => {
              const name = s.product?.name || '?';
              if (!productAggregated[name]) {
                productAggregated[name] = { count: 0, fat: 0, is_focus: !!s.product?.is_focus };
              }
              productAggregated[name].count += s.amount;
              productAggregated[name].fat += s.amount * (s.product?.multiplier || 0);
            });

            const data = Object.entries(productAggregated).map(([name, data]) => {
              return [
                name,
                `${data.count} ${isCurrencyProduct(name, block, blockSales.find(s => s.product?.name === name)?.product?.segment) ? '' : 'un.'}`,
                `R$ ${data.fat.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              ];
            });

            autoTable(doc, {
              startY: currentY,
              head: [['PRODUTO', 'QUANTIDADE ACUMULADA', 'FATURAMENTO ACUMULADO']],
              body: data,
              theme: 'grid',
              headStyles: { fillColor: [60, 60, 60] },
              styles: { fontSize: 8 },
              margin: { left: 15 },
            });

            currentY = (doc as any).lastAutoTable.finalY + 8;
            if (currentY > 260) {
              doc.addPage();
              currentY = 20;
            }
          });
        } else {
          doc.setFontSize(10);
          doc.setTextColor(150, 150, 150);
          doc.text('Nenhuma venda registrada para este período.', 15, currentY + 5);
        }
      }

      const pageCount = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Página ${i} de ${pageCount}`, 15, 285);
      }

      doc.save(`Relatorio_Produtividade_${reportTarget}_${reportMonth}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar relatório: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
       <div className="flex items-center justify-between mb-2">
         <div className="flex items-center space-x-3">
           <div className="p-2 bg-red-50 rounded-xl">
             <FileText className="w-5 h-5 text-red-600" />
           </div>
           <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Central de Relatórios</h3>
         </div>
         {isLeader && (
           <span className="text-[9px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-black uppercase tracking-tight">MODO GESTÃO</span>
         )}
       </div>
       
       <div className="space-y-4">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1 tracking-widest">Mês de Referência</label>
             <select 
               value={reportMonth} 
               onChange={e => setReportMonth(e.target.value)}
               className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm shadow-inner uppercase text-slate-700"
             >
               {months.map(m => (
                 <option key={m} value={m}>
                   {format(new Date(m + '-01T12:00:00'), 'MMMM / yyyy', { locale: ptBR }).toUpperCase()}
                 </option>
               ))}
             </select>
           </div>

           {isLeader ? (
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1 tracking-widest">Alvo do Relatório</label>
               <select 
                 value={reportTarget} 
                 onChange={e => setReportTarget(e.target.value)}
                 className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm shadow-inner uppercase text-slate-700"
               >
                 <option value="store">CONSOLIDADO DA LOJA</option>
                 <optgroup label="Selecione um Funcionário">
                   {members.map(m => (
                     <option key={m.id} value={m.id}>{m.name.toUpperCase()} ({m.profile === 'Líder' ? 'LÍDER' : 'ESPEC.'})</option>
                   ))}
                 </optgroup>
               </select>
             </div>
           ) : (
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1 tracking-widest">Relatório Pessoal</label>
               <div className="w-full p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-sm uppercase text-slate-400 italic">
                 {user.name} ({user.profile})
               </div>
             </div>
           )}
         </div>

         <div className="flex gap-4">
           <button 
             onClick={() => setReportType('daily')}
             className={cn("flex-1 p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all shadow-sm", reportType === 'daily' ? "bg-red-50 border-red-200 text-red-600 ring-2 ring-red-100" : "bg-white border-slate-100 text-slate-400")}
           >
             <Clock className="w-5 h-5" />
             <span className="text-[10px] font-black uppercase">DIÁRIO</span>
           </button>
           <button 
             onClick={() => setReportType('monthly')}
             className={cn("flex-1 p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all shadow-sm", reportType === 'monthly' ? "bg-red-50 border-red-200 text-red-600 ring-2 ring-red-100" : "bg-white border-slate-100 text-slate-400")}
           >
             <Calendar className="w-5 h-5" />
             <span className="text-[10px] font-black uppercase">MENSAL</span>
           </button>
         </div>

         {reportType === 'daily' && (
           <div className="animate-in zoom-in-95 duration-200">
             <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-1 tracking-widest">Data do Relatório Diário</label>
             <input 
               type="date"
               value={reportDate}
               onChange={e => setReportDate(e.target.value)}
               className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm shadow-inner text-slate-700"
             />
           </div>
         )}

         <button 
           onClick={generateReport}
           disabled={loading}
           className="w-full bg-red-600 text-white p-5 rounded-2xl font-black italic uppercase shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 group transform active:scale-95"
         >
           {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />}
           {loading ? 'Processando Documento...' : 'Gerar Relatório em PDF'}
         </button>
       </div>

       <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
         <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed text-center">
           Documento gerado em formato PDF A4.<br />
           {isLeader 
             ? "Visualize o desempenho consolidado da unidade ou selecione um especialista para análise detalhada e extrato de vendas."
             : "Seu relatório contém o resumo de produtividade, atingimento de metas e extrato detalhado de suas vendas."
           }
         </p>
       </div>
    </div>
  );
}
