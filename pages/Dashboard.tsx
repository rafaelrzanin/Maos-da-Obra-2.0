
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, WorkStatus, type Work, type DBNotification, type Step, type Expense, type Material } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx'; // Importa ZeModalProps

/** =========================
 * UI helpers
 * ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const surface =
  "bg-white border border-slate-200/90 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/5 " +
  "dark:bg-slate-900/70 dark:border-slate-800 dark:shadow-none dark:ring-0";

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

// Esta função não será mais usada no Dashboard após a desativação das push notifications
// function urlBase64ToUint8Array(base64String: string) {
//   const padding = '='.repeat((4 - base64String.length % 4) % 4);
//   const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
//   const rawData = window.atob(base64);
//   const outputArray = new Uint8Array(rawData.length);
//   for (let i = 0; i < rawData.length; ++i) {
//     outputArray[i] = rawData.charCodeAt(i);
//   }
//   return outputArray;
// }

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
const Donut = ({ value, label }: { value: number; label: string }) => {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative w-14 h-14 rounded-full"
        style={{ background: `conic-gradient(rgb(245 158 11) ${v * 3.6}deg, rgba(148,163,184,0.25) 0deg)` }}
      >
        <div className="absolute inset-[6px] rounded-full bg-white dark:bg-slate-950/60 border border-slate-200/50 dark:border-white/10"></div>
        <div className="absolute inset-0 grid place-items-center text-xs font-black text-slate-700 dark:text-slate-200">{v}%</div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{label}</p>
        <p className={cx("text-xs font-semibold", mutedText)}>Progresso geral</p>
      </div>
    </div>
  );
};

const KpiCard = ({ onClick, icon, iconClass, value, label, badge, accent }: {
  onClick?: () => void;
  icon: string;
  iconClass: string;
  value: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  accent?: "ok" | "warn" | "danger";
}) => {
  const ring = accent === "danger" ? "ring-1 ring-red-500/20" : accent === "warn" ? "ring-1 ring-amber-500/20" : "ring-1 ring-emerald-500/10";
  return (
    <div onClick={onClick} className={cx(surface, "rounded-3xl p-6 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:border-secondary/40", ring)} role={onClick ? "button" : undefined}>
      <div className="flex items-start justify-between mb-3">
        <div className={cx("w-11 h-11 rounded-2xl grid place-items-center", iconClass)}><i className={icon}></i></div>
        {badge}
      </div>
      <div className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-1">{value}</div>
      <div className={cx("text-[11px] font-extrabold tracking-widest uppercase", mutedText)}>{label}</div>
    </div>
  );
};

const RiskRadar = ({
  focusWork,
  stats,
  dailySummary,
  materials, // Not used in this component, but passed for compatibility
  onOpenWork,
}: {
  focusWork: Work;
  stats: { totalSpent: number; progress: number; delayedSteps: number };
  dailySummary: { completedSteps: number; delayedSteps: number; pendingMaterials: number; totalSteps: number };
  materials: Material[];
  onOpenWork: () => void;
}) => {
  const budgetUsage = focusWork.budgetPlanned > 0 ? (stats.totalSpent / focusWork.budgetPlanned) * 100 : 0;
  const budgetPct = Math.round(budgetUsage);

  const delayedPct = dailySummary.totalSteps > 0 ? Math.round((dailySummary.delayedSteps / dailySummary.totalSteps) * 100) : 0;

  const budgetTone = budgetPct > 100 ? { label: "Estourado", cls: "bg-red-100 dark:bg-red-900/25 text-red-700 dark:text-red-300", bar: "bg-red-500" } : budgetPct > 85 ? { label: "No limite", cls: "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300", bar: "bg-amber-500" } : { label: "Saudável", cls: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300", bar: "bg-emerald-500" };

  const scheduleTone =
    delayedPct >= 20
      ? { label: "Crítico", cls: "bg-red-100 dark:bg-red-900/25 text-red-700 dark:text-red-300" }
      : delayedPct >= 10
      ? { label: "Atenção", cls: "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300" }
      : { label: "Ok", cls: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300" };

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">Mapa de Riscos</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Onde pode “dar ruim” antes de dar ruim</p>
        </div>
        <button onClick={onOpenWork} className="text-xs font-extrabold text-secondary hover:opacity-80">
          Ver detalhes →
        </button>
      </div>

      {/* 4 mini-métricas (sem “Compras críticas” como você pediu) */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3 border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-950/20">
          <p className={cx("text-[11px] font-black uppercase tracking-wider", mutedText)}>Ritmo</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{stats.progress}%</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Progresso geral</p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-950/20">
          <p className={cx("text-[11px] font-black uppercase tracking-wider", mutedText)}>Cronograma</p>
          <div className="flex items-center gap-2">
            <p className="text-xl font-black text-slate-900 dark:text-white">{delayedPct}%</p>
            <span className={cx("text-[11px] font-black px-2 py-1 rounded-xl", scheduleTone.cls)}>
              {scheduleTone.label}
            </span>
          </div>
          <p className={cx("text-xs font-semibold", mutedText)}>{dailySummary.delayedSteps} etapas atrasadas</p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-950/20">
          <p className={cx("text-[11px] font-black uppercase tracking-wider", mutedText)}>Orçamento</p>
          <div className="flex items-center gap-2">
            <p className="text-xl font-black text-slate-900 dark:text-white">{budgetPct}%</p>
            <span className={cx("text-[11px] font-black px-2 py-1 rounded-xl", budgetTone.cls)}>
              {budgetTone.label}
            </span>
          </div>
          <p className={cx("text-xs font-semibold", mutedText)}>R$ {stats.totalSpent.toLocaleString("pt-BR")}</p>
        </div>

        <div className="rounded-xl p-3 border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-950/20">
          <p className={cx("text-[11px] font-black uppercase tracking-wider", mutedText)}>Compras</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{dailySummary.pendingMaterials}</p>
          <p className={cx("text-xs font-semibold", mutedText)}>pendências no checklist</p>
        </div>
      </div>

      {/* Barra “zona” do orçamento */}
      <div className="rounded-xl p-4 border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-950/20">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Zona do orçamento
          </p>
          <p className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
            R$ {focusWork.budgetPlanned.toLocaleString("pt-BR")}</p>
        </div>

        <div className="relative h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div className="absolute inset-y-0 left-[85%] w-[2px] bg-amber-400/80" />
          <div className="absolute inset-y-0 left-[100%] w-[2px] bg-red-400/80" />
          <div
            className={cx("h-full rounded-full transition-all", budgetTone.bar)}
            style={{ width: `${Math.min(100, Math.max(2, budgetUsage))}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span>0%</span>
          <span>85%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

const LiveTimeline = ({ steps, onClick }: { steps: Step[]; onClick: () => void }) => {
  const today = new Date();
  today.setHours(0,0,0,0);

  const getDiffDays = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const diffTime = dt.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const upcomingSteps = steps
    .filter(s => s.status === StepStatus.NOT_STARTED && new Date(s.startDate) >= today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">Próximas Etapas</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Linha do tempo ao vivo das atividades.</p>
        </div>
        <button onClick={onClick} className="text-xs font-extrabold text-secondary hover:opacity-80">
          Ver cronograma completo →
        </button>
      </div>

      {upcomingSteps.length === 0 ? (
        <div className="text-center py-6">
          <p className={cx("text-sm", mutedText)}>Nenhuma etapa futura por enquanto!</p>
          <button onClick={onClick} className="mt-3 text-secondary text-sm font-bold hover:underline">Adicionar novas etapas?</button>
        </div>
      ) : (
        <div className="space-y-4">
          {upcomingSteps.slice(0, 3).map((step, idx) => { // Show up to 3 upcoming steps
            const daysDiff = getDiffDays(step.startDate);
            const isSoon = daysDiff <= 7 && daysDiff >= 0;
            const statusClass = isSoon ? "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300" : "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300";

            return (
              <div key={step.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white ${isSoon ? 'bg-amber-500' : 'bg-primary dark:bg-slate-700'}`}>
                  <i className={`fa-solid ${isSoon ? 'fa-hourglass-half' : 'fa-calendar-alt'}`}></i>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-primary dark:text-white">{step.name}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>{formatDateDisplay(step.startDate)}</span>
                    <span className={cx("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase", statusClass)}>
                      {daysDiff === 0 ? 'Hoje' : (daysDiff === 1 ? 'Amanhã' : `Em ${daysDiff} dias`)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/** =========================
 * DASHBOARD PRINCIPAL
 * ========================= */
const Dashboard: React.FC = () => {
  const { user, isUserAuthFinished, authLoading, refreshNotifications, unreadNotificationsCount } = useAuth();
  const navigate = useNavigate();
  
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkId, setActiveWorkId] = useState<string | null>(null);
  // NOTIFICATIONS: setNotifications agora apenas para manter a compatibilidade com refreshNotifications
  // O estado 'notifications' não será mais usado para exibir nada no Dashboard.
  const [notifications, setNotifications] = useState<DBNotification[]>([]); 
  const [zeTip, setZeTip] = useState<ZeTip>(getRandomZeTip());

  const [focusWork, setFocusWork] = useState<Work | null>(null);
  const [focusWorkStats, setFocusWorkStats] = useState<{ totalSpent: number; progress: number; delayedSteps: number } | null>(null);
  const [focusWorkDailySummary, setFocusWorkDailySummary] = useState<{ completedSteps: number; delayedSteps: number; pendingMaterials: number; totalSteps: number } | null>(null);
  const [focusWorkMaterials, setFocusWorkMaterials] = useState<Material[]>([]); 
  const [focusWorkSteps, setFocusWorkSteps] = useState<Step[]>([]);

  // GENERAL MODAL for delete confirmations
  const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string }>({ 
    isOpen: false, 
    title: '', 
    message: '',
    onCancel: () => {}, 
  });


  const loadData = useCallback(async () => {
    if (!user?.id || !isUserAuthFinished || authLoading) {
        console.log("[NOTIF DEBUG] loadData: Skipping due to auth/user status.", { user: user?.id, isUserAuthFinished, authLoading });
        return;
    }
    
    console.log("[NOTIF DEBUG] loadData: Starting data load...");
    setLoading(true);

    try {
      const userWorks = await dbService.getWorks(user.id);
      setWorks(userWorks);

      const currentActiveWork = activeWorkId 
        ? userWorks.find(w => w.id === activeWorkId) 
        : userWorks[0]; // If no active work, default to the first one

      if (userWorks.length > 0 && currentActiveWork) { // Only fetch detailed data if there are works
        setFocusWork(currentActiveWork);
        setActiveWorkId(currentActiveWork.id);
        
        const [stats, summary, materials, steps] = await Promise.all([
          dbService.calculateWorkStats(currentActiveWork.id),
          dbService.getDailySummary(currentActiveWork.id),
          dbService.getMaterials(currentActiveWork.id),
          dbService.getSteps(currentActiveWork.id)
        ]);

        setFocusWorkStats(stats);
        setFocusWorkDailySummary(summary);
        setFocusWorkMaterials(materials);
        setFocusWorkSteps(steps);
      } else { // No works found or all deleted
        setFocusWork(null);
        setActiveWorkId(null);
        setFocusWorkStats(null);
        setFocusWorkDailySummary(null);
        setFocusWorkMaterials([]);
        setFocusWorkSteps([]);
      }
      
      const userNotifications = await dbService.getNotifications(user.id);
      setNotifications(userNotifications); // Apenas para manter o estado interno do Dashboard (não exibido)
      refreshNotifications(); // Apenas para manter a contagem global no AuthContext
      console.log("[NOTIF DEBUG] loadData: Data loaded successfully.");

    } catch (error: any) { // Catch all errors from loadData chain
      console.error("[NOTIF DEBUG] loadData: Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
      console.log("[NOTIF DEBUG] loadData: Finished loading.");
    }
  }, [user, activeWorkId, isUserAuthFinished, authLoading, refreshNotifications]);


  // Effect to load data on component mount and when user/auth status changes
  useEffect(() => {
    if (isUserAuthFinished && !authLoading && user) {
        loadData();
    }
  }, [loadData, isUserAuthFinished, authLoading, user]); // Refined dependencies


  const handleDismissNotification = async (notificationId: string) => {
    await dbService.dismissNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    refreshNotifications(); // Refresh global count (AuthContext)
  };

  const handleDeleteFocusedWork = async () => {
    if (!focusWork) return; // Ensure there's a work to delete
    setZeModal({
        isOpen: true,
        title: 'Excluir Obra?',
        message: `Tem certeza que deseja excluir a obra "${focusWork.name}" e TODOS os seus dados relacionados? Esta ação é irreversível.`,
        confirmText: 'Sim, Excluir Obra',
        cancelText: 'Cancelar',
        type: 'DANGER',
        onConfirm: async () => {
            if (focusWork) { // Re-check focusWork exists
                await dbService.deleteWork(focusWork.id);
            }
            setZeModal(prev => ({ ...prev, isOpen: false, onCancel: () => {} }));
            setActiveWorkId(null); // Clear active work to trigger new focus or empty state
            await loadData(); // Reload all data after deletion
        },
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false, onCancel: () => {} }))
    });
  };

  if (!isUserAuthFinished || authLoading || loading) return <DashboardSkeleton />;


  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0">
      {focusWork ? ( // RENDER HEADER AND "NOVA OBRA" BUTTON ONLY IF THERE IS A FOCUSED WORK
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className={cx("text-sm font-extrabold", mutedText)}>Olá, {user?.name.split(' ')[0]}!</p>
            <h1 className="text-3xl font-black text-primary dark:text-white">Seu Dashboard</h1>
          </div>
          <button onClick={() => navigate('/create')} className="bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2 hover:scale-105 transition-transform">
            <i className="fa-solid fa-plus-circle"></i> Nova Obra
          </button>
        </div>
      ) : (
        // Keep some top padding/margin for consistency when header is not present
        <div className="mb-8"></div> 
      )}


      {focusWork && focusWorkStats && focusWorkDailySummary ? (
        <>
          {/* Zé da Obra Tip - RENDERED ONLY WHEN A WORK IS FOCUSED */}
          <div className={cx(surface, card, "flex items-center gap-5 mb-8")}>
            <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0">
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
              <p className={cx("text-xs font-black uppercase tracking-wider", mutedText)}>Dica do Zé da Obra</p>
              <p className="text-sm font-bold text-slate-700 dark:text-white leading-snug">{zeTip.text}</p>
            </div>
            <button onClick={() => setZeTip(getRandomZeTip())} className={cx("text-lg", mutedText, "hover:text-primary transition-colors")}>
              <i className="fa-solid fa-sync-alt"></i>
            </button>
          </div>

          <div className={cx(surface, "rounded-[1.6rem] p-6 lg:p-8 mb-8")}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">Obra Focada</p>
                <p className={cx("text-xs font-semibold", mutedText)}>{focusWork.name}</p>
              </div>
              <div className="flex items-center gap-3"> {/* Container for select and delete button */}
                {works.length > 0 && (
                  <select
                    value={activeWorkId || ''}
                    onChange={(e) => setActiveWorkId(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm px-3 py-2 text-primary dark:text-white focus:ring-secondary focus:border-secondary transition-all"
                  >
                    {works.map((work) => (
                      <option key={work.id} value={work.id}>
                        {work.name}
                      </option>
                    ))}
                  </select>
                )}
                {/* NEW: Delete Focused Work Button */}
                {focusWork && (
                    <button onClick={handleDeleteFocusedWork} className="text-red-400 hover:text-red-600 transition-colors p-2">
                        <i className="fa-solid fa-trash text-xl"></i>
                    </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-6">
                {/* Donut Chart and KPIs */}
                <Donut value={focusWorkStats.progress} label="Obra Completa" />
                <KpiCard
                  icon="fa-dollar-sign"
                  iconClass="bg-red-100 dark:bg-red-900/20 text-red-600"
                  label="Orçamento Gasto"
                  value={<span>R$ {focusWorkStats.totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                  accent={
                    focusWorkStats.totalSpent > focusWork.budgetPlanned * 1.05
                      ? "danger"
                      : focusWorkStats.totalSpent > focusWork.budgetPlanned * 0.9
                      ? "warn"
                      : undefined
                  }
                />
                <KpiCard
                  icon="fa-calendar-alt"
                  iconClass="bg-amber-100 dark:bg-amber-900/20 text-amber-600"
                  label="Etapas Atrasadas"
                  value={focusWorkStats.delayedSteps}
                  accent={focusWorkStats.delayedSteps > 0 ? "warn" : undefined}
                  onClick={() => navigate(`/work/${focusWork.id}`)}
                />
              </div>
              {/* Risk Radar */}
              <RiskRadar
                focusWork={focusWork}
                stats={focusWorkStats}
                dailySummary={focusWorkDailySummary}
                materials={focusWorkMaterials}
                onOpenWork={() => navigate(`/work/${focusWork.id}/more?tab=REPORTS`)}
              />
            </div>
            {/* NEW: Access My Work Button */}
            <div className="mt-8">
                <button 
                    onClick={() => navigate(`/work/${focusWork.id}`)}
                    className="w-full py-4 bg-secondary text-white font-bold rounded-2xl shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-3"
                >
                    Acessar Obra <span className="font-medium">"{focusWork.name}"</span> <i className="fa-solid fa-arrow-right ml-2"></i>
                </button>
            </div>
          </div>
          <LiveTimeline steps={focusWorkSteps} onClick={() => navigate(`/work/${focusWork.id}`)} />
        </>
      ) : (
        /* NEW: Empty State UI - RENDERED WHEN NO WORK IS FOCUSED */
        <>
          {/* NEW: User Avatar and Greeting */}
          <div className="flex flex-col items-center justify-center mb-8 animate-in fade-in duration-500">
            <div className="w-24 h-24 rounded-full bg-gradient-gold p-1 flex items-center justify-center text-white text-5xl shadow-xl shadow-secondary/30">
                {user?.name ? (
                    <span className="font-bold">{user.name.charAt(0).toUpperCase()}</span>
                ) : (
                    <i className="fa-solid fa-user-tie"></i> {/* Generic worker icon */}
                )}
            </div>
            <p className="mt-4 text-2xl font-black text-primary dark:text-white">
                Olá, {user?.name.split(' ')[0]}!
            </p>
          </div>

          <div className={cx(surface, "rounded-[2rem] p-6 lg:p-10 mb-8 text-center py-16 animate-in fade-in duration-700")}>
            {/* Updated Icon and Styling */}
            <div className="w-24 h-24 mx-auto bg-gradient-gold rounded-full flex items-center justify-center text-white text-5xl mb-6 shadow-xl shadow-secondary/30 transform rotate-3">
              <i className="fa-solid fa-hammer-screwdriver -rotate-3"></i>
            </div>
            <p className={cx("text-3xl font-black text-primary dark:text-white mb-3 tracking-tight")}>Sua Primeira Obra Começa Aqui!</p>
            <p className={cx("text-lg max-w-md mx-auto", mutedText)}>Crie seu primeiro projeto e comece a construir seus sonhos com o Zé da Obra!</p>
            <button 
              onClick={() => navigate('/create')} 
              className="mt-10 py-5 px-10 bg-secondary text-white font-black rounded-3xl shadow-xl shadow-secondary/40 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out mx-auto border-2 border-secondary hover:border-orange-600"
            >
              <i className="fa-solid fa-plus-circle text-xl"></i> Criar Minha Primeira Obra
            </button>
          </div>
        </>
      )}

      {/* General Purpose Modal (for delete confirmations etc.) */}
      <ZeModal
          isOpen={zeModal.isOpen}
          title={zeModal.title}
          message={zeModal.message}
          confirmText={zeModal.confirmText}
          cancelText={zeModal.cancelText}
          onConfirm={zeModal.onConfirm}
          onCancel={zeModal.onCancel}
          type={zeModal.type}
      />
    </div>
  );
};

export default Dashboard;