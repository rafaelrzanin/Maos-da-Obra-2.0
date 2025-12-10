import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Worker, Supplier, Material, Step } from '../types';
import { ZeModal } from '../components/ZeModal';
import { FULL_MATERIAL_PACKAGES } from '../services/standards';

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <div className="mb-6">
        <h2 className="text-xl font-bold text-primary dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
);

const WorkDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [work, setWork] = useState<Work | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'MATERIALS' | 'TEAM' | 'SUPPLIER'>('MATERIALS');
    
    // Data State
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [jobRoles, setJobRoles] = useState<string[]>([]);
    const [supplierCategories, setSupplierCategories] = useState<string[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    
    // Materials UI State
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [editCost, setEditCost] = useState('');
    const [qtyToAdd, setQtyToAdd] = useState('');

    // Team/Supplier UI State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [zeModal, setZeModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // Form State (Shared for Team/Supplier)
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newNotes, setNewNotes] = useState('');

    const load = async () => {
        if (!id) return;
        const w = await dbService.getWorkById(id);
        setWork(w || null);
        
        if (w) {
            const [wk, sp, roles, cats, mats, stps] = await Promise.all([
                dbService.getWorkers(w.userId),
                dbService.getSuppliers(w.userId),
                dbService.getJobRoles(),
                dbService.getSupplierCategories(),
                dbService.getMaterials(w.id),
                dbService.getSteps(w.id)
            ]);
            setWorkers(wk);
            setSuppliers(sp);
            setJobRoles(roles);
            setSupplierCategories(cats);
            setMaterials(mats);
            setSteps(stps);
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
        alert(`${count} materiais adicionados com sucesso.`); 
        setIsImportOpen(false); 
        await load(); 
    };
    
    const handleUpdateMaterial = async (e: React.FormEvent) => { 
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
        } 
    };

    const groupedMaterials = materials.reduce((acc, m) => {
        const cat = m.category || 'Outros';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(m);
        return acc;
    }, {} as Record<string, Material[]>);

    const sortedCategories = Object.keys(groupedMaterials).sort((a, b) => {
        const indexA = steps.findIndex(s => s.name === a);
        const indexB = steps.findIndex(s => s.name === b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    // --- TEAM/SUPPLIER LOGIC ---
    const handleEdit = (item: Worker | Supplier) => {
        setEditingId(item.id);
        setNewName(item.name);
        setNewPhone(item.phone);
        setNewNotes(item.notes || '');
        if (tab === 'TEAM') {
            setNewRole((item as Worker).role);
        } else {
            setNewRole((item as Supplier).category);
        }
        setIsAddOpen(true);
    };

    const handleDeleteClick = (itemId: string) => {
        setZeModal({
            isOpen: true,
            title: tab === 'TEAM' ? 'Excluir Profissional' : 'Excluir Fornecedor',
            message: 'Tem certeza? Essa ação não pode ser desfeita.',
            onConfirm: async () => {
                if (tab === 'TEAM') {
                    await dbService.deleteWorker(itemId);
                } else {
                    await dbService.deleteSupplier(itemId);
                }
                await load();
                setZeModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!work) return;

        try {
            if (tab === 'TEAM') {
                const payload = {
                    userId: work.userId,
                    name: newName,
                    role: newRole,
                    phone: newPhone,
                    notes: newNotes
                };
                if (editingId) {
                    await dbService.updateWorker({ ...payload, id: editingId });
                } else {
                    await dbService.addWorker(payload);
                }
            } else {
                const payload = {
                    userId: work.userId,
                    name: newName,
                    category: newRole,
                    phone: newPhone,
                    email: '',
                    address: '',
                    notes: newNotes
                };
                if (editingId) {
                    await dbService.updateSupplier({ ...payload, id: editingId } as Supplier);
                } else {
                    await dbService.addSupplier(payload);
                }
            }
            setIsAddOpen(false);
            setEditingId(null);
            setNewName('');
            setNewRole('');
            setNewPhone('');
            setNewNotes('');
            await load();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar.");
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen text-primary"><i className="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>;
    if (!work) return <div className="p-8 text-center text-slate-500">Obra não encontrada</div>;

    const items = tab === 'TEAM' ? workers : suppliers;
    const options = tab === 'TEAM' ? jobRoles : supplierCategories;

    return (
        <div className="max-w-3xl mx-auto py-6 px-4 pb-20">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-500 hover:text-primary flex items-center gap-2">
                <i className="fa-solid fa-arrow-left"></i> Voltar
            </button>

            <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-6">{work.name}</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button 
                    onClick={() => setTab('MATERIALS')} 
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${tab === 'MATERIALS' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className="fa-solid fa-layer-group"></i> Materiais
                </button>
                <button 
                    onClick={() => setTab('TEAM')} 
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${tab === 'TEAM' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className="fa-solid fa-helmet-safety"></i> Minha Equipe
                </button>
                <button 
                    onClick={() => setTab('SUPPLIER')} 
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${tab === 'SUPPLIER' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className="fa-solid fa-truck"></i> Fornecedores
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="animate-in fade-in slide-in-from-right-4">
                
                {/* MATERIALS TAB */}
                {tab === 'MATERIALS' && (
                    <div className="pb-20">
                        <div className="flex items-center justify-between mb-8">
                            <SectionHeader title="Materiais" subtitle="Controle de compras e estoque." />
                            <div className="flex gap-2">
                                <button onClick={() => setIsImportOpen(true)} className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-secondary w-12 h-12 rounded-2xl flex items-center justify-center transition-all">
                                    <i className="fa-solid fa-cloud-arrow-down text-lg"></i>
                                </button>
                            </div>
                        </div>

                        {sortedCategories.map(cat => {
                            const stepIdx = steps.findIndex(s => s.name === cat);
                            const numberPrefix = stepIdx !== -1 ? String(stepIdx + 1).padStart(2, '0') : '';

                            return (
                            <div key={cat} className="mb-8 last:mb-0">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    {numberPrefix && <span className="text-secondary bg-secondary/10 w-6 h-6 rounded-md flex items-center justify-center text-xs">{numberPrefix}</span>}
                                    {cat}
                                </h3>
                                <div className="space-y-3">
                                    {groupedMaterials[cat].map(m => {
                                        const isCompleted = m.purchasedQty >= m.plannedQty;
                                        const isPartial = m.purchasedQty > 0 && m.purchasedQty < m.plannedQty;
                                        
                                        let statusLabel = 'Pendente';
                                        let statusColor = 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300';
                                        let progressColor = 'bg-secondary';
                                        let cardBorder = 'border-slate-100 dark:border-slate-800';

                                        if (isCompleted) {
                                            statusLabel = 'Comprado';
                                            statusColor = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
                                            progressColor = 'bg-success';
                                            cardBorder = 'border-green-200 dark:border-green-900/30 opacity-60';
                                        } else if (isPartial) {
                                            statusLabel = 'Parcial';
                                            statusColor = 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
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
                                                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">{m.purchasedQty} / {m.plannedQty} {m.unit}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}

                {/* TEAM & SUPPLIER TABS */}
                {(tab === 'TEAM' || tab === 'SUPPLIER') && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <SectionHeader title={tab === 'TEAM' ? 'Minha Equipe' : 'Fornecedores'} subtitle={tab === 'TEAM' ? 'Profissionais da obra' : 'Lojas e serviços'} />
                            <button onClick={() => { setEditingId(null); setIsAddOpen(true); }} className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105">
                                <i className="fa-solid fa-plus text-lg"></i>
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {items.length > 0 ? (
                                items.map((item: any) => (
                                    <div key={item.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition-all group">
                                        <div onClick={() => handleEdit(item)} className="flex-1 cursor-pointer">
                                            <h4 className="font-bold text-primary dark:text-white">{item.name}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{tab === 'TEAM' ? item.role : item.category}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <a href={`https://wa.me/55${item.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center hover:bg-green-200 transition-colors">
                                                <i className="fa-brands fa-whatsapp"></i>
                                            </a>
                                            <button onClick={() => handleDeleteClick(item.id)} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                <i className="fa-solid fa-trash text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-slate-400 py-8 text-sm">Nenhum registro encontrado.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

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
                                <button 
                                    key={idx}
                                    onClick={() => handleImport(pkg.category)}
                                    className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary transition-all flex items-center justify-between group"
                                >
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

            {/* ADD TEAM/SUPPLIER MODAL */}
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-primary dark:text-white">
                                {editingId ? 'Editar' : 'Adicionar'} {tab === 'TEAM' ? 'Profissional' : 'Fornecedor'}
                            </h3>
                            <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-primary"><i className="fa-solid fa-xmark text-xl"></i></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" required />
                            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" required>
                                <option value="">Selecione a Função</option>
                                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <input placeholder="Telefone / WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                            <textarea placeholder="Observações" value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-24 resize-none" />
                            <button type="submit" className="w-full bg-primary text-white font-bold py-3 rounded-xl">Salvar</button>
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
