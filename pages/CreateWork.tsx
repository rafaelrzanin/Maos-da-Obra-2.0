import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { dbService } from '../services/db';
import { WORK_TEMPLATES } from '../services/standards';
import { StepStatus } from '../types';

const CreateWork: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [loading, setLoading] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    budgetPlanned: '',
    area: '',
    floors: '1', // New field
    startDate: new Date().toISOString().split('T')[0],
  });

  // Template Logic
  const [workCategory, setWorkCategory] = useState<'CONSTRUCTION' | 'RENOVATION' | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [suggestedSteps, setSuggestedSteps] = useState<{name: string, checked: boolean}[]>([]);

  const selectedTemplate = WORK_TEMPLATES.find(t => t.id === selectedTemplateId);

  // Update steps when template changes
  useEffect(() => {
    if (selectedTemplate) {
      setSuggestedSteps(
        selectedTemplate.includedSteps.map(step => ({ name: step, checked: true }))
      );
    }
  }, [selectedTemplateId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStepToggle = (index: number) => {
    const newSteps = [...suggestedSteps];
    newSteps[index].checked = !newSteps[index].checked;
    setSuggestedSteps(newSteps);
  };

  const validateStep = (step: number) => {
    if (step === 1) {
       if (!formData.name.trim()) { alert("Por favor, dê um apelido para sua obra."); return false; }
       if (!formData.budgetPlanned) { alert("Quanto você pretende gastar (mesmo que seja um chute)?"); return false; }
    }
    if (step === 2) {
       if (!workCategory) { alert("Escolha entre Construção ou Reforma."); return false; }
       if (!selectedTemplateId) { alert("Selecione o tipo específico da obra."); return false; }
       if (!formData.startDate) { alert("Qual a data de início?"); return false; }
       if (workCategory === 'CONSTRUCTION' && (!formData.floors || Number(formData.floors) < 1)) { alert("Informe a quantidade de pavimentos."); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
        setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleCategorySelect = (category: 'CONSTRUCTION' | 'RENOVATION') => {
      setWorkCategory(category);
      if (category === 'CONSTRUCTION') {
          // Auto select the construction template
          setSelectedTemplateId('CONSTRUCAO');
      } else {
          // Reset template if switching to renovation to force choice
          setSelectedTemplateId('');
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateStep(currentStep)) return;

    setLoading(true);

    // Calculate end date based on template duration
    const duration = selectedTemplate?.defaultDurationDays || 90;
    const start = new Date(formData.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + duration);

    try {
        // Create Work (Async)
        const newWork = await dbService.createWork({
          userId: user.id,
          name: formData.name,
          address: formData.address || 'Endereço não informado',
          budgetPlanned: Number(formData.budgetPlanned),
          startDate: formData.startDate,
          endDate: end.toISOString().split('T')[0],
          area: Number(formData.area) || 0,
          floors: Number(formData.floors) || 1,
          notes: selectedTemplate?.label || ''
        }, workCategory === 'CONSTRUCTION'); // Pass flag to trigger calculations

        // Add Selected Steps Manually (since we allowed custom unchecking)
        const finalSteps = suggestedSteps.filter(s => s.checked).map(s => s.name);
        const stepDuration = Math.max(2, Math.floor(duration / finalSteps.length));
        
        let currentOffset = 0;
        
        // We do this loop in parallel or sequential? Sequential is safer for order.
        for (const stepName of finalSteps) {
            const sDate = new Date(start);
            sDate.setDate(sDate.getDate() + currentOffset);
            
            const eDate = new Date(sDate);
            eDate.setDate(eDate.getDate() + stepDuration);

            await dbService.addStep({
                workId: newWork.id,
                name: stepName,
                startDate: sDate.toISOString().split('T')[0],
                endDate: eDate.toISOString().split('T')[0],
                status: StepStatus.NOT_STARTED
            });
            
            currentOffset += (stepDuration - 1); 
        }

        navigate(`/work/${newWork.id}`);
    } catch (error) {
        console.error(error);
        alert("Erro ao criar obra. Tente novamente.");
    } finally {
        setLoading(false);
    }
  };

  // Step Content Renderer
  const renderStepContent = () => {
    switch(currentStep) {
        case 1:
            return (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="text-xl font-bold text-primary dark:text-white mb-1">Vamos começar com o básico</h2>
                        <p className="text-text-muted dark:text-slate-400 mb-6 text-sm">Me conte um pouco sobre o que você vai fazer.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Nome ou Apelido da Obra</label>
                                <input 
                                  name="name" 
                                  autoFocus
                                  placeholder="Ex: Minha Casa Nova, Reforma da Cozinha..."
                                  value={formData.name}
                                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                                  onChange={handleChange}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase mb-1 min-h-[2rem] flex items-end">Tamanho Total (m²)</label>
                                    <input 
                                    name="area" 
                                    type="number" 
                                    placeholder="Ex: 50"
                                    value={formData.area}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                                    onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-muted uppercase mb-1 min-h-[2rem] flex items-end">Meu Orçamento (R$)</label>
                                    <input 
                                        name="budgetPlanned" 
                                        type="number" 
                                        placeholder="0,00"
                                        value={formData.budgetPlanned}
                                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Endereço (Opcional)</label>
                                <input 
                                  name="address" 
                                  placeholder="Cidade ou bairro"
                                  value={formData.address}
                                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-main dark:text-white rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                                  onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            );
        case 2:
            // LEVEL 1: MACRO SELECTION (Construir vs Reformar)
            if (!workCategory) {
                return (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 text-center">
                            <h2 className="text-xl font-bold text-primary dark:text-white mb-2">O que você vai fazer?</h2>
                            <p className="text-text-muted dark:text-slate-400 mb-8 text-sm">Escolha a opção que melhor descreve o momento.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => handleCategorySelect('CONSTRUCTION')}
                                    className="p-8 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex flex-col items-center gap-4 group"
                                >
                                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl group-hover:scale-110 transition-transform">
                                        <i className="fa-solid fa-trowel-bricks"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-text-main dark:text-white">Construção</h3>
                                        <p className="text-sm text-text-muted dark:text-slate-400">Vou construir do zero (terreno vazio).</p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleCategorySelect('RENOVATION')}
                                    className="p-8 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex flex-col items-center gap-4 group"
                                >
                                    <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center text-secondary text-3xl group-hover:scale-110 transition-transform">
                                        <i className="fa-solid fa-paint-roller"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-text-main dark:text-white">Reforma</h3>
                                        <p className="text-sm text-text-muted dark:text-slate-400">Vou reformar ou melhorar um imóvel.</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }

            // LEVEL 2: SPECIFIC SELECTION
            return (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-primary dark:text-white mb-1">
                                    {workCategory === 'CONSTRUCTION' ? 'Detalhes da Construção' : 'O que vamos reformar?'}
                                </h2>
                                <p className="text-text-muted dark:text-slate-400 text-sm">
                                    {workCategory === 'CONSTRUCTION' ? 'Já deixei tudo pronto para uma obra completa.' : 'Selecione a opção mais parecida.'}
                                </p>
                            </div>
                            <button onClick={() => setWorkCategory(null)} className="text-xs font-bold text-primary hover:underline">
                                Mudar tipo
                            </button>
                        </div>

                        {/* If Renovation, show Grid of options */}
                        {workCategory === 'RENOVATION' && (
                             <div className="grid grid-cols-2 gap-3 mb-6">
                                {WORK_TEMPLATES.filter(t => t.id !== 'CONSTRUCAO').map(template => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={`p-4 rounded-xl border text-left transition-all relative ${
                                            selectedTemplateId === template.id 
                                            ? 'border-primary bg-primary/5 dark:bg-primary/20 ring-1 ring-primary' 
                                            : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                                        }`}
                                    >
                                        <i className={`fa-solid ${template.icon} text-2xl mb-2 ${selectedTemplateId === template.id ? 'text-primary' : 'text-slate-400'}`}></i>
                                        <h3 className={`font-bold text-sm ${selectedTemplateId === template.id ? 'text-primary' : 'text-text-main dark:text-white'}`}>{template.label}</h3>
                                        {selectedTemplateId === template.id && <i className="fa-solid fa-circle-check absolute top-2 right-2 text-primary"></i>}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {/* If Construction, we just show the summary card of what was auto-selected */}
                        {workCategory === 'CONSTRUCTION' && (
                             <div className="mb-6 p-4 bg-surface dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                 <div className="flex items-center gap-4 mb-4">
                                     <i className="fa-solid fa-house-chimney text-3xl text-primary"></i>
                                     <div>
                                         <h3 className="font-bold text-text-main dark:text-white">Construção Completa</h3>
                                         <p className="text-sm text-text-muted dark:text-slate-400">Calcularemos os materiais baseados na sua área.</p>
                                     </div>
                                 </div>
                                 <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                     <label className="block text-xs font-bold text-text-muted uppercase mb-1">Quantos pavimentos (andares)?</label>
                                     <div className="flex items-center gap-3">
                                         <button type="button" onClick={() => setFormData({...formData, floors: String(Math.max(1, Number(formData.floors) - 1))})} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-text-main dark:text-white font-bold">-</button>
                                         <input 
                                            type="number"
                                            value={formData.floors}
                                            onChange={(e) => setFormData({...formData, floors: e.target.value})}
                                            className="w-full text-center px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl font-bold"
                                         />
                                         <button type="button" onClick={() => setFormData({...formData, floors: String(Number(formData.floors) + 1)})} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-text-main dark:text-white font-bold">+</button>
                                     </div>
                                 </div>
                             </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Quando vou começar?</label>
                            <input 
                                name="startDate" 
                                type="date" 
                                required 
                                value={formData.startDate}
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-surface dark:bg-slate-800 text-text-body dark:text-white rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>
            );
        case 3:
            return (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="text-xl font-bold text-primary dark:text-white mb-1">O que vamos fazer?</h2>
                        <p className="text-text-muted dark:text-slate-400 mb-6 text-sm">Eu sugeri estas etapas. Desmarque o que você NÃO vai fazer.</p>

                        <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto pr-2">
                           {suggestedSteps.map((step, idx) => (
                               <label key={idx} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${step.checked ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'opacity-50 border-transparent'}`}>
                                   <div className={`w-6 h-6 rounded-md border flex items-center justify-center mr-3 transition-colors ${step.checked ? 'bg-primary border-primary text-white' : 'bg-white dark:bg-slate-900 border-slate-300'}`}>
                                       {step.checked && <i className="fa-solid fa-check text-xs"></i>}
                                   </div>
                                   <input 
                                      type="checkbox" 
                                      className="hidden" 
                                      checked={step.checked} 
                                      onChange={() => handleStepToggle(idx)}
                                   />
                                   <span className="text-sm font-medium text-text-main dark:text-white">{step.name}</span>
                               </label>
                           ))}
                        </div>
                        
                        {workCategory === 'CONSTRUCTION' && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl mb-4 border border-blue-100 dark:border-blue-900">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    <i className="fa-solid fa-robot mr-2"></i>
                                    <strong>Engenheiro Virtual:</strong> Vou calcular automaticamente os materiais (tijolos, cimento, telhas) baseado nos seus <strong>{formData.area}m²</strong> e <strong>{formData.floors} andares</strong>.
                                </p>
                            </div>
                        )}
                        
                        <div className="text-center text-xs text-text-muted">
                            <p>Fique tranquilo, você pode mudar tudo depois.</p>
                        </div>
                    </div>
                </div>
            );
        default: return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-12 pt-4 px-4 font-sans">
      <button onClick={() => navigate('/')} className="mb-4 text-text-muted hover:text-primary font-bold flex items-center text-sm transition-colors">
        <i className="fa-solid fa-arrow-left mr-2"></i> Cancelar
      </button>
      
      <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-text-main dark:text-white">Começar Nova Obra</h1>
            <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">Passo {currentStep} de {totalSteps}</span>
          </div>
          
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
             <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
             ></div>
          </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {renderStepContent()}

        <div className="flex gap-4 pt-2">
           {currentStep > 1 && (
             <button 
                type="button" 
                onClick={prevStep}
                disabled={loading}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-text-main dark:text-white font-bold py-4 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
             >
                Voltar
             </button>
           )}
           
           {currentStep === 2 && !workCategory ? null : (
               currentStep < totalSteps ? (
                 <button 
                    type="button" 
                    onClick={nextStep}
                    className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                 >
                    Continuar <i className="fa-solid fa-arrow-right"></i>
                 </button>
               ) : (
                <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 bg-success hover:bg-success-dark text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-success/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                >
                    {loading ? (
                        <>
                           <i className="fa-solid fa-circle-notch fa-spin"></i> Calculando...
                        </>
                    ) : (
                        <>
                           <i className="fa-solid fa-check"></i> Criar minha obra!
                        </>
                    )}
                </button>
               )
           )}
        </div>

      </form>
    </div>
  );
};

export default CreateWork;