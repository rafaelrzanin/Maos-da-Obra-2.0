import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Expense, Material, StepStatus, ExpenseCategory, PlanType, WorkPhoto, WorkFile } from '../types';
import { Recharts } from '../components/RechartsWrapper';
import { ZeModal } from '../components/ZeModal';
import { FULL_MATERIAL_PACKAGES, ZE_AVATAR } from '../services/standards';
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

// 1. CONTACTS VIEW (TEAM OR SUPPLIERS SEPARATED)
const ContactsView: React.FC<{ mode: 'TEAM' | 'SUPPLIERS', onBack: () => void }> = ({ mode, onBack }) => {
    const { user } = useAuth();
    const [items, setItems] = useState<any[]>([]);
    const [options, setOptions] = useState<string[]>([]); // List of roles or categories
    const [isAddOpen, setIsAddOpen] = useState(false);
    
    // Form States
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState(''); // Used for Role (Worker) or Category (Supplier)
    const [newPhone, setNewPhone] = useState('');

    const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

    const loadData = async () => {
        if(user) {
            setItems([]); // Clear before load
            if (mode === 'TEAM') {
                const [w, r] = await Promise.all([
                    dbService.getWorkers(user.id),
                    dbService.getJobRoles()
                ]);
                setItems(w);
                setOptions(r);
            } else {
                const [s, c] = await Promise.all([
                    dbService.getSuppliers(user.id),
                    dbService.getSupplierCategories()
                ]);
                setItems(s);
                setOptions(c);
            }
        }
    };
    
    // Reload when mode changes
    useEffect(() => { loadData(); }, [user, mode]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if(user) {
            if (mode === 'TEAM') {
                await dbService.addWorker({ userId: user.id, name: newName, role: newRole, phone: newPhone });
            } else {
                await dbService.addSupplier({ userId: user.id, name: newName, category: newRole, phone: newPhone });
            }
            setIsAddOpen(false);
            setNewName(''); setNewRole(''); setNewPhone('');
            loadData();
        }
    };

    const handleDeleteClick = (id: string) => {
        setZeModal({
            isOpen: true,
            title: mode === 'TEAM' ? "Remover Membro" : "Remover Fornecedor",
            message: `Tem certeza que quer apagar este contato da sua lista de ${mode === 'TEAM' ? 'Equipe' : 'Fornecedores'}?`,
            onConfirm: async () => {
                if (mode === 'TEAM') await dbService.deleteWorker(id);
                else await dbService.deleteSupplier(id);
                setZeModal(prev => ({...prev, isOpen: false}));
                loadData();
            }
        });
    }

    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <SectionHeader 
                title={mode === 'TEAM' ? "Minha Equipe" : "Meus Fornecedores"} 
                subtitle={mode === 'TEAM' ? "Profissionais cadastrados." : "Lojas e prestadores."} 
            />
            
            <div className="space-y-3">
                {items.map(item => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${mode === 'TEAM' ? 'bg-blue-500' : 'bg-indigo-500'}`}>
                                <i className={`fa-solid ${mode === 'TEAM' ? 'fa-helmet-safety' : 'fa-truck'}`}></i>
                            </div>
                            <div>
                                <h4 className="font-bold text-primary dark:text-white">{item.name}</h4>
                                <p className="text-xs text-slate-500">{(item as any).role || (item as any).category}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <a href={`https://wa.me/55${item.phone.replace(/\D/g,'')}`} target="_blank" className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"><i className="fa-brands fa-whatsapp"></i></a>
                             <button onClick={() => handleDeleteClick(item.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><i className="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    </div>
                ))}
                {items.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum cadastro encontrado.</p>}
            </div>

            <button onClick={() => setIsAddOpen(true)} className="mt-6 w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg">
                <i className="fa-solid fa-plus mr-2"></i>
                Adicionar {mode === 'TEAM' ? 'Membro' : 'Fornecedor'}
            </button>

            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Novo {mode === 'TEAM' ? 'Membro' : 'Fornecedor'}</h3>
                        <form onSubmit={handleAdd} className="space-y-3">
                            <input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary" required />
                            
                            {/* REPLACED INPUT WITH SELECT */}
                            <select 
                                value={newRole} 
                                onChange={e => setNewRole(e.target.value)} 
                                className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary appearance-none bg-no-repeat bg-[right_1rem_center]"
                                required
                            >
                                <option value="">{mode === 'TEAM' ? "Selecione a Profissão" : "Selecione a Categoria"}</option>
                                {options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>

                            <input placeholder="Telefone / WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary" required />
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">Salvar</button>
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
                onCancel={() => setZeModal({isOpen: false, title: '', message: '', onConfirm: () => {}})}
            />
        </div>
    );
};

// 2. PHOTOS VIEW
const PhotosView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    
    const loadPhotos = async () => {
        const p = await dbService.getPhotos(workId);
        setPhotos(p);
    };
    useEffect(() => { loadPhotos(); }, [workId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await dbService.uploadPhoto(workId, e.target.files[0], 'PROGRESS');
            loadPhotos();
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6">
                <SectionHeader title="Galeria de Fotos" subtitle="Acompanhamento visual." />
                <label className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer">
                    <i className="fa-solid fa-camera"></i>
                    <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                </label>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                 {photos.map(p => (
                     <div key={p.id} className="aspect-square rounded-xl overflow-hidden relative group">
                         <img src={p.url} className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <button onClick={async () => { await dbService.deletePhoto(p.id); loadPhotos(); }} className="text-white hover:text-red-400"><i className="fa-solid fa-trash"></i></button>
                         </div>
                     </div>
                 ))}
             </div>
             {photos.length === 0 && <p className="text-center text-slate-400 py-10">Nenhuma foto adicionada.</p>}
        </div>
    );
};

// 3. FILES VIEW
const FilesView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [files, setFiles] = useState<WorkFile[]>([]);
    const loadFiles = async () => {
        const f = await dbService.getFiles(workId);
        setFiles(f);
    };
    useEffect(() => { loadFiles(); }, [workId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await dbService.uploadFile(workId, e.target.files[0], 'Geral');
            loadFiles();
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6">
                <SectionHeader title="Projetos e Arquivos" subtitle="Plantas e documentos." />
                <label className="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer">
                    <i className="fa-solid fa-upload"></i>
                    <input type="file" className="hidden" onChange={handleUpload} />
                </label>
             </div>
             <div className="space-y-3">
                 {files.map(f => (
                     <div key={f.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-xl">
                                 <i className="fa-solid fa-file-pdf"></i>
                             </div>
                             <div>
                                 <h4 className="font-bold text-sm text-primary dark:text-white truncate max-w-[150px]">{f.name}</h4>
                                 <p className="text-xs text-slate-500">{new Date(f.date).toLocaleDateString()}</p>
                             </div>
                         </div>
                         <div className="flex gap-3">
                             <a href={f.url} target="_blank" className="text-secondary font-bold text-sm">Abrir</a>
                             <button onClick={async () => { await dbService.deleteFile(f.id); loadFiles(); }} className="text-slate-400 hover:text-red-500"><i className="fa-solid fa-trash"></i></button>
                         </div>
                     </div>
                 ))}
             </div>
             {files.length === 0 && <p className="text-center text-slate-400 py-10">Nenhum arquivo.</p>}
        </div>
    );
};

// 4. REPORTS VIEW (ADVANCED UI)
const ReportsView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [activeTab, setActiveTab] = useState<'FINANCIAL' | 'MATERIALS' | 'STEPS'>('FINANCIAL');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [work, setWork] = useState<Work | undefined>();
    
    // Load ALL Data for comprehensive reports
    useEffect(() => {
        const loadAll = async () => {
            const [exp, mat, stp, w] = await Promise.all([
                dbService.getExpenses(workId),
                dbService.getMaterials(workId),
                dbService.getSteps(workId),
                dbService.getWorkById(workId)
            ]);
            setExpenses(exp);
            setMaterials(mat);
            setSteps(stp.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
            setWork(w);
        };
        loadAll();
    }, [workId]);

    const handlePrint = () => {
        window.print();
    };

    // --- Financial Calculations ---
    const financialData = expenses.reduce((acc: any[], curr) => {
        const existing = acc.find(a => a.name === curr.category);
        if (existing) existing.value += curr.amount;
        else acc.push({ name: curr.category, value: curr.amount });
        return acc;
    }, []);
    const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0);
    const totalPaid = expenses.reduce((acc, e) => acc + (e.paidAmount || 0), 0);
    const totalPending = totalSpent - totalPaid;

    // --- Materials Calculations ---
    const totalMaterials = materials.length;
    const purchasedMaterials = materials.filter(m => m.purchasedQty >= m.plannedQty).length;
    const pendingMaterials = totalMaterials - purchasedMaterials;
    const materialChartData = [
        { name: 'Comprado', value: purchasedMaterials, fill: '#059669' },
        { name: 'Pendente', value: pendingMaterials, fill: '#E2E8F0' }
    ];
    // Group materials by category
    const groupedMaterials: Record<string, Material[]> = {};
    materials.forEach(m => {
        const cat = m.category || 'Geral';
        if (!groupedMaterials[cat]) groupedMaterials[cat] = [];
        groupedMaterials[cat].push(m);
    });

    // --- Steps Calculations ---
    const totalSteps = steps.length;
    const completedSteps = steps.filter(s => s.status === StepStatus.COMPLETED).length;
    const delayedSteps = steps.filter(s => s.isDelayed).length;

    return (
        <div className="animate-in fade-in slide-in-from-right-4 bg-white dark:bg-slate-950 min-h-screen">
             {/* PRINT HEADER ONLY */}
             <div className="hidden print:block mb-8 border-b-2 border-black pb-4">
                 <h1 className="text-3xl font-bold uppercase">{work?.name || "Relatório de Obra"}</h1>
                 <p className="text-sm">Gerado em: {new Date().toLocaleDateString()}</p>
                 <p className="text-sm">Endereço: {work?.address}</p>
             </div>

             <div className="flex justify-between items-center mb-6 print:hidden">
                <button onClick={onBack} className="text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2">
                    <i className="fa-solid fa-arrow-left"></i> Voltar
                </button>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2">
                        <i className="fa-solid fa-print"></i> Exportar PDF
                    </button>
                </div>
             </div>

             <SectionHeader title="Relatórios Inteligentes" subtitle="Analise cada detalhe da sua obra." />
             
             {/* TABS (Hidden on Print) */}
             <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl mb-6 print:hidden">
                 {[
                     { id: 'FINANCIAL', label: 'Financeiro', icon: 'fa-wallet' },
                     { id: 'MATERIALS', label: 'Compras', icon: 'fa-cart-shopping' },
                     { id: 'STEPS', label: 'Etapas', icon: 'fa-list-check' }
                 ].map(tab => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                         <i className={`fa-solid ${tab.icon}`}></i> {tab.label}
                     </button>
                 ))}
             </div>

             {/* === TAB CONTENT === */}
             
             {/* 1. FINANCIAL REPORT */}
             {activeTab === 'FINANCIAL' && (
                 <div className="space-y-6 animate-in fade-in">
                     {/* KPI CARDS */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                             <p className="text-xs font-bold text-slate-400 uppercase">Total Gasto</p>
                             <p className="text-2xl font-bold text-primary dark:text-white">R$ {totalSpent.toLocaleString('pt-BR')}</p>
                         </div>
                         <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                             <p className="text-xs font-bold text-slate-400 uppercase">Valor Pago</p>
                             <p className="text-2xl font-bold text-green-600">R$ {totalPaid.toLocaleString('pt-BR')}</p>
                         </div>
                         <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                             <p className="text-xs font-bold text-slate-400 uppercase">A Pagar (Pendente)</p>
                             <p className="text-2xl font-bold text-red-500">R$ {totalPending.toLocaleString('pt-BR')}</p>
                         </div>
                     </div>

                     {/* CHART */}
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold mb-6 dark:text-white flex items-center gap-2"><i className="fa-solid fa-chart-pie text-secondary"></i> Distribuição de Gastos</h3>
                        <div className="h-64">
                            <Recharts.ResponsiveContainer width="100%" height="100%">
                                <Recharts.BarChart data={financialData}>
                                    <Recharts.CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <Recharts.XAxis dataKey="name" tick={{fontSize: 10}} />
                                    <Recharts.YAxis />
                                    <Recharts.Tooltip 
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                    />
                                    <Recharts.Bar dataKey="value" fill="#D97706" radius={[6, 6, 0, 0]} barSize={40} />
                                </Recharts.BarChart>
                            </Recharts.ResponsiveContainer>
                        </div>
                     </div>

                     {/* TABLE */}
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold mb-4 dark:text-white">Extrato Detalhado</h3>
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b dark:border-slate-700 text-slate-500">
                                    <th className="py-2 font-bold">Data</th>
                                    <th className="py-2 font-bold">Descrição</th>
                                    <th className="py-2 font-bold">Categoria</th>
                                    <th className="py-2 font-bold text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map(e => (
                                    <tr key={e.id} className="border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="py-3 text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                                        <td className="py-3 font-medium dark:text-slate-300">{e.description}</td>
                                        <td className="py-3 text-xs">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{e.category}</span>
                                        </td>
                                        <td className="py-3 text-right font-bold dark:text-white">R$ {e.amount.toLocaleString('pt-BR')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                 </div>
             )}

             {/* 2. MATERIALS REPORT */}
             {activeTab === 'MATERIALS' && (
                 <div className="space-y-6 animate-in fade-in">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* CHART CARD */}
                         <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center">
                             <h3 className="font-bold mb-2 dark:text-white">Status de Compra</h3>
                             <div className="w-40 h-40 relative">
                                <Recharts.ResponsiveContainer width="100%" height="100%">
                                    <Recharts.PieChart>
                                        <Recharts.Pie
                                            data={materialChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={60}
                                            paddingAngle={5}
                                            dataKey="value"
                                            cornerRadius={5}
                                        />
                                    </Recharts.PieChart>
                                </Recharts.ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-2xl font-bold text-primary dark:text-white">{purchasedMaterials}</span>
                                    <span className="text-[10px] text-slate-400 uppercase">Comprados</span>
                                </div>
                             </div>
                         </div>

                         {/* SUMMARY CARD */}
                         <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-center">
                             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                             <div className="relative z-10">
                                 <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">Total de Itens</p>
                                 <p className="text-4xl font-extrabold mb-6">{totalMaterials}</p>
                                 <div className="space-y-2">
                                     <div className="flex justify-between text-sm">
                                         <span>Pendentes</span>
                                         <span className="font-bold text-orange-400">{pendingMaterials} itens</span>
                                     </div>
                                     <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                                         <div className="h-full bg-orange-400" style={{width: `${(pendingMaterials/totalMaterials)*100}%`}}></div>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>

                     {/* LIST BY CATEGORY */}
                     <div className="space-y-4">
                         {Object.keys(groupedMaterials).sort().map(cat => (
                             <div key={cat} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 break-inside-avoid">
                                 <h4 className="font-bold text-primary dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">{cat}</h4>
                                 <div className="grid grid-cols-1 gap-3">
                                     {groupedMaterials[cat].map(m => {
                                         const progress = Math.min(100, Math.round((m.purchasedQty / m.plannedQty) * 100));
                                         const isDone = progress >= 100;
                                         return (
                                             <div key={m.id} className="flex items-center gap-4 text-sm">
                                                 <div className={`w-2 h-2 rounded-full ${isDone ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                                 <div className="flex-1">
                                                     <div className="flex justify-between mb-1">
                                                         <span className="font-medium dark:text-slate-200">{m.name}</span>
                                                         <span className="text-slate-500 text-xs">{m.purchasedQty} / {m.plannedQty} {m.unit}</span>
                                                     </div>
                                                     <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                         <div className={`h-full rounded-full ${isDone ? 'bg-green-500' : 'bg-secondary'}`} style={{width: `${progress}%`}}></div>
                                                     </div>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* 3. STEPS REPORT */}
             {activeTab === 'STEPS' && (
                 <div className="space-y-6 animate-in fade-in">
                     
                     <div className="flex gap-4 mb-4 overflow-x-auto pb-2">
                         <div className="flex-1 min-w-[120px] bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-100 dark:border-green-900/30 text-center">
                             <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedSteps}</p>
                             <p className="text-xs font-bold text-green-700 dark:text-green-300 uppercase">Concluídas</p>
                         </div>
                         <div className="flex-1 min-w-[120px] bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 text-center">
                             <p className="text-2xl font-bold text-red-600 dark:text-red-400">{delayedSteps}</p>
                             <p className="text-xs font-bold text-red-700 dark:text-red-300 uppercase">Atrasadas</p>
                         </div>
                         <div className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                             <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{totalSteps}</p>
                             <p className="text-xs font-bold text-slate-500 uppercase">Total Etapas</p>
                         </div>
                     </div>

                     <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                         <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 font-bold text-sm text-slate-500 flex justify-between">
                             <span>Etapa</span>
                             <span>Status & Prazo</span>
                         </div>
                         <div className="divide-y divide-slate-100 dark:divide-slate-800">
                             {steps.map(step => {
                                 const isDone = step.status === StepStatus.COMPLETED;
                                 const isLate = !isDone && step.isDelayed;
                                 return (
                                     <div key={step.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors break-inside-avoid">
                                         <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white ${isDone ? 'bg-green-500' : isLate ? 'bg-red-500' : 'bg-slate-300'}`}>
                                                 <i className={`fa-solid ${isDone ? 'fa-check' : isLate ? 'fa-exclamation' : 'fa-clock'}`}></i>
                                             </div>
                                             <div>
                                                 <p className={`font-bold text-sm ${isDone ? 'text-slate-400 line-through' : 'text-primary dark:text-white'}`}>{step.name}</p>
                                                 <p className="text-xs text-slate-400">Previsto: {new Date(step.startDate).toLocaleDateString()}</p>
                                             </div>
                                         </div>
                                         <div className="text-right">
                                             {isLate && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Atrasado</span>}
                                             {isDone && <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Feito</span>}
                                             {!isLate && !isDone && <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Em andamento</span>}
                                         </div>
                                     </div>
                                 )
                             })}
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

// --- TABS (Updated Styles) ---

const OverviewTab: React.FC<{ work: Work, stats: any, onGoToSteps: () => void }> = ({ work, stats, onGoToSteps }) => {
// ... (rest of the file remains unchanged from previous versions, only ReportsView is replaced)
