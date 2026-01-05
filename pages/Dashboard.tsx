
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, WorkStatus, type Work, type DBNotification, type Step, type Material } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';
import { ZeModal } from '../components/ZeModal.tsx'; 

/** =========================
 * UI helpers
 * ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

// Updated to use new shadow classes
const surface =
  "bg-white border border-slate-200/90 shadow-card-default ring-1 ring-black/5 " +
  "dark:bg-slate-900/70 dark:border-slate-800 dark:shadow-card-dark-subtle dark:ring-0";

const card = "rounded-3xl p-6 lg:p-8";
const mutedText = "text-slate-500 dark:text-slate-400";

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

// Helper para formatar valores monetários
const formatCurrency = (value: number | string | undefined): string => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 'R$ 0,00';
  }
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** =========================
 * Skeleton
 *========================= */
const DashboardSkeleton = () => (
  <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 animate-pulse">
    {/* Header */}
    <div className="flex justify-between items-end mb-8">
      <div className="space-y-2">
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      </div>
      <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
    </div>
    
    {/* Ze Tip Skeleton */}
    <div className={cx(surface, "rounded-3xl p-4 md:p-5 flex items-start gap-4 mb-6")}>
      <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
      </div>
    </div>

    {/* Work Selector & Actions */}
    <div className="flex items-center gap-4 mb-8">
      <div className="h-12 flex-1 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      <div className="h-12 w-12 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
    </div>

    {/* Daily Summary Skeleton */}
    <div className={cx(surface, "rounded-3xl p-6 mb-8")}>
      <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-lg mb-4"></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl p-3">
            <div className="h-4 w-8 bg-slate-200 dark:bg-slate-700 rounded-full mb-2"></div>
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
    
    {/* Progress Bar Skeleton */}
    <div className={cx(surface, "rounded-3xl p-6 mb-8")}>
      <div className="h-6 w-1/4 bg-slate-200 dark:bg-slate-800 rounded-lg mb-4"></div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2"></div>
      <div className="flex justify-between text-xs text-slate-400">
        <div className="h-3 w-1/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="h-3 w-1/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="h-3 w-1/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="h-3 w-1/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
      </div>
    </div>

    {/* Budget Overview Skeleton */}
    <div className={cx(surface, "rounded-3xl p-6 mb-8")}> {/* Added mb-8 for spacing */}
      <div className="h-6 w-1/4 bg-slate-200 dark:bg-slate-800 rounded-lg mb-4"></div>
      <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded-full mb-2"></div>
      <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
    </div>

    {/* Access Work Button Skeleton */}
    <div className="h-14 w-full bg-secondary rounded-2xl"></div> {/* Skeleton for the access button */}
  </div>
);

/** =========================
 * Sub-Componentes
 * ========================= */

// NEW: Segmented Progress Bar Component (used for Work Detail)
const SegmentedProgressBar = ({ steps }: { steps: Step[] }) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 flex">
        <div className="h-full bg-slate-300 rounded-full" style={{ width: '100%' }}></div>
      </div>
    );
  }

  const totalSteps = steps.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today's date to midnight

  const completed = steps.filter(s => s.status === StepStatus.COMPLETED);
  const inProgress = steps.filter(s => s.status === StepStatus.IN_PROGRESS && new Date(s.endDate).setHours(0,0,0,0) >= today.getTime());
  const notStarted = steps.filter(s => s.status === StepStatus.NOT_STARTED && new Date(s.endDate).setHours(0,0,0,0) >= today.getTime()); 
  const delayed = steps.filter(s => s.status !== StepStatus.COMPLETED && new Date(s.endDate).setHours(0,0,0,0) < today.getTime());

  // Calculate percentages based on the new, mutually exclusive categories
  const completedPct = (completed.length / totalSteps) * 100;
  const inProgressPct = (inProgress.length / totalSteps) * 100;
  const delayedPct = (delayed.length / totalSteps) * 100;
  const notStartedPct = (notStarted.length / totalSteps) * 100;


  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 flex overflow-hidden">
      {/* Completed segment */}
      {completedPct > 0 && (
        <div 
          className="h-full bg-green-500" 
          style={{ width: `${completedPct}%` }} 
          title={`${completed.length} Concluída(s)`}
          aria-label={`${completed.length} etapas concluídas`}
        ></div>
      )}
      {/* In Progress segment */}
      {inProgressPct > 0 && (
        <div 
          className="h-full bg-amber-500"
          style={{ width: `${inProgressPct}%` }} 
          title={`${inProgress.length} Em Andamento`}
          aria-label={`${inProgress.length} etapas em andamento`}
        ></div>
      )}
      {/* Delayed segment */}
      {delayedPct > 0 && (
        <div 
          className="h-full bg-red-500" 
          style={{ width: `${delayedPct}%` }} 
          title={`${delayed.length} Atrasada(s)`}
          aria-label={`${delayed.length} etapas atrasadas`}
        ></div>
      )}
      {/* Not Started segment */}
      {notStartedPct > 0 && (
        <div 
          className="h-full bg-slate-400 dark:bg-slate-600"
          style={{ width: `${notStartedPct}%` }} 
          title={`${notStarted.length} Pendente(s)`}
          aria-label={`${notStarted.length} etapas pendentes`}
        ></div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user, authLoading, isUserAuthFinished, isSubscriptionValid, unreadNotificationsCount, requestPushNotificationPermission, pushSubscriptionStatus } = useAuth();
  const navigate = ReactRouter.useNavigate();
  
  // All works available to the user
  const [allWorks, setAllWorks] = useState<Work[]>([]);
  // The currently selected work for display
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  // Data for the selected work's dashboard summary
  const [workSummary, setWorkSummary] = useState<{
    totalSteps: number;
    completedSteps: number;
    inProgressSteps: number;
    delayedSteps: number;
    pendingMaterials: number;
    totalSpent: number;
    budgetPlanned: number;
  } | null>(null);
  const [selectedWorkSteps, setSelectedWorkSteps] = useState<Step[]>([]); // For progress bar
  
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [isDeletingWork, setIsDeletingWork] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Ref to track notification count changes for data refresh
  const notificationCountRef = useRef(unreadNotificationsCount);

  // =======================================================================
  // DATA LOADING
  // =======================================================================

  const loadAllWorks = useCallback(async () => {
    if (!user?.id || !isUserAuthFinished || authLoading) {
      setLoadingDashboard(false);
      return;
    }

    setLoadingDashboard(true);
    try {
      const fetchedWorks = await dbService.getWorks(user.id);
      setAllWorks(fetchedWorks);

      if (fetchedWorks.length > 0) {
        // If a work was previously selected (e.g., from local storage or URL), try to maintain it
        const lastSelectedWorkId = localStorage.getItem('lastSelectedWorkId');
        const defaultWork = fetchedWorks.find(w => w.id === lastSelectedWorkId) || fetchedWorks[0];
        
        setSelectedWork(defaultWork);
        await loadSelectedWorkData(defaultWork.id);
      } else {
        setSelectedWork(null);
        setWorkSummary(null);
        setSelectedWorkSteps([]);
      }
      
      // Request push notification permission after data loads
      if (pushSubscriptionStatus === 'idle' && isSubscriptionValid) {
        requestPushNotificationPermission();
      }

    } catch (error) {
      console.error("Erro ao carregar todas as obras:", error);
      setAllWorks([]);
      setSelectedWork(null);
      setWorkSummary(null);
      setSelectedWorkSteps([]);
    } finally {
      setLoadingDashboard(false);
    }
  }, [user, isUserAuthFinished, authLoading, isSubscriptionValid, pushSubscriptionStatus, requestPushNotificationPermission]);

  const loadSelectedWorkData = useCallback(async (workId: string) => {
    setLoadingDashboard(true);
    try {
      const [fetchedSteps, fetchedMaterials, fetchedExpenses, fetchedWork] = await Promise.all([
        dbService.getSteps(workId),
        dbService.getMaterials(workId),
        dbService.getExpenses(workId),
        dbService.getWorkById(workId) // Fetch full work details
      ]);

      if (fetchedWork) {
          setSelectedWork(fetchedWork);
          localStorage.setItem('lastSelectedWorkId', fetchedWork.id); // Save last selected work
      } else {
          // Should not happen if workId came from loadAllWorks, but for safety
          return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date to midnight

      const totalSteps = fetchedSteps.length;
      const completedSteps = fetchedSteps.filter(s => s.status === StepStatus.COMPLETED).length;
      
      // Delayed steps are those not completed and whose end date has passed
      const delayedStepsArray = fetchedSteps.filter(s => s.status !== StepStatus.COMPLETED && new Date(s.endDate).setHours(0,0,0,0) < today.getTime());
      const delayedStepsCount = delayedStepsArray.length;
      
      // In progress steps are those currently in progress and not delayed
      const inProgressSteps = fetchedSteps.filter(s => 
        s.status === StepStatus.IN_PROGRESS && !delayedStepsArray.some(d => d.id === s.id)
      ).length;

      const pendingMaterials = fetchedMaterials.filter(m => m.purchasedQty < m.plannedQty).length;
      const totalSpent = fetchedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      setWorkSummary({
        totalSteps,
        completedSteps,
        inProgressSteps,
        delayedSteps: delayedStepsCount,
        pendingMaterials,
        totalSpent,
        budgetPlanned: fetchedWork.budgetPlanned
      });
      setSelectedWorkSteps(fetchedSteps);

    } catch (error) {
      console.error(`Erro ao carregar dados da obra ${workId}:`, error);
      setWorkSummary(null);
      setSelectedWorkSteps([]);
    } finally {
      setLoadingDashboard(false);
    }
  }, []); // No dependencies for memoization, as workId is passed as argument

  useEffect(() => {
    loadAllWorks();
  }, [loadAllWorks]);

  // Refresh data when notifications are dismissed (as notification status can affect dashboard metrics)
  useEffect(() => {
      if (unreadNotificationsCount !== notificationCountRef.current) {
          notificationCountRef.current = unreadNotificationsCount;
          if (selectedWork) {
            loadSelectedWorkData(selectedWork.id);
          } else {
            loadAllWorks(); // If no work selected, refresh overall work list
          }
      }
  }, [unreadNotificationsCount, selectedWork, loadSelectedWorkData, loadAllWorks]);

  // =======================================================================
  // HANDLERS
  // =======================================================================

  const handleWorkSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const workId = e.target.value;
    const work = allWorks.find(w => w.id === workId);
    if (work) {
      setSelectedWork(work);
      await loadSelectedWorkData(work.id);
    }
  };

  const handleDeleteSelectedWork = async () => {
    if (!selectedWork) return;

    setIsDeletingWork(true);
    setDeleteError('');
    try {
      await dbService.deleteWork(selectedWork.id);
      setShowDeleteModal(false);
      
      // After deletion, reload all works to update the list and re-select if possible
      await loadAllWorks(); 

      // If no works remain, clear selected work; otherwise, the new loadAllWorks will set default
      if (allWorks.length === 0) {
        setSelectedWork(null);
        setWorkSummary(null);
        localStorage.removeItem('lastSelectedWorkId');
      }
    } catch (error: any) {
      console.error("Erro ao excluir obra:", error);
      setDeleteError(error.message);
    } finally {
      setIsDeletingWork(false);
    }
  };

  // =======================================================================
  // RENDERING
  // =======================================================================

  // Show skeleton while initial authentication or data fetching is in progress.
  if (!isUserAuthFinished || authLoading || loadingDashboard) {
    return <DashboardSkeleton />;
  }

  // If user is null AFTER auth is finished, redirect to login.
  if (!user) {
    console.log("[Dashboard] No user after auth finished. Redirecting to /login.");
    return <ReactRouter.Navigate to="/login" replace />;
  }

  // No Works State
  if (allWorks.length === 0) {
    return (
      <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans">
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Bem-vindo(a) de volta</p>
            <h1 className="text-3xl font-black text-primary dark:text-white">{user.name.split(' ')[0]}!</h1>
          </div>
          <button onClick={() => navigate('/create')} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Criar nova obra">
            <i className="fa-solid fa-plus-circle"></i> Nova Obra
          </button>
        </div>

        {/* Static Ze Tip */}
        <div className={cx(surface, "rounded-3xl p-4 md:p-5 flex items-start gap-4 mb-6 transition-all duration-300 transform animate-in fade-in slide-in-from-top-4")} role="status">
            <div className="w-12 h-12 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0">
                <img 
                src={ZE_AVATAR} 
                alt="Zé da Obra" 
                className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800"
                onError={(e) => { 
                    const target = e.currentTarget;
                    if (target.src !== ZE_AVATAR_FALLBACK) {
                        target.src = ZE_AVATAR_FALLBACK;
                    }
                }}
                />
            </div>
            <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-widest mb-1 text-secondary">Dica do Zé!</p>
                <p className="text-primary dark:text-white font-bold text-base leading-tight">
                  Sua obra começa aqui! Clique em "Nova Obra" para começar a planejar seu projeto e ter tudo na palma da sua mão.
                </p>
            </div>
        </div>

        {/* No works card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-4">Nenhuma obra cadastrada ainda.</p>
          <button onClick={() => navigate('/create')} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors" aria-label="Criar sua primeira obra">
            Criar sua primeira obra
          </button>
        </div>
      </div>
    );
  }

  // Main Dashboard Content
  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Bem-vindo(a) de volta</p>
          <h1 className="text-3xl font-black text-primary dark:text-white">{user.name.split(' ')[0]}!</h1>
        </div>
        <button onClick={() => navigate('/create')} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Criar nova obra">
          <i className="fa-solid fa-plus-circle"></i> Nova Obra
        </button>
      </div>

      {/* Static Ze Tip */}
      <div className={cx(surface, "rounded-3xl p-4 md:p-5 flex items-start gap-4 mb-6 transition-all duration-300 transform animate-in fade-in slide-in-from-top-4")} role="status">
            <div className="w-12 h-12 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0">
                <img 
                src={ZE_AVATAR} 
                alt="Zé da Obra" 
                className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800"
                onError={(e) => { 
                    const target = e.currentTarget;
                    if (target.src !== ZE_AVATAR_FALLBACK) {
                        target.src = ZE_AVATAR_FALLBACK;
                    }
                }}
                />
            </div>
            <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-widest mb-1 text-secondary">Dica do Zé!</p>
                <p className="text-primary dark:text-white font-bold text-base leading-tight">
                  Mantenha sempre o olho no cronograma e no orçamento! Uma boa gestão evita surpresas e prejuízos na obra.
                </p>
            </div>
        </div>

      {/* Work Selector & Delete Action */}
      <div className="flex items-center gap-3 mb-8">
        {allWorks.length > 1 && (
          <label htmlFor="work-select" className="sr-only">Selecionar Obra</label>
        )}
        <select
          id="work-select"
          value={selectedWork?.id || ''}
          onChange={handleWorkSelectChange}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary dark:text-white focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
          aria-label="Selecionar obra para visualizar dashboard"
        >
          {allWorks.map((workOption) => (
            <option key={workOption.id} value={workOption.id}>{workOption.name}</option>
          ))}
        </select>
        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={!selectedWork}
          className="flex-none w-12 h-12 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
          aria-label={`Excluir obra ${selectedWork?.name || ''}`}
        >
          <i className="fa-solid fa-trash-alt text-lg"></i>
        </button>
      </div>

      {selectedWork && workSummary && (
        <>
          {/* Daily Summary Card */}
          <div className={cx(surface, "rounded-3xl p-6 mb-8")} aria-labelledby="summary-title">
            <h2 id="summary-title" className="text-xl font-black text-primary dark:text-white mb-4">Resumo da Obra</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-list-check text-xl text-green-500 mb-1"></i>
                <p className="text-lg font-black text-green-600 leading-none">{workSummary.completedSteps}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Etapas Concluídas</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-hourglass-half text-xl text-amber-500 mb-1"></i>
                <p className="text-lg font-black text-amber-600 leading-none">{workSummary.inProgressSteps}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Etapas Em Andamento</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-triangle-exclamation text-xl text-red-500 mb-1"></i>
                <p className="text-lg font-black text-red-600 leading-none">{workSummary.delayedSteps}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Etapas Atrasadas</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-boxes-stacked text-xl text-secondary mb-1"></i>
                <p className="text-lg font-black text-secondary leading-none">{workSummary.pendingMaterials}</p>
                <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Materiais Pendentes</p>
              </div>
            </div>
          </div>

          {/* Cronograma Overview */}
          <div className={cx(surface, "rounded-3xl p-6 mb-8")}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Progresso do Cronograma</h2>
            <SegmentedProgressBar steps={selectedWorkSteps} />
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Pendente</span>
              <span>Em Andamento</span>
              <span>Atrasada</span>
              <span>Concluída</span>
            </div>
          </div>

          {/* Financeiro Overview */}
          <div className={cx(surface, "rounded-3xl p-6 mb-8")}>
            <h2 className="text-xl font-black text-primary dark:text-white mb-4">Orçamento</h2>
            <div className="flex items-center justify-between text-lg font-bold mb-2">
              <span className="text-slate-700 dark:text-slate-300">Planejado:</span>
              <span className="text-primary dark:text-white">{formatCurrency(workSummary.budgetPlanned)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold">
              <span className="text-slate-700 dark:text-slate-300">Gasto Total:</span>
              <span className={workSummary.totalSpent > workSummary.budgetPlanned ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>
                {formatCurrency(workSummary.totalSpent)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xl font-black pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
              <span className="text-primary dark:text-white">Balanço:</span>
              <span className={workSummary.totalSpent > workSummary.budgetPlanned ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>
                {formatCurrency(workSummary.budgetPlanned - workSummary.totalSpent)}
              </span>
            </div>
          </div>

          {/* Access Work Button - Moved to bottom */}
          <button 
            onClick={() => selectedWork && navigate(`/work/${selectedWork.id}`)} 
            disabled={!selectedWork}
            className="w-full py-4 bg-gradient-gold text-white font-black rounded-2xl shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100"
            aria-label={`Acessar obra ${selectedWork?.name || ''}`}
          >
            <i className="fa-solid fa-arrow-right"></i> Acessar Obra
          </button>
        </>
      )}

      {showDeleteModal && selectedWork && (
        <ZeModal
          isOpen={showDeleteModal}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir a obra "${selectedWork.name}"? Esta ação é irreversível e removerá todos os dados associados.`}
          confirmText="Sim, Excluir Obra"
          onConfirm={handleDeleteSelectedWork}
          onCancel={() => setShowDeleteModal(false)}
          type="DANGER"
          isConfirming={isDeletingWork}
        >
          {deleteError && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl text-sm">
              <i className="fa-solid fa-triangle-exclamation mr-2"></i> {deleteError}
            </div>
          )}
        </ZeModal>
      )}
    </div>
  );
};

export default Dashboard;