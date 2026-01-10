
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx'; // Keep XLSX import, as reports might use it
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts';
import { StepStatus, FileCategory, ExpenseCategory, ExpenseStatus, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
import { ZeModal, type ZeModalProps } from '../components/ZeModal.tsx';

// --- TYPES FOR VIEW STATE ---
export type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
type SubView = 'NONE' | 'WORKERS' | 'SUPPLIERS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST' | 'AICHAT' | 'REPORTS' | 'AIPLANNER';

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

// NEW: Type for status details
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
  let textColor = 'text-slate-700 dark:text-slate-300';
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
        textColor = 'text-green-600 dark:text-green-400';
        borderColor = 'border-green-400 dark:border-green-700';
        shadowClass = 'shadow-green-500/20';
        icon = 'fa-check';
        break;
      case StepStatus.IN_PROGRESS:
        statusText = 'Em Andamento';
        bgColor = 'bg-amber-500';
        textColor = 'text-amber-600 dark:text-amber-400';
        borderColor = 'border-amber-400 dark:border-amber-700';
        shadowClass = 'shadow-amber-500/20';
        icon = 'fa-hourglass-half';
        break;
      case StepStatus.DELAYED: // Now a direct status
        statusText = 'Atrasado';
        bgColor = 'bg-red-500';
        textColor = 'text-red-600 dark:text-red-400';
        borderColor = 'border-red-400 dark:border-red-700';
        shadowClass = 'shadow-red-500/20';
        icon = 'fa-exclamation-triangle';
        break;
      case StepStatus.PENDING: // RENOMEADO: De NOT_STARTED para PENDING
      default:
        statusText = 'Pendente';
        bgColor = 'bg-slate-400';
        textColor = 'text-slate-700 dark:text-slate-300';
        borderColor = 'border-slate-200 dark:border-slate-700';
        shadowClass = 'shadow-slate-400/20';
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
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3); 
        threeDaysFromNow.setHours(0, 0, 0, 0);

        isDelayed = (stepStartDate <= threeDaysFromNow);
    }
    
    // Determine status based on derived flags
    if (isDelayed && !materialIsComplete) { // Only delayed if not already complete
      statusText = 'Atrasado';
      bgColor = 'bg-red-500';
      textColor = 'text-red-600 dark:text-red-400';
      borderColor = 'border-red-400 dark:border-red-700';
      shadowClass = 'shadow-red-500/20';
      icon = 'fa-exclamation-triangle';
    } else if (materialIsComplete) {
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      textColor = 'text-green-600 dark:text-green-400';
      borderColor = 'border-green-400 dark:border-green-700';
      shadowClass = 'shadow-green-500/20';
      icon = 'fa-check';
    } else if (materialIsPartial) {
      statusText = 'Parcial';
      bgColor = 'bg-amber-500';
      textColor = 'text-amber-600 dark:text-amber-400';
      borderColor = 'border-amber-400 dark:border-amber-700';
      shadowClass = 'shadow-amber-500/20';
      icon = 'fa-hourglass-half';
    } else if (materialIsPending) { 
      statusText = 'Pendente';
      bgColor = 'bg-slate-400';
      textColor = 'text-slate-700 dark:text-slate-300';
      borderColor = 'border-slate-200 dark:border-slate-700';
      shadowClass = 'shadow-slate-400/20';
      icon = 'fa-hourglass-start';
    }
  } else if (entityType === 'expense') {
    // MODIFICADO: Usa o novo ExpenseStatus derivado
    const expense = entity as Expense;
    
    switch (expense.status) {
      case ExpenseStatus.COMPLETED:
        statusText = 'Concluído';
        bgColor = 'bg-green-500';
        textColor = 'text-green-600 dark:text-green-400';
        borderColor = 'border-green-400 dark:border-green-700';
        shadowClass = 'shadow-green-500/20';
        icon = 'fa-check';
        break;
      case ExpenseStatus.PARTIAL:
        statusText = 'Parcial';
        bgColor = 'bg-amber-500';
        textColor = 'text-amber-600 dark:text-amber-400';
        borderColor = 'border-amber-400 dark:border-amber-700';
        shadowClass = 'shadow-amber-500/20';
        icon = 'fa-hourglass-half';
        break;
      case ExpenseStatus.PENDING:
        statusText = 'Pendente';
        bgColor = 'bg-slate-400';
        textColor = 'text-slate-700 dark:text-slate-300';
        borderColor = 'border-slate-200 dark:border-slate-700';
        shadowClass = 'shadow-slate-400/20';
        icon = 'fa-hourglass-start';
        break;
      case ExpenseStatus.OVERPAID:
        statusText = 'Prejuízo'; // NOVO STATUS
        bgColor = 'bg-red-500';
        textColor = 'text-red-600 dark:text-red-400';
        borderColor = 'border-red-400 dark:border-red-700';
        shadowClass = 'shadow-red-500/20';
        icon = 'fa-sack-xmark'; // Ícone para prejuízo
        break;
      default:
        statusText = 'Desconhecido';
        bgColor = 'bg-slate-400';
        textColor = 'text-slate-700 dark:text-slate-300';
        borderColor = 'border-slate-200 dark:border-slate-700';
        shadowClass = 'shadow-slate-400/20';
        icon = 'fa-question';
        break;
    }
  }

  return { statusText, bgColor, textColor, borderColor, shadowClass, icon };
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
}

const ToolSubViewHeader: React.FC<ToolSubViewHeaderProps> = ({ title, onBack, onAdd }) => {
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
          className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
          aria-label={`Adicionar novo item em ${title}`}
        >
          <i className="fa-solid fa-plus"></i> Novo
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
  const [newExpenseTotalAgreed, setNewExpenseTotalAgreed] = useState<string>(''); // Raw string for monetary input


  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [newWorkerDailyRate, setNewWorkerDailyRate] = useState(''); // Raw string for monetary input
  const [newWorkerNotes, setNewWorkerNotes] = useState('');
  const [editWorkerData, setEditWorkerData] = useState<Worker | null>(null);

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCategory, setNewSupplierCategory] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');
  const [editSupplierData, setEditSupplierData] = useState<Supplier | null>(null);

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

  const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string, isConfirming?: boolean }>({
    isOpen: false, title: '', message: '', onCancel: () => { }, isConfirming: false
  });

  // NEW: State for Contract Viewer Modal
  const [showContractContentModal, setShowContractContentModal] = useState(false);
  const [selectedContractContent, setSelectedContractContent] = useState('');
  const [selectedContractTitle, setSelectedContractTitle] = useState('');
  const [copyContractSuccess, setCopyContractSuccess] = useState(false);


  // =======================================================================
  // AUXILIARY FUNCTIONS
  // =======================================================================

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

  const calculateStepProgress = (stepId: string): number => {
    const totalMaterialsForStep = materials.filter(m => m.stepId === stepId);
    if (totalMaterialsForStep.length === 0) return 0;

    const totalPlannedQty = totalMaterialsForStep.reduce((sum, m) => sum + m.plannedQty, 0);
    const totalPurchasedQty = totalMaterialsForStep.reduce((sum, m) => sum + m.purchasedQty, 0);

    // Fix: Use totalPurchasedQty instead of undefined purchasedQty
    return totalPlannedQty > 0 ? (totalPurchasedQty / totalPlannedQty) * 100 : 0;
  };

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
    const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

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

    } catch (error) {
      console.error("Erro ao carregar dados da obra:", error);
      // Optionally show a user-friendly error message
      setZeModal({
        isOpen: true,
        title: "Erro de Carregamento",
        message: "Não foi possível carregar os dados da obra. Verifique sua conexão ou tente novamente.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
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
    } catch (error: any) {
      console.error(`[handleStepStatusChange] Erro ao alterar status da etapa ${step.id}:`, error);
      setZeModal({
        isOpen: true,
        title: "Erro ao Atualizar Status",
        message: `Não foi possível atualizar o status da etapa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    } finally {
      setIsUpdatingStepStatus(false);
      console.log(`[handleStepStatusChange] Finalized status update for step ${step.id}. isUpdatingStepStatus set to false.`);
    }
  }, [loadWorkData, isUpdatingStepStatus]);

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
    } catch (error: any) {
      console.error("Erro ao adicionar etapa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Etapa",
        message: `Não foi possível adicionar a etapa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao editar etapa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Etapa",
        message: `Não foi possível editar a etapa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao deletar etapa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Etapa",
        message: `Não foi possível deletar a etapa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
            onConfirm: async (_e?: React.FormEvent) => {}, 
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
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
    } catch (error: any) {
      console.error("Erro ao reordenar etapas:", error);
      setZeModal({
        isOpen: true,
        title: "Erro ao Reordenar Etapas",
        message: `Não foi possível reordenar as etapas: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    } finally {
      setDraggedStepId(null);
      setDragOverStepId(null);
      setLoading(false);
    }
  }, [draggedStepId, steps, workId, loadWorkData, setLoading, setDraggedStepId, setDragOverStepId, setZeModal]);


  // =======================================================================
  // CRUD HANDLERS: MATERIALS
  // =======================================================================

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newMaterialName || !newMaterialPlannedQty || !newMaterialUnit) return;

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
    } catch (error: any) {
      console.error("Erro ao adicionar material:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Material",
        message: `Não foi possível adicionar o material: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao editar material ou registrar compra:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro na Operação",
        message: `Não foi possível completar a operação: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao deletar material:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Material",
        message: `Não foi possível deletar o material: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    if (!workId || !newExpenseDescription || !newExpenseAmount || !newExpenseDate) return;

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
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        // totalAgreed defaults to amount if not explicitly provided
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
      setNewExpenseTotalAgreed(''); // Clear new expense total agreed
      await loadWorkData();
    } catch (error: any) {
      console.error("Erro ao adicionar despesa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Despesa",
        message: `Não foi possível adicionar a despesa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
        totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : undefined, // Can be undefined
      });
      setEditExpenseData(null);
      setShowAddExpenseModal(false);
      await loadWorkData();
    } catch (error: any) {
      console.error("Erro ao editar despesa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Despesa",
        message: `Não foi possível editar a despesa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao deletar despesa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Despesa",
        message: `Não foi possível deletar a despesa: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao adicionar trabalhador:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Trabalhador",
        message: `Não foi possível adicionar o trabalhador: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorkerData || !workId || !user?.id || !newWorkerName || !newWorkerRole || !newWorkerPhone) return;

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
    } catch (error: any) {
      console.error("Erro ao editar trabalhador:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Trabalhador",
        message: `Não foi possível editar o trabalhador: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
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
    } catch (error: any) {
      console.error("Erro ao deletar trabalhador:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Trabalhador",
        message: `Não foi possível deletar o trabalhador: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao adicionar fornecedor:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Fornecedor",
        message: `Não foi possível adicionar o fornecedor: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplierData || !workId || !user?.id || !newSupplierName || !newSupplierCategory || !newSupplierPhone) return;

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
    } catch (error: any) {
      console.error("Erro ao editar fornecedor:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Fornecedor",
        message: `Não foi possível editar o fornecedor: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
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
    } catch (error: any) {
      console.error("Erro ao deletar fornecedor:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Fornecedor",
        message: `Não foi possível deletar o fornecedor: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    if (!workId || !newPhotoDescription || !newPhotoFile) return;

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
    } catch (error: any) {
      console.error("Erro ao adicionar foto:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Foto",
        message: `Não foi possível adicionar a foto: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao deletar foto:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Foto",
        message: `Não foi possível deletar a foto: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    if (!workId || !newFileName || !newUploadFile) return;

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
    } catch (error: any) {
      console.error("Erro ao adicionar arquivo:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Arquivo",
        message: `Não foi possível adicionar o arquivo: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    } catch (error: any) {
      console.error("Erro ao deletar arquivo:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Arquivo",
        message: `Não foi possível deletar o arquivo: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
      setZeModal(prev => ({ ...prev, title: "Campos Obrigatórios", message: "Por favor, preencha o nome do checklist e todos os itens.", type: "ERROR", confirmText: "Ok", onConfirm: async () => {}, onCancel: () => setZeModal(p => ({ ...p, isOpen: false })) }));
      return;
    }
  
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
    } catch (error: any) {
      console.error("Erro ao adicionar checklist:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Checklist",
        message: `Não foi possível adicionar o checklist: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChecklistData || !workId || !newChecklistName || newChecklistItems.some(item => !item.trim())) {
      setZeModal(prev => ({ ...prev, title: "Campos Obrigatórios", message: "Por favor, preencha o nome do checklist e todos os itens.", type: "ERROR", confirmText: "Ok", onConfirm: async () => {}, onCancel: () => setZeModal(p => ({ ...p, isOpen: false })) }));
      return;
    }
  
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
    } catch (error: any) {
      console.error("Erro ao editar checklist:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Checklist",
        message: `Não foi possível editar o checklist: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteChecklist(checklistId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      console.error("Erro ao deletar checklist:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Checklist",
        message: `Não foi possível deletar o checklist: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
                  aria-label="Voltar para o Dashboard"
              >
                  Voltar ao Dashboard
              </button>
          </div>
      );
  }

  // ... rest of the component rendering
  return (
    <div className="max-w-4xl mx-auto pb-12 pt-6 px-4 md:px-0 font-sans">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label="Voltar para Dashboard"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">{work?.name}</h1>
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

      {/* RENDER ACTIVE TAB CONTENT */}
      {activeTab === 'ETAPAS' && (
        <div className="tab-content animate-in fade-in duration-300">
          {activeSubView === 'NONE' ? (
            <>
              {/* ETAPAS: Overview */}
              <div className={cx(surface, card, "mb-6")}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-primary dark:text-white">Cronograma</h2>
                  <button
                    onClick={() => {
                      setEditStepData(null); // Clear any old edit data
                      setNewStepName('');
                      setNewStepStartDate(new Date().toISOString().split('T')[0]);
                      setNewStepEndDate(new Date().toISOString().split('T')[0]);
                      setNewEstimatedDurationDays(''); // Clear for new
                      setShowAddStepModal(true);
                    }}
                    className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                  >
                    <i className="fa-solid fa-plus"></i> Nova Etapa
                  </button>
                </div>
                {steps.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-slate-400 italic">Nenhuma etapa planejada para esta obra ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {steps.map(step => {
                      const statusDetails = getEntityStatusDetails('step', step, steps); // Pass all steps for full context
                      const progress = calculateStepProgress(step.id);
                      return (
                        <div
                          key={step.id}
                          className={cx(
                            surface,
                            "group p-4 rounded-2xl cursor-grab", // Added group and cursor-grab
                            dragOverStepId === step.id ? "ring-2 ring-secondary/50" : "", // Highlight drag over
                            "border-2", statusDetails.borderColor // Use status-based border
                          )}
                          draggable
                          onDragStart={(e) => handleDragStart(e, step.id)}
                          onDragOver={(e) => handleDragOver(e, step.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, step.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-bold text-primary dark:text-white text-lg leading-tight flex items-center gap-2">
                              <i className={`fa-solid fa-grip-vertical text-slate-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity`}></i>
                              {step.orderIndex}. {step.name}
                            </h3>
                            <button
                              onClick={() => handleStepStatusChange(step)}
                              disabled={isUpdatingStepStatus}
                              className={cx("px-3 py-1 rounded-full text-xs font-bold text-white transition-all disabled:opacity-70 flex items-center gap-1", statusDetails.bgColor)}
                              aria-label={`Mudar status da etapa ${step.name}. Status atual: ${statusDetails.statusText}`}
                            >
                               {isUpdatingStepStatus ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${statusDetails.icon}`}></i>}
                               {statusDetails.statusText}
                            </button>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                            {formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}
                            {step.realDate && <span className="ml-2 text-green-600 dark:text-green-400">(Concluído em: {formatDateDisplay(step.realDate)})</span>}
                          </p>
                          <div className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className="bg-secondary h-full rounded-full"
                              style={{ width: `${progress}%` }}
                            ></div>
                            <span className="absolute right-0 top-1/2 -translate-y-1/2 px-2 text-[10px] font-bold text-slate-600 dark:text-slate-300">{progress.toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center justify-end gap-3 mt-4">
                            <button
                              onClick={() => {
                                setEditStepData(step);
                                setNewStepName(step.name);
                                setNewStepStartDate(step.startDate);
                                setNewStepEndDate(step.endDate);
                                setNewEstimatedDurationDays(step.estimatedDurationDays ? String(step.estimatedDurationDays) : ''); // NEW
                                setShowAddStepModal(true);
                              }}
                              className="text-primary dark:text-white hover:text-secondary text-sm"
                            >
                              <i className="fa-solid fa-edit mr-1"></i> Editar
                            </button>
                            <button
                              onClick={() => setZeModal({
                                isOpen: true,
                                title: "Confirmar Exclusão",
                                message: `Tem certeza que deseja excluir a etapa "${step.name}"? Esta ação é irreversível se a etapa não tiver iniciado.`,
                                confirmText: "Sim, Excluir",
                                onConfirm: async () => handleDeleteStep(step.id),
                                onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                                type: "DANGER"
                              })}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : null}

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
        </div>
      )}

      {activeTab === 'MATERIAIS' && (
        <div className="tab-content animate-in fade-in duration-300">
          {activeSubView === 'NONE' ? (
            <>
              {/* MATERIAIS: Overview */}
              <div className={cx(surface, card, "mb-6")}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-primary dark:text-white">Materiais</h2>
                  <button
                    onClick={() => {
                      setEditMaterialData(null);
                      setNewMaterialName('');
                      setNewMaterialBrand('');
                      setNewMaterialPlannedQty('');
                      setNewMaterialUnit('');
                      setNewMaterialCategory('');
                      setNewMaterialStepId(steps.length > 0 ? steps[0].id : 'none'); // Default to first step
                      setShowAddMaterialModal(true);
                    }}
                    className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                  >
                    <i className="fa-solid fa-plus"></i> Novo Material
                  </button>
                </div>

                {materials.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-slate-400 italic">Nenhum material cadastrado para esta obra ainda.</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Você pode usar o "Gerar Materiais" na aba Ferramentas!</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <label htmlFor="material-filter" className="block text-sm font-bold text-primary dark:text-white mb-2">Filtrar por Etapa:</label>
                      <select
                        id="material-filter"
                        value={materialFilterStepId}
                        onChange={(e) => setMaterialFilterStepId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-primary dark:text-white focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                      >
                        <option value="all">Todas as Etapas</option>
                        {steps.map(step => (
                          <option key={step.id} value={step.id}>{step.orderIndex}. {step.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4">
                      {groupedMaterials.map(group => (
                        <div key={group.stepId}>
                          <h3 className="text-lg font-bold text-primary dark:text-white mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">{group.stepName}</h3>
                          {group.materials.length === 0 ? (
                            <p className="text-slate-500 dark:text-slate-400 italic ml-4">Nenhum material encontrado para esta etapa com o filtro atual.</p>
                          ) : (
                            <div className="space-y-3">
                              {group.materials.map(material => {
                                const statusDetails = getEntityStatusDetails('material', material, steps); // Pass all steps for delay calculation
                                const progress = material.plannedQty > 0 ? (material.purchasedQty / material.plannedQty) * 100 : 0;
                                return (
                                  <div key={material.id} className={cx(surface, "p-4 rounded-2xl", "border-2", statusDetails.borderColor)}>
                                    <div className="flex items-start justify-between mb-2">
                                      <h4 className="font-bold text-primary dark:text-white text-lg leading-tight">{material.name}</h4>
                                      <span
                                        className={cx("px-3 py-1 rounded-full text-xs font-bold text-white", statusDetails.bgColor)}
                                      >
                                        <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                                      {material.brand && `${material.brand} - `}
                                      {material.purchasedQty} / {material.plannedQty} {material.unit}
                                    </p>
                                    <div className="relative w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                      <div
                                        className="bg-secondary h-full rounded-full"
                                        style={{ width: `${progress}%` }}
                                      ></div>
                                      <span className="absolute right-0 top-1/2 -translate-y-1/2 px-2 text-[10px] font-bold text-slate-600 dark:text-slate-300">{progress.toFixed(0)}%</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-3 mt-4">
                                      <button
                                        onClick={() => {
                                          setEditMaterialData(material);
                                          setNewMaterialName(material.name);
                                          setNewMaterialBrand(material.brand || '');
                                          setNewMaterialPlannedQty(String(material.plannedQty));
                                          setNewMaterialUnit(material.unit);
                                          setNewMaterialCategory(material.category || '');
                                          setNewMaterialStepId(material.stepId || 'none');
                                          // Initialize purchase inputs to empty when opening for edit
                                          setPurchaseQtyInput(''); 
                                          setPurchaseCostInput('');
                                          setShowAddMaterialModal(true);
                                        }}
                                        className="text-primary dark:text-white hover:text-secondary text-sm"
                                      >
                                        <i className="fa-solid fa-edit mr-1"></i> Editar / Comprar
                                      </button>
                                      <button
                                        onClick={() => setZeModal({
                                          isOpen: true,
                                          title: "Confirmar Exclusão",
                                          message: `Tem certeza que deseja excluir o material "${material.name}"? Isso também removerá despesas associadas. Esta ação é irreversível.`,
                                          confirmText: "Sim, Excluir",
                                          onConfirm: async () => handleDeleteMaterial(material.id),
                                          onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                                          type: "DANGER"
                                        })}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                      >
                                        <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}

          {/* ADD/EDIT MATERIAL MODAL */}
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
                          placeholder="Custo total (ex: 150.00)"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </div>
                    {(Number(purchaseQtyInput) > 0 && Number(purchaseCostInput) <= 0) && (
                        <p className="text-red-500 text-xs mt-2">Custo deve ser maior que zero para registrar uma compra de material.</p>
                    )}
                  </div>
                )}
              </form>
            </ZeModal>
          )}
        </div>
      )}

      {activeTab === 'FINANCEIRO' && (
        <div className="tab-content animate-in fade-in duration-300">
          {activeSubView === 'NONE' ? (
            <>
              {/* FINANCEIRO: Overview */}
              <div className={cx(surface, card, "mb-6")}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-black text-primary dark:text-white">Financeiro</h2>
                  <button
                    onClick={() => {
                      setEditExpenseData(null);
                      setNewExpenseDescription('');
                      setNewExpenseAmount('');
                      setNewExpenseCategory(ExpenseCategory.OTHER);
                      setNewExpenseDate(new Date().toISOString().split('T')[0]);
                      setNewExpenseStepId(steps.length > 0 ? steps[0].id : 'none');
                      setNewExpenseWorkerId(workers.length > 0 ? workers[0].id : 'none');
                      setNewExpenseSupplierId(suppliers.length > 0 ? suppliers[0].id : 'none');
                      setNewExpenseTotalAgreed(''); // Clear
                      setShowAddExpenseModal(true);
                    }}
                    className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                  >
                    <i className="fa-solid fa-plus"></i> Nova Despesa
                  </button>
                </div>

                {expenses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-500 dark:text-slate-400 italic">Nenhuma despesa registrada para esta obra ainda.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Orçamento Planejado</p>
                        <h3 className="text-xl font-bold text-primary dark:text-white">{formatCurrency(work?.budgetPlanned)}</h3>
                      </div>
                      <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Gasto Total</p>
                        <h3 className={`text-xl font-bold ${calculateTotalExpenses > (work?.budgetPlanned || 0) ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(calculateTotalExpenses)}</h3>
                      </div>
                      <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">A Pagar</p>
                        <h3 className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalOutstandingExpenses)}</h3>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {groupedExpensesByStep.map(group => (
                        <div key={group.stepName}>
                          <h3 className="text-lg font-bold text-primary dark:text-white mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">{group.stepName}</h3>
                          {group.expenses.map(expense => {
                            const statusDetails = getEntityStatusDetails('expense', expense, steps);
                            return (
                              <div key={expense.id} className={cx(surface, "p-4 rounded-2xl mb-3", "border-2", statusDetails.borderColor)}>
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="font-bold text-primary dark:text-white text-lg leading-tight">{expense.description}</h4>
                                  <span
                                    className={cx("px-3 py-1 rounded-full text-xs font-bold text-white", statusDetails.bgColor)}
                                  >
                                    <i className={`fa-solid ${statusDetails.icon} mr-1`}></i> {statusDetails.statusText}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                                  Categoria: {expense.category} | Data: {formatDateDisplay(expense.date)}
                                </p>
                                <div className="flex justify-between items-center text-sm font-bold text-primary dark:text-white">
                                  <span>Previsto: {formatCurrency(expense.amount)}</span>
                                  <span>Pago: {formatCurrency(expense.paidAmount || 0)}</span>
                                  <span>Restante: {formatCurrency((expense.totalAgreed !== undefined && expense.totalAgreed !== null ? expense.totalAgreed : expense.amount) - (expense.paidAmount || 0))}</span>
                                </div>
                                <div className="flex items-center justify-end gap-3 mt-4">
                                  {(expense.status === ExpenseStatus.PENDING || expense.status === ExpenseStatus.PARTIAL) && (
                                    <button
                                      onClick={() => {
                                        setPaymentExpenseData(expense);
                                        setPaymentAmount(''); // Clear amount for new payment
                                        setNewPaymentDate(new Date().toISOString().split('T')[0]); // Default to today
                                        setShowAddPaymentModal(true);
                                      }}
                                      className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition-colors"
                                    >
                                      <i className="fa-solid fa-hand-holding-dollar mr-1"></i> Registrar Pagamento
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditExpenseData(expense);
                                      setNewExpenseDescription(expense.description);
                                      setNewExpenseAmount(String(expense.amount));
                                      setNewExpenseCategory(expense.category);
                                      setNewExpenseDate(expense.date);
                                      setNewExpenseStepId(expense.stepId || 'none');
                                      setNewExpenseWorkerId(expense.workerId || 'none');
                                      setNewExpenseSupplierId(expense.supplierId || 'none');
                                      setNewExpenseTotalAgreed(expense.totalAgreed !== undefined && expense.totalAgreed !== null ? String(expense.totalAgreed) : '');
                                      setShowAddExpenseModal(true);
                                    }}
                                    className="text-primary dark:text-white hover:text-secondary text-sm"
                                  >
                                    <i className="fa-solid fa-edit mr-1"></i> Editar
                                  </button>
                                  <button
                                    onClick={() => setZeModal({
                                      isOpen: true,
                                      title: "Confirmar Exclusão",
                                      message: `Tem certeza que deseja excluir a despesa "${expense.description}"? Isso também removerá pagamentos associados. Esta ação é irreversível.`,
                                      confirmText: "Sim, Excluir",
                                      onConfirm: async () => handleDeleteExpense(expense.id),
                                      onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                                      type: "DANGER"
                                    })}
                                    className="text-red-500 hover:text-red-700 text-sm"
                                  >
                                    <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}

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
                    placeholder="Ex: Pagamento Pedreiro João, Compra de Cimento"
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
                    placeholder="Ex: 500.00"
                    min="0"
                    step="0.01"
                    required
                    disabled={editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if already paid
                  />
                  {editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar o valor de uma despesa que já possui pagamentos.</p>}
                </div>
                {/* NEW: Total Agreed */}
                <div>
                  <label htmlFor="expense-total-agreed" className="block text-sm font-bold text-primary dark:text-white mb-1">Valor Combinado (R$)</label>
                  <input
                    id="expense-total-agreed"
                    type="number"
                    value={newExpenseTotalAgreed}
                    onChange={(e) => setNewExpenseTotalAgreed(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Ex: 500.00 (Opcional, se diferente do valor previsto)"
                    min="0"
                    step="0.01"
                    disabled={editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if already paid
                  />
                  {editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar o valor combinado de uma despesa que já possui pagamentos.</p>}
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Este é o valor total que você combinou pagar. Se não preenchido, será igual ao 'Valor Previsto'.
                  </p>
                </div>
                <div>
                  <label htmlFor="expense-category" className="block text-sm font-bold text-primary dark:text-white mb-1">Categoria</label>
                  <select
                    id="expense-category"
                    value={newExpenseCategory}
                    onChange={(e) => setNewExpenseCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    required
                    disabled={editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if already paid
                  >
                    {Object.values(ExpenseCategory).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                    <option value="Outros">Outros</option>
                  </select>
                  {editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar a categoria de uma despesa que já possui pagamentos.</p>}
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
                    disabled={editExpenseData?.paidAmount && editExpenseData.paidAmount > 0} // Disable if already paid
                  />
                  {editExpenseData?.paidAmount && editExpenseData.paidAmount > 0 && <p className="text-xs text-red-500 mt-1">Não é possível alterar a data de uma despesa que já possui pagamentos.</p>}
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
                {/* NEW: Worker and Supplier for Expenses */}
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

          {/* ADD PAYMENT MODAL */}
          {showAddPaymentModal && paymentExpenseData && (
            <ZeModal
              isOpen={showAddPaymentModal}
              title={`Registrar Pagamento para "${paymentExpenseData.description}"`}
              message=""
              confirmText="Registrar Pagamento"
              onConfirm={async (e) => {
                e?.preventDefault(); // Ensure event is passed if available
                if (!paymentExpenseData) return;
                setZeModal(prev => ({ ...prev, isConfirming: true }));
                try {
                  await dbService.addPaymentToExpense(
                    paymentExpenseData.id,
                    Number(paymentAmount),
                    paymentDate
                  );
                  setShowAddPaymentModal(false);
                  setPaymentExpenseData(null);
                  setPaymentAmount('');
                  setNewPaymentDate(new Date().toISOString().split('T')[0]); // Default to today
                  await loadWorkData();
                } catch (error: any) {
                  console.error("Erro ao registrar pagamento:", error);
                  setZeModal(prev => ({
                    ...prev,
                    isConfirming: false,
                    title: "Erro ao Registrar Pagamento",
                    message: `Não foi possível registrar o pagamento: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
                    type: "ERROR",
                    confirmText: "Ok",
                    onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
              <form onSubmit={async (e) => { e.preventDefault(); /* submit is handled by onConfirm */ }} className="space-y-4">
                <div>
                  <label htmlFor="payment-amount" className="block text-sm font-bold text-primary dark:text-white mb-1">Valor do Pagamento (R$)</label>
                  <input
                    id="payment-amount"
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder={`Ex: ${formatCurrency( (paymentExpenseData.totalAgreed !== undefined && paymentExpenseData.totalAgreed !== null ? paymentExpenseData.totalAgreed : paymentExpenseData.amount) - (paymentExpenseData.paidAmount || 0) )}`}
                    min="0"
                    step="0.01"
                    required
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Valor restante a pagar: {formatCurrency((paymentExpenseData.totalAgreed !== undefined && paymentExpenseData.totalAgreed !== null ? paymentExpenseData.totalAgreed : paymentExpenseData.amount) - (paymentExpenseData.paidAmount || 0))}
                  </p>
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
        </div>
      )}

      {activeTab === 'FERRAMENTAS' && (
        <div className="tab-content animate-in fade-in duration-300">
          {activeSubView === 'NONE' && (
            <>
              {/* FERRAMENTAS: Main Grid */}
              <div className={cx(surface, card, "mb-6")}>
                <h2 className="text-xl font-black text-primary dark:text-white mb-4">Ferramentas da Obra</h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <ToolCard
                    icon="fa-users-gear"
                    title="Equipe"
                    description="Gerencie trabalhadores e suas funções."
                    onClick={() => goToSubView('WORKERS')}
                  />
                  <ToolCard
                    icon="fa-truck-field"
                    title="Fornecedores"
                    description="Cadastre seus fornecedores e contatos."
                    onClick={() => goToSubView('SUPPLIERS')}
                  />
                  <ToolCard
                    icon="fa-camera"
                    title="Fotos"
                    description="Documente o progresso da sua obra."
                    onClick={() => goToSubView('PHOTOS')}
                  />
                  <ToolCard
                    icon="fa-file-alt"
                    title="Projetos e Documentos"
                    description="Armazene plantas, orçamentos e mais."
                    onClick={() => goToSubView('PROJECTS')}
                  />
                  <ToolCard
                    icon="fa-file-contract"
                    title="Contratos e Recibos"
                    description="Gere documentos legais rapidamente."
                    onClick={() => goToSubView('CONTRACTS')}
                    isLocked={!isVitalicio} // Only locked if not Vitalicio
                    requiresVitalicio={true}
                  />
                  <ToolCard
                    icon="fa-list-check"
                    title="Checklists"
                    description="Não esqueça de nada em cada etapa."
                    onClick={() => goToSubView('CHECKLIST')}
                    isLocked={!isVitalicio} // Only locked if not Vitalicio
                    requiresVitalicio={true}
                  />
                  <ToolCard
                    icon="fa-chart-pie"
                    title="Relatórios"
                    description="Visão financeira e cronograma em PDF/Excel."
                    onClick={() => navigate(`/work/${workId}/reports`)} // Navigate to reports page
                    isLocked={!isVitalicio} // Only locked if not Vitalicio
                    requiresVitalicio={true}
                  />
                  <ToolCard
                    icon="fa-robot"
                    title="Plano Inteligente AI"
                    description="Crie seu cronograma e riscos com IA."
                    onClick={() => navigate(`/work/${workId}/ai-planner`)} // Navigate to AI Planner page
                    isLocked={!hasAiAccess} // Locked if no AI access
                    requiresVitalicio={!isAiTrialActive} // Only show vitalicio tag if not on trial
                  />
                  <ToolCard
                    icon="fa-arrows-rotate"
                    title="Regerar Materiais"
                    description="Atualize lista de materiais baseada no projeto."
                    onClick={() =>
                      setZeModal({
                        isOpen: true,
                        title: "Regerar Materiais",
                        message: "Tem certeza que deseja regerar a lista de materiais? Isso removerá a lista atual e criará uma nova baseada nas características da obra e etapas existentes. Esta ação é irreversível.",
                        confirmText: "Sim, Regerar",
                        onConfirm: async () => {
                          try {
                            await dbService.regenerateMaterials(work!, steps); // Assure work is not null
                            await loadWorkData();
                            setZeModal(prev => ({ ...prev, isOpen: false }));
                          } catch (error: any) {
                            console.error("Erro ao regerar materiais:", error);
                            setZeModal(prev => ({ ...prev, title: "Erro", message: `Erro ao regerar materiais: ${error.message}`, type: "ERROR", confirmText: "Ok" }));
                          }
                        },
                        onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                        type: "DANGER"
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}
          {activeSubView === 'WORKERS' && (
            <>
              <ToolSubViewHeader
                title="Equipe da Obra"
                onBack={() => goToSubView('NONE')}
                onAdd={() => {
                  setEditWorkerData(null);
                  setNewWorkerName('');
                  setNewWorkerRole('');
                  setNewWorkerPhone('');
                  setNewWorkerDailyRate('');
                  setNewWorkerNotes('');
                  setShowAddWorkerModal(true);
                }}
              />
              <div className={cx(surface, card, "space-y-4")}>
                {workers.length === 0 ? (
                  <p className={mutedText}>Nenhum trabalhador cadastrado ainda.</p>
                ) : (
                  workers.map(worker => (
                    <div key={worker.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <h3 className="font-bold text-primary dark:text-white text-lg">{worker.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Função: {worker.role}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Telefone: {worker.phone}</p>
                      {worker.dailyRate && <p className="text-sm text-slate-500 dark:text-slate-400">Diária: {formatCurrency(worker.dailyRate)}</p>}
                      {worker.notes && <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">{worker.notes}</p>}
                      <div className="flex items-center justify-end gap-3 mt-4">
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
                          className="text-primary dark:text-white hover:text-secondary text-sm"
                        >
                          <i className="fa-solid fa-edit mr-1"></i> Editar
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir o trabalhador "${worker.name}"? Esta ação é irreversível.`,
                            confirmText: "Sim, Excluir",
                            onConfirm: async () => handleDeleteWorker(worker.id),
                            onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                            type: "DANGER"
                          })}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </>
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
                    <option value="">Selecione</option>
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
                    onChange={(e) => setNewWorkerPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Ex: (99) 99999-9999"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="worker-daily-rate" className="block text-sm font-bold text-primary dark:text-white mb-1">Valor da Diária (R$)</label>
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
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Informações adicionais sobre o trabalhador"
                  ></textarea>
                </div>
              </form>
            </ZeModal>
          )}

          {activeSubView === 'SUPPLIERS' && (
            <>
              <ToolSubViewHeader
                title="Fornecedores da Obra"
                onBack={() => goToSubView('NONE')}
                onAdd={() => {
                  setEditSupplierData(null);
                  setNewSupplierName('');
                  setNewSupplierCategory('');
                  setNewSupplierPhone('');
                  setNewSupplierEmail('');
                  setNewSupplierAddress('');
                  setNewSupplierNotes('');
                  setShowAddSupplierModal(true);
                }}
              />
              <div className={cx(surface, card, "space-y-4")}>
                {suppliers.length === 0 ? (
                  <p className={mutedText}>Nenhum fornecedor cadastrado ainda.</p>
                ) : (
                  suppliers.map(supplier => (
                    <div key={supplier.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                      <h3 className="font-bold text-primary dark:text-white text-lg">{supplier.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Categoria: {supplier.category}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Telefone: {supplier.phone}</p>
                      {supplier.email && <p className="text-sm text-slate-500 dark:text-slate-400">Email: {supplier.email}</p>}
                      {supplier.address && <p className="text-sm text-slate-500 dark:text-slate-400">Endereço: {supplier.address}</p>}
                      {supplier.notes && <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">{supplier.notes}</p>}
                      <div className="flex items-center justify-end gap-3 mt-4">
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
                          className="text-primary dark:text-white hover:text-secondary text-sm"
                        >
                          <i className="fa-solid fa-edit mr-1"></i> Editar
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir o fornecedor "${supplier.name}"? Esta ação é irreversível.`,
                            confirmText: "Sim, Excluir",
                            onConfirm: async () => handleDeleteSupplier(supplier.id, workId),
                            onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                            type: "DANGER"
                          })}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </>
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
                    placeholder="Ex: Casa do Construtor"
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
                    <option value="">Selecione</option>
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
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Ex: (99) 99999-9999"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="supplier-email" className="block text-sm font-bold text-primary dark:text-white mb-1">Email (Opcional)</label>
                  <input
                    id="supplier-email"
                    type="email"
                    value={newSupplierEmail}
                    onChange={(e) => setNewSupplierEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Ex: contato@fornecedor.com.br"
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
                    placeholder="Ex: Rua das Pedras, 456"
                  />
                </div>
                <div>
                  <label htmlFor="supplier-notes" className="block text-sm font-bold text-primary dark:text-white mb-1">Observações (Opcional)</label>
                  <textarea
                    id="supplier-notes"
                    value={newSupplierNotes}
                    onChange={(e) => setNewSupplierNotes(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Informações adicionais sobre o fornecedor"
                  ></textarea>
                </div>
              </form>
            </ZeModal>
          )}

          {activeSubView === 'PHOTOS' && (
            <>
              <ToolSubViewHeader
                title="Fotos da Obra"
                onBack={() => goToSubView('NONE')}
                onAdd={() => setShowAddPhotoModal(true)}
              />
              <div className={cx(surface, card, "space-y-4")}>
                {photos.length === 0 ? (
                  <p className={mutedText}>Nenhuma foto adicionada ainda.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map(photo => (
                      <div key={photo.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                        <img src={photo.url} alt={photo.description} className="w-full h-48 object-cover" />
                        <div className="p-3">
                          <p className="font-bold text-primary dark:text-white text-sm">{photo.description}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatDateDisplay(photo.date)} | Tipo: {photo.type}</p>
                          <div className="flex justify-end mt-3">
                            <button
                              onClick={() => setZeModal({
                                isOpen: true,
                                title: "Confirmar Exclusão",
                                message: "Tem certeza que deseja excluir esta foto? Esta ação é irreversível.",
                                confirmText: "Sim, Excluir",
                                onConfirm: async () => handleDeletePhoto(photo),
                                onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                                type: "DANGER"
                              })}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ADD PHOTO MODAL */}
          {showAddPhotoModal && (
            <ZeModal
              isOpen={showAddPhotoModal}
              title="Adicionar Nova Foto"
              message=""
              confirmText="Salvar Foto"
              onConfirm={handleAddPhoto}
              onCancel={() => {
                setShowAddPhotoModal(false);
                setNewPhotoDescription('');
                setNewPhotoFile(null);
                setNewPhotoType('PROGRESS');
              }}
              isConfirming={uploadingPhoto}
              type="SUCCESS"
            >
              <form onSubmit={handleAddPhoto} className="space-y-4">
                <div>
                  <label htmlFor="photo-description" className="block text-sm font-bold text-primary dark:text-white mb-1">Descrição</label>
                  <input
                    id="photo-description"
                    type="text"
                    value={newPhotoDescription}
                    onChange={(e) => setNewPhotoDescription(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    placeholder="Ex: Fundação da cozinha, Pintura da fachada"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="photo-file" className="block text-sm font-bold text-primary dark:text-white mb-1">Arquivo da Imagem</label>
                  <input
                    id="photo-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewPhotoFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full text-primary dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark cursor-pointer transition-all"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="photo-type" className="block text-sm font-bold text-primary dark:text-white mb-1">Tipo de Foto</label>
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

          {activeSubView === 'PROJECTS' && (
            <>
              <ToolSubViewHeader
                title="Projetos e Documentos"
                onBack={() => goToSubView('NONE')}
                onAdd={() => setShowAddFileModal(true)}
              />
              <div className={cx(surface, card, "space-y-4")}>
                {files.length === 0 ? (
                  <p className={mutedText}>Nenhum arquivo adicionado ainda.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {files.map(file => (
                      <div key={file.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <i className="fa-solid fa-file text-2xl text-secondary"></i>
                          <div>
                            <p className="font-bold text-primary dark:text-white text-sm">{file.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{file.category} | {file.type}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors">
                            <i className="fa-solid fa-external-link-alt"></i>
                          </a>
                          <button
                            onClick={() => setZeModal({
                              isOpen: true,
                              title: "Confirmar Exclusão",
                              message: "Tem certeza que deseja excluir este arquivo? Esta ação é irreversível.",
                              confirmText: "Sim, Excluir",
                              onConfirm: async () => handleDeleteFile(file),
                              onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                              type: "DANGER"
                            })}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            <i className="fa-solid fa-trash-alt"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ADD FILE MODAL */}
          {showAddFileModal && (
            <ZeModal
              isOpen={showAddFileModal}
              title="Adicionar Novo Arquivo"
              message=""
              confirmText="Salvar Arquivo"
              onConfirm={handleAddFile}
              onCancel={() => {
                setShowAddFileModal(false);
                setNewFileName('');
                setNewFileCategory(FileCategory.GENERAL);
                setNewUploadFile(null);
              }}
              isConfirming={uploadingFile}
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
                    placeholder="Ex: Planta Baixa, Orçamento Gesso"
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
                    required
                  >
                    {Object.values(FileCategory).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="upload-file" className="block text-sm font-bold text-primary dark:text-white mb-1">Selecionar Arquivo</label>
                  <input
                    id="upload-file"
                    type="file"
                    onChange={(e) => setNewUploadFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full text-primary dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-secondary file:text-white hover:file:bg-secondary-dark cursor-pointer transition-all"
                    required
                  />
                </div>
              </form>
            </ZeModal>
          )}

          {activeSubView === 'CONTRACTS' && (
            <>
              <ToolSubViewHeader
                title="Modelos de Contratos e Recibos"
                onBack={() => goToSubView('NONE')}
              />
              <div className={cx(surface, card, "space-y-4")}>
                {contracts.length === 0 ? (
                  <p className={mutedText}>Nenhum modelo de contrato encontrado.</p>
                ) : (
                  contracts.map(contract => (
                    <div key={contract.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <i className="fa-solid fa-file-contract text-2xl text-secondary"></i>
                        <div>
                          <p className="font-bold text-primary dark:text-white text-sm">{contract.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Categoria: {contract.category}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedContractContent(contract.contentTemplate);
                          setSelectedContractTitle(contract.title);
                          setShowContractContentModal(true);
                        }}
                        className="px-3 py-1 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary-dark transition-colors"
                      >
                        <i className="fa-solid fa-eye mr-1"></i> Visualizar
                      </button>
                    </div>
                  ))}
                )}
              </div>
            </>
          )}

          {/* CONTRACT CONTENT VIEWER MODAL */}
          {showContractContentModal && (
            <ZeModal
              isOpen={showContractContentModal}
              title={selectedContractTitle}
              message=""
              confirmText={copyContractSuccess ? "Copiado!" : "Copiar Texto"}
              onConfirm={async () => {
                await navigator.clipboard.writeText(selectedContractContent);
                setCopyContractSuccess(true);
                setTimeout(() => setCopyContractSuccess(false), 2000);
              }}
              onCancel={() => {
                setShowContractContentModal(false);
                setCopyContractSuccess(false);
                setSelectedContractContent('');
                setSelectedContractTitle('');
              }}
              isConfirming={false}
              type="INFO"
            >
              <div className="max-h-80 overflow-y-auto bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-sm text-primary dark:text-white whitespace-pre-wrap">
                {selectedContractContent}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Copie o texto para seu editor e preencha os dados da sua obra e das partes envolvidas.
              </p>
            </ZeModal>
          )}

          {activeSubView === 'CHECKLIST' && (
            <>
              <ToolSubViewHeader
                title="Checklists da Obra"
                onBack={() => goToSubView('NONE')}
                onAdd={() => {
                  setEditChecklistData(null);
                  setNewChecklistName('');
                  setNewChecklistCategory('');
                  setNewChecklistItems(['']);
                  setShowAddChecklistModal(true);
                }}
              />
              <div className={cx(surface, card, "space-y-4")}>
                {checklists.length === 0 ? (
                  <p className={mutedText}>Nenhum checklist cadastrado ainda.</p>
                ) : (
                  checklists.map(checklist => (
                    <div key={checklist.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                      <h3 className="font-bold text-primary dark:text-white text-lg">{checklist.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Categoria: {checklist.category}</p>
                      <ul className="list-disc list-inside text-sm text-primary dark:text-white space-y-1">
                        {checklist.items.map(item => (
                          <li key={item.id} className={item.checked ? 'text-green-600 line-through' : ''}>
                            {item.text}
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-end gap-3 mt-4">
                        <button
                          onClick={() => {
                            setEditChecklistData(checklist);
                            setNewChecklistName(checklist.name);
                            setNewChecklistCategory(checklist.category);
                            setNewChecklistItems(checklist.items.map(item => item.text));
                            setShowAddChecklistModal(true);
                          }}
                          className="text-primary dark:text-white hover:text-secondary text-sm"
                        >
                          <i className="fa-solid fa-edit mr-1"></i> Editar
                        </button>
                        <button
                          onClick={() => setZeModal({
                            isOpen: true,
                            title: "Confirmar Exclusão",
                            message: `Tem certeza que deseja excluir o checklist "${checklist.name}"? Esta ação é irreversível.`,
                            confirmText: "Sim, Excluir",
                            onConfirm: async () => handleDeleteChecklist(checklist.id),
                            onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                            type: "DANGER"
                          })}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          <i className="fa-solid fa-trash-alt mr-1"></i> Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                )}
              </div>
            </>
          )}

          {/* ADD/EDIT CHECKLIST MODAL */}
          {showAddChecklistModal && (
            <ZeModal
              isOpen={showAddChecklistModal}
              title={editChecklistData ? "Editar Checklist" : "Adicionar Novo Checklist"}
              message=""
              confirmText={editChecklistData ? "Salvar Alterações" : "Adicionar Checklist"}
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
                  <label htmlFor="checklist-category" className="block text-sm font-bold text-primary dark:text-white mb-1">Categoria (Vincular à Etapa, opcional)</label>
                  <select
                    id="checklist-category"
                    value={newChecklistCategory}
                    onChange={(e) => setNewChecklistCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                  >
                    <option value="">Nenhuma</option>
                    {steps.map(step => ( // Use existing steps as categories
                      <option key={step.id} value={step.name}>{step.orderIndex}. {step.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-primary dark:text-white mb-1">Itens do Checklist</label>
                  {newChecklistItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updatedItems = [...newChecklistItems];
                          updatedItems[index] = e.target.value;
                          setNewChecklistItems(updatedItems);
                        }}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                        placeholder={`Item ${index + 1}`}
                        required
                      />
                      {newChecklistItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewChecklistItems(prev => prev.filter((_, i) => i !== index))}
                          className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <i className="fa-solid fa-trash-alt"></i>
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewChecklistItems(prev => [...prev, ''])}
                    className="w-full py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 mt-2"
                  >
                    <i className="fa-solid fa-plus"></i> Adicionar Item
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