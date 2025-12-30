
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { StepStatus, FileCategory, ExpenseCategory, type Work, type Worker, type Supplier, type Material, type Step, type Expense, type WorkPhoto, type WorkFile } from '../types.ts';
import { ZeModal } from '../components/ZeModal.tsx';
import { STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'ETAPAS' | 'MATERIAIS' | 'FINANCEIRO' | 'FERRAMENTAS';
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';
type ReportSubTab = 'CRONOGRAMA' | 'MATERIAIS' | 'FINANCEIRO';

// --- DATE HELPERS ---
const parseDateNoTimezone = (dateStr: string) => {
    if (!dateStr) return '--/--';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    }
    return dateStr;
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

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, authLoading, isUserAuthFinished, isSubscriptionValid } = useAuth();
    
    const [work, setWork] = useState<Work | null>(null);
    const [loading, setLoading] = useState(true);
    const [steps, setSteps] = useState<Step[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const [files, setFiles] = useState<WorkFile[]>([]);
    const [, setStats] = useState<any>(null);

    const [activeTab, setActiveTab] = useState<MainTab>('ETAPAS');
    const [subView, setSubView] = useState<SubView>('NONE');
    const [uploading, setUploading] = useState(false);
    const [reportActiveTab, setReportActiveTab] = useState<ReportSubTab>('CRONOGRAMA');
    
    const [materialFilterStepId, setMaterialFilterStepId] = useState<string>('ALL');
    
    const [materialModal, setMaterialModal] = useState<{ isOpen: boolean, material: Material | null }>({ isOpen: false, material: null });
    const [matName, setMatName] = useState('');
    const [matBrand, setMatBrand] = useState('');
    const [matPlannedQty, setMatPlannedQty] = useState('');
    const [matUnit, setMatUnit] = useState('');
    const [matBuyQty, setMatBuyQty] = useState('');
    const [matBuyCost, setMatBuyCost] = useState(''); // Keep this for editing existing materials

    const [addMatModal, setAddMatModal] = useState(false);
    const [newMatName, setNewMatName] = useState('');
    const [newMatBrand, setNewMatBrand] = useState('');
    const [newMatQty, setNewMatQty] = useState('');
    const [newMatUnit, setNewMatUnit] = useState('un');
    const [newMatStepId, setNewMatStepId] = useState('');
    const [newMatBuyNow, setNewMatBuyNow] = useState(false);
    const [newMatBuyQty, setNewMatBuyQty] = useState('');
    const [newMatBuyCost, setNewMatBuyCost] = useState(''); // Corrected name for new material purchases

    const [isStepModalOpen, setIsStepModalOpen] = useState(false);
    const [stepModalMode, setStepModalMode] = useState<'ADD' | 'EDIT'>('ADD');
    const [stepName, setStepName] = useState('');
    const [stepStart, setStepStart] = useState(new Date().toISOString().split('T')[0]);
    const [stepEnd, setStepEnd] = useState(new Date().toISOString().split('T')[0]);
    const [currentStepId, setCurrentStepId] = useState<string | null>(null);

    const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean, mode: 'ADD'|'EDIT', id?: string }>({ isOpen: false, mode: 'ADD' });
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expTotalAgreed, setExpTotalAgreed] = useState('');
    const [expCategory, setExpCategory] = useState<ExpenseCategory>(ExpenseCategory.LABOR);
    const [expStepId, setExpStepId] = useState('');
    const [expSavedAmount, setExpSavedAmount] = useState(0);

    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personMode, setPersonMode] = useState<'WORKER'|'SUPPLIER'>('WORKER');
    const [personId, setPersonId] = useState<string | null>(null); 
    const [personName, setPersonName] = useState('');
    const [personRole, setPersonRole] = useState('');
    const [personPhone, setPersonPhone] = useState('');
    const [personNotes, setPersonNotes] = useState('');

    const [viewContract, setViewContract] = useState<{title: string, content: string} | null>(null);
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    const [zeModal, setZeModal] = useState<any>({ isOpen: false, title: '', message: '' });

    const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
    const [calcType, setCalcType] = useState<'PISO'|'PAREDE'|'PINTURA'>('PISO');
    const [calcArea, setCalcArea] = useState('');
    const [calcResult, setCalcResult] = useState<string[]>([]);

    const load = useCallback(async () => {
        if (!id || !isUserAuthFinished || authLoading) return;
        setLoading(true);
        try {
            const w = await dbService.getWorkById(id);
            setWork(w || null);
            if (w) {
                const [s, m, e, wk, sp, ph, fl, workStats] = await Promise.all([
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
        } catch (error) {
            console.error("Erro ao carregar detalhes da obra:", error);
        } finally {
            setLoading(false);
        }
    }, [id, authLoading, isUserAuthFinished]);

    useEffect(() => { load(); }, [load]);

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
                await dbService.updateStep({ ...existing, name: stepName, startDate: stepStart, endDate: stepEnd });
            }
        }
        setIsStepModalOpen(false);
        load();
    };

    const handleStepStatusClick = async (step: Step) => {
        let newStatus = step.status === StepStatus.NOT_STARTED ? StepStatus.IN_PROGRESS : 
                        step.status === StepStatus.IN_PROGRESS ? StepStatus.COMPLETED : StepStatus.NOT_STARTED;
        await dbService.updateStep({ ...step, status: newStatus });
        load();
    };

    const handleDeleteStep = async (stepId: string) => {
        if (!work) return; 
        setZeModal({
            isOpen: true,
            title: 'Excluir Etapa?',
            message: 'Tem certeza que deseja excluir esta etapa?',
            confirmText: 'Excluir',
            type: 'DANGER',
            onConfirm: async () => {
                try {
                    await dbService.deleteStep(stepId, work.id);
                    load();
                    setZeModal({ isOpen: false });
                } catch (error: any) {
                    console.error("Erro ao deletar etapa:", error);
                    setZeModal({
                        isOpen: true,
                        title: 'Erro ao Excluir Etapa',
                        message: error.message || 'Não foi possível excluir a etapa. Verifique se há lançamentos financeiros associados a ela ou aos seus materiais.',
                        confirmText: 'Entendido',
                        onCancel: () => setZeModal({ isOpen: false }),
                        type: 'ERROR'
                    });
                }
            },
            onCancel: () => setZeModal({ isOpen: false })
        });
    };

    const handleAddMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !newMatName) return;
        await dbService.addMaterial({
            workId: work.id,
            name: newMatName,
            brand: newMatBrand,
            plannedQty: Number(newMatQty),
            purchasedQty: 0,
            unit: newMatUnit,
            stepId: newMatStepId || undefined
        }, newMatBuyNow ? { qty: Number(newMatBuyQty), cost: Number(newMatBuyCost), date: new Date().toISOString() } : undefined);
        setAddMatModal(false);
        load();
    };

    const handleUpdateMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!materialModal.material) return;
        try {
            await dbService.updateMaterial({
                ...materialModal.material,
                name: matName,
                brand: matBrand,
                plannedQty: Number(matPlannedQty),
                unit: matUnit
            });
            if (matBuyQty && Number(matBuyQty) > 0) {
                await dbService.registerMaterialPurchase(materialModal.material.id, matName, matBrand, Number(matPlannedQty), matUnit, Number(matBuyQty), Number(matBuyCost));
            }
            setMaterialModal({ isOpen: false, material: null });
            load();
        } catch (error) {
            console.error(error);
        }
    };

    const openAddExpense = () => {
        setExpenseModal({ isOpen: true, mode: 'ADD' });
        setExpDesc(''); setExpAmount(''); setExpSavedAmount(0); setExpTotalAgreed(''); setExpCategory(ExpenseCategory.LABOR); setExpStepId('');
    };

    const openEditExpense = (expense: Expense) => {
        setExpenseModal({ isOpen: true, mode: 'EDIT', id: expense.id });
        setExpDesc(expense.description); 
        // No EDIT mode, expAmount should reflect the *next* payment, not the total paid so far
        setExpAmount(''); 
        setExpSavedAmount(expense.paidAmount || expense.amount); 
        setExpTotalAgreed(expense.totalAgreed ? String(expense.totalAgreed) : ''); 
        // Fix: Cast expense.category to ExpenseCategory to match the state type.
        setExpCategory(expense.category as ExpenseCategory); 
        setExpStepId(expense.stepId || '');
    };

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !expDesc) return;
        const inputAmount = Number(expAmount) || 0;
        if (expenseModal.mode === 'ADD') {
            await dbService.addExpense({
                workId: work.id,
                description: expDesc,
                amount: inputAmount,
                paidAmount: inputAmount,
                quantity: 1,
                date: new Date().toISOString(),
                category: expCategory,
                stepId: expStepId || undefined,
                totalAgreed: expTotalAgreed ? Number(expTotalAgreed) : undefined
            });
        } else if (expenseModal.mode === 'EDIT' && expenseModal.id) {
            const existing = expenses.find(ex => ex.id === expenseModal.id);
            if (existing) {
                // For editing, if totalAgreed exists, we assume `amount` is `paidAmount`
                const newPaidAmount = (existing.paidAmount || 0) + inputAmount;
                const newTotalAgreed = expTotalAgreed ? Number(expTotalAgreed) : existing.totalAgreed;

                await dbService.updateExpense({ 
                    ...existing, 
                    description: expDesc, 
                    amount: newPaidAmount, // Amount field now represents total paid
                    paidAmount: newPaidAmount, 
                    category: expCategory, 
                    stepId: expStepId || undefined, 
                    totalAgreed: newTotalAgreed 
                });
            }
        }
        setExpenseModal({ isOpen: false, mode: 'ADD' });
        load();
    };

    const handleDeleteExpense = async (expenseId: string) => {
        setZeModal({
            isOpen: true, title: 'Excluir Gasto?', message: 'Deseja excluir este registro?', confirmText: 'Excluir', type: 'DANGER',
            onConfirm: async () => { await dbService.deleteExpense(expenseId); load(); setZeModal({ isOpen: false }); },
            onCancel: () => setZeModal({ isOpen: false })
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'PHOTO' | 'FILE') => {
        if (e.target.files && e.target.files[0] && work) {
            setUploading(true);
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                if (type === 'PHOTO') {
                    await dbService.addPhoto({ workId: work.id, url: base64, description: 'Foto da obra', date: new Date().toISOString(), type: 'PROGRESS' });
                } else {
                    await dbService.addFile({ workId: work.id, name: file.name, category: FileCategory.GENERAL, url: base64, type: file.type, date: new Date().toISOString() });
                }
                setUploading(false);
                load();
            };
            reader.readAsDataURL(file);
        }
    };

    const openPersonModal = (mode: 'WORKER' | 'SUPPLIER', item?: any) => {
        setPersonMode(mode);
        if (item) {
            setPersonId(item.id); setPersonName(item.name); setPersonPhone(item.phone); setPersonNotes(item.notes || '');
            setPersonRole(mode === 'WORKER' ? item.role : item.category);
        } else {
            setPersonId(null); setPersonName(''); setPersonPhone(''); setPersonNotes('');
            setPersonRole(mode === 'WORKER' ? STANDARD_JOB_ROLES[0] : STANDARD_SUPPLIER_CATEGORIES[0]);
        }
        setIsPersonModalOpen(true);
    };

    const handleSavePerson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !work) return;
        const payload: any = { userId: user.id, workId: work.id, name: personName, phone: personPhone, notes: personNotes };
        if (personId) {
            if (personMode === 'WORKER') await dbService.updateWorker({ ...payload, id: personId, role: personRole });
            else await dbService.updateSupplier({ ...payload, id: personId, category: personRole });
        } else {
            if (personMode === 'WORKER') await dbService.addWorker({ ...payload, role: personRole });
            else await dbService.addSupplier({ ...payload, category: personRole });
        }
        setIsPersonModalOpen(false);
        load();
    };

    const handleDeletePerson = (pid: string, wid: string, mode: 'WORKER' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true, title: 'Remover?', message: 'Deseja remover esta pessoa?', confirmText: 'Remover', type: 'DANGER',
            onConfirm: async () => { 
                if (mode === 'WORKER') await dbService.deleteWorker(pid, wid); 
                else await dbService.deleteSupplier(pid, wid); 
                load(); setZeModal({ isOpen: false }); 
            },
            onCancel: () => setZeModal({ isOpen: false })
        });
    };

    useEffect(() => {
        if (!calcArea) { setCalcResult([]); return; }
        const area = Number(calcArea);
        if (calcType === 'PISO') setCalcResult([`${Math.ceil(area * 1.15)} m² de Piso`, `${Math.ceil(area * 4)} kg de Argamassa`]);
        else if (calcType === 'PAREDE') setCalcResult([`${Math.ceil(area * 30)} Tijolos`]);
        else if (calcType === 'PINTURA') setCalcResult([`${Math.ceil(area / 5)} L de Tinta`]);
    }, [calcArea, calcType]);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(steps), "Cronograma");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(materials), "Materiais");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), "Financeiro");
        XLSX.writeFile(wb, `Obra_${work?.name}.xlsx`);
    };

    const groupedExpenses = useMemo(() => {
        const groups: any = {};
        Object.values(ExpenseCategory).forEach(cat => groups[cat] = { steps: {}, expenses: [] });
        expenses.forEach(exp => {
            if (exp.category === ExpenseCategory.MATERIAL) {
                const sId = exp.stepId || 'no-step';
                if (!groups[exp.category].steps[sId]) groups[exp.category].steps[sId] = [];
                groups[exp.category].steps[sId].push(exp);
            } else groups[exp.category].expenses.push(exp);
        });
        return groups;
    }, [expenses]);

    if (authLoading || !isUserAuthFinished || loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return <div className="text-center py-10">Obra não encontrada.</div>;

    const RenderCronogramaReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold mb-4">Cronograma</h3>
            <div className="space-y-4">
                {steps.map(s => (
                    <div key={s.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border">
                        <p className="font-bold text-sm">{s.name}</p>
                        <p className="text-xs text-slate-500">{parseDateNoTimezone(s.startDate)} - {parseDateNoTimezone(s.endDate)}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const RenderMateriaisReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold mb-4">Materiais</h3>
            {steps.map(step => {
                const stepMats = materials.filter(m => m.stepId === step.id);
                if (stepMats.length === 0) return null;
                return (
                    <div key={step.id} className="mb-4">
                        <h4 className="text-xs font-bold uppercase text-secondary mb-2">{step.name}</h4>
                        {stepMats.map(m => <p key={m.id} className="text-sm">• {m.name}: {m.purchasedQty}/{m.plannedQty} {m.unit}</p>)}
                    </div>
                );
            })}
        </div>
    );

    const RenderFinanceiroReport = () => (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-6 shadow-sm">
            <h3 className="font-bold mb-4">Financeiro</h3>
            {expenses.map(e => (
                <div key={e.id} className="flex justify-between text-sm py-2 border-b">
                    <span>{e.description}</span>
                    <span className="font-bold">{formatCurrency(e.amount)}</span>
                </div>
            ))}
        </div>
    );

    const todayString = new Date().toISOString().split('T')[0];

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 md:px-0 pb-24">
            <div className="flex items-center justify-between mb-8">
                <button onClick={() => subView === 'NONE' ? navigate('/') : setSubView('NONE')} className="text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                <h1 className="text-2xl font-black text-primary dark:text-white">{work.name}</h1>
                <div className="w-10"></div>
            </div>

            {subView === 'NONE' ? (
                <>
                    <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t z-50 flex justify-around p-2 md:static md:bg-slate-100 md:rounded-2xl md:mb-6">
                        {(['ETAPAS', 'MATERIAIS', 'FINANCEIRO', 'FERRAMENTAS'] as MainTab[]).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center flex-1 py-2 text-[10px] font-bold md:text-sm md:rounded-xl ${activeTab === tab ? 'text-secondary md:bg-white md:shadow-sm' : 'text-slate-400'}`}>
                                <i className={`fa-solid ${tab === 'ETAPAS' ? 'fa-calendar' : tab === 'MATERIAIS' ? 'fa-box' : tab === 'FINANCEIRO' ? 'fa-dollar-sign' : 'fa-ellipsis'} text-lg mb-1`}></i>
                                {tab}
                            </button>
                        ))}
                    </nav>

                    {activeTab === 'ETAPAS' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="flex justify-between items-center px-2">
                                <h2 className="text-xl font-bold">Cronograma</h2>
                                <button onClick={() => { setStepModalMode('ADD'); setIsStepModalOpen(true); }} className="bg-primary text-white p-2 rounded-lg"><i className="fa-solid fa-plus"></i></button>
                            </div>
                            {steps.map((s, index) => {
                                const isDelayed = s.status !== StepStatus.COMPLETED && s.endDate < todayString;
                                return (
                                    <div key={s.id} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border flex items-center gap-4 ${isDelayed ? 'border-red-500 ring-1 ring-red-200' : ''}`}>
                                        <button 
                                            onClick={() => handleStepStatusClick(s)} 
                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-white 
                                                ${s.status === StepStatus.COMPLETED ? 'bg-green-500 border-green-500' : 
                                                  s.status === StepStatus.IN_PROGRESS ? 'bg-orange-500 border-orange-500' : 
                                                  'bg-slate-300 border-slate-300'}`}
                                        >
                                            <i className="fa-solid fa-check"></i>
                                        </button>
                                        <div className="flex-1" onClick={() => { setStepModalMode('EDIT'); setCurrentStepId(s.id); setStepName(s.name); setStepStart(s.startDate); setStepEnd(s.endDate); setIsStepModalOpen(true); }}>
                                            <p className="font-bold text-primary dark:text-white">{index + 1}. {s.name} {isDelayed && <span className="ml-2 text-xs font-semibold text-red-500">Atrasada!</span>}</p> {/* Adiciona numeração e status de atraso aqui */}
                                            <p className="text-xs text-slate-500">{parseDateNoTimezone(s.startDate)} - {parseDateNoTimezone(s.endDate)}</p>
                                        </div>
                                        <button onClick={() => handleDeleteStep(s.id)} className="text-red-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash"></i></button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'MATERIAIS' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="flex justify-between items-center px-2">
                                <h2 className="text-xl font-bold">Materiais</h2>
                                <button onClick={() => setAddMatModal(true)} className="bg-primary text-white p-2 rounded-lg"><i className="fa-solid fa-plus"></i></button>
                            </div>
                            {steps.map(step => {
                                const stepMats = materials.filter(m => m.stepId === step.id);
                                if (stepMats.length === 0) return null;
                                return (
                                    <div key={step.id} className="p-2">
                                        <h3 className="text-xs font-black uppercase text-slate-400 mb-3 border-b pb-1">{step.name}</h3>
                                        {stepMats.map(m => (
                                            <div key={m.id} onClick={() => { setMaterialModal({isOpen: true, material: m}); setMatName(m.name); setMatBrand(m.brand||''); setMatPlannedQty(String(m.plannedQty)); setMatUnit(m.unit); }} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border mb-3">
                                                <div className="flex justify-between mb-2"><p className="font-bold">{m.name}</p><span className="text-xs font-bold text-secondary">{m.purchasedQty}/{m.plannedQty} {m.unit}</span></div>
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-secondary" style={{ width: `${(m.purchasedQty/m.plannedQty)*100}%` }}></div></div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'FINANCEIRO' && (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="bg-primary text-white p-6 rounded-3xl shadow-lg">
                                <p className="text-xs opacity-70 uppercase font-bold mb-1">Gasto Total</p>
                                <h3 className="text-3xl font-black">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</h3>
                            </div>
                            <div className="flex justify-between items-center px-2 pt-4">
                                <h2 className="text-xl font-bold">Lançamentos</h2>
                                <button onClick={openAddExpense} className="bg-primary text-white p-2 rounded-lg"><i className="fa-solid fa-plus"></i></button>
                            </div>
                            {expenses.map(e => {
                                const isEmpreita = e.totalAgreed && e.totalAgreed > 0;
                                let statusText = '';
                                let progress = 0;
                                let progressBarColor = '';

                                if (isEmpreita) {
                                    progress = (e.amount / e.totalAgreed!) * 100;
                                    if (progress >= 100) {
                                        statusText = 'Concluído';
                                        progressBarColor = 'bg-green-500';
                                    } else if (e.amount > 0) {
                                        statusText = 'Parcial';
                                        progressBarColor = 'bg-orange-500';
                                    } else {
                                        statusText = 'Pendente';
                                        progressBarColor = 'bg-slate-300';
                                    }
                                }

                                return (
                                    <div key={e.id} onClick={() => openEditExpense(e)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border">
                                        <div className="flex justify-between items-center mb-2">
                                            <div>
                                                <p className="font-bold">{e.description}</p>
                                                <p className="text-xs text-slate-400">{parseDateNoTimezone(e.date)} • {String(e.category)}</p>
                                            </div>
                                            <p className="font-black text-primary dark:text-white">{formatCurrency(e.amount)}</p>
                                        </div>
                                        {isEmpreita && (
                                            <>
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                                                    <div className="h-full" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: progressBarColor }}></div>
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-500">
                                                    <span>{statusText}</span>
                                                    <span>{formatCurrency(e.amount)} / {formatCurrency(e.totalAgreed)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'FERRAMENTAS' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                            <button onClick={() => setSubView('TEAM')} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center"><i className="fa-solid fa-users text-2xl mb-2 text-secondary"></i>Equipe</button>
                            <button onClick={() => setSubView('PHOTOS')} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center"><i className="fa-solid fa-camera text-2xl mb-2 text-secondary"></i>Fotos</button>
                            <button onClick={() => setSubView('REPORTS')} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center"><i className="fa-solid fa-file-pdf text-2xl mb-2 text-secondary"></i>Relatórios</button>
                            <button onClick={() => setSubView('PROJECTS')} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center"><i className="fa-solid fa-folder text-2xl mb-2 text-secondary"></i>Arquivos</button>
                            {!isSubscriptionValid && (
                                <button onClick={() => navigate('/settings')} className="col-span-2 p-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-3xl font-bold flex items-center justify-center gap-3"><i className="fa-solid fa-crown"></i> Liberar Acesso Vitalício</button>
                            )}
                            <button onClick={() => setIsCalculatorModalOpen(true)} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center"><i className="fa-solid fa-calculator text-2xl mb-2 text-secondary"></i>Calculadoras</button>
                            <button onClick={() => setSubView('CONTRACTS')} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center"><i className="fa-solid fa-file-contract text-2xl mb-2 text-secondary"></i>Contratos</button>
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-in slide-in-from-right-4">
                    <button onClick={() => setSubView('NONE')} className="mb-6 text-secondary font-bold flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
                    {subView === 'TEAM' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Equipe</h2><button onClick={() => openPersonModal('WORKER')} className="bg-primary text-white p-2 rounded-lg"><i className="fa-solid fa-plus"></i></button></div>
                            {workers.map(w => (
                                <div key={w.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border flex justify-between items-center">
                                    <div><p className="font-bold">{w.name}</p><p className="text-xs text-slate-500">{w.role}</p></div>
                                    <button onClick={() => handleDeletePerson(w.id, w.workId, 'WORKER')} className="text-red-300 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash"></i></button>
                                </div>
                            ))}
                        </div>
                    )}
                    {subView === 'REPORTS' && (
                        <div className="space-y-6">
                            <RenderCronogramaReport />
                            <RenderMateriaisReport />
                            <RenderFinanceiroReport />
                            <button onClick={handleExportExcel} className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold"><i className="fa-solid fa-file-excel mr-2"></i> Exportar Excel</button>
                        </div>
                    )}
                    {subView === 'PHOTOS' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative aspect-square bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed">
                                <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'PHOTO')} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <i className="fa-solid fa-plus text-slate-400 text-2xl"></i>
                            </div>
                            {photos.map(p => <img key={p.id} src={p.url} className="aspect-square object-cover rounded-2xl border" />)}
                        </div>
                    )}
                </div>
            )}

            {/* Modals Simplificados para Funcionalidade */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md">
                        <h3 className="font-bold mb-4">Etapa</h3>
                        <form onSubmit={handleSaveStep} className="space-y-4">
                            <input value={stepName} onChange={e => setStepName(e.target.value)} placeholder="Nome" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={stepStart} onChange={e => setStepStart(e.target.value)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                                <input type="date" value={stepEnd} onChange={e => setStepEnd(e.target.value)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                            </div>
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                            <button type="button" onClick={() => setIsStepModalOpen(false)} className="w-full text-slate-400">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Modal de Adicionar Material (EXISTENTE) */}
            {addMatModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md">
                        <h3 className="font-bold mb-4">Adicionar Material</h3>
                        <form onSubmit={handleAddMaterial} className="space-y-4">
                            <input value={newMatName} onChange={e => setNewMatName(e.target.value)} placeholder="Nome do Material" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                            <input value={newMatBrand} onChange={e => setNewMatBrand(e.target.value)} placeholder="Marca (opcional)" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" value={newMatQty} onChange={e => setNewMatQty(e.target.value)} placeholder="Qtd. Planejada" className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                                <input value={newMatUnit} onChange={e => setNewMatUnit(e.target.value)} placeholder="Unidade (ex: m², un, kg)" className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                            </div>
                            <select value={newMatStepId} onChange={e => setNewMatStepId(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <option value="">Sem Etapa Específica</option>
                                {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={newMatBuyNow} onChange={e => setNewMatBuyNow(e.target.checked)} />
                                Lançar compra agora?
                            </label>
                            {newMatBuyNow && (
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" value={newMatBuyQty} onChange={e => setNewMatBuyQty(e.target.value)} placeholder="Qtd. Comprada" className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                                    <input type="number" value={newMatBuyCost} onChange={e => setNewMatBuyCost(e.target.value)} placeholder="Custo Total" className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                                </div>
                            )}
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold">Adicionar Material</button>
                            <button type="button" onClick={() => setAddMatModal(false)} className="w-full text-slate-400">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Edição de Material (EXISTENTE) */}
            {materialModal.isOpen && materialModal.material && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md">
                        <h3 className="font-bold mb-4">Editar Material</h3>
                        <form onSubmit={handleUpdateMaterial} className="space-y-4">
                            <input value={matName} onChange={e => setMatName(e.target.value)} placeholder="Nome do Material" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                            <input value={matBrand} onChange={e => setMatBrand(e.target.value)} placeholder="Marca (opcional)" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" value={matPlannedQty} onChange={e => setMatPlannedQty(e.target.value)} placeholder="Qtd. Planejada" className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                                <input value={matUnit} onChange={e => setMatUnit(e.target.value)} placeholder="Unidade (ex: m², un, kg)" className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                            </div>
                            {/* Campo de Compra Agora para materiais já existentes */}
                            <h4 className="font-bold mt-4">Registrar Nova Compra</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" value={matBuyQty} onChange={e => setMatBuyQty(e.target.value)} placeholder="Qtd. Comprada Agora" className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                                <input type="number" value={matBuyCost} onChange={e => setMatBuyCost(e.target.value)} placeholder="Custo Total da Compra" className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                            </div>
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold">Salvar e Registrar Compra</button>
                            <button type="button" onClick={() => setMaterialModal({isOpen: false, material: null})} className="w-full text-slate-400">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Adicionar/Editar Despesa (EXISTENTE) */}
            {expenseModal.isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md">
                        <h3 className="font-bold mb-4">{expenseModal.mode === 'ADD' ? 'Adicionar Novo Gasto' : 'Registrar Pagamento/Editar Gasto'}</h3>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            <input value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Descrição do Gasto (ex: Pedreiro, Cimento)" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                            <select value={expCategory} onChange={e => setExpCategory(e.target.value as ExpenseCategory)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                {Object.values(ExpenseCategory).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <select value={expStepId} onChange={e => setExpStepId(e.target.value)} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                <option value="">Associar à Etapa (Opcional)</option>
                                {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            {expCategory === ExpenseCategory.LABOR && expenseModal.mode === 'ADD' && ( // Only show totalAgreed for ADD mode and LABOR category
                                <input type="number" value={expTotalAgreed} onChange={e => setExpTotalAgreed(e.target.value)} placeholder="Preço Combinado (Total da Empreita)" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" />
                            )}
                            {expenseModal.mode === 'EDIT' && <p className="text-sm text-slate-500">Valor já pago: {formatCurrency(expSavedAmount)}</p>}
                            <input type="number" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder={expenseModal.mode === 'ADD' ? 'Valor Total do Gasto' : 'Valor Pago Agora'} className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl" required />
                            
                            <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-bold">Salvar Gasto</button>
                            <button type="button" onClick={() => setExpenseModal({isOpen: false, mode: 'ADD'})} className="w-full text-slate-400">Cancelar</button>
                        </form>
                    </div>
                </div>
            )}


            <ZeModal isOpen={zeModal.isOpen} title={zeModal.title} message={zeModal.message} confirmText={zeModal.confirmText} onConfirm={zeModal.onConfirm} onCancel={() => setZeModal({isOpen: false})} type={zeModal.type} />
            
            {isCalculatorModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl w-full max-w-md">
                        <h3 className="font-bold mb-4">Calculadora</h3>
                        <select value={calcType} onChange={e => setCalcType(e.target.value as any)} className="w-full p-3 mb-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
                            <option value="PISO">Piso/Revestimento</option>
                            <option value="PAREDE">Tijolos/Blocos</option>
                            <option value="PINTURA">Tinta</option>
                        </select>
                        <input type="number" value={calcArea} onChange={e => setCalcArea(e.target.value)} placeholder="Área em m²" className="w-full p-3 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4" />
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-4">
                            {calcResult.map((r, i) => <p key={i} className="text-sm font-bold">• {r}</p>)}
                        </div>
                        <button onClick={() => setIsCalculatorModalOpen(false)} className="w-full py-3 bg-primary text-white rounded-xl">Fechar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkDetail;
