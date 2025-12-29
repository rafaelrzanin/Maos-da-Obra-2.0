
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, WorkStatus, type Work, type Notification, type Step, type Expense, type Material } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx'; // Importa ZeModalProps

/** =========================
 *  UI helpers (UX + sombras)
 *  ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

// Super “recorte” no light e leve no dark
const surface =
  "bg-white border border-slate-200/90 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/5 " +
  "dark:bg-slate-900/70 dark:border-slate-800 dark:shadow-none dark:ring-0";

const card = "rounded-3xl p-6 lg:p-8";
const mutedText = "text-slate-500 dark:text-slate-400";

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

// ======================================
// NEW: Helper function to convert VAPID public key
// ======================================
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** =========================
 *  Skeleton (carregamento)
 *  ========================= */
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
    <div className="mb-8 rounded-[1.6rem] border border-slate-200 bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none dark:ring-0">
      <div className="h-64 w-full rounded-[1.4rem] bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 to-slate-900"></div>
    </div>

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
 *  Componentes UX novos
 *  ========================= */
const Donut = ({ value, label }: { value: number; label: string }) => {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative w-14 h-14 rounded-full"
        style={{
          background: `conic-gradient(rgb(245 158 11) ${v * 3.6}deg, rgba(148,163,184,0.25) 0deg)`,
        }}
      >
        <div className="absolute inset-[6px] rounded-full bg-white dark:bg-slate-950/60 border border-slate-200/50 dark:border-white/10"></div>
        <div className="absolute inset-0 grid place-items-center text-xs font-black text-slate-700 dark:text-slate-200">
          {v}%
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">{label}</p>
        <p className={cx("text-xs font-semibold", mutedText)}>Progresso geral</p>
      </div>
    </div>
  );
};

const KpiCard = ({
  onClick,
  icon,
  iconClass,
  value,
  label,
  badge,
  accent,
}: {
  onClick?: () => void;
  icon: string;
  iconClass: string;
  value: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  accent?: "ok" | "warn" | "danger";
}) => {
  const ring =
    accent === "danger"
      ? "ring-1 ring-red-500/20"
      : accent === "warn"
      ? "ring-1 ring-amber-500/20"
      : "ring-1 ring-emerald-500/10";

  return (
    <div
      onClick={onClick}
      className={cx(
        surface,
        "rounded-3xl p-6",
        "transition-all cursor-pointer",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-25px_rgba(15,23,42,0.45)]",
        "hover:border-secondary/40",
        ring
      )}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cx("w-11 h-11 rounded-2xl grid place-items-center", iconClass)}>
          <i className={icon}></i>
        </div>
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
  materials,
  onOpenWork,
}: {
  focusWork: Work;
  stats: { totalSpent: number; progress: number; delayedSteps: number };
  dailySummary: { completedSteps: number; delayedSteps: number; pendingMaterials: number; totalSteps: number };
  materials: Material[]; // mantemos no tipo pra compatibilidade de chamada, mas não usamos aqui
  onOpenWork: () => void;
}) => {
  const budgetUsage = focusWork.budgetPlanned > 0 ? (stats.totalSpent / focusWork.budgetPlanned) * 100 : 0;
  const budgetPct = Math.round(budgetUsage);

  // Fix: Calculate delayedPct locally
  const delayedPct =
    dailySummary.totalSteps > 0 ? Math.round((dailySummary.delayedSteps / dailySummary.totalSteps) * 100) : 0;

  const budgetTone =
    budgetPct > 100
      ? { label: "Estourado", cls: "bg-red-100 dark:bg-red-900/25 text-red-700 dark:text-red-300", bar: "bg-red-500" }
      : budgetPct > 85
      ? { label: "No limite", cls: "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300", bar: "bg-amber-500" }
      : { label: "Saudável", cls: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300", bar: "bg-emerald-500" };

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

        <div className="relative h-3 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
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

const LiveTimeline = ({
  steps,
  onClick,
}: {
  steps: Step[];
  onClick: () => void;
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDiffDays = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const diffTime = dt.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const upcomingSteps = steps.filter(s => {
    const stepStartDate = new Date(s.startDate);
    stepStartDate.setHours(0, 0, 0, 0);
    return s.status === StepStatus.NOT_STARTED && stepStartDate >= today;
  }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

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


const Dashboard: React.FC = () => {
  const { user, isUserAuthFinished, authLoading } = useAuth(); // Added authLoading
  const navigate = useNavigate();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkId, setActiveWorkId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [zeTip, setZeTip] = useState<ZeTip>(getRandomZeTip());

  // Data for the focused work (for HUD, risk radar)
  const [focusWork, setFocusWork] = useState<Work | null>(null);
  const [focusWorkStats, setFocusWorkStats] = useState<{ totalSpent: number, progress: number, delayedSteps: number } | null>(null);
  const [focusWorkDailySummary, setFocusWorkDailySummary] = useState<{ completedSteps: number, delayedSteps: number, pendingMaterials: number, totalSteps: number } | null>(null);
  const [focusWorkMaterials, setFocusWorkMaterials] = useState<Material[]>([]); 
  // NEW: Add state for focused work's steps for LiveTimeline component
  const [focusWorkSteps, setFocusWorkSteps] = useState<Step[]>([]);

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);

  const [showPushPermissionModal, setShowPushPermissionModal] = useState(false); // NEW: State for Push Permission Modal
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null); // NEW: VAPID Public Key State
  
  // Ref to store the PushSubscription object
  const pushSubscriptionRef = useRef<PushSubscription | null>(null);


  // Initial data load and refresh mechanism
  const loadData = useCallback(async () => {
    if (!user?.id || !isUserAuthFinished || authLoading) return; // Wait for auth to be finished
    
    setLoading(true);
    try {
      const userWorks = await dbService.getWorks(user.id);
      setWorks(userWorks);

      // Set initial active work if none is selected or previous is gone
      const currentActiveWork = activeWorkId 
        ? userWorks.find(w => w.id === activeWorkId) 
        : userWorks[0];
      
      if (currentActiveWork) {
        setFocusWork(currentActiveWork);
        setActiveWorkId(currentActiveWork.id);
        
        // Fetch detailed stats and summary for the focused work
        const stats = await dbService.calculateWorkStats(currentActiveWork.id);
        setFocusWorkStats(stats);
        
        const summary = await dbService.getDailySummary(currentActiveWork.id);
        setFocusWorkDailySummary(summary);

        const materials = await dbService.getMaterials(currentActiveWork.id);
        setFocusWorkMaterials(materials);

        // NEW: Fetch steps for the focused work
        const stepsForFocusWork = await dbService.getSteps(currentActiveWork.id);
        setFocusWorkSteps(stepsForFocusWork);

        // Generate smart notifications for the active work
        await dbService.generateSmartNotifications(
          user.id, 
          currentActiveWork.id,
          stepsForFocusWork, // Use already fetched steps
          (await dbService.getExpenses(currentActiveWork.id)), // Prefetch expenses
          materials, // Use already fetched materials
          currentActiveWork // Use already fetched work
        );

      } else {
        setFocusWork(null);
        setActiveWorkId(null);
        setFocusWorkStats(null);
        setFocusWorkDailySummary(null);
        setFocusWorkMaterials([]);
        setFocusWorkSteps([]); // Clear steps if no work is focused
      }
      
      // Load notifications for the user
      const userNotifications = await dbService.getNotifications(user.id);
      setNotifications(userNotifications);

    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, activeWorkId, isUserAuthFinished, authLoading]); // Added authLoading to dependencies


  // Effect to load data on component mount and when user/auth status changes
  useEffect(() => {
    if (isUserAuthFinished && !authLoading && user) { // Ensure auth is finished and not loading
      loadData();
    }
  }, [loadData, isUserAuthFinished, authLoading, user]); // Added authLoading and user to dependencies

  // Check and setup VAPID public key for push notifications
  useEffect(() => {
    // Check for VITE_VAPID_PUBLIC_KEY from import.meta.env
    const pubKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (pubKey && pubKey !== 'undefined') { // Check for "undefined" string
      setVapidPublicKey(pubKey);
    } else {
      console.warn("VITE_VAPID_PUBLIC_KEY is not defined in environment variables. Push notifications will not work.");
    }
  }, []);

  // --- Push Notification Logic ---
  const requestPushPermission = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidPublicKey || !user) {
      console.warn("Push notifications not supported or VAPID key/user missing.");
      setShowPushPermissionModal(false); // Close the modal if not supported
      return;
    }

    // Check if subscription already exists in DB
    const existingSubscription = await dbService.getPushSubscription(user.id);
    if (existingSubscription && Notification.permission === 'granted') {
        console.log("Existing push subscription found and permission granted.");
        pushSubscriptionRef.current = existingSubscription.subscription as PushSubscription;
        setShowPushPermissionModal(false);
        return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscribeOptions = {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        };
        const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
        
        pushSubscriptionRef.current = pushSubscription;
        await dbService.savePushSubscription(user.id, pushSubscription.toJSON());
        console.log('Push subscription saved:', pushSubscription.toJSON());
        alert('Notificações ativadas com sucesso!');
      } else {
        console.warn('Notification permission denied.');
        alert('Permissão para notificações negada.');
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      alert('Erro ao ativar notificações. Verifique o console.');
    } finally {
      setShowPushPermissionModal(false);
    }
  }, [user, vapidPublicKey]);

  useEffect(() => {
    if (!isUserAuthFinished || !user || !vapidPublicKey) return;

    // Check if the user has explicitly denied notifications
    if (Notification.permission === 'denied') {
        console.log("User has permanently denied notification permission.");
        // We could show a UI to ask them to enable it from browser settings if needed.
        return;
    }

    // If permission is default and no existing subscription is found, prompt.
    const checkAndPrompt = async () => {
      const existingSub = await dbService.getPushSubscription(user.id);
      if (!existingSub && Notification.permission === 'default') {
        setShowPushPermissionModal(true);
      } else if (existingSub && Notification.permission === 'granted') {
        // Ensure the local ref is updated even if we don't prompt
        pushSubscriptionRef.current = existingSub.subscription as PushSubscription;
      }
    };
    checkAndPrompt();
  }, [isUserAuthFinished, user, vapidPublicKey]);


  const handleDismissNotification = async (notificationId: string) => {
    await dbService.dismissNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setCurrentNotification(null); // Close modal if it was open for this notification
    if (focusWork?.id) {
      // Re-trigger smart notifications for this work to clear related tags
      await dbService.generateSmartNotifications(user!.id, focusWork.id);
    }
  };

  const handleClearAllNotifications = async () => {
    if (user?.id) {
      await dbService.clearAllNotifications(user.id);
      setNotifications([]);
      // Re-trigger smart notifications for all works if needed or update works to clear related tags
      await loadData();
    }
  };

  const handleDeleteWork = async (workId: string) => {
    if (window.confirm("Tem certeza que deseja apagar esta obra e TODOS os seus dados relacionados? Esta ação é irreversível.")) {
      await dbService.deleteWork(workId);
      loadData(); // Reload all data after deletion
    }
  };

  // If AuthContext is still loading or local data is loading
  if (!isUserAuthFinished || authLoading || loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className={cx("text-sm font-extrabold", mutedText)}>Olá, {user?.name.split(' ')[0]}!</p>
          <h1 className="text-3xl font-black text-primary dark:text-white">Seu Dashboard</h1>
        </div>
        <button onClick={() => navigate('/create')} className="bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2 hover:scale-105 transition-transform">
          <i className="fa-solid fa-plus-circle"></i> Nova Obra
        </button>
      </div>

      {/* Ze Tip Card */}
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

      {/* Main HUD */}
      <div className={cx(surface, "rounded-[1.6rem] p-6 lg:p-8 mb-8")}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">Obra Focada</p>
            {focusWork ? (
              <p className={cx("text-xs font-semibold", mutedText)}>{focusWork.name}</p>
            ) : (
              <p className={cx("text-xs font-semibold text-red-500")}>Nenhuma obra ativa. Crie uma!</p>
            )}
          </div>
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
        </div>

        {focusWork && focusWorkStats && focusWorkDailySummary ? (
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
        ) : (
          <div className="text-center py-10">
            <i className="fa-solid fa-house-chimney-medical text-6xl text-slate-300 dark:text-slate-700 mb-4"></i>
            <p className={cx("text-lg font-bold", mutedText)}>Crie sua primeira obra!</p>
            <p className={cx("text-sm", mutedText)}>Comece a gerenciar seus projetos com facilidade.</p>
          </div>
        )}
      </div>

      {/* Upcoming Steps */}
      {focusWork && focusWorkDailySummary && (
        // FIX: Pass focusWorkSteps directly to LiveTimeline
        <LiveTimeline steps={focusWorkSteps} onClick={() => navigate(`/work/${focusWork.id}`)} />
      )}
      
      {/* Works List */}
      <div className="mt-8">
        <div className="flex justify-between items-end mb-4">
          <p className="text-lg font-black text-primary dark:text-white">Todas as suas Obras</p>
          <button onClick={loadData} className={cx("text-sm", mutedText, "hover:text-primary transition-colors")}>
            Atualizar <i className="fa-solid fa-sync-alt ml-1"></i>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {works.length === 0 ? (
            <div className={cx(surface, card, "col-span-full text-center py-10")}>
              <i className="fa-solid fa-briefcase text-5xl text-slate-300 dark:text-slate-700 mb-4"></i>
              <p className={cx("text-lg font-bold", mutedText)}>Nenhuma obra cadastrada ainda.</p>
              <p className={cx("text-sm", mutedText)}>Clique em "+ Nova Obra" para começar.</p>
            </div>
          ) : (
            works.map((work) => {
              const startDate = formatDateDisplay(work.startDate);
              const endDate = formatDateDisplay(work.endDate);
              // FIX: Compare work.status with WorkStatus.COMPLETED
              const isOverdue = work.endDate < new Date().toISOString().split('T')[0] && work.status !== WorkStatus.COMPLETED;

              return (
                <div
                  key={work.id}
                  className={cx(
                    surface,
                    "rounded-2xl p-5 flex flex-col justify-between transition-all group",
                    "hover:border-secondary/40 hover:shadow-lg hover:-translate-y-1"
                  )}
                >
                  <div>
                    <h3 className="text-lg font-black text-primary dark:text-white mb-2 leading-tight">
                      {work.name}
                    </h3>
                    <p className={cx("text-xs font-bold uppercase tracking-wider mb-3", mutedText)}>
                      {work.address || "Endereço não informado"}
                    </p>
                    <div className="flex items-center gap-4 text-xs mb-4">
                      <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <i className="fa-regular fa-calendar text-slate-400"></i>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{startDate}</span>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <i className="fa-solid fa-flag-checkered text-slate-400"></i>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{endDate}</span>
                      </div>
                      {isOverdue && (
                        <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-md text-[10px] font-bold uppercase">
                          Atrasada
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => navigate(`/work/${work.id}`)}
                      className="flex-1 py-2 bg-secondary text-white font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-md"
                    >
                      Ver Detalhes
                    </button>
                    <button
                      onClick={() => handleDeleteWork(work.id)}
                      className="w-10 h-10 rounded-lg bg-red-500 text-white flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
                    >
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Notifications Area */}
      {notifications.length > 0 && (
        <div className="fixed bottom-6 right-6 z-30">
          <button
            onClick={() => {
              if (notifications.length > 0) {
                setCurrentNotification(notifications[0]);
                setShowNotificationModal(true);
              }
            }}
            className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white text-xl shadow-xl animate-pulse relative"
          >
            <i className="fa-solid fa-bell"></i>
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-white text-red-500 rounded-full text-xs font-bold flex items-center justify-center border-2 border-red-500">
              {notifications.length}
            </span>
          </button>
        </div>
      )}

      {/* Notification Modal */}
      {showNotificationModal && currentNotification && (
        <ZeModal
          isOpen={showNotificationModal}
          title={currentNotification.title}
          message={currentNotification.message}
          confirmText="Marcar como lida"
          onConfirm={() => handleDismissNotification(currentNotification.id)}
          cancelText="Ver todas"
          onCancel={() => {
            setCurrentNotification(null);
            setShowNotificationModal(false);
            alert('Funcionalidade de "Ver todas" em breve!'); // Placeholder for a dedicated notification list page
          }}
          type={currentNotification.type}
        />
      )}

      {/* Push Notification Permission Modal */}
      {showPushPermissionModal && (
        <ZeModal
          isOpen={showPushPermissionModal}
          title="Ativar Notificações?"
          message="Receba alertas importantes sobre o andamento das suas obras (etapas atrasadas, materiais em falta, etc.) diretamente no seu celular ou computador."
          confirmText="Sim, quero notificações!"
          onConfirm={requestPushPermission}
          cancelText="Agora não"
          onCancel={() => setShowPushPermissionModal(false)}
          type="INFO"
        />
      )}
    </div>
  );
};

export default Dashboard;