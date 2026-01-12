
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx'; // Keep XLSX import for Excel export functionality
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

// NEW: Helper para formatar um número para exibição em um input (e.g., "1.250.000,00")
const formatInputReal = (rawNumericString: string | number): string => {
  if (rawNumericString === undefined || rawNumericString === null || rawNumericString === '') return '';
  const num = parseFloat(String(rawNumericString).replace(',', '.')); // Handle internal comma from manual input
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// NEW: Helper para parsear uma string formatada (e.g., "1.250.000,00") para um número puro em string (e.g., "1250000.00")
const parseInputReal = (displayString: string): string => {
  if (!displayString) return '';

  let cleaned = displayString.replace(/[^0-9,]/g, '');

  const parts = cleaned.split(',');
  if (parts.length > 2) {
    cleaned = parts.slice(0, -1).join('') + ',' + parts[parts.length - 1];
  }
  
  cleaned = cleaned.replace(',', '.');
  
  // Try to parse to float and then back to string to ensure a valid number format
  const num = parseFloat(cleaned);
  if (isNaN(num)) return '';

  return num.toFixed(2); // Keep two decimal places for consistency
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
const WorkDetail: React.FC<WorkDetailProps> = ({ activeTab, onTabChange }): React.ReactNode => {
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
  const [loadingInitialWork, setLoadingInitialWork] = useState(true); // NEW: For initial work data load
  const [workError, setWorkError] = useState(''); // NEW: For initial work data errors

  const [steps, setSteps] = useState<Step[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false); // NEW: Tab-specific loading

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false); // NEW: Tab-specific loading

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false); // NEW: Tab-specific loading
  
  // NEW: Separate loading states for Tools sub-views
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const [photos, setPhotos] = useState<WorkPhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  const [files, setFiles] = useState<WorkFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);

  // Fix: Declare showAiAccessModal state here
  const [showAiAccessModal, setShowAiAccessModal] = useState(false);


  // Removed global `loading` state, using specific ones now.
  // const [loading, setLoading] = useState(true); 
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

  // REMOVED: State for "Atualizado automaticamente" badge on Financeiro tab
  // const [showFinanceUpdateBadge, setShowFinanceUpdateBadge] = useState(false);
  // const financeBadgeTimeoutRef = useRef<number | null>(null);

  // REMOVED: OE #001: State for initial orientation message
  // const [showInitialOrientation, setShowInitialOrientation] = useState(false);


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

  // REMOVED: Function to show finance update badge
  // const showFinanceBadge = useCallback(() => {
  //   if (financeBadgeTimeoutRef.current) {
  //     clearTimeout(financeBadgeTimeoutRef.current);
  //   }
  //   setShowFinanceUpdateBadge(true);
  //   financeBadgeTimeoutRef.current = setTimeout(() => {
  //     setShowFinanceUpdateBadge(false);
  //     financeBadgeTimeoutRef.current = null;
  //   }, 2000) as unknown as number; // Type assertion for setTimeout return type
  // }, []);


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

  // NEW: Refactored load functions for performance perceived.
  // 1. Initial Work Load (fastest possible)
  const _fetchInitialWorkAndAccess = useCallback(async (): Promise<void> => {
    if (!workId || !user?.id) {
      setWork(null);
      setLoadingInitialWork(false);
      return;
    }

    setLoadingInitialWork(true);
    setWorkError('');

    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        setWork(null);
        setWorkError("Obra não encontrada ou sem permissão.");
        // Redirect to dashboard if work not found or not owned
        navigate('/dashboard', { replace: true }); 
        return;
      }
      setWork(fetchedWork);

      if (!hasAiAccess) {
        setShowAiAccessModal(true);
        // Do NOT set workError here, as access modal takes precedence
      }
    } catch (error: any) {
      console.error("Erro ao carregar dados iniciais da obra:", error);
      setWork(null);
      setWorkError(`Erro ao carregar obra: ${error.message || 'Erro desconhecido.'}`);
    } finally {
      setLoadingInitialWork(false);
    }
  }, [workId, user, navigate, hasAiAccess]);

  // 2. Tab-specific data loads
  const _fetchStepsData = useCallback(async () => {
    if (!workId || !user?.id || !work) return; // Ensure basic work info is loaded
    setLoadingSteps(true);
    try {
      const fetchedSteps = await dbService.getSteps(workId);
      setSteps(fetchedSteps.sort((a, b) => a.orderIndex - b.orderIndex));
      // Ensure materials are generated if needed, but not block initial render.
      // This is now called during initial work load in CreateWork, so not needed here.
      // await dbService.ensureMaterialsForWork(work, fetchedSteps); 
    } catch (error: any) {
      console.error("Erro ao carregar etapas:", error);
      showToastNotification(`Erro ao carregar etapas: ${error.message}`, 'error');
    } finally {
      setLoadingSteps(false);
    }
  }, [workId, user, work, showToastNotification]);

  const _fetchMaterialsData = useCallback(async () => {
    if (!workId || !user?.id) return;
    setLoadingMaterials(true);
    try {
      const fetchedMaterials = await dbService.getMaterials(workId);
      setMaterials(fetchedMaterials);
    } catch (error: any) {
      console.error("Erro ao carregar materiais:", error);
      showToastNotification(`Erro ao carregar materiais: ${error.message}`, 'error');
    } finally {
      setLoadingMaterials(false);
    }
  }, [workId, user, showToastNotification]);

  const _fetchExpensesData = useCallback(async () => {
    if (!workId || !user?.id) return;
    setLoadingExpenses(true);
    try {
      const fetchedExpenses = await dbService.getExpenses(workId);
      setExpenses(fetchedExpenses);
    } catch (error: any) {
      console.error("Erro ao carregar despesas:", error);
      showToastNotification(`Erro ao carregar despesas: ${error.message}`, 'error');
    } finally {
      setLoadingExpenses(false);
    }
  }, [workId, user, showToastNotification]);

  const _fetchWorkersData = useCallback(async () => {
    if (!workId || !user?.id) return;
    setLoadingWorkers(true);
    try {
      const fetchedWorkers = await dbService.getWorkers(workId);
      setWorkers(fetchedWorkers);
    } catch (error: any) {
      console.error("Erro ao carregar funcionários:", error);
      showToastNotification(`Erro ao carregar funcionários: ${error.message}`, 'error');
    } finally {
      setLoadingWorkers(false);
    }
  }, [workId, user, showToastNotification]);

  const _fetchSuppliersData = useCallback(async () => {
    if (!workId || !user?.id) return;
    setLoadingSuppliers(true);
    try {
      const fetchedSuppliers = await dbService.getSuppliers(workId);
      setSuppliers(fetchedSuppliers);
    } catch (error: any) {
      console.error("Erro ao carregar fornecedores:", error);
      showToastNotification(`Erro ao carregar fornecedores: ${error.message}`, 'error');
    } finally {
      setLoadingSuppliers(false);
    }
  }, [workId, user, showToastNotification]);

  const _fetchPhotosData = useCallback(async () => {
    if (!workId || !user?.id) return;
    setLoadingPhotos(true);
    try {
      const fetchedPhotos = await dbService.getPhotos(workId);
      setPhotos(fetchedPhotos);
    } catch (error: any) {
      console.error("Erro ao carregar fotos:", error);
      showToastNotification(`Erro ao carregar fotos: ${error.message}`, 'error');
    } finally {
      setLoadingPhotos(false);
    }
  }, [workId, user, showToastNotification]);

  const _fetchFilesData = useCallback(async () => {
    if (!workId || !user?.id) return;
    setLoadingFiles(true);
    try {
      const fetchedFiles = await dbService.getFiles(workId);
      setFiles(fetchedFiles);
    } catch (error: any) {
      console.error("Erro ao carregar arquivos:", error);
      showToastNotification(`Erro ao carregar arquivos: ${error.message}`, 'error');
    } finally {
      setLoadingFiles(false);
    }
  }, [workId, user, showToastNotification]);

  const _fetchContractsData = useCallback(async () => {
    // Contracts are global, no workId dependency
    setLoadingContracts(true);
    try {
      const fetchedContracts = await dbService.getContractTemplates();
      setContracts(fetchedContracts);
    } catch (error: any) {
      console.error("Erro ao carregar contratos:", error);
      showToastNotification(`Erro ao carregar contratos: ${error.message}`, 'error');
    } finally {
      setLoadingContracts(false);
    }
  }, [showToastNotification]);

  const _fetchChecklistsData = useCallback(async () => {
    if (!workId || !user?.id) return;
    setLoadingChecklists(true);
    try {
      const fetchedChecklists = await dbService.getChecklists(workId);
      setChecklists(fetchedChecklists);
    } catch (error: any) {
      console.error("Erro ao carregar checklists:", error);
      showToastNotification(`Erro ao carregar checklists: ${error.message}`, 'error');
    } finally {
      setLoadingChecklists(false);
    }
  }, [workId, user, showToastNotification]);


  // 3. Main Effects for initial data load and tab changes
  useEffect(() => {
    if (!authLoading && isUserAuthFinished && !work && !loadingInitialWork) {
      _fetchInitialWorkAndAccess();
    }
  }, [authLoading, isUserAuthFinished, work, loadingInitialWork, _fetchInitialWorkAndAccess]);

  useEffect(() => {
    // Update activeTab from URL on first load or URL change
    const tabFromUrl = searchParams.get('tab') as MainTab;
    if (tabFromUrl && ['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'].includes(tabFromUrl)) {
      onTabChange(tabFromUrl);
    }
  }, [searchParams, onTabChange]);


  // Effects to trigger tab-specific data loads
  useEffect(() => {
    if (activeTab === 'ETAPAS' && work && !loadingSteps && steps.length === 0) {
      _fetchStepsData();
    }
  }, [activeTab, work, loadingSteps, steps.length, _fetchStepsData]);

  useEffect(() => {
    if (activeTab === 'MATERIAIS' && work && !loadingMaterials && materials.length === 0) {
      _fetchMaterialsData();
    }
  }, [activeTab, work, loadingMaterials, materials.length, _fetchMaterialsData]);

  useEffect(() => {
    if (activeTab === 'FINANCEIRO' && work && !loadingExpenses && expenses.length === 0) {
      _fetchExpensesData();
    }
  }, [activeTab, work, loadingExpenses, expenses.length, _fetchExpensesData]);

  // For the 'FERRAMENTAS' tab, load sub-view data when activeSubView changes
  useEffect(() => {
    if (activeTab === 'FERRAMENTAS' && work) {
        if (activeSubView === 'WORKERS' && !loadingWorkers && workers.length === 0) {
            _fetchWorkersData();
        } else if (activeSubView === 'SUPPLIERS' && !loadingSuppliers && suppliers.length === 0) {
            _fetchSuppliersData();
        } else if (activeSubView === 'PHOTOS' && !loadingPhotos && photos.length === 0) {
            _fetchPhotosData();
        } else if (activeSubView === 'FILES' && !loadingFiles && files.length === 0) {
            _fetchFilesData();
        } else if (activeSubView === 'CONTRACTS' && !loadingContracts && contracts.length === 0) {
            _fetchContractsData();
        } else if (activeSubView === 'CHECKLIST' && !loadingChecklists && checklists.length === 0) {
            _fetchChecklistsData();
        }
    }
  }, [activeTab, work, activeSubView, loadingWorkers, workers.length, _fetchWorkersData,
      loadingSuppliers, suppliers.length, _fetchSuppliersData,
      loadingPhotos, photos.length, _fetchPhotosData,
      loadingFiles, files.length, _fetchFilesData,
      loadingContracts, contracts.length, _fetchContractsData,
      loadingChecklists, checklists.length, _fetchChecklistsData
  ]);

  // Consolidated reload function to call after any CRUD operation
  const _reloadAllWorkData = useCallback(async () => {
      // Reload everything that might have changed
      if (workId) {
          await Promise.all([
              _fetchStepsData(),
              _fetchMaterialsData(),
              _fetchExpensesData(),
              _fetchWorkersData(),
              _fetchSuppliersData(),
              _fetchPhotosData(),
              _fetchFilesData(),
              _fetchContractsData(),
              _fetchChecklistsData()
          ]);
      }
  }, [workId, _fetchStepsData, _fetchMaterialsData, _fetchExpensesData, _fetchWorkersData, _fetchSuppliersData, _fetchPhotosData, _fetchFilesData, _fetchContractsData, _fetchChecklistsData]);


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
      await _reloadAllWorkData(); // Use the consolidated reload
      // OE-006: Replaced specific success message with generic "Informações salvas."
      showToastNotification("Informações salvas.", 'success');
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
  }, [_reloadAllWorkData, isUpdatingStepStatus, showToastNotification]);

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
      await _reloadAllWorkData(); // Use the consolidated reload
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
      await _reloadAllWorkData(); // Use the consolidated reload
      // OE-006: Replaced specific success message with generic "Informações salvas."
      showToastNotification("Informações salvas.", 'success');
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

  const handleDeleteStep = async (stepId: string, stepName: string) => {
    setZeModal(prev => ({ ...prev, id: stepId, isConfirming: true }));
    try {
      await dbService.deleteStep(stepId, workId!);
      setZeModal(prev => ({ ...prev, isOpen: false }));
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Etapa "${stepName}" excluída com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao excluir etapa:", error);
      showToastNotification(`Erro ao excluir etapa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Excluir Etapa",
        message: `Não foi possível excluir a etapa "${stepName}": ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));} // Fix: Ensure onCancel matches signature
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, stepId: string) => {
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stepId); // Set data to transfer
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, stepId: string) => {
    e.preventDefault(); // Necessary to allow drop
    setDragOverStepId(stepId);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (_e: React.DragEvent<HTMLDivElement>) => {
    setDragOverStepId(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetStepId: string) => {
    e.preventDefault();
    setDragOverStepId(null);

    const sourceStepId = e.dataTransfer.getData('text/plain'); // Get ID from dataTransfer

    if (!sourceStepId || sourceStepId === targetStepId || !workId) return;

    // Check if either step has started
    const sourceStep = steps.find(s => s.id === sourceStepId);
    const targetStep = steps.find(s => s.id === targetStepId);

    if (sourceStep?.startDate || targetStep?.startDate) {
        showToastNotification("Não é possível reordenar etapas que já foram iniciadas.", 'error');
        return;
    }

    const newStepsOrder = Array.from(steps);
    const draggedStepIndex = newStepsOrder.findIndex(step => step.id === sourceStepId);
    const targetStepIndex = newStepsOrder.findIndex(step => step.id === targetStepId);

    if (draggedStepIndex === -1 || targetStepIndex === -1) return;

    const [removed] = newStepsOrder.splice(draggedStepIndex, 1);
    newStepsOrder.splice(targetStepIndex, 0, removed);

    // Update orderIndex values
    const updatedSteps = newStepsOrder.map((step, index) => ({
      ...step,
      orderIndex: index + 1,
    }));

    // setLoading(true); // Indicate loading while reordering
    try {
      // Send updates to DB
      for (const step of updatedSteps) {
        // 🔥 CRITICAL: Only update orderIndex, ensure other derived fields are untouched
        await dbService.updateStep({ ...step, orderIndex: step.orderIndex });
      }
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification("Ordem das etapas atualizada!", 'success');
    } catch (error: any) {
      console.error("Erro ao reordenar etapas:", error);
      showToastNotification(`Erro ao reordenar etapas: ${error.message || 'Erro desconhecido'}.`, 'error');
    } finally {
      // setLoading(false);
      setDraggedStepId(null);
    }
  };

  // =======================================================================
  // CRUD HANDLERS: MATERIALS
  // =======================================================================

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (!workId || !user?.id || !newMaterialName || !newMaterialUnit || !newMaterialPlannedQty || !newMaterialCategory) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addMaterial(user.id, {
        workId: workId,
        name: newMaterialName,
        brand: newMaterialBrand,
        plannedQty: parseFloat(newMaterialPlannedQty),
        purchasedQty: 0, // Always 0 on add
        unit: newMaterialUnit,
        stepId: newMaterialStepId || undefined,
        category: newMaterialCategory,
        // totalCost will be initialized by DB
      });
      setShowAddMaterialModal(false);
      setNewMaterialName('');
      setNewMaterialBrand('');
      setNewMaterialPlannedQty('');
      setNewMaterialUnit('');
      setNewMaterialCategory('');
      setNewMaterialStepId('');
      await _reloadAllWorkData(); // Use the consolidated reload
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
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditMaterial = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (!editMaterialData || !workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // OE-006: Simplified success message
      await dbService.updateMaterial({
        ...editMaterialData,
        name: newMaterialName,
        brand: newMaterialBrand,
        plannedQty: parseFloat(newMaterialPlannedQty),
        unit: newMaterialUnit,
        stepId: newMaterialStepId || undefined,
        category: newMaterialCategory,
      });
      setEditMaterialData(null);
      setShowAddMaterialModal(false);
      await _reloadAllWorkData(); // Use the consolidated reload
      // OE-006: Replaced specific success message with generic "Informações salvas."
      showToastNotification("Informações salvas.", 'success');
    } catch (error: any) {
      console.error("Erro ao editar material:", error);
      showToastNotification(`Erro ao editar material: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Material",
        message: `Não foi possível editar o material: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // NEW: Handle Material Purchase (within edit modal context)
  const handleRegisterMaterialPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMaterialData || !purchaseQtyInput || !purchaseCostInput) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const purchasedQtyDelta = parseFloat(purchaseQtyInput);
      const cost = parseFloat(parseInputReal(purchaseCostInput)); // Parse formatted input

      if (isNaN(purchasedQtyDelta) || purchasedQtyDelta <= 0) {
        throw new Error("Quantidade comprada deve ser um número positivo.");
      }
      if (isNaN(cost) || cost <= 0) {
        throw new Error("Custo deve ser um número positivo.");
      }

      await dbService.registerMaterialPurchase(
        editMaterialData.id,
        editMaterialData.name,
        editMaterialData.brand,
        editMaterialData.plannedQty,
        editMaterialData.unit,
        purchasedQtyDelta,
        cost
      );
      setEditMaterialData(null); // Close the edit modal after purchase
      setShowAddMaterialModal(false);
      setPurchaseQtyInput('');
      setPurchaseCostInput('');
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification("Compra de material registrada com sucesso!", 'success');
      // REMOVED: showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao registrar compra de material:", error);
      showToastNotification(`Erro ao registrar compra: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Registrar Compra",
        message: `Não foi possível registrar a compra: ${error.message || 'Erro desconhecido'}. Verifique os valores.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteMaterial = async (materialId: string, materialName: string) => {
    setZeModal(prev => ({ ...prev, id: materialId, isConfirming: true }));
    try {
      await dbService.deleteMaterial(materialId);
      setZeModal(prev => ({ ...prev, isOpen: false }));
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Material "${materialName}" excluído com sucesso!`, 'success');
      // REMOVED: showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao excluir material:", error);
      showToastNotification(`Erro ao excluir material: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Excluir Material",
        message: `Não foi possível excluir o material "${materialName}": ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: EXPENSES
  // =======================================================================

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newExpenseDescription || !newExpenseAmount) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const amount = parseFloat(parseInputReal(newExpenseAmount));
      const totalAgreed = newExpenseTotalAgreed ? parseFloat(parseInputReal(newExpenseTotalAgreed)) : undefined;

      if (isNaN(amount) || amount <= 0) {
        throw new Error("Valor da despesa deve ser um número positivo.");
      }
      if (totalAgreed !== undefined && (isNaN(totalAgreed) || totalAgreed < 0)) {
          throw new Error("Valor combinado deve ser um número positivo ou zero.");
      }

      await dbService.addExpense({
        workId: workId,
        description: newExpenseDescription,
        amount: amount,
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId || undefined,
        workerId: newExpenseWorkerId || undefined,
        supplierId: newExpenseSupplierId || undefined,
        totalAgreed: totalAgreed
      });
      setShowAddExpenseModal(false);
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setNewExpenseCategory(ExpenseCategory.OTHER);
      setNewExpenseDate(new Date().toISOString().split('T')[0]);
      setNewExpenseStepId('');
      setNewExpenseWorkerId('');
      setNewExpenseSupplierId('');
      setNewExpenseTotalAgreed('');
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Despesa "${newExpenseDescription}" adicionada com sucesso!`, 'success');
      // REMOVED: showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao adicionar despesa:", error);
      showToastNotification(`Erro ao adicionar despesa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Despesa",
        message: `Não foi possível adicionar a despesa: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
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
      const amount = parseFloat(parseInputReal(newExpenseAmount));
      const totalAgreed = newExpenseTotalAgreed ? parseFloat(parseInputReal(newExpenseTotalAgreed)) : undefined;

      if (isNaN(amount) || amount <= 0) {
        throw new Error("Valor da despesa deve ser um número positivo.");
      }
      if (totalAgreed !== undefined && (isNaN(totalAgreed) || totalAgreed < 0)) {
          throw new Error("Valor combinado deve ser um número positivo ou zero.");
      }

      await dbService.updateExpense({
        ...editExpenseData,
        description: newExpenseDescription,
        amount: amount,
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId || undefined,
        workerId: newExpenseWorkerId || undefined,
        supplierId: newExpenseSupplierId || undefined,
        totalAgreed: totalAgreed,
      });
      setEditExpenseData(null);
      setShowAddExpenseModal(false);
      await _reloadAllWorkData(); // Use the consolidated reload
      // OE-006: Replaced specific success message with generic "Informações salvas."
      showToastNotification("Informações salvas.", 'success');
      // REMOVED: showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao editar despesa:", error);
      showToastNotification(`Erro ao editar despesa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Despesa",
        message: `Não foi possível editar a despesa: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteExpense = async (expenseId: string, expenseDescription: string) => {
    setZeModal(prev => ({ ...prev, id: expenseId, isConfirming: true }));
    try {
      await dbService.deleteExpense(expenseId);
      setZeModal(prev => ({ ...prev, isOpen: false }));
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Despesa "${expenseDescription}" excluída com sucesso!`, 'success');
      // REMOVED: showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao excluir despesa:", error);
      showToastNotification(`Erro ao excluir despesa: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Excluir Despesa",
        message: `Não foi possível excluir a despesa "${expenseDescription}": ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentExpenseData || !paymentAmount) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const amount = parseFloat(parseInputReal(paymentAmount));
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Valor do pagamento deve ser um número positivo.");
      }

      await dbService.addPaymentToExpense(paymentExpenseData.id, amount, paymentDate);
      setShowAddPaymentModal(false);
      setPaymentAmount('');
      setNewPaymentDate(new Date().toISOString().split('T')[0]);
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Pagamento de ${formatCurrency(amount)} registrado com sucesso!`, 'success');
      // REMOVED: showFinanceBadge(); // Show badge on finance tab
    } catch (error: any) {
      console.error("Erro ao adicionar pagamento:", error);
      showToastNotification(`Erro ao adicionar pagamento: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Pagamento",
        message: `Não foi possível adicionar o pagamento: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
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
    if (!workId || !user?.id || !newWorkerName || !newWorkerRole || !newWorkerPhone) return;

    setIsAddingWorker(true);
    try {
      await dbService.addWorker({
        workId: workId,
        userId: user.id,
        name: newWorkerName,
        role: newWorkerRole,
        phone: newWorkerPhone,
        dailyRate: parseFloat(parseInputReal(newWorkerDailyRate)) || undefined,
        notes: newWorkerNotes || undefined,
      });
      setShowAddWorkerModal(false);
      setNewWorkerName('');
      setNewWorkerRole('');
      setNewWorkerPhone('');
      setNewWorkerDailyRate('');
      setNewWorkerNotes('');
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Funcionário "${newWorkerName}" adicionado com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar funcionário:", error);
      showToastNotification(`Erro ao adicionar funcionário: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Adicionar Funcionário",
        message: `Não foi possível adicionar o funcionário: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      });
    } finally {
      setIsAddingWorker(false);
    }
  };

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorkerData || !workId) return;

    setIsAddingWorker(true); // Using same loading state
    try {
      await dbService.updateWorker({
        ...editWorkerData,
        name: newWorkerName,
        role: newWorkerRole,
        phone: newWorkerPhone,
        dailyRate: parseFloat(parseInputReal(newWorkerDailyRate)) || undefined,
        notes: newWorkerNotes || undefined,
      });
      setEditWorkerData(null);
      setShowAddWorkerModal(false);
      await _reloadAllWorkData(); // Use the consolidated reload
      // OE-006: Replaced specific success message with generic "Informações salvas."
      showToastNotification("Informações salvas.", 'success');
    } catch (error: any) {
      console.error("Erro ao editar funcionário:", error);
      showToastNotification(`Erro ao editar funcionário: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Editar Funcionário",
        message: `Não foi possível editar o funcionário: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      });
    } finally {
      setIsAddingWorker(false);
    }
  };

  const handleDeleteWorker = async (workerId: string, workerName: string) => {
    setZeModal(prev => ({ ...prev, id: workerId, isConfirming: true }));
    try {
      await dbService.deleteWorker(workerId, workId!);
      setZeModal(prev => ({ ...prev, isOpen: false }));
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Funcionário "${workerName}" excluído com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao excluir funcionário:", error);
      showToastNotification(`Erro ao excluir funcionário: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Excluir Funcionário",
        message: `Não foi possível excluir o funcionário "${workerName}": ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
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
    if (!workId || !user?.id || !newSupplierName || !newSupplierCategory || !newSupplierPhone) return;

    setIsAddingSupplier(true);
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
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Fornecedor "${newSupplierName}" adicionado com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar fornecedor:", error);
      showToastNotification(`Erro ao adicionar fornecedor: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Adicionar Fornecedor",
        message: `Não foi possível adicionar o fornecedor: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      });
    } finally {
      setIsAddingSupplier(false);
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplierData || !workId) return;

    setIsAddingSupplier(true); // Using same loading state
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
      await _reloadAllWorkData(); // Use the consolidated reload
      // OE-006: Replaced specific success message with generic "Informações salvas."
      showToastNotification("Informações salvas.", 'success');
    } catch (error: any) {
      console.error("Erro ao editar fornecedor:", error);
      showToastNotification(`Erro ao editar fornecedor: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Editar Fornecedor",
        message: `Não foi possível editar o fornecedor: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      });
    } finally {
      setIsAddingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string, supplierName: string) => {
    setZeModal(prev => ({ ...prev, id: supplierId, isConfirming: true }));
    try {
      await dbService.deleteSupplier(supplierId, workId!);
      setZeModal(prev => ({ ...prev, isOpen: false }));
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Fornecedor "${supplierName}" excluído com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao excluir fornecedor:", error);
      showToastNotification(`Erro ao excluir fornecedor: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Excluir Fornecedor",
        message: `Não foi possível excluir o fornecedor "${supplierName}": ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };


  // =======================================================================
  // CRUD HANDLERS: PHOTOS
  // =======================================================================

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewPhotoFile(e.target.files[0]);
    } else {
      setNewPhotoFile(null);
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newPhotoFile) return;

    setLoadingPhoto(true);
    try {
      // 1. Upload file to Supabase Storage
      const fileExt = newPhotoFile.name.split('.').pop();
      const filePath = `${workId}/photos/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work_files')
        .upload(filePath, newPhotoFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('work_files').getPublicUrl(filePath);

      // 2. Add photo record to DB
      await dbService.addPhoto({
        workId: workId,
        url: publicUrl,
        description: newPhotoDescription,
        date: new Date().toISOString().split('T')[0],
        type: newPhotoType,
      });
      setShowAddPhotoModal(false);
      setNewPhotoDescription('');
      setNewPhotoFile(null);
      setNewPhotoType('PROGRESS');
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification("Foto adicionada com sucesso!", 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar foto:", error);
      showToastNotification(`Erro ao adicionar foto: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Adicionar Foto",
        message: `Não foi possível adicionar a foto: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      });
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string, photoDescription: string) => {
    setZeModal(prev => ({ ...prev, id: photoId, isConfirming: true }));
    try {
      // 1. Delete from Supabase Storage
      const filePath = photoUrl.split('/work_files/')[1]; // Extract path from public URL
      const { error: deleteStorageError } = await supabase.storage
        .from('work_files')
        .remove([filePath]);

      if (deleteStorageError) console.error("Erro ao excluir foto do storage:", deleteStorageError);

      // 2. Delete record from DB
      await dbService.deletePhoto(photoId);
      setZeModal(prev => ({ ...prev, isOpen: false }));
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Foto "${photoDescription}" excluída com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao excluir foto:", error);
      showToastNotification(`Erro ao excluir foto: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Excluir Foto",
        message: `Não foi possível excluir a foto "${photoDescription}": ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: FILES
  // =======================================================================

  const handleUploadFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewUploadFile(e.target.files[0]);
    } else {
      setNewUploadFile(null);
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newUploadFile || !newFileName || !newFileCategory) return;

    setLoadingFile(true);
    try {
      // 1. Upload file to Supabase Storage
      const fileExt = newUploadFile.name.split('.').pop();
      const filePath = `${workId}/files/${Date.now()}-${newFileName.replace(/\s/g, '_')}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work_files')
        .upload(filePath, newUploadFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('work_files').getPublicUrl(filePath);

      // 2. Add file record to DB
      await dbService.addFile({
        workId: workId,
        name: newFileName,
        category: newFileCategory,
        url: publicUrl,
        type: newUploadFile.type || 'application/octet-stream',
        date: new Date().toISOString().split('T')[0],
      });
      setShowAddFileModal(false);
      setNewFileName('');
      setNewFileCategory(FileCategory.GENERAL);
      setNewUploadFile(null);
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Arquivo "${newFileName}" adicionado com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar arquivo:", error);
      showToastNotification(`Erro ao adicionar arquivo: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Adicionar Arquivo",
        message: `Não foi possível adicionar o arquivo: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      });
    } finally {
      setLoadingFile(false);
    }
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string, fileName: string) => {
    setZeModal(prev => ({ ...prev, id: fileId, isConfirming: true }));
    try {
      // 1. Delete from Supabase Storage
      const filePath = fileUrl.split('/work_files/')[1]; // Extract path from public URL
      const { error: deleteStorageError } = await supabase.storage
        .from('work_files')
        .remove([filePath]);

      if (deleteStorageError) console.error("Erro ao excluir arquivo do storage:", deleteStorageError);

      // 2. Delete record from DB
      await dbService.deleteFile(fileId);
      setZeModal(prev => ({ ...prev, isOpen: false }));
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Arquivo "${fileName}" excluído com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao excluir arquivo:", error);
      showToastNotification(`Erro ao excluir arquivo: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Excluir Arquivo",
        message: `Não foi possível excluir o arquivo "${fileName}": ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: CONTRACTS
  // =======================================================================

  const handleViewContract = (contract: Contract) => {
    setSelectedContractContent(contract.contentTemplate);
    setSelectedContractTitle(contract.title);
    setCopyContractSuccess(false); // Reset copy status
    setShowContractContentModal(true);
  };

  // =======================================================================
  // CRUD HANDLERS: CHECKLISTS
  // =======================================================================

  const handleAddChecklistItem = () => {
    setNewChecklistItems(prev => [...prev, '']);
  };

  const handleRemoveChecklistItem = (index: number) => {
    setNewChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleChecklistItemChange = (index: number, value: string) => {
    setNewChecklistItems(prev => prev.map((item, i) => i === index ? value : item));
  };

  const handleChecklistItemToggle = async (checklistId: string, itemId: string, isChecked: boolean) => {
    // setLoading(true); // General loading for checklist toggle
    try {
      const updatedChecklists = checklists.map(cl =>
        cl.id === checklistId
          ? {
              ...cl,
              items: cl.items.map(item =>
                item.id === itemId ? { ...item, checked: isChecked } : item
              ),
            }
          : cl
      );
      const targetChecklist = updatedChecklists.find(cl => cl.id === checklistId);
      if (!targetChecklist) throw new Error("Checklist não encontrada para atualização.");

      await dbService.updateChecklist(targetChecklist);
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification("Item da checklist atualizado!", 'success');
    } catch (error: any) {
      console.error("Erro ao alterar item da checklist:", error);
      showToastNotification(`Erro ao atualizar checklist: ${error.message || 'Erro desconhecido'}.`, 'error');
    } finally {
      // setLoading(false);
    }
  };


  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newChecklistName || !newChecklistCategory) return;

    setIsAddingChecklist(true);
    try {
      // Filter out empty items
      const itemsToSave: ChecklistItem[] = newChecklistItems
        .filter(text => text.trim() !== '')
        .map((text, index) => ({ id: `item-${Date.now()}-${index}`, text, checked: false }));

      await dbService.addChecklist({
        workId: workId,
        name: newChecklistName,
        category: newChecklistCategory,
        items: itemsToSave,
      });
      setShowAddChecklistModal(false);
      setNewChecklistName('');
      setNewChecklistCategory('');
      setNewChecklistItems(['']); // Reset to one empty item
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Checklist "${newChecklistName}" adicionada com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao adicionar checklist:", error);
      showToastNotification(`Erro ao adicionar checklist: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Adicionar Checklist",
        message: `Não foi possível adicionar a checklist: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      });
    } finally {
      setIsAddingChecklist(false);
    }
  };

  const handleEditChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChecklistData || !workId) return;

    setIsAddingChecklist(true); // Using same loading state
    try {
      const itemsToSave: ChecklistItem[] = newChecklistItems
        .filter(text => text.trim() !== '')
        .map((text, index) => {
            // Try to find existing item to preserve ID and checked status
            const existingItem = editChecklistData.items.find(item => item.text === text.trim());
            return existingItem ? existingItem : { id: `item-${Date.now()}-${index}`, text, checked: false };
        });


      await dbService.updateChecklist({
        ...editChecklistData,
        name: newChecklistName,
        category: newChecklistCategory,
        items: itemsToSave,
      });
      setEditChecklistData(null);
      setShowAddChecklistModal(false);
      await _reloadAllWorkData(); // Use the consolidated reload
      // OE-006: Replaced specific success message with generic "Informações salvas."
      showToastNotification("Informações salvas.", 'success');
    } catch (error: any) {
      console.error("Erro ao editar checklist:", error);
      showToastNotification(`Erro ao editar checklist: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal({
        isOpen: true,
        title: "Erro ao Editar Checklist",
        message: `Não foi possível editar a checklist: ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      });
    } finally {
      setIsAddingChecklist(false);
    }
  };

  const handleDeleteChecklist = async (checklistId: string, checklistName: string) => {
    setZeModal(prev => ({ ...prev, id: checklistId, isConfirming: true }));
    try {
      await dbService.deleteChecklist(checklistId);
      setZeModal(prev => ({ ...prev, isOpen: false }));
      await _reloadAllWorkData(); // Use the consolidated reload
      showToastNotification(`Checklist "${checklistName}" excluída com sucesso!`, 'success');
    } catch (error: any) {
      console.error("Erro ao excluir checklist:", error);
      showToastNotification(`Erro ao excluir checklist: ${error.message || 'Erro desconhecido'}.`, 'error');
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Excluir Checklist",
        message: `Não foi possível excluir a checklist "${checklistName}": ${error.message || 'Erro desconhecido'}.`,
        type: "ERROR",
        confirmText: "Ok",
        onConfirm: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));},
        onCancel: async (_e?: React.FormEvent) => {setZeModal(p => ({ ...p, isOpen: false }));}
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // RENDERING
  // =======================================================================

  // Render initial loading state
  if (!isUserAuthFinished || authLoading || loadingInitialWork) { // Use loadingInitialWork here
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-4"></i>
        <p className="text-lg">Carregando obra...</p>
      </div>
    );
  }

  // Handle work not found / not owned (after initial load is complete)
  if (!work) { // `work` is null only if an error or not found
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in">
        <i className="fa-solid fa-exclamation-circle text-6xl text-red-500 mb-4"></i>
        <h2 className="text-2xl font-black text-primary dark:text-white mb-2">Obra não encontrada!</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
          Parece que esta obra não existe ou você não tem permissão para acessá-la.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors"
          aria-label="Voltar ao Dashboard"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans">
      {/* Toast Notification */}
      {showToast && (
        <div 
          className={cx(
            "fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-8 duration-300",
            toastType === 'success' ? 'bg-green-500 text-white' :
            toastType === 'error' ? 'bg-red-500 text-white' :
            'bg-amber-500 text-white'
          )}
          role="status"
          aria-live="polite"
        >
          <i className={cx("fa-solid", 
            toastType === 'success' ? 'fa-check-circle' :
            toastType === 'error' ? 'fa-exclamation-circle' :
            'fa-info-circle'
          )}></i>
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ZeModal */}
      <ZeModal
        isOpen={zeModal.isOpen}
        title={zeModal.title}
        message={zeModal.message}
        confirmText={zeModal.confirmText || "Confirmar"}
        cancelText={zeModal.cancelText || "Cancelar"}
        type={zeModal.type}
        onConfirm={zeModal.onConfirm}
        onCancel={zeModal.onCancel}
        isConfirming={zeModal.isConfirming}
      >
        {zeModal.children}
      </ZeModal>

      {/* REMOVED: Initial Orientation Modal (OE #001) */}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label="Voltar para o Dashboard"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">{work.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Endereço: {work.address}</p>
        </div>
        <span className={cx(
          "ml-auto px-3 py-1 rounded-full text-xs font-bold uppercase",
          getWorkStatusDetails(work.status).bgColor,
          getWorkStatusDetails(work.status).textColor
        )}>
          {getWorkStatusDetails(work.status).text}
        </span>
      </div>

      {/* Tab Navigation for Desktop */}
      <div className="hidden md:flex justify-around bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => goToTab('ETAPAS')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'ETAPAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          aria-selected={activeTab === 'ETAPAS'}
          role="tab"
        >
          <i className="fa-solid fa-list-check mr-2"></i> Cronograma
        </button>
        <button
          onClick={() => goToTab('MATERIAIS')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'MATERIAIS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          aria-selected={activeTab === 'MATERIAIS'}
          role="tab"
        >
          <i className="fa-solid fa-boxes-stacked mr-2"></i> Materiais
        </button>
        <button
          onClick={() => goToTab('FINANCEIRO')}
          className={`relative flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'FINANCEIRO' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          aria-selected={activeTab === 'FINANCEIRO'}
          role="tab"
        >
          <i className="fa-solid fa-dollar-sign mr-2"></i> Financeiro
          {/* REMOVED: showFinanceUpdateBadge && (
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">Atualizado!</span>
          )*/}
        </button>
        <button
          onClick={() => goToTab('FERRAMENTAS')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'FERRAMENTAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          aria-selected={activeTab === 'FERRAMENTAS'}
          role="tab"
        >
          <i className="fa-solid fa-screwdriver-wrench mr-2"></i> Ferramentas
        </button>
      </div>

      {/* =========================================
       * TAB CONTENT: CRONOGRAMA (ETAPAS)
       * ========================================= */}
      {activeTab === 'ETAPAS' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-primary dark:text-white">Etapas da Obra ({steps.length})</h2>
            <button
              onClick={() => { setShowAddStepModal(true); setNewStepName(''); setNewStepStartDate(new Date().toISOString().split('T')[0]); setNewStepEndDate(new Date().toISOString().split('T')[0]); setNewEstimatedDurationDays(''); setEditStepData(null); }}
              className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
              aria-label="Adicionar nova etapa"
            >
              <i className="fa-solid fa-plus"></i> Nova Etapa
            </button>
          </div>

          {loadingSteps ? ( // NEW: Show loader for steps
            <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando etapas...
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              Nenhuma etapa cadastrada ainda. Comece adicionando a primeira!
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step) => {
                const statusDetails = getEntityStatusDetails('step', step, []); // [] as steps don't depend on materials for their own status
                return (
                  <div
                    key={step.id}
                    draggable={!step.startDate} // Only draggable if not started
                    onDragStart={(e) => handleDragStart(e, step.id)}
                    onDragOver={(e) => handleDragOver(e, step.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, step.id)}
                    className={cx(
                      surface,
                      card,
                      "p-5 rounded-2xl flex items-center gap-4 transition-all duration-200 cursor-pointer",
                      statusDetails.borderColor,
                      `shadow-sm shadow-card-default ${statusDetails.shadowClass}`, // Dynamic shadow
                      dragOverStepId === step.id ? 'outline outline-2 outline-offset-2 outline-secondary' : '', // Drag indicator
                      step.startDate ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.005] active:scale-[0.99]' // Visual for non-draggable
                    )}
                    role="listitem"
                    aria-describedby={`step-status-${step.id}`}
                  >
                    <div className={cx(
                        "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0",
                        statusDetails.bgColor
                    )}>
                        <i className={`fa-solid ${statusDetails.icon}`}></i>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-primary dark:text-white text-base">
                        {step.orderIndex}. {step.name}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Início: {formatDateDisplay(step.startDate)} - Término: {formatDateDisplay(step.endDate)} {step.estimatedDurationDays ? `(${step.estimatedDurationDays} dias)` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-auto shrink-0">
                      <button
                        onClick={() => handleStepStatusChange(step)}
                        disabled={isUpdatingStepStatus}
                        className={cx(
                            "px-3 py-1 rounded-lg text-white text-xs font-bold uppercase transition-colors",
                            step.status === StepStatus.COMPLETED ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600',
                            isUpdatingStepStatus ? 'opacity-70 cursor-not-allowed' : ''
                        )}
                        aria-label={step.status === StepStatus.COMPLETED ? `Reabrir etapa ${step.name}` : `Concluir etapa ${step.name}`}
                      >
                        {isUpdatingStepStatus ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (step.status === StepStatus.COMPLETED ? 'Reabrir' : 'Concluir')}
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
                        className="text-slate-500 hover:text-primary dark:hover:text-white transition-colors"
                        aria-label={`Editar etapa ${step.name}`}
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button
                        onClick={() => setZeModal({
                          isOpen: true,
                          title: "Confirmar Exclusão",
                          message: `Tem certeza que deseja excluir a etapa "${step.name}"?`,
                          type: "DANGER",
                          confirmText: "Sim, Excluir",
                          onConfirm: () => handleDeleteStep(step.id, step.name),
                          onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                          id: step.id
                        })}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        aria-label={`Excluir etapa ${step.name}`}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Step Modal */}
      {showAddStepModal && (
        <ZeModal
          isOpen={showAddStepModal}
          title={editStepData ? "Editar Etapa" : "Adicionar Nova Etapa"}
          message="" // Custom content handles message
          confirmText={editStepData ? "Salvar Alterações" : "Adicionar Etapa"}
          onConfirm={editStepData ? handleEditStep : handleAddStep}
          onCancel={() => { setShowAddStepModal(false); setEditStepData(null); setNewEstimatedDurationDays(''); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editStepData ? handleEditStep : handleAddStep} className="space-y-4">
            <div>
              <label htmlFor="stepName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Etapa</label>
              <input
                id="stepName"
                type="text"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Nome da etapa"
              />
            </div>
            <div>
              <label htmlFor="stepStartDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Início</label>
              <input
                id="stepStartDate"
                type="date"
                value={newStepStartDate || ''}
                onChange={(e) => setNewStepStartDate(e.target.value || null)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                aria-label="Data de início da etapa"
              />
            </div>
            <div>
              <label htmlFor="stepEndDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Término Prevista</label>
              <input
                id="stepEndDate"
                type="date"
                value={newStepEndDate || ''}
                onChange={(e) => setNewStepEndDate(e.target.value || null)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                aria-label="Data de término prevista da etapa"
              />
            </div>
            <div>
              <label htmlFor="estimatedDurationDays" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Duração Estimada (dias)</label>
              <input
                id="estimatedDurationDays"
                type="number"
                value={newEstimatedDurationDays}
                onChange={(e) => setNewEstimatedDurationDays(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                min="1"
                aria-label="Duração estimada em dias"
              />
            </div>
          </form>
        </ZeModal>
      )}


      {/* =========================================
       * TAB CONTENT: MATERIAIS
       * ========================================= */}
      {activeTab === 'MATERIAIS' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-primary dark:text-white">Materiais ({materials.length})</h2>
            <button
              onClick={() => { setShowAddMaterialModal(true); setNewMaterialName(''); setNewMaterialBrand(''); setNewMaterialPlannedQty(''); setNewMaterialUnit(''); setNewMaterialCategory(''); setNewMaterialStepId(''); setEditMaterialData(null); setPurchaseQtyInput(''); setPurchaseCostInput(''); }}
              className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
              aria-label="Adicionar novo material"
            >
              <i className="fa-solid fa-plus"></i> Novo Material
            </button>
          </div>

          <div className="mb-6">
            <label htmlFor="materialFilterStep" className="sr-only">Filtrar materiais por etapa</label>
            <select
              id="materialFilterStep"
              value={materialFilterStepId}
              onChange={(e) => setMaterialFilterStepId(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary dark:text-white"
              aria-label="Filtrar materiais por etapa"
            >
              <option value="all">Todos os Materiais</option>
              {steps.map(step => (
                <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
              ))}
            </select>
          </div>

          {loadingMaterials ? ( // NEW: Show loader for materials
             <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando materiais...
            </div>
          ) : groupedMaterials.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              {materialFilterStepId === 'all' ? 'Nenhum material cadastrado ainda.' : 'Nenhum material para esta etapa.'}
            </div>
          ) : (
            <div className="space-y-6">
              {groupedMaterials.map(group => (
                <div key={group.stepId}>
                  <h3 className="text-lg font-bold text-primary dark:text-white mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-boxes-stacked text-secondary"></i> {group.stepName}
                  </h3>
                  <div className="space-y-3">
                    {group.materials.map(material => {
                      const statusDetails = getEntityStatusDetails('material', material, steps);
                      return (
                        <div
                          key={material.id}
                          className={cx(
                            surface,
                            "p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-200 hover:scale-[1.005]",
                            statusDetails.borderColor,
                            `shadow-sm shadow-card-default ${statusDetails.shadowClass}`
                          )}
                          role="listitem"
                        >
                          <div className="flex-1">
                            <h4 className="font-bold text-primary dark:text-white text-base">
                              {material.name} {material.brand ? `(${material.brand})` : ''}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Planejado: {material.plannedQty} {material.unit} | Comprado: {material.purchasedQty} {material.unit}
                            </p>
                            {renderMaterialProgressBar(material)}
                            {material.totalCost !== undefined && material.totalCost > 0 && (
                                <p className="text-xs text-slate-400 mt-1">Custo Total: {formatCurrency(material.totalCost)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 sm:ml-auto shrink-0 mt-3 sm:mt-0">
                            <span className={cx(
                                "px-3 py-1 rounded-lg text-white text-xs font-bold uppercase",
                                statusDetails.bgColor
                            )}>
                                <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                            </span>
                            <button
                              onClick={() => {
                                setEditMaterialData(material);
                                setNewMaterialName(material.name);
                                setNewMaterialBrand(material.brand || '');
                                setNewMaterialPlannedQty(String(material.plannedQty));
                                setNewMaterialUnit(material.unit);
                                setNewMaterialCategory(material.category || '');
                                setNewMaterialStepId(material.stepId || '');
                                setPurchaseQtyInput(''); // Clear purchase inputs
                                setPurchaseCostInput(''); // Clear purchase inputs
                                setShowAddMaterialModal(true);
                              }}
                              className="text-slate-500 hover:text-primary dark:hover:text-white transition-colors"
                              aria-label={`Editar material ${material.name}`}
                            >
                              <i className="fa-solid fa-edit"></i>
                            </button>
                            <button
                              onClick={() => setZeModal({
                                isOpen: true,
                                title: "Confirmar Exclusão",
                                message: `Tem certeza que deseja excluir o material "${material.name}"? Esta ação removerá também as despesas de compra associadas.`,
                                type: "DANGER",
                                confirmText: "Sim, Excluir",
                                onConfirm: () => handleDeleteMaterial(material.id, material.name),
                                onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                                id: material.id
                              })}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              aria-label={`Excluir material ${material.name}`}
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Material Modal */}
      {showAddMaterialModal && (
        <ZeModal
          isOpen={showAddMaterialModal}
          title={editMaterialData ? "Editar Material" : "Adicionar Novo Material"}
          message="" // Custom content handles message
          confirmText={editMaterialData ? "Salvar Alterações" : "Adicionar Material"}
          onConfirm={editMaterialData ? handleEditMaterial : handleAddMaterial}
          onCancel={() => { setShowAddMaterialModal(false); setEditMaterialData(null); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editMaterialData ? handleEditMaterial : handleAddMaterial} className="space-y-4">
            <div>
              <label htmlFor="materialName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Material</label>
              <input
                id="materialName"
                type="text"
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Nome do material"
              />
            </div>
            <div>
              <label htmlFor="materialBrand" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca (Opcional)</label>
              <input
                id="materialBrand"
                type="text"
                value={newMaterialBrand}
                onChange={(e) => setNewMaterialBrand(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                aria-label="Marca do material"
              />
            </div>
            <div>
              <label htmlFor="materialPlannedQty" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantidade Planejada</label>
              <input
                id="materialPlannedQty"
                type="number"
                value={newMaterialPlannedQty}
                onChange={(e) => setNewMaterialPlannedQty(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                min="0"
                step="any"
                aria-label="Quantidade planejada do material"
              />
            </div>
            <div>
              <label htmlFor="materialUnit" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade de Medida</label>
              <input
                id="materialUnit"
                type="text"
                value={newMaterialUnit}
                onChange={(e) => setNewMaterialUnit(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Unidade de medida do material"
              />
            </div>
            <div>
              <label htmlFor="materialCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria (Opcional)</label>
              <input
                id="materialCategory"
                type="text"
                value={newMaterialCategory}
                onChange={(e) => setNewMaterialCategory(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                aria-label="Categoria do material"
              />
            </div>
            <div>
              <label htmlFor="materialStepId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Associar à Etapa (Opcional)</label>
              <select
                id="materialStepId"
                value={newMaterialStepId}
                onChange={(e) => setNewMaterialStepId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                aria-label="Associar material a uma etapa"
              >
                <option value="">Nenhuma Etapa</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                ))}
              </select>
            </div>
          </form>

          {editMaterialData && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-primary dark:text-white mb-3">Registrar Compra</h3>
              <form onSubmit={handleRegisterMaterialPurchase} className="space-y-4">
                <div>
                  <label htmlFor="purchaseQtyInput" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantidade Comprada Agora</label>
                  <input
                    id="purchaseQtyInput"
                    type="number"
                    value={purchaseQtyInput}
                    onChange={(e) => setPurchaseQtyInput(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    min="0"
                    step="any"
                    aria-label="Quantidade comprada agora"
                  />
                </div>
                <div>
                  <label htmlFor="purchaseCostInput" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custo da Compra (R$)</label>
                  <input
                    id="purchaseCostInput"
                    type="text" // Use text for custom formatting
                    value={formatInputReal(purchaseCostInput)}
                    onChange={(e) => setPurchaseCostInput(parseInputReal(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Custo total da compra"
                  />
                </div>
                <button
                  type="submit"
                  disabled={zeModal.isConfirming}
                  className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center justify-center gap-2"
                  aria-label="Registrar compra do material"
                >
                  {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-receipt"></i>}
                  Registrar Compra
                </button>
              </form>
            </div>
          )}
        </ZeModal>
      )}


      {/* =========================================
       * TAB CONTENT: FINANCEIRO
       * ========================================= */}
      {activeTab === 'FINANCEIRO' && (
        <div className="tab-content animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-primary dark:text-white">Despesas ({expenses.length})</h2>
            <button
              onClick={() => { setShowAddExpenseModal(true); setNewExpenseDescription(''); setNewExpenseAmount(''); setNewExpenseCategory(ExpenseCategory.OTHER); setNewExpenseDate(new Date().toISOString().split('T')[0]); setNewExpenseStepId(''); setNewExpenseWorkerId(''); setNewExpenseSupplierId(''); setNewExpenseTotalAgreed(''); setEditExpenseData(null); }}
              className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
              aria-label="Adicionar nova despesa"
            >
              <i className="fa-solid fa-plus"></i> Nova Despesa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Planejado</p>
              <p className="text-xl font-black text-primary dark:text-white">{formatCurrency(work.budgetPlanned)}</p>
            </div>
            <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Gasto</p>
              <p className={`text-xl font-black ${calculateTotalExpenses > work.budgetPlanned ? 'text-red-500' : 'text-green-500'}`}>
                {formatCurrency(calculateTotalExpenses)}
              </p>
            </div>
            <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">A Pagar</p>
              <p className="text-xl font-black text-amber-500">{formatCurrency(totalOutstandingExpenses)}</p>
            </div>
          </div>


          {loadingExpenses ? ( // NEW: Show loader for expenses
            <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando despesas...
            </div>
          ) : groupedExpensesByStep.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              Nenhuma despesa cadastrada ainda.
            </div>
          ) : (
            <div className="space-y-6">
              {groupedExpensesByStep.map(group => (
                <div key={group.stepName}>
                  <h3 className="text-lg font-bold text-primary dark:text-white mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-dollar-sign text-secondary"></i> {group.stepName}
                    <span className="ml-auto text-sm font-medium text-slate-500 dark:text-slate-400">{formatCurrency(group.totalStepAmount)}</span>
                  </h3>
                  <div className="space-y-3">
                    {group.expenses.map(expense => {
                      const statusDetails = getEntityStatusDetails('expense', expense, []);
                      const agreedAmount = expense.totalAgreed !== undefined && expense.totalAgreed !== null ? expense.totalAgreed : expense.amount;
                      return (
                        <div
                          key={expense.id}
                          className={cx(
                            surface,
                            "p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-200 hover:scale-[1.005]",
                            statusDetails.borderColor,
                            `shadow-sm shadow-card-default ${statusDetails.shadowClass}`
                          )}
                          role="listitem"
                        >
                          <div className="flex-1">
                            <h4 className="font-bold text-primary dark:text-white text-base">
                              {expense.description}
                            </h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Previsto: {formatCurrency(expense.amount)} | Combinado: {formatCurrency(agreedAmount)} | Pago: {formatCurrency(expense.paidAmount || 0)}
                            </p>
                            {renderExpenseProgressBar(expense)}
                            <p className="text-xs text-slate-400 mt-1">
                              Data: {formatDateDisplay(expense.date)} | Categoria: {expense.category}
                              {expense.workerId && ` | Funcionário: ${workers.find(w => w.id === expense.workerId)?.name || 'N/A'}`}
                              {expense.supplierId && ` | Fornecedor: ${suppliers.find(s => s.id === expense.supplierId)?.name || 'N/A'}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 sm:ml-auto shrink-0 mt-3 sm:mt-0">
                            <span className={cx(
                                "px-3 py-1 rounded-lg text-white text-xs font-bold uppercase",
                                statusDetails.bgColor
                            )}>
                                <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                            </span>
                            <button
                              onClick={() => {
                                setPaymentExpenseData(expense);
                                setPaymentAmount('');
                                setNewPaymentDate(new Date().toISOString().split('T')[0]);
                                setShowAddPaymentModal(true);
                              }}
                              className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition-colors"
                              aria-label={`Adicionar pagamento à despesa ${expense.description}`}
                            >
                              <i className="fa-solid fa-money-bill-transfer mr-1"></i> Pagar
                            </button>
                            <button
                              onClick={() => {
                                setEditExpenseData(expense);
                                setNewExpenseDescription(expense.description);
                                setNewExpenseAmount(String(expense.amount));
                                setNewExpenseCategory(expense.category);
                                setNewExpenseDate(expense.date);
                                setNewExpenseStepId(expense.stepId || '');
                                setNewExpenseWorkerId(expense.workerId || '');
                                setNewExpenseSupplierId(expense.supplierId || '');
                                setNewExpenseTotalAgreed(String(expense.totalAgreed || ''));
                                setShowAddExpenseModal(true);
                              }}
                              className="text-slate-500 hover:text-primary dark:hover:text-white transition-colors"
                              aria-label={`Editar despesa ${expense.description}`}
                            >
                              <i className="fa-solid fa-edit"></i>
                            </button>
                            <button
                              onClick={() => setZeModal({
                                isOpen: true,
                                title: "Confirmar Exclusão",
                                message: `Tem certeza que deseja excluir a despesa "${expense.description}"? Isso também removerá todos os pagamentos associados.`,
                                type: "DANGER",
                                confirmText: "Sim, Excluir",
                                onConfirm: () => handleDeleteExpense(expense.id, expense.description),
                                onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                                id: expense.id
                              })}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              aria-label={`Excluir despesa ${expense.description}`}
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Expense Modal */}
      {showAddExpenseModal && (
        <ZeModal
          isOpen={showAddExpenseModal}
          title={editExpenseData ? "Editar Despesa" : "Adicionar Nova Despesa"}
          message=""
          confirmText={editExpenseData ? "Salvar Alterações" : "Adicionar Despesa"}
          onConfirm={editExpenseData ? handleEditExpense : handleAddExpense}
          onCancel={() => { setShowAddExpenseModal(false); setEditExpenseData(null); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editExpenseData ? handleEditExpense : handleAddExpense} className="space-y-4">
            <div>
              <label htmlFor="expenseDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
              <input
                id="expenseDescription"
                type="text"
                value={newExpenseDescription}
                onChange={(e) => setNewExpenseDescription(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Descrição da despesa"
              />
            </div>
            <div>
              <label htmlFor="expenseAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor Previsto (R$)</label>
              <input
                id="expenseAmount"
                type="text"
                value={formatInputReal(newExpenseAmount)}
                onChange={(e) => setNewExpenseAmount(parseInputReal(e.target.value))}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Valor previsto da despesa"
              />
            </div>
            <div>
              <label htmlFor="expenseTotalAgreed" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor Combinado (R$ - Opcional)</label>
              <input
                id="expenseTotalAgreed"
                type="text"
                value={formatInputReal(newExpenseTotalAgreed)}
                onChange={(e) => setNewExpenseTotalAgreed(parseInputReal(e.target.value))}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                placeholder="Deixe em branco se for igual ao previsto"
                aria-label="Valor combinado com fornecedor/funcionário (opcional)"
              />
            </div>
            <div>
              <label htmlFor="expenseDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data da Despesa</label>
              <input
                id="expenseDate"
                type="date"
                value={newExpenseDate}
                onChange={(e) => setNewExpenseDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Data da despesa"
              />
            </div>
            <div>
              <label htmlFor="expenseCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
              <select
                id="expenseCategory"
                value={newExpenseCategory}
                onChange={(e) => setNewExpenseCategory(e.target.value as ExpenseCategory)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Categoria da despesa"
              >
                {Object.values(ExpenseCategory).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expenseStepId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Associar à Etapa (Opcional)</label>
              <select
                id="expenseStepId"
                value={newExpenseStepId}
                onChange={(e) => setNewExpenseStepId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                aria-label="Associar despesa a uma etapa"
              >
                <option value="">Nenhuma Etapa</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expenseWorkerId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Associar a Funcionário (Opcional)</label>
              <select
                id="expenseWorkerId"
                value={newExpenseWorkerId}
                onChange={(e) => setNewExpenseWorkerId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                aria-label="Associar despesa a um funcionário"
              >
                <option value="">Nenhum Funcionário</option>
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>{worker.name} ({worker.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expenseSupplierId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Associar a Fornecedor (Opcional)</label>
              <select
                id="expenseSupplierId"
                value={newExpenseSupplierId}
                onChange={(e) => setNewExpenseSupplierId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                aria-label="Associar despesa a um fornecedor"
              >
                <option value="">Nenhum Fornecedor</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.category})</option>
                ))}
              </select>
            </div>
          </form>
        </ZeModal>
      )}

      {/* Add Payment Modal */}
      {showAddPaymentModal && paymentExpenseData && (
        <ZeModal
          isOpen={showAddPaymentModal}
          title={`Registrar Pagamento para "${paymentExpenseData.description}"`}
          message=""
          confirmText="Registrar Pagamento"
          onConfirm={handleAddPayment}
          onCancel={() => { setShowAddPaymentModal(false); setPaymentExpenseData(null); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={handleAddPayment} className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Valor Combinado: <span className="font-bold">{formatCurrency(paymentExpenseData.totalAgreed !== undefined && paymentExpenseData.totalAgreed !== null ? paymentExpenseData.totalAgreed : paymentExpenseData.amount)}</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Já Pago: <span className="font-bold text-green-500">{formatCurrency(paymentExpenseData.paidAmount || 0)}</span>
            </p>
            <div>
              <label htmlFor="paymentAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor do Pagamento (R$)</label>
              <input
                id="paymentAmount"
                type="text"
                value={formatInputReal(paymentAmount)}
                onChange={(e) => setPaymentAmount(parseInputReal(e.target.value))}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Valor do pagamento"
              />
            </div>
            <div>
              <label htmlFor="paymentDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data do Pagamento</label>
              <input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setNewPaymentDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
                aria-label="Data do pagamento"
              />
            </div>
          </form>
        </ZeModal>
      )}


      {/* =========================================
       * TAB CONTENT: FERRAMENTAS
       * ========================================= */}
      {activeTab === 'FERRAMENTAS' && (
        <div className="tab-content animate-in fade-in duration-300">
          {activeSubView === 'NONE' && (
            <>
              <h2 className="text-xl font-black text-primary dark:text-white mb-6">Ferramentas de Gestão</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ToolCard
                  icon="fa-people-group"
                  title="Funcionários"
                  description="Gerencie a equipe de trabalho e seus contatos."
                  onClick={() => goToSubView('WORKERS')}
                />
                <ToolCard
                  icon="fa-truck-field"
                  title="Fornecedores"
                  description="Cadastre seus fornecedores e organize seus materiais."
                  onClick={() => goToSubView('SUPPLIERS')}
                />
                <ToolCard
                  icon="fa-camera"
                  title="Fotos da Obra"
                  description="Registre o progresso e os detalhes visuais do projeto."
                  onClick={() => goToSubView('PHOTOS')}
                />
                <ToolCard
                  icon="fa-file-alt"
                  title="Arquivos da Obra"
                  description="Organize projetos, plantas e documentos importantes."
                  onClick={() => goToSubView('FILES')}
                />
                <ToolCard
                  icon="fa-file-contract"
                  title="Gerador de Contratos"
                  description="Crie contratos e recibos de mão de obra rapidamente."
                  onClick={() => goToSubView('CONTRACTS')}
                  isLocked={!isVitalicio}
                  requiresVitalicio={true}
                />
                <ToolCard
                  icon="fa-list-check"
                  title="Checklists"
                  description="Listas de verificação para garantir a qualidade de cada etapa."
                  onClick={() => goToSubView('CHECKLIST')}
                  isLocked={!isVitalicio}
                  requiresVitalicio={true}
                />
                <ToolCard
                  icon="fa-robot"
                  title="Planejador AI"
                  description="Deixe o Zé da Obra AI gerar seu cronograma inteligente."
                  onClick={() => navigate(`/work/${workId}/ai-planner`)}
                  isLocked={!hasAiAccess}
                  requiresVitalicio={true}
                />
                <ToolCard
                  icon="fa-chart-pie"
                  title="Relatórios Detalhados"
                  description="Acompanhe o desempenho financeiro e de cronograma."
                  onClick={() => navigate(`/work/${workId}/reports`)}
                  isLocked={!hasAiAccess}
                  requiresVitalicio={true}
                />
              </div>
            </>
          )}

          {/* SubView: Workers */}
          {activeSubView === 'WORKERS' && (
            <div className="animate-in fade-in duration-300">
              <ToolSubViewHeader title="Funcionários" onBack={() => goToSubView('NONE')} onAdd={() => { setShowAddWorkerModal(true); setNewWorkerName(''); setNewWorkerRole(''); setNewWorkerPhone(''); setNewWorkerDailyRate(''); setNewWorkerNotes(''); setEditWorkerData(null); }} loading={isAddingWorker}/>
              {loadingWorkers ? (
                <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                    <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando funcionários...
                </div>
              ) : workers.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">
                  Nenhum funcionário cadastrado.
                </div>
              ) : (
                <div className="space-y-4">
                  {workers.map(worker => (
                    <div key={worker.id} className={cx(surface, "p-5 rounded-2xl flex items-center justify-between gap-4")}>
                      <div>
                        <h3 className="font-bold text-primary dark:text-white text-base">{worker.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{worker.role} - {worker.phone}</p>
                        {worker.dailyRate && <p className="text-xs text-slate-400">Diária: {formatCurrency(worker.dailyRate)}</p>}
                        {worker.notes && <p className="text-xs text-slate-400 italic">Obs: {worker.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
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
                          className="text-slate-500 hover:text-primary dark:hover:text-white transition-colors"
                          aria-label={`Editar funcionário ${worker.name}`}
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir o funcionário "${worker.name}"?`,
                            type: "DANGER",
                            confirmText: "Sim, Excluir",
                            onConfirm: () => handleDeleteWorker(worker.id, worker.name),
                            onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                            id: worker.id
                          })}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          aria-label={`Excluir funcionário ${worker.name}`}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add/Edit Worker Modal */}
          {showAddWorkerModal && (
            <ZeModal
              isOpen={showAddWorkerModal}
              title={editWorkerData ? "Editar Funcionário" : "Adicionar Novo Funcionário"}
              message=""
              confirmText={editWorkerData ? "Salvar Alterações" : "Adicionar Funcionário"}
              onConfirm={editWorkerData ? handleEditWorker : handleAddWorker}
              onCancel={() => { setShowAddWorkerModal(false); setEditWorkerData(null); }}
              type="INFO"
              isConfirming={isAddingWorker}
            >
              <form onSubmit={editWorkerData ? handleEditWorker : handleAddWorker} className="space-y-4">
                <div>
                  <label htmlFor="workerName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                  <input
                    id="workerName"
                    type="text"
                    value={newWorkerName}
                    onChange={(e) => setNewWorkerName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Nome completo do funcionário"
                  />
                </div>
                <div>
                  <label htmlFor="workerRole" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Função</label>
                  <select
                    id="workerRole"
                    value={newWorkerRole}
                    onChange={(e) => setNewWorkerRole(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Função do funcionário"
                  >
                    <option value="">Selecione uma função</option>
                    {STANDARD_JOB_ROLES.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="workerPhone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone (WhatsApp)</label>
                  <input
                    id="workerPhone"
                    type="tel"
                    value={newWorkerPhone}
                    onChange={(e) => setNewWorkerPhone(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Telefone do funcionário (WhatsApp)"
                  />
                </div>
                <div>
                  <label htmlFor="workerDailyRate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Diária (R$ - Opcional)</label>
                  <input
                    id="workerDailyRate"
                    type="text"
                    value={formatInputReal(newWorkerDailyRate)}
                    onChange={(e) => setNewWorkerDailyRate(parseInputReal(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    aria-label="Valor da diária (opcional)"
                  />
                </div>
                <div>
                  <label htmlFor="workerNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações (Opcional)</label>
                  <textarea
                    id="workerNotes"
                    value={newWorkerNotes}
                    onChange={(e) => setNewWorkerNotes(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    rows={3}
                    aria-label="Observações sobre o funcionário"
                  ></textarea>
                </div>
              </form>
            </ZeModal>
          )}

          {/* SubView: Suppliers */}
          {activeSubView === 'SUPPLIERS' && (
            <div className="animate-in fade-in duration-300">
              <ToolSubViewHeader title="Fornecedores" onBack={() => goToSubView('NONE')} onAdd={() => { setShowAddSupplierModal(true); setNewSupplierName(''); setNewSupplierCategory(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setNewSupplierAddress(''); setNewSupplierNotes(''); setEditSupplierData(null); }} loading={isAddingSupplier}/>
              {loadingSuppliers ? (
                <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                    <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando fornecedores...
                </div>
              ) : suppliers.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">
                  Nenhum fornecedor cadastrado.
                </div>
              ) : (
                <div className="space-y-4">
                  {suppliers.map(supplier => (
                    <div key={supplier.id} className={cx(surface, "p-5 rounded-2xl flex items-center justify-between gap-4")}>
                      <div>
                        <h3 className="font-bold text-primary dark:text-white text-base">{supplier.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{supplier.category} - {supplier.phone}</p>
                        {supplier.email && <p className="text-xs text-slate-400">Email: {supplier.email}</p>}
                        {supplier.address && <p className="text-xs text-slate-400">Endereço: {supplier.address}</p>}
                        {supplier.notes && <p className="text-xs text-slate-400 italic">Obs: {supplier.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
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
                          className="text-slate-500 hover:text-primary dark:hover:text-white transition-colors"
                          aria-label={`Editar fornecedor ${supplier.name}`}
                        >
                          <i className="fa-solid fa-edit"></i>
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir o fornecedor "${supplier.name}"?`,
                            type: "DANGER",
                            confirmText: "Sim, Excluir",
                            onConfirm: () => handleDeleteSupplier(supplier.id, supplier.name),
                            onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                            id: supplier.id
                          })}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          aria-label={`Excluir fornecedor ${supplier.name}`}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              isConfirming={isAddingSupplier}
            >
              <form onSubmit={editSupplierData ? handleEditSupplier : handleAddSupplier} className="space-y-4">
                <div>
                  <label htmlFor="supplierName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Fornecedor</label>
                  <input
                    id="supplierName"
                    type="text"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Nome do fornecedor"
                  />
                </div>
                <div>
                  <label htmlFor="supplierCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                  <select
                    id="supplierCategory"
                    value={newSupplierCategory}
                    onChange={(e) => setNewSupplierCategory(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Categoria do fornecedor"
                  >
                    <option value="">Selecione uma categoria</option>
                    {STANDARD_SUPPLIER_CATEGORIES.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="supplierPhone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                  <input
                    id="supplierPhone"
                    type="tel"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Telefone do fornecedor"
                  />
                </div>
                <div>
                  <label htmlFor="supplierEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail (Opcional)</label>
                  <input
                    id="supplierEmail"
                    type="email"
                    value={newSupplierEmail}
                    onChange={(e) => setNewSupplierEmail(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    aria-label="E-mail do fornecedor (opcional)"
                  />
                </div>
                <div>
                  <label htmlFor="supplierAddress" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço (Opcional)</label>
                  <input
                    id="supplierAddress"
                    type="text"
                    value={newSupplierAddress}
                    onChange={(e) => setNewSupplierAddress(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    aria-label="Endereço do fornecedor (opcional)"
                  />
                </div>
                <div>
                  <label htmlFor="supplierNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações (Opcional)</label>
                  <textarea
                    id="supplierNotes"
                    value={newSupplierNotes}
                    onChange={(e) => setNewSupplierNotes(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    rows={3}
                    aria-label="Observações sobre o fornecedor"
                  ></textarea>
                </div>
              </form>
            </ZeModal>
          )}

          {/* SubView: Photos */}
          {activeSubView === 'PHOTOS' && (
            <div className="animate-in fade-in duration-300">
              <ToolSubViewHeader title="Fotos da Obra" onBack={() => goToSubView('NONE')} onAdd={() => { setShowAddPhotoModal(true); setNewPhotoDescription(''); setNewPhotoFile(null); setNewPhotoType('PROGRESS'); }} loading={uploadingPhoto}/>
              {loadingPhotos ? (
                <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                    <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando fotos...
                </div>
              ) : photos.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">
                  Nenhuma foto cadastrada.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {photos.map(photo => (
                    <div key={photo.id} className={cx(surface, "p-4 rounded-2xl flex flex-col")}>
                      <img src={photo.url} alt={photo.description} className="w-full h-40 object-cover rounded-xl mb-3" />
                      <p className="font-bold text-primary dark:text-white text-base leading-tight">{photo.description}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Data: {formatDateDisplay(photo.date)} | Tipo: {photo.type}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <a href={photo.url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-secondary-dark transition-colors" aria-label={`Ver foto ${photo.description}`}>
                          <i className="fa-solid fa-eye"></i> Ver
                        </a>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir a foto "${photo.description}"?`,
                            type: "DANGER",
                            confirmText: "Sim, Excluir",
                            onConfirm: () => handleDeletePhoto(photo.id, photo.url, photo.description),
                            onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                            id: photo.id
                          })}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          aria-label={`Excluir foto ${photo.description}`}
                        >
                          <i className="fa-solid fa-trash"></i> Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add Photo Modal */}
          {showAddPhotoModal && (
            <ZeModal
              isOpen={showAddPhotoModal}
              title="Adicionar Nova Foto"
              message=""
              confirmText="Adicionar Foto"
              onConfirm={handleAddPhoto}
              onCancel={() => { setShowAddPhotoModal(false); setNewPhotoFile(null); }}
              type="INFO"
              isConfirming={uploadingPhoto}
            >
              <form onSubmit={handleAddPhoto} className="space-y-4">
                <div>
                  <label htmlFor="photoFile" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Arquivo da Foto</label>
                  <input
                    id="photoFile"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Escolher arquivo de foto"
                  />
                </div>
                <div>
                  <label htmlFor="photoDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                  <input
                    id="photoDescription"
                    type="text"
                    value={newPhotoDescription}
                    onChange={(e) => setNewPhotoDescription(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Descrição da foto"
                  />
                </div>
                <div>
                  <label htmlFor="photoType" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Foto</label>
                  <select
                    id="photoType"
                    value={newPhotoType}
                    onChange={(e) => setNewPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'PROGRESS')}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Tipo de foto"
                  >
                    <option value="PROGRESS">Progresso</option>
                    <option value="BEFORE">Antes</option>
                    <option value="AFTER">Depois</option>
                  </select>
                </div>
              </form>
            </ZeModal>
          )}

          {/* SubView: Files */}
          {activeSubView === 'FILES' && (
            <div className="animate-in fade-in duration-300">
              <ToolSubViewHeader title="Arquivos da Obra" onBack={() => goToSubView('NONE')} onAdd={() => { setShowAddFileModal(true); setNewFileName(''); setNewFileCategory(FileCategory.GENERAL); setNewUploadFile(null); }} loading={uploadingFile}/>
              {loadingFiles ? (
                <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                    <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando arquivos...
                </div>
              ) : files.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">
                  Nenhum arquivo cadastrado.
                </div>
              ) : (
                <div className="space-y-4">
                  {files.map(file => (
                    <div key={file.id} className={cx(surface, "p-5 rounded-2xl flex items-center justify-between gap-4")}>
                      <div className="flex items-center gap-3">
                        <i className="fa-solid fa-file-alt text-xl text-secondary"></i>
                        <div>
                          <p className="font-bold text-primary dark:text-white text-base">{file.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Categoria: {file.category} | Data: {formatDateDisplay(file.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-secondary-dark transition-colors" aria-label={`Abrir arquivo ${file.name}`}>
                          <i className="fa-solid fa-external-link-alt"></i> Abrir
                        </a>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir o arquivo "${file.name}"?`,
                            type: "DANGER",
                            confirmText: "Sim, Excluir",
                            onConfirm: () => handleDeleteFile(file.id, file.url, file.name),
                            onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                            id: file.id
                          })}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          aria-label={`Excluir arquivo ${file.name}`}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add File Modal */}
          {showAddFileModal && (
            <ZeModal
              isOpen={showAddFileModal}
              title="Adicionar Novo Arquivo"
              message=""
              confirmText="Adicionar Arquivo"
              onConfirm={handleAddFile}
              onCancel={() => { setShowAddFileModal(false); setNewUploadFile(null); }}
              type="INFO"
              isConfirming={uploadingFile}
            >
              <form onSubmit={handleAddFile} className="space-y-4">
                <div>
                  <label htmlFor="uploadFile" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Arquivo</label>
                  <input
                    id="uploadFile"
                    type="file"
                    onChange={handleUploadFileChange}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Escolher arquivo para upload"
                  />
                </div>
                <div>
                  <label htmlFor="fileName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Arquivo</label>
                  <input
                    id="fileName"
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Nome do arquivo"
                  />
                </div>
                <div>
                  <label htmlFor="fileCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                  <select
                    id="fileCategory"
                    value={newFileCategory}
                    onChange={(e) => setNewFileCategory(e.target.value as FileCategory)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Categoria do arquivo"
                  >
                    {Object.values(FileCategory).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </form>
            </ZeModal>
          )}

          {/* SubView: Contracts */}
          {activeSubView === 'CONTRACTS' && (
            <div className="animate-in fade-in duration-300">
              <ToolSubViewHeader title="Gerador de Contratos" onBack={() => goToSubView('NONE')} />
              {loadingContracts ? (
                <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                    <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando contratos...
                </div>
              ) : contracts.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">
                  Nenhum modelo de contrato disponível.
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts.map(contract => (
                    <div key={contract.id} className={cx(surface, "p-5 rounded-2xl flex items-center justify-between gap-4")}>
                      <div>
                        <h3 className="font-bold text-primary dark:text-white text-base">{contract.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Categoria: {contract.category}</p>
                      </div>
                      <button
                        onClick={() => handleViewContract(contract)}
                        className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                        aria-label={`Ver modelo de contrato ${contract.title}`}
                      >
                        <i className="fa-solid fa-file-alt"></i> Ver Modelo
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contract Content Modal */}
          {showContractContentModal && (
            <ZeModal
              isOpen={showContractContentModal}
              title={selectedContractTitle}
              message="" // Custom content handles message
              confirmText={copyContractSuccess ? "Copiado!" : "Copiar Conteúdo"}
              onConfirm={async () => {
                try {
                  await navigator.clipboard.writeText(selectedContractContent);
                  setCopyContractSuccess(true);
                  setTimeout(() => setShowContractContentModal(false), 1500); // Auto-close after copy
                } catch (err) {
                  console.error("Failed to copy text:", err);
                  alert("Erro ao copiar o conteúdo.");
                }
              }}
              onCancel={() => setShowContractContentModal(false)}
              type={copyContractSuccess ? "SUCCESS" : "INFO"}
              isConfirming={false} // Copy is usually fast
            >
              <div className="max-h-[50vh] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-sm whitespace-pre-wrap font-mono text-primary dark:text-white">
                {selectedContractContent}
              </div>
            </ZeModal>
          )}

          {/* SubView: Checklists */}
          {activeSubView === 'CHECKLIST' && (
            <div className="animate-in fade-in duration-300">
              <ToolSubViewHeader title="Checklists da Obra" onBack={() => goToSubView('NONE')} onAdd={() => { setShowAddChecklistModal(true); setNewChecklistName(''); setNewChecklistCategory(''); setNewChecklistItems(['']); setEditChecklistData(null); }} loading={isAddingChecklist}/>
              {loadingChecklists ? (
                <div className="text-center text-slate-400 py-10 italic text-lg flex items-center justify-center gap-2">
                    <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> Carregando checklists...
                </div>
              ) : checklists.length === 0 ? (
                <div className="text-center text-slate-400 py-10 italic text-lg">
                  Nenhuma checklist cadastrada.
                </div>
              ) : (
                <div className="space-y-4">
                  {checklists.map(checklist => (
                    <div key={checklist.id} className={cx(surface, "p-5 rounded-2xl flex flex-col")}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-primary dark:text-white text-base">{checklist.name}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Categoria: {checklist.category}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setEditChecklistData(checklist);
                              setNewChecklistName(checklist.name);
                              setNewChecklistCategory(checklist.category);
                              setNewChecklistItems(checklist.items.map(item => item.text));
                              setShowAddChecklistModal(true);
                            }}
                            className="text-slate-500 hover:text-primary dark:hover:text-white transition-colors"
                            aria-label={`Editar checklist ${checklist.name}`}
                          >
                            <i className="fa-solid fa-edit"></i>
                          </button>
                          <button
                            onClick={() => setZeModal({
                              isOpen: true,
                              title: "Confirmar Exclusão",
                              message: `Tem certeza que deseja excluir a checklist "${checklist.name}"?`,
                              type: "DANGER",
                              confirmText: "Sim, Excluir",
                              onConfirm: () => handleDeleteChecklist(checklist.id, checklist.name),
                              onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                              id: checklist.id
                            })}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            aria-label={`Excluir checklist ${checklist.name}`}
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {checklist.items.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Nenhum item na checklist.</p>
                        ) : (
                          checklist.items.map(item => (
                            <div key={item.id} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`checklist-item-${item.id}`}
                                checked={item.checked}
                                onChange={(e) => handleChecklistItemToggle(checklist.id, item.id, e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-secondary focus:ring-secondary/50 mr-2"
                                aria-label={`Marcar item ${item.text} como ${item.checked ? 'não concluído' : 'concluído'}`}
                              />
                              <label htmlFor={`checklist-item-${item.id}`} className={cx("text-sm text-primary dark:text-white", item.checked ? "line-through text-slate-400" : "")}>
                                {item.text}
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add/Edit Checklist Modal */}
          {showAddChecklistModal && (
            <ZeModal
              isOpen={showAddChecklistModal}
              title={editChecklistData ? "Editar Checklist" : "Adicionar Nova Checklist"}
              message=""
              confirmText={editChecklistData ? "Salvar Alterações" : "Adicionar Checklist"}
              onConfirm={editChecklistData ? handleEditChecklist : handleAddChecklist}
              onCancel={() => { setShowAddChecklistModal(false); setEditChecklistData(null); setNewChecklistItems(['']); }}
              type="INFO"
              isConfirming={isAddingChecklist}
            >
              <form onSubmit={editChecklistData ? handleEditChecklist : handleAddChecklist} className="space-y-4">
                <div>
                  <label htmlFor="checklistName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Checklist</label>
                  <input
                    id="checklistName"
                    type="text"
                    value={newChecklistName}
                    onChange={(e) => setNewChecklistName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Nome da checklist"
                  />
                </div>
                <div>
                  <label htmlFor="checklistCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                  <input
                    id="checklistCategory"
                    type="text"
                    value={newChecklistCategory}
                    onChange={(e) => setNewChecklistCategory(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    required
                    aria-label="Categoria da checklist"
                  />
                </div>
                <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Itens da Checklist</h4>
                  {newChecklistItems.map((itemText, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={itemText}
                        onChange={(e) => handleChecklistItemChange(index, e.target.value)}
                        className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white text-sm"
                        placeholder={`Item ${index + 1}`}
                        aria-label={`Item da checklist ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(index)}
                        className="text-red-500 hover:text-red-700 transition-colors p-1"
                        aria-label={`Remover item ${index + 1}`}
                      >
                        <i className="fa-solid fa-minus-circle"></i>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    aria-label="Adicionar novo item à checklist"
                  >
                    <i className="fa-solid fa-plus-circle"></i> Adicionar Item
                  </button>
                </div>
              </form>
            </ZeModal>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkDetail;
