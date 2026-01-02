
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx'; // Use authLoading and isUserAuthFinished
import * as ReactRouter from 'react-router-dom';
import { dbService } from '../services/db.ts';
import { WorkStatus } from '../types.ts';
import { WORK_TEMPLATES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

// Helper para formatar valores monetários
const formatCurrency = (value: number | string | undefined): string => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return '0,00'; // Retorna apenas o valor sem R$ para placeholder
  }
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};


const CreateWork = () => {
  const { user, authLoading, isUserAuthFinished } = useAuth(); // Use authLoading and isUserAuthFinished
  const navigate = ReactRouter.useNavigate();
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2; // Simplified to 2 steps for better UX
  const [loading, setLoading] = useState(false); // Local loading for form submission, not global auth loading
  
  // Generation Animation State
  const [generationMode, setGenerationMode] = useState(false);
  const [genStep, setGenStep] = useState(0);

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    budgetPlanned: '',
    area: '',
    floors: '1',
    startDate: new Date().toISOString().split('T')[0],
    bedrooms: '3',
    bathrooms: '2',
    kitchens: '1',
    livingRooms: '1',
    hasLeisureArea: false
  });

  const [workCategory, setWorkCategory] = useState<'CONSTRUCTION' | 'RENOVATION' | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  const selectedTemplate = WORK_TEMPLATES.find(t => t.id === selectedTemplateId);
  const needsDetailedInputs = workCategory === 'CONSTRUCTION' || selectedTemplateId === 'REFORMA_APTO';

  // --- NEW: Error States ---
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  // --- END NEW ---

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
    // Clear error for the field being edited
    setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[e.target.name];
        return newErrors;
    });
  };

  const handleCounter = (field: keyof typeof formData, increment: boolean) => {
      setFormData(prev => {
          const currentVal = Number(prev[field]);
          const newVal = increment ? currentVal + 1 : Math.max(0, currentVal - 1);
          if (field === 'floors' && newVal < 1) return prev;
          return { ...prev, [field]: String(newVal) };
      });
      setFormErrors(prev => { // Clear error for the field being edited
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
    });
  };

  // Refatorado para validar passos específicos
  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!formData.name.trim()) {
          newErrors.name = "Por favor, dê um apelido para sua obra."; 
      }
      if (!formData.budgetPlanned) {
          newErrors.budgetPlanned = "Quanto você pretende gastar (mesmo que seja um chute)?"; 
      } else if (Number(formData.budgetPlanned) <= 0) {
          newErrors.budgetPlanned = "O orçamento deve ser maior que zero.";
      }
      if (formData.area && Number(formData.area) <= 0) {
        newErrors.area = "A área deve ser maior que zero.";
      }
    } 
    else if (step === 2) {
      if (!workCategory) {
          newErrors.workCategory = "Escolha entre Construção ou Reforma."; 
      }
      if (!selectedTemplateId) {
          newErrors.selectedTemplate = "Selecione o tipo específico da obra."; 
      }
      if (!formData.startDate) {
          newErrors.startDate = "Qual a data de início?"; 
      // Fix: Compare Date objects' time values (milliseconds since epoch) for accurate date comparison.
      } else {
          // --- INÍCIO DA CORREÇÃO DA VALIDAÇÃO DE DATA ---
          // Garante que ambas as datas são comparadas como "início do dia" na hora LOCAL.
          const [year, month, day] = formData.startDate.split('-').map(Number);
          const selectedDateAtLocalMidnight = new Date(year, month - 1, day, 0, 0, 0, 0).getTime(); // Set to midnight local time

          const today = new Date();
          const todayAtLocalMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime(); // Set to midnight local time

          if (selectedDateAtLocalMidnight < todayAtLocalMidnight) {
              newErrors.startDate = "A data de início não pode ser no passado.";
          }
          // --- FIM DA CORREÇÃO DA VALIDAÇÃO DE DATA ---
      }
    }
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCategorySelect = (category: 'CONSTRUCTION' | 'RENOVATION') => {
      setWorkCategory(category);
      if (category === 'CONSTRUCTION') setSelectedTemplateId('CONSTRUCAO');
      else setSelectedTemplateId('');
      setFormErrors(prev => { // Clear category specific errors on selection
        const newErrors = { ...prev };
        delete newErrors.workCategory;
        delete newErrors.selectedTemplate;
        return newErrors;
      });
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Valida o passo final antes de realmente submeter
    if (!validateStep(totalSteps)) return; 

    setLoading(true);
    setGenerationMode(true); // Activate overlay
    setGeneralError(''); // Clear general error before submission

    // Timeout safety
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("TIMEOUT")), 15000); // 15 seconds max
    });

    try {
        // A duração será calculada dinamicamente dentro do dbService.createWork
        // Aqui, passamos apenas a data de início
        
        // Start Creation Process
        const createPromise = dbService.createWork({
          userId: user.id,
          name: formData.name,
          address: formData.address || 'Endereço não informado',
          budgetPlanned: Number(formData.budgetPlanned),
          startDate: formData.startDate,
          // endDate será calculada e atualizada dentro do dbService
          area: Number(formData.area) || 0,
          floors: Number(formData.floors) || 1,
          bedrooms: Number(formData.bedrooms),
          bathrooms: Number(formData.bathrooms),
          kitchens: Number(formData.kitchens),
          livingRooms: Number(formData.livingRooms),
          hasLeisureArea: formData.hasLeisureArea,
          status: WorkStatus.PLANNING,
          notes: selectedTemplate?.label || ''
        }, selectedTemplateId);

        // Simulated steps for UX
        setGenStep(1); // Analyzing
        await wait(1500); 
        
        setGenStep(2); // Creating Schedule
        await wait(1500);
        
        setGenStep(3); // Calculating Materials
        await wait(1500);

        setGenStep(4); // Finishing
        
        // Race against timeout
        const newWork: any = await Promise.race([createPromise, timeoutPromise]);
        await wait(800); 

        navigate(`/work/${newWork.id}`);
    } catch (error: any) {
        console.error("Erro CREATE:", error);
        setGenerationMode(false);
        setLoading(false);
        setGenStep(0);
        
        if (error.message === 'TIMEOUT' || error.message?.includes('Supabase off')) {
            setGeneralError("Erro de conexão ou Banco de Dados não configurado. Verifique se você criou as tabelas no Supabase.");
        } else if (error.message?.includes('permission denied')) {
            setGeneralError("Erro de Permissão. Verifique se você está logado corretamente.");
        } else {
            setGeneralError(`Erro ao salvar: ${error.message}`);
        }
    }
  };

  const CounterInput = ({ label, field, icon }: { label: string, field: keyof typeof formData, icon: string }) => (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-3 flex flex-col items-center justify-center shadow-sm hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors group">
          <div className="text-slate-400 mb-1 group-hover:text-secondary transition-colors text-lg"><i className={`fa-solid ${icon}`}></i></div>
          <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase mb-2 text-center tracking-wider">{label}</label>
          <div className="flex items-center gap-3 w-full justify-center">
              <button type="button" onClick={() => handleCounter(field, false)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center" aria-label={`Diminuir ${label.toLowerCase()}`}>-</button>
              <span className="min-w-[1.5rem] text-center font-black text-primary dark:text-white text-xl">{formData[field as keyof typeof formData]}</span>
              <button type="button" onClick={() => handleCounter(field, true)} className="w-8 h-8 rounded-lg bg-primary text-white font-bold hover:bg-primary-light transition-colors shadow-md shadow-primary/20 flex items-center justify-center" aria-label={`Aumentar ${label.toLowerCase()}`}>+</button>
          </div>
      </div>
  );

  // If AuthContext is still loading, show a simple spinner.
  // This prevents the CreateWork form from flashing prematurely before auth state is known.
  if (!isUserAuthFinished || authLoading) { // Updated condition
    return (
        <div className="flex items-center justify-center min-h-[80vh] text-primary dark:text-white">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
        </div>
    );
  }

  // GENERATION OVERLAY
  if (generationMode) {
      return (
          <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
              <div className="relative mb-8">
                  <div className="w-32 h-32 rounded-full border-4 border-slate-800 flex items-center justify-center relative z-10 bg-slate-900">
                      <img src={ZE_AVATAR} className="w-24 h-24 rounded-full border-2 border-slate-700 object-cover" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK} alt="Zé da Obra Avatar"/>
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-t-secondary border-r-secondary border-b-transparent border-l-transparent animate-spin"></div>
              </div>
              
              <h2 className="text-2xl font-black text-white mb-2 animate-pulse">
                  {genStep === 1 && "Analisando seus dados..."}
                  {genStep === 2 && "Criando cronograma..."}
                  {genStep === 3 && "Calculando materiais..."}
                  {genStep === 4 && "Finalizando projeto!"}
              </h2>
              
              <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8">
                  O Zé da Obra está organizando tudo para você não ter dor de cabeça.
              </p>

              <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary transition-all duration-1000 ease-out" 
                    style={{ width: `${genStep * 25}%` }}
                  ></div>
              </div>
          </div>
      );
  }

  const renderStepContent = () => {
    switch(currentStep) {
        case 1:
            return (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 dark:border-slate-800">
                        <h2 className="text-2xl font-black text-primary dark:text-white mb-2 tracking-tight">O Básico</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Primeiro, vamos dar um nome e definir as metas.</p>

                        <div className="space-y-6">
                            <div>
                                <label htmlFor="workName" className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Nome ou Apelido da Obra</label>
                                <input id="workName" name="name" autoFocus placeholder="Ex: Reforma da Cozinha..." value={formData.name} className="w-full px-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-secondary/20 focus:border-secondary outline-none transition-all placeholder:text-slate-300" onChange={handleChange} aria-invalid={!!formErrors.name} aria-describedby="name-error" aria-label="Nome ou Apelido da Obra" />
                                {formErrors.name && <p id="name-error" className="text-red-500 text-sm mt-1">{formErrors.name}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="area" className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Tamanho (m²)</label>
                                    <input id="area" name="area" type="number" placeholder="0" value={formData.area} className="w-full px-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-secondary/20 focus:border-secondary outline-none transition-all placeholder:text-slate-300" onChange={handleChange} aria-invalid={!!formErrors.area} aria-describedby="area-error" aria-label="Tamanho em metros quadrados" />
                                    {formErrors.area && <p id="area-error" className="text-red-500 text-sm mt-1">{formErrors.area}</p>}
                                </div>
                                <div>
                                    <label htmlFor="budgetPlanned" className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Orçamento (R$)</label>
                                    <input id="budgetPlanned" name="budgetPlanned" type="number" placeholder={formatCurrency(0)} value={formData.budgetPlanned} className="w-full px-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-secondary/20 focus:border-secondary outline-none transition-all placeholder:text-slate-300" onChange={handleChange} aria-invalid={!!formErrors.budgetPlanned} aria-describedby="budget-error" aria-label="Orçamento planejado em Reais" />
                                    {formErrors.budgetPlanned && <p id="budget-error" className="text-red-500 text-sm mt-1">{formErrors.budgetPlanned}</p>}
                                </div>
                            </div>
                            <div>
                                <label htmlFor="address" className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Endereço <span className="text-slate-400 font-medium normal-case tracking-normal">(Opcional)</span></label>
                                <input id="address" name="address" placeholder="Cidade ou bairro" value={formData.address} className="w-full px-5 py-4 text-base font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-secondary/20 focus:border-secondary outline-none transition-all placeholder:text-slate-300" onChange={handleChange} aria-label="Endereço da obra (opcional)" />
                            </div>
                        </div>
                    </div>
                </div>
            );
        case 2:
            if (!workCategory) {
                return (
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 dark:border-slate-800 text-center">
                            <h2 className="text-2xl font-black text-primary dark:text-white mb-2 tracking-tight">Tipo de Projeto</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Escolha a categoria principal.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button type="button" onClick={() => handleCategorySelect('CONSTRUCTION')} className="relative p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-secondary hover:bg-white dark:hover:bg-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col items-center gap-5 group" aria-label="Tipo de Projeto: Construção">
                                    <div className="w-20 h-20 rounded-full bg-secondary text-white flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform"><i className="fa-solid fa-trowel-bricks"></i></div>
                                    <div><h3 className="font-black text-xl text-primary dark:text-white mb-1">Construção</h3><p className="text-sm font-bold text-slate-400">Do zero (Terreno Vazio)</p></div>
                                </button>
                                <button type="button" onClick={() => handleCategorySelect('RENOVATION')} className="relative p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-secondary hover:bg-white dark:hover:bg-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col items-center gap-5 group" aria-label="Tipo de Projeto: Reforma">
                                    <div className="w-20 h-20 rounded-full bg-secondary text-white flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform"><i className="fa-solid fa-paint-roller"></i></div>
                                    <div><h3 className="font-black text-xl text-primary dark:text-white mb-1">Reforma</h3><p className="text-sm font-bold text-slate-400">Melhoria ou Reparo</p></div>
                                </button>
                            </div>
                            {formErrors.workCategory && <p className="text-red-500 text-sm mt-4">{formErrors.workCategory}</p>}
                        </div>
                    </div>
                );
            }
            return (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div><h2 className="text-2xl font-black text-primary dark:text-white mb-1 tracking-tight">{workCategory === 'CONSTRUCTION' ? 'Estrutura' : 'Tipo de Reforma'}</h2><p className="text-slate-500 dark:text-slate-400 text-sm font-bold">{workCategory === 'CONSTRUCTION' ? 'Detalhe os cômodos.' : 'Selecione o modelo.'}</p></div>
                            <button onClick={() => setWorkCategory(null)} className="text-xs font-black uppercase tracking-wider text-secondary hover:underline bg-secondary/5 px-3 py-1.5 rounded-lg transition-colors" aria-label="Mudar tipo de projeto"><i className="fa-solid fa-rotate-left mr-1"></i> Mudar</button>
                        </div>
                        {workCategory === 'RENOVATION' && (
                             <div className="grid grid-cols-2 gap-4 mb-8">
                                {WORK_TEMPLATES.filter(t => t.id !== 'CONSTRUCAO').map(template => (
                                    <button 
                                        key={template.id} 
                                        type="button" 
                                        onClick={() => { setSelectedTemplateId(template.id); setFormErrors(prev => { const newErrors = { ...prev }; delete newErrors.selectedTemplate; return newErrors; }); }} 
                                        className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col gap-3 group ${selectedTemplateId === template.id ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'}`}
                                        aria-pressed={selectedTemplateId === template.id}
                                        aria-label={`Selecionar modelo: ${template.label}`}
                                    >
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-colors bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:text-secondary"><i className={`fa-solid ${template.icon}`}></i></div>
                                        <div>
                                            <h3 className="font-black text-sm mb-1">{template.label}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 leading-tight">{template.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {formErrors.selectedTemplate && <p className="text-red-500 text-sm mt-1 mb-4">{formErrors.selectedTemplate}</p>}

                        {needsDetailedInputs && (
                             <div className="mb-8">
                                 {workCategory === 'CONSTRUCTION' && (
                                     <div className="mb-6">
                                         <CounterInput label="Pavimentos" field="floors" icon="fa-layer-group" />
                                     </div>
                                 )}
                                 <div className="grid grid-cols-2 gap-4">
                                     <CounterInput label="Quartos" field="bedrooms" icon="fa-bed" />
                                     <CounterInput label="Banheiros" field="bathrooms" icon="fa-bath" />
                                     <CounterInput label="Cozinhas" field="kitchens" icon="fa-kitchen-set" />
                                     <CounterInput label="Salas" field="livingRooms" icon="fa-tv" />
                                 </div>
                                 <div className="mt-6 flex items-center justify-center">
                                     <label className="flex items-center gap-3 cursor-pointer group">
                                         <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${formData.hasLeisureArea ? 'bg-secondary border-secondary' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                                             {formData.hasLeisureArea && <i className="fa-solid fa-check text-white text-xs"></i>}
                                         </div>
                                         <input type="checkbox" name="hasLeisureArea" checked={formData.hasLeisureArea} onChange={handleChange} className="hidden" aria-label="Possui área de lazer ou piscina" />
                                         <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-white transition-colors">Possui área de lazer / piscina?</span>
                                     </label>
                                 </div>
                             </div>
                        )}
                        
                        <div>
                            <label htmlFor="startDate" className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Data de Início</label>
                            <input id="startDate" type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="w-full px-5 py-4 text-base font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-secondary/20 focus:border-secondary outline-none transition-all placeholder:text-slate-300" aria-invalid={!!formErrors.startDate} aria-describedby="startDate-error" aria-label="Data de início da obra" />
                            {formErrors.startDate && <p id="startDate-error" className="text-red-500 text-sm mt-1">{formErrors.startDate}</p>}
                        </div>
                    </div>
                </div>
            );
        default: return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-12 pt-6 px-4">
      <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => { if(currentStep === 1) navigate('/'); else setCurrentStep(prev => prev - 1); setFormErrors({}); setGeneralError(''); }} 
            className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2"
            aria-label={currentStep === 1 ? "Voltar ao Dashboard" : "Voltar à etapa anterior"}
          >
            <i className="fa-solid fa-arrow-left text-xl"></i>
          </button>
          <div className="flex gap-2" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps}>
              {[1, 2].map(s => (
                  <div key={s} className={`h-2 rounded-full transition-all duration-500 ${s <= currentStep ? 'w-8 bg-secondary' : 'w-2 bg-slate-200 dark:bg-slate-700'}`}></div>
              ))}
          </div>
          <div className="w-6"></div> {/* Placeholder for alignment */}
      </div>

      <form onSubmit={handleSubmit}>
          {generalError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-900 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in" role="alert">
                  <i className="fa-solid fa-triangle-exclamation"></i> {generalError}
              </div>
          )}
          {renderStepContent()}
          
          <div className="mt-8 flex justify-end">
              {currentStep < totalSteps ? (
                  <button 
                    type="button" 
                    onClick={() => { if(validateStep(currentStep)) setCurrentStep(prev => prev + 1); setGeneralError(''); }} 
                    className="px-8 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg hover:bg-primary-light transition-all flex items-center gap-3"
                    aria-label="Próxima etapa do formulário"
                  >
                      Próximo <i className="fa-solid fa-arrow-right"></i>
                  </button>
              ) : (
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="px-8 py-4 bg-gradient-gold text-white font-bold rounded-2xl shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100"
                    aria-label={loading ? 'Gerando obra' : 'Criar obra'}
                  >
                      {loading ? 'Gerando...' : 'Criar Obra'} {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                  </button>
              )}
          </div>
      </form>
    </div>
  );
};

export default CreateWork;
