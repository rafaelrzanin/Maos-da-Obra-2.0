import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Worker, Supplier, Material, Step, Expense, StepStatus } from '../types';
import { ZeModal } from '../components/ZeModal';
import { FULL_MATERIAL_PACKAGES } from '../services/standards';

// Tabs Enum
type TabType = 'SCHEDULE' | 'STEPS' | 'MATERIALS' | 'FINANCIAL';

const SectionHeader: React.FC<{ title: string; subtitle: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
    <div className="mb-6 flex justify-between items-end">
        <div>
            <h2 className="text-xl font-bold text-primary dark:text-white">{title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        {action}
    </div>
);

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    // Core State
    const [work, setWork] = useState<Work | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('SCHEDULE');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    // Data State
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [jobRoles, setJobRoles] = useState<string[]>([]);
    const [supplierCategories, setSupplierCategories] = useState<string[]>([]);
    
    // --- UI Modals State ---
    
    // Materials
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [editCost, setEditCost] = useState('');
    const [qtyToAdd, setQtyToAdd] = useState('');

    // Team/Supplier
    const [isTeamOpen, setIsTeamOpen] = useState(false);
    const [isSupplierOpen, setIsSupplierOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // Forms
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newNotes, setNewNotes] = useState('');

    // Generic Modal
    const [zeModal, setZeModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const load = async () => {
        if (!id) return;
        const w = await dbService.getWorkById(id);
        setWork(w || null);
        
        if (w) {
            const [wk, sp, roles, cats, mats, stps, exps] = await Promise.all([
                dbService.getWorkers(w.userId),
                dbService.getSuppliers(w.userId),
                dbService.getJobRoles(),
                dbService.getSupplierCategories(),
                dbService.getMaterials(w.id),
                dbService.getSteps(w.id),
                dbService.getExpenses(w.id)
            ]);
            setWorkers(wk);
            setSuppliers(sp);
            setJobRoles(roles);
            setSupplierCategories(cats);
            setMaterials(mats);
            setSteps(stps.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
            setExpenses(exps);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, [id]);

    const onBack = () => navigate('/');

    // --- MATERIALS LOGIC ---
    const handleImport = async (category: string) => { 
        if (!work) return;
        const count = await dbService.importMaterialPackage(work.id, category); 
        alert(count > 0 ? `${count} materiais adicionados!` : 'Nenhum material novo encontrado para as etapas pendentes.'); 
        setIsImportOpen(false); 
        await load(); 
    };
    
    const handleUpdateMaterial = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if(editingMaterial) { 
            const addedQty = Number(qtyToAdd) || 0;
            const newTotalPurchased = editingMaterial.purchasedQty + addedQty;
            const updatedMaterial = { ...editingMaterial, purchasedQty: newTotalPurchased };
            await dbService.updateMaterial(updatedMaterial, Number(editCost), addedQty); 
            
            setEditingMaterial(null); 
            setEditCost(''); 
            setQtyToAdd('');
            await load(); 
        } 
    };

    const groupedMaterials = materials.reduce((acc, m) => {
        const cat = m.category || 'Geral';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(m);
        return acc;
    }, {} as Record<string, Material[]>);

    // --- STEPS LOGIC ---
    const toggleStep = async (step: Step) => {
        const newStatus = step.status === StepStatus.COMPLETED ? StepStatus.NOT_STARTED : StepStatus.COMPLETED;
        await dbService.updateStep({ ...step, status: newStatus });
        await load();
    };

    // --- TEAM/SUPPLIER GENERIC HANDLER ---
    const handleSaveEntity = async (type: 'TEAM' | 'SUPPLIER') => {
        if (!work) return;
        try {
            const common = { userId: work.userId, name: newName, phone: newPhone, notes: newNotes };
            if (type === 'TEAM') {
                const payload = { ...common, role: newRole };
                if (editingId) await dbService.updateWorker({ ...payload, id: editingId });
                else await dbService.addWorker(payload);
            } else {
                const payload = { ...common, category: newRole, email: '', address: '' };
                if (editingId) await dbService.updateSupplier({ ...payload, id: editingId } as Supplier);
                else await dbService.addSupplier(payload);
            }
            setIsTeamOpen(false);
            setIsSupplierOpen(false);
            setEditingId(null);
            setNewName(''); setNewRole(''); setNewPhone(''); setNewNotes('');
            await load();
        } catch (error) { console.error(error); alert("Erro ao salvar."); }
    };

    const openEditEntity = (item: any, type: 'TEAM' | 'SUPPLIER') => {
        setEditingId(item.id);
        setNewName(item.name);
        setNewPhone(item.phone);
        setNewNotes(item.notes || '');
        setNewRole(type === 'TEAM' ? item.role : item.category);
        if (type === 'TEAM') setIsTeamOpen(true);
        else setIsSupplierOpen(true);
        setIsMenuOpen(false);
    };

    const deleteEntity = (id: string, type: 'TEAM' | 'SUPPLIER') => {
        setZeModal({
            isOpen: true,
            title: "Excluir Registro",
            message: "Tem certeza? Não poderá desfazer.",
            onConfirm: async () => {
                if (type === 'TEAM') await dbService.deleteWorker(id);
                else await dbService.deleteSupplier(id);
                await load();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    if (loading) return <div className="flex justify-center items-center h-screen text-primary"><i className="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>;
    if (!work) return <div className="p-8 text-center text-slate-500">Obra não encontrada</div>;

    // --- RENDER CONTENT BASED ON TAB ---
    const renderContent = () => {
        switch (activeTab) {
            case 'SCHEDULE':
                return (
                    <div className="space-y-6 pb-20 animate-in fade-in">
                        <SectionHeader title="Cronograma" subtitle="Linha do tempo da sua obra." />
                        {steps.length === 0 ? (
                            <div className="text-center py-10 opacity-50">
                                <i className="fa-solid fa-calendar-xmark text-4xl mb-2"></i>
                                <p>Nenhuma etapa cadastrada.</p>
                            </div>
                        ) : (
                            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-8">
                                {steps.map((step) => {
                                    const isDone = step.status === StepStatus.COMPLETED;
                                    const date = new Date(step.startDate);
                                    const month = date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
                                    const day = date.getDate();
                                    return (
                                        <div key={step.id} className="relative pl-8">
                                            {/* Dot */}
                                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${isDone ? 'bg-green-500 border-green-500' : 'bg-white dark:bg-slate-900 border-slate-300'}`}></div>
                                            
                                            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="text-xs font-bold text-secondary">{day} {month}</span>
                                                        <h4 className={`text-lg font-bold ${isDone ? 'text-slate-400 line-through' : 'text-primary dark:text-white'}`}>{step.name}</h4>
                                                    </div>
                                                    {isDone && <i className="fa-solid fa-check text-green-500"></i>}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">Previsão: {new Date(step.endDate).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                );
            case 'STEPS':
                return (
                    <div className="space-y-4 pb-20 animate-in fade-in">
                        <SectionHeader title="Etapas" subtitle="Marque o que já foi concluído." />
                        {steps.map(step => (
                            <div key={step.id} onClick={() => toggleStep(step)} className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer transition-all active:scale-[0.98] ${step.status === StepStatus.COMPLETED ? 'bg-green-50 dark:bg-green-900/10 border-green-200' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${step.status === StepStatus.COMPLETED ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>
                                    {step.status === StepStatus.COMPLETED && <i className="fa-solid fa-check text-xs"></i>}
                                </div>
                                <div className="flex-1">
                                    <h4 className={`font-bold ${step.status === StepStatus.COMPLETED ? 'text-green-800 dark:text-green-200' : 'text-primary dark:text-white'}`}>{step.name}</h4>
                                </div>
                            </div>
                        ))}
                         {steps.length === 0 && <p className="text-center text-slate-400 mt-10">Sem etapas definidas.</p>}
                    </div>
                );
            case 'MATERIALS':
                return (
                    <div className="pb-20 animate-in fade-in">
                        <SectionHeader 
                            title="Materiais" 
                            subtitle="Controle de estoque." 
                            action={
                                <button onClick={() => setIsImportOpen(true)} className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-primary/20">
                                    <i className="fa-solid fa-cloud-arrow-down mr-2"></i> Importar
                                </button>
                            }
                        />
                        {Object.keys(groupedMaterials).sort().map(cat => (
                            <div key={cat} className="mb-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">{cat}</h3>
                                <div className="space-y-3">
                                    {groupedMaterials[cat].map(m => {
                                        const progress = Math.min(100, (m.purchasedQty / m.plannedQty) * 100);
                                        const isDone = m.purchasedQty >= m.plannedQty;
                                        return (
                                            <div key={m.id} onClick={() => { setQtyToAdd(''); setEditCost(''); setEditingMaterial(m); }} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary/50 transition-all cursor-pointer">
                                                <div className="flex justify-between mb-2">
                                                    <span className="font-bold text-primary dark:text-white">{m.name}</span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isDone ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{isDone ? 'OK' : 'Pendente'}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div className={`h-full ${isDone ? 'bg-green-500' : 'bg-secondary'}`} style={{ width: `${progress}%` }}></div>
                                                    </div>
                                                    <span className="text-xs font-mono text-slate-500">{m.purchasedQty}/{m.plannedQty} {m.unit}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                        {materials.length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-slate-400">Nenhum material. Importe uma lista.</p>
                            </div>
                        )}
                    </div>
                );
            case 'FINANCIAL':
                const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
                return (
                    <div className="pb-20 animate-in fade-in">
                        <SectionHeader title="Financeiro" subtitle="Gastos realizados." />
                        
                        <div className="bg-gradient-premium p-6 rounded-3xl text-white mb-8 shadow-xl">
                            <p className="text-sm opacity-80 mb-1">Total Gasto</p>
                            <h2 className="text-4xl font-black mb-4">R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                                <div className="h-full bg-secondary" style={{ width: `${Math.min(100, (totalSpent / work.budgetPlanned) * 100)}%` }}></div>
                            </div>
                            <p className="text-xs text-right opacity-70">Orçamento: R$ {work.budgetPlanned.toLocaleString('pt-BR')}</p>
                        </div>

                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 pl-1">Histórico</h3>
                        <div className="space-y-3">
                            {expenses.map(exp => (
                                <div key={exp.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                            <i className="fa-solid fa-receipt"></i>
                                        </div>
                                        <div>
                                            <p className="font-bold text-primary dark:text-white text-sm">{exp.description}</p>
                                            <p className="text-xs text-slate-400">{new Date(exp.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className="font-bold text-primary dark:text-white">- R$ {Number(exp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            ))}
                            {expenses.length === 0 && <p className="text-center text-slate-400 mt-4">Nenhum gasto registrado.</p>}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-6 px-4 h-full flex flex-col relative min-h-screen">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-500 hover:text-primary flex items-center gap-2 w-fit">
                <i className="fa-solid fa-arrow-left"></i> Voltar
            </button>

            <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-6">{work.name}</h1>

            {/* CONTENT AREA */}
            <div className="flex-1">
                {renderContent()}
            </div>

            {/* BOTTOM NAV BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-2 z-40 md:pl-72 safe-area-bottom">
                <div className="flex justify-around items-center max-w-3xl mx-auto">
                    <button onClick={() => setActiveTab('SCHEDULE')} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-16 transition-all ${activeTab === 'SCHEDULE' ? 'text-primary dark:text-white' : 'text-slate-400'}`}>
                        <i className={`fa-solid fa-calendar-days text-xl ${activeTab === 'SCHEDULE' ? 'scale-110' : ''}`}></i>
                        <span className="text-[9px] font-bold uppercase">Cronog.</span>
                    </button>
                    <button onClick={() => setActiveTab('STEPS')} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-16 transition-all ${activeTab === 'STEPS' ? 'text-primary dark:text-white' : 'text-slate-400'}`}>
                        <i className={`fa-solid fa-list-check text-xl ${activeTab === 'STEPS' ? 'scale-110' : ''}`}></i>
                        <span className="text-[9px] font-bold uppercase">Etapas</span>
                    </button>
                    
                    {/* CENTER MENU BUTTON (FAB) */}
                    <div className="relative -top-6">
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="w-14 h-14 rounded-full bg-secondary text-white shadow-xl shadow-secondary/40 flex items-center justify-center transform transition-transform active:scale-95"
                        >
                            <div className="flex flex-col gap-1 items-center justify-center">
                                <div className="w-5 h-0.5 bg-white rounded-full"></div>
                                <div className="w-5 h-0.5 bg-white rounded-full relative">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-white rounded-full"></div>
                                </div>
                                <div className="w-5 h-0.5 bg-white rounded-full"></div>
                            </div>
                        </button>
                        
                        {/* MENU POPUP */}
                        {isMenuOpen && (
                            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 animate-in slide-in-from-bottom-5 zoom-in-95">
                                <button onClick={() => { setIsTeamOpen(true); setIsMenuOpen(false); }} className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-600 dark:text-slate-300 font-bold text-sm">
                                    <i className="fa-solid fa-helmet-safety text-secondary"></i> Minha Equipe
                                </button>
                                <button onClick={() => { setIsSupplierOpen(true); setIsMenuOpen(false); }} className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 text-slate-600 dark:text-slate-300 font-bold text-sm">
                                    <i className="fa-solid fa-truck text-secondary"></i> Fornecedores
                                </button>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
                                <button onClick={() => setIsMenuOpen(false)} className="w-full text-center p-2 text-xs font-bold text-slate-400">Fechar</button>
                            </div>
                        )}
                        
                        {/* OVERLAY for Menu */}
                        {isMenuOpen && <div className="fixed inset-0 bg-black/20 z-[-1]" onClick={() => setIsMenuOpen(false)}></div>}
                    </div>

                    <button onClick={() => setActiveTab('MATERIALS')} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-16 transition-all ${activeTab === 'MATERIALS' ? 'text-primary dark:text-white' : 'text-slate-400'}`}>
                        <i className={`fa-solid fa-layer-group text-xl ${activeTab === 'MATERIALS' ? 'scale-110' : ''}`}></i>
                        <span className="text-[9px] font-bold uppercase">Materiais</span>
                    </button>
                    <button onClick={() => setActiveTab('FINANCIAL')} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-16 transition-all ${activeTab === 'FINANCIAL' ? 'text-primary dark:text-white' : 'text-slate-400'}`}>
                        <i className={`fa-solid fa-chart-pie text-xl ${activeTab === 'FINANCIAL' ? 'scale-110' : ''}`}></i>
                        <span className="text-[9px] font-bold uppercase">Financ.</span>
                    </button>
                </div>
            </div>

            {/* --- MODALS --- */}

            {/* IMPORT MODAL */}
            {isImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-primary dark:text-white">Importar Lista</h3>
                            <button onClick={() => setIsImportOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        
                        <div className="mb-6 p-4 bg-gradient-premium rounded-2xl text-white shadow-lg relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => handleImport('ALL_PENDING')}>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary border border-secondary/30 text-xl">
                                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm">Geração Inteligente</h4>
                                    <p className="text-[10px] text-slate-300 opacity-90 leading-tight mt-1">Calcular materiais apenas para as <strong className="text-white">etapas pendentes</strong> com base na área da obra.</p>
                                </div>
                                <i className="fa-solid fa-chevron-right text-white/50"></i>
                            </div>
                        </div>
                        <p className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">Ou importe por categoria</p>
                        <div className="space-y-3">
                            {FULL_MATERIAL_PACKAGES.map((pkg, idx) => (
                                <button key={idx} onClick={() => handleImport(pkg.category)} className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all flex items-center justify-between group">
                                    <span className="font-bold text-primary dark:text-white text-sm">{pkg.category}</span>
                                    <span className="text-xs text-slate-400 group-hover:text-primary dark:group-hover:text-white transition-colors">{pkg.items.length} itens</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MATERIAL EDIT MODAL */}
            {editingMaterial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-primary dark:text-white max-w-[80%] truncate">{editingMaterial.name}</h3>
                            <button onClick={() => setEditingMaterial(null)} className="text-slate-400 hover:text-primary"><i className="fa-solid fa-xmark text-xl"></i></button>
                        </div>
                        <form onSubmit={handleUpdateMaterial}>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qtd Comprada Agora</label>
                                <div className="flex items-center gap-2">
                                    <input autoFocus type="number" step="0.1" value={qtyToAdd} onChange={e => setQtyToAdd(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-lg font-bold" />
                                    <span className="text-sm font-bold text-slate-400">{editingMaterial.unit}</span>
                                </div>
                            </div>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Gasto (R$)</label>
                                <input type="number" step="0.01" value={editCost} onChange={e => setEditCost(e.target.value)} placeholder="0,00" className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-lg font-bold" />
                            </div>
                            <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl">Salvar Compra</button>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD TEAM/SUPPLIER MODAL - SHARED UI */}
            {(isTeamOpen || isSupplierOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-primary dark:text-white">
                                {editingId ? 'Editar' : 'Adicionar'} {isTeamOpen ? 'Profissional' : 'Fornecedor'}
                            </h3>
                            <button onClick={() => { setIsTeamOpen(false); setIsSupplierOpen(false); setEditingId(null); }} className="text-slate-400 hover:text-primary"><i className="fa-solid fa-xmark text-xl"></i></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSaveEntity(isTeamOpen ? 'TEAM' : 'SUPPLIER'); }} className="space-y-4">
                            <input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" required />
                            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" required>
                                <option value="">Selecione a Função</option>
                                {(isTeamOpen ? jobRoles : supplierCategories).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <input placeholder="Telefone / WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                            <textarea placeholder="Observações" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-24 resize-none" />
                            <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl">Salvar</button>
                        </form>
                        
                        {/* List Existing Items inside Modal for better management in small screens if desired, or just show list elsewhere. 
                            For this design, let's keep list in another tab? No, user wants Team/Supplier in + menu.
                            Let's add a small list below the form or just a view button. 
                            Actually, let's render the list of existing items BELOW the form in this modal for quick access.
                        */}
                        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
                             <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Cadastrados</h4>
                             <div className="max-h-40 overflow-y-auto space-y-2">
                                 {(isTeamOpen ? workers : suppliers).map(item => (
                                     <div key={item.id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
                                         <span className="font-bold text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{item.name}</span>
                                         <div className="flex gap-2">
                                             <button type="button" onClick={() => openEditEntity(item, isTeamOpen ? 'TEAM' : 'SUPPLIER')} className="text-primary"><i className="fa-solid fa-pencil"></i></button>
                                             <button type="button" onClick={() => deleteEntity(item.id, isTeamOpen ? 'TEAM' : 'SUPPLIER')} className="text-red-500"><i className="fa-solid fa-trash"></i></button>
                                         </div>
                                     </div>
                                 ))}
                                 {(isTeamOpen ? workers : suppliers).length === 0 && <p className="text-xs text-slate-400 italic">Nenhum registro ainda.</p>}
                             </div>
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
