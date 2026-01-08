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
        icon = 'fa-exclamation-triangle';
    }
  } else if (entityType === 'material') {
    const material = entity as Material;
    const associatedStep = allSteps.find(s => s.id === material.stepId);
    let isDelayed = false;
    if (associatedStep) {
      const stepStartDate = new Date(associatedStep.startDate);
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(today.getDate() + 3);
      isDelayed = (stepStartDate <= threeDaysFromNow && material.purchasedQty < material.plannedQty);
    }
    if (isDelayed) {
      statusText = 'Atrasado'; bgColor = 'bg-red-500'; icon = 'fa-exclamation-triangle';
    } else if (material.purchasedQty >= material.plannedQty && material.plannedQty > 0) {
      statusText = 'Concluído'; bgColor = 'bg-green-500'; icon = 'fa-check';
    } else if (material.purchasedQty > 0) {
      statusText = 'Parcial'; bgColor = 'bg-amber-500'; icon = 'fa-hourglass-half';
    } else {
      statusText = 'Pendente'; bgColor = 'bg-slate-400'; icon = 'fa-hourglass-start';
    }
  } else if (entityType === 'expense') {
    const expense = entity as Expense;
    const paidAmount = expense.paidAmount || 0;
    const totalAgreed = expense.totalAgreed !== undefined ? expense.totalAgreed : expense.amount;
    if (paidAmount >= totalAgreed && totalAgreed > 0) {
      statusText = 'Concluído'; bgColor = 'bg-green-500'; icon = 'fa-check';
    } else if (paidAmount > 0) {
      statusText = 'Parcial'; bgColor = 'bg-amber-500'; icon = 'fa-hand-holding-dollar';
    } else {
      statusText = 'Pendente'; bgColor = 'bg-slate-400'; icon = 'fa-hourglass-start';
    }
  }
  return { statusText, bgColor, textColor, borderColor, shadowClass, icon };
};

interface ToolCardProps {
  icon: string; title: string; description: string; onClick: () => void; isLocked?: boolean; requiresVitalicio?: boolean;
}

const ToolCard: React.FC<ToolCardProps> = ({ icon, title, description, onClick, isLocked, requiresVitalicio }) => (
    <button onClick={onClick} disabled={isLocked} className={cx(surface, "p-5 rounded-2xl flex flex-col items-center text-center gap-3 cursor-pointer hover:scale-[1.005] transition-transform relative group", isLocked ? "opacity-60 cursor-not-allowed" : "")}>
      {isLocked && <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center z-10"><i className="fa-solid fa-lock text-white text-3xl opacity-80"></i></div>}
      <div className="w-12 h-12 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xl shrink-0 group-hover:bg-secondary/20 transition-colors"><i className={`fa-solid ${icon}`}></i></div>
      <h3 className="font-bold text-primary dark:text-white text-lg leading-tight">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {requiresVitalicio && <span className="text-xs font-bold text-amber-600 mt-1 uppercase tracking-wider"><i className="fa-solid fa-crown mr-1"></i> Acesso Vitalício</span>}
    </button>
);

interface ToolSubViewHeaderProps { title: string; onBack: () => void; onAdd?: () => void; }
const ToolSubViewHeader: React.FC<ToolSubViewHeaderProps> = ({ title, onBack, onAdd }) => (
    <div className="flex items-center justify-between mb-6 px-2 sm:px-0">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-slate-400 hover:text-primary transition-colors p-2 -ml-2"><i className="fa-solid fa-arrow-left text-xl"></i></button>
        <h2 className="text-2xl font-black text-primary dark:text-white">{title}</h2>
      </div>
      {onAdd && <button onClick={onAdd} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark flex items-center gap-2"><i className="fa-solid fa-plus"></i> Novo</button>}
    </div>
);

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
  const [newStepStartDate, setNewStepStartDate] = useState('');
  const [newStepEndDate, setNewStepEndDate] = useState('');
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
  const [newExpenseDate, setNewExpenseDate] = useState('');
  const [newExpenseStepId, setNewExpenseStepId] = useState(''); 
  const [newExpenseWorkerId, setNewExpenseWorkerId] = useState('');
  const [newExpenseSupplierId, setNewExpenseSupplierId] = useState('');
  const [editExpenseData, setEditExpenseData] = useState<Expense | null>(null);
  const [newExpenseTotalAgreed, setNewExpenseTotalAgreed] = useState('');

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

  const [zeModal, setZeModal] = useState<ZeModalProps & { isOpen: boolean, isConfirming?: boolean }>({
    isOpen: false, title: '', message: '', onCancel: () => { }, isConfirming: false
  });

  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);

  const loadWorkData = useCallback(async () => {
    if (!workId || !user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const fetchedWork = await dbService.getWorkById(workId);
      if (!fetchedWork || fetchedWork.userId !== user.id) { navigate('/'); return; }
      setWork(fetchedWork);
      const [fetchedSteps, fetchedExpenses, fetchedWorkers, fetchedSuppliers, fetchedPhotos, fetchedFiles, fetchedContracts, fetchedChecklists] = await Promise.all([
        dbService.getSteps(workId), dbService.getExpenses(workId), dbService.getWorkers(workId), dbService.getSuppliers(workId), dbService.getPhotos(workId), dbService.getFiles(workId), dbService.getContractTemplates(), dbService.getChecklists(workId),
      ]);
      await dbService.ensureMaterialsForWork(fetchedWork, fetchedSteps);
      const currentMaterials = await dbService.getMaterials(workId);
      setMaterials(currentMaterials);
      setSteps(fetchedSteps); setExpenses(fetchedExpenses); setWorkers(fetchedWorkers); setSuppliers(fetchedSuppliers); setPhotos(fetchedPhotos); setFiles(fetchedFiles); setContracts(fetchedContracts); setChecklists(fetchedChecklists);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [workId, user, navigate]);

  useEffect(() => {
    if (!authLoading && isUserAuthFinished) {
      loadWorkData();
      const tabFromUrl = searchParams.get('tab') as MainTab;
      if (tabFromUrl) setActiveTab(tabFromUrl);
    }
  }, [authLoading, isUserAuthFinished, loadWorkData, searchParams]);

  /** * FUNÇÃO CORRIGIDA: handleStepStatusChange
   * Resolve o erro 400 limpando o payload e tratando nulos corretamente.
   */
  const handleStepStatusChange = useCallback(async (step: Step) => {
    if (isUpdatingStepStatus) return;
    setIsUpdatingStepStatus(true);

    const statusCycle: Record<StepStatus, StepStatus> = {
        [StepStatus.NOT_STARTED]: StepStatus.IN_PROGRESS,
        [StepStatus.IN_PROGRESS]: StepStatus.COMPLETED,
        [StepStatus.COMPLETED]: StepStatus.NOT_STARTED
    };

    const nextStatus = statusCycle[step.status] || StepStatus.NOT_STARTED;
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      // PAYLOAD LIMPO: Enviamos apenas o que o banco espera e tratamos realDate como null
      const cleanStepData: Step = {
        id: step.id,
        workId: step.workId,
        name: step.name,
        status: nextStatus,
        startDate: step.startDate,
        endDate: step.endDate,
        orderIndex: step.orderIndex,
        // Usar null explícito se não estiver concluído para evitar Erro 400
        realDate: nextStatus === StepStatus.COMPLETED ? todayStr : null as any,
        isDelayed: nextStatus !== StepStatus.COMPLETED && new Date() > new Date(step.endDate)
      };

      await dbService.updateStep(cleanStepData);
      await loadWorkData();
    } catch (error) {
      console.error("Erro ao alterar status da etapa:", error);
      setZeModal({
        isOpen: true, title: "Erro de Atualização", message: "Ocorreu um erro ao trocar o status. Tente novamente ou use o menu de edição.", type: "ERROR", confirmText: "Ok", onCancel: () => setZeModal(p => ({ ...p, isOpen: false }))
      });
    } finally {
      setIsUpdatingStepStatus(false);
    }
  }, [loadWorkData, isUpdatingStepStatus]);

  // Handlers Genéricos Simplificados
  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workId || !newStepName) return;
    await dbService.addStep({ workId, name: newStepName, startDate: newStepStartDate, endDate: newStepEndDate, status: StepStatus.NOT_STARTED });
    setShowAddStepModal(false); await loadWorkData();
  };

  const handleEditStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStepData) return;
    await dbService.updateStep({ ...editStepData, workId: workId! });
    setEditStepData(null); setShowAddStepModal(false); await loadWorkData();
  };

  const handleDeleteStep = async (id: string) => {
    await dbService.deleteStep(id, workId!);
    await loadWorkData(); setZeModal(p => ({ ...p, isOpen: false }));
  };

  const calculateStepProgress = (id: string) => {
    const mats = materials.filter(m => m.stepId === id);
    if (!mats.length) return 0;
    const plan = mats.reduce((s, m) => s + m.plannedQty, 0);
    const pur = mats.reduce((s, m) => s + m.purchasedQty, 0);
    return plan > 0 ? (pur / plan) * 100 : 0;
  };

  const groupedMaterials = useMemo(() => {
    const filtered = materialFilterStepId === 'all' ? materials : materials.filter(m => m.stepId === materialFilterStepId);
    return steps.map(s => ({
        stepId: s.id, stepName: `${s.orderIndex}. ${s.name}`,
        materials: filtered.filter(m => m.stepId === s.id)
    })).filter(g => g.materials.length > 0);
  }, [materials, steps, materialFilterStepId]);

  const groupedExpensesByStep = useMemo(() => {
    return steps.map(s => ({
        stepName: `${s.orderIndex}. ${s.name}`,
        expenses: expenses.filter(e => e.stepId === s.id),
        totalStepAmount: expenses.filter(e => e.stepId === s.id).reduce((sum, e) => sum + e.amount, 0)
    })).filter(g => g.expenses.length > 0);
  }, [expenses, steps]);

  if (loading || authLoading || !isUserAuthFinished || !work) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-primary">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
        <p className="mt-4">Carregando sua obra...</p>
      </div>
    );
  }

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
        {activeTab === 'ETAPAS' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-primary dark:text-white">Cronograma</h2>
              <button onClick={() => { setEditStepData(null); setShowAddStepModal(true); }} className="px-4 py-2 bg-secondary text-white text-sm font-bold rounded-xl flex items-center gap-2">
                <i className="fa-solid fa-plus"></i> Nova Etapa
              </button>
            </div>
            <div className="space-y-4">
              {steps.sort((a,b) => a.orderIndex - b.orderIndex).map(step => {
                const det = getEntityStatusDetails('step', step, steps);
                return (
                  <div key={step.id} onClick={() => { setEditStepData(step); setShowAddStepModal(true); }} className={cx(surface, `p-4 rounded-2xl flex items-center gap-4 border-2 ${det.borderColor} shadow-lg ${det.shadowClass} cursor-pointer`)}>
                    <button onClick={(e) => { e.stopPropagation(); handleStepStatusChange(step); }} disabled={isUpdatingStepStatus} className={cx("w-10 h-10 rounded-full text-white flex items-center justify-center text-lg", det.bgColor)}>
                        {isUpdatingStepStatus ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className={`fa-solid ${det.icon}`}></i>}
                    </button>
                    <div className="flex-1">
                      <p className="text-xs font-bold uppercase text-slate-400">Etapa {step.orderIndex} <span className={det.textColor}>({det.statusText})</span></p>
                      <h3 className="text-lg font-bold text-primary dark:text-white">{step.name}</h3>
                      <p className="text-xs text-slate-500">{formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-primary">{calculateStepProgress(step.id).toFixed(0)}%</p>
                        <button onClick={(e) => { e.stopPropagation(); setZeModal({ isOpen: true, title: "Excluir", message: "Excluir?", onConfirm: () => handleDeleteStep(step.id), type: "DANGER", onCancel: () => setZeModal(p => ({ ...p, isOpen: false })) }); }} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash-can"></i></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'MATERIAIS' && (
            <div className="space-y-6">
                 <div className="flex justify-between items-center"><h2 className="text-2xl font-black">Materiais</h2><button onClick={() => setShowAddMaterialModal(true)} className="bg-secondary text-white px-4 py-2 rounded-xl">Novo</button></div>
                 {groupedMaterials.map(g => (
                     <div key={g.stepId}>
                         <h3 className="font-bold text-slate-400 mb-2">{g.stepName}</h3>
                         {g.materials.map(m => (
                             <div key={m.id} className={cx(surface, "p-4 rounded-xl mb-2 flex justify-between items-center")}>
                                 <div><h4 className="font-bold">{m.name}</h4><p className="text-xs">{m.brand}</p></div>
                                 <p className="font-bold text-green-600">{m.purchasedQty} / {m.plannedQty} {m.unit}</p>
                             </div>
                         ))}
                     </div>
                 ))}
            </div>
        )}

        {activeTab === 'FINANCEIRO' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center"><h2 className="text-2xl font-black">Financeiro</h2><button onClick={() => setShowAddExpenseModal(true)} className="bg-secondary text-white px-4 py-2 rounded-xl">Nova Despesa</button></div>
                {groupedExpensesByStep.map((g,i) => (
                    <div key={i}>
                        <h3 className="font-bold text-slate-400 mb-2 flex justify-between">{g.stepName} <span>{formatCurrency(g.totalStepAmount)}</span></h3>
                        {g.expenses.map(e => (
                            <div key={e.id} className={cx(surface, "p-4 rounded-xl mb-2 flex justify-between")}>
                                <div><h4 className="font-bold">{e.description}</h4><p className="text-xs">{formatDateDisplay(e.date)}</p></div>
                                <div className="text-right"><p className="font-bold">{formatCurrency(e.amount)}</p><p className="text-xs text-green-600">Pago: {formatCurrency(e.paidAmount || 0)}</p></div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        )}

        {activeTab === 'FERRAMENTAS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToolCard icon="fa-users" title="Profissionais" description="Equipe." onClick={() => goToSubView('WORKERS')} />
                <ToolCard icon="fa-images" title="Fotos" description="Galeria." onClick={() => goToSubView('PHOTOS')} />
                <ToolCard icon="fa-file-shield" title="Documentos" description="Projetos." onClick={() => goToSubView('PROJECTS')} />
                <ToolCard icon="fa-list-check" title="Checklists" description="Verificações." onClick={() => goToSubView('CHECKLIST')} isLocked={!isVitalicio} requiresVitalicio />
            </div>
        )}
      </div>

      {/* MODAL ETAPA */}
      {showAddStepModal && (
          <ZeModal isOpen={showAddStepModal} title={editStepData ? "Editar" : "Nova Etapa"} onConfirm={editStepData ? handleEditStep : handleAddStep} onCancel={() => setShowAddStepModal(false)}>
              <div className="space-y-4 pt-4">
                  <input type="text" placeholder="Nome" value={editStepData ? editStepData.name : newStepName} onChange={e => editStepData ? setEditStepData({...editStepData, name: e.target.value}) : setNewStepName(e.target.value)} className="w-full p-3 border rounded-xl" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={editStepData ? editStepData.startDate : newStepStartDate} onChange={e => editStepData ? setEditStepData({...editStepData, startDate: e.target.value}) : setNewStepStartDate(e.target.value)} className="p-3 border rounded-xl" />
                    <input type="date" value={editStepData ? editStepData.endDate : newStepEndDate} onChange={e => editStepData ? setEditStepData({...editStepData, endDate: e.target.value}) : setNewStepEndDate(e.target.value)} className="p-3 border rounded-xl" />
                  </div>
                  {editStepData && (
                      <select value={editStepData.status} onChange={e => setEditStepData({...editStepData, status: e.target.value as StepStatus})} className="w-full p-3 border rounded-xl">
                          {Object.values(StepStatus).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  )}
              </div>
          </ZeModal>
      )}

      {zeModal.isOpen && <ZeModal {...zeModal} />}
    </div>
  );
};

export default WorkDetail;
