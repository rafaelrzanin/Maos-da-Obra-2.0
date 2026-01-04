
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, WorkStatus, type Work, type DBNotification, type Step, type Material } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx'; 
// REMOVIDO: import { Recharts } from '../components/RechartsWrapper.tsx';

// REMOVIDO: const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } = Recharts;

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
 * ========================= */
const DashboardSkeleton = () => (
  <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 animate-pulse">
    <div className="flex justify-between items-end mb-8">
      <div className="space-y-2">
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      </div>
      <div className="h-10 w-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
    </div>
    <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl mb-8"></div>
    <div className="mb-8 h-64 w-full rounded-[1.6rem] bg-slate-100 dark:bg-slate-900"></div>
    {/* List Skeleton */}
    <div className="space-y-4">
      <div className="h-4 w-32 rounded-full bg-slate-200 dark:bg-slate-800 mb-2"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-24px_rgba(15,23,42,0.40)] ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none dark:ring-0"
          >
            <div className="h-full w-full rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 to-slate-900"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** =========================
 * Sub-Componentes
 * ========================= */

// NEW: Segmented Progress Bar Component
const SegmentedProgressBar = ({ steps }: { steps: Step[] }) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 flex">
        <div className="h-full bg-slate-300 rounded-full" style={{ width: '100%' }}></div>
      </div>
    );
  }

  const totalSteps = steps.length;
  const today = new Date().toISOString().split('T')[0];

  const completed = steps.filter(s => s.status === StepStatus.COMPLETED);
  const inProgress = steps.filter(s => s.status === StepStatus.IN_PROGRESS);
  // Fix: Renamed 'notStarted' to 'initialNotStartedSteps' to avoid redeclaration issues.
  const initialNotStartedSteps = steps.filter(s => s.status === StepStatus.NOT_STARTED); 
  const delayed = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < today);

  // Remove delayed steps from inProgress and initialNotStartedSteps to avoid double counting for accurate segment widths
  const actualInProgress = inProgress.filter(s => !delayed.some(d => d.id === s.id));
  // Fix: Updated usage of the renamed variable 'initialNotStartedSteps'.
  const actualNotStarted = initialNotStartedSteps.filter(s => !delayed.some(d => d.id === s.id));

  const completedPct = (completed.length / totalSteps) * 100;
  const inProgressPct = (actualInProgress.length / totalSteps) * 100;
  const delayedPct = (delayed.length / totalSteps) * 100;
  const notStartedPct = (actualNotStarted.length / totalSteps) * 100; // Initialize notStartedPct

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
          className="h-full bg-amber-500" // Cor Laranja para Parcial/Em Andamento
          style={{ width: `${inProgressPct}%` }} 
          title={`${actualInProgress.length} Em Andamento`}
          aria-label={`${actualInProgress.length} etapas em andamento`}
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
          className="h-full bg-slate-400 dark:bg-slate-600" // Cor Cinza para Pendente
          style={{ width: `${notStartedPct}%` }} 
          title={`${actualNotStarted.length} Pendente(s)`}
          aria-label={`${actualNotStarted.length} etapas pendentes`}
        ></div>
      )}
    </div>
  );
}; // End of SegmentedProgressBar


const WorkCard = ({ work, userId, onDeleteSuccess }: { work: Work; userId: string; onDeleteSuccess: () => void }) => {
  const navigate = ReactRouter.useNavigate();
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const fetchedStats = await dbService.calculateWorkStats(work.id);
        if (isMounted) {
          setStats(fetchedStats);
        }
      } catch (error) {
        console.error(`Erro ao buscar estatísticas para a obra ${work.name}:`, error);
      } finally {
        if (isMounted) {
          setLoadingStats(false);
        }
      }
    };
    fetchStats();

    return () => {
      isMounted = false;
    };
  }, [work.id, work.name]);


  const handleDeleteWork = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await dbService.deleteWork(work.id);
      onDeleteSuccess(); // Notify parent to refresh list
      setShowDeleteModal(false);
    } catch (error: any) {
      console.error("Erro ao excluir obra:", error);
      setDeleteError(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      onClick={() => navigate(`/work/${work.id}`)}
      className={cx(surface, card, "flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:border-secondary/50")}
      aria-label={`Ver detalhes da obra ${work.name}`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-black text-primary dark:text-white leading-tight">{work.name}</h3>
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click from navigating
            setShowDeleteModal(true);
          }}
          className="text-slate-400 hover:text-red-500 transition-colors p-2 -mr-2"
          aria-label={`Excluir obra ${work.name}`}
        >
          <i className="fa-solid fa-trash-alt text-lg"></i>
        </button>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{work.address}</p>

      {loadingStats ? (
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full my-1 animate-pulse"></div>
      ) : (
        <SegmentedProgressBar steps={work.id ? [] : []} /> // Placeholder, actual steps from state later
      )}

      <div className="flex items-center justify-between text-sm mt-3">
        {loadingStats ? (
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        ) : (
          <span className="font-bold text-primary dark:text-white">{stats.progress.toFixed(0)}% Concluído</span>
        )}
        {loadingStats ? (
          <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        ) : (
          <span className={cx("font-medium", stats.totalSpent > (work.budgetPlanned || 0) ? "text-red-500" : "text-green-600 dark:text-green-400")}>
            {formatCurrency(stats.totalSpent)}
          </span>
        )}
      </div>

      {showDeleteModal && (
        <ZeModal
          isOpen={showDeleteModal}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir a obra "${work.name}"? Esta ação é irreversível e removerá todos os dados associados.`}
          confirmText="Sim, Excluir Obra"
          cancelText="Cancelar"
          type="DANGER"
          onConfirm={handleDeleteWork}
          onCancel={() => setShowDeleteModal(false)}
          isConfirming={isDeleting}
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


const Dashboard = () => {
  const { user, authLoading, isUserAuthFinished, refreshUser, isSubscriptionValid, trialDaysRemaining, unreadNotificationsCount, refreshNotifications, requestPushNotificationPermission, pushSubscriptionStatus } = useAuth(); // NEW: pushSubscriptionStatus
  const navigate = ReactRouter.useNavigate();
  const [works, setWorks] = useState<Work[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(true);
  const [dailySummary, setDailySummary] = useState<{ completedSteps: number; delayedSteps: number; pendingMaterials: number; totalSteps: number } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [zeTip, setZeTip] = useState<ZeTip | null>(null);

  // Debugging user and auth status
  useEffect(() => {
    console.log("[Dashboard] Rendered. User:", user?.email, "AuthLoading:", authLoading, "isUserAuthFinished:", isUserAuthFinished);
  }, [user, authLoading, isUserAuthFinished]);


  const loadWorksData = useCallback(async () => {
    if (!user?.id || !isUserAuthFinished || authLoading) {
      setLoadingWorks(false);
      setLoadingSummary(false);
      return;
    }

    setLoadingWorks(true);
    setLoadingSummary(true);
    try {
      const fetchedWorks = await dbService.getWorks(user.id);
      setWorks(fetchedWorks);

      const summaries = await Promise.all(
        fetchedWorks.map(work => dbService.getDailySummary(work.id))
      );

      const combinedSummary = summaries.reduce(
        (acc, curr) => ({
          completedSteps: acc.completedSteps + curr.completedSteps,
          delayedSteps: acc.delayedSteps + curr.delayedSteps,
          pendingMaterials: acc.pendingMaterials + curr.pendingMaterials,
          totalSteps: acc.totalSteps + curr.totalSteps,
        }),
        { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 }
      );
      setDailySummary(combinedSummary);
      setLoadingSummary(false);
      setLoadingWorks(false);
      
      // Request push notification permission after data loads
      if (pushSubscriptionStatus === 'idle' && isSubscriptionValid) { // Only prompt if subscription is valid
        requestPushNotificationPermission();
      }
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
      setWorks([]);
      setDailySummary({ completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 });
      setLoadingWorks(false);
      setLoadingSummary(false);
    }
  }, [user, isUserAuthFinished, authLoading, isSubscriptionValid, pushSubscriptionStatus, requestPushNotificationPermission]);


  useEffect(() => {
    loadWorksData();
  }, [loadWorksData]); // Recarrega dados ao mudar user ou após finalização de auth

  // Zé da Obra Tip
  useEffect(() => {
    setZeTip(getRandomZeTip());
  }, []); // Only once on mount

  // Refresh data when notifications are dismissed (as notification status can affect dashboard metrics)
  const notificationCountRef = useRef(unreadNotificationsCount);
  useEffect(() => {
      if (unreadNotificationsCount !== notificationCountRef.current) {
          notificationCountRef.current = unreadNotificationsCount;
          loadWorksData();
      }
  }, [unreadNotificationsCount, loadWorksData]);


  // Show skeleton while initial authentication or data fetching is in progress.
  // CRITICAL FIX: Ensure `isUserAuthFinished` is true before proceeding past initial loading.
  if (!isUserAuthFinished || authLoading || loadingWorks || loadingSummary) {
    return <DashboardSkeleton />;
  }

  // If user is null AFTER auth is finished, redirect to login.
  if (!user) {
    console.log("[Dashboard] No user after auth finished. Redirecting to /login.");
    return <ReactRouter.Navigate to="/login" replace />;
  }

  // --- COMPONENT RENDERING ---
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

      {/* Zé da Obra Tip Card */}
      {zeTip && (
        <div className={cx(surface, "rounded-3xl p-4 md:p-5 flex items-start gap-4 mb-8 transition-all duration-300 transform animate-in fade-in slide-in-from-top-4")} role="status">
          <div className="w-12 h-12 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0">
            <img 
              src={ZE_AVATAR} 
              alt="Zé da Obra" 
              className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800"
              onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-widest mb-1 text-secondary">Dica do Zé!</p>
            <p className="text-primary dark:text-white font-bold text-base leading-tight">{zeTip.text}</p>
          </div>
        </div>
      )}

      {/* Daily Summary Card */}
      {dailySummary && (
        <div className={cx(surface, "rounded-3xl p-6 mb-8")} aria-labelledby="summary-title">
          <h2 id="summary-title" className="text-xl font-black text-primary dark:text-white mb-4">Resumo Diário</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
              <i className="fa-solid fa-list-check text-xl text-green-500 mb-1"></i>
              <p className="text-lg font-black text-green-600 leading-none">{dailySummary.completedSteps}</p>
              <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Concluídas</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
              <i className="fa-solid fa-hourglass-half text-xl text-amber-500 mb-1"></i>
              <p className="text-lg font-black text-amber-600 leading-none">{dailySummary.totalSteps - dailySummary.completedSteps - dailySummary.delayedSteps}</p> {/* NEW: calculate in-progress better for dashboard summary */}
              <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Em Andamento</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
              <i className="fa-solid fa-triangle-exclamation text-xl text-red-500 mb-1"></i>
              <p className="text-lg font-black text-red-600 leading-none">{dailySummary.delayedSteps}</p>
              <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Atrasadas</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
              <i className="fa-solid fa-boxes-stacked text-xl text-secondary mb-1"></i>
              <p className="text-lg font-black text-secondary leading-none">{dailySummary.pendingMaterials}</p>
              <p className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500">Material Pendente</p>
            </div>
          </div>
        </div>
      )}

      {/* Your Works List */}
      <h2 className="text-xl font-black text-primary dark:text-white mb-4">Suas Obras</h2>
      {works.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-4">Nenhuma obra cadastrada ainda.</p>
          <button onClick={() => navigate('/create')} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors" aria-label="Criar sua primeira obra">
            Criar sua primeira obra
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {works.map((work) => (
            <WorkCard key={work.id} work={work} userId={user.id} onDeleteSuccess={loadWorksData} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
