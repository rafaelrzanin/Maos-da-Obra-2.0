import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext.tsx'; 
import { dbService } from '../services/db.ts';
import { Work, Worker, Supplier, Material, Step, Expense, StepStatus, WorkPhoto, WorkFile, FileCategory, ExpenseCategory, PlanType } from '../types.ts';
import { ZeModal } from '../components/ZeModal.tsx';
import { STANDARD_CHECKLISTS, CONTRACT_TEMPLATES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'SCHEDULE' | 'MATERIALS' | 'FINANCIAL' | 'MORE';
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';

// --- DATE HELPERS2 ---
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
    const { user, trialDaysRemaining } = useAuth(); 
    
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
    const [stats, setStats] = useState<{ totalSpent: number, progress: number, delayedSteps: number } | null>(null);

    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<MainTab>('SCHEDULE');
    const [subView, setSubView] = useState<SubView>('NONE');
    const [uploading, setUploading] = useState(false);
    
    // --- ACCESS LOGIC ---
    const isVitalicio = user?.plan === PlanType.VITALICIO;
    const isAiTrialActive = user?.isTrial && trialDaysRemaining !== null && trialDaysRemaining > 0;
    const hasAiAccess = isVitalicio || isAiTrialActive;
    const isPremium = isVitalicio;

    // --- MODALS STATE ---
    const [stepModalMode, setStepModalMode] = useState<'ADD' | 'EDIT'>('ADD');
    const [isStepModalOpen, setIsStepModalOpen] = useState(false);
    const [currentStepId, setCurrentStepId] = useState<string | null>(null);
    const [stepName, setStepName] = useState('');
    const [stepStart, setStepStart] = useState('');
    const [stepEnd, setStepEnd] = useState('');
    
    const [materialFilterStepId, setMaterialFilterStepId] = useState<string>('ALL');
    const [reportTab, setReportTab] = useState<'CRONO'|'MAT'|'FIN'>('CRONO');
    const [reportMaterialFilterStepId, setReportMaterialFilterStepId] = useState<string>('ALL');

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

    const [expenseModal, setExpenseModal] = useState<{ isOpen: boolean, mode: 'ADD'|'EDIT', id?: string }>({ isOpen: false, mode: 'ADD' });
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expTotalAgreed, setExpTotalAgreed] = useState('');
    const [expCategory, setExpCategory] = useState<string>(ExpenseCategory.LABOR);
    const [expStepId, setExpStepId] = useState('');
    const [expDate, setExpDate] = useState('');
    const [expSavedAmount, setExpSavedAmount] = useState(0);

    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personMode, setPersonMode] = useState<'WORKER'|'SUPPLIER'>('WORKER');
    const [personId, setPersonId] = useState<string | null>(null); 
    const [personName, setPersonName] = useState('');
    const [personRole, setPersonRole] = useState('');
    const [personPhone, setPersonPhone] = useState('');
    const [personNotes, setPersonNotes] = useState('');

    const [viewContract, setViewContract] = useState<{title: string, content: string} | null>(null);
    const [zeModal, setZeModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const [calcType, setCalcType] = useState<'PISO'|'PAREDE'|'PINTURA'>('PISO');
    const [calcArea, setCalcArea] = useState('');
    const [calcResult, setCalcResult] = useState<string[]>([]);
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    // --- LOAD DATA ---
    const load = async () => {
        if (!id) return;
        const w = await dbService.getWorkById(id);
        setWork(w || null);
        if (w) {
            const [s, m, e, wk, sp, ph, fl, workStats] = await Promise.all([
                dbService.getSteps(w.id),
                dbService.getMaterials(w.id),
                dbService.getExpenses(w.id),
                dbService.getWorkers(w.userId),
                dbService.getSuppliers(w.userId),
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

    useEffect(() => { load(); }, [id]);

    // --- HANDLERS (Simplified for review) ---
    const handleSaveStep = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !stepName) return;
        if (stepModalMode === 'ADD') {
            await dbService.addStep({ workId: work.id, name: stepName, startDate: stepStart, endDate: stepEnd, status: StepStatus.NOT_STARTED, isDelayed: false });
        } else if (stepModalMode === 'EDIT' && currentStepId) {
            const existing = steps.find(s => s.id === currentStepId);
            if (existing) await dbService.updateStep({ ...existing, name: stepName, startDate: stepStart, endDate: stepEnd });
        }
        setIsStepModalOpen(false);
        setStepName('');
        await load();
    };

    const handleStepStatusClick = async (step: Step) => {
        let newStatus = StepStatus.NOT_STARTED;
        if (step.status === StepStatus.NOT_STARTED) newStatus = StepStatus.IN_PROGRESS;
        else if (step.status === StepStatus.IN_PROGRESS) newStatus = StepStatus.COMPLETED;
        await dbService.updateStep({ ...step, status: newStatus });
        await load();
    };

    const handleAddMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !newMatName) return;
        const mat: Omit<Material, 'id'> = {
            workId: work.id, name: newMatName, brand: newMatBrand, plannedQty: Number(newMatQty), purchasedQty: 0, unit: newMatUnit, stepId: newMatStepId || undefined
        };
        await dbService.addMaterial(mat, newMatBuyNow ? { qty: Number(newMatBuyQty), cost: Number(newMatBuyCost), date: new Date().toISOString() } : undefined);
        setAddMatModal(false);
        setNewMatName(''); await load();
    };

    const handleUpdateMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!materialModal.material) return;
        const hasPurchase = matBuyQty && Number(matBuyQty) > 0;
        await dbService.updateMaterial({ ...materialModal.material, name: matName, brand: matBrand, plannedQty: Number(matPlannedQty), unit: matUnit });
        if (hasPurchase) {
            await dbService.registerMaterialPurchase(materialModal.material.id, matName, matBrand, Number(matPlannedQty), matUnit, Number(matBuyQty), Number(matBuyCost));
        }
        setMaterialModal({ isOpen: false, material: null });
        await load();
    };

    const openAddExpense = () => {
        setExpenseModal({ isOpen: true, mode: 'ADD' });
        setExpDesc(''); setExpAmount(''); setExpSavedAmount(0); setExpTotalAgreed(''); setExpCategory(ExpenseCategory.LABOR); setExpStepId(''); setExpDate(new Date().toISOString().split('T')[0]);
    };

    const openEditExpense = (expense: Expense) => {
        setExpenseModal({ isOpen: true, mode: 'EDIT', id: expense.id });
        setExpDesc(expense.description); setExpAmount(''); setExpSavedAmount(expense.amount); setExpTotalAgreed(expense.totalAgreed ? String(expense.totalAgreed) : ''); setExpCategory(expense.category); setExpStepId(expense.stepId || ''); setExpDate(expense.date.split('T')[0]);
    };

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !expDesc) return;
        const inputAmount = Number(expAmount) || 0;
        if (expenseModal.mode === 'ADD') {
            await dbService.addExpense({ workId: work.id, description: expDesc, amount: inputAmount, date: new Date(expDate).toISOString(), category: expCategory, stepId: expStepId || undefined, totalAgreed: expTotalAgreed ? Number(expTotalAgreed) : undefined });
        } else if (expenseModal.mode === 'EDIT' && expenseModal.id) {
            const existing = expenses.find(e => e.id === expenseModal.id);
            if (existing) await dbService.updateExpense({ ...existing, description: expDesc, amount: expSavedAmount + inputAmount, date: new Date(expDate).toISOString(), category: expCategory, stepId: expStepId || undefined, totalAgreed: expTotalAgreed ? Number(expTotalAgreed) : undefined });
        }
        setExpenseModal({ isOpen: false, mode: 'ADD' });
        await load();
    };

    const handleDeleteExpense = async () => {
        if (expenseModal.id && window.confirm("Excluir este gasto?")) {
            await dbService.deleteExpense(expenseModal.id);
            setExpenseModal({ isOpen: false, mode: 'ADD' });
            await load();
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'PHOTO' | 'FILE') => {
        if (e.target.files && e.target.files[0] && work) {
            setUploading(true);
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                if (type === 'PHOTO') await dbService.addPhoto({ workId: work.id, url: base64, description: 'Foto da obra', date: new Date().toISOString(), type: 'PROGRESS' });
                else await dbService.addFile({ workId: work.id, name: file.name, category: FileCategory.GENERAL, url: base64, type: file.type, date: new Date().toISOString() });
                setUploading(false);
                await load();
            };
            reader.readAsDataURL(file);
        }
    };

    const openPersonModal = (mode: 'WORKER' | 'SUPPLIER', item?: Worker | Supplier) => {
        setPersonMode(mode);
        if (item) {
            setPersonId(item.id); setPersonName(item.name); setPersonPhone(item.phone); setPersonNotes(item.notes || '');
            setPersonRole(mode === 'WORKER' ? (item as Worker).role : (item as Supplier).category);
        } else {
            setPersonId(null); setPersonName(''); setPersonPhone(''); setPersonNotes('');
            setPersonRole(mode === 'WORKER' ? STANDARD_JOB_ROLES[0] : STANDARD_SUPPLIER_CATEGORIES[0]);
        }
        setIsPersonModalOpen(true);
    };

    const handleSavePerson = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work) return;
        const payload = { userId: work.userId, name: personName, phone: personPhone, notes: personNotes };
        if (personMode === 'WORKER') {
            personId ? await dbService.updateWorker({ ...payload, id: personId, role: personRole }) : await dbService.addWorker({ ...payload, role: personRole });
        } else {
            personId ? await dbService.updateSupplier({ ...payload, id: personId, category: personRole }) : await dbService.addSupplier({ ...payload, category: personRole });
        }
        await load(); setIsPersonModalOpen(false);
    };

    const handleDeletePerson = (id: string, mode: 'WORKER' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true, title: 'Confirmar Exclusão', message: 'Deseja excluir este registro?',
            onConfirm: async () => {
                mode === 'WORKER' ? await dbService.deleteWorker(id) : await dbService.deleteSupplier(id);
                await load(); setZeModal(p => ({ ...p, isOpen: false }));
            }
        });
    };

    useEffect(() => {
        const area = Number(calcArea);
        if (!area) { setCalcResult([]); return; }
        if (calcType === 'PISO') setCalcResult([`${Math.ceil(area * 1.15)} m² Piso`, `${Math.ceil(area * 4)}kg Argamassa`]);
        else if (calcType === 'PAREDE') setCalcResult([`${Math.ceil(area * 30)} Tijolos`, `${Math.ceil(area * 5)}kg Cimento`]);
        else if (calcType === 'PINTURA') setCalcResult([`${Math.ceil(area / 5)}L Tinta`]);
    }, [calcArea, calcType]);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(steps.map(s => ({ Etapa: s.name, Status: s.status }))), "Obra");
        XLSX.writeFile(wb, `Obra_${work?.name}.xlsx`);
    };

    const handlePrintPDF = () => window.print();

    if (loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return null;

    // --- RENDERERS ---
    const renderMainTab = () => {
        switch (activeTab) {
            case 'SCHEDULE':
                return (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div><h2 className="text-2xl font-black text-primary dark:text-white">Cronograma</h2><p className="text-xs text-slate-500 font-bold uppercase">Etapas da Obra</p></div>
                            <button onClick={() => { setStepModalMode('ADD'); setStepName(''); setIsStepModalOpen(true); }} className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center"><i className="fa-solid fa-plus"></i></button>
                        </div>
                        {steps.map((step, idx) => (
                            <div key={step.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                                <button onClick={() => handleStepStatusClick(step)} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center ${step.status === StepStatus.COMPLETED ? 'bg-green-500 text-white' : 'text-slate-300'}`}><i className="fa-solid fa-check"></i></button>
                                <div className="flex-1 cursor-pointer" onClick={() => { setStepModalMode('EDIT'); setCurrentStepId(step.id); setStepName(step.name); setStepStart(step.startDate.split('T')[0]); setStepEnd(step.endDate.split('T')[0]); setIsStepModalOpen(true); }}>
                                    <h3 className={`font-bold ${step.status === StepStatus.COMPLETED ? 'line-through text-slate-400' : ''}`}>{step.name}</h3>
                                    <p className="text-xs text-slate-500">{parseDateNoTimezone(step.startDate)} - {parseDateNoTimezone(step.endDate)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'MATERIALS':
                return (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-2xl font-black text-primary dark:text-white">Materiais</h2>
                            <button onClick={() => setAddMatModal(true)} className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center"><i className="fa-solid fa-plus"></i></button>
                        </div>
                        {materials.map(mat => (
                            <div key={mat.id} onClick={() => { setMaterialModal({isOpen: true, material: mat}); setMatName(mat.name); setMatBrand(mat.brand||''); setMatPlannedQty(String(mat.plannedQty)); setMatUnit(mat.unit); }} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm">
                                <div className="flex justify-between">
                                    <span className="font-bold">{mat.name}</span>
                                    <span className="text-xs uppercase font-bold text-slate-400">{mat.purchasedQty}/{mat.plannedQty} {mat.unit}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-secondary" style={{ width: `${(mat.purchasedQty/mat.plannedQty)*100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'FINANCIAL':
                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                            <h2 className="text-2xl font-black text-primary">Financeiro</h2>
                            <button onClick={openAddExpense} className="bg-green-600 text-white w-10 h-10 rounded-xl flex items-center justify-center"><i className="fa-solid fa-plus"></i></button>
                        </div>
                        <div className="bg-gradient-premium p-6 rounded-3xl text-white shadow-xl">
                            <p className="text-sm opacity-80">Total Gasto</p>
                            <h3 className="text-3xl font-black">R$ {expenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString('pt-BR')}</h3>
                        </div>
                        {expenses.map(exp => (
                            <div key={exp.id} onClick={() => openEditExpense(exp)} className="bg-white p-4 rounded-2xl border flex justify-between items-center">
                                <div><p className="font-bold">{exp.description}</p><p className="text-xs text-slate-500">{exp.category}</p></div>
                                <span className="font-bold text-primary">R$ {Number(exp.amount).toLocaleString('pt-BR')}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'MORE':
                return (
                    <div className="space-y-8 px-2">
                        <h2 className="text-3xl font-black">Mais Opções</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setSubView('TEAM')} className="p-6 bg-white rounded-3xl border flex flex-col items-center gap-2"><i className="fa-solid fa-users text-2xl text-blue-500"></i><span className="font-bold">Equipe</span></button>
                            <button onClick={() => setSubView('SUPPLIERS')} className="p-6 bg-white rounded-3xl border flex flex-col items-center gap-2"><i className="fa-solid fa-truck text-2xl text-amber-500"></i><span className="font-bold">Fornecedores</span></button>
                            <button onClick={() => setSubView('REPORTS')} className="p-6 bg-white rounded-3xl border flex flex-col items-center gap-2"><i className="fa-solid fa-file-invoice text-2xl text-indigo-500"></i><span className="font-bold">Relatórios</span></button>
                            <button onClick={() => setSubView('PHOTOS')} className="p-6 bg-white rounded-3xl border flex flex-col items-center gap-2"><i className="fa-solid fa-camera text-2xl text-pink-500"></i><span className="font-bold">Fotos</span></button>
                        </div>
                        <div className="bg-slate-900 p-6 rounded-[2rem] text-white">
                            <h3 className="font-black text-secondary mb-4">ÁREA PREMIUM</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => setSubView('CALCULATORS')} className="p-2 bg-white/10 rounded-xl text-[10px] font-bold">CALCULADORA</button>
                                <button onClick={() => setSubView('CONTRACTS')} className="p-2 bg-white/10 rounded-xl text-[10px] font-bold">CONTRATOS</button>
                                <button onClick={() => setSubView('CHECKLIST')} className="p-2 bg-white/10 rounded-xl text-[10px] font-bold">CHECKLIST</button>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    const renderSubViewContent = () => {
        switch (subView) {
            case 'TEAM':
                return (
                    <div className="space-y-4">
                        <button onClick={() => openPersonModal('WORKER')} className="w-full p-4 bg-blue-600 text-white font-bold rounded-2xl">Adicionar Profissional</button>
                        {workers.map(w => (
                            <div key={w.id} className="p-4 bg-white rounded-2xl border flex justify-between items-center">
                                <div onClick={() => openPersonModal('WORKER', w)}><p className="font-bold">{w.name}</p><p className="text-xs text-slate-500">{w.role}</p></div>
                                <button onClick={() => handleDeletePerson(w.id, 'WORKER')} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                            </div>
                        ))}
                    </div>
                );
            case 'REPORTS':
                return (
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl border">
                            <h3 className="font-black text-xl mb-4">Relatório Consolidado</h3>
                            <p className="text-sm">Progresso: {stats?.progress || 0}%</p>
                            <p className="text-sm">Total Gasto: R$ {expenses.reduce((s, e) => s + Number(e.amount), 0).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleExportExcel} className="flex-1 p-3 bg-green-600 text-white rounded-xl font-bold">Exportar Excel</button>
                            <button onClick={handlePrintPDF} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">Imprimir PDF</button>
                        </div>
                    </div>
                );
            case 'PHOTOS':
                return (
                    <div className="space-y-4">
                        <label className="block p-8 border-2 border-dashed border-pink-300 bg-pink-50 rounded-2xl text-center cursor-pointer">
                            <i className="fa-solid fa-camera text-2xl text-pink-400"></i>
                            <span className="block font-bold text-pink-600 mt-2">{uploading ? 'Enviando...' : 'Adicionar Foto'}</span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'PHOTO')} />
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            {photos.map(p => <img key={p.id} src={p.url} className="rounded-xl aspect-square object-cover border" alt="obra" />)}
                        </div>
                    </div>
                );
            case 'CALCULATORS':
                return (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-2">
                            {['PISO', 'PAREDE', 'PINTURA'].map(t => <button key={t} onClick={() => setCalcType(t as any)} className={`p-3 rounded-xl font-bold text-xs ${calcType === t ? 'bg-secondary text-white' : 'bg-white border'}`}>{t}</button>)}
                        </div>
                        <div className="bg-slate-900 p-6 rounded-3xl text-white">
                            <input type="number" value={calcArea} onChange={e => setCalcArea(e.target.value)} placeholder="Área em m²" className="w-full p-4 bg-white/10 rounded-xl text-center text-2xl font-black mb-4 outline-none" />
                            <div className="space-y-2">
                                {calcResult.map((r, i) => <div key={i} className="p-3 bg-white/5 rounded-lg text-sm"><i className="fa-solid fa-check text-green-400 mr-2"></i>{r}</div>)}
                            </div>
                        </div>
                    </div>
                );
            case 'CONTRACTS':
                return (
                    <div className="space-y-4">
                        {CONTRACT_TEMPLATES.map(ct => (
                            <div key={ct.id} onClick={() => setViewContract({ title: ct.title, content: ct.contentTemplate })} className="p-4 bg-white rounded-2xl border flex items-center gap-4 cursor-pointer">
                                <i className="fa-solid fa-file-contract text-indigo-500"></i>
                                <span className="font-bold">{ct.title}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'CHECKLIST':
                return (
                    <div className="space-y-4">
                        {STANDARD_CHECKLISTS.map((cl, idx) => (
                            <div key={idx} className="bg-white rounded-2xl border overflow-hidden">
                                <button onClick={() => setActiveChecklist(activeChecklist === cl.category ? null : cl.category)} className="w-full p-4 flex justify-between font-bold">
                                    <span>{cl.category}</span><i className="fa-solid fa-chevron-down"></i>
                                </button>
                                {activeChecklist === cl.category && (
                                    <div className="p-4 border-t bg-slate-50 space-y-2">
                                        {cl.items.map((item, i) => <label key={i} className="flex gap-2 text-sm"><input type="checkbox" className="rounded" /> {item}</label>)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            case 'PROJECTS':
                return (
                    <div className="space-y-4">
                        <label className="block p-8 border-2 border-dashed border-teal-300 bg-teal-50 rounded-2xl text-center cursor-pointer">
                            <i className="fa-solid fa-file-pdf text-2xl text-teal-400"></i>
                            <span className="block font-bold text-teal-600 mt-2">Adicionar Projeto (PDF)</span>
                            <input type="file" className="hidden" onChange={e => handleFileUpload(e, 'FILE')} />
                        </label>
                        {files.map(f => <div key={f.id} className="p-4 bg-white rounded-xl border flex justify-between"><span>{f.name}</span><a href={f.url} download><i className="fa-solid fa-download"></i></a></div>)}
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="max-w-4xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative font-sans">
            {/* HEADER */}
            <div className="bg-white dark:bg-slate-900 px-6 py-4 sticky top-0 z-20 border-b no-print">
                <div className="flex justify-between items-center">
                    <button onClick={() => subView !== 'NONE' ? setSubView('NONE') : navigate('/')} className="text-slate-400"><i className="fa-solid fa-arrow-left text-xl"></i></button>
                    <h1 className="text-lg font-black uppercase tracking-tight">{subView !== 'NONE' ? subView : work.name}</h1>
                    <div className="w-6"></div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 p-4 pb-32 overflow-y-auto">
                {subView !== 'NONE' ? renderSubViewContent() : renderMainTab()}
            </div>

            {/* BOTTOM NAV */}
            {subView === 'NONE' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-40 no-print">
                    <div className="flex justify-around items-center h-16 max-w-4xl mx-auto">
                        <button onClick={() => setActiveTab('SCHEDULE')} className={`flex flex-col items-center flex-1 ${activeTab === 'SCHEDULE' ? 'text-secondary' : 'text-slate-400'}`}><i className="fa-solid fa-calendar-days"></i><span className="text-[10px] font-bold">ETAPAS</span></button>
                        <button onClick={() => setActiveTab('MATERIALS')} className={`flex flex-col items-center flex-1 ${activeTab === 'MATERIALS' ? 'text-secondary' : 'text-slate-400'}`}><i className="fa-solid fa-layer-group"></i><span className="text-[10px] font-bold">MATERIAIS</span></button>
                        <button onClick={() => setActiveTab('FINANCIAL')} className={`flex flex-col items-center flex-1 ${activeTab === 'FINANCIAL' ? 'text-secondary' : 'text-slate-400'}`}><i className="fa-solid fa-chart-pie"></i><span className="text-[10px] font-bold">FINANCEIRO</span></button>
                        <button onClick={() => setActiveTab('MORE')} className={`flex flex-col items-center flex-1 ${activeTab === 'MORE' ? 'text-secondary' : 'text-slate-400'}`}><i className="fa-solid fa-bars"></i><span className="text-[10px] font-bold">MAIS</span></button>
                    </div>
                </div>
            )}

            {/* MODALS RENDERED HERE */}
            {isStepModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6">
                        <h3 className="text-xl font-bold mb-4">Etapa</h3>
                        <form onSubmit={handleSaveStep} className="space-y-4">
                            <input placeholder="Nome" value={stepName} onChange={e => setStepName(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl" required />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={stepStart} onChange={e => setStepStart(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl" required />
                                <input type="date" value={stepEnd} onChange={e => setStepEnd(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl" required />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setIsStepModalOpen(false)} className="flex-1 p-3 font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 p-3 bg-primary text-white font-bold rounded-xl">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Outros modais seguem o mesmo padrão... */}
            <ZeModal isOpen={zeModal.isOpen} title={zeModal.title} message={zeModal.message} onConfirm={zeModal.onConfirm} onCancel={() => setZeModal(p => ({ ...p, isOpen: false }))} />
        </div>
    );
};

export default WorkDetail;
