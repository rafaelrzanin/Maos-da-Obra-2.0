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
              <div key={step.id} className="flex items-center gap-3">
                <div className="flex flex-col items-center justify-center w-12 h-12 shrink-0">
                  <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{formatDateDisplay(step.startDate).split('/')[0]}</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{formatDateDisplay(step.startDate).split('/')[1]}</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">{step.name}</p>
                  <p className={cx("text-xs font-semibold", mutedText)}>
                    {daysDiff === 0 ? "Começa hoje" : daysDiff > 0 ? `Em ${daysDiff} dia(s)` : `Iniciou ${-daysDiff} dia(s) atrás`}
                  </p>
                </div>
                <span className={cx("text-[10px] font-black px-2 py-1 rounded-full uppercase", statusClass)}>
                  {daysDiff === 0 ? "Hoje" : daysDiff === 1 ? "Amanhã" : `Dia ${daysDiff}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


const WorkCard = ({ work, stats, dailySummary, onOpenWork, onDeleteWork }: { work: Work; stats: { totalSpent: number, progress: number, delayedSteps: number }; dailySummary: { completedSteps: number, delayedSteps: number, pendingMaterials: number, totalSteps: number }; onOpenWork: () => void; onDeleteWork: () => void; }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const totalSteps = dailySummary.totalSteps; // Get total steps from dailySummary

  return (
    <div className={cx(surface, card, "flex flex-col")}>
      {/* Header com status e opções */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-1">Status: {work.status}</p>
          <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{work.name}</h3>
          <p className={cx("text-xs font-semibold", mutedText)}>{work.address}</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowDeleteConfirm(prev => !prev)} className="text-slate-400 hover:text-red-500 text-lg">
            <i className="fa-solid fa-ellipsis-v"></i>
          </button>
          {showDeleteConfirm && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-10 animate-in fade-in slide-in-from-top-1">
              <button
                onClick={() => { onDeleteWork(); setShowDeleteConfirm(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
              >
                <i className="fa-solid fa-trash-alt mr-2"></i> Excluir Obra
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats principais */}
      <div className="flex justify-between items-end mb-6 flex-wrap gap-y-4">
        <Donut value={stats.progress} label="Progresso da Obra" />
        <div className="text-right">
          <p className={cx("text-[11px] font-extrabold tracking-widest uppercase", mutedText)}>Orçamento</p>
          <p className="text-2xl font-black text-secondary leading-none">R$ {work.budgetPlanned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Mini-stats */}
      <div className="grid grid-cols-2 gap-3 text-center text-sm mb-6">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
          <p className="font-extrabold text-slate-900 dark:text-white">{totalSteps} Etapas</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Planejadas</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
          <p className="font-extrabold text-emerald-600 dark:text-emerald-400">{dailySummary.completedSteps} Concluídas</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Etapas</p>
        </div>
      </div>

      {/* Botão para abrir detalhes */}
      <button
        onClick={onOpenWork}
        className="mt-auto w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg hover:bg-primary-light transition-all flex items-center justify-center gap-3"
      >
        <i className="fa-solid fa-arrow-right"></i> Ver Detalhes
      </button>
    </div>
  );
};


const Dashboard: React.FC = () => {
  const { user, authLoading, isUserAuthFinished } = useAuth();
  const navigate = useNavigate();
  
  const [works, setWorks] = useState<Work[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, { totalSpent: number, progress: number, delayedSteps: number }>>({});
  const [dailySummaries, setDailySummaries] = useState<Record<string, { completedSteps: number, delayedSteps: number, pendingMaterials: number, totalSteps: number }>>({});
  const [zeTip, setZeTip] = useState<ZeTip | null>(null);

  // NEW: PWA Push Notification state
  const [showPushNotificationPrompt, setShowPushNotificationPrompt] = useState(false);
  // NEW: Added 'ERROR' to the possible states for pushNotificationStatus
  const [pushNotificationStatus, setPushNotificationStatus] = useState<'IDLE' | 'REQUESTING' | 'GRANTED' | 'DENIED' | 'UNSUPPORTED' | 'CHECKING_SUBSCRIPTION' | 'ERROR'>('IDLE');
  const [zeModalConfig, setZeModalConfig] = useState<ZeModalProps & { id?: string }>({ 
    isOpen: false, 
    title: '', 
    message: '',
    onCancel: () => {}, 
  });


  const loadDashboardData = useCallback(async () => {
    if (!user || !isUserAuthFinished) return;

    setLoading(true);
    try {
      const userWorks = await dbService.getWorks(user.id);
      setWorks(userWorks);

      // Fetch stats and summaries in parallel for all works
      const statsPromises = userWorks.map(async (work) => ({
        workId: work.id,
        stats: await dbService.calculateWorkStats(work.id),
        summary: await dbService.getDailySummary(work.id),
      }));
      const results = await Promise.all(statsPromises);

      const newStats: Record<string, { totalSpent: number, progress: number, delayedSteps: number }> = {};
      const newSummaries: Record<string, { completedSteps: number, delayedSteps: number, pendingMaterials: number, totalSteps: number }> = {};
      
      for (const result of results) {
        newStats[result.workId] = result.stats;
        newSummaries[result.workId] = result.summary;
        
        // Generate notifications for EACH work
        await dbService.generateSmartNotifications(
          user.id, 
          result.workId, 
          await dbService.getSteps(result.workId), // Fetch current steps for notification logic
          await dbService.getExpenses(result.workId), // Fetch current expenses for notification logic
          await dbService.getMaterials(result.workId), // Fetch current materials for notification logic
          userWorks.find(w => w.id === result.workId) // Pass the work object
        );
      }
      setStats(newStats);
      setDailySummaries(newSummaries);

      // Fetch notifications after generating them
      const userNotifications = await dbService.getNotifications(user.id);
      setNotifications(userNotifications);

      // Set a random Zé tip
      setZeTip(getRandomZeTip());

    } catch (error) {
      console.error("Erro ao carregar dados do Dashboard:", error);
      // Optionally show an error message to the user
    } finally {
      setLoading(false);
    }
  }, [user, isUserAuthFinished]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // PWA Push Notification Logic
  useEffect(() => {
    if (!user || !isUserAuthFinished) return;

    const checkSubscriptionStatus = async () => {
      setPushNotificationStatus('CHECKING_SUBSCRIPTION');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushNotificationStatus('UNSUPPORTED');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Check if our DB has this subscription
        const dbSub = await dbService.getPushSubscription(user.id);
        if (dbSub && dbSub.endpoint === subscription.endpoint) {
          setPushNotificationStatus('GRANTED');
          setShowPushNotificationPrompt(false);
        } else {
          // Subscription exists but not in our DB, save it.
          console.log("Existing browser subscription not found in DB, saving...");
          await dbService.savePushSubscription(user.id, subscription.toJSON());
          setPushNotificationStatus('GRANTED');
          setShowPushNotificationPrompt(false);
        }
      } else {
        setPushNotificationStatus('IDLE');
        setShowPushNotificationPrompt(true); // Prompt if no subscription
      }
    };
    checkSubscriptionStatus();
  }, [user, isUserAuthFinished]); // Re-run when user or auth state changes

  const subscribeToPushNotifications = async () => {
    if (pushNotificationStatus === 'UNSUPPORTED' || !user) return;

    setPushNotificationStatus('REQUESTING');
    try {
      const registration = await navigator.serviceWorker.ready;
      const VITE_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY; // Access VAPID key

      if (!VITE_VAPID_PUBLIC_KEY || VITE_VAPID_PUBLIC_KEY === "undefined") { // Check for undefined string
        console.error("VAPID Public Key not defined in environment variables.");
        setZeModalConfig({
          isOpen: true,
          title: "Erro de Configuração",
          message: "A chave VAPID pública para notificações não foi configurada. Verifique as variáveis de ambiente (VITE_VAPID_PUBLIC_KEY).",
          confirmText: "Entendido",
          onCancel: () => setZeModalConfig(prev => ({ ...prev, isOpen: false }))
        });
        setPushNotificationStatus('ERROR'); // Set status to ERROR
        return;
      }
      
      const convertedVapidKey = urlBase64ToUint8Array(VITE_VAPID_PUBLIC_KEY);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });

      await dbService.savePushSubscription(user.id, subscription.toJSON());
      setPushNotificationStatus('GRANTED');
      setShowPushNotificationPrompt(false); // Hide the prompt
      setZeModalConfig({
        isOpen: true,
        title: "Notificações Ativadas!",
        message: "Você receberá resumos diários e alertas importantes sobre suas obras. Mantenha-se atualizado!",
        confirmText: "Entendido",
        type: 'SUCCESS',
        onCancel: () => setZeModalConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (error: any) {
      console.error("Erro ao assinar notificações push:", error);
      setPushNotificationStatus('DENIED');
      setZeModalConfig({
        isOpen: true,
        title: "Falha nas Notificações",
        message: `Não foi possível ativar as notificações. Por favor, verifique as permissões do navegador e tente novamente. Detalhes: ${error.message}`,
        confirmText: "Entendido",
        type: 'ERROR',
        onCancel: () => setZeModalConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };


  const handleDismissNotification = async (notificationId: string) => {
    if (!user) return;
    await dbService.dismissNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleClearAllNotifications = async () => {
    if (!user) return;
    setZeModalConfig({
      isOpen: true,
      title: "Limpar Todas as Notificações",
      message: "Tem certeza que deseja marcar todas as notificações como lidas?",
      confirmText: "Sim, limpar",
      cancelText: "Não",
      type: 'INFO',
      onConfirm: async () => {
        await dbService.clearAllNotifications(user.id);
        setNotifications([]);
        setZeModalConfig(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setZeModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleDeleteWork = (workId: string) => {
    setZeModalConfig({
      isOpen: true,
      title: "Excluir Obra",
      message: "Esta ação é irreversível e apagará TODOS os dados (etapas, materiais, gastos, etc.) desta obra. Tem certeza?",
      confirmText: "Sim, Excluir Obra",
      cancelText: "Cancelar",
      type: 'DANGER',
      onConfirm: async () => {
        setZeModalConfig(prev => ({...prev, isConfirming: true})); // Show loading on confirm button
        try {
          await dbService.deleteWork(workId);
          await loadDashboardData(); // Reload all data after deletion
          setZeModalConfig(prev => ({...prev, isOpen: false, isConfirming: false}));
        } catch (error: any) {
          console.error("Erro ao excluir obra:", error);
          setZeModalConfig({
            isOpen: true,
            title: "Erro",
            message: `Falha ao excluir obra: ${error.message || "Tente novamente."}`,
            confirmText: "Entendido",
            type: 'ERROR',
            onCancel: () => setZeModalConfig(prev => ({ ...prev, isOpen: false }))
          });
        }
      },
      onCancel: () => setZeModalConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  // If AuthContext is still loading, show a simple spinner.
  if (authLoading || !isUserAuthFinished || loading) return <DashboardSkeleton />;

  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bem-vindo(a) de volta!</p>
          <h1 className="text-3xl font-black text-primary dark:text-white mt-1">{user?.name}</h1>
        </div>
        <button
          onClick={() => navigate('/create')}
          className="bg-primary text-white text-sm font-bold px-5 py-3 rounded-xl shadow-lg hover:bg-primary-light transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-plus-circle"></i> Nova Obra
        </button>
      </div>

      {/* PWA Push Notification Prompt */}
      {showPushNotificationPrompt && (pushNotificationStatus === 'IDLE' || pushNotificationStatus === 'DENIED') && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200 rounded-2xl p-5 mb-8 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <div>
            <p className="font-bold text-sm mb-1">Receba alertas importantes!</p>
            <p className="text-xs">Ative as notificações para acompanhar o progresso das suas obras.</p>
          </div>
          <button
            onClick={subscribeToPushNotifications}
            disabled={pushNotificationStatus === 'REQUESTING'}
            className="shrink-0 ml-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {pushNotificationStatus === 'REQUESTING' ? 'Ativando...' : 'Ativar'}
          </button>
        </div>
      )}

      {/* Zé da Obra Tip */}
      {zeTip && (
        <div className="relative bg-gradient-to-br from-primary to-primary-light rounded-2xl p-5 mb-8 shadow-xl overflow-hidden group">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-full p-1 bg-gradient-gold shadow-lg flex items-center justify-center shrink-0">
              <img
                src={ZE_AVATAR}
                alt="Zé da Obra"
                className="w-full h-full object-cover rounded-full border-2 border-primary"
                onError={(e) => (e.currentTarget.src = ZE_AVATAR_FALLBACK)}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Dica do Zé da Obra</p>
              <p className="text-white text-sm font-medium leading-relaxed">{zeTip.text}</p>
            </div>
          </div>
          <div className="absolute top-2 right-2 text-white/20 text-xs font-bold uppercase group-hover:text-amber-300 transition-colors">
            {zeTip.tag}
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {notifications.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 mb-8 shadow-md border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-black text-primary dark:text-white flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Alertas ({notifications.length})
            </h2>
            <button onClick={handleClearAllNotifications} className="text-xs font-bold text-slate-500 hover:text-primary dark:hover:text-white">Limpar todos</button>
          </div>
          <div className="space-y-3">
            {notifications.map(notif => (
              <div key={notif.id} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                <div className="flex-shrink-0 mt-1">
                  {notif.type === 'WARNING' && <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>}
                  {notif.type === 'ERROR' && <i className="fa-solid fa-circle-exclamation text-red-500"></i>}
                  {notif.type === 'INFO' && <i className="fa-solid fa-info-circle text-blue-500"></i>}
                  {notif.type === 'SUCCESS' && <i className="fa-solid fa-check-circle text-green-500"></i>}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-primary dark:text-white text-sm">{notif.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{notif.message}</p>
                </div>
                <button onClick={() => handleDismissNotification(notif.id)} className="shrink-0 text-slate-400 hover:text-primary dark:hover:text-white">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minhas Obras */}
      <h2 className="text-xl font-black text-primary dark:text-white mb-4 pl-2">Minhas Obras</h2>
      {works.length === 0 ? (
        <div className={cx(surface, card, "text-center py-10")}>
          <i className="fa-solid fa-house-chimney-crack text-6xl text-slate-300 dark:text-slate-700 mb-4"></i>
          <p className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">Nenhuma obra cadastrada ainda.</p>
          <p className={cx("text-sm", mutedText, "mb-6")}>Comece seu projeto agora e organize sua construção ou reforma!</p>
          <button
            onClick={() => navigate('/create')}
            className="bg-secondary text-white text-sm font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-secondary-dark transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <i className="fa-solid fa-plus-circle"></i> Criar Nova Obra
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {works.map(work => (
            <WorkCard
              key={work.id}
              work={work}
              stats={stats[work.id] || { totalSpent: 0, progress: 0, delayedSteps: 0 }}
              dailySummary={dailySummaries[work.id] || { completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 }}
              onOpenWork={() => navigate(`/work/${work.id}`)}
              onDeleteWork={() => handleDeleteWork(work.id)}
            />
          ))}
        </div>
      )}
      
      <ZeModal {...zeModalConfig} />
    </div>
  );
};

export default Dashboard;