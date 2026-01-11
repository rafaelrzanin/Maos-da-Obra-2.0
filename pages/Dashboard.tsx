
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, PlanType, WorkStatus, type Work, type DBNotification, type Step, type Material } from '../types.ts';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';
import { ZeModal } from '../components/ZeModal.tsx'; 

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
 *========================= */
const DashboardSkeleton = () => (
  <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 animate-pulse">
    {/* Header */}
    <div className="flex justify-between items-end mb-10"> {/* OE #004: Increased margin-bottom */}
      <div className="space-y-3"> {/* OE #004: Increased space-y */}
        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded-full"></div> {/* OE #004: Increased height, width */}
        <div className="h-9 w-60 bg-slate-200 dark:bg-slate-800 rounded-xl"></div> {/* OE #004: Increased height, width */}
      </div>
      <div className="h-12 w-44 bg-slate-200 dark:bg-slate-800 rounded-xl"></div> {/* OE #004: Increased height, width */}
    </div>
    
    {/* Ze Tip Skeleton */}
    <div className={cx(surface, "rounded-3xl p-5 md:p-6 flex items-start gap-4 mb-8")}> {/* OE #004: Increased padding, margin-bottom */}
      <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0"></div> {/* OE #004: Increased size */}
      <div className="flex-1 space-y-3"> {/* OE #004: Increased space-y */}
        <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div> {/* OE #004: Increased height, width */}
        <div className="h-5 w-2/3 bg-slate-200 dark:bg-slate-700 rounded-full"></div> {/* OE #004: Increased height, width */}
      </div>
    </div>

    {/* Work Selector & Actions */}
    <div className="flex items-center gap-4 mb-10"> {/* OE #004: Increased margin-bottom */}
      <div className="h-14 flex-1 bg-slate-200 dark:bg-slate-800 rounded-xl"></div> {/* OE #004: Increased height */}
      <div className="h-14 w-14 bg-slate-200 dark:bg-slate-800 rounded-xl"></div> {/* OE #004: Increased size */}
    </div>

    {/* Daily Summary Skeleton */}
    <div className={cx(surface, "rounded-3xl p-7 mb-10")}> {/* OE #004: Increased padding, margin-bottom */}
      <div className="h-7 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-lg mb-5"></div> {/* OE #004: Increased height, margin-bottom */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"> {/* OE #004: Increased gap */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl p-4"> {/* OE #004: Increased height, padding */}
            <div className="h-5 w-10 bg-slate-200 dark:bg-slate-700 rounded-full mb-3"></div> {/* OE #004: Increased height, width, margin-bottom */}
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-full"></div> {/* OE #004: Increased height, width */}
          </div>
        ))}
      </div>
    </div>
    
    {/* Progress Bar Skeleton */}
    <div className={cx(surface, "rounded-3xl p-7 mb-10")}> {/* OE #004: Increased padding, margin-bottom */}
      <div className="h-7 w-1/4 bg-slate-200 dark:bg-slate-800 rounded-lg mb-5"></div> {/* OE #004: Increased height, margin-bottom */}
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 mb-3"></div> {/* OE #004: Increased height, margin-bottom */}
      <div className="flex justify-between text-sm text-slate-400"> {/* OE #004: Increased text size */}
        <div className="h-4 w-1/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div> {/* OE #004: Increased height */}
        <div className="h-4 w-1/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="h-4 w-1/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div className="h-4 w-1/5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
      </div>
    </div>

    {/* Budget Overview Skeleton */}
    <div className={cx(surface, "rounded-3xl p-7 mb-10")}> {/* OE #004: Increased padding, margin-bottom */}
      <div className="h-7 w-1/4 bg-slate-200 dark:bg-slate-800 rounded-lg mb-5"></div> {/* OE #004: Increased height, margin-bottom */}
      <div className="h-5 w-full bg-slate-200 dark:bg-slate-700 rounded-full mb-3"></div> {/* OE #004: Increased height, margin-bottom */}
      <div className="h-5 w-2/3 bg-slate-200 dark:bg-slate-700 rounded-full"></div> {/* OE #004: Increased height */}
    </div>

    {/* Access Work Button Skeleton */}
    <div className="h-16 w-full bg-secondary rounded-2xl"></div> {/* OE #004: Increased height */}
  </div>
);

/** =========================
 * Sub-Componentes
 * ========================= */

// NEW: Segmented Progress Bar Component (used for Work Detail)
const SegmentedProgressBar = ({ steps }: { steps: Step[] }) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 mb-3 flex"> {/* OE #004: Increased height, margin-bottom */}
        <div className="h-full bg-slate-300 rounded-full" style={{ width: '100%' }}></div>
      </div>
    );
  }

  const totalSteps = steps.length;
  // Use the derived status directly
  const completed = steps.filter(s => s.status === StepStatus.COMPLETED);
  const inProgress = steps.filter(s => s.status === StepStatus.IN_PROGRESS);
  const delayed = steps.filter(s => s.status === StepStatus.DELAYED);
  const pending = steps.filter(s => s.status === StepStatus.PENDING); // RENOMEADO: NotStarted para Pending

  // Calculate percentages based on the new, mutually exclusive categories
  const completedPct = (completed.length / totalSteps) * 100;
  const inProgressPct = (inProgress.length / totalSteps) * 100;
  const delayedPct = (delayed.length / totalSteps) * 100;
  const pendingPct = (pending.length / totalSteps) * 100; // RENOMEADO

  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 mb-3 flex overflow-hidden"> {/* OE #004: Increased height, margin-bottom */}
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
          className="h-full bg-amber-500"
          style={{ width: `${inProgressPct}%` }} 
          title={`${inProgress.length} Em Andamento`}
          aria-label={`${inProgress.length} etapas em andamento`}
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
      {/* Pending segment */}
      {pendingPct > 0 && (
        <div 
          className="h-full bg-slate-400 dark:bg-slate-600" // RENOMEADO
          style={{ width: `${pendingPct}%` }} 
          title={`${pending.length} Pendente(s)`} // RENOMEADO
          aria-label={`${pending.length} etapas pendentes`} // RENOMEADO
        ></div>
      )}
    </div>
  );
};

// OE-006: Re-added for "Segurança Percebida"
const getWorkStatusDetails = (status: WorkStatus): { text: string; bgColor: string; textColor: string } => {
  switch (status) {
    case WorkStatus.COMPLETED: return { text: 'Concluída', bgColor: 'bg-green-500', textColor: 'text-white' };
    case WorkStatus.IN_PROGRESS: return { text: 'Em Andamento', bgColor: 'bg-amber-500', textColor: 'text-white' };
    case WorkStatus.PAUSED: return { text: 'Pausada', bgColor: 'bg-blue-500', textColor: 'text-white' };
    case WorkStatus.PLANNING: return { text: 'Planejamento', bgColor: 'bg-slate-500', textColor: 'text-white' };
    default: return { text: 'Desconhecido', bgColor: 'bg-slate-400', textColor: 'text-white' };
  }
};


// NEW: FTUE steps content
const ftueStepsContent = [
  { text: "Eu sou o Zé da Obra. Vou te mostrar como começar e como o app funciona. Depois, sempre que precisar, estarei por aqui." }, // Step 1 - Apresentação
  { text: "O primeiro passo é criar a sua primeira obra. É a partir dela que todo o resto se organiza." }, // Step 2 - Como Começar
  { text: "Cadastre a obra e coloque as informações principais. Não precisa estar tudo perfeito agora, isso pode ser ajustado depois." }, // Step 3 - Cadastro da Obra
  { text: "Depois de criar a obra, o app gera um cronograma inicial com as etapas mais comuns. Ele serve como ponto de partida." }, // Step 4 - Cronograma Inicial
  { text: "Esse cronograma não substitui o responsável técnico. Engenheiro, arquiteto ou mestre de obras vão te ajudar a ajustar datas, etapas e sequência. Aqui você pode editar, criar ou excluir etapas para deixar tudo fiel à sua obra." }, // Step 5 - Importante Sobre o Cronograma
  { text: "Com o cronograma, o app sugere materiais para cada etapa. Confira com o responsável técnico, ajuste quantidades, marcas e inclua novos itens se precisar." }, // Step 6 - Materiais
  { text: "As compras de materiais entram automaticamente no financeiro. Outros gastos, como mão de obra, taxas e documentos, você pode lançar manualmente." }, // Step 7 - Financeiro
  { text: "Você também pode cadastrar sua equipe e fornecedores, guardar contatos e falar direto pelo WhatsApp." }, // Step 8 - Controle e Equipe
  { text: "O painel principal ajuda a acompanhar prazos, gastos e andamento da obra. Tudo fica organizado em um só lugar." }, // Step 9 - Acompanhamento
  { text: "Se surgir qualquer dúvida, no menu principal você encontra a área de Dúvidas, vídeos explicativos e pode falar comigo quando quiser." }, // Step 10 - Ajuda Disponível
  { text: "Pronto. Agora você já sabe como funciona. E sempre que precisar, é só me chamar." }, // Step 11 - Encerramento
];


const Dashboard = () => {
  const { user, authLoading, isUserAuthFinished, isSubscriptionValid, unreadNotificationsCount, requestPushNotificationPermission, pushSubscriptionStatus } = useAuth();
  const navigate = ReactRouter.useNavigate();
  
  // All works available to the user
  const [allWorks, setAllWorks] = useState<Work[]>([]);
  // The currently selected work for display
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  // Data for the selected work's dashboard summary
  const [workSummary, setWorkSummary] = useState<{
    totalSteps: number;
    completedSteps: number;
    inProgressSteps: number;
    delayedSteps: number;
    pendingMaterials: number;
    totalSpent: number;
    budgetPlanned: number;
  } | null>(null);
  const [selectedWorkSteps, setSelectedWorkSteps] = useState<Step[]>([]); // For progress bar
  
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [isDeletingWork, setIsDeletingWork] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null); // NEW: State for general dashboard errors

  // Ref to track notification count changes for data refresh
  const notificationCountRef = useRef(unreadNotificationsCount);

  // NEW: FTUE States
  const [showFtue, setShowFtue] = useState(false);
  const [currentFtueStep, setCurrentFtueStep] = useState(0);


  // =======================================================================
  // AUXILIARY FUNCTIONS
  // =======================================================================

  const markFtueAsSeen = useCallback(() => {
    localStorage.setItem('seen_app_ftue_guide', 'true');
    setShowFtue(false);
    setCurrentFtueStep(0);
  }, []);

  const handleNextFtueStep = useCallback(() => {
    if (currentFtueStep < ftueStepsContent.length - 1) {
      setCurrentFtueStep(prev => prev + 1);
    } else {
      markFtueAsSeen(); // Last step, mark as seen and close
    }
  }, [currentFtueStep, markFtueAsSeen]);


  // =======================================================================
  // DATA LOADING
  // =======================================================================

  const loadAllWorks = useCallback(async () => {
    if (!user?.id || !isUserAuthFinished || authLoading) {
      setLoadingDashboard(false);
      return;
    }

    setLoadingDashboard(true);
    setDashboardError(null); // Clear previous errors
    try {
      const fetchedWorks = await dbService.getWorks(user.id);
      setAllWorks(fetchedWorks);

      if (fetchedWorks.length > 0) {
        // If a work was previously selected (e.g., from local storage or URL), try to maintain it
        const lastSelectedWorkId = localStorage.getItem('lastSelectedWorkId');
        const defaultWork = fetchedWorks.find(w => w.id === lastSelectedWorkId) || fetchedWorks[0];
        
        setSelectedWork(defaultWork);
        await loadSelectedWorkData(defaultWork.id);
      } else {
        setSelectedWork(null);
        setWorkSummary(null);
        setSelectedWorkSteps([]);
      }
      
      // Request push notification permission after data loads
      if (pushSubscriptionStatus === 'idle' && isSubscriptionValid) {
        requestPushNotificationPermission();
      }

    } catch (error: any) {
      console.error("Erro ao carregar todas as obras:", error);
      setAllWorks([]);
      setSelectedWork(null);
      setWorkSummary(null);
      setSelectedWorkSteps([]);
      setDashboardError(`Não foi possível carregar suas obras. Por favor, tente novamente.`); // Set user-friendly error
    } finally {
      setLoadingDashboard(false);
    }
  }, [user, isUserAuthFinished, authLoading, isSubscriptionValid, pushSubscriptionStatus, requestPushNotificationPermission]);

  const loadSelectedWorkData = useCallback(async (workId: string) => {
    setLoadingDashboard(true);
    setDashboardError(null); // Clear previous errors
    try {
      const [fetchedSteps, fetchedMaterials, fetchedExpenses, fetchedWork] = await Promise.all([
        dbService.getSteps(workId),
        dbService.getMaterials(workId),
        dbService.getExpenses(workId),
        dbService.getWorkById(workId) // Fetch full work details
      ]);

      if (fetchedWork) {
          setSelectedWork(fetchedWork);
          localStorage.setItem('lastSelectedWorkId', fetchedWork.id); // Save last selected work
      } else {
          // Should not happen if workId came from loadAllWorks, but for safety
          setDashboardError("A obra selecionada não foi encontrada ou houve um erro ao carregá-la.");
          return;
      }

      // 🔥 CRITICAL: Use the derived status directly
      const totalSteps = fetchedSteps.length;
      const completedSteps = fetchedSteps.filter(s => s.status === StepStatus.COMPLETED).length;
      const delayedStepsCount = fetchedSteps.filter(s => s.status === StepStatus.DELAYED).length;
      const inProgressSteps = fetchedSteps.filter(s => s.status === StepStatus.IN_PROGRESS).length;


      const pendingMaterials = fetchedMaterials.filter(m => m.purchasedQty < m.plannedQty).length;
      const totalSpent = fetchedExpenses.reduce((sum, expense) => sum + (expense.paidAmount || 0), 0); // Use paidAmount

      setWorkSummary({
        totalSteps,
        completedSteps,
        inProgressSteps,
        delayedSteps: delayedStepsCount,
        pendingMaterials,
        totalSpent,
        budgetPlanned: fetchedWork.budgetPlanned
      });
      setSelectedWorkSteps(fetchedSteps);

    } catch (error: any) {
      console.error(`Erro ao carregar dados da obra ${workId}:`, error);
      setWorkSummary(null);
      setSelectedWorkSteps([]);
      setDashboardError(`Algo não saiu como esperado ao carregar os detalhes da obra: ${error.message || 'Erro desconhecido'}.`);
    } finally {
      setLoadingDashboard(false);
    }
  }, []); // No dependencies for memoization, as workId is passed as argument

  useEffect(() => {
    loadAllWorks();
  }, [loadAllWorks]);

  // Refresh data when notifications are dismissed (as notification status can affect dashboard metrics)
  useEffect(() => {
      if (unreadNotificationsCount !== notificationCountRef.current) {
          notificationCountRef.current = unreadNotificationsCount;
          if (selectedWork) {
            loadSelectedWorkData(selectedWork.id);
          } else {
            loadAllWorks(); // If no work selected, refresh overall work list
          }
      }
  }, [unreadNotificationsCount, selectedWork, loadSelectedWorkData, loadAllWorks]);

  // NEW: FTUE Trigger useEffect
  useEffect(() => {
    if (isUserAuthFinished && !authLoading && !loadingDashboard && user && localStorage.getItem('seen_app_ftue_guide') !== 'true') {
      setShowFtue(true);
      setCurrentFtueStep(0);
    }
  }, [isUserAuthFinished, authLoading, loadingDashboard, user]);


  // =======================================================================
  // HANDLERS
  // =======================================================================

  const handleWorkSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const workId = e.target.value;
    const work = allWorks.find(w => w.id === workId);
    if (work) {
      setSelectedWork(work);
      await loadSelectedWorkData(work.id);
    }
  };

  const handleDeleteSelectedWork = async () => {
    if (!selectedWork) return;

    setIsDeletingWork(true);
    setDeleteError('');
    try {
      await dbService.deleteWork(selectedWork.id);
      setShowDeleteModal(false);
      
      // After deletion, reload all works to update the list and re-select if possible
      await loadAllWorks(); 

      // If no works remain, clear selected work; otherwise, the new loadAllWorks will set default
      if (allWorks.length === 0) {
        setSelectedWork(null);
        setWorkSummary(null);
        localStorage.removeItem('lastSelectedWorkId');
      }
    } catch (error: any) {
      console.error("Erro ao excluir obra:", error);
      setDeleteError(error.message);
    } finally {
      setIsDeletingWork(false);
    }
  };

  // =======================================================================
  // RENDERING
  // =======================================================================

  // Show skeleton while initial authentication or data fetching is in progress.
  if (!isUserAuthFinished || authLoading || loadingDashboard) {
    return <DashboardSkeleton />;
  }

  // If user is null AFTER auth is finished, redirect to login.
  if (!user) {
    console.log("[Dashboard] No user after auth finished. Redirecting to /login.");
    return <ReactRouter.Navigate to="/login" replace />;
  }

  // NEW: Display general dashboard error if present
  if (dashboardError) {
    return (
      <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans animate-in fade-in">
        <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
            <i className="fa-solid fa-cloud-exclamation text-6xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
            <h2 className="text-2xl font-black text-primary dark:text-white mb-3">Ops! Tivemos um pequeno problema.</h2> {/* OE #004: Increased margin */}
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8 text-base"> {/* OE #004: Increased margin, text size */}
                Algo não saiu como esperado ao carregar suas obras. Por favor, tente novamente.
            </p>
            <button
                onClick={loadAllWorks}
                className="px-7 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors text-lg" /* OE #004: Increased padding, text size */
                aria-label="Tentar carregar obras novamente"
                disabled={loadingDashboard}
            >
                {loadingDashboard ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : null}
                Tentar Novamente
            </button>
        </div>
      </div>
    );
  }

  // No Works State - Redesigned
  if (allWorks.length === 0) {
    return (
      <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans">
        {/* Header - Welcome back [user's first name] */}
        <div className="flex justify-between items-end mb-10"> {/* OE #004: Increased margin-bottom */}
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Bem-vindo(a) de volta</p>
            <h1 className="text-3xl font-black text-primary dark:text-white">{user.name.split(' ')[0]}!</h1>
          </div>
          <button onClick={() => navigate('/create')} className="px-5 py-3 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Criar nova obra"> {/* OE #004: Increased padding, text size */}
            <i className="fa-solid fa-plus-circle"></i> Nova Obra
          </button>
        </div>

        {/* "Create your first work" eye-catching section */}
        <div className="flex flex-col items-center justify-center min-h-[40vh] bg-gradient-gold rounded-3xl p-10 text-white text-center shadow-lg shadow-amber-500/30 animate-in fade-in zoom-in-95 duration-500"> {/* OE #004: Increased padding */}
          <i className="fa-solid fa-hammer text-7xl mb-5 text-white/90"></i> {/* OE #004: Increased icon size, margin */}
          <h2 className="text-4xl md:text-5xl font-black mb-4">Crie sua primeira obra!</h2> {/* OE #004: Increased text sizes */}
          <p className="text-xl mb-10 text-white/80 max-w-lg">Transforme suas ideias em realidade com a gestão perfeita.</p> {/* OE #004: Increased text size, margin, added max-width */}
          <button 
            onClick={() => navigate('/create')} 
            className="px-9 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 transition-all flex items-center justify-center gap-3 text-xl" /* OE #004: Increased padding, text size */
            aria-label="Começar a criar sua primeira obra"
          >
            <i className="fa-solid fa-plus-circle"></i> Começar Nova Obra
          </button>
        </div>
      </div>
    );
  }

  // NEW: Fallback for when work is available but selectedWork/workSummary is not loaded (after filter change, etc.)
  if (allWorks.length > 0 && (!selectedWork || !workSummary)) {
    return (
      <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans animate-in fade-in">
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
          <i className="fa-solid fa-cloud-exclamation text-6xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
          <h2 className="text-2xl font-black text-primary dark:text-white mb-3">Algo não saiu como esperado.</h2> {/* OE #004: Increased margin */}
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8 text-base"> {/* OE #004: Increased margin, text size */}
            Não foi possível carregar os detalhes da obra selecionada. Por favor, tente novamente.
          </p>
          <button
            onClick={loadAllWorks}
            className="px-7 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors text-lg" /* OE #004: Increased padding, text size */
            aria-label="Tentar carregar obra novamente"
            disabled={loadingDashboard}
          >
            {loadingDashboard ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : null}
            Tentar Novamente
          </button>
          {/* Removed button to return to Dashboard, as loadAllWorks is the primary recovery mechanism here. */}
        </div>
      </div>
    );
  }

  // Main Dashboard Content
  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans">
      {/* FTUE Modal */}
      {showFtue && (
        <ZeModal
          isOpen={showFtue}
          title="Mãos da Obra - Guia Rápido"
          message={ftueStepsContent[currentFtueStep].text}
          confirmText={currentFtueStep === ftueStepsContent.length - 1 ? "Entendido!" : "Próximo"}
          cancelText="Pular Tour"
          onConfirm={handleNextFtueStep}
          onCancel={markFtueAsSeen}
          type="INFO"
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-end mb-10"> {/* OE #004: Increased margin-bottom */}
        <div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Bem-vindo(a) de volta</p>
          <h1 className="text-3xl font-black text-primary dark:text-white">{user.name.split(' ')[0]}!</h1>
        </div>
        <button onClick={() => navigate('/create')} className="px-5 py-3 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" aria-label="Criar nova obra"> {/* OE #004: Increased padding, text size */}
          <i className="fa-solid fa-plus-circle"></i> Nova Obra
        </button>
      </div>

      {/* Static Ze Tip (Only shown if works exist) */}
      <div className={cx(surface, "rounded-3xl p-5 md:p-6 flex items-start gap-4 mb-8 transition-all duration-300 transform animate-in fade-in slide-in-from-top-4")} role="status"> {/* OE #004: Increased padding, margin-bottom */}
            <div className="w-14 h-14 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0"> {/* OE #004: Increased size */}
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
                <p className="text-base font-black uppercase tracking-widest mb-1 text-secondary">Dica do Zé!</p> {/* OE #004: Increased text size */}
                <p className="text-primary dark:text-white font-bold text-lg leading-tight"> {/* OE #004: Increased text size */}
                  Mantenha sempre o olho no cronograma e no orçamento! Uma boa gestão evita surpresas e prejuízos na obra.
                </p>
            </div>
        </div>

      {/* Work Selector & Delete Action */}
      <div className="flex items-center gap-3 mb-10"> {/* OE #004: Increased margin-bottom */}
        {allWorks.length > 1 && (
          <label htmlFor="work-select" className="sr-only">Selecionar Obra</label>
        )}
        <select
          id="work-select"
          value={selectedWork?.id || ''}
          onChange={handleWorkSelectChange}
          className="flex-1 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary dark:text-white focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all text-base" /* OE #004: Increased padding, text size */
          aria-label="Selecionar obra para visualizar dashboard"
        >
          {allWorks.map((workOption) => (
            <option key={workOption.id} value={workOption.id}>{workOption.name}</option>
          ))}
        </select>
        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={!selectedWork}
          className="flex-none w-14 h-14 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50" /* OE #004: Increased size */
          aria-label={`Excluir obra ${selectedWork?.name || ''}`}
        >
          <i className="fa-solid fa-trash-alt text-xl"></i> {/* OE #004: Increased icon size */}
        </button>
      </div>

      {selectedWork && workSummary && (
        <>
          {/* Daily Summary Card */}
          <div className={cx(surface, "rounded-3xl p-7 mb-10")} aria-labelledby="summary-title"> {/* OE #004: Increased padding, margin-bottom */}
            <h2 id="summary-title" className="text-xl font-black text-primary dark:text-white mb-5">Resumo da Obra</h2> {/* OE #004: Increased margin-bottom */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"> {/* OE #004: Increased gap */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner"> {/* OE #004: Increased padding */}
                <i className="fa-solid fa-list-check text-2xl text-green-500 mb-2"></i> {/* OE #004: Increased icon size, margin */}
                <p className="text-xl font-black text-green-600 leading-none">{workSummary.completedSteps}</p> {/* OE #004: Increased text size */}
                <p className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500 mt-1">Etapas Concluídas</p> {/* OE #004: Added margin-top */}
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-hourglass-half text-2xl text-amber-500 mb-2"></i>
                <p className="text-xl font-black text-amber-600 leading-none">{workSummary.inProgressSteps}</p>
                <p className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500 mt-1">Etapas Em Andamento</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-triangle-exclamation text-2xl text-red-500 mb-2"></i>
                <p className="text-xl font-black text-red-600 leading-none">{workSummary.delayedSteps}</p>
                <p className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500 mt-1">Etapas Atrasadas</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 flex flex-col items-start border border-slate-100 dark:border-slate-700 shadow-inner">
                <i className="fa-solid fa-boxes-stacked text-2xl text-secondary mb-2"></i>
                <p className="text-xl font-black text-secondary leading-none">{workSummary.pendingMaterials}</p>
                <p className="text-[10px] font-extrabold tracking-widest uppercase text-slate-500 mt-1">Materiais Pendentes</p>
              </div>
            </div>
          </div>

          {/* Cronograma Overview */}
          <div className={cx(surface, "rounded-3xl p-7 mb-10")}> {/* OE #004: Increased padding, margin-bottom */}
            <h2 className="text-xl font-black text-primary dark:text-white mb-5">Progresso do Cronograma</h2> {/* OE #004: Increased margin-bottom */}
            <SegmentedProgressBar steps={selectedWorkSteps} />
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 font-medium"> {/* OE #004: Increased text size */}
              <span>Pendente</span>
              <span>Em Andamento</span>
              <span>Atrasada</span>
              <span>Concluída</span>
            </div>
          </div>

          {/* Financeiro Overview */}
          <div className={cx(surface, "rounded-3xl p-7 mb-10")}> {/* OE #004: Increased padding, margin-bottom */}
            <h2 className="text-xl font-black text-primary dark:text-white mb-5">Orçamento</h2> {/* OE #004: Increased margin-bottom */}
            <div className="flex items-center justify-between text-lg font-bold mb-3"> {/* OE #004: Increased margin-bottom */}
              <span className="text-slate-700 dark:text-slate-300">Planejado:</span>
              <span className="text-primary dark:text-white">{formatCurrency(workSummary.budgetPlanned)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold">
              <span className="text-slate-700 dark:text-slate-300">Gasto Total:</span>
              <span className={workSummary.totalSpent > workSummary.budgetPlanned ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>
                {formatCurrency(workSummary.totalSpent)}
              </span>
            </div>
            <div className="flex items-center justify-between text-2xl font-black pt-5 border-t border-slate-200 dark:border-slate-800 mt-5"> {/* OE #004: Increased padding, margin, text size */}
              <span className="text-primary dark:text-white">Balanço:</span>
              <span className={workSummary.totalSpent > workSummary.budgetPlanned ? 'text-red-500' : 'text-green-600 dark:text-green-400'}>
                {formatCurrency(workSummary.budgetPlanned - workSummary.totalSpent)}
              </span>
            </div>
          </div>

          {/* Access Work Button - Moved to bottom */}
          <button 
            onClick={() => selectedWork && navigate(`/work/${selectedWork.id}`)} 
            disabled={!selectedWork}
            className="w-full py-4 bg-gradient-gold text-white font-black rounded-2xl shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100 text-xl" /* OE #004: Increased padding, text size */
            aria-label={`Acessar obra ${selectedWork?.name || ''}`}
          >
            <i className="fa-solid fa-arrow-right"></i> Acessar Obra
          </button>
        </>
      )}

      {showDeleteModal && selectedWork && (
        <ZeModal
          isOpen={showDeleteModal}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir a obra "${selectedWork.name}"? Esta ação é irreversível e removerá todos os dados associados.`}
          confirmText="Sim, Excluir Obra"
          onConfirm={handleDeleteSelectedWork}
          onCancel={() => setShowDeleteModal(false)}
          type="DANGER"
          isConfirming={isDeletingWork}
        >
          {deleteError && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl text-base"> {/* OE #004: Increased text size */}
              <i className="fa-solid fa-triangle-exclamation mr-2"></i> {deleteError}
            </div>
          )}
        </ZeModal>
      )}
    </div>
  );
};

export default Dashboard;
