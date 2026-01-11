
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx'; // Keep XLSX import, as reports might use it
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts';
import { StepStatus, FileCategory, ExpenseCategory, ExpenseStatus, WorkStatus, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
import { ZeModal, type ZeModalProps } from '../components/ZeModal.tsx';

// --- TYPES FOR VIEW STATE ---
export type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
// Adjusted SubView type to only include actual sub-views rendered within WorkDetail.
// AIPLANNER, REPORTS, AICHAT navigate to different pages.
type SubView = 'NONE' | 'WORKERS' | 'SUPPLIERS' | 'PHOTOS' | 'FILES' | 'CONTRACTS' | 'CHECKLIST'; 

// Define a type for a single step group inside expenses
interface ExpenseStepGroup {
    stepName: string;
    expenses: Expense[];
    totalStepAmount: number;
}

// Define a type for material groups (for Material tab and Reports)
interface MaterialStepGroup {
  stepName: string;
  stepId: string;
  materials: Material[];
}


/** =========================
 * UI helpers
 * ========================= */
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');

const surface =
  "bg-white border border-slate-200/90 shadow-card-default ring-1 ring-black/5 " +
  "dark:bg-slate-900/70 dark:border-slate-800 dark:shadow-card-dark-subtle dark:ring-0";

const card = "rounded-3xl p-6 lg:p-8";
const mutedText = "text-slate-500 dark:text-slate-400";

const formatDateDisplay = (dateStr: string | null) => { // Updated to accept null
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

// Helper para formatar valores monetários (apenas para exibição estática)
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

// NEW: Type for status details for Steps, Materials, Expenses
interface StatusDetails {
  statusText: string;
  bgColor: string; // For status button/badge background
  textColor: string; // For status text
  borderColor: string; // For card border
  shadowClass: string; // For card shadow
  icon: string; // For status button/badge icon
}

// NEW: Helper function to get status details for Steps, Materials, and Expenses
const getEntityStatusDetails = (
  entityType: 'step' | 'material' | 'expense',
  entity: Step | Material | Expense,
  allSteps: Step[] // Needed for material delay calculation
): StatusDetails => {
  let statusText = '';
  let bgColor = 'bg-slate-400'; // Default gray for pending/not started
  let textColor = 'text-white'; // Always white for badges
  let borderColor = 'border-slate-200 dark:border-slate-700';
  let shadowClass = 'shadow-slate-400/20'; // Custom shadow for status (using /20 opacity suffix)
  let icon = 'fa-hourglass-start';

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  if (entityType === 'step') {
    const step = entity as Step;

    switch (step.status) {
      case StepStatus.COMPLETED:
        statusText = 'Concluído';
        bgColor = 'bg-green-500';
        textColor = 'text-white'; // Always white for badges
        borderColor = 'border-green-400 dark:border-green-700';
        shadowClass = 'shadow-green-500/20';
        icon = 'fa-check';
        break;
      case StepStatus.IN_PROGRESS:
        statusText = 'Em Andamento';
        bgColor = 'bg-amber-500';
        textColor = 'text-white';
        borderColor = 'border-amber-400 dark:border-amber-700';
        shadowClass = 'shadow-amber-500/20';
        icon = 'fa-hourglass-half';
        break;
      case StepStatus.DELAYED: // Now a direct status
        statusText = 'Atrasado';
        bgColor = 'bg-red-500';
        textColor = 'text-white';
        borderColor = 'border-red-400 dark:border-red-700';
        shadowClass = 'shadow-red-500/20';
        icon = 'fa-exclamation-triangle';
        break;
      case StepStatus.PENDING: // RENOMEADO: De NOT_STARTED para PENDING
      default:
        statusText = 'Pendente';
        bgColor = 'bg-slate-500'; // Darker gray for pending to stand out
        textColor = 'text-white';
        borderColor = 'border-slate-300 dark:border-slate-700';
        shadowClass = 'shadow-slate-500/20';
        icon = 'fa-hourglass-start';
        break;
    }
  } else if (entityType === 'material') {
    const material = entity as Material;
    const associatedStep = allSteps.find(s => s.id === material.stepId);

    // Material Delay Logic: "Quando faltar 3 dias para a etapa iniciar e material não estiver concluído"
    // This logic directly mirrors _getMaterialDerivedStatus in db.ts
    let isDelayed = false;
    let materialIsComplete = false;
    let materialIsPartial = false;
    let materialIsPending = false;

    if (material.plannedQty === 0) {
        materialIsComplete = true; // No material planned, so considered complete
    } else if (material.purchasedQty >= material.plannedQty) {
        materialIsComplete = true;
    } else if (material.purchasedQty > 0) {
        materialIsPartial = true;
    } else {
        materialIsPending = true; // purchasedQty is 0 and plannedQty > 0
    }

    if (!materialIsComplete && associatedStep && associatedStep.startDate) {
        const stepStartDate = new Date(associatedStep.startDate);
        stepStartDate.setHours(0, 0, 0, 0);
        
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(today.getDate() + 3);
        threeDaysFromNow.setHours(0, 0, 0, 0);

        isDelayed = (stepStartDate <= threeDaysFromNow);
    }

    // Determine status based on derived flags
    if (isDelayed && !materialIsComplete) { // Only delayed if not already complete
      statusText = 'Atrasado';
      bgColor = 'bg-red-500';
      textColor = 'text-white';
      borderColor = 'border-red-400 dark:border-red-700';
      shadowClass = 'shadow-red-500/20';
      icon = 'fa-exclamation-triangle';
    } else if (materialIsComplete) {
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      textColor = 'text-white';
      borderColor = 'border-green-400 dark:border-green-700';
      shadowClass = 'shadow-green-500/20';
      icon = 'fa-check';
    } else if (materialIsPartial) {
      statusText = 'Parcial';
      bgColor = 'bg-amber-500';
      textColor = 'text-white';
      borderColor = 'border-amber-400 dark:border-amber-700';
      shadowClass = 'shadow-amber-500/20';
      icon = 'fa-hourglass-half';
    } else if (materialIsPending) {
      statusText = 'Pendente';
      bgColor = 'bg-slate-500';
      textColor = 'text-white';
      borderColor = 'border-slate-300 dark:border-slate-700';
      shadowClass = 'shadow-slate-500/20';
      icon = 'fa-hourglass-start';
    }
  } else if (entityType === 'expense') {
    // MODIFICADO: Usa o novo ExpenseStatus derivado
    const expense = entity as Expense;

    switch (expense.status) {
      case ExpenseStatus.COMPLETED:
        statusText = 'Concluído';
        bgColor = 'bg-green-500';
        textColor = 'text-white';
        borderColor = 'border-green-400 dark:border-green-700';
        shadowClass = 'shadow-green-500/20';
        icon = 'fa-check';
        break;
      case ExpenseStatus.PARTIAL:
        statusText = 'Parcial';
        bgColor = 'bg-amber-500';
        textColor = 'text-white';
        borderColor = 'border-amber-400 dark:border-amber-700';
        shadowClass = 'shadow-amber-500/20';
        icon = 'fa-hourglass-half';
        break;
      case ExpenseStatus.PENDING:
        statusText = 'Pendente';
        bgColor = 'bg-slate-500';
        textColor = 'text-white';
        borderColor = 'border-slate-300 dark:border-slate-700';
        shadowClass = 'shadow-slate-500/20';
        icon = 'fa-hourglass-start';
        break;
      case ExpenseStatus.OVERPAID:
        statusText = 'Prejuízo'; // NOVO STATUS
        bgColor = 'bg-red-500';
        textColor = 'text-white';
        borderColor = 'border-red-400 dark:border-red-700';
        shadowClass = 'shadow-red-500/20';
        icon = 'fa-sack-xmark'; // Ícone para prejuízo
        break;
      default:
        statusText = 'Desconhecido';
        bgColor = 'bg-slate-500';
        textColor = 'text-white';
        borderColor = 'border-slate-300 dark:border-slate-700';
        shadowClass = 'shadow-slate-500/20';
        icon = 'fa-question';
        break;
    }
  }

  return { statusText, bgColor, textColor, borderColor, shadowClass, icon };
};

// NEW: Helper for WorkStatus colors
const getWorkStatusDetails = (status: WorkStatus): { text: string; bgColor: string; textColor: string } => {
  switch (status) {
    case WorkStatus.COMPLETED: return { text: 'Concluída', bgColor: 'bg-green-500', textColor: 'text-white' };
    case WorkStatus.IN_PROGRESS: return { text: 'Em Andamento', bgColor: 'bg-amber-500', textColor: 'text-white' };
    case WorkStatus.PAUSED: return { text: 'Pausada', bgColor: 'bg-blue-500', textColor: 'text-white' };
    case WorkStatus.PLANNING: return { text: 'Planejamento', bgColor: 'bg-slate-500', textColor: 'text-white' };
    default: return { text: 'Desconhecido', bgColor: 'bg-slate-400', textColor: 'text-white' };
  }
};


// NEW: ToolCard Component
interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  isLocked?: boolean;
  requiresVitalicio?: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ icon, title, description, onClick, isLocked, requiresVitalicio }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLocked}
      className={cx(
        surface,
        "p-5 rounded-2xl flex flex-col items-center text-center gap-3 cursor-pointer hover:scale-[1.005] transition-transform relative group",
        isLocked ? "opacity-60 cursor-not-allowed" : ""
      )}
      aria-label={title}
    >
      {isLocked && (
        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center z-10">
          <i className="fa-solid fa-lock text-white text-3xl opacity-80"></i>
        </div>
      )}
      <div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xl shrink-0 group-hover:bg-secondary/20 transition-colors">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <h3 className="font-bold text-primary dark:text-white text-lg leading-tight">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {requiresVitalicio && (
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1 uppercase tracking-wider">
          <i className="fa-solid fa-crown mr-1"></i> Acesso Vitalício
        </span>
      )}
    </button>
  );
};

// NEW: ToolSubViewHeader Component
interface ToolSubViewHeaderProps {
  title: string;
  onBack: () => void;
  onAdd?: () => void; // Optional add button
  loading?: boolean; // NEW: For local loading spinner (e.g., when adding an item)
}

const ToolSubViewHeader: React.FC<ToolSubViewHeaderProps> = ({ title, onBack, onAdd, loading }) => {
  return (
    <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label={`Voltar para ${title}`}
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <h2 className="text-2xl font-black text-primary dark:text-white">{title}</h2>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          disabled={loading} // Disable if loading
          className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          aria-label={`Adicionar novo item em ${title}`}
        >
          {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
          Novo
        </button>
      )}
    </div>
  );
};

// EXPORT WorkDetailProps so it can be imported and used for type casting in App.tsx
export interface WorkDetailProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

/** =========================
 * WorkDetail
 * ========================= */
const WorkDetail: React.FC<WorkDetailProps> = ({ activeTab, onTabChange }) => {
  const { id: workId } = ReactRouter.useParams<{ id: string }>();
  const navigate = ReactRouter.useNavigate();
  const location = ReactRouter.useLocation();
  const { user, isSubscriptionValid, authLoading, isUserAuthFinished, refreshUser, trialDaysRemaining } = useAuth();
  const [searchParams] = ReactRouter.useSearchParams();

  // NEW: Calculate AI access for tool access
  const isVitalicio = user?.plan === PlanType.VITALICIO;
  const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
  const hasAiAccess = isVitalicio || isAiTrialActive;

  const [work, setWork] = useState<Work | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [photos, setPhotos] = useState<WorkPhoto[]>([]);
  const [files, setFiles] = useState<WorkFile[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);

  const [loading, setLoading] = useState(true);
  // REMOVED: `activeTab` from useState, it's now a prop
  const [activeSubView, setActiveSubView] = useState<SubView>('NONE');

  // States for Material Filter
  const [materialFilterStepId, setMaterialFilterStepId] = useState('all');

  // New item states
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepStartDate, setNewStepStartDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
  const [newStepEndDate, setNewStepEndDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
  const [newEstimatedDurationDays, setNewEstimatedDurationDays] = useState(''); // NEW: For estimated duration
  const [editStepData, setEditStepData] = useState<Step | null>(null);
  // State for drag and drop
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);
  const [isUpdatingStepStatus, setIsUpdatingStepStatus] = useState(false); // NEW: Step status loading

  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialBrand, setNewMaterialBrand] = useState(''); // NEW: State for material brand
  const [newMaterialPlannedQty, setNewMaterialPlannedQty] = useState(''); // Raw string for quantity input
  const [newMaterialUnit, setNewMaterialUnit] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState('');
  const [newMaterialStepId, setNewMaterialStepId] = useState('');
  const [editMaterialData, setEditMaterialData] = useState<Material | null>(null);
  // NEW: States for material purchase *within* the edit modal (these replace the old currentPurchaseQty/Cost states)
  const [purchaseQtyInput, setPurchaseQtyInput] = useState('');
  // Fixing error: `setNewMaterialCost` is not defined. It should be `setPurchaseCostInput`.
  const [purchaseCostInput, setPurchaseCostInput] = useState('');


  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState(''); // Raw string for monetary input
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory | string>(ExpenseCategory.OTHER);
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpenseStepId, setNewExpenseStepId] = useState('');
  // NEW: States for worker and supplier linking in expense modal
  const [newExpenseWorkerId, setNewExpenseWorkerId] = useState('');
  const [newExpenseSupplierId, setNewExpenseSupplierId] = useState('');
  const [editExpenseData, setEditExpenseData] = useState<Expense | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentExpenseData, setPaymentExpenseData] = useState<Expense | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(''); // Raw string for monetary input
  const [paymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  // FIX: Renamed `newExpenseTotalAgued` to `newExpenseTotalAgreed`
  const [newExpenseTotalAgreed, setNewExpenseTotalAgreed] = useState<string>(''); // Raw string for monetary input


  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [newWorkerDailyRate, setNewWorkerDailyRate] = useState(''); // Raw string for monetary input
  const [newWorkerNotes, setNewWorkerNotes] = useState('');
  const [editWorkerData, setEditWorkerData] = useState<Worker | null>(null);
  const [isAddingWorker, setIsAddingWorker] = useState(false); // NEW: Local loading state

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');
  const [editSupplierData, setEditSupplierData] = useState<Supplier | null>(null);
  const [isAddingSupplier, setIsAddingSupplier] = useState(false); // NEW: Local loading state

  const [showAddPhotoModal, setShowAddPhotoModal] = useState(false);
  const [newPhotoDescription, setNewPhotoDescription] = useState('');
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null); // Corrected useState syntax
  const [newPhotoType, setNewPhotoType] = useState<'BEFORE' | 'AFTER' | 'PROGRESS'>('PROGRESS');
  const [uploadingPhoto, setLoadingPhoto] = useState(false);

  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState<FileCategory>(FileCategory.GENERAL);
  const [newUploadFile, setNewUploadFile] = useState<File | null>(null);
  const [uploadingFile, setLoadingFile] = useState(false);

  const [showAddChecklistModal, setShowAddChecklistModal] = useState(false);
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newChecklistCategory, setNewChecklistCategory] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<string[]>(['']);
  const [editChecklistData, setEditChecklistData] = useState<Checklist | null>(null);
  const [isAddingChecklist, setIsAddingChecklist] = useState(false); // NEW: Local loading state

  const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string, isConfirming?: boolean }>({
    isOpen: false, title: '', message: '', onCancel: () => { }, isConfirming: false
  });

  // NEW: State for Contract Viewer Modal
  const [showContractContentModal, setShowContractContentModal] = useState(false);
  const [selectedContractContent, setSelectedContractContent] = useState('');
  const [selectedContractTitle, setSelectedContractTitle] = useState('');
  const [copyContractSuccess, setCopyContractSuccess] = useState(false);

  // NEW: Global Toast State for general feedback
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const toastTimeoutRef = useRef<number | null>(null);

  // NEW: State for "Atualizado automaticamente" badge on Financeiro tab
  const [showFinanceUpdateBadge, setShowFinanceUpdateBadge] = useState(false);
  const financeBadgeTimeoutRef = useRef<number | null>(null);


  // =======================================================================
  // AUXILIARY FUNCTIONS
  // =======================================================================

  // NEW: Function to show a toast message
  const showToastNotification = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
      toastTimeoutRef.current = null;
    }, 3000) as unknown as number; // Type assertion for setTimeout return type
  }, []);

  // NEW: Function to show finance update badge
  const showFinanceBadge = useCallback(() => {
    if (financeBadgeTimeoutRef.current) {
      clearTimeout(financeBadgeTimeoutRef.current);
    }
    setShowFinanceUpdateBadge(true);
    financeBadgeTimeoutRef.current = setTimeout(() => {
      setShowFinanceUpdateBadge(false);
      financeBadgeTimeoutRef.current = null;
    }, 2000) as unknown as number; // Type assertion for setTimeout return type
  }, []);


  const goToTab = useCallback((tab: MainTab) => {
    onTabChange(tab); // Use the prop to update activeTab in App.tsx
    setActiveSubView('NONE');
    setMaterialFilterStepId('all');
    navigate(`/work/${workId}?tab=${tab}`, { replace: true }); // Update URL for consistent navigation
  }, [workId, navigate, onTabChange]);

  const goToSubView = useCallback((subView: SubView) => {
    setActiveSubView(subView);
  }, []);

  const getDayDifference = (date1: string, date2: string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateStepProgress = useCallback((stepId: string): number => {
    const totalMaterialsForStep = materials.filter(m => m.stepId === stepId);
    if (totalMaterialsForStep.length === 0) return 0; // No materials, no progress

    const totalPlannedQty = totalMaterialsForStep.reduce((sum, m) => sum + m.plannedQty, 0);
    const totalPurchasedQty = totalMaterialsForStep.reduce((sum, m) => sum + m.purchasedQty, 0);

    return totalPlannedQty > 0 ? (totalPurchasedQty / totalPlannedQty) * 100 : (totalPurchasedQty > 0 ? 100 : 0); // If planned is 0 but purchased > 0, consider it 100%
  }, [materials]);

  const calculateTotalExpenses = useMemo(() => {
    // 🔥 MODIFICADO: Excluir despesas de material do total gasto para o cálculo de progresso financeiro principal
    // Agora o expense.paidAmount é derivado, o que o torna a soma das parcelas pagas.
    return expenses.filter(expense => expense.category !== ExpenseCategory.MATERIAL).reduce((sum, expense) => sum + (expense.paidAmount || 0), 0);
  }, [expenses]);

  const totalOutstandingExpenses = useMemo(() => {
    // Sum of (totalAgreed - paidAmount) for all non-completed expenses
    return expenses.reduce((sum, expense) => {
      const agreed = expense.totalAgreed !== undefined && expense.totalAgreed !== null ? expense.totalAgreed : expense.amount;
      const paid = expense.paidAmount || 0;
      return sum + Math.max(0, agreed - paid);
    }, 0);
  }, [expenses]);

  const budgetUsage = useMemo(() =>
    work && work.budgetPlanned > 0 ? (calculateTotalExpenses / work.budgetPlanned) * 100 : 0
  , [work, calculateTotalExpenses]);

  // NEW: Grouped and filtered materials for UI
  const groupedMaterials = useMemo<MaterialStepGroup[]>(() => {
    // Filter materials by selected step if not 'all'
    const filteredMaterials = materialFilterStepId === 'all'
      ? materials
      : materials.filter(m => m.stepId === materialFilterStepId);

    const groups: { [key: string]: Material[] } = {};
    const stepOrder: string[] = [];

    // Ensure steps are sorted by orderIndex
    const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

    // Group materials by step, preserving step order
    sortedSteps.forEach(step => {
      const materialsForStep = filteredMaterials.filter(m => m.stepId === step.id);
      if (materialsForStep.length > 0) {
        groups[step.id] = materialsForStep.sort((a, b) => a.name.localeCompare(b.name));
        stepOrder.push(step.id);
      }
    });

    return stepOrder.map(stepId => ({
      stepName: `${sortedSteps.find(s => s.id === stepId)?.orderIndex}. ${sortedSteps.find(s => s.id === stepId)?.name || 'Sem Etapa'}`,
      stepId: stepId,
      materials: groups[stepId] || [],
    }));
  }, [materials, steps, materialFilterStepId]);

  // NEW: Grouped expenses for UI (by step)
  const groupedExpensesByStep = useMemo<ExpenseStepGroup[]>(() => {
    const groups: { [key: string]: Expense[] } = {};
    expenses.forEach(expense => {
      const stepKey = expense.stepId || 'no_step'; // Group by stepId or 'no_step'
      if (!groups[stepKey]) {
        groups[stepKey] = [];
      }
      groups[stepKey].push(expense);
    });

    const expenseGroups: ExpenseStepGroup[] = [];

    // Ensure steps are sorted by orderIndex
    const sortedSteps = [...steps].
      sort((a, b) => a.orderIndex - b.orderIndex);

    // Add expenses linked to steps, in step order
    sortedSteps.forEach(step => {
      if (groups[step.id]) {
        expenseGroups.push({
          stepName: `${step.orderIndex}. ${step.name}`,
          expenses: groups[step.id].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          totalStepAmount: groups[step.id].reduce((sum, exp) => sum + (exp.amount || 0), 0), // Use amount here for planned
        });
      }
    });

    // Add expenses not linked to any specific step (e.g., 'no_step')
    if (groups['no_step']) {
      expenseGroups.push({
        stepName: 'Sem Etapa Definida', // Label for expenses not linked to any step
        expenses: groups['no_step'].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        totalStepAmount: groups['no_step'].reduce((sum, exp) => sum + (exp.amount || 0), 0),
      });
    }

    return expenseGroups;
  }, [expenses, steps]);

  // NEW: Helper to render material progress bar
  const renderMaterialProgressBar = (material: Material) => {
    const progressPct = material.plannedQty > 0
      ? (material.purchasedQty / material.plannedQty) * 100
      : (material.purchasedQty > 0 ? 100 : 0); // If planned is 0 but purchased > 0, it's 100%

    const progressBarColor = progressPct === 100 ? 'bg-green-500' : 'bg-secondary';

    return (
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
        <div 
          className={cx("h-full rounded-full", progressBarColor, "transition-all duration-500")} 
          style={{ width: `${progressPct}%` }}
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progresso: ${Math.round(progressPct)}%`}
        ></div>
      </div>
    );
  };

  // NEW: Helper to render expense progress bar
  const renderExpenseProgressBar = (expense: Expense) => {
    const agreedAmount = expense.totalAgreed !== undefined && expense.totalAgreed !== null ? expense.totalAgreed : expense.amount;
    const paidAmount = expense.paidAmount || 0;
    const progressPct = agreedAmount > 0 ? (paidAmount / agreedAmount) * 100 : (paidAmount > 0 ? 100 : 0);
    const progressBarColor = progressPct >= 100 ? 'bg-green-500' : 'bg-secondary';
    const isOverpaid = expense.status === ExpenseStatus.OVERPAID;

    return (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-1">
            <div
                className={cx("h-full rounded-full", isOverpaid ? 'bg-red-500' : progressBarColor, "transition-all duration-500")}
                style={{ width: `${Math.min(100, progressPct)}%` }} // Cap at 100% visually
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progresso de pagamento: ${Math.round(progressPct)}%`}
            ></div>
        </div>
    );
  };

  // =======================================================================
  // DATA LOADING
  // =======================================================================

  const loadWorkData = useCallback(async (): Promise<void> => { // Explicitly set return type to void
    if (!workId || !user?.id) {
      // These redirects are handled by the component's main render logic now.
      setLoading(false);
      return; // Return void here
    }

    setLoading(true);
    try {
      const fetchedWork = await dbService.getWorkById(workId);
      // Check if work exists and belongs to the user
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        setWork(null); // Explicitly set work to null if not found or not owned
        return; // This will trigger the "Obra não encontrada" block after loading is false
      }
      setWork(fetchedWork);

      const [fetchedSteps, fetchedMaterials, fetchedExpenses, fetchedWorkers, fetchedSuppliers, fetchedPhotos, fetchedFiles, fetchedContracts, fetchedChecklists] = await Promise.all([
        dbService.getSteps(workId),
        dbService.getMaterials(workId),
        dbService.getExpenses(workId),
        dbService.getWorkers(workId),
        dbService.getSuppliers(workId),
        dbService.getPhotos(workId),
        dbService.getFiles(workId),
        dbService.getContractTemplates(), // Contracts are global
        dbService.getChecklists(workId),
      ]);

      // NEW CRITICAL STEP: Ensure materials are generated if none exist after fetching work and steps
      await dbService.ensureMaterialsForWork(fetchedWork, fetchedSteps);

      // After ensuring materials (and potentially generating them),
      // we need to re-fetch the materials to ensure the state is up-to-date.
      const currentMaterials = await dbService.getMaterials(workId);
      setMaterials(currentMaterials);

      // 🔥 CRITICAL: Steps no longer store `isDelayed` explicitly in DB. Status is derived.
      // The `dbService.getSteps` now returns steps with `status` already calculated.
      setSteps(fetchedSteps.sort((a, b) => a.orderIndex - b.orderIndex)); // Ensure sorted by orderIndex

      setExpenses(fetchedExpenses);
      setWorkers(fetchedWorkers);
      setSuppliers(fetchedSuppliers);
      setPhotos(fetchedPhotos);
      setFiles(fetchedFiles);
      setContracts(fetchedContracts);
      setChecklists(fetchedChecklists);

    } catch (error: any) {
      console.error("Erro ao carregar dados da obra:", error);
      // Show ZeModal for loading error
      setZeModal({
        isOpen: true,
        title: "Erro de Carregamento",
        message: `Tivemos um problema ao carregar os dados da obra. Por favor, tente novamente.`,
        type: "ERROR",
        confirmText: "Tentar Novamente", // Renamed for better UX
        onConfirm: async (_e?: React.FormEvent) => {
            setZeModal(p => ({ ...p, isOpen: false })); 
            await loadWorkData(); // Retry loading
        }, 
        onCancel: async (_e?: React.FormEvent) => {
            setZeModal(p => ({ ...p, isOpen: false })); 
            navigate('/dashboard');
        }, // Go to dashboard on cancel
        cancelText: "Voltar para Dashboard" // Renamed for better UX
      });
      setWork(null); // Ensure work is null on error to show not found
      return; // Explicitly return void on error
    } finally {
      setLoading(false);
    }
  }, [workId, user, navigate]);

  useEffect(() => {
    if (!authLoading && isUserAuthFinished) {
      loadWorkData();
      // Read initial tab from URL on first load
      const tabFromUrl = searchParams.get('tab') as MainTab;
      if (tabFromUrl && ['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'].includes(tabFromUrl)) {
        onTabChange(tabFromUrl); // Update parent state from URL
      }
    }
  }, [authLoading, isUserAuthFinished, loadWorkData, searchParams, onTabChange]);

  // =======================================================================
  // CRUD HANDLERS: STEPS
  // =======================================================================

  // NEW: Handle Step Status Change (Pendente -> Parcial -> Concluída -> Pendente)
  const handleStepStatusChange = useCallback(async (step: Step) => {
    if (isUpdatingStepStatus) {
        console.log(`[handleStepStatusChange] Button disabled, preventing multiple clicks for step ${step.id}.`);
        return; // Prevent multiple clicks
    }

    console.log(`[handleStepStatusChange] Processing step ID: ${step.id}. Current Step Object:`, { ...step });
    setIsUpdatingStepStatus(true);

    let newRealDate: string | null = null; // Will be mapped to NULL in DB if null

    // 🔥 CRITICAL: Status is now fully derived from `realDate` and `start/end dates`.
    // The UI only sets `realDate` to affect the derived status.
    // The cycle should be: (PENDING / IN_PROGRESS / DELAYED) -> COMPLETED -> PENDING
    // If it's already COMPLETED, then it reverts to PENDING (and clears realDate).
    // If it's anything else, it goes to COMPLETED (and sets realDate).

    if (step.status === StepStatus.COMPLETED) {
        newRealDate = null; // Clear realDate
        console.log(`[handleStepStatusChange] Status transition: COMPLETED -> PENDING for step ${step.id}. Clearing RealDate.`);
    } else {
        newRealDate = new Date().toISOString().split('T')[0]; // Set real completion date
        console.log(`[handleStepStatusChange] Status transition: ${step.status} -> COMPLETED for step ${step.id}. RealDate: ${newRealDate}.`);
    }

    try {
      const updatedStepData: Step = {
        ...step, // Spread all existing properties
        // status property should NOT be directly set here. It's derived by the backend.
        // realDate should be passed directly as it's the trigger for status change.
        realDate: newRealDate,
      };

      // 🔥 CRITICAL: The `dbService.updateStep` will enforce immutability and recalculate `status`
      // based on `realDate` and other dates. We are NOT sending `isDelayed`.
      await dbService.updateStep(updatedStepData);
      console.log(`[handleStepStatusChange] dbService.updateStep successful for step ${step.id}.`);
      console.log(`[handleStepStatusChange] Data reloaded after status update for step ${step.id}.`);
      await loadWorkData();
      showToastNotification(`Status da etapa "${step.name}" atualizado para ${newRealDate ? 'Concluído' : 'Pendente'}.`, 'success');
    } catch (error: any) {
      console.error(`[handleStepStatusChange] Erro ao alterar status da etapa ${step.id}:`, error);
      showToastNotification(`Erro ao atualizar status da etapa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Atualizar Status",
        message: `Não foi possível atualizar o status da etapa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      });
    } finally {
      setIsUpdatingStepStatus(false);
      console.log(`[handleStepStatusChange] Finalized status update for step ${step.id}. isUpdatingStepStatus set to false.`);
    }
  }, [loadWorkData, isUpdatingStepStatus, showToastNotification]);

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (!workId || !newStepName) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // Fix: orderIndex is omitted from the input type because it's calculated internally by dbService.addStep
      // 🔥 CRITICAL: Only provide fields that are persisted, `status` is derived.
      await dbService.addStep({
        workId: workId,
        name: newStepName,
        startDate: newStepStartDate,
        endDate: newStepEndDate,
        realDate: null, // FIX: realDate must be explicitly set to null for new steps
        estimatedDurationDays: Number(newEstimatedDurationDays) || undefined, // NEW
        // orderIndex is omitted here as dbService.addStep generates it
      });
      setShowAddStepModal(false);
      setNewStepName('');
      setNewStepStartDate(new Date().toISOString().split('T')[0]);
      setNewStepEndDate(new Date().toISOString().split('T')[0]);
      setNewEstimatedDurationDays(''); // Clear for new
      await loadWorkData();
      showToastNotification(`Etapa "${newStepName}" adicionada com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar etapa:", error);
      showToastNotification(`Erro ao adicionar etapa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Etapa",
        message: `Não foi possível adicionar a etapa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditStep = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (!editStepData || !workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // 🔥 CRITICAL: The `dbService.updateStep` will enforce immutability and recalculate `status`
      // based on `realDate` and other dates. We are NOT sending `isDelayed`.
      await dbService.updateStep({
        ...editStepData!,
        name: newStepName,
        startDate: newStepStartDate,
        endDate: newStepEndDate,
        estimatedDurationDays: Number(newEstimatedDurationDays) || undefined, // NEW
        // `status` and `realDate` will be managed by `handleStepStatusChange` for status updates
        // and by the backend's `_calculateStepStatus` for derivation.
        // We ensure `realDate` is preserved here if it exists.
        realDate: editStepData.realDate,
      });
      setEditStepData(null);
      setShowAddStepModal(false); // Close the modal
      await loadWorkData();
      showToastNotification(`Etapa "${newStepName}" atualizada com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao editar etapa:", error);
      showToastNotification(`Erro ao editar etapa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Etapa",
        message: `Não foi possível editar a etapa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!workId) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteStep(stepId, workId); // Backend will throw error if step is started
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false })); // Close the modal after successful deletion
      showToastNotification("Etapa excluída com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao deletar etapa:", error);
      showToastNotification(`Erro ao deletar etapa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Etapa",
        message: `Não foi possível deletar a etapa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // Drag and drop handlers for steps
  const handleDragStart = (e: React.DragEvent, stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (step?.startDate) { // 🔥 CRITICAL: Prevent dragging a started step
        e.preventDefault();
        setZeModal({
            isOpen: true,
            title: "Etapa Iniciada",
            message: "Não é possível reordenar uma etapa que já foi iniciada.",
            confirmText: "Entendido",
            // FIX: Add `_e?: React.FormEvent` to match ZeModalProps.onConfirm signature.
            onConfirm: async (_e?: React.FormEvent) => {setZeModal(prev => ({ ...prev, isOpen: false }));},
            onCancel: async (_e?: React.FormEvent) => {setZeModal(prev => ({ ...prev, isOpen: false }));}, // Fix: Ensure onCancel matches signature
            type: "WARNING"
        }); // Corrected: Added missing closing parenthesis here
        return;
    }
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stepId); // Required for Firefox
  };

  const handleDragOver = (e: React.DragEvent, stepId: string) => {
    e.preventDefault(); // Allow drop
    // 🔥 CRITICAL: Prevent dragging over a started step as well if it causes reorder
    const targetStep = steps.find(s => s.id === stepId);
    if (targetStep?.startDate) {
      setDragOverStepId(null); // Do not highlight if target is started
      return;
    }
    setDragOverStepId(stepId);
  };

  const handleDragLeave = () => {
    setDragOverStepId(null);
  };

  const handleDrop = useCallback(async (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    if (!draggedStepId || !workId || draggedStepId === targetStepId) {
      setDragOverStepId(null);
      return;
    }

    const newStepsOrder = Array.from(steps);
    // Fix: Explicitly type 's' in the findIndex callback to resolve 'Property 'id' does not exist on type 'unknown'.'
    const draggedIndex = newStepsOrder.findIndex((s: Step) => s.id === draggedStepId);
    // Fix: Explicitly type 's' in the findIndex callback to resolve 'Property 'id' does not exist on type 'unknown'.'
    const targetIndex = newStepsOrder.findIndex((s: Step) => s.id === targetStepId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDragOverStepId(null);
      return;
    }

    // Move the dragged item
    const [reorderedItem] = newStepsOrder.splice(draggedIndex, 1);
    newStepsOrder.splice(targetIndex, 0, reorderedItem);

    // Update orderIndex for all steps
    const updatedSteps = newStepsOrder.map((step, index) => ({
      ...step,
      orderIndex: index + 1,
    }));

    setLoading(true);
    try {
      // Send updates to the database in parallel
      await Promise.all(updatedSteps.map(step => dbService.updateStep(step))); // Backend will validate immutability
      await loadWorkData(); // Refresh data to ensure consistency
      showToastNotification("Etapas reordenadas com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao reordenar etapas:", error);
      showToastNotification(`Erro ao reordenar etapas: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Reordenar Etapas",
        message: `Não foi possível reordenar as etapas: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      });
    } finally {
      setDraggedStepId(null);
      setDragOverStepId(null);
      setLoading(false);
    }
  }, [draggedStepId, steps, workId, loadWorkData, setLoading, setDraggedStepId, setDragOverStepId, setZeModal, showToastNotification]);

  // NEW: Handler for generating materials (when empty state button is clicked)
  const handleGenerateMaterials = useCallback(async () => {
    if (!work || !steps.length) {
      setZeModal({
        isOpen: true,
        title: "Erro na Geração",
        message: "Não é possível gerar materiais sem dados da obra ou etapas existentes. Por favor, cadastre ao menos uma etapa.",
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      });
      return;
    }

    setLoading(true); // General loading for the page
    setZeModal(prev => ({ ...prev, isConfirming: true })); // Activates modal spinner if modal is open. If not, this state is just internal.

    try {
      // This will delete existing materials and then insert new ones based on work and steps.
      // This matches the `ensureMaterialsForWork` behavior.
      await dbService.regenerateMaterials(work, steps);
      await loadWorkData(); // Reload all data to reflect new materials
      setZeModal(prev => ({ ...prev, isOpen: false })); // Close modal if it was open
      showToastNotification("Lista de materiais gerada com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao gerar lista de materiais:", error);
      showToastNotification(`Erro ao gerar materiais: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro na Geração",
        message: `Não foi possível gerar a lista de materiais: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setLoading(false); // Deactivate general page loading
      setZeModal(prev => ({ ...prev, isConfirming: false })); // Deactivate modal spinner
    }
  }, [work, steps, loadWorkData, showToastNotification]);


  // =======================================================================
  // CRUD HANDLERS: MATERIALS
  // =======================================================================

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newMaterialName || !newMaterialPlannedQty || !newMaterialUnit) {
      showToastNotification("Por favor, preencha todos os campos obrigatórios do material.", 'warning');
      return;
    }

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // FIX: Pass user.id as the first argument
      await dbService.addMaterial(user.id, {
        workId: workId,
        name: newMaterialName,
        brand: newMaterialBrand, // NEW: Pass brand
        plannedQty: Number(newMaterialPlannedQty), // Quantity is not monetary
        purchasedQty: 0,
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
      });
      setShowAddMaterialModal(false);
      setNewMaterialName('');
      setNewMaterialBrand(''); // Clear brand for new material
      setNewMaterialPlannedQty('');
      setNewMaterialUnit('');
      setNewMaterialCategory('');
      setNewMaterialStepId('');
      setPurchaseQtyInput(''); // Clear temporary purchase inputs
      setPurchaseCostInput(''); // Clear temporary purchase inputs
      await loadWorkData();
      showToastNotification(`Material "${newMaterialName}" adicionado com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar material:", error);
      showToastNotification(`Erro ao adicionar material: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Material",
        message: `Não foi possível adicionar o material: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMaterialData || !workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const qtyToRegister = Number(purchaseQtyInput);
      const costToRegister = Number(purchaseCostInput);

      // 1. Update the material's descriptive properties
      // dbService.updateMaterial will validate and prevent changes to key fields if already purchased
      await dbService.updateMaterial({
        ...editMaterialData, // All original data
        name: newMaterialName,
        brand: newMaterialBrand,
        plannedQty: Number(newMaterialPlannedQty),
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
        // purchasedQty and totalCost are derived and handled by registerMaterialPurchase,
        // so we pass the original values here and update them only via purchase registration.
        // dbService.updateMaterial will ignore them anyway for consistency if a purchase exists.
        purchasedQty: editMaterialData.purchasedQty,
        totalCost: editMaterialData.totalCost,
      });

      // 2. If new purchase quantities are provided, register the purchase
      if (qtyToRegister > 0 && costToRegister >= 0) {
        await dbService.registerMaterialPurchase(
          editMaterialData.id,
          newMaterialName, // Use potentially updated name
          newMaterialBrand, // Use potentially updated brand
          Number(newMaterialPlannedQty), // Use potentially updated plannedQty
          newMaterialUnit, // Use potentially updated unit
          qtyToRegister,
          costToRegister
        );
        setPurchaseQtyInput(''); // Clear temporary purchase inputs
        setPurchaseCostInput('');
      }

      setEditMaterialData(null);
      setShowAddMaterialModal(false); // Close the modal
      await loadWorkData();
      showToastNotification(`Material "${newMaterialName}" atualizado e/ou compra registrada com sucesso!`, 'success');
      showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao editar material ou registrar compra:", error);
      showToastNotification(`Erro na operação de material: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro na Operação",
        message: `Não foi possível completar a operação: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteMaterial(materialId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false })); // Close the modal after successful deletion
      showToastNotification("Material excluído com sucesso!", 'success');
      showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao deletar material:", error);
      showToastNotification(`Erro ao deletar material: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Material",
        message: `Não foi possível deletar o material: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // REMOVED handleRegisterMaterialPurchase as it's now integrated

  // =======================================================================
  // CRUD HANDLERS: EXPENSES
  // =======================================================================

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newExpenseDescription || !newExpenseAmount || !newExpenseDate) {
        showToastNotification("Por favor, preencha todos os campos obrigatórios da despesa.", 'warning');
        return;
    }

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addExpense({
        workId: workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount), // Direct conversion
        // paidAmount e status são DERIVADOS, não passados na criação
        quantity: 1, // Default to 1 for generic expenses
        date: newExpenseDate,
        category: newExpenseCategory,
        relatedMaterialId: undefined, // Manually added expenses don't have relatedMaterialId
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        // totalAgreed defaults to amount if not explicitly provided
        // FIX: Use `newExpenseTotalAgreed` here
        totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : Number(newExpenseAmount), // Direct conversion
      });
      setShowAddExpenseModal(false);
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setNewExpenseCategory(ExpenseCategory.OTHER);
      setNewExpenseDate(new Date().toISOString().split('T')[0]);
      setNewExpenseStepId('');
      setNewExpenseWorkerId('');
      setNewExpenseSupplierId('');
      // FIX: Clear `newExpenseTotalAgreed`
      setNewExpenseTotalAgreed(''); // Clear new expense total agreed
      await loadWorkData();
      showToastNotification(`Despesa "${newExpenseDescription}" adicionada com sucesso!`, 'success');
      showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao adicionar despesa:", error);
      showToastNotification(`Erro ao adicionar despesa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Despesa",
        message: `Não foi possível adicionar a despesa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpenseData || !workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateExpense({
        ...editExpenseData,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount),
        category: newExpenseCategory,
        date: newExpenseDate,
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        // FIX: Use `newExpenseTotalAgreed` here
        totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : undefined, // Can be undefined
      });
      setEditExpenseData(null);
      setShowAddExpenseModal(false);
      await loadWorkData();
      showToastNotification(`Despesa "${newExpenseDescription}" atualizada com sucesso!`, 'success');
      showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao editar despesa:", error);
      showToastNotification(`Erro ao editar despesa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Despesa",
        message: `Não foi possível editar a despesa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteExpense(expenseId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
      showToastNotification("Despesa excluída com sucesso!", 'success');
      showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao deletar despesa:", error);
      showToastNotification(`Erro ao deletar despesa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Despesa",
        message: `Não foi possível deletar a despesa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: WORKERS
  // =======================================================================

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newWorkerName || !newWorkerRole || !newWorkerPhone) {
        showToastNotification("Por favor, preencha todos os campos obrigatórios do trabalhador.", 'warning');
        return;
    }

    setIsAddingWorker(true); // Set local loading for this action
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addWorker({
        workId: workId,
        userId: user.id,
        name: newWorkerName,
        role: newWorkerRole,
        phone: newWorkerPhone,
        dailyRate: Number(newWorkerDailyRate) || undefined,
        notes: newWorkerNotes || undefined,
      });
      setShowAddWorkerModal(false);
      setNewWorkerName('');
      setNewWorkerRole('');
      setNewWorkerPhone('');
      setNewWorkerDailyRate('');
      setNewWorkerNotes('');
      await loadWorkData();
      showToastNotification(`Trabalhador "${newWorkerName}" adicionado com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar trabalhador:", error);
      showToastNotification(`Erro ao adicionar trabalhador: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Trabalhador",
        message: `Não foi possível adicionar o trabalhador: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setIsAddingWorker(false); // Clear local loading
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorkerData || !workId || !user?.id || !newWorkerName || !newWorkerRole || !newWorkerPhone) {
        showToastNotification("Por favor, preencha todos os campos obrigatórios do trabalhador.", 'warning');
        return;
    }

    setIsAddingWorker(true); // Use same loading state for edit
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateWorker({
        ...editWorkerData,
        name: newWorkerName,
        role: newWorkerRole,
        phone: newWorkerPhone,
        dailyRate: Number(newWorkerDailyRate) || undefined,
        notes: newWorkerNotes || undefined,
      });
      setEditWorkerData(null);
      setShowAddWorkerModal(false);
      await loadWorkData();
      showToastNotification(`Trabalhador "${newWorkerName}" atualizado com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao editar trabalhador:", error);
      showToastNotification(`Erro ao editar trabalhador: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Trabalhador",
        message: `Não foi possível editar o trabalhador: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setIsAddingWorker(false);
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!workId) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteWorker(workerId, workId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
      showToastNotification("Trabalhador excluído com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao deletar trabalhador:", error);
      showToastNotification(`Erro ao deletar trabalhador: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Trabalhador",
        message: `Não foi possível deletar o trabalhador: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: SUPPLIERS
  // =======================================================================

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newSupplierName || !newSupplierCategory || !newSupplierPhone) {
        showToastNotification("Por favor, preencha todos os campos obrigatórios do fornecedor.", 'warning');
        return;
    }

    setIsAddingSupplier(true);
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addSupplier({
        workId: workId,
        userId: user.id,
        name: newSupplierName,
        category: newSupplierCategory,
        phone: newSupplierPhone,
        email: newSupplierEmail || undefined,
        address: newSupplierAddress || undefined,
        notes: newSupplierNotes || undefined,
      });
      setShowAddSupplierModal(false);
      setNewSupplierName('');
      setNewSupplierCategory('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
      setNewSupplierAddress('');
      setNewSupplierNotes('');
      await loadWorkData();
      showToastNotification(`Fornecedor "${newSupplierName}" adicionado com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar fornecedor:", error);
      showToastNotification(`Erro ao adicionar fornecedor: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Fornecedor",
        message: `Não foi possível adicionar o fornecedor: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setIsAddingSupplier(false);
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplierData || !workId || !user?.id || !newSupplierName || !newSupplierCategory || !newSupplierPhone) {
        showToastNotification("Por favor, preencha todos os campos obrigatórios do fornecedor.", 'warning');
        return;
    }

    setIsAddingSupplier(true); // Use same loading state for edit
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateSupplier({
        ...editSupplierData,
        name: newSupplierName,
        category: newSupplierCategory,
        phone: newSupplierPhone,
        email: newSupplierEmail || undefined,
        address: newSupplierAddress || undefined,
        notes: newSupplierNotes || undefined,
      });
      setEditSupplierData(null);
      setShowAddSupplierModal(false);
      await loadWorkData();
      showToastNotification(`Fornecedor "${newSupplierName}" atualizado com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao editar fornecedor:", error);
      showToastNotification(`Erro ao editar fornecedor: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Fornecedor",
        message: `Não foi possível editar o fornecedor: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setIsAddingSupplier(false);
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteSupplier = async (supplierId: string, workId: string): Promise<void> => {
    if (!workId) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteSupplier(supplierId, workId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
      showToastNotification("Fornecedor excluído com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao deletar fornecedor:", error);
      showToastNotification(`Erro ao deletar fornecedor: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Fornecedor",
        message: `Não foi possível deletar o fornecedor: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: PHOTOS
  // =======================================================================

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newPhotoDescription || !newPhotoFile) {
        showToastNotification("Por favor, preencha a descrição e selecione uma foto.", 'warning');
        return;
    }

    setLoadingPhoto(true);
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const fileExtension = newPhotoFile.name.split('.').pop();
      const filePath = `${workId}/${Date.now()}.${fileExtension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work-photos')
        .upload(filePath, newPhotoFile);

      if (uploadError) throw new Error(`Erro ao fazer upload da foto: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from('work-photos')
        .getPublicUrl(filePath);

      if (!publicUrlData || !publicUrlData.publicUrl) throw new Error("Não foi possível obter a URL pública da foto.");

      await dbService.addPhoto({
        workId: workId,
        url: publicUrlData.publicUrl,
        description: newPhotoDescription,
        date: new Date().toISOString().split('T')[0],
        type: newPhotoType,
      });

      setShowAddPhotoModal(false);
      setNewPhotoDescription('');
      setNewPhotoFile(null);
      setNewPhotoType('PROGRESS');
      await loadWorkData();
      showToastNotification("Foto adicionada com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar foto:", error);
      showToastNotification(`Erro ao adicionar foto: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Foto",
        message: `Não foi possível adicionar a foto: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setLoadingPhoto(false);
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeletePhoto = async (photo: WorkPhoto) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // Extract file path from URL
      const urlParts = photo.url.split('/');
      const filePath = urlParts.slice(urlParts.indexOf(photo.workId)).join('/');

      const { error: deleteStorageError } = await supabase.storage
        .from('work-photos')
        .remove([filePath]);

      if (deleteStorageError) console.warn("Erro ao deletar foto do storage (pode não existir):", deleteStorageError);

      await dbService.deletePhoto(photo.id);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
      showToastNotification("Foto excluída com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao deletar foto:", error);
      showToastNotification(`Erro ao deletar foto: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Foto",
        message: `Não foi possível deletar a foto: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: FILES
  // =======================================================================

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newFileName || !newUploadFile) {
        showToastNotification("Por favor, preencha o nome do arquivo e selecione o arquivo para upload.", 'warning');
        return;
    }

    setLoadingFile(true);
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const fileExtension = newUploadFile.name.split('.').pop();
      const filePath = `${workId}/files/${Date.now()}-${newFileName}.${fileExtension}`; // Subfolder for files

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work-files')
        .upload(filePath, newUploadFile);

      if (uploadError) throw new Error(`Erro ao fazer upload do arquivo: ${uploadError.message}`);

      const { data: publicUrlData } = supabase.storage
        .from('work-files')
        .getPublicUrl(filePath);

      if (!publicUrlData || !publicUrlData.publicUrl) throw new Error("Não foi possível obter a URL pública do arquivo.");

      await dbService.addFile({
        workId: workId,
        url: publicUrlData.publicUrl,
        name: newFileName,
        date: new Date().toISOString().split('T')[0],
        type: newUploadFile.type,
        category: newFileCategory,
      });

      setShowAddFileModal(false);
      setNewFileName('');
      setNewFileCategory(FileCategory.GENERAL);
      setNewUploadFile(null);
      await loadWorkData();
      showToastNotification("Arquivo adicionado com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar arquivo:", error);
      showToastNotification(`Erro ao adicionar arquivo: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Arquivo",
        message: `Não foi possível adicionar o arquivo: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setLoadingFile(false);
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteFile = async (file: WorkFile) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // Extract file path from URL
      const urlParts = file.url.split('/');
      // Assuming URL format is something like: .../storage/v1/object/public/bucket-name/workId/files/filename.ext
      // We need 'workId/files/filename.ext'
      const filePath = urlParts.slice(urlParts.indexOf(file.workId)).join('/');

      const { error: deleteStorageError } = await supabase.storage
        .from('work-files')
        .remove([filePath]);

      if (deleteStorageError) console.warn("Erro ao deletar arquivo do storage (pode não existir):", deleteStorageError);

      await dbService.deleteFile(file.id);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
      showToastNotification("Arquivo excluído com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao deletar arquivo:", error);
      showToastNotification(`Erro ao deletar arquivo: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Arquivo",
        message: `Não foi possível deletar o arquivo: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: CHECKLISTS
  // =======================================================================

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newChecklistName || newChecklistItems.some(item => !item.trim())) {
      setZeModal(prev => ({ ...prev, title: "Campos Obrigatórios", message: "Por favor, preencha o nome do checklist e todos os itens.", type: "WARNING", confirmText: "Ok", onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}, onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} })); // Fix: Ensure onConfirm/onCancel match signature
      return;
    }

    setIsAddingChecklist(true);
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addChecklist({
        workId: workId,
        name: newChecklistName,
        category: newChecklistCategory || 'Geral', // Default to 'Geral' if no category
        items: newChecklistItems.filter(item => item.trim() !== '').map(itemText => ({
          id: crypto.randomUUID(), // Generate UUID for each item
          text: itemText,
          checked: false,
        })),
      });
      setShowAddChecklistModal(false);
      setNewChecklistName('');
      setNewChecklistCategory('');
      setNewChecklistItems(['']);
      await loadWorkData();
      showToastNotification("Checklist adicionado com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar checklist:", error);
      showToastNotification(`Erro ao adicionar checklist: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Checklist",
        message: `Não foi possível adicionar o checklist: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setIsAddingChecklist(false);
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChecklistData || !workId || !newChecklistName || newChecklistItems.some(item => !item.trim())) {
      setZeModal(prev => ({ ...prev, title: "Campos Obrigatórios", message: "Por favor, preencha o nome do checklist e todos os itens.", type: "WARNING", confirmText: "Ok", onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}, onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} })); // Fix: Ensure onConfirm/onCancel match signature
      return;
    }

    setIsAddingChecklist(true); // Use same loading state for edit
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateChecklist({
        ...editChecklistData,
        name: newChecklistName,
        category: newChecklistCategory || 'Geral',
        items: newChecklistItems.filter(item => item.trim() !== '').map(itemText => {
          // Try to preserve existing item IDs if text matches, otherwise create new
          const existingItem = editChecklistData.items.find(item => item.text === itemText);
          return {
            id: existingItem ? existingItem.id : crypto.randomUUID(),
            text: itemText,
            checked: existingItem ? existingItem.checked : false,
          };
        }),
      });
      setEditChecklistData(null);
      setShowAddChecklistModal(false);
      await loadWorkData();
      showToastNotification("Checklist atualizado com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao editar checklist:", error);
      showToastNotification(`Erro ao editar checklist: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Checklist",
        message: `Não foi possível editar o checklist: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setIsAddingChecklist(false);
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteChecklist(checklistId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
      showToastNotification("Checklist excluído com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao deletar checklist:", error);
      showToastNotification(`Erro ao deletar checklist: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Checklist",
        message: `Não foi possível deletar o checklist: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // MAIN RENDER LOGIC
  // =======================================================================

  // Initial loading/auth check for the component itself
  if (!isUserAuthFinished || authLoading) {
    return (
        <div className="flex items-center justify-center min-h-[70vh] text-primary dark:text-white">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
        </div>
    );
  }

  // If user is null AFTER auth is finished, redirect to login.
  if (!user) {
    navigate('/login', { replace: true });
    return null; // Return null while redirecting
  }

  // If workId is missing, it's a critical error for this page, redirect to dashboard.
  if (!workId) {
    navigate('/', { replace: true }); // Redirect to dashboard
    return null; // Return null while redirecting
  }

  // Main loading state specific to WorkDetail data
  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-primary dark:text-white animate-in fade-in">
            <i className="fa-solid fa-sync fa-spin text-4xl mb-4 text-secondary"></i>
            <p className="text-xl font-bold">Carregando detalhes da obra...</p>
        </div>
    );
  }

  // NEW: If work is still null AFTER loading has finished, it means the work was not found.
  // This replaces the problematic redirect.
  if (!work && !loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in">
              <i className="fa-solid fa-exclamation-circle text-6xl text-red-500 mb-4"></i>
              <h2 className="text-2xl font-black text-primary dark:text-white mb-2">Obra não encontrada!</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                  Parece que esta obra não existe ou você não tem permissão para acessá-la.
              </p>
              <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors"
                  aria-label="Voltar ao Dashboard"
              >
                  Voltar ao Dashboard
              </button>
          </div>
      );
  }

  // ... rest of the component rendering
  return (
    <div className="max-w-4xl mx-auto pb-12 pt-6 px-4 md:px-0 font-sans">
      {/* NEW: Global Toast Notification */}
      {showToast && (
        <div 
          className={cx(
            "fixed top-4 left-1/2 -translate-x-1/2 z-[1001] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-8 duration-300",
            toastType === 'success' ? 'bg-green-500 text-white' :
            toastType === 'error' ? 'bg-red-500 text-white' :
            'bg-amber-500 text-white'
          )}
          role="status"
          aria-live="polite"
        >
          <i className={cx(
            "fa-solid",
            toastType === 'success' ? 'fa-check-circle' :
            toastType === 'error' ? 'fa-exclamation-circle' :
            'fa-triangle-exclamation'
          )}></i>
          <span className="font-bold">{toastMessage}</span>
        </div>
      )}


      {/* HEADER PREMIUM */}
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label="Voltar para Dashboard"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight flex items-center gap-3">
            {work?.name}
            {work?.status && (
              <span className={cx(
                "px-3 py-1 rounded-full text-xs font-bold uppercase",
                getWorkStatusDetails(work.status).bgColor,
                getWorkStatusDetails(work.status).textColor,
                getWorkStatusDetails(work.status).bgColor.replace('bg-', 'shadow-') + '/20' // Dynamic shadow color
              )}>
                {getWorkStatusDetails(work.status).text}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {work?.address} • {work?.area}m² • Início: {formatDateDisplay(work?.startDate || null)}
          </p>
        </div>
      </div>

      {/* NAVIGATION TABS (Mobile hidden, shown in desktop and handled by BottomNavBar for mobile) */}
      <div className="hidden md:flex justify-around bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => goToTab('ETAPAS')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'ETAPAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Cronograma
        </button>
        <button
          onClick={() => goToTab('MATERIAIS')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'MATERIAIS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Materiais
        </button>
        <button
          onClick={() => goToTab('FINANCEIRO')}
          className={`relative flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'FINANCEIRO' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Financeiro
          {showFinanceUpdateBadge && (
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold w-auto px-2 py-0.5 rounded-full flex items-center justify-center leading-none shadow-lg animate-pulse">
              Atualizado!
            </span>
          )}
        </button>
        <button
          onClick={() => goToTab('FERRAMENTAS')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'FERRAMENTAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Ferramentas
        </button>
      </div>

      {/* RENDER ACTIVE TAB CONTENT */}
      {activeTab === 'ETAPAS' && activeSubView === 'NONE' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className={cx(surface, card)}> {/* Use card class for consistent padding/radius */}
            {steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <i className="fa-solid fa-calendar-times text-6xl text-slate-400 mb-6"></i>
                <h2 className="text-xl font-black text-primary dark:text-white mb-2">Ainda não existe um cronograma para esta obra.</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                  Crie um cronograma seguro com base na estrutura da obra usando o Planejador AI.
                </p>
                <button
                  onClick={() => navigate(`/work/${workId}/ai-planner`)}
                  className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                  aria-label="Criar Cronograma Seguro com AI"
                >
                  <i className="fa-solid fa-robot"></i> Criar Cronograma Seguro (AI)
                </button>
                <button
                  onClick={() => {
                    setShowAddStepModal(true);
                    setEditStepData(null);
                    setNewStepName('');
                    setNewStepStartDate(new Date().toISOString().split('T')[0]);
                    setNewStepEndDate(new Date().toISOString().split('T')[0]);
                    setNewEstimatedDurationDays('');
                  }}
                  className="mt-4 px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center gap-2"
                  aria-label="Adicionar primeira etapa manualmente"
                >
                  <i className="fa-solid fa-plus-circle"></i> Adicionar Etapa Manualmente
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black text-primary dark:text-white">Seu Cronograma</h2>
                  <button
                    onClick={() => {
                      setShowAddStepModal(true);
                      setEditStepData(null);
                      setNewStepName('');
                      setNewStepStartDate(new Date().toISOString().split('T')[0]);
                      setNewStepEndDate(new Date().toISOString().split('T')[0]);
                      setNewEstimatedDurationDays('');
                    }}
                    className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                    aria-label="Adicionar nova etapa"
                  >
                    <i className="fa-solid fa-plus"></i> Nova
                  </button>
                </div>
                {steps.map(step => {
                  const statusDetails = getEntityStatusDetails('step', step, steps);
                  const isDraggable = !step.startDate; // NEW: Explicit boolean for readability
                  return (
                    <div
                      key={step.id}
                      draggable={isDraggable} // Only allow dragging if step has not started
                      onDragStart={(e) => handleDragStart(e, step.id)}
                      onDragOver={(e) => handleDragOver(e, step.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, step.id)}
                      className={cx(
                        "bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border-l-4 transition-all duration-300 group",
                        statusDetails.borderColor, // Use status-specific border
                        dragOverStepId === step.id ? 'border-r-4 border-dashed border-secondary scale-[1.01] shadow-lg' : '',
                        isDraggable ? 'cursor-grab hover:scale-[1.005]' : 'cursor-not-allowed opacity-80', // Visual feedback for draggable
                      )}
                      aria-labelledby={`step-name-${step.id}`}
                      aria-describedby={`step-status-${step.id}`}
                      aria-disabled={!!step.startDate}
                      title={isDraggable ? "Arraste para reordenar" : "Etapa iniciada, não reordenável."} // NEW: Tooltip for reorder
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 id={`step-name-${step.id}`} className="font-bold text-primary dark:text-white text-lg flex items-center gap-2">
                          {step.orderIndex}. {step.name}
                          {!step.startDate && <i className="fa-solid fa-arrows-alt-v text-slate-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"></i>}
                        </h3>
                        {/* Status Badge (Read-only from backend) */}
                        <span id={`step-status-${step.id}`} className={cx(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase",
                          statusDetails.bgColor,
                          statusDetails.textColor,
                          statusDetails.shadowClass
                        )}>
                          <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Início: {formatDateDisplay(step.startDate)} &bull; Término Previsto: {formatDateDisplay(step.endDate)}
                      </p>
                      {step.realDate && (
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          <i className="fa-solid fa-calendar-check mr-1"></i> Concluído em: {formatDateDisplay(step.realDate)}
                        </p>
                      )}
                      {step.status === StepStatus.DELAYED && (
                        <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                          <i className="fa-solid fa-exclamation-triangle mr-1"></i> Esta etapa está atrasada!
                        </p>
                      )}
                      {/* NEW: Step progress bar based on material completion */}
                      {steps.length > 0 && ( 
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-3">
                          <div 
                            className="h-full rounded-full bg-secondary transition-all duration-500" 
                            style={{ width: `${calculateStepProgress(step.id)}%` }}
                            aria-valuenow={calculateStepProgress(step.id)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Progresso da etapa: ${Math.round(calculateStepProgress(step.id))}%`}
                          ></div>
                        </div>
                      )}
                      <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <button
                          onClick={() => handleStepStatusChange(step)}
                          disabled={isUpdatingStepStatus}
                          className={cx(
                            "px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-2",
                            step.status === StepStatus.COMPLETED 
                              ? "bg-amber-500 text-white hover:bg-amber-600" 
                              : "bg-green-500 text-white hover:bg-green-600",
                            isUpdatingStepStatus && "opacity-70 cursor-not-allowed"
                          )}
                          aria-label={step.status === StepStatus.COMPLETED ? "Marcar como pendente" : "Marcar como concluída"}
                        >
                          {isUpdatingStepStatus && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                          {step.status === StepStatus.COMPLETED ? 'Marcar como Pendente' : 'Marcar como Concluída'}
                        </button>
                        <button
                          onClick={() => {
                            setEditStepData(step);
                            setNewStepName(step.name);
                            setNewStepStartDate(step.startDate);
                            setNewStepEndDate(step.endDate);
                            setNewEstimatedDurationDays(String(step.estimatedDurationDays || ''));
                            setShowAddStepModal(true);
                          }}
                          disabled={!!step.startDate} // NEW: Disable edit if step started
                          title={!!step.startDate ? "Etapa iniciada, não editável." : "Editar detalhes da etapa"} // NEW: Tooltip
                          className="ml-2 px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label={`Editar etapa ${step.name}`}
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'MATERIAIS' && activeSubView === 'NONE' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className={cx(surface, card)}> {/* Use card class for consistent padding/radius */}
            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
                <h2 className="text-2xl font-black text-primary dark:text-white">Sua Lista de Materiais</h2>
                <button
                    onClick={() => {
                        setShowAddMaterialModal(true);
                        setEditMaterialData(null); // Clear edit data when adding new
                        setNewMaterialName('');
                        setNewMaterialBrand('');
                        setNewMaterialPlannedQty('');
                        setNewMaterialUnit('');
                        setNewMaterialCategory('');
                        setNewMaterialStepId('');
                        setPurchaseQtyInput(''); // Clear temporary purchase inputs
                        setPurchaseCostInput(''); // Clear temporary purchase inputs
                    }}
                    className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                    aria-label="Adicionar novo material"
                >
                    <i className="fa-solid fa-plus"></i> Novo
                </button>
            </div>

            {materials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <i className="fa-solid fa-boxes-stacked text-6xl text-slate-400 mb-6"></i>
                <h2 className="text-xl font-black text-primary dark:text-white mb-2">Ainda não existe uma lista de materiais para esta obra.</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                  Gere uma lista segura com base na estrutura da obra.
                </p>
                <button
                  onClick={handleGenerateMaterials}
                  disabled={loading}
                  className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  aria-label="Gerar Lista de Materiais (AI)"
                >
                  {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-robot"></i>}
                  {zeModal.isConfirming ? 'Gerando...' : 'Gerar Lista de Materiais (AI)'}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="mb-4">
                  <label htmlFor="material-step-filter" className="sr-only">Filtrar materiais por etapa</label>
                  <select
                    id="material-step-filter"
                    value={materialFilterStepId}
                    onChange={(e) => setMaterialFilterStepId(e.target.value)}
                    className="w-full md:w-auto px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary dark:text-white focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    aria-label="Filtrar materiais por etapa"
                  >
                    <option value="all">Todas as Etapas</option>
                    {steps.map(step => (
                      <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                    ))}
                  </select>
                </div>

                {groupedMaterials.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 italic">Nenhum material encontrado para o filtro selecionado. Tente outro filtro ou adicione novos materiais.</p>
                ) : (
                  groupedMaterials.map(group => (
                    <div key={group.stepId} className="space-y-4">
                      <h3 className="text-lg font-bold text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">{group.stepName}</h3>
                      {group.materials.map(material => {
                        const statusDetails = getEntityStatusDetails('material', material, steps);
                        return (
                          <div key={material.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold text-primary dark:text-white text-base">{material.name} {material.brand && <span className="text-sm text-slate-500 dark:text-slate-400">({material.brand})</span>}</h4>
                              <span className={cx(
                                "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                                statusDetails.bgColor,
                                statusDetails.textColor
                              )}>
                                <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {material.purchasedQty} / {material.plannedQty} {material.unit} Comprados
                            </p>
                            {renderMaterialProgressBar(material)}
                            <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                              <p className="text-sm font-bold text-primary dark:text-white">Custo Total: {formatCurrency(material.totalCost || 0)}</p>
                              <button
                                onClick={() => {
                                  setEditMaterialData(material);
                                  setNewMaterialName(material.name);
                                  setNewMaterialBrand(material.brand || '');
                                  setNewMaterialPlannedQty(String(material.plannedQty));
                                  setNewMaterialUnit(material.unit);
                                  setNewMaterialCategory(material.category || '');
                                  setNewMaterialStepId(material.stepId || 'none');
                                  setPurchaseQtyInput(''); // Reset purchase input for new transaction
                                  setPurchaseCostInput(''); // Reset purchase input for new transaction
                                  setShowAddMaterialModal(true);
                                }}
                                className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-colors"
                                aria-label={`Editar material ${material.name} ou registrar compra`}
                              >
                                Editar / Comprar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'FINANCEIRO' && activeSubView === 'NONE' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className={cx(surface, card)}> {/* Use card class for consistent padding/radius */}
            <h2 className="text-2xl font-black text-primary dark:text-white mb-6">Visão Geral Financeira</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Orçamento Planejado</p>
                    <h3 className="text-xl font-bold text-primary dark:text-white">{formatCurrency(work?.budgetPlanned || 0)}</h3>
                </div>
                <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Gasto Total</p>
                    <h3 className={`text-xl font-bold ${calculateTotalExpenses > (work?.budgetPlanned || 0) ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(calculateTotalExpenses)}</h3>
                </div>
                <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Balanço</p>
                    <h3 className={`text-xl font-bold ${budgetUsage < 100 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{formatCurrency((work?.budgetPlanned || 0) - calculateTotalExpenses)}</h3>
                </div>
            </div>

            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
                <h2 className="text-2xl font-black text-primary dark:text-white">Suas Despesas</h2>
                <button
                    onClick={() => {
                        setShowAddExpenseModal(true);
                        setEditExpenseData(null); // Clear edit data when adding new
                        setNewExpenseDescription('');
                        setNewExpenseAmount('');
                        setNewExpenseCategory(ExpenseCategory.OTHER);
                        setNewExpenseDate(new Date().toISOString().split('T')[0]);
                        setNewExpenseStepId('');
                        setNewExpenseWorkerId('');
                        setNewExpenseSupplierId('');
                        setNewExpenseTotalAgreed('');
                    }}
                    className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                    aria-label="Adicionar nova despesa"
                >
                    <i className="fa-solid fa-plus"></i> Nova
                </button>
            </div>

            {expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <i className="fa-solid fa-receipt text-6xl text-slate-400 mb-6"></i>
                    <h2 className="text-xl font-black text-primary dark:text-white mb-2">Nenhuma despesa registrada ainda.</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                        Comece a registrar seus gastos para ter controle total do financeiro da sua obra.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedExpensesByStep.map(group => (
                        <div key={group.stepName} className="space-y-4">
                            <h3 className="text-lg font-bold text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mb-4">{group.stepName}</h3>
                            {group.expenses.map(expense => {
                                const statusDetails = getEntityStatusDetails('expense', expense, steps);
                                const agreed = expense.totalAgreed !== undefined && expense.totalAgreed !== null ? expense.totalAgreed : expense.amount;
                                const remaining = Math.max(0, agreed - (expense.paidAmount || 0));

                                return (
                                    <div key={expense.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-bold text-primary dark:text-white text-base">{expense.description}</h4>
                                            <span className={cx(
                                                "px-2 py-0.5 rounded-full text-xs font-bold uppercase",
                                                statusDetails.bgColor,
                                                statusDetails.textColor
                                            )}>
                                                <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Previsto: {formatCurrency(expense.amount)}
                                            {agreed !== expense.amount && ` (Combinado: ${formatCurrency(agreed)})`}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">
                                            Pago: {formatCurrency(expense.paidAmount || 0)}
                                            {remaining > 0 && <span className="ml-2 text-red-500">(Falta: {formatCurrency(remaining)})</span>}
                                        </p>
                                        {renderExpenseProgressBar(expense)}
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                            <p className="text-sm font-bold text-primary dark:text-white">Categoria: {expense.category}</p>
                                            <div className="flex gap-2">
                                                {expense.status !== ExpenseStatus.COMPLETED && expense.status !== ExpenseStatus.OVERPAID && (
                                                    <button
                                                        onClick={() => {
                                                            setPaymentExpenseData(expense);
                                                            setPaymentAmount(String(remaining)); // Pre-fill with remaining amount
                                                            setShowAddPaymentModal(true);
                                                        }}
                                                        className="px-3 py-1 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary-dark transition-colors"
                                                        aria-label={`Registrar pagamento para ${expense.description}`}
                                                    >
                                                        Pagar
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setEditExpenseData(expense);
                                                        setNewExpenseDescription(expense.description);
                                                        setNewExpenseAmount(String(expense.amount));
                                                        setNewExpenseCategory(expense.category as ExpenseCategory);
                                                        setNewExpenseDate(expense.date);
                                                        setNewExpenseStepId(expense.stepId || 'none');
                                                        setNewExpenseWorkerId(expense.workerId || 'none');
                                                        setNewExpenseSupplierId(expense.supplierId || 'none');
                                                        setNewExpenseTotalAgreed(expense.totalAgreed !== undefined && expense.totalAgreed !== null ? String(expense.totalAgreed) : '');
                                                        setShowAddExpenseModal(true);
                                                    }}
                                                    className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-colors"
                                                    aria-label={`Editar despesa ${expense.description}`}
                                                >
                                                    Editar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'FERRAMENTAS' && activeSubView === 'NONE' && (
        <div className="tab-content animate-in fade-in duration-300">
            <div className={cx(surface, card)}> {/* Use card class for consistent padding/radius */}
                <h2 className="text-2xl font-black text-primary dark:text-white mb-6">Ferramentas da Obra</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ToolCard
                        icon="fa-people-group"
                        title="Sua Equipe"
                        description="Gerencie seus trabalhadores e prestadores de serviço."
                        onClick={() => goToSubView('WORKERS')}
                    />
                    <ToolCard
                        icon="fa-truck-fast"
                        title="Seus Fornecedores"
                        description="Cadastre e organize seus contatos de materiais e serviços."
                        onClick={() => goToSubView('SUPPLIERS')}
                    />
                    <ToolCard
                        icon="fa-camera"
                        title="Fotos da Obra"
                        description="Documente o progresso com fotos organizadas por data e tipo."
                        onClick={() => goToSubView('PHOTOS')}
                    />
                    <ToolCard
                        icon="fa-file-alt"
                        title="Arquivos da Obra"
                        description="Guarde plantas, orçamentos, contratos e outros documentos importantes."
                        onClick={() => goToSubView('FILES')}
                    />
                    <ToolCard
                        icon="fa-file-contract"
                        title="Contratos & Recibos"
                        description="Gere contratos e recibos para sua equipe e fornecedores em segundos."
                        onClick={() => goToSubView('CONTRACTS')}
                    />
                    <ToolCard
                        icon="fa-list-check"
                        title="Checklists Inteligentes"
                        description="Listas de verificação para cada etapa, garantindo que nada seja esquecido."
                        onClick={() => goToSubView('CHECKLIST')}
                    />
                    <ToolCard
                        icon="fa-chart-line"
                        title="Relatórios de Obra"
                        description="Acompanhe o desempenho financeiro e de cronograma com relatórios detalhados."
                        onClick={() => navigate(`/work/${workId}/reports`)}
                        isLocked={!hasAiAccess} 
                        requiresVitalicio={true} 
                    />
                    <ToolCard
                        icon="fa-robot"
                        title="Plano Inteligente IA"
                        description="Deixe a IA planejar cronogramas, materiais e riscos da sua obra em segundos."
                        onClick={() => navigate(`/work/${workId}/ai-planner`)}
                        isLocked={!hasAiAccess}
                        requiresVitalicio={true}
                    />
                    <ToolCard
                        icon="fa-comment-dots"
                        title="Zé da Obra AI Chat"
                        description="Seu engenheiro virtual particular para tirar dúvidas em tempo real."
                        onClick={() => navigate('/ai-chat')} // AI Chat is a global tool, not specific to a work, so navigate to global AI chat
                        isLocked={!hasAiAccess}
                        requiresVitalicio={true}
                    />
                </div>
            </div>
        </div>
      )}

      {/* Render sub-views for FERRAMENTAS tab */}
      {activeSubView !== 'NONE' && (
        <div className="tab-content animate-in fade-in duration-300">
          {activeSubView === 'WORKERS' && (
            <div className={cx(surface, card)}>
              <ToolSubViewHeader 
                title="Sua Equipe" 
                onBack={() => goToSubView('NONE')} 
                onAdd={() => { 
                  setShowAddWorkerModal(true); 
                  setEditWorkerData(null); 
                  setNewWorkerName(''); 
                  setNewWorkerRole(''); 
                  setNewWorkerPhone(''); 
                  setNewWorkerDailyRate(''); 
                  setNewWorkerNotes(''); 
                }}
                loading={isAddingWorker} // Show spinner on add button if adding
              />
              {workers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-hard-hat text-6xl text-slate-400 mb-6"></i>
                  <h3 className="text-xl font-black text-primary dark:text-white mb-2">Nenhum trabalhador cadastrado.</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Adicione sua equipe para gerenciar diárias e pagamentos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {workers.map(worker => (
                    <div key={worker.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-primary dark:text-white text-base">{worker.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500 text-white">{worker.role}</span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Tel: {worker.phone} {worker.dailyRate ? ` • Diária: ${formatCurrency(worker.dailyRate)}` : ''}
                      </p>
                      {worker.notes && <p className="text-xs text-slate-400 mt-1">{worker.notes}</p>}
                      <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <button
                          onClick={() => {
                            setEditWorkerData(worker);
                            setNewWorkerName(worker.name);
                            setNewWorkerRole(worker.role);
                            setNewWorkerPhone(worker.phone);
                            setNewWorkerDailyRate(String(worker.dailyRate || ''));
                            setNewWorkerNotes(worker.notes || '');
                            setShowAddWorkerModal(true);
                          }}
                          className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-colors"
                          aria-label={`Editar trabalhador ${worker.name}`}
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubView === 'SUPPLIERS' && (
            <div className={cx(surface, card)}>
              <ToolSubViewHeader 
                title="Seus Fornecedores" 
                onBack={() => goToSubView('NONE')} 
                onAdd={() => { 
                  setShowAddSupplierModal(true); 
                  setEditSupplierData(null); 
                  setNewSupplierName(''); 
                  setNewSupplierCategory(''); 
                  setNewSupplierPhone(''); 
                  setNewSupplierEmail(''); 
                  setNewSupplierAddress(''); 
                  setNewSupplierNotes(''); 
                }}
                loading={isAddingSupplier} // Show spinner on add button if adding
              />
              {suppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-truck-fast text-6xl text-slate-400 mb-6"></i>
                  <h3 className="text-xl font-black text-primary dark:text-white mb-2">Nenhum fornecedor cadastrado.</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Organize seus contatos para cotações e compras.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suppliers.map(supplier => (
                    <div key={supplier.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-primary dark:text-white text-base">{supplier.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500 text-white">{supplier.category}</span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Tel: {supplier.phone} {supplier.email && ` • Email: ${supplier.email}`}
                      </p>
                      {supplier.address && <p className="text-xs text-slate-400 mt-1">{supplier.address}</p>}
                      {supplier.notes && <p className="text-xs text-slate-400 mt-1">{supplier.notes}</p>}
                      <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <button
                          onClick={() => {
                            setEditSupplierData(supplier);
                            setNewSupplierName(supplier.name);
                            setNewSupplierCategory(supplier.category);
                            setNewSupplierPhone(supplier.phone);
                            setNewSupplierEmail(supplier.email || '');
                            setNewSupplierAddress(supplier.address || '');
                            setNewSupplierNotes(supplier.notes || '');
                            setShowAddSupplierModal(true);
                          }}
                          className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-colors"
                          aria-label={`Editar fornecedor ${supplier.name}`}
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubView === 'PHOTOS' && (
            <div className={cx(surface, card)}>
              <ToolSubViewHeader
                title="Suas Fotos da Obra"
                onBack={() => goToSubView('NONE')}
                onAdd={() => setShowAddPhotoModal(true)}
                loading={uploadingPhoto}
              />
              {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-camera text-6xl text-slate-400 mb-6"></i>
                  <h3 className="text-xl font-black text-primary dark:text-white mb-2">Nenhuma foto ainda.</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Registre o progresso e os momentos importantes da sua obra.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map(photo => (
                    <div key={photo.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                      <img src={photo.url} alt={photo.description} className="w-full h-32 object-cover" loading="lazy" />
                      <div className="p-3">
                        <p className="font-bold text-primary dark:text-white text-sm truncate">{photo.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatDateDisplay(photo.date)} - {photo.type}</p>
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => {
                              // Confirm delete
                              setZeModal({
                                isOpen: true,
                                title: "Excluir Foto",
                                message: `Tem certeza que deseja excluir esta foto "${photo.description}"?`,
                                confirmText: "Excluir",
                                onConfirm: async (e) => {
                                  e?.preventDefault(); // Pass event here
                                  await handleDeletePhoto(photo);
                                },
                                onCancel: async (_e?: React.FormEvent) => {setZeModal(prev => ({ ...prev, isOpen: false }));}, // Fix: Ensure onCancel matches signature
                                isConfirming: zeModal.isConfirming,
                                type: "DANGER"
                              });
                            }}
                            className="text-red-500 hover:text-red-600 text-sm p-1"
                            aria-label={`Excluir foto ${photo.description}`}
                          >
                            <i className="fa-solid fa-trash-alt"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubView === 'FILES' && (
            <div className={cx(surface, card)}>
              <ToolSubViewHeader
                title="Seus Arquivos da Obra"
                onBack={() => goToSubView('NONE')}
                onAdd={() => setShowAddFileModal(true)}
                loading={uploadingFile}
              />
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-file-alt text-6xl text-slate-400 mb-6"></i>
                  <h3 className="text-xl font-black text-primary dark:text-white mb-2">Nenhum arquivo ainda.</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Organize plantas, documentos e orçamentos importantes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {files.map(file => (
                    <div key={file.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                      <div className="flex items-center gap-4">
                        <i className="fa-solid fa-file text-2xl text-secondary"></i>
                        <div>
                          <p className="font-bold text-primary dark:text-white text-base">{file.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{file.category} - {formatDateDisplay(file.date)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-primary dark:text-white hover:text-secondary p-1" aria-label={`Visualizar arquivo ${file.name}`}>
                          <i className="fa-solid fa-eye"></i>
                        </a>
                        <button
                          onClick={() => {
                            setZeModal({
                              isOpen: true,
                              title: "Excluir Arquivo",
                              message: `Tem certeza que deseja excluir o arquivo "${file.name}"?`,
                              confirmText: "Excluir",
                              onConfirm: async (e) => {
                                e?.preventDefault();
                                await handleDeleteFile(file);
                              },
                              onCancel: async (_e?: React.FormEvent) => {setZeModal(prev => ({ ...prev, isOpen: false }));}, // Fix: Ensure onCancel matches signature
                              isConfirming: zeModal.isConfirming,
                              type: "DANGER"
                            });
                          }}
                          className="text-red-500 hover:text-red-600 p-1"
                          aria-label={`Excluir arquivo ${file.name}`}
                        >
                          <i className="fa-solid fa-trash-alt"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubView === 'CONTRACTS' && (
            <div className={cx(surface, card)}>
              <ToolSubViewHeader
                title="Contratos & Recibos"
                onBack={() => goToSubView('NONE')}
              />
              {contracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-file-contract text-6xl text-slate-400 mb-6"></i>
                  <h3 className="text-xl font-black text-primary dark:text-white mb-2">Nenhum modelo de contrato disponível.</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Entre em contato com o suporte para adicionar modelos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts.map(contract => (
                    <div key={contract.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                      <div>
                        <p className="font-bold text-primary dark:text-white text-base">{contract.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{contract.category}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedContractContent(contract.contentTemplate);
                          setSelectedContractTitle(contract.title);
                          setShowContractContentModal(true);
                        }}
                        className="px-3 py-1 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary-dark transition-colors"
                        aria-label={`Visualizar contrato ${contract.title}`}
                      >
                        Visualizar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSubView === 'CHECKLIST' && (
            <div className={cx(surface, card)}>
              <ToolSubViewHeader
                title="Seus Checklists"
                onBack={() => goToSubView('NONE')}
                onAdd={() => { setShowAddChecklistModal(true); setEditChecklistData(null); setNewChecklistName(''); setNewChecklistCategory(''); setNewChecklistItems(['']); }}
                loading={isAddingChecklist}
              />
              {checklists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-list-check text-6xl text-slate-400 mb-6"></i>
                  <h3 className="text-xl font-black text-primary dark:text-white mb-2">Nenhum checklist criado.</h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Crie listas de verificação para não esquecer de nada importante.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {checklists.map(checklist => (
                    <div key={checklist.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-primary dark:text-white text-base">{checklist.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-lime-500 text-white">{checklist.category}</span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {checklist.items.filter(item => item.checked).length} / {checklist.items.length} itens concluídos
                      </p>
                      <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <button
                          onClick={() => {
                            setEditChecklistData(checklist);
                            setNewChecklistName(checklist.name);
                            setNewChecklistCategory(checklist.category);
                            setNewChecklistItems(checklist.items.map(item => item.text));
                            setShowAddChecklistModal(true);
                          }}
                          className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-light transition-colors"
                          aria-label={`Editar checklist ${checklist.name}`}
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ADD/EDIT STEP MODAL */}
      {showAddStepModal && (
        <ZeModal
          isOpen={showAddStepModal}
          title={editStepData ? "Editar Etapa" : "Adicionar Nova Etapa"}
          message="" // Message handled by form fields
          confirmText={editStepData ? "Salvar Alterações" : "Adicionar Etapa"}
          onConfirm={editStepData ? handleEditStep : handleAddStep}
          onCancel={() => {
            setShowAddStepModal(false);
            setEditStepData(null); // Clear edit data on cancel
            setNewStepName('');
            setNewStepStartDate(new Date().toISOString().split('T')[0]);
            setNewStepEndDate(new Date().toISOString().split('T')[0]);
            setNewEstimatedDurationDays(''); // Clear for new
          }}
          isConfirming={zeModal.isConfirming}
          type={editStepData ? "INFO" : "SUCCESS"}
        >
          <form onSubmit={editStepData ? handleEditStep : handleAddStep} className="space-y-4">
            <div>
              <label htmlFor="step-name" className="block text-sm font-bold text-primary dark:text-white mb-1">Nome da Etapa</label>
              <input
                id="step-name"
                type="text"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Fundações, Pintura Final"
                required
                disabled={!!editStepData?.startDate} // Disable name edit if step started
                title={!!editStepData?.startDate ? "Não é possível alterar o nome de uma etapa iniciada." : undefined} // Tooltip
              />
              {editStepData?.startDate && <p className="text-xs text-red-500 mt-1">Não é possível alterar o nome de uma etapa iniciada.</p>}
            </div>
            <div>
              <label htmlFor="step-start-date" className="block text-sm font-bold text-primary dark:text-white mb-1">Data de Início</label>
              <input
                id="step-start-date"
                type="date"
                value={newStepStartDate || ''}
                onChange={(e) => setNewStepStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                disabled={!!editStepData?.startDate} // Disable start date edit if step started
                title={!!editStepData?.startDate ? "Não é possível alterar a data de início de uma etapa iniciada." : undefined} // Tooltip
              />
              {editStepData?.startDate && <p className="text-xs text-red-500 mt-1">Não é possível alterar a data de início de uma etapa iniciada.</p>}
            </div>
            <div>
              <label htmlFor="step-end-date" className="block text-sm font-bold text-primary dark:text-white mb-1">Data de Término Prevista</label>
              <input
                id="step-end-date"
                type="date"
                value={newStepEndDate || ''}
                onChange={(e) => setNewStepEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required={!!newStepStartDate} // Required if start date is set
              />
            </div>
            {/* NEW: Estimated Duration Days */}
            <div>
              <label htmlFor="estimated-duration-days" className="block text-sm font-bold text-primary dark:text-white mb-1">Duração Estimada (dias)</label>
              <input
                id="estimated-duration-days"
                type="number"
                value={newEstimatedDurationDays}
                onChange={(e) => setNewEstimatedDurationDays(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 15"
                min="1"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A duração ajuda a recalcular as datas se o plano for alterado.</p>
            </div>
          </form>
        </ZeModal>
      )}

      {showAddMaterialModal && (
        <ZeModal
          isOpen={showAddMaterialModal}
          title={editMaterialData ? "Editar Material / Registrar Compra" : "Adicionar Novo Material"}
          message=""
          confirmText={editMaterialData ? "Salvar e/ou Registrar Compra" : "Adicionar Material"}
          onConfirm={editMaterialData ? handleEditMaterial : handleAddMaterial}
          onCancel={() => {
            setShowAddMaterialModal(false);
            setEditMaterialData(null);
            setNewMaterialName('');
            setNewMaterialBrand('');
            setNewMaterialPlannedQty('');
            setNewMaterialUnit('');
            setNewMaterialCategory('');
            setNewMaterialStepId('');
            setPurchaseQtyInput(''); // Clear temporary purchase inputs
            setPurchaseCostInput(''); // Clear temporary purchase inputs
          }}
          isConfirming={zeModal.isConfirming}
          type={editMaterialData ? "INFO" : "SUCCESS"}
        >
          <form onSubmit={editMaterialData ? handleEditMaterial : handleAddMaterial} className="space-y-4">
            {/* Editable fields */}
            <div>
              <label htmlFor="material-name" className="block text-sm font-bold text-primary dark:text-white mb-1">Nome do Material</label>
              <input
                id="material-name"
                type="text"
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Cimento CP-II"
                required
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // NEW: Disable if purchased
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Não editável após compra registrada." : undefined} // NEW: Tooltip
              />
            </div>
            <div>
              <label htmlFor="material-brand" className="block text-sm font-bold text-primary dark:text-white mb-1">Marca (Opcional)</label>
              <input
                id="material-brand"
                type="text"
                value={newMaterialBrand}
                onChange={(e) => setNewMaterialBrand(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Votorantim, Quartzolit"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // NEW: Disable if purchased
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Não editável após compra registrada." : undefined} // NEW: Tooltip
              />
            </div>
            <div>
              <label htmlFor="material-planned-qty" className="block text-sm font-bold text-primary dark:text-white mb-1">Qtd. Planejada</label>
              <input
                id="material-planned-qty"
                type="number"
                value={newMaterialPlannedQty}
                onChange={(e) => setNewMaterialPlannedQty(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 50"
                min="0"
                required
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // NEW: Disable if purchased
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Não editável após compra registrada." : undefined} // NEW: Tooltip
              />
            </div>
            <div>
              <label htmlFor="material-unit" className="block text-sm font-bold text-primary dark:text-white mb-1">Unidade de Medida</label>
              <input
                id="material-unit"
                type="text"
                value={newMaterialUnit}
                onChange={(e) => setNewMaterialUnit(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Sacos, M², Litros"
                required
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // NEW: Disable if purchased
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Não editável após compra registrada." : undefined} // NEW: Tooltip
              />
            </div>
            <div>
              <label htmlFor="material-category" className="block text-sm font-bold text-primary dark:text-white mb-1">Categoria (Opcional)</label>
              <input
                id="material-category"
                type="text"
                value={newMaterialCategory}
                onChange={(e) => setNewMaterialCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Elétrica, Hidráulica, Acabamento"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // NEW: Disable if purchased
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Não editável após compra registrada." : undefined} // NEW: Tooltip
              />
            </div>
            <div>
              <label htmlFor="material-step" className="block text-sm font-bold text-primary dark:text-white mb-1">Vincular à Etapa (Opcional)</label>
              <select
                id="material-step"
                value={newMaterialStepId}
                onChange={(e) => setNewMaterialStepId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="none">Nenhuma</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                ))}
              </select>
            </div>

            {/* Purchase Registration fields (only for editing existing material) */}
            {editMaterialData && (
              <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-primary dark:text-white mb-3">Registrar Compra</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="purchase-qty" className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd. Comprada</label>
                    <input
                      id="purchase-qty"
                      type="number"
                      value={purchaseQtyInput}
                      onChange={(e) => setPurchaseQtyInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                      placeholder="Qtd. da compra"
                      min="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="purchase-cost" className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Total (R$)</label>
                    <input
                      id="purchase-cost"
                      type="number"
                      value={purchaseCostInput}
                      onChange={(e) => setPurchaseCostInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                      placeholder="Custo total da compra"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        </ZeModal>
      )}

      {/* ADD/EDIT EXPENSE MODAL */}
      {showAddExpenseModal && (
        <ZeModal
          isOpen={showAddExpenseModal}
          title={editExpenseData ? "Editar Despesa" : "Adicionar Nova Despesa"}
          message=""
          confirmText={editExpenseData ? "Salvar Alterações" : "Adicionar Despesa"}
          onConfirm={editExpenseData ? handleEditExpense : handleAddExpense}
          onCancel={() => {
            setShowAddExpenseModal(false);
            setEditExpenseData(null);
            setNewExpenseDescription('');
            setNewExpenseAmount('');
            setNewExpenseCategory(ExpenseCategory.OTHER);
            setNewExpenseDate(new Date().toISOString().split('T')[0]);
            setNewExpenseStepId('');
            setNewExpenseWorkerId('');
            setNewExpenseSupplierId('');
            setNewExpenseTotalAgreed('');
          }}
          isConfirming={zeModal.isConfirming}
          type={editExpenseData ? "INFO" : "SUCCESS"}
        >
          <form onSubmit={editExpenseData ? handleEditExpense : handleAddExpense} className="space-y-4">
            <div>
              <label htmlFor="expense-description" className="block text-sm font-bold text-primary dark:text-white mb-1">Descrição</label>
              <input
                id="expense-description"
                type="text"
                value={newExpenseDescription}
                onChange={(e) => setNewExpenseDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Compra de Cimento, Diária Pedreiro"
                required
              />
            </div>
            <div>
              <label htmlFor="expense-amount" className="block text-sm font-bold text-primary dark:text-white mb-1">Valor Previsto (R$)</label>
              <input
                id="expense-amount"
                type="number"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 1500.00"
                min="0"
                step="0.01"
                required
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && editExpenseData.category !== ExpenseCategory.MATERIAL} // Disable if paid AND not material
                title={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && editExpenseData.category !== ExpenseCategory.MATERIAL ? "Não editável após pagamentos." : undefined}
              />
              {!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && editExpenseData.category !== ExpenseCategory.MATERIAL && <p className="text-xs text-red-500 mt-1">Valor não pode ser alterado após pagamentos.</p>}
            </div>
            {/* NEW: Total Agreed field (optional, not for materials) */}
            {newExpenseCategory !== ExpenseCategory.MATERIAL && (
              <div>
                <label htmlFor="expense-total-agreed" className="block text-sm font-bold text-primary dark:text-white mb-1">Valor Combinado (R$ - Opcional)</label>
                <input
                  id="expense-total-agreed"
                  type="number"
                  value={newExpenseTotalAgreed}
                  onChange={(e) => setNewExpenseTotalAgreed(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                  placeholder="Ex: 1450.00 (se negociado)"
                  min="0"
                  step="0.01"
                  disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if paid
                  title={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 ? "Não editável após pagamentos." : undefined}
                />
                {!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Valor combinado não pode ser alterado após pagamentos.</p>}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Se diferente do valor previsto, será o valor base para pagamentos.</p>
              </div>
            )}
            <div>
              <label htmlFor="expense-category" className="block text-sm font-bold text-primary dark:text-white mb-1">Categoria</label>
              <select
                id="expense-category"
                value={newExpenseCategory}
                onChange={(e) => setNewExpenseCategory(e.target.value as ExpenseCategory)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && editExpenseData.category !== ExpenseCategory.MATERIAL} // Disable if paid AND not material
                title={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && editExpenseData.category !== ExpenseCategory.MATERIAL ? "Não editável após pagamentos." : undefined}
              >
                {Object.values(ExpenseCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="Outros">Outros</option>
              </select>
              {!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && editExpenseData.category !== ExpenseCategory.MATERIAL && <p className="text-xs text-red-500 mt-1">Categoria não pode ser alterada após pagamentos.</p>}
            </div>
            <div>
              <label htmlFor="expense-date" className="block text-sm font-bold text-primary dark:text-white mb-1">Data</label>
              <input
                id="expense-date"
                type="date"
                value={newExpenseDate}
                onChange={(e) => setNewExpenseDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if paid
                title={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 ? "Não editável após pagamentos." : undefined}
              />
              {!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Data não pode ser alterada após pagamentos.</p>}
            </div>
            <div>
              <label htmlFor="expense-step" className="block text-sm font-bold text-primary dark:text-white mb-1">Vincular à Etapa (Opcional)</label>
              <select
                id="expense-step"
                value={newExpenseStepId}
                onChange={(e) => setNewExpenseStepId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="none">Nenhuma</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expense-worker" className="block text-sm font-bold text-primary dark:text-white mb-1">Vincular a Trabalhador (Opcional)</label>
              <select
                id="expense-worker"
                value={newExpenseWorkerId}
                onChange={(e) => setNewExpenseWorkerId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="none">Nenhum</option>
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>{worker.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expense-supplier" className="block text-sm font-bold text-primary dark:text-white mb-1">Vincular a Fornecedor (Opcional)</label>
              <select
                id="expense-supplier"
                value={newExpenseSupplierId}
                onChange={(e) => setNewExpenseSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="none">Nenhum</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
          </form>
        </ZeModal>
      )}

      {/* ADD PAYMENT TO EXPENSE MODAL */}
      {showAddPaymentModal && paymentExpenseData && (
        <ZeModal
          isOpen={showAddPaymentModal}
          title={`Registrar Pagamento para "${paymentExpenseData.description}"`}
          message=""
          confirmText="Registrar Pagamento"
          onConfirm={async (e) => {
            e?.preventDefault();
            setZeModal(prev => ({ ...prev, isConfirming: true }));
            try {
              if (!paymentExpenseData || !paymentAmount || !paymentDate) {
                showToastNotification("Preencha o valor e a data do pagamento.", 'warning');
                setZeModal(prev => ({ ...prev, isConfirming: false }));
                return;
              }
              await dbService.addPaymentToExpense(paymentExpenseData.id, Number(paymentAmount), paymentDate);
              setShowAddPaymentModal(false);
              setPaymentExpenseData(null);
              setPaymentAmount('');
              setNewPaymentDate(new Date().toISOString().split('T')[0]);
              await loadWorkData();
              showToastNotification("Pagamento registrado com sucesso!", 'success');
              showFinanceBadge(); // Show badge on finance tab
            } catch (error: any) {
              console.error("Erro ao registrar pagamento:", error);
              showToastNotification(`Erro ao registrar pagamento: ${error.message || 'Erro desconhecido'}.`, 'error');
              setZeModal(prev => ({
                ...prev,
                isConfirming: false,
                title: "Erro ao Registrar Pagamento",
                message: `Não foi possível registrar o pagamento: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
                type: "ERROR",
                confirmText: "Ok",
                onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
                onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
              }));
            } finally {
              setZeModal(prev => ({ ...prev, isConfirming: false }));
            }
          }}
          onCancel={() => {
            setShowAddPaymentModal(false);
            setPaymentExpenseData(null);
            setPaymentAmount('');
            setNewPaymentDate(new Date().toISOString().split('T')[0]);
          }}
          isConfirming={zeModal.isConfirming}
          type="SUCCESS"
        >
          <form className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Valor Previsto: {formatCurrency(paymentExpenseData.amount)}<br/>
              Valor Combinado: {formatCurrency(paymentExpenseData.totalAgreed !== undefined && paymentExpenseData.totalAgreed !== null ? paymentExpenseData.totalAgreed : paymentExpenseData.amount)}<br/>
              Já Pago: {formatCurrency(paymentExpenseData.paidAmount || 0)}<br/>
              Restante: {formatCurrency(Math.max(0, (paymentExpenseData.totalAgreed !== undefined && paymentExpenseData.totalAgreed !== null ? paymentExpenseData.totalAgreed : paymentExpenseData.amount) - (paymentExpenseData.paidAmount || 0)))}
            </p>
            <div>
              <label htmlFor="payment-amount" className="block text-sm font-bold text-primary dark:text-white mb-1">Valor do Pagamento (R$)</label>
              <input
                id="payment-amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 500.00"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <label htmlFor="payment-date" className="block text-sm font-bold text-primary dark:text-white mb-1">Data do Pagamento</label>
              <input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setNewPaymentDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              />
            </div>
          </form>
        </ZeModal>
      )}

      {/* ADD/EDIT WORKER MODAL */}
      {showAddWorkerModal && (
        <ZeModal
          isOpen={showAddWorkerModal}
          title={editWorkerData ? "Editar Trabalhador" : "Adicionar Novo Trabalhador"}
          message=""
          confirmText={editWorkerData ? "Salvar Alterações" : "Adicionar Trabalhador"}
          onConfirm={editWorkerData ? handleEditWorker : handleAddWorker}
          onCancel={() => {
            setShowAddWorkerModal(false);
            setEditWorkerData(null);
            setNewWorkerName('');
            setNewWorkerRole('');
            setNewWorkerPhone('');
            setNewWorkerDailyRate('');
            setNewWorkerNotes('');
          }}
          isConfirming={zeModal.isConfirming}
          type={editWorkerData ? "INFO" : "SUCCESS"}
        >
          <form onSubmit={editWorkerData ? handleEditWorker : handleAddWorker} className="space-y-4">
            <div>
              <label htmlFor="worker-name" className="block text-sm font-bold text-primary dark:text-white mb-1">Nome Completo</label>
              <input
                id="worker-name"
                type="text"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: João da Silva"
                required
              />
            </div>
            <div>
              <label htmlFor="worker-role" className="block text-sm font-bold text-primary dark:text-white mb-1">Função</label>
              <select
                id="worker-role"
                value={newWorkerRole}
                onChange={(e) => setNewWorkerRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              >
                <option value="">Selecione a Função</option>
                {STANDARD_JOB_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="worker-phone" className="block text-sm font-bold text-primary dark:text-white mb-1">Telefone (WhatsApp)</label>
              <input
                id="worker-phone"
                type="text"
                value={newWorkerPhone}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '').substring(0, 11);
                  if (value.length === 11) {
                    value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                  } else if (value.length > 2) {
                    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
                    value = value.replace(/(\d{5})(\d)/, "$1-$2");
                  }
                  setNewWorkerPhone(value);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="(DDD) 9XXXX-XXXX"
                required
                maxLength={15}
              />
            </div>
            <div>
              <label htmlFor="worker-daily-rate" className="block text-sm font-bold text-primary dark:text-white mb-1">Diária (R$ - Opcional)</label>
              <input
                id="worker-daily-rate"
                type="number"
                value={newWorkerDailyRate}
                onChange={(e) => setNewWorkerDailyRate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 150.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label htmlFor="worker-notes" className="block text-sm font-bold text-primary dark:text-white mb-1">Observações (Opcional)</label>
              <textarea
                id="worker-notes"
                value={newWorkerNotes}
                onChange={(e) => setNewWorkerNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Detalhes adicionais sobre o trabalhador"
                rows={3}
              ></textarea>
            </div>
          </form>
        </ZeModal>
      )}

      {/* ADD/EDIT SUPPLIER MODAL */}
      {showAddSupplierModal && (
        <ZeModal
          isOpen={showAddSupplierModal}
          title={editSupplierData ? "Editar Fornecedor" : "Adicionar Novo Fornecedor"}
          message=""
          confirmText={editSupplierData ? "Salvar Alterações" : "Adicionar Fornecedor"}
          onConfirm={editSupplierData ? handleEditSupplier : handleAddSupplier}
          onCancel={() => {
            setShowAddSupplierModal(false);
            setEditSupplierData(null);
            setNewSupplierName('');
            setNewSupplierCategory('');
            setNewSupplierPhone('');
            setNewSupplierEmail('');
            setNewSupplierAddress('');
            setNewSupplierNotes('');
          }}
          isConfirming={zeModal.isConfirming}
          type={editSupplierData ? "INFO" : "SUCCESS"}
        >
          <form onSubmit={editSupplierData ? handleEditSupplier : handleAddSupplier} className="space-y-4">
            <div>
              <label htmlFor="supplier-name" className="block text-sm font-bold text-primary dark:text-white mb-1">Nome do Fornecedor</label>
              <input
                id="supplier-name"
                type="text"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Madeireira São João"
                required
              />
            </div>
            <div>
              <label htmlFor="supplier-category" className="block text-sm font-bold text-primary dark:text-white mb-1">Categoria</label>
              <select
                id="supplier-category"
                value={newSupplierCategory}
                onChange={(e) => setNewSupplierCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              >
                <option value="">Selecione a Categoria</option>
                {STANDARD_SUPPLIER_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="supplier-phone" className="block text-sm font-bold text-primary dark:text-white mb-1">Telefone</label>
              <input
                id="supplier-phone"
                type="text"
                value={newSupplierPhone}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '').substring(0, 11);
                  if (value.length === 11) {
                    value = value.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                  } else if (value.length > 2) {
                    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
                    value = value.replace(/(\d{5})(\d)/, "$1-$2");
                  }
                  setNewSupplierPhone(value);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="(DDD) XXXX-XXXX ou (DDD) 9XXXX-XXXX"
                required
                maxLength={15}
              />
            </div>
            <div>
              <label htmlFor="supplier-email" className="block text-sm font-bold text-primary dark:text-white mb-1">E-mail (Opcional)</label>
              <input
                id="supplier-email"
                type="email"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="contato@fornecedor.com"
              />
            </div>
            <div>
              <label htmlFor="supplier-address" className="block text-sm font-bold text-primary dark:text-white mb-1">Endereço (Opcional)</label>
              <input
                id="supplier-address"
                type="text"
                value={newSupplierAddress}
                onChange={(e) => setNewSupplierAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Rua, Número, Bairro, Cidade"
              />
            </div>
            <div>
              <label htmlFor="supplier-notes" className="block text-sm font-bold text-primary dark:text-white mb-1">Observações (Opcional)</label>
              <textarea
                id="supplier-notes"
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Detalhes adicionais sobre o fornecedor, prazos de entrega"
                rows={3}
              ></textarea>
            </div>
          </form>
        </ZeModal>
      )}

      {/* ADD PHOTO MODAL */}
      {showAddPhotoModal && (
        <ZeModal
          isOpen={showAddPhotoModal}
          title="Adicionar Nova Foto"
          message=""
          confirmText="Upload Foto"
          onConfirm={handleAddPhoto}
          onCancel={() => { setShowAddPhotoModal(false); setNewPhotoDescription(''); setNewPhotoFile(null); setNewPhotoType('PROGRESS'); }}
          isConfirming={zeModal.isConfirming}
          type="SUCCESS"
        >
          <form onSubmit={handleAddPhoto} className="space-y-4">
            <div>
              <label htmlFor="photo-description" className="block text-sm font-bold text-primary dark:text-white mb-1">Descrição da Foto</label>
              <input
                id="photo-description"
                type="text"
                value={newPhotoDescription}
                onChange={(e) => setNewPhotoDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Fundação do Muro, Pintura da Sala"
                required
              />
            </div>
            <div>
              <label htmlFor="photo-file" className="block text-sm font-bold text-primary dark:text-white mb-1">Arquivo de Imagem</label>
              <input
                id="photo-file"
                type="file"
                accept="image/*"
                onChange={(e) => setNewPhotoFile(e.target.files ? e.target.files[0] : null)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark cursor-pointer"
                required
              />
              {newPhotoFile && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Selecionado: {newPhotoFile.name}</p>}
            </div>
            <div>
              <label htmlFor="photo-type" className="block text-sm font-bold text-primary dark:text-white mb-1">Tipo da Foto</label>
              <select
                id="photo-type"
                value={newPhotoType}
                onChange={(e) => setNewPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'PROGRESS')}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="PROGRESS">Progresso</option>
                <option value="BEFORE">Antes</option>
                <option value="AFTER">Depois</option>
              </select>
            </div>
          </form>
        </ZeModal>
      )}

      {/* ADD FILE MODAL */}
      {showAddFileModal && (
        <ZeModal
          isOpen={showAddFileModal}
          title="Adicionar Novo Arquivo"
          message=""
          confirmText="Upload Arquivo"
          onConfirm={handleAddFile}
          onCancel={() => { setShowAddFileModal(false); setNewFileName(''); setNewFileCategory(FileCategory.GENERAL); setNewUploadFile(null); }}
          isConfirming={zeModal.isConfirming}
          type="SUCCESS"
        >
          <form onSubmit={handleAddFile} className="space-y-4">
            <div>
              <label htmlFor="file-name" className="block text-sm font-bold text-primary dark:text-white mb-1">Nome do Arquivo</label>
              <input
                id="file-name"
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Projeto Elétrico, Orçamento Final"
                required
              />
            </div>
            <div>
              <label htmlFor="file-category" className="block text-sm font-bold text-primary dark:text-white mb-1">Categoria</label>
              <select
                id="file-category"
                value={newFileCategory}
                onChange={(e) => setNewFileCategory(e.target.value as FileCategory)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                {Object.values(FileCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="file-upload" className="block text-sm font-bold text-primary dark:text-white mb-1">Selecione o Arquivo</label>
              <input
                id="file-upload"
                type="file"
                onChange={(e) => setNewUploadFile(e.target.files ? e.target.files[0] : null)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark cursor-pointer"
                required
              />
              {newUploadFile && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Selecionado: {newUploadFile.name}</p>}
            </div>
          </form>
        </ZeModal>
      )}

      {/* CONTRACT CONTENT VIEWER MODAL */}
      {showContractContentModal && (
        <ZeModal
          isOpen={showContractContentModal}
          title={selectedContractTitle}
          message=""
          confirmText="Copiar Texto"
          onConfirm={async (e) => {
            e?.preventDefault(); // Pass event here
            try {
              await navigator.clipboard.writeText(selectedContractContent);
              setCopyContractSuccess(true);
              setTimeout(() => setCopyContractSuccess(false), 2000);
              showToastNotification("Conteúdo do contrato copiado!", 'success');
            } catch (err) {
              console.error("Erro ao copiar contrato:", err);
              showToastNotification("Falha ao copiar o contrato. Tente manualmente.", 'error');
            }
          }}
          onCancel={() => { setShowContractContentModal(false); setSelectedContractContent(''); setSelectedContractTitle(''); setCopyContractSuccess(false); }}
          type="INFO"
          cancelText="Fechar"
        >
          <div className="relative p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap font-mono text-sm text-primary dark:text-white">
              {selectedContractContent}
            </pre>
            {copyContractSuccess && (
                <div className="absolute top-2 right-2 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg animate-in fade-in">Copiado!</div>
            )}
          </div>
        </ZeModal>
      )}

      {/* ADD/EDIT CHECKLIST MODAL */}
      {showAddChecklistModal && (
        <ZeModal
          isOpen={showAddChecklistModal}
          title={editChecklistData ? "Editar Checklist" : "Adicionar Novo Checklist"}
          message=""
          confirmText={editChecklistData ? "Salvar Checklist" : "Adicionar Checklist"}
          onConfirm={editChecklistData ? handleEditChecklist : handleAddChecklist}
          onCancel={() => {
            setShowAddChecklistModal(false);
            setEditChecklistData(null);
            setNewChecklistName('');
            setNewChecklistCategory('');
            setNewChecklistItems(['']);
          }}
          isConfirming={zeModal.isConfirming}
          type={editChecklistData ? "INFO" : "SUCCESS"}
        >
          <form onSubmit={editChecklistData ? handleEditChecklist : handleAddChecklist} className="space-y-4">
            <div>
              <label htmlFor="checklist-name" className="block text-sm font-bold text-primary dark:text-white mb-1">Nome do Checklist</label>
              <input
                id="checklist-name"
                type="text"
                value={newChecklistName}
                onChange={(e) => setNewChecklistName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Fundações - Pré-Concretagem"
                required
              />
            </div>
            <div>
              <label htmlFor="checklist-category" className="block text-sm font-bold text-primary dark:text-white mb-1">Categoria (Opcional)</label>
              <select
                id="checklist-category"
                value={newChecklistCategory}
                onChange={(e) => setNewChecklistCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="">Nenhuma</option>
                {/* Dynamically generate categories based on work's steps for easier linking */}
                {steps.map(step => (
                    <option key={step.id} value={step.name}>{step.name}</option>
                ))}
                {/* Also allow general categories from templates */}
                {CHECKLIST_TEMPLATES.map(template => (
                  <option key={template.id} value={template.category}>{template.category}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ajuda a organizar e vincular a etapas.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-primary dark:text-white mb-1">Itens do Checklist</label>
              {newChecklistItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-center mb-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const updatedItems = [...newChecklistItems];
                      updatedItems[index] = e.target.value;
                      setNewChecklistItems(updatedItems);
                    }}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder={`Item ${index + 1}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updatedItems = newChecklistItems.filter((_, i) => i !== index);
                      setNewChecklistItems(updatedItems.length > 0 ? updatedItems : ['']); // Ensure at least one empty item
                    }}
                    className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    aria-label={`Remover item ${index + 1}`}
                  >
                    <i className="fa-solid fa-trash-alt text-sm"></i>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setNewChecklistItems([...newChecklistItems, ''])}
                className="mt-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-primary dark:text-white text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                aria-label="Adicionar novo item de checklist"
              >
                <i className="fa-solid fa-plus"></i> Adicionar Item
              </button>
            </div>
          </form>
        </ZeModal>
      )}

      {/* Confirmation Modal (general purpose) */}
      {zeModal.isOpen && (
        <ZeModal {...zeModal} />
      )}
    </div>
  );
};

export default WorkDetail;
