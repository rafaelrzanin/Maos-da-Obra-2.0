import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Expense, Material, StepStatus, ExpenseCategory, PlanType, WorkPhoto, WorkFile } from '../types';
import { Recharts } from '../components/RechartsWrapper';
import { ZeModal } from '../components/ZeModal';
import { FULL_MATERIAL_PACKAGES, ZE_AVATAR, CALCULATOR_LOGIC, CONTRACT_TEMPLATES, STANDARD_CHECKLISTS } from '../services/standards';
import { useAuth } from '../App';
import { aiService } from '../services/ai';

// --- Shared Components ---

const SectionHeader: React.FC<{ title: string, subtitle: string }> = ({ title, subtitle }) => (
    <div className="mb-6 print:mb-2">
        <h2 className="text-2xl font-bold text-primary dark:text-white tracking-tight">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{subtitle}</p>
        <div className="h-1 w-10 bg-secondary rounded-full mt-3 print:hidden"></div>
    </div>
);

// --- SUB-VIEWS FOR "MORE" TAB ---

// 1. CONTACTS VIEW
const ContactsView: React.FC<{ mode: 'TEAM' | 'SUPPLIERS', onBack: () => void }> = ({ mode, onBack }) => {
    // ... (Code from previous step remains same)
    const { user } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [options, setOptions] = useState<string[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
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

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if(user) {
            if (mode === 'TEAM') await dbService.addWorker({ userId: user.id, name: newName, role: newRole, phone: newPhone });
            else await dbService.addSupplier({ userId: user.id, name: newName, category: newRole, phone: newPhone });
            setIsAddOpen(false); setNewName(''); setNewRole(''); setNewPhone(''); loadData();
        }
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
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${mode === 'TEAM' ? 'bg-blue-500' : 'bg-indigo-500'}`}><i className={`fa-solid ${mode === 'TEAM' ? 'fa-helmet-safety' : 'fa-truck'}`}></i></div>
                            <div><h4 className="font-bold text-primary dark:text-white">{item.name}</h4><p className="text-xs text-slate-500">{(item as any).role || (item as any).category}</p></div>
                        </div>
                        <div className="flex gap-2">
                             <a href={`https://wa.me/55${item.phone.replace(/\D/g,'')}`} target="_blank" className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"><i className="fa-brands fa-whatsapp"></i></a>
                             <button onClick={() => handleDeleteClick(item.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><i className="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    </div>
                ))}
                {items.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum cadastro encontrado.</p>}
            </div>
            <button onClick={() => setIsAddOpen(true)} className="mt-6 w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg"><i className="fa-solid fa-plus mr-2"></i> Adicionar</button>
            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Novo Cadastro</h3>
                        <form onSubmit={handleAdd} className="space-y-3">
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
    // ... (Same as before)
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const loadPhotos = async () => { const p = await dbService.getPhotos(workId); setPhotos(p); };
    useEffect(() => { loadPhotos(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadPhoto(workId, e.target.files[0], 'PROGRESS'); loadPhotos(); }};
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6"><SectionHeader title="Galeria" subtitle="Acompanhamento visual." /><label className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer"><i className="fa-solid fa-camera"></i><input type="file" className="hidden" accept="image/*" onChange={handleUpload} /></label></div>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{photos.map(p => (<div key={p.id} className="aspect-square rounded-xl overflow-hidden relative group"><img src={p.url} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><button onClick={async () => { await dbService.deletePhoto(p.id); loadPhotos(); }} className="text-white hover:text-red-400"><i className="fa-solid fa-trash"></i></button></div></div>))}</div>
             {photos.length === 0 && <p className="text-center text-slate-400 py-10">Nenhuma foto.</p>}
        </div>
    );
};

// 3. FILES VIEW
const FilesView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    // ... (Same as before)
    const [files, setFiles] = useState<WorkFile[]>([]);
    const loadFiles = async () => { const f = await dbService.getFiles(workId); setFiles(f); };
    useEffect(() => { loadFiles(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadFile(workId, e.target.files[0], 'Geral'); loadFiles(); }};
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6"><SectionHeader title="Projetos" subtitle="Plantas e documentos." /><label className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer"><i className="fa-solid fa-upload"></i><input type="file" className="hidden" onChange={handleUpload} /></label></div>
             <div className="space-y-3">{files.map(f => (<div key={f.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-xl"><i className="fa-solid fa-file-pdf"></i></div><div><h4 className="font-bold text-sm text-primary dark:text-white truncate max-w-[150px]">{f.name}</h4><p className="text-xs text-slate-500">{new Date(f.date).toLocaleDateString()}</p></div></div><div className="flex gap-3"><a href={f.url} target="_blank" className="text-secondary font-bold text-sm">Abrir</a><button onClick={async () => { await dbService.deleteFile(f.id); loadFiles(); }} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button></div></div>))}</div>
             {files.length === 0 && <p className="text-center text-slate-400 py-10">Nenhum arquivo.</p>}
        </div>
    );
};

// 4. REPORTS VIEW
const ReportsView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    // ... (Same as before)
    const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'MATERIALS' | 'STEPS'>('FINANCIAL');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [work, setWork] = useState<Work | undefined>();
    useEffect(() => {
        const loadAll = async () => { const [exp, mat, stp, w] = await Promise.all([dbService.getExpenses(workId), dbService.getMaterials(workId), dbService.getSteps(workId), dbService.getWorkById(workId)]); setExpenses(exp); setMaterials(mat); setSteps(stp.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())); setWork(w); }; loadAll();
    }, [workId]);
    const handlePrint = () => { window.print(); };
    // Calculations...
    const financialData = expenses.reduce((acc: any[], curr) => { const existing = acc.find(a => a.name === curr.category); if (existing) existing.value += curr.amount; else acc.push({ name: curr.category, value: curr.amount }); return acc; }, []);
    const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0); const totalPaid = expenses.reduce((acc, e) => acc + (e.paidAmount || 0), 0); const totalPending = totalSpent - totalPaid;
    const purchasedMaterials = materials.filter(m => m.purchasedQty >= m.plannedQty).length; const materialChartData = [{ name: 'Comprado', value: purchasedMaterials, fill: '#059669' }, { name: 'Pendente', value: materials.length - purchasedMaterials, fill: '#E2E8F0' }];
    const groupedMaterials: Record<string, Material[]> = {}; materials.forEach(m => { const cat = m.category || 'Geral'; if (!groupedMaterials[cat]) groupedMaterials[cat] = []; groupedMaterials[cat].push(m); });
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length; const delayedSteps = steps.filter(s => s.isDelayed).length; const totalSteps = steps.length;

    return (
        <div className="animate-in fade-in slide-in-from-right-4 bg-white dark:bg-slate-950 min-h-screen">
             <div className="hidden print:block mb-8 border-b-2 border-black pb-4"><h1 className="text-3xl font-bold uppercase">{work?.name || "Relatório"}</h1><p className="text-sm">Endereço: {work?.address}</p></div>
             <div className="flex justify-between items-center mb-6 print:hidden"><button onClick={onBack} className="text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button><div className="flex gap-2"><button onClick={handlePrint} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2"><i className="fa-solid fa-print"></i> PDF</button></div></div>
             <SectionHeader title="Relatórios Inteligentes" subtitle="Analise cada detalhe da sua obra." />
             <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6 print:hidden">{[{ id: 'FINANCIAL', label: 'Financeiro', icon: 'fa-wallet' }, { id: 'MATERIALS', label: 'Compras', icon: 'fa-cart-shopping' }, { id: 'STEPS', label: 'Etapas', icon: 'fa-list-check' }].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><i className={`fa-solid ${tab.icon}`}></i> {tab.label}</button>))}</div>
             {/* CONTENT */}
             {activeTab === 'FINANCIAL' && (<div className="space-y-6 animate-in fade-in"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">Total Gasto</p><p className="text-2xl font-bold text-primary dark:text-white">R$ {totalSpent.toLocaleString('pt-BR')}</p></div><div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm"><p className="text-xs font-bold text-slate-400 uppercase">A Pagar</p><p className="text-2xl font-bold text-red-500">R$ {totalPending.toLocaleString('pt-BR')}</p></div></div><div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm"><div className="h-64"><Recharts.ResponsiveContainer width="100%" height="100%"><Recharts.BarChart data={financialData}><Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} /><Recharts.XAxis dataKey="name" tick={{fontSize: 10}} /><Recharts.YAxis /><Recharts.Tooltip /><Recharts.Bar dataKey="value" fill="#D97706" radius={[6, 6, 0, 0]} barSize={40} /></Recharts.BarChart></Recharts.ResponsiveContainer></div></div></div>)}
             {activeTab === 'MATERIALS' && (<div className="space-y-6 animate-in fade-in"><div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center"><div className="w-40 h-40 relative"><Recharts.ResponsiveContainer width="100%" height="100%"><Recharts.PieChart><Recharts.Pie data={materialChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" cornerRadius={5} /></Recharts.PieChart></Recharts.ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold text-primary dark:text-white">{purchasedMaterials}</span><span className="text-[10px] text-slate-400 uppercase">Comprados</span></div></div></div><div className="space-y-4">{Object.keys(groupedMaterials).sort().map(cat => (<div key={cat} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 break-inside-avoid"><h4 className="font-bold text-primary dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">{cat}</h4><div className="grid grid-cols-1 gap-3">{groupedMaterials[cat].map(m => (<div key={m.id} className="flex items-center gap-4 text-sm"><div className={`w-2 h-2 rounded-full ${m.purchasedQty >= m.plannedQty ? 'bg-green-500' : 'bg-slate-300'}`}></div><div className="flex-1"><div className="flex justify-between mb-1"><span className="font-medium dark:text-slate-200">{m.name}</span><span className="text-slate-500 text-xs">{m.purchasedQty} / {m.plannedQty} {m.unit}</span></div></div></div>))}</div></div>))}</div></div>)}
             {activeTab === 'STEPS' && (<div className="space-y-6 animate-in fade-in"><div className="flex gap-4 mb-4 overflow-x-auto pb-2"><div className="flex-1 min-w-[120px] bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-900/30 text-center"><p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedSteps}</p><p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Concluídas</p></div><div className="flex-1 min-w-[120px] bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center"><p className="text-2xl font-bold text-red-600 dark:text-red-400">{delayedSteps}</p><p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase">Atrasadas</p></div></div></div>)}
        </div>
    );
};

// 5. CALCULATOR VIEW
const CalculatorView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // ... (Same as before)
    const [mode, setMode] = useState<'MENU' | 'FLOOR' | 'WALL' | 'PAINT' | 'ESTIMATOR'>('MENU');
    const [area, setArea] = useState<number>(0);
    const [width, setWidth] = useState<number>(0);
    const [height, setHeight] = useState<number>(0);
    const [rooms, setRooms] = useState<number>(0);
    const [baths, setBaths] = useState<number>(0);

    const ResultCard: React.FC<{ label: string, value: string, sub?: string }> = ({ label, value, sub }) => (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden group hover:shadow-xl transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
            <p className="text-3xl font-extrabold text-secondary mb-1">{value}</p>
            {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
    );

    const renderContent = () => {
        if (mode === 'FLOOR') { const res = CALCULATOR_LOGIC.FLOOR(area); return (<div className="animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-primary dark:text-white mb-4">Pisos</h3><div className="mb-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase">Área Total (m²)</label><input type="number" className="w-full text-3xl font-bold bg-transparent outline-none text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-2 focus:border-secondary transition-colors" placeholder="0" onChange={e => setArea(Number(e.target.value))}/></div><div className="grid grid-cols-1 gap-4"><ResultCard label="Piso / Porcelanato" value={`${res.tiles} m²`} sub="Já inclui 10% de perda" /><ResultCard label="Argamassa" value={`${res.mortar} sacos`} sub="Sacos de 20kg (AC-I/II)" /><ResultCard label="Rejunte" value={`${res.grout} kg`} sub="Estimativa média" /></div></div>); }
        if (mode === 'WALL') { const res = CALCULATOR_LOGIC.WALL(width, height); return (<div className="animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-primary dark:text-white mb-4">Paredes</h3><div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase">Largura (m)</label><input type="number" className="w-full text-2xl font-bold bg-transparent outline-none text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-2" onChange={e => setWidth(Number(e.target.value))} /></div><div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase">Altura (m)</label><input type="number" className="w-full text-2xl font-bold bg-transparent outline-none text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-2" onChange={e => setHeight(Number(e.target.value))} /></div></div><div className="grid grid-cols-1 gap-4"><ResultCard label="Tijolos (8 furos)" value={`${res.bricks} un`} sub={`Para área de ${res.area} m²`} /><ResultCard label="Cimento" value={`${res.cement} sacos`} sub="Para assentamento" /><ResultCard label="Areia" value={`${res.sand} m³`} sub="Volume estimado" /></div></div>); }
        if (mode === 'PAINT') { const res = CALCULATOR_LOGIC.PAINT(area); return (<div className="animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-primary dark:text-white mb-4">Pintura</h3><div className="mb-6 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase">Área de Parede (m²)</label><input type="number" className="w-full text-3xl font-bold bg-transparent outline-none text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-2 focus:border-secondary transition-colors" placeholder="0" onChange={e => setArea(Number(e.target.value))}/></div><div className="grid grid-cols-1 gap-4"><ResultCard label="Tinta 18L" value={`${res.cans18} latas`} sub="Considerando 2 demãos" /><ResultCard label="Massa Corrida" value={`${res.spackle} latas`} /><ResultCard label="Selador" value={`${res.sealer} latas`} /></div></div>); }
        if (mode === 'ESTIMATOR') { const res = CALCULATOR_LOGIC.ESTIMATOR(baths, rooms); return (<div className="animate-in fade-in slide-in-from-right-4"><h3 className="text-lg font-bold text-primary dark:text-white mb-4">Estimador Rápido</h3><div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase">Quartos/Salas</label><input type="number" className="w-full text-2xl font-bold bg-transparent outline-none text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-2" onChange={e => setRooms(Number(e.target.value))} /></div><div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800"><label className="text-xs font-bold text-slate-500 uppercase">Banheiros</label><input type="number" className="w-full text-2xl font-bold bg-transparent outline-none text-primary dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mt-2" onChange={e => setBaths(Number(e.target.value))} /></div></div><div className="space-y-4"><ResultCard label="Tomadas/Interruptores" value={`${res.outlets + res.switches} un`} /><ResultCard label="Vasos/Pias" value={`${res.toilets + res.sinks} un`} /></div></div>); }
        
        return (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
                {[{ id: 'FLOOR', label: 'Pisos', icon: 'fa-layer-group', color: 'bg-emerald-500' }, { id: 'WALL', label: 'Paredes', icon: 'fa-cubes-stacked', color: 'bg-orange-500' }, { id: 'PAINT', label: 'Pintura', icon: 'fa-paint-roller', color: 'bg-blue-500' }, { id: 'ESTIMATOR', label: 'Estimativa', icon: 'fa-calculator', color: 'bg-purple-500' }].map(item => (
                    <button key={item.id} onClick={() => setMode(item.id as any)} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"><div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-3 shadow-lg ${item.color}`}><i className={`fa-solid ${item.icon} text-2xl`}></i></div><span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-white">{item.label}</span></button>
                ))}
            </div>
        );
    };
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={mode === 'MENU' ? onBack : () => setMode('MENU')} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> {mode === 'MENU' ? 'Voltar' : 'Outras Calculadoras'}</button>
            <SectionHeader title="Calculadora Premium" subtitle="Estimativas precisas para sua obra." />
            {renderContent()}
        </div>
    );
};

// 6. CONTRACTS VIEW
const ContractsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [selectedContract, setSelectedContract] = useState<any | null>(null);
    const [editableContent, setEditableContent] = useState('');

    const handleSelect = (contract: any) => { setSelectedContract(contract); setEditableContent(contract.contentTemplate); };
    const handleDownload = () => {
        const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${selectedContract.title}</title></head><body style="font-family: Arial; white-space: pre-wrap;">${editableContent}</body></html>`;
        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `${selectedContract.title}.doc`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };
    const handleCopy = () => { navigator.clipboard.writeText(editableContent); alert('Texto copiado!'); };

    if (selectedContract) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 h-full flex flex-col">
                <button onClick={() => setSelectedContract(null)} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
                <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-primary dark:text-white">{selectedContract.title}</h2><div className="flex gap-2"><button onClick={handleCopy} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-bold">Copiar</button><button onClick={handleDownload} className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><i className="fa-solid fa-download"></i> Baixar .doc</button></div></div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-4 text-xs text-amber-800"><i className="fa-solid fa-circle-info mr-2"></i><strong>Dica:</strong> Você pode editar o texto abaixo antes de baixar.</div>
                <textarea className="flex-1 w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-sm font-mono leading-relaxed outline-none resize-none focus:ring-2 focus:ring-secondary/50" value={editableContent} onChange={(e) => setEditableContent(e.target.value)} />
            </div>
        );
    }
    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <SectionHeader title="Contratos e Documentos" subtitle="Modelos prontos para sua segurança." />
            <div className="grid grid-cols-1 gap-3">
                {CONTRACT_TEMPLATES.map(ct => (
                    <button key={ct.id} onClick={() => handleSelect(ct)} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary transition-all text-left shadow-sm group">
                        <div className="flex items-start gap-4"><div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl group-hover:scale-110 transition-transform"><i className="fa-solid fa-file-contract"></i></div><div><h4 className="font-bold text-primary dark:text-white mb-1 group-hover:text-secondary transition-colors">{ct.title}</h4><p className="text-xs text-slate-500">{ct.description}</p></div></div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// 7. CHECKLISTS VIEW (BONUS)
const ChecklistsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [openCategory, setOpenCategory] = useState<string | null>(null);

    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2 print:hidden"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <div className="flex justify-between items-center mb-6">
                <SectionHeader title="Checklists Anti-Erro" subtitle="O que verificar para evitar prejuízo." />
                <button onClick={() => window.print()} className="bg-slate-100 dark:bg-slate-800 text-slate-500 w-10 h-10 rounded-xl flex items-center justify-center print:hidden"><i className="fa-solid fa-print"></i></button>
            </div>
            
            <div className="space-y-4">
                {STANDARD_CHECKLISTS.map((list, idx) => {
                    const isOpen = openCategory === list.category;
                    return (
                        <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden print:border-black print:break-inside-avoid">
                            <button 
                                onClick={() => setOpenCategory(isOpen ? null : list.category)}
                                className="w-full flex items-center justify-between p-5 text-left bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center text-sm"><i className="fa-solid fa-list-check"></i></div>
                                    <h4 className="font-bold text-primary dark:text-white">{list.category}</h4>
                                </div>
                                <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                            
                            {(isOpen || window.matchMedia('print').matches) && (
                                <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800">
                                    <div className="space-y-4 mt-4">
                                        {list.items.map((item, i) => (
                                            <label key={i} className="flex items-start gap-3 cursor-pointer group">
                                                <input type="checkbox" className="mt-1 w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary" />
                                                <span className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed group-hover:text-primary dark:group-hover:text-white transition-colors">{item}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- More / Super Menu Tab ---
const MoreMenuTab: React.FC<{ workId: string }> = ({ workId }) => {
    const { user } = useAuth();
    const isLifetime = user?.plan === PlanType.VITALICIO;
    const [activeSection, setActiveSection] = useState<string | null>(null);

    // Render Active Sub-View
    if (activeSection === 'TEAM') return <ContactsView mode="TEAM" onBack={() => setActiveSection(null)} />;
    if (activeSection === 'SUPPLIERS') return <ContactsView mode="SUPPLIERS" onBack={() => setActiveSection(null)} />;
    if (activeSection === 'PHOTOS') return <PhotosView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'FILES') return <FilesView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'REPORTS') return <ReportsView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'CALC') return <CalculatorView onBack={() => setActiveSection(null)} />;
    if (activeSection === 'CONTRACTS') return <ContractsView onBack={() => setActiveSection(null)} />;
    if (activeSection === 'CHECKLISTS') return <ChecklistsView onBack={() => setActiveSection(null)} />;
    
    if (activeSection === 'AI') {
        return (
            <div className="flex flex-col h-full">
                <button onClick={() => setActiveSection(null)} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6"><div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center mb-4"><i className="fa-solid fa-robot text-4xl text-secondary"></i></div><h3 className="text-xl font-bold text-primary dark:text-white mb-2">IA do Zé da Obra</h3><p className="text-slate-500 mb-6">Seu assistente está disponível no ícone de robô no topo da tela.</p></div>
            </div>
        )
    }

    const sections = [{ id: 'TEAM', icon: 'fa-users', label: 'Equipe', color: 'bg-blue-500' }, { id: 'SUPPLIERS', icon: 'fa-truck', label: 'Fornecedores', color: 'bg-indigo-500' }, { id: 'REPORTS', icon: 'fa-chart-line', label: 'Relatórios', color: 'bg-emerald-500' }, { id: 'PHOTOS', icon: 'fa-camera', label: 'Galeria', color: 'bg-rose-500' }, { id: 'FILES', icon: 'fa-folder-open', label: 'Projetos', color: 'bg-orange-500' }];
    const bonusFeatures = [{ id: 'AI', icon: 'fa-robot', label: 'IA do Zé da Obra', desc: 'Tire dúvidas 24h' }, { id: 'CALC', icon: 'fa-calculator', label: 'Calculadora', desc: 'Estimativa de material' }, { id: 'CONTRACTS', icon: 'fa-file-signature', label: 'Contratos', desc: 'Modelos prontos' }, { id: 'CHECKLISTS', icon: 'fa-list-check', label: 'Checklists', desc: 'Não esqueça nada' }];

    return (
        <div className="animate-in fade-in duration-500 pb-24">
            <SectionHeader title="Mais Opções" subtitle="Gestão completa e ferramentas." />
            <div className="grid grid-cols-3 gap-3 mb-8">
                {sections.map(s => (
                    <button key={s.id} onClick={() => setActiveSection(s.id)} className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-95">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg ${s.color}`}><i className={`fa-solid ${s.icon}`}></i></div><span className="text-xs font-bold text-slate-600 dark:text-slate-300">{s.label}</span>
                    </button>
                ))}
            </div>
            <div className={`relative rounded-3xl p-6 overflow-hidden ${isLifetime ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {!isLifetime && (<div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-6"><i className="fa-solid fa-lock text-3xl text-slate-400 mb-3"></i><h3 className="font-bold text-primary dark:text-white mb-1">Bônus Exclusivo</h3><p className="text-xs text-slate-500 mb-4">Disponível no Plano Vitalício</p><button onClick={() => window.location.hash = '#/settings'} className="bg-premium text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-purple-500/20 text-sm">Liberar Acesso</button></div>)}
                <div className="relative z-0"><div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg"><i className="fa-solid fa-crown"></i></div><div><h3 className={`font-bold ${isLifetime ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>Ferramentas Premium</h3><p className={`text-xs ${isLifetime ? 'text-slate-400' : 'text-slate-500'}`}>Incluso no seu plano</p></div></div><div className="grid grid-cols-2 gap-3">{bonusFeatures.map(f => (<button key={f.id} onClick={() => { if(isLifetime) setActiveSection(f.id); }} className={`p-4 rounded-xl text-left transition-all ${isLifetime ? 'bg-white/10 hover:bg-white/20 border border-white/5' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}><i className={`fa-solid ${f.icon} text-xl mb-2 ${isLifetime ? 'text-secondary' : 'text-slate-400'}`}></i><h4 className={`font-bold text-sm mb-0.5 ${isLifetime ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{f.label}</h4><p className={`text-[10px] leading-tight ${isLifetime ? 'text-slate-400' : 'text-slate-400'}`}>{f.desc}</p></button>))}</div></div>
            </div>
        </div>
    );
}

// --- MAIN DETAIL COMPONENT ---
const WorkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [work, setWork] = useState<Work | null>(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, steps, materials, expenses, more
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });
  const [loading, setLoading] = useState(true);
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiHistory, setAiHistory] = useState<{sender: 'user'|'ze', text: string}[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const loadWork = async () => { if (!id) return; setLoading(true); const w = await dbService.getWorkById(id); if (w) { setWork(w); const s = await dbService.calculateWorkStats(id); setStats(s); } setLoading(false); };
  useEffect(() => { loadWork(); }, [id]);

  const handleAiSend = async (e: React.FormEvent) => {
      e.preventDefault(); if (!aiMessage.trim()) return; const userMsg = aiMessage; setAiHistory(prev => [...prev, { sender: 'user', text: userMsg }]); setAiMessage(''); setAiLoading(true); const response = await aiService.sendMessage(userMsg); setAiHistory(prev => [...prev, { sender: 'ze', text: response }]); setAiLoading(false);
  };

  if (loading) return (<div className="min-h-screen flex items-center justify-center text-secondary"><i className="fa-solid fa-circle-notch fa-spin text-3xl"></i></div>);
  if (!work) return (<div className="min-h-screen flex flex-col items-center justify-center p-4 text-center"><h2 className="text-xl font-bold text-slate-500 mb-4">Obra não encontrada</h2><button onClick={() => navigate('/')} className="text-primary hover:underline">Voltar ao Painel</button></div>);

  return (
      <div className="min-h-screen pb-24">
          <div className="sticky top-0 z-30 bg-surface/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex justify-between items-center"><div className="flex items-center gap-3"><button onClick={() => navigate('/')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i className="fa-solid fa-arrow-left"></i></button><h1 className="font-bold text-primary dark:text-white truncate max-w-[200px]">{work.name}</h1></div><button onClick={() => setShowAiChat(true)} className="bg-secondary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20"><i className="fa-solid fa-robot text-xs"></i></button></div>
          <div className="max-w-4xl mx-auto p-4 md:p-6">
              {activeTab === 'overview' && <OverviewTab work={work} stats={stats} onGoToSteps={() => setActiveTab('steps')} />}
              {activeTab === 'steps' && <StepsTab workId={work.id} refreshWork={loadWork} />}
              {activeTab === 'materials' && <MaterialsTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'expenses' && <ExpensesTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'more' && <MoreMenuTab workId={work.id} />}
          </div>
          <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-6 flex justify-between items-center z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">{[{ id: 'overview', icon: 'fa-house', label: 'Geral' }, { id: 'steps', icon: 'fa-calendar-days', label: 'Cronograma' }, { id: 'materials', icon: 'fa-cart-shopping', label: 'Materiais' }, { id: 'expenses', icon: 'fa-wallet', label: 'Gastos' }, { id: 'more', icon: 'fa-bars', label: 'Mais' }].map(tab => (<button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300 ${activeTab === tab.id ? 'text-secondary -translate-y-2' : 'text-slate-400 hover:text-slate-600'}`}><div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-all ${activeTab === tab.id ? 'bg-secondary text-white shadow-lg shadow-orange-500/30' : ''}`}><i className={`fa-solid ${tab.icon}`}></i></div><span className={`text-[10px] font-bold ${activeTab === tab.id ? 'opacity-100' : 'opacity-0'}`}>{tab.label}</span></button>))}</div>
          {showAiChat && (<div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-bottom duration-300 md:max-w-md md:right-4 md:bottom-20 md:left-auto md:top-auto md:h-[600px] md:rounded-3xl md:shadow-2xl md:border md:border-slate-200"><div className="p-4 bg-primary text-white flex justify-between items-center shrink-0 md:rounded-t-3xl"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/10 p-1"><img src={ZE_AVATAR} className="w-full h-full object-cover rounded-full" /></div><div><h3 className="font-bold text-sm">Zé da Obra</h3><p className="text-[10px] text-green-300 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span> Online</p></div></div><button onClick={() => setShowAiChat(false)} className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"><i className="fa-solid fa-xmark"></i></button></div><div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-black/20">{aiHistory.length === 0 && (<div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-6"><i className="fa-solid fa-comments text-4xl mb-3"></i><p className="text-sm font-medium">"Fala chefe! Tô aqui pra ajudar."</p></div>)}{aiHistory.map((msg, i) => (<div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none shadow-sm'}`}>{msg.text}</div></div>))}{aiLoading && (<div className="flex justify-start"><div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm"><div className="flex gap-1.5"><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span></div></div></div>)}</div><form onSubmit={handleAiSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0 md:rounded-b-3xl"><input className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary/50 outline-none dark:text-white" placeholder="Digite sua dúvida..." value={aiMessage} onChange={e => setAiMessage(e.target.value)} /><button type="submit" disabled={!aiMessage.trim() || aiLoading} className="w-12 h-12 rounded-xl bg-secondary text-white flex items-center justify-center hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><i className="fa-solid fa-paper-plane"></i></button></form></div>)}
      </div>
  );
};

export default WorkDetail;
