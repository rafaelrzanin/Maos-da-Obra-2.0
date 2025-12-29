
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, WorkStatus, type Work, type DBNotification, type Step, type Expense, type Material } from '../types.ts';
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
  const { user, isUserAuthFinished, authLoading, refreshNotifications, unreadNotificationsCount } = useAuth();
  const navigate = useNavigate();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkId, setActiveWorkId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<DBNotification[]>([]); // Changed to DBNotification
  const [zeTip, setZeTip] = useState<ZeTip>(getRandomZeTip());

  // Data for the focused work (for HUD, risk radar)
  const [focusWork, setFocusWork] = useState<Work | null>(null);
  const [focusWorkStats, setFocusWorkStats] = useState<{ totalSpent: number, progress: number, delayedSteps: number } | null>(null);
  const [focusWorkDailySummary, setFocusWorkDailySummary] = useState<{ completedSteps: number, delayedSteps: number, pendingMaterials: number, totalSteps: number } | null>(null);
  const [focusWorkMaterials, setFocusWorkMaterials] = useState<Material[]>([]); 
  const [focusWorkSteps, setFocusWorkSteps] = useState<Step[]>([]);

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<DBNotification | null>(null); // Changed to DBNotification

  const [showPushPermissionModal, setShowPushPermissionModal] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  // NEW: Use a ref for a more stable check across renders, initialized from localStorage
  const hasPromptedPushOnceRef = useRef(localStorage.getItem('hasPromptedPushOnce') === 'true');
  
  // Ref to store the PushSubscription object
  const pushSubscriptionRef = useRef<PushSubscription | null>(null);

  // NEW: State for Critical Error Modal
  const [showCriticalErrorModal, setShowCriticalErrorModal] = useState(false);
  const [criticalErrorMessage, setCriticalErrorMessage] = useState('');
  // NEW: To prevent loadData from running repeatedly if a critical error is active
  const criticalErrorActiveRef = useRef(false);


  // Initial data load and refresh mechanism
  const loadData = useCallback(async () => {
    // NEW: If a critical error is active, do not attempt to load data again
    if (criticalErrorActiveRef.current) {
        console.log("[NOTIF DEBUG] loadData: Critical error active, skipping data load.");
        return;
    }
    if (!user?.id || !isUserAuthFinished || authLoading) {
        console.log("[NOTIF DEBUG] loadData: Skipping due to auth/user status.", { user: user?.id, isUserAuthFinished, authLoading });
        return;
    }
    
    console.log("[NOTIF DEBUG] loadData: Starting data load...");
    setLoading(true);
    setShowCriticalErrorModal(false); // Hide any previous error modal
    setCriticalErrorMessage('');

    try {
      const userWorks = await dbService.getWorks(user.id);
      setWorks(userWorks);

      const currentActiveWork = activeWorkId 
        ? userWorks.find(w => w.id === activeWorkId) 
        : userWorks[0];
      
      if (currentActiveWork) {
        setFocusWork(currentActiveWork);
        setActiveWorkId(currentActiveWork.id);
        
        const stats = await dbService.calculateWorkStats(currentActiveWork.id);
        setFocusWorkStats(stats);
        
        const summary = await dbService.getDailySummary(currentActiveWork.id);
        setFocusWorkDailySummary(summary);

        const materials = await dbService.getMaterials(currentActiveWork.id);
        setFocusWorkMaterials(materials);

        const stepsForFocusWork = await dbService.getSteps(currentActiveWork.id);
        setFocusWorkSteps(stepsForFocusWork);

        // This is still a critical area. Ensure all dbService calls are robust.
        // The generateSmartNotifications call can fail due to DB issues (like missing work_id).
        // This part *must* propagate errors correctly.
        await dbService.generateSmartNotifications(
          user.id, 
          currentActiveWork.id,
          stepsForFocusWork,
          (await dbService.getExpenses(currentActiveWork.id)), // Ensure this is awaited
          materials, // Use the fetched materials
          currentActiveWork
        );

      } else {
        setFocusWork(null);
        setActiveWorkId(null);
        setFocusWorkStats(null);
        setFocusWorkDailySummary(null);
        setFocusWorkMaterials([]);
        setFocusWorkSteps([]);
      }
      
      const userNotifications = await dbService.getNotifications(user.id);
      setNotifications(userNotifications);
      refreshNotifications();
      console.log("[NOTIF DEBUG] loadData: Data loaded successfully.");

    } catch (error: any) { // Catch all errors from loadData chain
      console.error("[NOTIF DEBUG] loadData: Failed to load dashboard data:", error);
      let errorMessage = `Um erro crítico impediu o carregamento do Dashboard. Causa: ${error.message || "Erro desconhecido."}`;
      if (error.message?.includes("PGRST204") || error.message?.includes("Could not find the 'work_id' column")) {
          errorMessage += "\n\nPor favor, verifique *URGENTEMENTE* se a tabela 'notifications' no seu Supabase tem a coluna 'work_id' do tipo TEXT e se suas RLS policies permitem INSERT/SELECT/UPDATE para ela.";
      } else if (error.message?.includes("SyntaxError: Unexpected token 'A'") || error.message?.includes("API returned non-JSON")) {
          errorMessage += "\n\nO servidor de Push Notifications está retornando um erro inesperado. Verifique se as variáveis VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY estão configuradas no Vercel e se a função /api/send-event-notification.js está funcionando.";
      }
      setCriticalErrorMessage(errorMessage);
      setShowCriticalErrorModal(true);
      criticalErrorActiveRef.current = true; // Mark critical error as active
    } finally {
      setLoading(false);
      console.log("[NOTIF DEBUG] loadData: Finished loading.");
    }
  }, [user, activeWorkId, isUserAuthFinished, authLoading, refreshNotifications]);


  // Effect to load data on component mount and when user/auth status changes
  useEffect(() => {
    console.log("[NOTIF DEBUG] useEffect [loadData, isUserAuthFinished, authLoading, user] triggered.", { isUserAuthFinished, authLoading, user: user?.id, criticalErrorActive: criticalErrorActiveRef.current });
    // NEW: Only call loadData if no critical error is active
    if (!criticalErrorActiveRef.current) {
        if (isUserAuthFinished && !authLoading && user) {
            loadData();
        }
    } else {
        console.log("[NOTIF DEBUG] Not calling loadData because criticalErrorActiveRef is true.");
    }
  }, [loadData, isUserAuthFinished, authLoading, user]); // Refined dependencies

  // Check and setup VAPID public key for push notifications
  useEffect(() => {
    const pubKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    console.log("[NOTIF DEBUG] VAPID Public Key check. Value:", pubKey);
    if (pubKey && pubKey !== 'undefined') {
      setVapidPublicKey(pubKey);
    } else {
      console.error("CRÍTICO: VITE_VAPID_PUBLIC_KEY não está definida nas variáveis de ambiente! As Push Notifications não funcionarão. Por favor, configure-a no Vercel/Ambiente de Deploy.");
      setVapidPublicKey(null); 
      // If VAPID key is missing, we still want to indicate we've "checked"
      hasPromptedPushOnceRef.current = true; // Prevents the modal from trying to open repeatedly if key is missing
      localStorage.setItem('hasPromptedPushOnce', 'true'); // Persist this state
    }
  }, []); // Run once on mount

  // --- Push Notification Logic (FIXED FOR FLICKERING) ---
  const requestPushPermission = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidPublicKey || !user) {
      console.warn("[NOTIF DEBUG] Push notifications not supported or VAPID key/user missing for request.");
      setShowPushPermissionModal(false);
      hasPromptedPushOnceRef.current = true; // Mark as prompted/dismissed for this session
      localStorage.setItem('hasPromptedPushOnce', 'true'); // Persist this state
      return;
    }

    try {
      const permission = await window.Notification.requestPermission(); // Global Notification API
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscribeOptions = {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        };
        const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
        
        pushSubscriptionRef.current = pushSubscription;
        await dbService.savePushSubscription(user.id, pushSubscription.toJSON());
        console.log('[NOTIF DEBUG] Push subscription saved:', pushSubscription.toJSON());
        alert('Notificações ativadas com sucesso!');
      } else {
        console.warn('[NOTIF DEBUG] Notification permission denied by user.');
        alert('Permissão para notificações negada.');
      }
    } catch (error) {
      console.error('[NOTIF DEBUG] Error subscribing to push notifications:', error);
      alert('Erro ao ativar notificações. Verifique o console.');
    } finally {
      setShowPushPermissionModal(false);
      // After interaction, ensure the ref is set so we don't re-prompt until a logical reset (e.g., app restart or manual revoke)
      hasPromptedPushOnceRef.current = true;
      localStorage.setItem('hasPromptedPushOnce', 'true'); // Persist this state
      console.log("[NOTIF DEBUG] requestPushPermission finished. hasPromptedPushOnceRef.current set to true.");
    }
  }, [user, vapidPublicKey]);

  useEffect(() => {
    console.log("[NOTIF DEBUG] Push permission useEffect triggered.", {
        isUserAuthFinished, user: user?.id, vapidPublicKey: !!vapidPublicKey,
        hasPromptedPushOnce: hasPromptedPushOnceRef.current, showPushPermissionModal
    });

    // 1. Exit early if conditions for checking are not met or if already prompted.
    // hasPromptedPushOnceRef.current is the most important guard here.
    if (!isUserAuthFinished || !user || !vapidPublicKey || hasPromptedPushOnceRef.current) {
        console.log("[NOTIF DEBUG] Push useEffect exited early. Conditions:", {
            isUserAuthFinished, user: user?.id, vapidPublicKey: !!vapidPublicKey, hasPromptedPushOnce: hasPromptedPushOnceRef.current
        });
        return;
    }

    const performPushPermissionCheck = async () => {
        // CRUCIAL: Mark as checked immediately upon starting the check logic for this cycle.
        // This prevents re-triggering the check during the async operation or subsequent renders.
        hasPromptedPushOnceRef.current = true; 
        localStorage.setItem('hasPromptedPushOnce', 'true'); // Persist this state
        console.log("[NOTIF DEBUG] Push permission check initiated, hasPromptedPushOnceRef.current set to true.");

        try {
            const currentPermission = window.Notification.permission; // Global Notification API
            const existingSub = await dbService.getPushSubscription(user.id);
            console.log("[NOTIF DEBUG] Push permission check results:", { currentPermission, existingSub: !!existingSub });

            if (currentPermission === 'granted') {
                if (!existingSub) { // Granted but no subscription in DB. Re-subscribe.
                    console.log("[NOTIF DEBUG] Permission granted but no sub in DB, attempting to subscribe silently.");
                    // Attempt to subscribe silently, but don't show modal
                    const registration = await navigator.serviceWorker.ready;
                    const subscribeOptions = {
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!), // vapidPublicKey is guaranteed to exist here
                    };
                    const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
                    pushSubscriptionRef.current = pushSubscription;
                    await dbService.savePushSubscription(user.id, pushSubscription.toJSON());
                    console.log('[NOTIF DEBUG] Push subscription silently saved.');
                }
                setShowPushPermissionModal(false); // Ensure modal is closed if already granted
            } else if (currentPermission === 'denied') {
                console.log("[NOTIF DEBUG] Notification permission denied.");
                setShowPushPermissionModal(false); // Ensure modal is closed
            } else { // currentPermission === 'default'
                if (!existingSub) { // Only prompt if no existing subscription (to prevent re-prompts for user who said no)
                    console.log("[NOTIF DEBUG] Permission default and no sub in DB, showing modal.");
                    setShowPushPermissionModal(true);
                } else { // If permission is default but user has a sub (e.g. from another device), no need to prompt.
                    console.log("[NOTIF DEBUG] Permission default but existing sub, not showing modal.");
                    setShowPushPermissionModal(false);
                }
            }
        } catch (error) {
            console.error("[NOTIF DEBUG] Error during push permission check:", error);
            setShowPushPermissionModal(false);
        }
        // No finally block here, as hasPromptedPushOnceRef.current is set at the very beginning.
    };

    // Run performPushPermissionCheck directly
    performPushPermissionCheck();
 

    return () => {
        // When user logs out, reset this ref AND localStorage
        if (!user) {
            hasPromptedPushOnceRef.current = false;
            localStorage.removeItem('hasPromptedPushOnce'); // Clear from localStorage on logout
            console.log("[NOTIF DEBUG] Push permission useEffect cleanup: User logged out, reset hasPromptedPushOnceRef and localStorage.");
        }
    };
  }, [user, isUserAuthFinished, vapidPublicKey]); // Removed showPushPermissionModal from deps

  const handleDismissNotification = async (notificationId: string) => {
    await dbService.dismissNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setCurrentNotification(null); // Close modal if it was open for this notification
    if (focusWork?.id) {
      // Re-trigger smart notifications for this work to clear related tags
      await dbService.generateSmartNotifications(user!.id, focusWork.id);
    }
    refreshNotifications(); // Refresh global count
  };

  const handleClearAllNotifications = async () => {
    if (user?.id) {
      await dbService.clearAllNotifications(user.id);
      setNotifications([]);
      refreshNotifications(); // Refresh global count
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
    console.log("[NOTIF DEBUG] Dashboard: Rendering Skeleton. AuthFinished:", isUserAuthFinished, "AuthLoading:", authLoading, "Local Loading:", loading);
    return <DashboardSkeleton />;
  }

  // NEW: Render Critical Error Modal if active, *and prevent any other content from rendering*
  if (showCriticalErrorModal) {
    console.error("[NOTIF DEBUG] Dashboard: Rendering Critical Error Modal. Message:", criticalErrorMessage);
    return (
        <ZeModal
          isOpen={showCriticalErrorModal}
          title="Erro Crítico no Dashboard!"
          message={criticalErrorMessage}
          confirmText="Recarregar Página"
          onConfirm={() => window.location.reload()}
          onCancel={() => window.location.reload()} // Same action to ensure resolution
          type="ERROR"
        />
    );
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
        {/* NEW: Access My Work Button */}
        {focusWork && (
          <div className="mt-8">
              <button 
                  onClick={() => navigate(`/work/${focusWork.id}`)}
                  className="w-full py-4 bg-secondary text-white font-bold rounded-2xl shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-3"
              >
                  Acessar Obra <span className="font-medium">"{focusWork.name}"</span> <i className="fa-solid fa-arrow-right ml-2"></i>
              </button>
          </div>
        )}
      </div>

      {/* Upcoming Steps */}
      {focusWork && focusWorkDailySummary && (
        <LiveTimeline steps={focusWorkSteps} onClick={() => navigate(`/work/${focusWork.id}`)} />
      )}
      
      {/* Notifications Area */}
      {unreadNotificationsCount > 0 && (
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
              {unreadNotificationsCount}
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
            navigate('/notifications'); // Navigate to the new notifications page
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
          onCancel={() => {
            setShowPushPermissionModal(false);
            hasPromptedPushOnceRef.current = true; // Mark as prompted/dismissed for this session
            localStorage.setItem('hasPromptedPushOnce', 'true'); // Persist this state
          }}
          type="INFO"
        />
      )}
    </div>
  );
};

export default Dashboard;