
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
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2 text-xl" /* OE #004: Increased text size */
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
          className="px-4 py-2 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" /* OE #004: Increased text size */
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

  // OE #001: State for initial orientation message
  const [showInitialOrientation, setShowInitialOrientation] = useState(false);


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

      // OE #001: Check if initial orientation should be shown
      const hasSeenOrientation = localStorage.getItem(`seen_work_orientation_${workId}`);
      if (!hasSeenOrientation) {
        setShowInitialOrientation(true);
      } else {
        setShowInitialOrientation(false);
      }

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

  // NEW: Function to handle payment confirmation
  const handlePaymentConfirmation = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!paymentExpenseData || !paymentAmount || Number(paymentAmount) <= 0) {
      showToastNotification("Valor de pagamento inválido.", 'warning');
      return;
    }
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addPaymentToExpense(paymentExpenseData.id, Number(paymentAmount), paymentDate);
      setShowAddPaymentModal(false);
      setPaymentAmount('');
      setNewPaymentDate(new Date().toISOString().split('T')[0]);
      await loadWorkData();
      showToastNotification("Pagamento registrado com sucesso!", 'success');
      showFinanceBadge();
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
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  }, [paymentExpenseData, paymentAmount, paymentDate, showToastNotification, loadWorkData, showFinanceBadge]);

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
      setNewChecklistItems(['']); // Start with one empty item
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
              <i className="fa-solid fa-exclamation-circle text-6xl mb-6 text-red-500"></i> {/* OE #004: Increased icon size, margin */}
              <h2 className="text-2xl font-black text-primary dark:text-white mb-3">Obra não encontrada!</h2> {/* OE #004: Increased margin */}
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8 text-base"> {/* OE #004: Increased margin, text size */}
                  Parece que esta obra não existe ou você não tem permissão para acessá-la.
              </p>
              <button
                  onClick={() => navigate('/')}
                  className="px-7 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors text-lg" /* OE #004: Increased padding, text size */
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
          <span className="font-bold text-base">{toastMessage}</span> {/* OE #004: Increased text size */}
        </div>
      )}


      {/* HEADER PREMIUM */}
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2 text-xl" /* OE #004: Increased text size */
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
          <p className="text-base text-slate-500 dark:text-slate-400 font-medium"> {/* OE #004: Increased text size */}
            {work?.address} • {work?.area}m² • Início: {formatDateDisplay(work?.startDate || null)}
          </p>
        </div>
      </div>

      {/* OE #001: Initial Orientation Message */}
      {showInitialOrientation && (
        <div 
          className={cx(
            "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-4", /* OE #004: Increased padding */
            "shadow-lg shadow-blue-500/10" // Using existing shadow pattern
          )}
          role="alert"
        >
          <i className="fa-solid fa-info-circle text-2xl mt-0.5 shrink-0"></i>
          <div className="flex-1">
            <p className="font-bold text-xl mb-2">Boas-vindas à sua obra!</p> {/* OE #004: Increased text size, margin */}
            <p className="text-base"> {/* OE #004: Increased text size */}
              Essa é a sua obra. Aqui você acompanha tudo o que está acontecendo.
              Normalmente, você começa olhando o andamento geral e depois confere gastos, materiais e prazos.
            </p>
            <button
              onClick={() => {
                setShowInitialOrientation(false);
                localStorage.setItem(`seen_work_orientation_${workId}`, 'true');
              }}
              className="mt-4 px-5 py-2.5 bg-blue-500 text-white text-base font-bold rounded-xl hover:bg-blue-600 transition-colors" /* OE #004: Increased padding, text size, margin */
              aria-label="Entendi! Ocultar mensagem de orientação"
            >
              Entendi!
            </button>
          </div>
        </div>
      )}


      {/* NAVIGATION TABS (Mobile hidden, shown in desktop and handled by BottomNavBar for mobile) */}
      <div className="hidden md:flex justify-around bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => goToTab('ETAPAS')}
          className={`flex-1 py-2 rounded-xl text-base font-bold transition-colors ${activeTab === 'ETAPAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`} /* OE #004: Increased text size */
        >
          Cronograma
        </button>
        <button
          onClick={() => goToTab('MATERIAIS')}
          className={`flex-1 py-2 rounded-xl text-base font-bold transition-colors ${activeTab === 'MATERIAIS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Materiais
        </button>
        <button
          onClick={() => goToTab('FINANCEIRO')}
          className={`relative flex-1 py-2 rounded-xl text-base font-bold transition-colors ${activeTab === 'FINANCEIRO' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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
          className={`flex-1 py-2 rounded-xl text-base font-bold transition-colors ${activeTab === 'FERRAMENTAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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
                <i className="fa-solid fa-calendar-times text-7xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
                <h2 className="text-2xl font-black text-primary dark:text-white mb-3">Ainda não existe um cronograma para esta obra.</h2> {/* OE #004: Increased margin */}
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6 text-base"> {/* OE #004: Increased text size */}
                  Crie um cronograma seguro com base na estrutura da obra usando o Planejador AI.
                </p>
                <button
                  onClick={() => navigate(`/work/${workId}/ai-planner`)}
                  className="px-6 py-3 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" /* OE #004: Increased padding, text size */
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
                  className="mt-4 px-6 py-3 bg-primary text-white text-base font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center gap-2" /* OE #004: Increased padding, text size */
                  aria-label="Adicionar primeira etapa manualmente"
                >
                  <i className="fa-solid fa-plus-circle"></i> Adicionar Etapa Manualmente
                </button>
              </div>
            ) : (
              <div className="space-y-5"> {/* OE #004: Increased space-y */}
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
                    className="px-4 py-2 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" /* OE #004: Increased text size */
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
                          "px-3 py-1 rounded-full text-sm font-bold uppercase", /* OE #004: Increased text size */
                          statusDetails.bgColor,
                          statusDetails.textColor,
                          statusDetails.shadowClass
                        )}>
                          <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                        </span>
                      </div>
                      <p className="text-base text-slate-500 dark:text-slate-400"> {/* OE #004: Increased text size */}
                        Início: {formatDateDisplay(step.startDate)} &bull; Término Previsto: {formatDateDisplay(step.endDate)}
                      </p>
                      {step.realDate && (
                        <p className="text-base text-green-600 dark:text-green-400 mt-1"> {/* OE #004: Increased text size */}
                          <i className="fa-solid fa-calendar-check mr-1"></i> Concluído em: {formatDateDisplay(step.realDate)}
                        </p>
                      )}
                      {step.status === StepStatus.DELAYED && (
                        <p className="text-base text-red-500 dark:text-red-400 mt-1"> {/* OE #004: Increased text size */}
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
                            "px-4 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-2", /* OE #004: Increased padding, text size */
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
                          className="ml-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed" /* OE #004: Increased padding, text size */
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
                    className="px-4 py-2 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" /* OE #004: Increased text size */
                    aria-label="Adicionar novo material"
                >
                    <i className="fa-solid fa-plus"></i> Novo
                </button>
            </div>

            {materials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <i className="fa-solid fa-boxes-stacked text-7xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
                <h2 className="text-2xl font-black text-primary dark:text-white mb-3">Ainda não existe uma lista de materiais para esta obra.</h2> {/* OE #004: Increased margin */}
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6 text-base"> {/* OE #004: Increased text size */}
                  Gere uma lista segura com base na estrutura da obra.
                </p>
                <button
                  onClick={handleGenerateMaterials}
                  disabled={loading}
                  className="px-6 py-3 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed" /* OE #004: Increased padding, text size */
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
                    className="w-full md:w-auto px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary dark:text-white focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all text-base" /* OE #004: Increased text size */
                    aria-label="Filtrar materiais por etapa"
                  >
                    <option value="all">Todas as Etapas</option>
                    {steps.map(step => (
                      <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                    ))}
                  </select>
                </div>

                {groupedMaterials.length === 0 ? (
                  <p className="text-center text-slate-400 py-10 italic text-base">Nenhum material encontrado para o filtro selecionado. Tente outro filtro ou adicione novos materiais.</p> /* OE #004: Increased text size */
                ) : (
                  groupedMaterials.map(group => (
                    <div key={group.stepId} className="space-y-5"> {/* OE #004: Increased space-y */}
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
                            <p className="text-base text-slate-500 dark:text-slate-400"> {/* OE #004: Increased text size */}
                              {material.purchasedQty} / {material.plannedQty} {material.unit} Comprados
                            </p>
                            {renderMaterialProgressBar(material)}
                            <p className="text-base font-bold text-primary dark:text-white mt-3">Custo Total: {formatCurrency(material.totalCost || 0)}</p> {/* OE #004: Increased text size */}
                            <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
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
                                className="px-3 py-1 bg-primary text-white text-base font-bold rounded-lg hover:bg-primary-light transition-colors" /* OE #004: Increased text size */
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8"> {/* OE #004: Increased gap */}
                <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                    <p className="text-base text-slate-500 dark:text-slate-400 mb-1">Orçamento Planejado</p> {/* OE #004: Increased text size */}
                    <h3 className="text-xl font-bold text-primary dark:text-white">{formatCurrency(work?.budgetPlanned || 0)}</h3>
                </div>
                <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                    <p className="text-base text-slate-500 dark:text-slate-400 mb-1">Gasto Total</p> {/* OE #004: Increased text size */}
                    <h3 className={`text-xl font-bold ${calculateTotalExpenses > (work?.budgetPlanned || 0) ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(calculateTotalExpenses)}</h3>
                </div>
                <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                    <p className="text-base text-slate-500 dark:text-slate-400 mb-1">Balanço</p> {/* OE #004: Increased text size */}
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
                    className="px-4 py-2 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" /* OE #004: Increased text size */
                    aria-label="Adicionar nova despesa"
                >
                    <i className="fa-solid fa-plus"></i> Nova
                </button>
            </div>

            {expenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <i className="fa-solid fa-receipt text-7xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
                    <h2 className="text-2xl font-black text-primary dark:text-white mb-3">Nenhuma despesa registrada ainda.</h2> {/* OE #004: Increased margin */}
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-base"> {/* OE #004: Increased text size */}
                        Comece a registrar seus gastos para ter controle total do financeiro da sua obra.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedExpensesByStep.map(group => (
                        <div key={group.stepName} className="space-y-5"> {/* OE #004: Increased space-y */}
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
                                        <p className="text-base text-slate-500 dark:text-slate-400"> {/* OE #004: Increased text size */}
                                            Previsto: {formatCurrency(expense.amount)}
                                            {agreed !== expense.amount && ` (Combinado: ${formatCurrency(agreed)})`}
                                        </p>
                                        <p className="text-base text-slate-500 dark:text-slate-400"> {/* OE #004: Increased text size */}
                                            Pago: {formatCurrency(expense.paidAmount || 0)}
                                            {remaining > 0 && <span className="ml-2 text-red-500">(Falta: {formatCurrency(remaining)})</span>}
                                        </p>
                                        {renderExpenseProgressBar(expense)}
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                            <p className="text-base font-bold text-primary dark:text-white">Categoria: {expense.category}</p> {/* OE #004: Increased text size */}
                                            <div className="flex gap-2">
                                                {expense.status !== ExpenseStatus.COMPLETED && expense.status !== ExpenseStatus.OVERPAID && (
                                                    <button
                                                        onClick={() => {
                                                            setPaymentExpenseData(expense);
                                                            setPaymentAmount(String(remaining)); // Pre-fill with remaining amount
                                                            setShowAddPaymentModal(true);
                                                        }}
                                                        className="px-3 py-1 bg-secondary text-white text-base font-bold rounded-lg hover:bg-secondary-dark transition-colors" /* OE #004: Increased text size */
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
                                                    className="px-3 py-1 bg-primary text-white text-base font-bold rounded-lg hover:bg-primary-light transition-colors" /* OE #004: Increased text size */
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
                  <i className="fa-solid fa-hard-hat text-7xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
                  <h3 className="text-2xl font-black text-primary dark:text-white mb-3">Nenhum trabalhador cadastrado.</h3> {/* OE #004: Increased margin */}
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-base"> {/* OE #004: Increased text size */}
                    Adicione sua equipe para gerenciar diárias e pagamentos.
                  </p>
                </div>
              ) : (
                <div className="space-y-5"> {/* OE #004: Increased space-y */}
                  {workers.map(worker => (
                    <div key={worker.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-primary dark:text-white text-base">{worker.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500 text-white">{worker.role}</span>
                      </div>
                      <p className="text-base text-slate-500 dark:text-slate-400"> {/* OE #004: Increased text size */}
                        Tel: {worker.phone} {worker.dailyRate ? ` • Diária: ${formatCurrency(worker.dailyRate)}` : ''}
                      </p>
                      {worker.notes && <p className="text-sm text-slate-400 mt-1">{worker.notes}</p>} {/* OE #004: Increased text size */}
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
                          className="px-3 py-1 bg-primary text-white text-base font-bold rounded-lg hover:bg-primary-light transition-colors" /* OE #004: Increased text size */
                          aria-label={`Editar trabalhador ${worker.name}`}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: `Excluir ${worker.name}?`,
                            message: `Tem certeza que deseja excluir o trabalhador ${worker.name}?`,
                            type: 'DANGER',
                            confirmText: 'Sim, Excluir',
                            onConfirm: async (_e?: React.FormEvent) => handleDeleteWorker(worker.id),
                            onCancel: async (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                          })}
                          className="ml-2 px-3 py-1 bg-red-500 text-white text-base font-bold rounded-lg hover:bg-red-600 transition-colors"
                          aria-label={`Excluir trabalhador ${worker.name}`}
                        >
                          Excluir
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
                  <i className="fa-solid fa-truck-fast text-7xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
                  <h3 className="text-2xl font-black text-primary dark:text-white mb-3">Nenhum fornecedor cadastrado.</h3> {/* OE #004: Increased margin */}
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-base"> {/* OE #004: Increased text size */}
                    Adicione seus fornecedores de materiais e serviços.
                  </p>
                </div>
              ) : (
                <div className="space-y-5"> {/* OE #004: Increased space-y */}
                  {suppliers.map(supplier => (
                    <div key={supplier.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:scale-[1.005] hover:shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-primary dark:text-white text-base">{supplier.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500 text-white">{supplier.category}</span>
                      </div>
                      <p className="text-base text-slate-500 dark:text-slate-400"> {/* OE #004: Increased text size */}
                        Tel: {supplier.phone} {supplier.email && ` • Email: ${supplier.email}`}
                      </p>
                      {supplier.address && <p className="text-sm text-slate-400 mt-1">Endereço: {supplier.address}</p>} {/* OE #004: Increased text size */}
                      {supplier.notes && <p className="text-sm text-slate-400 mt-1">{supplier.notes}</p>} {/* OE #004: Increased text size */}
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
                          className="px-3 py-1 bg-primary text-white text-base font-bold rounded-lg hover:bg-primary-light transition-colors" /* OE #004: Increased text size */
                          aria-label={`Editar fornecedor ${supplier.name}`}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: `Excluir ${supplier.name}?`,
                            message: `Tem certeza que deseja excluir o fornecedor ${supplier.name}?`,
                            type: 'DANGER',
                            confirmText: 'Sim, Excluir',
                            onConfirm: async (_e?: React.FormEvent) => handleDeleteSupplier(supplier.id, workId),
                            onCancel: async (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                          })}
                          className="ml-2 px-3 py-1 bg-red-500 text-white text-base font-bold rounded-lg hover:bg-red-600 transition-colors"
                          aria-label={`Excluir fornecedor ${supplier.name}`}
                        >
                          Excluir
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
                title="Fotos da Obra" 
                onBack={() => goToSubView('NONE')} 
                onAdd={() => setShowAddPhotoModal(true)}
                loading={uploadingPhoto} // Show spinner on add button if uploading
              />
              {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-camera-retro text-7xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
                  <h3 className="text-2xl font-black text-primary dark:text-white mb-3">Nenhuma foto adicionada.</h3> {/* OE #004: Increased margin */}
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-base"> {/* OE #004: Increased text size */}
                    Registre cada etapa da sua obra.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5"> {/* OE #004: Increased gap */}
                  {photos.map(photo => (
                    <div key={photo.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-md">
                      <img src={photo.url} alt={photo.description} className="w-full h-48 object-cover" />
                      <div className="p-3">
                        <p className="font-bold text-primary dark:text-white text-base mb-1">{photo.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <i className="fa-regular fa-calendar"></i> {formatDateDisplay(photo.date)}
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-500/10 text-blue-600">
                            {photo.type}
                          </span>
                        </p>
                        <div className="flex justify-end mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                          <button
                            onClick={() => setZeModal({
                              isOpen: true,
                              title: `Excluir Foto?`,
                              message: `Tem certeza que deseja excluir esta foto (${photo.description})?`,
                              type: 'DANGER',
                              confirmText: 'Sim, Excluir',
                              onConfirm: async (_e?: React.FormEvent) => handleDeletePhoto(photo),
                              onCancel: async (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                            })}
                            className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors" /* OE #004: Increased text size */
                            aria-label={`Excluir foto ${photo.description}`}
                          >
                            Excluir
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
                title="Arquivos da Obra" 
                onBack={() => goToSubView('NONE')} 
                onAdd={() => setShowAddFileModal(true)}
                loading={uploadingFile} // Show spinner on add button if uploading
              />
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-folder-open text-7xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
                  <h3 className="text-2xl font-black text-primary dark:text-white mb-3">Nenhum arquivo adicionado.</h3> {/* OE #004: Increased margin */}
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-base"> {/* OE #004: Increased text size */}
                    Organize todos os documentos da sua obra em um só lugar.
                  </p>
                </div>
              ) : (
                <div className="space-y-4"> {/* OE #004: Increased space-y */}
                  {files.map(file => (
                    <div key={file.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-start gap-4 shadow-md">
                      <div className="w-10 h-10 flex items-center justify-center text-secondary text-2xl shrink-0">
                        <i className="fa-solid fa-file-alt"></i>
                      </div>
                      <div className="flex-1">
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="font-bold text-primary dark:text-white text-base hover:text-secondary transition-colors block leading-tight">{file.name}</a>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                          <span><i className="fa-regular fa-calendar mr-1"></i> {formatDateDisplay(file.date)}</span>
                          <span><i className="fa-solid fa-tag mr-1"></i> {file.category}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setZeModal({
                          isOpen: true,
                          title: `Excluir Arquivo?`,
                          message: `Tem certeza que deseja excluir o arquivo ${file.name}?`,
                          type: 'DANGER',
                          confirmText: 'Sim, Excluir',
                          onConfirm: async (_e?: React.FormEvent) => handleDeleteFile(file),
                          onCancel: async (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                        })}
                        className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors shrink-0" /* OE #004: Increased text size */
                        aria-label={`Excluir arquivo ${file.name}`}
                      >
                        Excluir
                      </button>
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
              <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6 text-base"> {/* OE #004: Increased text size */}
                Escolha um modelo e gere documentos personalizados para sua obra.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CONTRACT_TEMPLATES.map(contract => (
                  <button
                    key={contract.id}
                    onClick={() => {
                      setSelectedContractTitle(contract.title);
                      setSelectedContractContent(contract.contentTemplate);
                      setShowContractContentModal(true);
                      setCopyContractSuccess(false); // Reset copy status
                    }}
                    className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left shadow-sm hover:border-secondary/50 transition-colors"
                  >
                    <i className="fa-solid fa-file-contract text-2xl text-secondary mr-3"></i>
                    <h3 className="font-bold text-primary dark:text-white text-base">{contract.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Categoria: {contract.category}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSubView === 'CHECKLIST' && (
            <div className={cx(surface, card)}>
              <ToolSubViewHeader 
                title="Checklists Inteligentes" 
                onBack={() => goToSubView('NONE')} 
                onAdd={() => {
                  setShowAddChecklistModal(true);
                  setEditChecklistData(null); // Clear edit data
                  setNewChecklistName('');
                  setNewChecklistCategory('');
                  setNewChecklistItems(['']); // Start with one empty item
                }}
                loading={isAddingChecklist}
              />
              {checklists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <i className="fa-solid fa-list-check text-7xl text-slate-400 mb-6"></i> {/* OE #004: Increased icon size, margin */}
                  <h3 className="text-2xl font-black text-primary dark:text-white mb-3">Nenhum checklist cadastrado.</h3> {/* OE #004: Increased margin */}
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-base"> {/* OE #004: Increased text size */}
                    Crie listas de verificação para garantir a qualidade em cada etapa.
                  </p>
                  <button
                    onClick={() => {
                      setShowAddChecklistModal(true);
                      setEditChecklistData(null);
                      setNewChecklistName('');
                      setNewChecklistCategory('');
                      setNewChecklistItems(['']);
                    }}
                    className="mt-4 px-6 py-3 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2" /* OE #004: Increased padding, text size */
                    aria-label="Adicionar primeiro checklist"
                  >
                    <i className="fa-solid fa-plus-circle"></i> Criar Checklist
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {checklists.map(checklist => (
                    <div key={checklist.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-md">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-primary dark:text-white text-lg">{checklist.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-600 dark:text-green-400">{checklist.category}</span>
                      </div>
                      <ul className="space-y-2">
                        {checklist.items.map((item, itemIndex) => (
                          <li key={item.id || itemIndex} className="flex items-start text-sm text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              // Read-only on this view, actual update happens in a modal or dedicated page
                              onChange={() => {}} 
                              disabled 
                              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-secondary focus:ring-secondary/50 mt-1 mr-3"
                            />
                            {item.text}
                          </li>
                        ))}
                      </ul>
                      <div className="flex justify-end items-center mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button
                          onClick={() => {
                            setEditChecklistData(checklist);
                            setNewChecklistName(checklist.name);
                            setNewChecklistCategory(checklist.category);
                            setNewChecklistItems(checklist.items.map(item => item.text));
                            setShowAddChecklistModal(true);
                          }}
                          className="px-3 py-1 bg-primary text-white text-base font-bold rounded-lg hover:bg-primary-light transition-colors"
                          aria-label={`Editar checklist ${checklist.name}`}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: `Excluir Checklist?`,
                            message: `Tem certeza que deseja excluir o checklist ${checklist.name}?`,
                            type: 'DANGER',
                            confirmText: 'Sim, Excluir',
                            onConfirm: async (_e?: React.FormEvent) => handleDeleteChecklist(checklist.id),
                            onCancel: async (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                          })}
                          className="ml-2 px-3 py-1 bg-red-500 text-white text-base font-bold rounded-lg hover:bg-red-600 transition-colors"
                          aria-label={`Excluir checklist ${checklist.name}`}
                        >
                          Excluir
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

      {/* --- MODALS --- */}

      {/* Add/Edit Step Modal */}
      {showAddStepModal && (
        <ZeModal
          isOpen={showAddStepModal}
          title={editStepData ? "Editar Etapa" : "Adicionar Nova Etapa"}
          message="" // Empty message because content is in children
          confirmText={editStepData ? "Salvar Alterações" : "Adicionar Etapa"}
          onConfirm={editStepData ? handleEditStep : handleAddStep}
          onCancel={() => { setShowAddStepModal(false); setEditStepData(null); setNewEstimatedDurationDays(''); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editStepData ? handleEditStep : handleAddStep} className="space-y-4">
            <div>
              <label htmlFor="stepName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome da Etapa</label>
              <input
                type="text"
                id="stepName"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                placeholder="Ex: Fundações, Instalações Elétricas"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Nome da etapa"
                // Disable name field if step has started
                disabled={!!editStepData?.startDate}
                title={!!editStepData?.startDate ? "Nome não editável para etapas iniciadas" : undefined}
              />
            </div>
            <div>
              <label htmlFor="estimatedDurationDays" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Duração Estimada (dias)</label>
              <input
                type="number"
                id="estimatedDurationDays"
                value={newEstimatedDurationDays}
                onChange={(e) => setNewEstimatedDurationDays(e.target.value)}
                placeholder="Ex: 7, 30"
                min="1"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Duração estimada em dias"
              />
            </div>
            <div>
              <label htmlFor="stepStartDate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data de Início (Opcional)</label>
              <input
                type="date"
                id="stepStartDate"
                value={newStepStartDate || ''}
                onChange={(e) => setNewStepStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Data de início da etapa"
                // Disable start date field if it's already set
                disabled={!!editStepData?.startDate}
                title={!!editStepData?.startDate ? "Data de início não editável para etapas já iniciadas" : undefined}
              />
            </div>
            <div>
              <label htmlFor="stepEndDate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data de Término (Opcional)</label>
              <input
                type="date"
                id="stepEndDate"
                value={newStepEndDate || ''}
                onChange={(e) => setNewStepEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Data de término da etapa"
              />
            </div>
            {/* The modal's internal buttons will handle form submission */}
            <button type="submit" hidden></button> 
          </form>
        </ZeModal>
      )}

      {/* Add/Edit Material Modal */}
      {showAddMaterialModal && (
        <ZeModal
          isOpen={showAddMaterialModal}
          title={editMaterialData ? "Editar Material ou Registrar Compra" : "Adicionar Novo Material"}
          message=""
          confirmText={editMaterialData ? "Salvar / Registrar" : "Adicionar Material"}
          onConfirm={editMaterialData ? handleEditMaterial : handleAddMaterial}
          onCancel={() => { setShowAddMaterialModal(false); setEditMaterialData(null); setPurchaseQtyInput(''); setPurchaseCostInput(''); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editMaterialData ? handleEditMaterial : handleAddMaterial} className="space-y-4">
            <div>
              <label htmlFor="materialName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Material</label>
              <input
                type="text"
                id="materialName"
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                placeholder="Ex: Cimento, Tijolo, Piso"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Nome do material"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0}
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Campo não editável após a primeira compra." : undefined}
              />
            </div>
            <div>
              <label htmlFor="materialBrand" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Marca (Opcional)</label>
              <input
                type="text"
                id="materialBrand"
                value={newMaterialBrand}
                onChange={(e) => setNewMaterialBrand(e.target.value)}
                placeholder="Ex: Votorantim, Portobello"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Marca do material"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0}
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Campo não editável após a primeira compra." : undefined}
              />
            </div>
            <div>
              <label htmlFor="materialPlannedQty" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Quantidade Planejada</label>
              <input
                type="number"
                id="materialPlannedQty"
                value={newMaterialPlannedQty}
                onChange={(e) => setNewMaterialPlannedQty(e.target.value)}
                placeholder="Ex: 50, 1000"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Quantidade planejada do material"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0}
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Campo não editável após a primeira compra." : undefined}
              />
            </div>
            <div>
              <label htmlFor="materialUnit" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
              <input
                type="text"
                id="materialUnit"
                value={newMaterialUnit}
                onChange={(e) => setNewMaterialUnit(e.target.value)}
                placeholder="Ex: saco, m², barra"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Unidade de medida do material"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0}
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Campo não editável após a primeira compra." : undefined}
              />
            </div>
            <div>
              <label htmlFor="materialCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria (Opcional)</label>
              <input
                type="text"
                id="materialCategory"
                value={newMaterialCategory}
                onChange={(e) => setNewMaterialCategory(e.target.value)}
                placeholder="Ex: Hidráulica, Elétrica"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Categoria do material"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0}
                title={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 ? "Campo não editável após a primeira compra." : undefined}
              />
            </div>
            <div>
              <label htmlFor="materialStepId" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Etapa Relacionada (Opcional)</label>
              <select
                id="materialStepId"
                value={newMaterialStepId}
                onChange={(e) => setNewMaterialStepId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Etapa relacionada ao material"
              >
                <option value="none">Nenhuma</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                ))}
              </select>
            </div>
            {editMaterialData && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Registrar Nova Compra</h3>
                <div>
                  <label htmlFor="purchaseQty" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Quantidade Comprada</label>
                  <input
                    type="number"
                    id="purchaseQty"
                    value={purchaseQtyInput}
                    onChange={(e) => setPurchaseQtyInput(e.target.value)}
                    placeholder="Quantidade comprada"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    aria-label="Quantidade de material comprada"
                  />
                </div>
                <div>
                  <label htmlFor="purchaseCost" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Custo Total da Compra (R$)</label>
                  <input
                    type="number"
                    id="purchaseCost"
                    value={purchaseCostInput}
                    onChange={(e) => setPurchaseCostInput(e.target.value)}
                    placeholder="Custo da compra"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    aria-label="Custo total da compra"
                  />
                </div>
              </div>
            )}
            {/* The modal's internal buttons will handle form submission */}
            <button type="submit" hidden></button>
          </form>
        </ZeModal>
      )}

      {/* Add/Edit Expense Modal */}
      {showAddExpenseModal && (
        <ZeModal
          isOpen={showAddExpenseModal}
          title={editExpenseData ? "Editar Despesa" : "Adicionar Nova Despesa"}
          message=""
          confirmText={editExpenseData ? "Salvar Alterações" : "Adicionar Despesa"}
          onConfirm={editExpenseData ? handleEditExpense : handleAddExpense}
          onCancel={() => { setShowAddExpenseModal(false); setEditExpenseData(null); setNewExpenseTotalAgreed(''); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editExpenseData ? handleEditExpense : handleAddExpense} className="space-y-4">
            <div>
              <label htmlFor="expenseDescription" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
              <input
                type="text"
                id="expenseDescription"
                value={newExpenseDescription}
                onChange={(e) => setNewExpenseDescription(e.target.value)}
                placeholder="Ex: Pagamento pedreiro, Aluguel de máquina"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Descrição da despesa"
              />
            </div>
            <div>
              <label htmlFor="expenseAmount" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Previsto (R$)</label>
              <input
                type="number"
                id="expenseAmount"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
                placeholder="Ex: 500.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Valor previsto da despesa"
                // Disable if expense already has payments
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0}
                title={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 ? "Valor não editável após pagamentos." : undefined}
              />
            </div>
            <div>
              <label htmlFor="expenseTotalAgreed" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Valor Combinado (R$ - Opcional)</label>
              <input
                type="number"
                id="expenseTotalAgreed"
                value={newExpenseTotalAgreed}
                onChange={(e) => setNewExpenseTotalAgreed(e.target.value)}
                placeholder="Valor final combinado (se diferente do previsto)"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Valor total combinado para pagamento"
                 // Disable if expense already has payments
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0}
                title={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 ? "Valor não editável após pagamentos." : undefined}
              />
            </div>
            <div>
              <label htmlFor="expenseCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
              <select
                id="expenseCategory"
                value={newExpenseCategory}
                onChange={(e) => setNewExpenseCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Categoria da despesa"
                 // Disable if expense already has payments
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0}
                title={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 ? "Categoria não editável após pagamentos." : undefined}
              >
                {Object.values(ExpenseCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="Outro">Outro</option> {/* Added for flexibility */}
              </select>
            </div>
            <div>
              <label htmlFor="expenseDate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data</label>
              <input
                type="date"
                id="expenseDate"
                value={newExpenseDate}
                onChange={(e) => setNewExpenseDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Data da despesa"
                 // Disable if expense already has payments
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0}
                title={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 ? "Data não editável após pagamentos." : undefined}
              />
            </div>
            <div>
              <label htmlFor="expenseStepId" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Etapa Relacionada (Opcional)</label>
              <select
                id="expenseStepId"
                value={newExpenseStepId}
                onChange={(e) => setNewExpenseStepId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Etapa relacionada à despesa"
              >
                <option value="none">Nenhuma</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                ))}
              </select>
            </div>
            {/* Worker and Supplier linking */}
            <div>
                <label htmlFor="expenseWorkerId" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Trabalhador (Opcional)</label>
                <select
                    id="expenseWorkerId"
                    value={newExpenseWorkerId}
                    onChange={(e) => setNewExpenseWorkerId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    aria-label="Trabalhador relacionado à despesa"
                >
                    <option value="none">Nenhum</option>
                    {workers.map(worker => (
                        <option key={worker.id} value={worker.id}>{worker.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="expenseSupplierId" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Fornecedor (Opcional)</label>
                <select
                    id="expenseSupplierId"
                    value={newExpenseSupplierId}
                    onChange={(e) => setNewExpenseSupplierId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    aria-label="Fornecedor relacionado à despesa"
                >
                    <option value="none">Nenhum</option>
                    {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                </select>
            </div>
            <button type="submit" hidden></button>
          </form>
        </ZeModal>
      )}

      {/* Add Payment Modal (for partial payments) */}
      {showAddPaymentModal && paymentExpenseData && (
        <ZeModal
          isOpen={showAddPaymentModal}
          title={`Registrar Pagamento para "${paymentExpenseData.description}"`}
          message=""
          confirmText="Registrar Pagamento"
          onConfirm={handlePaymentConfirmation}
          onCancel={() => { setShowAddPaymentModal(false); setPaymentExpenseData(null); setPaymentAmount(''); setNewPaymentDate(new Date().toISOString().split('T')[0]); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={handlePaymentConfirmation} className="space-y-4"> {/* Dummy submit */}
            <div>
              <label htmlFor="paymentAmount" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Valor a Pagar (R$)</label>
              <input
                type="number"
                id="paymentAmount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Valor a pagar"
              />
            </div>
            <div>
              <label htmlFor="paymentDate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Data do Pagamento</label>
              <input
                type="date"
                id="paymentDate"
                value={paymentDate}
                onChange={(e) => setNewPaymentDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Data do pagamento"
              />
            </div>
            {/* Hidden submit to enable Enter key press in modal */}
            <button type="submit" hidden></button>
          </form>
        </ZeModal>
      )}

      {/* Add/Edit Worker Modal */}
      {showAddWorkerModal && (
        <ZeModal
          isOpen={showAddWorkerModal}
          title={editWorkerData ? "Editar Trabalhador" : "Adicionar Novo Trabalhador"}
          message=""
          confirmText={editWorkerData ? "Salvar Alterações" : "Adicionar Trabalhador"}
          onConfirm={editWorkerData ? handleEditWorker : handleAddWorker}
          onCancel={() => { setShowAddWorkerModal(false); setEditWorkerData(null); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editWorkerData ? handleEditWorker : handleAddWorker} className="space-y-4">
            <div>
              <label htmlFor="workerName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome</label>
              <input
                type="text"
                id="workerName"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                placeholder="Nome completo do trabalhador"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Nome do trabalhador"
              />
            </div>
            <div>
              <label htmlFor="workerRole" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Função</label>
              <select
                id="workerRole"
                value={newWorkerRole}
                onChange={(e) => setNewWorkerRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Função do trabalhador"
              >
                <option value="">Selecione a Função</option>
                {STANDARD_JOB_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="workerPhone" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Telefone (WhatsApp)</label>
              <input
                type="tel"
                id="workerPhone"
                value={newWorkerPhone}
                onChange={(e) => setNewWorkerPhone(e.target.value)}
                placeholder="(DDD) 9XXXX-XXXX"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Telefone do trabalhador"
              />
            </div>
            <div>
              <label htmlFor="workerDailyRate" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Diária (R$ - Opcional)</label>
              <input
                type="number"
                id="workerDailyRate"
                value={newWorkerDailyRate}
                onChange={(e) => setNewWorkerDailyRate(e.target.value)}
                placeholder="Ex: 150.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Diária do trabalhador"
              />
            </div>
            <div>
              <label htmlFor="workerNotes" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Observações (Opcional)</label>
              <textarea
                id="workerNotes"
                value={newWorkerNotes}
                onChange={(e) => setNewWorkerNotes(e.target.value)}
                placeholder="Detalhes sobre o trabalhador ou acordo"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Observações sobre o trabalhador"
              ></textarea>
            </div>
            <button type="submit" hidden></button>
          </form>
        </ZeModal>
      )}

      {/* Add/Edit Supplier Modal */}
      {showAddSupplierModal && (
        <ZeModal
          isOpen={showAddSupplierModal}
          title={editSupplierData ? "Editar Fornecedor" : "Adicionar Novo Fornecedor"}
          message=""
          confirmText={editSupplierData ? "Salvar Alterações" : "Adicionar Fornecedor"}
          onConfirm={editSupplierData ? handleEditSupplier : handleAddSupplier}
          onCancel={() => { setShowAddSupplierModal(false); setEditSupplierData(null); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editSupplierData ? handleEditSupplier : handleAddSupplier} className="space-y-4">
            <div>
              <label htmlFor="supplierName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Fornecedor</label>
              <input
                type="text"
                id="supplierName"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Ex: Cimentos da Silva, Materiais Express"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Nome do fornecedor"
              />
            </div>
            <div>
              <label htmlFor="supplierCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
              <select
                id="supplierCategory"
                value={newSupplierCategory}
                onChange={(e) => setNewSupplierCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Categoria do fornecedor"
              >
                <option value="">Selecione a Categoria</option>
                {STANDARD_SUPPLIER_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="supplierPhone" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Telefone (WhatsApp)</label>
              <input
                type="tel"
                id="supplierPhone"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="(DDD) 9XXXX-XXXX"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Telefone do fornecedor"
              />
            </div>
            <div>
              <label htmlFor="supplierEmail" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail (Opcional)</label>
              <input
                type="email"
                id="supplierEmail"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                placeholder="contato@fornecedor.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="E-mail do fornecedor"
              />
            </div>
            <div>
              <label htmlFor="supplierAddress" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Endereço (Opcional)</label>
              <input
                type="text"
                id="supplierAddress"
                value={newSupplierAddress}
                onChange={(e) => setNewSupplierAddress(e.target.value)}
                placeholder="Endereço completo ou bairro"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Endereço do fornecedor"
              />
            </div>
            <div>
              <label htmlFor="supplierNotes" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Observações (Opcional)</label>
              <textarea
                id="supplierNotes"
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                placeholder="Detalhes de contato, promoções, etc."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Observações sobre o fornecedor"
              ></textarea>
            </div>
            <button type="submit" hidden></button>
          </form>
        </ZeModal>
      )}

      {/* Add Photo Modal */}
      {showAddPhotoModal && (
        <ZeModal
          isOpen={showAddPhotoModal}
          title="Adicionar Nova Foto"
          message=""
          confirmText="Fazer Upload"
          onConfirm={handleAddPhoto}
          onCancel={() => { setShowAddPhotoModal(false); setNewPhotoFile(null); setNewPhotoDescription(''); setNewPhotoType('PROGRESS'); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={handleAddPhoto} className="space-y-4">
            <div>
              <label htmlFor="photoDescription" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
              <input
                type="text"
                id="photoDescription"
                value={newPhotoDescription}
                onChange={(e) => setNewPhotoDescription(e.target.value)}
                placeholder="Ex: Obra em 01/01/2024, Fundação etapa 1"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Descrição da foto"
              />
            </div>
            <div>
              <label htmlFor="photoType" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
              <select
                id="photoType"
                value={newPhotoType}
                onChange={(e) => setNewPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'PROGRESS')}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Tipo de foto"
              >
                <option value="PROGRESS">Progresso</option>
                <option value="BEFORE">Antes</option>
                <option value="AFTER">Depois</option>
              </select>
            </div>
            <div>
              <label htmlFor="photoFile" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Arquivo da Foto</label>
              <input
                type="file"
                id="photoFile"
                accept="image/*"
                onChange={(e) => setNewPhotoFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark"
                required
                aria-label="Selecionar arquivo de foto"
              />
            </div>
            <button type="submit" hidden></button>
          </form>
        </ZeModal>
      )}

      {/* Add File Modal */}
      {showAddFileModal && (
        <ZeModal
          isOpen={showAddFileModal}
          title="Adicionar Novo Arquivo"
          message=""
          confirmText="Fazer Upload"
          onConfirm={handleAddFile}
          onCancel={() => { setShowAddFileModal(false); setNewUploadFile(null); setNewFileName(''); setNewFileCategory(FileCategory.GENERAL); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={handleAddFile} className="space-y-4">
            <div>
              <label htmlFor="fileName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Arquivo</label>
              <input
                type="text"
                id="fileName"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Ex: Planta Baixa, Orçamento Final"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Nome do arquivo"
              />
            </div>
            <div>
              <label htmlFor="fileCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
              <select
                id="fileCategory"
                value={newFileCategory}
                onChange={(e) => setNewFileCategory(e.target.value as FileCategory)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Categoria do arquivo"
              >
                {Object.values(FileCategory).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="uploadFile" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Arquivo para Upload</label>
              <input
                type="file"
                id="uploadFile"
                onChange={(e) => setNewUploadFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark"
                required
                aria-label="Selecionar arquivo para upload"
              />
            </div>
            <button type="submit" hidden></button>
          </form>
        </ZeModal>
      )}

      {/* Contract Content Viewer Modal */}
      {showContractContentModal && (
        <ZeModal
          isOpen={showContractContentModal}
          title={selectedContractTitle}
          message="" // Content passed as children
          confirmText="Copiar Texto"
          onConfirm={async (_e?: React.FormEvent) => {
            await navigator.clipboard.writeText(selectedContractContent);
            setCopyContractSuccess(true);
            setTimeout(() => setCopyContractSuccess(false), 2000);
            showToastNotification("Conteúdo copiado para a área de transferência!", 'success');
          }}
          onCancel={() => setShowContractContentModal(false)}
          type="INFO"
          cancelText="Fechar"
        >
          {copyContractSuccess && (
            <div className="p-3 bg-green-500/20 text-green-700 dark:text-green-300 rounded-xl mb-4 text-sm font-bold text-center animate-in fade-in">
              <i className="fa-solid fa-check-circle mr-2"></i> Copiado!
            </div>
          )}
          <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-mono">
            {selectedContractContent}
          </div>
        </ZeModal>
      )}

      {/* Add/Edit Checklist Modal */}
      {showAddChecklistModal && (
        <ZeModal
          isOpen={showAddChecklistModal}
          title={editChecklistData ? "Editar Checklist" : "Criar Novo Checklist"}
          message=""
          confirmText={editChecklistData ? "Salvar Alterações" : "Criar Checklist"}
          onConfirm={editChecklistData ? handleEditChecklist : handleAddChecklist}
          onCancel={() => { setShowAddChecklistModal(false); setEditChecklistData(null); setNewChecklistName(''); setNewChecklistCategory(''); setNewChecklistItems(['']); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editChecklistData ? handleEditChecklist : handleAddChecklist} className="space-y-4">
            <div>
              <label htmlFor="checklistName" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nome do Checklist</label>
              <input
                type="text"
                id="checklistName"
                value={newChecklistName}
                onChange={(e) => setNewChecklistName(e.target.value)}
                placeholder="Ex: Pré-Concretagem de Laje"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                aria-label="Nome do checklist"
              />
            </div>
            <div>
              <label htmlFor="checklistCategory" className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria (Opcional)</label>
              <select
                id="checklistCategory"
                value={newChecklistCategory}
                onChange={(e) => setNewChecklistCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Categoria do checklist"
              >
                <option value="">Geral</option>
                {/* Dynamically populate with relevant step names from current work */}
                {steps.map(step => (
                  <option key={step.id} value={step.name}>{step.name}</option>
                ))}
                {/* Add standard categories if needed */}
                <option value="Segurança">Segurança</option>
                <option value="Limpeza">Limpeza</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Itens do Checklist</label>
              {newChecklistItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const updatedItems = [...newChecklistItems];
                      updatedItems[index] = e.target.value;
                      setNewChecklistItems(updatedItems);
                    }}
                    placeholder={`Item ${index + 1}`}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    required
                    aria-label={`Item ${index + 1} do checklist`}
                  />
                  {newChecklistItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedItems = newChecklistItems.filter((_, i) => i !== index);
                        setNewChecklistItems(updatedItems);
                      }}
                      className="text-red-500 hover:text-red-700 p-2"
                      aria-label={`Remover item ${index + 1}`}
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setNewChecklistItems([...newChecklistItems, ''])}
                className="w-full py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                aria-label="Adicionar novo item ao checklist"
              >
                <i className="fa-solid fa-plus"></i> Adicionar Item
              </button>
            </div>
            <button type="submit" hidden></button>
          </form>
        </ZeModal>
      )}
    </div>
  );
};

export default WorkDetail;
