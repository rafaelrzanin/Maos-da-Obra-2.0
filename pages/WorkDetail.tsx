


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx'; // Keep XLSX import, as reports might use it
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts';
import { StepStatus, FileCategory, ExpenseCategory, ExpenseStatus, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
import { ZeModal, type ZeModalProps } from '../components/ZeModal.tsx';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
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
      case StepStatus.NOT_STARTED:
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
    let isDelayed = false; // Local variable for material
    if (associatedStep) {
      const stepStartDate = new Date(associatedStep.startDate);
      stepStartDate.setHours(0, 0, 0, 0); // Normalize to start of day
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(today.getDate() + 3); // Current date + 3 days (inclusive)
      threeDaysFromNow.setHours(0, 0, 0, 0);

      isDelayed = (stepStartDate <= threeDaysFromNow && material.purchasedQty < material.plannedQty);
    }
    
    const isMaterialComplete = (material.purchasedQty >= material.plannedQty && material.plannedQty > 0);
    const isMaterialPartial = (material.purchasedQty > 0 && material.purchasedQty < material.plannedQty);
    const isMaterialPending = (material.purchasedQty === 0 || material.plannedQty === 0);

    if (isDelayed) {
      statusText = 'Atrasado';
      bgColor = 'bg-red-500';
      textColor = 'text-red-600 dark:text-red-400';
      borderColor = 'border-red-400 dark:border-red-700';
      shadowClass = 'shadow-red-500/20';
      icon = 'fa-exclamation-triangle';
    } else if (isMaterialComplete) {
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      textColor = 'text-green-600 dark:text-green-400';
      borderColor = 'border-green-400 dark:border-green-700';
      shadowClass = 'shadow-green-500/20';
      icon = 'fa-check';
    } else if (isMaterialPartial) {
      statusText = 'Parcial';
      bgColor = 'bg-amber-500';
      textColor = 'text-amber-600 dark:text-amber-400';
      borderColor = 'border-amber-400 dark:border-amber-700';
      shadowClass = 'shadow-amber-500/20';
      icon = 'fa-hourglass-half';
    } else if (isMaterialPending) { // Includes plannedQty === 0, which means nothing to buy
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
  const [newStepStartDate, setNewStepStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStepEndDate, setNewStepEndDate] = useState(new Date().toISOString().split('T')[0]);
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

  const loadWorkData = useCallback(async () => {
    if (!workId || !user?.id) {
      setLoading(false);
      navigate('/', { replace: true }); // Use replace: true for redirects
      return null; // Explicitly return null
    }

    setLoading(true);
    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        navigate('/', { replace: true }); // Use replace: true for redirects
        return null; // Explicitly return null
      }
      setWork(fetchedWork);

      const [fetchedSteps, fetchedExpenses, fetchedWorkers, fetchedSuppliers, fetchedPhotos, fetchedFiles, fetchedContracts, fetchedChecklists] = await Promise.all([
        dbService.getSteps(workId),
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
      return null; // Explicitly return null on error
    } finally {
      setLoading(false);
    }
    return null;
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

    let newStatus: StepStatus;
    let newRealDate: string | undefined = undefined; // Will be mapped to NULL in DB if undefined

    // 🔥 CRITICAL: Status is now fully derived from `realDate` and `start/end dates`.
    // The UI only sets `realDate` to affect the derived status.
    // The cycle should be: (NOT_STARTED / IN_PROGRESS / DELAYED) -> COMPLETED -> NOT_STARTED
    // If it's already COMPLETED, then it reverts to NOT_STARTED (and clears realDate).
    // If it's anything else, it goes to COMPLETED (and sets realDate).

    if (step.status === StepStatus.COMPLETED) {
        newStatus = StepStatus.NOT_STARTED; // Revert to NOT_STARTED
        newRealDate = undefined; // Clear realDate
        console.log(`[handleStepStatusChange] Status transition: COMPLETED -> NOT_STARTED for step ${step.id}. Clearing RealDate.`);
    } else {
        newStatus = StepStatus.COMPLETED; // Go to COMPLETED
        newRealDate = new Date().toISOString().split('T')[0]; // Set real completion date
        console.log(`[handleStepStatusChange] Status transition: ${step.status} -> COMPLETED for step ${step.id}. RealDate: ${newRealDate}.`);
    }
    
    try {
      const updatedStepData: Step = {
        ...step, // Spread all existing properties
        status: newStatus, // Frontend status is for visual feedback before refresh, actual is derived
        realDate: newRealDate, // Explicitly set new realDate (or undefined for null)
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
        realDate: undefined, // No realDate on creation
        estimatedDurationDays: Number(newEstimatedDurationDays) || undefined, // NEW
        // orderIndex is omitted here as dbService.addStep generates it
      });
      setShowAddStepModal(false);
      setNewStepName('');
      setNewStepStartDate(new Date().toISOString().split('T')[0]);
      setNewStepEndDate(new Date().toISOString().split('T')[0]);
      setNewEstimatedDurationDays(''); // NEW
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
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
            type: "WARNING"
        });
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
        ...editExpenseData, // Contém paidAmount e status derivados
        workId: workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount), // Direct conversion
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : Number(editExpenseData.amount), // Direct conversion
      });
      setEditExpenseData(null);
      setShowAddExpenseModal(false); // Close the modal
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
      setZeModal(prev => ({ ...prev, isOpen: false })); // Close the modal after successful deletion
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

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentExpenseData || !paymentAmount || !paymentDate) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addPaymentToExpense(
        paymentExpenseData.id,
        Number(paymentAmount), // Direct conversion
        paymentDate
      );
      setPaymentAmount('');
      setPaymentExpenseData(null);
      setShowAddPaymentModal(false);
      await loadWorkData();
    } catch (error: any) {
      console.error("Erro ao adicionar pagamento:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Pagamento",
        message: `Não foi possível adicionar o pagamento: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
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
        dailyRate: newWorkerDailyRate ? Number(newWorkerDailyRate) : undefined, // Direct conversion
        notes: newWorkerNotes,
      });
      setShowAddWorkerModal(false);
      setNewWorkerName(''); setNewWorkerRole(''); setNewWorkerPhone(''); setNewWorkerDailyRate(''); setNewWorkerNotes('');
      await loadWorkData();
    } catch (error: any) {
      console.error("Erro ao adicionar profissional:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Profissional",
        message: `Não foi possível adicionar o profissional: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
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
    if (!editWorkerData || !workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateWorker({
        ...editWorkerData,
        name: newWorkerName,
        role: newWorkerRole,
        phone: newWorkerPhone,
        dailyRate: newWorkerDailyRate ? Number(newWorkerDailyRate) : undefined, // Direct conversion
        notes: newWorkerNotes,
      });
      setEditWorkerData(null);
      setShowAddWorkerModal(false);
      await loadWorkData();
    } catch (error: any) {
      console.error("Erro ao editar profissional:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Profissional",
        message: `Não foi possível editar o profissional: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
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
      console.error("Erro ao deletar profissional:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Profissional",
        message: `Não foi possível deletar o profissional: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
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
        email: newSupplierEmail,
        address: newSupplierAddress,
        notes: newSupplierNotes,
      });
      setShowAddSupplierModal(false);
      setNewSupplierName(''); setNewSupplierCategory(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setNewSupplierAddress(''); setNewSupplierNotes('');
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
    if (!editSupplierData || !workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateSupplier({
        ...editSupplierData,
        name: newSupplierName,
        category: newSupplierCategory,
        phone: newSupplierPhone,
        email: newSupplierEmail,
        address: newSupplierAddress,
        notes: newSupplierNotes,
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

  const handleDeleteSupplier = async (supplierId: string) => {
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
    if (!workId || !newPhotoFile) return;

    setLoadingPhoto(true);
    setZeModal(prev => ({ ...prev, isConfirming: true }));

    try {
      const filePath = `${user?.id}/${workId}/photos/${Date.now()}-${newPhotoFile.name}`;
      const { data, error } = await supabase.storage.from('work_files').upload(filePath, newPhotoFile);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('work_files').getPublicUrl(filePath);

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

  const handleDeletePhoto = async (photoId: string, url: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // Extract file path from URL
      const pathSegments = url.split('/');
      const filePath = pathSegments.slice(pathSegments.indexOf('work_files') + 1).join('/');

      // Delete from storage
      const { error: storageError } = await supabase.storage.from('work_files').remove([filePath]);
      if (storageError) console.error("Erro ao deletar foto do storage:", storageError); // Log but don't block DB delete

      await dbService.deletePhoto(photoId);
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
    if (!workId || !newUploadFile) return;

    setLoadingFile(true);
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const fileExtension = newUploadFile.name.split('.').pop();
      const filePath = `${user?.id}/${workId}/files/${newFileName.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.${fileExtension}`;
      const { data, error } = await supabase.storage.from('work_files').upload(filePath, newUploadFile);

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('work_files').getPublicUrl(filePath);

      await dbService.addFile({
        workId: workId,
        name: newFileName,
        category: newFileCategory,
        url: publicUrlData.publicUrl,
        type: newUploadFile.type,
        date: new Date().toISOString().split('T')[0],
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

  const handleDeleteFile = async (fileId: string, url: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const pathSegments = url.split('/');
      const filePath = pathSegments.slice(pathSegments.indexOf('work_files') + 1).join('/');

      const { error: storageError } = await supabase.storage.from('work_files').remove([filePath]);
      if (storageError) console.error("Erro ao deletar arquivo do storage:", storageError);

      await dbService.deleteFile(fileId);
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
    if (!workId || !newChecklistName || !newChecklistCategory || newChecklistItems.every(item => item.trim() === '')) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const itemsToSave = newChecklistItems.filter(item => item.trim() !== '').map((item, index) => ({
        id: `item-${Date.now()}-${index}`,
        text: item,
        checked: false,
      }));

      await dbService.addChecklist({
        workId: workId,
        name: newChecklistName,
        category: newChecklistCategory,
        items: itemsToSave,
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
    if (!editChecklistData || !workId || !newChecklistName || !newChecklistCategory || newChecklistItems.every(item => item.trim() === '')) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const itemsToSave = newChecklistItems.filter(item => item.trim() !== '').map((item, index) => {
        // Try to keep existing item IDs if text matches, otherwise generate new
        const existingItem = editChecklistData.items.find(oldItem => oldItem.text === item);
        return {
          id: existingItem ? existingItem.id : `item-${Date.now()}-${index}`,
          text: item,
          checked: existingItem ? existingItem.checked : false, // Preserve checked status
        };
      });

      await dbService.updateChecklist({
        ...editChecklistData,
        name: newChecklistName,
        category: newChecklistCategory,
        items: itemsToSave,
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

  const handleToggleChecklistItem = async (checklistId: string, itemId: string) => {
    const checklistToUpdate = checklists.find(cl => cl.id === checklistId);
    if (!checklistToUpdate) return;

    const updatedItems = checklistToUpdate.items.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );

    try {
      await dbService.updateChecklist({
        ...checklistToUpdate,
        items: updatedItems,
      });
      await loadWorkData(); // Reload to reflect changes
    } catch (error: any) {
      console.error("Erro ao atualizar item do checklist:", error);
      setZeModal({
        isOpen: true,
        title: "Erro ao Atualizar Checklist",
        message: `Não foi possível atualizar o item do checklist: ${error.message || 'Erro desconhecido'}. Tente novamente.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    }
  };


  // =======================================================================
  // RENDER LOGIC
  // =======================================================================
  if (authLoading || !isUserAuthFinished || loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
    );
  }

  if (!work) { // Fallback if work is null after loading (e.g., deleted or not found)
    return (
      <div className="max-w-4xl mx-auto pb-12 pt-6 px-4 md:px-0 text-center">
        <h1 className="text-2xl font-bold text-red-500">Obra não encontrada!</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Redirecionando para o Dashboard...</p>
      </div>
    );
  }
  
  const isWorkFinished = work.status === WorkStatus.COMPLETED;

  // Tools Sub-Views
  const renderSubView = () => {
    switch (activeSubView) {
      case 'WORKERS':
        return (
          <>
            <ToolSubViewHeader title="Profissionais da Obra" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddWorkerModal(true)} />
            <div className="space-y-4">
              {workers.length === 0 ? (
                <div className={cx(surface, card, "text-center", mutedText)}>Nenhum profissional cadastrado.</div>
              ) : (
                workers.map(worker => (
                  <div key={worker.id} className={cx(surface, "flex items-center justify-between p-4 rounded-2xl")}>
                    <div>
                      <p className="font-bold text-primary dark:text-white">{worker.name} - {worker.role}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{worker.phone}</p>
                      {worker.dailyRate && <p className="text-xs text-secondary">{formatCurrency(worker.dailyRate)}/dia</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditWorkerData(worker); setShowAddWorkerModal(true); }} className="p-2 text-primary dark:text-white hover:text-secondary" aria-label={`Editar profissional ${worker.name}`}>
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir o profissional "${worker.name}"?`,
                        confirmText: "Sim, Excluir",
                        onConfirm: async () => handleDeleteWorker(worker.id, workId!),
                        onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                        type: "DANGER"
                      })} className="p-2 text-red-500 hover:text-red-700" aria-label={`Excluir profissional ${worker.name}`}>
                        <i className="fa-solid fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        );
      case 'SUPPLIERS':
        return (
          <>
            <ToolSubViewHeader title="Fornecedores da Obra" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddSupplierModal(true)} />
            <div className="space-y-4">
              {suppliers.length === 0 ? (
                <div className={cx(surface, card, "text-center", mutedText)}>Nenhum fornecedor cadastrado.</div>
              ) : (
                suppliers.map(supplier => (
                  <div key={supplier.id} className={cx(surface, "flex items-center justify-between p-4 rounded-2xl")}>
                    <div>
                      <p className="font-bold text-primary dark:text-white">{supplier.name} ({supplier.category})</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{supplier.phone}</p>
                      {supplier.email && <p className="text-xs text-slate-400">{supplier.email}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditSupplierData(supplier); setShowAddSupplierModal(true); }} className="p-2 text-primary dark:text-white hover:text-secondary" aria-label={`Editar fornecedor ${supplier.name}`}>
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir o fornecedor "${supplier.name}"?`,
                        confirmText: "Sim, Excluir",
                        onConfirm: async () => handleDeleteSupplier(supplier.id, workId!),
                        onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                        type: "DANGER"
                      })} className="p-2 text-red-500 hover:text-red-700" aria-label={`Excluir fornecedor ${supplier.name}`}>
                        <i className="fa-solid fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        );
      case 'PHOTOS':
        return (
          <>
            <ToolSubViewHeader title="Fotos da Obra" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddPhotoModal(true)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.length === 0 ? (
                <div className={cx(surface, card, "text-center col-span-full", mutedText)}>Nenhuma foto cadastrada.</div>
              ) : (
                photos.map(photo => (
                  <div key={photo.id} className={cx(surface, "rounded-2xl overflow-hidden")}>
                    <img src={photo.url} alt={photo.description} className="w-full h-48 object-cover" />
                    <div className="p-4">
                      <p className="font-bold text-primary dark:text-white text-sm">{photo.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateDisplay(photo.date)} - {photo.type}</p>
                      <button onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir esta foto (${photo.description})?`,
                        confirmText: "Sim, Excluir",
                        onConfirm: async () => handleDeletePhoto(photo.id, photo.url),
                        onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                        type: "DANGER"
                      })} className="mt-3 text-red-500 hover:text-red-700 text-xs font-bold" aria-label={`Excluir foto ${photo.description}`}>
                        <i className="fa-solid fa-trash-alt mr-1"></i> Excluir Foto
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        );
      case 'PROJECTS':
        return (
          <>
            <ToolSubViewHeader title="Projetos e Documentos" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddFileModal(true)} />
            <div className="space-y-4">
              {files.length === 0 ? (
                <div className={cx(surface, card, "text-center", mutedText)}>Nenhum arquivo cadastrado.</div>
              ) : (
                files.map(file => (
                  <div key={file.id} className={cx(surface, "flex items-center justify-between p-4 rounded-2xl")}>
                    <div>
                      <p className="font-bold text-primary dark:text-white">{file.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{file.category} - {formatDateDisplay(file.date)}</p>
                    </div>
                    <div className="flex gap-3">
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 text-secondary hover:text-orange-600" aria-label={`Abrir arquivo ${file.name}`}>
                        <i className="fa-solid fa-external-link-alt"></i>
                      </a>
                      <button onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir o arquivo "${file.name}"?`,
                        confirmText: "Sim, Excluir",
                        onConfirm: async () => handleDeleteFile(file.id, file.url),
                        onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                        type: "DANGER"
                      })} className="p-2 text-red-500 hover:text-red-700" aria-label={`Excluir arquivo ${file.name}`}>
                        <i className="fa-solid fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        );
      case 'CONTRACTS':
        return (
          <>
            <ToolSubViewHeader title="Gerador de Contratos" onBack={() => goToSubView('NONE')} />
            <p className={cx(mutedText, "mb-6")}>Selecione um modelo de contrato para gerar ou copiar.</p>
            <div className="space-y-4">
              {contracts.length === 0 ? (
                <div className={cx(surface, card, "text-center", mutedText)}>Nenhum modelo de contrato disponível.</div>
              ) : (
                contracts.map(contract => (
                  <div key={contract.id} className={cx(surface, "flex flex-col items-start p-4 rounded-2xl")}>
                    <h3 className="font-bold text-primary dark:text-white">{contract.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{contract.category}</p>
                    <button
                      onClick={() => {
                        setSelectedContractTitle(contract.title);
                        setSelectedContractContent(contract.contentTemplate);
                        setShowContractContentModal(true);
                      }}
                      className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-lg hover:bg-secondary-dark transition-colors"
                      aria-label={`Visualizar contrato ${contract.title}`}
                    >
                      <i className="fa-solid fa-file-contract mr-2"></i> Visualizar
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        );
      case 'CHECKLIST':
        return (
          <>
            <ToolSubViewHeader title="Checklists da Obra" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddChecklistModal(true)} />
            <div className="space-y-4">
              {checklists.length === 0 ? (
                <div className={cx(surface, card, "text-center", mutedText)}>Nenhum checklist cadastrado.</div>
              ) : (
                checklists.map(checklist => (
                  <div key={checklist.id} className={cx(surface, "flex flex-col items-start p-4 rounded-2xl")}>
                    <h3 className="font-bold text-primary dark:text-white">{checklist.name} ({checklist.category})</h3>
                    <ul className="list-none p-0 mt-3 w-full">
                      {checklist.items.map(item => (
                        <li key={item.id} className="flex items-center text-sm text-slate-600 dark:text-slate-300 mb-2">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleToggleChecklistItem(checklist.id, item.id)}
                            className="mr-2 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-secondary focus:ring-secondary/50"
                            aria-label={`Marcar item ${item.text} como ${item.checked ? 'não verificado' : 'verificado'}`}
                          />
                          <span className={item.checked ? 'line-through text-slate-400 dark:text-slate-500' : ''}>{item.text}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2 mt-4 self-end">
                      <button onClick={() => { setEditChecklistData(checklist); setNewChecklistName(checklist.name); setNewChecklistCategory(checklist.category); setNewChecklistItems(checklist.items.map(i => i.text)); setShowAddChecklistModal(true); }} className="p-2 text-primary dark:text-white hover:text-secondary" aria-label={`Editar checklist ${checklist.name}`}>
                        <i className="fa-solid fa-edit"></i>
                      </button>
                      <button onClick={() => setZeModal({
                        isOpen: true,
                        title: "Confirmar Exclusão",
                        message: `Tem certeza que deseja excluir o checklist "${checklist.name}"?`,
                        confirmText: "Sim, Excluir",
                        onConfirm: async () => handleDeleteChecklist(checklist.id),
                        onCancel: () => setZeModal(p => ({ ...p, isOpen: false })),
                        type: "DANGER"
                      })} className="p-2 text-red-500 hover:text-red-700" aria-label={`Excluir checklist ${checklist.name}`}>
                        <i className="fa-solid fa-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        );
      case 'AICHAT':
        // Navigate directly to the AI Chat page, which is a global tool
        // This is handled by the ToolCard's onClick, so this case won't be explicitly rendered
        return null; 
      case 'REPORTS':
        // Navigate directly to the ReportsView page, which is a global tool
        // This is handled by the ToolCard's onClick, so this case won't be explicitly rendered
        return null;
      case 'AIPLANNER':
        return null; // Handled by ToolCard and direct navigation

      case 'CALCULATORS':
        return (
          <>
            <ToolSubViewHeader title="Calculadoras" onBack={() => goToSubView('NONE')} />
            <div className={cx(surface, card, "text-center", mutedText)}>
              Funcionalidade em desenvolvimento!
            </div>
          </>
        );
      case 'NONE':
      default:
        // Main Tools Dashboard
        return (
          <>
            <h2 className="text-3xl font-black text-primary dark:text-white mb-6">Ferramentas Essenciais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <ToolCard
                icon="fa-users"
                title="Profissionais"
                description="Organize sua equipe e contatos."
                onClick={() => goToSubView('WORKERS')}
              />
              <ToolCard
                icon="fa-truck-field"
                title="Fornecedores"
                description="Cadastre e gerencie seus fornecedores."
                onClick={() => goToSubView('SUPPLIERS')}
              />
              <ToolCard
                icon="fa-camera"
                title="Galeria de Fotos"
                description="Documente o progresso da sua obra com fotos."
                onClick={() => goToSubView('PHOTOS')}
              />
              <ToolCard
                icon="fa-folder-open"
                title="Projetos e Documentos"
                description="Armazene plantas, orçamentos e arquivos importantes."
                onClick={() => goToSubView('PROJECTS')}
              />
              <ToolCard
                icon="fa-file-contract"
                title="Gerador de Contratos"
                description="Crie e personalize contratos de mão de obra e serviços."
                onClick={() => goToSubView('CONTRACTS')}
                isLocked={!isVitalicio}
                requiresVitalicio={true}
              />
              <ToolCard
                icon="fa-list-check"
                title="Checklists Inteligentes"
                description="Listas de verificação para garantir cada etapa."
                onClick={() => goToSubView('CHECKLIST')}
                isLocked={!isVitalicio}
                requiresVitalicio={true}
              />
              <ToolCard
                icon="fa-calculator"
                title="Calculadoras de Materiais"
                description="Estime quantidades de forma rápida e precisa."
                onClick={() => goToSubView('CALCULATORS')}
                isLocked={!isVitalicio}
                requiresVitalicio={true}
              />
              <ToolCard
                icon="fa-robot"
                title="Zé da Obra AI"
                description="Seu engenheiro virtual para dicas e conselhos."
                onClick={() => navigate('/ai-chat')}
                isLocked={!hasAiAccess}
                requiresVitalicio={true}
              />
              <ToolCard
                icon="fa-chart-line"
                title="Relatórios Completos"
                description="Visão detalhada de cronograma, materiais e financeiro."
                onClick={() => navigate(`/work/${workId}/reports`)}
                isLocked={!hasAiAccess}
                requiresVitalicio={true}
              />
              <ToolCard
                icon="fa-clipboard-list"
                title="Planejamento AI"
                description="Gere um plano de obra inteligente e análise de riscos."
                onClick={() => navigate(`/work/${workId}/ai-planner`)}
                isLocked={!hasAiAccess}
                requiresVitalicio={true}
              />
            </div>
          </>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-28 pt-4 px-2 font-sans">
      <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label="Voltar para o Dashboard"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">{work.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{work.address}</p>
        </div>
        {/* Placeholder para botão de edição da obra, se necessário */}
      </div>

      {zeModal.isOpen && <ZeModal {...zeModal} />}
      
      {/* Modals for Add/Edit Step */}
      {showAddStepModal && (
        <ZeModal
          isOpen={showAddStepModal}
          title={editStepData ? "Editar Etapa" : "Adicionar Nova Etapa"}
          message="" // Custom content will be rendered via children
          confirmText={editStepData ? "Salvar Alterações" : "Adicionar Etapa"}
          onConfirm={editStepData ? handleEditStep : handleAddStep}
          onCancel={() => { setShowAddStepModal(false); setEditStepData(null); setNewStepName(''); setNewStepStartDate(new Date().toISOString().split('T')[0]); setNewStepEndDate(new Date().toISOString().split('T')[0]); setNewEstimatedDurationDays(''); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="newStepName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome da Etapa</label>
              <input
                id="newStepName"
                type="text"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Fundações, Alvenaria"
                required
              />
            </div>
            <div>
              <label htmlFor="newEstimatedDurationDays" className="block text-xs font-bold text-slate-500 uppercase mb-1">Duração Estimada (dias)</label>
              <input
                id="newEstimatedDurationDays"
                type="number"
                value={newEstimatedDurationDays}
                onChange={(e) => setNewEstimatedDurationDays(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 10"
                min="1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="newStepStartDate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início</label>
                <input
                  id="newStepStartDate"
                  type="date"
                  value={newStepStartDate}
                  onChange={(e) => setNewStepStartDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                  required
                />
              </div>
              <div>
                <label htmlFor="newStepEndDate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Término</label>
                <input
                  id="newStepEndDate"
                  type="date"
                  value={newStepEndDate}
                  onChange={(e) => setNewStepEndDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                  required
                />
              </div>
            </div>
          </div>
        </ZeModal>
      )}

      {/* Modals for Add/Edit Material */}
      {showAddMaterialModal && (
        <ZeModal
          isOpen={showAddMaterialModal}
          title={editMaterialData ? "Editar Material" : "Adicionar Novo Material"}
          message=""
          confirmText={editMaterialData ? "Salvar Material" : "Adicionar Material"}
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
            setPurchaseQtyInput('');
            setPurchaseCostInput('');
          }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="newMaterialName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Material</label>
              <input
                id="newMaterialName"
                type="text"
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Cimento, Tijolo, Piso"
                required
              />
            </div>
            <div>
              <label htmlFor="newMaterialBrand" className="block text-xs font-bold text-slate-500 uppercase mb-1">Marca (Opcional)</label>
              <input
                id="newMaterialBrand"
                type="text"
                value={newMaterialBrand}
                onChange={(e) => setNewMaterialBrand(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Votorantim, Eliane"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="newMaterialPlannedQty" className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantidade Planejada</label>
                <input
                  id="newMaterialPlannedQty"
                  type="number"
                  value={newMaterialPlannedQty}
                  onChange={(e) => setNewMaterialPlannedQty(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                  placeholder="Ex: 50"
                  min="0"
                  required
                />
              </div>
              <div>
                <label htmlFor="newMaterialUnit" className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade de Medida</label>
                <input
                  id="newMaterialUnit"
                  type="text"
                  value={newMaterialUnit}
                  onChange={(e) => setNewMaterialUnit(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                  placeholder="Ex: sacos, m², un"
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="newMaterialCategory" className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria (Opcional)</label>
              <input
                id="newMaterialCategory"
                type="text"
                value={newMaterialCategory}
                onChange={(e) => setNewMaterialCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Fundações, Acabamento"
              />
            </div>
            <div>
              <label htmlFor="newMaterialStepId" className="block text-xs font-bold text-slate-500 uppercase mb-1">Relacionar à Etapa (Opcional)</label>
              <select
                id="newMaterialStepId"
                value={newMaterialStepId}
                onChange={(e) => setNewMaterialStepId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="none">Nenhuma</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.name}</option>
                ))}
              </select>
            </div>
            {editMaterialData && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-primary dark:text-white mb-4">Registrar Compra</h3>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Comprado: {editMaterialData.purchasedQty} {editMaterialData.unit} / Custo: {formatCurrency(editMaterialData.totalCost || 0)}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="purchaseQtyInput" className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantidade Comprada</label>
                    <input
                      id="purchaseQtyInput"
                      type="number"
                      value={purchaseQtyInput}
                      onChange={(e) => setPurchaseQtyInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                      placeholder="Ex: 10"
                      min="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="purchaseCostInput" className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Total da Compra (R$)</label>
                    <input
                      id="purchaseCostInput"
                      type="number"
                      value={purchaseCostInput}
                      onChange={(e) => setPurchaseCostInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                      placeholder="Ex: 250.50"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ZeModal>
      )}

      {/* Modals for Add/Edit Expense */}
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
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="newExpenseDescription" className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
              <input
                id="newExpenseDescription"
                type="text"
                value={newExpenseDescription}
                onChange={(e) => setNewExpenseDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Pagamento pedreiro, Compra de cimento"
                required
              />
            </div>
            <div>
              <label htmlFor="newExpenseAmount" className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor da Despesa (R$)</label>
              <input
                id="newExpenseAmount"
                type="number"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 500.00"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <label htmlFor="newExpenseTotalAgreed" className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Combinado (Opcional - se parcelado)</label>
              <input
                id="newExpenseTotalAgreed"
                type="number"
                value={newExpenseTotalAgreed}
                onChange={(e) => setNewExpenseTotalAgreed(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 1500.00 (se o valor total é diferente da primeira despesa)"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label htmlFor="newExpenseCategory" className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
              <select
                id="newExpenseCategory"
                value={newExpenseCategory}
                onChange={(e) => setNewExpenseCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              >
                {Object.values(ExpenseCategory).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="newExpenseDate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                id="newExpenseDate"
                type="date"
                value={newExpenseDate}
                onChange={(e) => setNewExpenseDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              />
            </div>
            <div>
              <label htmlFor="newExpenseStepId" className="block text-xs font-bold text-slate-500 uppercase mb-1">Relacionar à Etapa (Opcional)</label>
              <select
                id="newExpenseStepId"
                value={newExpenseStepId}
                onChange={(e) => setNewExpenseStepId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="none">Nenhuma</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="newExpenseWorkerId" className="block text-xs font-bold text-slate-500 uppercase mb-1">Relacionar a Profissional (Opcional)</label>
              <select
                id="newExpenseWorkerId"
                value={newExpenseWorkerId}
                onChange={(e) => setNewExpenseWorkerId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="none">Nenhum</option>
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>{worker.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="newExpenseSupplierId" className="block text-xs font-bold text-slate-500 uppercase mb-1">Relacionar a Fornecedor (Opcional)</label>
              <select
                id="newExpenseSupplierId"
                value={newExpenseSupplierId}
                onChange={(e) => setNewExpenseSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              >
                <option value="none">Nenhum</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
          </div>
        </ZeModal>
      )}

      {/* Modals for Add Payment to Expense */}
      {showAddPaymentModal && paymentExpenseData && (
        <ZeModal
          isOpen={showAddPaymentModal}
          title={`Adicionar Pagamento: ${paymentExpenseData.description}`}
          message=""
          confirmText="Adicionar Pagamento"
          onConfirm={handleAddPayment}
          onCancel={() => { setShowAddPaymentModal(false); setPaymentExpenseData(null); setPaymentAmount(''); setNewPaymentDate(new Date().toISOString().split('T')[0]); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Valor Total: {formatCurrency(paymentExpenseData.totalAgreed || paymentExpenseData.amount)}
              <br />
              Já Pago: {formatCurrency(paymentExpenseData.paidAmount || 0)}
              <br />
              A Pagar: {formatCurrency((paymentExpenseData.totalAgreed || paymentExpenseData.amount) - (paymentExpenseData.paidAmount || 0))}
            </p>
            <div>
              <label htmlFor="paymentAmount" className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor do Pagamento (R$)</label>
              <input
                id="paymentAmount"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 100.00"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <label htmlFor="paymentDate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Data do Pagamento</label>
              <input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setNewPaymentDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              />
            </div>
          </div>
        </ZeModal>
      )}

      {/* Modals for Add/Edit Worker */}
      {showAddWorkerModal && (
        <ZeModal
          isOpen={showAddWorkerModal}
          title={editWorkerData ? "Editar Profissional" : "Adicionar Novo Profissional"}
          message=""
          confirmText={editWorkerData ? "Salvar Alterações" : "Adicionar Profissional"}
          onConfirm={editWorkerData ? handleEditWorker : handleAddWorker}
          onCancel={() => {
            setShowAddWorkerModal(false);
            setEditWorkerData(null);
            setNewWorkerName(''); setNewWorkerRole(''); setNewWorkerPhone(''); setNewWorkerDailyRate(''); setNewWorkerNotes('');
          }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="newWorkerName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
              <input
                id="newWorkerName"
                type="text"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: João da Silva"
                required
              />
            </div>
            <div>
              <label htmlFor="newWorkerRole" className="block text-xs font-bold text-slate-500 uppercase mb-1">Função</label>
              <select
                id="newWorkerRole"
                value={newWorkerRole}
                onChange={(e) => setNewWorkerRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              >
                <option value="">Selecione</option>
                {STANDARD_JOB_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="newWorkerPhone" className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone / WhatsApp</label>
              <input
                id="newWorkerPhone"
                type="text"
                value={newWorkerPhone}
                onChange={(e) => setNewWorkerPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: (99) 99999-9999"
                required
              />
            </div>
            <div>
              <label htmlFor="newWorkerDailyRate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Diária (R$ - Opcional)</label>
              <input
                id="newWorkerDailyRate"
                type="number"
                value={newWorkerDailyRate}
                onChange={(e) => setNewWorkerDailyRate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: 150.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label htmlFor="newWorkerNotes" className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações (Opcional)</label>
              <textarea
                id="newWorkerNotes"
                value={newWorkerNotes}
                onChange={(e) => setNewWorkerNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Detalhes adicionais sobre o profissional"
                rows={3}
              ></textarea>
            </div>
          </div>
        </ZeModal>
      )}

      {/* Modals for Add/Edit Supplier */}
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
            setNewSupplierName(''); setNewSupplierCategory(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setNewSupplierAddress(''); setNewSupplierNotes('');
          }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="newSupplierName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Fornecedor</label>
              <input
                id="newSupplierName"
                type="text"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: Casa do Construtor, Madeireira XYZ"
                required
              />
            </div>
            <div>
              <label htmlFor="newSupplierCategory" className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
              <select
                id="newSupplierCategory"
                value={newSupplierCategory}
                onChange={(e) => setNewSupplierCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                required
              >
                <option value="">Selecione</option>
                {STANDARD_SUPPLIER_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="newSupplierPhone" className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone / WhatsApp</label>
              <input
                id="newSupplierPhone"
                type="text"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="Ex: (99) 99999-9999"
                required
              />
            </div>
            <div>
              <label htmlFor="newSupplierEmail" className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail (Opcional)</label>
              <input
                id="newSupplierEmail"
                type="email"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                placeholder="contato@fornecedor.com"
              />
            </div>
            <div>
              <label htmlFor="newSupplierAddress" className="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço (Opcional)</label>
              <input
                id="newSupplierAddress"
                type="