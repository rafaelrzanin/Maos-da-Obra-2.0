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
          Nova
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
export const WorkDetail: React.FC<WorkDetailProps> = ({ activeTab, onTabChange }): React.ReactNode => {
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
  // const [showInitialOrientation, setShowInitialOrientation = useState(false);


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
      return; // Returns void (implicitly undefined)
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
        return; // Returns void (implicitly undefined)
      }
      setWork(fetchedWork);

      if (!hasAiAccess) {
        setShowAiAccessModal(true);
        // Do NOT set workError here, as access modal takes precedence
      }
      // Explicitly return void to satisfy the type.
      return;
    } catch (err: any) {
      console.error("Erro ao carregar dados iniciais da obra:", err);
      setWork(null);
      setWorkError(`Erro ao carregar obra: ${err.message || 'Erro desconhecido.'}`);
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
    } catch (err: any) {
      console.error("Erro ao carregar etapas:", err);
      showToastNotification(`Erro ao carregar etapas: ${err.message}`, 'error');
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
    } catch (err: any) {
      console.error("Erro ao carregar materiais:", err);
      showToastNotification(`Erro ao carregar materiais: ${err.message}`, 'error');
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
    } catch (err: any) {
      console.error("Erro ao carregar despesas:", err);
      showToastNotification(`Erro ao carregar despesas: ${err.message}`, 'error');
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
    } catch (err: any) {
      console.error("Erro ao carregar trabalhadores:", err);
      showToastNotification(`Erro ao carregar trabalhadores: ${err.message}`, 'error');
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
    } catch (err: any) {
      console.error("Erro ao carregar fornecedores:", err);
      showToastNotification(`Erro ao carregar fornecedores: ${err.message}`, 'error');
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
    } catch (err: any) {
      console.error("Erro ao carregar fotos:", err);
      showToastNotification(`Erro ao carregar fotos: ${err.message}`, 'error');
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
    } catch (err: any) {
      console.error("Erro ao carregar arquivos:", err);
      showToastNotification(`Erro ao carregar arquivos: ${err.message}`, 'error');
    } finally {
      setLoadingFiles(false);
    }
  }, [workId, user, showToastNotification]);

  const _fetchContractsData = useCallback(async (): Promise<void> => {
    if (!user?.id) return; // Contracts are global, not work-specific
    setLoadingContracts(true);
    try {
      const fetchedContracts = await dbService.getContractTemplates();
      setContracts(fetchedContracts);
    } catch (err: any) {
      console.error("Erro ao carregar modelos de contrato:", err);
      showToastNotification(`Erro ao carregar modelos de contrato: ${err.message}`, 'error');
    } finally {
      setLoadingContracts(false);
    }
  }, [user, showToastNotification]);

  const _fetchChecklistsData = useCallback(async () => {
    if (!workId || !user?.id) return;
    setLoadingChecklists(true);
    try {
      const fetchedChecklists = await dbService.getChecklists(workId);
      setChecklists(fetchedChecklists);
    } catch (err: any) {
      console.error("Erro ao carregar checklists:", err);
      showToastNotification(`Erro ao carregar checklists: ${err.message}`, 'error');
    } finally {
      setLoadingChecklists(false);
    }
  }, [workId, user, showToastNotification]);


  // Initial load for work data
  useEffect(() => {
    if (!isUserAuthFinished || authLoading) return;
    _fetchInitialWorkAndAccess();
  }, [isUserAuthFinished, authLoading, _fetchInitialWorkAndAccess]);

  // Load specific tab data when `activeTab` or `workId` changes
  useEffect(() => {
    if (!user?.id || !workId || loadingInitialWork || workError) return;

    // First, try to read tab from URL (overrides prop default on initial load)
    const params = new URLSearchParams(location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl && ['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'].includes(tabFromUrl)) {
      onTabChange(tabFromUrl as MainTab);
    } else if (!tabFromUrl) {
      // If no tab in URL, ensure it defaults to 'ETAPAS' (or what's passed by prop)
      onTabChange(activeTab);
    }

    switch (activeTab) {
      case 'ETAPAS':
        _fetchStepsData();
        // Also ensure materials are loaded, as step status depends on it.
        // This makes "ETAPAS" tab a more comprehensive status overview.
        _fetchMaterialsData(); 
        break;
      case 'MATERIAIS':
        _fetchMaterialsData();
        _fetchStepsData(); // Materials view needs steps for filtering and step-linking
        break;
      case 'FINANCEIRO':
        _fetchExpensesData();
        _fetchStepsData(); // Expenses view needs steps for grouping
        break;
      case 'FERRAMENTAS':
        // No general data to load, sub-views will trigger their own loads
        break;
      default:
        break;
    }
  }, [activeTab, workId, user, loadingInitialWork, workError, _fetchStepsData, _fetchMaterialsData, _fetchExpensesData, onTabChange, location.search]);


  // Load data for specific sub-views within 'FERRAMENTAS'
  useEffect(() => {
    if (!user?.id || !workId || activeTab !== 'FERRAMENTAS') return;

    switch (activeSubView) {
      case 'WORKERS':
        _fetchWorkersData();
        break;
      case 'SUPPLIERS':
        _fetchSuppliersData();
        break;
      case 'PHOTOS':
        _fetchPhotosData();
        break;
      case 'FILES':
        _fetchFilesData();
        break;
      case 'CONTRACTS':
        _fetchContractsData();
        break;
      case 'CHECKLIST':
        _fetchChecklistsData();
        break;
      default:
        break;
    }
  }, [activeSubView, workId, user, activeTab, _fetchWorkersData, _fetchSuppliersData, _fetchPhotosData, _fetchFilesData, _fetchContractsData, _fetchChecklistsData]);

  // =======================================================================
  // HANDLERS
  // =======================================================================

  const handleDragStart = (e: React.DragEvent, stepId: string) => {
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stepId); // Store stepId in dataTransfer
    e.currentTarget.classList.add('opacity-50'); // Visual feedback
  };

  const handleDragOver = (e: React.DragEvent, stepId: string) => {
    e.preventDefault(); // Allows drop
    if (draggedStepId !== stepId) {
      setDragOverStepId(stepId);
    }
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (_e: React.DragEvent) => {
    setDragOverStepId(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedStepId(null);
    setDragOverStepId(null);
    e.currentTarget.classList.remove('opacity-50');
  };

  const handleDrop = async (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    setDragOverStepId(null);

    if (draggedId === targetStepId) return;

    const draggedStepIndex = steps.findIndex(s => s.id === draggedId);
    const targetStepIndex = steps.findIndex(s => s.id === targetStepId);

    if (draggedStepIndex === -1 || targetStepIndex === -1) return;

    // Prevent reordering if the dragged step has started (immutability rule)
    const draggedStep = steps[draggedStepIndex];
    if (draggedStep.startDate) {
        showToastNotification("Não é possível reordenar etapas que já foram iniciadas.", 'warning');
        return;
    }

    const newSteps = Array.from(steps);
    const [removed] = newSteps.splice(draggedStepIndex, 1);
    newSteps.splice(targetStepIndex, 0, removed);

    // Update orderIndex in the backend
    try {
      setLoadingSteps(true);
      const updatePromises = newSteps.map(async (step, index) => {
        if (step.orderIndex !== (index + 1)) {
          const updatedStep = { ...step, orderIndex: index + 1 };
          return dbService.updateStep(updatedStep);
        }
        return Promise.resolve(step); // No actual update needed for this step
      });
      await Promise.all(updatePromises);
      showToastNotification("Ordem das etapas atualizada!", 'success');
      _fetchStepsData(); // Re-fetch to ensure consistency
    } catch (err: any) {
      console.error("Erro ao reordenar etapas:", err);
      showToastNotification(`Erro ao reordenar etapas: ${err.message}`, 'error');
      _fetchStepsData(); // Re-fetch to revert to original state
    } finally {
      setLoadingSteps(false);
    }
  };


  // --- STEPS HANDLERS ---
  const handleAddStep = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!workId || !newStepName.trim() || isUpdatingStepStatus) return; // Use isUpdatingStepStatus as general step loading

    // Simple date validation
    if (newStepStartDate && newStepEndDate && new Date(newStepEndDate) < new Date(newStepStartDate)) {
        showToastNotification("A data de término não pode ser anterior à data de início.", 'error');
        return;
    }
    if (!newStepStartDate && newStepEndDate) {
        showToastNotification("A data de término não pode ser definida se a data de início não estiver definida.", 'error');
        return;
    }

    setIsUpdatingStepStatus(true); // Set loading state for step operations
    try {
      await dbService.addStep({
        workId,
        name: newStepName.trim(),
        startDate: newStepStartDate,
        endDate: newStepEndDate,
        realDate: null, // Always null on creation
        estimatedDurationDays: Number(newEstimatedDurationDays) || undefined,
      });
      showToastNotification("Etapa adicionada com sucesso!", 'success');
      setShowAddStepModal(false);
      setNewStepName('');
      setNewStepStartDate(new Date().toISOString().split('T')[0]);
      setNewStepEndDate(new Date().toISOString().split('T')[0]);
      setNewEstimatedDurationDays('');
      _fetchStepsData();
      _fetchMaterialsData(); // Materials might be regenerated based on new steps
    } catch (err: any) {
      console.error("Erro ao adicionar etapa:", err);
      showToastNotification(`Erro ao adicionar etapa: ${err.message}`, 'error');
    } finally {
      setIsUpdatingStepStatus(false);
    }
  };

  const handleUpdateStep = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!editStepData || isUpdatingStepStatus) return;

    // Ensure status is correctly derived, not directly sent
    const updatedStepToSend: Step = {
      ...editStepData,
      estimatedDurationDays: Number(newEstimatedDurationDays) || undefined,
      // Status is derived in parseStepFromDB, not set directly here
    };

    setIsUpdatingStepStatus(true); // Set loading state for step operations
    try {
      await dbService.updateStep(updatedStepToSend);
      showToastNotification("Etapa atualizada com sucesso!", 'success');
      setEditStepData(null); // Close edit modal
      setNewEstimatedDurationDays('');
      _fetchStepsData(); // Reload steps
      _fetchMaterialsData(); // Reload materials as step changes can affect material status
    } catch (err: any) {
      console.error("Erro ao atualizar etapa:", err);
      showToastNotification(`Erro ao atualizar etapa: ${err.message}`, 'error');
    } finally {
      setIsUpdatingStepStatus(false);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!workId || isUpdatingStepStatus) return;
    setIsUpdatingStepStatus(true); // Set loading state for step operations
    try {
      await dbService.deleteStep(stepId, workId);
      showToastNotification("Etapa excluída com sucesso!", 'success');
      _fetchStepsData();
      _fetchMaterialsData(); // Materials linked to this step will be deleted/reloaded
    } catch (err: any) {
      console.error("Erro ao excluir etapa:", err);
      showToastNotification(`Erro ao excluir etapa: ${err.message}`, 'error');
    } finally {
      setIsUpdatingStepStatus(false);
    }
  };

  const toggleStepStatus = async (step: Step) => {
    if (!workId || isUpdatingStepStatus) return;
    setIsUpdatingStepStatus(true); // Set loading state for step operations

    const newRealDate = step.realDate ? null : new Date().toISOString().split('T')[0];
    // The `status` property in `Step` is now a derived field and not directly set by `updateStep`.
    // So, we don't need to calculate `newStatus` here, just pass `newRealDate`.
    // The `parseStepFromDB` function handles the status derivation.
    
    try {
      await dbService.updateStep({ ...step, realDate: newRealDate });
      showToastNotification(`Etapa ${newRealDate ? 'concluída' : 'reaberta'} com sucesso!`, 'success');
      _fetchStepsData(); // Reload steps
      _fetchMaterialsData(); // Reload materials as step status affects material status
    } catch (err: any) {
      console.error("Erro ao alterar status da etapa:", err);
      showToastNotification(`Erro ao alterar status da etapa: ${err.message}`, 'error');
    } finally {
      setIsUpdatingStepStatus(false);
    }
  };


  // --- MATERIALS HANDLERS ---
  const handleAddMaterial = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!workId || !user?.id || !newMaterialName.trim() || !newMaterialUnit.trim() || !newMaterialPlannedQty.trim() || loadingMaterials) return;

    const plannedQty = Number(newMaterialPlannedQty);
    if (isNaN(plannedQty) || plannedQty <= 0) {
      showToastNotification("Quantidade planejada deve ser um número maior que zero.", 'error');
      return;
    }

    setLoadingMaterials(true);
    try {
      await dbService.addMaterial(user.id, {
        workId,
        name: newMaterialName.trim(),
        brand: newMaterialBrand.trim(),
        plannedQty: plannedQty,
        purchasedQty: 0,
        unit: newMaterialUnit.trim(),
        stepId: newMaterialStepId || undefined,
        category: newMaterialCategory.trim()
      });
      showToastNotification("Material adicionado com sucesso!", 'success');
      setShowAddMaterialModal(false);
      setNewMaterialName('');
      setNewMaterialBrand('');
      setNewMaterialPlannedQty('');
      setNewMaterialUnit('');
      setNewMaterialCategory('');
      setNewMaterialStepId('');
      _fetchMaterialsData();
      _fetchStepsData(); // Material changes can affect step status
    } catch (err: any) {
      console.error("Erro ao adicionar material:", err);
      showToastNotification(`Erro ao adicionar material: ${err.message}`, 'error');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleUpdateMaterial = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!editMaterialData || loadingMaterials) return;

    const plannedQty = Number(newMaterialPlannedQty);
    if (isNaN(plannedQty) || plannedQty < 0) {
      showToastNotification("Quantidade planejada deve ser um número válido e não negativo.", 'error');
      return;
    }

    const updatedMaterial: Material = {
      ...editMaterialData,
      name: newMaterialName.trim(),
      brand: newMaterialBrand.trim(),
      plannedQty: plannedQty,
      unit: newMaterialUnit.trim(),
      stepId: newMaterialStepId || undefined,
      category: newMaterialCategory.trim(),
    };

    setLoadingMaterials(true);
    try {
      await dbService.updateMaterial(updatedMaterial);
      showToastNotification("Material atualizado com sucesso!", 'success');
      setEditMaterialData(null);
      setNewMaterialPlannedQty('');
      setNewMaterialUnit('');
      setNewMaterialBrand('');
      setNewMaterialName('');
      setNewMaterialCategory('');
      setNewMaterialStepId('');
      _fetchMaterialsData();
      _fetchStepsData(); // Material changes can affect step status
    } catch (err: any) {
      console.error("Erro ao atualizar material:", err);
      showToastNotification(`Erro ao atualizar material: ${err.message}`, 'error');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!workId || loadingMaterials) return;
    setLoadingMaterials(true);
    try {
      await dbService.deleteMaterial(materialId);
      showToastNotification("Material excluído com sucesso!", 'success');
      _fetchMaterialsData();
      _fetchExpensesData(); // Expenses might be related
      _fetchStepsData(); // Material changes can affect step status
    } catch (err: any) {
      console.error("Erro ao excluir material:", err);
      showToastNotification(`Erro ao excluir material: ${err.message}`, 'error');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const handleRegisterMaterialPurchase = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!editMaterialData || !user?.id || loadingMaterials) return;

    const purchasedQtyDelta = Number(purchaseQtyInput);
    const cost = Number(parseInputReal(purchaseCostInput)); // Use parsed value

    if (isNaN(purchasedQtyDelta) || purchasedQtyDelta <= 0 || isNaN(cost) || cost <= 0) {
      showToastNotification("Quantidade e custo da compra devem ser números maiores que zero.", 'error');
      return;
    }

    setLoadingMaterials(true);
    try {
      await dbService.registerMaterialPurchase(
        editMaterialData.id,
        editMaterialData.name,
        editMaterialData.brand,
        editMaterialData.plannedQty,
        editMaterialData.unit,
        purchasedQtyDelta,
        cost
      );
      showToastNotification("Compra de material registrada e despesa criada!", 'success');
      setPurchaseQtyInput('');
      setPurchaseCostInput('');
      setEditMaterialData(null); // Close the edit/purchase modal
      _fetchMaterialsData(); // Refresh materials
      _fetchExpensesData(); // Refresh expenses (new expense created)
      _fetchStepsData(); // Material status affects step status
    } catch (err: any) {
      console.error("Erro ao registrar compra de material:", err);
      showToastNotification(`Erro ao registrar compra: ${err.message}`, 'error');
    } finally {
      setLoadingMaterials(false);
    }
  };


  // --- EXPENSES HANDLERS ---
  const handleAddExpense = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!workId || !user?.id || !newExpenseDescription.trim() || !newExpenseAmount.trim() || loadingExpenses) return;

    const amount = Number(parseInputReal(newExpenseAmount)); // Use parsed value
    const totalAgreed = newExpenseTotalAgreed.trim() ? Number(parseInputReal(newExpenseTotalAgreed)) : undefined;

    if (isNaN(amount) || amount <= 0) {
      showToastNotification("Valor da despesa deve ser um número maior que zero.", 'error');
      return;
    }
    if (totalAgreed !== undefined && (isNaN(totalAgreed) || totalAgreed < 0)) {
      showToastNotification("Valor combinado deve ser um número válido e não negativo.", 'error');
      return;
    }

    setLoadingExpenses(true);
    try {
      await dbService.addExpense({
        workId,
        description: newExpenseDescription.trim(),
        amount: amount,
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId || undefined,
        workerId: newExpenseWorkerId || undefined,
        supplierId: newExpenseSupplierId || undefined,
        totalAgreed: totalAgreed,
      });
      showToastNotification("Despesa adicionada com sucesso!", 'success');
      setShowAddExpenseModal(false);
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setNewExpenseCategory(ExpenseCategory.OTHER);
      setNewExpenseDate(new Date().toISOString().split('T')[0]);
      setNewExpenseStepId('');
      setNewExpenseWorkerId('');
      setNewExpenseSupplierId('');
      setNewExpenseTotalAgreed('');
      _fetchExpensesData();
    } catch (err: any) {
      console.error("Erro ao adicionar despesa:", err);
      showToastNotification(`Erro ao adicionar despesa: ${err.message}`, 'error');
    } finally {
      setLoadingExpenses(false);
    }
  };

  const handleUpdateExpense = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!editExpenseData || loadingExpenses) return;

    const amount = Number(parseInputReal(newExpenseAmount));
    const totalAgreed = newExpenseTotalAgreed.trim() ? Number(parseInputReal(newExpenseTotalAgreed)) : undefined;

    if (isNaN(amount) || amount <= 0) {
      showToastNotification("Valor da despesa deve ser um número maior que zero.", 'error');
      return;
    }
    if (totalAgreed !== undefined && (isNaN(totalAgreed) || totalAgreed < 0)) {
      showToastNotification("Valor combinado deve ser um número válido e não negativo.", 'error');
      return;
    }

    const updatedExpense: Expense = {
      ...editExpenseData,
      description: newExpenseDescription.trim(),
      amount: amount,
      date: newExpenseDate,
      category: newExpenseCategory,
      stepId: newExpenseStepId || undefined,
      workerId: newExpenseWorkerId || undefined,
      supplierId: newExpenseSupplierId || undefined,
      totalAgreed: totalAgreed,
    };

    setLoadingExpenses(true);
    try {
      await dbService.updateExpense(updatedExpense);
      showToastNotification("Despesa atualizada com sucesso!", 'success');
      setEditExpenseData(null);
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setNewExpenseCategory(ExpenseCategory.OTHER);
      setNewExpenseDate(new Date().toISOString().split('T')[0]);
      setNewExpenseStepId('');
      setNewExpenseWorkerId('');
      setNewExpenseSupplierId('');
      setNewExpenseTotalAgreed('');
      _fetchExpensesData();
    } catch (err: any) {
      console.error("Erro ao atualizar despesa:", err);
      showToastNotification(`Erro ao atualizar despesa: ${err.message}`, 'error');
    } finally {
      setLoadingExpenses(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!workId || loadingExpenses) return;
    setLoadingExpenses(true);
    try {
      await dbService.deleteExpense(expenseId);
      showToastNotification("Despesa excluída com sucesso!", 'success');
      _fetchExpensesData();
      _fetchMaterialsData(); // If a material expense was deleted
    } catch (err: any) {
      console.error("Erro ao excluir despesa:", err);
      showToastNotification(`Erro ao excluir despesa: ${err.message}`, 'error');
    } finally {
      setLoadingExpenses(false);
    }
  };

  const handleAddPayment = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!paymentExpenseData || !user?.id || loadingExpenses) return;

    const amount = Number(parseInputReal(paymentAmount));
    if (isNaN(amount) || amount <= 0) {
      showToastNotification("Valor do pagamento deve ser um número maior que zero.", 'error');
      return;
    }

    setLoadingExpenses(true);
    try {
      await dbService.addPaymentToExpense(paymentExpenseData.id, amount, paymentDate);
      showToastNotification("Pagamento registrado com sucesso!", 'success');
      setShowAddPaymentModal(false);
      setPaymentExpenseData(null);
      setPaymentAmount('');
      setNewPaymentDate(new Date().toISOString().split('T')[0]);
      _fetchExpensesData(); // Refresh expenses
    } catch (err: any) {
      console.error("Erro ao registrar pagamento:", err);
      showToastNotification(`Erro ao registrar pagamento: ${err.message}`, 'error');
    } finally {
      setLoadingExpenses(false);
    }
  };


  // --- WORKERS HANDLERS ---
  const handleAddWorker = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!workId || !user?.id || !newWorkerName.trim() || !newWorkerRole.trim() || !newWorkerPhone.trim() || isAddingWorker) return;

    setIsAddingWorker(true);
    try {
      await dbService.addWorker({
        workId,
        userId: user.id,
        name: newWorkerName.trim(),
        role: newWorkerRole.trim(),
        phone: newWorkerPhone.trim(),
        dailyRate: Number(parseInputReal(newWorkerDailyRate)) || undefined,
        notes: newWorkerNotes.trim() || undefined,
      });
      showToastNotification("Trabalhador adicionado com sucesso!", 'success');
      setShowAddWorkerModal(false);
      setNewWorkerName('');
      setNewWorkerRole('');
      setNewWorkerPhone('');
      setNewWorkerDailyRate('');
      setNewWorkerNotes('');
      _fetchWorkersData();
    } catch (err: any) {
      console.error("Erro ao adicionar trabalhador:", err);
      showToastNotification(`Erro ao adicionar trabalhador: ${err.message}`, 'error');
    } finally {
      setIsAddingWorker(false);
    }
  };

  const handleUpdateWorker = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!editWorkerData || isAddingWorker) return; // Reusing isAddingWorker for general worker loading

    setIsAddingWorker(true);
    try {
      await dbService.updateWorker({
        ...editWorkerData,
        name: newWorkerName.trim(),
        role: newWorkerRole.trim(),
        phone: newWorkerPhone.trim(),
        dailyRate: Number(parseInputReal(newWorkerDailyRate)) || undefined,
        notes: newWorkerNotes.trim() || undefined,
      });
      showToastNotification("Trabalhador atualizado com sucesso!", 'success');
      setEditWorkerData(null);
      setNewWorkerName('');
      setNewWorkerRole('');
      setNewWorkerPhone('');
      setNewWorkerDailyRate('');
      setNewWorkerNotes('');
      _fetchWorkersData();
      _fetchExpensesData(); // Expenses might be related
    } catch (err: any) {
      console.error("Erro ao atualizar trabalhador:", err);
      showToastNotification(`Erro ao atualizar trabalhador: ${err.message}`, 'error');
    } finally {
      setIsAddingWorker(false);
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    if (!workId || isAddingWorker) return;
    setIsAddingWorker(true);
    try {
      await dbService.deleteWorker(workerId, workId);
      showToastNotification("Trabalhador excluído com sucesso!", 'success');
      _fetchWorkersData();
      _fetchExpensesData(); // Expenses might be related
    } catch (err: any) {
      console.error("Erro ao excluir trabalhador:", err);
      showToastNotification(`Erro ao excluir trabalhador: ${err.message}`, 'error');
    } finally {
      setIsAddingWorker(false);
    }
  };


  // --- SUPPLIERS HANDLERS ---
  const handleAddSupplier = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!workId || !user?.id || !newSupplierName.trim() || !newSupplierCategory.trim() || !newSupplierPhone.trim() || isAddingSupplier) return;

    setIsAddingSupplier(true);
    try {
      await dbService.addSupplier({
        workId,
        userId: user.id,
        name: newSupplierName.trim(),
        category: newSupplierCategory.trim(),
        phone: newSupplierPhone.trim(),
        email: newSupplierEmail.trim() || undefined,
        address: newSupplierAddress.trim() || undefined,
        notes: newSupplierNotes.trim() || undefined,
      });
      showToastNotification("Fornecedor adicionado com sucesso!", 'success');
      setShowAddSupplierModal(false);
      setNewSupplierName('');
      setNewSupplierCategory('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
      setNewSupplierAddress('');
      setNewSupplierNotes('');
      _fetchSuppliersData();
    } catch (err: any) {
      console.error("Erro ao adicionar fornecedor:", err);
      showToastNotification(`Erro ao adicionar fornecedor: ${err.message}`, 'error');
    } finally {
      setIsAddingSupplier(false);
    }
  };

  const handleUpdateSupplier = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!editSupplierData || isAddingSupplier) return;

    setIsAddingSupplier(true);
    try {
      await dbService.updateSupplier({
        ...editSupplierData,
        name: newSupplierName.trim(),
        category: newSupplierCategory.trim(),
        phone: newSupplierPhone.trim(),
        email: newSupplierEmail.trim() || undefined,
        address: newSupplierAddress.trim() || undefined,
        notes: newSupplierNotes.trim() || undefined,
      });
      showToastNotification("Fornecedor atualizado com sucesso!", 'success');
      setEditSupplierData(null);
      setNewSupplierName('');
      setNewSupplierCategory('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
      setNewSupplierAddress('');
      setNewSupplierNotes('');
      _fetchSuppliersData();
      _fetchExpensesData(); // Expenses might be related
    } catch (err: any) {
      console.error("Erro ao atualizar fornecedor:", err);
      showToastNotification(`Erro ao atualizar fornecedor: ${err.message}`, 'error');
    } finally {
      setIsAddingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!workId || isAddingSupplier) return;
    setIsAddingSupplier(true);
    try {
      await dbService.deleteSupplier(supplierId, workId);
      showToastNotification("Fornecedor excluído com sucesso!", 'success');
      _fetchSuppliersData();
      _fetchExpensesData(); // Expenses might be related
    } catch (err: any) {
      console.error("Erro ao excluir fornecedor:", err);
      showToastNotification(`Erro ao excluir fornecedor: ${err.message}`, 'error');
    } finally {
      setIsAddingSupplier(false);
    }
  };


  // --- PHOTOS HANDLERS ---
  const handleAddPhoto = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!workId || !newPhotoFile || !newPhotoDescription.trim() || uploadingPhoto) return;

    setLoadingPhoto(true);
    try {
      const filePath = `${user?.id}/${workId}/photos/${Date.now()}_${newPhotoFile.name}`;
      const { data, error: uploadError } = await supabase.storage.from('work-files').upload(filePath, newPhotoFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('work-files').getPublicUrl(data.path);

      await dbService.addPhoto({
        workId,
        url: publicUrlData.publicUrl,
        description: newPhotoDescription.trim(),
        date: new Date().toISOString().split('T')[0],
        type: newPhotoType,
      });
      showToastNotification("Foto adicionada com sucesso!", 'success');
      setShowAddPhotoModal(false);
      setNewPhotoDescription('');
      setNewPhotoFile(null);
      setNewPhotoType('PROGRESS');
      _fetchPhotosData();
    } catch (err: any) {
      console.error("Erro ao adicionar foto:", err);
      showToastNotification(`Erro ao adicionar foto: ${err.message}`, 'error');
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    if (!workId || uploadingPhoto) return; // Using uploadingPhoto as general photo loading/deleting state

    setLoadingPhoto(true);
    try {
      // Extract file path from URL
      const urlParts = photoUrl.split('/public/work-files/');
      const filePath = urlParts.length > 1 ? urlParts[1] : null;

      if (filePath) {
        await supabase.storage.from('work-files').remove([filePath]);
      } else {
        console.warn("Could not extract file path from URL:", photoUrl);
      }

      await dbService.deletePhoto(photoId);
      showToastNotification("Foto excluída com sucesso!", 'success');
      _fetchPhotosData();
    } catch (err: any) {
      console.error("Erro ao excluir foto:", err);
      showToastNotification(`Erro ao excluir foto: ${err.message}`, 'error');
    } finally {
      setLoadingPhoto(false);
    }
  };


  // --- FILES HANDLERS ---
  const handleAddFile = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!workId || !newUploadFile || !newFileName.trim() || uploadingFile) return;

    setLoadingFile(true);
    try {
      const filePath = `${user?.id}/${workId}/files/${Date.now()}_${newUploadFile.name}`;
      const { data, error: uploadError } = await supabase.storage.from('work-files').upload(filePath, newUploadFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('work-files').getPublicUrl(data.path);

      await dbService.addFile({
        workId,
        name: newFileName.trim(),
        category: newFileCategory,
        url: publicUrlData.publicUrl,
        type: newUploadFile.type || 'application/octet-stream', // Fallback for file type
        date: new Date().toISOString().split('T')[0],
      });
      showToastNotification("Arquivo adicionado com sucesso!", 'success');
      setShowAddFileModal(false);
      setNewFileName('');
      setNewFileCategory(FileCategory.GENERAL);
      setNewUploadFile(null);
      _fetchFilesData();
    } catch (err: any) {
      console.error("Erro ao adicionar arquivo:", err);
      showToastNotification(`Erro ao adicionar arquivo: ${err.message}`, 'error');
    } finally {
      setLoadingFile(false);
    }
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    if (!workId || uploadingFile) return;

    setLoadingFile(true);
    try {
      const urlParts = fileUrl.split('/public/work-files/');
      const filePath = urlParts.length > 1 ? urlParts[1] : null;

      if (filePath) {
        await supabase.storage.from('work-files').remove([filePath]);
      } else {
        console.warn("Could not extract file path from URL:", fileUrl);
      }

      await dbService.deleteFile(fileId);
      showToastNotification("Arquivo excluído com sucesso!", 'success');
      _fetchFilesData();
    } catch (err: any) {
      console.error("Erro ao excluir arquivo:", err);
      showToastNotification(`Erro ao excluir arquivo: ${err.message}`, 'error');
    } finally {
      setLoadingFile(false);
    }
  };


  // --- CONTRACTS HANDLERS ---
  const handleViewContract = (contract: Contract) => {
    setSelectedContractContent(contract.contentTemplate);
    setSelectedContractTitle(contract.title);
    setShowContractContentModal(true);
  };

  const handleCopyContractContent = () => {
    navigator.clipboard.writeText(selectedContractContent).then(() => {
      setCopyContractSuccess(true);
      setTimeout(() => setCopyContractSuccess(false), 2000);
    }).catch(err => {
      console.error("Erro ao copiar conteúdo:", err);
      showToastNotification("Falha ao copiar o conteúdo do contrato.", 'error');
    });
  };


  // --- CHECKLISTS HANDLERS ---
  const handleAddChecklist = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!workId || !newChecklistName.trim() || !newChecklistCategory.trim() || isAddingChecklist) return;

    const items: ChecklistItem[] = newChecklistItems
      .filter(itemText => itemText.trim() !== '')
      .map((itemText, index) => ({ id: `item-${index}`, text: itemText.trim(), checked: false }));

    if (items.length === 0) {
      showToastNotification("Adicione pelo menos um item para a checklist.", 'error');
      return;
    }

    setIsAddingChecklist(true);
    try {
      await dbService.addChecklist({
        workId,
        name: newChecklistName.trim(),
        category: newChecklistCategory.trim(),
        items,
      });
      showToastNotification("Checklist adicionada com sucesso!", 'success');
      setShowAddChecklistModal(false);
      setNewChecklistName('');
      setNewChecklistCategory('');
      setNewChecklistItems(['']);
      _fetchChecklistsData();
    } catch (err: any) {
      console.error("Erro ao adicionar checklist:", err);
      showToastNotification(`Erro ao adicionar checklist: ${err.message}`, 'error');
    } finally {
      setIsAddingChecklist(false);
    }
  };

  const handleUpdateChecklist = async (_e?: React.FormEvent) => {
    _e?.preventDefault();
    if (!editChecklistData || isAddingChecklist) return;

    const items: ChecklistItem[] = newChecklistItems
      .filter(itemText => itemText.trim() !== '')
      .map((itemText, index) => {
        // Try to preserve original item ID and checked status if possible, otherwise create new
        const existingItem = editChecklistData.items.find(item => item.text === itemText.trim());
        return existingItem ? { ...existingItem, text: itemText.trim() } : { id: `item-${Date.now()}-${index}`, text: itemText.trim(), checked: false };
      });

    if (items.length === 0) {
      showToastNotification("Adicione pelo menos um item para a checklist.", 'error');
      return;
    }

    setIsAddingChecklist(true);
    try {
      await dbService.updateChecklist({
        ...editChecklistData,
        name: newChecklistName.trim(),
        category: newChecklistCategory.trim(),
        items,
      });
      showToastNotification("Checklist atualizada com sucesso!", 'success');
      setEditChecklistData(null);
      setNewChecklistName('');
      setNewChecklistCategory('');
      setNewChecklistItems(['']);
      _fetchChecklistsData();
    } catch (err: any) {
      console.error("Erro ao atualizar checklist:", err);
      showToastNotification(`Erro ao atualizar checklist: ${err.message}`, 'error');
    } finally {
      setIsAddingChecklist(false);
    }
  };

  const handleToggleChecklistItem = async (checklistId: string, itemId: string, currentChecked: boolean) => {
    if (!workId || isAddingChecklist) return; // isAddingChecklist is general checklist loading

    setIsAddingChecklist(true);
    try {
      const checklistToUpdate = checklists.find(cl => cl.id === checklistId);
      if (!checklistToUpdate) throw new Error("Checklist não encontrada.");

      const updatedItems = checklistToUpdate.items.map(item =>
        item.id === itemId ? { ...item, checked: !currentChecked } : item
      );

      await dbService.updateChecklist({ ...checklistToUpdate, items: updatedItems });
      showToastNotification("Item da checklist atualizado!", 'success');
      _fetchChecklistsData();
    } catch (err: any) {
      console.error("Erro ao atualizar item da checklist:", err);
      showToastNotification(`Erro ao atualizar item da checklist: ${err.message}`, 'error');
    } finally {
      setIsAddingChecklist(false);
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!workId || isAddingChecklist) return;
    setIsAddingChecklist(true);
    try {
      await dbService.deleteChecklist(checklistId);
      showToastNotification("Checklist excluída com sucesso!", 'success');
      _fetchChecklistsData();
    } catch (err: any) {
      console.error("Erro ao excluir checklist:", err);
      showToastNotification(`Erro ao excluir checklist: ${err.message}`, 'error');
    } finally {
      setIsAddingChecklist(false);
    }
  };

  // --- General Form Modals ---
  const handleOpenAddStepModal = () => {
    setNewStepName('');
    setNewStepStartDate(new Date().toISOString().split('T')[0]);
    setNewStepEndDate(new Date().toISOString().split('T')[0]);
    setNewEstimatedDurationDays('');
    setShowAddStepModal(true);
  };

  const handleOpenEditStepModal = (step: Step) => {
    setEditStepData(step);
    setNewStepName(step.name);
    setNewStepStartDate(step.startDate);
    setNewStepEndDate(step.endDate);
    setNewEstimatedDurationDays(step.estimatedDurationDays?.toString() || '');
    setShowAddStepModal(true); // Re-use add modal for editing
  };

  const handleOpenAddMaterialModal = () => {
    setNewMaterialName('');
    setNewMaterialBrand('');
    setNewMaterialPlannedQty('');
    setNewMaterialUnit('');
    setNewMaterialCategory('');
    setNewMaterialStepId('');
    setShowAddMaterialModal(true);
  };

  const handleOpenEditMaterialModal = (material: Material) => {
    setEditMaterialData(material);
    setNewMaterialName(material.name);
    setNewMaterialBrand(material.brand || '');
    setNewMaterialPlannedQty(material.plannedQty.toString());
    setNewMaterialUnit(material.unit);
    setNewMaterialCategory(material.category || '');
    setNewMaterialStepId(material.stepId || '');
    setPurchaseQtyInput('');
    setPurchaseCostInput('');
    setShowAddMaterialModal(true);
  };

  const handleOpenAddExpenseModal = () => {
    setNewExpenseDescription('');
    setNewExpenseAmount('');
    setNewExpenseCategory(ExpenseCategory.OTHER);
    setNewExpenseDate(new Date().toISOString().split('T')[0]);
    setNewExpenseStepId('');
    setNewExpenseWorkerId('');
    setNewExpenseSupplierId('');
    setNewExpenseTotalAgreed('');
    setShowAddExpenseModal(true);
  };

  const handleOpenEditExpenseModal = (expense: Expense) => {
    setEditExpenseData(expense);
    setNewExpenseDescription(expense.description);
    setNewExpenseAmount(formatInputReal(expense.amount.toString()));
    setNewExpenseCategory(expense.category);
    setNewExpenseDate(expense.date);
    setNewExpenseStepId(expense.stepId || '');
    setNewExpenseWorkerId(expense.workerId || '');
    setNewExpenseSupplierId(expense.supplierId || '');
    setNewExpenseTotalAgreed(expense.totalAgreed !== undefined && expense.totalAgreed !== null ? formatInputReal(expense.totalAgreed.toString()) : '');
    setShowAddExpenseModal(true); // Re-use add modal for editing
  };

  const handleOpenAddPaymentModal = (expense: Expense) => {
    setPaymentExpenseData(expense);
    setPaymentAmount('');
    setNewPaymentDate(new Date().toISOString().split('T')[0]);
    setShowAddPaymentModal(true);
  };

  const handleOpenAddWorkerModal = () => {
    setNewWorkerName('');
    setNewWorkerRole('');
    setNewWorkerPhone('');
    setNewWorkerDailyRate('');
    setNewWorkerNotes('');
    setShowAddWorkerModal(true);
  };

  const handleOpenEditWorkerModal = (worker: Worker) => {
    setEditWorkerData(worker);
    setNewWorkerName(worker.name);
    setNewWorkerRole(worker.role);
    setNewWorkerPhone(worker.phone);
    setNewWorkerDailyRate(worker.dailyRate?.toString() || '');
    setNewWorkerNotes(worker.notes || '');
    setShowAddWorkerModal(true); // Re-use add modal for editing
  };

  const handleOpenAddSupplierModal = () => {
    setNewSupplierName('');
    setNewSupplierCategory('');
    setNewSupplierPhone('');
    setNewSupplierEmail('');
    setNewSupplierAddress('');
    setNewSupplierNotes('');
    setShowAddSupplierModal(true);
  };

  const handleOpenEditSupplierModal = (supplier: Supplier) => {
    setEditSupplierData(supplier);
    setNewSupplierName(supplier.name);
    setNewSupplierCategory(supplier.category);
    setNewSupplierPhone(supplier.phone);
    setNewSupplierEmail(supplier.email || '');
    setNewSupplierAddress(supplier.address || '');
    setNewSupplierNotes(supplier.notes || '');
    setShowAddSupplierModal(true); // Re-use add modal for editing
  };

  const handleOpenAddChecklistModal = () => {
    setNewChecklistName('');
    setNewChecklistCategory('');
    setNewChecklistItems(['']);
    setShowAddChecklistModal(true);
  };

  const handleOpenEditChecklistModal = (checklist: Checklist) => {
    setEditChecklistData(checklist);
    setNewChecklistName(checklist.name);
    setNewChecklistCategory(checklist.category);
    setNewChecklistItems(checklist.items.map(item => item.text));
    setShowAddChecklistModal(true); // Re-use add modal for editing
  };


  // =======================================================================
  // RENDER SECTIONS
  // =======================================================================

  const renderStepsTab = () => (
    <div className="tab-content animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
        <h2 className="text-2xl font-black text-primary dark:text-white">Cronograma da Obra</h2>
        <button
          onClick={handleOpenAddStepModal}
          className="px-4 py-2 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={loadingSteps || isUpdatingStepStatus}
          aria-label="Adicionar Nova Etapa"
        >
          {loadingSteps || isUpdatingStepStatus ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
          Nova Etapa
        </button>
      </div>

      {loadingSteps ? (
        <div className="flex flex-col items-center justify-center py-10">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
          <p className="text-slate-500 dark:text-slate-400">Carregando etapas...</p>
        </div>
      ) : steps.length === 0 ? (
        <div className="text-center text-slate-400 py-10 italic text-lg">
          Nenhuma etapa cadastrada. Adicione sua primeira etapa!
        </div>
      ) : (
        <div className="space-y-4">
          {steps.map((step) => {
            const statusDetails = getEntityStatusDetails('step', step, steps);
            const isDraggable = !step.startDate; // Only allow drag if step hasn't started
            const isDragOver = dragOverStepId === step.id && draggedStepId !== step.id;

            return (
              <div
                key={step.id}
                draggable={isDraggable}
                onDragStart={(e) => handleDragStart(e, step.id)}
                onDragOver={(e) => handleDragOver(e, step.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, step.id)}
                onDragEnd={handleDragEnd}
                className={cx(
                  surface,
                  "p-5 rounded-2xl flex flex-col gap-3 relative transition-all duration-200",
                  statusDetails.borderColor, // Dynamic border color
                  `shadow-${statusDetails.shadowClass}`, // Dynamic shadow
                  isDraggable ? 'cursor-grab' : 'cursor-not-allowed',
                  isDragOver ? 'border-dashed border-2 border-secondary-light bg-secondary/5' : '',
                  draggedStepId === step.id ? 'opacity-50' : ''
                )}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-primary dark:text-white text-lg">
                    {step.orderIndex}. {step.name}
                  </h3>
                  <span className={cx(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-2",
                    statusDetails.bgColor,
                    statusDetails.textColor
                  )}>
                    <i className={`fa-solid ${statusDetails.icon}`}></i>
                    {statusDetails.statusText}
                  </span>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <p>Início Previsto: <span className="font-medium">{formatDateDisplay(step.startDate)}</span></p>
                  <p>Término Previsto: <span className="font-medium">{formatDateDisplay(step.endDate)}</span></p>
                  {step.estimatedDurationDays && <p>Duração Estimada: <span className="font-medium">{step.estimatedDurationDays} dias</span></p>}
                  {step.realDate && <p>Concluído em: <span className="font-medium">{formatDateDisplay(step.realDate)}</span></p>}
                </div>
                
                {/* Progress bar and Material progress */}
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Materiais para esta etapa:</p>
                  {materials.filter(m => m.stepId === step.id).length > 0 ? (
                    <div className="space-y-1">
                      {materials.filter(m => m.stepId === step.id).map(material => (
                        <div key={material.id} className="flex items-center gap-2 text-xs text-primary dark:text-white">
                          <i className="fa-solid fa-boxes-stacked text-secondary"></i>
                          <span>{material.name} ({material.purchasedQty}/{material.plannedQty} {material.unit})</span>
                          {renderMaterialProgressBar(material)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Nenhum material associado.</p>
                  )}
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => toggleStepStatus(step)}
                    disabled={isUpdatingStepStatus}
                    className={cx(
                      "flex-1 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed",
                      step.realDate
                        ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
                        : "bg-green-500 text-white hover:bg-green-600"
                    )}
                    aria-label={step.realDate ? `Reabrir etapa ${step.name}` : `Concluir etapa ${step.name}`}
                  >
                    {isUpdatingStepStatus ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${step.realDate ? 'fa-undo' : 'fa-check'}`}></i>}
                    {step.realDate ? 'Reabrir' : 'Concluir'}
                  </button>
                  <button
                    onClick={() => handleOpenEditStepModal(step)}
                    disabled={isUpdatingStepStatus}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    aria-label={`Editar etapa ${step.name}`}
                  >
                    <i className="fa-solid fa-edit"></i> Editar
                  </button>
                  <button
                    onClick={() => setZeModal({
                      isOpen: true,
                      title: "Confirmar Exclusão",
                      message: `Tem certeza que deseja excluir a etapa "${step.name}"? Esta ação é irreversível e removerá todos os materiais e despesas associados.`,
                      type: "DANGER",
                      confirmText: "Sim, Excluir Etapa",
                      onConfirm: (_e?: React.FormEvent) => handleDeleteStep(step.id),
                      onCancel: (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                      id: step.id
                    })}
                    disabled={isUpdatingStepStatus}
                    className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    aria-label={`Excluir etapa ${step.name}`}
                  >
                    <i className="fa-solid fa-trash-alt"></i> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Step Modal */}
      {showAddStepModal && (
        <ZeModal
          isOpen={showAddStepModal}
          title={editStepData ? "Editar Etapa" : "Adicionar Nova Etapa"}
          message="" // Children are used for form content
          confirmText={editStepData ? "Salvar Alterações" : "Adicionar Etapa"}
          onConfirm={editStepData ? handleUpdateStep : handleAddStep}
          onCancel={() => { setShowAddStepModal(false); setEditStepData(null); setNewEstimatedDurationDays(''); }}
          type="INFO"
          isConfirming={isUpdatingStepStatus}
        >
          <form onSubmit={editStepData ? handleUpdateStep : handleAddStep} className="space-y-4">
            <div>
              <label htmlFor="stepName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome da Etapa</label>
              <input
                type="text"
                id="stepName"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Fundações, Alvenaria"
                required
                disabled={!!editStepData?.startDate} // Disable name edit if step has started
              />
              {editStepData?.startDate && <p className="text-xs text-red-500 mt-1">Não é possível alterar o nome de uma etapa iniciada.</p>}
            </div>
            <div>
              <label htmlFor="newStepStartDate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Data de Início Prevista</label>
              <input
                type="date"
                id="newStepStartDate"
                value={newStepStartDate || ''}
                onChange={(e) => setNewStepStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                disabled={!!editStepData?.startDate} // Disable start date edit if already set
              />
              {editStepData?.startDate && <p className="text-xs text-red-500 mt-1">Não é possível alterar a data de início de uma etapa já definida.</p>}
            </div>
            <div>
              <label htmlFor="newStepEndDate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Data de Término Prevista</label>
              <input
                type="date"
                id="newStepEndDate"
                value={newStepEndDate || ''}
                onChange={(e) => setNewStepEndDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              />
            </div>
            <div>
              <label htmlFor="newEstimatedDurationDays" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Duração Estimada (dias)</label>
              <input
                type="number"
                id="newEstimatedDurationDays"
                value={newEstimatedDurationDays}
                onChange={(e) => setNewEstimatedDurationDays(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 30"
                min="1"
              />
            </div>
          </form>
        </ZeModal>
      )}

      {/* Delete Confirmation Modal for Steps */}
      {zeModal.isOpen && zeModal.id && zeModal.type === 'DANGER' && (
        <ZeModal {...zeModal} onConfirm={async (_e?: React.FormEvent) => {
          if (zeModal.id) {
            await handleDeleteStep(zeModal.id);
            setZeModal(p => ({ ...p, isOpen: false }));
          }
        }} />
      )}
    </div>
  );

  const renderMaterialsTab = () => (
    <div className="tab-content animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
        <h2 className="text-2xl font-black text-primary dark:text-white">Materiais da Obra</h2>
        <button
          onClick={handleOpenAddMaterialModal}
          className="px-4 py-2 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={loadingMaterials}
          aria-label="Adicionar novo material"
        >
          {loadingMaterials ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
          Nova Material
        </button>
      </div>

      <div className="mb-6 px-2 sm:px-0">
        <label htmlFor="material-step-filter" className="sr-only">Filtrar materiais por etapa</label>
        <select
          id="material-step-filter"
          value={materialFilterStepId}
          onChange={(e) => setMaterialFilterStepId(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
          aria-label="Filtrar materiais por etapa"
        >
          <option value="all">Todas as Etapas</option>
          {steps.map(step => (
            <option key={step.id} value={step.id}>
              {step.orderIndex}. {step.name}
            </option>
          ))}
        </select>
      </div>

      {loadingMaterials ? (
        <div className="flex flex-col items-center justify-center py-10">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
          <p className="text-slate-500 dark:text-slate-400">Carregando materiais...</p>
        </div>
      ) : groupedMaterials.length === 0 ? (
        <div className="text-center text-slate-400 py-10 italic text-lg">
          Nenhum material cadastrado ou corresponde ao filtro.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedMaterials.map(group => (
            <div key={group.stepId}>
              <h3 className="text-lg font-bold text-primary dark:text-white mb-3 pl-2 sm:pl-0">{group.stepName}</h3>
              <div className="space-y-4">
                {group.materials.map((material) => {
                  const statusDetails = getEntityStatusDetails('material', material, steps);
                  return (
                    <div
                      key={material.id}
                      className={cx(
                        surface,
                        "p-5 rounded-2xl flex flex-col gap-3 relative transition-all duration-200",
                        statusDetails.borderColor,
                        `shadow-${statusDetails.shadowClass}`
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-primary dark:text-white text-base">
                          {material.name} {material.brand && `(${material.brand})`}
                        </h4>
                        <span className={cx(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-2",
                          statusDetails.bgColor,
                          statusDetails.textColor
                        )}>
                          <i className={`fa-solid ${statusDetails.icon}`}></i>
                          {statusDetails.statusText}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <p>Planejado: <span className="font-medium">{material.plannedQty} {material.unit}</span></p>
                        <p>Comprado: <span className="font-medium">{material.purchasedQty} {material.unit}</span></p>
                        <p>Custo Total: <span className="font-medium">{formatCurrency(material.totalCost || 0)}</span></p>
                      </div>
                      {renderMaterialProgressBar(material)}
                      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleOpenEditMaterialModal(material)}
                          disabled={loadingMaterials}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                          aria-label={`Editar material ${material.name}`}
                        >
                          <i className="fa-solid fa-edit"></i> Editar
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir o material "${material.name}"? Isso também removerá as despesas de compra associadas.`,
                            type: "DANGER",
                            confirmText: "Sim, Excluir Material",
                            onConfirm: (_e?: React.FormEvent) => handleDeleteMaterial(material.id),
                            onCancel: (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                            id: material.id
                          })}
                          disabled={loadingMaterials}
                          className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                          aria-label={`Excluir material ${material.name}`}
                        >
                          <i className="fa-solid fa-trash-alt"></i> Excluir
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

      {/* Add/Edit Material Modal */}
      {showAddMaterialModal && (
        <ZeModal
          isOpen={showAddMaterialModal}
          title={editMaterialData ? `Editar/Comprar Material: ${editMaterialData.name}` : "Adicionar Novo Material"}
          message="" // Children are used for form content
          confirmText={editMaterialData ? "Salvar Material" : "Adicionar Material"}
          onConfirm={editMaterialData ? handleUpdateMaterial : handleAddMaterial}
          onCancel={() => { setShowAddMaterialModal(false); setEditMaterialData(null); setPurchaseQtyInput(''); setPurchaseCostInput(''); }}
          type="INFO"
          isConfirming={loadingMaterials}
        >
          <form className="space-y-4">
            <div>
              <label htmlFor="materialName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome do Material</label>
              <input
                type="text"
                id="materialName"
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Cimento, Tijolo"
                required
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // Disable name edit if already purchased
              />
              {!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar nome de material com compras registradas.</p>}
            </div>
            <div>
              <label htmlFor="materialBrand" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Marca (Opcional)</label>
              <input
                type="text"
                id="materialBrand"
                value={newMaterialBrand}
                onChange={(e) => setNewMaterialBrand(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Votorantim, Amanco"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // Disable brand edit if already purchased
              />
              {!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar marca de material com compras registradas.</p>}
            </div>
            <div>
              <label htmlFor="materialPlannedQty" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Quantidade Planejada</label>
              <input
                type="number"
                id="materialPlannedQty"
                value={newMaterialPlannedQty}
                onChange={(e) => setNewMaterialPlannedQty(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 50"
                min="0"
                required
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // Disable plannedQty edit if already purchased
              />
              {!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar quantidade planejada de material com compras registradas.</p>}
            </div>
            <div>
              <label htmlFor="materialUnit" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Unidade</label>
              <input
                type="text"
                id="materialUnit"
                value={newMaterialUnit}
                onChange={(e) => setNewMaterialUnit(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: sacos, m², un"
                required
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // Disable unit edit if already purchased
              />
              {!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar unidade de material com compras registradas.</p>}
            </div>
            <div>
              <label htmlFor="materialCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria (Opcional)</label>
              <input
                type="text"
                id="materialCategory"
                value={newMaterialCategory}
                onChange={(e) => setNewMaterialCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Fundações, Elétrica"
                disabled={!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0} // Disable category edit if already purchased
              />
              {!!editMaterialData?.purchasedQty && editMaterialData.purchasedQty > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar categoria de material com compras registradas.</p>}
            </div>
            <div>
              <label htmlFor="materialStepId" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Etapa Associada (Opcional)</label>
              <select
                id="materialStepId"
                value={newMaterialStepId}
                onChange={(e) => setNewMaterialStepId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                aria-label="Etapa associada ao material"
              >
                <option value="">Nenhuma Etapa</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>
                    {step.orderIndex}. {step.name}
                  </option>
                ))}
              </select>
            </div>

            {editMaterialData && (
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <h3 className="text-lg font-bold text-primary dark:text-white">Registrar Compra</h3>
                <div>
                  <label htmlFor="purchaseQty" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Quantidade Comprada Agora</label>
                  <input
                    type="number"
                    id="purchaseQty"
                    value={purchaseQtyInput}
                    onChange={(e) => setPurchaseQtyInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Ex: 10"
                    min="1"
                  />
                </div>
                <div>
                  <label htmlFor="purchaseCost" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Custo Total da Compra (R$)</label>
                  <input
                    type="text"
                    id="purchaseCost"
                    value={purchaseCostInput}
                    onChange={(e) => setPurchaseCostInput(formatInputReal(parseInputReal(e.target.value)))} // Auto-format on change
                    onBlur={(e) => setPurchaseCostInput(formatInputReal(parseInputReal(e.target.value)))} // Format on blur
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Ex: 250.00"
                    inputMode="decimal"
                  />
                </div>
                <button
                  type="button" // Important: type="button" to prevent form submission for main form
                  onClick={handleRegisterMaterialPurchase}
                  disabled={loadingMaterials || !purchaseQtyInput || !purchaseCostInput}
                  className="w-full py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingMaterials ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-shopping-cart"></i>}
                  Registrar Compra
                </button>
              </div>
            )}
          </form>
        </ZeModal>
      )}

      {/* Delete Confirmation Modal for Materials */}
      {zeModal.isOpen && zeModal.id && zeModal.type === 'DANGER' && (
        <ZeModal {...zeModal} onConfirm={async (_e?: React.FormEvent) => {
          if (zeModal.id) {
            await handleDeleteMaterial(zeModal.id);
            setZeModal(p => ({ ...p, isOpen: false }));
          }
        }} />
      )}
    </div>
  );

  const renderExpensesTab = () => (
    <div className="tab-content animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
        <h2 className="text-2xl font-black text-primary dark:text-white">Controle Financeiro</h2>
        <button
          onClick={handleOpenAddExpenseModal}
          className="px-4 py-2 bg-secondary text-white text-base font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={loadingExpenses}
          aria-label="Adicionar nova despesa"
        >
          {loadingExpenses ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
          Nova Despesa
        </button>
      </div>

      {/* Overview Card */}
      <div className={cx(surface, card, "mb-6")}>
        <h3 className="text-xl font-black text-primary dark:text-white mb-4">Resumo Financeiro</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">Orçamento Planejado</p>
            <p className="text-2xl font-bold text-primary dark:text-white">{formatCurrency(work?.budgetPlanned || 0)}</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Gasto (Não Materiais)</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(calculateTotalExpenses)}</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">Valor a Pagar (Não Materiais)</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalOutstandingExpenses)}</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">Balanço</p>
            <p className={`text-2xl font-bold ${((work?.budgetPlanned || 0) - calculateTotalExpenses) < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {formatCurrency((work?.budgetPlanned || 0) - calculateTotalExpenses)}
            </p>
          </div>
        </div>
      </div>

      {loadingExpenses ? (
        <div className="flex flex-col items-center justify-center py-10">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
          <p className="text-slate-500 dark:text-slate-400">Carregando despesas...</p>
        </div>
      ) : groupedExpensesByStep.length === 0 ? (
        <div className="text-center text-slate-400 py-10 italic text-lg">
          Nenhuma despesa cadastrada.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedExpensesByStep.map(group => (
            <div key={group.stepName}>
              <h3 className="text-lg font-bold text-primary dark:text-white mb-3 pl-2 sm:pl-0">{group.stepName}</h3>
              <div className="space-y-4">
                {group.expenses.map((expense) => {
                  // Fix: Use the common helper getEntityStatusDetails
                  const statusDetails = getEntityStatusDetails('expense', expense, steps);
                  const agreedAmount = expense.totalAgreed !== undefined && expense.totalAgreed !== null ? expense.totalAgreed : expense.amount;
                  return (
                    <div
                      key={expense.id}
                      className={cx(
                        surface,
                        "p-5 rounded-2xl flex flex-col gap-3 relative transition-all duration-200",
                        statusDetails.borderColor,
                        `shadow-${statusDetails.shadowClass}`
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-primary dark:text-white text-base">
                          {expense.description}
                        </h4>
                        <span className={cx(
                          "px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-2",
                          statusDetails.bgColor,
                          statusDetails.textColor
                        )}>
                          <i className={`fa-solid ${statusDetails.icon}`}></i>
                          {statusDetails.statusText}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <p>Previsto: <span className="font-medium">{formatCurrency(expense.amount)}</span></p>
                        <p>Combinado: <span className="font-medium">{formatCurrency(agreedAmount)}</span></p>
                        <p>Pago: <span className="font-medium">{formatCurrency(expense.paidAmount || 0)}</span></p>
                        <p>Data: <span className="font-medium">{formatDateDisplay(expense.date)} | Categoria: <span className="font-medium">{expense.category}</span></span></p>
                        {expense.workerId && <p>Trabalhador: <span className="font-medium">{workers.find(w => w.id === expense.workerId)?.name || 'N/A'}</span></p>}
                        {expense.supplierId && <p>Fornecedor: <span className="font-medium">{suppliers.find(s => s.id === expense.supplierId)?.name || 'N/A'}</span></p>}
                      </div>
                      {renderExpenseProgressBar(expense)}
                      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        {expense.status !== ExpenseStatus.OVERPAID && (
                          <button
                            onClick={() => handleOpenAddPaymentModal(expense)}
                            disabled={loadingExpenses}
                            className="flex-1 px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                            aria-label={`Registrar pagamento para ${expense.description}`}
                          >
                            <i className="fa-solid fa-dollar-sign"></i> Pagar
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditExpenseModal(expense)}
                          disabled={loadingExpenses}
                          className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                          aria-label={`Editar despesa ${expense.description}`}
                        >
                          <i className="fa-solid fa-edit"></i> Editar
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir a despesa "${expense.description}"? Isso removerá todos os pagamentos associados.`,
                            type: "DANGER",
                            confirmText: "Sim, Excluir Despesa",
                            onConfirm: (_e?: React.FormEvent) => handleDeleteExpense(expense.id),
                            onCancel: (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                            id: expense.id
                          })}
                          disabled={loadingExpenses}
                          className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                          aria-label={`Excluir despesa ${expense.description}`}
                        >
                          <i className="fa-solid fa-trash-alt"></i> Excluir
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

      {/* Add/Edit Expense Modal */}
      {showAddExpenseModal && (
        <ZeModal
          isOpen={showAddExpenseModal}
          title={editExpenseData ? "Editar Despesa" : "Adicionar Nova Despesa"}
          message=""
          confirmText={editExpenseData ? "Salvar Despesa" : "Adicionar Despesa"}
          onConfirm={editExpenseData ? handleUpdateExpense : handleAddExpense}
          onCancel={() => { setShowAddExpenseModal(false); setEditExpenseData(null); setNewExpenseTotalAgreed(''); }}
          type="INFO"
          isConfirming={loadingExpenses}
        >
          <form className="space-y-4">
            <div>
              <label htmlFor="expenseDescription" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Descrição</label>
              <input
                type="text"
                id="expenseDescription"
                value={newExpenseDescription}
                onChange={(e) => setNewExpenseDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Mão de obra pedreiro, Taxa de alvará"
                required
              />
            </div>
            <div>
              <label htmlFor="expenseAmount" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Valor Previsto (R$)</label>
              <input
                type="text"
                id="expenseAmount"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(formatInputReal(parseInputReal(e.target.value)))}
                onBlur={(e) => setNewExpenseAmount(formatInputReal(parseInputReal(e.target.value)))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 1500.00"
                inputMode="decimal"
                required
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if already paid
              />
              {!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar o valor de uma despesa com pagamentos registrados.</p>}
            </div>
            <div>
              <label htmlFor="expenseTotalAgreed" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Valor Combinado (R$) <span className="text-xs italic text-slate-400">(Opcional, se diferente do previsto)</span></label>
              <input
                type="text"
                id="expenseTotalAgreed"
                value={newExpenseTotalAgreed}
                onChange={(e) => setNewExpenseTotalAgreed(formatInputReal(parseInputReal(e.target.value)))}
                onBlur={(e) => setNewExpenseTotalAgreed(formatInputReal(parseInputReal(e.target.value)))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 1450.00"
                inputMode="decimal"
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if already paid
              />
              {!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar o valor combinado de uma despesa com pagamentos registrados.</p>}
            </div>
            <div>
              <label htmlFor="expenseCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
              <select
                id="expenseCategory"
                value={newExpenseCategory}
                onChange={(e) => setNewExpenseCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if already paid
              >
                {Object.values(ExpenseCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar a categoria de uma despesa com pagamentos registrados.</p>}
            </div>
            <div>
              <label htmlFor="expenseDate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Data da Despesa</label>
              <input
                type="date"
                id="expenseDate"
                value={newExpenseDate}
                onChange={(e) => setNewExpenseDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
                disabled={!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if already paid
              />
              {!!editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar a data de uma despesa com pagamentos registrados.</p>}
            </div>
            <div>
              <label htmlFor="expenseStepId" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Etapa Associada (Opcional)</label>
              <select
                id="expenseStepId"
                value={newExpenseStepId}
                onChange={(e) => setNewExpenseStepId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="">Nenhuma Etapa</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>
                    {step.orderIndex}. {step.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expenseWorkerId" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Trabalhador Associado (Opcional)</label>
              <select
                id="expenseWorkerId"
                value={newExpenseWorkerId}
                onChange={(e) => setNewExpenseWorkerId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="">Nenhum Trabalhador</option>
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>{worker.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expenseSupplierId" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Fornecedor Associado (Opcional)</label>
              <select
                id="expenseSupplierId"
                value={newExpenseSupplierId}
                onChange={(e) => setNewExpenseSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="">Nenhum Fornecedor</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
          </form>
        </ZeModal>
      )}

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <ZeModal
          isOpen={showAddPaymentModal}
          title={`Registrar Pagamento para "${paymentExpenseData?.description}"`}
          message=""
          confirmText="Registrar Pagamento"
          onConfirm={handleAddPayment}
          onCancel={() => { setShowAddPaymentModal(false); setPaymentExpenseData(null); }}
          type="INFO"
          isConfirming={loadingExpenses}
        >
          <form className="space-y-4">
            <div>
              <label htmlFor="paymentAmount" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Valor do Pagamento (R$)</label>
              <input
                type="text"
                id="paymentAmount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(formatInputReal(parseInputReal(e.target.value)))}
                onBlur={(e) => setPaymentAmount(formatInputReal(parseInputReal(e.target.value)))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 500.00"
                inputMode="decimal"
                required
              />
            </div>
            <div>
              <label htmlFor="paymentDate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Data do Pagamento</label>
              <input
                type="date"
                id="paymentDate"
                value={paymentDate}
                onChange={(e) => setNewPaymentDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              />
            </div>
          </form>
        </ZeModal>
      )}

      {/* Delete Confirmation Modal for Expenses */}
      {zeModal.isOpen && zeModal.id && zeModal.type === 'DANGER' && (
        <ZeModal {...zeModal} onConfirm={async (_e?: React.FormEvent) => {
          if (zeModal.id) {
            await handleDeleteExpense(zeModal.id);
            setZeModal(p => ({ ...p, isOpen: false }));
          }
        }} />
      )}
    </div>
  );

  const renderToolsTab = () => (
    <div className="tab-content animate-in fade-in duration-300">
      {activeSubView === 'NONE' && (
        <>
          <h2 className="text-2xl font-black text-primary dark:text-white mb-6 px-2 sm:px-0">Ferramentas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ToolCard
              icon="fa-people-carry-box"
              title="Equipe"
              description="Gerencie seus trabalhadores e contatos."
              onClick={() => goToSubView('WORKERS')}
            />
            <ToolCard
              icon="fa-handshake"
              title="Fornecedores"
              description="Organize contatos de fornecedores e prestadores."
              onClick={() => goToSubView('SUPPLIERS')}
            />
            <ToolCard
              icon="fa-camera"
              title="Fotos da Obra"
              description="Guarde o registro visual da evolução do projeto."
              onClick={() => goToSubView('PHOTOS')}
            />
            <ToolCard
              icon="fa-file-alt"
              title="Arquivos e Documentos"
              description="Centralize plantas, orçamentos e documentos importantes."
              onClick={() => goToSubView('FILES')}
            />
            <ToolCard
              icon="fa-list-check"
              title="Checklists"
              description="Crie listas de verificação para não esquecer nada."
              onClick={() => goToSubView('CHECKLIST')}
            />
            <ToolCard
              icon="fa-file-contract"
              title="Gerador de Contratos"
              description="Modelos de contratos editáveis para equipe e serviços."
              onClick={() => goToSubView('CONTRACTS')}
              isLocked={!hasAiAccess}
              requiresVitalicio={true}
            />
            <ToolCard
              icon="fa-robot"
              title="Planejador Inteligente AI"
              description="Peça ao Zé da Obra para gerar um plano detalhado."
              onClick={() => navigate(`/work/${workId}/ai-planner`)}
              isLocked={!hasAiAccess}
              requiresVitalicio={true}
            />
            <ToolCard
              icon="fa-chart-pie"
              title="Relatórios Detalhados"
              description="Visão analítica de cronograma, materiais e finanças."
              onClick={() => navigate(`/work/${workId}/reports`)}
              isLocked={!hasAiAccess}
              requiresVitalicio={true}
            />
          </div>
        </>
      )}

      {activeSubView === 'WORKERS' && (
        <div className="animate-in fade-in duration-300">
          <ToolSubViewHeader title="Equipe" onBack={() => goToSubView('NONE')} onAdd={handleOpenAddWorkerModal} loading={isAddingWorker} />
          {loadingWorkers ? (
            <div className="flex flex-col items-center justify-center py-10">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
              <p className="text-slate-500 dark:text-slate-400">Carregando equipe...</p>
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              Nenhum trabalhador cadastrado.
            </div>
          ) : (
            <div className="space-y-4">
              {workers.map(worker => (
                <div key={worker.id} className={cx(surface, "p-4 rounded-xl flex items-center justify-between")}>
                  <div>
                    <h3 className="font-bold text-primary dark:text-white text-base">{worker.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{worker.role} | {worker.phone}</p>
                    {worker.dailyRate && <p className="text-xs text-slate-400">Diária: {formatCurrency(worker.dailyRate)}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenEditWorkerModal(worker)} className="px-3 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors" aria-label={`Editar trabalhador ${worker.name}`}><i className="fa-solid fa-edit"></i></button>
                    <button
                      onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir o trabalhador "${worker.name}"? Isso pode afetar despesas relacionadas.`,
                        type: "DANGER",
                        confirmText: "Sim, Excluir Trabalhador",
                        onConfirm: (_e?: React.FormEvent) => handleDeleteWorker(worker.id),
                        onCancel: (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                        id: worker.id
                      })}
                      className="px-3 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors"
                      aria-label={`Excluir trabalhador ${worker.name}`}
                    >
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Worker Modal */}
          {showAddWorkerModal && (
            <ZeModal
              isOpen={showAddWorkerModal}
              title={editWorkerData ? "Editar Trabalhador" : "Adicionar Novo Trabalhador"}
              message=""
              confirmText={editWorkerData ? "Salvar Trabalhador" : "Adicionar Trabalhador"}
              onConfirm={editWorkerData ? handleUpdateWorker : handleAddWorker}
              onCancel={() => { setShowAddWorkerModal(false); setEditWorkerData(null); }}
              type="INFO"
              isConfirming={isAddingWorker}
            >
              <form className="space-y-4">
                <div>
                  <label htmlFor="workerName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome</label>
                  <input type="text" id="workerName" value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="Nome Completo" required />
                </div>
                <div>
                  <label htmlFor="workerRole" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Função</label>
                  <select id="workerRole" value={newWorkerRole} onChange={(e) => setNewWorkerRole(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required>
                    <option value="">Selecione a Função</option>
                    {STANDARD_JOB_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="workerPhone" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Telefone (WhatsApp)</label>
                  <input type="text" id="workerPhone" value={newWorkerPhone} onChange={(e) => setNewWorkerPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="(DD) 9XXXX-XXXX" required />
                </div>
                <div>
                  <label htmlFor="workerDailyRate" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Diária (R$ - Opcional)</label>
                  <input type="text" id="workerDailyRate" value={newWorkerDailyRate} onChange={(e) => setNewWorkerDailyRate(formatInputReal(parseInputReal(e.target.value)))} onBlur={(e) => setNewWorkerDailyRate(formatInputReal(parseInputReal(e.target.value)))} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="150.00" inputMode="decimal" />
                </div>
                <div>
                  <label htmlFor="workerNotes" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Observações (Opcional)</label>
                  <textarea id="workerNotes" value={newWorkerNotes} onChange={(e) => setNewWorkerNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" rows={3} />
                </div>
              </form>
            </ZeModal>
          )}

          {/* Delete Confirmation Modal for Workers */}
          {zeModal.isOpen && zeModal.id && zeModal.type === 'DANGER' && (
            <ZeModal {...zeModal} onConfirm={async (_e?: React.FormEvent) => {
              if (zeModal.id) {
                await handleDeleteWorker(zeModal.id);
                setZeModal(p => ({ ...p, isOpen: false }));
              }
            }} />
          )}
        </div>
      )}

      {activeSubView === 'SUPPLIERS' && (
        <div className="animate-in fade-in duration-300">
          <ToolSubViewHeader title="Fornecedores" onBack={() => goToSubView('NONE')} onAdd={handleOpenAddSupplierModal} loading={isAddingSupplier} />
          {loadingSuppliers ? (
            <div className="flex flex-col items-center justify-center py-10">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
              <p className="text-slate-500 dark:text-slate-400">Carregando fornecedores...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              Nenhum fornecedor cadastrado.
            </div>
          ) : (
            <div className="space-y-4">
              {suppliers.map(supplier => (
                <div key={supplier.id} className={cx(surface, "p-4 rounded-xl flex items-center justify-between")}>
                  <div>
                    <h3 className="font-bold text-primary dark:text-white text-base">{supplier.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{supplier.category} | {supplier.phone}</p>
                    {supplier.email && <p className="text-xs text-slate-400">{supplier.email}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenEditSupplierModal(supplier)} className="px-3 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors" aria-label={`Editar fornecedor ${supplier.name}`}><i className="fa-solid fa-edit"></i></button>
                    <button
                      onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir o fornecedor "${supplier.name}"? Isso pode afetar despesas relacionadas.`,
                        type: "DANGER",
                        confirmText: "Sim, Excluir Fornecedor",
                        onConfirm: (_e?: React.FormEvent) => handleDeleteSupplier(supplier.id),
                        onCancel: (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                        id: supplier.id
                      })}
                      className="px-3 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors"
                      aria-label={`Excluir fornecedor ${supplier.name}`}
                    >
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Supplier Modal */}
          {showAddSupplierModal && (
            <ZeModal
              isOpen={showAddSupplierModal}
              title={editSupplierData ? "Editar Fornecedor" : "Adicionar Novo Fornecedor"}
              message=""
              confirmText={editSupplierData ? "Salvar Fornecedor" : "Adicionar Fornecedor"}
              onConfirm={editSupplierData ? handleUpdateSupplier : handleAddSupplier}
              onCancel={() => { setShowAddSupplierModal(false); setEditSupplierData(null); }}
              type="INFO"
              isConfirming={isAddingSupplier}
            >
              <form className="space-y-4">
                <div>
                  <label htmlFor="supplierName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome</label>
                  <input type="text" id="supplierName" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="Nome do Fornecedor" required />
                </div>
                <div>
                  <label htmlFor="supplierCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                  <select id="supplierCategory" value={newSupplierCategory} onChange={(e) => setNewSupplierCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required>
                    <option value="">Selecione a Categoria</option>
                    {STANDARD_SUPPLIER_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="supplierPhone" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Telefone</label>
                  <input type="text" id="supplierPhone" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="(DD) XXXXX-XXXX" required />
                </div>
                <div>
                  <label htmlFor="supplierEmail" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">E-mail (Opcional)</label>
                  <input type="email" id="supplierEmail" value={newSupplierEmail} onChange={(e) => setNewSupplierEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="email@exemplo.com" />
                </div>
                <div>
                  <label htmlFor="supplierAddress" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Endereço (Opcional)</label>
                  <input type="text" id="supplierAddress" value={newSupplierAddress} onChange={(e) => setNewSupplierAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="Rua, Número, Bairro, Cidade" />
                </div>
                <div>
                  <label htmlFor="supplierNotes" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Observações (Opcional)</label>
                  <textarea id="supplierNotes" value={newSupplierNotes} onChange={(e) => setNewSupplierNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" rows={3} />
                </div>
              </form>
            </ZeModal>
          )}

          {/* Delete Confirmation Modal for Suppliers */}
          {zeModal.isOpen && zeModal.id && zeModal.type === 'DANGER' && (
            <ZeModal {...zeModal} onConfirm={async (_e?: React.FormEvent) => {
              if (zeModal.id) {
                await handleDeleteSupplier(zeModal.id);
                setZeModal(p => ({ ...p, isOpen: false }));
              }
            }} />
          )}
        </div>
      )}

      {activeSubView === 'PHOTOS' && (
        <div className="animate-in fade-in duration-300">
          <ToolSubViewHeader title="Fotos da Obra" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddPhotoModal(true)} loading={uploadingPhoto} />
          {loadingPhotos ? (
            <div className="flex flex-col items-center justify-center py-10">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
              <p className="text-slate-500 dark:text-slate-400">Carregando fotos...</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              Nenhuma foto cadastrada.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map(photo => (
                <div key={photo.id} className={cx(surface, "rounded-xl overflow-hidden shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800")}>
                  <img src={photo.url} alt={photo.description} className="w-full h-48 object-cover" />
                  <div className="p-3">
                    <p className="font-bold text-primary dark:text-white text-sm truncate">{photo.description}</p>
                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>{formatDateDisplay(photo.date)}</span>
                      <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full capitalize">{photo.type.toLowerCase()}</span>
                    </div>
                    <button
                      onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: "Tem certeza que deseja excluir esta foto? Esta ação é irreversível.",
                        type: "DANGER",
                        confirmText: "Sim, Excluir Foto",
                        onConfirm: (_e?: React.FormEvent) => handleDeletePhoto(photo.id, photo.url),
                        onCancel: (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                        id: photo.id
                      })}
                      disabled={uploadingPhoto}
                      className="mt-3 w-full py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      aria-label={`Excluir foto ${photo.description}`}
                    >
                      <i className="fa-solid fa-trash-alt"></i> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Photo Modal */}
          {showAddPhotoModal && (
            <ZeModal
              isOpen={showAddPhotoModal}
              title="Adicionar Nova Foto"
              message=""
              confirmText="Salvar Foto"
              onConfirm={handleAddPhoto}
              onCancel={() => { setShowAddPhotoModal(false); setNewPhotoFile(null); setNewPhotoDescription(''); }}
              type="INFO"
              isConfirming={uploadingPhoto}
            >
              <form className="space-y-4">
                <div>
                  <label htmlFor="photoFile" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Arquivo da Foto</label>
                  <input
                    type="file"
                    id="photoFile"
                    accept="image/*"
                    onChange={(e) => setNewPhotoFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="photoDescription" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Descrição</label>
                  <input
                    type="text"
                    id="photoDescription"
                    value={newPhotoDescription}
                    onChange={(e) => setNewPhotoDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    placeholder="O que esta foto mostra?"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="photoType" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Tipo</label>
                  <select
                    id="photoType"
                    value={newPhotoType}
                    onChange={(e) => setNewPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'PROGRESS')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                  >
                    <option value="BEFORE">Antes</option>
                    <option value="PROGRESS">Progresso</option>
                    <option value="AFTER">Depois</option>
                  </select>
                </div>
              </form>
            </ZeModal>
          )}

          {/* Delete Confirmation Modal for Photos */}
          {zeModal.isOpen && zeModal.id && zeModal.type === 'DANGER' && (
            <ZeModal {...zeModal} onConfirm={async (_e?: React.FormEvent) => {
              if (zeModal.id) {
                const photoToDelete = photos.find(p => p.id === zeModal.id);
                if (photoToDelete) {
                  await handleDeletePhoto(photoToDelete.id, photoToDelete.url);
                }
                setZeModal(p => ({ ...p, isOpen: false }));
              }
            }} />
          )}
        </div>
      )}

      {activeSubView === 'FILES' && (
        <div className="animate-in fade-in duration-300">
          <ToolSubViewHeader title="Arquivos e Documentos" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddFileModal(true)} loading={uploadingFile} />
          {loadingFiles ? (
            <div className="flex flex-col items-center justify-center py-10">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
              <p className="text-slate-500 dark:text-slate-400">Carregando arquivos...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              Nenhum arquivo cadastrado.
            </div>
          ) : (
            <div className="space-y-4">
              {files.map(file => (
                <div key={file.id} className={cx(surface, "p-4 rounded-xl flex items-center justify-between")}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-file-alt"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-primary dark:text-white text-base">{file.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{file.category} | {formatDateDisplay(file.date)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors" aria-label={`Ver arquivo ${file.name}`}>
                      <i className="fa-solid fa-eye"></i>
                    </a>
                    <button
                      onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: "Tem certeza que deseja excluir este arquivo? Esta ação é irreversível e o arquivo será removido da nuvem.",
                        type: "DANGER",
                        confirmText: "Sim, Excluir Arquivo",
                        onConfirm: (_e?: React.FormEvent) => handleDeleteFile(file.id, file.url),
                        onCancel: (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                        id: file.id
                      })}
                      disabled={uploadingFile}
                      className="px-3 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      aria-label={`Excluir arquivo ${file.name}`}
                    >
                      <i className="fa-solid fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add File Modal */}
          {showAddFileModal && (
            <ZeModal
              isOpen={showAddFileModal}
              title="Adicionar Novo Arquivo"
              message=""
              confirmText="Salvar Arquivo"
              onConfirm={handleAddFile}
              onCancel={() => { setShowAddFileModal(false); setNewUploadFile(null); setNewFileName(''); }}
              type="INFO"
              isConfirming={uploadingFile}
            >
              <form className="space-y-4">
                <div>
                  <label htmlFor="uploadFile" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Arquivo</label>
                  <input
                    type="file"
                    id="uploadFile"
                    onChange={(e) => setNewUploadFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="fileName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome do Arquivo</label>
                  <input
                    type="text"
                    id="fileName"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    placeholder="Ex: Planta Baixa_rev01"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="fileCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
                  <select
                    id="fileCategory"
                    value={newFileCategory}
                    onChange={(e) => setNewFileCategory(e.target.value as FileCategory)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                  >
                    {Object.values(FileCategory).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </form>
            </ZeModal>
          )}

          {/* Delete Confirmation Modal for Files */}
          {zeModal.isOpen && zeModal.id && zeModal.type === 'DANGER' && (
            <ZeModal {...zeModal} onConfirm={async (_e?: React.FormEvent) => {
              if (zeModal.id) {
                const fileToDelete = files.find(f => f.id === zeModal.id);
                if (fileToDelete) {
                  await handleDeleteFile(fileToDelete.id, fileToDelete.url);
                }
                setZeModal(p => ({ ...p, isOpen: false }));
              }
            }} />
          )}
        </div>
      )}

      {activeSubView === 'CONTRACTS' && (
        <div className="animate-in fade-in duration-300">
          <ToolSubViewHeader title="Gerador de Contratos" onBack={() => goToSubView('NONE')} />
          {loadingContracts ? (
            <div className="flex flex-col items-center justify-center py-10">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
              <p className="text-slate-500 dark:text-slate-400">Carregando modelos de contrato...</p>
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              Nenhum modelo de contrato encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {contracts.map(contract => (
                <div key={contract.id} className={cx(surface, "p-4 rounded-xl flex items-center justify-between")}>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-file-contract"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-primary dark:text-white text-base">{contract.title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{contract.category}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewContract(contract)}
                    className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors"
                    aria-label={`Visualizar contrato ${contract.title}`}
                  >
                    <i className="fa-solid fa-eye mr-2"></i> Visualizar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Contract Content Modal */}
          {showContractContentModal && (
            <ZeModal
              isOpen={showContractContentModal}
              title={selectedContractTitle}
              message="" // Content passed as children
              confirmText={copyContractSuccess ? "Copiado!" : "Copiar Conteúdo"}
              onConfirm={handleCopyContractContent}
              onCancel={() => { setShowContractContentModal(false); setSelectedContractContent(''); setSelectedContractTitle(''); setCopyContractSuccess(false); }}
              type={copyContractSuccess ? "SUCCESS" : "INFO"}
            >
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-primary dark:text-white overflow-y-auto max-h-[60vh] whitespace-pre-wrap font-mono">
                {selectedContractContent}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Copie e cole em seu editor de texto para personalizar e imprimir.
              </p>
            </ZeModal>
          )}
        </div>
      )}

      {activeSubView === 'CHECKLIST' && (
        <div className="animate-in fade-in duration-300">
          <ToolSubViewHeader title="Checklists" onBack={() => goToSubView('NONE')} onAdd={handleOpenAddChecklistModal} loading={isAddingChecklist} />
          {loadingChecklists ? (
            <div className="flex flex-col items-center justify-center py-10">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary mb-4"></i>
              <p className="text-slate-500 dark:text-slate-400">Carregando checklists...</p>
            </div>
          ) : checklists.length === 0 ? (
            <div className="text-center text-slate-400 py-10 italic text-lg">
              Nenhuma checklist cadastrada.
            </div>
          ) : (
            <div className="space-y-4">
              {checklists.map(checklist => (
                <div key={checklist.id} className={cx(surface, "p-4 rounded-xl flex flex-col gap-3")}>
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-primary dark:text-white text-base">{checklist.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {checklist.category}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {checklist.items.map(item => (
                      <label key={item.id} className="flex items-center gap-2 text-sm text-primary dark:text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleToggleChecklistItem(checklist.id, item.id, item.checked)}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-secondary focus:ring-secondary/50"
                          disabled={isAddingChecklist}
                        />
                        <span className={item.checked ? 'line-through text-slate-400 dark:text-slate-500' : ''}>{item.text}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleOpenEditChecklistModal(checklist)}
                      disabled={isAddingChecklist}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      aria-label={`Editar checklist ${checklist.name}`}
                    >
                      <i className="fa-solid fa-edit"></i> Editar
                    </button>
                    <button
                      onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir a checklist "${checklist.name}"? Esta ação é irreversível.`,
                        type: "DANGER",
                        confirmText: "Sim, Excluir Checklist",
                        onConfirm: (_e?: React.FormEvent) => handleDeleteChecklist(checklist.id),
                        onCancel: (_e?: React.FormEvent) => setZeModal(p => ({ ...p, isOpen: false })),
                        id: checklist.id
                      })}
                      disabled={isAddingChecklist}
                      className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                      aria-label={`Excluir checklist ${checklist.name}`}
                    >
                      <i className="fa-solid fa-trash-alt"></i> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit Checklist Modal */}
          {showAddChecklistModal && (
            <ZeModal
              isOpen={showAddChecklistModal}
              title={editChecklistData ? "Editar Checklist" : "Adicionar Nova Checklist"}
              message=""
              confirmText={editChecklistData ? "Salvar Alterações" : "Adicionar Checklist"}
              onConfirm={editChecklistData ? handleUpdateChecklist : handleAddChecklist}
              onCancel={() => { setShowAddChecklistModal(false); setEditChecklistData(null); setNewChecklistItems(['']); }}
              type="INFO"
              isConfirming={isAddingChecklist}
            >
              <form className="space-y-4">
                <div>
                  <label htmlFor="checklistName" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Nome da Checklist</label>
                  <input
                    type="text"
                    id="checklistName"
                    value={newChecklistName}
                    onChange={(e) => setNewChecklistName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Ex: Pré-Concretagem Fundações"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="checklistCategory" className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Categoria (Associada a Etapa)</label>
                  <select
                    id="checklistCategory"
                    value={newChecklistCategory}
                    onChange={(e) => setNewChecklistCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    required
                  >
                    <option value="">Selecione uma Categoria</option>
                    {/* Populate with unique categories from existing steps or a standard list */}
                    {Array.from(new Set(steps.map(s => s.name))).map(category => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                    {/* Add standard categories if none exist in steps, or if more general categories are needed */}
                    {['Fundações', 'Alvenaria e Vedação', 'Estrutura e Lajes', 'Cobertura e Telhado', 'Instalações Hidráulicas e Esgoto', 'Instalações Elétricas e Lógica', 'Reboco e Regularização', 'Impermeabilização Principal', 'Gesso e Forros', 'Pisos e Revestimentos', 'Esquadrias (Portas e Janelas)', 'Bancadas e Marmoraria', 'Pintura Interna e Externa', 'Louças e Metais Finais', 'Luminotécnica', 'Limpeza Final e Entrega', 'Demolição e Retirada de Entulho', 'Revisão Hidráulica e Esgoto', 'Revisão Elétrica e Lógica', 'Regularização de Contrapisos', 'Impermeabilização', 'Banheiro', 'Cozinha', 'Pintura', 'Geral', 'Segurança'].map(cat => (
                        // Only add if not already present from steps
                        !Array.from(new Set(steps.map(s => s.name))).includes(cat) && <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Itens da Checklist</label>
                  {newChecklistItems.map((itemText, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={itemText}
                        onChange={(e) => {
                          const updatedItems = [...newChecklistItems];
                          updatedItems[index] = e.target.value;
                          setNewChecklistItems(updatedItems);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                        placeholder={`Item ${index + 1}`}
                      />
                      {newChecklistItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updatedItems = newChecklistItems.filter((_, i) => i !== index);
                            setNewChecklistItems(updatedItems);
                          }}
                          className="p-2 text-red-500 hover:text-red-600 transition-colors"
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
                    className="mt-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                    aria-label="Adicionar novo item à checklist"
                  >
                    <i className="fa-solid fa-plus"></i> Adicionar Item
                  </button>
                </div>
              </form>
            </ZeModal>
          )}

          {/* Delete Confirmation Modal for Checklists */}
          {zeModal.isOpen && zeModal.id && zeModal.type === 'DANGER' && (
            <ZeModal {...zeModal} onConfirm={async (_e?: React.FormEvent) => {
              if (zeModal.id) {
                await handleDeleteChecklist(zeModal.id);
                setZeModal(p => ({ ...p, isOpen: false }));
              }
            }} />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 font-sans animate-in fade-in">
      {loadingInitialWork ? (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-primary dark:text-white">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-4"></i>
          <p className="text-slate-500 dark:text-slate-400">Carregando obra...</p>
        </div>
      ) : workError ? (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-4">
          <i className="fa-solid fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
          <h2 className="text-2xl font-black text-primary dark:text-white mb-2">Erro ao Carregar Obra</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">{workError}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors"
          >
            Voltar ao Dashboard
          </button>
        </div>
      ) : (
        <>
          {/* Header da Obra */}
          <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2 text-xl"
              aria-label="Voltar ao Dashboard"
            >
              <i className="fa-solid fa-arrow-left text-xl"></i>
            </button>
            <div className="flex-1 px-4">
              <h1 className="text-3xl font-black text-primary dark:text-white leading-tight">{work?.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{work?.address}</p>
            </div>
            {work?.status && (
              <span className={cx(
                "px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1 shrink-0",
                getWorkStatusDetails(work.status).bgColor,
                getWorkStatusDetails(work.status).textColor
              )}>
                {getWorkStatusDetails(work.status).text}
              </span>
            )}
          </div>

          {/* Navegação das Abas */}
          <div className="flex justify-around bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-6">
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
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'FINANCEIRO' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Financeiro
            </button>
            <button
              onClick={() => goToTab('FERRAMENTAS')}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === 'FERRAMENTAS' ? 'bg-secondary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Ferramentas
            </button>
          </div>

          {/* Conteúdo das Abas */}
          {activeTab === 'ETAPAS' && renderStepsTab()}
          {activeTab === 'MATERIAIS' && renderMaterialsTab()}
          {activeTab === 'FINANCEIRO' && renderExpensesTab()}
          {activeTab === 'FERRAMENTAS' && renderToolsTab()}

          {/* Toast Notification */}
          {showToast && (
            <div className={cx(
              "fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-full fade-in-full duration-300 z-50",
              toastType === 'success' ? 'bg-green-500 text-white' :
              toastType === 'error' ? 'bg-red-500 text-white' :
              'bg-amber-500 text-white'
            )}>
              <i className={`fa-solid ${
                toastType === 'success' ? 'fa-check-circle' :
                toastType === 'error' ? 'fa-exclamation-circle' :
                'fa-triangle-exclamation'
              }`}></i>
              {toastMessage}
            </div>
          )}

          {/* Modal de Confirmação Genérico (ZeModal) - para operações de exclusão, etc. */}
          {zeModal.isOpen && (!zeModal.id || zeModal.id === workId) && zeModal.type === 'DANGER' && (
            <ZeModal
              isOpen={zeModal.isOpen}
              title={zeModal.title}
              message={zeModal.message}
              confirmText={zeModal.confirmText || "Confirmar"}
              onConfirm={zeModal.onConfirm}
              onCancel={zeModal.onCancel}
              type={zeModal.type}
              isConfirming={zeModal.isConfirming}
            />
          )}
        </>
      )}
    </div>
  );
};
