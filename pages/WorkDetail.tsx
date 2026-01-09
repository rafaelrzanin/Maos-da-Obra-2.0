

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
import { ZeModal, type ZeModalProps } from '../components/ZeModal.tsx';
// REMOVED: aiService import as Ze Assistant card is removed from here

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

// REMOVED: cleanMonetaryInput, formatMonetaryDisplay, formatMonetaryValueForDB
// Removed as per user request to simplify monetary input.

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
    const isActuallyDelayed = step.isDelayed; 

    if (step.status === StepStatus.COMPLETED) {
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      textColor = 'text-green-600 dark:text-green-400';
      borderColor = 'border-green-400 dark:border-green-700';
      shadowClass = 'shadow-green-500/20';
      icon = 'fa-check';
    } else if (step.status === StepStatus.IN_PROGRESS) {
      statusText = 'Em Andamento';
      bgColor = 'bg-amber-500';
      textColor = 'text-amber-600 dark:text-amber-400';
      borderColor = 'border-amber-400 dark:border-amber-700';
      shadowClass = 'shadow-amber-500/20';
      icon = 'fa-hourglass-half';
    } else { // StepStatus.NOT_STARTED
      statusText = 'Pendente';
      bgColor = 'bg-slate-400';
      textColor = 'text-slate-700 dark:text-slate-300';
      borderColor = 'border-slate-200 dark:border-slate-700';
      shadowClass = 'shadow-slate-400/20';
      icon = 'fa-hourglass-start';
    }

    // Override colors/shadows if actually delayed, but keep statusText pure
    if (isActuallyDelayed) {
      // The button/card visuals should still turn red for delayed items
      bgColor = 'bg-red-500';
      textColor = 'text-red-600 dark:text-red-400';
      borderColor = 'border-red-400 dark:border-red-700';
      shadowClass = 'shadow-red-500/20';
      icon = 'fa-exclamation-triangle'; // Delayed icon
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
    const expense = entity as Expense;
    const paidAmount = expense.paidAmount || 0;
    const totalAgreed = expense.totalAgreed !== undefined ? expense.totalAgreed : expense.amount; // Use totalAgreed or fallback to amount

    const isExpenseComplete = paidAmount >= totalAgreed && totalAgreed > 0;
    const isExpensePartial = paidAmount > 0 && paidAmount < totalAgreed;
    const isExpensePending = paidAmount === 0;
    const isExpenseOverpaid = paidAmount > totalAgreed && totalAgreed > 0; // Prejuízo: total pago > combinado (and combinado > 0)
    
    // If totalAgreed is 0 (or not set), it means it's a "free" or non-monetary expense from the start, consider complete if paid 0
    if (totalAgreed === 0 && paidAmount === 0) {
        statusText = 'Concluído'; // Treat as completed if 0 agreed and 0 paid
        bgColor = 'bg-green-500';
        textColor = 'text-green-600 dark:text-green-400';
        borderColor = 'border-green-400 dark:border-green-700';
        shadowClass = 'shadow-green-500/20';
        icon = 'fa-check';
    } else if (isExpenseOverpaid) {
      statusText = 'Prejuízo';
      bgColor = 'bg-red-500';
      textColor = 'text-red-600 dark:text-red-400';
      borderColor = 'border-red-400 dark:border-red-700';
      shadowClass = 'shadow-red-500/20';
      icon = 'fa-sack-xmark'; // Icon for overpayment/loss
    } else if (isExpenseComplete) {
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      textColor = 'text-green-600 dark:text-green-400';
      borderColor = 'border-green-400 dark:border-green-700';
      shadowClass = 'shadow-green-500/20';
      icon = 'fa-check';
    } else if (isExpensePartial) {
      statusText = 'Parcial';
      bgColor = 'bg-amber-500';
      textColor = 'text-amber-600 dark:text-amber-400';
      borderColor = 'border-amber-400 dark:border-amber-700';
      shadowClass = 'shadow-amber-500/20';
      icon = 'fa-hourglass-half';
    } else if (isExpensePending) {
      statusText = 'Pendente';
      bgColor = 'bg-slate-400';
      textColor = 'text-slate-700 dark:text-slate-300';
      borderColor = 'border-slate-200 dark:border-slate-700';
      shadowClass = 'shadow-slate-400/20';
      icon = 'fa-hourglass-start';
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

/** =========================
 * WorkDetail
 * ========================= */
const WorkDetail = () => {
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
  const [activeTab, setActiveTab] = useState<MainTab>('ETAPAS'); // Controlled by BottomNavBar or URL
  const [activeSubView, setActiveSubView] = useState<SubView>('NONE'); 
  
  // States for Material Filter
  const [materialFilterStepId, setMaterialFilterStepId] = useState('all');

  // New item states
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepStartDate, setNewStepStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStepEndDate, setNewStepEndDate] = useState(new Date().toISOString().split('T')[0]);
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
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(() => null); // Corrected useState syntax
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
    setActiveTab(tab);
    setActiveSubView('NONE'); 
    setMaterialFilterStepId('all'); 
    navigate(`/work/${workId}?tab=${tab}`, { replace: true }); // Update URL for consistent navigation
  }, [workId, navigate]);

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
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
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
          totalStepAmount: groups[step.id].reduce((sum, exp) => sum + exp.amount, 0),
        });
      }
    });

    // Add expenses not linked to any specific step (e.g., 'no_step')
    if (groups['no_step']) {
      expenseGroups.push({
        stepName: 'Sem Etapa Definida', // Label for expenses not linked to any step
        expenses: groups['no_step'].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        totalStepAmount: groups['no_step'].reduce((sum, exp) => sum + exp.amount, 0),
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
      return;
    }

    setLoading(true);
    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        navigate('/', { replace: true }); // Use replace: true for redirects
        return;
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

      // Recalculate isDelayed for fetched steps
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date to midnight

      const stepsWithCorrectedDelay = fetchedSteps.map(step => {
        let currentIsDelayed = false;
        const stepStartDate = new Date(step.startDate);
        stepStartDate.setHours(0, 0, 0, 0);
        const stepEndDate = new Date(step.endDate);
        stepEndDate.setHours(0, 0, 0, 0);

        if (step.status !== StepStatus.COMPLETED) {
            currentIsDelayed = today.getTime() > stepEndDate.getTime(); // Delayed if end date is past
        }
        return { ...step, isDelayed: currentIsDelayed };
      }).sort((a, b) => a.orderIndex - b.orderIndex); // Ensure sorted by orderIndex

      setSteps(stepsWithCorrectedDelay); // Use corrected steps

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
    } finally {
      setLoading(false);
    }
  }, [workId, user, navigate, refreshUser]);

  useEffect(() => {
    if (!authLoading && isUserAuthFinished) {
      loadWorkData();
      // Read initial tab from URL on first load
      const tabFromUrl = searchParams.get('tab') as MainTab;
      if (tabFromUrl && ['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'].includes(tabFromUrl)) {
        setActiveTab(tabFromUrl);
      }
    }
  }, [authLoading, isUserAuthFinished, loadWorkData, searchParams]);

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
    let newRealDate: string | undefined = undefined;
    let newIsDelayed: boolean = false; 

    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    const stepStartDate = new Date(step.startDate);
    stepStartDate.setHours(0, 0, 0, 0);
    const stepEndDate = new Date(step.endDate);
    stepEndDate.setHours(0, 0, 0, 0);

    switch (step.status) {
      case StepStatus.NOT_STARTED:
        newStatus = StepStatus.IN_PROGRESS;
        // A step going into IN_PROGRESS is delayed if its END date has already passed.
        newIsDelayed = today.getTime() > stepEndDate.getTime();
        console.log(`[handleStepStatusChange] Status transition: NOT_STARTED -> IN_PROGRESS for step ${step.id}. Recalculated newIsDelayed: ${newIsDelayed}.`);
        break;
      case StepStatus.IN_PROGRESS:
        newStatus = StepStatus.COMPLETED;
        newRealDate = new Date().toISOString().split('T')[0]; // Set real completion date
        newIsDelayed = false; // Completed steps are never delayed.
        console.log(`[handleStepStatusChange] Status transition: IN_PROGRESS -> COMPLETED for step ${step.id}. RealDate: ${newRealDate}. newIsDelayed: ${newIsDelayed}.`);
        break;
      case StepStatus.COMPLETED:
        newStatus = StepStatus.NOT_STARTED; // Reverts to NOT_STARTED
        newRealDate = undefined; // Clear realDate
        // A step reverting to NOT_STARTED is delayed if its START date has already passed.
        newIsDelayed = today.getTime() > stepStartDate.getTime();
        console.log(`[handleStepStatusChange] Status transition: COMPLETED -> NOT_STARTED for step ${step.id}. Clearing RealDate. Recalculated newIsDelayed: ${newIsDelayed}.`);
        break;
      default:
        newStatus = StepStatus.NOT_STARTED;
        newIsDelayed = today.getTime() > stepStartDate.getTime(); // Default to delayed if start date is past.
        console.warn(`[handleStepStatusChange] Unexpected status for step ${step.id}: ${step.status}. Defaulting to NOT_STARTED. Recalculated newIsDelayed: ${newIsDelayed}.`);
    }
    
    try {
      // Create a new Step object ensuring all properties are present and
      // status/realDate/isDelayed are explicitly updated.
      const updatedStepData: Step = {
        ...step, // Spread all existing properties
        status: newStatus, // Explicitly set the new status
        realDate: newRealDate, // Explicitly set the new realDate (or undefined to be converted to null in dbService)
        isDelayed: newIsDelayed // Explicitly set the new isDelayed state
      };

      const updatedStep = await dbService.updateStep(updatedStepData); // Pass the fully formed object
      console.log(`[handleStepStatusChange] dbService.updateStep successful for step ${step.id}. Updated Step Data:`, updatedStep);
      console.log(`[handleStepStatusChange] Data reloaded after status update for step ${step.id}.`);
      await loadWorkData();
    } catch (error) {
      console.error(`[handleStepStatusChange] Erro ao alterar status da etapa ${step.id}:`, error);
      setZeModal({
        isOpen: true,
        title: "Erro ao Atualizar Status",
        message: "Não foi possível atualizar o status da etapa. Tente novamente.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
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
      await dbService.addStep({
        workId: workId,
        name: newStepName,
        startDate: newStepStartDate,
        endDate: newStepEndDate,
        status: StepStatus.NOT_STARTED,
      });
      setShowAddStepModal(false);
      setNewStepName('');
      setNewStepStartDate(new Date().toISOString().split('T')[0]);
      setNewStepEndDate(new Date().toISOString().split('T')[0]);
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao adicionar etapa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Etapa",
        message: "Não foi possível adicionar a etapa. Tente novamente.",
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
      // isDelayed will be re-calculated in dbService.updateStep (backend logic for consistency)
      await dbService.updateStep({
        ...editStepData!,
        workId: workId,
      });
      setEditStepData(null);
      setShowAddStepModal(false); // Close the modal
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao editar etapa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Etapa",
        message: "Não foi possível editar a etapa. Tente novamente.",
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
      await dbService.deleteStep(stepId, workId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false })); // Close the modal after successful deletion
    } catch (error) {
      console.error("Erro ao deletar etapa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Etapa",
        message: "Não foi possível deletar a etapa. Tente novamente.",
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
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', stepId); // Required for Firefox
  };

  const handleDragOver = (e: React.DragEvent, stepId: string) => {
    e.preventDefault(); // Allow drop
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
      await Promise.all(updatedSteps.map(step => dbService.updateStep(step)));
      await loadWorkData(); // Refresh data to ensure consistency
    } catch (error) {
      console.error("Erro ao reordenar etapas:", error);
      setZeModal({
        isOpen: true,
        title: "Erro ao Reordenar Etapas",
        message: "Não foi possível reordenar as etapas. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao adicionar material:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Material",
        message: "Não foi possível adicionar o material. Tente novamente.",
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
      await dbService.updateMaterial({
        ...editMaterialData, // All original data
        name: newMaterialName,
        brand: newMaterialBrand,
        plannedQty: Number(newMaterialPlannedQty),
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
        // Keep original purchasedQty and totalCost here, dbService.registerMaterialPurchase will update them
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
    } catch (error) {
      console.error("Erro ao editar material ou registrar compra:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro na Operação",
        message: "Não foi possível completar a operação. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao deletar material:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Material",
        message: "Não foi possível deletar o material. Tente novamente.",
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
        // When adding a new expense, paidAmount is 0 by default, unless explicitly set
        paidAmount: 0, 
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
    } catch (error) {
      console.error("Erro ao adicionar despesa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Despesa",
        message: "Não foi possível adicionar a despesa. Tente novamente.",
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
        workId: workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount), // Direct conversion
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        // FIX: Add non-null assertion for editExpenseData.amount, as it's guaranteed by the 'if' guard
        totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : Number(editExpenseData.amount), // Direct conversion
      });
      setEditExpenseData(null);
      setShowAddExpenseModal(false); // Close the modal
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao editar despesa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Despesa",
        message: "Não foi possível editar a despesa. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao deletar despesa:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Despesa",
        message: "Não foi possível deletar a despesa. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao adicionar pagamento:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Pagamento",
        message: "Não foi possível adicionar o pagamento. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao adicionar profissional:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Profissional",
        message: "Não foi possível adicionar o profissional. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao editar profissional:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Profissional",
        message: "Não foi possível editar o profissional. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao deletar profissional:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Profissional",
        message: "Não foi possível deletar o profissional. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao adicionar fornecedor:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Fornecedor",
        message: "Não foi possível adicionar o fornecedor. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao editar fornecedor:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Fornecedor",
        message: "Não foi possível editar o fornecedor. Tente novamente.",
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
    } catch (error) {
      console.error("Erro ao deletar fornecedor:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Fornecedor",
        message: "Não foi possível deletar o fornecedor. Tente novamente.",
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
    try {
      // 1. Upload to Supabase Storage
      const fileExt = newPhotoFile.name.split('.').pop();
      const filePath = `${workId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work_media')
        .upload(filePath, newPhotoFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('work_media')
        .getPublicUrl(filePath);
      
      if (!publicUrlData?.publicUrl) throw new Error("Could not get public URL for the image.");

      // 3. Save photo record to database
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
      setZeModal({
        isOpen: true,
        title: "Erro ao Adicionar Foto",
        message: `Não foi possível adicionar a foto: ${error.message}.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    if (!workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // 1. Delete from Supabase Storage
      // The URL looks like: https://[project_id].supabase.co/storage/v1/object/public/work_media/workId/timestamp.ext
      const filePath = photoUrl.split('work_media/')[1]; // Extract path from URL: workId/timestamp.ext
      const { error: storageError } = await supabase.storage.from('work_media').remove([filePath]);
      if (storageError) {
        // If the storage object is not found (already deleted, etc.), don't block DB deletion
        if (storageError.statusCode === '404' || storageError.message.includes('not found')) {
            console.warn(`Storage object for photo ID ${photoId} not found or already deleted. Proceeding with DB deletion.`);
        } else {
            throw storageError;
        }
      }

      // 2. Delete record from database
      await dbService.deletePhoto(photoId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      console.error("Erro ao deletar foto:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Foto",
        message: `Não foi possível deletar a foto: ${error.message}.`,
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
    try {
      // 1. Upload to Supabase Storage
      const fileExt = newUploadFile.name.split('.').pop();
      const filePath = `${workId}/docs/${newFileName || newUploadFile.name}-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('work_files') // Assuming a separate bucket for files
        .upload(filePath, newUploadFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('work_files')
        .getPublicUrl(filePath);
      
      if (!publicUrlData?.publicUrl) throw new Error("Could not get public URL for the file.");

      // 3. Save file record to database
      await dbService.addFile({
        workId: workId,
        name: newFileName || newUploadFile.name,
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
      setZeModal({
        isOpen: true,
        title: "Erro ao Adicionar Arquivo",
        message: `Não foi possível adicionar o arquivo: ${error.message}.`,
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    } finally {
      setLoadingFile(false);
    }
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    if (!workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      // 1. Delete from Supabase Storage
      const filePath = fileUrl.split('work_files/')[1]; // Extract path from URL
      const { error: storageError } = await supabase.storage.from('work_files').remove([filePath]);
      if (storageError) {
          // If the storage object is not found (already deleted, etc.), don't block DB deletion
          if (storageError.statusCode === '404' || storageError.message.includes('not found')) {
              console.warn(`Storage object for file ID ${fileId} not found or already deleted. Proceeding with DB deletion.`);
          } else {
              throw storageError;
          }
      }

      // 2. Delete record from database
      await dbService.deleteFile(fileId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      console.error("Erro ao deletar arquivo:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Arquivo",
        message: `Não foi possível deletar o arquivo: ${error.message}.`,
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
    if (!workId || !newChecklistName || !newChecklistCategory) return;

    const itemsForDb = newChecklistItems.filter(item => item.trim() !== '').map((text, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      text: text.trim(),
      checked: false
    }));

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addChecklist({
        workId: workId,
        name: newChecklistName,
        category: newChecklistCategory,
        items: itemsForDb,
      });
      setShowAddChecklistModal(false);
      setNewChecklistName('');
      setNewChecklistCategory('');
      setNewChecklistItems(['']); // Reset to one empty item
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao adicionar checklist:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Checklist",
        message: "Não foi possível adicionar o checklist. Tente novamente.",
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
    if (!editChecklistData || !workId) return;

    const itemsForDb = newChecklistItems.filter(item => item.trim() !== '').map((text, idx) => {
      // Try to preserve existing item IDs if possible
      const existingItem = editChecklistData.items.find(item => item.text === text.trim());
      return {
        id: existingItem ? existingItem.id : `item-${Date.now()}-${idx}`,
        text: text.trim(),
        checked: existingItem ? existingItem.checked : false
      };
    });

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateChecklist({
        ...editChecklistData,
        name: newChecklistName,
        category: newChecklistCategory,
        items: itemsForDb,
      });
      setEditChecklistData(null);
      setShowAddChecklistModal(false);
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao editar checklist:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Checklist",
        message: "Não foi possível editar o checklist. Tente novamente.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleChecklistItemToggle = async (checklistId: string, itemId: string, checked: boolean) => {
    if (!workId) return;
    try {
      const checklistToUpdate = checklists.find(cl => cl.id === checklistId);
      if (!checklistToUpdate) return;

      const updatedItems = checklistToUpdate.items.map(item =>
        item.id === itemId ? { ...item, checked: checked } : item
      );

      await dbService.updateChecklist({ ...checklistToUpdate, items: updatedItems });
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao atualizar item do checklist:", error);
      setZeModal({
        isOpen: true,
        title: "Erro ao Atualizar Item",
        message: "Não foi possível atualizar o item do checklist. Tente novamente.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteChecklist(checklistId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error("Erro ao deletar checklist:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Checklist",
        message: "Não foi possível deletar o checklist. Tente novamente.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };


  // =======================================================================
  // UI RENDERING
  // =======================================================================

  if (loading || authLoading || !isUserAuthFinished || !work) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
        <p className="mt-4 text-lg">Carregando dados da obra...</p>
      </div>
    );
  }

  const renderMainContent = () => {
    switch (activeTab) {
      case 'ETAPAS':
        return (
          <>
            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
              <h2 className="text-2xl font-black text-primary dark:text-white">Cronograma</h2>
              <button
                onClick={() => {
                    setEditStepData(null); // Ensure add mode
                    setNewStepName('');
                    setNewStepStartDate(new Date().toISOString().split('T')[0]);
                    setNewStepEndDate(new Date().toISOString().split('T')[0]);
                    setShowAddStepModal(true);
                }}
                className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                aria-label="Adicionar nova etapa"
              >
                <i className="fa-solid fa-plus"></i> Nova Etapa
              </button>
            </div>
            
            {steps.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhuma etapa cadastrada ainda.</p>
                    <button onClick={() => {
                        setEditStepData(null); // Ensure add mode
                        setNewStepName('');
                        setNewStepStartDate(new Date().toISOString().split('T')[0]);
                        setNewStepEndDate(new Date().toISOString().split('T')[0]);
                        setShowAddStepModal(true);
                    }} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar sua primeira etapa
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {steps.map((step) => {
                        const statusDetails = getEntityStatusDetails('step', step, steps);
                        
                        return (
                            <div
                                key={step.id}
                                className={cx(
                                    surface,
                                    `p-4 rounded-2xl flex items-center gap-4 transition-all hover:scale-[1.005] border-2 ${statusDetails.borderColor} shadow-lg ${statusDetails.shadowClass}`, // Apply dynamic border and shadow
                                    draggedStepId === step.id && "opacity-50",
                                    dragOverStepId === step.id && "ring-2 ring-secondary/50", // Highlight drag target with a ring
                                )}
                                draggable
                                onDragStart={(e) => handleDragStart(e, step.id)}
                                onDragOver={(e) => handleDragOver(e, step.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, step.id)}
                                onClick={() => { 
                                    setNewStepName(step.name);
                                    setNewStepStartDate(step.startDate);
                                    setNewStepEndDate(step.endDate);
                                    setEditStepData(step); 
                                    setShowAddStepModal(true); 
                                }} // Open edit modal on card click
                                role="listitem"
                                aria-label={`Etapa ${step.orderIndex}. ${step.name}, status: ${statusDetails.statusText}`}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleStepStatusChange(step); }} // Prevent card click
                                    disabled={isUpdatingStepStatus} // NEW: Disable button while updating
                                    className={cx(
                                        "w-10 h-10 rounded-full text-white flex items-center justify-center text-lg font-bold transition-colors shrink-0",
                                        statusDetails.bgColor, // This will be red if isDelayed is true
                                        isUpdatingStepStatus ? 'opacity-70 cursor-not-allowed' : ''
                                    )}
                                    aria-label={`Mudar status da etapa ${step.name}`}
                                >
                                    {isUpdatingStepStatus ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${statusDetails.icon}`}></i>}
                                </button>
                                <div className="flex-1">
                                    <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">
                                        Etapa {step.orderIndex} 
                                        {step.isDelayed && (
                                            <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-wider">
                                                Atrasada <i className="fa-solid fa-exclamation-triangle ml-1"></i>
                                            </span>
                                        )}
                                        <span className={statusDetails.textColor}> ({statusDetails.statusText})</span>
                                    </p>
                                    <h3 className="text-lg font-bold text-primary dark:text-white leading-tight">{step.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}
                                        {/* REMOVED: {step.realDate && <span className="ml-2 text-green-600 dark:text-green-400">(Concluído em: {formatDateDisplay(step.realDate)})</span>} */}
                                    </p>
                                </div>
                                <div className="text-right text-sm flex flex-col items-center gap-2">
                                    <p className="font-bold text-primary dark:text-white">{calculateStepProgress(step.id).toFixed(0)}%</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Progresso Materiais</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); 
                                            setZeModal({
                                                isOpen: true,
                                                title: "Excluir Etapa",
                                                message: `Tem certeza que deseja excluir a etapa ${step.name}?`,
                                                confirmText: "Excluir",
                                                onConfirm: async () => handleDeleteStep(step.id),
                                                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                                type: "DANGER"
                                            });
                                        }}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                        aria-label={`Excluir etapa ${step.name}`}
                                    >
                                        <i className="fa-solid fa-trash-alt text-lg"></i>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
          </>
        );

      case 'MATERIAIS':
        return (
          <>
            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
              <h2 className="text-2xl font-black text-primary dark:text-white">Materiais</h2>
              <button
                onClick={() => {
                  setEditMaterialData(null); // Ensure add mode
                  setNewMaterialName('');
                  setNewMaterialBrand(''); // Clear brand for new material
                  setNewMaterialPlannedQty('');
                  setNewMaterialUnit('');
                  setNewMaterialCategory('');
                  setNewMaterialStepId('');
                  setPurchaseQtyInput(''); // Clear temporary purchase inputs
                  setPurchaseCostInput(''); // Clear temporary purchase inputs
                  setShowAddMaterialModal(true);
                }}
                className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                aria-label="Adicionar novo material"
              >
                <i className="fa-solid fa-plus"></i> Novo Material
              </button>
            </div>
            {materials.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhuma material cadastrado ainda.</p>
                    <button onClick={() => {
                      setEditMaterialData(null); 
                      setNewMaterialName('');
                      setNewMaterialBrand('');
                      setNewMaterialPlannedQty('');
                      setNewMaterialUnit('');
                      setNewMaterialCategory('');
                      setNewMaterialStepId('');
                      setPurchaseQtyInput(''); // Clear temporary purchase inputs
                      setPurchaseCostInput(''); // Clear temporary purchase inputs
                      setShowAddMaterialModal(true);
                    }} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar seu primeiro material
                    </button>
                </div>
            ) : (
              <>
                <div className="mb-6 px-2 sm:px-0">
                  <label htmlFor="material-step-filter" className="sr-only">Filtrar por etapa</label>
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

                <div className="space-y-6">
                  {groupedMaterials.map(group => (
                    <div key={group.stepId}>
                      <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 mb-3 px-2 sm:px-0">{group.stepName}</h3>
                      <div className="space-y-4">
                        {group.materials.map(material => {
                           const statusDetails = getEntityStatusDetails('material', material, steps);
                           const progress = material.plannedQty > 0 ? (material.purchasedQty / material.plannedQty) * 100 : 0;

                           return (
                            <div 
                              key={material.id} 
                              onClick={() => { 
                                setNewMaterialName(material.name);
                                setNewMaterialBrand(material.brand || ''); // NEW: Pre-populate brand
                                setNewMaterialPlannedQty(String(material.plannedQty)); // Convert to string for input
                                setNewMaterialUnit(material.unit);
                                setNewMaterialCategory(material.category || '');
                                setNewMaterialStepId(material.stepId || 'none');
                                setEditMaterialData(material); 
                                setPurchaseQtyInput(''); // Clear temporary purchase inputs
                                setPurchaseCostInput(''); // Clear temporary purchase inputs
                                setShowAddMaterialModal(true); 
                              }} 
                              className={cx(
                                surface, 
                                `p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer hover:scale-[1.005] transition-transform border-2 ${statusDetails.borderColor} shadow-lg ${statusDetails.shadowClass}`
                              )} 
                              aria-label={`Material ${material.name}`}
                            >
                                <div className="flex-1 text-left w-full sm:w-auto">
                                    <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">Material <span className={statusDetails.textColor}>({statusDetails.statusText})</span></p>
                                    <h4 className="font-bold text-primary dark:text-white text-lg">{material.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{material.brand || 'Marca não informada'}</p>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                                        <div className="h-full bg-secondary rounded-full" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {progress.toFixed(0)}% Comprado
                                    </p>
                                </div>
                                <div className="text-center sm:text-right w-full sm:w-auto flex flex-col items-end gap-1">
                                    <p className="text-sm text-slate-700 dark:text-slate-300">Sugerido: <span className="font-bold">{material.plannedQty} {material.unit}</span></p>
                                    <p className="text-sm text-green-600 dark:text-green-400 font-bold">Comprado: {material.purchasedQty} {material.unit}</p>
                                    {material.totalCost !== undefined && <p className="text-xs text-slate-500 dark:text-slate-400">Custo Total: {formatCurrency(material.totalCost)}</p>}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); 
                                            setZeModal({
                                                isOpen: true,
                                                title: "Excluir Material",
                                                message: `Tem certeza que deseja excluir o material ${material.name}? Isso também excluirá despesas relacionadas.`,
                                                confirmText: "Excluir",
                                                onConfirm: async () => handleDeleteMaterial(material.id),
                                                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                                type: "DANGER"
                                            });
                                        }}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                        aria-label={`Excluir material ${material.name}`}
                                    >
                                        <i className="fa-solid fa-trash-alt text-lg"></i>
                                    </button>
                                </div>
                            </div>
                           );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        );

      case 'FINANCEIRO':
        const totalPaid = expenses.reduce((sum, exp) => sum + (exp.paidAmount || 0), 0);
        const totalOutstanding = calculateTotalExpenses - totalPaid;

        return (
          <>
            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
              <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
              <button
                onClick={() => {
                  setEditExpenseData(null); // Ensure add mode
                  setNewExpenseDescription('');
                  setNewExpenseAmount('');
                  setNewExpenseCategory(ExpenseCategory.OTHER);
                  setNewExpenseDate(new Date().toISOString().split('T')[0]);
                  setNewExpenseStepId('');
                  setNewExpenseWorkerId('');
                  setNewExpenseSupplierId('');
                  setNewExpenseTotalAgreed('');
                  setShowAddExpenseModal(true);
                }}
                className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                aria-label="Adicionar nova despesa"
              >
                <i className="fa-solid fa-plus"></i> Nova Despesa
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Orçamento Planejado</p>
                <h3 className="text-xl font-bold text-primary dark:text-white">{formatCurrency(work.budgetPlanned)}</h3>
              </div>
              <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Gasto Total</p>
                <h3 className={`text-xl font-bold ${calculateTotalExpenses > work.budgetPlanned ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(calculateTotalExpenses)}</h3>
              </div>
              <div className={cx(surface, "p-5 rounded-2xl flex flex-col items-start")}>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Balanço</p>
                <h3 className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-amber-500' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(work.budgetPlanned - calculateTotalExpenses)}</h3>
              </div>
            </div>

            {expenses.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhuma despesa cadastrada ainda.</p>
                    <button onClick={() => {
                      setEditExpenseData(null); // Ensure add mode
                      setNewExpenseDescription('');
                      setNewExpenseAmount('');
                      setNewExpenseCategory(ExpenseCategory.OTHER);
                      setNewExpenseDate(new Date().toISOString().split('T')[0]);
                      setNewExpenseStepId('');
                      setNewExpenseWorkerId('');
                      setNewExpenseSupplierId('');
                      setNewExpenseTotalAgreed('');
                      setShowAddExpenseModal(true);
                    }} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar sua primeira despesa
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedExpensesByStep.map((group, groupIndex) => (
                        <div key={groupIndex}>
                            <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 mb-3 px-2 sm:px-0 flex justify-between items-center">
                                {group.stepName}
                                <span className="text-base font-black text-primary dark:text-white">{formatCurrency(group.totalStepAmount)}</span>
                            </h3>
                            <div className="space-y-4">
                                {group.expenses.map(expense => {
                                    const statusDetails = getEntityStatusDetails('expense', expense, steps); // steps not directly used here, but for consistency
                                    const valorCombinado = expense.totalAgreed !== undefined ? expense.totalAgreed : expense.amount;
                                    const valorPago = expense.paidAmount || 0;
                                    const valorRestante = valorCombinado - valorPago;
                                    const progressPercent = valorCombinado > 0 ? (valorPago / valorCombinado) * 100 : 0;

                                    return (
                                        <div 
                                          key={expense.id} 
                                          onClick={() => { 
                                            setNewExpenseDescription(expense.description);
                                            setNewExpenseAmount(String(expense.amount)); // Convert to string for input
                                            setNewExpenseCategory(expense.category);
                                            setNewExpenseDate(expense.date);
                                            setNewExpenseStepId(expense.stepId || 'none');
                                            setNewExpenseWorkerId(expense.workerId || 'none');
                                            setNewExpenseSupplierId(expense.supplierId || 'none');
                                            setNewExpenseTotalAgreed(String(expense.totalAgreed !== undefined ? expense.totalAgreed : expense.amount)); // Set editable totalAgreed
                                            setEditExpenseData(expense); 
                                            setShowAddExpenseModal(true); 
                                          }} 
                                          className={cx(
                                            surface, 
                                            `p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer hover:scale-[1.005] transition-transform border-2 ${statusDetails.borderColor} shadow-lg ${statusDetails.shadowClass}`
                                          )} 
                                          aria-label={`Despesa ${expense.description}`}
                                        >
                                            <div className="flex-1 text-left w-full sm:w-auto">
                                                <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">Despesa <span className={statusDetails.textColor}>({statusDetails.statusText})</span></p>
                                                <h4 className="font-bold text-primary dark:text-white text-lg">{expense.description}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateDisplay(expense.date)} - {expense.category}</p>
                                                {expense.workerId && <p className="text-xs text-slate-500 dark:text-slate-400">Profissional: {workers.find(w => w.id === expense.workerId)?.name}</p>}
                                                {expense.supplierId && <p className="text-xs text-slate-500 dark:text-slate-400">Fornecedor: {suppliers.find(s => s.id === expense.supplierId)?.name}</p>}
                                            </div>
                                            <div className="text-center sm:text-right w-full sm:w-auto flex flex-col items-end gap-1">
                                                <p className="text-sm text-slate-700 dark:text-slate-300">Combinado: <span className="font-bold">{formatCurrency(valorCombinado)}</span></p>
                                                <p className={cx("text-sm font-bold", statusDetails.textColor)}>Pago: {formatCurrency(valorPago)}</p>
                                                {valorRestante > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Restante: {formatCurrency(valorRestante)}</p>}
                                                
                                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                                                    <div className="h-full bg-secondary rounded-full" style={{ width: `${progressPercent}%` }}></div>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    {progressPercent.toFixed(0)}% Pago
                                                </p>

                                                {statusDetails.statusText !== 'Concluído' && statusDetails.statusText !== 'Prejuízo' && (
                                                    <button onClick={(e) => { e.stopPropagation(); setPaymentExpenseData(expense); setShowAddPaymentModal(true); }} className="text-xs text-secondary hover:underline" aria-label={`Adicionar pagamento para despesa ${expense.description}`}>
                                                        Pagar {formatCurrency(valorRestante)}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); 
                                                        setZeModal({
                                                            isOpen: true,
                                                            title: "Excluir Despesa",
                                                            message: `Tem certeza que deseja excluir a despesa ${expense.description}?`,
                                                            confirmText: "Excluir",
                                                            onConfirm: async () => handleDeleteExpense(expense.id),
                                                            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                                            type: "DANGER"
                                                        });
                                                    }}
                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                    aria-label={`Excluir despesa ${expense.description}`}
                                                >
                                                    <i className="fa-solid fa-trash-alt text-lg"></i>
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
          </>
        );

      case 'FERRAMENTAS':
        return renderToolsSubView();

      default:
        return null;
    }
  };

  const renderToolsSubView = () => {
    switch (activeSubView) {
      case 'NONE':
        return (
          <>
            <h2 className="text-2xl font-black text-primary dark:text-white mb-6 px-2 sm:px-0">Ferramentas de Gestão</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ToolCard icon="fa-users-gear" title="Profissionais" description="Gerencie sua equipe e mão de obra." onClick={() => goToSubView('WORKERS')} />
              <ToolCard icon="fa-truck-field" title="Fornecedores" description="Organize seus contatos e orçamentos de materiais." onClick={() => goToSubView('SUPPLIERS')} />
              <ToolCard icon="fa-images" title="Fotos da Obra" description="Documente o progresso com fotos e vídeos." onClick={() => goToSubView('PHOTOS')} />
              <ToolCard icon="fa-file-lines" title="Projetos e Docs" description="Guarde plantas, licenças e outros documentos." onClick={() => goToSubView('PROJECTS')} />
              
              {/* Vitalício Bonus Tools */}
              <ToolCard icon="fa-calculator" title="Calculadoras" description="Ferramentas para cálculo de materiais, mão de obra, etc." 
                onClick={() => setZeModal({
                    isOpen: true,
                    title: "Calculadoras em Desenvolvimento",
                    message: "As calculadoras estão sendo desenvolvidas. Fique ligado!",
                    confirmText: "Entendido",
                    onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                    // Removed onConfirm: showAccessModal as it was a boolean assignment error.
                    // The ZeModal component's internal logic handles "Entendido" as closing the modal
                    // if onConfirm is the default no-op function or explicitly onCancel.
                })} 
                isLocked={!isVitalicio} // Only Vitalicio users can access
                requiresVitalicio={true}
              />
              <ToolCard
                icon="fa-file-contract"
                title="Gerador de Contratos"
                description="Crie contratos de mão de obra e serviços em segundos, de forma profissional."
                onClick={() => goToSubView('CONTRACTS')}
                isLocked={!isVitalicio} // Only Vitalicio users can access
                requiresVitalicio={true}
              />
              <ToolCard
                icon="fa-list-check"
                title="Checklists"
                description="Listas de verificação para cada etapa da obra, garantindo que nada seja esquecido."
                onClick={() => goToSubView('CHECKLIST')}
                isLocked={!isVitalicio} // Only Vitalicio users can access
                requiresVitalicio={true}
              />
              <ToolCard
                icon="fa-robot"
                title="Planejamento Inteligente AI"
                description="Gere planos, riscos e sugestões de materiais com IA."
                onClick={() => navigate(`/work/${workId}/ai-planner`)}
                isLocked={!hasAiAccess} // AI access (Vitalicio or trial)
                requiresVitalicio={true} // Marketing for Vitalicio
              />
              <ToolCard
                icon="fa-chart-line"
                title="Relatórios Completos"
                description="Analise o desempenho financeiro e de cronograma com relatórios detalhados."
                onClick={() => navigate(`/work/${workId}/reports`)}
                isLocked={!isVitalicio} // Only Vitalicio users can access
                requiresVitalicio={true}
              />
            </div>
          </>
        );

      case 'WORKERS':
        return (
          <>
            <ToolSubViewHeader title="Profissionais" onBack={() => goToSubView('NONE')} onAdd={() => {
              setEditWorkerData(null);
              setNewWorkerName(''); setNewWorkerRole(''); setNewWorkerPhone(''); setNewWorkerDailyRate(''); setNewWorkerNotes('');
              setShowAddWorkerModal(true);
            }} />
            {workers.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhum profissional cadastrado ainda.</p>
                    <button onClick={() => {
                      setEditWorkerData(null); 
                      setNewWorkerName(''); setNewWorkerRole(''); setNewWorkerPhone(''); setNewWorkerDailyRate(''); setNewWorkerNotes('');
                      setShowAddWorkerModal(true);
                    }} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar seu primeiro profissional
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {workers.map(worker => (
                        <div 
                            key={worker.id} 
                            onClick={() => {
                                setNewWorkerName(worker.name);
                                setNewWorkerRole(worker.role);
                                setNewWorkerPhone(worker.phone);
                                setNewWorkerDailyRate(String(worker.dailyRate || '')); // Convert to string for input
                                setNewWorkerNotes(worker.notes || '');
                                setEditWorkerData(worker); 
                                setShowAddWorkerModal(true);
                            }}
                            className={cx(surface, "p-4 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.005] transition-transform")}
                            aria-label={`Profissional ${worker.name}, função: ${worker.role}`}
                        >
                            <div className="flex-1">
                                <h3 className="font-bold text-primary dark:text-white text-lg">{worker.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{worker.role} - {worker.phone}</p>
                                {worker.dailyRate !== undefined && worker.dailyRate > 0 && <p className="text-xs text-secondary">Diária: {formatCurrency(worker.dailyRate)}</p>}
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); 
                                    setZeModal({
                                        isOpen: true,
                                        title: "Excluir Profissional",
                                        message: `Tem certeza que deseja excluir o profissional ${worker.name}?`,
                                        confirmText: "Excluir",
                                        onConfirm: async () => handleDeleteWorker(worker.id),
                                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                        type: "DANGER"
                                    });
                                }}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1 shrink-0"
                                aria-label={`Excluir profissional ${worker.name}`}
                            >
                                <i className="fa-solid fa-trash-alt text-lg"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </>
        );

      case 'SUPPLIERS':
        return (
          <>
            <ToolSubViewHeader title="Fornecedores" onBack={() => goToSubView('NONE')} onAdd={() => {
              setEditSupplierData(null);
              setNewSupplierName(''); setNewSupplierCategory(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setNewSupplierAddress(''); setNewSupplierNotes('');
              setShowAddSupplierModal(true);
            }} />
            {suppliers.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhum fornecedor cadastrado ainda.</p>
                    <button onClick={() => {
                      setEditSupplierData(null);
                      setNewSupplierName(''); setNewSupplierCategory(''); setNewSupplierPhone(''); setNewSupplierEmail(''); setNewSupplierAddress(''); setNewSupplierNotes('');
                      setShowAddSupplierModal(true);
                    }} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar seu primeiro fornecedor
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {suppliers.map(supplier => (
                        <div 
                            key={supplier.id} 
                            onClick={() => {
                                setNewSupplierName(supplier.name);
                                setNewSupplierCategory(supplier.category);
                                setNewSupplierPhone(supplier.phone);
                                setNewSupplierEmail(supplier.email || '');
                                setNewSupplierAddress(supplier.address || '');
                                setNewSupplierNotes(supplier.notes || '');
                                setEditSupplierData(supplier); 
                                setShowAddSupplierModal(true);
                            }}
                            className={cx(surface, "p-4 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.005] transition-transform")}
                            aria-label={`Fornecedor ${supplier.name}, categoria: ${supplier.category}`}
                        >
                            <div className="flex-1">
                                <h3 className="font-bold text-primary dark:text-white text-lg">{supplier.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{supplier.category} - {supplier.phone}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); 
                                    setZeModal({
                                        isOpen: true,
                                        title: "Excluir Fornecedor",
                                        message: `Tem certeza que deseja excluir o fornecedor ${supplier.name}?`,
                                        confirmText: "Excluir",
                                        onConfirm: async () => handleDeleteSupplier(supplier.id),
                                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                        type: "DANGER"
                                    });
                                }}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1 shrink-0"
                                aria-label={`Excluir fornecedor ${supplier.name}`}
                            >
                                <i className="fa-solid fa-trash-alt text-lg"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </>
        );

      case 'PHOTOS':
        return (
          <>
            <ToolSubViewHeader title="Fotos da Obra" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddPhotoModal(true)} />
            {photos.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhuma foto cadastrada ainda.</p>
                    <button onClick={() => setShowAddPhotoModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar sua primeira foto
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map(photo => (
                        <div key={photo.id} className={cx(surface, "rounded-2xl overflow-hidden shadow-lg group relative")}>
                            <img src={photo.url} alt={photo.description} className="w-full h-48 object-cover transition-transform group-hover:scale-105" />
                            <div className="p-4">
                                <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">{photo.type}</p>
                                <h3 className="font-bold text-primary dark:text-white text-lg leading-tight">{photo.description}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatDateDisplay(photo.date)}</p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); 
                                    setZeModal({
                                        isOpen: true,
                                        title: "Excluir Foto",
                                        message: `Tem certeza que deseja excluir esta foto?`,
                                        confirmText: "Excluir",
                                        onConfirm: async () => handleDeletePhoto(photo.id, photo.url),
                                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                        type: "DANGER"
                                    });
                                }}
                                className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Excluir foto"
                            >
                                <i className="fa-solid fa-trash-alt text-sm"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </>
        );

      case 'PROJECTS':
        return (
          <>
            <ToolSubViewHeader title="Projetos e Documentos" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddFileModal(true)} />
            {files.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhum documento cadastrado ainda.</p>
                    <button onClick={() => setShowAddFileModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar seu primeiro documento
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {files.map(file => (
                        <div key={file.id} className={cx(surface, "p-4 rounded-2xl flex items-center justify-between gap-4")}>
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center gap-4 group cursor-pointer" aria-label={`Abrir arquivo ${file.name}`}>
                                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-lg shrink-0 group-hover:bg-primary/20 transition-colors">
                                    <i className="fa-solid fa-file"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-primary dark:text-white text-lg leading-tight group-hover:text-secondary transition-colors">{file.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{file.category} - {formatDateDisplay(file.date)}</p>
                                </div>
                            </a>
                            <button
                                onClick={(e) => { e.stopPropagation(); 
                                    setZeModal({
                                        isOpen: true,
                                        title: "Excluir Documento",
                                        message: `Tem certeza que deseja excluir o documento "${file.name}"?`,
                                        confirmText: "Excluir",
                                        onConfirm: async () => handleDeleteFile(file.id, file.url),
                                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                        type: "DANGER"
                                    });
                                }}
                                className="text-slate-400 hover:text-red-500 transition-colors p-1 shrink-0"
                                aria-label={`Excluir documento ${file.name}`}
                            >
                                <i className="fa-solid fa-trash-alt text-lg"></i>
                            </button>
                        </div>
                    ))}
                </div>
            )}
          </>
        );
      
      case 'CALCULATORS':
        return (
          <>
            <ToolSubViewHeader title="Calculadoras" onBack={() => goToSubView('NONE')} />
            <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
              <p className="text-lg mb-4">Calculadoras em desenvolvimento!</p>
              <p className="text-sm">Em breve, ferramentas para te ajudar a calcular materiais e mão de obra.</p>
              <div className="mt-6 text-slate-300 dark:text-slate-500">
                <i className="fa-solid fa-calculator text-5xl opacity-40"></i>
              </div>
            </div>
          </>
        );

      case 'CONTRACTS':
        return (
            <>
                <ToolSubViewHeader title="Gerador de Contratos" onBack={() => goToSubView('NONE')} />
                {contracts.length === 0 ? (
                    <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                        <p className="text-lg mb-4">Nenhum modelo de contrato disponível.</p>
                        <p className="text-sm">Contratos padrões serão adicionados em breve.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {CONTRACT_TEMPLATES.map(contract => (
                            <div key={contract.id} className={cx(surface, "p-4 rounded-2xl flex items-start gap-4")}>
                                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-lg shrink-0">
                                    <i className="fa-solid fa-file-contract"></i>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-primary dark:text-white text-lg leading-tight">{contract.title}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{contract.category}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedContractTitle(contract.title);
                                        setSelectedContractContent(contract.contentTemplate);
                                        setShowContractContentModal(true);
                                    }}
                                    className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors shrink-0"
                                    aria-label={`Visualizar contrato ${contract.title}`}
                                >
                                    Visualizar
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </>
        );

      case 'CHECKLIST':
        return (
            <>
                <ToolSubViewHeader title="Checklists" onBack={() => goToSubView('NONE')} onAdd={() => {
                  setEditChecklistData(null); // Ensure add mode
                  setNewChecklistName('');
                  setNewChecklistCategory('');
                  setNewChecklistItems(['']); // Reset to one empty item
                  setShowAddChecklistModal(true);
                }} />
                {checklists.length === 0 ? (
                    <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                        <p className="text-lg mb-4">Nenhum checklist cadastrado ainda.</p>
                        <button onClick={() => {
                          setEditChecklistData(null); 
                          setNewChecklistName('');
                          setNewChecklistCategory('');
                          setNewChecklistItems(['']);
                          setShowAddChecklistModal(true);
                        }} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                            Adicionar seu primeiro checklist
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {checklists.map(checklist => (
                            <div key={checklist.id} className={cx(surface, "p-4 rounded-2xl flex flex-col items-start gap-4")}>
                                <div className="flex justify-between items-center w-full">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-primary dark:text-white text-lg leading-tight">{checklist.name}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{checklist.category}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setNewChecklistName(checklist.name);
                                                setNewChecklistCategory(checklist.category);
                                                setNewChecklistItems(checklist.items.map(item => item.text));
                                                setEditChecklistData(checklist);
                                                setShowAddChecklistModal(true);
                                            }}
                                            className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-1"
                                            aria-label={`Editar checklist ${checklist.name}`}
                                        >
                                            <i className="fa-solid fa-edit text-lg"></i>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setZeModal({
                                                    isOpen: true,
                                                    title: "Excluir Checklist",
                                                    message: `Tem certeza que deseja excluir o checklist "${checklist.name}"?`,
                                                    confirmText: "Excluir",
                                                    onConfirm: async () => handleDeleteChecklist(checklist.id),
                                                    onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                                    type: "DANGER"
                                                });
                                            }}
                                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                            aria-label={`Excluir checklist ${checklist.name}`}
                                        >
                                            <i className="fa-solid fa-trash-alt text-lg"></i>
                                        </button>
                                    </div>
                                </div>
                                <ul className="w-full mt-2 space-y-2">
                                    {checklist.items.map(item => (
                                        <li key={item.id} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id={`checklist-item-${item.id}`}
                                                checked={item.checked}
                                                onChange={(e) => handleChecklistItemToggle(checklist.id, item.id, e.target.checked)}
                                                className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-secondary focus:ring-secondary/50"
                                            />
                                            <label htmlFor={`checklist-item-${item.id}`} className="ml-3 text-sm text-primary dark:text-white cursor-pointer">
                                                {item.text}
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </>
        );

      case 'AICHAT':
        return (
            <>
                <ToolSubViewHeader title="Zé da Obra AI" onBack={() => goToSubView('NONE')} />
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Acessar o Zé da Obra AI para conversar!</p>
                    <button 
                        onClick={() => navigate('/ai-chat')} 
                        className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors"
                    >
                        Abrir Chat AI
                    </button>
                </div>
            </>
        );
      case 'REPORTS':
        return (
          <>
            <ToolSubViewHeader title="Relatórios" onBack={() => goToSubView('NONE')} />
            <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
              <p className="text-lg mb-4">Acessar a visualização de Relatórios!</p>
              <button 
                  onClick={() => navigate(`/work/${workId}/reports`)} 
                  className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors"
              >
                  Ver Relatórios
              </button>
            </div>
          </>
        );
      case 'AIPLANNER':
        return (
          <>
            <ToolSubViewHeader title="Planejamento Inteligente AI" onBack={() => goToSubView('NONE')} />
            <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
              <p className="text-lg mb-4">Acessar o Planejamento Inteligente AI!</p>
              <button 
                  onClick={() => navigate(`/work/${workId}/ai-planner`)} 
                  className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors"
              >
                  Ver Plano AI
              </button>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans">
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0 print:hidden">
        <button
          onClick={() => navigate('/')}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label="Voltar para dashboard"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">{work.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{work.address}</p>
        </div>
      </div>

      {/* Main Content Area */}
      {renderMainContent()}

      {/* Modals for CRUD operations */}
      {/* Add/Edit Step Modal */}
      {showAddStepModal && (
        <ZeModal
          isOpen={showAddStepModal}
          title={editStepData ? "Editar Etapa" : "Adicionar Nova Etapa"}
          message="" // Content will be in children
          confirmText={editStepData ? "Salvar Alterações" : "Adicionar Etapa"}
          onConfirm={editStepData ? handleEditStep : handleAddStep}
          onCancel={() => { setShowAddStepModal(false); setEditStepData(null); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editStepData ? handleEditStep : handleAddStep} className="space-y-4">
            <div>
              <label htmlFor="stepName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Etapa</label>
              <input
                type="text"
                id="stepName"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="stepStartDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Início</label>
              <input
                type="date"
                id="stepStartDate"
                value={newStepStartDate}
                onChange={(e) => setNewStepStartDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="stepEndDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Término</label>
              <input
                type="date"
                id="stepEndDate"
                value={newStepEndDate}
                onChange={(e) => setNewStepEndDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
          </form>
        </ZeModal>
      )}

      {/* Add/Edit Material Modal */}
      {showAddMaterialModal && (
        <ZeModal
          isOpen={showAddMaterialModal}
          title={editMaterialData ? "Editar Material" : "Adicionar Novo Material"}
          message="" // Content in children
          confirmText={editMaterialData ? "Salvar Alterações" : "Adicionar Material"}
          onConfirm={editMaterialData ? handleEditMaterial : handleAddMaterial}
          onCancel={() => { setShowAddMaterialModal(false); setEditMaterialData(null); setPurchaseQtyInput(''); setPurchaseCostInput(''); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editMaterialData ? handleEditMaterial : handleAddMaterial} className="space-y-4">
            <div>
              <label htmlFor="materialName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Material</label>
              <input
                type="text"
                id="materialName"
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="materialBrand" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca (Opcional)</label>
              <input
                type="text"
                id="materialBrand"
                value={newMaterialBrand}
                onChange={(e) => setNewMaterialBrand(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="materialPlannedQty" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantidade Planejada</label>
              <input
                type="number"
                id="materialPlannedQty"
                value={newMaterialPlannedQty}
                onChange={(e) => setNewMaterialPlannedQty(e.target.value)}
                min="0"
                step="any"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="materialUnit" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
              <input
                type="text"
                id="materialUnit"
                value={newMaterialUnit}
                onChange={(e) => setNewMaterialUnit(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="materialCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria (Opcional)</label>
              <input
                type="text"
                id="materialCategory"
                value={newMaterialCategory}
                onChange={(e) => setNewMaterialCategory(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="materialStep" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Etapa Relacionada (Opcional)</label>
              <select
                id="materialStep"
                value={newMaterialStepId}
                onChange={(e) => setNewMaterialStepId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              >
                <option value="none">Nenhuma</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.name}</option>
                ))}
              </select>
            </div>
            {editMaterialData && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
                <h3 className="text-lg font-bold text-primary dark:text-white mb-3">Registrar Compra</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="purchaseQtyInput" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantidade Comprada</label>
                    <input
                      type="number"
                      id="purchaseQtyInput"
                      value={purchaseQtyInput}
                      onChange={(e) => setPurchaseQtyInput(e.target.value)}
                      min="0"
                      step="any"
                      placeholder={`Ex: ${editMaterialData.plannedQty - editMaterialData.purchasedQty}`}
                      className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="purchaseCostInput" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custo Total (R$)</label>
                    <input
                      type="number"
                      id="purchaseCostInput"
                      value={purchaseCostInput}
                      onChange={(e) => setPurchaseCostInput(e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="Ex: 150.75"
                      className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </form>
        </ZeModal>
      )}
      
      {/* Add/Edit Expense Modal */}
      {showAddExpenseModal && (
        <ZeModal
          isOpen={showAddExpenseModal}
          title={editExpenseData ? "Editar Despesa" : "Adicionar Nova Despesa"}
          message="" // Content in children
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
                type="text"
                id="expenseDescription"
                value={newExpenseDescription}
                onChange={(e) => setNewExpenseDescription(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="expenseAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor (R$)</label>
              <input
                type="number"
                id="expenseAmount"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
                min="0"
                step="0.01"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="expenseTotalAgreed" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor Combinado (Opcional, default é o valor da despesa)</label>
              <input
                type="number"
                id="expenseTotalAgreed"
                value={newExpenseTotalAgreed}
                onChange={(e) => setNewExpenseTotalAgreed(e.target.value)}
                min="0"
                step="0.01"
                placeholder="Ex: 500.00"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="expenseCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
              <select
                id="expenseCategory"
                value={newExpenseCategory}
                onChange={(e) => setNewExpenseCategory(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              >
                {Object.values(ExpenseCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expenseDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data</label>
              <input
                type="date"
                id="expenseDate"
                value={newExpenseDate}
                onChange={(e) => setNewExpenseDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="expenseStep" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Etapa Relacionada (Opcional)</label>
              <select
                id="expenseStep"
                value={newExpenseStepId}
                onChange={(e) => setNewExpenseStepId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              >
                <option value="none">Nenhuma</option>
                {steps.map(step => (
                  <option key={step.id} value={step.id}>{step.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expenseWorker" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Profissional Relacionado (Opcional)</label>
              <select
                id="expenseWorker"
                value={newExpenseWorkerId}
                onChange={(e) => setNewExpenseWorkerId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              >
                <option value="none">Nenhum</option>
                {workers.map(worker => (
                  <option key={worker.id} value={worker.id}>{worker.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expenseSupplier" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fornecedor Relacionado (Opcional)</label>
              <select
                id="expenseSupplier"
                value={newExpenseSupplierId}
                onChange={(e) => setNewExpenseSupplierId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
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

      {/* Add Payment to Expense Modal */}
      {showAddPaymentModal && paymentExpenseData && (
        <ZeModal
          isOpen={showAddPaymentModal}
          title={`Adicionar Pagamento para ${paymentExpenseData.description}`}
          message="" // Content in children
          confirmText="Adicionar Pagamento"
          onConfirm={handleAddPayment}
          onCancel={() => { setShowAddPaymentModal(false); setPaymentExpenseData(null); setPaymentAmount(''); setNewPaymentDate(new Date().toISOString().split('T')[0]); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={handleAddPayment} className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Valor Combinado: <span className="font-bold">{formatCurrency(paymentExpenseData.totalAgreed !== undefined ? paymentExpenseData.totalAgreed : paymentExpenseData.amount)}</span>
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Valor Já Pago: <span className="font-bold">{formatCurrency(paymentExpenseData.paidAmount || 0)}</span>
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
              Valor Restante: <span className="font-bold">{formatCurrency((paymentExpenseData.totalAgreed !== undefined ? paymentExpenseData.totalAgreed : paymentExpenseData.amount) - (paymentExpenseData.paidAmount || 0))}</span>
            </p>
            <div>
              <label htmlFor="paymentAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor do Pagamento (R$)</label>
              <input
                type="number"
                id="paymentAmount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="paymentDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data do Pagamento</label>
              <input
                type="date"
                id="paymentDate"
                value={paymentDate}
                onChange={(e) => setNewPaymentDate(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
          </form>
        </ZeModal>
      )}

      {/* Add/Edit Worker Modal */}
      {showAddWorkerModal && (
        <ZeModal
          isOpen={showAddWorkerModal}
          title={editWorkerData ? "Editar Profissional" : "Adicionar Novo Profissional"}
          message="" // Content in children
          confirmText={editWorkerData ? "Salvar Alterações" : "Adicionar Profissional"}
          onConfirm={editWorkerData ? handleEditWorker : handleAddWorker}
          onCancel={() => { setShowAddWorkerModal(false); setEditWorkerData(null); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editWorkerData ? handleEditWorker : handleAddWorker} className="space-y-4">
            <div>
              <label htmlFor="workerName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
              <input
                type="text"
                id="workerName"
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
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
              >
                <option value="">Selecione</option>
                {STANDARD_JOB_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="workerPhone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
              <input
                type="tel"
                id="workerPhone"
                value={newWorkerPhone}
                onChange={(e) => setNewWorkerPhone(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="workerDailyRate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Diária (R$)</label>
              <input
                type="number"
                id="workerDailyRate"
                value={newWorkerDailyRate}
                onChange={(e) => setNewWorkerDailyRate(e.target.value)}
                min="0"
                step="0.01"
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="workerNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações (Opcional)</label>
              <textarea
                id="workerNotes"
                value={newWorkerNotes}
                onChange={(e) => setNewWorkerNotes(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              ></textarea>
            </div>
          </form>
        </ZeModal>
      )}

      {/* Add/Edit Supplier Modal */}
      {showAddSupplierModal && (
        <ZeModal
          isOpen={showAddSupplierModal}
          title={editSupplierData ? "Editar Fornecedor" : "Adicionar Novo Fornecedor"}
          message="" // Content in children
          confirmText={editSupplierData ? "Salvar Alterações" : "Adicionar Fornecedor"}
          onConfirm={editSupplierData ? handleEditSupplier : handleAddSupplier}
          onCancel={() => { setShowAddSupplierModal(false); setEditSupplierData(null); }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editSupplierData ? handleEditSupplier : handleAddSupplier} className="space-y-4">
            <div>
              <label htmlFor="supplierName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Fornecedor</label>
              <input
                type="text"
                id="supplierName"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
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
              >
                <option value="">Selecione</option>
                {STANDARD_SUPPLIER_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="supplierPhone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
              <input
                type="tel"
                id="supplierPhone"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="supplierEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email (Opcional)</label>
              <input
                type="email"
                id="supplierEmail"
                value={newSupplierEmail}
                onChange={(e) => setNewSupplierEmail(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="supplierAddress" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço (Opcional)</label>
              <input
                type="text"
                id="supplierAddress"
                value={newSupplierAddress}
                onChange={(e) => setNewSupplierAddress(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="supplierNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações (Opcional)</label>
              <textarea
                id="supplierNotes"
                value={newSupplierNotes}
                onChange={(e) => setNewSupplierNotes(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              ></textarea>
            </div>
          </form>
        </ZeModal>
      )}

      {/* Add Photo Modal */}
      {showAddPhotoModal && (
        <ZeModal
          isOpen={showAddPhotoModal}
          title="Adicionar Nova Foto"
          message=""
          confirmText="Upload da Foto"
          onConfirm={handleAddPhoto}
          onCancel={() => { setShowAddPhotoModal(false); setNewPhotoFile(null); setNewPhotoDescription(''); setNewPhotoType('PROGRESS'); }}
          type="INFO"
          isConfirming={uploadingPhoto}
        >
          <form onSubmit={handleAddPhoto} className="space-y-4">
            <div>
              <label htmlFor="photoFile" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Arquivo de Imagem</label>
              <input
                type="file"
                id="photoFile"
                accept="image/*"
                onChange={(e) => setNewPhotoFile(e.target.files ? e.target.files[0] : null)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="photoDescription" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição (Opcional)</label>
              <input
                type="text"
                id="photoDescription"
                value={newPhotoDescription}
                onChange={(e) => setNewPhotoDescription(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="photoType" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo da Foto</label>
              <select
                id="photoType"
                value={newPhotoType}
                onChange={(e) => setNewPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'PROGRESS')}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              >
                <option value="PROGRESS">Progresso</option>
                <option value="BEFORE">Antes</option>
                <option value="AFTER">Depois</option>
              </select>
            </div>
          </form>
        </ZeModal>
      )}

      {/* Add File Modal */}
      {showAddFileModal && (
        <ZeModal
          isOpen={showAddFileModal}
          title="Adicionar Novo Documento"
          message=""
          confirmText="Upload do Documento"
          onConfirm={handleAddFile}
          onCancel={() => { setShowAddFileModal(false); setNewUploadFile(null); setNewFileName(''); setNewFileCategory(FileCategory.GENERAL); }}
          type="INFO"
          isConfirming={uploadingFile}
        >
          <form onSubmit={handleAddFile} className="space-y-4">
            <div>
              <label htmlFor="uploadFile" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Arquivo</label>
              <input
                type="file"
                id="uploadFile"
                onChange={(e) => setNewUploadFile(e.target.files ? e.target.files[0] : null)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="fileName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Documento (Opcional, default é o nome do arquivo)</label>
              <input
                type="text"
                id="fileName"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
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
              >
                {Object.values(FileCategory).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </form>
        </ZeModal>
      )}

      {/* Contract Content Viewer Modal */}
      {showContractContentModal && (
        <ZeModal
          isOpen={showContractContentModal}
          title={selectedContractTitle}
          message="" // Content in children
          confirmText={copyContractSuccess ? "Copiado!" : "Copiar Texto"}
          onConfirm={async () => {
              await navigator.clipboard.writeText(selectedContractContent);
              setCopyContractSuccess(true);
              setTimeout(() => setCopyContractSuccess(false), 2000); // Reset after 2 seconds
          }}
          onCancel={() => { setShowContractContentModal(false); setCopyContractSuccess(false); }}
          type="INFO"
        >
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-96 overflow-auto">
            {selectedContractContent}
          </div>
          {copyContractSuccess && (
            <p className="text-center text-green-500 text-sm mt-3 animate-in fade-in">
              <i className="fa-solid fa-check-circle mr-1"></i> Texto copiado para a área de transferência!
            </p>
          )}
        </ZeModal>
      )}

      {/* Add/Edit Checklist Modal */}
      {showAddChecklistModal && (
        <ZeModal
          isOpen={showAddChecklistModal}
          title={editChecklistData ? "Editar Checklist" : "Adicionar Novo Checklist"}
          message="" // Content in children
          confirmText={editChecklistData ? "Salvar Checklist" : "Adicionar Checklist"}
          onConfirm={editChecklistData ? handleEditChecklist : handleAddChecklist}
          onCancel={() => { 
            setShowAddChecklistModal(false); 
            setEditChecklistData(null); 
            setNewChecklistName(''); 
            setNewChecklistCategory(''); 
            setNewChecklistItems(['']); 
          }}
          type="INFO"
          isConfirming={zeModal.isConfirming}
        >
          <form onSubmit={editChecklistData ? handleEditChecklist : handleAddChecklist} className="space-y-4">
            <div>
              <label htmlFor="checklistName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Checklist</label>
              <input
                type="text"
                id="checklistName"
                value={newChecklistName}
                onChange={(e) => setNewChecklistName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="checklistCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria (Ex: Fundações, Elétrica)</label>
              <input
                type="text"
                id="checklistCategory"
                value={newChecklistCategory}
                onChange={(e) => setNewChecklistCategory(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Itens do Checklist</label>
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
                    placeholder={`Item ${index + 1}`}
                    className="flex-1 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                  />
                  {newChecklistItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updatedItems = newChecklistItems.filter((_, i) => i !== index);
                        setNewChecklistItems(updatedItems);
                      }}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"
                    >
                      <i className="fa-solid fa-times"></i>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setNewChecklistItems([...newChecklistItems, ''])}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mt-2"
              >
                <i className="fa-solid fa-plus mr-2"></i> Adicionar Item
              </button>
            </div>
          </form>
        </ZeModal>
      )}

      {/* Generic ZeModal for confirmations/errors */}
      {zeModal.isOpen && (
        <ZeModal
          isOpen={zeModal.isOpen}
          title={zeModal.title}
          message={zeModal.message}
          confirmText={zeModal.confirmText}
          onConfirm={zeModal.onConfirm}
          onCancel={zeModal.onCancel}
          type={zeModal.type}
          isConfirming={zeModal.isConfirming}
        >
          {zeModal.children}
        </ZeModal>
      )}
    </div>
  );
};

export default WorkDetail;
