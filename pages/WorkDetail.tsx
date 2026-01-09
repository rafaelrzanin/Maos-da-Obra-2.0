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
  const { user, authLoading, isUserAuthFinished, trialDaysRemaining } = useAuth();
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
  // NEW: States for material purchase within the edit modal
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
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null); 
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
    navigate(`/work/${workId}?tab=${tab}`, { replace: true }); 
  }, [workId, navigate, onTabChange]);

  const goToSubView = useCallback((subView: SubView) => {
    setActiveSubView(subView);
  }, []);

  const calculateStepProgress = (stepId: string): number => {
    const totalMaterialsForStep = materials.filter(m => m.stepId === stepId);
    if (totalMaterialsForStep.length === 0) return 0;

    const totalPlannedQty = totalMaterialsForStep.reduce((sum, m) => sum + m.plannedQty, 0);
    const totalPurchasedQty = totalMaterialsForStep.reduce((sum, m) => sum + m.purchasedQty, 0);

    return totalPlannedQty > 0 ? (totalPurchasedQty / totalPlannedQty) * 100 : 0;
  };

  const calculateTotalExpenses = useMemo(() => {
    return expenses.filter(expense => expense.category !== ExpenseCategory.MATERIAL).reduce((sum, expense) => sum + (expense.paidAmount || 0), 0);
  }, [expenses]);

  // NEW: Grouped and filtered materials for UI
  const groupedMaterials = useMemo<MaterialStepGroup[]>(() => {
    const filteredMaterials = materialFilterStepId === 'all'
      ? materials
      : materials.filter(m => m.stepId === materialFilterStepId);

    const groups: { [key: string]: Material[] } = {};
    const stepOrder: string[] = [];
    const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

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
      const stepKey = expense.stepId || 'no_step'; 
      if (!groups[stepKey]) {
        groups[stepKey] = [];
      }
      groups[stepKey].push(expense);
    });

    const expenseGroups: ExpenseStepGroup[] = [];
    const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

    sortedSteps.forEach(step => {
      if (groups[step.id]) {
        expenseGroups.push({
          stepName: `${step.orderIndex}. ${step.name}`,
          expenses: groups[step.id].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          totalStepAmount: groups[step.id].reduce((sum, exp) => sum + (exp.amount || 0), 0), 
        });
      }
    });

    if (groups['no_step']) {
      expenseGroups.push({
        stepName: 'Sem Etapa Definida', 
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
      navigate('/', { replace: true });
      return;
    }

    setLoading(true);
    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        navigate('/', { replace: true });
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
        dbService.getContractTemplates(), 
        dbService.getChecklists(workId),
      ]);

      await dbService.ensureMaterialsForWork(fetchedWork, fetchedSteps);
      const currentMaterials = await dbService.getMaterials(workId);
      setMaterials(currentMaterials);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stepsWithCorrectedDelay = fetchedSteps.map(step => {
        let currentIsDelayed = false;
        const stepEndDate = new Date(step.endDate);
        stepEndDate.setHours(0, 0, 0, 0);

        if (step.status !== StepStatus.COMPLETED) {
            currentIsDelayed = today.getTime() > stepEndDate.getTime();
        }
        return { ...step, isDelayed: currentIsDelayed };
      }).sort((a, b) => a.orderIndex - b.orderIndex);

      setSteps(stepsWithCorrectedDelay); 
      setExpenses(fetchedExpenses);
      setWorkers(fetchedWorkers);
      setSuppliers(fetchedSuppliers);
      setPhotos(fetchedPhotos);
      setFiles(fetchedFiles);
      setContracts(fetchedContracts);
      setChecklists(fetchedChecklists);

    } catch (error) {
      console.error("Erro ao carregar dados da obra:", error);
      setZeModal({
        isOpen: true,
        title: "Erro de Carregamento",
        message: "Não foi possível carregar os dados da obra.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setLoading(false);
    }
  }, [workId, user, navigate]);

  useEffect(() => {
    if (!authLoading && isUserAuthFinished) {
      loadWorkData();
      const tabFromUrl = searchParams.get('tab') as MainTab;
      if (tabFromUrl && ['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'].includes(tabFromUrl)) {
        onTabChange(tabFromUrl);
      }
    }
  }, [authLoading, isUserAuthFinished, loadWorkData, searchParams, onTabChange]);

  // =======================================================================
  // CRUD HANDLERS: STEPS
  // =======================================================================

  const handleStepStatusChange = useCallback(async (step: Step) => {
    if (isUpdatingStepStatus) return;
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
        newIsDelayed = today.getTime() > stepEndDate.getTime();
        break;
      case StepStatus.IN_PROGRESS:
        newStatus = StepStatus.COMPLETED;
        newRealDate = new Date().toISOString().split('T')[0];
        newIsDelayed = false;
        break;
      case StepStatus.COMPLETED:
        newStatus = StepStatus.NOT_STARTED;
        newRealDate = undefined;
        newIsDelayed = today.getTime() > stepStartDate.getTime();
        break;
      default:
        newStatus = StepStatus.NOT_STARTED;
    }
    
    try {
      const updatedStepData: Step = {
        ...step,
        status: newStatus,
        realDate: newRealDate,
        isDelayed: newIsDelayed
      };

      await dbService.updateStep(updatedStepData);
      await loadWorkData();
    } catch (error: any) {
      setZeModal({
        isOpen: true,
        title: "Erro ao Atualizar Status",
        message: "Não foi possível atualizar o status da etapa.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    } finally {
      setIsUpdatingStepStatus(false);
    }
  }, [loadWorkData, isUpdatingStepStatus]);

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newStepName) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addStep({
        workId: workId,
        name: newStepName,
        startDate: newStepStartDate,
        endDate: newStepEndDate,
        status: StepStatus.NOT_STARTED,
      });
      setShowAddStepModal(false);
      setNewStepName('');
      await loadWorkData();
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar Etapa",
        message: "Não foi possível adicionar a etapa.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStepData || !workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateStep({
        ...editStepData,
        name: newStepName,
        startDate: newStepStartDate,
        endDate: newStepEndDate,
        workId: workId,
      });
      setEditStepData(null);
      setShowAddStepModal(false);
      await loadWorkData();
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Etapa",
        message: "Não foi possível editar a etapa.",
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
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar Etapa",
        message: "Não foi possível deletar a etapa.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDragStart = (e: React.DragEvent, stepId: string) => {
    setDraggedStepId(stepId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stepId: string) => {
    e.preventDefault();
    setDragOverStepId(stepId);
  };

  const handleDrop = useCallback(async (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    if (!draggedStepId || !workId || draggedStepId === targetStepId) {
      setDragOverStepId(null);
      return;
    }

    const newStepsOrder = Array.from(steps);
    const draggedIndex = newStepsOrder.findIndex((s: Step) => s.id === draggedStepId);
    const targetIndex = newStepsOrder.findIndex((s: Step) => s.id === targetStepId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDragOverStepId(null);
      return;
    }

    const [reorderedItem] = newStepsOrder.splice(draggedIndex, 1);
    newStepsOrder.splice(targetIndex, 0, reorderedItem);

    const updatedSteps = newStepsOrder.map((step, index) => ({
      ...step,
      orderIndex: index + 1,
    }));

    setLoading(true);
    try {
      await Promise.all(updatedSteps.map(step => dbService.updateStep(step)));
      await loadWorkData();
    } catch (error: any) {
      setZeModal({
        isOpen: true,
        title: "Erro ao Reordenar",
        message: "Não foi possível reordenar as etapas.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    } finally {
      setDraggedStepId(null);
      setDragOverStepId(null);
      setLoading(false);
    }
  }, [draggedStepId, steps, workId, loadWorkData]);

  // =======================================================================
  // CRUD HANDLERS: MATERIALS
  // =======================================================================

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newMaterialName || !newMaterialPlannedQty || !newMaterialUnit) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addMaterial(user.id, {
        workId: workId,
        name: newMaterialName,
        brand: newMaterialBrand,
        plannedQty: Number(newMaterialPlannedQty),
        purchasedQty: 0,
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
      });
      setShowAddMaterialModal(false);
      setNewMaterialName('');
      await loadWorkData();
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar",
        message: "Não foi possível adicionar o material.",
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

      await dbService.updateMaterial({
        ...editMaterialData,
        name: newMaterialName,
        brand: newMaterialBrand,
        plannedQty: Number(newMaterialPlannedQty),
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
      });

      if (qtyToRegister > 0 && costToRegister >= 0) {
        await dbService.registerMaterialPurchase(
          editMaterialData.id,
          newMaterialName,
          newMaterialBrand,
          Number(newMaterialPlannedQty),
          newMaterialUnit,
          qtyToRegister,
          costToRegister
        );
      }

      setEditMaterialData(null);
      setShowAddMaterialModal(false);
      await loadWorkData();
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro na Operação",
        message: "Não foi possível completar a operação.",
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
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar",
        message: "Não foi possível deletar o material.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
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
    if (!workId || !newExpenseDescription || !newExpenseAmount || !newExpenseDate) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addExpense({
        workId: workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount),
        quantity: 1,
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : Number(newExpenseAmount),
      });
      setShowAddExpenseModal(false);
      await loadWorkData();
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Adicionar",
        message: "Não foi possível adicionar a despesa.",
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
        amount: Number(newExpenseAmount),
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : Number(editExpenseData.amount),
      });
      setEditExpenseData(null);
      setShowAddExpenseModal(false);
      await loadWorkData();
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar",
        message: "Não foi possível editar a despesa.",
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
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Deletar",
        message: "Não foi possível deletar a despesa.",
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
        Number(paymentAmount),
        paymentDate
      );
      setPaymentAmount('');
      setShowAddPaymentModal(false);
      await loadWorkData();
    } catch (error: any) {
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Pagar",
        message: "Não foi possível adicionar o pagamento.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      }));
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  // =======================================================================
  // CRUD HANDLERS: WORKERS / SUPPLIERS / PHOTOS / FILES / CHECKLISTS
  // =======================================================================

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newWorkerName || !newWorkerRole || !newWorkerPhone) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addWorker({
        workId, userId: user.id, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone,
        dailyRate: newWorkerDailyRate ? Number(newWorkerDailyRate) : undefined, notes: newWorkerNotes,
      });
      setShowAddWorkerModal(false);
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
    } finally {
        setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorkerData) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateWorker({
        ...editWorkerData, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone,
        dailyRate: newWorkerDailyRate ? Number(newWorkerDailyRate) : undefined, notes: newWorkerNotes,
      });
      setEditWorkerData(null);
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
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
        console.error(error);
    } finally {
        setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newSupplierName) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addSupplier({
        workId, userId: user.id, name: newSupplierName, category: newSupplierCategory,
        phone: newSupplierPhone, email: newSupplierEmail, address: newSupplierAddress, notes: newSupplierNotes,
      });
      setShowAddSupplierModal(false);
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
    } finally {
        setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplierData) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateSupplier({
        ...editSupplierData, name: newSupplierName, category: newSupplierCategory,
        phone: newSupplierPhone, email: newSupplierEmail, address: newSupplierAddress, notes: newSupplierNotes,
      });
      setEditSupplierData(null);
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
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
        console.error(error);
    } finally {
        setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newPhotoFile) return;
    setLoadingPhoto(true);
    try {
      const fileExt = newPhotoFile.name.split('.').pop();
      const filePath = `${workId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('work_media').upload(filePath, newPhotoFile);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('work_media').getPublicUrl(filePath);
      await dbService.addPhoto({
        workId, url: publicUrlData.publicUrl, description: newPhotoDescription,
        date: new Date().toISOString().split('T')[0], type: newPhotoType,
      });
      setShowAddPhotoModal(false);
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
    } finally {
      setLoadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    if (!workId) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const filePath = photoUrl.split('work_media/')[1];
      await supabase.storage.from('work_media').remove([filePath]);
      await dbService.deletePhoto(photoId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
        console.error(error);
    } finally {
        setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newUploadFile) return;
    setLoadingFile(true);
    try {
      const fileExt = newUploadFile.name.split('.').pop();
      const filePath = `${workId}/docs/${newFileName || newUploadFile.name}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('work_files').upload(filePath, newUploadFile);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('work_files').getPublicUrl(filePath);
      await dbService.addFile({
        workId, name: newFileName || newUploadFile.name, category: newFileCategory,
        url: publicUrlData.publicUrl, type: newUploadFile.type, date: new Date().toISOString().split('T')[0],
      });
      setShowAddFileModal(false);
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    if (!workId) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      const filePath = fileUrl.split('work_files/')[1];
      await supabase.storage.from('work_files').remove([filePath]);
      await dbService.deleteFile(fileId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
        console.error(error);
    } finally {
        setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newChecklistName) return;
    const itemsForDb = newChecklistItems.filter(item => item.trim() !== '').map((text, idx) => ({
      id: `item-${Date.now()}-${idx}`, text: text.trim(), checked: false
    }));
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addChecklist({ workId, name: newChecklistName, category: newChecklistCategory, items: itemsForDb });
      setShowAddChecklistModal(false);
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
    } finally {
        setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChecklistData) return;
    const itemsForDb = newChecklistItems.filter(item => item.trim() !== '').map((text, idx) => {
      const existingItem = editChecklistData.items.find(item => item.text === text.trim());
      return { id: existingItem ? existingItem.id : `item-${Date.now()}-${idx}`, text: text.trim(), checked: existingItem ? existingItem.checked : false };
    });
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateChecklist({ ...editChecklistData, name: newChecklistName, category: newChecklistCategory, items: itemsForDb });
      setEditChecklistData(null);
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
    } finally {
        setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleChecklistItemToggle = async (checklistId: string, itemId: string, checked: boolean) => {
    try {
      const checklistToUpdate = checklists.find(cl => cl.id === checklistId);
      if (!checklistToUpdate) return;
      const updatedItems = checklistToUpdate.items.map(item => item.id === itemId ? { ...item, checked } : item);
      await dbService.updateChecklist({ ...checklistToUpdate, items: updatedItems });
      await loadWorkData();
    } catch (error: any) {
        console.error(error);
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteChecklist(checklistId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (error: any) {
        console.error(error);
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

  const isEditingExpenseWithPayments = editExpenseData && editExpenseData.status !== ExpenseStatus.PENDING;
  const isMaterialCategorySelected = newExpenseCategory === ExpenseCategory.MATERIAL;

  const renderMainContent = () => {
    switch (activeTab) {
      case 'ETAPAS':
        return (
          <>
            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
              <h2 className="text-2xl font-black text-primary dark:text-white">Cronograma</h2>
              <button
                onClick={() => {
                    setEditStepData(null);
                    setNewStepName('');
                    setNewStepStartDate(new Date().toISOString().split('T')[0]);
                    setNewStepEndDate(new Date().toISOString().split('T')[0]);
                    setShowAddStepModal(true);
                }}
                className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-plus"></i> Nova Etapa
              </button>
            </div>
            
            {steps.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhuma etapa cadastrada ainda.</p>
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
                                    `p-4 rounded-2xl flex items-center gap-4 transition-all hover:scale-[1.005] border-2 ${statusDetails.borderColor} shadow-lg ${statusDetails.shadowClass}`,
                                    draggedStepId === step.id && "opacity-50",
                                    dragOverStepId === step.id && "ring-2 ring-secondary/50",
                                )}
                                draggable
                                onDragStart={(e) => handleDragStart(e, step.id)}
                                onDragOver={(e) => handleDragOver(e, step.id)}
                                onDrop={(e) => handleDrop(e, step.id)}
                                onClick={() => { 
                                    setNewStepName(step.name);
                                    setNewStepStartDate(step.startDate);
                                    setNewStepEndDate(step.endDate);
                                    setEditStepData(step); 
                                    setShowAddStepModal(true); 
                                }}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleStepStatusChange(step); }}
                                    disabled={isUpdatingStepStatus}
                                    className={cx(
                                        "w-10 h-10 rounded-full text-white flex items-center justify-center text-lg font-bold transition-colors shrink-0",
                                        statusDetails.bgColor
                                    )}
                                >
                                    <i className={`fa-solid ${statusDetails.icon}`}></i>
                                </button>
                                <div className="flex-1">
                                    <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">
                                        Etapa {step.orderIndex} 
                                        <span className={statusDetails.textColor}> ({statusDetails.statusText})</span>
                                    </p>
                                    <h3 className="text-lg font-bold text-primary dark:text-white leading-tight">{step.name}</h3>
                                </div>
                                <div className="text-right text-sm">
                                    <p className="font-bold text-primary dark:text-white">{calculateStepProgress(step.id).toFixed(0)}%</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); 
                                            setZeModal({
                                                isOpen: true,
                                                title: "Excluir Etapa",
                                                message: `Tem certeza?`,
                                                confirmText: "Excluir",
                                                onConfirm: () => handleDeleteStep(step.id),
                                                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                                type: "DANGER"
                                            });
                                        }}
                                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                    >
                                        <i className="fa-solid fa-trash-alt"></i>
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
                  setEditMaterialData(null);
                  setNewMaterialName('');
                  setNewMaterialPlannedQty('');
                  setNewMaterialUnit('');
                  setShowAddMaterialModal(true);
                }}
                className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-plus"></i> Novo Material
              </button>
            </div>
            {groupedMaterials.map(group => (
                <div key={group.stepId} className="mb-6">
                    <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 mb-3">{group.stepName}</h3>
                    <div className="space-y-4">
                    {group.materials.map(material => {
                        const statusDetails = getEntityStatusDetails('material', material, steps);
                        return (
                            <div 
                            key={material.id} 
                            onClick={() => {
                                setNewMaterialName(material.name);
                                setNewMaterialBrand(material.brand || '');
                                setNewMaterialPlannedQty(String(material.plannedQty));
                                setNewMaterialUnit(material.unit);
                                setEditMaterialData(material); 
                                setShowAddMaterialModal(true); 
                            }}
                            className={cx(surface, `p-4 rounded-2xl flex items-center justify-between border-2 ${statusDetails.borderColor}`)}
                            >
                                <div className="flex-1">
                                    <h4 className="font-bold text-primary dark:text-white">{material.name}</h4>
                                    <p className="text-xs text-slate-500">{material.brand}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold">{material.purchasedQty} / {material.plannedQty} {material.unit}</p>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMaterial(material.id); }} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            ))}
          </>
        );

      case 'FINANCEIRO':
        const totalNonMaterialPaid = expenses.filter(e => e.category !== ExpenseCategory.MATERIAL).reduce((sum, exp) => sum + (exp.paidAmount || 0), 0);
        return (
          <>
            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
              <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
              <button onClick={() => setShowAddExpenseModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2">
                <i className="fa-solid fa-plus"></i> Nova Despesa
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className={cx(surface, "p-5 rounded-2xl")}>
                <p className="text-sm text-slate-500">Orçamento Planejado</p>
                <h3 className="text-xl font-bold">{formatCurrency(work.budgetPlanned)}</h3>
              </div>
              <div className={cx(surface, "p-5 rounded-2xl")}>
                <p className="text-sm text-slate-500">Gasto Total (Mão de Obra)</p>
                <h3 className="text-xl font-bold">{formatCurrency(totalNonMaterialPaid)}</h3>
              </div>
            </div>
            <div className="space-y-6">
                {groupedExpensesByStep.map((group, idx) => (
                    <div key={idx}>
                        <h3 className="font-bold text-slate-500 mb-3">{group.stepName}</h3>
                        {group.expenses.map(expense => (
                            <div key={expense.id} className={cx(surface, "p-4 rounded-2xl flex justify-between mb-2")}>
                                <div>
                                    <h4 className="font-bold">{expense.description}</h4>
                                    <p className="text-xs">{formatDateDisplay(expense.date)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{formatCurrency(expense.paidAmount || 0)}</p>
                                    <button onClick={() => { setPaymentExpenseData(expense); setShowAddPaymentModal(true); }} className="text-xs text-secondary underline">Pagar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ToolCard icon="fa-users-gear" title="Profissionais" description="Equipe e mão de obra." onClick={() => goToSubView('WORKERS')} />
            <ToolCard icon="fa-truck-field" title="Fornecedores" description="Organize seus contatos." onClick={() => goToSubView('SUPPLIERS')} />
            <ToolCard icon="fa-images" title="Fotos da Obra" description="Documente o progresso." onClick={() => goToSubView('PHOTOS')} />
            <ToolCard icon="fa-file-lines" title="Projetos e Docs" description="Guarde suas plantas." onClick={() => goToSubView('PROJECTS')} />
            <ToolCard icon="fa-file-contract" title="Gerador de Contratos" description="Crie contratos profissionais." onClick={() => goToSubView('CONTRACTS')} isLocked={!isVitalicio} requiresVitalicio />
            <ToolCard icon="fa-list-check" title="Checklists" description="Listas de verificação." onClick={() => goToSubView('CHECKLIST')} isLocked={!isVitalicio} requiresVitalicio />
          </div>
        );
      case 'WORKERS':
        return (
            <>
                <ToolSubViewHeader title="Profissionais" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddWorkerModal(true)} />
                <div className="space-y-4">
                    {workers.map(worker => (
                        <div key={worker.id} className={cx(surface, "p-4 rounded-2xl flex justify-between")}>
                            <div><h3 className="font-bold">{worker.name}</h3><p className="text-sm">{worker.role}</p></div>
                            <button onClick={() => handleDeleteWorker(worker.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                        </div>
                    ))}
                </div>
            </>
        );
      case 'SUPPLIERS':
        return (
            <>
                <ToolSubViewHeader title="Fornecedores" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddSupplierModal(true)} />
                <div className="space-y-4">
                    {suppliers.map(supplier => (
                        <div key={supplier.id} className={cx(surface, "p-4 rounded-2xl flex justify-between")}>
                            <div><h3 className="font-bold">{supplier.name}</h3><p className="text-sm">{supplier.category}</p></div>
                            <button onClick={() => handleDeleteSupplier(supplier.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                        </div>
                    ))}
                </div>
            </>
        );
      case 'PHOTOS':
        return (
            <>
                <ToolSubViewHeader title="Fotos" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddPhotoModal(true)} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map(photo => (
                        <div key={photo.id} className="relative group">
                            <img src={photo.url} alt="" className="rounded-xl h-40 w-full object-cover" />
                            <button onClick={() => handleDeletePhoto(photo.id, photo.url)} className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100"><i className="fa-solid fa-trash"></i></button>
                        </div>
                    ))}
                </div>
            </>
        );
      case 'PROJECTS':
        return (
            <>
                <ToolSubViewHeader title="Documentos" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddFileModal(true)} />
                <div className="space-y-4">
                    {files.map(file => (
                        <div key={file.id} className={cx(surface, "p-4 rounded-2xl flex justify-between")}>
                            <div><h3 className="font-bold">{file.name}</h3></div>
                            <div className="flex gap-4">
                                <a href={file.url} target="_blank" rel="noreferrer" className="text-secondary">Ver</a>
                                <button onClick={() => handleDeleteFile(file.id, file.url)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
      case 'CONTRACTS':
        return (
            <>
                <ToolSubViewHeader title="Contratos" onBack={() => goToSubView('NONE')} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contracts.map(contract => (
                        <button key={contract.id} onClick={() => { setSelectedContractTitle(contract.title); setSelectedContractContent(contract.contentTemplate); setShowContractContentModal(true); }} className={cx(surface, "p-4 rounded-2xl text-left")}>
                            <h3 className="font-bold">{contract.title}</h3>
                        </button>
                    ))}
                </div>
            </>
        );
      case 'CHECKLIST':
        return (
            <>
                <ToolSubViewHeader title="Checklists" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddChecklistModal(true)} />
                <div className="space-y-6">
                    {checklists.map(checklist => (
                        <div key={checklist.id} className={cx(surface, "p-5 rounded-2xl")}>
                            <h3 className="font-bold text-xl mb-4">{checklist.name}</h3>
                            <div className="space-y-2">
                                {checklist.items.map(item => (
                                    <label key={item.id} className="flex items-center gap-3">
                                        <input type="checkbox" checked={item.checked} onChange={(e) => handleChecklistItemToggle(checklist.id, item.id, e.target.checked)} />
                                        <span className={item.checked ? 'line-through' : ''}>{item.text}</span>
                                    </label>
                                ))}
                            </div>
                            <button onClick={() => handleDeleteChecklist(checklist.id)} className="mt-4 text-red-500 text-sm">Excluir Checklist</button>
                        </div>
                    ))}
                </div>
            </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans">
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-primary p-2 -ml-2"><i className="fa-solid fa-arrow-left text-xl"></i></button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">{work.name}</h1>
          <p className="text-sm text-slate-500 font-medium">Endereço: {work.address}</p>
        </div>
      </div>
      
      <div className="flex justify-around bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
        {(['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'] as MainTab[]).map(tab => (
            <button key={tab} onClick={() => goToTab(tab)} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === tab ? 'bg-secondary text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                {tab === 'ETAPAS' ? 'Cronograma' : tab === 'MATERIAIS' ? 'Materiais' : tab === 'FINANCEIRO' ? 'Financeiro' : 'Ferramentas'}
            </button>
        ))}
      </div>

      <div className={cx(surface, card, "animate-in fade-in")}>
        {renderMainContent()}
      </div>

      {/* MODALS */}
      {(showAddStepModal || editStepData) && (
        <ZeModal isOpen title={editStepData ? "Editar Etapa" : "Nova Etapa"} confirmText="Salvar" onConfirm={editStepData ? handleEditStep : handleAddStep} onCancel={() => { setShowAddStepModal(false); setEditStepData(null); }} isConfirming={zeModal.isConfirming}>
            <div className="space-y-4">
                <input type="text" placeholder="Nome" value={newStepName} onChange={e => setNewStepName(e.target.value)} className="w-full p-3 rounded-xl border" />
                <input type="date" value={newStepStartDate} onChange={e => setNewStepStartDate(e.target.value)} className="w-full p-3 rounded-xl border" />
                <input type="date" value={newStepEndDate} onChange={e => setNewStepEndDate(e.target.value)} className="w-full p-3 rounded-xl border" />
            </div>
        </ZeModal>
      )}

      {showAddExpenseModal && (
        <ZeModal isOpen title="Nova Despesa" confirmText="Adicionar" onConfirm={handleAddExpense} onCancel={() => setShowAddExpenseModal(false)} isConfirming={zeModal.isConfirming}>
            <div className="space-y-4">
                <input type="text" placeholder="Descrição" value={newExpenseDescription} onChange={e => setNewExpenseDescription(e.target.value)} className="w-full p-3 rounded-xl border" />
                <input type="number" placeholder="Valor" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} className="w-full p-3 rounded-xl border" />
                <select value={newExpenseCategory} onChange={e => setNewExpenseCategory(e.target.value as ExpenseCategory)} className="w-full p-3 rounded-xl border">
                    {Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="date" value={newExpenseDate} onChange={e => setNewExpenseDate(e.target.value)} className="w-full p-3 rounded-xl border" />
            </div>
        </ZeModal>
      )}

      {showAddPaymentModal && (
        <ZeModal isOpen title="Pagar" confirmText="Confirmar" onConfirm={handleAddPayment} onCancel={() => setShowAddPaymentModal(false)} isConfirming={zeModal.isConfirming}>
            <div className="space-y-4">
                <input type="number" placeholder="Valor do Pagamento" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full p-3 rounded-xl border" />
                <input type="date" value={paymentDate} onChange={e => setNewPaymentDate(e.target.value)} className="w-full p-3 rounded-xl border" />
            </div>
        </ZeModal>
      )}

      {zeModal.isOpen && <ZeModal {...zeModal} />}
    </div>
  );
};

export default WorkDetail;
