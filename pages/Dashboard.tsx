
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/db';
import { Work, Notification, Step, StepStatus, PlanType } from '../types';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards';
import { ZeModal } from '../components/ZeModal';

// --- COMPONENTE SKELETON (Carregamento Visual) ---
const DashboardSkeleton = () => (
  <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-end mb-8">
          <div className="space-y-2">
              <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
              <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          </div>
          <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      </div>
      
      {/* Zé Tip Skeleton */}
      <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl mb-8"></div>
      
      {/* Main HUD Skeleton */}
      <div className="h-64 w-full bg-slate-200 dark:bg-slate-800 rounded-[1.4rem] mb-8"></div>
      
      {/* List Skeleton */}
      <div className="space-y-4">
          <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-full mb-2"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
              <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
              <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          </div>
      </div>
  </div>
);

// Helper para formatar data
const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [, month, day] = dateStr.split('-');
        return `${day}/${month}`;
    }
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch (e) {
        return dateStr;
    }
};

const Dashboard: React.FC = () => {
  const { user, trialDaysRemaining, loading: authLoading } = useAuth(); // Import authLoading
  const navigate = useNavigate();
  
  // Data State
  const [works, setWorks] = useState<Work[]>([]);
  const [focusWork, setFocusWork] = useState<Work | null>(null);
  
  // Dashboard Metrics State
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });
  const [dailySummary, setDailySummary] = useState({ completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingSteps, setUpcomingSteps] = useState<Step[]>([]);
  
  // Loading States (Optimized with Safety Timeout)
  const [isLoadingWorks, setIsLoadingWorks] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // UI States
  const [currentTip] = useState<ZeTip>(() => getRandomZeTip());
  const [showWorkSelector, setShowWorkSelector] = useState(false);
  const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, workId?: string}>({isOpen: false, title: '', message: ''});
  const [showTrialUpsell, setShowTrialUpsell] = useState(false);

  // 1. Initial Load: Busca lista de obras
  useEffect(() => {
    // CRITICAL FIX: Do not attempt to load works if Auth is still determining session.
    // This prevents the dashboard from thinking "User is null" -> "Show Empty State" prematurely.
    if (authLoading) return;

    let isMounted = true;
    
    // SAFETY: Force stop loading after 4 seconds (reduced from 8s)
    const safetyTimeout = setTimeout(() => {
        if (isMounted && isLoadingWorks) {
            console.warn("Dashboard load timed out. Forcing UI.");
            setIsLoadingWorks(false);
        }
    }, 4000);

    const fetchWorks = async () => {
        // If auth finished and we still have no user, stop loading (display empty/login state)
        if (!user) {
            if (isMounted) setIsLoadingWorks(false);
            return;
        }
        
        try {
            const data = await dbService.getWorks(user.id);
            
            if (isMounted) {
                setWorks(data);
                
                if (data.length > 0) {
                    setFocusWork(prev => {
                        // Keep current focus if it still exists in the new list
                        if (prev) {
                            const exists = data.find(w => w.id === prev.id);
                            if (exists) return exists;
                        }
                        // Otherwise default to first
                        return data[0];
                    });
                } else {
                    setFocusWork(null);
                }
                setIsLoadingWorks(false);
            }
        } catch (e) {
            console.error("Erro ao buscar obras:", e);
            if (isMounted) setIsLoadingWorks(false);
        }
    };

    fetchWorks();
    return () => { 
        isMounted = false; 
        clearTimeout(safetyTimeout);
    };
  }, [user, authLoading]); // Added authLoading dependency

  // 2. Details Load: Busca os dados pesados
  useEffect(() => {
      let isMounted = true;

      const fetchDetails = async () => {
          if (!focusWork || !user) {
              setIsLoadingDetails(false);
              return;
          }

          setIsLoadingDetails(true);
          
          try {
            const [workStats, summary, notifs, steps] = await Promise.all([
                dbService.calculateWorkStats(focusWork.id),
                dbService.getDailySummary(focusWork.id),
                dbService.getNotifications(user.id),
                dbService.getSteps(focusWork.id)
            ]);

            if (isMounted) {
                setStats(workStats);
                setDailySummary(summary);
                setNotifications(notifs);

                const nextSteps = steps
                    .filter(s => s.status !== StepStatus.COMPLETED)
                    .sort((a: Step, b: Step) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                    .slice(0, 3);
                setUpcomingSteps(nextSteps);
            }
            
            dbService.generateSmartNotifications(user.id, focusWork.id);

          } catch (e) {
              console.error("Erro nos detalhes:", e);
          } finally {
              if (isMounted) setIsLoadingDetails(false);
          }
      };

      if (focusWork?.id) {
          fetchDetails();
      } else if (works.length > 0 && !focusWork) {
          // Fallback if focusWork was lost but works exist
          setFocusWork(works[0]);
      } else {
          setIsLoadingDetails(false);
      }
      
      return () => { isMounted = false; };
  }, [focusWork?.id, user]);

  useEffect(() => {
    if (user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining <= 1) {
        setShowTrialUpsell(true);
    }
  }, [user, trialDaysRemaining]);

  const handleSwitchWork = (work: Work) => {
      if (focusWork?.id !== work.id) {
          setFocusWork(work);
          setShowWorkSelector(false);
      }
  };

  const handleAccessWork = () => {
      if (focusWork && focusWork.id) {
          navigate(`/work/${focusWork.id}`);
      }
  };

  const handleDeleteClick = (e: React.MouseEvent, workId: string, workName: string) => {
      e.stopPropagation();
      setZeModal({
          isOpen: true,
          title: "Apagar Obra",
          message: `Tem certeza? Ao apagar a obra "${workName}", todo o histórico de gastos, compras e cronograma será perdido permanentemente.`,
          workId: workId
      });
  };

  const confirmDelete = async () => {
      if (zeModal.workId && user) {
          try {
            setIsLoadingWorks(true); 
            await dbService.deleteWork(zeModal.workId);
            
            const updatedWorks = await dbService.getWorks(user.id);
            setWorks(updatedWorks);
            setZeModal({isOpen: false, title: '', message: ''});
  
            if (updatedWorks.length > 0) {
                const stillExists = updatedWorks.find(w => w.id === focusWork?.id);
                setFocusWork(stillExists || updatedWorks[0]);
            } else {
                setFocusWork(null);
            }
          } catch (e) {
              console.error("Erro ao apagar", e);
              alert("Erro ao excluir obra.");
          } finally {
              setIsLoadingWorks(false);
          }
      }
  };

  const handleDismiss = async (id: string) => {
      await dbService.dismissNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleClearAll = async () => {
      if (!user) return;
      await dbService.clearAllNotifications(user.id);
      setNotifications([]);
  };

  // --- RENDERIZADORES ---

  if (authLoading || isLoadingWorks) return <DashboardSkeleton />;

  if (works.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center animate-in fade-in duration-500">
            <div className="w-24 h-24 bg-gradient-gold rounded-[2rem] flex items-center justify-center text-white mb-8 shadow-glow transform rotate-3">
                <i className="fa-solid fa-helmet-safety text-5xl"></i>
            </div>
            <h2 className="text-3xl font-bold text-primary dark:text-white mb-4 tracking-tight">Bem-vindo ao Mãos da Obra</h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-md mb-10 leading-relaxed">
                Gestão profissional para sua construção. Simples, visual e direto ao ponto. Vamos começar sua primeira obra?
            </p>
            <button 
                onClick={() => navigate('/create')}
                className="bg-primary hover:bg-primary-dark dark:bg-white dark:hover:bg-slate-200 text-white dark:text-primary font-bold py-4 px-10 rounded-2xl shadow-xl transition-all flex items-center gap-3 text-lg"
            >
                <i className="fa-solid fa-plus"></i> Iniciar Projeto
            </button>
        </div>
      );
  }

  if (!focusWork) return <DashboardSkeleton />;

  const budgetUsage = focusWork.budgetPlanned > 0 ? (stats.totalSpent / focusWork.budgetPlanned) * 100 : 0;
  const budgetPercentage = Math.round(budgetUsage);
  
  const hasDelay = dailySummary.delayedSteps > 0;
  const isOverBudget = budgetPercentage > 100;
  const isNearBudget = budgetPercentage > 85;
  
  let statusGradient = 'from-secondary to-yellow-500';
  let statusIcon = 'fa-thumbs-up';
  let statusMessage = 'Tudo sob controle';
  
  if (hasDelay || isOverBudget) {
      statusGradient = 'from-red-600 to-red-400';
      statusIcon = 'fa-triangle-exclamation';
      statusMessage = 'Atenção necessária';
  } else if (isNearBudget || dailySummary.pendingMaterials > 2) {
      statusGradient = 'from-orange-500 to-amber-400';
      statusIcon = 'fa-circle-exclamation';
      statusMessage = 'Pontos de atenção';
  }

  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans animate-in fade-in">
      
      {/* Header Area */}
      <div className="mb-8 flex items-end justify-between relative z-20">
          <div>
            <p className="text-xs text-secondary font-bold uppercase tracking-widest mb-1">Painel de Controle</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-primary dark:text-white leading-tight tracking-tight">
                Olá, {user?.name.split(' ')[0]}
            </h1>
          </div>
          {works.length > 0 && (
             <div className="relative flex items-center gap-2">
                 <button 
                    onClick={() => setShowWorkSelector(!showWorkSelector)}
                    className="text-sm text-primary dark:text-white font-bold bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-secondary transition-all flex items-center gap-2"
                 >
                     <i className="fa-solid fa-building text-secondary"></i>
                     <span className="max-w-[120px] truncate">{focusWork.name}</span> 
                     <i className={`fa-solid fa-chevron-down text-xs transition-transform ${showWorkSelector ? 'rotate-180' : ''}`}></i>
                 </button>
                 
                 <button 
                    onClick={(e) => handleDeleteClick(e, focusWork.id, focusWork.name)}
                    className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900 dark:hover:text-red-400 flex items-center justify-center shadow-sm transition-all"
                    title="Excluir Obra Atual"
                 >
                     <i className="fa-solid fa-trash"></i>
                 </button>
                 
                 {showWorkSelector && (
                     <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                         <div className="p-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                             <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Minhas Obras</p>
                         </div>
                         {works.map((w: Work) => (
                             <div
                                key={w.id}
                                className={`w-full px-5 py-4 text-sm font-medium border-b last:border-0 border-slate-50 dark:border-slate-800 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${focusWork.id === w.id ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                                onClick={() => handleSwitchWork(w)}
                             >
                                <span className={`flex-1 truncate ${focusWork.id === w.id ? 'text-secondary font-bold' : 'text-slate-600 dark:text-slate-300'}`}>{w.name}</span>
                                <div className="flex items-center gap-3">
                                    {focusWork.id === w.id && <i className="fa-solid fa-check text-secondary"></i>}
                                </div>
                             </div>
                         ))}
                         <button
                            onClick={() => navigate('/create')}
                            className="w-full text-left px-5 py-4 text-sm font-bold text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                         >
                            <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center">
                                <i className="fa-solid fa-plus text-xs"></i>
                            </div>
                            Nova Obra
                         </button>
                     </div>
                 )}
             </div>
          )}
      </div>
      
      {/* ZÉ DA OBRA TIP */}
      <div className="mb-8 relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm group hover:shadow-md transition-all">
           <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl translate-x-10 -translate-y-10 group-hover:bg-secondary/20 transition-all"></div>
           <div className="flex items-center gap-5 p-5 relative z-10">
                <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-300 dark:from-slate-700 dark:to-slate-800 shrink-0 shadow-inner">
                        <img 
                        src={ZE_AVATAR} 
                        alt="Zeca da Obra" 
                        className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800 bg-white"
                        onError={(e) => { 
                            const target = e.currentTarget;
                            if (target.src !== ZE_AVATAR_FALLBACK) {
                                target.src = ZE_AVATAR_FALLBACK;
                            }
                        }}
                        />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Dica do Zé: {currentTip.tag}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic font-medium">
                        "{currentTip.text}"
                    </p>
                </div>
           </div>
      </div>

      {/* Access Button (Floating CTA) */}
      <button 
        type="button"
        onClick={handleAccessWork}
        className="group w-full mb-8 relative overflow-hidden rounded-2xl bg-primary dark:bg-white text-white dark:text-primary shadow-2xl hover:shadow-glow transition-all active:scale-[0.98] cursor-pointer"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 dark:bg-primary/10 flex items-center justify-center">
                    <i className="fa-solid fa-arrow-right-to-bracket text-xl"></i>
                </div>
                <div className="text-left">
                    <h3 className="text-lg font-bold">Acessar Minha Obra</h3>
                    <p className="text-xs opacity-80 font-medium">Gerenciar etapas, compras e gastos</p>
                </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xl opacity-50 group-hover:translate-x-1 transition-transform"></i>
        </div>
      </button>

      {/* MAIN HUD (SKELETON IF LOADING) */}
      {isLoadingDetails ? (
          <div className="glass-panel rounded-3xl p-1 shadow-2xl mb-8 relative z-0 animate-pulse">
              <div className="bg-white/50 dark:bg-slate-800/60 rounded-[1.4rem] p-6 h-64"></div>
          </div>
      ) : (
          <div className="glass-panel rounded-3xl p-1 shadow-2xl mb-8 relative z-0">
              <div className="bg-white/50 dark:bg-slate-800/60 rounded-[1.4rem] p-6 lg:p-8 backdrop-blur-xl">
                  {/* Status Header */}
                  <div className="flex items-center gap-4 mb-8">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${statusGradient} flex items-center justify-center text-white text-3xl shadow-lg transform -rotate-3`}>
                          <i className={`fa-solid ${statusIcon}`}></i>
                      </div>
                      <div>
                          <h2 className="text-2xl font-bold text-primary dark:text-white leading-tight">{statusMessage}</h2>
                          <p className="text-slate-500 dark:text-slate-400 font-medium">Resumo de hoje</p>
                      </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                      {/* Card 1: Tarefas */}
                      <div 
                        onClick={handleAccessWork}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg bg-white dark:bg-slate-800/80 ${hasDelay ? 'border-red-500/30' : 'border-slate-100 dark:border-slate-700'}`}
                      >
                          <div className="flex justify-between items-start mb-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasDelay ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                  <i className="fa-solid fa-list-check"></i>
                              </div>
                              {hasDelay && <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>}
                          </div>
                          <p className="text-3xl font-extrabold text-primary dark:text-white mb-1">
                              {hasDelay ? dailySummary.delayedSteps : dailySummary.completedSteps}
                          </p>
                          <p className={`text-xs font-bold uppercase tracking-wider ${hasDelay ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                              {hasDelay ? 'Atrasadas' : 'Concluídas'}
                          </p>
                      </div>

                      {/* Card 2: Compras */}
                      <div 
                        onClick={handleAccessWork}
                        className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg"
                      >
                          <div className="flex justify-between items-start mb-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-secondary flex items-center justify-center">
                                  <i className="fa-solid fa-cart-shopping"></i>
                              </div>
                          </div>
                          <p className="text-3xl font-extrabold text-primary dark:text-white mb-1">
                              {dailySummary.pendingMaterials}
                          </p>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Pendentes
                          </p>
                      </div>

                      {/* Card 3: Progresso (Full width on mobile) */}
                      <div className="col-span-2 md:col-span-1 p-5 rounded-2xl bg-gradient-to-br from-primary to-slate-800 text-white shadow-xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                          <div className="relative z-10">
                            <div className="flex justify-between items-start mb-3">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                    <i className="fa-solid fa-chart-pie"></i>
                                </div>
                                <span className="font-bold text-lg">{stats.progress}%</span>
                            </div>
                            <div className="h-2 bg-black/20 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-secondary shadow-[0_0_10px_rgba(217,119,6,0.5)]" style={{ width: `${stats.progress}%` }}></div>
                            </div>
                            <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Progresso Geral</p>
                          </div>
                      </div>
                  </div>

                  {/* Financial Strip */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 h-1 bg-slate-200 dark:bg-slate-700 w-full"></div>
                      <div className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${isOverBudget ? 'bg-danger shadow-[0_0_15px_red]' : 'bg-success shadow-[0_0_15px_lime]'}`} style={{ width: `${Math.min(budgetPercentage, 100)}%` }}></div>

                      <div className="flex justify-between items-end mb-2 relative z-10">
                          <div>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Orçamento Utilizado</p>
                              <p className="text-xl font-bold text-primary dark:text-white">
                                  R$ {stats.totalSpent.toLocaleString('pt-BR')} 
                                  <span className="text-sm font-normal text-slate-400 dark:text-slate-500 mx-2">/</span>
                                  <span className="text-sm text-slate-400 dark:text-slate-500">R$ {focusWork.budgetPlanned.toLocaleString('pt-BR')}</span>
                              </p>
                          </div>
                          <div className={`px-3 py-1 rounded-lg text-sm font-bold ${isOverBudget ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                              {budgetPercentage}%
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* UPCOMING STEPS & NOTIFICATIONS */}
      {isLoadingDetails ? (
          <div className="space-y-4 animate-pulse">
              <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
              <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl"></div>
          </div>
      ) : (
          <>
            {upcomingSteps.length > 0 && (
                <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4 px-1">
                        <i className="fa-solid fa-calendar-day"></i> Próximas Etapas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {upcomingSteps.map((step) => {
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            
                            const [y, m, d] = step.startDate.split('-').map(Number);
                            const startDate = new Date(y, m - 1, d); 
                            
                            const diffTime = startDate.getTime() - today.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            let statusLabel = '';
                            let statusColor = 'text-slate-400 bg-slate-100 dark:bg-slate-800';
                            
                            if (diffDays < 0) {
                                statusLabel = 'Atrasado';
                                statusColor = 'text-red-600 bg-red-100 dark:bg-red-900/30';
                            } else if (diffDays === 0) {
                                statusLabel = 'Começa Hoje';
                                statusColor = 'text-green-600 bg-green-100 dark:bg-green-900/30';
                            } else {
                                statusLabel = `Em ${diffDays} dias`;
                                statusColor = 'text-secondary bg-orange-100 dark:bg-orange-900/20';
                            }

                            return (
                                <div key={step.id} onClick={handleAccessWork} className="cursor-pointer bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 shadow-sm hover:shadow-md hover:border-secondary/30 transition-all">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                                        <i className="fa-regular fa-calendar"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-primary dark:text-white text-sm truncate">{step.name}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateDisplay(step.startDate)}</p>
                                    </div>
                                    <div className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase whitespace-nowrap ${statusColor}`}>
                                        {statusLabel}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-regular fa-bell"></i> Avisos Recentes
                    </h3>
                    {notifications.length > 0 && (
                        <button onClick={handleClearAll} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors">Limpar tudo</button>
                    )}
                </div>
                
                <div className="space-y-3">
                    {notifications.length > 0 ? (
                        notifications.map(notif => (
                            <div key={notif.id} className={`group relative p-4 rounded-2xl border flex items-start gap-4 transition-all ${notif.type === 'WARNING' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                                <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${notif.type === 'WARNING' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                                    <i className={`fa-solid ${notif.type === 'WARNING' ? 'fa-bolt' : 'fa-info'} text-sm`}></i>
                                </div>
                                <div className="flex-1 pr-6">
                                    <h4 className="text-sm font-bold text-primary dark:text-white mb-0.5">{notif.title}</h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug">{notif.message}</p>
                                </div>
                                <button onClick={() => handleDismiss(notif.id)} className="absolute top-2 right-2 text-slate-300 hover:text-slate-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-xmark"></i></button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                            <p className="text-slate-400 text-sm font-medium">Nenhum aviso urgente. Tudo em paz! 🍃</p>
                        </div>
                    )}
                </div>
            </div>
          </>
      )}

      <button 
        onClick={() => navigate('/create')}
        className="fixed bottom-6 right-6 md:hidden w-16 h-16 rounded-full bg-gradient-gold text-white shadow-2xl flex items-center justify-center z-50 hover:scale-110 transition-transform active:scale-90"
      >
        <i className="fa-solid fa-plus text-2xl"></i>
      </button>

      <ZeModal 
        isOpen={zeModal.isOpen}
        title={zeModal.title}
        message={zeModal.message}
        confirmText="Sim, apagar obra"
        onConfirm={confirmDelete}
        onCancel={() => setZeModal({isOpen: false, title: '', message: ''})}
      />

      {showTrialUpsell && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-sm p-0 shadow-2xl border border-slate-800 relative overflow-hidden transform scale-100 animate-in zoom-in-95">
                <div className="bg-gradient-premium p-8 relative overflow-hidden text-center">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/20 rounded-full blur-3xl translate-x-10 -translate-y-10"></div>
                    <div className="w-20 h-20 mx-auto rounded-full bg-red-600 border-4 border-slate-900 flex items-center justify-center text-3xl text-white shadow-xl mb-4 animate-pulse"><i className="fa-solid fa-hourglass-end"></i></div>
                    <h2 className="text-2xl font-black text-white mb-1 tracking-tight">ÚLTIMO DIA!</h2>
                    <p className="text-slate-300 text-sm font-medium">Seu teste grátis acaba hoje.</p>
                </div>
                <div className="p-8">
                    <p className="text-center text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">Não perca o acesso às suas obras. Garanta o plano <strong>Vitalício</strong> agora e nunca mais se preocupe com mensalidades.</p>
                    <div className="space-y-3">
                        <button onClick={() => navigate(`/checkout?plan=${PlanType.VITALICIO}`)} className="w-full py-4 bg-gradient-gold text-white font-black rounded-2xl shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all flex items-center justify-center gap-2 group"><i className="fa-solid fa-crown text-yellow-200"></i> Quero Vitalício <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i></button>
                        <button onClick={() => setShowTrialUpsell(false)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wide">Manter plano atual</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

