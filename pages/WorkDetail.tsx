import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, PlanType, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile } from '../types.ts';
import { ZeModal, ZeModalProps } from '../components/ZeModal.tsx';
import { STANDARD_CHECKLISTS, CONTRACT_TEMPLATES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'SCHEDULE' | 'MATERIALS' | 'FINANCIAL' | 'MORE';
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO';

// --- DATE HELPERS ---
const parseDateNoTimezone = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    }
    return dateStr;
};

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, trialDaysRemaining, authLoading, isUserAuthFinished } = useAuth();
    
    // --- CORE DATA STATE ---
    const [work, setWork] = useState<Work | null>(null);
    const [loading, setLoading] = useState(true);
    const [steps, setSteps] = useState<Step[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const [files, setFiles] = useState<WorkFile[]>([]);
    // Dashboard Stats for Report
    const [stats, setStats] = useState<{ totalSpent: number, progress: number, delayedSteps: number } | null>(null);

    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<MainTab>('SCHEDULE');
    const [subView, setSubView] = useState<SubView>('NONE');
    const [uploading, setUploading] = useState(false);
    const [reportActiveTab, setReportActiveTab] = useState<ReportSubTab>('CRONOGRAMA');
    
    // --- AI ACCESS LOGIC ---
    const isVitalicio = user?.plan === PlanType.VITALICIO;
    const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
    const hasAiAccess = isVitalicio || isAiTrialActive;

    // --- PREMIUM TOOLS LOCK ---
    // isPremium is used for non-AI premium tools (Calculators, Contracts, Checklist)
    const isPremium = isVitalicio;

    // --- MODALS STATE ---
    const [stepModalMode, setStepModalMode] = useState<'ADD' | 'EDIT'>('ADD');
    const [isStepModalOpen, setIsStepModalOpen] = useState(false);
    const [currentStepId, setCurrentStepId] = useState<string | null>(null);
    const [stepName, setStepName] = useState('');
    const [stepStart, setStepStart] = useState('');
    const [stepEnd, setStepEnd] = useState('');
    
    // Material Filter (Main Tab)
    const [materialFilterStepId, setMaterialFilterStepId] = useState<string>('ALL');
    
    // Material Modals & Forms
    const [materialModal, setMaterialModal] = useState<{ isOpen: boolean, material: Material | null }>({ isOpen: false, material: null });
    const [matName, setMatName] = useState('');
    const [matBrand, setMatBrand] = useState('');
    const [matPlannedQty, setMatPlannedQty] = useState('');
    const [matUnit, setMatUnit] = useState('');
    const [matBuyQty, setMatBuyQty] = useState('');
    const [matBuyCost, setMatBuyCost] = useState('');

    const [addMatModal, setAddMatModal] = useState(false);
    const [newMatName, setNewMatName] = useState('');
    const [newMatBrand, setNewMatBrand] = useState('');
    const [newMatQty, setNewMatQty] = useState('');
    const [newMatUnit, setNewMatUnit] = useState('un');
    const [newMatStepId, setNewMatStepId] = useState('');
    const [newMatBuyNow, setNewMatBuyNow] = useState(false);
    const [newMatBuyQty, setNewMatBuyQty] = useState('');
    const [newMatBuyCost, setNewMatBuyCost] = useState('');

    // EXPENSE MODAL STATE
    const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean, mode: 'ADD'|'EDIT', id?: string }>({ isOpen: false, mode: 'ADD' });
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expTotalAgreed, setExpTotalAgreed] = useState('');
    const [expCategory, setExpCategory] = useState<string>(ExpenseCategory.LABOR);
    const [expStepId, setExpStepId] = useState('');
    const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
    // NEW STATE: Tracks the amount already in DB to support cumulative logic
    const [expSavedAmount, setExpSavedAmount] = useState(0);

    // PEOPLE MODAL STATE
    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personMode, setPersonMode] = useState<'WORKER'|'SUPPLIER'>('WORKER');
    const [personId, setPersonId] = useState<string | null>(null); 
    const [personName, setPersonName] = useState('');
    const [personRole, setPersonRole] = useState('');
    const [personPhone, setPersonPhone] = useState('');
    const [personNotes, setPersonNotes] = useState('');

    // CONTRACTS/CHECKLISTS
    const [viewContract, setViewContract] = useState<{title: string, content: string} | null>(null);
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    // GENERAL MODAL
    const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string }>({ 
        isOpen: false, 
        title: '', 
        message: '',
        onCancel: () => {}, 
    });

    // CALCULATOR STATES
    const [calcType, setCalcType] = useState<'PISO'|'PAREDE'|'PINTURA'>('PISO');
    const [calcArea, setCalcArea] = useState('');
    const [calcResult, setCalcResult] = useState<string[]>([]);

    // --- LOAD DATA ---
    const load = async () => {
        // Only proceed if initial auth check is done AND id is available
        if (!id || !isUserAuthFinished) return;
        
        // Use authLoading from context to gate initial page load
        if (authLoading) return; // Wait for AuthContext to finish loading

        setLoading(true);
        const w = await dbService.getWorkById(id);
        setWork(w || null);
        
        if (w) {
            const [s, m, e, wk, sp, ph, fl, workStats] = await Promise.all([ // Added workStats to parallel fetch
                dbService.getSteps(w.id),
                dbService.getMaterials(w.id),
                dbService.getExpenses(w.id),
                dbService.getWorkers(w.id),
                dbService.getSuppliers(w.id),
                dbService.getPhotos(w.id),
                dbService.getFiles(w.id),
                dbService.calculateWorkStats(w.id)
            ]);
            
            setSteps(s ? s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) : []);
            setMaterials(m || []);
            setExpenses(e ? e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : []);
            setWorkers(wk || []);
            setSuppliers(sp || []);
            setPhotos(ph || []);
            setFiles(fl || []);
            setStats(workStats);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, [id, authLoading, isUserAuthFinished]);

    // --- HANDLERS ---

    const handleSaveStep = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !stepName) return;

        if (stepModalMode === 'ADD') {
            await dbService.addStep({
                workId: work.id,
                name: stepName,
                startDate: stepStart,
                endDate: stepEnd,
                status: StepStatus.NOT_STARTED,
                isDelayed: false
            });
        } else if (stepModalMode === 'EDIT' && currentStepId) {
            const existing = steps.find(s => s.id === currentStepId);
            if (existing) {
                await dbService.updateStep({
                    ...existing,
                    name: stepName,
                    startDate: stepStart,
                    endDate: stepEnd
                });
            }
        }
        setIsStepModalOpen(false);
        setStepName('');
        await load();
    };

    const handleStepStatusClick = async (step: Step) => {
        let newStatus = StepStatus.NOT_STARTED;
        if (step.status === StepStatus.NOT_STARTED) newStatus = StepStatus.IN_PROGRESS;
        else if (step.status === StepStatus.IN_PROGRESS) newStatus = StepStatus.COMPLETED;
        else newStatus = StepStatus.NOT_STARTED;

        await dbService.updateStep({ ...step, status: newStatus });
        await load();
    };

    const handleAddMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !newMatName) return;
        const mat: Omit<Material, 'id'> = {
            workId: work.id,
            name: newMatName,
            brand: newMatBrand,
            plannedQty: Number(newMatQty),
            purchasedQty: 0,
            unit: newMatUnit,
            stepId: newMatStepId || undefined
        };
        
        await dbService.addMaterial(mat, newMatBuyNow ? {
            qty: Number(newMatBuyQty),
            cost: Number(newMatBuyCost),
            date: new Date().toISOString()
        } : undefined);
        
        setAddMatModal(false);
        setNewMatName(''); setNewMatBrand(''); setNewMatQty(''); setNewMatBuyNow(false);
        setNewMatStepId(''); setNewMatBuyQty(''); setNewMatBuyCost(''); // Reset all fields
        await load();
    };

    const handleUpdateMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!materialModal.material) return;
        
        const hasPurchase = matBuyQty && Number(matBuyQty) > 0;

        try {
            // 1. Update Definition
            const updatedMaterial = {
                ...materialModal.material,
                name: matName,
                brand: matBrand,
                plannedQty: Number(matPlannedQty),
                unit: matUnit
            };
            await dbService.updateMaterial(updatedMaterial);

            // 2. Register Purchase (if applicable)
            if (hasPurchase) {
                await dbService.registerMaterialPurchase(
                    materialModal.material.id,
                    matName,
                    matBrand,
                    Number(matPlannedQty),
                    matUnit,
                    Number(matBuyQty),
                    Number(matBuyCost)
                );
            }

            setMaterialModal({ isOpen: false, material: null });
            await load();
        } catch (error: any) {
            console.error("Erro ao salvar material:", error);
            alert(`Falha ao salvar material: ${error.message || "Erro desconhecido."}`);
        }
    };

    const openAddExpense = () => {
        setExpenseModal({ isOpen: true, mode: 'ADD' });
        setExpDesc('');
        setExpAmount('');
        setExpSavedAmount(0);
        setExpTotalAgreed('');
        setExpCategory(ExpenseCategory.LABOR);
        setExpStepId('');
        setExpDate(new Date().toISOString().split('T')[0]);
    };

    const openEditExpense = (expense: Expense) => {
        setExpenseModal({ isOpen: true, mode: 'EDIT', id: expense.id });
        setExpDesc(expense.description);
        setExpAmount(''); 
        setExpSavedAmount(expense.amount); 
        setExpTotalAgreed(expense.totalAgreed ? String(expense.totalAgreed) : '');
        setExpCategory(expense.category);
        setExpStepId(expense.stepId || '');
        setExpDate(expense.date.split('T')[0]);
    };

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !expDesc) return;
        
        const finalStepId = expStepId || undefined;
        const finalTotalAgreed = expTotalAgreed ? Number(expTotalAgreed) : undefined;
        const inputAmount = Number(expAmount) || 0;

        try {
            if (expenseModal.mode === 'ADD') {
                await dbService.addExpense({
                    workId: work.id,
                    description: expDesc,
                    amount: inputAmount,
                    date: new Date(expDate).toISOString(),
                    category: expCategory,
                    stepId: finalStepId,
                    // Fix: Corrected typo from finalTotalAgumed to finalTotalAgreed
                    totalAgreed: finalTotalAgreed 
                });
            } else if (expenseModal.mode === 'EDIT' && expenseModal.id) {
                const existing = expenses.find(e => e.id === expenseModal.id);
                if (existing) {
                    const newTotalAmount = expSavedAmount + inputAmount;

                    await dbService.updateExpense({
                        ...existing,
                        description: expDesc,
                        amount: newTotalAmount,
                        date: new Date(expDate).toISOString(),
                        category: expCategory,
                        stepId: finalStepId,
                        totalAgreed: finalTotalAgreed
                    });
                }
            }
            setExpenseModal({ isOpen: false, mode: 'ADD' });
            await load();
        } catch (error: any) {
            console.error("Erro ao salvar despesa:", error);
            alert(`Falha ao salvar despesa: ${error.message || "Erro desconhecido."}`);
        }
    };

    const handleDeleteExpense = async () => {
        if (expenseModal.id) {
            if (window.confirm("Tem certeza que deseja excluir este gasto?")) {
                await dbService.deleteExpense(expenseModal.id);
                setExpenseModal({ isOpen: false, mode: 'ADD' });
                await load();
            }
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'PHOTO' | 'FILE') => {
        if (e.target.files && e.target.files[0] && work) {
            setUploading(true);
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                await new Promise(r => setTimeout(r, 800));
                
                if (type === 'PHOTO') {
                    await dbService.addPhoto({
                        workId: work.id,
                        url: base64,
                        description: 'Foto da obra',
                        date: new Date().toISOString(),
                        type: 'PROGRESS'
                    });
                } else {
                    await dbService.addFile({
                        workId: work.id,
                        name: file.name,
                        category: FileCategory.GENERAL,
                        url: base64,
                        type: file.type,
                        date: new Date().toISOString()
                    });
                }
                setUploading(false);
                await load();
            };
            reader.readAsDataURL(file);
        }
    };

    const openPersonModal = (mode: 'WORKER' | 'SUPPLIER', item?: Worker | Supplier) => {
        if (!user || !work) {
            console.error("Usuário ou Obra não disponíveis para abrir modal de pessoa.");
            return;
        }

        setPersonMode(mode);
        if (item) {
            setPersonId(item.id);
            setPersonName(item.name);
            setPersonPhone(item.phone);
            setPersonNotes(item.notes || '');
            if (mode === 'WORKER') setPersonRole((item as Worker).role);
            else setPersonRole((item as Supplier).category);
        } else {
            setPersonId(null);
            setPersonName('');
            setPersonPhone('');
            setPersonNotes('');
            setPersonRole(mode === 'WORKER' ? STANDARD_JOB_ROLES[0] : STANDARD_SUPPLIER_CATEGORIES[0]);
        }
        setIsPersonModalOpen(true);
    };

    const handleSavePerson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !work) {
            console.error("Usuário ou Obra não disponíveis para salvar pessoa.");
            return;
        }

        const payload = {
            userId: user.id,
            workId: work.id,
            name: personName,
            phone: personPhone,
            notes: personNotes
        };

        if (personId) {
            if (personMode === 'WORKER') await dbService.updateWorker({ ...payload, id: personId, role: personRole });
            else await dbService.updateSupplier({ ...payload, id: personId, category: personRole });
        } else {
            if (personMode === 'WORKER') await dbService.addWorker({ ...payload, role: personRole });
            else await dbService.addSupplier({ ...payload, category: personRole });
        }
        
        await load();
        setIsPersonModalOpen(false);
    };

    const handleDeletePerson = (idToDelete: string, workId: string, mode: 'WORKER' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true,
            title: mode === 'WORKER' ? 'Excluir Profissional' : 'Excluir Fornecedor',
            message: 'Tem certeza? Essa ação não pode ser desfeita. O profissional/fornecedor será removido APENAS desta obra.',
            onConfirm: async () => {
                if (mode === 'WORKER') await dbService.deleteWorker(idToDelete, workId);
                else await dbService.deleteSupplier(idToDelete, workId);
                await load();
                setZeModal(prev => ({ ...prev, isOpen: false, onCancel: () => {} }));
            },
            onCancel: () => setZeModal(prev => ({ ...prev, isOpen: false, onCancel: () => {} }))
        });
    };

    // CALCULATORS
    useEffect(() => {
        if (!calcArea) { setCalcResult([]); return; }
        const area = Number(calcArea);
        if (calcType === 'PISO') {
            const piso = Math.ceil(area * 1.15); 
            const argamassa = Math.ceil(area * 4); 
            const rejunte = Math.ceil(area * 0.3); 
            setCalcResult([`${piso} m² de Piso (com quebra)`, `${argamassa} kg de Argamassa AC-II/III`, `${rejunte} kg de Rejunte`]);
        } else if (calcType === 'PAREDE') {
            const tijolos = Math.ceil(area * 30); 
            const cimento = Math.ceil(area * 5); 
            setCalcResult([`${tijolos} Blocos/Tijolos`, `~${Math.ceil(cimento/50)} Sacos de Cimento`]);
        } else if (calcType === 'PINTURA') {
            const litros = Math.ceil(area / 10);
            setCalcResult([`${litros * 2} Litros de Tinta (2 demãos)`, `${Math.ceil(area/30)} L de Selador`]);
        }
    }, [calcArea, calcType]);

    // EXPORT EXCEL
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const wsCrono = XLSX.utils.json_to_sheet(steps.map(s => ({ Etapa: s.name, Inicio: parseDateNoTimezone(s.startDate), Fim: parseDateNoTimezone(s.endDate), Status: s.status })));
        XLSX.utils.book_append_sheet(wb, wsCrono, "Cronograma");
        const wsMat = XLSX.utils.json_to_sheet(materials.map(m => ({ Material: m.name, Qtd: m.plannedQty, Comprado: m.purchasedQty })));
        XLSX.utils.book_append_sheet(wb, wsMat, "Materiais");
        const wsFin = XLSX.utils.json_to_sheet(expenses.map(e => ({ Descrição: e.description, Valor: e.amount, Categoria: e.category, Data: parseDateNoTimezone(e.date), Etapa: steps.find(s => s.id === e.stepId)?.name || 'N/A' })));
        XLSX.utils.book_append_sheet(wb, wsFin, "Financeiro");
        XLSX.writeFile(wb, `Obra_${work?.name}.xlsx`);
    };

    const handlePrintPDF = () => {
        window.print();
    };

    // Show loading if AuthContext is still loading OR if initial auth check is not done OR if local work details are loading
    if (authLoading || !isUserAuthFinished || loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return <div className="text-center text-xl text-red-500 py-10">Obra não encontrada.</div>;


    // --- RENDER FUNCTIONS FOR REPORT SECTIONS (REUSABLE) ---
    const today = new Date().toISOString().split('T')[0]; // Define today once for date comparisons

    const RenderCronogramaReport: React.FC = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
            <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
                <i className="fa-solid fa-calendar-days text-secondary"></i> Cronograma
            </h3>
            <div className="space-y-4">
                {steps.map((s, idx) => {
                    const isDone = s.status === StepStatus.COMPLETED;
                    const isInProgress = s.status === StepStatus.IN_PROGRESS;
                    const isDelayed = s.endDate < today && !isDone;

                    let bgColorClass = 'bg-slate-50 dark:bg-slate-800';
                    let textColorClass = 'text-slate-600 dark:text-slate-300';
                    let iconClass = 'fa-clock';
                    let iconColor = 'text-slate-400';

                    if (isDone) {
                        bgColorClass = 'bg-green-50 dark:bg-green-900/10';
                        textColorClass = 'text-green-700 dark:text-green-400';
                        iconClass = 'fa-check-circle';
                        iconColor = 'text-green-600';
                    } else if (isDelayed) {
                        bgColorClass = 'bg-red-50 dark:bg-red-900/10';
                        textColorClass = 'text-red-700 dark:text-red-400';
                        iconClass = 'fa-triangle-exclamation';
                        iconColor = 'text-red-600';
                    } else if (isInProgress) {
                        bgColorClass = 'bg-orange-50 dark:bg-orange-900/10';
                        textColorClass = 'text-orange-700 dark:text-orange-400';
                        iconClass = 'fa-hammer';
                        iconColor = 'text-orange-600';
                    }
                    
                    return (
                        <div key={s.id} className={`p-3 rounded-xl border ${bgColorClass} border-slate-200 dark:border-slate-700`}>
                            <div className="flex items-center gap-3 mb-2">
                                <i className={`fa-solid ${iconClass} ${iconColor} text-lg`}></i>
                                <p className={`font-bold text-sm ${textColorClass}`}>{String(idx + 1).padStart(2, '0')}. {s.name}</p>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Início: {parseDateNoTimezone(s.startDate)}</span>
                                <span>Fim: {parseDateNoTimezone(s.endDate)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const RenderMateriaisReport: React.FC = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
            <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
                <i className="fa-solid fa-boxes-stacked text-secondary"></i> Materiais
            </h3>
            <div className="space-y-6">
                {[...steps, { id: 'general-mat', name: 'Materiais Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step) => {
                    const groupMaterials = materials.filter(m => {
                        if (step.id === 'general-mat') return !m.stepId;
                        return m.stepId === step.id;
                    });

                    if (groupMaterials.length === 0) return null;

                    const isGeneral = step.id === 'general-mat';
                    const stepLabel = isGeneral ? step.name : `Etapa: ${step.name}`;

                    return (
                        <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-primary dark:text-white text-sm uppercase tracking-wide mb-3">{stepLabel}</h4>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                {groupMaterials.map(m => {
                                    const isFullyPurchased = m.purchasedQty >= m.plannedQty;
                                    const itemStatusClass = isFullyPurchased ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
                                    const itemIconClass = isFullyPurchased ? 'fa-check-circle' : 'fa-circle-exclamation';

                                    return (
                                        <li key={m.id} className="py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs">
                                            <p className="font-bold text-primary dark:text-white mb-1 sm:mb-0">{m.name} {m.brand && <span className="text-slate-500 font-normal">({m.brand})</span>}</p>
                                            <div className="flex items-center gap-2 font-mono text-right">
                                                <span className="text-slate-700 dark:text-slate-300">Sug.: {m.plannedQty} {m.unit}</span>
                                                <span className={`font-bold ${itemStatusClass} flex items-center gap-1`}>
                                                    <i className={`fa-solid ${itemIconClass}`}></i> Compr.: {m.purchasedQty} {m.unit}
                                                </span>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const RenderFinanceiroReport: React.FC = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 print:shadow-none print:border-0 print:rounded-none">
            <h3 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
                <i className="fa-solid fa-dollar-sign text-secondary"></i> Financeiro
            </h3>
            <div className="space-y-6">
                {[...steps, { id: 'general-fin', name: 'Despesas Gerais / Sem Etapa', startDate: '', endDate: '', status: StepStatus.NOT_STARTED, workId: '', isDelayed: false }].map((step) => {
                    const groupExpenses = expenses.filter(e => {
                        if (step.id === 'general-fin') return !e.stepId;
                        return e.stepId === step.id;
                    });

                    if (groupExpenses.length === 0) return null;

                    const isGeneral = step.id === 'general-fin';
                    const stepLabel = isGeneral ? step.name : `Etapa: ${step.name}`;

                    return (
                        <div key={step.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-primary dark:text-white text-sm uppercase tracking-wide mb-3">{stepLabel}</h4>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                                {groupExpenses.map(exp => {
                                    const relatedMaterial = exp.relatedMaterialId ? materials.find(m => m.id === exp.relatedMaterialId) : null;
                                    const expenseWorker = exp.workerId ? workers.find(w => w.id === exp.workerId) : null;

                                    let categoryIcon = 'fa-tag';
                                    let categoryColor = 'text-slate-500';
                                    if (exp.category === ExpenseCategory.MATERIAL) {
                                        categoryIcon = 'fa-box';
                                        categoryColor = 'text-amber-600';
                                    } else if (exp.category === ExpenseCategory.LABOR) {
                                        categoryIcon = 'fa-helmet-safety';
                                        categoryColor = 'text-blue-600';
                                    }

                                    return (
                                        <li key={exp.id} className="py-3 flex justify-between items-center text-xs">
                                            <div>
                                                <p className="font-bold text-primary dark:text-white">{exp.description}</p>
                                                <p className="text-slate-500 mt-1 flex items-center gap-2">
                                                    <span className={`flex items-center gap-1 ${categoryColor}`}><i className={`fa-solid ${categoryIcon}`}></i> {exp.category}</span>
                                                    <span>• {parseDateNoTimezone(exp.date)}</span>
                                                    {relatedMaterial && <span className="text-sm font-medium text-slate-400">(Material: {relatedMaterial.name})</span>}
                                                    {expenseWorker && <span className="text-sm font-medium text-slate-400">(Profissional: {expenseWorker.name})</span>}
                                                </p>
                                            </div>
                                            <span className="font-bold text-primary dark:text-white whitespace-nowrap">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    // --- RENDER CONTENT ---

    const renderMainTab = () => {
        if (activeTab === 'SCHEDULE') {
            return (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Cronograma</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Etapas da Obra</p>
                        </div>
                        <button onClick={() => { setStepModalMode('ADD'); setStepName(''); setStepStart(new Date().toISOString().split('T')[0]); setStepEnd(new Date().toISOString().split('T')[0]); setIsStepModalOpen(true); }} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                    </div>
                    {steps.map((step, idx) => {
                         const stepNum = String(idx + 1).padStart(2, '0');
                         const isDone = step.status === StepStatus.COMPLETED;
                         const isInProgress = step.status === StepStatus.IN_PROGRESS;
                         
                         // Determine Delay (Late) status
                         const today = new Date().toISOString().split('T')[0];
                         const isDelayed = step.endDate < today && !isDone;

                         let statusBadgeClass = 'bg-slate-100 text-slate-500';
                         let statusText = 'Pendente';
                         let cardBorderClass = 'border-slate-100 dark:border-slate-800';
                         let iconColor = 'border-slate-200 text-slate-300';
                         let iconClass = 'fa-play';

                         if (isDone) {
                             statusBadgeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                             statusText = 'Concluído';
                             cardBorderClass = 'border-green-200 dark:border-green-900/30';
                             iconColor = 'bg-green-500 border-green-500 text-white';
                             iconClass = 'fa-check';
                         } else if (isDelayed) {
                             // Red style for delayed items
                             statusBadgeClass = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
                             statusText = 'Atrasado';
                             cardBorderClass = 'border-red-200 dark:border-red-900/30';
                             iconColor = 'bg-red-500 border-red-500 text-white animate-pulse';
                             iconClass = 'fa-triangle-exclamation';
                         } else if (isInProgress) {
                             statusBadgeClass = 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
                             statusText = 'Em Andamento';
                             iconColor = 'bg-secondary border-secondary text-white';
                             iconClass = 'fa-hammer';
                         }

                         return (
                            <div key={step.id} className={`group bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md relative overflow-hidden ${cardBorderClass}`}>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleStepStatusClick(step)} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${iconColor}`}>
                                        <i className={`fa-solid ${iconClass}`}></i>
                                    </button>
                                    <div className="flex-1 cursor-pointer" onClick={() => { setStepModalMode('EDIT'); setCurrentStepId(step.id); setStepName(step.name); setStepStart(step.startDate.split('T')[0]); setStepEnd(step.endDate.split('T')[0]); setIsStepModalOpen(true); }}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-bold text-slate-400">ETAPA {stepNum}</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusBadgeClass}`}>{statusText}</span>
                                                </div>
                                                <h3 className={`font-bold text-lg leading-tight ${isDone ? 'text-slate-400 line-through' : 'text-primary dark:text-white'}`}>{step.name}</h3>
                                            </div>
                                            <div className="text-slate-300 hover:text-secondary p-1"><i className="fa-solid fa-pen-to-square"></i></div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                <i className="fa-regular fa-calendar"></i> {parseDateNoTimezone(step.startDate)}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                <i className="fa-solid fa-flag-checkered"></i> {parseDateNoTimezone(step.endDate)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                         );
                    })}
                </div>
            );
        }

        if (activeTab === 'MATERIALS') {
             // Filter Logic
             const filteredSteps = materialFilterStepId === 'ALL' 
                ? steps 
                : steps.filter(s => s.id === materialFilterStepId);

             return (
                <div className="space-y-6 animate-in fade-in">
                    <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950 pb-2">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white">Materiais</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Controle de Compras</p>
                            </div>
                            <button onClick={() => setAddMatModal(true)} className="bg-primary text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-primary-light transition-all shadow-lg shadow-primary/30"><i className="fa-solid fa-plus text-lg"></i></button>
                        </div>
                        
                        {/* STEP FILTER DROPDOWN */}
                        <div className="px-2">
                            <select 
                                value={materialFilterStepId}
                                onChange={(e) => setMaterialFilterStepId(e.target.value)}
                                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-sm text-slate-600 dark:text-slate-300 shadow-sm focus:border-secondary focus:ring-1 focus:ring-secondary outline-none transition-all"
                            >
                                <option value="ALL">Todas as Etapas</option>
                                {steps.map((s, idx) => (
                                    <option key={s.id} value={s.id}>{String(idx+1).padStart(2, '0')}. {s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {filteredSteps.map((step) => {
                        const originalIdx = steps.findIndex(s => s.id === step.id);
                        const stepMaterials = materials ? materials.filter(m => m.stepId === step.id) : [];
                        
                        if (stepMaterials.length === 0 && materialFilterStepId !== 'ALL') {
                            return <div key={step.id} className="text-center text-slate-400 py-8 italic text-sm">Sem materiais cadastrados nesta etapa.</div>;
                        }
                        if (stepMaterials.length === 0) return null;
                        
                        return (
                            <div key={step.id} className="mb-8 bg-white/50 dark:bg-slate-900/50 rounded-2xl p-2">
                                {/* Stronger Visual Separation for Step Header */}
                                <div className="flex items-center gap-3 mb-4 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border-l-4 border-secondary">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-secondary font-black text-sm flex items-center justify-center">
                                        {String(originalIdx+1).padStart(2,'0')}
                                    </div>
                                    <h3 className="font-bold text-lg text-primary dark:text-white uppercase tracking-tight">{step.name}</h3>
                                </div>

                                <div className="space-y-3 px-1">
                                    {stepMaterials.map(mat => {
                                        const hasPlanned = mat.plannedQty > 0;
                                        const purchased = mat.purchasedQty;
                                        const progress = hasPlanned ? Math.min(100, (purchased / mat.plannedQty) * 100) : 0;
                                        
                                        // Logic for Partial/Complete/Pending
                                        let statusText = 'Pendente';
                                        let statusColor = 'bg-slate-100 text-slate-500';
                                        let barColor = 'bg-slate-200';

                                        if (purchased >= mat.plannedQty) {
                                            statusText = 'Concluído';
                                            statusColor = 'bg-green-100 text-green-700';
                                            barColor = 'bg-green-500';
                                        } else if (purchased > 0) {
                                            statusText = 'Parcial';
                                            statusColor = 'bg-orange-100 text-orange-600';
                                            barColor = 'bg-secondary';
                                        }

                                        return (
                                            <div key={mat.id} onClick={() => { setMaterialModal({isOpen: true, material: mat}); setMatName(mat.name); setMatBrand(mat.brand||''); setMatPlannedQty(String(mat.plannedQty)); setMatUnit(mat.unit); setMatBuyQty(''); setMatBuyCost(''); }} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20`}>
                                                <div className="flex items-center justify-between gap-3 mb-2">
                                                    <h4 className="font-bold text-primary dark:text-white text-base leading-tight truncate">{mat.name}</h4>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${statusColor}`}>{statusText}</span>
                                                </div>
                                                {mat.brand && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Marca: {mat.brand}</p>}
                                                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium mb-1">
                                                    <span>Planejado: <span className="font-bold">{mat.plannedQty} {mat.unit}</span></span>
                                                    <span>Comprado: <span className="font-bold">{mat.purchasedQty} {mat.unit}</span></span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (activeTab === 'FINANCIAL') {
            const totalPlanned = work.budgetPlanned;
            const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const remainingBudget = totalPlanned - totalSpent;
            const budgetStatusClass = remainingBudget < 0 ? 'text-red-500' : 'text-green-500';

            return (
                <div className="space-y-6 animate-in fade-in">
                    <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950 pb-2">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Despesas da Obra</p>
                            </div>
                            <button onClick={openAddExpense} className="bg-primary text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-primary-light transition-all shadow-lg shadow-primary/30"><i className="fa-solid fa-plus text-lg"></i></button>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                        <h3 className="text-lg font-bold text-primary dark:text-white mb-4">Resumo Orçamentário</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <p>Orçamento Total:</p> <p className="font-bold text-right">R$ {totalPlanned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p>Total Gasto:</p> <p className="font-bold text-right">R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="font-bold pt-2 border-t border-slate-100 dark:border-slate-800">Saldo Restante:</p> 
                            <p className={`font-bold pt-2 border-t border-slate-100 dark:border-slate-800 text-right ${budgetStatusClass}`}>R$ {remainingBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {expenses.length === 0 ? (
                            <div className="text-center text-slate-400 py-8 italic text-sm">Nenhum gasto registrado ainda.</div>
                        ) : (
                            expenses.map(exp => {
                                const stepName = steps.find(s => s.id === exp.stepId)?.name || 'N/A';
                                const workerName = workers.find(w => w.id === exp.workerId)?.name || 'N/A';
                                let categoryIcon = 'fa-tag';
                                let categoryColor = 'text-slate-500';

                                if (exp.category === ExpenseCategory.MATERIAL) {
                                    categoryIcon = 'fa-box';
                                    categoryColor = 'text-amber-600';
                                } else if (exp.category === ExpenseCategory.LABOR) {
                                    categoryIcon = 'fa-helmet-safety';
                                    categoryColor = 'text-blue-600';
                                }

                                return (
                                    <div key={exp.id} onClick={() => openEditExpense(exp)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-primary dark:text-white text-base leading-tight">{exp.description}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs font-medium flex items-center gap-1 ${categoryColor}`}>
                                                        <i className={`fa-solid ${categoryIcon}`}></i> {exp.category}
                                                    </span>
                                                    <span className="text-xs text-slate-400">• {parseDateNoTimezone(exp.date)}</span>
                                                    {exp.stepId && <span className="text-xs text-slate-400">• Etapa: {stepName}</span>}
                                                    {exp.workerId && <span className="text-xs text-slate-400">• Prof.: {workerName}</span>}
                                                </div>
                                            </div>
                                            <span className="font-black text-lg text-primary dark:text-white whitespace-nowrap">R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        {exp.totalAgreed && (exp.totalAgreed > exp.amount) && (
                                            <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                                <span>Valor total acordado:</span>
                                                <span className="font-bold">R$ {Number(exp.totalAgreed).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                {exp.totalAgreed > exp.amount && (
                                                    <span className="font-bold text-red-500">
                                                        (Faltam: R$ {(exp.totalAgreed - exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            );
        }

        if (activeTab === 'MORE') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Mais Ferramentas</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Bônus & Relatórios</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                        <h3 className="text-lg font-bold text-primary dark:text-white mb-4">Gerenciamento Avançado</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <button onClick={() => setSubView('TEAM')} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex flex-col items-center justify-center text-sm font-medium text-primary dark:text-white">
                                <i className="fa-solid fa-people-group text-2xl mb-2 text-secondary"></i> Equipe
                            </button>
                            <button onClick={() => setSubView('SUPPLIERS')} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex flex-col items-center justify-center text-sm font-medium text-primary dark:text-white">
                                <i className="fa-solid fa-truck-field text-2xl mb-2 text-secondary"></i> Fornecedores
                            </button>
                            <button onClick={() => setSubView('PHOTOS')} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex flex-col items-center justify-center text-sm font-medium text-primary dark:text-white">
                                <i className="fa-solid fa-camera text-2xl mb-2 text-secondary"></i> Fotos da Obra
                            </button>
                            <button onClick={() => setSubView('PROJECTS')} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex flex-col items-center justify-center text-sm font-medium text-primary dark:text-white">
                                <i className="fa-solid fa-folder-open text-2xl mb-2 text-secondary"></i> Projetos e Docs
                            </button>
                            {isPremium ? (
                                <>
                                <button onClick={() => setSubView('CALCULATORS')} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-secondary/10 dark:hover:bg-secondary/20 transition-colors flex flex-col items-center justify-center text-sm font-medium text-secondary border border-secondary/20">
                                    <i className="fa-solid fa-calculator text-2xl mb-2 text-secondary"></i> Calculadoras
                                </button>
                                <button onClick={() => setSubView('CONTRACTS')} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-secondary/10 dark:hover:bg-secondary/20 transition-colors flex flex-col items-center justify-center text-sm font-medium text-secondary border border-secondary/20">
                                    <i className="fa-solid fa-file-contract text-2xl mb-2 text-secondary"></i> Contratos
                                </button>
                                <button onClick={() => setSubView('CHECKLIST')} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-secondary/10 dark:hover:bg-secondary/20 transition-colors flex flex-col items-center justify-center text-sm font-medium text-secondary border border-secondary/20">
                                    <i className="fa-solid fa-list-check text-2xl mb-2 text-secondary"></i> Checklists
                                </button>
                                </>
                            ) : (
                                <div className="p-4 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 text-white flex flex-col items-center justify-center text-sm font-medium relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-gold opacity-10"></div>
                                    <i className="fa-solid fa-lock text-3xl mb-2 text-amber-300 relative z-10"></i>
                                    <span className="font-bold text-amber-200 text-xs text-center relative z-10">Recursos Premium</span>
                                    <button onClick={() => navigate('/settings')} className="absolute inset-0 text-xs font-bold bg-black/60 hover:bg-black/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <i className="fa-solid fa-arrow-up-right-from-square mr-2 text-white/80"></i> <span className="text-white">Desbloquear</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="text-lg font-bold text-primary dark:text-white mb-4">Relatórios</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setSubView('REPORTS')} className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors flex flex-col items-center justify-center text-sm font-medium">
                                <i className="fa-solid fa-file-pdf text-2xl mb-2"></i> PDF
                            </button>
                            <button onClick={handleExportExcel} className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors flex flex-col items-center justify-center text-sm font-medium">
                                <i className="fa-solid fa-file-excel text-2xl mb-2"></i> Excel
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (subView === 'TEAM') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Equipe</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Profissionais da Obra</p>
                        </div>
                        <button onClick={() => openPersonModal('WORKER')} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                    </div>
                    <div className="space-y-4">
                        {workers.length === 0 ? (
                            <div className="text-center text-slate-400 py-8 italic text-sm">Nenhum profissional cadastrado.</div>
                        ) : (
                            workers.map(worker => (
                                <div key={worker.id} onClick={() => openPersonModal('WORKER', worker)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="font-bold text-primary dark:text-white text-base leading-tight">{worker.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{worker.role}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {worker.dailyRate && <span className="text-sm font-bold text-secondary">R$ {worker.dailyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/dia</span>}
                                            <button onClick={(e) => { e.stopPropagation(); handleDeletePerson(worker.id, worker.workId, 'WORKER'); }} className="text-red-400 hover:text-red-600 transition-colors p-1"><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            );
        }
        if (subView === 'SUPPLIERS') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Fornecedores</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Parceiros da Obra</p>
                        </div>
                        <button onClick={() => openPersonModal('SUPPLIER')} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                    </div>
                    <div className="space-y-4">
                        {suppliers.length === 0 ? (
                            <div className="text-center text-slate-400 py-8 italic text-sm">Nenhum fornecedor cadastrado.</div>
                        ) : (
                            suppliers.map(supplier => (
                                <div key={supplier.id} onClick={() => openPersonModal('SUPPLIER', supplier)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="font-bold text-primary dark:text-white text-base leading-tight">{supplier.name}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{supplier.category}</p>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeletePerson(supplier.id, supplier.workId, 'SUPPLIER'); }} className="text-red-400 hover:text-red-600 transition-colors p-1"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            );
        }
        if (subView === 'PHOTOS') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Fotos</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Registro Visual</p>
                        </div>
                        <div className="relative">
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleFileUpload(e, 'PHOTO')} 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                                disabled={uploading}
                            />
                            <button className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform" disabled={uploading}>
                                {uploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {photos.length === 0 ? (
                            <div className="col-span-full text-center text-slate-400 py-8 italic text-sm">Nenhuma foto adicionada.</div>
                        ) : (
                            photos.map(photo => (
                                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm group">
                                    <img src={photo.url} alt={photo.description} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex flex-col justify-end text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-xs font-medium">{parseDateNoTimezone(photo.date)}</p>
                                        <p className="text-sm font-bold">{photo.description}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            );
        }
        if (subView === 'PROJECTS') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Projetos & Docs</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Arquivos Importantes</p>
                        </div>
                        <div className="relative">
                            <input 
                                type="file" 
                                onChange={(e) => handleFileUpload(e, 'FILE')} 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                                disabled={uploading}
                            />
                            <button className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform" disabled={uploading}>
                                {uploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {files.length === 0 ? (
                            <div className="col-span-full text-center text-slate-400 py-8 italic text-sm">Nenhum arquivo adicionado.</div>
                        ) : (
                            files.map(file => (
                                <a href={file.url} target="_blank" rel="noopener noreferrer" key={file.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                                    <div className="w-10 h-10 rounded-lg bg-secondary/10 dark:bg-secondary/20 text-secondary flex items-center justify-center shrink-0">
                                        <i className="fa-solid fa-file text-xl"></i>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-primary dark:text-white text-base leading-tight group-hover:text-secondary">{file.name}</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{file.category} • {parseDateNoTimezone(file.date)}</p>
                                    </div>
                                    <i className="fa-solid fa-arrow-up-right-from-square text-slate-400 group-hover:text-secondary"></i>
                                </a>
                            ))
                        )}
                    </div>
                </div>
            );
        }
        if (subView === 'REPORTS') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2 print:hidden">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Relatórios</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gerar e Imprimir</p>
                        </div>
                        <button onClick={handlePrintPDF} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-print"></i></button>
                    </div>

                    <div className="md:hidden mb-4 print:hidden">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-sm font-bold text-slate-500">
                            <button onClick={() => setReportActiveTab('CRONOGRAMA')} className={`flex-1 py-2 rounded-lg transition-colors ${reportActiveTab === 'CRONOGRAMA' ? 'bg-white text-primary shadow-sm dark:bg-slate-900 dark:text-white' : 'hover:text-primary dark:hover:text-white'}`}>Cronograma</button>
                            <button onClick={() => setReportActiveTab('MATERIAIS')} className={`flex-1 py-2 rounded-lg transition-colors ${reportActiveTab === 'MATERIAIS' ? 'bg-white text-primary shadow-sm dark:bg-slate-900 dark:text-white' : 'hover:text-primary dark:hover:text-white'}`}>Materiais</button>
                            <button onClick={() => setReportActiveTab('FINANCEIRO')} className={`flex-1 py-2 rounded-lg transition-colors ${reportActiveTab === 'FINANCEIRO' ? 'bg-white text-primary shadow-sm dark:bg-slate-900 dark:text-white' : 'hover:text-primary dark:hover:text-white'}`}>Financeiro</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 print:block hidden-in-print">
                            <RenderCronogramaReport />
                        </div>
                        <div className="md:col-span-1 print:block hidden-in-print">
                            <RenderMateriaisReport />
                        </div>
                        <div className="md:col-span-1 print:block hidden-in-print">
                            <RenderFinanceiroReport />
                        </div>

                        {/* Mobile view rendering based on reportActiveTab */}
                        <div className="md:hidden">
                            {reportActiveTab === 'CRONOGRAMA' && <RenderCronogramaReport />}
                            {reportActiveTab === 'MATERIAIS' && <RenderMateriaisReport />}
                            {reportActiveTab === 'FINANCEIRO' && <RenderFinanceiroReport />}
                        </div>
                    </div>
                </div>
            );
        }
        if (subView === 'CALCULATORS') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Calculadoras</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Estimativas Rápidas</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-sm font-bold text-slate-500 mb-6">
                            <button onClick={() => setCalcType('PISO')} className={`flex-1 py-2 rounded-lg transition-colors ${calcType === 'PISO' ? 'bg-white text-primary shadow-sm dark:bg-slate-900 dark:text-white' : 'hover:text-primary dark:hover:text-white'}`}>Piso</button>
                            <button onClick={() => setCalcType('PAREDE')} className={`flex-1 py-2 rounded-lg transition-colors ${calcType === 'PAREDE' ? 'bg-white text-primary shadow-sm dark:bg-slate-900 dark:text-white' : 'hover:text-primary dark:hover:text-white'}`}>Parede</button>
                            <button onClick={() => setCalcType('PINTURA')} className={`flex-1 py-2 rounded-lg transition-colors ${calcType === 'PINTURA' ? 'bg-white text-primary shadow-sm dark:bg-slate-900 dark:text-white' : 'hover:text-primary dark:hover:text-white'}`}>Pintura</button>
                        </div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Área em m²</label>
                        <input type="number" value={calcArea} onChange={(e) => setCalcArea(e.target.value)} placeholder="Ex: 50" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50 transition-all mb-6" />
                        {calcResult.length > 0 && (
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
                                <h4 className="font-bold text-primary dark:text-white mb-2">Resultado Estimado:</h4>
                                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                                    {calcResult.map((res, idx) => <li key={idx}><i className="fa-solid fa-check-circle text-secondary mr-2"></i>{res}</li>)}
                                </ul>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                                    <i className="fa-solid fa-info-circle mr-1"></i> Valores aproximados, podem variar.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        if (subView === 'CONTRACTS') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Contratos</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Modelos Prontos</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {CONTRACT_TEMPLATES.map(template => (
                            <div key={template.id} onClick={() => setViewContract({ title: template.title, content: template.contentTemplate })} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20">
                                <h3 className="font-bold text-primary dark:text-white text-base leading-tight">{template.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{template.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        if (subView === 'CHECKLIST') {
            return (
                <div className="animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Checklists</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Verificação de Qualidade</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {STANDARD_CHECKLISTS.map((checklist) => (
                            <div key={checklist.category} onClick={() => setActiveChecklist(activeChecklist === checklist.category ? null : checklist.category)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md dark:hover:border-white/20">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-primary dark:text-white text-base leading-tight">{checklist.category}</h3>
                                    <i className={`fa-solid ${activeChecklist === checklist.category ? 'fa-chevron-up' : 'fa-chevron-down'} text-secondary text-sm`}></i>
                                </div>
                                {activeChecklist === checklist.category && (
                                    <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                        {checklist.items.map((item, idx) => (
                                            <li key={idx} className="flex items-start">
                                                <i className="fa-regular fa-square mr-3 mt-1 text-slate-400"></i> {item}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans">
            {/* Header with Work Name */}
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => subView === 'NONE' ? navigate('/') : setSubView('NONE')} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                <h1 className="text-2xl font-black text-primary dark:text-white mx-auto">{work.name}</h1>
                <div className="w-6"></div> {/* Spacer */}
            </div>

            {subView !== 'NONE' && (
                <div className="mb-6">
                    <button onClick={() => setSubView('NONE')} className="text-sm font-bold text-secondary hover:underline">
                        <i className="fa-solid fa-arrow-left mr-2"></i> Voltar para Ferramentas
                    </button>
                </div>
            )}

            {subView === 'NONE' ? (
                <>
                    {/* Main Tabs Navigation */}
                    <nav className="mb-6 bg-slate-100 dark:bg-slate-900 rounded-2xl p-1 flex shadow-sm border border-slate-200 dark:border-slate-800">
                        <button onClick={() => setActiveTab('SCHEDULE')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'SCHEDULE' ? 'bg-white text-primary dark:bg-slate-800 dark:text-white shadow-md' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                            <i className="fa-solid fa-calendar-days mr-2"></i> Cronograma
                        </button>
                        <button onClick={() => setActiveTab('MATERIALS')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'MATERIALS' ? 'bg-white text-primary dark:bg-slate-800 dark:text-white shadow-md' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                            <i className="fa-solid fa-boxes-stacked mr-2"></i> Materiais
                        </button>
                        <button onClick={() => setActiveTab('FINANCIAL')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'FINANCIAL' ? 'bg-white text-primary dark:bg-slate-800 dark:text-white shadow-md' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                            <i className="fa-solid fa-dollar-sign mr-2"></i> Financeiro
                        </button>
                        <button onClick={() => setActiveTab('MORE')} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === 'MORE' ? 'bg-white text-primary dark:bg-slate-800 dark:text-white shadow-md' : 'text-slate-500 hover:text-primary dark:hover:text-white'}`}>
                            <i className="fa-solid fa-ellipsis-h mr-2"></i> Mais
                        </button>
                    </nav>

                    {renderMainTab()}
                </>
            ) : (
                renderSubView()
            )}

            {/* Modals */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{stepModalMode === 'ADD' ? 'Adicionar Etapa' : 'Editar Etapa'}</h3>
                        <form onSubmit={handleSaveStep} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Etapa</label>
                                <input type="text" value={stepName} onChange={(e) => setStepName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Início</label>
                                    <input type="date" value={stepStart} onChange={(e) => setStepStart(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data de Fim</label>
                                    <input type="date" value={stepEnd} onChange={(e) => setStepEnd(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsStepModalOpen(false)} className="px-5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-light">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {addMatModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Adicionar Material</h3>
                        <form onSubmit={handleAddMaterial} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                                <input type="text" value={newMatName} onChange={(e) => setNewMatName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca (Opcional)</label>
                                <input type="text" value={newMatBrand} onChange={(e) => setNewMatBrand(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd. Planejada</label>
                                    <input type="number" value={newMatQty} onChange={(e) => setNewMatQty(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
                                    <input type="text" value={newMatUnit} onChange={(e) => setNewMatUnit(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Etapa (Opcional)</label>
                                <select value={newMatStepId} onChange={(e) => setNewMatStepId(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    <option value="">Nenhuma</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" checked={newMatBuyNow} onChange={(e) => setNewMatBuyNow(e.target.checked)} id="buyNow" className="w-4 h-4 text-secondary bg-slate-100 border-slate-300 rounded focus:ring-secondary" />
                                <label htmlFor="buyNow" className="text-sm font-medium text-slate-700 dark:text-slate-300">Registrar compra agora?</label>
                            </div>
                            {newMatBuyNow && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd. Comprada</label>
                                        <input type="number" value={newMatBuyQty} onChange={(e) => setNewMatBuyQty(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custo Total (R$)</label>
                                        <input type="number" step="0.01" value={newMatBuyCost} onChange={(e) => setNewMatBuyCost(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setAddMatModal(false)} className="px-5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-light">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {materialModal.isOpen && materialModal.material && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">Editar Material</h3>
                        <form onSubmit={handleUpdateMaterial} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                                <input type="text" value={matName} onChange={(e) => setMatName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marca (Opcional)</label>
                                <input type="text" value={matBrand} onChange={(e) => setMatBrand(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd. Planejada</label>
                                    <input type="number" value={matPlannedQty} onChange={(e) => setMatPlannedQty(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
                                    <input type="text" value={matUnit} onChange={(e) => setMatUnit(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                                </div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
                                <p className="font-bold mb-1">Qtd. já comprada: {materialModal.material.purchasedQty} {materialModal.material.unit}</p>
                                <p className="text-xs text-slate-500">Para registrar uma nova compra, preencha abaixo. O valor será somado ao total já comprado.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qtd. Comprada AGORA</label>
                                    <input type="number" value={matBuyQty} onChange={(e) => setMatBuyQty(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custo Total AGORA (R$)</label>
                                    <input type="number" step="0.01" value={matBuyCost} onChange={(e) => setMatBuyCost(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setMaterialModal({isOpen: false, material: null})} className="px-5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-light">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {expenseModal.isOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{expenseModal.mode === 'ADD' ? 'Adicionar Gasto' : 'Atualizar Gasto'}</h3>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                                <input type="text" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                                <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    {Object.values(ExpenseCategory).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Etapa (Opcional)</label>
                                <select value={expStepId} onChange={(e) => setExpStepId(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    <option value="">Nenhuma</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data</label>
                                <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            
                            {expenseModal.mode === 'EDIT' && (
                                <p className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">
                                    Valor já registrado: <span className="font-bold">R$ {expSavedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </p>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{expenseModal.mode === 'ADD' ? 'Valor (R$)' : 'Adicionar valor (R$)'}</label>
                                <input type="number" step="0.01" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required={expenseModal.mode === 'ADD'} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Total Acordado (Opcional - R$)</label>
                                <input type="number" step="0.01" value={expTotalAgreed} onChange={(e) => setExpTotalAgreed(e.target.value)} placeholder="Ex: 5000.00" className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" />
                            </div>
                            
                            <div className="flex justify-between gap-3">
                                {expenseModal.mode === 'EDIT' && (
                                    <button type="button" onClick={handleDeleteExpense} className="px-5 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><i className="fa-solid fa-trash mr-2"></i>Excluir</button>
                                )}
                                <div className="flex-1 flex justify-end gap-3">
                                    <button type="button" onClick={() => setExpenseModal({isOpen: false, mode: 'ADD'})} className="px-5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                    <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-light">Salvar</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPersonModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{personId ? `Editar ${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}` : `Adicionar ${personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}`}</h3>
                        <form onSubmit={handleSavePerson} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                                <input type="text" value={personName} onChange={(e) => setPersonName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{personMode === 'WORKER' ? 'Função' : 'Categoria'}</label>
                                <select value={personRole} onChange={(e) => setPersonRole(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white">
                                    {(personMode === 'WORKER' ? STANDARD_JOB_ROLES : STANDARD_SUPPLIER_CATEGORIES).map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                                <input type="text" value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" required />
                            </div>
                            {personMode === 'WORKER' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Diária (R$)</label>
                                    <input type="number" step="0.01" value={personNotes} onChange={(e) => setPersonNotes(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" placeholder="Ex: 150.00" />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações (Opcional)</label>
                                <textarea value={personNotes} onChange={(e) => setPersonNotes(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white" rows={3}></textarea>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsPersonModalOpen(false)} className="px-5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                                <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-light">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewContract && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-4">{viewContract.title}</h3>
                        <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {viewContract.content}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button type="button" onClick={() => setViewContract(null)} className="px-5 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Fechar</button>
                            <button onClick={() => navigator.clipboard.writeText(viewContract.content).then(() => alert('Contrato copiado!')).catch(err => console.error(err))} className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-light">Copiar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* General Purpose Modal (for delete confirmations etc.) */}
            <ZeModal
                isOpen={zeModal.isOpen}
                title={zeModal.title}
                message={zeModal.message}
                confirmText={zeModal.confirmText}
                cancelText={zeModal.cancelText}
                onConfirm={zeModal.onConfirm}
                onCancel={zeModal.onCancel}
                type={zeModal.type}
            />
        </div>
    );
};

export default WorkDetail;
