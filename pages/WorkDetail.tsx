import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Expense, Material, StepStatus, ExpenseCategory, WorkPhoto, WorkFile, PlanType } from '../types';
import { Recharts } from '../components/RechartsWrapper';
import { ZeModal } from '../components/ZeModal';
import { FULL_MATERIAL_PACKAGES, ZE_AVATAR, CALCULATOR_LOGIC, CONTRACT_TEMPLATES, STANDARD_CHECKLISTS } from '../services/standards';
import { useAuth } from '../App';
import { aiService } from '../services/ai';

// --- Shared Helpers ---
const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '--/--/----';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }
    try { return new Date(dateStr).toLocaleDateString('pt-BR'); } catch (e) { return dateStr; }
};

const SectionHeader: React.FC<{ title: string, subtitle: string, action?: React.ReactNode }> = ({ title, subtitle, action }) => (
    <div className="flex justify-between items-start mb-6">
        <div>
            <h2 className="text-2xl font-bold text-primary dark:text-white tracking-tight">{title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{subtitle}</p>
            <div className="h-1 w-10 bg-secondary rounded-full mt-3"></div>
        </div>
        {action && <div>{action}</div>}
    </div>
);

// ----------------------------------------------------------------------
// SUB-VIEWS
// ----------------------------------------------------------------------

const ContactsView: React.FC<{ mode: 'TEAM' | 'SUPPLIERS', onBack: () => void }> = ({ mode, onBack }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [options, setOptions] = useState<string[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState(''); 
    const [newPhone, setNewPhone] = useState('');
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
                const item = items.find(i => i.id === editingId);
                if (mode === 'TEAM') await dbService.updateWorker({ ...item, name: newName, role: newRole, phone: newPhone });
                else await dbService.updateSupplier({ ...item, name: newName, category: newRole, phone: newPhone });
            } else {
                if (mode === 'TEAM') await dbService.addWorker({ userId: user.id, name: newName, role: newRole, phone: newPhone });
                else await dbService.addSupplier({ userId: user.id, name: newName, category: newRole, phone: newPhone });
            }
            setIsAddOpen(false); setEditingId(null); setNewName(''); setNewRole(''); setNewPhone(''); loadData();
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4 pb-24">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <SectionHeader title={mode === 'TEAM' ? "Minha Equipe" : "Meus Fornecedores"} subtitle={mode === 'TEAM' ? "Profissionais cadastrados." : "Lojas e prestadores."} />
            <div className="space-y-3">
                {items.map(item => (
                    <div key={item.id} onClick={() => { setEditingId(item.id); setNewName(item.name); setNewRole(item.role||item.category); setNewPhone(item.phone); setIsAddOpen(true); }} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:border-secondary transition-all">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${mode === 'TEAM' ? 'bg-blue-500' : 'bg-indigo-500'}`}><i className={`fa-solid ${mode === 'TEAM' ? 'fa-helmet-safety' : 'fa-truck'}`}></i></div>
                            <div><h4 className="font-bold text-primary dark:text-white">{item.name}</h4><p className="text-xs text-slate-500">{(item as any).role || (item as any).category}</p></div>
                        </div>
                        <div className="flex gap-2">
                             <a href={`https://wa.me/55${item.phone.replace(/\D/g,'')}`} target="_blank" onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"><i className="fa-brands fa-whatsapp"></i></a>
                             <button onClick={(e) => { e.stopPropagation(); setZeModal({isOpen: true, title: "Remover", message: "Tem certeza?", onConfirm: async () => { if(mode==='TEAM') await dbService.deleteWorker(item.id); else await dbService.deleteSupplier(item.id); setZeModal({isOpen:false, title:'', message:'', onConfirm:()=>{}}); loadData(); }}); }} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><i className="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    </div>
                ))}
                <button onClick={() => { setEditingId(null); setNewName(''); setNewRole(''); setNewPhone(''); setIsAddOpen(true); }} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"><i className="fa-solid fa-plus"></i> Adicionar Novo</button>
            </div>
            {isAddOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">{editingId ? 'Editar' : 'Novo'}</h3>
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

const PhotosView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const loadPhotos = async () => { const p = await dbService.getPhotos(workId); setPhotos(p); };
    useEffect(() => { loadPhotos(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadPhoto(workId, e.target.files[0], 'PROGRESS'); loadPhotos(); }};
    return (
        <div className="animate-in fade-in slide-in-from-right-4 pb-24">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6"><SectionHeader title="Galeria" subtitle="Acompanhamento visual." /><label className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer"><i className="fa-solid fa-camera"></i><input type="file" className="hidden" accept="image/*" onChange={handleUpload} /></label></div>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{photos.map(p => (<div key={p.id} className="aspect-square rounded-xl overflow-hidden relative group"><img src={p.url} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><button onClick={async () => { await dbService.deletePhoto(p.id); loadPhotos(); }} className="text-white hover:text-red-400"><i className="fa-solid fa-trash"></i></button></div></div>))}</div>
             {photos.length === 0 && <p className="text-center text-slate-400 py-10">Nenhuma foto.</p>}
        </div>
    );
};

const FilesView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [files, setFiles] = useState<WorkFile[]>([]);
    const loadFiles = async () => { const f = await dbService.getFiles(workId); setFiles(f); };
    useEffect(() => { loadFiles(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadFile(workId, e.target.files[0], 'Geral'); loadFiles(); }};
    return (
        <div className="animate-in fade-in slide-in-from-right-4 pb-24">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6"><SectionHeader title="Projetos" subtitle="Plantas e documentos." /><label className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer"><i className="fa-solid fa-upload"></i><input type="file" className="hidden" onChange={handleUpload} /></label></div>
             <div className="space-y-3">{files.map(f => (<div key={f.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-xl"><i className="fa-solid fa-file-pdf"></i></div><div><h4 className="font-bold text-sm text-primary dark:text-white truncate max-w-[150px]">{f.name}</h4><p className="text-xs text-slate-500">{new Date(f.date).toLocaleDateString()}</p></div></div><div className="flex gap-3"><a href={f.url} target="_blank" className="text-secondary font-bold text-sm">Abrir</a><button onClick={async () => { await dbService.deleteFile(f.id); loadFiles(); }} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button></div></div>))}</div>
             {files.length === 0 && <p className="text-center text-slate-400 py-10">Nenhum arquivo.</p>}
        </div>
    );
};

const ReportsView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'MATERIALS' | 'STEPS'>('FINANCIAL');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [work, setWork] = useState<Work | undefined>();
    
    useEffect(() => {
        const loadAll = async () => { 
            const [exp, mat, stp, w] = await Promise.all([dbService.getExpenses(workId), dbService.getMaterials(workId), dbService.getSteps(workId), dbService.getWorkById(workId)]); 
            setExpenses(exp); setMaterials(mat); setSteps(stp.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())); setWork(w); 
        }; 
        loadAll();
    }, [workId]);

    const handlePrint = () => { window.print(); };
    
    const financialData = expenses.reduce((acc: any[], curr) => { const existing = acc.find((a: any) => a.name === curr.category); if (existing) existing.value += (Number(curr.amount) || 0); else acc.push({ name: curr.category, value: (Number(curr.amount) || 0) }); return acc; }, []);
    const totalSpent = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0); const totalPaid = expenses.reduce((acc, e) => acc + (Number(e.paidAmount) || 0), 0); const totalPending = totalSpent - totalPaid;
    const purchasedMaterials = materials.filter(m => m.purchasedQty >= m.plannedQty).length; const materialChartData = [{ name: 'Comprado', value: purchasedMaterials, fill: '#059669' }, { name: 'Pendente', value: materials.length - purchasedMaterials, fill: '#E2E8F0' }];
    const groupedMaterials: Record<string, Material[]> = {}; materials.forEach(m => { const cat = m.category || 'Geral'; if (!groupedMaterials[cat]) groupedMaterials[cat] = []; groupedMaterials[cat].push(m); });
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length; const delayedSteps = steps.filter(s => s.isDelayed).length; const totalSteps = steps.length;

    return (
        <div className="animate-in fade-in slide-in-from-right-4 bg-white dark:bg-slate-950 min-h-screen pb-24">
             <div className="hidden print:block mb-8 border-b-2 border-black pb-4"><h1 className="text-3xl font-bold uppercase">{work?.name || "Relatório"}</h1><p className="text-sm">Endereço: {work?.address}</p></div>
             <div className="flex justify-between items-center mb-6 print:hidden"><button onClick={onBack} className="text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button><div className="flex gap-2"><button onClick={handlePrint} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2"><i className="fa-solid fa-print"></i> PDF</button></div></div>
             <SectionHeader title="Relatórios" subtitle="Visão geral do progresso." />
             <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6 print:hidden">{[{ id: 'FINANCIAL', label: 'Financeiro', icon: 'fa-wallet' }, { id: 'MATERIALS', label: 'Compras', icon: 'fa-cart-shopping' }, { id: 'STEPS', label: 'Etapas', icon: 'fa-list-check' }].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><i className={`fa-solid ${tab.icon}`}></i> {tab.label}</button>))}</div>
             {activeTab === 'FINANCIAL' && (<div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Total Gasto</p><p className="text-2xl font-bold text-primary dark:text-white">R$ {totalSpent.toLocaleString('pt-BR')}</p></div><div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Valor Pago</p><p className="text-2xl font-bold text-green-600">R$ {totalPaid.toLocaleString('pt-BR')}</p></div><div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">A Pagar</p><p className="text-2xl font-bold text-red-500">R$ {totalPending.toLocaleString('pt-BR')}</p></div></div><div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"><div className="h-64"><Recharts.ResponsiveContainer width="100%" height="100%"><Recharts.BarChart data={financialData}><Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} /><Recharts.XAxis dataKey="name" tick={{fontSize: 10}} /><Recharts.YAxis /><Recharts.Tooltip /><Recharts.Bar dataKey="value" fill="#D97706" radius={[6, 6, 0, 0]} barSize={40} /></Recharts.BarChart></Recharts.ResponsiveContainer></div></div></div>)}
             {activeTab === 'MATERIALS' && (<div className="space-y-6 animate-in fade-in"><div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center"><div className="w-40 h-40 relative"><Recharts.ResponsiveContainer width="100%" height="100%"><Recharts.PieChart><Recharts.Pie data={materialChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" cornerRadius={5} /></Recharts.PieChart></Recharts.ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-primary dark:text-white">{purchasedMaterials}</span><span className="text-[10px] text-slate-400 uppercase">Comprados</span></div></div></div></div>)}
             {activeTab === 'STEPS' && (<div className="space-y-6 animate-in fade-in"><div className="flex gap-4 mb-4 overflow-x-auto pb-2"><div className="flex-1 min-w-[120px] bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-900/30 text-center"><p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedSteps}</p><p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Concluídas</p></div><div className="flex-1 min-w-[120px] bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center"><p className="text-2xl font-bold text-red-600 dark:text-red-400">{delayedSteps}</p><p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase">Atrasadas</p></div><div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{totalSteps}</p><p className="text-xs font-bold text-slate-500 uppercase">Total Etapas</p></div></div></div>)}
        </div>
    );
};

const CalculatorView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [type, setType] = useState('FLOOR');
    const [inputs, setInputs] = useState({ area: '', width: '', height: '', rooms: '', bathrooms: '' });
    const [result, setResult] = useState<any>(null);

    const calculate = () => {
        if (type === 'FLOOR') setResult(CALCULATOR_LOGIC.FLOOR(Number(inputs.area)));
        if (type === 'WALL') setResult(CALCULATOR_LOGIC.WALL(Number(inputs.width), Number(inputs.height)));
        if (type === 'PAINT') setResult(CALCULATOR_LOGIC.PAINT(Number(inputs.area)));
        if (type === 'ESTIMATOR') setResult(CALCULATOR_LOGIC.ESTIMATOR(Number(inputs.bathrooms), Number(inputs.rooms)));
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4 pb-24">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <SectionHeader title="Calculadoras" subtitle="Estimativas rápidas de material." />
             <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
                 {['FLOOR', 'WALL', 'PAINT', 'ESTIMATOR'].map(t => (
                     <button key={t} onClick={() => { setType(t); setResult(null); }} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${type === t ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                         {t === 'FLOOR' ? 'Pisos' : t === 'WALL' ? 'Paredes' : t === 'PAINT' ? 'Pintura' : 'Elétrica'}
                     </button>
                 ))}
             </div>
             <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                 <div className="space-y-4 mb-6">
                     {(type === 'FLOOR' || type === 'PAINT') && <div><label className="block text-xs font-bold uppercase text-slate-400 mb-1">Área Total (m²)</label><input type="number" value={inputs.area} onChange={e => setInputs({...inputs, area: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 outline-none" placeholder="Ex: 20" /></div>}
                     {type === 'WALL' && <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold uppercase text-slate-400 mb-1">Largura (m)</label><input type="number" value={inputs.width} onChange={e => setInputs({...inputs, width: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 outline-none" /></div><div><label className="block text-xs font-bold uppercase text-slate-400 mb-1">Altura (m)</label><input type="number" value={inputs.height} onChange={e => setInputs({...inputs, height: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 outline-none" /></div></div>}
                     {type === 'ESTIMATOR' && <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold uppercase text-slate-400 mb-1">Quartos/Salas</label><input type="number" value={inputs.rooms} onChange={e => setInputs({...inputs, rooms: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 outline-none" /></div><div><label className="block text-xs font-bold uppercase text-slate-400 mb-1">Banheiros</label><input type="number" value={inputs.bathrooms} onChange={e => setInputs({...inputs, bathrooms: e.target.value})} className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 outline-none" /></div></div>}
                     <button onClick={calculate} className="w-full py-3 bg-secondary text-white font-bold rounded-xl shadow-lg">Calcular</button>
                 </div>
                 {result && (
                     <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                         <h4 className="font-bold text-primary dark:text-white mb-3 border-b pb-2 border-slate-200 dark:border-slate-700">Resultado Estimado:</h4>
                         <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                             {Object.entries(result).map(([k, v]) => (
                                 <li key={k} className="flex justify-between"><span className="capitalize">{k}</span> <span className="font-bold">{String(v)}</span></li>
                             ))}
                         </ul>
                     </div>
                 )}
             </div>
        </div>
    )
};

const ContractsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [selected, setSelected] = useState<string | null>(null);
    const tmpl = CONTRACT_TEMPLATES.find(t => t.id === selected);
    return (
        <div className="animate-in fade-in slide-in-from-right-4 pb-24">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <SectionHeader title="Modelos de Contrato" subtitle="Documentos prontos para usar." />
             {!selected ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {CONTRACT_TEMPLATES.map(t => (
                         <div key={t.id} onClick={() => setSelected(t.id)} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary cursor-pointer transition-all shadow-sm">
                             <h3 className="font-bold text-primary dark:text-white mb-1">{t.title}</h3>
                             <p className="text-xs text-slate-500">{t.description}</p>
                         </div>
                     ))}
                 </div>
             ) : (
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg dark:text-white">{tmpl?.title}</h3>
                        <button onClick={() => setSelected(null)} className="text-sm text-slate-400">Fechar</button>
                     </div>
                     <div className="bg-slate-50 dark:bg-black/30 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap dark:text-slate-300 mb-4 h-64 overflow-y-auto border border-slate-200 dark:border-slate-700">
                         {tmpl?.contentTemplate}
                     </div>
                     <button onClick={() => { navigator.clipboard.writeText(tmpl?.contentTemplate || ''); alert('Copiado!'); }} className="w-full py-3 bg-primary text-white font-bold rounded-xl"><i className="fa-solid fa-copy"></i> Copiar Texto</button>
                 </div>
             )}
        </div>
    );
};

const ChecklistsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    return (
        <div className="animate-in fade-in slide-in-from-right-4 pb-24">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <SectionHeader title="Checklists" subtitle="Não esqueça de nada." />
             <div className="space-y-4">
                 {STANDARD_CHECKLISTS.map((list, i) => (
                     <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                         <h3 className="font-bold text-primary dark:text-white mb-3">{list.category}</h3>
                         <ul className="space-y-2">
                             {list.items.map((item, j) => (
                                 <li key={j} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                                     <input type="checkbox" className="mt-1" />
                                     <span>{item}</span>
                                 </li>
                             ))}
                         </ul>
                     </div>
                 ))}
             </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// MAIN TABS
// ----------------------------------------------------------------------

const OverviewTab: React.FC<{ work: Work }> = ({ work }) => {
    const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });
    const load = async () => { const s = await dbService.calculateWorkStats(work.id); setStats(s); };
    useEffect(() => { load(); }, [work]);
    
    return (
        <div className="animate-in fade-in space-y-6 pb-24">
            <div className="bg-gradient-premium p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                 <div className="relative z-10">
                     <p className="text-xs uppercase tracking-widest opacity-70 font-bold mb-1">Gasto Total</p>
                     <p className="text-4xl font-extrabold mb-6 tracking-tight">R$ {stats.totalSpent.toLocaleString('pt-BR')}</p>
                     <div className="flex gap-8">
                         <div>
                             <p className="text-[10px] opacity-70 uppercase font-bold">Orçamento</p>
                             <p className="font-bold text-lg">R$ {work.budgetPlanned.toLocaleString('pt-BR')}</p>
                         </div>
                         <div>
                             <p className="text-[10px] opacity-70 uppercase font-bold">Progresso</p>
                             <p className="font-bold text-lg">{stats.progress}%</p>
                         </div>
                     </div>
                 </div>
            </div>
            
             <div className="flex items-start gap-4 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
                <div className="w-12 h-12 rounded-full bg-slate-100 shrink-0"><img src={ZE_AVATAR} className="w-full h-full rounded-full" /></div>
                <div><h4 className="font-bold text-sm text-primary dark:text-white">Dica do Zé</h4><p className="text-sm text-slate-500 italic mt-1 leading-relaxed">"Mantenha as notas fiscais organizadas. Se sobrar material, algumas lojas aceitam devolução! E não esqueça de conferir a entrega."</p></div>
             </div>
        </div>
    );
};

const StepsTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [steps, setSteps] = useState<Step[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingStep, setEditingStep] = useState<Step | null>(null);
    const [formData, setFormData] = useState({ name: '', startDate: '', endDate: '' });

    const load = async () => { const s = await dbService.getSteps(workId); setSteps(s.sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())); };
    useEffect(() => { load(); }, [workId]);
    
    const toggle = async (e: React.MouseEvent, step: Step) => {
        e.stopPropagation();
        const newStatus = step.status === StepStatus.COMPLETED ? StepStatus.NOT_STARTED : StepStatus.COMPLETED;
        await dbService.updateStep({...step, status: newStatus});
        await load(); onUpdate();
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingStep) {
            await dbService.updateStep({ ...editingStep, name: formData.name, startDate: formData.startDate, endDate: formData.endDate });
        } else {
            await dbService.addStep({ workId, name: formData.name, startDate: formData.startDate, endDate: formData.endDate, status: StepStatus.NOT_STARTED });
        }
        setIsAddOpen(false); setEditingStep(null); setFormData({name: '', startDate: '', endDate: ''});
        await load(); onUpdate();
    };

    const openEdit = (step: Step) => {
        setEditingStep(step);
        setFormData({ name: step.name, startDate: step.startDate, endDate: step.endDate });
        setIsAddOpen(true);
    };

    return (
        <div className="animate-in fade-in pb-28 relative min-h-full">
            <SectionHeader title="Cronograma" subtitle="Toque para editar, clique no check para concluir." />
            
            <div className="space-y-3">
                {steps.map(s => (
                    <div 
                        key={s.id} 
                        onClick={() => openEdit(s)}
                        className={`group p-4 rounded-2xl border bg-white dark:bg-slate-900 flex items-center justify-between cursor-pointer transition-all active:scale-[0.98] ${s.status === StepStatus.COMPLETED ? 'border-green-200 opacity-60' : 'border-slate-100 dark:border-slate-800 hover:border-secondary/50'}`}
                    >
                        <div className="flex items-center gap-4">
                             <button 
                                onClick={(e) => toggle(e, s)} 
                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${s.status === StepStatus.COMPLETED ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent hover:border-primary'}`}
                             >
                                 <i className="fa-solid fa-check text-xs font-bold"></i>
                             </button>
                             <div>
                                 <p className={`font-bold text-sm ${s.status === StepStatus.COMPLETED ? 'line-through text-slate-400' : 'text-primary dark:text-white'}`}>{s.name}</p>
                                 <p className="text-xs text-slate-400 font-medium">{formatDateDisplay(s.startDate)} - {formatDateDisplay(s.endDate)}</p>
                             </div>
                        </div>
                        {s.isDelayed && s.status !== StepStatus.COMPLETED && <div className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded">Atrasado</div>}
                        <i className="fa-solid fa-pencil text-slate-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"></i>
                    </div>
                ))}
                {steps.length === 0 && <div className="text-center py-10 text-slate-400">Nenhuma etapa cadastrada.</div>}
            </div>

            {/* Floating Action Button */}
            <button 
                onClick={() => { setEditingStep(null); setFormData({name: '', startDate: '', endDate: ''}); setIsAddOpen(true); }}
                className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40"
            >
                <i className="fa-solid fa-plus text-xl"></i>
            </button>

            {isAddOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editingStep ? 'Editar Etapa' : 'Nova Etapa'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase">Nome da Tarefa</label>
                                <input className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Início</label>
                                    <input type="date" className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} required />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase">Fim</label>
                                    <input type="date" className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} required />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                            </div>
                            {editingStep && (
                                <button type="button" onClick={async () => { await dbService.deleteStep(editingStep.id); setIsAddOpen(false); await load(); onUpdate(); }} className="w-full py-2 text-red-500 text-xs font-bold">Excluir Etapa</button>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const MaterialsTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    
    // Split State for clarity and specific "New Purchase" logic
    const [detailsData, setDetailsData] = useState({ name: '', plannedQty: 0, unit: '', category: '' });
    const [purchaseData, setPurchaseData] = useState({ qtyNow: '', costNow: '' });

    const load = async () => { const m = await dbService.getMaterials(workId); setMaterials(m); };
    useEffect(() => { load(); }, [workId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingMaterial) {
            // Update Basic Details
            const updatedMaterial = {
                ...editingMaterial,
                name: detailsData.name,
                plannedQty: Number(detailsData.plannedQty),
                unit: detailsData.unit,
                category: detailsData.category
            };
            
            const qtyBuying = Number(purchaseData.qtyNow);
            const costBuying = Number(purchaseData.costNow);

            if (qtyBuying > 0) {
                updatedMaterial.purchasedQty += qtyBuying;
            }

            // Calls DB update: 
            // 1. Updates Material Record (new total purchased)
            // 2. Creates Expense Record (using ONLY costBuying)
            await dbService.updateMaterial(updatedMaterial, costBuying, qtyBuying);
        } else {
            // Create New
            await dbService.addMaterial({
                workId,
                name: detailsData.name,
                plannedQty: Number(detailsData.plannedQty),
                purchasedQty: 0,
                unit: detailsData.unit,
                category: detailsData.category
            });
        }
        setIsAddOpen(false); setEditingMaterial(null);
        setDetailsData({ name: '', plannedQty: 0, unit: '', category: '' });
        setPurchaseData({ qtyNow: '', costNow: '' });
        await load(); onUpdate();
    };

    const handleImport = async (category: string) => {
        await dbService.importMaterialPackage(workId, category);
        setIsImportOpen(false);
        await load(); onUpdate();
    };

    const openEdit = (m: Material) => {
        setEditingMaterial(m);
        setDetailsData({
            name: m.name,
            plannedQty: m.plannedQty,
            unit: m.unit,
            category: m.category || 'Geral'
        });
        setPurchaseData({ qtyNow: '', costNow: '' });
        setIsAddOpen(true);
    };
    
    // Grouping
    const grouped: Record<string, Material[]> = {};
    materials.forEach(m => {
        const cat = m.category || 'Geral';
        if(!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(m);
    });

    return (
        <div className="animate-in fade-in pb-28 relative min-h-full">
            <div className="flex justify-between items-start mb-6">
                <SectionHeader title="Materiais" subtitle="Lista de compras." />
                <button onClick={() => setIsImportOpen(true)} className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-2 rounded-lg hover:bg-secondary/20 transition-colors">
                    <i className="fa-solid fa-cloud-arrow-down mr-1"></i> Pacotes
                </button>
            </div>

            <div className="space-y-6">
                {Object.keys(grouped).sort().map(cat => (
                    <div key={cat}>
                        <h3 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-3 border-b border-slate-100 dark:border-slate-800 pb-1">{cat}</h3>
                        <div className="space-y-3">
                            {grouped[cat].map(m => {
                                const percentage = m.plannedQty > 0 ? (m.purchasedQty / m.plannedQty) * 100 : 0;
                                const isComplete = m.purchasedQty >= m.plannedQty;
                                return (
                                    <div key={m.id} onClick={() => openEdit(m)} className={`bg-white dark:bg-slate-900 border p-4 rounded-xl flex items-center justify-between cursor-pointer hover:border-secondary transition-all ${isComplete ? 'border-green-200 opacity-70' : 'border-slate-100 dark:border-slate-800'}`}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className={`font-bold text-sm ${isComplete ? 'text-slate-500 line-through' : 'text-primary dark:text-white'}`}>{m.name}</h4>
                                                {isComplete && <i className="fa-solid fa-check text-green-500 text-xs"></i>}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="font-bold">{m.purchasedQty}</span> / {m.plannedQty} {m.unit}
                                            </div>
                                        </div>
                                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden ml-4">
                                            <div className={`h-full ${isComplete ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {materials.length === 0 && <div className="text-center py-10 text-slate-400">Nenhum material cadastrado.</div>}
            </div>

            <button 
                onClick={() => { setEditingMaterial(null); setDetailsData({ name: '', plannedQty: 0, unit: 'un', category: 'Geral' }); setPurchaseData({qtyNow: '', costNow: ''}); setIsAddOpen(true); }}
                className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40"
            >
                <i className="fa-solid fa-plus text-xl"></i>
            </button>

            {isAddOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editingMaterial ? 'Gerenciar Material' : 'Novo Material'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            
                            {/* --- STATS SECTION (READ ONLY) --- */}
                            {editingMaterial && (
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-2">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-500 font-medium">Planejado: <b className="text-primary dark:text-white">{editingMaterial.plannedQty}</b></span>
                                        <span className="text-slate-500 font-medium">Em Estoque: <b className="text-primary dark:text-white">{editingMaterial.purchasedQty}</b></span>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                         <div className="bg-primary h-2 rounded-full transition-all" style={{width: `${Math.min(100, (editingMaterial.purchasedQty/Math.max(1, editingMaterial.plannedQty))*100)}%`}}></div>
                                    </div>
                                </div>
                            )}

                            {/* --- NEW PURCHASE SECTION (EDIT ONLY) --- */}
                            {editingMaterial && (
                                <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-2xl border border-orange-100 dark:border-orange-900 mb-4 shadow-sm">
                                    <h4 className="font-bold text-orange-600 dark:text-orange-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <i className="fa-solid fa-cart-plus"></i> Registrar Nova Compra
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Qtd. Comprando Agora</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none font-bold text-lg" 
                                                value={purchaseData.qtyNow}
                                                onChange={e => setPurchaseData({...purchaseData, qtyNow: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Valor Pago (R$)</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none font-bold text-lg" 
                                                value={purchaseData.costNow}
                                                onChange={e => setPurchaseData({...purchaseData, costNow: e.target.value})}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">
                                        Ao salvar, adicionaremos <b>{purchaseData.qtyNow || 0} {detailsData.unit}</b> ao estoque e lançaremos <b>R$ {purchaseData.costNow || 0}</b> nos gastos.
                                    </p>
                                </div>
                            )}

                            {/* --- EDIT DETAILS SECTION --- */}
                            <div className="space-y-3 pt-2">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detalhes do Item</p>
                                <div>
                                    <input className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" placeholder="Nome do Material" value={detailsData.name} onChange={e => setDetailsData({...detailsData, name: e.target.value})} required />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <input type="number" className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" placeholder="Qtd Planejada" value={detailsData.plannedQty} onChange={e => setDetailsData({...detailsData, plannedQty: Number(e.target.value)})} required />
                                    </div>
                                    <div>
                                        <input className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" placeholder="Unidade" value={detailsData.unit} onChange={e => setDetailsData({...detailsData, unit: e.target.value})} required />
                                    </div>
                                </div>
                                <div>
                                    <input className="w-full p-3 rounded-xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" placeholder="Categoria (Ex: Elétrica)" value={detailsData.category} onChange={e => setDetailsData({...detailsData, category: e.target.value})} />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Salvar</button>
                            </div>
                            {editingMaterial && (
                                <button type="button" onClick={async () => { await dbService.deleteMaterial(editingMaterial.id); setIsAddOpen(false); await load(); onUpdate(); }} className="w-full py-2 text-red-500 text-xs font-bold">Excluir Material</button>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {isImportOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-primary dark:text-white">Importar Pacote</h3>
                            <button onClick={() => setIsImportOpen(false)} className="text-slate-400 hover:text-primary"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {FULL_MATERIAL_PACKAGES.map((pkg, i) => (
                                <button key={i} onClick={() => handleImport(pkg.category)} className="w-full text-left p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex justify-between items-center group transition-colors">
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{pkg.category}</span>
                                    <i className="fa-solid fa-download text-slate-300 group-hover:text-primary"></i>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ExpensesTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [groupedExpenses, setGroupedExpenses] = useState<Record<string, {total: number, items: Expense[]}>>({});
    const [steps, setSteps] = useState<Step[]>([]);
    
    // Default values for new expenses
    const [formData, setFormData] = useState<Partial<Expense>>({ date: new Date().toISOString().split('T')[0], category: ExpenseCategory.MATERIAL, amount: 0, paidAmount: 0, description: '', stepId: 'geral' });
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // "Pay Now" field for partial payments logic
    const [payNowAmount, setPayNowAmount] = useState<string>('');
    const [existingPaidAmount, setExistingPaidAmount] = useState<number>(0);

    const load = async () => { 
        const [exp, stp] = await Promise.all([dbService.getExpenses(workId), dbService.getSteps(workId)]); 
        setSteps(stp); 
        const grouped: Record<string, {total: number, items: Expense[]}> = {}; 
        
        const getStepName = (id?: string) => { 
            if (!id || id === 'geral') return 'Geral'; 
            const s = stp.find(st => st.id === id); 
            return s ? s.name : 'Outros'; 
        }; 
        
        exp.forEach(e => { 
            const groupName = getStepName(e.stepId); 
            if (!grouped[groupName]) grouped[groupName] = { total: 0, items: [] }; 
            grouped[groupName].items.push(e); 
            grouped[groupName].total += (Number(e.paidAmount) || 0); 
        }); 
        setGroupedExpenses(grouped); 
    };
    
    useEffect(() => { load(); }, [workId]);

    const handleSave = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        let finalPaidAmount = Number(formData.paidAmount);
        // Logic change: If editing, 'Pay Now' is additive. If creating, 'Pay Now' is the initial payment.
        // But current implementation relies on formData.paidAmount which might be confusing.
        // Let's force the logic based on 'payNowAmount'.
        
        if (editingId) {
            // Edit Mode: New Total Paid = Old Total Paid (static) + Pay Now Input
            finalPaidAmount = existingPaidAmount + (Number(payNowAmount) || 0);
        } else {
            // New Mode: Total Paid = Pay Now Input
            finalPaidAmount = Number(payNowAmount) || 0;
        }

        const payload = { 
            workId, 
            description: formData.description!, 
            amount: Number(formData.amount), // Total Agreed
            paidAmount: finalPaidAmount, 
            category: formData.category!, 
            date: formData.date!, 
            stepId: formData.stepId === 'geral' ? undefined : formData.stepId, 
            quantity: 1 
        }; 
        
        if (editingId) await dbService.updateExpense({ ...payload, id: editingId } as Expense); 
        else await dbService.addExpense(payload); 
        
        setIsCreateOpen(false); setEditingId(null); setPayNowAmount(''); setExistingPaidAmount(0);
        await load(); onUpdate(); 
    };

    const handleEdit = (expense: Expense) => { 
        setEditingId(expense.id); 
        setExistingPaidAmount(Number(expense.paidAmount) || 0);
        setPayNowAmount(''); 
        setFormData({ ...expense, stepId: expense.stepId || 'geral' }); 
        setIsCreateOpen(true); 
    };
    
    const handleDelete = async () => {
        if(editingId) {
            await dbService.deleteExpense(editingId);
            setIsCreateOpen(false); setEditingId(null); await load(); onUpdate();
        }
    }

    const hasExpenses = Object.keys(groupedExpenses).length > 0;

    return (
        <div className="animate-in fade-in pb-28 relative min-h-full">
             <SectionHeader title="Gastos" subtitle="Controle financeiro." />
             
             {!hasExpenses && (
                 <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                     <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 text-2xl"><i className="fa-solid fa-wallet"></i></div>
                     <p className="text-slate-500 font-medium">Nenhum gasto lançado ainda.</p>
                     <p className="text-xs text-slate-400 mt-1">Adicione materiais ou mão de obra.</p>
                 </div>
             )}

            {Object.keys(groupedExpenses).sort().map(group => (<div key={group} className="mb-8"><div className="flex justify-between items-end mb-4 border-b border-slate-100 dark:border-slate-800 pb-2"><h3 className="font-bold text-primary dark:text-white">{group}</h3><span className="text-xs font-bold text-slate-500">R$ {groupedExpenses[group].total.toLocaleString('pt-BR')}</span></div><div className="space-y-3">{groupedExpenses[group].items.map(expense => {
                const total = Number(expense.amount) || 0;
                const paid = Number(expense.paidAmount) || 0;
                const progress = total > 0 ? (paid / total) * 100 : 0;
                let status = 'Pendente';
                let statusColor = 'bg-slate-100 text-slate-500';
                
                if (paid >= total && total > 0) { status = 'Pago'; statusColor = 'bg-green-100 text-green-700'; }
                else if (paid > 0) { status = 'Parcial'; statusColor = 'bg-orange-100 text-orange-700'; }

                return (
                <div key={expense.id} onClick={() => handleEdit(expense)} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400`}>
                                <i className={`fa-solid ${expense.category === ExpenseCategory.MATERIAL ? 'fa-box' : expense.category === ExpenseCategory.LABOR ? 'fa-helmet-safety' : 'fa-tag'}`}></i>
                            </div>
                            <div>
                                <p className="font-bold text-sm text-primary dark:text-white">{expense.description}</p>
                                <p className="text-[10px] text-slate-400">{formatDateDisplay(expense.date)} • {expense.category}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-primary dark:text-white">R$ {total.toLocaleString('pt-BR')}</p>
                            <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor}`}>{status}</div>
                        </div>
                    </div>
                    {/* Progress Bar for Partial Payments */}
                    <div className="mt-3 relative h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${paid >= total ? 'bg-green-500' : 'bg-orange-500'}`} style={{width: `${Math.min(progress, 100)}%`}}></div>
                    </div>
                    {paid > 0 && paid < total && (
                        <p className="text-[10px] text-right mt-1 text-slate-400">Pago: R$ {paid.toLocaleString('pt-BR')}</p>
                    )}
                </div>
            )})}</div></div>))}
            
            <button 
                onClick={() => { setEditingId(null); setExistingPaidAmount(0); setPayNowAmount(''); setFormData({ date: new Date().toISOString().split('T')[0], category: ExpenseCategory.MATERIAL, amount: 0, paidAmount: 0, description: '', stepId: 'geral' }); setIsCreateOpen(true); }}
                className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40"
            >
                <i className="fa-solid fa-plus text-xl"></i>
            </button>

            {isCreateOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editingId ? 'Editar Pagamento' : 'Novo Gasto'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tipo de Gasto</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[ExpenseCategory.MATERIAL, ExpenseCategory.LABOR, ExpenseCategory.PERMITS, ExpenseCategory.OTHER].map(cat => (
                                        <button key={cat} type="button" onClick={() => setFormData({...formData, category: cat})} className={`p-2 rounded-xl text-xs font-bold border transition-all ${formData.category === cat ? 'bg-primary text-white border-primary' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>{cat}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <input placeholder="Descrição (ex: Pedreiro João, Cimento)" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm font-bold text-primary dark:text-white mb-2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
                                <select className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm text-slate-500" value={formData.stepId} onChange={e => setFormData({...formData, stepId: e.target.value})}>
                                    <option value="geral">Geral (Sem etapa)</option>
                                    {steps.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                                </select>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Valor Total Combinado</label>
                                    <div className="relative"><span className="absolute left-4 top-3 text-slate-400 text-sm">R$</span><input type="number" placeholder="0.00" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none font-bold text-lg" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} /></div>
                                </div>
                                {editingId && (
                                    <div className="flex justify-between items-center px-2">
                                        <span className="text-xs font-bold text-slate-500">Já Pago Anteriormente:</span>
                                        <span className={`font-bold ${existingPaidAmount >= (formData.amount||0) ? 'text-green-600' : 'text-orange-500'}`}>R$ {existingPaidAmount.toLocaleString('pt-BR')}</span>
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1 block">{editingId ? "Adicionar Pagamento (Hoje)" : "Pagamento Inicial (Hoje)"}</label>
                                    <div className="relative"><span className="absolute left-4 top-3 text-green-600 dark:text-green-400 text-sm">R$</span><input type="number" placeholder="0.00" className="w-full pl-10 pr-4 py-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/10 outline-none font-bold text-lg text-green-700 dark:text-green-300 focus:ring-2 focus:ring-green-500/20" value={payNowAmount} onChange={e => setPayNowAmount(e.target.value)} /></div>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Data</label>
                                <input type="date" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Salvar</button>
                            </div>
                            {editingId && <button type="button" onClick={handleDelete} className="w-full py-2 text-red-500 text-xs font-bold uppercase tracking-wider">Excluir Gasto</button>}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

const MoreMenuTab: React.FC<{ onSelect: (view: string) => void }> = ({ onSelect }) => {
    const menu = [
        { id: 'CONTACTS_TEAM', label: 'Minha Equipe', icon: 'fa-helmet-safety', color: 'bg-blue-500' },
        { id: 'CONTACTS_SUPPLIERS', label: 'Fornecedores', icon: 'fa-truck', color: 'bg-indigo-500' },
        { id: 'PHOTOS', label: 'Fotos da Obra', icon: 'fa-camera', color: 'bg-pink-500' },
        { id: 'FILES', label: 'Projetos/Arquivos', icon: 'fa-file-pdf', color: 'bg-orange-500' },
        { id: 'REPORTS', label: 'Relatórios', icon: 'fa-chart-pie', color: 'bg-emerald-500' },
        { id: 'CALCULATOR', label: 'Calculadoras', icon: 'fa-calculator', color: 'bg-slate-600' },
        { id: 'CONTRACTS', label: 'Modelos Contrato', icon: 'fa-file-signature', color: 'bg-purple-500' },
        { id: 'CHECKLISTS', label: 'Checklists', icon: 'fa-list-check', color: 'bg-teal-500' },
    ];
    return (
        <div className="animate-in fade-in grid grid-cols-2 gap-4 pb-24">
            {menu.map(item => (
                <button key={item.id} onClick={() => onSelect(item.id)} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-3 hover:shadow-md transition-all">
                    <div className={`w-12 h-12 rounded-xl ${item.color} text-white flex items-center justify-center text-xl shadow-lg`}>
                        <i className={`fa-solid ${item.icon}`}></i>
                    </div>
                    <span className="font-bold text-sm text-primary dark:text-white">{item.label}</span>
                </button>
            ))}
        </div>
    );
};

// ----------------------------------------------------------------------
// MAIN WORK DETAIL COMPONENT
// ----------------------------------------------------------------------

const WorkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STEPS' | 'MATERIALS' | 'EXPENSES' | 'MORE'>('OVERVIEW');
  const [subView, setSubView] = useState<'NONE' | 'CONTACTS_TEAM' | 'CONTACTS_SUPPLIERS' | 'PHOTOS' | 'FILES' | 'REPORTS' | 'CALCULATOR' | 'CONTRACTS' | 'CHECKLISTS'>('NONE');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{from: 'me'|'ze', text: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const loadWork = async () => {
    if (!id) return;
    setLoading(true);
    const w = await dbService.getWorkById(id);
    if (w) setWork(w);
    else navigate('/');
    setLoading(false);
  };

  useEffect(() => { loadWork(); }, [id]);

  const handleChat = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!chatMessage.trim()) return;
      const userMsg = chatMessage;
      setChatHistory(prev => [...prev, {from: 'me', text: userMsg}]);
      setChatMessage('');
      setChatLoading(true);
      const response = await aiService.sendMessage(userMsg);
      setChatHistory(prev => [...prev, {from: 'ze', text: response}]);
      setChatLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-secondary"></i></div>;
  if (!work) return null;

  if (subView !== 'NONE') {
      const handleBack = () => setSubView('NONE');
      return (
          <div className="max-w-2xl mx-auto h-screen flex flex-col bg-surface dark:bg-slate-950">
             <div className="flex-1 overflow-y-auto p-4">
                {subView === 'CONTACTS_TEAM' && <ContactsView mode="TEAM" onBack={handleBack} />}
                {subView === 'CONTACTS_SUPPLIERS' && <ContactsView mode="SUPPLIERS" onBack={handleBack} />}
                {subView === 'PHOTOS' && <PhotosView workId={work.id} onBack={handleBack} />}
                {subView === 'FILES' && <FilesView workId={work.id} onBack={handleBack} />}
                {subView === 'REPORTS' && <ReportsView workId={work.id} onBack={handleBack} />} 
                {subView === 'CALCULATOR' && <CalculatorView onBack={handleBack} />}
                {subView === 'CONTRACTS' && <ContractsView onBack={handleBack} />}
                {subView === 'CHECKLISTS' && <ChecklistsView onBack={handleBack} />}
             </div>
          </div>
      );
  }

  return (
      <div className="max-w-2xl mx-auto h-screen flex flex-col relative bg-surface dark:bg-slate-950 overflow-hidden">
          
          {/* Header (Fixed) */}
          <div className="shrink-0 px-4 py-4 flex items-center justify-between bg-surface dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 z-10">
             <div>
                 <h1 className="text-xl font-bold text-primary dark:text-white truncate max-w-[200px]">{work.name}</h1>
                 <p className="text-xs text-slate-400 font-bold uppercase">{activeTab === 'OVERVIEW' ? 'Visão Geral' : activeTab}</p>
             </div>
             <button onClick={() => setChatOpen(true)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-secondary transition-colors">
                 <i className="fa-solid fa-comment-dots"></i>
             </button>
          </div>

          {/* Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
              {activeTab === 'OVERVIEW' && <OverviewTab work={work} />}
              {activeTab === 'STEPS' && <StepsTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'MATERIALS' && <MaterialsTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'EXPENSES' && <ExpensesTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'MORE' && <MoreMenuTab onSelect={(view) => setSubView(view as any)} />}
          </div>

          {/* Bottom Nav (Fixed Floating) */}
          <div className="shrink-0 fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-2 flex justify-around items-center z-50 md:relative md:bg-transparent">
              {[
                  {id: 'OVERVIEW', icon: 'fa-chart-pie', label: 'Resumo'},
                  {id: 'STEPS', icon: 'fa-list-check', label: 'Etapas'},
                  {id: 'MATERIALS', icon: 'fa-cart-shopping', label: 'Compras'},
                  {id: 'EXPENSES', icon: 'fa-wallet', label: 'Gastos'},
                  {id: 'MORE', icon: 'fa-bars', label: 'Menu'},
              ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-16 ${activeTab === tab.id ? 'text-secondary bg-secondary/10' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      <i className={`fa-solid ${tab.icon} text-lg`}></i>
                      <span className="text-[10px] font-bold">{tab.label}</span>
                  </button>
              ))}
          </div>

          {/* Zé Chat Overlay */}
          {chatOpen && (
              <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
                  <div className="bg-white dark:bg-slate-900 w-full md:max-w-md h-[90vh] md:h-[600px] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                      <div className="bg-primary p-4 flex items-center justify-between text-white shrink-0">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full border-2 border-white/20"><img src={ZE_AVATAR} className="w-full h-full rounded-full" /></div>
                              <div><h3 className="font-bold">Zé da Obra</h3><p className="text-xs opacity-70">IA Mestre de Obras</p></div>
                          </div>
                          <button onClick={() => setChatOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"><i className="fa-solid fa-xmark"></i></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-black/20">
                          {chatHistory.length === 0 && (
                              <div className="text-center text-slate-400 text-sm mt-10">
                                  <i className="fa-solid fa-helmet-safety text-4xl mb-2 opacity-50"></i>
                                  <p>Fala, Chefe! Tamo junto.<br/>Pode perguntar qualquer coisa sobre sua obra.</p>
                              </div>
                          )}
                          {chatHistory.map((msg, i) => (
                              <div key={i} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.from === 'me' ? 'bg-secondary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-none'}`}>
                                      {msg.text}
                                  </div>
                              </div>
                          ))}
                          {chatLoading && <div className="flex justify-start"><div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700"><div className="flex gap-1"><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span></div></div></div>}
                      </div>
                      <form onSubmit={handleChat} className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
                          <input value={chatMessage} onChange={e => setChatMessage(e.target.value)} placeholder="Pergunte ao Zé..." className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary outline-none dark:text-white" />
                          <button type="submit" disabled={chatLoading || !chatMessage.trim()} className="bg-secondary text-white w-12 rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-secondary-dark transition-colors"><i className="fa-solid fa-paper-plane"></i></button>
                      </form>
                  </div>
              </div>
          )}
      </div>
  );
};

export default WorkDetail;
