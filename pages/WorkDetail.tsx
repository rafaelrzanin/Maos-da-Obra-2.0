
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
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO'; // Keep for reports view

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
    const [subView, setSubView] = useState<SubView>('NONE'); // Reverted to using subView
    const [uploading, setUploading] = useState(false);
    const [reportActiveTab, setReportActiveTab] = useState<ReportSubTab>('CRONOGRAMA'); // Keep for reports view
    
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

    // CONTRACTS/CHECKLISTS MODAL STATE
    const [viewContract, setViewContract] = useState<{title: string, content: string} | null>(null);
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    // GENERAL MODAL
    const [zeModal, setZeModal] = useState<ZeModalProps & { id?: string }>({ 
        isOpen: false, 
        title: '', 
        message: '',
        onCancel: () => {}, 
    });

    // CALCULATOR STATES (now in a modal)
    const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
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

        // Cronograma Sheet
        const wsCrono = XLSX.utils.json_to_sheet(steps.map(s => ({
            'Nome da Etapa': s.name,
            'Início Planejado': parseDateNoTimezone(s.startDate),
            'Fim Planejado': parseDateNoTimezone(s.endDate),
            'Status Atual': s.status
        })));
        XLSX.utils.book_append_sheet(wb, wsCrono, "Cronograma");

        // Materiais Sheet
        const wsMat = XLSX.utils.json_to_sheet(materials.map(m => ({
            'Nome do Material': m.name,
            'Marca': m.brand || 'N/A',
            'Qtd. Planejada': m.plannedQty,
            'Unidade': m.unit,
            'Qtd. Comprada': m.purchasedQty,
            'Status Compra': m.purchasedQty >= m.plannedQty ? 'Completa' : 'Pendente'
        })));
        XLSX.utils.book_append_sheet(wb, wsMat, "Materiais");

        // Financeiro Sheet
        const wsFin = XLSX.utils.json_to_sheet(expenses.map(e => {
            const stepName = steps.find(s => s.id === e.stepId)?.name || 'N/A';
            const workerOrSupplierName = (workers.find(w => w.id === e.workerId)?.name || suppliers.find(s => s.id === e.supplierId)?.name || 'N/A');
            const totalAgreedValue = e.totalAgreed || e.amount;
            const saldoAPagar = totalAgreedValue - e.amount;

            return {
                'Descrição': e.description,
                'Valor Lançado': Number(e.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                'Total Acordado': Number(totalAgreedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                'Diferença (Saldo)': Number(saldoAPagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                'Categoria': e.category,
                'Data': parseDateNoTimezone(e.date),
                'Etapa Associada': stepName,
                'Profissional/Fornecedor': workerOrSupplierName
            };
        }));
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
    // These are kept as separate render functions for the REPORTS subView
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
                                    const expenseSupplier = exp.supplierId ? suppliers.find(s => s.id === exp.supplierId) : null; // NEW

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
                                                    {expenseSupplier && <span className="text-sm font-medium text-slate-400">(Fornecedor: {expenseSupplier.name})</span>}
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

    // --- RENDER MAIN TAB CONTENT ---
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
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestão de Compras</p>
                            </div>
                            <div className="flex gap-2 items-center">
                                <select value={materialFilterStepId} onChange={e => setMaterialFilterStepId(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm px-3 py-2 text-primary dark:text-white focus:ring-secondary focus:border-secondary transition-all">
                                    <option value="ALL">Todas as Etapas</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <button onClick={() => setAddMatModal(true)} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                            </div>
                        </div>
                    </div>
                    
                    {filteredSteps.map((step) => {
                        const stepMaterials = materials.filter(m => m.stepId === step.id);
                        if (stepMaterials.length === 0) return null; // Only render step section if it has materials

                        return (
                            <div key={step.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                    <h3 className="font-bold text-primary dark:text-white text-base uppercase tracking-wide">Etapa: {step.name}</h3>
                                </div>
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {stepMaterials.map(material => {
                                        const isFullyPurchased = material.purchasedQty >= material.plannedQty;
                                        const remainingQty = material.plannedQty - material.purchasedQty;
                                        const statusColor = isFullyPurchased ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
                                        const statusIcon = isFullyPurchased ? 'fa-check-circle' : 'fa-triangle-exclamation';

                                        return (
                                            <li key={material.id} onClick={() => { setMaterialModal({isOpen: true, material}); setMatName(material.name); setMatBrand(material.brand || ''); setMatPlannedQty(String(material.plannedQty)); setMatUnit(material.unit); }} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                                <div className="flex items-center gap-3 mb-2 md:mb-0">
                                                    <div className={`w-9 h-9 rounded-full ${isFullyPurchased ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'} flex items-center justify-center shrink-0`}>
                                                        <i className={`fa-solid ${statusIcon} ${statusColor}`}></i>
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-primary dark:text-white leading-tight">{material.name}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{material.brand || 'Marca não informada'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-primary dark:text-white">{material.purchasedQty} / {material.plannedQty} {material.unit}</p>
                                                    <p className={`text-xs ${statusColor}`}>{isFullyPurchased ? 'Compra Concluída' : `${remainingQty} ${material.unit} pendentes`}</p>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                    {materials.filter(m => !m.stepId).length > 0 && (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                                <h3 className="font-bold text-primary dark:text-white text-base uppercase tracking-wide">Materiais Gerais / Sem Etapa</h3>
                            </div>
                            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                {materials.filter(m => !m.stepId).map(material => {
                                    const isFullyPurchased = material.purchasedQty >= material.plannedQty;
                                    const remainingQty = material.plannedQty - material.purchasedQty;
                                    const statusColor = isFullyPurchased ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';
                                    const statusIcon = isFullyPurchased ? 'fa-check-circle' : 'fa-triangle-exclamation';

                                    return (
                                        <li key={material.id} onClick={() => { setMaterialModal({isOpen: true, material}); setMatName(material.name); setMatBrand(material.brand || ''); setMatPlannedQty(String(material.plannedQty)); setMatUnit(material.unit); }} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                            <div className="flex items-center gap-3 mb-2 md:mb-0">
                                                <div className={`w-9 h-9 rounded-full ${isFullyPurchased ? 'bg-green-100 dark:bg-green-900/30' : 'bg-amber-100 dark:bg-amber-900/30'} flex items-center justify-center shrink-0`}>
                                                    <i className={`fa-solid ${statusIcon} ${statusColor}`}></i>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-primary dark:text-white leading-tight">{material.name}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{material.brand || 'Marca não informada'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-primary dark:text-white">{material.purchasedQty} / {material.plannedQty} {material.unit}</p>
                                                <p className={`text-xs ${statusColor}`}>{isFullyPurchased ? 'Compra Concluída' : `${remainingQty} ${material.unit} pendentes`}</p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }

        if (activeTab === 'FINANCIAL') {
            const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

            return (
                <div className="space-y-6 animate-in fade-in">
                     <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950 pb-2">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestão de Gastos</p>
                            </div>
                            <button onClick={openAddExpense} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                        </div>
                     </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wide">Orçamento Planejado</p>
                        <p className="text-3xl font-black text-primary dark:text-white">R$ {work.budgetPlanned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <div className="flex justify-between items-center mt-4">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Gasto</p>
                                <p className="text-xl font-bold text-red-600 dark:text-red-400">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Restante</p>
                                <p className={`text-xl font-bold ${work.budgetPlanned - totalExpenses < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    R$ {(work.budgetPlanned - totalExpenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {expenses.map(expense => {
                                const stepName = steps.find(s => s.id === expense.stepId)?.name || 'Geral';
                                const workerOrSupplierName = (workers.find(w => w.id === expense.workerId)?.name || suppliers.find(s => s.id === expense.supplierId)?.name || 'Não associado');

                                return (
                                    <li key={expense.id} onClick={() => openEditExpense(expense)} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                        <div className="flex items-center gap-3 mb-2 md:mb-0">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                                <i className="fa-solid fa-dollar-sign text-slate-500"></i>
                                            </div>
                                            <div>
                                                <p className="font-bold text-primary dark:text-white leading-tight">{expense.description}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {expense.category} • {parseDateNoTimezone(expense.date)} • Etapa: {stepName}
                                                </p>
                                                {workerOrSupplierName !== 'Não associado' && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        Associado a: {workerOrSupplierName}
                                                    </p>
                                                )}
                                            </div>