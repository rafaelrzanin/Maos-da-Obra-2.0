import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Expense, Material, StepStatus, ExpenseCategory, PlanType, Supplier, Worker, WorkPhoto, WorkFile } from '../types';
import { Recharts } from '../components/RechartsWrapper';
import { CALCULATORS, CONTRACT_TEMPLATES, STANDARD_CHECKLISTS, FULL_MATERIAL_PACKAGES, ZE_AVATAR } from '../services/standards';
import { useAuth } from '../App';
import { aiService } from '../services/ai';

// --- Shared Components ---

const SectionHeader: React.FC<{ title: string, subtitle: string }> = ({ title, subtitle }) => (
    <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary dark:text-white tracking-tight">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">{subtitle}</p>
        <div className="h-1 w-10 bg-secondary rounded-full mt-3"></div>
    </div>
);

// --- ZÉ DA OBRA MODAL (Premium Style) ---
interface ZeModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'DANGER' | 'INFO' | 'SUCCESS';
  onConfirm: () => void;
  onCancel: () => void;
}

const ZeModal: React.FC<ZeModalProps> = ({ isOpen, title, message, confirmText = "Sim, confirmar", cancelText = "Cancelar", type = 'DANGER', onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  const isDanger = type === 'DANGER';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-white/20 transform scale-100 transition-all relative overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10">
            <div className="flex gap-5 mb-6">
                <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0">
                    <img 
                    src={ZE_AVATAR} 
                    alt="Zé da Obra" 
                    className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800"
                    onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=Ze+Obra&background=0F172A&color=fff'; }}
                    />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-primary dark:text-white leading-tight mb-1">Ei, Chefe!</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                </div>
            </div>
            
            <div className={`mb-8 p-4 rounded-2xl text-sm leading-relaxed border ${isDanger ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900 text-red-800 dark:text-red-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                <p>{message}</p>
            </div>

            <div className="flex flex-col gap-3">
                <button 
                    onClick={onConfirm} 
                    className={`w-full py-4 rounded-xl text-white font-bold transition-all shadow-lg active:scale-[0.98] ${isDanger ? 'bg-danger hover:bg-red-700 shadow-red-500/20' : 'bg-primary hover:bg-slate-800 shadow-slate-500/20'}`}
                >
                    {confirmText}
                </button>
                <button 
                    onClick={onCancel} 
                    className="w-full py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    {cancelText}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

// --- SUB-VIEWS FOR "MORE" TAB ---

// 1. CONTACTS VIEW (TEAM & SUPPLIERS)
const ContactsView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const { user } = useAuth();
    const [tab, setTab] = useState<'TEAM' | 'SUPPLIERS'>('TEAM');
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    // Form States
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newPhone, setNewPhone] = useState('');

    const loadContacts = async () => {
        if(user) {
            const w = await dbService.getWorkers(user.id);
            setWorkers(w);
            const s = await dbService.getSuppliers(user.id);
            setSuppliers(s);
        }
    };
    useEffect(() => { loadContacts(); }, [user]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if(user) {
            if (tab === 'TEAM') {
                await dbService.addWorker({ userId: user.id, name: newName, role: newRole, phone: newPhone });
            } else {
                await dbService.addSupplier({ userId: user.id, name: newName, category: newRole, phone: newPhone });
            }
            setIsAddOpen(false);
            setNewName(''); setNewRole(''); setNewPhone('');
            loadContacts();
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Remover este contato?")) {
            if (tab === 'TEAM') await dbService.deleteWorker(id);
            else await dbService.deleteSupplier(id);
            loadContacts();
        }
    }

    return (
        <div className="animate-in fade-in slide-in-from-right-4">
            <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
            <SectionHeader title="Meus Contatos" subtitle="Equipe e Fornecedores." />
            
            <div className="flex gap-2 mb-6 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button onClick={() => setTab('TEAM')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'TEAM' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500'}`}>Equipe</button>
                <button onClick={() => setTab('SUPPLIERS')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'SUPPLIERS' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary dark:text-white' : 'text-slate-500'}`}>Fornecedores</button>
            </div>

            <div className="space-y-3">
                {(tab === 'TEAM' ? workers : suppliers).map(item => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${tab === 'TEAM' ? 'bg-blue-500' : 'bg-indigo-500'}`}>
                                <i className={`fa-solid ${tab === 'TEAM' ? 'fa-helmet-safety' : 'fa-truck'}`}></i>
                            </div>
                            <div>
                                <h4 className="font-bold text-primary dark:text-white">{item.name}</h4>
                                <p className="text-xs text-slate-500">{(item as any).role || (item as any).category}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <a href={`https://wa.me/55${item.phone.replace(/\D/g,'')}`} target="_blank" className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200"><i className="fa-brands fa-whatsapp"></i></a>
                             <button onClick={() => handleDelete(item.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100"><i className="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    </div>
                ))}
                {(tab === 'TEAM' ? workers : suppliers).length === 0 && <p className="text-center text-slate-400 py-4 text-sm">Nenhum contato cadastrado.</p>}
            </div>

            <button onClick={() => setIsAddOpen(true)} className="mt-6 w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Adicionar Novo</button>

            {isAddOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Novo {tab === 'TEAM' ? 'Membro' : 'Fornecedor'}</h3>
                        <form onSubmit={handleAdd} className="space-y-3">
                            <input placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white" required />
                            <input placeholder={tab === 'TEAM' ? "Profissão (ex: Pedreiro)" : "Categoria (ex: Elétrica)"} value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white" required />
                            <input placeholder="Telefone / WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-800 dark:text-white" required />
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
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

// 4. REPORTS VIEW
const ReportsView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    
    useEffect(() => {
        dbService.getExpenses(workId).then(setExpenses);
    }, [workId]);

    const handlePrint = () => {
        window.print();
    };

    const data = expenses.reduce((acc: any[], curr) => {
        const existing = acc.find(a => a.name === curr.category);
        if (existing) existing.value += curr.amount;
        else acc.push({ name: curr.category, value: curr.amount });
        return acc;
    }, []);

    return (
        <div className="animate-in fade-in slide-in-from-right-4">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-slate-400 hover:text-primary print:hidden"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             <div className="flex justify-between items-center mb-6">
                <SectionHeader title="Relatórios" subtitle="Análise financeira." />
                <button onClick={handlePrint} className="bg-slate-100 text-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-sm print:hidden">
                    <i className="fa-solid fa-print"></i>
                </button>
             </div>
             
             <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 mb-6">
                 <h3 className="font-bold mb-4 dark:text-white">Gastos por Categoria</h3>
                 <div className="h-64">
                    <Recharts.ResponsiveContainer width="100%" height="100%">
                        <Recharts.BarChart data={data}>
                            <Recharts.CartesianGrid strokeDasharray="3 3" />
                            <Recharts.XAxis dataKey="name" />
                            <Recharts.YAxis />
                            <Recharts.Tooltip />
                            <Recharts.Bar dataKey="value" fill="#D97706" radius={[4, 4, 0, 0]} />
                        </Recharts.BarChart>
                    </Recharts.ResponsiveContainer>
                 </div>
             </div>

             <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                 <h3 className="font-bold mb-4 dark:text-white">Extrato Detalhado</h3>
                 <table className="w-full text-sm text-left">
                     <thead>
                         <tr className="border-b dark:border-slate-700 text-slate-500">
                             <th className="py-2">Data</th>
                             <th className="py-2">Descrição</th>
                             <th className="py-2 text-right">Valor</th>
                         </tr>
                     </thead>
                     <tbody>
                         {expenses.map(e => (
                             <tr key={e.id} className="border-b dark:border-slate-800 last:border-0">
                                 <td className="py-3 text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                                 <td className="py-3 font-medium dark:text-slate-300">{e.description}</td>
                                 <td className="py-3 text-right font-bold dark:text-white">R$ {e.amount.toLocaleString('pt-BR')}</td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
        </div>
    );
};

// --- TABS (Updated Styles) ---

const OverviewTab: React.FC<{ work: Work, stats: any, onGoToSteps: () => void }> = ({ work, stats, onGoToSteps }) => {
  const budgetUsage = work.budgetPlanned > 0 ? (stats.totalSpent / work.budgetPlanned) * 100 : 0;
  
  const pieData = [
    { name: 'Concluído', value: stats.progress, fill: '#059669' }, 
    { name: 'Pendente', value: '#E2E8F0' } 
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <SectionHeader 
          title="Visão Geral" 
          subtitle="O pulso da sua obra em tempo real."
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Progress Card */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <h3 className="absolute top-6 left-6 text-xs text-slate-400 uppercase font-bold tracking-widest">Avanço Físico</h3>
            <div className="w-full h-48 relative flex items-center justify-center">
                <Recharts.ResponsiveContainer width="100%" height="100%">
                    <Recharts.PieChart>
                        <Recharts.Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                            cornerRadius={10}
                            paddingAngle={5}
                        >
                        </Recharts.Pie>
                    </Recharts.PieChart>
                </Recharts.ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-extrabold text-primary dark:text-white">{stats.progress}%</span>
                    <span className="text-xs text-slate-400 uppercase font-bold">Concluído</span>
                </div>
            </div>
        </div>

        {/* Budget Card */}
        <div className="bg-gradient-to-br from-slate-900 to-primary p-8 rounded-3xl shadow-xl text-white flex flex-col justify-between relative overflow-hidden">
             <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             
             <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-6">
                     <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-secondary">
                         <i className="fa-solid fa-wallet text-xl"></i>
                     </div>
                     <span className="text-xs text-slate-300 uppercase font-bold tracking-widest">Financeiro</span>
                 </div>
                 
                 <div className="mb-8">
                     <p className="text-4xl font-bold mb-1 tracking-tight">R$ {stats.totalSpent.toLocaleString('pt-BR')}</p>
                     <p className="text-sm text-slate-400 font-medium">de R$ {work.budgetPlanned.toLocaleString('pt-BR')} planejado</p>
                 </div>

                 <div className="w-full bg-black/30 rounded-full h-2 mb-2 overflow-hidden backdrop-blur-sm">
                    <div 
                        className={`h-full rounded-full transition-all duration-1000 ${budgetUsage > 100 ? 'bg-red-500' : 'bg-secondary'}`} 
                        style={{ width: `${Math.min(budgetUsage, 100)}%` }}
                    ></div>
                 </div>
                 <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                     <span>0%</span>
                     <span>{Math.round(budgetUsage)}% Usado</span>
                 </div>
             </div>
        </div>
      </div>

      <button 
          onClick={() => { if (stats.delayedSteps > 0) onGoToSteps(); }}
          className={`w-full bg-white dark:bg-slate-900 p-6 rounded-2xl border transition-all flex items-center justify-between group ${stats.delayedSteps > 0 ? 'border-red-200 dark:border-red-900/30 shadow-lg shadow-red-500/5 hover:-translate-y-1' : 'border-slate-100 dark:border-slate-800 hover:border-success/30'}`}
        >
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${stats.delayedSteps > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                     <i className={`fa-solid ${stats.delayedSteps > 0 ? 'fa-clock' : 'fa-check-circle'}`}></i>
                </div>
                <div>
                    <h3 className={`text-lg font-bold ${stats.delayedSteps > 0 ? 'text-red-600 dark:text-red-400' : 'text-primary dark:text-white'}`}>
                        {stats.delayedSteps > 0 ? `${stats.delayedSteps} Etapas Atrasadas` : 'Cronograma em dia'}
                    </h3>
                    <p className="text-sm text-slate-500">Status atual do cronograma</p>
                </div>
            </div>
            {stats.delayedSteps > 0 && <i className="fa-solid fa-chevron-right text-slate-300 group-hover:text-red-500 transition-colors"></i>}
        </button>
    </div>
  );
};

const StepsTab: React.FC<{ workId: string, refreshWork: () => void }> = ({ workId, refreshWork }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepDate, setNewStepDate] = useState('');
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  
  const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  const [pendingStartStep, setPendingStartStep] = useState<Step | null>(null);
  const [foundPackage, setFoundPackage] = useState<string | null>(null);

  const loadSteps = async () => {
    const s = await dbService.getSteps(workId);
    setSteps(s.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
  };

  useEffect(() => { loadSteps(); }, [workId]);

  const toggleStatus = async (step: Step) => {
      let newStatus = StepStatus.IN_PROGRESS;
      if (step.status === StepStatus.NOT_STARTED) newStatus = StepStatus.IN_PROGRESS;
      else if (step.status === StepStatus.IN_PROGRESS) newStatus = StepStatus.COMPLETED;
      else newStatus = StepStatus.NOT_STARTED;
      
      if (step.status === StepStatus.NOT_STARTED && newStatus === StepStatus.IN_PROGRESS) {
          const matchPkg = FULL_MATERIAL_PACKAGES.find(p => step.name.toLowerCase().includes(p.category.toLowerCase()));
          if (matchPkg) {
              setPendingStartStep(step);
              setFoundPackage(matchPkg.category);
              return;
          }
      }
      await updateStepStatus(step, newStatus);
  };
  
  const updateStepStatus = async (step: Step, status: StepStatus) => {
      await dbService.updateStep({ ...step, status });
      loadSteps();
      refreshWork();
  }

  const handleConfirmImport = async () => {
      if (pendingStartStep && foundPackage) {
          const count = await dbService.importMaterialPackage(workId, foundPackage);
          await updateStepStatus(pendingStartStep, StepStatus.IN_PROGRESS);
          setPendingStartStep(null);
          setFoundPackage(null);
          if (count > 0) alert(`${count} materiais sugeridos foram adicionados!`);
      }
  };

  const handleCancelImport = async () => {
      if (pendingStartStep) {
          await updateStepStatus(pendingStartStep, StepStatus.IN_PROGRESS);
          setPendingStartStep(null);
          setFoundPackage(null);
      }
  };
  
  const handleCreateStep = async (e: React.FormEvent) => {
      e.preventDefault();
      await dbService.addStep({
          workId,
          name: newStepName,
          startDate: newStepDate,
          endDate: newStepDate,
          status: StepStatus.NOT_STARTED
      });
      setIsCreateModalOpen(false);
      setNewStepName('');
      setNewStepDate('');
      loadSteps();
  };

  const handleUpdateStep = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingStep) {
          const originalStep = steps.find(s => s.id === editingStep.id);
          const isStarting = originalStep && originalStep.status === StepStatus.NOT_STARTED && editingStep.status === StepStatus.IN_PROGRESS;

          if (isStarting) {
              const matchPkg = FULL_MATERIAL_PACKAGES.find(p => editingStep.name.toLowerCase().includes(p.category.toLowerCase()));
              if (matchPkg) {
                  setPendingStartStep(editingStep);
                  setFoundPackage(matchPkg.category);
                  setEditingStep(null);
                  return;
              }
          }
          await dbService.updateStep(editingStep);
          setEditingStep(null);
          loadSteps();
          refreshWork();
      }
  };

  const handleDeleteClick = (stepId: string) => {
      setZeModal({
          isOpen: true,
          title: "Apagar Etapa",
          message: "Tem certeza que quer remover essa etapa do cronograma?",
          onConfirm: async () => {
              await dbService.deleteStep(stepId);
              setEditingStep(null);
              setZeModal(prev => ({...prev, isOpen: false}));
              loadSteps();
              refreshWork();
          }
      });
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
         <SectionHeader title="Cronograma" subtitle="Toque para mudar o status." />
         <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:bg-slate-800 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
              <i className="fa-solid fa-plus text-lg"></i>
          </button>
      </div>

      <div className="space-y-4">
        {steps.map((step, idx) => {
            const isComplete = step.status === StepStatus.COMPLETED;
            const isInProgress = step.status === StepStatus.IN_PROGRESS;
            const now = new Date();
            const endDate = new Date(step.endDate);
            const isLate = !isComplete && now > endDate;

            return (
                <div key={step.id} className={`group relative p-5 rounded-3xl border transition-all duration-300 ${
                    isComplete ? 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60' : 
                    isInProgress ? 'bg-white dark:bg-slate-800 border-secondary/30 ring-1 ring-secondary/20 shadow-lg shadow-secondary/5' :
                    isLate ? 'bg-white dark:bg-slate-800 border-red-200 dark:border-red-900/30 shadow-sm' :
                    'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-slate-300'
                }`}>
                    {/* Connecting Line (except last) */}
                    {idx < steps.length - 1 && (
                        <div className="absolute left-9 bottom-[-20px] top-[60px] w-0.5 bg-slate-100 dark:bg-slate-800 z-0"></div>
                    )}

                    <div className="flex items-center gap-5 relative z-10">
                        {/* Status Button */}
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleStatus(step); }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border-2 ${
                              isComplete ? 'bg-success border-success text-white' : 
                              isInProgress ? 'bg-secondary border-secondary text-white' : 
                              isLate ? 'bg-white border-red-300 text-red-500' :
                              'bg-white border-slate-300 text-transparent hover:border-secondary'
                          }`}
                        >
                            <i className={`fa-solid ${isComplete ? 'fa-check' : isInProgress ? 'fa-play text-[10px]' : isLate ? 'fa-exclamation' : 'fa-check'}`}></i>
                        </button>
                        
                        <div onClick={() => setEditingStep(step)} className="cursor-pointer flex-1">
                            <div className="flex justify-between items-start">
                                <h4 className={`text-base font-bold mb-1 ${isComplete ? 'line-through text-slate-400' : 'text-primary dark:text-white'}`}>
                                    {step.name}
                                </h4>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <i className="fa-solid fa-pen text-slate-300 hover:text-secondary"></i>
                                </div>
                            </div>
                            
                            <div className="flex items-center flex-wrap gap-3 text-xs font-medium">
                                <span className="text-slate-500 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                    <i className="fa-regular fa-calendar"></i>
                                    {new Date(step.endDate).toLocaleDateString('pt-BR')}
                                </span>
                                {isLate && <span className="text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md uppercase tracking-wide font-bold">Atrasado</span>}
                                {isInProgress && <span className="text-secondary bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md uppercase tracking-wide font-bold">Em Andamento</span>}
                            </div>
                        </div>
                    </div>
                </div>
            )
        })}
        {steps.length === 0 && (
             <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <i className="fa-solid fa-list-check text-4xl text-slate-200 dark:text-slate-700 mb-3"></i>
                <p className="text-slate-400 font-medium">Nenhuma etapa cadastrada.</p>
             </div>
        )}
      </div>

      {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Nova Etapa</h3>
                  <form onSubmit={handleCreateStep} className="space-y-5">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome da Tarefa</label>
                          <input 
                             placeholder="Ex: Pintar Sala"
                             className="w-full px-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50"
                             value={newStepName}
                             onChange={e => setNewStepName(e.target.value)}
                             required
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Data Prevista</label>
                          <input type="date" className="w-full px-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/50" value={newStepDate} onChange={e => setNewStepDate(e.target.value)} required />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button>
                          <button type="submit" className="flex-1 py-4 rounded-xl bg-primary text-white font-bold hover:bg-slate-800 transition-colors shadow-lg">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {editingStep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-primary dark:text-white">Editar Etapa</h3>
                      <button onClick={() => handleDeleteClick(editingStep.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100">
                          <i className="fa-solid fa-trash text-sm"></i>
                      </button>
                  </div>
                  <form onSubmit={handleUpdateStep} className="space-y-5">
                      <input 
                         className="w-full px-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white font-bold text-lg outline-none focus:ring-2 focus:ring-secondary/50"
                         value={editingStep.name}
                         onChange={e => setEditingStep({...editingStep, name: e.target.value})}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Início</label>
                            <input type="date" className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none" value={editingStep.startDate} onChange={e => setEditingStep({...editingStep, startDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Fim</label>
                            <input type="date" className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none" value={editingStep.endDate} onChange={e => setEditingStep({...editingStep, endDate: e.target.value})} />
                        </div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Status</label>
                          <select 
                            value={editingStep.status}
                            onChange={e => setEditingStep({...editingStep, status: e.target.value as StepStatus})}
                            className="w-full px-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none"
                          >
                              <option value={StepStatus.NOT_STARTED}>A fazer</option>
                              <option value={StepStatus.IN_PROGRESS}>Em Andamento</option>
                              <option value={StepStatus.COMPLETED}>Concluído</option>
                          </select>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => setEditingStep(null)} className="flex-1 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancelar</button>
                          <button type="submit" className="flex-1 py-4 rounded-xl bg-primary text-white font-bold hover:bg-slate-800 transition-colors shadow-lg">Atualizar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* ZÉ DA OBRA MODAL */}
      <ZeModal 
        isOpen={zeModal.isOpen}
        title={zeModal.title}
        message={zeModal.message}
        onConfirm={zeModal.onConfirm}
        onCancel={() => setZeModal({isOpen: false, title: '', message: '', onConfirm: () => {}})}
      />

      {/* ASSISTANT IMPORT MODAL */}
      {pendingStartStep && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="relative z-10">
                    <div className="flex gap-5 mb-6">
                        <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 shadow-lg shrink-0">
                             <img src={ZE_AVATAR} alt="Zé da Obra" className="w-full h-full object-cover rounded-full border-2 border-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-primary dark:text-white leading-tight mb-1">Oi, chefe!</h3>
                            <p className="text-sm text-slate-500">Começando a <strong>{foundPackage}</strong>?</p>
                        </div>
                    </div>
                    
                    <div className="mb-6 bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-700">
                        <p>Posso adicionar a <strong>lista de materiais padrão</strong> dessa fase pra você agora mesmo.</p>
                        <p className="mt-2 text-xs font-bold text-secondary uppercase tracking-wide">Economia de tempo: ~10 minutos</p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={handleConfirmImport} 
                            className="w-full py-4 rounded-xl bg-secondary text-white font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles"></i> Gerar Lista Automática
                        </button>
                        <button 
                            onClick={handleCancelImport} 
                            className="w-full py-3 rounded-xl text-slate-400 font-bold hover:text-slate-600 transition-colors"
                        >
                            Não, obrigado
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// --- Materials Tab ---
const MaterialsTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [editCost, setEditCost] = useState<string>('');
    const [newMaterial, setNewMaterial] = useState({ name: '', plannedQty: '', unit: 'un', category: 'Geral' });
    
    // Grouped
    const [groupedMaterials, setGroupedMaterials] = useState<Record<string, Material[]>>({});

    const load = async () => {
        const data = await dbService.getMaterials(workId);
        setMaterials(data);
        
        // Group by Category
        const grouped: Record<string, Material[]> = {};
        data.forEach(m => {
            const cat = m.category || 'Geral';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(m);
        });
        setGroupedMaterials(grouped);
        onUpdate();
    };

    useEffect(() => { load(); }, [workId]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        await dbService.addMaterial({
            workId,
            name: newMaterial.name,
            plannedQty: Number(newMaterial.plannedQty),
            purchasedQty: 0,
            unit: newMaterial.unit,
            category: newMaterial.category
        });
        setNewMaterial({ name: '', plannedQty: '', unit: 'un', category: 'Geral' });
        setIsCreateOpen(false);
        load();
    };

    const handleImport = async (category: string) => {
        const count = await dbService.importMaterialPackage(workId, category);
        alert(`${count} materiais adicionados.`);
        setIsImportOpen(false);
        load();
    };
    
    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if(editingMaterial) {
            await dbService.updateMaterial(editingMaterial, Number(editCost));
            setEditingMaterial(null);
            setEditCost('');
            load();
        }
    }

    return (
        <div className="animate-in fade-in duration-500 pb-20">
            <div className="flex items-center justify-between mb-8">
                <SectionHeader title="Materiais" subtitle="Controle de compras e estoque." />
                <div className="flex gap-2">
                     <button onClick={() => setIsImportOpen(true)} className="bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-secondary w-12 h-12 rounded-2xl flex items-center justify-center transition-all">
                        <i className="fa-solid fa-cloud-arrow-down text-lg"></i>
                    </button>
                    <button onClick={() => setIsCreateOpen(true)} className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all">
                        <i className="fa-solid fa-plus text-lg"></i>
                    </button>
                </div>
            </div>

            {Object.keys(groupedMaterials).sort().map(cat => (
                <div key={cat} className="mb-8 last:mb-0">
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-layer-group text-secondary"></i> {cat}
                     </h3>
                     <div className="space-y-3">
                        {groupedMaterials[cat].map(m => {
                            const isPurchased = m.purchasedQty >= m.plannedQty;
                            const percentage = Math.min(100, Math.round((m.purchasedQty / m.plannedQty) * 100)) || 0;
                            return (
                                <div 
                                  key={m.id} 
                                  onClick={() => setEditingMaterial(m)}
                                  className={`p-4 rounded-2xl border bg-white dark:bg-slate-900 cursor-pointer transition-all hover:border-secondary/50 hover:shadow-md ${isPurchased ? 'border-green-200 dark:border-green-900/30 opacity-60' : 'border-slate-100 dark:border-slate-800'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-primary dark:text-white">{m.name}</h4>
                                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${isPurchased ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {isPurchased ? 'Comprado' : 'Pendente'}
                                        </div>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${isPurchased ? 'bg-success' : 'bg-secondary'}`} style={{width: `${percentage}%`}}></div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold text-slate-500 whitespace-nowrap">
                                            {m.purchasedQty} / {m.plannedQty} {m.unit}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                     </div>
                </div>
            ))}
            
            {materials.length === 0 && (
                 <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                    <i className="fa-solid fa-cart-shopping text-4xl text-slate-200 dark:text-slate-700 mb-3"></i>
                    <p className="text-slate-400 font-medium">Nenhum material na lista.</p>
                 </div>
            )}

            {/* CREATE MODAL */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl">
                         <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Novo Material</h3>
                         <form onSubmit={handleAdd} className="space-y-4">
                             <input placeholder="Nome do Material" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} />
                             <div className="grid grid-cols-2 gap-3">
                                <input type="number" placeholder="Qtd" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.plannedQty} onChange={e => setNewMaterial({...newMaterial, plannedQty: e.target.value})} />
                                <input placeholder="Un (kg, m, un)" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.unit} onChange={e => setNewMaterial({...newMaterial, unit: e.target.value})} />
                             </div>
                             <input placeholder="Categoria (ex: Pintura)" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})} />
                             <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                             </div>
                         </form>
                    </div>
                </div>
            )}
            
            {/* EDIT MODAL */}
            {editingMaterial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">Atualizar Estoque</h3>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl mb-2">
                                <p className="text-sm font-bold text-primary dark:text-white">{editingMaterial.name}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Planejado</label>
                                    <input type="number" className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" value={editingMaterial.plannedQty} onChange={e => setEditingMaterial({...editingMaterial, plannedQty: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400">Comprado</label>
                                    <input type="number" className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" value={editingMaterial.purchasedQty} onChange={e => setEditingMaterial({...editingMaterial, purchasedQty: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-slate-400">Valor desta compra (Opcional)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">R$</span>
                                    <input type="number" className="w-full pl-8 pr-4 py-2 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" placeholder="0.00" value={editCost} onChange={e => setEditCost(e.target.value)} />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Se preencher, lança no financeiro automaticamente.</p>
                            </div>
                             <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => { setEditingMaterial(null); setEditCost(''); }} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold">Salvar</button>
                             </div>
                             <button type="button" onClick={async () => { await dbService.deleteMaterial(editingMaterial.id); setEditingMaterial(null); load(); }} className="w-full py-2 text-red-500 text-xs font-bold uppercase tracking-wider">Excluir Material</button>
                        </form>
                    </div>
                </div>
            )}

            {/* IMPORT MODAL */}
            {isImportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-primary dark:text-white">Pacotes Prontos</h3>
                            <button onClick={() => setIsImportOpen(false)}><i className="fa-solid fa-xmark text-slate-400"></i></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                             {FULL_MATERIAL_PACKAGES.map(pkg => (
                                 <button key={pkg.category} onClick={() => handleImport(pkg.category)} className="w-full p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left group">
                                     <h4 className="font-bold text-primary dark:text-white group-hover:text-secondary">{pkg.category}</h4>
                                     <p className="text-xs text-slate-400">{pkg.items.length} itens sugeridos</p>
                                 </button>
                             ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Expenses Tab ---
const ExpensesTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [groupedExpenses, setGroupedExpenses] = useState<Record<string, {total: number, items: Expense[]}>>({});
    const [steps, setSteps] = useState<Step[]>([]);
    
    // Form
    const [formData, setFormData] = useState<Partial<Expense>>({
        date: new Date().toISOString().split('T')[0],
        category: ExpenseCategory.MATERIAL,
        amount: 0,
        paidAmount: 0,
        description: '',
        stepId: 'geral' 
    });
    
    // Edit Mode
    const [editingId, setEditingId] = useState<string | null>(null);

    const load = async () => {
        const [exp, stp] = await Promise.all([
            dbService.getExpenses(workId),
            dbService.getSteps(workId)
        ]);
        setExpenses(exp);
        setSteps(stp);

        // Grouping
        const grouped: Record<string, {total: number, items: Expense[]}> = {};
        
        // Helper to find step name
        const getStepName = (id?: string) => {
            if (!id || id === 'geral') return 'Geral / Obra Toda';
            const s = stp.find(st => st.id === id);
            return s ? s.name : 'Outros';
        };

        exp.forEach(e => {
            const groupName = getStepName(e.stepId);
            if (!grouped[groupName]) grouped[groupName] = { total: 0, items: [] };
            grouped[groupName].items.push(e);
            grouped[groupName].total += (e.paidAmount || 0); // Sum paid amount for total
        });
        
        setGroupedExpenses(grouped);
        onUpdate();
    };

    useEffect(() => { load(); }, [workId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            workId,
            description: formData.description!,
            amount: Number(formData.amount),
            paidAmount: Number(formData.paidAmount),
            category: formData.category!,
            date: formData.date!,
            stepId: formData.stepId === 'geral' ? undefined : formData.stepId,
            quantity: 1
        };

        if (editingId) {
            await dbService.updateExpense({ ...payload, id: editingId } as Expense);
        } else {
            await dbService.addExpense(payload);
        }

        setIsCreateOpen(false);
        setEditingId(null);
        setFormData({
            date: new Date().toISOString().split('T')[0],
            category: ExpenseCategory.MATERIAL,
            amount: 0,
            paidAmount: 0,
            description: '',
            stepId: 'geral'
        });
        load();
    };
    
    const handleEdit = (expense: Expense) => {
        setEditingId(expense.id);
        setFormData({
            ...expense,
            stepId: expense.stepId || 'geral'
        });
        setIsCreateOpen(true);
    };

    const handleDelete = async (id: string) => {
        if(confirm("Excluir este gasto?")) {
             await dbService.deleteExpense(id);
             setIsCreateOpen(false);
             load();
        }
    };

    // Auto-fill description for Labor
    useEffect(() => {
        if (formData.category === ExpenseCategory.LABOR && !formData.description) {
            // Optional: could add logic here
        }
    }, [formData.category]);

    return (
        <div className="animate-in fade-in duration-500 pb-20">
             <div className="flex items-center justify-between mb-8">
                <SectionHeader title="Gastos" subtitle="Controle financeiro detalhado." />
                <button onClick={() => { setEditingId(null); setIsCreateOpen(true); }} className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all">
                    <i className="fa-solid fa-plus text-lg"></i>
                </button>
            </div>

            {Object.keys(groupedExpenses).sort().map(group => (
                <div key={group} className="mb-8">
                    <div className="flex justify-between items-end mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <h3 className="font-bold text-primary dark:text-white">{group}</h3>
                        <span className="text-xs font-bold text-slate-500">R$ {groupedExpenses[group].total.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="space-y-3">
                        {groupedExpenses[group].items.map(expense => {
                             const isPaid = expense.paidAmount === expense.amount;
                             const isPartial = (expense.paidAmount || 0) > 0 && (expense.paidAmount || 0) < expense.amount;
                             
                             return (
                                 <div key={expense.id} onClick={() => handleEdit(expense)} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer">
                                     <div className="flex justify-between items-start mb-2">
                                         <div className="flex items-center gap-3">
                                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                                                 expense.category === ExpenseCategory.MATERIAL ? 'bg-blue-50 text-blue-600' :
                                                 expense.category === ExpenseCategory.LABOR ? 'bg-orange-50 text-orange-600' :
                                                 'bg-slate-50 text-slate-600'
                                             }`}>
                                                 <i className={`fa-solid ${
                                                     expense.category === ExpenseCategory.MATERIAL ? 'fa-box' :
                                                     expense.category === ExpenseCategory.LABOR ? 'fa-helmet-safety' : 'fa-tag'
                                                 }`}></i>
                                             </div>
                                             <div>
                                                 <p className="font-bold text-sm text-primary dark:text-white">{expense.description}</p>
                                                 <p className="text-[10px] text-slate-400">{new Date(expense.date).toLocaleDateString('pt-BR')}</p>
                                             </div>
                                         </div>
                                         <div className="text-right">
                                             <p className="font-bold text-primary dark:text-white">R$ {expense.amount.toLocaleString('pt-BR')}</p>
                                             <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                 isPaid ? 'bg-green-100 text-green-700' : 
                                                 isPartial ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                             }`}>
                                                 {isPaid ? 'Pago' : isPartial ? 'Parcial' : 'Pendente'}
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             )
                        })}
                    </div>
                </div>
            ))}
            
            {expenses.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <i className="fa-solid fa-wallet text-4xl text-slate-200 dark:text-slate-700 mb-3"></i>
                <p className="text-slate-400 font-medium">Nenhum gasto lançado.</p>
                </div>
            )}

            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold text-primary dark:text-white mb-6">{editingId ? 'Editar Gasto' : 'Novo Gasto'}</h3>
                        <form onSubmit={handleSave} className="space-y-4">
                            
                            {/* 1. O QUE (Categoria) */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tipo de Gasto</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[ExpenseCategory.MATERIAL, ExpenseCategory.LABOR, ExpenseCategory.PERMITS, ExpenseCategory.OTHER].map(cat => (
                                        <button 
                                            key={cat}
                                            type="button"
                                            onClick={() => setFormData({...formData, category: cat})}
                                            className={`p-2 rounded-xl text-xs font-bold border ${formData.category === cat ? 'bg-primary text-white border-primary' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 2. ONDE (Etapa) */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Etapa da Obra</label>
                                <select 
                                    className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm"
                                    value={formData.stepId}
                                    onChange={e => setFormData({...formData, stepId: e.target.value})}
                                >
                                    <option value="geral">Geral / Obra Toda</option>
                                    {steps.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 3. DESCRIÇÃO */}
                            {formData.category === ExpenseCategory.LABOR ? (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Profissão / Serviço</label>
                                    <select 
                                        className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm"
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="Serviço de Pedreiro">Pedreiro</option>
                                        <option value="Serviço de Pintor">Pintor</option>
                                        <option value="Serviço de Eletricista">Eletricista</option>
                                        <option value="Serviço de Encanador">Encanador</option>
                                        <option value="Serviço de Ajudante">Ajudante</option>
                                        <option value="Empreita Global">Empreiteiro</option>
                                    </select>
                                </div>
                            ) : (
                                <input 
                                    placeholder="Descrição (ex: Cimento, Taxa)" 
                                    className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm" 
                                    value={formData.description}
                                    onChange={e => setFormData({...formData, description: e.target.value})}
                                    required
                                />
                            )}

                            {/* 4. VALORES */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Valor Total</label>
                                    <input type="number" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Valor Pago</label>
                                    <input type="number" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none" value={formData.paidAmount} onChange={e => setFormData({...formData, paidAmount: Number(e.target.value)})} />
                                </div>
                            </div>

                            <input type="date" className="w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                            
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg">Salvar</button>
                            </div>
                            {editingId && (
                                <button type="button" onClick={() => handleDelete(editingId)} className="w-full py-2 text-red-500 text-xs font-bold uppercase tracking-wider">Excluir</button>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- More / Super Menu Tab ---
const MoreMenuTab: React.FC<{ workId: string }> = ({ workId }) => {
    const { user } = useAuth();
    const isLifetime = user?.plan === PlanType.VITALICIO;
    
    // View State
    const [activeSection, setActiveSection] = useState<string | null>(null);

    const sections = [
        { id: 'TEAM', icon: 'fa-users', label: 'Equipe', color: 'bg-blue-500' },
        { id: 'SUPPLIERS', icon: 'fa-truck', label: 'Fornecedores', color: 'bg-indigo-500' },
        { id: 'REPORTS', icon: 'fa-chart-line', label: 'Relatórios', color: 'bg-emerald-500' },
        { id: 'PHOTOS', icon: 'fa-camera', label: 'Galeria', color: 'bg-rose-500' },
        { id: 'FILES', icon: 'fa-folder-open', label: 'Projetos', color: 'bg-orange-500' },
    ];

    const bonusFeatures = [
        { id: 'AI', icon: 'fa-robot', label: 'IA do Zé da Obra', desc: 'Tire dúvidas 24h' },
        { id: 'CALC', icon: 'fa-calculator', label: 'Calculadora', desc: 'Estimativa de material' },
        { id: 'CONTRACTS', icon: 'fa-file-signature', label: 'Contratos', desc: 'Modelos prontos' },
        { id: 'CHECKLISTS', icon: 'fa-list-check', label: 'Checklists', desc: 'Não esqueça nada' },
    ];

    // Render Active Sub-View
    if (activeSection === 'TEAM' || activeSection === 'SUPPLIERS') return <ContactsView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'PHOTOS') return <PhotosView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'FILES') return <FilesView workId={workId} onBack={() => setActiveSection(null)} />;
    if (activeSection === 'REPORTS') return <ReportsView workId={workId} onBack={() => setActiveSection(null)} />;

    return (
        <div className="animate-in fade-in duration-500 pb-24">
            <SectionHeader title="Mais Opções" subtitle="Gestão completa e ferramentas." />
            
            {/* MANAGEMENT GRID */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                {sections.map(s => (
                    <button 
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-95"
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg ${s.color}`}>
                            <i className={`fa-solid ${s.icon}`}></i>
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{s.label}</span>
                    </button>
                ))}
            </div>

            {/* LIFETIME BONUS SECTION */}
            <div className={`relative rounded-3xl p-6 overflow-hidden ${isLifetime ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                {!isLifetime && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-6">
                        <i className="fa-solid fa-lock text-3xl text-slate-400 mb-3"></i>
                        <h3 className="font-bold text-primary dark:text-white mb-1">Bônus Exclusivo</h3>
                        <p className="text-xs text-slate-500 mb-4">Disponível no Plano Vitalício</p>
                        <button onClick={() => window.location.hash = '#/settings'} className="bg-premium text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-purple-500/20 text-sm">
                            Liberar Acesso
                        </button>
                    </div>
                )}

                <div className="relative z-0">
                    <div className="flex items-center gap-3 mb-6">
                         <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                             <i className="fa-solid fa-crown"></i>
                         </div>
                         <div>
                             <h3 className={`font-bold ${isLifetime ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>Ferramentas Premium</h3>
                             <p className={`text-xs ${isLifetime ? 'text-slate-400' : 'text-slate-500'}`}>Incluso no seu plano</p>
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {bonusFeatures.map(f => (
                            <button key={f.id} onClick={() => isLifetime && alert("Funcionalidade " + f.label + " será implementada em breve.")} className={`p-4 rounded-xl text-left transition-all ${isLifetime ? 'bg-white/10 hover:bg-white/20 border border-white/5' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}>
                                <i className={`fa-solid ${f.icon} text-xl mb-2 ${isLifetime ? 'text-secondary' : 'text-slate-400'}`}></i>
                                <h4 className={`font-bold text-sm mb-0.5 ${isLifetime ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>{f.label}</h4>
                                <p className={`text-[10px] leading-tight ${isLifetime ? 'text-slate-400' : 'text-slate-400'}`}>{f.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
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
  
  // AI Chat State
  const [showAiChat, setShowAiChat] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiHistory, setAiHistory] = useState<{sender: 'user'|'ze', text: string}[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const loadWork = async () => {
      if (!id) return;
      setLoading(true);
      const w = await dbService.getWorkById(id);
      if (w) {
          setWork(w);
          const s = await dbService.calculateWorkStats(id);
          setStats(s);
      }
      setLoading(false);
  };

  useEffect(() => {
      loadWork();
  }, [id]);

  const handleAiSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!aiMessage.trim()) return;
      
      const userMsg = aiMessage;
      setAiHistory(prev => [...prev, { sender: 'user', text: userMsg }]);
      setAiMessage('');
      setAiLoading(true);

      const response = await aiService.sendMessage(userMsg);
      
      setAiHistory(prev => [...prev, { sender: 'ze', text: response }]);
      setAiLoading(false);
  };

  if (loading) return (
      <div className="min-h-screen flex items-center justify-center text-secondary">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
  );

  if (!work) return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-xl font-bold text-slate-500 mb-4">Obra não encontrada</h2>
          <button onClick={() => navigate('/')} className="text-primary hover:underline">Voltar ao Painel</button>
      </div>
  );

  return (
      <div className="min-h-screen pb-24"> {/* Added padding for bottom bar */}
          
          {/* Top Header */}
          <div className="sticky top-0 z-30 bg-surface/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-4 flex justify-between items-center">
               <div className="flex items-center gap-3">
                   <button onClick={() => navigate('/')} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                       <i className="fa-solid fa-arrow-left"></i>
                   </button>
                   <h1 className="font-bold text-primary dark:text-white truncate max-w-[200px]">{work.name}</h1>
               </div>
               <button 
                  onClick={() => setShowAiChat(true)}
                  className="bg-secondary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20"
              >
                  <i className="fa-solid fa-robot text-xs"></i>
              </button>
          </div>

          {/* Content Area */}
          <div className="max-w-4xl mx-auto p-4 md:p-6">
              {activeTab === 'overview' && <OverviewTab work={work} stats={stats} onGoToSteps={() => setActiveTab('steps')} />}
              {activeTab === 'steps' && <StepsTab workId={work.id} refreshWork={loadWork} />}
              {activeTab === 'materials' && <MaterialsTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'expenses' && <ExpensesTab workId={work.id} onUpdate={loadWork} />}
              {activeTab === 'more' && <MoreMenuTab workId={work.id} />}
          </div>

          {/* Bottom Navigation Bar */}
          <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-6 flex justify-between items-center z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
              {[
                  { id: 'overview', icon: 'fa-house', label: 'Geral' },
                  { id: 'steps', icon: 'fa-calendar-days', label: 'Cronograma' },
                  { id: 'materials', icon: 'fa-cart-shopping', label: 'Materiais' },
                  { id: 'expenses', icon: 'fa-wallet', label: 'Gastos' },
                  { id: 'more', icon: 'fa-bars', label: 'Mais' },
              ].map(tab => (
                  <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300 ${
                          activeTab === tab.id ? 'text-secondary -translate-y-2' : 'text-slate-400 hover:text-slate-600'
                      }`}
                  >
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg transition-all ${
                          activeTab === tab.id ? 'bg-secondary text-white shadow-lg shadow-orange-500/30' : ''
                      }`}>
                          <i className={`fa-solid ${tab.icon}`}></i>
                      </div>
                      <span className={`text-[10px] font-bold ${activeTab === tab.id ? 'opacity-100' : 'opacity-0'}`}>{tab.label}</span>
                  </button>
              ))}
          </div>

          {/* Zé da Obra Chat Modal */}
          {showAiChat && (
              <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900 animate-in slide-in-from-bottom duration-300 md:max-w-md md:right-4 md:bottom-20 md:left-auto md:top-auto md:h-[600px] md:rounded-3xl md:shadow-2xl md:border md:border-slate-200">
                  <div className="p-4 bg-primary text-white flex justify-between items-center shrink-0 md:rounded-t-3xl">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/10 p-1">
                              <img src={ZE_AVATAR} className="w-full h-full object-cover rounded-full" />
                          </div>
                          <div>
                              <h3 className="font-bold text-sm">Zé da Obra</h3>
                              <p className="text-[10px] text-green-300 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span> Online</p>
                          </div>
                      </div>
                      <button onClick={() => setShowAiChat(false)} className="text-white/70 hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"><i className="fa-solid fa-xmark"></i></button>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-black/20">
                      {aiHistory.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-6">
                              <i className="fa-solid fa-comments text-4xl mb-3"></i>
                              <p className="text-sm font-medium">"Fala chefe! Tô aqui pra ajudar. Pode perguntar sobre a obra, materiais ou pedir uma dica!"</p>
                          </div>
                      )}
                      {aiHistory.map((msg, i) => (
                          <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none shadow-sm'}`}>
                                  {msg.text}
                              </div>
                          </div>
                      ))}
                      {aiLoading && (
                          <div className="flex justify-start">
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm">
                                  <div className="flex gap-1.5">
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  <form onSubmit={handleAiSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0 md:rounded-b-3xl">
                      <input 
                          className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-secondary/50 outline-none dark:text-white"
                          placeholder="Digite sua dúvida..."
                          value={aiMessage}
                          onChange={e => setAiMessage(e.target.value)}
                      />
                      <button type="submit" disabled={!aiMessage.trim() || aiLoading} className="w-12 h-12 rounded-xl bg-secondary text-white flex items-center justify-center hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          <i className="fa-solid fa-paper-plane"></i>
                      </button>
                  </form>
              </div>
          )}
      </div>
  );
};

export default WorkDetail;