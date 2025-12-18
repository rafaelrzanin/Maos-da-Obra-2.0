
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { Work, Notification, Step, StepStatus, PlanType, Expense, Material } from '../types.ts'; // Importe Expense e Material
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards.ts';
import { ZeModal } from '../components/ZeModal.tsx';

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

//PAINEL DE RISCO
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
  materials: Material[];
  onOpenWork: () => void;
}) => {
  const budgetUsage = focusWork.budgetPlanned > 0 ? (stats.totalSpent / focusWork.budgetPlanned) * 100 : 0;
  const budgetPct = Math.round(budgetUsage);

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

  // Top 3 materiais “críticos” por gap (planejado - comprado)
  const critical = (materials || [])
    .map(m => ({ ...m, gap: Math.max(0, (m.plannedQty || 0) - (m.purchasedQty || 0)) }))
    .filter(m => m.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  return (
    <div className={cx(surface, "rounded-2xl p-5")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">Mapa de Riscos</p>
          <p className={cx("text-xs font-semibold", mutedText)}>
            Onde pode “dar ruim” antes de dar ruim
          </p>
        </div>
        <button onClick={onOpenWork} className="text-xs font-extrabold text-secondary hover:opacity-80">
          Ver detalhes →
        </button>
      </div>

      {/* 4 mini-métricas */}
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

      {/* Barra “zona” do orçamento (com marcas 85% e 100%) */}
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
          {/* marcas */}
          <div className="absolute inset-y-0 left-[85%] w-[2px] bg-amber-400/80" />
          <div className="absolute inset-y-0 left-[100%] w-[2px] bg-red-400/80" />
          <div className={cx("h-full rounded-full transition-all", budgetTone.bar)} style={{ width: `${Math.min(100, Math.max(2, budgetUsage))}%` }} />
        </div>

        <div className="flex justify-between mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span>0%</span>
          <span>85%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Compras críticas */}
      {critical.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Compras críticas
          </p>
          <div className="space-y-2">
            {critical.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl p-3 border border-slate-200/60 dark:border-white/10 bg-white/60 dark:bg-slate-950/20">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{m.name}</p>
                  <p className={cx("text-xs font-semibold", mutedText)}>
                    Falta comprar: {m.gap} {m.unit}
                  </p>
                </div>
                <span className="text-[11px] font-black px-2 py-1 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 whitespace-nowrap">
                  gap
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

//ARQUITETURA UX TESTE GPT
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const surface =
  "bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl border border-slate-200/60 dark:border-white/10 shadow-[0_12px_35px_rgba(2,6,23,0.10)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.35)]";

const card =
  "rounded-2xl p-5 transition-all";

const cardHover =
  "hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(2,6,23,0.14)] dark:hover:shadow-[0_22px_55px_rgba(0,0,0,0.45)]";

const subtleText = "text-slate-600 dark:text-slate-300";
const mutedText = "text-slate-500 dark:text-slate-400";

const SectionTitle = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <h3 className="text-xs font-extrabold tracking-[0.22em] uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-4 px-1">
    <i className={icon}></i> {children}
  </h3>
);

const Donut = ({ value, label }: { value: number; label: string }) => {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative w-14 h-14 rounded-full"
        style={{
          background: `conic-gradient(var(--tw-prose-links, rgb(245 158 11)) ${v * 3.6}deg, rgba(148,163,184,0.25) 0deg)`,
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

const MiniBars = ({
  aLabel, aValue, aMax, aClass,
  bLabel, bValue, bMax, bClass,
  cLabel, cValue, cMax, cClass,
}: {
  aLabel: string; aValue: number; aMax: number; aClass: string;
  bLabel: string; bValue: number; bMax: number; bClass: string;
  cLabel: string; cValue: number; cMax: number; cClass: string;
}) => {
  const w = (v: number, m: number) => `${Math.max(6, Math.min(100, m ? (v / m) * 100 : 0))}%`;

  return (
    <div className={cx(surface, "rounded-2xl p-5")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">Painel Vivo</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Radar rápido do dia</p>
        </div>
        <div className="text-xs font-extrabold tracking-widest uppercase text-slate-500 dark:text-slate-400">
          hoje
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className={mutedText}>{aLabel}</span>
            <span className="text-slate-900 dark:text-white">{aValue}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
            <div className={cx("h-full rounded-full", aClass)} style={{ width: w(aValue, aMax) }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className={mutedText}>{bLabel}</span>
            <span className="text-slate-900 dark:text-white">{bValue}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
            <div className={cx("h-full rounded-full", bClass)} style={{ width: w(bValue, bMax) }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className={mutedText}>{cLabel}</span>
            <span className="text-slate-900 dark:text-white">{cValue}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
            <div className={cx("h-full rounded-full", cClass)} style={{ width: w(cValue, cMax) }} />
          </div>
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
    <div className={cx(surface, "rounded-2xl p-5")}>
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
            <div key={s.id} onClick={onClick} className={cx("cursor-pointer", cardHover, "rounded-xl p-3 border border-slate-200/50 dark:border-white/10 bg-white/60 dark:bg-slate-950/20")}>
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

              {/* barrinha de “posição” na timeline */}
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
      className={cx(surface, card, cardHover, "cursor-pointer", ring)}
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
  const [expenses, setExpenses] = useState<Expense[]>([]); // Adicionado para passar para notifications
  const [materials, setMaterials] = useState<Material[]>([]); // Adicionado para passar para notifications
  
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
            const [workStats, summary, notifs, workSteps, workExpenses, workMaterials] = await Promise.all([
                dbService.calculateWorkStats(focusWork.id),
                dbService.getDailySummary(focusWork.id),
                dbService.getNotifications(user.id),
                dbService.getSteps(focusWork.id), // Busca etapas aqui
                dbService.getExpenses(focusWork.id), // Busca despesas aqui
                dbService.getMaterials(focusWork.id) // Busca materiais aqui
            ]);

            if (isMounted) {
                setStats(workStats);
                setDailySummary(summary);
                setNotifications(notifs);
                setExpenses(workExpenses); // Salva despesas no estado
                setMaterials(workMaterials); // Salva materiais no estado

                const nextSteps = workSteps // Use workSteps recém-buscado
                    .filter(s => s.status !== StepStatus.COMPLETED)
                    .sort((a: Step, b: Step) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                    .slice(0, 3);
                setUpcomingSteps(nextSteps);
            }
            
            // Passa os dados já carregados para evitar buscas redundantes na geração de notificações
            dbService.generateSmartNotifications(user.id, focusWork.id, workSteps, workExpenses, workMaterials, focusWork);

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
    if (user?.plan !== PlanType.VITALICIO && user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining <= 1) {
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
                if (stillExists) {
                    setFocusWork(stillExists);
                } else {
                    setFocusWork(updatedWorks[0]);
                }
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
                                <i className="fa-solid fa-plus-circle text-xs"></i>
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

      {/* Access Button (OLD POSITION) - REMOVED FROM HERE */}

      {/* MAIN HUD (SKELETON IF LOADING) */}
   {isLoadingDetails ? (
  <div className={cx("rounded-3xl p-1 mb-8 animate-pulse", surface)}>
    <div className="rounded-[1.4rem] p-6 h-64 bg-slate-100/70 dark:bg-slate-800/40"></div>
  </div>
) : (
  <div className={cx("rounded-3xl p-6 lg:p-8 mb-8", surface)}>
    {/* Header do bloco */}
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

      {/* Donut de progresso (gráfico simples) */}
      <div className="hidden md:block">
        <Donut value={stats.progress} label="Andamento" />
      </div>
    </div>

    {/* Grid KPIs */}
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

      <div className={cx(surface, card, "md:col-span-1", "flex flex-col justify-between")}>
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
              className={cx(
                "h-full rounded-full transition-all duration-700",
                isOverBudget ? "bg-red-500" : isNearBudget ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>

    {/* Mobile donut */}
    <div className="md:hidden">
      <div className={cx(surface, "rounded-2xl p-4")}>
        <Donut value={stats.progress} label="Andamento" />
      </div>
    </div>
  </div>
)}

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



            {/* NEW POSITION FOR ACCESS WORK BUTTON */}
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
