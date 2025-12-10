import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { dbService } from '../services/db';
import { WORK_TEMPLATES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards';

const CreateWork: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [loading, setLoading] = useState(false);
  const [aiProcessingStage, setAiProcessingStage] = useState<string | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    budgetPlanned: '',
    area: '',
    floors: '1',
    startDate: new Date().toISOString().split('T')[0],
    // New Detailed Fields
    bedrooms: '3',
    bathrooms: '2',
    kitchens: '1',
    livingRooms: '1',
    hasLeisureArea: false
  });

  // Template Logic
  const [workCategory, setWorkCategory] = useState<'CONSTRUCTION' | 'RENOVATION' | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  
  // Helper to determine if we need detailed room inputs
  const needsDetailedInputs = workCategory === 'CONSTRUCTION' || selectedTemplateId === 'REFORMA_APTO';

  const selectedTemplate = WORK_TEMPLATES.find(t => t.id === selectedTemplateId);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleCounter = (field: keyof typeof formData, increment: boolean) => {
      setFormData(prev => {
          const currentVal = Number(prev[field]);
          const newVal = increment ? currentVal + 1 : Math.max(0, currentVal - 1);
          // Special case for floors, min 1
          if (field === 'floors' && newVal < 1) return prev;
          return { ...prev, [field]: String(newVal) };
      });
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

  const simulateAiProcessing = async () => {
      const messages = [
          "Conectando com a base de engenharia...",
          `Analisando dimensões (${formData.area}m²) e estrutura...`,
          `Calculando materiais para ${formData.bathrooms} banheiros...`,
          "Otimizando cronograma físico-financeiro...",
          "Validando etapas da obra...",
          "Gerando plano mestre..."
      ];

      for (const msg of messages) {
          setAiProcessingStage(msg);
          // Varia o tempo para parecer "pensando"
          await new Promise(r => setTimeout(r, 800 + Math.random() * 800));
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateStep(currentStep)) return;

    setLoading(true);

    try {
        await simulateAiProcessing();

        // Calculate end date based on template duration
        const duration = selectedTemplate?.defaultDurationDays || 90;
        const start = new Date(formData.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + duration);

        const newWork = await dbService.createWork({
          userId: user.id,
          name: formData.name,
          address: formData.address || 'Endereço não informado',
          budgetPlanned: Number(formData.budgetPlanned),
          startDate: formData.startDate,
          endDate: end.toISOString().split('T')[0],
          area: Number(formData.area) || 0,
          floors: Number(formData.floors) || 1,
          bedrooms: Number(formData.bedrooms),
          bathrooms: Number(formData.bathrooms),
          kitchens: Number(formData.kitchens),
          livingRooms: Number(formData.livingRooms),
          hasLeisureArea: formData.hasLeisureArea,
          notes: selectedTemplate?.label || ''
        }, selectedTemplateId);

        navigate(`/work/${newWork.id}`);
    } catch (error) {
        console.error(error);
        setAiProcessingStage(null); 
        alert("Ops! Ocorreu um erro técnico ao salvar. Tente novamente em instantes.");
    } finally {
        setLoading(false);
    }
  };

  const CounterInput = ({ label, field, icon }: { label: string, field: keyof typeof formData, icon: string }) => (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-4 flex flex-col items-center justify-center shadow-lg hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors group">
          <div className="text-slate-400 mb-2 group-hover:text-secondary transition-colors text-xl"><i className={`fa-solid ${icon}`}></i></div>
          <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-3 text-center tracking-wider">{label}</label>
          <div className="flex items-center gap-3 w-full justify-center">
              <button type="button" onClick={() => handleCounter(field, false)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors border border-slate-200 dark:border-slate-600 shadow-sm text-xl flex items-center justify-center pb-1">-</button>
              <span className="min-w-[2rem] text-center font-black text-primary dark:text-white text-2xl">{formData[field as keyof typeof formData]}</span>
              <button type="button" onClick={() => handleCounter(field, true)} className="w-10 h-10 rounded-xl bg-primary text-white font-bold hover:bg-primary-light transition-colors shadow-md shadow-primary/20 text-xl flex items-center justify-center pb-1">+</button>
          </div>
      </div>
  );

  // AI Loading Overlay ("Notoriety")
  if (aiProcessingStage) {
      return (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-premium p-6 text-white animate-in fade-in duration-500">
              <div className="relative mb-10 scale-125">
                  <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-secondary to-orange-500 animate-pulse relative z-10">
                      <img 
                        src={ZE_AVATAR} 
                        alt="Zé" 
                        className="w-full h-full object-cover rounded-full border-4 border-slate-900 bg-slate-800"
                        onError={(e) => { 
                            const target = e.currentTarget;
                            if (target.src !== ZE_AVATAR_FALLBACK) {
                                target.src = ZE_AVATAR_FALLBACK;
                            }
                        }}
                      />
                  </div>
                  {/* Glow Effect */}
                  <div className="absolute inset-0 bg-secondary rounded-full blur-2xl opacity-40 animate-ping"></div>
              </div>
              
              <h2 className="text-3xl font-black mb-6 text-center tracking-tight animate-in slide-in-from-bottom-2">
                  Engenheiro Virtual
              </h2>
              
              <div className="w-full max-w-xs mb-8">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                      <div className="h-full bg-secondary animate-progress-indeterminate"></div>
                  </div>
              </div>
              
              <div className="h-8 flex items-center justify-center">
                  <p className="text-xl font-medium text-slate-300 text-center animate-pulse transition-all duration-300">
                      {aiProcessingStage}
                  </p>
              </div>
          </div>
      );
  }

  // Step Content Renderer
  const renderStepContent = () => {
    switch(currentStep) {
        case 1:
            return (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-800">
                        <h2 className="text-2xl font-black text-primary dark:text-white mb-2 tracking-tight">O Básico</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Primeiro, vamos dar um nome e definir as metas.</p>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Nome ou Apelido da Obra</label>
                                <input 
                                  name="name" 
                                  autoFocus
                                  placeholder="Ex: Reforma da Cozinha..."
                                  value={formData.name}
                                  className="w-full px-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
                                  onChange={handleChange}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1 min-h-[1rem]">Tamanho (m²)</label>
                                    <div className="relative">
                                        <input 
                                        name="area" 
                                        type="number" 
                                        placeholder="0"
                                        value={formData.area}
                                        className="w-full px-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
                                        onChange={handleChange}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none">m²</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1 min-h-[1rem]">Orçamento (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">R$</span>
                                        <input 
                                            name="budgetPlanned" 
                                            type="number" 
                                            placeholder="0,00"
                                            value={formData.budgetPlanned}
                                            className="w-full pl-10 pr-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Endereço <span className="text-slate-400 font-medium normal-case tracking-normal">(Opcional)</span></label>
                                <input 
                                  name="address" 
                                  placeholder="Cidade ou bairro"
                                  value={formData.address}
                                  className="w-full px-5 py-4 text-base font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
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
                    <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-800 text-center">
                            <h2 className="text-2xl font-black text-primary dark:text-white mb-2 tracking-tight">Tipo de Projeto</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Escolha a categoria principal da sua obra.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <button
                                    type="button"
                                    onClick={() => handleCategorySelect('CONSTRUCTION')}
                                    className="relative p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-secondary hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center gap-5 group"
                                >
                                    <div className="w-20 h-20 rounded-full bg-secondary text-white flex items-center justify-center text-3xl shadow-xl shadow-secondary/30 group-hover:scale-110 transition-transform duration-500">
                                        <i className="fa-solid fa-trowel-bricks"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl text-primary dark:text-white mb-1">Construção</h3>
                                        <p className="text-sm font-bold text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300">Do zero (Terreno Vazio)</p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleCategorySelect('RENOVATION')}
                                    className="relative p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-secondary hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center gap-5 group"
                                >
                                    <div className="w-20 h-20 rounded-full bg-secondary text-white flex items-center justify-center text-3xl shadow-xl shadow-secondary/30 group-hover:scale-110 transition-transform duration-500">
                                        <i className="fa-solid fa-paint-roller"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl text-primary dark:text-white mb-1">Reforma</h3>
                                        <p className="text-sm font-bold text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300">Melhoria ou Reparo</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }

            // LEVEL 2: SPECIFIC SELECTION
            return (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white mb-1 tracking-tight">
                                    {workCategory === 'CONSTRUCTION' ? 'Estrutura' : 'Tipo de Reforma'}
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-bold">
                                    {workCategory === 'CONSTRUCTION' ? 'Detalhe os cômodos para o cálculo.' : 'Selecione o modelo mais próximo.'}
                                </p>
                            </div>
                            <button onClick={() => setWorkCategory(null)} className="text-xs font-black uppercase tracking-wider text-secondary hover:underline bg-secondary/5 px-3 py-1.5 rounded-lg transition-colors">
                                <i className="fa-solid fa-rotate-left mr-1"></i> Mudar
                            </button>
                        </div>

                        {/* If Renovation, show Grid of options */}
                        {workCategory === 'RENOVATION' && (
                             <div className="grid grid-cols-2 gap-4 mb-8">
                                {WORK_TEMPLATES.filter(t => t.id !== 'CONSTRUCAO').map(template => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col gap-3 group ${
                                            selectedTemplateId === template.id 
                                            ? 'border-secondary bg-secondary/5 ring-2 ring-secondary/20 shadow-lg dark:bg-secondary/10' 
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50 hover:shadow-lg'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-colors ${selectedTemplateId === template.id ? 'bg-secondary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:text-secondary'}`}>
                                            <i className={`fa-solid ${template.icon}`}></i>
                                        </div>
                                        <div>
                                            <h3 className={`font-black text-sm mb-1 ${selectedTemplateId === template.id ? 'text-primary dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{template.label}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 leading-tight">{template.description}</p>
                                        </div>
                                        {selectedTemplateId === template.id && <div className="absolute top-3 right-3 text-secondary"><i className="fa-solid fa-circle-check text-xl"></i></div>}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {/* Enhanced Details Form (For Construction OR Full Renovation) */}
                        {needsDetailedInputs && (
                             <div className="mb-8 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                 {workCategory === 'CONSTRUCTION' && (
                                     <div className="p-5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                                         <div className="flex items-center gap-4 mb-4">
                                             <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary text-xl">
                                                <i className="fa-solid fa-layer-group"></i>
                                             </div>
                                             <div>
                                                 <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-wide">Pavimentos</h3>
                                                 <p className="text-xs font-bold text-slate-400">Quantos andares terá a obra?</p>
                                             </div>
                                         </div>
                                         <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                             <label className="text-xs font-black text-slate-500 uppercase ml-3">Quantidade</label>
                                             <div className="flex items-center gap-3">
                                                 <button type="button" onClick={() => handleCounter('floors', false)} className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-white font-bold hover:bg-slate-200 transition-colors text-lg">-</button>
                                                 <span className="w-8 text-center font-black text-xl text-primary dark:text-white">{formData.floors}</span>
                                                 <button type="button" onClick={() => handleCounter('floors', true)} className="w-10 h-10 rounded-lg bg-primary text-white font-bold hover:bg-primary-light transition-colors text-lg shadow-md shadow-primary/20">+</button>
                                             </div>
                                         </div>
                                     </div>
                                 )}

                                 <div className="grid grid-cols-2 gap-4">
                                     <CounterInput label="Quartos" field="bedrooms" icon="fa-bed" />
                                     <CounterInput label="Banheiros" field="bathrooms" icon="fa-bath" />
                                     <CounterInput label="Cozinhas" field="kitchens" icon="fa-kitchen-set" />
                                     <CounterInput label="Salas" field="livingRooms" icon="fa-couch" />
                                 </div>

                                 <div 
                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between group ${formData.hasLeisureArea ? 'bg-secondary/5 border-secondary shadow-md dark:bg-secondary/10' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-secondary/50'}`} 
                                    onClick={() => setFormData({...formData, hasLeisureArea: !formData.hasLeisureArea})}
                                 >
                                     <div className="flex items-center gap-4">
                                         <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-colors ${formData.hasLeisureArea ? 'bg-secondary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                             <i className="fa-solid fa-umbrella-beach"></i>
                                         </div>
                                         <div>
                                             <h3 className={`font-black text-sm uppercase tracking-wide ${formData.hasLeisureArea ? 'text-primary dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>Área de Lazer</h3>
                                             <p className="text-xs font-bold text-slate-400">Piscina ou Churrasqueira</p>
                                         </div>
                                     </div>
                                     <div className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${formData.hasLeisureArea ? 'bg-secondary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                         <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-300 ${formData.hasLeisureArea ? 'translate-x-6' : ''}`}></div>
                                     </div>
                                 </div>
                             </div>
                        )}

                        <div>
                            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Data de Início</label>
                            <input 
                                name="startDate" 
                                type="date" 
                                required 
                                value={formData.startDate}
                                className="w-full px-5 py-4 text-base font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white dark:focus:bg-slate-900 outline-none transition-all shadow-inner"
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>
            );
        case 3:
            return (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-secondary to-orange-500 shadow-xl">
                                <img src={ZE_AVATAR} alt="Zé" className="w-full h-full object-cover rounded-full bg-slate-800 border-2 border-white" onError={(e) => { e.currentTarget.src = ZE_AVATAR_FALLBACK; }} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-primary dark:text-white leading-tight">Engenheiro Virtual</h2>
                                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Pronto para calcular sua obra.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* The "Magic" Box */}
                            <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/30 group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-secondary/30 transition-colors"></div>
                                
                                <div className="relative z-10">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-list-check text-secondary"></i>
                                        Resumo do Projeto
                                    </h3>
                                    
                                    <div className="space-y-3 mb-6">
                                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                            <span className="text-slate-400 text-sm">Projeto</span>
                                            <span className="font-bold">{formData.name}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                            <span className="text-slate-400 text-sm">Tipo</span>
                                            <span className="font-bold">{needsDetailedInputs ? 'Construção' : selectedTemplate?.label}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/10 pb-2">
                                            <span className="text-slate-400 text-sm">Área Total</span>
                                            <span className="font-bold">{formData.area} m²</span>
                                        </div>
                                        {needsDetailedInputs && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                <span className="bg-white/10 text-xs px-3 py-1 rounded-full">{formData.floors} Pavimentos</span>
                                                <span className="bg-white/10 text-xs px-3 py-1 rounded-full">{formData.bedrooms} Quartos</span>
                                                <span className="bg-white/10 text-xs px-3 py-1 rounded-full">{formData.bathrooms} Banhos</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-start gap-3">
                                        <i className="fa-solid fa-wand-magic-sparkles text-secondary mt-1"></i>
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            Vou utilizar inteligência artificial para estimar a quantidade de tijolos, cimento e o tempo necessário para cada etapa.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        default: return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-12 pt-6 px-4 font-sans">
      <button onClick={() => navigate('/')} className="mb-6 text-slate-400 hover:text-primary dark:hover:text-white font-black uppercase text-xs tracking-widest flex items-center gap-2 transition-colors">
        <i className="fa-solid fa-arrow-left"></i> Cancelar
      </button>
      
      <div className="mb-8">
          <div className="flex flex-col gap-2 mb-4">
            <span className="w-fit px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-black uppercase tracking-widest border border-secondary/20">
                Passo {currentStep} de {totalSteps}
            </span>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                {currentStep === 1 ? 'Nova Obra' : currentStep === 2 ? 'Configuração' : 'Resumo Inteligente'}
            </h1>
          </div>
          
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
             <div 
                className="bg-gradient-to-r from-secondary to-orange-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(217,119,6,0.5)]" 
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
             ></div>
          </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {renderStepContent()}

        <div className="flex gap-4 pt-2">
           {currentStep > 1 && (
             <button 
                type="button" 
                onClick={prevStep}
                disabled={loading}
                className="flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-sm uppercase tracking-wide py-5 rounded-2xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 disabled:opacity-50 shadow-sm"
             >
                Voltar
             </button>
           )}
           
           {currentStep === 2 && !workCategory ? null : (
               currentStep < totalSteps ? (
                 <button 
                    type="button" 
                    onClick={nextStep}
                    className="flex-1 bg-primary hover:bg-primary-dark text-white font-black text-sm uppercase tracking-wide py-5 rounded-2xl transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0"
                 >
                    Continuar <i className="fa-solid fa-arrow-right"></i>
                 </button>
               ) : (
                <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black text-sm uppercase tracking-wide py-5 rounded-2xl transition-all shadow-xl shadow-green-600/30 flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:cursor-wait"
                >
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Gerar Obra com IA
                </button>
               )
           )}
        </div>

      </form>
    </div>
  );
};

export default CreateWork;
