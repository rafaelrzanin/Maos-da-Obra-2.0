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
    <div className="mb-8">
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
                    alt="Zé" 
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

      {/* ZÉ MODAL */}
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
                             <img src={ZE_AVATAR} alt="Zé" className="w-full h-full object-cover rounded-full border-2 border-white" />
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

const WorkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [work, setWork] = useState<Work | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
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
      <div className="max-w-6xl mx-auto pb-24 pt-6 px-4 md:px-0">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                  <button onClick={() => navigate('/')} className="text-xs font-bold text-slate-400 hover:text-primary mb-2 flex items-center gap-1 transition-colors">
                      <i className="fa-solid fa-arrow-left"></i> Voltar
                  </button>
                  <h1 className="text-3xl font-extrabold text-primary dark:text-white flex items-center gap-3">
                      {work.name}
                      <span className={`text-xs px-2 py-1 rounded-lg border uppercase tracking-widest ${work.status === 'Planejamento' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                          {work.status}
                      </span>
                  </h1>
              </div>
              <button 
                  onClick={() => setShowAiChat(true)}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all transform hover:scale-105"
              >
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                      <i className="fa-solid fa-robot text-xs"></i>
                  </div>
                  Falar com o Zé
              </button>
          </div>

          {/* Navigation */}
          <div className="flex overflow-x-auto gap-2 mb-8 pb-2 hide-scrollbar">
              {[
                  { id: 'overview', icon: 'fa-chart-pie', label: 'Visão Geral' },
                  { id: 'steps', icon: 'fa-list-check', label: 'Cronograma' },
              ].map(tab => (
                  <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                          activeTab === tab.id 
                          ? 'bg-primary text-white shadow-md' 
                          : 'bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                  >
                      <i className={`fa-solid ${tab.icon}`}></i>
                      {tab.label}
                  </button>
              ))}
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm min-h-[400px]">
              {activeTab === 'overview' && (
                  <OverviewTab work={work} stats={stats} onGoToSteps={() => setActiveTab('steps')} />
              )}
              {activeTab === 'steps' && (
                  <StepsTab workId={work.id} refreshWork={loadWork} />
              )}
          </div>

          {/* Zé Chat */}
          {showAiChat && (
              <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 w-full md:w-[380px] h-[500px] bg-white dark:bg-slate-900 md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                  <div className="p-4 bg-primary text-white flex justify-between items-center shrink-0">
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

                  <form onSubmit={handleAiSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2 shrink-0">
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