
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Expense, Material, StepStatus, ExpenseCategory, PlanType, WorkPhoto, WorkFile } from '../types';
import { Recharts } from '../components/RechartsWrapper';
import { ZeModal } from '../components/ZeModal';
import { FULL_MATERIAL_PACKAGES, ZE_AVATAR, ZE_AVATAR_FALLBACK, CALCULATOR_LOGIC, CONTRACT_TEMPLATES, STANDARD_CHECKLISTS, getRandomZeTip, ZeTip } from '../services/standards';
import { useAuth } from '../App';
import { aiService } from '../services/ai';
import * as XLSX from 'xlsx';

// --- Shared Components & Helpers ---

const SectionHeader: React.FC<{ title: string, subtitle: string }> = ({ title, subtitle }) => (
    <div className="mb-6 print:mb-2">
        <h2 className="text-2xl font-bold text-primary dark:text-white tracking-tight">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{subtitle}</p>
        <div className="h-1 w-10 bg-secondary rounded-full mt-3 print:hidden"></div>
    </div>
);

const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/----';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }
    try {
        return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch (e) {
        return dateStr;
    }
};

// ----------------------------------------------------------------------
// SUB-VIEWS FOR "MORE" TAB
// ----------------------------------------------------------------------

// 1. CONTACTS VIEW
const ContactsView: React.FC<{ mode: 'TEAM' | 'SUPPLIERS', onBack: () => void }> = ({ mode, onBack }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [options, setOptions] = useState<string[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState(''); 
    const [newPhone, setNewPhone] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

    const loadData = async () => {
        if(user) {
            setItems([]);
            if (mode === 'TEAM') {
                const [w, r] = await Promise.all([dbService.getWorkers(user.id), dbService.getJobRoles()]);
                setItems(w); setOptions(r);
            } else {
                const [s, c] = await Promise.all([dbService.getSuppliers(user.id), dbService.getSupplierCategories()]);
                setItems(s); setOptions(c);
            }
        }
    };
    useEffect(() => { loadData(); }, [user, mode]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(user) {
            if (editingId) {
                if (mode === 'TEAM') {
                    const currentItem = items.find(i => i.id === editingId);
                    if (currentItem) await dbService.updateWorker({ ...currentItem, name: newName, role: newRole, phone: newPhone, notes: newNotes });
                } else {
                    const currentItem = items.find(i => i.id === editingId);
                    if (currentItem) await dbService.updateSupplier({ ...currentItem, name: newName, category: newRole, phone: newPhone, notes: newNotes });
                }
            } else {
                if (mode === 'TEAM') await dbService.addWorker({ userId: user.id, name: newName, role: newRole, phone: newPhone, notes: newNotes });
                else await dbService.addSupplier({ userId: user.id, name: newName, category: newRole, phone: newPhone, notes: newNotes });
            }
            setIsAddOpen(false); setEditingId(null); setNewName(''); setNewRole(''); setNewPhone(''); setNewNotes(''); loadData();
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        setNewName(item.name);
        setNewRole(item.role || item.category);
        setNewPhone(item.phone);
        setNewNotes(item.notes || '');
        setIsAddOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setZeModal({
            isOpen: true, title: "Remover", message: `Tem certeza?`,
            onConfirm: async () => {
                if (mode === 'TEAM') await dbService.deleteWorker(id); else await dbService.deleteSupplier(id);
                setZeModal(prev => ({...prev, isOpen: false})); loadData();
            }
        });
    }

    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <SectionHeader title={mode === 'TEAM' ? "Minha Equipe" : "Meus Fornecedores"} subtitle={mode === 'TEAM' ? "Profissionais cadastrados." : "Lojas e prestadores."} />
            <div className="space-y-3">
                {items.map(item => (
                    <div key={item.id} onClick={() => handleEdit(item)} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:border-secondary transition-all">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${mode === 'TEAM' ? 'bg-blue-500' : 'bg-indigo-500'}`}><i className={`fa-solid ${mode === 'TEAM' ? 'fa-helmet-safety' : 'fa-truck'}`}></i></div>
                            <div>
                                <h4 className="font-bold text-primary dark:text-white">{item.name}</h4>
                                <p className="text-xs text-slate-500">{(item as any).role || (item as any).category}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <a href={`https://wa.me/55${item.phone.replace(/\D/g,'')}`} target="_blank" onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"><i className="fa-brands fa-whatsapp"></i></a>
                             <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id); }} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><i className="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={() => { setEditingId(null); setIsAddOpen(true); }} className="mt-6 w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg"><i className="fa-solid fa-plus mr-2"></i> Adicionar</button>
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">{editingId ? 'Editar Cadastro' : 'Novo Cadastro'}</h3>
                        <form onSubmit={handleSave} className="space-y-3">
                            <input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none" required />
                            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none" required>
                                <option value="">{mode === 'TEAM' ? "Selecione a Profissão" : "Selecione a Categoria"}</option>
                                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <input placeholder="Telefone" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none" required />
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
             <ZeModal isOpen={zeModal.isOpen} title={zeModal.title} message={zeModal.message} onConfirm={zeModal.onConfirm} onCancel={() => setZeModal({isOpen: false, title: '', message: '', onConfirm: () => {}})} />
        </div>
    );
};

// 2. PHOTOS VIEW
const PhotosView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const loadPhotos = async () => { const p = await dbService.getPhotos(workId); setPhotos(p); };
    useEffect(() => { loadPhotos(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadPhoto(workId, e.target.files[0], 'PROGRESS'); loadPhotos(); }};
    
    return (
        <div className="animate-in fade-in slide-in-from-right-4 flex flex-col h-full">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2 w-fit"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6">
                 <SectionHeader title="Galeria" subtitle="Acompanhamento visual." />
                 {photos.length > 0 && <label className="bg-primary hover:bg-slate-700 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer transition-colors"><i className="fa-solid fa-camera"></i><input type="file" className="hidden" accept="image/*" onChange={handleUpload} /></label>}
             </div>
             {photos.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
                     <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mb-6 shadow-sm"><i className="fa-solid fa-images text-3xl"></i></div>
                     <h3 className="text-xl font-bold text-primary dark:text-white mb-2">Galeria Vazia</h3>
                     <label className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 cursor-pointer flex items-center gap-2 hover:bg-slate-800 transition-all"><i className="fa-solid fa-camera"></i> Adicionar Foto<input type="file" className="hidden" accept="image/*" onChange={handleUpload} /></label>
                 </div>
             ) : (
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     {photos.map(p => (<div key={p.id} className="aspect-square rounded-2xl overflow-hidden relative group border border-slate-100 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-900"><img src={p.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Obra" /><div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2"><button onClick={async () => { if(confirm('Apagar foto?')) { await dbService.deletePhoto(p.id); loadPhotos(); }}} className="text-white bg-red-500/80 hover:bg-red-500 w-10 h-10 rounded-full flex items-center justify-center transition-colors"><i className="fa-solid fa-trash"></i></button></div></div>))}
                 </div>
             )}
        </div>
    );
};

// 3. FILES VIEW
const FilesView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [files, setFiles] = useState<WorkFile[]>([]);
    const loadFiles = async () => { const f = await dbService.getFiles(workId); setFiles(f); };
    useEffect(() => { loadFiles(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadFile(workId, e.target.files[0], 'Geral'); loadFiles(); }};
    
    return (
        <div className="animate-in fade-in slide-in-from-right-4 flex flex-col h-full">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2 w-fit"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6">
                 <SectionHeader title="Projetos" subtitle="Plantas e documentos." />
                 {files.length > 0 && <label className="bg-primary hover:bg-slate-700 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer transition-colors"><i className="fa-solid fa-upload"></i><input type="file" className="hidden" onChange={handleUpload} /></label>}
             </div>
             {files.length === 0 ? (
                 <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
                     <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mb-6 shadow-sm"><i className="fa-solid fa-folder-open text-3xl"></i></div>
                     <h3 className="text-xl font-bold text-primary dark:text-white mb-2">Sem Arquivos</h3>
                     <label className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 cursor-pointer flex items-center gap-2 hover:bg-slate-800 transition-all"><i className="fa-solid fa-cloud-arrow-up"></i> Adicionar Arquivo<input type="file" className="hidden" onChange={handleUpload} /></label>
                 </div>
             ) : (
                 <div className="space-y-3">{files.map(f => (<div key={f.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:border-secondary/30 transition-all shadow-sm group"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xl shrink-0"><i className={`fa-solid ${f.name.endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file-lines'}`}></i></div><div className="min-w-0"><h4 className="font-bold text-sm text-primary dark:text-white truncate max-w-[180px] md:max-w-xs">{f.name}</h4><p className="text-[10px] text-slate-500 uppercase tracking-wide font-bold mt-0.5">{new Date(f.date).toLocaleDateString()} • {f.category}</p></div></div><div className="flex gap-2"><a href={f.url} target="_blank" className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-primary hover:text-white transition-colors" title="Abrir"><i className="fa-solid fa-arrow-up-right-from-square text-xs"></i></a><button onClick={async () => { if(confirm('Excluir arquivo?')) { await dbService.deleteFile(f.id); loadFiles(); }}} className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors" title="Excluir"><i className="fa-solid fa-trash text-xs"></i></button></div></div>))}</div>
             )}
        </div>
    );
};

// 4. REPORTS VIEW
const ReportsView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'MATERIALS' | 'STEPS'>('FINANCIAL');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [work, setWork] = useState<Work | undefined>();
    useEffect(() => {
        const loadAll = async () => { const [exp, mat, stp, w] = await Promise.all([dbService.getExpenses(workId), dbService.getMaterials(workId), dbService.getSteps(workId), dbService.getWorkById(workId)]); setExpenses(exp); setMaterials(mat); setSteps(stp.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())); setWork(w); }; loadAll();
    }, [workId]);
    const handlePrint = () => { window.print(); };
    
    // EXPORT TO EXCEL LOGIC
    const handleExportExcel = () => {
        let data: any[] = [];
        let sheetName = "";

        if (activeTab === 'FINANCIAL') {
            sheetName = "Financeiro";
            data = expenses.map(e => ({
                Data: new Date(e.date).toLocaleDateString('pt-BR'),
                Descrição: e.description,
                Categoria: e.category,
                'Valor Lançado': e.amount,
                'Valor Pago': e.paidAmount || 0
            }));
        } else if (activeTab === 'MATERIALS') {
            sheetName = "Materiais";
            data = materials.map(m => ({
                Material: m.name,
                Categoria: m.category || 'Geral',
                Planejado: m.plannedQty,
                Comprado: m.purchasedQty,
                Unidade: m.unit,
                Status: m.purchasedQty >= m.plannedQty ? 'Comprado' : m.purchasedQty > 0 ? 'Parcial' : 'Pendente'
            }));
        } else if (activeTab === 'STEPS') {
            sheetName = "Cronograma";
            data = steps.map(s => {
                const isLate = s.status !== StepStatus.COMPLETED && new Date(s.endDate) < new Date();
                let status = 'Planejamento';
                if (s.status === StepStatus.COMPLETED) status = 'Concluído';
                else if (s.status === StepStatus.IN_PROGRESS) status = 'Em Andamento';
                if (isLate) status += ' (Atrasado)';
                
                return {
                    Etapa: s.name,
                    Início: new Date(s.startDate).toLocaleDateString('pt-BR'),
                    Fim: new Date(s.endDate).toLocaleDateString('pt-BR'),
                    Status: status
                };
            });
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `Relatorio_${sheetName}_${work?.name.replace(/\s/g, '_')}.xlsx`);
    };

    const financialData = expenses.reduce((acc: any[], curr) => { const existing = acc.find((a: any) => a.name === curr.category); if (existing) existing.value += curr.amount; else acc.push({ name: curr.category, value: curr.amount }); return acc; }, []);
    const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0); const totalPaid = expenses.reduce((acc, e) => acc + (e.paidAmount || 0), 0); const totalPending = totalSpent - totalPaid;
    
    // Group Materials
    const groupedMaterials: Record<string, Material[]> = {}; 
    materials.forEach(m => { const cat = m.category || 'Geral'; if (!groupedMaterials[cat]) groupedMaterials[cat] = []; groupedMaterials[cat].push(m); });
    const sortedCategories = Object.keys(groupedMaterials).sort();

    // Steps Logic
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length; 
    const delayedSteps = steps.filter(s => s.status !== StepStatus.COMPLETED && new Date(s.endDate) < new Date()).length;
    const inProgressSteps = steps.filter(s => s.status === StepStatus.IN_PROGRESS).length; 
    const totalSteps = steps.length;

    return (
        <div className="animate-in fade-in slide-in-from-right-4 bg-white dark:bg-slate-950 min-h-screen">
             <div className="hidden print:block mb-8 border-b-2 border-black pb-4"><h1 className="text-3xl font-bold uppercase">{work?.name || "Relatório"}</h1><p className="text-sm">Endereço: {work?.address}</p></div>
             <div className="flex justify-between items-center mb-6 print:hidden">
                 <button onClick={onBack} className="text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
                 <div className="flex gap-2">
                     <button onClick={handleExportExcel} className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-green-700 transition-colors"><i className="fa-solid fa-file-excel"></i> Excel</button>
                     <button onClick={handlePrint} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 hover:bg-slate-800 transition-colors"><i className="fa-solid fa-print"></i> PDF</button>
                 </div>
             </div>
             <SectionHeader title="Relatórios Inteligentes" subtitle="Analise cada detalhe da sua obra." />
             <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6 print:hidden">{[{ id: 'FINANCIAL', label: 'Financeiro', icon: 'fa-wallet' }, { id: 'MATERIALS', label: 'Compras', icon: 'fa-cart-shopping' }, { id: 'STEPS', label: 'Etapas', icon: 'fa-list-check' }].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><i className={`fa-solid ${tab.icon}`}></i> {tab.label}</button>))}</div>
             
             {/* FINANCIAL TAB */}
             {activeTab === 'FINANCIAL' && (
                 <div className="space-y-6 animate-in fade-in">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                             <p className="text-xs font-bold text-slate-400 uppercase">Total Lançado</p>
                             <p className="text-2xl font-bold text-primary dark:text-white">R$ {totalSpent.toLocaleString('pt-BR')}</p>
                         </div>
                         <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                             <p className="text-xs font-bold text-slate-400 uppercase">Valor Pago</p>
                             <p className="text-2xl font-bold text-green-600">R$ {totalPaid.toLocaleString('pt-BR')}</p>
                         </div>
                         <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                             <p className="text-xs font-bold text-slate-400 uppercase">A Pagar</p>
                             <p className="text-2xl font-bold text-red-500">R$ {totalPending.toLocaleString('pt-BR')}</p>
                         </div>
                     </div>
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                         <div className="h-64">
                             <Recharts.ResponsiveContainer width="100%" height="100%">
                                 <Recharts.BarChart data={financialData}>
                                     <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} />
                                     <Recharts.XAxis dataKey="name" tick={{fontSize: 10}} />
                                     <Recharts.YAxis />
                                     <Recharts.Tooltip />
                                     <Recharts.Bar dataKey="value" fill="#D97706" radius={[6, 6, 0, 0]} barSize={40} />
                                 </Recharts.BarChart>
                             </Recharts.ResponsiveContainer>
                         </div>
                     </div>
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                         <h3 className="font-bold mb-4 dark:text-white">Extrato Detalhado</h3>
                         <div className="space-y-3">
                             {expenses.map(e => (
                                 <div key={e.id} className="flex flex-col p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50">
                                     <div className="flex justify-between items-start mb-2">
                                         <span className="font-bold text-sm text-primary dark:text-white leading-tight">{e.description}</span>
                                         <span className="font-bold text-sm text-primary dark:text-white ml-4 whitespace-nowrap">R$ {(e.paidAmount || 0).toLocaleString('pt-BR')}</span>
                                     </div>
                                     <div className="flex justify-between items-center text-xs">
                                         <div className="flex items-center gap-2 text-slate-500">
                                             <i className="fa-regular fa-calendar"></i>
                                             <span>{formatDateDisplay(e.date)}</span>
                                         </div>
                                         <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-500 font-medium text-[10px] uppercase tracking-wide">
                                             {e.category}
                                         </span>
                                     </div>
                                 </div>
                             ))}
                             {expenses.length === 0 && <p className="text-slate-400 text-center text-sm py-4">Nenhum lançamento.</p>}
                         </div>
                     </div>
                 </div>
             )}

             {/* MATERIALS TAB */}
             {activeTab === 'MATERIALS' && (
                 <div className="space-y-6 animate-in fade-in">
                     <div className="space-y-4">
                         {sortedCategories.map((cat, idx) => (
                             <div key={cat} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 break-inside-avoid">
                                 <h4 className="font-bold text-primary dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                                     <span className="text-secondary bg-secondary/10 w-6 h-6 rounded-md flex items-center justify-center text-xs">{String(idx + 1).padStart(2, '0')}</span> 
                                     {cat}
                                 </h4>
                                 <div className="grid grid-cols-1 gap-3">
                                     {groupedMaterials[cat].map(m => {
                                         const isComplete = m.purchasedQty >= m.plannedQty;
                                         const isPartial = m.purchasedQty > 0 && m.purchasedQty < m.plannedQty;
                                         
                                         let dotColor = 'bg-slate-300';
                                         if (isComplete) dotColor = 'bg-green-500';
                                         else if (isPartial) dotColor = 'bg-orange-500';

                                         return (
                                             <div key={m.id} className="flex items-center gap-4 text-sm">
                                                 <div className={`w-3 h-3 rounded-full ${dotColor}`}></div>
                                                 <div className="flex-1">
                                                     <div className="flex justify-between mb-1">
                                                         <span className="font-medium dark:text-slate-200">{m.name}</span>
                                                         <span className="text-slate-500 text-xs">{m.purchasedQty} / {m.plannedQty} {m.unit}</span>
                                                     </div>
                                                 </div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* STEPS TAB */}
             {activeTab === 'STEPS' && (
                 <div className="space-y-6 animate-in fade-in">
                     {/* Big Stats Card */}
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                         <div>
                             <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total de Etapas</p>
                             <p className="text-4xl font-extrabold text-primary dark:text-white mt-1">{totalSteps}</p>
                         </div>
                         <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl text-slate-400">
                             <i className="fa-solid fa-list-check"></i>
                         </div>
                     </div>

                     {/* Detail Grid */}
                     <div className="grid grid-cols-3 gap-4">
                         <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-l-4 border-green-500 shadow-sm">
                             <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedSteps}</p>
                             <p className="text-xs font-bold text-slate-500 uppercase mt-1">Concluídas</p>
                         </div>
                         <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-l-4 border-orange-500 shadow-sm">
                             <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{inProgressSteps}</p>
                             <p className="text-xs font-bold text-slate-500 uppercase mt-1">Em Andamento</p>
                         </div>
                         <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border-l-4 border-red-500 shadow-sm">
                             <p className="text-2xl font-bold text-red-600 dark:text-red-400">{delayedSteps}</p>
                             <p className="text-xs font-bold text-slate-500 uppercase mt-1">Atrasadas</p>
                         </div>
                     </div>

                     {/* Steps List */}
                     <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                         <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 font-bold text-sm text-slate-500 flex justify-between">
                             <span>Etapa</span><span>Status & Prazo</span>
                         </div>
                         <div className="divide-y divide-slate-100 dark:divide-slate-800">
                             {steps.map(step => {
                                 const isDone = step.status === StepStatus.COMPLETED;
                                 const isInProgress = step.status === StepStatus.IN_PROGRESS;
                                 const isNotStarted = step.status === StepStatus.NOT_STARTED;
                                 const isLate = !isDone && new Date(step.endDate) < new Date();

                                 return (
                                     <div key={step.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors break-inside-avoid">
                                         <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white ${isDone ? 'bg-green-500' : isLate ? 'bg-red-500' : isInProgress ? 'bg-orange-500' : 'bg-slate-300'}`}>
                                                 <i className={`fa-solid ${isDone ? 'fa-check' : isLate ? 'fa-exclamation' : isInProgress ? 'fa-play' : 'fa-clock'}`}></i>
                                             </div>
                                             <div>
                                                 <p className={`font-bold text-sm ${isDone ? 'text-slate-400 line-through' : 'text-primary dark:text-white'}`}>{step.name}</p>
                                                 <p className="text-xs text-slate-400">Previsto: {formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}</p>
                                             </div>
                                         </div>
                                         <div className="text-right">
                                             {isLate && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Atrasado</span>}
                                             {isDone && <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Feito</span>}
                                             {isInProgress && !isLate && <span className="bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> Em Andamento</span>}
                                             {isNotStarted && !isLate && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Planejamento</span>}
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

const WorkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation State
  const [subView, setSubView] = useState<'NONE' | 'TEAM' | 'SUPPLIERS' | 'PHOTOS' | 'FILES' | 'REPORTS'>('NONE');
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STEPS' | 'FINANCE' | 'MATERIALS' | 'AI'>('OVERVIEW');

  // Data State for Main View
  const [steps, setSteps] = useState<Step[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  // AI Chat State
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{sender: 'USER'|'AI', text: string}[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Modals
  const [zeModal, setZeModal] = useState({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // Load Work Data
  const loadData = async () => {
      if (!id) return;
      setLoading(true);
      const w = await dbService.getWorkById(id);
      if (!w) {
          navigate('/');
          return;
      }
      setWork(w);
      
      const [s, e, m] = await Promise.all([
          dbService.getSteps(id),
          dbService.getExpenses(id),
          dbService.getMaterials(id)
      ]);
      setSteps(s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
      setExpenses(e.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setMaterials(m);
      setLoading(false);
  };

  useEffect(() => {
      loadData();
  }, [id]);

  // AI Handler
  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!chatMessage.trim()) return;
      
      const userMsg = chatMessage;
      setChatHistory(prev => [...prev, { sender: 'USER', text: userMsg }]);
      setChatMessage('');
      setAiLoading(true);

      const response = await aiService.sendMessage(userMsg);
      
      setChatHistory(prev => [...prev, { sender: 'AI', text: response }]);
      setAiLoading(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-primary"><i className="fa-solid fa-circle-notch fa-spin text-4xl"></i></div>;
  if (!work) return null;

  // Render Sub Views
  if (subView === 'TEAM') return <div className="p-4 md:p-8"><ContactsView mode="TEAM" onBack={() => setSubView('NONE')} /></div>;
  if (subView === 'SUPPLIERS') return <div className="p-4 md:p-8"><ContactsView mode="SUPPLIERS" onBack={() => setSubView('NONE')} /></div>;
  if (subView === 'PHOTOS') return <div className="p-4 md:p-8 h-screen"><PhotosView workId={work.id} onBack={() => setSubView('NONE')} /></div>;
  if (subView === 'FILES') return <div className="p-4 md:p-8 h-screen"><FilesView workId={work.id} onBack={() => setSubView('NONE')} /></div>;
  if (subView === 'REPORTS') return <div className="p-4 md:p-8"><ReportsView workId={work.id} onBack={() => setSubView('NONE')} /></div>;

  // Helper to render Tab Button
  const TabBtn = ({ id, label, icon }: any) => (
      <button 
        onClick={() => setActiveTab(id)} 
        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${activeTab === id ? 'text-secondary font-bold' : 'text-slate-400 hover:text-slate-600'}`}
      >
          <i className={`fa-solid ${icon} text-xl mb-1`}></i>
          <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </button>
  );

  return (
    <div className="pb-24 md:pb-0">
       {/* HEADER Mobile/Desktop */}
       <div className="flex justify-between items-center mb-6">
           <div>
               <button onClick={() => navigate('/')} className="text-slate-400 text-xs font-bold uppercase tracking-widest hover:text-primary mb-1">
                   <i className="fa-solid fa-chevron-left"></i> Painel Geral
               </button>
               <h1 className="text-2xl font-extrabold text-primary dark:text-white leading-none">{work.name}</h1>
           </div>
           
           <div className="flex gap-2">
               <button onClick={() => setSubView('REPORTS')} className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700" title="Relatórios">
                   <i className="fa-solid fa-chart-pie"></i>
               </button>
               <div className="relative group">
                   <button className="w-10 h-10 rounded-xl bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center">
                       <i className="fa-solid fa-ellipsis-vertical"></i>
                   </button>
                   <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-2">
                       <button onClick={() => setSubView('TEAM')} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2"><i className="fa-solid fa-helmet-safety w-5"></i> Equipe</button>
                       <button onClick={() => setSubView('SUPPLIERS')} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2"><i className="fa-solid fa-truck w-5"></i> Fornecedores</button>
                       <button onClick={() => setSubView('PHOTOS')} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2"><i className="fa-solid fa-camera w-5"></i> Fotos</button>
                       <button onClick={() => setSubView('FILES')} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center gap-2"><i className="fa-solid fa-folder w-5"></i> Arquivos</button>
                   </div>
               </div>
           </div>
       </div>

       {/* MAIN TABS CONTENT */}
       <div className="animate-in fade-in slide-in-from-bottom-4">
           
           {/* OVERVIEW */}
           {activeTab === 'OVERVIEW' && (
               <div className="space-y-6">
                   {/* Summary Cards */}
                   <div className="grid grid-cols-2 gap-4">
                       <div className="bg-gradient-to-br from-primary to-slate-800 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                           <p className="text-xs uppercase opacity-70 font-bold mb-1">Gasto Total</p>
                           <p className="text-2xl font-bold">R$ {expenses.reduce((acc, e) => acc + (e.paidAmount || 0), 0).toLocaleString('pt-BR')}</p>
                           <p className="text-[10px] mt-2 opacity-60">Planejado: R$ {work.budgetPlanned.toLocaleString('pt-BR')}</p>
                       </div>
                       <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
                           <p className="text-xs uppercase text-slate-400 font-bold mb-1">Progresso</p>
                           <div className="flex items-end gap-2">
                               <span className="text-3xl font-bold text-primary dark:text-white">{Math.round((steps.filter(s => s.status === StepStatus.COMPLETED).length / Math.max(1, steps.length)) * 100)}%</span>
                               <span className="text-xs text-slate-500 mb-1.5">concluído</span>
                           </div>
                           <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                               <div className="h-full bg-secondary" style={{width: `${(steps.filter(s => s.status === StepStatus.COMPLETED).length / Math.max(1, steps.length)) * 100}%`}}></div>
                           </div>
                       </div>
                   </div>

                   {/* Next Steps */}
                   <div>
                       <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Próximos Passos</h3>
                       <div className="space-y-3">
                           {steps.filter(s => s.status !== StepStatus.COMPLETED).slice(0, 3).map(step => (
                               <div key={step.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                       <div className={`w-2 h-10 rounded-full ${new Date(step.startDate) <= new Date() ? 'bg-orange-500' : 'bg-slate-300'}`}></div>
                                       <div>
                                           <p className="font-bold text-primary dark:text-white text-sm">{step.name}</p>
                                           <p className="text-xs text-slate-500">{formatDateDisplay(step.startDate)}</p>
                                       </div>
                                   </div>
                                   {new Date(step.startDate) <= new Date() && <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded">AGORA</span>}
                               </div>
                           ))}
                           {steps.filter(s => s.status !== StepStatus.COMPLETED).length === 0 && (
                               <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                   <p className="text-slate-400 text-sm">Obra finalizada! 🎉</p>
                               </div>
                           )}
                       </div>
                   </div>
               </div>
           )}

           {/* STEPS TAB (Simple View) */}
           {activeTab === 'STEPS' && (
               <div className="space-y-4">
                   <div className="flex justify-between items-center">
                       <h3 className="text-lg font-bold text-primary dark:text-white">Cronograma</h3>
                       <button className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-1.5 rounded-lg" onClick={() => setSubView('REPORTS')}>Ver Detalhado</button>
                   </div>
                   <div className="space-y-2">
                       {steps.map(step => (
                           <div key={step.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group">
                               <div className="flex items-center gap-3 overflow-hidden">
                                   <button 
                                      onClick={async () => {
                                          const nextStatus = step.status === StepStatus.COMPLETED ? StepStatus.NOT_STARTED : StepStatus.COMPLETED;
                                          await dbService.updateStep({...step, status: nextStatus});
                                          loadData();
                                      }}
                                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${step.status === StepStatus.COMPLETED ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-green-500'}`}
                                   >
                                       <i className="fa-solid fa-check text-xs"></i>
                                   </button>
                                   <span className={`text-sm font-medium truncate ${step.status === StepStatus.COMPLETED ? 'text-slate-400 line-through' : 'text-primary dark:text-white'}`}>{step.name}</span>
                               </div>
                               <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateDisplay(step.endDate)}</span>
                           </div>
                       ))}
                   </div>
               </div>
           )}

            {/* FINANCE TAB (Simple View) */}
            {activeTab === 'FINANCE' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-primary dark:text-white">Gastos Recentes</h3>
                        <button className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-1.5 rounded-lg" onClick={() => setSubView('REPORTS')}>Ver Relatório</button>
                    </div>
                    {/* Simplified for brevity - in real app would have add expense modal */}
                    <div className="space-y-2">
                        {expenses.slice(0, 10).map(expense => (
                            <div key={expense.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-primary dark:text-white">{expense.description}</p>
                                    <p className="text-xs text-slate-500">{expense.category} • {formatDateDisplay(expense.date)}</p>
                                </div>
                                <span className="text-sm font-bold text-primary dark:text-white">R$ {expense.amount.toLocaleString('pt-BR')}</span>
                            </div>
                        ))}
                         {expenses.length === 0 && <p className="text-center text-slate-400 py-8">Nenhum gasto lançado.</p>}
                    </div>
                </div>
            )}

            {/* MATERIALS TAB (Simple View) */}
            {activeTab === 'MATERIALS' && (
                <div className="space-y-4">
                     <h3 className="text-lg font-bold text-primary dark:text-white">Lista de Materiais</h3>
                     <div className="space-y-2">
                         {materials.map(mat => (
                             <div key={mat.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                 <div>
                                     <p className="text-sm font-bold text-primary dark:text-white">{mat.name}</p>
                                     <p className="text-xs text-slate-500">{mat.purchasedQty} / {mat.plannedQty} {mat.unit}</p>
                                 </div>
                                 {mat.purchasedQty >= mat.plannedQty ? (
                                     <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-1 rounded">OK</span>
                                 ) : (
                                     <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded">COMPRAR</span>
                                 )}
                             </div>
                         ))}
                         {materials.length === 0 && <p className="text-center text-slate-400 py-8">Nenhum material cadastrado.</p>}
                     </div>
                </div>
            )}

           {/* AI CHAT TAB */}
           {activeTab === 'AI' && (
               <div className="flex flex-col h-[60vh]">
                   <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 overflow-y-auto space-y-4 mb-4">
                       {/* Welcome Message */}
                       <div className="flex gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                               <img src={ZE_AVATAR} alt="Zé" className="w-full h-full object-cover" onError={(e:any) => e.target.src = ZE_AVATAR_FALLBACK}/>
                           </div>
                           <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl text-sm text-slate-700 dark:text-slate-300">
                               Fala parceiro! Eu sou o Zé. Pode perguntar qualquer coisa sobre sua obra que eu ajudo.
                           </div>
                       </div>
                       
                       {chatHistory.map((msg, idx) => (
                           <div key={idx} className={`flex gap-3 ${msg.sender === 'USER' ? 'flex-row-reverse' : ''}`}>
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${msg.sender === 'USER' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                   {msg.sender === 'USER' ? <span className="text-xs font-bold">{user?.name.charAt(0)}</span> : <img src={ZE_AVATAR} alt="Zé" className="w-full h-full object-cover" onError={(e:any) => e.target.src = ZE_AVATAR_FALLBACK}/>}
                               </div>
                               <div className={`p-3 max-w-[80%] text-sm ${msg.sender === 'USER' ? 'bg-primary text-white rounded-tl-xl rounded-bl-xl rounded-br-xl' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tr-xl rounded-br-xl rounded-bl-xl'}`}>
                                   {msg.text}
                               </div>
                           </div>
                       ))}
                       {aiLoading && (
                           <div className="flex gap-3">
                               <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0"><i className="fa-solid fa-circle-notch fa-spin text-slate-400"></i></div>
                               <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-xs text-slate-400 italic">Digitando...</div>
                           </div>
                       )}
                   </div>
                   <form onSubmit={handleSendMessage} className="flex gap-2">
                       <input 
                          value={chatMessage}
                          onChange={e => setChatMessage(e.target.value)}
                          placeholder="Ex: Qual o traço do concreto?" 
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 outline-none focus:border-secondary dark:text-white"
                       />
                       <button type="submit" disabled={aiLoading || !chatMessage.trim()} className="bg-secondary text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg disabled:opacity-50">
                           <i className="fa-solid fa-paper-plane"></i>
                       </button>
                   </form>
               </div>
           )}

       </div>

       {/* MOBILE TAB BAR */}
       <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2 md:hidden z-50 flex justify-between px-6 pb-safe">
           <TabBtn id="OVERVIEW" label="Resumo" icon="fa-house" />
           <TabBtn id="STEPS" label="Etapas" icon="fa-list-check" />
           <div className="-mt-8">
               <button onClick={() => setActiveTab('AI')} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-50 dark:border-slate-950 transition-transform active:scale-95 ${activeTab === 'AI' ? 'bg-secondary text-white' : 'bg-primary text-white'}`}>
                   <img src={ZE_AVATAR} className="w-full h-full object-cover rounded-full" onError={(e:any) => e.target.src = ZE_AVATAR_FALLBACK} />
               </button>
           </div>
           <TabBtn id="FINANCE" label="Gastos" icon="fa-wallet" />
           <TabBtn id="MATERIALS" label="Materiais" icon="fa-cart-shopping" />
       </div>
       
       <ZeModal isOpen={zeModal.isOpen} title={zeModal.title} message={zeModal.message} onConfirm={zeModal.onConfirm} onCancel={() => setZeModal({isOpen: false, title: '', message: '', onConfirm: () => {}})} />
    </div>
  );
};

export default WorkDetail;
