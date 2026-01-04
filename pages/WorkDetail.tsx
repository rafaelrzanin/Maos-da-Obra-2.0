
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as ReactRouter from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile, type Contract, type Checklist, type ChecklistItem, PlanType } from '../types.ts';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CONTRACT_TEMPLATES, CHECKLIST_TEMPLATES } from '../services/standards.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx';
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


  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newMaterialPlannedQty, setNewMaterialPlannedQty] = useState('');
  const [newMaterialUnit, setNewMaterialUnit] = useState('');
  const [newMaterialCategory, setNewMaterialCategory] = useState('');
  const [newMaterialStepId, setNewMaterialStepId] = useState('');
  const [editMaterialData, setEditMaterialData] = useState<Material | null>(null);
  // NEW: States for material purchase within the edit modal
  const [currentPurchaseQty, setCurrentPurchaseQty] = useState('');
  const [currentPurchaseCost, setCurrentPurchaseCost] = useState('');


  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory | string>(ExpenseCategory.OTHER);
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExpenseStepId, setNewExpenseStepId] = useState(''); 
  // NEW: States for worker and supplier linking in expense modal
  const [newExpenseWorkerId, setNewExpenseWorkerId] = useState('');
  const [newExpenseSupplierId, setNewExpenseSupplierId] = useState('');
  const [editExpenseData, setEditExpenseData] = useState<Expense | null>(null);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false); 
  const [paymentExpenseData, setPaymentExpenseData] = useState<Expense | null>(null); 
  const [paymentAmount, setPaymentAmount] = useState(''); 
  const [paymentDate, setNewPaymentDate] = useState(new Date().toISOString().split('T')[0]); 

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

  const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string, isConfirming?: boolean }>({
    isOpen: false, title: '', message: '', onCancel: () => { }, isConfirming: false
  });

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

    // Group materials by step, preserving step order
    steps.forEach(step => {
      const materialsForStep = filteredMaterials.filter(m => m.stepId === step.id);
      if (materialsForStep.length > 0) {
        groups[step.id] = materialsForStep.sort((a, b) => a.name.localeCompare(b.name));
        stepOrder.push(step.id);
      }
    });

    return stepOrder.map(stepId => ({
      stepName: steps.find(s => s.id === stepId)?.name || 'Sem Etapa',
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
    
    // Add expenses linked to steps, in step order
    steps.forEach(step => {
      if (groups[step.id]) {
        expenseGroups.push({
          stepName: step.name,
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
      navigate('/'); // Redirect if no workId or user
      return;
    }

    setLoading(true);
    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) {
        navigate('/'); // Redirect if work not found or not owned by user
        return;
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

      setSteps(fetchedSteps);
      setMaterials(fetchedMaterials);
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
    if (step.isDelayed) {
        setZeModal({
            isOpen: true,
            title: "Etapa Atrasada",
            message: "Esta etapa está atrasada e não pode ter seu status alterado manualmente. Ajuste as datas para remover o atraso.",
            type: "WARNING",
            confirmText: "Entendido",
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
        });
        return;
    }

    let newStatus: StepStatus;
    let newRealDate: string | undefined = undefined;

    switch (step.status) {
      case StepStatus.NOT_STARTED:
        newStatus = StepStatus.IN_PROGRESS;
        break;
      case StepStatus.IN_PROGRESS:
        newStatus = StepStatus.COMPLETED;
        newRealDate = new Date().toISOString().split('T')[0]; // Set real completion date
        break;
      case StepStatus.COMPLETED:
        newStatus = StepStatus.NOT_STARTED; // Cycle back to NOT_STARTED
        newRealDate = undefined; // Clear real completion date
        break;
      default:
        newStatus = StepStatus.NOT_STARTED;
    }

    try {
      await dbService.updateStep({ ...step, status: newStatus, realDate: newRealDate });
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao alterar status da etapa:", error);
      setZeModal({
        isOpen: true,
        title: "Erro ao Atualizar Status",
        message: "Não foi possível atualizar o status da etapa. Tente novamente.",
        type: "ERROR",
        confirmText: "Ok",
        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false }))
      });
    }
  }, [loadWorkData]);

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newStepName) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addStep({
        workId,
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
    e.preventDefault();
    if (!editStepData || !workId) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.updateStep({
        ...editStepData,
        workId,
        isDelayed: new Date(editStepData.endDate) < new Date() && editStepData.status !== StepStatus.COMPLETED
      });
      setEditStepData(null);
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
    const draggedIndex = newStepsOrder.findIndex(s => s.id === draggedStepId);
    const targetIndex = newStepsOrder.findIndex(s => s.id === targetStepId);

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
  }, [draggedStepId, steps, workId, loadWorkData]);


  // =======================================================================
  // CRUD HANDLERS: MATERIALS
  // =======================================================================

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newMaterialName || !newMaterialPlannedQty || !newMaterialUnit) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
    try {
      await dbService.addMaterial({
        workId,
        name: newMaterialName,
        plannedQty: Number(newMaterialPlannedQty),
        purchasedQty: 0,
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
      });
      setShowAddMaterialModal(false);
      setNewMaterialName('');
      setNewMaterialPlannedQty('');
      setNewMaterialUnit('');
      setNewMaterialCategory('');
      setNewMaterialStepId('');
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
      await dbService.updateMaterial({
        ...editMaterialData,
        workId,
        name: newMaterialName,
        plannedQty: Number(newMaterialPlannedQty),
        unit: newMaterialUnit,
        category: newMaterialCategory,
        stepId: newMaterialStepId === 'none' ? undefined : newMaterialStepId,
      });
      setEditMaterialData(null);
      setShowAddMaterialModal(false); // Close the modal
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao editar material:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Editar Material",
        message: "Não foi possível editar o material. Tente novamente.",
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

  const handleRegisterMaterialPurchase = async () => {
    if (!editMaterialData || !workId || !currentPurchaseQty || !currentPurchaseCost) return;

    setZeModal(prev => ({ ...prev, isConfirming: true }));
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
      setCurrentPurchaseQty('');
      setCurrentPurchaseCost('');
      setEditMaterialData(null); // Close the edit modal after purchase
      setShowAddMaterialModal(false); // Ensure modal closes
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao registrar compra de material:", error);
      setZeModal(prev => ({
        ...prev,
        isConfirming: false,
        title: "Erro ao Registrar Compra",
        message: "Não foi possível registrar a compra. Tente novamente.",
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
        workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount),
        paidAmount: Number(newExpenseAmount), // Assume full payment on add
        quantity: 1, // Default to 1 for generic expenses
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        totalAgreed: Number(newExpenseAmount),
      });
      setShowAddExpenseModal(false);
      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setNewExpenseCategory(ExpenseCategory.OTHER);
      setNewExpenseDate(new Date().toISOString().split('T')[0]);
      setNewExpenseStepId('');
      setNewExpenseWorkerId('');
      setNewExpenseSupplierId('');
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
        workId,
        description: newExpenseDescription,
        amount: Number(newExpenseAmount),
        date: newExpenseDate,
        category: newExpenseCategory,
        stepId: newExpenseStepId === 'none' ? undefined : newExpenseStepId,
        workerId: newExpenseWorkerId === 'none' ? undefined : newExpenseWorkerId,
        supplierId: newExpenseSupplierId === 'none' ? undefined : newExpenseSupplierId,
        totalAgreed: Number(newExpenseAmount),
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
        Number(paymentAmount),
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
        workId,
        userId: user.id,
        name: newWorkerName,
        role: newWorkerRole,
        phone: newWorkerPhone,
        dailyRate: Number(newWorkerDailyRate) || undefined,
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
        dailyRate: Number(newWorkerDailyRate) || undefined,
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
        workId,
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
        workId,
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
      const filePath = photoUrl.split('work_media/')[1]; // Extract path from URL
      const { error: storageError } = await supabase.storage.from('work_media').remove([filePath]);
      if (storageError) throw storageError;

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
        workId,
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
      if (storageError) throw storageError;

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
        workId,
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
                onClick={() => setShowAddStepModal(true)}
                className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                aria-label="Adicionar nova etapa"
              >
                <i className="fa-solid fa-plus"></i> Nova Etapa
              </button>
            </div>
            
            {steps.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhuma etapa cadastrada ainda.</p>
                    <button onClick={() => setShowAddStepModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar sua primeira etapa
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {steps.map((step) => {
                        const isDelayed = new Date(step.endDate) < new Date() && step.status !== StepStatus.COMPLETED;
                        let statusColorClass = '';
                        let statusIcon = '';
                        switch (step.status) {
                            case StepStatus.NOT_STARTED: statusColorClass = 'bg-slate-400'; statusIcon = 'fa-hourglass-start'; break;
                            case StepStatus.IN_PROGRESS: statusColorClass = 'bg-amber-500'; statusIcon = 'fa-hourglass-half'; break;
                            case StepStatus.COMPLETED: statusColorClass = 'bg-green-500'; statusIcon = 'fa-check'; break;
                        }
                        if (isDelayed) {
                          statusColorClass = 'bg-red-500'; statusIcon = 'fa-exclamation-triangle';
                        }
                        
                        return (
                            <div
                                key={step.id}
                                className={cx(
                                    surface,
                                    "p-4 rounded-2xl flex items-center gap-4 transition-all hover:scale-[1.005]",
                                    draggedStepId === step.id && "opacity-50",
                                    dragOverStepId === step.id && "border-2 border-secondary", // Highlight drag target
                                    isDelayed && "border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-900/10" // Highlight delayed steps
                                )}
                                draggable
                                onDragStart={(e) => handleDragStart(e, step.id)}
                                onDragOver={(e) => handleDragOver(e, step.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, step.id)}
                                onClick={() => { setEditStepData(step); setShowAddStepModal(true); }} // Open edit modal on card click
                                role="listitem"
                                aria-label={`Etapa ${step.name}, status: ${step.status}`}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleStepStatusChange(step); }} // Prevent card click
                                    className={cx(
                                        "w-8 h-8 rounded-full text-white flex items-center justify-center text-sm font-bold transition-colors shrink-0",
                                        statusColorClass,
                                        isDelayed && "opacity-50 cursor-not-allowed" // Disable button if delayed
                                    )}
                                    disabled={isDelayed}
                                    aria-label={`Mudar status da etapa ${step.name}`}
                                >
                                    <i className={`fa-solid ${statusIcon}`}></i>
                                </button>
                                <div className="flex-1">
                                    <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5">Etapa {step.orderIndex}</p>
                                    <h3 className="text-lg font-bold text-primary dark:text-white leading-tight">{step.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}
                                        {step.realDate && <span className="ml-2 text-green-600 dark:text-green-400">(Concluído em: {formatDateDisplay(step.realDate)})</span>}
                                    </p>
                                    {isDelayed && (
                                        <p className="text-xs font-bold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                                            <i className="fa-solid fa-clock"></i> ATRASADA!
                                        </p>
                                    )}
                                </div>
                                <div className="text-right text-sm">
                                    <p className="font-bold text-primary dark:text-white">{calculateStepProgress(step.id).toFixed(0)}%</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Progresso Materiais</p>
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
                onClick={() => setShowAddMaterialModal(true)}
                className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
                aria-label="Adicionar novo material"
              >
                <i className="fa-solid fa-plus"></i> Novo Material
              </button>
            </div>
            {materials.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhum material cadastrado ainda.</p>
                    <button onClick={() => setShowAddMaterialModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
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
                      <option key={step.id} value={step.id}>{step.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-6">
                  {groupedMaterials.map(group => (
                    <div key={group.stepId}>
                      <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400 mb-3 px-2 sm:px-0">{group.stepName}</h3>
                      <div className="space-y-4">
                        {group.materials.map(material => (
                          <div key={material.id} onClick={() => { setEditMaterialData(material); setShowAddMaterialModal(true); }} className={cx(surface, "p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer hover:scale-[1.005] transition-transform")} aria-label={`Material ${material.name}`}>
                            <div className="flex-1 text-left w-full sm:w-auto">
                              <h4 className="font-bold text-primary dark:text-white text-lg">{material.name}</h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{material.brand || 'Marca não informada'}</p>
                            </div>
                            <div className="text-center sm:text-right w-full sm:w-auto">
                              <p className="text-sm text-slate-700 dark:text-slate-300">Planejado: <span className="font-bold">{material.plannedQty} {material.unit}</span></p>
                              <p className="text-sm text-slate-700 dark:text-slate-300">Comprado: <span className="font-bold text-green-600">{material.purchasedQty} {material.unit}</span></p>
                              {material.totalCost !== undefined && <p className="text-xs text-slate-500 dark:text-slate-400">Custo Total: {formatCurrency(material.totalCost)}</p>}
                            </div>
                          </div>
                        ))}
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
                onClick={() => setShowAddExpenseModal(true)}
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
                    <button onClick={() => setShowAddExpenseModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
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
                                    const isPaid = (expense.paidAmount || 0) >= expense.amount;
                                    const isPartial = (expense.paidAmount || 0) > 0 && !isPaid;
                                    const remainingToPay = expense.amount - (expense.paidAmount || 0);

                                    return (
                                        <div key={expense.id} onClick={() => { setEditExpenseData(expense); setShowAddExpenseModal(true); }} className={cx(surface, "p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer hover:scale-[1.005] transition-transform")} aria-label={`Despesa ${expense.description}`}>
                                            <div className="flex-1 text-left w-full sm:w-auto">
                                                <h4 className="font-bold text-primary dark:text-white text-lg">{expense.description}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateDisplay(expense.date)} - {expense.category}</p>
                                                {expense.workerId && <p className="text-xs text-slate-500 dark:text-slate-400">Profissional: {workers.find(w => w.id === expense.workerId)?.name}</p>}
                                                {expense.supplierId && <p className="text-xs text-slate-500 dark:text-slate-400">Fornecedor: {suppliers.find(s => s.id === expense.supplierId)?.name}</p>}
                                            </div>
                                            <div className="text-center sm:text-right w-full sm:w-auto flex flex-col items-end gap-1">
                                                <p className="text-sm text-slate-700 dark:text-slate-300">Valor: <span className="font-bold">{formatCurrency(expense.amount)}</span></p>
                                                <p className={cx("text-sm", isPaid ? "text-green-600 dark:text-green-400" : isPartial ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>
                                                    Pago: <span className="font-bold">{formatCurrency(expense.paidAmount || 0)}</span>
                                                </p>
                                                {!isPaid && (
                                                    <button onClick={(e) => { e.stopPropagation(); setPaymentExpenseData(expense); setShowAddPaymentModal(true); }} className="text-xs text-secondary hover:underline" aria-label={`Adicionar pagamento para despesa ${expense.description}`}>
                                                        Pagar {formatCurrency(remainingToPay)}
                                                    </button>
                                                )}
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
              
              <ToolCard
                icon="fa-robot"
                title="Planejamento Inteligente AI"
                description="Deixe a IA planejar e analisar riscos da sua obra."
                onClick={() => hasAiAccess ? navigate(`/work/${workId}/ai-planner`) : setZeModal({
                  isOpen: true,
                  title: "Acesso Vitalício Necessário",
                  message: "Para usar o Planejamento Inteligente AI, você precisa ter o plano Vitalício ou estar em período de teste. Desbloqueie essa ferramenta para otimizar sua obra!",
                  confirmText: "Ver Planos",
                  onConfirm: async () => navigate('/settings'),
                  onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                  type: "WARNING"
                })}
                isLocked={!hasAiAccess}
              />
              <ToolCard
                icon="fa-file-contract"
                title="Gerador de Contratos"
                description="Crie contratos profissionais de mão de obra e serviços em segundos."
                onClick={() => hasAiAccess ? goToSubView('CONTRACTS') : setZeModal({
                  isOpen: true,
                  title: "Acesso Vitalício Necessário",
                  message: "Esta ferramenta é exclusiva para assinantes Vitalícios ou durante o período de teste da IA. Adquira já seu acesso para ter contratos prontos e personalizados!",
                  confirmText: "Ver Planos",
                  onConfirm: async () => navigate('/settings'),
                  onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                  type: "WARNING"
                })}
                isLocked={!hasAiAccess}
              />
              <ToolCard
                icon="fa-list-check"
                title="Checklists Inteligentes"
                description="Listas de verificação para cada etapa, garantindo que nada seja esquecido."
                onClick={() => hasAiAccess ? goToSubView('CHECKLIST') : setZeModal({
                  isOpen: true,
                  title: "Acesso Vitalício Necessário",
                  message: "Para acessar os Checklists Inteligentes, você precisa ter o plano Vitalício ou estar em período de teste da IA. Não perca nenhum detalhe na sua obra!",
                  confirmText: "Ver Planos",
                  onConfirm: async () => navigate('/settings'),
                  onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                  type: "WARNING"
                })}
                isLocked={!hasAiAccess}
              />
              <ToolCard
                icon="fa-calculator"
                title="Calculadoras de Materiais"
                description="Calcule quantidades de pisos, tintas, blocos, etc."
                onClick={() => hasAiAccess ? goToSubView('CALCULATORS') : setZeModal({
                  isOpen: true,
                  title: "Acesso Vitalício Necessário",
                  message: "As Calculadoras Avançadas são exclusivas para assinantes Vitalícios ou durante o período de teste da IA. Evite o desperdício de material!",
                  confirmText: "Ver Planos",
                  onConfirm: async () => navigate('/settings'),
                  onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                  type: "WARNING"
                })}
                isLocked={!hasAiAccess}
              />
              <ToolCard
                icon="fa-chart-line"
                title="Relatórios Completos"
                description="Análise detalhada de cronograma, materiais e finanças (PDF/Excel)."
                onClick={() => hasAiAccess ? navigate(`/work/${workId}/reports`) : setZeModal({ // Direct navigation
                  isOpen: true,
                  title: "Acesso Vitalício Necessário",
                  message: "Os Relatórios Completos são exclusivos para assinantes Vitalícios ou durante o período de teste da IA. Tenha a visão total da sua obra!",
                  confirmText: "Ver Planos",
                  onConfirm: async () => navigate('/settings'),
                  onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                  type: "WARNING"
                })}
                isLocked={!hasAiAccess}
              />
            </div>
          </>
        );
      
      case 'WORKERS':
        return (
          <>
            <ToolSubViewHeader title="Profissionais" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddWorkerModal(true)} />
            {workers.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhum profissional cadastrado ainda.</p>
                    <button onClick={() => setShowAddWorkerModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar seu primeiro profissional
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {workers.map(worker => (
                        <div key={worker.id} onClick={() => { setEditWorkerData(worker); setShowAddWorkerModal(true); }} className={cx(surface, "p-4 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.005] transition-transform")}>
                            <div>
                                <h3 className="font-bold text-primary dark:text-white text-lg">{worker.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{worker.role} - {worker.phone}</p>
                                {worker.dailyRate && <p className="text-xs text-slate-500 dark:text-slate-400">Diária: {formatCurrency(worker.dailyRate)}</p>}
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setZeModal({
                                    isOpen: true,
                                    title: "Excluir Profissional",
                                    message: `Tem certeza que deseja excluir o profissional ${worker.name}?`,
                                    confirmText: "Excluir",
                                    onConfirm: async () => handleDeleteWorker(worker.id),
                                    onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                    type: "DANGER"
                                }); }}
                                className="text-slate-400 hover:text-red-500 transition-colors p-2"
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
            <ToolSubViewHeader title="Fornecedores" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddSupplierModal(true)} />
            {suppliers.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhum fornecedor cadastrado ainda.</p>
                    <button onClick={() => setShowAddSupplierModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar seu primeiro fornecedor
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {suppliers.map(supplier => (
                        <div key={supplier.id} onClick={() => { setEditSupplierData(supplier); setShowAddSupplierModal(true); }} className={cx(surface, "p-4 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.005] transition-transform")}>
                            <div>
                                <h3 className="font-bold text-primary dark:text-white text-lg">{supplier.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{supplier.category} - {supplier.phone}</p>
                                {supplier.email && <p className="text-xs text-slate-500 dark:text-slate-400">{supplier.email}</p>}
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setZeModal({
                                    isOpen: true,
                                    title: "Excluir Fornecedor",
                                    message: `Tem certeza que deseja excluir o fornecedor ${supplier.name}?`,
                                    confirmText: "Excluir",
                                    onConfirm: async () => handleDeleteSupplier(supplier.id),
                                    onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                    type: "DANGER"
                                }); }}
                                className="text-slate-400 hover:text-red-500 transition-colors p-2"
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
                        <p className="text-lg mb-4">Nenhuma foto adicionada ainda.</p>
                        <button onClick={() => setShowAddPhotoModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                            Adicionar sua primeira foto
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {photos.map(photo => (
                            <div key={photo.id} className={cx(surface, "p-4 rounded-2xl flex flex-col")}>
                                <img src={photo.url} alt={photo.description} className="w-full h-48 object-cover rounded-xl mb-3" />
                                <h3 className="font-bold text-primary dark:text-white text-base leading-tight">{photo.description}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{formatDateDisplay(photo.date)} - {photo.type}</p>
                                <button
                                    onClick={() => setZeModal({
                                        isOpen: true,
                                        title: "Excluir Foto",
                                        message: `Tem certeza que deseja excluir esta foto?`,
                                        confirmText: "Excluir",
                                        onConfirm: async () => handleDeletePhoto(photo.id, photo.url),
                                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                        type: "DANGER"
                                    })}
                                    className="mt-3 text-red-500 hover:text-red-700 text-sm self-start"
                                    aria-label={`Excluir foto: ${photo.description}`}
                                >
                                    <i className="fa-solid fa-trash-alt mr-2"></i> Excluir
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
                        <p className="text-lg mb-4">Nenhum arquivo adicionado ainda.</p>
                        <button onClick={() => setShowAddFileModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                            Adicionar seu primeiro arquivo
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {files.map(file => (
                            <div key={file.id} className={cx(surface, "p-4 rounded-2xl flex items-center justify-between gap-4")}>
                                <div className="flex items-center gap-3 flex-1">
                                    <i className="fa-solid fa-file-pdf text-red-500 text-2xl" aria-hidden="true"></i> {/* Generic icon */}
                                    <div>
                                        <h3 className="font-bold text-primary dark:text-white text-base leading-tight">{file.name}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{file.category} - {formatDateDisplay(file.date)}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 text-primary dark:text-white hover:text-secondary transition-colors" aria-label={`Visualizar ${file.name}`}>
                                        <i className="fa-solid fa-eye text-lg"></i>
                                    </a>
                                    <button
                                        onClick={() => setZeModal({
                                            isOpen: true,
                                            title: "Excluir Arquivo",
                                            message: `Tem certeza que deseja excluir o arquivo ${file.name}?`,
                                            confirmText: "Excluir",
                                            onConfirm: async () => handleDeleteFile(file.id, file.url),
                                            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                            type: "DANGER"
                                        })}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                        aria-label={`Excluir arquivo: ${file.name}`}
                                    >
                                        <i className="fa-solid fa-trash-alt text-lg"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        );

      case 'CALCULATORS':
        return (
          <>
            <ToolSubViewHeader title="Calculadoras de Materiais" onBack={() => goToSubView('NONE')} />
            <div className={cx(surface, card, "text-center", mutedText)}>
              <p className="text-lg mb-4">Calculadoras de materiais em desenvolvimento.</p>
              <p className="text-sm">Em breve você poderá calcular pisos, tintas, blocos e muito mais!</p>
            </div>
          </>
        );

      case 'CONTRACTS':
        return (
          <>
            <ToolSubViewHeader title="Gerador de Contratos" onBack={() => goToSubView('NONE')} onAdd={() => setZeModal({
                isOpen: true,
                title: "Gerar Novo Contrato",
                message: "Selecione um modelo de contrato para gerar.",
                children: (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {contracts.map(contract => (
                            <button
                                key={contract.id}
                                onClick={async () => {
                                    setZeModal(prev => ({ ...prev, isConfirming: true })); // Indicate loading
                                    // Navigate to a temporary view or trigger an action to fill the template
                                    // For now, let's just show it in a modal
                                    setZeModal({
                                        isOpen: true,
                                        title: contract.title,
                                        message: "", // Empty message for children rendering
                                        children: (
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm leading-relaxed border border-slate-100 dark:border-slate-700 max-h-96 overflow-y-auto">
                                                <pre className="whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300 text-xs">{contract.contentTemplate}</pre>
                                            </div>
                                        ),
                                        confirmText: "Fechar",
                                        onConfirm: async () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                        type: "INFO"
                                    });
                                }}
                                className="w-full text-left p-3 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
                            >
                                <p className="font-bold text-primary dark:text-white">{contract.title}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{contract.category}</p>
                            </button>
                        ))}
                    </div>
                ),
                confirmText: "Fechar", // Changed to close button
                onConfirm: async () => setZeModal(prev => ({ ...prev, isOpen: false })),
                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                type: "INFO"
            })}/>
            {contracts.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhum modelo de contrato disponível.</p>
                    <p className="text-sm">Contacte o suporte para adicionar mais modelos.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {contracts.map(contract => (
                        <div key={contract.id} onClick={async () => {
                            setZeModal({
                                isOpen: true,
                                title: contract.title,
                                message: "", // Empty message for children rendering
                                children: (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm leading-relaxed border border-slate-100 dark:border-slate-700 max-h-96 overflow-y-auto">
                                        <pre className="whitespace-pre-wrap font-mono text-slate-700 dark:text-slate-300 text-xs">{contract.contentTemplate}</pre>
                                    </div>
                                ),
                                confirmText: "Fechar",
                                onConfirm: async () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                type: "INFO"
                            });
                        }} className={cx(surface, "p-4 rounded-2xl flex items-center justify-between gap-4 cursor-pointer hover:scale-[1.005] transition-transform")}>
                            <div>
                                <h3 className="font-bold text-primary dark:text-white text-lg">{contract.title}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{contract.category}</p>
                            </div>
                            <button className="p-2 text-secondary hover:text-secondary-dark transition-colors" aria-label={`Ver contrato ${contract.title}`}>
                                <i className="fa-solid fa-file-contract text-lg"></i>
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
            <ToolSubViewHeader title="Checklists Inteligentes" onBack={() => goToSubView('NONE')} onAdd={() => setShowAddChecklistModal(true)} />
            {checklists.length === 0 ? (
                <div className={cx(surface, "rounded-3xl p-8 text-center", mutedText)}>
                    <p className="text-lg mb-4">Nenhum checklist cadastrado ainda.</p>
                    <button onClick={() => setShowAddChecklistModal(true)} className="px-6 py-3 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors">
                        Adicionar seu primeiro checklist
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {checklists.map(checklist => (
                        <div key={checklist.id} className={cx(surface, "p-4 rounded-2xl flex flex-col")}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-primary dark:text-white text-lg">{checklist.name}</h3>
                                <div className="flex gap-2">
                                  <button onClick={() => {
                                      setEditChecklistData(checklist);
                                      setNewChecklistName(checklist.name);
                                      setNewChecklistCategory(checklist.category);
                                      setNewChecklistItems(checklist.items.map(item => item.text));
                                      setShowAddChecklistModal(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-secondary transition-colors" aria-label={`Editar checklist ${checklist.name}`}>
                                    <i className="fa-solid fa-pencil text-lg"></i>
                                  </button>
                                  <button
                                      onClick={() => setZeModal({
                                          isOpen: true,
                                          title: "Excluir Checklist",
                                          message: `Tem certeza que deseja excluir o checklist ${checklist.name}?`,
                                          confirmText: "Excluir",
                                          onConfirm: async () => handleDeleteChecklist(checklist.id),
                                          onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                                          type: "DANGER"
                                      })}
                                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                      aria-label={`Excluir checklist ${checklist.name}`}
                                  >
                                      <i className="fa-solid fa-trash-alt text-lg"></i>
                                  </button>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Categoria: {checklist.category}</p>
                            <div className="space-y-2">
                                {checklist.items.map(item => (
                                    <div key={item.id} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={(e) => handleChecklistItemToggle(checklist.id, item.id, e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary mr-3"
                                        />
                                        <label className={`text-sm text-primary dark:text-white ${item.checked ? 'line-through text-slate-500 dark:text-slate-600' : ''}`}>
                                            {item.text}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </>
        );
      
      // Removed AIPLANNER sub-view here as it's now a direct route
      // Removed REPORTS sub-view here as it's now a direct route

      default:
        return (
          <div className="text-center text-slate-400 py-10 italic text-lg">
            Selecione uma ferramenta.
          </div>
        );
    }
  };


  // =======================================================================
  // MODAL COMPONENTS
  // =======================================================================
  
  const AddEditStepModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative")}>
        <button onClick={() => { setShowAddStepModal(false); setEditStepData(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editStepData ? `Editar Etapa: ${editStepData.name}` : 'Adicionar Nova Etapa'}</h3>
        <form onSubmit={editStepData ? handleEditStep : handleAddStep} className="space-y-4">
          <div>
            <label htmlFor="stepName" className="block text-sm font-bold text-slate-500 uppercase mb-2">Nome da Etapa</label>
            <input
              type="text"
              id="stepName"
              value={editStepData ? editStepData.name : newStepName}
              onChange={(e) => editStepData ? setEditStepData({ ...editStepData, name: e.target.value }) : setNewStepName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Nome da etapa"
            />
          </div>
          <div>
            <label htmlFor="stepStartDate" className="block text-sm font-bold text-slate-500 uppercase mb-2">Data de Início</label>
            <input
              type="date"
              id="stepStartDate"
              value={editStepData ? editStepData.startDate : newStepStartDate}
              onChange={(e) => editStepData ? setEditStepData({ ...editStepData, startDate: e.target.value }) : setNewStepStartDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Data de início da etapa"
            />
          </div>
          <div>
            <label htmlFor="stepEndDate" className="block text-sm font-bold text-slate-500 uppercase mb-2">Data de Fim</label>
            <input
              type="date"
              id="stepEndDate"
              value={editStepData ? editStepData.endDate : newStepEndDate}
              onChange={(e) => editStepData ? setEditStepData({ ...editStepData, endDate: e.target.value }) : setNewStepEndDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Data de fim da etapa"
            />
          </div>
          {editStepData && (
              <div className="flex items-center gap-2">
                <label className="block text-sm font-bold text-slate-500 uppercase">Status:</label>
                <select
                  value={editStepData.status}
                  onChange={(e) => setEditStepData({ ...editStepData, status: e.target.value as StepStatus, realDate: e.target.value === StepStatus.COMPLETED ? (editStepData.realDate || new Date().toISOString().split('T')[0]) : undefined })}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white focus:ring-2 focus:ring-secondary/20 focus:border-secondary"
                  aria-label="Status da etapa"
                >
                  <option value={StepStatus.NOT_STARTED}>Não Iniciada</option>
                  <option value={StepStatus.IN_PROGRESS}>Em Andamento</option>
                  <option value={StepStatus.COMPLETED}>Concluída</option>
                </select>
              </div>
            )}
          <div className="flex justify-between gap-3 mt-6">
            {editStepData && (
                <button
                    type="button"
                    onClick={() => setZeModal({
                        isOpen: true,
                        title: "Excluir Etapa",
                        message: `Tem certeza que deseja excluir a etapa ${editStepData.name}?`,
                        confirmText: "Excluir",
                        onConfirm: async () => handleDeleteStep(editStepData.id),
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: "DANGER"
                    })}
                    className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    aria-label={`Excluir etapa ${editStepData.name}`}
                >
                    <i className="fa-solid fa-trash-alt"></i> Excluir
                </button>
            )}
            <button
              type="submit"
              disabled={zeModal.isConfirming}
              className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label={editStepData ? "Salvar alterações da etapa" : "Adicionar etapa"}
            >
              {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
              {editStepData ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const AddEditMaterialModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto")}> {/* Added max-h and overflow-y-auto */}
        <button onClick={() => { setShowAddMaterialModal(false); setEditMaterialData(null); setCurrentPurchaseQty(''); setCurrentPurchaseCost(''); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editMaterialData ? `Editar Material: ${editMaterialData.name}` : 'Adicionar Novo Material'}</h3>
        <form onSubmit={editMaterialData ? handleEditMaterial : handleAddMaterial} className="space-y-4">
          <div>
            <label htmlFor="materialName" className="block text-sm font-bold text-slate-500 uppercase mb-2">Nome do Material</label>
            <input
              type="text"
              id="materialName"
              value={editMaterialData ? editMaterialData.name : newMaterialName}
              onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, name: e.target.value }) : setNewMaterialName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Nome do material"
            />
          </div>
          <div>
            <label htmlFor="materialPlannedQty" className="block text-sm font-bold text-slate-500 uppercase mb-2">Quantidade Planejada</label>
            <input
              type="number"
              id="materialPlannedQty"
              value={editMaterialData ? editMaterialData.plannedQty : newMaterialPlannedQty}
              onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, plannedQty: Number(e.target.value) }) : setNewMaterialPlannedQty(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              min="0"
              aria-label="Quantidade planejada"
            />
          </div>
          <div>
            <label htmlFor="materialUnit" className="block text-sm font-bold text-slate-500 uppercase mb-2">Unidade</label>
            <input
              type="text"
              id="materialUnit"
              value={editMaterialData ? editMaterialData.unit : newMaterialUnit}
              onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, unit: e.target.value }) : setNewMaterialUnit(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Unidade de medida"
            />
          </div>
          <div>
            <label htmlFor="materialCategory" className="block text-sm font-bold text-slate-500 uppercase mb-2">Categoria</label>
            <input
              type="text"
              id="materialCategory"
              value={editMaterialData ? editMaterialData.category : newMaterialCategory}
              onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, category: e.target.value }) : setNewMaterialCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Categoria do material"
            />
          </div>
          <div>
            <label htmlFor="materialStep" className="block text-sm font-bold text-slate-500 uppercase mb-2">Etapa Relacionada</label>
            <select
              id="materialStep"
              value={editMaterialData ? (editMaterialData.stepId || 'none') : (newMaterialStepId || 'none')}
              onChange={(e) => editMaterialData ? setEditMaterialData({ ...editMaterialData, stepId: e.target.value === 'none' ? undefined : e.target.value }) : setNewMaterialStepId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Etapa relacionada ao material"
            >
              <option value="none">Nenhuma</option>
              {steps.map(step => (
                <option key={step.id} value={step.id}>{step.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-between gap-3 mt-6">
            {editMaterialData && (
                <button
                    type="button"
                    onClick={() => setZeModal({
                        isOpen: true,
                        title: "Excluir Material",
                        message: `Tem certeza que deseja excluir o material ${editMaterialData.name}? Isso também excluirá despesas relacionadas.`,
                        confirmText: "Excluir",
                        onConfirm: async () => handleDeleteMaterial(editMaterialData.id),
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: "DANGER"
                    })}
                    className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    aria-label={`Excluir material ${editMaterialData.name}`}
                >
                    <i className="fa-solid fa-trash-alt"></i> Excluir
                </button>
            )}
            <button
              type="submit"
              disabled={zeModal.isConfirming}
              className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label={editMaterialData ? "Salvar alterações do material" : "Adicionar material"}
            >
              {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
              {editMaterialData ? 'Salvar' : 'Adicionar'}
            </button>
          </div>

          {editMaterialData && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-lg font-bold text-primary dark:text-white mb-4">Registrar Compra</h4>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <label htmlFor="purchaseQty" className="block text-sm font-bold text-slate-500 uppercase mb-2">Quantidade Comprada</label>
                        <input
                            type="number"
                            id="purchaseQty"
                            value={currentPurchaseQty}
                            onChange={(e) => setCurrentPurchaseQty(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                            min="0"
                            aria-label="Quantidade comprada"
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="purchaseCost" className="block text-sm font-bold text-slate-500 uppercase mb-2">Custo Total (R$)</label>
                        <input
                            type="number"
                            id="purchaseCost"
                            value={currentPurchaseCost}
                            onChange={(e) => setCurrentPurchaseCost(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white"
                            min="0"
                            step="0.01"
                            aria-label="Custo total da compra"
                        />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleRegisterMaterialPurchase}
                    disabled={zeModal.isConfirming || !currentPurchaseQty || !currentPurchaseCost}
                    className="w-full py-3 px-4 bg-secondary text-white font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                    aria-label="Registrar compra de material"
                >
                    {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cart-shopping"></i>}
                    Registrar Compra
                </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );

  const AddEditExpenseModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto")}>
        <button onClick={() => { setShowAddExpenseModal(false); setEditExpenseData(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editExpenseData ? `Editar Despesa: ${editExpenseData.description}` : 'Adicionar Nova Despesa'}</h3>
        <form onSubmit={editExpenseData ? handleEditExpense : handleAddExpense} className="space-y-4">
          <div>
            <label htmlFor="expenseDescription" className="block text-sm font-bold text-slate-500 uppercase mb-2">Descrição</label>
            <input
              type="text"
              id="expenseDescription"
              value={editExpenseData ? editExpenseData.description : newExpenseDescription}
              onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, description: e.target.value }) : setNewExpenseDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Descrição da despesa"
            />
          </div>
          <div>
            <label htmlFor="expenseAmount" className="block text-sm font-bold text-slate-500 uppercase mb-2">Valor (R$)</label>
            <input
              type="number"
              id="expenseAmount"
              value={editExpenseData ? editExpenseData.amount : newExpenseAmount}
              onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, amount: Number(e.target.value) }) : setNewExpenseAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              min="0"
              step="0.01"
              aria-label="Valor da despesa"
            />
          </div>
          <div>
            <label htmlFor="expenseCategory" className="block text-sm font-bold text-slate-500 uppercase mb-2">Categoria</label>
            <select
              id="expenseCategory"
              value={editExpenseData ? editExpenseData.category : newExpenseCategory}
              onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, category: e.target.value }) : setNewExpenseCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Categoria da despesa"
            >
              {Object.values(ExpenseCategory).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="Outros">Outros</option>
            </select>
          </div>
          <div>
            <label htmlFor="expenseDate" className="block text-sm font-bold text-slate-500 uppercase mb-2">Data</label>
            <input
              type="date"
              id="expenseDate"
              value={editExpenseData ? editExpenseData.date : newExpenseDate}
              onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, date: e.target.value }) : setNewExpenseDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Data da despesa"
            />
          </div>
          <div>
            <label htmlFor="expenseStep" className="block text-sm font-bold text-slate-500 uppercase mb-2">Etapa Relacionada</label>
            <select
              id="expenseStep"
              value={editExpenseData ? (editExpenseData.stepId || 'none') : (newExpenseStepId || 'none')}
              onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, stepId: e.target.value === 'none' ? undefined : e.target.value }) : setNewExpenseStepId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Etapa relacionada à despesa"
            >
              <option value="none">Nenhuma</option>
              {steps.map(step => (
                <option key={step.id} value={step.id}>{step.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="expenseWorker" className="block text-sm font-bold text-slate-500 uppercase mb-2">Profissional</label>
            <select
              id="expenseWorker"
              value={editExpenseData ? (editExpenseData.workerId || 'none') : (newExpenseWorkerId || 'none')}
              onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, workerId: e.target.value === 'none' ? undefined : e.target.value }) : setNewExpenseWorkerId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Profissional relacionado à despesa"
            >
              <option value="none">Nenhum</option>
              {workers.map(worker => (
                <option key={worker.id} value={worker.id}>{worker.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="expenseSupplier" className="block text-sm font-bold text-slate-500 uppercase mb-2">Fornecedor</label>
            <select
              id="expenseSupplier"
              value={editExpenseData ? (editExpenseData.supplierId || 'none') : (newExpenseSupplierId || 'none')}
              onChange={(e) => editExpenseData ? setEditExpenseData({ ...editExpenseData, supplierId: e.target.value === 'none' ? undefined : e.target.value }) : setNewExpenseSupplierId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Fornecedor relacionado à despesa"
            >
              <option value="none">Nenhum</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-between gap-3 mt-6">
            {editExpenseData && (
                <button
                    type="button"
                    onClick={() => setZeModal({
                        isOpen: true,
                        title: "Excluir Despesa",
                        message: `Tem certeza que deseja excluir a despesa ${editExpenseData.description}?`,
                        confirmText: "Excluir",
                        onConfirm: async () => handleDeleteExpense(editExpenseData.id),
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: "DANGER"
                    })}
                    className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    aria-label={`Excluir despesa ${editExpenseData.description}`}
                >
                    <i className="fa-solid fa-trash-alt"></i> Excluir
                </button>
            )}
            <button
              type="submit"
              disabled={zeModal.isConfirming}
              className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label={editExpenseData ? "Salvar alterações da despesa" : "Adicionar despesa"}
            >
              {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
              {editExpenseData ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const AddPaymentModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative")}>
        <button onClick={() => { setShowAddPaymentModal(false); setPaymentExpenseData(null); setPaymentAmount(''); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Adicionar Pagamento</h3>
        <p className="text-slate-700 dark:text-slate-300 mb-4">Despesa: <span className="font-bold">{paymentExpenseData?.description}</span></p>
        <p className="text-slate-700 dark:text-slate-300 mb-4">Valor Total: <span className="font-bold">{formatCurrency(paymentExpenseData?.amount)}</span></p>
        <p className="text-slate-700 dark:text-slate-300 mb-6">Já Pago: <span className="font-bold text-green-600">{formatCurrency(paymentExpenseData?.paidAmount || 0)}</span></p>
        <form onSubmit={handleAddPayment} className="space-y-4">
          <div>
            <label htmlFor="paymentAmount" className="block text-sm font-bold text-slate-500 uppercase mb-2">Valor do Pagamento (R$)</label>
            <input
              type="number"
              id="paymentAmount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              min="0"
              step="0.01"
              max={paymentExpenseData ? paymentExpenseData.amount - (paymentExpenseData.paidAmount || 0) : undefined}
              aria-label="Valor do pagamento"
            />
          </div>
          <div>
            <label htmlFor="paymentDate" className="block text-sm font-bold text-slate-500 uppercase mb-2">Data do Pagamento</label>
            <input
              type="date"
              id="paymentDate"
              value={paymentDate}
              onChange={(e) => setNewPaymentDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Data do pagamento"
            />
          </div>
          <button
            type="submit"
            disabled={zeModal.isConfirming || !paymentAmount || Number(paymentAmount) <= 0}
            className="w-full py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="Registrar pagamento"
          >
            {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wallet"></i>}
            Registrar Pagamento
          </button>
        </form>
      </div>
    </div>
  );

  const AddEditWorkerModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative")}>
        <button onClick={() => { setShowAddWorkerModal(false); setEditWorkerData(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editWorkerData ? `Editar Profissional: ${editWorkerData.name}` : 'Adicionar Novo Profissional'}</h3>
        <form onSubmit={editWorkerData ? handleEditWorker : handleAddWorker} className="space-y-4">
          <div>
            <label htmlFor="workerName" className="block text-sm font-bold text-slate-500 uppercase mb-2">Nome Completo</label>
            <input
              type="text"
              id="workerName"
              value={editWorkerData ? editWorkerData.name : newWorkerName}
              onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, name: e.target.value }) : setNewWorkerName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Nome completo do profissional"
            />
          </div>
          <div>
            <label htmlFor="workerRole" className="block text-sm font-bold text-slate-500 uppercase mb-2">Função</label>
            <select
              id="workerRole"
              value={editWorkerData ? editWorkerData.role : newWorkerRole}
              onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, role: e.target.value }) : setNewWorkerRole(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Função do profissional"
            >
              <option value="">Selecione uma função</option>
              {STANDARD_JOB_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="workerPhone" className="block text-sm font-bold text-slate-500 uppercase mb-2">Telefone</label>
            <input
              type="tel"
              id="workerPhone"
              value={editWorkerData ? editWorkerData.phone : newWorkerPhone}
              onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, phone: e.target.value }) : setNewWorkerPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Telefone do profissional"
            />
          </div>
          <div>
            <label htmlFor="workerDailyRate" className="block text-sm font-bold text-slate-500 uppercase mb-2">Diária (R$)</label>
            <input
              type="number"
              id="workerDailyRate"
              value={editWorkerData ? (editWorkerData.dailyRate || '') : newWorkerDailyRate}
              onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, dailyRate: Number(e.target.value) }) : setNewWorkerDailyRate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              min="0"
              step="0.01"
              aria-label="Valor da diária"
            />
          </div>
          <div>
            <label htmlFor="workerNotes" className="block text-sm font-bold text-slate-500 uppercase mb-2">Observações</label>
            <textarea
              id="workerNotes"
              value={editWorkerData ? (editWorkerData.notes || '') : newWorkerNotes}
              onChange={(e) => editWorkerData ? setEditWorkerData({ ...editWorkerData, notes: e.target.value }) : setNewWorkerNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              rows={3}
              aria-label="Observações sobre o profissional"
            ></textarea>
          </div>
          <div className="flex justify-between gap-3 mt-6">
            {editWorkerData && (
                <button
                    type="button"
                    onClick={() => setZeModal({
                        isOpen: true,
                        title: "Excluir Profissional",
                        message: `Tem certeza que deseja excluir o profissional ${editWorkerData.name}?`,
                        confirmText: "Excluir",
                        onConfirm: async () => handleDeleteWorker(editWorkerData.id),
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: "DANGER"
                    })}
                    className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    aria-label={`Excluir profissional ${editWorkerData.name}`}
                >
                    <i className="fa-solid fa-trash-alt"></i> Excluir
                </button>
            )}
            <button
              type="submit"
              disabled={zeModal.isConfirming}
              className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label={editWorkerData ? "Salvar alterações do profissional" : "Adicionar profissional"}
            >
              {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
              {editWorkerData ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const AddEditSupplierModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative")}>
        <button onClick={() => { setShowAddSupplierModal(false); setEditSupplierData(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editSupplierData ? `Editar Fornecedor: ${editSupplierData.name}` : 'Adicionar Novo Fornecedor'}</h3>
        <form onSubmit={editSupplierData ? handleEditSupplier : handleAddSupplier} className="space-y-4">
          <div>
            <label htmlFor="supplierName" className="block text-sm font-bold text-slate-500 uppercase mb-2">Nome/Empresa</label>
            <input
              type="text"
              id="supplierName"
              value={editSupplierData ? editSupplierData.name : newSupplierName}
              onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, name: e.target.value }) : setNewSupplierName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Nome do fornecedor"
            />
          </div>
          <div>
            <label htmlFor="supplierCategory" className="block text-sm font-bold text-slate-500 uppercase mb-2">Categoria</label>
            <select
              id="supplierCategory"
              value={editSupplierData ? editSupplierData.category : newSupplierCategory}
              onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, category: e.target.value }) : setNewSupplierCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Categoria do fornecedor"
            >
              <option value="">Selecione uma categoria</option>
              {STANDARD_SUPPLIER_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="supplierPhone" className="block text-sm font-bold text-slate-500 uppercase mb-2">Telefone</label>
            <input
              type="tel"
              id="supplierPhone"
              value={editSupplierData ? editSupplierData.phone : newSupplierPhone}
              onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, phone: e.target.value }) : setNewSupplierPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Telefone do fornecedor"
            />
          </div>
          <div>
            <label htmlFor="supplierEmail" className="block text-sm font-bold text-slate-500 uppercase mb-2">E-mail (Opcional)</label>
            <input
              type="email"
              id="supplierEmail"
              value={editSupplierData ? (editSupplierData.email || '') : newSupplierEmail}
              onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, email: e.target.value }) : setNewSupplierEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Email do fornecedor"
            />
          </div>
          <div>
            <label htmlFor="supplierAddress" className="block text-sm font-bold text-slate-500 uppercase mb-2">Endereço (Opcional)</label>
            <input
              type="text"
              id="supplierAddress"
              value={editSupplierData ? (editSupplierData.address || '') : newSupplierAddress}
              onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, address: e.target.value }) : setNewSupplierAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:focus-border-secondary transition-all"
              aria-label="Endereço do fornecedor"
            />
          </div>
          <div>
            <label htmlFor="supplierNotes" className="block text-sm font-bold text-slate-500 uppercase mb-2">Observações</label>
            <textarea
              id="supplierNotes"
              value={editSupplierData ? (editSupplierData.notes || '') : newSupplierNotes}
              onChange={(e) => editSupplierData ? setEditSupplierData({ ...editSupplierData, notes: e.target.value }) : setNewSupplierNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              rows={3}
              aria-label="Observações sobre o fornecedor"
            ></textarea>
          </div>
          <div className="flex justify-between gap-3 mt-6">
            {editSupplierData && (
                <button
                    type="button"
                    onClick={() => setZeModal({
                        isOpen: true,
                        title: "Excluir Fornecedor",
                        message: `Tem certeza que deseja excluir o fornecedor ${editSupplierData.name}?`,
                        confirmText: "Excluir",
                        onConfirm: async () => handleDeleteSupplier(editSupplierData.id),
                        onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false })),
                        type: "DANGER"
                    })}
                    className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                    aria-label={`Excluir fornecedor ${editSupplierData.name}`}
                >
                    <i className="fa-solid fa-trash-alt"></i> Excluir
                </button>
            )}
            <button
              type="submit"
              disabled={zeModal.isConfirming}
              className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label={editSupplierData ? "Salvar alterações do fornecedor" : "Adicionar fornecedor"}
            >
              {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
              {editSupplierData ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const AddPhotoModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative")}>
        <button onClick={() => { setShowAddPhotoModal(false); setNewPhotoFile(null); setNewPhotoDescription(''); setNewPhotoType('PROGRESS'); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Adicionar Nova Foto</h3>
        <form onSubmit={handleAddPhoto} className="space-y-4">
          <div>
            <label htmlFor="photoFile" className="block text-sm font-bold text-slate-500 uppercase mb-2">Arquivo de Imagem</label>
            <input
              type="file"
              id="photoFile"
              accept="image/*"
              onChange={(e) => setNewPhotoFile(e.target.files ? e.target.files[0] : null)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Selecionar arquivo de imagem"
            />
          </div>
          <div>
            <label htmlFor="photoDescription" className="block text-sm font-bold text-slate-500 uppercase mb-2">Descrição da Foto</label>
            <input
              type="text"
              id="photoDescription"
              value={newPhotoDescription}
              onChange={(e) => setNewPhotoDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Descrição da foto"
            />
          </div>
          <div>
            <label htmlFor="photoType" className="block text-sm font-bold text-slate-500 uppercase mb-2">Tipo de Foto</label>
            <select
              id="photoType"
              value={newPhotoType}
              onChange={(e) => setNewPhotoType(e.target.value as 'BEFORE' | 'AFTER' | 'PROGRESS')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Tipo de foto"
            >
              <option value="PROGRESS">Progresso</option>
              <option value="BEFORE">Antes</option>
              <option value="AFTER">Depois</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={uploadingPhoto}
            className="w-full py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="Adicionar foto"
          >
            {uploadingPhoto ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
            {uploadingPhoto ? 'Enviando...' : 'Adicionar Foto'}
          </button>
        </form>
      </div>
    </div>
  );

  const AddFileModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative")}>
        <button onClick={() => { setShowAddFileModal(false); setNewUploadFile(null); setNewFileName(''); setNewFileCategory(FileCategory.GENERAL); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Adicionar Novo Arquivo</h3>
        <form onSubmit={handleAddFile} className="space-y-4">
          <div>
            <label htmlFor="uploadFile" className="block text-sm font-bold text-slate-500 uppercase mb-2">Arquivo</label>
            <input
              type="file"
              id="uploadFile"
              onChange={(e) => setNewUploadFile(e.target.files ? e.target.files[0] : null)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Selecionar arquivo para upload"
            />
          </div>
          <div>
            <label htmlFor="fileName" className="block text-sm font-bold text-slate-500 uppercase mb-2">Nome do Arquivo</label>
            <input
              type="text"
              id="fileName"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder={newUploadFile?.name || "Ex: Planta Baixa"}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Nome do arquivo"
            />
          </div>
          <div>
            <label htmlFor="fileCategory" className="block text-sm font-bold text-slate-500 uppercase mb-2">Categoria</label>
            <select
              id="fileCategory"
              value={newFileCategory}
              onChange={(e) => setNewFileCategory(e.target.value as FileCategory)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              aria-label="Categoria do arquivo"
            >
              {Object.values(FileCategory).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={uploadingFile}
            className="w-full py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="Adicionar arquivo"
          >
            {uploadingFile ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
            {uploadingFile ? 'Enviando...' : 'Adicionar Arquivo'}
          </button>
        </form>
      </div>
    </div>
  );
  
  const AddEditChecklistModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={cx(surface, "rounded-3xl p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto")}>
        <button onClick={() => { setShowAddChecklistModal(false); setEditChecklistData(null); setNewChecklistName(''); setNewChecklistCategory(''); setNewChecklistItems(['']); }} className="absolute top-4 right-4 text-slate-400 hover:text-primary dark:hover:text-white" aria-label="Fechar modal"><i className="fa-solid fa-xmark text-xl"></i></button>
        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editChecklistData ? `Editar Checklist: ${editChecklistData.name}` : 'Adicionar Novo Checklist'}</h3>
        <form onSubmit={editChecklistData ? handleEditChecklist : handleAddChecklist} className="space-y-4">
          <div>
            <label htmlFor="checklistName" className="block text-sm font-bold text-slate-500 uppercase mb-2">Nome do Checklist</label>
            <input
              type="text"
              id="checklistName"
              value={editChecklistData ? editChecklistData.name : newChecklistName}
              onChange={(e) => editChecklistData ? setEditChecklistData({ ...editChecklistData, name: e.target.value }) : setNewChecklistName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Nome do checklist"
            />
          </div>
          <div>
            <label htmlFor="checklistCategory" className="block text-sm font-bold text-slate-500 uppercase mb-2">Categoria (Etapa Relacionada)</label>
            <select
              id="checklistCategory"
              value={editChecklistData ? editChecklistData.category : newChecklistCategory}
              onChange={(e) => editChecklistData ? setEditChecklistData({ ...editChecklistData, category: e.target.value }) : setNewChecklistCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
              required
              aria-label="Categoria do checklist"
            >
              <option value="">Selecione uma etapa</option>
              {steps.map(step => (
                <option key={step.id} value={step.name}>{step.name}</option> // Use step name as category
              ))}
              <option value="Geral">Geral</option>
              <option value="Segurança">Segurança</option>
            </select>
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Itens do Checklist</label>
            {newChecklistItems.map((itemText, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={itemText}
                  onChange={(e) => {
                    const updatedItems = [...newChecklistItems];
                    updatedItems[index] = e.target.value;
                    setNewChecklistItems(updatedItems);
                  }}
                  placeholder={`Item ${index + 1}`}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                  aria-label={`Item ${index + 1} do checklist`}
                />
                <button
                  type="button"
                  onClick={() => setNewChecklistItems(newChecklistItems.filter((_, i) => i !== index))}
                  className="p-2 text-red-500 hover:text-red-700 transition-colors"
                  aria-label={`Remover item ${index + 1}`}
                >
                  <i className="fa-solid fa-trash-alt"></i>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setNewChecklistItems([...newChecklistItems, ''])}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
              aria-label="Adicionar novo item ao checklist"
            >
              <i className="fa-solid fa-plus"></i> Adicionar Item
            </button>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="submit"
              disabled={zeModal.isConfirming || newChecklistItems.filter(item => item.trim() !== '').length === 0}
              className="flex-1 py-3 px-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              aria-label={editChecklistData ? "Salvar alterações do checklist" : "Adicionar checklist"}
            >
              {zeModal.isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
              {editChecklistData ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );


  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-2 sm:px-4 md:px-0 font-sans">
      <div className="flex items-center gap-4 mb-6 px-2 sm:px-0">
        <button
          onClick={() => {
            if (activeSubView !== 'NONE') {
              setActiveSubView('NONE'); // Go back from sub-view to main tools
            } else {
              navigate('/'); // Go back to dashboard from main work detail
            }
          }}
          className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
          aria-label={activeSubView !== 'NONE' ? "Voltar às Ferramentas" : "Voltar ao Dashboard"}
        >
          <i className="fa-solid fa-arrow-left text-xl"></i>
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary dark:text-white mb-1 tracking-tight">{work.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Endereço: {work.address}</p>
        </div>
      </div>
      
      {/* Main Content Area based on activeTab and activeSubView */}
      {activeSubView === 'NONE' ? renderMainContent() : renderToolsSubView()}

      {/* Modals */}
      {showAddStepModal && <AddEditStepModal />}
      {showAddMaterialModal && <AddEditMaterialModal />}
      {showAddExpenseModal && <AddEditExpenseModal />}
      {showAddPaymentModal && <AddPaymentModal />}
      {showAddWorkerModal && <AddEditWorkerModal />}
      {showAddSupplierModal && <AddEditSupplierModal />}
      {showAddPhotoModal && <AddPhotoModal />}
      {showAddFileModal && <AddFileModal />}
      {showAddChecklistModal && <AddEditChecklistModal />}
      {zeModal.isOpen && <ZeModal {...zeModal} />}
    </div>
  );
};

// =======================================================================
// SHARED COMPONENTS
// =======================================================================

interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  isLocked?: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ icon, title, description, onClick, isLocked }) => (
  <button
    onClick={onClick}
    disabled={isLocked}
    className={cx(
      "relative flex flex-col items-center text-center p-6 rounded-2xl border-2 transition-all group",
      "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
      "shadow-sm dark:shadow-card-dark-subtle",
      isLocked ? "opacity-50 cursor-not-allowed" : "hover:border-secondary/50 hover:shadow-lg hover:scale-[1.01] active:scale-[0.98]"
    )}
    aria-label={`Abrir ferramenta ${title}`}
    aria-disabled={isLocked}
  >
    {isLocked && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl z-10">
        <i className="fa-solid fa-lock text-white text-4xl"></i>
      </div>
    )}
    <div className={cx(
      "w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 transition-all",
      isLocked ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500" : "bg-primary text-white group-hover:bg-secondary"
    )}>
      <i className={`fa-solid ${icon}`}></i>
    </div>
    <h3 className="text-xl font-bold text-primary dark:text-white mb-2">{title}</h3>
    <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </button>
);

interface ToolSubViewHeaderProps {
  title: string;
  onBack: () => void;
  onAdd?: () => void;
}

const ToolSubViewHeader: React.FC<ToolSubViewHeaderProps> = ({ title, onBack, onAdd }) => (
  <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
    <div className="flex items-center gap-4">
      <button
        onClick={onBack}
        className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
        aria-label="Voltar"
      >
        <i className="fa-solid fa-arrow-left text-xl"></i>
      </button>
      <h2 className="text-2xl font-black text-primary dark:text-white">{title}</h2>
    </div>
    {onAdd && (
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark transition-colors flex items-center gap-2"
        aria-label={`Adicionar novo ${title}`}
      >
        <i className="fa-solid fa-plus"></i> Novo
      </button>
    )}
  </div>
);

export default WorkDetail;
