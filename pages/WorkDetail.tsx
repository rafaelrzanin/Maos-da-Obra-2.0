import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { dbService } from '../services/db';
import { Work, Worker, Supplier, Material, Step, Expense, StepStatus, ExpenseCategory, ChecklistItem } from '../types';
import { ZeModal } from '../components/ZeModal';
import { FULL_MATERIAL_PACKAGES, STANDARD_CHECKLISTS, CONTRACT_TEMPLATES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards';
import { aiService } from '../services/ai';

// --- TYPES FOR VIEW STATE ---
type MainTab = 'SCHEDULE' | 'MATERIALS' | 'FINANCIAL' | 'MORE';
type SubView = 'NONE' | 'TEAM' | 'SUPPLIERS' | 'REPORTS' | 'PHOTOS' | 'FILES' | 'BONUS_IA' | 'CALCULATORS' | 'CONTRACTS' | 'CHECKLIST';

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    // --- CORE DATA STATE ---
    const [work, setWork] = useState<Work | null>(null);
    const [loading, setLoading] = useState(true);
    const [steps, setSteps] = useState<Step[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    
    // --- UI STATE ---
    const [activeTab, setActiveTab] = useState<MainTab>('SCHEDULE');
    const [subView, setSubView] = useState<SubView>('NONE');
    
    // --- MODALS STATE ---
    const [stepModal, setStepModal] = useState<{ isOpen: boolean, step: Step | null }>({ isOpen: false, step: null });
    const [materialModal, setMaterialModal] = useState<{ isOpen: boolean, material: Material | null }>({ isOpen: false, material: null });
    const [purchaseCost, setPurchaseCost] = useState('');
    const [purchaseQty, setPurchaseQty] = useState('');
    
    const [zeModal, setZeModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // --- AI CHAT STATE ---
    const [aiMessage, setAiMessage] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    // --- CHECKLIST STATE ---
    const [activeChecklist, setActiveChecklist] = useState<string | null>(null);

    // --- LOAD DATA ---
    const load = async () => {
        if (!id) return;
        const w = await dbService.getWorkById(id);
        setWork(w || null);
        
        if (w) {
            const [s, m, e, wk, sp] = await Promise.all([
                dbService.getSteps(w.id),
                dbService.getMaterials(w.id),
                dbService.getExpenses(w.id),
                dbService.getWorkers(w.userId),
                dbService.getSuppliers(w.userId)
            ]);
            
            // Ordenar etapas por data
            setSteps(s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
            setMaterials(m);
            setExpenses(e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setWorkers(wk);
            setSuppliers(sp);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, [id]);

    // --- SCHEDULE LOGIC (Tri-state & Edit) ---
    const handleStepClick = async (step: Step) => {
        // Toggle Logic: NOT_STARTED -> IN_PROGRESS -> COMPLETED -> NOT_STARTED
        let newStatus = StepStatus.NOT_STARTED;
        if (step.status === StepStatus.NOT_STARTED) newStatus = StepStatus.IN_PROGRESS;
        else if (step.status === StepStatus.IN_PROGRESS) newStatus = StepStatus.COMPLETED;
        else newStatus = StepStatus.NOT_STARTED;

        await dbService.updateStep({ ...step, status: newStatus });
        await load();
    };

    const handleEditStep = (step: Step, e: React.MouseEvent) => {
        e.stopPropagation();
        setStepModal({ isOpen: true, step });
    };

    const handleDeleteStep = (stepId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setZeModal({
            isOpen: true,
            title: "Excluir Etapa",
            message: "Tem certeza? Isso pode afetar o cronograma.",
            onConfirm: async () => {
                // In a real scenario, dbService.deleteStep(stepId);
                // For MVP, we filter locally then save (assuming dbService has update capabilities or we mock it)
                // Let's assume user accepts visual deletion for now or implement deleteStep in dbService if needed.
                // Since deleteStep isn't in the interface provided in prompt, I'll simulate a refresh
                alert("Funcionalidade de exclusão simulada."); 
                setZeModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const saveStepChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        if (stepModal.step) {
            await dbService.updateStep(stepModal.step);
            setStepModal({ isOpen: false, step: null });
            load();
        }
    };

    // --- MATERIAL LOGIC (Purchase Flow) ---
    const handleMaterialClick = (material: Material) => {
        setPurchaseQty('');
        setPurchaseCost('');
        setMaterialModal({ isOpen: true, material });
    };

    const submitPurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (materialModal.material) {
            const addedQty = Number(purchaseQty);
            const cost = Number(purchaseCost);
            
            if (addedQty <= 0) return;

            const updatedMaterial = {
                ...materialModal.material,
                purchasedQty: materialModal.material.purchasedQty + addedQty
            };

            await dbService.updateMaterial(updatedMaterial, cost, addedQty);
            setMaterialModal({ isOpen: false, material: null });
            load();
        }
    };

    // --- AI LOGIC ---
    const handleAiAsk = async () => {
        if (!aiMessage.trim()) return;
        setAiLoading(true);
        const response = await aiService.sendMessage(aiMessage);
        setAiResponse(response);
        setAiLoading(false);
        setAiMessage('');
    };

    // --- REPORTS LOGIC ---
    const exportXLS = () => {
        const wb = XLSX.utils.book_new();
        
        // Cronograma Sheet
        const wsSchedule = XLSX.utils.json_to_sheet(steps.map(s => ({ Etapa: s.name, Inicio: s.startDate, Fim: s.endDate, Status: s.status })));
        XLSX.utils.book_append_sheet(wb, wsSchedule, "Cronograma");
        
        // Materiais Sheet
        const wsMaterials = XLSX.utils.json_to_sheet(materials.map(m => ({ Material: m.name, Plan: m.plannedQty, Comprado: m.purchasedQty, Un: m.unit })));
        XLSX.utils.book_append_sheet(wb, wsMaterials, "Materiais");
        
        // Financeiro Sheet
        const wsFinancial = XLSX.utils.json_to_sheet(expenses.map(e => ({ Data: e.date, Descricao: e.description, Valor: e.amount, Categoria: e.category })));
        XLSX.utils.book_append_sheet(wb, wsFinancial, "Financeiro");

        XLSX.writeFile(wb, `${work?.name}_Relatorio_Geral.xlsx`);
    };

    const handlePrint = () => window.print();

    // --- RENDER HELPERS ---
    const getStatusColor = (status: StepStatus) => {
        if (status === StepStatus.COMPLETED) return 'bg-green-500 border-green-500 text-white';
        if (status === StepStatus.IN_PROGRESS) return 'bg-secondary border-secondary text-white';
        return 'bg-transparent border-slate-300 dark:border-slate-600';
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;
    if (!work) return null;

    // --- SUB-VIEWS (MORE TAB) ---
    if (subView !== 'NONE') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
                {/* Header Subview */}
                <div className="bg-white dark:bg-slate-900 sticky top-0 z-30 px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm">
                    <button onClick={() => setSubView('NONE')} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <h2 className="text-lg font-bold text-primary dark:text-white uppercase tracking-wide">
                        {subView === 'TEAM' && 'Minha Equipe'}
                        {subView === 'SUPPLIERS' && 'Fornecedores'}
                        {subView === 'REPORTS' && 'Relatórios'}
                        {subView === 'BONUS_IA' && 'Zé da Obra AI'}
                        {subView === 'CONTRACTS' && 'Modelos de Contrato'}
                        {subView === 'CHECKLIST' && 'Checklists Anti-Erro'}
                        {subView === 'CALCULATORS' && 'Calculadoras'}
                    </h2>
                </div>

                <div className="p-4 max-w-3xl mx-auto animate-in slide-in-from-right-10">
                    {/* TEAM LIST */}
                    {subView === 'TEAM' && (
                        <div className="space-y-3">
                            {workers.map(w => (
                                <div key={w.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
                                    <div>
                                        <h4 className="font-bold text-primary dark:text-white">{w.name}</h4>
                                        <p className="text-sm text-slate-500">{w.role}</p>
                                    </div>
                                    <a href={`https://wa.me/55${w.phone.replace(/\D/g, '')}`} target="_blank" className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                        <i className="fa-brands fa-whatsapp text-xl"></i>
                                    </a>
                                </div>
                            ))}
                            <button className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-bold hover:bg-slate-50 transition-colors">+ Adicionar Profissional</button>
                        </div>
                    )}

                    {/* AI CHAT */}
                    {subView === 'BONUS_IA' && (
                        <div className="flex flex-col h-[80vh]">
                            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-inner overflow-y-auto mb-4 border border-slate-200 dark:border-slate-800">
                                <div className="flex gap-4 mb-6">
                                    <img src={ZE_AVATAR} className="w-12 h-12 rounded-full border-2 border-slate-200" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}/>
                                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-b-xl text-sm">
                                        <p className="font-bold text-secondary mb-1">Zé da Obra</p>
                                        <p>Opa! Mestre de obras na área. Pode perguntar qualquer coisa sobre traço de concreto, elétrica, encanamento ou dúvidas gerais que eu te ajudo!</p>
                                    </div>
                                </div>
                                {aiResponse && (
                                    <div className="flex gap-4 mb-6 animate-in fade-in">
                                        <img src={ZE_AVATAR} className="w-12 h-12 rounded-full border-2 border-slate-200" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}/>
                                        <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-b-xl text-sm">
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
                                    placeholder="Ex: Qual o traço para contrapiso?" 
                                    className="flex-1 p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-secondary"
                                />
                                <button onClick={handleAiAsk} disabled={aiLoading} className="w-14 bg-secondary text-white rounded-xl flex items-center justify-center shadow-lg">
                                    {aiLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* REPORTS */}
                    {subView === 'REPORTS' && (
                        <div className="space-y-4">
                            <div onClick={handlePrint} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 cursor-pointer hover:border-secondary transition-colors group">
                                <div className="w-14 h-14 bg-red-100 text-red-600 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-file-pdf"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-primary dark:text-white">Relatório em PDF</h3>
                                    <p className="text-sm text-slate-500">Cronograma, Materiais e Financeiro prontos para impressão.</p>
                                </div>
                            </div>
                            <div onClick={exportXLS} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 cursor-pointer hover:border-secondary transition-colors group">
                                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                                    <i className="fa-solid fa-file-excel"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-primary dark:text-white">Exportar para Excel</h3>
                                    <p className="text-sm text-slate-500">Baixe a planilha completa para editar no computador.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONTRACTS */}
                    {subView === 'CONTRACTS' && (
                        <div className="space-y-4">
                            {CONTRACT_TEMPLATES.map(ct => (
                                <div key={ct.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-primary dark:text-white">{ct.title}</h4>
                                        <button 
                                            onClick={() => {navigator.clipboard.writeText(ct.contentTemplate); alert("Modelo copiado!");}}
                                            className="text-xs font-bold text-secondary bg-secondary/10 px-2 py-1 rounded hover:bg-secondary hover:text-white transition-colors"
                                        >
                                            Copiar Texto
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-3">{ct.description}</p>
                                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-[10px] font-mono text-slate-600 dark:text-slate-400 h-24 overflow-hidden relative">
                                        {ct.contentTemplate}
                                        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-50 dark:from-slate-800 to-transparent"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CHECKLISTS */}
                    {subView === 'CHECKLIST' && (
                        <div className="space-y-4">
                            {STANDARD_CHECKLISTS.map((cl, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <button 
                                        onClick={() => setActiveChecklist(activeChecklist === cl.category ? null : cl.category)}
                                        className="w-full p-4 flex justify-between items-center text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <span className="font-bold text-sm text-primary dark:text-white">{cl.category}</span>
                                        <i className={`fa-solid fa-chevron-down transition-transform ${activeChecklist === cl.category ? 'rotate-180' : ''}`}></i>
                                    </button>
                                    {activeChecklist === cl.category && (
                                        <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                            {cl.items.map((item, i) => (
                                                <label key={i} className="flex items-start gap-3 py-2 cursor-pointer">
                                                    <input type="checkbox" className="mt-1 rounded border-slate-300 text-secondary focus:ring-secondary" />
                                                    <span className="text-sm text-slate-600 dark:text-slate-300 leading-tight">{item}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- MAIN RENDER ---
    return (
        <div className="max-w-4xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans relative">
            
            {/* --- HEADER --- */}
            <div className="bg-white dark:bg-slate-900 px-6 pt-6 pb-2 sticky top-0 z-20 shadow-sm border-b border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-1">
                    <button onClick={() => navigate('/')} className="text-slate-400 hover:text-primary dark:hover:text-white">
                        <i className="fa-solid fa-arrow-left text-xl"></i>
                    </button>
                    <h1 className="text-lg font-black text-primary dark:text-white uppercase tracking-tight">{work.name}</h1>
                    <div className="w-6"></div> {/* Spacer */}
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 p-4 pb-32 overflow-y-auto">
                
                {/* 1. SCHEDULE TAB */}
                {activeTab === 'SCHEDULE' && (
                    <div className="space-y-4 animate-in fade-in">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white">Cronograma</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Etapas da Obra</p>
                            </div>
                            <button onClick={() => alert("Adicionar etapa em breve")} className="bg-primary text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center hover:scale-105 transition-transform"><i className="fa-solid fa-plus"></i></button>
                        </div>

                        {steps.map((step, idx) => {
                             const stepNum = String(idx + 1).padStart(2, '0');
                             const isDone = step.status === StepStatus.COMPLETED;
                             
                             return (
                                <div key={step.id} className={`group bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md relative overflow-hidden ${isDone ? 'border-green-200 dark:border-green-900/30' : 'border-slate-100 dark:border-slate-800'}`}>
                                    {/* Line Connector */}
                                    {idx < steps.length - 1 && <div className="absolute left-[29px] top-16 bottom-[-20px] w-0.5 bg-slate-100 dark:bg-slate-800 -z-10"></div>}
                                    
                                    <div className="flex items-center gap-4">
                                        {/* Status Circle (Tri-state) */}
                                        <button 
                                            onClick={() => handleStepClick(step)}
                                            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${getStatusColor(step.status)}`}
                                        >
                                            {isDone && <i className="fa-solid fa-check text-xs"></i>}
                                            {step.status === StepStatus.IN_PROGRESS && <div className="w-3 h-3 bg-white rounded-full"></div>}
                                        </button>

                                        {/* Content */}
                                        <div className="flex-1 cursor-pointer" onClick={(e) => handleEditStep(step, e)}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ETAPA {stepNum}</span>
                                                    <h3 className={`font-bold text-lg leading-tight ${isDone ? 'text-slate-400 line-through decoration-2 decoration-green-500/50' : 'text-primary dark:text-white'}`}>{step.name}</h3>
                                                </div>
                                                <button onClick={(e) => handleDeleteStep(step.id, e)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                            <div className="flex gap-4 mt-2">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                    <i className="fa-regular fa-calendar"></i> {new Date(step.startDate).toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">
                                                    <i className="fa-solid fa-flag-checkered"></i> {new Date(step.endDate).toLocaleDateString('pt-BR')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                )}

                {/* 2. MATERIALS TAB */}
                {activeTab === 'MATERIALS' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-end mb-2 px-2">
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white">Materiais</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Controle de Compras</p>
                            </div>
                            <button onClick={() => dbService.importMaterialPackage(work.id, 'ALL_PENDING').then(() => load())} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 w-10 h-10 rounded-xl flex items-center justify-center hover:bg-secondary hover:text-white transition-all">
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </button>
                        </div>

                        {/* Group by category logic same as steps order */}
                        {steps.map((step, idx) => {
                            // Find materials matching step name approx
                            const stepMaterials = materials.filter(m => {
                                const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                return normalize(m.category || '').includes(normalize(step.name)) || normalize(step.name).includes(normalize(m.category || ''));
                            });

                            if (stepMaterials.length === 0) return null;

                            return (
                                <div key={step.id}>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                                        <span className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-[10px]">{String(idx+1).padStart(2,'0')}</span>
                                        {step.name}
                                    </h3>
                                    <div className="space-y-3">
                                        {stepMaterials.map(mat => {
                                            const progress = Math.min(100, (mat.purchasedQty / mat.plannedQty) * 100);
                                            const isComplete = mat.purchasedQty >= mat.plannedQty;
                                            const isStarted = mat.purchasedQty > 0;
                                            
                                            let statusColor = isComplete ? 'bg-green-500' : isStarted ? 'bg-orange-500' : 'bg-slate-200';
                                            let borderColor = isComplete ? 'border-green-200 dark:border-green-900/30' : isStarted ? 'border-orange-200 dark:border-orange-900/30' : 'border-slate-100 dark:border-slate-800';

                                            return (
                                                <div 
                                                    key={mat.id} 
                                                    onClick={() => handleMaterialClick(mat)}
                                                    className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${borderColor}`}
                                                >
                                                    <div className="flex justify-between mb-2">
                                                        <span className="font-bold text-primary dark:text-white">{mat.name}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isComplete ? 'bg-green-100 text-green-700' : isStarted ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                                                            {isComplete ? 'OK' : isStarted ? 'Parcial' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div className={`h-full transition-all duration-500 ${statusColor}`} style={{ width: `${progress}%` }}></div>
                                                        </div>
                                                        <div className="text-xs font-mono font-bold text-slate-500">
                                                            {mat.purchasedQty}/{mat.plannedQty} {mat.unit}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {materials.length === 0 && (
                            <div className="text-center py-10 opacity-50">
                                <i className="fa-solid fa-box-open text-4xl mb-2 text-slate-300"></i>
                                <p className="text-sm">Nenhum material cadastrado.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. FINANCIAL TAB */}
                {activeTab === 'FINANCIAL' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="px-2">
                            <h2 className="text-2xl font-black text-primary dark:text-white">Financeiro</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Fluxo de Caixa</p>
                        </div>
                        
                        {/* Summary Card */}
                        <div className="bg-gradient-premium p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                            <p className="text-sm opacity-80 font-medium mb-1">Total Gasto</p>
                            <h3 className="text-4xl font-black mb-4 tracking-tight">
                                R$ {expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h3>
                            <div className="flex items-center gap-2 text-xs opacity-70 bg-white/10 w-fit px-3 py-1 rounded-full">
                                <i className="fa-solid fa-wallet"></i> Orçamento: R$ {work.budgetPlanned.toLocaleString('pt-BR')}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {expenses.map(exp => (
                                <div key={exp.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                            <i className="fa-solid fa-receipt"></i>
                                        </div>
                                        <div>
                                            <p className="font-bold text-primary dark:text-white text-sm">{exp.description}</p>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{new Date(exp.date).toLocaleDateString()} • {exp.category}</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-primary dark:text-white">- R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            ))}
                             {expenses.length === 0 && (
                                <div className="text-center py-10 opacity-50">
                                    <p className="text-sm">Nenhum gasto registrado ainda.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. MORE TAB (MENU) */}
                {activeTab === 'MORE' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="px-2">
                            <h2 className="text-2xl font-black text-primary dark:text-white">Mais Opções</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestão Completa</p>
                        </div>

                        {/* Grid Menu */}
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setSubView('TEAM')} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl"><i className="fa-solid fa-helmet-safety"></i></div>
                                <span className="font-bold text-sm text-primary dark:text-white">Equipe</span>
                            </button>
                            <button onClick={() => setSubView('SUPPLIERS')} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xl"><i className="fa-solid fa-truck-fast"></i></div>
                                <span className="font-bold text-sm text-primary dark:text-white">Fornecedores</span>
                            </button>
                            <button onClick={() => setSubView('REPORTS')} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl"><i className="fa-solid fa-file-pdf"></i></div>
                                <span className="font-bold text-sm text-primary dark:text-white">Relatórios</span>
                            </button>
                            <button onClick={() => setSubView('CHECKLIST')} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl"><i className="fa-solid fa-list-check"></i></div>
                                <span className="font-bold text-sm text-primary dark:text-white">Checklists</span>
                            </button>
                            <button onClick={() => setSubView('CONTRACTS')} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xl"><i className="fa-solid fa-file-signature"></i></div>
                                <span className="font-bold text-sm text-primary dark:text-white">Contratos</span>
                            </button>
                             <button onClick={() => setSubView('PHOTOS')} className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-secondary transition-all flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl"><i className="fa-solid fa-camera"></i></div>
                                <span className="font-bold text-sm text-primary dark:text-white">Fotos</span>
                            </button>
                        </div>

                        {/* Zé AI Promo */}
                        <div onClick={() => setSubView('BONUS_IA')} className="bg-gradient-to-r from-secondary to-amber-600 rounded-2xl p-6 text-white shadow-lg cursor-pointer transform transition-transform active:scale-95 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform"></div>
                             <div className="flex items-center gap-4 relative z-10">
                                 <img src={ZE_AVATAR} className="w-16 h-16 rounded-full border-2 border-white bg-slate-800" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}/>
                                 <div className="flex-1">
                                     <h3 className="text-lg font-black uppercase italic">Zé da Obra AI</h3>
                                     <p className="text-xs opacity-90 leading-tight mb-2">Seu assistente virtual 24h. Tire dúvidas sobre traço, elétrica e mais.</p>
                                     <span className="bg-white text-secondary text-[10px] font-bold px-2 py-1 rounded shadow-sm">
                                         Acessar Agora
                                     </span>
                                 </div>
                             </div>
                        </div>

                        {/* Calculators Link */}
                         <button onClick={() => alert("Calculadoras em breve!")} className="w-full bg-slate-800 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg">
                            <span className="font-bold flex items-center gap-3"><i className="fa-solid fa-calculator text-secondary"></i> Calculadoras de Material</span>
                            <i className="fa-solid fa-chevron-right text-slate-500"></i>
                        </button>
                    </div>
                )}
            </div>

            {/* --- BOTTOM NAVIGATION BAR (FIXED) --- */}
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

            {/* --- MODALS --- */}

            {/* Step Edit Modal */}
            {stepModal.isOpen && stepModal.step && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-4 text-primary dark:text-white">Editar Etapa</h3>
                        <form onSubmit={saveStepChanges} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Nome da Etapa</label>
                                <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" value={stepModal.step.name} onChange={e => setStepModal({...stepModal, step: {...stepModal.step!, name: e.target.value}})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Início</label>
                                    <input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" value={stepModal.step.startDate} onChange={e => setStepModal({...stepModal, step: {...stepModal.step!, startDate: e.target.value}})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Fim</label>
                                    <input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" value={stepModal.step.endDate} onChange={e => setStepModal({...stepModal, step: {...stepModal.step!, endDate: e.target.value}})} />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setStepModal({isOpen: false, step: null})} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 font-bold bg-primary text-white rounded-xl shadow-lg">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Material Purchase Modal */}
            {materialModal.isOpen && materialModal.material && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                         <div className="flex items-center gap-3 mb-4">
                             <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center text-xl"><i className="fa-solid fa-cart-plus"></i></div>
                             <div>
                                 <h3 className="text-lg font-bold text-primary dark:text-white leading-tight">Lançar Compra</h3>
                                 <p className="text-xs text-slate-500">{materialModal.material.name}</p>
                             </div>
                         </div>
                         <form onSubmit={submitPurchase} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Quantidade Comprada (+)</label>
                                <div className="flex items-center gap-2">
                                    <input type="number" autoFocus className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-lg font-bold" value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} placeholder="0" />
                                    <span className="font-bold text-slate-400">{materialModal.material.unit}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Valor Total Gasto (R$)</label>
                                <input type="number" step="0.01" className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-lg font-bold" value={purchaseCost} onChange={e => setPurchaseCost(e.target.value)} placeholder="0,00" />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setMaterialModal({isOpen: false, material: null})} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 font-bold bg-green-600 text-white rounded-xl shadow-lg">Confirmar</button>
                            </div>
                        </form>
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
