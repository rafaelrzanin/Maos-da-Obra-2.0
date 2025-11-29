

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
        <h2 className="text-xl font-bold text-text-main dark:text-white">{title}</h2>
        <p className="text-sm text-text-muted dark:text-slate-400">{subtitle}</p>
    </div>
);

// --- ZÉ DA OBRA MODAL (SUBSTITUI O CONFIRM MODAL) ---
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

const ZeModal: React.FC<ZeModalProps> = ({ isOpen, title, message, confirmText = "Sim, confirmar", cancelText = "Melhor não", type = 'DANGER', onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  const isDanger = type === 'DANGER';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 print:hidden">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border-2 border-primary/20 transform scale-100 transition-all">
        <div className="flex gap-4">
            <div className="w-16 h-16 rounded-full bg-white border-2 border-primary p-0.5 shrink-0 shadow-lg overflow-hidden relative">
                    <img 
                    src={ZE_AVATAR} 
                    alt="Zé da Obra" 
                    className="w-full h-full object-cover rounded-full"
                    onError={(e) => {
                        e.currentTarget.src = 'https://ui-avatars.com/api/?name=Ze+Obra&background=1E3A45&color=fff';
                    }}
                    />
            </div>
            <div>
                <h3 className="text-lg font-bold text-text-main dark:text-white leading-tight mb-1">Ei, Chefe!</h3>
                <p className="text-sm font-medium text-text-main dark:text-white">{title}</p>
            </div>
        </div>
        
        <div className={`mt-4 mb-6 p-4 rounded-xl text-sm leading-relaxed ${isDanger ? 'bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-200' : 'bg-slate-50 dark:bg-slate-800 text-text-body dark:text-slate-300'}`}>
            <p>{message}</p>
        </div>

        <div className="flex flex-col gap-3">
            <button 
                onClick={onConfirm} 
                className={`w-full py-3.5 rounded-xl text-white font-bold transition-colors shadow-lg flex items-center justify-center gap-2 ${isDanger ? 'bg-danger hover:bg-red-600 shadow-danger/20' : 'bg-primary hover:bg-primary-dark shadow-primary/20'}`}
            >
                {confirmText}
            </button>
            <button 
                onClick={onCancel} 
                className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-text-muted font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
                {cancelText}
            </button>
        </div>
      </div>
    </div>
  );
};

// --- TABS ---

// 1. INÍCIO
const OverviewTab: React.FC<{ work: Work, stats: any, onGoToSteps: () => void }> = ({ work, stats, onGoToSteps }) => {
  const budgetUsage = work.budgetPlanned > 0 ? (stats.totalSpent / work.budgetPlanned) * 100 : 0;
  
  const pieData = [
    { name: 'Concluído', value: stats.progress, fill: '#2BB86B' }, 
    { name: 'Pendente', value: 100 - stats.progress, fill: '#E2E8F0' } 
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SectionHeader 
          title="Como estamos indo?" 
          subtitle="O resumo mais importante da sua obra."
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center h-full relative">
            <h3 className="absolute top-6 left-6 text-xs text-text-muted dark:text-slate-400 uppercase font-bold tracking-wider">Quanto já fiz</h3>
            <div className="w-full h-40 relative">
                <Recharts.ResponsiveContainer width="100%" height="100%">
                    <Recharts.PieChart>
                        <Recharts.Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        >
                             <Recharts.Label 
                                value={`${stats.progress}%`} 
                                position="center" 
                                className="text-3xl font-bold fill-slate-800 dark:fill-white"
                                style={{ fontSize: '28px', fontWeight: 'bold' }}
                            />
                        </Recharts.Pie>
                    </Recharts.PieChart>
                </Recharts.ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center h-full">
             <div className="text-center mb-4">
                 <p className="text-xs text-text-muted dark:text-slate-400 uppercase font-bold tracking-wider mb-2">Quanto já gastei do total</p>
                 <p className="text-3xl font-bold text-text-main dark:text-white mb-1">R$ {stats.totalSpent.toLocaleString('pt-BR')}</p>
                 <p className="text-sm text-text-muted dark:text-slate-500">Minha meta: R$ {work.budgetPlanned.toLocaleString('pt-BR')}</p>
             </div>
             <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2 overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ${budgetUsage > 90 ? 'bg-danger' : 'bg-primary'}`} 
                    style={{ width: `${Math.min(budgetUsage, 100)}%` }}
                ></div>
             </div>
        </div>
      </div>

      <div 
          onClick={() => { if (stats.delayedSteps > 0) onGoToSteps(); }}
          className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all ${stats.delayedSteps > 0 ? 'cursor-pointer border-l-4 border-l-danger hover:shadow-md' : 'border-l-4 border-l-success'}`}
        >
            <div>
                <p className="text-xs text-text-muted dark:text-slate-400 uppercase font-bold tracking-wider mb-1">Prazos</p>
                <h3 className={`text-xl font-bold ${stats.delayedSteps > 0 ? 'text-danger' : 'text-success'}`}>
                    {stats.delayedSteps > 0 ? `${stats.delayedSteps} Tarefas Atrasadas` : 'Tudo no prazo'}
                </h3>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stats.delayedSteps > 0 ? 'bg-danger/10 text-danger animate-pulse' : 'bg-success/10 text-success'}`}>
                 <i className={`fa-solid ${stats.delayedSteps > 0 ? 'fa-exclamation' : 'fa-check'}`}></i>
            </div>
        </div>
    </div>
  );
};

// 2. ETAPAS (Mantido igual)
const StepsTab: React.FC<{ workId: string, refreshWork: () => void }> = ({ workId, refreshWork }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepDate, setNewStepDate] = useState('');
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  
  // Zé Modal State
  const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  
  // States for Smart Material Import Logic
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
          if (count > 0) alert(`${count} materiais sugeridos foram adicionados à lista de compras!`);
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
          title: "Vou apagar essa etapa",
          message: "Se você excluir, o histórico dela some para sempre. Se só quiser cancelar, talvez seja melhor mudar o nome ou data. Quer apagar mesmo?",
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
         <div>
            <h2 className="text-xl font-bold text-text-main dark:text-white">Minhas Tarefas</h2>
            <p className="text-sm text-text-muted dark:text-slate-400">Toque no círculo para avançar a etapa.</p>
         </div>
         <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2"
          >
              <i className="fa-solid fa-plus"></i> Adicionar
          </button>
      </div>

      <div className="space-y-3">
        {steps.map(step => {
            const isComplete = step.status === StepStatus.COMPLETED;
            const isInProgress = step.status === StepStatus.IN_PROGRESS;
            const now = new Date();
            const endDate = new Date(step.endDate);
            const isLate = !isComplete && now > endDate;

            let containerClass = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm";
            let textClass = "text-text-main dark:text-white";
            let checkClass = "border-slate-300 text-transparent hover:border-primary";

            if (isComplete) {
                containerClass = "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60";
                textClass = "line-through text-text-muted";
                checkClass = "bg-success border-success text-white";
            } else if (isLate) {
                containerClass = "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900 shadow-sm";
                checkClass = "border-red-300 text-red-300"; 
            } else if (isInProgress) {
                containerClass = "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 shadow-sm";
                checkClass = "border-orange-400 text-orange-500 bg-white dark:bg-slate-800";
            }

            return (
                <div key={step.id} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${containerClass}`}>
                    <div className="flex items-center gap-4 flex-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleStatus(step); }}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 shadow-sm ${checkClass}`}
                        >
                            {isComplete && <i className="fa-solid fa-check text-sm"></i>}
                            {!isComplete && isInProgress && <i className="fa-solid fa-play text-[10px] ml-0.5"></i>}
                            {!isComplete && !isInProgress && isLate && <i className="fa-solid fa-exclamation text-sm"></i>}
                        </button>
                        
                        <div onClick={() => setEditingStep(step)} className="cursor-pointer flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                                <p className={`font-bold leading-tight ${textClass}`}>
                                    {step.name}
                                </p>
                            </div>
                            
                            <div className="flex items-center flex-wrap gap-2 text-xs">
                                <span className="text-text-muted dark:text-slate-500">
                                    {new Date(step.startDate).toLocaleDateString('pt-BR')} até {new Date(step.endDate).toLocaleDateString('pt-BR')}
                                </span>
                                {isLate && <span className="font-bold bg-danger text-white px-2 py-0.5 rounded-full text-[10px] tracking-wide">ATRASADO</span>}
                                {!isLate && isInProgress && <span className="font-bold bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 rounded-full text-[10px] tracking-wide">EM ANDAMENTO</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setEditingStep(step)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-primary">
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                </div>
            )
        })}
        {steps.length === 0 && (
             <div className="p-8 text-center text-text-muted bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-700">
                <p>Nenhuma etapa cadastrada.</p>
             </div>
        )}
      </div>

      {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-text-main dark:text-white mb-4">Nova Etapa</h3>
                  <form onSubmit={handleCreateStep} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-text-muted mb-1">O que fazer?</label>
                          <input 
                             placeholder="Ex: Instalar Piso, Pintar Quarto..."
                             className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none"
                             value={newStepName}
                             onChange={e => setNewStepName(e.target.value)}
                             required
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-text-muted mb-1">Data Início</label>
                          <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none" value={newStepDate} onChange={e => setNewStepDate(e.target.value)} required />
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button type="button" onClick={() => setIsCreateModalOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-text-muted">Cancelar</button>
                          <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {editingStep && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-text-main dark:text-white">Editar Etapa</h3>
                      <button onClick={() => handleDeleteClick(editingStep.id)} className="text-danger text-sm font-bold hover:underline">
                          Excluir
                      </button>
                  </div>
                  <form onSubmit={handleUpdateStep} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-text-muted mb-1">Nome</label>
                          <input 
                             className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none"
                             value={editingStep.name}
                             onChange={e => setEditingStep({...editingStep, name: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Início</label>
                            <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none" value={editingStep.startDate} onChange={e => setEditingStep({...editingStep, startDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Fim</label>
                            <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none" value={editingStep.endDate} onChange={e => setEditingStep({...editingStep, endDate: e.target.value})} />
                        </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-text-muted mb-1">Status</label>
                          <select 
                            value={editingStep.status}
                            onChange={e => setEditingStep({...editingStep, status: e.target.value as StepStatus})}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none"
                          >
                              <option value={StepStatus.NOT_STARTED}>A fazer</option>
                              <option value={StepStatus.IN_PROGRESS}>Em Andamento</option>
                              <option value={StepStatus.COMPLETED}>Concluído</option>
                          </select>
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button type="button" onClick={() => setEditingStep(null)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-text-muted">Cancelar</button>
                          <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold">Atualizar</button>
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

      {pendingStartStep && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border-2 border-primary/20 transform scale-100 transition-all">
                <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-primary p-0.5 shrink-0 shadow-lg overflow-hidden relative">
                         <img 
                            src={ZE_AVATAR} 
                            alt="Zé da Obra" 
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                                e.currentTarget.src = 'https://ui-avatars.com/api/?name=Ze+Obra&background=1E3A45&color=fff';
                            }}
                         />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text-main dark:text-white leading-tight mb-1">Oi, chefe!</h3>
                        <p className="text-sm text-text-muted dark:text-slate-400">Vi que você vai começar a <strong>{foundPackage}</strong>.</p>
                    </div>
                </div>
                
                <div className="mt-4 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm text-text-body dark:text-slate-300 leading-relaxed">
                    <p>Quer que eu adicione a lista de materiais padrão dessa fase na sua lista de compras?</p>
                    <p className="mt-2 text-xs font-bold text-primary">Isso economiza uns 10 minutos de digitação! 😉</p>
                </div>

                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleConfirmImport} 
                        className="w-full py-3.5 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Sim, gerar lista agora
                    </button>
                    <button 
                        onClick={handleCancelImport} 
                        className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-text-muted font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        Não, obrigado
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// 3. MATERIAIS (Mantido igual)
const MaterialsTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [newMat, setNewMat] = useState({ name: '', qty: '', unit: 'un', category: 'Geral' });
  const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [costInput, setCostInput] = useState('');

  const loadMaterials = async () => {
    const data = await dbService.getMaterials(workId);
    setMaterials(data);
  };
  
  useEffect(() => { loadMaterials(); }, [workId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await dbService.addMaterial({
      workId,
      name: newMat.name,
      plannedQty: Number(newMat.qty),
      purchasedQty: 0,
      unit: newMat.unit,
      category: newMat.category
    });
    setNewMat({ name: '', qty: '', unit: 'un', category: 'Geral' });
    setShowAddForm(false);
    loadMaterials();
    onUpdate();
  };

  const handleUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingMaterial) {
          await dbService.updateMaterial(editingMaterial, Number(costInput));
          setEditingMaterial(null);
          setCostInput(''); 
          loadMaterials();
          onUpdate();
      }
  };

  const handleDeleteClick = (id: string) => {
    setZeModal({
        isOpen: true,
        title: "Tirar da lista?",
        message: "Opa, vai remover esse material? Se já comprou, isso pode bagunçar seu controle. Posso apagar?",
        onConfirm: async () => {
            await dbService.deleteMaterial(id);
            setEditingMaterial(null);
            loadMaterials();
            onUpdate();
            setZeModal(prev => ({ ...prev, isOpen: false }));
        }
    });
  }

  const handleImportPackage = async (category: string) => {
    setShowPackageModal(false);
    const count = await dbService.importMaterialPackage(workId, category);
    if (count > 0) {
        alert(`${count} itens foram adicionados em "${category}"!`);
        loadMaterials();
        onUpdate();
    } else {
        alert("Não encontramos itens para esta categoria.");
    }
  };

  const openEditModal = (mat: Material) => {
      setEditingMaterial(mat);
      setCostInput(''); 
  };

  const groupedMaterials = materials.reduce((acc, mat) => {
      const cat = mat.category || 'Geral';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(mat);
      return acc;
  }, {} as Record<string, Material[]>);

  const categoryOrder = FULL_MATERIAL_PACKAGES.map(p => p.category);
  const sortedCategories = Object.keys(groupedMaterials).sort((a, b) => {
      const idxA = categoryOrder.indexOf(a);
      const idxB = categoryOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SectionHeader 
          title="Lista de Compras" 
          subtitle="Toque em um item para editar quantidade."
      />

      <div className="flex flex-col gap-3 mb-6">
        <button 
            onClick={() => setShowAddForm(true)}
            className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-text-muted hover:text-primary hover:border-primary transition-all font-bold flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50"
        >
            <i className="fa-solid fa-plus"></i> Novo Item Individual
        </button>
        <button 
            onClick={() => setShowPackageModal(true)}
            className="w-full py-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-premium font-bold flex items-center justify-center gap-2 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
        >
            <i className="fa-solid fa-wand-magic-sparkles"></i> Adicionar Pacote por Etapa
        </button>
      </div>

      {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                <h3 className="font-bold text-text-main dark:text-white mb-4">Novo Material</h3>
                <form onSubmit={handleAdd} className="space-y-4">
                     <div>
                       <label className="text-xs font-bold text-text-muted mb-1 block">Nome do Material</label>
                       <input 
                         placeholder="Ex: Cimento, Tijolo..." 
                         className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none"
                         value={newMat.name}
                         onChange={e => setNewMat({...newMat, name: e.target.value})}
                         required
                       />
                     </div>
                     <div>
                       <label className="text-xs font-bold text-text-muted mb-1 block">Categoria</label>
                       <select 
                         className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none"
                         value={newMat.category}
                         onChange={e => setNewMat({...newMat, category: e.target.value})}
                       >
                           <option value="Geral">Geral</option>
                           {FULL_MATERIAL_PACKAGES.map(p => <option key={p.category} value={p.category}>{p.category}</option>)}
                       </select>
                     </div>
                     <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-text-muted mb-1 block">Quantidade</label>
                            <input 
                            type="number" 
                            placeholder="0" 
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none"
                            value={newMat.qty}
                            onChange={e => setNewMat({...newMat, qty: e.target.value})}
                            required
                            />
                        </div>
                        <div className="w-24">
                            <label className="text-xs font-bold text-text-muted mb-1 block">Unidade</label>
                            <input 
                            type="text" 
                            placeholder="un" 
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none"
                            value={newMat.unit}
                            onChange={e => setNewMat({...newMat, unit: e.target.value})}
                            required
                            />
                        </div>
                     </div>
                     <div className="flex gap-3 pt-2">
                       <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-3 font-bold text-text-muted bg-slate-100 dark:bg-slate-800 rounded-xl">Cancelar</button>
                       <button type="submit" className="flex-1 py-3 font-bold text-white bg-primary rounded-xl">Salvar</button>
                     </div>
                </form>
              </div>
          </div>
      )}

      {showPackageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-text-main dark:text-white mb-2">Pacotes Prontos</h3>
                  <p className="text-sm text-text-muted dark:text-slate-400 mb-4">Escolha a categoria para preencher a lista automaticamente.</p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-6 max-h-[50vh] overflow-y-auto">
                      {FULL_MATERIAL_PACKAGES.map((pkg, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleImportPackage(pkg.category)}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-bold text-text-body dark:text-slate-300"
                          >
                              {pkg.category}
                          </button>
                      ))}
                  </div>
                  
                  <button onClick={() => setShowPackageModal(false)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-text-main dark:text-white font-bold rounded-xl">
                      Cancelar
                  </button>
              </div>
          </div>
      )}

      <div className="space-y-6">
          {sortedCategories.map(category => (
              <div key={category} className="space-y-2">
                   <div className="flex items-center gap-2 px-1">
                       <div className="h-4 w-1 bg-primary rounded-full"></div>
                       <h3 className="font-bold text-text-main dark:text-white uppercase tracking-wider text-sm">{category}</h3>
                   </div>
                   {groupedMaterials[category].map(mat => (
                        <div 
                            key={mat.id} 
                            onClick={() => openEditModal(mat)}
                            className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center group cursor-pointer hover:border-primary/30 transition-all"
                        >
                            <div>
                                <p className="font-bold text-text-main dark:text-white">{mat.name}</p>
                                <div className="text-sm flex gap-3 mt-1">
                                    <span className="text-text-muted dark:text-slate-500">
                                        Planejado: <strong>{mat.plannedQty}</strong> {mat.unit}
                                    </span>
                                    {mat.purchasedQty >= mat.plannedQty ? (
                                        <span className="text-success font-bold text-xs bg-success/10 px-2 py-0.5 rounded-full">Comprado</span>
                                    ) : (
                                        <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${mat.purchasedQty > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {mat.purchasedQty > 0 ? `Comprado: ${mat.purchasedQty}` : 'Não comprado'}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                                <i className="fa-solid fa-pen text-xs"></i>
                            </div>
                        </div>
                   ))}
              </div>
          ))}

          {materials.length === 0 && (
                <div className="text-center py-10 text-text-muted dark:text-slate-500">
                    <p>Sua lista está vazia. Adicione itens acima!</p>
                </div>
           )}
      </div>

      {editingMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-text-main dark:text-white">Editar Material</h3>
                      <button onClick={() => handleDeleteClick(editingMaterial.id)} className="text-danger text-sm font-bold hover:underline">
                          Excluir
                      </button>
                  </div>
                  <form onSubmit={handleUpdate} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-text-muted mb-1">Nome</label>
                          <input 
                             className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none"
                             value={editingMaterial.name}
                             onChange={e => setEditingMaterial({...editingMaterial, name: e.target.value})}
                          />
                      </div>
                      <div>
                       <label className="text-xs font-bold text-text-muted mb-1 block">Categoria</label>
                       <select 
                         className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none"
                         value={editingMaterial.category || 'Geral'}
                         onChange={e => setEditingMaterial({...editingMaterial, category: e.target.value})}
                       >
                           <option value="Geral">Geral</option>
                           {FULL_MATERIAL_PACKAGES.map(p => <option key={p.category} value={p.category}>{p.category}</option>)}
                       </select>
                     </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Planejado</label>
                            <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none" value={editingMaterial.plannedQty} onChange={e => setEditingMaterial({...editingMaterial, plannedQty: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Já Comprado</label>
                            <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white outline-none" value={editingMaterial.purchasedQty} onChange={e => setEditingMaterial({...editingMaterial, purchasedQty: Number(e.target.value)})} />
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                           <label className="block text-xs font-bold text-primary mb-1">
                               <i className="fa-solid fa-money-bill-wave mr-1"></i> Valor desta Compra (R$)
                           </label>
                           <input 
                                type="number" 
                                placeholder="0,00"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-text-main dark:text-white outline-none focus:ring-2 focus:ring-primary" 
                                value={costInput} 
                                onChange={e => setCostInput(e.target.value)} 
                           />
                           <p className="text-[10px] text-text-muted mt-1 leading-tight">
                               Se você colocar um valor aqui, ele será adicionado automaticamente em <strong>Gastos</strong>.
                           </p>
                      </div>
                      
                      <div className="flex gap-3 pt-4">
                          <button type="button" onClick={() => setEditingMaterial(null)} className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-text-muted">Cancelar</button>
                          <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold">Atualizar</button>
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
         onCancel={() => setZeModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

// 4. FINANCEIRO (Mantido igual)
const ExpensesTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [jobRoles, setJobRoles] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
      description: string, amount: string, paidAmount: string, category: ExpenseCategory, date: string, stepId?: string, role?: string
  }>({ description: '', amount: '', paidAmount: '', category: ExpenseCategory.MATERIAL, date: new Date().toISOString().split('T')[0], stepId: undefined, role: '' });
  const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const loadData = async () => {
      const [expData, stepsData, rolesData] = await Promise.all([
          dbService.getExpenses(workId),
          dbService.getSteps(workId),
          dbService.getJobRoles()
      ]);
      setExpenses(expData);
      setSteps(stepsData.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
      setJobRoles(rolesData);
  };

  useEffect(() => { loadData(); }, [workId, user]);

  const resetForm = () => {
      setFormData({ description: '', amount: '', paidAmount: '', category: ExpenseCategory.MATERIAL, date: new Date().toISOString().split('T')[0], stepId: undefined, role: '' });
      setIsEditing(false);
      setEditingId(null);
      setShowForm(false);
  }

  const handleEditClick = (exp: Expense) => {
      const foundRole = jobRoles.find(r => exp.description.toLowerCase().includes(r.toLowerCase())) || '';
      setFormData({ description: exp.description, amount: exp.amount.toString(), paidAmount: (exp.paidAmount ?? exp.amount).toString(), category: exp.category, date: exp.date, stepId: exp.stepId, role: foundRole });
      setIsEditing(true);
      setEditingId(exp.id);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { workId, description: formData.description, amount: Number(formData.amount), paidAmount: Number(formData.paidAmount), quantity: 1, category: formData.category, date: formData.date, stepId: formData.stepId, workerId: undefined };
    if (isEditing && editingId) await dbService.updateExpense({ ...payload, id: editingId });
    else await dbService.addExpense(payload);
    resetForm();
    loadData();
    onUpdate();
  };

  const handleDeleteClick = (id: string) => {
      setZeModal({
          isOpen: true,
          title: "Apagar Gasto",
          message: "Cuidado, chefe! Apagar gastos pode fazer a conta não fechar no final. Tem certeza?",
          onConfirm: async () => {
              await dbService.deleteExpense(id);
              loadData();
              onUpdate();
              setZeModal(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  const handleRoleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const role = e.target.value;
      setFormData(prev => ({ ...prev, role: role, description: role ? `Serviço de ${role}` : prev.description }));
  }

  const groupedExpenses: Record<string, Expense[]> = { 'GERAL': [] };
  steps.forEach(s => { groupedExpenses[s.id] = [] });
  expenses.forEach(exp => {
      if (exp.stepId && groupedExpenses[exp.stepId]) groupedExpenses[exp.stepId].push(exp);
      else groupedExpenses['GERAL'].push(exp);
  });
  const getGroupTotal = (groupExps: Expense[]) => groupExps.reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || 0), 0);

  const ExpenseCard: React.FC<{ exp: Expense }> = ({ exp }) => {
      const paid = exp.paidAmount ?? 0;
      const total = exp.amount;
      let status = 'PAGO';
      if (paid === 0) status = 'PENDENTE';
      else if (paid < total) status = 'PARCIAL';
      return (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col gap-3 relative overflow-hidden group hover:shadow-md transition-all">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${status === 'PENDENTE' ? 'bg-danger' : status === 'PARCIAL' ? 'bg-orange-500' : 'bg-success'}`}></div>
            <div className="flex justify-between items-start pl-3">
                <div className="flex-1 cursor-pointer" onClick={() => handleEditClick(exp)}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-text-muted dark:text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{exp.category}</span>
                        <span className="text-[10px] text-text-muted dark:text-slate-500">• {new Date(exp.date).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <h4 className="font-bold text-text-main dark:text-white text-base leading-tight">{exp.description}</h4>
                </div>
                <div className="flex gap-1 ml-2">
                    <button onClick={() => handleEditClick(exp)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-primary transition-colors"><i className="fa-solid fa-pen text-xs"></i></button>
                    <button onClick={() => handleDeleteClick(exp.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-danger transition-colors"><i className="fa-solid fa-trash text-xs"></i></button>
                </div>
            </div>
            <div className="flex items-end justify-between pl-3 mt-1 border-t border-slate-50 dark:border-slate-800 pt-3">
                <div>
                    {status === 'PENDENTE' && <span className="inline-flex items-center px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-[10px] font-bold uppercase"><i className="fa-regular fa-clock mr-1"></i> Pendente</span>}
                    {status === 'PARCIAL' && <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-[10px] font-bold uppercase"><i className="fa-solid fa-chart-pie mr-1"></i> Parcial</span>}
                    {status === 'PAGO' && <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold uppercase"><i className="fa-solid fa-check mr-1"></i> Pago</span>}
                </div>
                <div className="text-right">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] text-text-muted dark:text-slate-500 font-medium">Valor Total</span>
                        <span className="text-sm font-bold text-text-main dark:text-white">R$ {total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                    {status !== 'PAGO' && <div className="flex flex-col items-end mt-1"><span className="text-[10px] text-text-muted">Pago até agora</span><span className={`text-xs font-bold ${status === 'PENDENTE' ? 'text-danger' : 'text-orange-500'}`}>R$ {paid.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>}
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SectionHeader title="Controle de Gastos" subtitle="Tudo o que saiu do seu bolso, organizado." />
      {!showForm ? (
          <button onClick={() => setShowForm(true)} className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-text-muted hover:text-primary hover:border-primary transition-all font-bold flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50"><i className="fa-solid fa-plus"></i> Anotar gasto</button>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
            <h3 className="font-bold text-text-main dark:text-white mb-4">{isEditing ? 'Editar Despesa' : 'Novo Gasto'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="text-xs font-bold text-text-muted mb-1 block">No que foi gasto?</label><select className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ExpenseCategory})}>{Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                {formData.category === ExpenseCategory.LABOR && <div className="animate-in fade-in slide-in-from-top-1 space-y-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"><label className="text-xs font-bold text-primary block">Qual profissional?</label><div><select className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" onChange={handleRoleSelect} value={formData.role || ''}><option value="" disabled>Selecione a profissão...</option>{jobRoles.map(role => <option key={role} value={role}>{role}</option>)}</select></div></div>}
                <div><label className="text-xs font-bold text-text-muted mb-1 block">Em qual etapa da obra?</label><select className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" value={formData.stepId || ''} onChange={e => setFormData({...formData, stepId: e.target.value || undefined})}><option value="">Geral / Obra Toda</option>{steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="text-xs font-bold text-text-muted mb-1 block">Descrição do item</label><input placeholder="Ex: Cimento, Diária Pedreiro..." required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" /></div>
                <div className="flex gap-4"><div className="flex-1"><label className="text-xs font-bold text-text-muted mb-1 block">Valor Total (R$)</label><input type="number" placeholder="0,00" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" /></div><div className="flex-1"><label className="text-xs font-bold text-text-muted mb-1 block">Valor Pago (R$)</label><input type="number" placeholder="0,00" value={formData.paidAmount} onChange={e => setFormData({...formData, paidAmount: e.target.value})} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary" /><p className="text-[10px] text-text-muted mt-1">Se for parcelado, coloque quanto pagou hoje.</p></div></div>
                <div className="flex gap-3 pt-2"><button type="button" onClick={resetForm} className="flex-1 py-3 font-bold text-text-muted bg-slate-100 dark:bg-slate-800 rounded-xl">Cancelar</button><button type="submit" className="flex-1 py-3 font-bold text-white bg-primary rounded-xl hover:bg-primary-dark">{isEditing ? 'Atualizar' : 'Salvar'}</button></div>
            </form>
        </div>
      )}
      <div className="space-y-6">
          {groupedExpenses['GERAL'].length > 0 && <div className="space-y-2"><div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><div className="h-4 w-1 bg-slate-400 rounded-full"></div><h3 className="font-bold text-text-main dark:text-white uppercase tracking-wider text-sm">Geral / Obra Toda</h3></div><span className="text-xs font-bold text-text-main dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">Pago: R$ {getGroupTotal(groupedExpenses['GERAL']).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div><div className="space-y-3">{groupedExpenses['GERAL'].map(exp => <ExpenseCard key={exp.id} exp={exp} />)}</div></div>}
          {steps.map(step => { const groupExps = groupedExpenses[step.id] || []; if (groupExps.length === 0) return null; const groupTotal = getGroupTotal(groupExps); return (<div key={step.id} className="space-y-2"><div className="flex items-center justify-between px-1"><div className="flex items-center gap-2"><div className="h-4 w-1 bg-primary rounded-full"></div><h3 className="font-bold text-text-main dark:text-white uppercase tracking-wider text-sm truncate max-w-[200px]">{step.name}</h3></div><span className="text-xs font-bold text-text-main dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">Pago: R$ {groupTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div><div className="space-y-3">{groupExps.map(exp => <ExpenseCard key={exp.id} exp={exp} />)}</div></div>); })}
          {expenses.length === 0 && <div className="text-center py-10 text-text-muted dark:text-slate-500"><p>Nenhum gasto lançado ainda.</p></div>}
      </div>
      <ZeModal isOpen={zeModal.isOpen} title={zeModal.title} message={zeModal.message} onConfirm={zeModal.onConfirm} onCancel={() => setZeModal(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

// --- NEW COMPONENTS FOR MORE MENU ---

const AssistantView: React.FC = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
        { role: 'ai', text: `Fala, ${user?.name.split(' ')[0]}! Sou o Zé da Obra. Tô aqui pra ajudar com dicas, dúvidas de material ou o que precisar. Manda aí!` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || loading) return;
        
        const userText = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setLoading(true);

        try {
            const response = await aiService.sendMessage(userText);
            setMessages(prev => [...prev, { role: 'ai', text: response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', text: "Deu ruim na conexão, chefe. Tenta de novo?" }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-4 bg-primary text-white flex items-center gap-3 shadow-md z-10">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-white/50 p-0.5 shrink-0 overflow-hidden">
                    <img src={ZE_AVATAR} alt="Zé" className="w-full h-full object-cover rounded-full" />
                </div>
                <div>
                    <h3 className="font-bold text-sm">Zé da Obra</h3>
                    <p className="text-xs opacity-90">Inteligência Artificial</p>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-primary text-white rounded-tr-none' 
                            : 'bg-white dark:bg-slate-800 text-text-main dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                         <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700 flex gap-2 items-center">
                             <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                             <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                             <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                         </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                <input 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Pergunte sobre materiais, traço de concreto..."
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-text-main dark:text-white px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                />
                <button 
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                    <i className="fa-solid fa-paper-plane"></i>
                </button>
            </form>
        </div>
    );
};

const CalculatorView: React.FC<{workId: string, onBack: () => void}> = ({ onBack }) => {
    const [activeCalc, setActiveCalc] = useState<string | null>(null);
    const [area, setArea] = useState('');
    const [result, setResult] = useState<string | null>(null);

    const handleCalculate = () => {
        if (!activeCalc || !area) return;
        const calc = CALCULATORS[activeCalc as keyof typeof CALCULATORS];
        const val = calc.calculate(Number(area));
        setResult(calc.message(val));
    };

    return (
        <div className="space-y-6 animate-in fade-in">
             <div className="flex items-center gap-2 mb-4">
                 <button onClick={onBack} className="text-sm font-bold text-primary hover:underline"><i className="fa-solid fa-arrow-left"></i> Voltar</button>
             </div>
             
             <SectionHeader title="Calculadoras de Material" subtitle="Estimativas rápidas para sua obra." />

             {!activeCalc ? (
                 <div className="grid grid-cols-2 gap-4">
                     {Object.entries(CALCULATORS).map(([key, calc]) => (
                         <button 
                            key={key}
                            onClick={() => { setActiveCalc(key); setResult(null); setArea(''); }}
                            className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-primary transition-all text-left group"
                         >
                             <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-500 group-hover:text-primary mb-3">
                                 <i className="fa-solid fa-calculator"></i>
                             </div>
                             <h4 className="font-bold text-text-main dark:text-white text-sm">{calc.label}</h4>
                             <p className="text-xs text-text-muted">Calcular em {calc.unit}</p>
                         </button>
                     ))}
                 </div>
             ) : (
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                     <div className="flex justify-between items-center mb-6">
                         <h3 className="font-bold text-lg text-text-main dark:text-white">
                             {CALCULATORS[activeCalc as keyof typeof CALCULATORS].label}
                         </h3>
                         <button onClick={() => setActiveCalc(null)} className="text-xs font-bold text-text-muted">Trocar</button>
                     </div>

                     <div className="mb-6">
                         <label className="block text-xs font-bold text-text-muted mb-2 uppercase">
                             Informe a área/quantidade ({CALCULATORS[activeCalc as keyof typeof CALCULATORS].unit})
                         </label>
                         <div className="flex gap-4">
                             <input 
                                type="number" 
                                value={area}
                                onChange={e => setArea(e.target.value)}
                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-text-main dark:text-white outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                                placeholder="0"
                                autoFocus
                             />
                             <button 
                                onClick={handleCalculate}
                                className="bg-primary text-white px-6 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors"
                             >
                                 Calcular
                             </button>
                         </div>
                     </div>

                     {result && (
                         <div className="bg-success/10 border border-success/20 p-4 rounded-xl flex gap-3 items-start animate-in zoom-in-95">
                             <i className="fa-solid fa-check-circle text-success mt-1"></i>
                             <div>
                                 <p className="font-bold text-success text-sm mb-1">Resultado Estimado</p>
                                 <p className="text-text-main dark:text-slate-200 text-sm leading-relaxed">{result}</p>
                             </div>
                         </div>
                     )}
                 </div>
             )}
        </div>
    );
};

const ContractsView: React.FC = () => {
    const [selectedContract, setSelectedContract] = useState<string | null>(null);

    return (
        <div className="space-y-6 animate-in fade-in">
             <SectionHeader title="Modelos de Contrato" subtitle="Copie, edite e use para se proteger." />
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {CONTRACT_TEMPLATES.map(template => (
                     <div key={template.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
                         <div className="flex-1 mb-4">
                             <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl flex items-center justify-center mb-3">
                                 <i className="fa-solid fa-file-contract"></i>
                             </div>
                             <h4 className="font-bold text-text-main dark:text-white">{template.title}</h4>
                             <p className="text-xs text-text-muted mt-1">{template.description}</p>
                         </div>
                         <button 
                            onClick={() => setSelectedContract(template.id)}
                            className="w-full py-2 bg-slate-50 dark:bg-slate-800 text-text-main dark:text-white text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors"
                         >
                             Ver Modelo
                         </button>
                     </div>
                 ))}
             </div>

             {selectedContract && (
                 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                     <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                         <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                             <h3 className="font-bold text-lg text-text-main dark:text-white">
                                 {CONTRACT_TEMPLATES.find(c => c.id === selectedContract)?.title}
                             </h3>
                             <button onClick={() => setSelectedContract(null)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-text-muted hover:text-danger">
                                 <i className="fa-solid fa-xmark"></i>
                             </button>
                         </div>
                         <div className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-950">
                             <pre className="whitespace-pre-wrap font-mono text-xs md:text-sm text-text-body dark:text-slate-300 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl select-all">
                                 {CONTRACT_TEMPLATES.find(c => c.id === selectedContract)?.contentTemplate}
                             </pre>
                         </div>
                         <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-2xl">
                             <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(CONTRACT_TEMPLATES.find(c => c.id === selectedContract)?.contentTemplate || '');
                                    alert('Copiado para a área de transferência!');
                                }}
                                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors"
                             >
                                 <i className="fa-regular fa-copy mr-2"></i> Copiar Texto
                             </button>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
};

const ChecklistsView: React.FC = () => {
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('maos_checklists');
        return saved ? JSON.parse(saved) : {};
    });

    const toggleItem = (category: string, item: string) => {
        const key = `${category}-${item}`;
        const newState = { ...checkedItems, [key]: !checkedItems[key] };
        setCheckedItems(newState);
        localStorage.setItem('maos_checklists', JSON.stringify(newState));
    };

    return (
        <div className="space-y-6 animate-in fade-in">
             <SectionHeader title="Checklists Importantes" subtitle="Não esqueça de nada antes de avançar." />
             
             <div className="space-y-4">
                 {STANDARD_CHECKLISTS.map((list, idx) => (
                     <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                         <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-primary shadow-sm">
                                 <i className="fa-solid fa-list-check"></i>
                             </div>
                             <h4 className="font-bold text-text-main dark:text-white">{list.category}</h4>
                         </div>
                         <div className="p-2">
                             {list.items.map((item, i) => {
                                 const isChecked = checkedItems[`${list.category}-${item}`];
                                 return (
                                     <label key={i} className={`flex items-start p-3 rounded-xl cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${isChecked ? 'opacity-50' : ''}`}>
                                         <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center mt-0.5 transition-colors ${isChecked ? 'bg-success border-success text-white' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                                             {isChecked && <i className="fa-solid fa-check text-xs"></i>}
                                         </div>
                                         <input type="checkbox" className="hidden" checked={!!isChecked} onChange={() => toggleItem(list.category, item)} />
                                         <span className={`text-sm ${isChecked ? 'line-through text-text-muted' : 'text-text-main dark:text-slate-200'}`}>{item}</span>
                                     </label>
                                 )
                             })}
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
};

const ContactsView: React.FC = () => {
    const { user } = useAuth();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [activeTab, setActiveTab] = useState<'SUPPLIERS' | 'WORKERS'>('WORKERS');
    const [showForm, setShowForm] = useState(false);
    
    // Form States
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newRole, setNewRole] = useState(''); // For Worker
    const [newCategory, setNewCategory] = useState(''); // For Supplier

    const loadData = async () => {
        if (!user) return;
        const s = await dbService.getSuppliers(user.id);
        const w = await dbService.getWorkers(user.id);
        setSuppliers(s);
        setWorkers(w);
    };

    useEffect(() => { loadData(); }, [user]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        if (activeTab === 'WORKERS') {
            await dbService.addWorker({ userId: user.id, name: newName, phone: newPhone, role: newRole || 'Geral' });
        } else {
            await dbService.addSupplier({ userId: user.id, name: newName, phone: newPhone, category: newCategory || 'Geral' });
        }
        setShowForm(false);
        setNewName(''); setNewPhone(''); setNewRole(''); setNewCategory('');
        loadData();
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza?')) {
            if (activeTab === 'WORKERS') await dbService.deleteWorker(id);
            else await dbService.deleteSupplier(id);
            loadData();
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in">
             <SectionHeader title="Meus Contatos" subtitle="Tenha os telefones sempre à mão." />
             
             <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
                 <button onClick={() => setActiveTab('WORKERS')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'WORKERS' ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-text-muted'}`}>Trabalhadores</button>
                 <button onClick={() => setActiveTab('SUPPLIERS')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'SUPPLIERS' ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-text-muted'}`}>Fornecedores</button>
             </div>

             <button onClick={() => setShowForm(true)} className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                 <i className="fa-solid fa-plus"></i> Adicionar {activeTab === 'WORKERS' ? 'Profissional' : 'Loja'}
             </button>

             {showForm && (
                 <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2">
                     <form onSubmit={handleAdd} className="space-y-3">
                         <input placeholder="Nome" required value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm" />
                         <input placeholder="Telefone / WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm" />
                         {activeTab === 'WORKERS' ? (
                             <input placeholder="Função (Ex: Pedreiro)" value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm" />
                         ) : (
                             <input placeholder="Categoria (Ex: Elétrica)" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none text-sm" />
                         )}
                         <div className="flex gap-3">
                             <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 font-bold rounded-xl text-xs">Cancelar</button>
                             <button type="submit" className="flex-1 py-3 bg-success text-white font-bold rounded-xl text-xs">Salvar</button>
                         </div>
                     </form>
                 </div>
             )}

             <div className="space-y-3">
                 {(activeTab === 'WORKERS' ? workers : suppliers).map((item: any) => (
                     <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center shadow-sm">
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                 <i className={`fa-solid ${activeTab === 'WORKERS' ? 'fa-helmet-safety' : 'fa-store'}`}></i>
                             </div>
                             <div>
                                 <h4 className="font-bold text-text-main dark:text-white text-sm">{item.name}</h4>
                                 <p className="text-xs text-text-muted">{item.role || item.category || 'Geral'} • {item.phone}</p>
                             </div>
                         </div>
                         <div className="flex gap-2">
                             {item.phone && (
                                 <a href={`https://wa.me/55${item.phone.replace(/\D/g,'')}`} target="_blank" className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors">
                                     <i className="fa-brands fa-whatsapp"></i>
                                 </a>
                             )}
                             <button onClick={() => handleDelete(item.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors">
                                 <i className="fa-solid fa-trash text-xs"></i>
                             </button>
                         </div>
                     </div>
                 ))}
                 {(activeTab === 'WORKERS' ? workers : suppliers).length === 0 && (
                     <p className="text-center text-text-muted text-sm py-8">Nenhum contato salvo.</p>
                 )}
             </div>
        </div>
    );
};

const PhotosView: React.FC<{workId: string}> = ({ workId }) => {
    const [photos, setPhotos] = useState<WorkPhoto[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const loadPhotos = async () => {
        const p = await dbService.getPhotos(workId);
        setPhotos(p);
    };

    useEffect(() => { loadPhotos(); }, [workId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            await dbService.uploadPhoto(workId, e.target.files[0], 'PROGRESS');
            await loadPhotos();
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Apagar foto?')) {
            await dbService.deletePhoto(id);
            loadPhotos();
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
             <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-xl font-bold text-text-main dark:text-white">Galeria</h2>
                    <p className="text-sm text-text-muted dark:text-slate-400">Registre o andamento.</p>
                 </div>
                 <button onClick={() => fileInputRef.current?.click()} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 hover:bg-primary-dark transition-colors">
                     {uploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-camera"></i>} Adicionar
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                 {photos.map(photo => (
                     <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group bg-slate-100 dark:bg-slate-800">
                         <img src={photo.url} alt="Obra" className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <a href={photo.url} target="_blank" className="w-8 h-8 rounded-full bg-white text-primary flex items-center justify-center hover:scale-110 transition-transform"><i className="fa-solid fa-eye"></i></a>
                             <button onClick={() => handleDelete(photo.id)} className="w-8 h-8 rounded-full bg-white text-danger flex items-center justify-center hover:scale-110 transition-transform"><i className="fa-solid fa-trash"></i></button>
                         </div>
                         <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                             <p className="text-[10px] text-white font-medium">{new Date(photo.date).toLocaleDateString()}</p>
                         </div>
                     </div>
                 ))}
             </div>
             {photos.length === 0 && (
                 <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-700 text-text-muted">
                     <p>Nenhuma foto ainda.</p>
                 </div>
             )}
        </div>
    );
};

const FilesView: React.FC<{workId: string}> = ({ workId }) => {
    const [files, setFiles] = useState<WorkFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const loadFiles = async () => {
        const f = await dbService.getFiles(workId);
        setFiles(f);
    };

    useEffect(() => { loadFiles(); }, [workId]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            // Default category 'General' for now
            await dbService.uploadFile(workId, e.target.files[0], 'Geral / Documentos');
            await loadFiles();
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Apagar arquivo?')) {
            await dbService.deleteFile(id);
            loadFiles();
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
             <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-xl font-bold text-text-main dark:text-white">Documentos</h2>
                    <p className="text-sm text-text-muted dark:text-slate-400">Projetos e arquivos.</p>
                 </div>
                 <button onClick={() => fileInputRef.current?.click()} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 hover:bg-primary-dark transition-colors">
                     {uploading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-upload"></i>} Upload
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleUpload} />
             </div>

             <div className="space-y-3">
                 {files.map(file => (
                     <div key={file.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
                         <div className="flex items-center gap-3 overflow-hidden">
                             <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center text-xl shrink-0">
                                 <i className="fa-solid fa-file-pdf"></i>
                             </div>
                             <div className="min-w-0">
                                 <h4 className="font-bold text-text-main dark:text-white text-sm truncate">{file.name}</h4>
                                 <p className="text-xs text-text-muted">{file.category} • {new Date(file.date).toLocaleDateString()}</p>
                             </div>
                         </div>
                         <div className="flex gap-2 shrink-0">
                             <a href={file.url} target="_blank" className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors"><i className="fa-solid fa-download text-xs"></i></a>
                             <button onClick={() => handleDelete(file.id)} className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-danger flex items-center justify-center hover:bg-danger hover:text-white transition-colors"><i className="fa-solid fa-trash text-xs"></i></button>
                         </div>
                     </div>
                 ))}
                 {files.length === 0 && (
                     <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-700 text-text-muted">
                         <p>Nenhum arquivo.</p>
                     </div>
                 )}
             </div>
        </div>
    );
};

// --- NEW REPORTS COMPONENT (Advanced) ---

const ReportsView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [steps, setSteps] = useState<Step[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [activeTab, setActiveTab] = useState<'FINANCEIRO' | 'MATERIAIS' | 'CRONOGRAMA'>('FINANCEIRO');

    useEffect(() => {
        Promise.all([
            dbService.getExpenses(workId),
            dbService.getSteps(workId),
            dbService.getMaterials(workId)
        ]).then(([e, s, m]) => {
            setExpenses(e);
            setSteps(s);
            setMaterials(m);
        });
    }, [workId]);

    // --- Helpers Export ---
    const downloadCSV = (data: any[], filename: string) => {
        if (!data || !data.length) return;
        const separator = ',';
        const keys = Object.keys(data[0]);
        const csvContent =
            keys.join(separator) +
            '\n' +
            data.map(row => {
                return keys.map(k => {
                    let cell = row[k] === null || row[k] === undefined ? '' : row[k];
                    cell = cell instanceof Date ? cell.toLocaleString() : cell.toString().replace(/"/g, '""');
                    if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
                    return cell;
                }).join(separator);
            }).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // --- Aggregations ---
    const totalSpent = expenses.reduce((acc, curr) => acc + (curr.paidAmount || curr.amount), 0);
    const totalPending = expenses.reduce((acc, curr) => acc + (curr.amount - (curr.paidAmount || 0)), 0);
    
    // Chart Data: Expenses by Category
    const categoryData = Object.values(ExpenseCategory).map(cat => ({
        name: cat,
        value: expenses.filter(e => e.category === cat).reduce((acc, curr) => acc + (curr.paidAmount || curr.amount), 0)
    })).filter(d => d.value > 0);

    const COLORS = ['#1E3A45', '#3B7C8C', '#FACC15', '#EF4444', '#6D28D9'];

    // --- RENDERERS ---

    const renderFinancialReport = () => (
        <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                     <p className="text-xs text-text-muted uppercase font-bold mb-1">Total Pago</p>
                     <p className="text-2xl font-bold text-success">R$ {totalSpent.toLocaleString('pt-BR')}</p>
                 </div>
                 <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                     <p className="text-xs text-text-muted uppercase font-bold mb-1">A Pagar</p>
                     <p className="text-2xl font-bold text-orange-500">R$ {totalPending.toLocaleString('pt-BR')}</p>
                 </div>
             </div>

             <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 h-80 flex flex-col items-center">
                 <h4 className="text-sm font-bold text-text-main dark:text-white mb-4">Para onde foi o dinheiro?</h4>
                 {categoryData.length > 0 ? (
                     <Recharts.ResponsiveContainer width="100%" height="100%">
                        <Recharts.PieChart>
                            <Recharts.Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {categoryData.map((entry, index) => (
                                    <Recharts.Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Recharts.Pie>
                            <Recharts.Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                            <Recharts.Legend />
                        </Recharts.PieChart>
                     </Recharts.ResponsiveContainer>
                 ) : (
                     <div className="flex-1 flex items-center justify-center text-text-muted">Sem dados ainda.</div>
                 )}
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                 <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                     <h4 className="font-bold text-text-main dark:text-white">Detalhamento</h4>
                     <button onClick={() => downloadCSV(expenses, 'financeiro.csv')} className="text-primary text-xs font-bold hover:underline print:hidden">Baixar CSV</button>
                 </div>
                 <div className="divide-y divide-slate-100 dark:divide-slate-800">
                     {expenses.map(e => (
                         <div key={e.id} className="px-6 py-3 flex justify-between items-center text-sm">
                             <div>
                                 <p className="font-bold text-text-main dark:text-white">{e.description}</p>
                                 <p className="text-xs text-text-muted">{new Date(e.date).toLocaleDateString()} • {e.category}</p>
                             </div>
                             <span className="font-bold text-text-body dark:text-slate-300">R$ {(e.paidAmount || e.amount).toLocaleString('pt-BR')}</span>
                         </div>
                     ))}
                 </div>
             </div>
        </div>
    );

    const renderMaterialReport = () => (
        <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 gap-4">
                 <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                     <div>
                        <p className="text-xs text-text-muted uppercase font-bold mb-1">Itens Comprados</p>
                        <p className="text-2xl font-bold text-primary">{materials.filter(m => m.purchasedQty >= m.plannedQty).length} <span className="text-sm text-text-muted font-normal">de {materials.length}</span></p>
                     </div>
                     <div className="w-12 h-12 rounded-full bg-blue-100 text-primary flex items-center justify-center text-xl">
                         <i className="fa-solid fa-cart-shopping"></i>
                     </div>
                 </div>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                 <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                     <h4 className="font-bold text-text-main dark:text-white">Status de Compra</h4>
                     <button onClick={() => downloadCSV(materials, 'materiais.csv')} className="text-primary text-xs font-bold hover:underline print:hidden">Baixar CSV</button>
                 </div>
                 <div className="divide-y divide-slate-100 dark:divide-slate-800">
                     {materials.map(m => {
                         const progress = Math.min((m.purchasedQty / m.plannedQty) * 100, 100);
                         return (
                            <div key={m.id} className="px-6 py-4">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="font-bold text-sm text-text-main dark:text-white">{m.name}</span>
                                    <span className="text-xs font-bold text-text-muted">{m.purchasedQty} / {m.plannedQty} {m.unit}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full ${progress >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                         )
                     })}
                 </div>
             </div>
        </div>
    );

    const renderTaskReport = () => (
        <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-2 gap-4">
                 <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-100 dark:border-green-800">
                     <p className="text-xs text-green-700 dark:text-green-300 uppercase font-bold mb-1">Concluídas</p>
                     <p className="text-2xl font-bold text-green-700 dark:text-green-300">{steps.filter(s => s.status === StepStatus.COMPLETED).length}</p>
                 </div>
                 <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-800">
                     <p className="text-xs text-red-700 dark:text-red-300 uppercase font-bold mb-1">Atrasadas</p>
                     <p className="text-2xl font-bold text-red-700 dark:text-red-300">{steps.filter(s => s.status !== StepStatus.COMPLETED && new Date(s.endDate) < new Date()).length}</p>
                 </div>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                 <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                     <h4 className="font-bold text-text-main dark:text-white">Cronograma Detalhado</h4>
                     <button onClick={() => downloadCSV(steps, 'cronograma.csv')} className="text-primary text-xs font-bold hover:underline print:hidden">Baixar CSV</button>
                 </div>
                 <div className="divide-y divide-slate-100 dark:divide-slate-800">
                     {steps.map(s => {
                         const isLate = s.status !== StepStatus.COMPLETED && new Date(s.endDate) < new Date();
                         return (
                             <div key={s.id} className="px-6 py-3 flex justify-between items-center text-sm">
                                 <div>
                                     <div className="flex items-center gap-2">
                                        <p className="font-bold text-text-main dark:text-white">{s.name}</p>
                                        {isLate && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded font-bold">ATRASADO</span>}
                                        {s.status === StepStatus.COMPLETED && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded font-bold">FEITO</span>}
                                     </div>
                                     <p className="text-xs text-text-muted">{new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}</p>
                                 </div>
                             </div>
                         )
                     })}
                 </div>
             </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 print:space-y-4">
             <div className="flex items-center justify-between print:hidden">
                <button onClick={onBack} className="text-sm font-bold text-primary hover:underline flex items-center gap-2">
                    <i className="fa-solid fa-arrow-left"></i> Voltar
                </button>
                <button 
                    onClick={() => window.print()}
                    className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                    <i className="fa-solid fa-print"></i> Imprimir PDF
                </button>
             </div>

             <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                 <div className="w-14 h-14 rounded-full bg-white border-2 border-primary p-0.5 shrink-0 overflow-hidden">
                     <img src={ZE_AVATAR} alt="Zé" className="w-full h-full object-cover rounded-full" />
                 </div>
                 <div>
                     <h3 className="font-bold text-lg text-text-main dark:text-white">Resumo Executivo da Obra</h3>
                     <p className="text-sm text-text-muted">Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
                 </div>
             </div>

             {/* TABS */}
             <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl print:hidden">
                {['FINANCEIRO', 'MATERIAIS', 'CRONOGRAMA'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-text-muted'}`}
                    >
                        {tab}
                    </button>
                ))}
             </div>

             <div className="print:block">
                 {/* On Print, we might want to show all sections stacked, but for now lets rely on WYSIWYG based on active tab or specific print styles */}
                 <div className="print:hidden">
                    {activeTab === 'FINANCEIRO' && renderFinancialReport()}
                    {activeTab === 'MATERIAIS' && renderMaterialReport()}
                    {activeTab === 'CRONOGRAMA' && renderTaskReport()}
                 </div>

                 {/* PRINT ONLY SECTION - Show all summaries stacked */}
                 <div className="hidden print:block space-y-8">
                     <div><h3 className="text-xl font-bold mb-4 border-b pb-2">1. Financeiro</h3>{renderFinancialReport()}</div>
                     <div className="break-before-page"><h3 className="text-xl font-bold mb-4 border-b pb-2">2. Materiais</h3>{renderMaterialReport()}</div>
                     <div className="break-before-page"><h3 className="text-xl font-bold mb-4 border-b pb-2">3. Cronograma</h3>{renderTaskReport()}</div>
                 </div>
             </div>
        </div>
    );
};

// 5. MAIS MENU MAIN (Update to include ReportsView integration)
const MoreMenuTab: React.FC<{ 
    onNavigate: (view: string) => void,
    activeSubView: string | null,
    workId: string
}> = ({ onNavigate, activeSubView, workId }) => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const standardItems = [
        { id: 'CONTACTS', label: 'Equipe e Fornecedores', icon: 'fa-address-book', color: 'text-blue-500', desc: 'Sua lista de contatos.' },
        { id: 'PHOTOS', label: 'Minhas Fotos', icon: 'fa-camera', color: 'text-purple-500', desc: 'Guarde o antes e depois da obra.' },
        { id: 'FILES', label: 'Meus Projetos (PDF)', icon: 'fa-folder-open', color: 'text-indigo-500', desc: 'Plantas e documentos importantes.' },
        { id: 'REPORTS', label: 'Relatórios Inteligentes', icon: 'fa-chart-pie', color: 'text-red-500', desc: 'Gráficos, PDFs e exportação.' },
    ];

    const bonusItems = [
        { id: 'AI_CHAT', label: 'IA do Zé (Assistente)', icon: 'fa-robot', color: 'text-blue-600', desc: 'Tire dúvidas técnicas na hora.' },
        { id: 'CALCULATOR', label: 'Calculadora da Obra', icon: 'fa-calculator', color: 'text-primary', desc: 'Calcule pisos, tijolos e tintas.' },
        { id: 'CHECKLISTS', label: 'Checklists', icon: 'fa-list-check', color: 'text-success', desc: 'Não esqueça de nada importante.' },
        { id: 'CONTRACTS', label: 'Contratos e Recibos', icon: 'fa-file-signature', color: 'text-orange-500', desc: 'Modelos prontos para usar.' },
    ];

    const isLifetime = user?.plan === PlanType.VITALICIO;

    if (activeSubView) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {activeSubView !== 'CALCULATOR' && activeSubView !== 'CONTRACTS' && activeSubView !== 'AI_CHAT' && activeSubView !== 'REPORTS' && (
                    <button 
                        onClick={() => onNavigate('')} 
                        className="mb-4 text-sm font-bold text-text-muted hover:text-primary flex items-center gap-2"
                    >
                        <i className="fa-solid fa-arrow-left"></i> Voltar ao Menu
                    </button>
                )}
                
                {activeSubView === 'CONTACTS' && <ContactsView />}
                {activeSubView === 'PHOTOS' && <PhotosView workId={workId} />}
                {activeSubView === 'FILES' && <FilesView workId={workId} />}
                {activeSubView === 'CHECKLISTS' && <ChecklistsView />}
                {activeSubView === 'CONTRACTS' && <ContractsView />}
                {activeSubView === 'CALCULATOR' && <CalculatorView workId={workId} onBack={() => onNavigate('')} />}
                {activeSubView === 'AI_CHAT' && (
                    <div>
                         <button onClick={() => onNavigate('')} className="mb-4 text-sm font-bold text-primary hover:underline flex items-center gap-2">
                            <i className="fa-solid fa-arrow-left"></i> Voltar
                         </button>
                         <AssistantView />
                    </div>
                )}
                {activeSubView === 'REPORTS' && <ReportsView workId={workId} onBack={() => onNavigate('')} />}
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <SectionHeader 
                title="Mais Coisas" 
                subtitle="Ferramentas e extras da sua obra."
            />
            
            {/* Standard Tools */}
            <div className="grid grid-cols-1 gap-4">
                {standardItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all text-left flex items-center gap-4 group"
                    >
                        <div className={`w-10 h-10 rounded-xl bg-surface dark:bg-slate-800 flex items-center justify-center text-lg ${item.color}`}>
                            <i className={`fa-solid ${item.icon}`}></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-text-main dark:text-white">{item.label}</h3>
                            <p className="text-xs text-text-muted dark:text-slate-400">{item.desc}</p>
                        </div>
                        <i className="fa-solid fa-chevron-right ml-auto text-slate-300 group-hover:text-primary transition-colors"></i>
                    </button>
                ))}
            </div>

            {/* Bonus Section Header */}
            <div className="pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                <h3 className="font-bold text-lg text-text-main dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-gift text-premium"></i> Bônus Vitalício
                </h3>
                <p className="text-xs text-text-muted dark:text-slate-400">Exclusivo para membros do plano completo.</p>
            </div>

            {/* Bonus Items */}
            <div className="grid grid-cols-1 gap-4">
                {bonusItems.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => isLifetime && onNavigate(item.id)}
                        disabled={!isLifetime}
                        className={`p-5 rounded-2xl border shadow-sm transition-all text-left flex items-center gap-4 group relative overflow-hidden ${
                            isLifetime 
                            ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:shadow-md cursor-pointer' 
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-60 cursor-not-allowed'
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl bg-surface dark:bg-slate-800 flex items-center justify-center text-lg ${item.color}`}>
                            <i className={`fa-solid ${item.icon}`}></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-text-main dark:text-white">{item.label}</h3>
                            <p className="text-xs text-text-muted dark:text-slate-400">{item.desc}</p>
                        </div>
                        {!isLifetime ? (
                             <i className="fa-solid fa-lock ml-auto text-slate-400"></i>
                        ) : (
                             <i className="fa-solid fa-chevron-right ml-auto text-slate-300 group-hover:text-primary transition-colors"></i>
                        )}
                    </button>
                ))}
            </div>

            {/* Unlock Banner for Non-Lifetime */}
            {!isLifetime && (
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-purple-500/30 text-center mt-4">
                    <i className="fa-solid fa-crown text-3xl mb-2 text-yellow-300"></i>
                    <h3 className="font-bold text-lg mb-1">Desbloquear Bônus</h3>
                    <p className="text-sm opacity-90 mb-4">Tenha acesso vitalício à calculadora, contratos e checklists exclusivos.</p>
                    <button 
                        onClick={() => navigate('/settings')}
                        className="bg-white text-purple-600 font-bold py-3 px-6 rounded-xl w-full hover:bg-purple-50 transition-colors"
                    >
                        Quero ser Vitalício
                    </button>
                </div>
            )}
        </div>
    );
};

// --- MAIN PAGE --- (Same as before)

const WorkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [work, setWork] = useState<Work | undefined>();
  const [activeTab, setActiveTab] = useState(0); 
  const [moreSubView, setMoreSubView] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });
  const [loading, setLoading] = useState(true);

  const loadWork = async () => {
    if (id) {
        const w = await dbService.getWorkById(id);
        if (w) {
          setWork(w);
          const st = await dbService.calculateWorkStats(id);
          setStats(st);
        } else {
          navigate('/');
        }
        setLoading(false);
      }
  }

  useEffect(() => { loadWork(); }, [id, navigate, activeTab]); 

  if (loading || !work) return <div className="h-screen flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-primary text-3xl"></i></div>;

  const tabs = [
    { name: 'Resumo', icon: 'fa-house' },
    { name: 'Tarefas', icon: 'fa-list-check' },
    { name: 'Compras', icon: 'fa-box-open' },
    { name: 'Gastos', icon: 'fa-sack-dollar' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-28 pt-2 px-2 md:px-0">
      
      <div className="flex items-center justify-between py-2 print:hidden bg-surface dark:bg-slate-950 sticky top-0 z-40">
         <div className="flex items-center gap-3">
             <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-text-muted hover:text-primary transition-colors shadow-sm">
               <i className="fa-solid fa-arrow-left"></i>
             </button>
             <div className="min-w-0">
                <h1 className="text-lg font-bold text-text-main dark:text-white leading-tight truncate">{work.name}</h1>
                <p className="text-xs text-text-muted dark:text-slate-400 truncate">{work.address || 'Sem endereço cadastrado'}</p>
             </div>
         </div>
         
         <button 
            onClick={() => { setActiveTab(4); setMoreSubView(null); }}
            className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all shadow-sm ${activeTab === 4 ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-text-muted hover:text-primary'}`}
            title="Mais Opções"
         >
            <i className="fa-solid fa-bars"></i>
         </button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 0 && <OverviewTab work={work} stats={stats} onGoToSteps={() => setActiveTab(1)} />}
        {activeTab === 1 && <StepsTab workId={work.id} refreshWork={loadWork} />}
        {activeTab === 2 && <MaterialsTab workId={work.id} onUpdate={loadWork} />}
        {activeTab === 3 && <ExpensesTab workId={work.id} onUpdate={loadWork} />}
        {activeTab === 4 && (
            <MoreMenuTab 
                onNavigate={(view) => setMoreSubView(view)} 
                activeSubView={moreSubView} 
                workId={work.id}
            />
        )}
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-2 md:hidden z-50 flex justify-around items-center shadow-[0_-4px_10px_rgba(0,0,0,0.03)] print:hidden">
        {tabs.map((tab, idx) => {
            const isActive = activeTab === idx;
            return (
                <button
                    key={idx}
                    onClick={() => { setActiveTab(idx); setMoreSubView(null); }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl w-full transition-all duration-200 ${isActive ? 'text-primary dark:text-white translate-y-[-2px]' : 'text-slate-400 dark:text-slate-600'}`}
                >
                    <i className={`fa-solid ${tab.icon} text-xl mb-1 ${isActive ? 'scale-110' : ''} transition-transform`}></i>
                    <span className={`text-[10px] font-bold ${isActive ? 'opacity-100' : 'opacity-80'}`}>{tab.name}</span>
                </button>
            )
        })}
      </div>

      <div className="hidden md:flex justify-center mb-8 print:hidden">
        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm inline-flex">
            {tabs.map((tab, idx) => (
            <button
                key={idx}
                onClick={() => { setActiveTab(idx); setMoreSubView(null); }}
                className={`flex items-center px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
                activeTab === idx 
                    ? 'bg-primary text-white shadow-md' 
                    : 'text-text-muted dark:text-slate-400 hover:text-text-main dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
            >
                <i className={`fa-solid ${tab.icon} mr-2 ${activeTab === idx ? 'text-white' : 'opacity-70'}`}></i>
                {tab.name}
            </button>
            ))}
        </div>
      </div>

    </div>
  );
};

export default WorkDetail;
