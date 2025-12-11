
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAuth } from '../App';
import { dbService } from '../services/db';
import { Work, Worker, Supplier, Material, Step, Expense, StepStatus, WorkPhoto, WorkFile, FileCategory, ExpenseCategory, PlanType } from '../types';
import { ZeModal } from '../components/ZeModal';
import { STANDARD_CHECKLISTS, CONTRACT_TEMPLATES, STANDARD_JOB_ROLES, STANDARD_SUPPLIER_CATEGORIES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards';
import { aiService } from '../services/ai';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'SCHEDULE' | 'MATERIALS' | 'FINANCIAL' | 'MORE';
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'PROJECTS' | 'BONUS_IA' | 'BONUS_IA_CHAT' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
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
    
    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<MainTab>('SCHEDULE');
    const [subView, setSubView] = useState<SubView>('NONE');
    const [uploading, setUploading] = useState(false);
    
    // --- PREMIUM CHECK ---
    const isPremium = user?.plan === PlanType.VITALICIO;

    // --- MODALS STATE ---
    // STEP MODALS
    const [addStepModal, setAddStepModal] = useState(false);
    const [newStepName, setNewStepName] = useState('');
    const [newStepStart, setNewStepStart] = useState('');
    const [newStepEnd, setNewStepEnd] = useState('');
    
    // MATERIAL MODALS (EDIT & ADD)
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

    // EXPENSE MODAL
    const [addExpenseModal, setAddExpenseModal] = useState(false);
    const [expDesc, setExpDesc] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expTotalAgreed, setExpTotalAgreed] = useState('');
    const [expCategory, setExpCategory] = useState<string>(ExpenseCategory.LABOR);
    const [expStepId, setExpStepId] = useState('');

    // TEAM & SUPPLIER MODALS
    const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
    const [personMode, setPersonMode] = useState<'WORKER'|'SUPPLIER'>('WORKER');
    const [personId, setPersonId] = useState<string | null>(null); 
    const [personName, setPersonName] = useState('');
    const [personRole, setPersonRole] = useState('');
    const [personPhone, setPersonPhone] = useState('');
    const [personNotes, setPersonNotes] = useState('');

    // CONTRACT VIEWER MODAL
    const [viewContract, setViewContract] = useState<{title: string, content: string} | null>(null);

    const [zeModal, setZeModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // AI CHAT
    const [aiMessage, setAiMessage] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // CALCULATORS
    const [calcType, setCalcType] = useState<'PISO'|'PAREDE'|'PINTURA'>('PISO');
    const [calcArea, setCalcArea] = useState('');
    const [calcResult, setCalcResult] = useState<string[]>([]);

    // CHECKLIST
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    // REPORT TABS
    const [reportTab, setReportTab] = useState<'CRONO'|'MAT'|'FIN'>('CRONO');

    // --- LOAD DATA ---
    const load = async () => {
        if (!id) return;
        const w = await dbService.getWorkById(id);
        setWork(w || null);
        
        if (w) {
            const [s, m, e, wk, sp, ph, fl] = await Promise.all([
                dbService.getSteps(w.id),
                dbService.getMaterials(w.id),
                dbService.getExpenses(w.id),
                dbService.getWorkers(w.userId),
                dbService.getSuppliers(w.userId),
                // @ts-ignore
                dbService.getPhotos ? dbService.getPhotos(w.id) : [],
                // @ts-ignore
                dbService.getFiles ? dbService.getFiles(w.id) : []
            ]);
            
            setSteps(s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
            setMaterials(m);
            setExpenses(e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setWorkers(wk);
            setSuppliers(sp);
            setPhotos(ph);
            setFiles(fl);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, [id]);

    // --- HANDLERS FOR MODALS ---

    const handleAddStep = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !newStepName) return;
        await dbService.addStep({
            id: Math.random().toString(36).substr(2, 9),
            workId: work.id,
            name: newStepName,
            startDate: newStepStart || new Date().toISOString(),
            endDate: newStepEnd || new Date().toISOString(),
            status: StepStatus.NOT_STARTED,
            isDelayed: false
        });
        setAddStepModal(false);
        setNewStepName('');
        load();
    };

    const handleAddMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !newMatName) return;
        const mat: Material = {
            id: Math.random().toString(36).substr(2, 9),
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
        load();
    };

    const handleUpdateMaterial = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!materialModal.material) return;
        
        await dbService.registerMaterialPurchase(
            materialModal.material.id,
            matName,
            matBrand,
            Number(matPlannedQty),
            matUnit,
            Number(matBuyQty),
            Number(matBuyCost)
        );
        
        setMaterialModal({ isOpen: false, material: null });
        load();
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work || !expDesc) return;
        await dbService.addExpense({
            id: Math.random().toString(36).substr(2, 9),
            workId: work.id,
            description: expDesc,
            amount: Number(expAmount),
            date: new Date().toISOString(),
            category: expCategory,
            stepId: expStepId || undefined,
            totalAgreed: expTotalAgreed ? Number(expTotalAgreed) : undefined
        });
        setAddExpenseModal(false);
        setExpDesc(''); setExpAmount(''); setExpTotalAgreed('');
        load();
    };

    // --- HELPER FUNCTIONS ---
    const handleStepClick = async (step: Step) => {
        let newStatus = StepStatus.NOT_STARTED;
        if (step.status === StepStatus.NOT_STARTED) newStatus = StepStatus.IN_PROGRESS;
        else if (step.status === StepStatus.IN_PROGRESS) newStatus = StepStatus.COMPLETED;
        else newStatus = StepStatus.NOT_STARTED;

        await dbService.updateStep({ ...step, status: newStatus });
        await load();
    };

    // --- PHOTO / FILE UPLOAD (BASE64 for LocalStorage MVP) ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'PHOTO' | 'FILE') => {
        if (e.target.files && e.target.files[0] && work) {
            setUploading(true);
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                // Artificial delay to show loading state for UX
                await new Promise(r => setTimeout(r, 800));
                
                if (type === 'PHOTO') {
                    // @ts-ignore
                    await dbService.addPhoto({
                        id: Math.random().toString(36).substr(2, 9),
                        workId: work.id,
                        url: base64,
                        description: 'Foto da obra',
                        date: new Date().toISOString(),
                        type: 'PROGRESS'
                    });
                } else {
                    // @ts-ignore
                    await dbService.addFile({
                        id: Math.random().toString(36).substr(2, 9),
                        workId: work.id,
                        name: file.name,
                        category: FileCategory.GENERAL,
                        url: base64,
                        type: file.type,
                        date: new Date().toISOString()
                    });
                }
                setUploading(false);
                load();
            };
            reader.readAsDataURL(file);
        }
    };

    // --- TEAM & SUPPLIER MANAGEMENT ---
    const openPersonModal = (mode: 'WORKER' | 'SUPPLIER', item?: Worker | Supplier) => {
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
        if (!work) return;

        const payload = {
            userId: work.userId,
            name: personName,
            phone: personPhone,
            notes: personNotes
        };

        // Wait for DB operation to finish
        if (personMode === 'WORKER') {
            if (personId) await dbService.updateWorker({ ...payload, id: personId, role: personRole });
            else await dbService.addWorker({ ...payload, role: personRole });
        } else {
            if (personId) await dbService.updateSupplier({ ...payload, id: personId, category: personRole });
            else await dbService.addSupplier({ ...payload, category: personRole });
        }
        
        // Refresh data explicitly before closing modal
        await load();
        setIsPersonModalOpen(false);
    };

    const handleDeletePerson = (id: string, mode: 'WORKER' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true,
            title: mode === 'WORKER' ? 'Excluir Profissional' : 'Excluir Fornecedor',
            message: 'Tem certeza? Essa ação não pode ser desfeita.',
            onConfirm: async () => {
                if (mode === 'WORKER') await dbService.deleteWorker(id);
                else await dbService.deleteSupplier(id);
                await load();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // --- CALCULATORS ---
    useEffect(() => {
        if (!calcArea) { setCalcResult([]); return; }
        const area = Number(calcArea);
        if (calcType === 'PISO') {
            const piso = Math.ceil(area * 1.15); // 15% quebra
            const argamassa = Math.ceil(area * 4); // ~4kg/m2
            const rejunte = Math.ceil(area * 0.3); // ~300g/m2
            setCalcResult([
                `${piso} m² de Piso (com quebra)`,
                `${argamassa} kg de Argamassa AC-II/III`,
                `${rejunte} kg de Rejunte`
            ]);
        } else if (calcType === 'PAREDE') {
            const tijolos = Math.ceil(area * 30); // ~30 tijolos/m2 (tijolo baiano em pé)
            const cimento = Math.ceil(area * 5); // estimativa grossa
            setCalcResult([
                `${tijolos} Blocos/Tijolos`,
                `~${Math.ceil(cimento/50)} Sacos de Cimento (Assentamento)`
            ]);
        } else if (calcType === 'PINTURA') {
            const litros = Math.ceil(area / 10); // ~10m2 por litro por demão
            setCalcResult([
                `${litros * 2} Litros de Tinta (2 demãos)`,
                `${Math.ceil(area/30)} L de Selador`,
                `${Math.ceil(area/15)} kg de Massa Corrida`
            ]);
        }
    }, [calcArea, calcType]);

    // --- REPORTS EXPORT ---
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        
        // Cronograma Sheet
        const wsCrono = XLSX.utils.json_to_sheet(steps.map(s => ({
            Etapa: s.name,
            Inicio: new Date(s.startDate).toLocaleDateString(),
            Fim: new Date(s.endDate).toLocaleDateString(),
            Status: s.status === 'CONCLUIDO' ? 'Concluído' : s.status === 'EM_ANDAMENTO' ? 'Em Andamento' : 'Pendente'
        })));
        XLSX.utils.book_append_sheet(wb, wsCrono, "Cronograma");

        // Materiais Sheet
        const wsMat = XLSX.utils.json_to_sheet(materials.map(m => ({
            Material: m.name,
            Qtd_Planejada: m.plannedQty,
            Qtd_Comprada: m.purchasedQty,
            Status: m.purchasedQty >= m.plannedQty ? 'OK' : 'Pendente'
        })));
        XLSX.utils.book_append_sheet(wb, wsMat, "Materiais");

        // Financeiro Sheet
        const wsFin = XLSX.utils.json_to_sheet(expenses.map(e => ({
            Data: new Date(e.date).toLocaleDateString(),
            Descricao: e.description,
            Categoria: e.category,
            Valor: e.amount
        })));
        XLSX.utils.book_append_sheet(wb, wsFin, "Financeiro");

        XLSX.writeFile(wb, `Relatorio_Obra_${work?.name.replace(/ /g, '_')}.xlsx`);
    };

    // --- AI CHAT ---
    const handleAiAsk = async () => {
        if (!aiMessage.trim()) return;
        setAiLoading(true);
        const response = await aiService.sendMessage(aiMessage);
        setAiResponse(response);
        setAiLoading(false);
        setAiMessage('');
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return null;

    // =================================================================================================
    // SUB-VIEWS RENDER (THE "MAIS" SECTION CONTENT)
    // =================================================================================================
    if (subView !== 'NONE') {
        const renderSubViewContent = () => {
            switch(subView) {
                // --- 1. GESTÃO DE EQUIPE ---
                case 'TEAM': return (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl border border-blue-100 dark:border-blue-900 mb-2">
                            <h3 className="text-xl font-bold text-primary dark:text-white mb-1">Minha Equipe</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                Cadastre quem faz sua obra acontecer.
                            </p>
                            <button 
                                onClick={() => openPersonModal('WORKER')} 
                                className="w-full py-4 rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center justify-center gap-2 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-plus text-sm"></i>
                                </div>
                                Adicionar Novo Profissional
                            </button>
                        </div>

                        {workers.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <i className="fa-solid fa-helmet-safety text-4xl mb-2 text-slate-300"></i>
                                <p className="text-sm font-medium">Nenhum profissional cadastrado.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {workers.map(w => (
                                    <div key={w.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                                        <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => openPersonModal('WORKER', w)}>
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-2xl shadow-inner">
                                                <i className="fa-solid fa-user-helmet-safety"></i>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-primary dark:text-white text-lg">{w.name}</h4>
                                                <p className="text-xs font-bold text-secondary uppercase tracking-wider">{w.role}</p>
                                                {w.phone && <p className="text-xs text-slate-400 mt-1"><i className="fa-solid fa-phone mr-1"></i> {w.phone}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {w.phone && (
                                                <a href={`https://wa.me/55${w.phone.replace(/\D/g, '')}`} target="_blank" className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors border border-green-100">
                                                    <i className="fa-brands fa-whatsapp text-lg"></i>
                                                </a>
                                            )}
                                            <button onClick={() => handleDeletePerson(w.id, 'WORKER')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors">
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

                // --- 2. GESTÃO DE FORNECEDORES ---
                case 'SUPPLIERS': return (
                    <div className="space-y-6">
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-3xl border border-amber-100 dark:border-amber-900 mb-2">
                            <h3 className="text-xl font-bold text-primary dark:text-white mb-1">Fornecedores</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                                Lojas e prestadores de serviço parceiros.
                            </p>
                            <button 
                                onClick={() => openPersonModal('SUPPLIER')} 
                                className="w-full py-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-500 font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center justify-center gap-2 group"
                            >
                                <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-plus text-sm"></i>
                                </div>
                                Adicionar Novo Fornecedor
                            </button>
                        </div>

                        {suppliers.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <i className="fa-solid fa-store text-4xl mb-2 text-slate-300"></i>
                                <p className="text-sm font-medium">Nenhum fornecedor cadastrado.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {suppliers.map(s => (
                                    <div key={s.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                                        <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => openPersonModal('SUPPLIER', s)}>
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-2xl shadow-inner">
                                                <i className="fa-solid fa-store"></i>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-primary dark:text-white text-lg">{s.name}</h4>
                                                <p className="text-xs font-bold text-secondary uppercase tracking-wider">{s.category}</p>
                                                {s.phone && <p className="text-xs text-slate-400 mt-1"><i className="fa-solid fa-phone mr-1"></i> {s.phone}</p>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {s.phone && (
                                                <a href={`https://wa.me/55${s.phone.replace(/\D/g, '')}`} target="_blank" className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors border border-green-100">
                                                    <i className="fa-brands fa-whatsapp text-lg"></i>
                                                </a>
                                            )}
                                            <button onClick={() => handleDeletePerson(s.id, 'SUPPLIER')} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors">
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

                // --- 3. RELATÓRIOS ---
                case 'REPORTS': return (
                    <div className="space-y-6">
                        <div className="flex gap-2 p-1 bg-slate-200 dark:bg-slate-800 rounded-xl">
                            {['CRONO', 'MAT', 'FIN'].map((rt) => (
                                <button 
                                    key={rt} 
                                    onClick={() => setReportTab(rt as any)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${reportTab === rt ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
                                >
                                    {rt === 'CRONO' ? 'Cronograma' : rt === 'MAT' ? 'Materiais' : 'Financeiro'}
                                </button>
                            ))}
                        </div>

                        {/* Export Buttons */}
                        <div className="flex gap-4">
                            <button onClick={() => window.print()} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors shadow-sm">
                                <i className="fa-solid fa-file-pdf"></i> Imprimir PDF
                            </button>
                            <button onClick={handleExportExcel} className="flex-1 py-3 bg-green-50 text-green-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-100 transition-colors shadow-sm">
                                <i className="fa-solid fa-file-excel"></i> Baixar Excel
                            </button>
                        </div>
                        
                        {/* Report Content */}
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg min-h-[300px]">
                            {reportTab === 'CRONO' && (
                                <div className="space-y-4">
                                    {steps.map((s, i) => (
                                        <div key={s.id} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">
                                                    {String(i+1).padStart(2,'0')}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold block">{s.name}</span>
                                                    <span className="text-[10px] text-slate-400 uppercase font-medium">{new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide ${s.status === 'CONCLUIDO' ? 'bg-green-100 text-green-700' : s.status === 'EM_ANDAMENTO' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                {s.status === 'CONCLUIDO' ? 'Concluído' : s.status === 'EM_ANDAMENTO' ? 'Andamento' : 'Pendente'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {reportTab === 'MAT' && (
                                <div className="space-y-6">
                                    {steps.map((step, i) => {
                                        const stepMaterials = materials.filter(m => m.stepId === step.id);
                                        if (stepMaterials.length === 0) return null;
                                        return (
                                            <div key={step.id}>
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">{step.name}</h4>
                                                <div className="space-y-2">
                                                    {stepMaterials.map(m => (
                                                        <div key={m.id} className="flex justify-between items-center text-sm">
                                                            <span className="font-medium text-slate-700 dark:text-slate-300">• {m.name}</span>
                                                            <span className={`text-xs font-mono font-bold ${m.purchasedQty >= m.plannedQty ? 'text-green-600' : 'text-slate-400'}`}>
                                                                {m.purchasedQty} / {m.plannedQty} {m.unit}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {reportTab === 'FIN' && (
                                <div className="space-y-4">
                                    {expenses.map(e => (
                                        <div key={e.id} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${e.category === 'Material' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    <i className={`fa-solid ${e.category === 'Material' ? 'fa-box' : 'fa-user'}`}></i>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{e.description}</p>
                                                    <p className="text-[10px] text-slate-400">{new Date(e.date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">R$ {e.amount.toLocaleString('pt-BR')}</span>
                                        </div>
                                    ))}
                                    <div className="pt-6 mt-4 border-t-2 border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                        <span className="font-black text-primary dark:text-white uppercase tracking-widest">Total Gasto</span>
                                        <span className="text-2xl font-black text-secondary">R$ {expenses.reduce((a,b)=>a+b.amount,0).toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );

                // --- 4. FOTOS ---
                case 'PHOTOS': return (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-center">
                            <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 flex items-center justify-center text-3xl mx-auto mb-4">
                                <i className="fa-solid fa-camera-retro"></i>
                            </div>
                            <h3 className="text-lg font-bold text-primary dark:text-white">Galeria de Progresso</h3>
                            <p className="text-sm text-slate-500 mb-6">Registre o antes, durante e depois.</p>
                            
                            <label className="block w-full py-4 border-2 border-dashed border-pink-200 dark:border-pink-900 bg-pink-50 dark:bg-pink-900/10 rounded-2xl cursor-pointer hover:bg-pink-100 dark:hover:bg-pink-900/20 transition-all group">
                                {uploading ? (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-pink-600"></i>
                                        <span className="text-sm font-bold text-pink-600">Enviando...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <i className="fa-solid fa-cloud-arrow-up text-2xl text-pink-400 group-hover:text-pink-600 transition-colors"></i>
                                        <span className="text-sm font-bold text-pink-600 dark:text-pink-400">Toque para enviar foto (JPG/PNG)</span>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'PHOTO')} disabled={uploading} />
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {photos.map((p) => (
                                <div key={p.id} className="aspect-square bg-white dark:bg-slate-900 rounded-2xl overflow-hidden relative group shadow-sm border border-slate-200 dark:border-slate-800">
                                    <img src={p.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Obra" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <span className="text-white text-xs font-bold">{new Date(p.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

                // --- 5. ARQUIVOS (RENAMED TO PROJETOS & PLANTAS) ---
                case 'PROJECTS': return (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-center">
                            <div className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center text-3xl mx-auto mb-4">
                                <i className="fa-solid fa-compass-drafting"></i>
                            </div>
                            <h3 className="text-lg font-bold text-primary dark:text-white">Central de Projetos</h3>
                            <p className="text-sm text-slate-500 mb-6">Arquitetônico, Elétrico, Hidráulico e Documentos.</p>
                            
                            <label className="block w-full py-4 border-2 border-dashed border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-900/10 rounded-2xl cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/20 transition-all group">
                                {uploading ? (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-teal-600"></i>
                                        <span className="text-sm font-bold text-teal-600">Enviando...</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <i className="fa-solid fa-file-arrow-up text-2xl text-teal-400 group-hover:text-teal-600 transition-colors"></i>
                                        <span className="text-sm font-bold text-teal-600 dark:text-teal-400">Adicionar Arquivo (PDF, DWG, DXF)</span>
                                    </div>
                                )}
                                <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'FILE')} disabled={uploading} />
                            </label>
                        </div>

                        <div className="space-y-3">
                            {files.map(f => (
                                <div key={f.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm hover:shadow-md transition-all group">
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-red-500 flex items-center justify-center text-2xl group-hover:bg-red-50 transition-colors">
                                        <i className="fa-solid fa-file-pdf"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-primary dark:text-white truncate">{f.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{new Date(f.date).toLocaleDateString()}</p>
                                    </div>
                                    <a href={f.url} download={f.name} className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-primary dark:text-white hover:bg-slate-200 transition-colors">
                                        <i className="fa-solid fa-download"></i>
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                );

                // --- 6. BONUS IA (LANDING) ---
                case 'BONUS_IA': return (
                    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 animate-in zoom-in-95 relative">
                        {/* Premium Check Overlay */}
                        {!isPremium && (
                            <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center rounded-3xl">
                                <div className="w-20 h-20 bg-premium text-white rounded-full flex items-center justify-center text-4xl mb-6 shadow-xl shadow-purple-500/30">
                                    <i className="fa-solid fa-lock"></i>
                                </div>
                                <h3 className="text-2xl font-black text-primary dark:text-white mb-2">Engenheiro Virtual Bloqueado</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-xs">
                                    O Zé da Obra IA está disponível exclusivamente para membros Vitalícios.
                                </p>
                                <button onClick={() => navigate('/settings')} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 px-8 rounded-2xl shadow-xl hover:scale-105 transition-transform w-full animate-pulse">
                                    Liberar Acesso Vitalício
                                </button>
                            </div>
                        )}

                        <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-secondary to-orange-500 shadow-2xl mb-6 relative">
                            <img src={ZE_AVATAR} className="w-full h-full object-cover rounded-full border-4 border-slate-900 bg-slate-800" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} />
                            <div className="absolute -bottom-2 -right-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full border-2 border-white">ONLINE</div>
                        </div>
                        <h2 className="text-3xl font-black text-primary dark:text-white mb-2">Zé da Obra <span className="text-secondary">AI</span></h2>
                        <p className="text-slate-500 max-w-xs text-center mb-8">
                            Seu engenheiro virtual disponível 24h. Tire dúvidas sobre traço de concreto, elétrica, pintura e muito mais.
                        </p>
                        <button 
                            onClick={() => setSubView('BONUS_IA_CHAT')}
                            className="w-full max-w-sm py-4 bg-gradient-premium text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:scale-105 transition-transform"
                        >
                            <i className="fa-solid fa-comments"></i> Iniciar Conversa
                        </button>
                    </div>
                );

                // --- 7. BONUS IA (CHAT) ---
                case 'BONUS_IA_CHAT': 
                    if (!isPremium) return null; // Double check
                    return (
                    <div className="flex flex-col h-[80vh]">
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-inner overflow-y-auto mb-4 border border-slate-200 dark:border-slate-800">
                             <div className="flex gap-4 mb-6">
                                <img src={ZE_AVATAR} className="w-10 h-10 rounded-full border border-slate-200" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}/>
                                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-b-xl text-sm shadow-sm">
                                    <p className="font-bold text-secondary mb-1">Zé da Obra</p>
                                    <p>Opa! Mestre de obras na área. O que tá pegando?</p>
                                </div>
                            </div>
                            {aiResponse && (
                                <div className="flex gap-4 mb-6 animate-in fade-in">
                                    <img src={ZE_AVATAR} className="w-10 h-10 rounded-full border border-slate-200" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}/>
                                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-b-xl text-sm shadow-sm">
                                        <p className="font-bold text-secondary mb-1">Zé da Obra</p>
                                        <p className="whitespace-pre-wrap">{aiResponse}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                value={aiMessage} 
                                onChange={e => setAiMessage(e.target.value)}
                                placeholder="Pergunte ao Zé..." 
                                className="flex-1 p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-secondary transition-colors"
                            />
                            <button onClick={handleAiAsk} disabled={aiLoading} className="w-14 bg-secondary text-white rounded-xl flex items-center justify-center shadow-lg">
                                {aiLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                            </button>
                        </div>
                    </div>
                );

                // --- 8. CALCULADORAS (PREMIUM) ---
                case 'CALCULATORS': return (
                    <div className="space-y-6 relative">
                        {!isPremium && <PremiumLockOverlay title="Calculadoras de Engenharia" />}
                        
                        <div className={`transition-all ${!isPremium ? 'opacity-20 blur-sm pointer-events-none' : ''}`}>
                            <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6">
                                {['PISO', 'PAREDE', 'PINTURA'].map(t => (
                                    <button key={t} onClick={() => {setCalcType(t as any); setCalcArea(''); setCalcResult([])}} className={`py-2 text-xs font-bold rounded-lg transition-all ${calcType === t ? 'bg-white shadow text-primary' : 'text-slate-500'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl text-center">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 block">Área Total (m²)</label>
                                <div className="relative max-w-[200px] mx-auto mb-8">
                                    <input type="number" value={calcArea} onChange={e => setCalcArea(e.target.value)} placeholder="0" className="w-full p-4 text-4xl font-black bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 outline-none focus:border-secondary text-center" />
                                    <span className="absolute right-4 bottom-4 text-slate-400 font-bold text-lg pointer-events-none">m²</span>
                                </div>
                                
                                {calcResult.length > 0 ? (
                                    <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-2 text-left">
                                        <h4 className="text-sm font-bold text-secondary uppercase mb-3">Material Estimado</h4>
                                        {calcResult.map((res, i) => (
                                            <div key={i} className="flex items-center gap-3 font-bold text-primary dark:text-white bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                                                <i className="fa-solid fa-check-circle text-green-500 text-xl"></i> {res}
                                            </div>
                                        ))}
                                        <p className="text-[10px] text-slate-400 mt-2 text-center">*Valores aproximados com 10% de margem.</p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-400 italic">Digite a área acima para calcular.</p>
                                )}
                            </div>
                        </div>
                    </div>
                );

                // --- 9. CONTRATOS (PREMIUM) ---
                case 'CONTRACTS': return (
                    <div className="space-y-4 relative">
                        {!isPremium && <PremiumLockOverlay title="Modelos de Contrato" />}
                        
                        <div className={`transition-all ${!isPremium ? 'opacity-20 blur-sm pointer-events-none' : ''}`}>
                            {CONTRACT_TEMPLATES.map(ct => (
                                <div 
                                    key={ct.id} 
                                    onClick={() => setViewContract({ title: ct.title, content: ct.contentTemplate })}
                                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-secondary transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-secondary group-hover:text-white transition-colors">
                                                <i className="fa-solid fa-file-contract text-xl"></i>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-primary dark:text-white text-lg">{ct.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium">Toque para visualizar e copiar</p>
                                            </div>
                                        </div>
                                        <i className="fa-solid fa-chevron-right text-slate-300 mt-4"></i>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
                
                // --- 10. CHECKLIST (PREMIUM) ---
                case 'CHECKLIST': return (
                    <div className="space-y-4 relative">
                        {!isPremium && <PremiumLockOverlay title="Checklist Profissional" />}

                        <div className={`transition-all ${!isPremium ? 'opacity-20 blur-sm pointer-events-none' : ''}`}>
                            {STANDARD_CHECKLISTS.map((cl, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                    <button 
                                        onClick={() => setActiveChecklist(activeChecklist === cl.category ? null : cl.category)}
                                        className="w-full p-5 flex justify-between items-center text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <span className="font-bold text-sm flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                                                <i className="fa-solid fa-list-check"></i>
                                            </div>
                                            {cl.category}
                                        </span>
                                        <i className={`fa-solid fa-chevron-down transition-transform ${activeChecklist === cl.category ? 'rotate-180' : ''}`}></i>
                                    </button>
                                    {activeChecklist === cl.category && (
                                        <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                                            {cl.items.map((item, i) => (
                                                <label key={i} className="flex items-start gap-3 py-3 cursor-pointer border-b border-dashed border-slate-200 dark:border-slate-700 last:border-0 hover:bg-white/50 rounded-lg px-2 transition-colors">
                                                    <input type="checkbox" className="mt-1 rounded border-slate-300 text-secondary focus:ring-secondary w-5 h-5" />
                                                    <span className="text-sm text-slate-600 dark:text-slate-300 leading-tight">{item}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                );

                default: return null;
            }
        };

        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 font-sans">
                <div className="bg-white dark:bg-slate-900 sticky top-0 z-30 px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm">
                    <button onClick={() => setSubView('NONE')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 className="text-lg font-bold text-primary dark:text-white uppercase tracking-wide truncate">
                        {subView === 'TEAM' && 'Minha Equipe'}
                        {subView === 'SUPPLIERS' && 'Fornecedores'}
                        {subView === 'REPORTS' && 'Relatórios'}
                        {subView === 'PHOTOS' && 'Galeria de Fotos'}
                        {subView === 'PROJECTS' && 'Projetos e Plantas'}
                        {subView === 'BONUS_IA' && 'Engenheiro Virtual'}
                        {subView === 'BONUS_IA_CHAT' && 'Chat com Zé da Obra'}
                        {subView === 'CALCULATORS' && 'Calculadoras'}
                        {subView === 'CONTRACTS' && 'Contratos Premium'}
                        {subView === 'CHECKLIST' && 'Checklist Técnico'}
                    </h2>
                </div>
                <div className="p-4 max-w-3xl mx-auto animate-in slide-in-from-right-10">
                    {renderSubViewContent()}
                </div>
            </div>
        );
    }

    // --- PREMIUM LOCK OVERLAY COMPONENT ---
    const PremiumLockOverlay = ({ title }: { title: string }) => (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-center p-6 animate-in fade-in">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-full flex items-center justify-center text-white text-3xl shadow-xl shadow-purple-500/30 mb-6">
                <i className="fa-solid fa-lock"></i>
            </div>
            <h3 className="text-2xl font-black text-primary dark:text-white mb-2">{title} Bloqueado</h3>
            <p className="text-slate-500 mb-8 max-w-xs">
                Esta ferramenta exclusiva está disponível apenas para membros do <strong>Plano Vitalício</strong>.
            </p>
            <button 
                onClick={() => navigate('/settings')}
                className="w-full max-w-xs py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all animate-pulse"
            >
                Quero Acesso Vitalício
            </button>
        </div>
    );

    // =================================================================================================
    // MAIN TAB VIEW
    // =================================================================================================

    // --- 1, 2, 3: SCHEDULE, MATERIALS, FINANCIAL (AS BEFORE) ---
    const renderMainTab = () => {
        if (activeTab === 'SCHEDULE') {
            return (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Cronograma</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Etapas da Obra</p>
                        </div>
                        <button onClick={() => setAddStepModal(true)} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                    </div>
                    {steps.map((step, idx) => {
                         const stepNum = String(idx + 1).padStart(2, '0');
                         const isDone = step.status === StepStatus.COMPLETED;
                         const statusColor = step.status === StepStatus.COMPLETED ? 'bg-green-500 border-green-500 text-white' : step.status === StepStatus.IN_PROGRESS ? 'bg-secondary border-secondary text-white' : 'bg-transparent border-slate-300 dark:border-slate-600';

                         return (
                            <div key={step.id} className={`group bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md relative overflow-hidden ${isDone ? 'border-green-200 dark:border-green-900/30' : 'border-slate-100 dark:border-slate-800'}`}>
                                {idx < steps.length - 1 && <div className="absolute left-[29px] top-16 bottom-[-20px] w-0.5 bg-slate-100 dark:bg-slate-800 -z-10"></div>}
                                <div className="flex items-center gap-4">
                                    <button onClick={() => handleStepClick(step)} className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${statusColor}`}>
                                        {isDone && <i className="fa-solid fa-check text-xs"></i>}
                                        {step.status === StepStatus.IN_PROGRESS && <div className="w-3 h-3 bg-white rounded-full"></div>}
                                    </button>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ETAPA {stepNum}</span>
                                                <h3 className={`font-bold text-lg leading-tight ${isDone ? 'text-slate-400 line-through decoration-2 decoration-green-500/50' : 'text-primary dark:text-white'}`}>{step.name}</h3>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 mt-2">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md"><i className="fa-regular fa-calendar"></i> {new Date(step.startDate).toLocaleDateString('pt-BR')}</div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md"><i className="fa-solid fa-flag-checkered"></i> {new Date(step.endDate).toLocaleDateString('pt-BR')}</div>
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
             return (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2 sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 py-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Materiais</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Controle de Compras</p>
                        </div>
                        <button onClick={() => setAddMatModal(true)} className="bg-primary text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-primary-light transition-all shadow-lg shadow-primary/30"><i className="fa-solid fa-plus text-lg"></i></button>
                    </div>
                    {steps.map((step, idx) => {
                        const stepMaterials = materials.filter(m => m.stepId === step.id);
                        return (
                            <div key={step.id} className="mb-8">
                                <div className="flex items-center gap-3 mb-4 pl-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-black text-sm">{String(idx+1).padStart(2,'0')}</div>
                                    <h3 className="font-bold text-lg text-primary dark:text-white">{step.name}</h3>
                                </div>
                                <div className="space-y-3">
                                    {stepMaterials.length === 0 && <div className="px-4 py-4 bg-white/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center"><p className="text-xs text-slate-400">Nenhum material previsto.</p></div>}
                                    {stepMaterials.map(mat => {
                                        const hasPlanned = mat.plannedQty > 0;
                                        const progress = hasPlanned ? Math.min(100, (mat.purchasedQty / mat.plannedQty) * 100) : 0;
                                        const isComplete = hasPlanned && mat.purchasedQty >= mat.plannedQty;
                                        return (
                                            <div key={mat.id} onClick={() => { setMaterialModal({isOpen: true, material: mat}); setMatName(mat.name); setMatBrand(mat.brand||''); setMatPlannedQty(String(mat.plannedQty)); setMatUnit(mat.unit); setMatBuyQty(''); setMatBuyCost(''); }} className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${isComplete ? 'border-green-200 dark:border-green-900/30' : 'border-slate-100 dark:border-slate-800'}`}>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div><div className="font-bold text-primary dark:text-white text-base leading-tight">{mat.name}</div>{mat.brand && <div className="text-xs text-slate-400 font-bold uppercase mt-0.5">{mat.brand}</div>}</div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isComplete ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{isComplete ? 'OK' : 'Pendente'}</span>
                                                </div>
                                                <div className="mt-3 flex items-center gap-3">
                                                    <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${progress}%` }}></div></div>
                                                    <div className="text-xs font-mono font-bold text-slate-500 whitespace-nowrap bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">{mat.purchasedQty}/{mat.plannedQty} {mat.unit}</div>
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
            return (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-end mb-2 px-2 sticky top-0 z-10 bg-slate-50 dark:bg-slate-950 py-2">
                        <div>
                            <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Fluxo de Caixa</p>
                        </div>
                        <button onClick={() => setAddExpenseModal(true)} className="bg-green-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-green-700 transition-all shadow-lg shadow-green-600/30"><i className="fa-solid fa-plus text-lg"></i></button>
                    </div>
                    <div className="bg-gradient-premium p-6 rounded-3xl text-white shadow-xl relative overflow-hidden mb-8">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <p className="text-sm opacity-80 font-medium mb-1">Total Gasto na Obra</p>
                        <h3 className="text-4xl font-black mb-4 tracking-tight">R$ {expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                        <div className="flex items-center gap-2 text-xs opacity-70 bg-white/10 w-fit px-3 py-1 rounded-full"><i className="fa-solid fa-wallet"></i> Orçamento: R$ {work.budgetPlanned.toLocaleString('pt-BR')}</div>
                    </div>
                    {steps.map((step, idx) => {
                        const stepExpenses = expenses.filter(e => e.stepId === step.id);
                        if (stepExpenses.length === 0) return null;
                        return (
                            <div key={step.id} className="mb-8">
                                <div className="flex items-center gap-3 mb-4 pl-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-black text-sm">{String(idx+1).padStart(2,'0')}</div>
                                    <h3 className="font-bold text-lg text-primary dark:text-white">{step.name}</h3>
                                    <div className="ml-auto text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">R$ {stepExpenses.reduce((s,e)=>s+e.amount, 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                                </div>
                                <div className="space-y-3">
                                    {stepExpenses.map(exp => (
                                        <div key={exp.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${exp.category === 'Material' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}><i className={`fa-solid ${exp.category === 'Material' ? 'fa-box' : 'fa-helmet-safety'}`}></i></div>
                                                    <div><p className="font-bold text-primary dark:text-white text-sm">{exp.description}</p><p className="text-[10px] text-slate-400 uppercase tracking-wide">{new Date(exp.date).toLocaleDateString()} • {exp.category}</p></div>
                                                </div>
                                                <span className="font-bold text-primary dark:text-white">- R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            {exp.totalAgreed && exp.totalAgreed > exp.amount && <div className="mt-2 ml-14 bg-slate-50 dark:bg-slate-800 rounded-lg p-2 text-xs text-slate-500 flex justify-between items-center"><span>Ref. Contrato: R$ {exp.totalAgreed.toLocaleString('pt-BR')}</span><span className="font-bold text-amber-600">Restante: R$ {(exp.totalAgreed - exp.amount).toLocaleString('pt-BR')}</span></div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // --- 4: THE "MAIS" MENU (RESTORED STRUCTURE) ---
        if (activeTab === 'MORE') {
            return (
                <div className="space-y-8 animate-in fade-in">
                    <div className="px-2">
                        <h2 className="text-3xl font-black text-primary dark:text-white">Mais Opções</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Central de Controle</p>
                    </div>

                    <div className="space-y-8">
                        {/* Section: Gestão (Enhanced Design) */}
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Gestão Operacional</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setSubView('TEAM')} className="group p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-sm"><i className="fa-solid fa-helmet-safety"></i></div>
                                    <span className="font-bold text-base text-primary dark:text-white relative z-10">Equipe</span>
                                </button>
                                <button onClick={() => setSubView('SUPPLIERS')} className="group p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-sm"><i className="fa-solid fa-truck-fast"></i></div>
                                    <span className="font-bold text-base text-primary dark:text-white relative z-10">Fornecedores</span>
                                </button>
                            </div>
                        </div>

                        {/* Section: Documentação (Grid Layout) */}
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 pl-2">Documentação e Mídia</h3>
                            <div className="grid grid-cols-3 gap-3">
                                <button onClick={() => setSubView('REPORTS')} className="group p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-indigo-100 transition-colors"><i className="fa-solid fa-file-chart-column"></i></div>
                                    <span className="font-bold text-xs text-primary dark:text-white">Relatórios</span>
                                </button>
                                <button onClick={() => setSubView('PHOTOS')} className="group p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-pink-100 transition-colors"><i className="fa-solid fa-camera-retro"></i></div>
                                    <span className="font-bold text-xs text-primary dark:text-white">Fotos</span>
                                </button>
                                <button onClick={() => setSubView('PROJECTS')} className="group p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-2">
                                    <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center text-xl group-hover:bg-teal-100 transition-colors"><i className="fa-solid fa-folder-open"></i></div>
                                    <span className="font-bold text-xs text-primary dark:text-white">Projetos</span>
                                </button>
                            </div>
                        </div>

                        {/* Section: Bônus Vitalício (The Premium CTA Area) */}
                        <div className="relative overflow-hidden rounded-[2rem] shadow-xl">
                            <div className="absolute inset-0 bg-gradient-premium"></div>
                            {/* Decorative Background Elements */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

                            <div className="relative z-10 p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white shadow-lg shadow-secondary/30"><i className="fa-solid fa-crown"></i></div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Área Premium</h3>
                                        <p className="text-xs text-slate-400 font-medium">Ferramentas Exclusivas</p>
                                    </div>
                                </div>

                                <div onClick={() => setSubView('BONUS_IA')} className="bg-white/10 hover:bg-white/15 p-4 rounded-2xl border border-white/10 mb-4 cursor-pointer flex items-center gap-4 transition-all backdrop-blur-sm group">
                                    <div className="relative">
                                        <img src={ZE_AVATAR} className={`w-14 h-14 rounded-full border-2 border-secondary bg-slate-800 object-cover ${!isPremium ? 'grayscale opacity-70' : ''}`} onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}/>
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-800 rounded-full"></div>
                                        {!isPremium && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                                                <i className="fa-solid fa-lock text-white text-lg"></i>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-base group-hover:text-secondary transition-colors">Zé da Obra AI</h4>
                                        <p className="text-xs text-slate-300">Tire dúvidas técnicas 24h</p>
                                    </div>
                                    <div className="ml-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:bg-secondary group-hover:text-white transition-all">
                                        {isPremium ? <i className="fa-solid fa-comment-dots"></i> : <i className="fa-solid fa-lock"></i>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    {['CALCULATORS', 'CONTRACTS', 'CHECKLIST'].map(item => (
                                        <button 
                                            key={item}
                                            onClick={() => setSubView(item as SubView)} 
                                            className={`p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 flex flex-col items-center gap-2 text-center transition-colors group ${!isPremium ? 'opacity-70' : ''}`}
                                        >
                                            <div className="relative">
                                                <i className={`fa-solid ${item === 'CALCULATORS' ? 'fa-calculator' : item === 'CONTRACTS' ? 'fa-file-signature' : 'fa-clipboard-check'} text-slate-300 group-hover:text-secondary text-2xl mb-1 transition-colors`}></i>
                                                {!isPremium && (
                                                    <div className="absolute -top-2 -right-2 bg-black/80 rounded-full w-4 h-4 flex items-center justify-center">
                                                        <i className="fa-solid fa-lock text-[8px] text-white"></i>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-white uppercase tracking-wide">
                                                {item === 'CALCULATORS' ? 'Calculadoras' : item === 'CONTRACTS' ? 'Contratos' : 'Checklist'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                
                                {!isPremium && (
                                    <button onClick={() => navigate('/settings')} className="w-full mt-4 py-3 bg-gradient-to-r from-secondary to-yellow-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-yellow-500/20 animate-pulse hover:scale-[1.02] transition-transform">
                                        Liberar Acesso Vitalício
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="max-w-4xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans relative">
            
            {/* --- HEADER --- */}
            <div className="bg-white dark:bg-slate-900 px-6 pt-6 pb-2 sticky top-0 z-20 shadow-sm border-b border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-1">
                    <button onClick={() => navigate('/')} className="text-slate-400 hover:text-primary dark:hover:text-white">
                        <i className="fa-solid fa-arrow-left text-xl"></i>
                    </button>
                    <h1 className="text-lg font-black text-primary dark:text-white uppercase tracking-tight">{work.name}</h1>
                    <div className="w-6"></div> 
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 p-4 pb-32 overflow-y-auto">
                {renderMainTab()}
            </div>

            {/* --- BOTTOM NAVIGATION BAR --- */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 pb-safe z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <div className="flex justify-around items-center max-w-4xl mx-auto h-16">
                    <button onClick={() => setActiveTab('SCHEDULE')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'SCHEDULE' ? 'text-secondary' : 'text-slate-400'}`}>
                        <i className={`fa-solid fa-calendar-days text-xl ${activeTab === 'SCHEDULE' ? 'scale-110' : ''}`}></i>
                        <span className="text-[10px] font-bold uppercase">Cronograma</span>
                    </button>
                    <button onClick={() => setActiveTab('MATERIALS')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'MATERIALS' ? 'text-secondary' : 'text-slate-400'}`}>
                        <i className={`fa-solid fa-layer-group text-xl ${activeTab === 'MATERIALS' ? 'scale-110' : ''}`}></i>
                        <span className="text-[10px] font-bold uppercase">Materiais</span>
                    </button>
                    <button onClick={() => setActiveTab('FINANCIAL')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'FINANCIAL' ? 'text-secondary' : 'text-slate-400'}`}>
                        <i className={`fa-solid fa-chart-pie text-xl ${activeTab === 'FINANCIAL' ? 'scale-110' : ''}`}></i>
                        <span className="text-[10px] font-bold uppercase">Financeiro</span>
                    </button>
                    <button onClick={() => setActiveTab('MORE')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all ${activeTab === 'MORE' ? 'text-secondary' : 'text-slate-400'}`}>
                        <i className={`fa-solid fa-bars text-xl ${activeTab === 'MORE' ? 'scale-110' : ''}`}></i>
                        <span className="text-[10px] font-bold uppercase">Mais</span>
                    </button>
                </div>
            </div>

            {/* --- MODALS (FIXED POSITION) --- */}
            
            {/* ADD STEP MODAL */}
            {addStepModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">Nova Etapa</h3>
                        <form onSubmit={handleAddStep} className="space-y-4">
                            <input placeholder="Nome da Etapa" value={newStepName} onChange={e => setNewStepName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="date" value={newStepStart} onChange={e => setNewStepStart(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                                <input type="date" value={newStepEnd} onChange={e => setNewStepEnd(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setAddStepModal(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Adicionar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD MATERIAL MODAL */}
            {addMatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">Novo Material</h3>
                        <form onSubmit={handleAddMaterial} className="space-y-4">
                            <input placeholder="Nome do Material" value={newMatName} onChange={e => setNewMatName(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" placeholder="Qtd" value={newMatQty} onChange={e => setNewMatQty(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                                <input placeholder="Unidade (un, m2)" value={newMatUnit} onChange={e => setNewMatUnit(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            </div>
                            <select value={newMatStepId} onChange={e => setNewMatStepId(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <option value="">Sem etapa definida</option>
                                {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            
                            <div className="border-t pt-4 mt-2">
                                <label className="flex items-center gap-2 mb-2 font-bold text-sm">
                                    <input type="checkbox" checked={newMatBuyNow} onChange={e => setNewMatBuyNow(e.target.checked)} className="w-4 h-4" />
                                    Já comprei este material
                                </label>
                                {newMatBuyNow && (
                                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-2">
                                        <input type="number" placeholder="Qtd Comprada" value={newMatBuyQty} onChange={e => setNewMatBuyQty(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
                                        <input type="number" placeholder="Valor Total (R$)" value={newMatBuyCost} onChange={e => setNewMatBuyCost(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={() => setAddMatModal(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MATERIAL MODAL */}
            {materialModal.isOpen && materialModal.material && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-1 text-primary dark:text-white">{materialModal.material.name}</h3>
                        <p className="text-xs text-slate-500 mb-4 uppercase font-bold">Atualizar Estoque</p>
                        <form onSubmit={handleUpdateMaterial} className="space-y-4">
                            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                <span className="text-sm font-bold">Planejado:</span>
                                <span className="font-mono font-bold">{materialModal.material.plannedQty} {materialModal.material.unit}</span>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-900 flex justify-between items-center">
                                <span className="text-sm font-bold text-green-700 dark:text-green-400">Já Comprado:</span>
                                <span className="font-mono font-bold text-green-700 dark:text-green-400">{materialModal.material.purchasedQty} {materialModal.material.unit}</span>
                            </div>
                            
                            <div className="pt-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nova Compra</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" placeholder="Qtd" value={matBuyQty} onChange={e => setMatBuyQty(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
                                    <input type="number" placeholder="Valor (R$)" value={matBuyCost} onChange={e => setMatBuyCost(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={() => setMaterialModal({isOpen: false, material: null})} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Registrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD EXPENSE MODAL */}
            {addExpenseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">Novo Gasto</h3>
                        <form onSubmit={handleAddExpense} className="space-y-4">
                            <input placeholder="Descrição (ex: Pagamento Pedreiro)" value={expDesc} onChange={e => setExpDesc(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                <input type="number" placeholder="Valor Pago" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" required />
                            </div>
                            
                            <input 
                                type="number" 
                                placeholder="Valor Total Combinado (Opcional)" 
                                value={expTotalAgreed} 
                                onChange={e => setExpTotalAgreed(e.target.value)} 
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" 
                            />

                            <div className="grid grid-cols-2 gap-2">
                                <select value={expCategory} onChange={e => setExpCategory(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <option value={ExpenseCategory.LABOR}>Mão de Obra</option>
                                    <option value={ExpenseCategory.MATERIAL}>Material</option>
                                    <option value={ExpenseCategory.PERMITS}>Taxas</option>
                                    <option value={ExpenseCategory.OTHER}>Outros</option>
                                </select>
                                <select value={expStepId} onChange={e => setExpStepId(e.target.value)} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <option value="">Geral</option>
                                    {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <button type="button" onClick={() => setAddExpenseModal(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* TEAM & SUPPLIER FORM MODAL */}
            {isPersonModalOpen && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex items-center gap-3 mb-4">
                             <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${personMode === 'WORKER' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                 <i className={`fa-solid ${personMode === 'WORKER' ? 'fa-helmet-safety' : 'fa-truck'}`}></i>
                             </div>
                             <div>
                                 <h3 className="text-lg font-bold text-primary dark:text-white leading-tight">
                                     {personId ? 'Editar' : 'Adicionar'} {personMode === 'WORKER' ? 'Profissional' : 'Fornecedor'}
                                 </h3>
                             </div>
                        </div>
                        <form onSubmit={handleSavePerson} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</label>
                                <input required className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold" value={personName} onChange={e => setPersonName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{personMode === 'WORKER' ? 'Função' : 'Categoria'}</label>
                                <select required className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm" value={personRole} onChange={e => setPersonRole(e.target.value)}>
                                    {(personMode === 'WORKER' ? STANDARD_JOB_ROLES : STANDARD_SUPPLIER_CATEGORIES).map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Telefone / WhatsApp</label>
                                <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold" placeholder="51 99999-9999" value={personPhone} onChange={e => setPersonPhone(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observações</label>
                                <textarea className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold h-20 resize-none" placeholder="Detalhes opcionais..." value={personNotes} onChange={e => setPersonNotes(e.target.value)}></textarea>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsPersonModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 font-bold bg-primary text-white rounded-xl shadow-lg">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONTRACT VIEWER MODAL */}
            {viewContract && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-xl font-bold text-primary dark:text-white">{viewContract.title}</h3>
                            <button onClick={() => setViewContract(null)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {viewContract.content}
                            </pre>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => {navigator.clipboard.writeText(viewContract.content); alert("Copiado!"); setViewContract(null);}}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-primary dark:text-white font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                <i className="fa-regular fa-copy mr-2"></i> Copiar
                            </button>
                            <button 
                                onClick={() => {
                                    const blob = new Blob([viewContract.content], {type: "application/msword"});
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `${viewContract.title}.doc`;
                                    link.click();
                                }}
                                className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors"
                            >
                                <i className="fa-solid fa-download mr-2"></i> Baixar Word
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ZeModal 
                isOpen={zeModal.isOpen} 
                title={zeModal.title} 
                message={zeModal.message} 
                onConfirm={zeModal.onConfirm} 
                onCancel={() => setZeModal(prev => ({ ...prev, isOpen: false }))} 
            />
        </div>
    );
};

export default WorkDetail;
