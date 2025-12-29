
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

const EmptyDashboard = ({ onOpenCreateWork }: { onOpenCreateWork: () => void }) => {
  return (
    <div className={cx(surface, card, "flex flex-col items-center justify-center text-center p-10")}>
      <img src={ZE_AVATAR} className="w-24 h-24 rounded-full mb-6" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} alt="Zé da Obra Avatar" />
      <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Bem-vindo(a) ao Mãos da Obra!</h2>
      <p className={cx("text-md max-w-md", mutedText)}>
        Ainda não há nenhuma obra cadastrada. Que tal começar um novo projeto e ter tudo sob controle?
      </p>
      <button onClick={onOpenCreateWork} className="mt-8 px-6 py-3 bg-secondary text-white font-bold rounded-xl shadow-lg hover:bg-secondary-dark transition-colors flex items-center gap-2">
        <i className="fa-solid fa-plus-circle"></i> Começar Nova Obra
      </button>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user, authLoading, isUserAuthFinished } = useAuth();
  const navigate = useNavigate();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusWork, setFocusWork] = useState<Work | null>(null);
  const [stats, setStats] = useState<{ totalSpent: number, progress: number, delayedSteps: number } | null>(null);
  const [dailySummary, setDailySummary] = useState<{ completedSteps: number, delayedSteps: number, pendingMaterials: number, totalSteps: number } | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [zeTip, setZeTip] = useState<ZeTip | null>(null);

  // General Purpose Modal for Delete Confirmation
  const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string }>({
    isOpen: false,
    title: '',
    message: '',
    onCancel: () => { },
  });

  const loadDashboardData = useCallback(async () => {
    if (!user?.id || !isUserAuthFinished || authLoading) return;

    setLoading(true);
    try {
      const fetchedWorks = await dbService.getWorks(user.id);
      setWorks(fetchedWorks);

      if (fetchedWorks.length > 0) {
        const primaryWork = fetchedWorks[0];
        setFocusWork(primaryWork);

        const [workStats, summary, materialsList] = await Promise.all([
          dbService.calculateWorkStats(primaryWork.id),
          dbService.getDailySummary(primaryWork.id),
          dbService.getMaterials(primaryWork.id),
        ]);
        setStats(workStats);
        setDailySummary(summary);
        setMaterials(materialsList);
      } else {
        setFocusWork(null);
        setStats(null);
        setDailySummary(null);
        setMaterials([]);
      }
      setZeTip(getRandomZeTip()); // Load a random tip
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
      // Optionally set an error message to display
    } finally {
      setLoading(false);
    }
  }, [user, isUserAuthFinished, authLoading]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);


  const handleOpenCreateWork = () => {
    navigate('/create');
  };

  const handleOpenWorkDetail = (workId: string) => {
    navigate(`/work/${workId}`);
  };

  const handleDeleteWork = (workToDelete: Work) => {
    setZeModal({
      isOpen: true,
      title: 'Excluir Obra?',
      message: `Tem certeza que deseja excluir a obra "${workToDelete.name}" e TODOS os seus dados relacionados? Esta ação é irreversível.`,
      confirmText: 'Sim, Excluir Obra',
      cancelText: 'Cancelar',
      type: 'DANGER',
      onConfirm: async () => {
        try {
          await dbService.deleteWork(workToDelete.id);
          await loadDashboardData(); // Reload dashboard after deletion
          setZeModal(prev => ({ ...prev, isOpen: false })); // Close modal
        } catch (error) {
          console.error("Erro ao excluir obra:", error);
          setZeModal({
            isOpen: true,
            title: 'Erro!',
            message: `Falha ao excluir obra: ${error.message || 'Um erro desconhecido ocorreu.'}`,
            confirmText: 'Entendido',
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
          });
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Show skeleton if AuthContext is still loading OR if local dashboard data is loading
  if (authLoading || loading) {
    return <DashboardSkeleton />;
  }

  // If no works, show empty state
  if (works.length === 0) {
    return (
      <div className="max-w-4xl mx-auto pb-6 pt-6 px-4 md:px-0 font-sans">
        <EmptyDashboard onOpenCreateWork={handleOpenCreateWork} />
      </div>
    );
  }

  // Display dashboard content
  return (
    <div className="max-w-4xl mx-auto pb-6 pt-6 px-4 md:px-0 font-sans">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className={cx("text-sm font-bold uppercase tracking-wider", mutedText)}>Dashboard</p>
          <h1 className="text-3xl font-black text-primary dark:text-white">Minhas Obras</h1>
        </div>
        <button onClick={handleOpenCreateWork} className="px-5 py-2 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-light transition-colors flex items-center gap-2">
          <i className="fa-solid fa-plus-circle"></i> Nova Obra
        </button>
      </div>

      {/* Work Selector & Current Work Overview */}
      {focusWork && (
        <div className={cx(surface, card, "mb-8")}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-primary dark:text-white">Obra Focada:</h2>
            <div className="relative">
              <select
                value={focusWork.id}
                onChange={(e) => setFocusWork(works.find(w => w.id === e.target.value) || null)}
                className="block w-full pl-3 pr-10 py-2 text-base border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-xl focus:outline-none focus:ring-secondary focus:border-secondary transition-colors cursor-pointer"
                aria-label="Selecionar Obra Focada"
              >
                {works.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 dark:text-slate-300">
                <i className="fa-solid fa-chevron-down text-sm"></i>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Donut value={stats?.progress || 0} label="Progresso da Obra" />
            <div className="space-y-3">
              <KpiCard
                icon="fa-calendar-days"
                iconClass="bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-300"
                value={stats?.delayedSteps || 0}
                label="Etapas Atrasadas"
                accent={stats && stats.delayedSteps > 0 ? "danger" : "ok"}
                onClick={() => handleOpenWorkDetail(focusWork.id)}
              />
              <KpiCard
                icon="fa-dollar-sign"
                iconClass="bg-amber-500/10 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300"
                value={`R$ ${(stats?.totalSpent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                label="Gasto Total"
                accent={focusWork.budgetPlanned > 0 && stats && stats.totalSpent > focusWork.budgetPlanned * 0.9 ? "warn" : "ok"}
                onClick={() => handleOpenWorkDetail(focusWork.id)}
              />
            </div>
          </div>
          <div className="mt-8 flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => handleOpenWorkDetail(focusWork.id)} className="px-5 py-2 bg-secondary text-white font-bold rounded-xl shadow-lg hover:bg-secondary-dark transition-colors flex items-center gap-2">
              <i className="fa-solid fa-eye"></i> Ver Detalhes
            </button>
            <button onClick={() => handleDeleteWork(focusWork)} className="text-red-400 hover:text-red-600 transition-colors">
              <i className="fa-solid fa-trash mr-2"></i> Excluir Obra
            </button>
          </div>
        </div>
      )}

      {/* Risk Radar */}
      {focusWork && stats && dailySummary && (
        <div className="mb-8">
          <RiskRadar focusWork={focusWork} stats={stats} dailySummary={dailySummary} materials={materials} onOpenWork={() => handleOpenWorkDetail(focusWork.id)} />
        </div>
      )}

      {/* Zé da Obra Tip */}
      {zeTip && (
        <div className={cx(surface, card, "mb-8 flex items-start gap-5")}>
          <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-secondary to-orange-400 shadow-lg shrink-0 animate-float">
            <img src={ZE_AVATAR} className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} alt="Zé da Obra Avatar" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-1">{zeTip.tag}</p>
            <p className="text-md font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{zeTip.text}</p>
          </div>
        </div>
      )}

      {/* Other Works (List) */}
      {works.length > 1 && (
        <div className="mb-8">
          <h2 className="text-lg font-black text-primary dark:text-white mb-4">Outras Obras:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {works.filter(w => w.id !== focusWork?.id).map((work) => (
              <div key={work.id} onClick={() => setFocusWork(work)} className={cx(surface, "rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all")}>
                <div>
                  <h3 className="font-bold text-primary dark:text-white text-md">{work.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateDisplay(work.startDate)} - {formatDateDisplay(work.endDate)}</p>
                </div>
                <button onClick={() => setFocusWork(work)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <i className="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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