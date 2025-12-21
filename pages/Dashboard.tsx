
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, type Work, type Notification, type Step, type Expense, type Material } from '../types.ts';
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
          {/* FIX: Removed duplicate 'className' attribute. */}
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
            R$ {focusWork.budgetPlanned.toLocaleString("pt-BR")}
          </p>
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

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">Próximas Etapas</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Linha do tempo da obra</p>
        </div>
        <button onClick={onClick} className="text-xs font-extrabold text-secondary hover:opacity-80">
          Abrir obra →
        </button>
      </div>

      <div className="space-y-3">
        {steps.slice(0, 4).map((s, idx) => {
          const diffDays = getDiffDays(s.startDate);

          const pill =
            diffDays < 0
              ? { text: "Atrasado", cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" }
              : diffDays === 0
              ? { text: "Hoje", cls: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300" }
              : { text: `Em ${diffDays}d`, cls: "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300" };

          return (
            <div
              key={s.id}
              onClick={onClick}
              className={cx(
                "cursor-pointer rounded-xl p-3 border border-slate-200/50 dark:border-white/10 bg-white/60 dark:bg-slate-950/20 transition-all",
                "hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-25px_rgba(15,23,42,0.45)] hover:border-secondary/40"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 grid place-items-center text-slate-600 dark:text-slate-300">
                  <i className="fa-regular fa-calendar"></i>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{s.name}</p>
                  <p className={cx("text-xs font-semibold", mutedText)}>{formatDateDisplay(s.startDate)}</p>
                </div>

                <span className={cx("text-[11px] font-black px-2.5 py-1 rounded-xl whitespace-nowrap", pill.cls)}>
                  {pill.text}
                </span>
              </div>

              <div className="mt-3 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                <div
                  className={cx("h-full rounded-full", diffDays < 0 ? "bg-red-500" : diffDays === 0 ? "bg-emerald-500" : "bg-amber-500")}
                  style={{ width: `${Math.max(18, 100 - idx * 18)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** =========================
 *  Dashboard
 *  ========================= */
const Dashboard: React.FC = () => {
  const { user, trialDaysRemaining, authLoading, isUserAuthFinished } = useAuth(); // Updated authLoading to isUserAuthFinished
  const navigate = useNavigate();

  // Data State
  const [works, setWorks] = useState<Work[]>([]);
  const [focusWork, setFocusWork] = useState<Work | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  // Dashboard Metrics State
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });
  const [dailySummary, setDailySummary] = useState({ completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingSteps, setUpcomingSteps] = useState<Step[]>([]);

  // Loading States
  const [isLoadingWorks, setIsLoadingWorks] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isDeletingWork, setIsDeletingWork] = useState(false); // NEW: State for delete operation loading

  // UI States
  const [currentTip] = useState<ZeTip>(() => getRandomZeTip());
  const [showWorkSelector, setShowWorkSelector] = useState(false);
  // Fix: Updated the type of zeModal state to explicitly use ZeModalProps.
  const [zeModal, setZeModal] = useState<ZeModalProps & { workIdToDelete?: string }>({ // NEW: Renamed to workIdToDelete
    isOpen: false, 
    title: '', 
    message: '',
    onCancel: () => {}, // Necessário para satisfazer ZeModalProps
  });
  const [showTrialUpsell, setShowTrialUpsell] = useState(false);
  // NEW: State for push notification permission UI
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isSubscribedToPush, setIsSubscribedToPush] = useState(false);

  // NEW: State to toggle showing all notifications
  const [showAllNotifications, setShowAllNotifications] = useState(false);


  // 1) Initial Load: obras
  useEffect(() => {
    // Only attempt to fetch works if initial auth check is done AND user is available
    if (!isUserAuthFinished || !user) { 
        if (isUserAuthFinished && !user) { // If auth is done but no user, stop loading works
            setIsLoadingWorks(false);
        }
        return;
    }

    let isMounted = true;

    // Safety timeout is less critical with `isUserAuthFinished`
    const safetyTimeout = setTimeout(() => {
      if (isMounted && isLoadingWorks) {
        console.warn("Dashboard load timed out. Forcing UI.");
        setIsLoadingWorks(false);
      }
    }, 4000);

    const fetchWorks = async () => {
      try {
        const data = await dbService.getWorks(user.id);
        if (!isMounted) return;

        setWorks(data);

        if (data.length > 0) {
          setFocusWork(prev => {
            if (prev) {
              const exists = data.find(w => w.id === prev.id);
              if (exists) return exists;
            }
            return data[0]; // Set focus to the first work if none previously focused or previous doesn't exist
          });
        } else {
          setFocusWork(null); // No works available
        }
        setIsLoadingWorks(false);
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
  }, [user, isUserAuthFinished]); // Updated dependency to isUserAuthFinished

  // 2) Details Load
  useEffect(() => {
    let isMounted = true;

    const fetchDetails = async () => {
      // Only fetch details if initial auth check is done AND user is available AND a work is focused.
      if (!isUserAuthFinished || !user || !focusWork) {
        setIsLoadingDetails(false);
        return;
      }

      setIsLoadingDetails(true);

      try {
        const [workStats, summary, fetchedNotifs, workSteps, workExpenses, workMaterials] = await Promise.all([
          dbService.calculateWorkStats(focusWork.id),
          dbService.getDailySummary(focusWork.id),
          dbService.getNotifications(user.id),
          dbService.getSteps(focusWork.id),
          dbService.getExpenses(focusWork.id),
          dbService.getMaterials(focusWork.id)
        ]);

        if (!isMounted) return;

        setStats(workStats);
        setDailySummary(summary);
        setExpenses(workExpenses);
        setMaterials(workMaterials);

        // NEW: Filter notifications to only show those for existing works or general notifications
        const activeWorkIds = new Set(works.map(w => w.id));
        const filteredNotifs = fetchedNotifs.filter(n => 
          !n.workId || activeWorkIds.has(n.workId)
        );
        setNotifications(filteredNotifs);

        const nextSteps = workSteps
          .filter(s => s.status !== StepStatus.COMPLETED)
          .sort((a: Step, b: Step) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
          .slice(0, 3);

        setUpcomingSteps(nextSteps);

        // Generate smart notifications for the *current focused work*
        dbService.generateSmartNotifications(user.id, focusWork.id, workSteps, workExpenses, workMaterials, focusWork);
      } catch (e) {
        console.error("Erro nos detalhes:", e);
      } finally {
        if (isMounted) setIsLoadingDetails(false);
      }
    };

    // Trigger fetchDetails only when focusWork or user/auth status changes AND isUserAuthFinished is true
    // `authLoading` (from context) is not needed here as `isUserAuthFinished` already covers initial state.
    if (isUserAuthFinished && user && focusWork?.id) { 
      fetchDetails();
    } else {
      setIsLoadingDetails(false);
    }

    return () => { isMounted = false; };
  }, [focusWork?.id, user, isUserAuthFinished, works]); // Updated dependencies: user and isUserAuthFinished

  useEffect(() => {
    if (user?.plan !== PlanType.VITALICIO && user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining <= 1) {
      setShowTrialUpsell(true);
    }
  }, [user, trialDaysRemaining]);

  // ======================================
  // NEW: PWA Notification Logic
  // ======================================

  const checkNotificationStatus = useCallback(async () => {
    // CRITICAL FIX: Even more robust check for `Notification` object itself
    // `typeof window !== 'undefined'` handles SSR. `window.Notification` directly accesses the global.
    // `typeof window.Notification.permission === 'string'` ensures the API is fully functional.
    if (typeof window === 'undefined' || !window.Notification || typeof window.Notification.permission !== 'string') {
      setNotificationStatus('unsupported');
      return;
    }
    if (!('serviceWorker' in navigator)) { // ServiceWorker is also critical for push notifications
      setNotificationStatus('unsupported');
      return;
    }

    setNotificationStatus(window.Notification.permission as 'default' | 'granted' | 'denied' | 'unsupported'); // Use window.Notification directly

    if (window.Notification.permission === 'granted' && user) {
      const existingSubscription = await dbService.getPushSubscription(user.id);
      setIsSubscribedToPush(!!existingSubscription);
    } else {
      setIsSubscribedToPush(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isUserAuthFinished || !user) return; // Wait for auth to be fully loaded and user to be present
    
    checkNotificationStatus(); // Call the now more robust check
    
    // Only show prompt if permission is 'default' and Notification API is actually supported.
    // This second check is necessary because `checkNotificationStatus` might have set 'unsupported'.
    if (typeof window !== 'undefined' && window.Notification && window.Notification.permission === 'default') {
      setShowNotificationPrompt(true);
    }
  }, [user, isUserAuthFinished, checkNotificationStatus]); // Updated dependencies: isUserAuthFinished


  const subscribeUserToPush = async () => {
    // Only proceed if Notification API is supported and current status is 'default'
    if (typeof window === 'undefined' || !window.Notification || window.Notification.permission !== 'default' || !user) return;

    setShowNotificationPrompt(false); // Hide the prompt while asking

    try {
      const permission = await window.Notification.requestPermission(); // Use window.Notification directly
      setNotificationStatus(permission);

      if (permission === 'granted') {
        const serviceWorkerRegistration = await navigator.serviceWorker.ready;
        
        const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY; 

        if (!VAPID_PUBLIC_KEY) {
          console.error("VAPID Public Key not defined in client environment.");
          alert("Erro na configuração de notificações. Chave VAPID ausente.");
          return;
        }

        const subscription = await serviceWorkerRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        await dbService.savePushSubscription(user.id, subscription.toJSON());
        setIsSubscribedToPush(true);
        alert('Notificações ativadas! Você receberá avisos importantes da sua obra.');

      } else {
        alert('As notificações foram bloqueadas. Você pode ativá-las nas configurações do navegador.');
      }
    } catch (error: any) {
      console.error('Erro ao inscrever para notificações push:', error);
      alert(`Erro ao ativar notificações: ${error.message}`);
      setNotificationStatus('denied');
    }
  };

  const unsubscribeUserFromPush = async () => {
    if (!user) return;

    try {
      const serviceWorkerRegistration = await navigator.serviceWorker.ready;
      const subscription = await serviceWorkerRegistration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe(); // Unsubscribe from browser
        await dbService.deletePushSubscription(user.id, subscription.endpoint); // Delete from backend
        setIsSubscribedToPush(false);
        alert('Notificações desativadas com sucesso.');
      }
    } catch (error: any) {
      console.error('Erro ao desinscrever de notificações push:', error);
      alert(`Erro ao desativar notificações: ${error.message}`);
    }
  };


  const handleSwitchWork = (work: Work) => {
    if (focusWork?.id !== work.id) {
      setFocusWork(work);
      setShowWorkSelector(false);
    }
  };

  const handleAccessWork = () => {
    if (focusWork?.id) navigate(`/work/${focusWork.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, workId: string, workName: string) => {
    e.stopPropagation();
    console.log(`[DASHBOARD DELETE] handleDeleteClick chamado. workId: ${workId}, workName: ${workName}, userId: ${user?.id}`);
    setZeModal({
      isOpen: true,
      title: "Apagar Obra",
      message: `Tem certeza? Ao apagar a obra "${workName}", todo o histórico de gastos, compras e cronograma será perdido permanentemente.`,
      workIdToDelete: workId, // Pass workId directly
      onConfirm: confirmDelete, 
      type: 'DANGER',
      onCancel: () => {
        console.log("[DASHBOARD DELETE] Delete cancelado pelo usuário.");
        setZeModal(prev => ({ ...prev, isOpen: false, onConfirm: () => {}, onCancel: () => {} })) // Clear callbacks explicitly
      }
    });
  };

  const confirmDelete = async () => {
    // NEW: Ensure workIdToDelete is of type string, as it's optional in ZeModalProps
    const workId = zeModal.workIdToDelete;
    console.log(`[DASHBOARD DELETE] confirmDelete chamado. workIdToDelete: ${workId}, userId: ${user?.id}`);

    if (!workId || !user) {
        console.error("[DASHBOARD DELETE] Erro: workIdToDelete ou usuário não disponível para exclusão.");
        setZeModal(prev => ({ 
            ...prev, 
            message: "Não foi possível identificar a obra para exclusão. Tente novamente.", 
            type: 'ERROR',
            confirmText: "Entendido",
            onConfirm: () => setZeModal(p => ({ ...p, isOpen: false, onConfirm: () => {}, onCancel: () => {} })),
            onCancel: () => setZeModal(p => ({ ...p, isOpen: false, onConfirm: () => {}, onCancel: () => {} }))
        }));
        return;
    }

    setIsDeletingWork(true);
    try {
      console.log(`[DASHBOARD DELETE] Iniciando dbService.deleteWork para workId: ${workId}`);
      await dbService.deleteWork(workId);
      console.log(`[DASHBOARD DELETE] dbService.deleteWork concluído com sucesso para workId: ${workId}`);
      
      // Close the modal upon successful deletion
      setZeModal(prev => ({ ...prev, isOpen: false, onConfirm: () => {}, onCancel: () => {} })); // Clear callbacks explicitly

      // Re-fetch all works to get the latest list
      const updatedWorks = await dbService.getWorks(user.id);
      console.log(`[DASHBOARD DELETE] Obras atualizadas após exclusão: ${updatedWorks.length}`);
      setWorks(updatedWorks);
      
      // Update focusWork based on the new list
      if (updatedWorks.length > 0) {
        // Try to keep the focus on the current work if it still exists
        const stillExists = updatedWorks.find(w => w.id === focusWork?.id);
        if (stillExists) {
            setFocusWork(stillExists);
            console.log(`[DASHBOARD DELETE] FocusWork mantido: ${stillExists.name}`);
        } else {
            // If the deleted work was the focus or it no longer exists, set focus to the first work
            setFocusWork(updatedWorks[0]);
            console.log(`[DASHBOARD DELETE] FocusWork atualizado para: ${updatedWorks[0].name}`);
        }
      } else {
        // If no works remain, clear focusWork
        setFocusWork(null);
        console.log("[DASHBOARD DELETE] Nenhuma obra restante, FocusWork definido como null.");
      }
      // NEW: Force refresh notifications as well to clean up any remaining stale ones
      // This part is already correct as it clears and re-fetches.
      setNotifications([]); 
      dbService.getNotifications(user!.id).then(fetched => { // user! is safe here because it's checked above
        const activeWorkIds = new Set(updatedWorks.map(w => w.id)); // Use the `works` state *after* the deletion and refetch.
        const filteredNotifs = fetched.filter(n => 
          !n.workId || activeWorkIds.has(n.workId)
        );
        setNotifications(filteredNotifs);
      });
      

    } catch (e: any) {
      console.error(`[DASHBOARD DELETE] Erro ao apagar obra ${workId}:`, e);
      // Update modal to show an error message
      setZeModal(prev => ({ 
        ...prev, 
        title: "Erro ao Excluir", 
        message: `Erro ao excluir obra "${focusWork?.name || workId}": ${e.message || "Um erro desconhecido ocorreu."}`, // More specific message
        type: 'ERROR', 
        confirmText: "Entendido", // Change text for error acknowledgment
        onConfirm: () => setZeModal(p => ({ ...p, isOpen: false, onConfirm: () => {}, onCancel: () => {} })), // Close on "Entendido"
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false, onConfirm: () => {}, onCancel: () => {} })) // Also close if user attempts to cancel error modal
      }));
    } finally {
      setIsDeletingWork(false);
      console.log(`[DASHBOARD DELETE] Fim do confirmDelete para workId: ${workId}. isDeletingWork: false`);
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

  /** ============ Render ============ */
  // Use `isUserAuthFinished` and `authLoading` for the primary loading gate
  if (!isUserAuthFinished || authLoading || isLoadingWorks) return <DashboardSkeleton />;

  if (works.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-gradient-gold rounded-[2rem] flex items-center justify-center text-white mb-8 shadow-glow transform rotate-3">
          <i className="fa-solid fa-helmet-safety"></i>
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
  } else if (isNearBudget) {
    statusGradient = 'from-orange-500 to-amber-400';
    statusIcon = 'fa-circle-exclamation';
    statusMessage = 'Pontos de atenção';
  }

  // Determine which notifications to display based on showAllNotifications state
  const notificationsToDisplay = showAllNotifications ? notifications : notifications.slice(0, 3);
  const hasMoreNotifications = notifications.length > 3;

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
                    <i className="fa-solid fa-plus-circle text-xs"></i>
                  </div>
                  Nova Obra
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* NEW: PWA Notification Prompt / Status Banner */}
      {showNotificationPrompt && notificationStatus === 'default' && (
        <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><i className="fa-regular fa-bell text-xl"></i></div>
            <div>
              <p className="font-bold text-sm md:text-base">Ativar Notificações da Obra</p>
              <p className="text-xs opacity-90">Receba alertas importantes sobre sua obra mesmo fora do app.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={subscribeUserToPush} className="px-6 py-2 bg-white text-blue-700 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors shadow-sm whitespace-nowrap">
              Ativar
            </button>
            <button onClick={() => setShowNotificationPrompt(false)} className="px-6 py-2 bg-white/20 text-white font-bold rounded-xl text-sm hover:bg-white/30 transition-colors shadow-sm whitespace-nowrap">
              Agora Não
            </button>
          </div>
          <button onClick={() => setShowNotificationPrompt(false)} className="absolute top-2 right-2 text-white/70 hover:text-white p-1 rounded-full">
              <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      )}

      {isSubscribedToPush && notificationStatus === 'granted' && (
        <div className="mb-6 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-4 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><i className="fa-solid fa-bell text-xl"></i></div>
            <div>
              <p className="font-bold text-sm md:text-base">Notificações Ativas</p>
              <p className="text-xs opacity-90">Você receberá alertas importantes da sua obra.</p>
            </div>
          </div>
          <button onClick={unsubscribeUserFromPush} className="px-6 py-2 bg-white/20 text-white font-bold rounded-xl text-sm hover:bg-white/30 transition-colors shadow-sm whitespace-nowrap">
            Desativar
          </button>
          <button onClick={() => setIsSubscribedToPush(false)} className="absolute top-2 right-2 text-white/70 hover:text-white p-1 rounded-full">
              <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      )}

      {notificationStatus === 'denied' && (
        <div className="mb-6 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><i className="fa-solid fa-bell-slash text-xl"></i></div>
            <div>
              <p className="font-bold text-sm md:text-base">Notificações Bloqueadas</p>
              <p className="text-xs opacity-90">Ative nas configurações do seu navegador para receber alertas.</p>
            </div>
          </div>
          <button onClick={() => setShowNotificationPrompt(false)} className="absolute top-2 right-2 text-white/70 hover:text-white p-1 rounded-full">
              <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>
      )}

      {/* ZÉ DA OBRA TIP */}
      <div className="mb-8 relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm group hover:shadow-md transition-all">
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl translate-x-10 -translate-y-10 group-hover:bg-secondary/20 transition-all"></div>
        <div className="flex items-center gap-5 p-5 relative z-10">
          <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shrink-0 shadow-inner">
            <img
              src={ZE_AVATAR}
              alt="Zeca da Obra"
              className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800 bg-white"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src !== ZE_AVATAR_FALLBACK) target.src = ZE_AVATAR_FALLBACK;
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                Dica do Zé: {currentTip.tag}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 italic font-medium">
              "{currentTip.text}"
            </p>
          </div>
        </div>
      </div>

      {/* MAIN HUD */}
      {isLoadingDetails ? (
        <div className={cx("rounded-3xl p-1 mb-8 animate-pulse", surface)}>
          <div className="rounded-[1.4rem] p-6 h-64 bg-slate-100/70 dark:bg-slate-800/40"></div>
        </div>
      ) : (
        <div className={cx(surface, card, "mb-8")}>
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className={cx("w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-2xl shadow-lg -rotate-2", statusGradient)}>
                <i className={`fa-solid ${statusIcon}`}></i>
              </div>
              <div className="min-w-0">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{statusMessage}</h2>
                <p className={cx("text-sm font-semibold", mutedText)}>Resumo de hoje</p>
              </div>
            </div>

            <div className="hidden md:block">
              <Donut value={stats.progress} label="Andamento" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <KpiCard
              onClick={handleAccessWork}
              icon="fa-solid fa-list-check"
              iconClass={hasDelay ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}
              value={hasDelay ? dailySummary.delayedSteps : dailySummary.completedSteps}
              label={hasDelay ? "Atrasadas" : "Concluídas"}
              badge={hasDelay ? <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse mt-1" /> : null}
              accent={hasDelay ? "danger" : "ok"}
            />

            <KpiCard
              onClick={handleAccessWork}
              icon="fa-solid fa-cart-shopping"
              iconClass="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
              value={dailySummary.pendingMaterials}
              label="Materiais pendentes"
              accent={dailySummary.pendingMaterials > 2 ? "warn" : "ok"}
            />

            <div className={cx(surface, "rounded-3xl p-6", "flex flex-col justify-between")}>
              <div className="flex items-start justify-between">
                <div className={cx("w-11 h-11 rounded-2xl grid place-items-center", "bg-primary/10 dark:bg-white/10 text-primary dark:text-white")}>
                  <i className="fa-solid fa-wallet"></i>
                </div>
                <div className={cx("text-xs font-extrabold tracking-widest uppercase", mutedText)}>
                  orçamento
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-end justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-slate-900 dark:text-white leading-tight truncate">
                      R$ {stats.totalSpent.toLocaleString("pt-BR")}
                      <span className={cx("text-sm font-semibold mx-2", mutedText)}>/</span>
                      <span className={cx("text-sm font-semibold", mutedText)}>
                        R$ {focusWork.budgetPlanned.toLocaleString("pt-BR")}
                      </span>
                    </p>
                    <p className={cx("text-xs font-semibold", mutedText)}>Utilizado</p>
                  </div>

                  <div className={cx(
                    "px-3 py-1 rounded-xl text-sm font-black",
                    isOverBudget
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      : isNearBudget
                      ? "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
                      : "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
                  )}>
                    {budgetPercentage}%
                  </div>
                </div>

                <div className="h-2.5 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={cx("h-full rounded-full transition-all duration-700", isOverBudget ? "bg-red-500" : isNearBudget ? "bg-amber-500" : "bg-emerald-500")}
                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="md:hidden">
            <div className={cx(surface, "rounded-2xl p-4")}>
              <Donut value={stats.progress} label="Andamento" />
            </div>
          </div>
        </div>
      )}

      {/* BLOCO 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <RiskRadar
          focusWork={focusWork}
          stats={stats}
          dailySummary={dailySummary}
          materials={materials}
          onOpenWork={handleAccessWork}
        />
        <LiveTimeline steps={upcomingSteps} onClick={handleAccessWork} />
      </div>

      {/* Central de Notificações */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <i className="fa-regular fa-bell"></i> Central de Notificações
          </h3>
          {notifications.length > 0 && (
            <button onClick={handleClearAll} className="text-xs font-bold text-slate-400 hover:text-primary transition-colors">
              Limpar tudo
            </button>
          )}
        </div>

        <div className="space-y-3">
          {notifications.length > 0 ? (
            notificationsToDisplay.map(notif => {
              let cardBgClass = 'bg-white dark:bg-slate-900';
              let cardBorderClass = 'border-slate-200 dark:border-slate-800';
              // NEW: Simplified icon background to solid color
              let iconBgClass = 'bg-blue-100 dark:bg-blue-900/30'; 
              let iconColorClass = 'text-blue-600 dark:text-blue-400';
              let iconType = 'fa-lightbulb'; // Default INFO icon
              let textColorClass = 'text-slate-700 dark:text-slate-300';
              let titleColorClass = 'text-primary dark:text-white';

              if (notif.type === 'WARNING') {
                // FIX: Updated color classes for WARNING type notifications for better contrast
                cardBgClass = 'bg-amber-100 dark:bg-amber-900/30'; // Lighter amber bg, more opaque in dark mode
                cardBorderClass = 'border-amber-400 dark:border-amber-800'; // Stronger amber border
                iconBgClass = 'bg-amber-500/20 dark:bg-amber-600/30'; // Darker amber for icon bg
                iconColorClass = 'text-amber-800 dark:text-amber-50'; // Vibrant amber for icon color, very light for dark mode
                textColorClass = 'text-amber-950 dark:text-amber-50'; // Darker text for light mode, lighter for dark mode
                titleColorClass = 'text-amber-950 dark:text-amber-50'; // Darker text for light mode, lighter for dark mode
              } else if (notif.type === 'ERROR') {
                cardBgClass = 'bg-red-50 dark:bg-red-900/10';
                cardBorderClass = 'border-red-200 dark:border-red-900/30'; // Changed to red-200 for border
                iconBgClass = 'bg-red-100 dark:bg-red-900/30';
                iconColorClass = 'text-red-700 dark:text-red-400';
                iconType = 'fa-circle-xmark';
                textColorClass = 'text-red-800 dark:text-red-200';
                titleColorClass = 'text-red-900 dark:text-red-100';
              } else if (notif.type === 'SUCCESS') {
                cardBgClass = 'bg-green-50 dark:bg-green-900/10';
                cardBorderClass = 'border-green-200 dark:border-green-900/30'; // Changed to green-200 for border
                iconBgClass = 'bg-green-100 dark:bg-green-900/30';
                iconColorClass = 'text-green-700 dark:text-green-400';
                iconType = 'fa-check-circle';
                textColorClass = 'text-green-800 dark:text-green-200';
                titleColorClass = 'text-green-900 dark:text-green-100';
              }

              return (
                <div
                  key={notif.id}
                  className={cx(
                    "group relative p-4 rounded-2xl border flex items-start gap-4 transition-all duration-300", // p-4, rounded-2xl, border
                    cardBgClass,
                    cardBorderClass,
                    "shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-0", // shadow-sm
                    "hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20" // hover:-translate-y-0.5, hover:shadow-md
                  )}
                >
                  <div className={cx(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", // w-10 h-10, rounded-xl, NO p-1
                    iconBgClass, // Use simple solid color background
                    iconColorClass,
                    "text-xl" // text-xl
                  )}>
                    <i className={`fa-solid ${iconType}`}></i>
                  </div>

                  <div className="flex-1 pr-4"> {/* pr-4 */}
                    <h4 className={cx("font-bold text-base mb-0.5 leading-tight", titleColorClass)}>{notif.title}</h4> {/* font-bold, text-base, mb-0.5 */}
                    <p className={cx("text-sm leading-snug font-medium", textColorClass)}>{notif.message}</p> {/* text-sm, leading-snug */}
                  </div>

                  <button
                    onClick={() => handleDismiss(notif.id)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-slate-500 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full" // top-2 right-2, p-1.5, text-lg
                    aria-label="Dispensar notificação"
                  >
                    <i className="fa-solid fa-circle-xmark text-lg"></i>
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 animate-in fade-in"> {/* py-10, rounded-2xl, border */}
              <i className="fa-solid fa-heart-circle-check text-5xl text-slate-400 mb-4"></i> {/* text-5xl, mb-4 */}
              <p className="text-slate-500 dark:text-slate-400 text-base font-medium">Nenhum aviso urgente. Tudo em paz por aqui! 🍃</p> {/* text-base */}
              <p className="text-sm text-slate-400 mt-2">Novidades importantes aparecerão aqui automaticamente.</p> {/* text-sm, mt-2 */}
            </div>
          )}
          {hasMoreNotifications && (
            <button
              onClick={() => setShowAllNotifications(!showAllNotifications)}
              className="w-full mt-4 py-3 bg-slate-100 dark:bg-slate-800 text-secondary font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {showAllNotifications ? 'Ver menos' : `Ver todos (${notifications.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Botão acessar obra */}
      <button
        type="button"
        onClick={handleAccessWork}
        className="group w-full mt-10 mb-8 relative overflow-hidden rounded-2xl bg-primary dark:bg-white text-white dark:text-primary shadow-2xl hover:shadow-glow transition-all active:scale-[0.98] cursor-pointer"
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

      {/* FAB mobile */}
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
        confirmText={zeModal.confirmText}
        onConfirm={zeModal.onConfirm} // onConfirm is now guaranteed to be a function
        onCancel={zeModal.onCancel} // onCancel is always required
        type={zeModal.type} // Pass type directly, it can now be 'ERROR'
        isConfirming={isDeletingWork} // NEW: Pass the loading state
      />

      {showTrialUpsell && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2.5rem] p-0 shadow-2xl border border-slate-800 relative overflow-hidden transform scale-100 animate-in zoom-in-95">
            <div className="bg-gradient-premium p-8 relative overflow-hidden text-center">
              <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/20 rounded-full blur-3xl translate-x-10 -translate-y-1/2"></div>
              <div className="w-20 h-20 mx-auto rounded-full bg-red-600 border-4 border-slate-900 flex items-center justify-center text-3xl text-white shadow-xl mb-4 animate-pulse">
                <i className="fa-solid fa-hourglass-end"></i>
              </div>
              <h2 className="text-2xl font-black text-white mb-1 tracking-tight">ÚLTIMO DIA!</h2>
              <p className="text-slate-300 text-sm font-medium">Seu teste grátis acaba hoje.</p>
            </div>
            <div className="p-8">
              <p className="text-center text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
                Não perca o acesso às suas obras. Garante o plano <strong>Vitalício</strong> agora e nunca mais se preocupe com mensalidades.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/checkout?plan=${PlanType.VITALICIO}`)}
                  className="w-full py-4 bg-gradient-gold text-white font-black rounded-2xl shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all flex items-center justify-center gap-2 group"
                >
                  <i className="fa-solid fa-crown text-yellow-200"></i> Quero Vitalício{' '}
                  <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                </button>
                <button
                  onClick={() => setShowTrialUpsell(false)}
                  className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase tracking-wide"
                >
                  Manter plano atual
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* (não usado, mas mantido por compatibilidade futura) */}
      {expenses && materials && null}
    </div>
  );
};

export default Dashboard;
