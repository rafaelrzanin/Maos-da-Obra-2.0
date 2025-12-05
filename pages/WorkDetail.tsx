import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Work, Step, Material, Expense, WorkPhoto, 
  StepStatus, ExpenseCategory 
} from '../types';
import { dbService } from '../services/db';
import { FULL_MATERIAL_PACKAGES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards';
import { aiService } from '../services/ai';
import { useAuth } from '../App';

// --- HELPER COMPONENTS ---
const SectionHeader: React.FC<{ title: string, subtitle: string }> = ({ title, subtitle }) => (
    <div>
        <h2 className="text-xl font-bold text-primary dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
);

// --- TABS (MATERIAIS) ---
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
            <div className="flex items-center justify-between mb-8"><SectionHeader title="Materiais" subtitle="Controle de compras e estoque." /><div className="flex gap-2"><button onClick={() => setIsImportOpen(true)} className="bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-secondary w-12 h-12 rounded-2xl flex items-center justify-center transition-all"><i className="fa-solid fa-cloud-arrow-down text-lg"></i></button><button onClick={() => setIsCreateOpen(true)} className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all"><i className="fa-solid fa-plus text-lg"></i></button></div></div>
            {sortedCategories.map(cat => (<div key={cat} className="mb-8 last:mb-0"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fa-solid fa-layer-group text-secondary"></i> {cat}</h3><div className="space-y-3">{groupedMaterials[cat].map(m => {
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
            })}</div></div>))}
            
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
                                <button key={idx} onClick={() => handleImport(pkg.category)} className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all flex items-center justify-between group">
                                    <span className="font-bold text-primary dark:text-white">{pkg.category}</span>
                                    <span className="text-xs text-slate-400 group-hover:text-primary transition-colors">{pkg.items.length} itens</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isCreateOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl"><h3 className="text-xl font-bold text-primary dark:text-white mb-6">Novo Material</h3><form onSubmit={handleAdd} className="space-y-4"><input placeholder="Nome" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} /><div className="grid grid-cols-2 gap-3"><input type="number" placeholder="Qtd" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.plannedQty} onChange={e => setNewMaterial({...newMaterial, plannedQty: e.target.value})} /><input placeholder="Un" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} /></div>
            <div className="w-full"><label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Categoria / Etapa</label><select className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm appearance-none bg-no-repeat bg-[right_1rem_center]" value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})}><option value="Geral">Geral / Extra</option>{steps.sort((a,b) => a.name.localeCompare(b.name)).map(s => (<option key={s.id} value={s.name}>{s.name}</option>))}</select></div>
            <div className="flex gap-3 pt-2"><button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button><button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button></div></form></div></div>)}
            
            {editingMaterial && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"><div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl"><h3 className="text-xl font-bold text-primary dark:text-white mb-6">Atualizar Estoque</h3><form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700"><div><label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Nome do Material</label><input className="w-full px-0 py-1 bg-transparent border-b border-slate-200 dark:border-slate-600 text-primary dark:text-white font-bold outline-none" value={editingMaterial.name} onChange={e => setEditingMaterial({...editingMaterial, name: e.target.value})} /></div><div><label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Categoria / Etapa</label><select className="w-full px-0 py-1 bg-transparent border-b border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 outline-none" value={editingMaterial.category || ''} onChange={e => setEditingMaterial({...editingMaterial, category: e.target.value})}><option value="Geral">Geral / Extra</option>{steps.sort((a,b) => a.name.localeCompare(b.name)).map(s => (<option key={s.id} value={s.name}>{s.name}</option>))}</select></div>
            <div className="pt-2"><label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Qtd. Planejada Total</label><input type="number" className="w-full bg-transparent border-b border-slate-200 dark:border-slate-600 text-sm py-1 outline-none dark:text-white" value={editingMaterial.plannedQty} onChange={e => setEditingMaterial({...editingMaterial, plannedQty: Number(e.target.value)})} /></div></div>
            <div className="grid grid-cols-2 gap-4 mb-2"><div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"><span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Planejado</span><span className="text-xl font-bold text-slate-700 dark:text-slate-300">{editingMaterial.plannedQty} <span className="text-xs font-normal">{editingMaterial.unit}</span></span></div><div className={`p-3 rounded-xl border ${editingMaterial.purchasedQty >= editingMaterial.plannedQty ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'} dark:bg-slate-800 dark:border-slate-700`}><span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Já Comprado</span><span className={`text-xl font-bold ${editingMaterial.purchasedQty >= editingMaterial.plannedQty ? 'text-green-600' : 'text-slate-700 dark:text-slate-300'}`}>{editingMaterial.purchasedQty} <span className="text-xs font-normal">{editingMaterial.unit}</span></span></div></div>
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800"><h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2"><i className="fa-solid fa-cart-plus"></i> Registrar Compra</h4><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] uppercase font-bold text-blue-600/70 dark:text-blue-400 block mb-1">Qtd. Comprando</label><input type="number" className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0" value={qtyToAdd} onChange={e => setQtyToAdd(e.target.value)} /></div><div><label className="text-[10px] uppercase font-bold text-blue-600/70 dark:text-blue-400 block mb-1">Valor Pago (R$)</label><input type="number" className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="0.00" value={editCost} onChange={e => setEditCost(e.target.value)} /></div></div>{(Number(qtyToAdd) > 0) && (<div className="mt-3 text-xs text-blue-600 dark:text-blue-300 text-center">Novo total será: <strong>{editingMaterial.purchasedQty + Number(qtyToAdd)} {editingMaterial.unit}</strong></div>)}</div>
            <div className="flex gap-3 pt-2"><button type="button" onClick={() => { setEditingMaterial(null); setEditCost(''); setQtyToAdd(''); }} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button><button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Confirmar Compra</button></div><button type="button" onClick={async () => { await dbService.deleteMaterial(editingMaterial.id); setEditingMaterial(null); await load(); onUpdate(); }} className="w-full py-2 text-red-500 text-xs font-bold uppercase tracking-wider">Excluir Item</button></form></div></div>)}
        </div>
    );
}

// --- TABS (CRONOGRAMA) ---
const StepsTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [steps, setSteps] = useState<Step[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newStep, setNewStep] = useState({ name: '', startDate: '', endDate: '' });

    const load = async () => {
        const data = await dbService.getSteps(workId);
        setSteps(data.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
    };

    useEffect(() => { load(); }, [workId]);

    const handleStatusToggle = async (step: Step) => {
        const newStatus = step.status === StepStatus.COMPLETED ? StepStatus.NOT_STARTED : StepStatus.COMPLETED;
        await dbService.updateStep({...step, status: newStatus});
        await load();
        onUpdate();
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await dbService.addStep({
            workId,
            name: newStep.name,
            startDate: newStep.startDate,
            endDate: newStep.endDate,
            status: StepStatus.NOT_STARTED
        });
        setIsCreateOpen(false);
        setNewStep({ name: '', startDate: '', endDate: '' });
        await load();
        onUpdate();
    };

    const handleDelete = async (id: string) => {
        if(confirm("Apagar etapa?")) {
            await dbService.deleteStep(id);
            await load();
            onUpdate();
        }
    };

    return (
        <div className="animate-in fade-in duration-500 pb-20">
             <div className="flex items-center justify-between mb-8">
                <SectionHeader title="Cronograma" subtitle="Gerencie as etapas da obra." />
                <button onClick={() => setIsCreateOpen(true)} className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all"><i className="fa-solid fa-plus text-lg"></i></button>
            </div>
            
            <div className="space-y-4 relative">
                <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 z-0"></div>
                {steps.map((step) => {
                    const isCompleted = step.status === StepStatus.COMPLETED;
                    const isDelayed = step.isDelayed;
                    return (
                        <div key={step.id} className="relative z-10 flex gap-4">
                            <button 
                                onClick={() => handleStatusToggle(step)}
                                className={`w-12 h-12 rounded-full border-4 shrink-0 flex items-center justify-center transition-all bg-white dark:bg-slate-900 ${isCompleted ? 'border-green-500 text-green-500' : isDelayed ? 'border-red-500 text-red-500' : 'border-slate-200 dark:border-slate-700 text-slate-300'}`}
                            >
                                {isCompleted && <i className="fa-solid fa-check text-lg"></i>}
                                {!isCompleted && isDelayed && <i className="fa-solid fa-exclamation text-lg"></i>}
                            </button>
                            <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`font-bold ${isCompleted ? 'text-slate-500 line-through' : 'text-primary dark:text-white'}`}>{step.name}</h4>
                                    <button onClick={() => handleDelete(step.id)} className="text-slate-300 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                                </div>
                                <div className="flex gap-4 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><i className="fa-regular fa-calendar"></i> {new Date(step.startDate).toLocaleDateString('pt-BR')}</span>
                                    <span className="flex items-center gap-1"><i className="fa-solid fa-arrow-right"></i> {new Date(step.endDate).toLocaleDateString('pt-BR')}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Nova Etapa</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <input placeholder="Nome da etapa" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newStep.name} onChange={e => setNewStep({...newStep, name: e.target.value})} required />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Início</label>
                                    <input type="date" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newStep.startDate} onChange={e => setNewStep({...newStep, startDate: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Fim</label>
                                    <input type="date" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newStep.endDate} onChange={e => setNewStep({...newStep, endDate: e.target.value})} required />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- TABS (FINANCEIRO) ---
const FinancialTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newExpense, setNewExpense] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: ExpenseCategory.MATERIAL });

    const load = async () => {
        const data = await dbService.getExpenses(workId);
        setExpenses(data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    };

    useEffect(() => { load(); }, [workId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await dbService.addExpense({
            workId,
            description: newExpense.description,
            amount: Number(newExpense.amount),
            paidAmount: Number(newExpense.amount),
            date: newExpense.date,
            category: newExpense.category as ExpenseCategory,
        });
        setIsCreateOpen(false);
        setNewExpense({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: ExpenseCategory.MATERIAL });
        await load();
        onUpdate();
    };

    const handleDelete = async (id: string) => {
        if(confirm("Apagar despesa?")) {
            await dbService.deleteExpense(id);
            await load();
            onUpdate();
        }
    }

    const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between mb-6">
                <SectionHeader title="Financeiro" subtitle="Controle de gastos." />
                <button onClick={() => setIsCreateOpen(true)} className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all"><i className="fa-solid fa-plus text-lg"></i></button>
            </div>

            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white mb-6 shadow-lg">
                <p className="text-xs uppercase text-slate-400 font-bold mb-1">Total Gasto</p>
                <p className="text-3xl font-bold">R$ {total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>

            <div className="space-y-3">
                {expenses.map(exp => (
                    <div key={exp.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                <i className={`fa-solid ${exp.category === 'Mão de Obra' ? 'fa-user-helmet-safety' : 'fa-bag-shopping'}`}></i>
                            </div>
                            <div>
                                <h4 className="font-bold text-primary dark:text-white text-sm">{exp.description}</h4>
                                <p className="text-xs text-slate-400">{new Date(exp.date).toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <p className="font-bold text-primary dark:text-white text-sm">- R$ {exp.amount.toFixed(2)}</p>
                             <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-400 mt-1 hover:underline">apagar</button>
                        </div>
                    </div>
                ))}
            </div>

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Nova Despesa</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <input placeholder="Descrição" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} required />
                            <div className="grid grid-cols-2 gap-3">
                                <input type="number" placeholder="Valor (R$)" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} required />
                                <input type="date" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newExpense.date} onChange={e => setNewExpense({...newExpense, date: e.target.value})} required />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Categoria</label>
                                <select className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value as ExpenseCategory})}>
                                    {Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{c}</option>)}
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
        </div>
    );
};

// --- TABS (FILES & PHOTOS) ---
const FilesTab: React.FC<{ workId: string }> = ({ workId }) => {
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    
    const load = async () => {
        const p = await dbService.getPhotos(workId);
        setPhotos(p);
    };

    useEffect(() => { load(); }, [workId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files && e.target.files[0]) {
            setIsUploading(true);
            await dbService.uploadPhoto(workId, e.target.files[0], 'PROGRESS');
            await load();
            setIsUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(confirm("Apagar foto?")) {
            await dbService.deletePhoto(id);
            await load();
        }
    };

    return (
        <div className="animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between mb-6">
                <SectionHeader title="Galeria" subtitle="Fotos do progresso." />
                <label className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all cursor-pointer hover:bg-primary-dark">
                    <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={isUploading} />
                    {isUploading ? <i className="fa-solid fa-circle-notch fa-spin text-lg"></i> : <i className="fa-solid fa-camera text-lg"></i>}
                </label>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map(p => (
                    <div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden group">
                        <img src={p.url} alt="Obra" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <a href={p.url} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40"><i className="fa-solid fa-eye"></i></a>
                             <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-full bg-red-500/80 text-white flex items-center justify-center hover:bg-red-500"><i className="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                ))}
                {photos.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                        <i className="fa-solid fa-images text-3xl mb-2"></i>
                        <p>Nenhuma foto ainda.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- CHAT AI COMPONENT ---
const AIChat: React.FC = () => {
    const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([{role: 'model', text: 'Olá! Sou o Zé da Obra. Pode me perguntar qualquer coisa sobre construção.'}]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!input.trim()) return;
        
        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
        setLoading(true);

        const response = await aiService.sendMessage(userMsg);
        setMessages(prev => [...prev, {role: 'model', text: response}]);
        setLoading(false);
    };

    useEffect(() => { bottomRef.current?.scrollIntoView({behavior: 'smooth'}) }, [messages]);

    return (
        <div className="flex flex-col h-[500px] bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
             <div className="bg-primary p-4 flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-white p-0.5"><img src={ZE_AVATAR} alt="Ze" className="w-full h-full rounded-full object-cover" onError={e => (e.currentTarget.src = ZE_AVATAR_FALLBACK)} /></div>
                 <div><h3 className="font-bold text-white">Zé da Obra</h3><p className="text-xs text-white/80">Engenheiro Virtual</p></div>
             </div>
             <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
                 {messages.map((m, i) => (
                     <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none'}`}>
                             {m.text}
                         </div>
                     </div>
                 ))}
                 {loading && <div className="flex justify-start"><div className="bg-slate-200 dark:bg-slate-800 rounded-full px-4 py-2 text-xs text-slate-500 animate-pulse">Digitando...</div></div>}
                 <div ref={bottomRef}></div>
             </div>
             <form onSubmit={send} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                 <input className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-3 text-sm outline-none" placeholder="Pergunte algo..." value={input} onChange={e => setInput(e.target.value)} disabled={loading} />
                 <button type="submit" disabled={loading || !input.trim()} className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50"><i className="fa-solid fa-paper-plane"></i></button>
             </form>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
const WorkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [work, setWork] = useState<Work | null>(null);
  const [activeTab, setActiveTab] = useState<'RESUMO' | 'CRONOGRAMA' | 'FINANCEIRO' | 'MATERIAIS' | 'FOTOS'>('RESUMO');
  const [loading, setLoading] = useState(true);

  // Stats for Header
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0 });

  const loadWork = async () => {
    if (!id || !user) return;
    const w = await dbService.getWorkById(id);
    if (w) {
       setWork(w);
       const s = await dbService.calculateWorkStats(id);
       setStats({ totalSpent: s.totalSpent, progress: s.progress });
    } else {
       navigate('/');
    }
    setLoading(false);
  };

  useEffect(() => { loadWork(); }, [id, user]);

  if (loading || !work) return <div className="flex items-center justify-center h-screen"><i className="fa-solid fa-circle-notch fa-spin text-secondary text-2xl"></i></div>;

  const tabs = [
      { id: 'RESUMO', icon: 'fa-chart-pie', label: 'Resumo' },
      { id: 'CRONOGRAMA', icon: 'fa-calendar-days', label: 'Etapas' },
      { id: 'MATERIAIS', icon: 'fa-layer-group', label: 'Materiais' },
      { id: 'FINANCEIRO', icon: 'fa-wallet', label: 'Gastos' },
      { id: 'FOTOS', icon: 'fa-images', label: 'Fotos' },
  ];

  return (
    <div className="max-w-4xl mx-auto pt-4 px-4 md:px-0 font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary transition-colors">
              <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div className="text-right">
              <h1 className="text-xl font-bold text-primary dark:text-white leading-tight">{work.name}</h1>
              <p className="text-xs text-slate-400">Progresso: {stats.progress}% • Gasto: R$ {stats.totalSpent.toLocaleString()}</p>
          </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                  <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
              </button>
          ))}
      </div>

      {/* Content Area */}
      <div>
          {activeTab === 'RESUMO' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Quick Stats */}
                      <div className="space-y-6">
                          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                               <SectionHeader title="Status Geral" subtitle="Visão macro da obra." />
                               <div className="mt-6 flex items-center gap-4">
                                   <div className="w-20 h-20 rounded-full border-4 border-slate-100 dark:border-slate-800 flex items-center justify-center relative">
                                        <span className="text-xl font-bold text-primary dark:text-white">{stats.progress}%</span>
                                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                                            <path className="text-secondary" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray={`${stats.progress}, 100`} />
                                        </svg>
                                   </div>
                                   <div>
                                       <p className="text-sm font-bold text-slate-500 uppercase">Orçamento</p>
                                       <p className="text-2xl font-bold text-primary dark:text-white">R$ {work.budgetPlanned.toLocaleString()}</p>
                                       <p className={`text-xs font-bold ${stats.totalSpent > work.budgetPlanned ? 'text-red-500' : 'text-green-500'}`}>
                                           {stats.totalSpent > work.budgetPlanned ? 'Estourado em ' : 'Disponível: '} 
                                           R$ {Math.abs(work.budgetPlanned - stats.totalSpent).toLocaleString()}
                                       </p>
                                   </div>
                               </div>
                          </div>
                      </div>
                      
                      {/* Right: AI Chat */}
                      <div>
                          <AIChat />
                      </div>
                  </div>
              </div>
          )}
          {activeTab === 'MATERIAIS' && <MaterialsTab workId={id!} onUpdate={loadWork} />}
          {activeTab === 'CRONOGRAMA' && <StepsTab workId={id!} onUpdate={loadWork} />}
          {activeTab === 'FINANCEIRO' && <FinancialTab workId={id!} onUpdate={loadWork} />}
          {activeTab === 'FOTOS' && <FilesTab workId={id!} />}
      </div>
    </div>
  );
};

export default WorkDetail;