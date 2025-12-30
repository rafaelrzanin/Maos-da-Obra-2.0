
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, WorkStatus, type Work, type DBNotification, type Step, type Expense, type Material } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx'; // Importa ZeModalProps
import { Recharts } from '../components/RechartsWrapper.tsx'; // Importa Recharts

const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } = Recharts;

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
  const notStarted = steps.filter(s => s.status === StepStatus.NOT_STARTED);
  const delayed = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < today);

  // Remove delayed steps from inProgress and notStarted to avoid double counting for accurate segment widths
  const actualInProgress = inProgress.filter(s => !delayed.some(d => d.id === s.id));
  const actualNotStarted = notStarted.filter(s => !delayed.some(d => d.id === s.id));


  const completedPct = (completed.length / totalSteps) * 100;
  const inProgressPct = (actualInProgress.length / totalSteps) * 100;
  const delayedPct = (delayed.length / totalSteps) * 100;
  const notStartedPct = (actualNotStarted.length / totalSteps) * 100; // Remaining

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 flex overflow-hidden">
      {completedPct > 0 && <div className="h-full bg-green-500" style={{ width: `${completedPct}%` }} title={`Concluído: ${completedPct.toFixed(0)}%`}></div>}
      {inProgressPct > 0 && <div className="h-full bg-orange-500" style={{ width: `${inProgressPct}%` }} title={`Em Andamento: ${inProgressPct.toFixed(0)}%`}></div>}
      {delayedPct > 0 && <div className="h-full bg-red-500" style={{ width: `${delayedPct}%` }} title={`Atrasado: ${delayedPct.toFixed(0)}%`}></div>}
      {notStartedPct > 0 && <div className="h-full bg-slate-300" style={{ width: `${notStartedPct}%` }} title={`Pendente: ${notStartedPct.toFixed(0)}%`}></div>}
    </div>
  );
};


// FIX: Updated KpiCardProps interface to accept `children`
const KpiCard = ({ onClick, icon, iconClass, value, label, badge, accent, children }: {
  onClick?: () => void;
  icon: string;
  iconClass: string;
  value: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
  accent?: "ok" | "warn" | "danger";
  children?: React.ReactNode; // NEW: Added children prop
}) => {
  const ring = accent === "danger" ? "ring-1 ring-red-500/20" : accent === "warn" ? "ring-1 ring-amber-500/20" : "ring-1 ring-emerald-500/10";
  return (
    <div 
      onClick={onClick} 
      className={cx(surface, "rounded-3xl p-4 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-xl hover:border-secondary/40", ring)} 
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1} // Make clickable elements focusable
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick(); }} // Keyboard accessibility
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cx("w-10 h-10 rounded-xl grid place-items-center text-base", iconClass)}><i className={icon}></i></div>
        {badge}
      </div>
      <div className="text-2xl font-black text-slate-900 dark:text-white leading-none mb-1">{value}</div>
      <div className={cx("text-[10px] font-extrabold tracking-widest uppercase", mutedText)}>{label}</div>
      {children} {/* NEW: Render children here */}
    </div>
  );
};

// NEW: NextSteps Component
const NextSteps = ({
  focusWork,
  steps,
  onOpenWork,
}: {
  focusWork: Work;
  steps: Step[];
  onOpenWork: () => void;
}) => {
  const today = new Date().toISOString().split('T')[0];
  const nextRelevantSteps = steps
    .filter(s => s.status !== StepStatus.COMPLETED && s.endDate >= today) // Filter out completed and past due
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5); // Max 5 cards

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-black text-slate-900 dark:text-white">Próximas Etapas</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Organize os próximos passos da sua obra</p>
        </div>
        <button onClick={onOpenWork} className="text-xs font-extrabold text-secondary hover:opacity-80 px-3 py-1.5 rounded-lg bg-secondary/5 transition-colors" aria-label="Ver cronograma completo">
          Ver cronograma →
        </button>
      </div>

      {nextRelevantSteps.length === 0 ? (
        <div className="text-center text-slate-400 py-8 italic text-sm">
          Todas as etapas futuras concluídas ou sem etapas futuras.
        </div>
      ) : (
        <div className="space-y-4">
          {nextRelevantSteps.map((step, idx) => {
            let statusClass = '';
            let statusIcon = '';

            const isDelayed = step.status !== StepStatus.COMPLETED && step.endDate < today;

            if (isDelayed) {
                statusClass = 'text-red-600';
                statusIcon = 'fa-triangle-exclamation';
            } else if (step.status === StepStatus.COMPLETED) {
                statusClass = 'text-green-600';
                statusIcon = 'fa-check-circle';
            } else if (step.status === StepStatus.IN_PROGRESS) {
                statusClass = 'text-orange-600';
                statusIcon = 'fa-hammer';
            } else { // StepStatus.NOT_STARTED
                statusClass = 'text-slate-500';
                statusIcon = 'fa-clock';
            }

            return (
              <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-primary dark:text-white text-sm">{step.name}</p>
                  <span className={cx("text-xs font-semibold flex items-center gap-1", statusClass)}>
                    <i className={`fa-solid ${statusIcon}`}></i> {isDelayed ? "Atrasada" : (step.status === StepStatus.COMPLETED ? "Concluída" : (step.status === StepStatus.IN_PROGRESS ? "Em Andamento" : "Pendente"))}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// NEW: MaterialsNeeded Component
const MaterialsNeeded = ({
  focusWork,
  materials,
  steps,
  onOpenWork,
}: {
  focusWork: Work;
  materials: Material[];
  steps: Step[];
  onOpenWork: () => void;
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to midnight for comparison
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(today.getDate() + 3); // threeDaysFromNow is inclusive of day 3

  const relevantMaterials = materials.filter(mat => {
    if (!mat.stepId || mat.purchasedQty >= mat.plannedQty) return false; // Already purchased or no step

    const linkedStep = steps.find(s => s.id === mat.stepId);
    if (!linkedStep) return false;

    // Normalize step dates to local midnight for consistent comparison
    const [yearS, monthS, dayS] = linkedStep.startDate.split('-').map(Number);
    const stepStartDate = new Date(yearS, monthS - 1, dayS, 0, 0, 0, 0);

    const [yearE, monthE, dayE] = linkedStep.endDate.split('-').map(Number);
    const stepEndDate = new Date(yearE, monthE - 1, dayE, 0, 0, 0, 0);


    // Rule 1: Step starts in up to 3 days (inclusive)
    const isUpcoming = stepStartDate >= today && stepStartDate <= threeDaysFromNow;

    // Rule 2: Step has already started (or is today) AND material is pending/partial
    const hasStartedAndPending = stepStartDate <= today && mat.purchasedQty < mat.plannedQty;
    
    return isUpcoming || hasStartedAndPending;
  });

  if (relevantMaterials.length === 0) {
    return null; // Don't render the section if no relevant materials
  }

  return (
    <div className={cx(surface, "rounded-3xl p-6")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-lg font-black text-slate-900 dark:text-white">Materiais para Compra</p>
          <p className={cx("text-xs font-semibold", mutedText)}>Organize suas compras para não atrasar a obra</p>
        </div>
        <button onClick={() => onOpenWork()} className="text-xs font-extrabold text-secondary hover:opacity-80 px-3 py-1.5 rounded-lg bg-secondary/5 transition-colors" aria-label="Ver todos os materiais">
          Ver todos os materiais →
        </button>
      </div>

      <div className="space-y-4">
        {relevantMaterials.map(mat => {
          const linkedStep = steps.find(s => s.id === mat.stepId);
          const statusText = mat.purchasedQty === 0 ? "Pendente" : "Parcial";
          const statusClass = mat.purchasedQty === 0 ? "text-red-500" : "text-orange-500";
          const progress = (mat.purchasedQty / mat.plannedQty) * 100;

          return (
            <div key={mat.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-primary dark:text-white text-sm">{mat.name}</p>
                <span className={cx("text-xs font-semibold flex items-center gap-1", statusClass)}>
                  <i className="fa-solid fa-box"></i> {statusText}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Etapa: {linkedStep?.name || 'N/A'}</p>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-secondary" style={{ width: `${Math.min(100, progress)}%` }}></div>
              </div>
              <p className="text-[10px] text-right text-slate-500 dark:text-slate-400 mt-1">
                {mat.purchasedQty}/{mat.plannedQty} {mat.unit} comprados
              </p>
            </div>
          );
        })}
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
      <button 
        onClick={onOpenCreateWork} 
        className="mt-8 px-6 py-3 bg-secondary text-white font-bold rounded-xl shadow-lg hover:bg-secondary-dark transition-colors flex items-center gap-2"
        aria-label="Começar Nova Obra"
      >
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
  const [steps, setSteps] = useState<Step[]>([]); 
  const [expenses, setExpenses] = useState<Expense[]>([]); // Added expenses state for the chart
  const [zeTip, setZeTip] = useState<ZeTip | null>(null);

  // General Purpose Modal for Delete Confirmation
  const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string, isConfirming?: boolean }>({
    isOpen: false,
    title: '',
    message: '',
    onCancel: () => { },
    isConfirming: false
  });

  const loadDashboardData = useCallback(async () => {
    if (!user?.id || !isUserAuthFinished || authLoading) return;
    console.log("[Dashboard] loadDashboardData: Fetching data from DB..."); // Debug log

    setLoading(true);
    try {
      const fetchedWorks = await dbService.getWorks(user.id);
      setWorks(fetchedWorks);
      console.log("[Dashboard] loadDashboardData: fetchedWorks after getWorks:", fetchedWorks);


      if (fetchedWorks.length > 0) {
        const primaryWork = fetchedWorks[0];
        setFocusWork(primaryWork);

        const [workStats, summary, materialsList, stepsList, expensesList] = await Promise.all([ // Fetch expensesList too
          dbService.calculateWorkStats(primaryWork.id),
          dbService.getDailySummary(primaryWork.id),
          dbService.getMaterials(primaryWork.id),
          dbService.getSteps(primaryWork.id),
          dbService.getExpenses(primaryWork.id) // Fetch expenses for chart
        ]);
        setStats(workStats);
        setDailySummary(summary);
        setMaterials(materialsList);
        setSteps(stepsList);
        setExpenses(expensesList); // Set expenses
      } else {
        setFocusWork(null);
        setStats(null);
        setDailySummary(null);
        setMaterials([]);
        setSteps([]);
        setExpenses([]); // Clear expenses
      }
      setZeTip(getRandomZeTip()); // Load a random tip
    } catch (error: any) {
      console.error("Erro ao carregar dados do dashboard:", error);
      // Optionally set an error message to display
    } finally {
      setLoading(false);
      console.log("[Dashboard] loadDashboardData: Data fetched and loading set to false."); // Debug log
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
      isConfirming: false,
      onConfirm: async () => {
        setZeModal(prev => ({ ...prev, isConfirming: true }));
        console.log(`[Dashboard] handleDeleteWork: Attempting to delete work ID: ${workToDelete.id}`);
        try {
          await dbService.deleteWork(workToDelete.id);
          console.log(`[Dashboard] handleDeleteWork: Successfully deleted work ID: ${workToDelete.id}. Reloading data...`);
          await loadDashboardData();
          setZeModal(prev => ({ ...prev, isOpen: false }));
          console.log(`[Dashboard] handleDeleteWork: Modal closed and data reloaded.`);
        } catch (error: any) {
          console.error("[Dashboard] Erro ao excluir obra no frontend:", error);
          setZeModal({
            isOpen: true,
            title: 'Erro!',
            message: `Falha ao excluir obra: ${error.message || 'Um erro desconhecido ocorreu.'}\nPor favor, verifique suas permissões de RLS no Supabase.`,
            confirmText: 'Entendido',
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: 'ERROR'
          });
        } finally {
          setZeModal(prev => ({ ...prev, isConfirming: false }));
        }
      },
      onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Process expenses for chart data
  const chartData = useMemo(() => {
    if (!expenses || expenses.length === 0) return [];

    const monthlyExpenses: { [key: string]: number } = {};
    expenses.forEach(exp => {
      const date = new Date(exp.date);
      const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      monthlyExpenses[monthYear] = (monthlyExpenses[monthYear] || 0) + exp.amount;
    });

    return Object.keys(monthlyExpenses)
      .sort()
      .map(monthYear => ({
        month: new Date(monthYear).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        value: monthlyExpenses[monthYear],
      }));
  }, [expenses]);


  // Show skeleton if AuthContext is still loading OR if local dashboard data is loading
  if (authLoading || loading) {
    return <DashboardSkeleton />;
  }

  // If no works, show empty state
  if (works.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 md:px-0 font-sans">
        <EmptyDashboard onOpenCreateWork={handleOpenCreateWork} />
      </div>
    );
  }

  // Calculate step counts for KPI Cards
  const totalSteps = steps.length;
  const completedStepsCount = steps.filter(s => s.status === StepStatus.COMPLETED).length;
  const inProgressStepsCount = steps.filter(s => s.status === StepStatus.IN_PROGRESS).length;
  const todayDateString = new Date().toISOString().split('T')[0];
  const delayedStepsCount = steps.filter(s => s.status !== StepStatus.COMPLETED && s.endDate < todayDateString).length;
  const notStartedStepsCount = steps.filter(s => s.status === StepStatus.NOT_STARTED && s.endDate >= todayDateString).length;


  // Display dashboard content
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 md:px-0 font-sans">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className={cx("text-sm font-bold uppercase tracking-wider", mutedText)}>Dashboard</p>
          <h1 className="text-3xl font-black text-primary dark:text-white">Olá, {user?.name.split(' ')[0]}!</h1>
        </div>
        <button 
          onClick={handleOpenCreateWork} 
          className="px-5 py-2 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-light transition-colors flex items-center gap-2"
          aria-label="Adicionar Nova Obra"
        >
          <i className="fa-solid fa-plus-circle"></i> Nova Obra
        </button>
      </div>

      {/* Work Selector & Current Work Overview */}
      {focusWork && (
        <div className={cx(surface, card, "mb-8 p-6 md:p-8")}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-primary dark:text-white">Obra Principal:</h2> {/* Terminology changed */}
            <div className="relative flex items-center">
              <select
                value={focusWork.id}
                onChange={(e) => setFocusWork(works.find(w => w.id === e.target.value) || null)}
                className="block min-w-[150px] pl-3 pr-10 py-2 text-base border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-xl focus:outline-none focus:ring-secondary focus:border-secondary transition-colors cursor-pointer"
                aria-label="Selecionar Obra Focada"
              >
                {works.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-10 flex items-center px-2 text-slate-700 dark:text-slate-300">
                <i className="fa-solid fa-chevron-down text-sm"></i>
              </div>
              <button onClick={() => handleDeleteWork(focusWork)} className="text-red-400 hover:text-red-600 transition-colors p-2 ml-2" aria-label={`Excluir obra ${focusWork.name}`}>
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          {/* PROGRESSO GERAL DA OBRA (BLOCO PRINCIPAL) */}
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight mb-2">Progresso Geral da Obra</h3>
            <p className={cx("text-sm font-semibold mb-4", mutedText)}>Visão completa das etapas da obra</p>
            
            {/* Segmented Progress Bar */}
            <SegmentedProgressBar steps={steps} />

            <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">
                <span>Total: {totalSteps} etapas</span>
                {totalSteps > 0 && <span>{((completedStepsCount / totalSteps) * 100).toFixed(0)}% Concluído</span>}
            </div>
          </div>


          {/* STATUS DAS ETAPAS (RESUMO VISUAL) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            <KpiCard
                icon="fa-check-circle"
                iconClass="bg-green-500/10 text-green-600 dark:bg-green-900/20 dark:text-green-300"
                value={completedStepsCount}
                label="Etapas Concluídas"
                onClick={() => handleOpenWorkDetail(focusWork.id)}
            />
            <KpiCard
                icon="fa-hammer"
                iconClass="bg-orange-500/10 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300"
                value={inProgressStepsCount}
                label="Etapas Em Andamento"
                accent={inProgressStepsCount > 0 ? "warn" : "ok"}
                onClick={() => handleOpenWorkDetail(focusWork.id)}
            />
            <KpiCard
                icon="fa-clock"
                iconClass="bg-slate-300/10 text-slate-500 dark:bg-slate-700/20 dark:text-slate-400"
                value={notStartedStepsCount}
                label="Etapas Pendentes"
                onClick={() => handleOpenWorkDetail(focusWork.id)}
            />
            <KpiCard
                icon="fa-triangle-exclamation"
                iconClass="bg-red-500/10 text-red-600 dark:bg-red-900/20 dark:text-red-300"
                value={delayedStepsCount}
                label="Etapas Atrasadas"
                accent={delayedStepsCount > 0 ? "danger" : "ok"}
                onClick={() => handleOpenWorkDetail(focusWork.id)}
            />
          </div>

          {/* Budget Overview (KpiCard with progress bar, kept as per previous) */}
          <KpiCard
                icon="fa-dollar-sign"
                iconClass="bg-secondary/10 text-secondary dark:bg-secondary-dark/20 dark:text-secondary-light"
                value={formatCurrency(stats?.totalSpent || 0)} // Currency formatted
                label="Gasto Total"
                accent={focusWork.budgetPlanned > 0 && stats && stats.totalSpent > focusWork.budgetPlanned * 0.9 ? "warn" : "ok"}
                onClick={() => handleOpenWorkDetail(focusWork.id)}
              >
                {/* Budget Progress Bar */}
                {focusWork.budgetPlanned > 0 && stats && (
                  <div className="w-full mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={(stats.totalSpent / focusWork.budgetPlanned) * 100} aria-valuemin={0} aria-valuemax={100}>
                    <div 
                      className={`h-full rounded-full ${
                        (stats.totalSpent / focusWork.budgetPlanned) * 100 > 100 ? 'bg-red-500' :
                        (stats.totalSpent / focusWork.budgetPlanned) * 100 > 80 ? 'bg-amber-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (stats.totalSpent / focusWork.budgetPlanned) * 100)}%` }}
                    ></div>
                    <p className="text-[10px] text-right text-slate-500 dark:text-slate-400 mt-1">
                      {(stats.totalSpent / focusWork.budgetPlanned * 100).toFixed(0)}% do orçamento ({formatCurrency(stats.totalSpent)} / {formatCurrency(focusWork.budgetPlanned)})
                    </p>
                  </div>
                )}
              </KpiCard>

          <div className="pt-4">
            <button 
              onClick={() => handleOpenWorkDetail(focusWork.id)} 
              className="w-full py-4 bg-secondary text-white font-bold rounded-xl shadow-lg hover:bg-secondary-dark transition-colors flex items-center justify-center gap-2"
              aria-label={`Acessar detalhes da obra ${focusWork.name}`}
            >
              <i className="fa-solid fa-arrow-right"></i> Acessar Obra
            </button>
          </div>
        </div>
      )}

      {/* NEW: Monthly Expenses Chart (kept as per previous, it's a useful summary) */}
      {focusWork && chartData.length > 0 && (
        <div className={cx(surface, card, "mb-8")}>
          <h2 className="text-lg font-black text-primary dark:text-white mb-4">Gastos Mensais</h2>
          <div className="h-64"> {/* Define a fixed height for the chart */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 5, right: 10, left: 0, bottom: 5,
                }}
              >
                <XAxis dataKey="month" stroke="rgb(100 116 139)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgb(100 116 139)" tickFormatter={value => `R$ ${value.toLocaleString('pt-BR')}`} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }} 
                  formatter={(value: number) => [formatCurrency(value), 'Gasto']} 
                  labelFormatter={(label) => `Mês: ${label}`}
                  contentStyle={{ 
                    backgroundColor: 'rgb(15 23 42 / 0.8)', 
                    borderColor: 'rgb(51 65 85 / 0.8)', 
                    borderRadius: '0.75rem',
                    color: 'white' 
                  }}
                  itemStyle={{ color: 'white' }}
                />
                <Bar dataKey="value" fill="rgb(217 119 6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* NEW: Next Steps Section */}
      {focusWork && steps && (
        <div className="mb-8">
          <NextSteps focusWork={focusWork} steps={steps} onOpenWork={() => handleOpenWorkDetail(focusWork.id)} />
        </div>
      )}

      {/* NEW: Materials Needed for Purchase (Intelligent) */}
      {focusWork && materials && steps && (
        <div className="mb-8">
          <MaterialsNeeded focusWork={focusWork} materials={materials} steps={steps} onOpenWork={() => handleOpenWorkDetail(focusWork.id)} />
        </div>
      )}

      {/* Zé da Obra Tip */}
      {zeTip && (
        <div className={cx(surface, card, "mb-8 flex items-start gap-5 p-6 md:p-8")}>
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
              <div 
                key={work.id} 
                onClick={() => setFocusWork(work)} 
                className={cx(surface, "rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all")}
                role="button"
                tabIndex={0}
                aria-label={`Selecionar obra ${work.name}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setFocusWork(work); }}
              >
                <div>
                  <h3 className="font-bold text-primary dark:text-white text-md">{work.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateDisplay(work.startDate)} - {formatDateDisplay(work.endDate)}</p>
                </div>
                <button 
                  onClick={() => setFocusWork(work)} 
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  aria-label={`Ver detalhes da obra ${work.name}`}
                >
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
        isConfirming={zeModal.isConfirming}
      />
    </div>
  );
};

export default Dashboard;
