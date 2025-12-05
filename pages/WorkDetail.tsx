
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Material, Expense, StepStatus } from '../types';
import { FULL_MATERIAL_PACKAGES } from '../services/standards';

// --- HELPER COMPONENTS ---

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div>
    <h2 className="text-xl font-bold text-primary dark:text-white">{title}</h2>
    <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
  </div>
);

// --- TABS ---

const StepsTab: React.FC<{ workId: string; onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [steps, setSteps] = useState<Step[]>([]);
    
    useEffect(() => {
        dbService.getSteps(workId).then(setSteps);
    }, [workId]);

    const handleStatusChange = async (step: Step, newStatus: StepStatus) => {
        await dbService.updateStep({ ...step, status: newStatus });
        onUpdate();
        const updated = await dbService.getSteps(workId);
        setSteps(updated);
    };

    return (
        <div className="animate-in fade-in duration-500 pb-20">
             <div className="flex items-center justify-between mb-8">
                 <SectionHeader title="Cronograma" subtitle="Acompanhe as etapas da obra." />
                 <button onClick={() => {}} className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all opacity-50 cursor-not-allowed" title="Em breve"><i className="fa-solid fa-plus text-lg"></i></button>
             </div>
             <div className="space-y-3">
                {steps.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).map(step => {
                    const isDelayed = step.status !== StepStatus.COMPLETED && new Date(step.endDate) < new Date();
                    return (
                        <div key={step.id} className={`p-5 bg-white dark:bg-slate-900 rounded-2xl border transition-all hover:shadow-md ${isDelayed ? 'border-red-200 dark:border-red-900/30' : 'border-slate-100 dark:border-slate-800'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="font-bold text-primary dark:text-white mb-1">{step.name}</h4>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${isDelayed ? 'text-red-500' : 'text-slate-400'}`}>
                                        {new Date(step.startDate).toLocaleDateString()} - {new Date(step.endDate).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1">
                                     {step.status === StepStatus.COMPLETED ? (
                                         <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                             <i className="fa-solid fa-check"></i> Concluído
                                         </span>
                                     ) : (
                                         <button 
                                            onClick={() => handleStatusChange(step, StepStatus.COMPLETED)}
                                            className="bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-green-100 hover:text-green-700 text-xs font-bold px-3 py-1 rounded-full transition-colors"
                                         >
                                             Marcar Concluído
                                         </button>
                                     )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {steps.length === 0 && <p className="text-slate-500 text-center py-8">Nenhuma etapa cadastrada.</p>}
             </div>
        </div>
    );
};

const ExpensesTab: React.FC<{ workId: string; onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    
    useEffect(() => {
        dbService.getExpenses(workId).then(setExpenses);
    }, [workId]);

    const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="animate-in fade-in duration-500 pb-20">
             <div className="flex items-center justify-between mb-8">
                 <SectionHeader title="Financeiro" subtitle={`Total Gasto: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} />
                 <button className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all opacity-50 cursor-not-allowed" title="Em breve"><i className="fa-solid fa-plus text-lg"></i></button>
             </div>
             <div className="space-y-2">
                {expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
                    <div key={e.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary/30 transition-colors">
                        <div>
                            <p className="font-bold text-primary dark:text-white">{e.description}</p>
                            <p className="text-xs text-slate-400">{e.category} • {new Date(e.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                             <p className="font-bold text-primary dark:text-white">R$ {e.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                    </div>
                ))}
                 {expenses.length === 0 && <p className="text-slate-500 text-center py-8">Nenhum gasto registrado.</p>}
             </div>
        </div>
    );
};

const MaterialsTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [steps, setSteps] = useState<Step[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [editCost, setEditCost] = useState<string>('');
    const [qtyToAdd, setQtyToAdd] = useState<string>('');
    const [newMaterial, setNewMaterial] = useState({ name: '', plannedQty: '', unit: 'un', category: 'Geral' });
    const [groupedMaterials, setGroupedMaterials] = useState<Record<string, Material[]>>({});

    const load = async () => {
        const [matData, stepData] = await Promise.all([
            dbService.getMaterials(workId),
            dbService.getSteps(workId)
        ]);
        setSteps(stepData);
        const grouped: Record<string, Material[]> = {};
        matData.forEach(m => {
            const cat = m.category || 'Geral';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(m);
        });
        setGroupedMaterials(grouped);
    };

    useEffect(() => { load(); }, [workId]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        await dbService.addMaterial({ workId, name: newMaterial.name, plannedQty: Number(newMaterial.plannedQty), purchasedQty: 0, unit: newMaterial.unit, category: newMaterial.category });
        setIsCreateOpen(false); await load(); onUpdate();
    };
    
    const handleImport = async (category: string) => { 
        const count = await dbService.importMaterialPackage(workId, category); 
        alert(`${count} materiais adicionados.`); 
        setIsImportOpen(false); 
        await load(); 
        onUpdate(); 
    };
    
    const handleUpdate = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if(editingMaterial) { 
            const addedQty = Number(qtyToAdd) || 0;
            const newTotalPurchased = editingMaterial.purchasedQty + addedQty;
            const updatedMaterial = {
                ...editingMaterial,
                purchasedQty: newTotalPurchased
            };
            await dbService.updateMaterial(updatedMaterial, Number(editCost), addedQty); 
            setEditingMaterial(null); 
            setEditCost(''); 
            setQtyToAdd('');
            await load(); 
            onUpdate(); 
        } 
    }
    
    const sortedCategories = Object.keys(groupedMaterials).sort();

    return (
        <div className="animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between mb-8">
                <SectionHeader title="Materiais" subtitle="Controle de compras e estoque." />
                <div className="flex gap-2">
                    <button onClick={() => setIsImportOpen(true)} className="bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-secondary w-12 h-12 rounded-2xl flex items-center justify-center transition-all"><i className="fa-solid fa-cloud-arrow-down text-lg"></i></button>
                    <button onClick={() => setIsCreateOpen(true)} className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all"><i className="fa-solid fa-plus text-lg"></i></button>
                </div>
            </div>
            {sortedCategories.map(cat => (
                <div key={cat} className="mb-8 last:mb-0">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fa-solid fa-layer-group text-secondary"></i> {cat}</h3>
                    <div className="space-y-3">
                        {groupedMaterials[cat].map(m => {
                            const isCompleted = m.purchasedQty >= m.plannedQty;
                            const isPartial = m.purchasedQty > 0 && m.purchasedQty < m.plannedQty;
                            
                            let statusLabel = 'Pendente';
                            let statusColor = 'bg-slate-100 text-slate-500';
                            let progressColor = 'bg-secondary';
                            let cardBorder = 'border-slate-100 dark:border-slate-800';

                            if (isCompleted) {
                                statusLabel = 'Comprado';
                                statusColor = 'bg-green-100 text-green-700';
                                progressColor = 'bg-success';
                                cardBorder = 'border-green-200 dark:border-green-900/30 opacity-60';
                            } else if (isPartial) {
                                statusLabel = 'Parcial';
                                statusColor = 'bg-orange-100 text-orange-700';
                                progressColor = 'bg-orange-500';
                                cardBorder = 'border-orange-200 dark:border-orange-900/30 shadow-md';
                            }

                            return (
                                <div key={m.id} onClick={() => { setQtyToAdd(''); setEditCost(''); setEditingMaterial(m); }} className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 cursor-pointer transition-all hover:border-secondary/50 hover:shadow-md ${cardBorder}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-primary dark:text-white">{m.name}</h4>
                                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${statusColor}`}>{statusLabel}</div>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{width: `${Math.min(100, (m.purchasedQty / m.plannedQty) * 100)}%`}}></div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-slate-500 whitespace-nowrap">{m.purchasedQty} / {m.plannedQty} {m.unit}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            
            {isImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-primary dark:text-white">Importar Lista</h3>
                            <button onClick={() => setIsImportOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">Selecione um pacote padrão para adicionar itens rapidamente.</p>
                        <div className="space-y-3">
                            {FULL_MATERIAL_PACKAGES.map((pkg, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => handleImport(pkg.category)}
                                    className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all flex items-center justify-between group"
                                >
                                    <span className="font-bold text-primary dark:text-white">{pkg.category}</span>
                                    <span className="text-xs text-slate-400 group-hover:text-primary transition-colors">{pkg.items.length} itens</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Novo Material</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <input placeholder="Nome" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                            <div className="grid grid-cols-2 gap-3">
                                <input type="number" placeholder="Qtd" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.plannedQty} onChange={e => setNewMaterial({...newMaterial, plannedQty: e.target.value})} />
                                <input placeholder="Un" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} />
                            </div>
                            <div className="w-full">
                                <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Categoria / Etapa</label>
                                <select className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm appearance-none bg-no-repeat bg-[right_1rem_center]" value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})}>
                                    <option value="Geral">Geral / Extra</option>
                                    {steps.sort((a,b) => a.name.localeCompare(b.name)).map(s => (<option key={s.id} value={s.name}>{s.name}</option>))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {editingMaterial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Atualizar Estoque</h3>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Nome do Material</label>
                                    <input className="w-full px-0 py-1 bg-transparent border-b border-slate-200 dark:border-slate-600 text-primary dark:text-white font-bold outline-none" value={editingMaterial.name} onChange={e => setEditingMaterial({...editingMaterial, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Categoria / Etapa</label>
                                    <select className="w-full px-0 py-1 bg-transparent border-b border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 outline-none" value={editingMaterial.category || ''} onChange={e => setEditingMaterial({...editingMaterial, category: e.target.value})}>
                                        <option value="Geral">Geral / Extra</option>
                                        {steps.sort((a,b) => a.name.localeCompare(b.name)).map(s => (<option key={s.id} value={s.name}>{s.name}</option>))}
                                    </select>
                                </div>
                                <div className="pt-2">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Qtd. Planejada Total</label>
                                    <input type="number" className="w-full bg-transparent border-b border-slate-200 dark:border-slate-600 text-sm py-1 outline-none dark:text-white" value={editingMaterial.plannedQty} onChange={e => setEditingMaterial({...editingMaterial, plannedQty: Number(e.target.value)})} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Planejado</span>
                                    <span className="text-xl font-bold text-slate-700 dark:text-slate-300">{editingMaterial.plannedQty} <span className="text-xs font-normal">{editingMaterial.unit}</span></span>
                                </div>
                                <div className={`p-3 rounded-xl border ${editingMaterial.purchasedQty >= editingMaterial.plannedQty ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'} dark:bg-slate-800 dark:border-slate-700`}>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Já Comprado</span>
                                    <span className={`text-xl font-bold ${editingMaterial.purchasedQty >= editingMaterial.plannedQty ? 'text-green-600' : 'text-slate-700 dark:text-slate-300'}`}>{editingMaterial.purchasedQty} <span className="text-xs font-normal">{editingMaterial.unit}</span></span>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800">
                                <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-cart-plus"></i> Registrar Compra
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-blue-600/70 dark:text-blue-400 block mb-1">Qtd. Comprando</label>
                                        <input type="number" className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0" value={qtyToAdd} onChange={e => setQtyToAdd(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-blue-600/70 dark:text-blue-400 block mb-1">Valor Pago (R$)</label>
                                        <input type="number" className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0.00" value={editCost} onChange={e => setEditCost(e.target.value)} />
                                    </div>
                                </div>
                                {(Number(qtyToAdd) > 0) && (
                                    <div className="mt-3 text-xs text-blue-600 dark:text-blue-300 text-center">
                                        Novo total será: <strong>{editingMaterial.purchasedQty + Number(qtyToAdd)} {editingMaterial.unit}</strong>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setEditingMaterial(null); setEditCost(''); setQtyToAdd(''); }} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Confirmar Compra</button>
                            </div>
                            <button type="button" onClick={async () => { await dbService.deleteMaterial(editingMaterial.id); setEditingMaterial(null); await load(); onUpdate(); }} className="w-full py-2 text-red-500 text-xs font-bold uppercase tracking-wider">Excluir Item</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- MAIN PAGE ---

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [work, setWork] = useState<Work | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'STEPS' | 'MATERIALS' | 'EXPENSES'>('MATERIALS');
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        const w = await dbService.getWorkById(id);
        if (!w) {
            navigate('/');
            return;
        }
        setWork(w);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [id]);

    if (loading || !work) {
        return <div className="flex items-center justify-center h-screen"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary"></i></div>;
    }

    return (
        <div className="max-w-4xl mx-auto pb-20 pt-4 px-4 md:px-0 font-sans">
             {/* Header */}
             <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                <button onClick={() => navigate('/')} className="text-sm font-bold text-slate-400 hover:text-primary mb-2 flex items-center gap-2 transition-colors">
                    <i className="fa-solid fa-arrow-left"></i> Voltar ao Painel
                </button>
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold text-primary dark:text-white leading-tight">{work.name}</h1>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                             <i className="fa-solid fa-location-dot text-secondary"></i>
                             {work.address}
                        </div>
                    </div>
                    <div className="hidden md:block text-right">
                        <p className="text-xs uppercase font-bold text-slate-400">Orçamento Planejado</p>
                        <p className="text-xl font-bold text-primary dark:text-white">R$ {work.budgetPlanned.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                </div>
             </div>

             {/* Tab Navigation */}
             <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                <button 
                    onClick={() => setActiveTab('STEPS')} 
                    className={`px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'STEPS' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className="fa-solid fa-list-check"></i> Cronograma
                </button>
                <button 
                    onClick={() => setActiveTab('MATERIALS')} 
                    className={`px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'MATERIALS' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className="fa-solid fa-layer-group"></i> Materiais
                </button>
                <button 
                    onClick={() => setActiveTab('EXPENSES')} 
                    className={`px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${activeTab === 'EXPENSES' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className="fa-solid fa-wallet"></i> Financeiro
                </button>
             </div>

             {/* Content Area */}
             <div className="min-h-[400px]">
                {activeTab === 'STEPS' && <StepsTab workId={work.id} onUpdate={loadData} />}
                {activeTab === 'MATERIALS' && <MaterialsTab workId={work.id} onUpdate={loadData} />}
                {activeTab === 'EXPENSES' && <ExpensesTab workId={work.id} onUpdate={loadData} />}
             </div>
        </div>
    );
};

export default WorkDetail;
    