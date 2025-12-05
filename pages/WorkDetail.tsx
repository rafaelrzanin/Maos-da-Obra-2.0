
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Expense, Material, StepStatus, ExpenseCategory, WorkPhoto, WorkFile, PlanType } from '../types';
import { Recharts } from '../components/RechartsWrapper';
import { ZeModal } from '../components/ZeModal';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK, getRandomZeTip, ZeTip } from '../services/standards';
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
                     {photos.map(p => (<div key={p.id} className="aspect-square rounded-2xl overflow-hidden relative group border border-slate-100 dark:border-slate-800 shadow-sm bg-slate-100 dark:bg-slate-900">
                        <img src={p.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={p.description}/>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <a href={p.url} target="_blank" className="p-2 bg-white/20 rounded-full text-white hover:bg-white/40"><i className="fa-solid fa-expand"></i></a>
                             <button onClick={() => dbService.deletePhoto(p.id).then(loadPhotos)} className="p-2 bg-red-500/80 rounded-full text-white hover:bg-red-500"><i className="fa-solid fa-trash"></i></button>
                        </div>
                     </div>))}
                 </div>
             )}
        </div>
    );
};

// 3. FILES VIEW (DOCS)
const FilesView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [files, setFiles] = useState<WorkFile[]>([]);
    const loadFiles = async () => { const f = await dbService.getFiles(workId); setFiles(f); };
    useEffect(() => { loadFiles(); }, [workId]);
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { await dbService.uploadFile(workId, e.target.files[0], 'Geral'); loadFiles(); }};

    return (
        <div className="animate-in fade-in slide-in-from-right-4 flex flex-col h-full">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-2 w-fit"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <div className="flex justify-between items-center mb-6">
                <SectionHeader title="Documentos" subtitle="Projetos e arquivos." />
                <label className="bg-primary hover:bg-slate-700 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg cursor-pointer transition-colors"><i className="fa-solid fa-file-arrow-up"></i><input type="file" className="hidden" accept=".pdf,.jpg,.png,.doc" onChange={handleUpload} /></label>
            </div>
            {files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 mb-6 shadow-sm"><i className="fa-solid fa-folder-open text-3xl"></i></div>
                    <h3 className="text-xl font-bold text-primary dark:text-white mb-2">Sem Arquivos</h3>
                    <label className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 cursor-pointer flex items-center gap-2 hover:bg-slate-800 transition-all"><i className="fa-solid fa-cloud-arrow-up"></i> Upload<input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={handleUpload} /></label>
                </div>
            ) : (
                <div className="space-y-3">
                    {files.map(f => (
                        <div key={f.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-4 overflow-hidden">
                                <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center shrink-0"><i className="fa-solid fa-file-pdf text-xl"></i></div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-primary dark:text-white truncate">{f.name}</h4>
                                    <p className="text-xs text-slate-400">{formatDateDisplay(f.date)}</p>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <a href={f.url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-primary dark:text-white flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"><i className="fa-solid fa-download"></i></a>
                                <button onClick={() => dbService.deleteFile(f.id).then(loadFiles)} className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><i className="fa-solid fa-trash text-xs"></i></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------

const WorkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STEPS' | 'FINANCIAL' | 'MATERIALS' | 'MORE'>('OVERVIEW');
  const [subView, setSubView] = useState<'NONE' | 'PHOTOS' | 'FILES' | 'TEAM' | 'SUPPLIERS'>('NONE');
  
  // Data
  const [steps, setSteps] = useState<Step[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState<{text: string, isUser: boolean}[]>([{ text: "Olá! Sou o Zé da Obra. Pode me perguntar qualquer coisa sobre construção.", isUser: false }]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    if (id) {
        setLoading(true);
        const [w, s, e, m, st] = await Promise.all([
            dbService.getWorkById(id),
            dbService.getSteps(id),
            dbService.getExpenses(id),
            dbService.getMaterials(id),
            dbService.calculateWorkStats(id)
        ]);
        if (w) {
            setWork(w); setSteps(s); setExpenses(e); setMaterials(m); setStats(st);
        } else {
            navigate('/');
        }
        setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, chatOpen]);

  const handleSendMessage = async () => {
      if (!chatMsg.trim()) return;
      const userText = chatMsg;
      setChatHistory(prev => [...prev, { text: userText, isUser: true }]);
      setChatMsg('');
      setChatLoading(true);
      
      const response = await aiService.sendMessage(userText);
      setChatHistory(prev => [...prev, { text: response, isUser: false }]);
      setChatLoading(false);
  };

  if (loading || !work) return <div className="flex h-screen items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i></div>;

  // SUBVIEWS RENDER
  if (subView === 'PHOTOS') return <div className="p-4 h-screen bg-surface dark:bg-slate-950"><PhotosView workId={work.id} onBack={() => setSubView('NONE')} /></div>;
  if (subView === 'FILES') return <div className="p-4 h-screen bg-surface dark:bg-slate-950"><FilesView workId={work.id} onBack={() => setSubView('NONE')} /></div>;
  if (subView === 'TEAM') return <div className="p-4 h-screen bg-surface dark:bg-slate-950"><ContactsView mode="TEAM" onBack={() => setSubView('NONE')} /></div>;
  if (subView === 'SUPPLIERS') return <div className="p-4 h-screen bg-surface dark:bg-slate-950"><ContactsView mode="SUPPLIERS" onBack={() => setSubView('NONE')} /></div>;

  return (
    <div className="relative min-h-screen pb-20 max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-500 hover:text-primary transition-colors"><i className="fa-solid fa-arrow-left"></i></button>
            <div className="text-right">
                <h1 className="text-xl font-bold text-primary dark:text-white truncate max-w-[200px]">{work.name}</h1>
                <p className={`text-xs font-bold uppercase ${stats.delayedSteps > 0 ? 'text-red-500' : 'text-green-500'}`}>{stats.delayedSteps > 0 ? `${stats.delayedSteps} etapas atrasadas` : 'Cronograma em dia'}</p>
            </div>
        </div>

        {/* TABS */}
        <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm mb-6 overflow-x-auto no-scrollbar border border-slate-100 dark:border-slate-800">
            {[
                { id: 'OVERVIEW', icon: 'fa-chart-pie', label: 'Resumo' },
                { id: 'STEPS', icon: 'fa-list-check', label: 'Etapas' },
                { id: 'FINANCIAL', icon: 'fa-wallet', label: 'Gastos' },
                { id: 'MATERIALS', icon: 'fa-cart-flatbed', label: 'Materiais' },
                { id: 'MORE', icon: 'fa-bars', label: 'Mais' }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 min-w-[80px] py-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                    <i className={`fa-solid ${tab.icon} text-sm`}></i>
                    {tab.label}
                </button>
            ))}
        </div>

        {/* CONTENT */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* 1. OVERVIEW TAB */}
            {activeTab === 'OVERVIEW' && (
                <div className="space-y-6">
                    {/* Main Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"><i className="fa-solid fa-coins"></i></div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Gasto Total</span>
                            </div>
                            <p className="text-xl font-bold text-primary dark:text-white">R$ {stats.totalSpent.toLocaleString('pt-BR')}</p>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min((stats.totalSpent / (work.budgetPlanned || 1)) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                             <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center"><i className="fa-solid fa-bars-progress"></i></div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Progresso</span>
                            </div>
                            <p className="text-xl font-bold text-primary dark:text-white">{stats.progress}%</p>
                             <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div className="bg-green-500 h-full rounded-full" style={{ width: `${stats.progress}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Pending Items */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
                        <h3 className="font-bold text-primary dark:text-white mb-4">Próximos Passos</h3>
                        <div className="space-y-3">
                            {steps.filter(s => s.status !== StepStatus.COMPLETED).slice(0, 3).map(step => (
                                <div key={step.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <div className="w-2 h-2 rounded-full bg-secondary"></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-primary dark:text-white">{step.name}</p>
                                        <p className="text-xs text-slate-500">{formatDateDisplay(step.startDate)}</p>
                                    </div>
                                </div>
                            ))}
                            {steps.every(s => s.status === StepStatus.COMPLETED) && (
                                <p className="text-center text-slate-400 text-sm py-2">Nenhuma etapa pendente. Obra concluída! 🎉</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. STEPS TAB (Simplified) */}
            {activeTab === 'STEPS' && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-primary dark:text-white">Cronograma</h3>
                        <button className="text-xs font-bold text-secondary bg-secondary/10 px-3 py-1.5 rounded-lg"><i className="fa-solid fa-plus mr-1"></i> Nova Etapa</button>
                    </div>
                    {steps.map(step => (
                        <div key={step.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h4 className={`font-bold text-sm ${step.status === StepStatus.COMPLETED ? 'text-slate-400 line-through' : 'text-primary dark:text-white'}`}>{step.name}</h4>
                                <p className="text-xs text-slate-500">{formatDateDisplay(step.startDate)} - {formatDateDisplay(step.endDate)}</p>
                            </div>
                            <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${step.status === StepStatus.COMPLETED ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {step.status === StepStatus.COMPLETED ? 'Feito' : 'Pendente'}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 3. FINANCIAL TAB (Simplified) */}
            {activeTab === 'FINANCIAL' && (
                 <div className="space-y-3">
                    <div className="bg-gradient-to-r from-primary to-slate-800 rounded-2xl p-6 text-white mb-4 shadow-lg">
                        <p className="text-sm opacity-80 mb-1">Total Gasto</p>
                        <h2 className="text-3xl font-bold">R$ {stats.totalSpent.toLocaleString('pt-BR')}</h2>
                        <p className="text-xs opacity-60 mt-2">Orçamento: R$ {work.budgetPlanned.toLocaleString('pt-BR')}</p>
                    </div>
                    {expenses.length === 0 ? <p className="text-center text-slate-400 py-8">Nenhum gasto lançado ainda.</p> : expenses.map(exp => (
                        <div key={exp.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><i className="fa-solid fa-receipt"></i></div>
                                 <div>
                                     <h4 className="font-bold text-sm text-primary dark:text-white">{exp.description}</h4>
                                     <p className="text-xs text-slate-500">{formatDateDisplay(exp.date)} • {exp.category}</p>
                                 </div>
                             </div>
                             <span className="font-bold text-primary dark:text-white">R$ {exp.amount}</span>
                        </div>
                    ))}
                 </div>
            )}

            {/* 4. MATERIALS TAB (Simplified) */}
            {activeTab === 'MATERIALS' && (
                <div className="space-y-3">
                     {materials.length === 0 ? <p className="text-center text-slate-400 py-8">Nenhum material cadastrado.</p> : materials.map(mat => {
                         const percent = mat.plannedQty > 0 ? (mat.purchasedQty / mat.plannedQty) * 100 : 0;
                         return (
                            <div key={mat.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between mb-2">
                                    <h4 className="font-bold text-sm text-primary dark:text-white">{mat.name}</h4>
                                    <span className="text-xs font-bold text-slate-500">{mat.purchasedQty} / {mat.plannedQty} {mat.unit}</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${percent >= 100 ? 'bg-green-500' : 'bg-secondary'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                                </div>
                            </div>
                         );
                     })}
                </div>
            )}

            {/* 5. MORE TAB */}
            {activeTab === 'MORE' && (
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setSubView('PHOTOS')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary transition-all flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><i className="fa-solid fa-camera text-xl"></i></div>
                        <span className="font-bold text-primary dark:text-white">Galeria de Fotos</span>
                    </button>
                    <button onClick={() => setSubView('FILES')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary transition-all flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><i className="fa-solid fa-folder-open text-xl"></i></div>
                        <span className="font-bold text-primary dark:text-white">Documentos</span>
                    </button>
                    <button onClick={() => setSubView('TEAM')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary transition-all flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><i className="fa-solid fa-helmet-safety text-xl"></i></div>
                        <span className="font-bold text-primary dark:text-white">Minha Equipe</span>
                    </button>
                    <button onClick={() => setSubView('SUPPLIERS')} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-secondary transition-all flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><i className="fa-solid fa-truck text-xl"></i></div>
                        <span className="font-bold text-primary dark:text-white">Fornecedores</span>
                    </button>
                </div>
            )}

        </div>

        {/* ZE CHAT BUBBLE */}
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
            {chatOpen && (
                <div className="mb-4 w-80 md:w-96 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-10 zoom-in-95 origin-bottom-right">
                    <div className="bg-primary p-4 flex items-center justify-between text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white p-0.5"><img src={ZE_AVATAR} className="w-full h-full rounded-full object-cover" onError={(e) => e.currentTarget.src=ZE_AVATAR_FALLBACK}/></div>
                            <div><p className="font-bold text-sm">Zé da Obra</p><p className="text-[10px] opacity-80">Online agora</p></div>
                        </div>
                        <button onClick={() => setChatOpen(false)}><i className="fa-solid fa-xmark"></i></button>
                    </div>
                    <div className="h-80 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-black/20">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.isUser ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {chatLoading && <div className="flex justify-start"><div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700"><i className="fa-solid fa-ellipsis fa-bounce text-slate-400"></i></div></div>}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                        <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Pergunte pro Zé..." className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2 text-sm outline-none dark:text-white" />
                        <button onClick={handleSendMessage} disabled={chatLoading} className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center hover:bg-secondary-dark disabled:opacity-50"><i className="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>
            )}
            <button onClick={() => setChatOpen(!chatOpen)} className="w-16 h-16 rounded-full bg-primary text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 border-4 border-white dark:border-slate-800">
                {chatOpen ? <i className="fa-solid fa-xmark text-2xl"></i> : <div className="relative"><i className="fa-solid fa-helmet-safety text-2xl"></i><span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-primary"></span></div>}
            </button>
        </div>

    </div>
  );
};

export default WorkDetail;
