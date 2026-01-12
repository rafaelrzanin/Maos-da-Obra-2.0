
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx'; // Use authLoading and isUserAuthFinished
import * as ReactRouter from 'react-router-dom';
import { dbService } from '../services/db.ts';
import { WorkStatus, StepStatus } from '../types.ts'; // Import StepStatus
import { WORK_TEMPLATES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';
// Removed: import { aiService } from '../services/ai'; // CRITICAL: REMOVED AI SERVICE IMPORT

// CRITICAL FIX: Local mockAiService to entirely replace aiService in the browser
const mockAiService = {
  chat: async (message: string): Promise<string> => {
    console.warn("MOCK AI SERVICE: chat called in browser (CreateWork). AI is disabled.");
    await new Promise(r => setTimeout(r, 500)); // Simulate loading
    return "O Zé está em modo offline no momento para gerar um resumo. Por favor, configure sua chave de API ou acesse um plano Vitalício para usar a IA.";
  },
  getWorkInsight: async (context: string): Promise<string> => {
    console.warn("MOCK AI SERVICE: getWorkInsight called in browser (CreateWork). AI is disabled.");
    await new Promise(r => setTimeout(r, 500)); // Simulate loading
    return "Estou sem conexão para dar a dica, mas a atenção ao cronograma é sempre crucial.";
  },
  generateWorkPlanAndRisk: async (work: any): Promise<any> => { // Returns any to match expected object
    console.warn("MOCK AI SERVICE: generateWorkPlanAndRisk called in browser (CreateWork). AI is disabled.");
    await new Promise(r => setTimeout(r, 2000));
    return {
      workId: work.id,
      generalAdvice: "A IA está offline. Não foi possível gerar um plano detalhado. Verifique suas anotações e contatos para gerenciar a obra.",
      timelineSummary: "Plano offline. Organize suas etapas manualmente.",
      detailedSteps: [{ orderIndex: 1, name: "Fase 1: Preparação (OFFLINE)", estimatedDurationDays: 10, notes: "Defina seus materiais manualmente enquanto a IA está offline." }],
      potentialRisks: [{ description: "Risco de atraso devido a IA offline.", likelihood: "high", mitigation: "A IA está offline." }],
      materialSuggestions: [{ item: "Cimento (OFFLINE)", priority: "medium", reason: "Sempre essencial, mas a IA não pode sugerir agora." }],
    };
  }
};


// Helper para formatar valores monetários (apenas para exibição estática)
const formatCurrency = (value: number | string | undefined): string => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 'R$ 0,00'; // Retorna apenas o valor sem R$ para placeholder
  }
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// NEW: UI helper
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(' ');


const CreateWork = () => {
  const { user, authLoading, isUserAuthFinished } = useAuth(); // Use authLoading and isUserAuthFinished
  const navigate = ReactRouter.useNavigate();
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3; // UPDATED to 3 steps
  const [loading, setLoading] = useState(false); // Local loading for form submission, not global auth loading
  
  // REMOVED: Generation Animation State (generationMode, genStep)

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    budgetPlanned: '', // Kept as string for direct input, converted to Number on submit
    area: '', // Still string, but not currency formatted
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
  
  // CRITICAL: Ensure conditional logic uses current `selectedTemplateId`
  const selectedTemplate = WORK_TEMPLATES.find(t => t.id === selectedTemplateId);
  const needsDetailedInputs = workCategory === 'CONSTRUCTION' || selectedTemplateId === 'REFORMA_APTO';

  // --- NEW: Error States ---
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  // --- END NEW ---

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { name, value, type, checked } = e.target;
    // For number inputs, allow empty string but convert to number on blur or submission
    const processedValue = type === 'checkbox' ? checked : value;

    // Direct update without custom monetary formatting logic
    setFormData({ ...formData, [name]: processedValue });
    
    // Clear error for the field being edited
    setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
    });
  };

  // REMOVED: handleMonetaryBlur

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
    if (step === 1) { // Step 1: Basic Info
      if (!formData.name.trim()) {
          newErrors.name = "Por favor, dê um apelido para sua obra."; 
      }
      if (!formData.area || Number(formData.area) <= 0) { // AREA IS NOW MANDATORY
          newErrors.area = "A área em m² é obrigatória e deve ser maior que zero.";
      }
      // Validation for budgetPlanned directly on Number conversion
      if (!formData.budgetPlanned || Number(formData.budgetPlanned) <= 0) {
          newErrors.budgetPlanned = "O orçamento deve ser maior que zero.";
      }
    } 
    else if (step === 2) { // Step 2: Work Type and Start Date
      if (!workCategory) {
          newErrors.workCategory = "Escolha entre Construção ou Reforma."; 
      }
      if (!formData.startDate) {
          newErrors.startDate = "Qual a data de início?"; 
      } else {
          const [year, month, day] = formData.startDate.split('-').map(Number);
          const selectedDateAtLocalMidnight = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();

          const today = new Date();
          const todayAtLocalMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime();

          if (selectedDateAtLocalMidnight < todayAtLocalMidnight) {
              newErrors.startDate = "A data de início não pode ser no passado.";
          }
      }
    }
    else if (step === 3) { // Step 3: Specific Type and Additional Details
        if (!selectedTemplateId) {
            newErrors.selectedTemplate = "Selecione o tipo específico da obra.";
        }
        // No specific validation needed for counters here, as they have default values (1) or are optional (leisure area)
    }
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCategorySelect = (category: 'CONSTRUCTION' | 'RENOVATION') => {
      setWorkCategory(category);
      setSelectedTemplateId(''); // Clear specific template on category change
      setFormErrors(prev => { // Clear category specific errors on selection
        const newErrors = { ...prev };
        delete newErrors.workCategory;
        delete newErrors.selectedTemplate; // Clear template error too
        return newErrors;
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        setGeneralError("Usuário não autenticado. Por favor, faça login novamente.");
        return;
    }
    
    // Valida o passo final antes de realmente submeter
    if (!validateStep(totalSteps)) return; 

    setLoading(true);
    setGeneralError(''); // Clear general error antes da submissão

    // Timeout safety
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("TIMEOUT")), 15000); // 15 seconds max
    });

    try {
        const workToCreate = {
            userId: user.id,
            name: formData.name,
            address: formData.address || 'Endereço não informado',
            budgetPlanned: Number(formData.budgetPlanned), // Direct conversion from string to number
            startDate: formData.startDate,
            area: Number(formData.area) || 0,
            floors: Number(formData.floors) || 1,
            bedrooms: Number(formData.bedrooms),
            bathrooms: Number(formData.bathrooms),
            kitchens: Number(formData.kitchens),
            livingRooms: Number(formData.livingRooms),
            hasLeisureArea: formData.hasLeisureArea,
            status: WorkStatus.PLANNING,
            notes: selectedTemplate?.label || ''
        };

        // Call dbService to create work, which also handles step and material generation
        const newWork: any = await Promise.race([
          dbService.createWork(workToCreate, selectedTemplateId),
          timeoutPromise
        ]);

        // NEW: Generate an AI notification for the new work plan summary
        try {
            const aiPlanSummaryPrompt = `Gere um resumo da timeline e dos principais marcos para a obra "${newWork.name}", com ${newWork.area}m², ${newWork.floors} pavimentos, ${newWork.bathrooms} banheiros e ${newWork.kitchens} cozinhas, com início em ${newWork.startDate} e orçamento de R$ ${newWork.budgetPlanned}. Foque nos pontos mais importantes e na duração total estimada.`;
            // CRITICAL FIX: Use mockAiService here
            const aiPlanSummary = await mockAiService.chat(aiPlanSummaryPrompt); // Using chat for a slightly longer summary
            
            // Fix: Call dbService.addNotification with an object conforming to Omit<DBNotification, 'id'>
            await dbService.addNotification({
                userId: user.id,
                workId: newWork.id,
                title: `Plano Inteligente para Obra: ${newWork.name}! (AI OFFLINE)`,
                message: aiPlanSummary, // Will contain the mock message
                date: new Date().toISOString(),
                read: false,
                type: 'SUCCESS',
                tag: `work-plan-summary-${newWork.id}` // Unique tag for this notification
            });
        } catch (aiError) {
            console.error("Erro ao gerar ou salvar notificação AI para novo plano:", aiError);
            // Still proceed with navigation even if AI notification fails
        }
        
        navigate(`/work/${newWork.id}`);
    } catch (error: any) {
        console.error("Erro CREATE:", error);
        setLoading(false);
        
        if (error.message === 'TIMEOUT' || error.message?.includes('Supabase off')) {
            setGeneralError("Erro de conexão. Não foi possível criar sua obra agora. Tente novamente.");
        } else if (error.message?.includes('permission denied')) {
            setGeneralError("Erro de Permissão. Verifique se você está logado corretamente.");
        } else {
            setGeneralError(`Algo não saiu como esperado: ${error.message}. Tente novamente.`);
        }
    } finally {
        setLoading(false);
    }
  };

  const CounterInput = ({ label, field, icon }: { label: string, field: keyof typeof formData, icon: string }) => (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 flex flex-col items-center justify-center shadow-sm group hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors"> {/* OE #004: Increased padding */}
          <div className="text-slate-400 mb-2 group-hover:text-secondary transition-colors text-xl"><i className={`fa-solid ${icon}`}></i></div> {/* OE #004: Increased icon size, margin */}
          <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-3 text-center tracking-wider">{label}</label> {/* OE #004: Increased margin */}
          <div className="flex items-center gap-4 w-full justify-center"> {/* OE #004: Increased gap */}
              <button type="button" onClick={() => handleCounter(field, false)} className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center text-lg" aria-label={`Diminuir ${label.toLowerCase()}`}>-</button> {/* OE #004: Increased size, text size */}
              <span className="min-w-[1.5rem] text-center font-black text-primary dark:text-white text-2xl">{formData[field as keyof typeof formData]}</span> {/* OE #004: Increased text size */}
              <button type="button" onClick={() => handleCounter(field, true)} className="w-9 h-9 rounded-lg bg-primary text-white font-bold hover:bg-primary-light transition-colors shadow-md shadow-primary/20 flex items-center justify-center text-lg" aria-label={`Aumentar ${label.toLowerCase()}`}>+</button> {/* OE #004: Increased size, text size */}
          </div>
      </div>
  );

  // Fix: Implement renderStepContent to conditionally render form steps
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <h2 className="text-3xl font-black text-primary dark:text-white mb-3 tracking-tight text-center">Crie sua Obra!</h2> {/* OE #004: Increased margin */}
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-center mb-10 text-base"> {/* OE #004: Increased margin, text size */}
              Primeiros passos para o seu projeto de sucesso.
            </p>

            <div className="space-y-6"> {/* OE #004: Increased space-y */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 shadow-sm group hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors">
                <div className="w-10 h-10 flex items-center justify-center text-secondary text-2xl">
                    <i className="fa-solid fa-signature"></i>
                </div>
                <div className="flex-1">
                    <label htmlFor="name" className="block text-xs font-bold text-slate-500 uppercase mb-1">Apelido da Obra <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Ex: Reforma da Cozinha, Casa da Praia"
                        className={`w-full bg-transparent text-primary dark:text-white outline-none text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 ${formErrors.name ? 'border-red-500' : ''}`} /* OE #004: Added placeholder styling */
                        required
                        aria-invalid={!!formErrors.name}
                        aria-describedby={formErrors.name ? "name-error" : undefined}
                    />
                    {formErrors.name && <p id="name-error" className="text-red-500 text-sm mt-1">{formErrors.name}</p>} {/* OE #004: Increased text size */}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 shadow-sm group hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors">
                <div className="w-10 h-10 flex items-center justify-center text-secondary text-2xl">
                    <i className="fa-solid fa-ruler-combined"></i>
                </div>
                <div className="flex-1">
                    <label htmlFor="area" className="block text-xs font-bold text-slate-500 uppercase mb-1">Área (m²) <span className="text-red-500">*</span></label>
                    <input
                        type="number" 
                        id="area"
                        name="area"
                        value={formData.area}
                        onChange={handleChange}
                        placeholder="100"
                        min="0"
                        step="0.01"
                        className={`w-full bg-transparent text-primary dark:text-white outline-none text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 ${formErrors.area ? 'border-red-500' : ''}`} /* OE #004: Added placeholder styling */
                        required
                        aria-invalid={!!formErrors.area}
                        aria-describedby={formErrors.area ? "area-error" : undefined}
                    />
                    {formErrors.area && <p id="area-error" className="text-red-500 text-sm mt-1">{formErrors.area}</p>} /* OE #004: Increased text size */
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 shadow-sm group hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors">
                <div className="w-10 h-10 flex items-center justify-center text-secondary text-2xl">
                    <i className="fa-solid fa-dollar-sign"></i>
                </div>
                <div className="flex-1">
                    <label htmlFor="budgetPlanned" className="block text-xs font-bold text-slate-500 uppercase mb-1">Orçamento Previsto (R$) <span className="text-red-500">*</span></label>
                    <input
                        type="number" // Reverted to number
                        id="budgetPlanned"
                        name="budgetPlanned"
                        value={formData.budgetPlanned} 
                        onChange={handleChange}
                        placeholder="50000.00"
                        className={`w-full bg-transparent text-primary dark:text-white outline-none text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 ${formErrors.budgetPlanned ? 'border-red-500' : ''}`} /* OE #004: Added placeholder styling */
                        required
                        aria-invalid={!!formErrors.budgetPlanned}
                        aria-describedby={formErrors.budgetPlanned ? "budgetPlanned-error" : undefined}
                        min="0"
                        step="0.01"
                    />
                    {formErrors.budgetPlanned && <p id="budgetPlanned-error" className="text-red-500 text-sm mt-1">{formErrors.budgetPlanned}</p>} {/* OE #004: Increased text size */}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 shadow-sm group hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors">
                <div className="w-10 h-10 flex items-center justify-center text-secondary text-2xl">
                    <i className="fa-solid fa-location-dot"></i>
                </div>
                <div className="flex-1">
                    <label htmlFor="address" className="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço (Opcional)</label>
                    <input
                        type="text"
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Ex: Rua das Flores, 123"
                        className="w-full bg-transparent text-primary dark:text-white outline-none text-base placeholder:text-gray-400 dark:placeholder:text-gray-500" /* OE #004: Added placeholder styling */
                    />
                </div>
              </div>
            </div>
          </>
        );
      case 2:
        return (
          <>
            <h2 className="text-3xl font-black text-primary dark:text-white mb-3 tracking-tight text-center">Tipo de Obra e Início</h2> {/* OE #004: Increased margin */}
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-center mb-10 text-base"> {/* OE #004: Increased margin, text size */}
              Selecione o tipo de projeto e a data de início.
            </p>

            <div className="space-y-6"> {/* OE #004: Increased space-y */}
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase mb-3">Tipo de Obra <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleCategorySelect('CONSTRUCTION')}
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all shadow-md ${workCategory === 'CONSTRUCTION' ? 'border-secondary bg-secondary/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'}`} /* OE #004: Increased padding */
                    aria-pressed={workCategory === 'CONSTRUCTION'}
                  >
                    <i className="fa-solid fa-house-chimney text-4xl mb-4 text-primary dark:text-white"></i> {/* OE #004: Increased icon size, margin */}
                    <span className="font-black text-primary dark:text-white text-lg">Construção</span> {/* OE #004: Increased text size */}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategorySelect('RENOVATION')}
                    className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all shadow-md ${workCategory === 'RENOVATION' ? 'border-secondary bg-secondary/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'}`} /* OE #004: Increased padding */
                    aria-pressed={workCategory === 'RENOVATION'}
                  >
                    <i className="fa-solid fa-screwdriver-wrench text-4xl mb-4 text-primary dark:text-white"></i> {/* OE #004: Increased icon size, margin */}
                    <span className="font-black text-primary dark:text-white text-lg">Reforma</span> {/* OE #004: Increased text size */}
                  </button>
                </div>
                {formErrors.workCategory && <p className="text-red-500 text-sm mt-1">{formErrors.workCategory}</p>} {/* OE #004: Increased text size */}
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 shadow-sm group hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors">
                <div className="w-10 h-10 flex items-center justify-center text-secondary text-2xl">
                    <i className="fa-solid fa-calendar-alt"></i>
                </div>
                <div className="flex-1">
                    <label htmlFor="startDate" className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Início <span className="text-red-500">*</span></label>
                    <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleChange}
                        className={`w-full bg-transparent text-primary dark:text-white outline-none text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 ${formErrors.startDate ? 'border-red-500' : ''}`} /* OE #004: Added placeholder styling */
                        required
                        aria-invalid={!!formErrors.startDate}
                        aria-describedby={formErrors.startDate ? "startDate-error" : undefined}
                    />
                    {formErrors.startDate && <p id="startDate-error" className="text-red-500 text-sm mt-1">{formErrors.startDate}</p>} {/* OE #004: Increased text size */}
                </div>
              </div>
            </div>
          </>
        );
      case 3: // NEW Step 3
        return (
          <>
            <h2 className="text-3xl font-black text-primary dark:text-white mb-3 tracking-tight text-center">Detalhes do Projeto</h2> {/* OE #004: Increased margin */}
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-center mb-10 text-base"> {/* OE #004: Increased margin, text size */}
              Selecione o tipo específico e adicione detalhes para o Zé da Obra planejar tudo.
            </p>

            <div className="space-y-6"> {/* OE #004: Increased space-y */}
              {workCategory && (
                <div>
                  <label htmlFor="selectedTemplateId" className="block text-sm font-bold text-slate-500 uppercase mb-3">Tipo Específico <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {/* OE #004: Increased gap */}
                    {WORK_TEMPLATES.filter(t => 
                      workCategory === 'CONSTRUCTION' ? t.id === 'CONSTRUCAO' : t.id !== 'CONSTRUCAO'
                    ).map(template => (
                      <button
                        type="button"
                        key={template.id}
                        onClick={() => { setSelectedTemplateId(template.id); setFormErrors(prev => { const newErrors = { ...prev }; delete newErrors.selectedTemplate; return newErrors; }); }}
                        className={`flex items-center p-4 rounded-2xl border-2 transition-all text-left shadow-sm ${selectedTemplateId === template.id ? 'border-secondary bg-secondary/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'}`}
                        aria-pressed={selectedTemplateId === template.id}
                      >
                        <i className={`fa-solid ${template.icon} text-2xl mr-4 text-primary dark:text-white`}></i> {/* OE #004: Increased margin */}
                        <div>
                          <p className="font-bold text-primary dark:text-white text-base">{template.label}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{template.description}</p> {/* OE #004: Increased text size */}
                        </div>
                      </button>
                    ))}
                  </div>
                  {formErrors.selectedTemplate && <p className="text-red-500 text-sm mt-1">{formErrors.selectedTemplate}</p>} {/* OE #004: Increased text size */}
                </div>
              )}

              {needsDetailedInputs && (
                <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-700"> {/* OE #004: Increased margin-top, padding-top */}
                    <h3 className="text-xl font-bold text-primary dark:text-white mb-5">Detalhes Adicionais</h3> {/* OE #004: Increased text size, margin */}
                    <div className="grid grid-cols-2 gap-4">
                        <CounterInput label="Nº de Pavimentos" field="floors" icon="fa-layer-group" />
                        <CounterInput label="Nº de Banheiros" field="bathrooms" icon="fa-toilet" />
                        <CounterInput label="Nº de Cozinhas" field="kitchens" icon="fa-kitchen-set" />
                        <CounterInput label="Nº de Quartos" field="bedrooms" icon="fa-bed" />
                        <CounterInput label="Nº de Salas" field="livingRooms" icon="fa-couch" />
                        {/* Leisure area is a checkbox, not a counter */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 flex flex-col items-center justify-center shadow-sm hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors group"> {/* OE #004: Increased padding */}
                            <div className="text-slate-400 mb-2 group-hover:text-secondary transition-colors text-xl"><i className="fa-solid fa-swimming-pool"></i></div> {/* OE #004: Increased icon size, margin */}
                            <label htmlFor="hasLeisureArea" className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-3 text-center tracking-wider cursor-pointer">Área de Lazer</label> {/* OE #004: Increased margin */}
                            <input
                                type="checkbox"
                                id="hasLeisureArea"
                                name="hasLeisureArea"
                                checked={formData.hasLeisureArea}
                                onChange={handleChange}
                                className="h-6 w-6 rounded border-slate-300 dark:border-slate-600 text-secondary focus:ring-secondary/50"
                            />
                        </div>
                    </div>
                </div>
              )}
            </div>
          </>
        );
      default:
        return null;
    }
  };


  // If AuthContext is still loading, show a simple spinner.
  // This prevents the CreateWork form from flashing prematurely before auth state is known.
  // OE #004: Ensured loading screen is robust and centered.
  if (!isUserAuthFinished || authLoading) { 
    return (
        <div className="flex items-center justify-center min-h-[80vh] text-primary dark:text-white">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
        </div>
    );
  }

  // REMOVED: GENERATION OVERLAY (generationMode block)
  
  return (
    <div className="max-w-2xl mx-auto pb-12 pt-6 px-4">
      <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => { 
                if(currentStep === 1) navigate('/'); 
                else setCurrentStep(prev => prev - 1); 
                setFormErrors({}); 
                setGeneralError(''); 
            }} 
            className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-2 -ml-2 text-xl" /* OE #004: Increased text size */
            aria-label={currentStep === 1 ? "Voltar ao Dashboard" : "Voltar à etapa anterior"}
          >
            <i className="fa-solid fa-arrow-left text-xl"></i>
          </button>
          <div className="flex gap-3" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps}> {/* OE #004: Increased gap */}
              {[1, 2, 3].map(s => ( // UPDATED progress bar for 3 steps
                  <div 
                    key={s} 
                    className={
                      "h-2 rounded-full transition-all duration-500 " + 
                      (s <= currentStep ? "w-10 bg-secondary" : "w-3 bg-slate-200 dark:bg-slate-700")
                    }
                  ></div>
              ))}
          </div>
          <div className="w-6"></div> {/* Placeholder for alignment */}
      </div>

      <form onSubmit={handleSubmit}>
          {generalError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-900 text-red-600 dark:text-red-400 rounded-xl text-base font-bold flex items-center gap-2 animate-in fade-in" role="alert"> {/* OE #004: Increased text size */}
                  <i className="fa-solid fa-triangle-exclamation"></i> {generalError}
              </div>
          )}
          {renderStepContent()}
          
          <div className="mt-10 flex justify-center"> {/* OE #004: Increased margin-top */}
              {currentStep < totalSteps ? (
                  <button 
                    type="button" 
                    onClick={() => { if(validateStep(currentStep)) setCurrentStep(prev => prev + 1); setGeneralError(''); }} 
                    className="px-9 py-4 bg-secondary text-white font-bold rounded-2xl shadow-lg hover:bg-orange-600 transition-all flex items-center gap-3 text-xl" /* OE #004: Increased padding, text size */
                    aria-label="Próxima etapa do formulário"
                  >
                      Próximo <i className="fa-solid fa-arrow-right"></i>
                  </button>
              ) : (
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="px-9 py-4 bg-gradient-gold text-white font-black rounded-2xl shadow-lg hover:shadow-amber-500/30 hover:scale-105 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:scale-100 text-xl" /* OE #004: Increased padding, text size */
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
