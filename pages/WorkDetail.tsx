

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';
import { Work, Step, Expense, Material, StepStatus, ExpenseCategory, PlanType, Supplier, Worker } from '../types';
import { Recharts } from '../components/RechartsWrapper';
import { CALCULATORS, CONTRACT_TEMPLATES, STANDARD_CHECKLISTS, FULL_MATERIAL_PACKAGES } from '../services/standards';
import { useAuth } from '../App';

// --- Shared Components ---

const SectionHeader: React.FC<{ title: string, subtitle: string }> = ({ title, subtitle }) => (
    <div className="mb-6">
        <h2 className="text-xl font-bold text-text-main dark:text-white">{title}</h2>
        <p className="text-sm text-text-muted dark:text-slate-400">{subtitle}</p>
    </div>
);

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 dark:border-slate-700 transform scale-100 transition-all">
        <div className="mb-4 text-center">
          <div className="w-12 h-12 bg-warning/20 text-warning rounded-full flex items-center justify-center mx-auto mb-4">
             <i className="fa-solid fa-triangle-exclamation text-xl"></i>
          </div>
          <h3 className="text-lg font-bold text-text-main dark:text-white mb-2">{title}</h3>
          <p className="text-text-muted dark:text-slate-400 text-sm">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-text-muted font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20">
            Confirmar
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

// 2. ETAPAS
const StepsTab: React.FC<{ workId: string, refreshWork: () => void }> = ({ workId, refreshWork }) => {
  const [steps, setSteps] = useState<Step[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepDate, setNewStepDate] = useState('');
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{isOpen: boolean, stepId: string}>({isOpen: false, stepId: ''});

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
      
      await dbService.updateStep({ ...step, status: newStatus });
      loadSteps();
      refreshWork();
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
          await dbService.updateStep(editingStep);
          setEditingStep(null);
          loadSteps();
          refreshWork();
      }
  };

  const handleDeleteStep = async () => {
      setConfirmDelete({isOpen: false, stepId: ''});
      setEditingStep(null);
      loadSteps();
      refreshWork();
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
                      <button onClick={() => setConfirmDelete({isOpen: true, stepId: editingStep.id})} className="text-danger text-sm font-bold hover:underline">
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

      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        title="Excluir Etapa"
        message="Tem certeza? Isso não pode ser desfeito."
        onConfirm={handleDeleteStep}
        onCancel={() => setConfirmDelete({isOpen: false, stepId: ''})}
      />
    </div>
  );
};

// 3. MATERIAIS
const MaterialsTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  
  // Create / Edit
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [newMat, setNewMat] = useState({ name: '', qty: '', unit: 'un', category: 'Geral' });
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  // NEW: Cost input for editing
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
          // Pass the cost input (if any) to the service
          await dbService.updateMaterial(editingMaterial, Number(costInput));
          setEditingMaterial(null);
          setCostInput(''); // Reset cost input
          loadMaterials();
          onUpdate();
      }
  };

  const handleDeleteClick = (id: string) => {
    setConfirmModal({
        isOpen: true,
        title: "Remover Item",
        message: "Quer mesmo tirar este material da lista?",
        onConfirm: async () => {
            await dbService.deleteMaterial(id);
            setEditingMaterial(null);
            loadMaterials();
            onUpdate();
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
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
      setCostInput(''); // Ensure it's empty so user enters NEW cost
  };

  // Grouping Logic
  const groupedMaterials = materials.reduce((acc, mat) => {
      const cat = mat.category || 'Geral';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(mat);
      return acc;
  }, {} as Record<string, Material[]>);

  // Categories Order (Standard First, then others)
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

      {/* RENDER LIST GROUPED */}
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

      {/* EDIT MODAL */}
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

      <ConfirmModal 
         isOpen={confirmModal.isOpen}
         title={confirmModal.title}
         message={confirmModal.message}
         onConfirm={confirmModal.onConfirm}
         onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

// 4. FINANCEIRO (Refactored for Step Grouping)
const ExpensesTab: React.FC<{ workId: string, onUpdate: () => void }> = ({ workId, onUpdate }) => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]); // New: Workers List
  
  // UI States
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
      description: string, 
      amount: string, 
      paidAmount: string, // New: Separate Paid vs Total
      category: ExpenseCategory, 
      date: string,
      stepId?: string,
      workerId?: string // New: Worker Selection
  }>({ 
      description: '', 
      amount: '', 
      paidAmount: '',
      category: ExpenseCategory.MATERIAL, 
      date: new Date().toISOString().split('T')[0],
      stepId: undefined,
      workerId: undefined
  });
  
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const loadData = async () => {
      const [expData, stepsData] = await Promise.all([
          dbService.getExpenses(workId),
          dbService.getSteps(workId)
      ]);
      setExpenses(expData);
      setSteps(stepsData.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
      
      // Load workers if user exists
      if (user) {
          const w = await dbService.getWorkers(user.id);
          setWorkers(w);
      }
  };

  useEffect(() => { loadData(); }, [workId, user]);

  const resetForm = () => {
      setFormData({ 
          description: '', 
          amount: '', 
          paidAmount: '',
          category: ExpenseCategory.MATERIAL, 
          date: new Date().toISOString().split('T')[0], 
          stepId: undefined,
          workerId: undefined
      });
      setIsEditing(false);
      setEditingId(null);
      setShowForm(false);
  }

  const handleEditClick = (exp: Expense) => {
      setFormData({
          description: exp.description,
          amount: exp.amount.toString(),
          paidAmount: (exp.paidAmount || exp.amount).toString(),
          category: exp.category,
          date: exp.date,
          stepId: exp.stepId,
          workerId: exp.workerId
      });
      setIsEditing(true);
      setEditingId(exp.id);
      setShowForm(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      workId,
      description: formData.description,
      amount: Number(formData.amount),
      paidAmount: Number(formData.paidAmount), 
      quantity: 1,
      category: formData.category,
      date: formData.date,
      stepId: formData.stepId,
      workerId: formData.workerId
    };

    if (isEditing && editingId) {
        // Update
        await dbService.updateExpense({ ...payload, id: editingId });
    } else {
        // Create
        await dbService.addExpense(payload);
    }
    
    resetForm();
    loadData();
    onUpdate();
  };

  const handleDeleteClick = (id: string) => {
      setConfirmModal({
          isOpen: true,
          title: "Excluir Despesa",
          message: "Apagar este registro?",
          onConfirm: async () => {
              await dbService.deleteExpense(id);
              loadData();
              onUpdate();
              setConfirmModal(prev => ({ ...prev, isOpen: false }));
          }
      });
  };

  // Logic to auto-fill description when selecting worker
  const handleWorkerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const wId = e.target.value;
      const worker = workers.find(w => w.id === wId);
      setFormData(prev => ({
          ...prev, 
          workerId: wId,
          description: worker ? `${prev.description || 'Pagamento:'} ${worker.name}` : prev.description
      }));
  };

  // Group Expenses by Step
  const groupedExpenses: Record<string, Expense[]> = { 'GERAL': [] };
  steps.forEach(s => { groupedExpenses[s.id] = [] });

  expenses.forEach(exp => {
      if (exp.stepId && groupedExpenses[exp.stepId]) {
          groupedExpenses[exp.stepId].push(exp);
      } else {
          groupedExpenses['GERAL'].push(exp);
      }
  });

  const getGroupTotal = (groupExps: Expense[]) => groupExps.reduce((acc, curr) => acc + (curr.paidAmount || curr.amount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <SectionHeader 
          title="Controle de Gastos" 
          subtitle="Tudo o que saiu do seu bolso, organizado."
      />

      {!showForm ? (
          <button 
            onClick={() => setShowForm(true)}
            className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-text-muted hover:text-primary hover:border-primary transition-all font-bold flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50"
          >
              <i className="fa-solid fa-plus"></i> Anotar gasto
          </button>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
            <h3 className="font-bold text-text-main dark:text-white mb-4">{isEditing ? 'Editar Despesa' : 'Novo Gasto'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Category (Tipo do Gasto) */}
                <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">No que foi gasto?</label>
                    <select 
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value as ExpenseCategory})}
                    >
                        {Object.values(ExpenseCategory).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                {/* 1.5 Worker Selection (Only if Category is Labor) */}
                {formData.category === ExpenseCategory.LABOR && (
                    <div className="animate-in fade-in slide-in-from-top-1">
                        <label className="text-xs font-bold text-primary mb-1 block">Qual profissional?</label>
                        <select 
                            className="w-full px-4 py-3 border-2 border-primary/20 bg-primary/5 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                            value={formData.workerId || ''}
                            onChange={handleWorkerSelect}
                        >
                            <option value="">Selecione da equipe...</option>
                            {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.role})</option>)}
                        </select>
                        {workers.length === 0 && (
                            <p className="text-[10px] text-red-500 mt-1">Nenhum trabalhador cadastrado em Contatos.</p>
                        )}
                    </div>
                )}

                {/* 2. Step Selection */}
                <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">Em qual etapa da obra?</label>
                    <select 
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                        value={formData.stepId || ''}
                        onChange={e => setFormData({...formData, stepId: e.target.value || undefined})}
                    >
                        <option value="">Geral / Obra Toda</option>
                        {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                {/* 3. Description */}
                <div>
                    <label className="text-xs font-bold text-text-muted mb-1 block">Descrição do item</label>
                    <input 
                        placeholder="Ex: Cimento, Diária Pedreiro..." 
                        required
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                {/* 4. Amount - Total vs Paid */}
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-text-muted mb-1 block">Valor Total (R$)</label>
                        <input 
                            type="number" 
                            placeholder="0,00" 
                            required
                            value={formData.amount}
                            onChange={e => setFormData({...formData, amount: e.target.value})}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-text-muted mb-1 block">Valor Pago (R$)</label>
                        <input 
                            type="number" 
                            placeholder="0,00" 
                            value={formData.paidAmount}
                            onChange={e => setFormData({...formData, paidAmount: e.target.value})}
                            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-text-main dark:text-white rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-[10px] text-text-muted mt-1">Se for parcelado, coloque quanto pagou hoje.</p>
                    </div>
                </div>
                
                <div className="flex gap-3 pt-2">
                   <button type="button" onClick={resetForm} className="flex-1 py-3 font-bold text-text-muted bg-slate-100 dark:bg-slate-800 rounded-xl">Cancelar</button>
                   <button type="submit" className="flex-1 py-3 font-bold text-white bg-primary rounded-xl hover:bg-primary-dark">
                       {isEditing ? 'Atualizar' : 'Salvar'}
                   </button>
                 </div>
            </form>
        </div>
      )}

      <div className="space-y-6">
          {/* GENERAL GROUP (Only show if has items) */}
          {groupedExpenses['GERAL'].length > 0 && (
             <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                          <div className="h-4 w-1 bg-slate-400 rounded-full"></div>
                          <h3 className="font-bold text-text-main dark:text-white uppercase tracking-wider text-sm">Geral / Obra Toda</h3>
                      </div>
                      <span className="text-xs font-bold text-text-main dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                          Pago: R$ {getGroupTotal(groupedExpenses['GERAL']).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </span>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {groupedExpenses['GERAL'].map(exp => {
                                const isPartial = (exp.paidAmount || 0) < exp.amount;
                                return (
                                <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="cursor-pointer flex-1" onClick={() => handleEditClick(exp)}>
                                        <p className="font-bold text-text-main dark:text-white">{exp.description}</p>
                                        <div className="flex items-center gap-2 text-xs text-text-muted dark:text-slate-500">
                                            <span>{new Date(exp.date).toLocaleDateString('pt-BR')}</span>
                                            <span>•</span>
                                            <span>{exp.category}</span>
                                            {isPartial && <span className="text-orange-500 font-bold bg-orange-100 dark:bg-orange-900 px-1.5 rounded">Parcial</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <span className="font-bold text-text-body dark:text-slate-300 block">R$ {(exp.paidAmount || exp.amount).toFixed(2)}</span>
                                            {isPartial && <span className="text-[10px] text-text-muted line-through block">Total: R$ {exp.amount.toFixed(2)}</span>}
                                        </div>
                                        <button onClick={() => handleDeleteClick(exp.id)} className="text-slate-300 hover:text-danger p-2">
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                        <button onClick={() => handleEditClick(exp)} className="text-slate-300 hover:text-primary p-2">
                                            <i className="fa-solid fa-pen"></i>
                                        </button>
                                    </div>
                                </div>
                            )})}
                        </div>
                </div>
             </div>
          )}

          {/* STEP GROUPS */}
          {steps.map(step => {
              const groupExps = groupedExpenses[step.id] || [];
              if (groupExps.length === 0) return null; // HIDE EMPTY STEPS
              const groupTotal = getGroupTotal(groupExps);
              return (
                <div key={step.id} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-1 bg-primary rounded-full"></div>
                            <h3 className="font-bold text-text-main dark:text-white uppercase tracking-wider text-sm truncate max-w-[200px]">{step.name}</h3>
                        </div>
                        <span className="text-xs font-bold text-text-main dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                            Pago: R$ {groupTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </span>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                             {groupExps.map(exp => {
                                const isPartial = (exp.paidAmount || 0) < exp.amount;
                                return (
                                <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="cursor-pointer flex-1" onClick={() => handleEditClick(exp)}>
                                        <p className="font-bold text-text-main dark:text-white">{exp.description}</p>
                                        <div className="flex items-center gap-2 text-xs text-text-muted dark:text-slate-500">
                                            <span>{new Date(exp.date).toLocaleDateString('pt-BR')}</span>
                                            <span>•</span>
                                            <span>{exp.category}</span>
                                            {isPartial && <span className="text-orange-500 font-bold bg-orange-100 dark:bg-orange-900 px-1.5 rounded">Parcial</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <span className="font-bold text-text-body dark:text-slate-300 block">R$ {(exp.paidAmount || exp.amount).toFixed(2)}</span>
                                            {isPartial && <span className="text-[10px] text-text-muted line-through block">Total: R$ {exp.amount.toFixed(2)}</span>}
                                        </div>
                                        <button onClick={() => handleDeleteClick(exp.id)} className="text-slate-300 hover:text-danger p-2">
                                            <i className="fa-solid fa-trash"></i>
                                        </button>
                                        <button onClick={() => handleEditClick(exp)} className="text-slate-300 hover:text-primary p-2">
                                            <i className="fa-solid fa-pen"></i>
                                        </button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>
              );
          })}
          
          {/* Empty State if absolutely nothing exists */}
          {expenses.length === 0 && (
             <div className="text-center py-10 text-text-muted dark:text-slate-500">
                <p>Nenhum gasto lançado ainda.</p>
             </div>
          )}
      </div>

      <ConfirmModal 
         isOpen={confirmModal.isOpen}
         title={confirmModal.title}
         message={confirmModal.message}
         onConfirm={confirmModal.onConfirm}
         onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

// 5. MAIS MENU - TOOLS SUBVIEWS (Refactored)

const CalculatorView: React.FC<{ workId: string, onBack: () => void }> = ({ workId, onBack }) => {
    const [calcType, setCalcType] = useState('PISO');
    const [calcArea, setCalcArea] = useState('');
    const [calcResult, setCalcResult] = useState<{qty: number, msg: string} | null>(null);

    const calculateMaterial = () => {
        const calc = CALCULATORS[calcType as keyof typeof CALCULATORS];
        if (calc && Number(calcArea) > 0) {
            const qty = calc.calculate(Number(calcArea));
            setCalcResult({ qty, msg: calc.message(qty) });
        }
    };

    const saveCalculation = async () => {
        if (!calcResult) return;
        const calc = CALCULATORS[calcType as keyof typeof CALCULATORS];
        await dbService.addMaterial({
            workId,
            name: calc.label,
            plannedQty: calcResult.qty,
            purchasedQty: 0,
            unit: calc.unit
        });
        alert('Material adicionado à lista de compras!');
        onBack();
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
             <button onClick={onBack} className="mb-4 text-sm font-bold text-primary hover:underline flex items-center gap-2">
                <i className="fa-solid fa-arrow-left"></i> Voltar
             </button>
             <h3 className="font-bold text-lg text-text-main dark:text-white mb-4">Calculadora de Materiais</h3>
             <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                {!calcResult ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">O que vamos calcular?</label>
                            <select 
                                value={calcType} 
                                onChange={e => setCalcType(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white rounded-xl outline-none"
                            >
                                {Object.entries(CALCULATORS).map(([key, val]) => (
                                    <option key={key} value={key}>{val.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-text-muted mb-1">Qual o tamanho da área? (m²)</label>
                            <input 
                                type="number" 
                                autoFocus
                                value={calcArea}
                                onChange={e => setCalcArea(e.target.value)}
                                placeholder="Ex: 25"
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white rounded-xl outline-none"
                            />
                        </div>
                        <button onClick={calculateMaterial} className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg mt-2">
                            Ver quantidade sugerida
                        </button>
                    </div>
                ) : (
                    <div className="text-center">
                        <div className="bg-surface dark:bg-slate-800 p-4 rounded-xl mb-4">
                            <p className="text-3xl font-bold text-primary mb-1">{calcResult.qty} <span className="text-sm text-text-muted">{CALCULATORS[calcType as keyof typeof CALCULATORS].unit}</span></p>
                            <p className="text-sm text-text-muted">{calcResult.msg}</p>
                        </div>
                        <button onClick={saveCalculation} className="w-full py-3 bg-success text-white font-bold rounded-xl shadow-lg mb-2">
                            Adicionar à minha lista
                        </button>
                        <button onClick={() => setCalcResult(null)} className="w-full py-2 text-text-muted font-bold text-sm">Calcular outro</button>
                    </div>
                )}
             </div>
        </div>
    );
};

const ChecklistsView: React.FC = () => {
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

    const toggle = (id: string) => {
        setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-bold text-lg text-text-main dark:text-white mb-4">Checklists Prontos</h3>
            <div className="space-y-4">
                {STANDARD_CHECKLISTS.map((list, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-primary dark:text-white">{list.category}</h4>
                        </div>
                        <div className="p-2">
                            {list.items.map((item, itemIdx) => {
                                const id = `${idx}-${itemIdx}`;
                                return (
                                    <div key={id} onClick={() => toggle(id)} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checkedItems[id] ? 'bg-success border-success text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {checkedItems[id] && <i className="fa-solid fa-check text-xs"></i>}
                                        </div>
                                        <span className={`text-sm ${checkedItems[id] ? 'text-text-muted line-through' : 'text-text-body dark:text-slate-300'}`}>{item}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const ContractsView: React.FC = () => {
    const [selectedContract, setSelectedContract] = useState<string | null>(null);

    if (selectedContract) {
        const template = CONTRACT_TEMPLATES.find(c => c.id === selectedContract);
        return (
            <div className="animate-in fade-in slide-in-from-right-4">
                 <button onClick={() => setSelectedContract(null)} className="mb-4 text-sm font-bold text-primary hover:underline">
                    <i className="fa-solid fa-arrow-left mr-1"></i> Voltar
                 </button>
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                     <h3 className="font-bold text-lg mb-2 text-text-main dark:text-white">{template?.title}</h3>
                     <p className="text-xs text-text-muted mb-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-2 rounded">
                         Copie o texto abaixo e preencha os dados entre colchetes [ ].
                     </p>
                     <textarea 
                        className="w-full h-96 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary text-text-body dark:text-slate-300"
                        readOnly
                        value={template?.contentTemplate}
                     />
                     <button 
                        onClick={() => navigator.clipboard.writeText(template?.contentTemplate || '')}
                        className="mt-4 w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-dark transition-all"
                    >
                        Copiar Texto
                    </button>
                 </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-bold text-lg text-text-main dark:text-white mb-2">Modelos de Contrato</h3>
            {CONTRACT_TEMPLATES.map(c => (
                <button 
                    key={c.id}
                    onClick={() => setSelectedContract(c.id)}
                    className="w-full text-left bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary transition-all group"
                >
                    <h4 className="font-bold text-text-main dark:text-white group-hover:text-primary transition-colors">{c.title}</h4>
                    <p className="text-sm text-text-muted dark:text-slate-400">{c.description}</p>
                </button>
            ))}
        </div>
    );
}

const ContactsView: React.FC = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'WORKERS' | 'SUPPLIERS'>('WORKERS');
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    
    // Lists from DB
    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    
    // Form States
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newNote, setNewNote] = useState('');
    const [confirmModal, setConfirmModal] = useState({isOpen: false, id: '', type: ''});

    const loadData = async () => {
        if (!user) return;
        setWorkers(await dbService.getWorkers(user.id));
        setSuppliers(await dbService.getSuppliers(user.id));
        setAvailableRoles(await dbService.getJobRoles());
        setAvailableCategories(await dbService.getSupplierCategories());
    };

    useEffect(() => { loadData(); }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        if (activeTab === 'WORKERS') {
            await dbService.addWorker({
                userId: user.id,
                name: newName,
                role: newRole,
                phone: newPhone,
                notes: newNote
            });
        } else {
            await dbService.addSupplier({
                userId: user.id,
                name: newName,
                category: newRole, // using role input as category
                phone: newPhone,
                email: '',
                address: '',
                notes: newNote
            });
        }
        setShowAdd(false);
        setNewName(''); setNewRole(''); setNewPhone(''); setNewNote('');
        loadData();
    };

    const handleDelete = async () => {
        const { id, type } = confirmModal;
        if (type === 'WORKERS') await dbService.deleteWorker(id);
        else await dbService.deleteSupplier(id);
        setConfirmModal({isOpen: false, id: '', type: ''});
        loadData();
    }

    const formatPhoneLink = (phone: string) => {
        const clean = phone.replace(/\D/g, '');
        return `https://wa.me/55${clean}`;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-bold text-lg text-text-main dark:text-white mb-4">Meus Contatos</h3>
            
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
                <button 
                    onClick={() => setActiveTab('WORKERS')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'WORKERS' ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-text-muted'}`}
                >
                    Equipe
                </button>
                <button 
                    onClick={() => setActiveTab('SUPPLIERS')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'SUPPLIERS' ? 'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm' : 'text-text-muted'}`}
                >
                    Fornecedores
                </button>
            </div>

            <button 
                onClick={() => setShowAdd(true)}
                className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-dark transition-all flex items-center justify-center gap-2"
            >
                <i className="fa-solid fa-plus"></i> Novo {activeTab === 'WORKERS' ? 'Trabalhador' : 'Fornecedor'}
            </button>

            {showAdd && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in slide-in-from-top-2">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">Nome</label>
                            <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 rounded-xl outline-none" placeholder="Ex: João da Silva" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">{activeTab === 'WORKERS' ? 'Profissão' : 'Categoria'}</label>
                            <select 
                                required 
                                value={newRole} 
                                onChange={e => setNewRole(e.target.value)} 
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 rounded-xl outline-none"
                            >
                                <option value="" disabled>Selecione uma opção</option>
                                {(activeTab === 'WORKERS' ? availableRoles : availableCategories).map(item => (
                                    <option key={item} value={item}>{item}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">WhatsApp / Telefone</label>
                            <input required value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 rounded-xl outline-none" placeholder="Ex: 11999999999" type="tel" />
                        </div>
                         <div>
                            <label className="text-xs font-bold text-text-muted mb-1 block">Observação (Opcional)</label>
                            <input value={newNote} onChange={e => setNewNote(e.target.value)} className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 rounded-xl outline-none" placeholder="..." />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 text-text-muted bg-slate-100 dark:bg-slate-800 rounded-xl font-bold">Cancelar</button>
                            <button type="submit" className="flex-1 py-3 text-white bg-primary rounded-xl font-bold">Salvar</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-3">
                {(activeTab === 'WORKERS' ? workers : suppliers).map((item: any) => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-text-main dark:text-white">{item.name}</h4>
                            <p className="text-sm text-text-muted dark:text-slate-500">{item.role || item.category}</p>
                            {item.notes && <p className="text-xs text-text-muted dark:text-slate-600 mt-1 italic">{item.notes}</p>}
                        </div>
                        <div className="flex gap-2">
                             <a 
                                href={formatPhoneLink(item.phone)} 
                                target="_blank"
                                className="w-10 h-10 rounded-lg bg-success text-white flex items-center justify-center hover:bg-success-dark transition-colors shadow-sm"
                             >
                                 <i className="fa-brands fa-whatsapp text-lg"></i>
                             </a>
                             <button 
                                onClick={() => setConfirmModal({isOpen: true, id: item.id, type: activeTab})}
                                className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-danger flex items-center justify-center transition-colors"
                             >
                                 <i className="fa-solid fa-trash"></i>
                             </button>
                        </div>
                    </div>
                ))}
                {(activeTab === 'WORKERS' ? workers : suppliers).length === 0 && !showAdd && (
                    <div className="text-center py-10 text-text-muted dark:text-slate-500">
                        Nenhum contato cadastrado.
                    </div>
                )}
            </div>

            <ConfirmModal 
                isOpen={confirmModal.isOpen} 
                title="Excluir Contato" 
                message="Tem certeza?" 
                onConfirm={handleDelete} 
                onCancel={() => setConfirmModal({isOpen: false, id: '', type: ''})} 
            />
        </div>
    );
}

// 5. MAIS MENU MAIN
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
        { id: 'REPORTS', label: 'Relatórios', icon: 'fa-file-pdf', color: 'text-red-500', desc: 'Para imprimir ou mandar para alguém.' },
    ];

    const bonusItems = [
        { id: 'CALCULATOR', label: 'Calculadora da Obra', icon: 'fa-calculator', color: 'text-primary', desc: 'Calcule pisos, tijolos e tintas.' },
        { id: 'CHECKLISTS', label: 'Checklists', icon: 'fa-list-check', color: 'text-success', desc: 'Não esqueça de nada importante.' },
        { id: 'CONTRACTS', label: 'Contratos e Recibos', icon: 'fa-file-signature', color: 'text-orange-500', desc: 'Modelos prontos para usar.' },
    ];

    const isLifetime = user?.plan === PlanType.VITALICIO;

    if (activeSubView) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {activeSubView !== 'CALCULATOR' && activeSubView !== 'CONTRACTS' && (
                    <button 
                        onClick={() => onNavigate('')} 
                        className="mb-4 text-sm font-bold text-text-muted hover:text-primary flex items-center gap-2"
                    >
                        <i className="fa-solid fa-arrow-left"></i> Voltar ao Menu
                    </button>
                )}
                
                {activeSubView === 'CONTACTS' && <ContactsView />}
                {activeSubView === 'PHOTOS' && <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl text-text-muted border border-slate-200 dark:border-slate-800">Galeria de Fotos (Em breve)</div>}
                {activeSubView === 'FILES' && <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl text-text-muted border border-slate-200 dark:border-slate-800">Gerenciador de Arquivos (Em breve)</div>}
                {activeSubView === 'CHECKLISTS' && <ChecklistsView />}
                {activeSubView === 'CONTRACTS' && <ContractsView />}
                {activeSubView === 'CALCULATOR' && <CalculatorView workId={workId} onBack={() => onNavigate('')} />}
                {activeSubView === 'REPORTS' && (
                    <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl text-center border border-slate-200 dark:border-slate-800">
                        <i className="fa-solid fa-print text-4xl text-slate-300 mb-4"></i>
                        <p className="mb-4 text-text-main dark:text-white">Gerar relatório PDF da obra?</p>
                        <button onClick={() => window.print()} className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all">Imprimir Relatório</button>
                    </div>
                )}
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

// --- MAIN PAGE ---

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

      <div className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-2 md:hidden z-50 flex justify-around items-center shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
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