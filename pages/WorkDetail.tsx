import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
import { ZeModal, type ZeModalProps } from '../components/ZeModal.tsx';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
type SubView = 'NONE' | 'WORKERS' | 'SUPPLIERS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST' | 'AICHAT' | 'REPORTS' | 'AIPLANNER';

interface ExpenseStepGroup {
    stepName: string;
    expenses: Expense[];
    totalStepAmount: number;
}

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

interface StatusDetails {
  statusText: string;
  bgColor: string; 
  textColor: string; 
  borderColor: string; 
  shadowClass: string; 
  icon: string; 
}

const getEntityStatusDetails = (
  entityType: 'step' | 'material' | 'expense',
  entity: Step | Material | Expense,
  allSteps: Step[]
): StatusDetails => {
  let statusText = '';
  let bgColor = 'bg-slate-400';
  let textColor = 'text-slate-700 dark:text-slate-300';
  let borderColor = 'border-slate-200 dark:border-slate-700';
  let shadowClass = 'shadow-slate-400/20';
  let icon = 'fa-hourglass-start';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    } else {
      statusText = 'Pendente';
      bgColor = 'bg-slate-400';
      textColor = 'text-slate-700 dark:text-slate-300';
      borderColor = 'border-slate-200 dark:border-slate-700';
      shadowClass = 'shadow-slate-400/20';
      icon = 'fa-hourglass-start';
    }

    if (isActuallyDelayed && step.status !== StepStatus.COMPLETED) {
        bgColor = 'bg-red-500';
        statusText += ' (Atrasado)';
        icon = 'fa-exclamation-triangle';
    }
  } else if (entityType === 'material') {
    const material = entity as Material;
    const associatedStep = allSteps.find(s => s.id === material.stepId);
    
    let isDelayed = false;
    if (associatedStep) {
      const stepStartDate = new Date(associatedStep.startDate);
      stepStartDate.setHours(0, 0, 0, 0);
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(today.getDate() + 3);
      threeDaysFromNow.setHours(0, 0, 0, 0);
      isDelayed = (stepStartDate <= threeDaysFromNow && material.purchasedQty < material.plannedQty);
    }
    
    const isMaterialComplete = (material.purchasedQty >= material.plannedQty && material.plannedQty > 0);
    const isMaterialPartial = (material.purchasedQty > 0 && material.purchasedQty < material.plannedQty);

    if (isDelayed) {
      statusText = 'Atrasado';
      bgColor = 'bg-red-500';
      icon = 'fa-exclamation-triangle';
    } else if (isMaterialComplete) {
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      icon = 'fa-check';
    } else if (isMaterialPartial) {
      statusText = 'Parcial';
      bgColor = 'bg-amber-500';
      icon = 'fa-hourglass-half';
    } else {
      statusText = 'Pendente';
      bgColor = 'bg-slate-400';
      icon = 'fa-hourglass-start';
    }
  } else if (entityType === 'expense') {
    const expense = entity as Expense;
    const paidAmount = expense.paidAmount || 0;
    const totalAgreed = expense.totalAgreed !== undefined ? expense.totalAgreed : expense.amount;

    if (totalAgreed === 0 && paidAmount === 0) {
        statusText = 'Concluído';
        bgColor = 'bg-green-500';
        icon = 'fa-check';
    } else if (paidAmount > totalAgreed && totalAgreed > 0) {
      statusText = 'Prejuízo';
      bgColor = 'bg-red-500';
      icon = 'fa-sack-xmark';
    } else if (paidAmount >= totalAgreed && totalAgreed > 0) {
      statusText = 'Concluído';
      bgColor = 'bg-green-500';
      icon = 'fa-check';
    } else if (paidAmount > 0) {
      statusText = 'Parcial';
      bgColor = 'bg-amber-500';
      icon = 'fa-hand-holding-dollar';
    } else {
      statusText = 'Pendente';
      bgColor = 'bg-slate-400';
      icon = 'fa-hourglass-start';
    }
  }

  return { statusText, bgColor, textColor, borderColor, shadowClass, icon };
};

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

interface ToolSubViewHeaderProps {
  title: string;
  onBack: () => void;
  onAdd?: () => void;
}

const ToolSubViewHeader: React.FC<ToolSubViewHeaderProps> = ({ title, onBack, onAdd }) => {
  return (
    <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <h2 className="text-2xl font-black text-primary dark:text-white">{title}</h2>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
        >
          <i className="fa-solid fa-plus"></i> Novo
        </button>
      )}
    </div>
  );
};

const WorkDetail = () => {
  const { id: workId } = ReactRouter.useParams<{ id: string }>();
  const navigate = ReactRouter.useNavigate();
  const { user, trialDaysRemaining, isUserAuthFinished, authLoading } = useAuth();
  const [searchParams] = ReactRouter.useSearchParams();

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
  const [activeTab, setActiveTab] = useState<MainTab>('ETAPAS');
  const [activeSubView, setActiveSubView] = useState<SubView>('NONE'); 
  const [materialFilterStepId, setMaterialFilterStepId] = useState('all');

  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepStartDate, setNewStepStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStepEndDate, setNewStepEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [editStepData, setEditStepData] = useState<Step | null>(null);
  const [isUpdatingStepStatus, setIsUpdatingStepStatus] = useState(false);

  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialBrand, setNewMaterialBrand] = useState('');
  const [newMaterialPlannedQty, setNewMaterialPlannedQty] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState('');
  const [newMaterialStepId, setNewMaterialStepId] = useState('');
  const [editMaterialData, setEditMaterialData] = useState<Material | null>(null);
  const [currentPurchaseQty, setCurrentPurchaseQty] = useState('');
  const [currentPurchaseCost, setCurrentPurchaseCost] = useState('');

  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory | string>(ExpenseCategory.OTHER);
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpenseStepId, setNewExpenseStepId] = useState(''); 
  const [newExpenseWorkerId, setNewExpenseWorkerId] = useState('');
  const [newExpenseSupplierId, setNewExpenseSupplierId] = useState('');
  const [editExpenseData, setEditExpenseData] = useState<Expense | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false); 
  const [paymentExpenseData, setPaymentExpenseData] = useState<Expense | null>(null); 
  const [paymentAmount, setPaymentAmount] = useState(''); 
  const [paymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]); 
  const [newExpenseTotalAgreed, setNewExpenseTotalAgreed] = useState<string>('');

  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [newWorkerDailyRate, setNewWorkerDailyRate] = useState('');
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

  const [zeModal, setZeModal] = useState<ZeModalProps & { isOpen: boolean, isConfirming?: boolean }>({
    isOpen: false, title: '', message: '', onCancel: () => { }, isConfirming: false
  });

  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

  const goToTab = useCallback((tab: MainTab) => {
    setActiveTab(tab);
    setActiveSubView('NONE'); 
    setMaterialFilterStepId('all'); 
    navigate(`/work/${workId}?tab=${tab}`, { replace: true });
  }, [workId, navigate]);

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
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

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

  const groupedExpensesByStep = useMemo<ExpenseStepGroup[]>(() => {
    const groups: { [key: string]: Expense[] } = {};
    expenses.forEach(expense => {
      const stepKey = expense.stepId || 'no_step';
      if (!groups[stepKey]) groups[stepKey] = [];
      groups[stepKey].push(expense);
    });
    const expenseGroups: ExpenseStepGroup[] = [];
    const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
    sortedSteps.forEach(step => {
      if (groups[step.id]) {
        expenseGroups.push({
          stepName: `${step.orderIndex}. ${step.name}`,
          expenses: groups[step.id].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          totalStepAmount: groups[step.id].reduce((sum, exp) => sum + exp.amount, 0),
        });
      }
    });
    if (groups['no_step']) {
      expenseGroups.push({
        stepName: 'Sem Etapa Definida',
        expenses: groups['no_step'].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        totalStepAmount: groups['no_step'].reduce((sum, exp) => sum + exp.amount, 0),
      });
    }
    return expenseGroups;
  }, [expenses, steps]);

  const loadWorkData = useCallback(async () => {
    if (!workId || !user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        navigate('/');
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
      setSteps(fetchedSteps);
      setExpenses(fetchedExpenses);
      setWorkers(fetchedWorkers);
      setSuppliers(fetchedSuppliers);
      setPhotos(fetchedPhotos);
      setFiles(fetchedFiles);
      setContracts(fetchedContracts);
      setChecklists(fetchedChecklists);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [workId, user, navigate]);

  useEffect(() => {
    if (!authLoading && isUserAuthFinished) {
      loadWorkData();
      const tabFromUrl = searchParams.get('tab') as MainTab;
      if (tabFromUrl) setActiveTab(tabFromUrl);
    }
  }, [authLoading, isUserAuthFinished, loadWorkData, searchParams]);

  /** * CORREÇÃO DA LÓGICA DE STATUS (TOGGLE)
   * O problema era que o switch não lidava com a transição Parcial -> Concluído corretamente
   * ou o dbService.updateStep estava faltando campos obrigatórios.
   */
  const handleStepStatusChange = useCallback(async (step: Step) => {
    if (isUpdatingStepStatus) return;
    setIsUpdatingStepStatus(true);

    // Mapeamento explícito de transição de estados
    const statusCycle: Record<StepStatus, StepStatus> = {
        [StepStatus.NOT_STARTED]: StepStatus.IN_PROGRESS,
        [StepStatus.IN_PROGRESS]: StepStatus.COMPLETED,
        [StepStatus.COMPLETED]: StepStatus.NOT_STARTED
    };

    const nextStatus = statusCycle[step.status] || StepStatus.NOT_STARTED;
    
    // Preparação dos dados auxiliares (Datas e Atraso)
    const todayStr = new Date().toISOString().split('T')[0];
    const newRealDate = nextStatus === StepStatus.COMPLETED ? todayStr : undefined;
    
    // Lógica de atraso simplificada para a atualização
    const endDate = new Date(step.endDate);
    endDate.setHours(0,0,0,0);
    const now = new Date();
    now.setHours(0,0,0,0);
    const isDelayed = nextStatus !== StepStatus.COMPLETED && now > endDate;

    try {
      // Criamos o objeto completo para garantir que o dbService receba tudo o que precisa
      const updatedStep: Step = {
        ...step,
        status: nextStatus,
        realDate: newRealDate,
        isDelayed: isDelayed
      };

      await dbService.updateStep(updatedStep);
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao alterar status:", error);
      setZeModal({
        isOpen: true,
        title: "Erro",
        message: "Não foi possível atualizar o status da etapa.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
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
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleEditStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStepData || !workId) return;
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateStep({ ...editStepData, workId });
      setEditStepData(null);
      setShowAddStepModal(false);
      await loadWorkData();
    } finally {
      setZeModal(prev => ({ ...prev, isConfirming: false }));
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.deleteStep(stepId, workId!);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
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

  const handleDragLeave = () => setDragOverStepId(null);

  const handleDrop = useCallback(async (e: React.DragEvent, targetStepId: string) => {
    e.preventDefault();
    if (!draggedStepId || !workId || draggedStepId === targetStepId) {
      setDragOverStepId(null);
      return;
    }
    const newStepsOrder = Array.from(steps);
    const draggedIndex = newStepsOrder.findIndex((s) => s.id === draggedStepId);
    const targetIndex = newStepsOrder.findIndex((s) => s.id === targetStepId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    const [reorderedItem] = newStepsOrder.splice(draggedIndex, 1);
    newStepsOrder.splice(targetIndex, 0, reorderedItem);
    const updatedSteps = newStepsOrder.map((step, index) => ({ ...step, orderIndex: index + 1 }));
    try {
      await Promise.all(updatedSteps.map(step => dbService.updateStep(step)));
      await loadWorkData();
    } finally {
      setDraggedStepId(null);
      setDragOverStepId(null);
    }
  }, [draggedStepId, steps, workId, loadWorkData]);

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newMaterialName) return;
    try {
      await dbService.addMaterial(user.id, {
        workId,
        name: newMaterialName,
        brand: newMaterialBrand,
        plannedQty: Number(newMaterialPlannedQty),
        purchasedQty: 0,
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
      });
      setShowAddMaterialModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleEditMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMaterialData || !workId) return;
    try {
      await dbService.updateMaterial({
        ...editMaterialData,
        name: newMaterialName,
        brand: newMaterialBrand,
        plannedQty: Number(newMaterialPlannedQty),
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
      });
      setEditMaterialData(null);
      setShowAddMaterialModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      await dbService.deleteMaterial(materialId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (e) { console.error(e); }
  };

  const handleRegisterMaterialPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMaterialData || !currentPurchaseQty || !currentPurchaseCost) return;
    try {
      await dbService.registerMaterialPurchase(
        editMaterialData.id,
        editMaterialData.name,
        editMaterialData.brand,
        editMaterialData.plannedQty,
        editMaterialData.unit,
        Number(currentPurchaseQty),
        Number(currentPurchaseCost)
      );
      setEditMaterialData(null);
      setShowAddMaterialModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newExpenseDescription) return;
    try {
      await dbService.addExpense({
        workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount),
        paidAmount: 0,
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        totalAgreed: newExpenseTotalAgreed ? Number(newExpenseTotalAgreed) : Number(newExpenseAmount),
      });
      setShowAddExpenseModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleEditExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExpenseData) return;
    try {
      await dbService.updateExpense({
        ...editExpenseData,
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
    } catch (e) { console.error(e); }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await dbService.deleteExpense(expenseId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (e) { console.error(e); }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentExpenseData || !paymentAmount) return;
    try {
      await dbService.addPaymentToExpense(paymentExpenseData.id, Number(paymentAmount), paymentDate);
      setShowAddPaymentModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newWorkerName) return;
    try {
      await dbService.addWorker({
        workId, userId: user.id, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone,
        dailyRate: Number(newWorkerDailyRate) || undefined, notes: newWorkerNotes,
      });
      setShowAddWorkerModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorkerData) return;
    try {
      await dbService.updateWorker({
        ...editWorkerData, name: newWorkerName, role: newWorkerRole, phone: newWorkerPhone,
        dailyRate: Number(newWorkerDailyRate) || undefined, notes: newWorkerNotes,
      });
      setEditWorkerData(null);
      setShowAddWorkerModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteWorker = async (workerId: string) => {
    try {
      await dbService.deleteWorker(workerId, workId!);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (e) { console.error(e); }
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !user?.id || !newSupplierName) return;
    try {
      await dbService.addSupplier({
        workId, userId: user.id, name: newSupplierName, category: newSupplierCategory, phone: newSupplierPhone,
        email: newSupplierEmail, address: newSupplierAddress, notes: newSupplierNotes,
      });
      setShowAddSupplierModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplierData) return;
    try {
      await dbService.updateSupplier({
        ...editSupplierData, name: newSupplierName, category: newSupplierCategory, phone: newSupplierPhone,
        email: newSupplierEmail, address: newSupplierAddress, notes: newSupplierNotes,
      });
      setEditSupplierData(null);
      setShowAddSupplierModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    try {
      await dbService.deleteSupplier(supplierId, workId!);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (e) { console.error(e); }
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
    } finally { setLoadingPhoto(false); }
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    try {
      const filePath = photoUrl.split('work_media/')[1];
      await supabase.storage.from('work_media').remove([filePath]);
      await dbService.deletePhoto(photoId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (e) { console.error(e); }
  };

  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newUploadFile) return;
    setLoadingFile(true);
    try {
      const fileExt = newUploadFile.name.split('.').pop();
      const filePath = `${workId}/docs/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('work_files').upload(filePath, newUploadFile);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('work_files').getPublicUrl(filePath);
      await dbService.addFile({
        workId, name: newFileName || newUploadFile.name, category: newFileCategory,
        url: publicUrlData.publicUrl, type: newUploadFile.type, date: new Date().toISOString().split('T')[0],
      });
      setShowAddFileModal(false);
      await loadWorkData();
    } finally { setLoadingFile(false); }
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    try {
      const filePath = fileUrl.split('work_files/')[1];
      await supabase.storage.from('work_files').remove([filePath]);
      await dbService.deleteFile(fileId);
      await loadWorkData();
      setZeModal(prev => ({ ...prev, isOpen: false }));
    } catch (e) { console.error(e); }
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newChecklistName) return;
    try {
      const items = newChecklistItems.filter(i => i.trim()).map((text, idx) => ({
        id: `item-${Date.now()}-${idx}`, text: text.trim(), checked: false
      }));
      await dbService.addChecklist({ workId, name: newChecklistName, category: newChecklistCategory, items });
      setShowAddChecklistModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleEditChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChecklistData) return;
    try {
      const items = newChecklistItems.filter(i => i.trim()).map((text, idx) => ({
        id: `item-${Date.now()}-${idx}`, text: text.trim(), checked: false
      }));
      await dbService.updateChecklist({ ...editChecklistData, name: newChecklistName, category: newChecklistCategory, items });
      setEditChecklistData(null);
      setShowAddChecklistModal(false);
      await loadWorkData();
    } catch (e) { console.error(e); }
  };

  const handleChecklistItemToggle = async (checklistId: string, itemId: string, checked: boolean) => {
    const cl = checklists.find(c => c.id === checklistId);
    if (!cl) return;
    const items = cl.items.map(i => i.id === itemId ? { ...i, checked } : i);
    await dbService.updateChecklist({ ...cl, items });
    await loadWorkData();
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    await dbService.deleteChecklist(checklistId);
    await loadWorkData();
    setZeModal(prev => ({ ...prev, isOpen: false }));
  };

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
              <button onClick={() => setShowAddStepModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl flex items-center gap-2">
                <i className="fa-solid fa-plus"></i> Nova Etapa
              </button>
            </div>
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
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, step.id)}
                            onClick={() => { 
                                setEditStepData(step); 
                                setShowAddStepModal(true); 
                            }}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStepStatusChange(step); }}
                                disabled={isUpdatingStepStatus}
                                className={cx(
                                    "w-10 h-10 rounded-full text-white flex items-center justify-center text-lg font-bold transition-colors shrink-0",
                                    statusDetails.bgColor,
                                    isUpdatingStepStatus ? 'opacity-70 cursor-not-allowed' : ''
                                )}
                            >
                                {isUpdatingStepStatus ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${statusDetails.icon}`}></i>}
                            </button>
                            <div className="flex-1">
                                <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">Etapa {step.orderIndex} <span className={statusDetails.textColor}>({statusDetails.statusText})</span></p>
                                <h3 className="text-lg font-bold text-primary dark:text-white leading-tight">{step.name}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}
                                    {step.realDate && <span className="ml-2 text-green-600 dark:text-green-400">(Concluído em: {formatDateDisplay(step.realDate)})</span>}
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-center gap-2">
                                <p className="font-bold text-primary dark:text-white">{calculateStepProgress(step.id).toFixed(0)}%</p>
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
                                >
                                    <i className="fa-solid fa-trash-alt text-lg"></i>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
          </>
        );

      case 'MATERIAIS':
        return (
          <>
            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
              <h2 className="text-2xl font-black text-primary dark:text-white">Materiais</h2>
              <button onClick={() => setShowAddMaterialModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl flex items-center gap-2">
                <i className="fa-solid fa-plus"></i> Novo Material
              </button>
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
                        <div key={material.id} onClick={() => { setEditMaterialData(material); setShowAddMaterialModal(true); }} className={cx(surface, `p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer border-2 ${statusDetails.borderColor} shadow-lg ${statusDetails.shadowClass}`)}>
                            <div className="flex-1 text-left w-full sm:w-auto">
                                <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">Material <span className={statusDetails.textColor}>({statusDetails.statusText})</span></p>
                                <h4 className="font-bold text-primary dark:text-white text-lg">{material.name}</h4>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mt-2">
                                    <div className="h-full bg-secondary rounded-full" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                            <div className="text-right w-full sm:w-auto">
                                <p className="text-sm font-bold text-green-600 dark:text-green-400">Comprado: {material.purchasedQty} / {material.plannedQty} {material.unit}</p>
                            </div>
                        </div>
                       );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        );

      case 'FINANCEIRO':
        return (
          <>
            <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
              <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
              <button onClick={() => setShowAddExpenseModal(true)} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl flex items-center gap-2">
                <i className="fa-solid fa-plus"></i> Nova Despesa
              </button>
            </div>
            <div className="space-y-6">
                {groupedExpensesByStep.map((group, idx) => (
                    <div key={idx}>
                        <h3 className="text-lg font-bold text-slate-500 mb-3 flex justify-between">
                            {group.stepName} <span>{formatCurrency(group.totalStepAmount)}</span>
                        </h3>
                        <div className="space-y-4">
                            {group.expenses.map(expense => (
                                <div key={expense.id} onClick={() => { setEditExpenseData(expense); setShowAddExpenseModal(true); }} className={cx(surface, "p-4 rounded-2xl flex justify-between items-center cursor-pointer")}>
                                    <div>
                                        <h4 className="font-bold text-primary dark:text-white">{expense.description}</h4>
                                        <p className="text-xs text-slate-500">{formatDateDisplay(expense.date)} - {expense.category}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-primary">{formatCurrency(expense.amount)}</p>
                                        <p className="text-xs text-green-600">Pago: {formatCurrency(expense.paidAmount || 0)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          </>
        );

      case 'FERRAMENTAS':
        return renderToolsSubView();

      default: return null;
    }
  };

  const renderToolsSubView = () => {
    switch (activeSubView) {
      case 'NONE':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ToolCard icon="fa-users-gear" title="Profissionais" description="Gerencie sua equipe." onClick={() => goToSubView('WORKERS')} />
            <ToolCard icon="fa-truck-field" title="Fornecedores" description="Organize contatos." onClick={() => goToSubView('SUPPLIERS')} />
            <ToolCard icon="fa-images" title="Fotos" description="Documente o progresso." onClick={() => goToSubView('PHOTOS')} />
            <ToolCard icon="fa-file-lines" title="Docs" description="Guarde plantas e licenças." onClick={() => goToSubView('PROJECTS')} />
            <ToolCard icon="fa-list-check" title="Checklists" description="Listas de verificação." onClick={() => goToSubView('CHECKLIST')} isLocked={!isVitalicio} requiresVitalicio />
          </div>
        );
      case 'WORKERS':
        return (
            <>
                <ToolSubViewHeader title="Profissionais" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddWorkerModal(true)} />
                <div className="space-y-4">
                    {workers.map(w => (
                        <div key={w.id} onClick={() => { setEditWorkerData(w); setShowAddWorkerModal(true); }} className={cx(surface, "p-4 rounded-2xl flex justify-between cursor-pointer")}>
                            <div><h3 className="font-bold">{w.name}</h3><p className="text-sm">{w.role}</p></div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteWorker(w.id); }} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
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
                    {suppliers.map(s => (
                        <div key={s.id} onClick={() => { setEditSupplierData(s); setShowAddSupplierModal(true); }} className={cx(surface, "p-4 rounded-2xl flex justify-between cursor-pointer")}>
                            <div><h3 className="font-bold">{s.name}</h3><p className="text-sm">{s.category}</p></div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(s.id); }} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
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
                    {photos.map(p => (
                        <div key={p.id} className="relative group rounded-xl overflow-hidden shadow-lg">
                            <img src={p.url} alt={p.description} className="w-full h-40 object-cover" />
                            <button onClick={() => handleDeletePhoto(p.id, p.url)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100"><i className="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    ))}
                </div>
            </>
        );
      case 'PROJECTS':
        return (
            <>
                <ToolSubViewHeader title="Documentos" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddFileModal(true)} />
                <div className="space-y-2">
                    {files.map(f => (
                        <div key={f.id} className={cx(surface, "p-4 rounded-xl flex justify-between")}>
                            <a href={f.url} target="_blank" className="font-bold text-primary">{f.name}</a>
                            <button onClick={() => handleDeleteFile(f.id, f.url)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                        </div>
                    ))}
                </div>
            </>
        );
      case 'CHECKLIST':
        return (
            <>
                <ToolSubViewHeader title="Checklists" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddChecklistModal(true)} />
                <div className="space-y-4">
                    {checklists.map(c => (
                        <div key={c.id} className={cx(surface, "p-4 rounded-2xl")}>
                            <div className="flex justify-between mb-2">
                                <h3 className="font-bold">{c.name}</h3>
                                <button onClick={() => handleDeleteChecklist(c.id)} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                            </div>
                            {c.items.map(i => (
                                <div key={i.id} className="flex items-center gap-2">
                                    <input type="checkbox" checked={i.checked} onChange={(e) => handleChecklistItemToggle(c.id, i.id, e.target.checked)} />
                                    <span className={i.checked ? 'line-through opacity-50' : ''}>{i.text}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </>
        );
      default: return null;
    }
  };

  const renderModal = () => {
    if (showAddStepModal) {
      return (
        <ZeModal
          isOpen={showAddStepModal}
          title={editStepData ? "Editar Etapa" : "Nova Etapa"}
          confirmText="Salvar"
          onConfirm={editStepData ? handleEditStep : handleAddStep}
          onCancel={() => { setShowAddStepModal(false); setEditStepData(null); }}
          isConfirming={zeModal.isConfirming}
        >
          <div className="space-y-4 pt-4">
            <input type="text" placeholder="Nome" value={editStepData ? editStepData.name : newStepName} onChange={e => editStepData ? setEditStepData({...editStepData, name: e.target.value}) : setNewStepName(e.target.value)} className="w-full p-3 border rounded-xl" />
            <input type="date" value={editStepData ? editStepData.startDate : newStepStartDate} onChange={e => editStepData ? setEditStepData({...editStepData, startDate: e.target.value}) : setNewStepStartDate(e.target.value)} className="w-full p-3 border rounded-xl" />
            <input type="date" value={editStepData ? editStepData.endDate : newStepEndDate} onChange={e => editStepData ? setEditStepData({...editStepData, endDate: e.target.value}) : setNewStepEndDate(e.target.value)} className="w-full p-3 border rounded-xl" />
            {editStepData && (
                <select value={editStepData.status} onChange={e => setEditStepData({...editStepData, status: e.target.value as StepStatus})} className="w-full p-3 border rounded-xl">
                    {Object.values(StepStatus).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            )}
          </div>
        </ZeModal>
      );
    }

    if (showAddMaterialModal) {
      return (
        <ZeModal
          isOpen={showAddMaterialModal}
          title={editMaterialData ? "Material" : "Novo Material"}
          confirmText="Salvar"
          onConfirm={editMaterialData ? handleEditMaterial : handleAddMaterial}
          onCancel={() => { setShowAddMaterialModal(false); setEditMaterialData(null); }}
        >
          <div className="space-y-4 pt-4">
            <input type="text" placeholder="Nome" value={editMaterialData ? editMaterialData.name : newMaterialName} onChange={e => editMaterialData ? setEditMaterialData({...editMaterialData, name: e.target.value}) : setNewMaterialName(e.target.value)} className="w-full p-3 border rounded-xl" />
            <input type="number" placeholder="Qtd" value={editMaterialData ? editMaterialData.plannedQty : newMaterialPlannedQty} onChange={e => editMaterialData ? setEditMaterialData({...editMaterialData, plannedQty: Number(e.target.value)}) : setNewMaterialPlannedQty(e.target.value)} className="w-full p-3 border rounded-xl" />
            {editMaterialData && (
                <div className="border-t pt-4">
                    <p className="font-bold mb-2">Registrar Compra</p>
                    <input type="number" placeholder="Qtd Comprada" value={currentPurchaseQty} onChange={e => setCurrentPurchaseQty(e.target.value)} className="w-full p-3 border rounded-xl mb-2" />
                    <input type="number" placeholder="Valor" value={currentPurchaseCost} onChange={e => setCurrentPurchaseCost(e.target.value)} className="w-full p-3 border rounded-xl" />
                    <button onClick={handleRegisterMaterialPurchase} className="w-full mt-2 py-2 bg-secondary text-white rounded-xl">Confirmar Compra</button>
                </div>
            )}
          </div>
        </ZeModal>
      );
    }
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-6 px-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/')} className="text-slate-400 p-2"><i className="fa-solid fa-arrow-left text-xl"></i></button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white">Obra: {work.name}</h1>
          <p className="text-sm text-slate-500">{work.address}</p>
        </div>
      </div>
      <div className={cx(surface, card)}>
        {renderMainContent()}
      </div>
      {renderModal()}
      {zeModal.isOpen && <ZeModal {...zeModal} />}
    </div>
  );
};

export default WorkDetail;
