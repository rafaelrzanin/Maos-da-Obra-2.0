import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, type Work, type Notification, type Step, type Material } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards.ts';
import { ZeModal } from '../components/ZeModal.tsx';

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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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

const KpiCard = ({ onClick, icon, iconClass, value, label, badge, accent }: any) => {
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

const RiskRadar = ({ focusWork, stats, dailySummary, onOpenWork }: any) => {
  const budgetPct = focusWork.budgetPlanned > 0 ? Math.round((stats.totalSpent / focusWork.budgetPlanned) * 100) : 0;
  const delayedPct = dailySummary.totalSteps > 0 ? Math.round((dailySummary.delayedSteps / dailySummary.totalSteps) * 100) : 0;

  const budgetTone = budgetPct > 100 ? { label: "Estourado", cls: "bg-red-100 dark:bg-red-900/25 text-red-700", bar: "bg-red-500" } : budgetPct > 85 ? { label: "No limite", cls: "bg-amber-100 text-amber-800", bar: "bg-amber-500" } : { label: "Saudável", cls: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500" };

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">Mapa de Riscos</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Análise proativa da obra</p>
        </div>
        <button onClick={onOpenWork} className="text-xs font-extrabold text-secondary">Ver detalhes →</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3 border border-slate-200/60 dark:border-white/10">
          <p className={cx("text-[11px] font-black uppercase", mutedText)}>Ritmo</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{stats.progress}%</p>
        </div>
        <div className="rounded-xl p-3 border border-slate-200/60 dark:border-white/10">
          <p className={cx("text-[11px] font-black uppercase", mutedText)}>Cronograma</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{delayedPct}%</p>
        </div>
      </div>
      <div className="rounded-xl p-4 border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-slate-950/20">
        <div className="flex justify-between mb-2">
          <p className="text-[10px] font-black uppercase text-slate-500">Uso do Orçamento</p>
          <p className="text-[10px] font-bold">R$ {focusWork.budgetPlanned.toLocaleString("pt-BR")}</p>
        </div>
        <div className="relative h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div className={cx("h-full transition-all", budgetTone.bar)} style={{ width: `${Math.min(100, budgetPct)}%` }} />
        </div>
      </div>
    </div>
  );
};

const LiveTimeline = ({ steps, onClick }: { steps: Step[]; onClick: () => void }) => {
  const today = new Date();
  today.setHours(0,0,0,0);

  const upcomingSteps = steps
    .filter(s => s.status === StepStatus.NOT_STARTED && new Date(s.startDate) >= today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <p className="text-sm font-black mb-4">Próximas Etapas</p>
      {upcomingSteps.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-4">Tudo em dia!</p>
      ) : (
        <div className="space-y-3">
          {upcomingSteps.slice(0, 2).map(step => (
            <div key={step.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-xs"><i className="fa-solid fa-calendar"></i></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{step.name}</p>
                <p className="text-[10px] text-slate-500">{formatDateDisplay(step.startDate)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={onClick} className="w-full mt-4 text-[11px] font-black text-secondary uppercase tracking-widest text-center">Ver cronograma completo</button>
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [zeTip, setZeTip] = useState<ZeTip>(getRandomZeTip());

  const [focusWork, setFocusWork] = useState<Work | null>(null);
  const [focusWorkStats, setFocusWorkStats] = useState<any>(null);
  const [focusWorkDailySummary, setFocusWorkDailySummary] = useState<any>(null);
  const [focusWorkMaterials, setFocusWorkMaterials] = useState<Material[]>([]); 
  const [focusWorkSteps, setFocusWorkSteps] = useState<Step[]>([]);

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [showPushPermissionModal, setShowPushPermissionModal] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  
  const hasPromptedPushOnceRef = useRef(false);
  const criticalErrorActiveRef = useRef(false);
  const [showCriticalErrorModal, setShowCriticalErrorModal] = useState(false);
  const [criticalErrorMessage, setCriticalErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    if (criticalErrorActiveRef.current || !user?.id || !isUserAuthFinished || authLoading) return;
    
    setLoading(true);
    try {
      const userWorks = await dbService.getWorks(user.id);
      setWorks(userWorks);

      const currentActiveWork = activeWorkId ? userWorks.find(w => w.id === activeWorkId) : userWorks[0];
      
      if (currentActiveWork) {
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

        // --- CORREÇÃO DO LOOP: Try/Catch isolado para notificações ---
        try {
          const expenses = await dbService.getExpenses(currentActiveWork.id);
          await dbService.generateSmartNotifications(
            user.id, 
            currentActiveWork.id,
            steps,
            expenses,
            materials,
            currentActiveWork
          );
        } catch (notifErr) {
          console.warn("[NOTIF DEBUG] Erro não-fatal nas notificações Push:", notifErr);
        }

      }
      
      const userNotifications = await dbService.getNotifications(user.id);
      setNotifications(userNotifications);
      refreshNotifications();

    } catch (error: any) {
      console.error("[NOTIF DEBUG] Erro fatal no Dashboard:", error);
      setCriticalErrorMessage(`Erro ao carregar dados: ${error.message}`);
      setShowCriticalErrorModal(true);
      criticalErrorActiveRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [user, activeWorkId, isUserAuthFinished, authLoading, refreshNotifications]);

  useEffect(() => {
    if (!criticalErrorActiveRef.current && isUserAuthFinished && !authLoading && user) {
        loadData();
    }
  }, [loadData, isUserAuthFinished, authLoading, user]);

  useEffect(() => {
    const pubKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (pubKey && pubKey !== 'undefined') {
      setVapidPublicKey(pubKey);
    } else {
      hasPromptedPushOnceRef.current = true;
    }
  }, []);

  const requestPushPermission = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !vapidPublicKey || !user) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        await dbService.savePushSubscription(user.id, pushSubscription.toJSON());
        alert('Notificações ativadas!');
      }
    } catch (error) {
      console.error('Push error:', error);
    } finally {
      setShowPushPermissionModal(false);
      hasPromptedPushOnceRef.current = true;
    }
  }, [user, vapidPublicKey]);

  useEffect(() => {
    if (!isUserAuthFinished || !user || !vapidPublicKey || hasPromptedPushOnceRef.current || showPushPermissionModal) return;

    const check = async () => {
        try {
            if (Notification.permission === 'default') {
                const existing = await dbService.getPushSubscription(user.id);
                if (!existing) setShowPushPermissionModal(true);
            }
        } catch (e) {} finally { hasPromptedPushOnceRef.current = true; }
    };
    setTimeout(check, 1500);
  }, [user, isUserAuthFinished, vapidPublicKey]);

  const handleDismissNotification = async (notificationId: string) => {
    await dbService.dismissNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setCurrentNotification(null);
    setShowNotificationModal(false);
    refreshNotifications();
  };

  if (!isUserAuthFinished || authLoading || loading) return <DashboardSkeleton />;

  if (showCriticalErrorModal) {
    return (
        <ZeModal
          isOpen={true}
          title="Ops! Algo deu errado"
          message={criticalErrorMessage}
          confirmText="Tentar Novamente"
          onConfirm={() => window.location.reload()}
          type="ERROR"
        />
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className={cx("text-sm font-extrabold", mutedText)}>Olá, {user?.name.split(' ')[0]}!</p>
          <h1 className="text-3xl font-black text-primary dark:text-white">Dashboard</h1>
        </div>
        <button onClick={() => navigate('/create')} className="bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:scale-105 transition-transform text-sm">
          <i className="fa-solid fa-plus-circle mr-2"></i> Nova Obra
        </button>
      </div>

      <div className={cx(surface, card, "flex items-center gap-5 mb-8")}>
        <div className="w-14 h-14 rounded-full p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0">
          <img src={ZE_AVATAR} alt="Zé" className="w-full h-full object-cover rounded-full border border-white" onError={(e) => (e.currentTarget.src = ZE_AVATAR_FALLBACK)} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase text-slate-400">Dica do Zé</p>
          <p className="text-sm font-bold leading-snug">{zeTip.text}</p>
        </div>
        <button onClick={() => setZeTip(getRandomZeTip())} className="text-slate-400 hover:text-primary"><i className="fa-solid fa-sync-alt"></i></button>
      </div>

      <div className={cx(surface, "rounded-[2rem] p-6 lg:p-8 mb-8")}>
        <div className="flex justify-between items-center mb-8">
          <p className="text-sm font-black">Obra em Destaque</p>
          {works.length > 0 && (
            <select value={activeWorkId || ''} onChange={(e) => setActiveWorkId(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold px-4 py-2">
              {works.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}
        </div>

        {focusWork && focusWorkStats ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <Donut value={focusWorkStats.progress} label={focusWork.name} />
              <KpiCard icon="fa-dollar-sign" iconClass="bg-emerald-100 text-emerald-600" label="Gasto Total" value={`R$ ${focusWorkStats.totalSpent.toLocaleString("pt-BR")}`} />
              <KpiCard onClick={() => navigate(`/work/${focusWork.id}`)} icon="fa-triangle-exclamation" iconClass="bg-red-100 text-red-600" label="Atrasos" value={focusWorkStats.delayedSteps} accent={focusWorkStats.delayedSteps > 0 ? "danger" : "ok"} />
            </div>
            <RiskRadar focusWork={focusWork} stats={focusWorkStats} dailySummary={focusWorkDailySummary} onOpenWork={() => navigate(`/work/${focusWork.id}/more?tab=REPORTS`)} />
          </div>
        ) : (
          <div className="text-center py-10 opacity-40"><i className="fa-solid fa-hard-hat text-5xl mb-4"></i><p className="font-bold">Nenhuma obra selecionada</p></div>
        )}
        
        {focusWork && (
          <button onClick={() => navigate(`/work/${focusWork.id}`)} className="w-full mt-8 py-4 bg-secondary text-white font-black rounded-2xl shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-3">
            ACESSAR OBRA <i className="fa-solid fa-arrow-right"></i>
          </button>
        )}
      </div>

      {focusWork && <LiveTimeline steps={focusWorkSteps} onClick={() => navigate(`/work/${focusWork.id}`)} />}

      {unreadNotificationsCount > 0 && (
        <div className="fixed bottom-24 right-6 z-50">
          <button onClick={() => { setCurrentNotification(notifications[0]); setShowNotificationModal(true); }} className="w-14 h-14 bg-red-500 rounded-full text-white shadow-2xl animate-bounce flex items-center justify-center relative">
            <i className="fa-solid fa-bell text-xl"></i>
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-white text-red-500 rounded-full text-[10px] font-black border-2 border-red-500 flex items-center justify-center">{unreadNotificationsCount}</span>
          </button>
        </div>
      )}

      {showNotificationModal && currentNotification && (
        <ZeModal isOpen={true} title={currentNotification.title} message={currentNotification.message} confirmText="Entendido" onConfirm={() => handleDismissNotification(currentNotification.id)} cancelText="Ver Todas" onCancel={() => navigate('/notifications')} type={currentNotification.type} />
      )}

      {showPushPermissionModal && (
        <ZeModal isOpen={true} title="Notificações Push" message="Deseja receber alertas de materiais e atrasos diretamente no seu celular?" confirmText="Sim, ativar!" onConfirm={requestPushPermission} cancelText="Agora não" onCancel={() => { setShowPushPermissionModal(false); hasPromptedPushOnceRef.current = true; }} type="INFO" />
      )}
    </div>
  );
};

export default Dashboard;
