
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/db';
import { WORK_TEMPLATES, ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards';
import { WorkStatus } from '../types';

const CreateWork: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2; // Simplified to 2 steps for better UX
  const [loading, setLoading] = useState(false);
  
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleCounter = (field: keyof typeof formData, increment: boolean) => {
      setFormData(prev => {
          const currentVal = Number(prev[field]);
          const newVal = increment ? currentVal + 1 : Math.max(0, currentVal - 1);
          if (field === 'floors' && newVal < 1) return prev;
          return { ...prev, [field]: String(newVal) };
      });
  };

  const validateStep = (step: number) => {
    if (step === 1) {
       if (!formData.name.trim()) { alert("Por favor, dê um apelido para sua obra."); return false; }
       if (!formData.budgetPlanned) { alert("Quanto você pretende gastar (mesmo que seja um chute)?"); return false; }
    }
    return true;
  };

  const handleCategorySelect = (category: 'CONSTRUCTION' | 'RENOVATION') => {
      setWorkCategory(category);
      if (category === 'CONSTRUCTION') setSelectedTemplateId('CONSTRUCAO');
      else setSelectedTemplateId('');
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!validateStep(currentStep)) return;
    
    // Validate Step 2 specific
    if (!workCategory) { alert("Escolha entre Construção ou Reforma."); return; }
    if (!selectedTemplateId) { alert("Selecione o tipo específico da obra."); return; }
    if (!formData.startDate) { alert("Qual a data de início?"); return; }

    setLoading(true);
    setGenerationMode(true); // Activate overlay

    // Timeout safety
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("TIMEOUT")), 15000); // 15 seconds max
    });

    try {
        const duration = selectedTemplate?.defaultDurationDays || 90;
        const start = new Date(formData.startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + duration);

        // Start Creation Process
        const createPromise = dbService.createWork({
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
            alert("Erro de conexão ou Banco de Dados não configurado. Verifique se você criou as tabelas no Supabase.");
        } else if (error.message?.includes('permission denied')) {
            alert("Erro de Permissão. Verifique se você está logado corretamente.");
        } else {
            alert(`Erro ao salvar: ${error.message}`);
        }
    }
  };

  const CounterInput = ({ label, field, icon }: { label: string, field: keyof typeof formData, icon: string }) => (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-3 flex flex-col items-center justify-center shadow-sm hover:border-secondary/50 dark:hover:border-secondary/50 transition-colors group">
          <div className="text-slate-400 mb-1 group-hover:text-secondary transition-colors text-lg"><i className={`fa-solid ${icon}`}></i></div>
          <label className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase mb-2 text-center tracking-wider">{label}</label>
          <div className="flex items-center gap-3 w-full justify-center">
              <button type="button" onClick={() => handleCounter(field, false)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center">-</button>
              <span className="min-w-[1.5rem] text-center font-black text-primary dark:text-white text-xl">{formData[field as keyof typeof formData]}</span>
              <button type="button" onClick={() => handleCounter(field, true)} className="w-8 h-8 rounded-lg bg-primary text-white font-bold hover:bg-primary-light transition-colors shadow-md shadow-primary/20 flex items-center justify-center">+</button>
          </div>
      </div>
  );

  // GENERATION OVERLAY
  if (generationMode) {
      return (
          <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
              <div className="relative mb-8">
                  <div className="w-32 h-32 rounded-full border-4 border-slate-800 flex items-center justify-center relative z-10 bg-slate-900">
                      <img src={ZE_AVATAR} className="w-24 h-24 rounded-full border-2 border-slate-700 object-cover" onError={(e) => e.currentTarget.src = ZE_AVATAR_FALLBACK}/>
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
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Nome ou Apelido da Obra</label>
                                <input name="name" autoFocus placeholder="Ex: Reforma da Cozinha..." value={formData.name} className="w-full px-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300" onChange={handleChange} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Tamanho (m²)</label>
                                    <input name="area" type="number" placeholder="0" value={formData.area} className="w-full px-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300" onChange={handleChange} />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Orçamento (R$)</label>
                                    <input name="budgetPlanned" type="number" placeholder="0,00" value={formData.budgetPlanned} className="w-full px-5 py-4 text-lg font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300" onChange={handleChange} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Endereço <span className="text-slate-400 font-medium normal-case tracking-normal">(Opcional)</span></label>
                                <input name="address" placeholder="Cidade ou bairro" value={formData.address} className="w-full px-5 py-4 text-base font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300" onChange={handleChange} />
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
                                <button type="button" onClick={() => handleCategorySelect('CONSTRUCTION')} className="relative p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-secondary hover:bg-white dark:hover:bg-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col items-center gap-5 group">
                                    <div className="w-20 h-20 rounded-full bg-secondary text-white flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform"><i className="fa-solid fa-trowel-bricks"></i></div>
                                    <div><h3 className="font-black text-xl text-primary dark:text-white mb-1">Construção</h3><p className="text-sm font-bold text-slate-400">Do zero (Terreno Vazio)</p></div>
                                </button>
                                <button type="button" onClick={() => handleCategorySelect('RENOVATION')} className="relative p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-secondary hover:bg-white dark:hover:bg-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col items-center gap-5 group">
                                    <div className="w-20 h-20 rounded-full bg-secondary text-white flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform"><i className="fa-solid fa-paint-roller"></i></div>
                                    <div><h3 className="font-black text-xl text-primary dark:text-white mb-1">Reforma</h3><p className="text-sm font-bold text-slate-400">Melhoria ou Reparo</p></div>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            }
            return (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                            <div><h2 className="text-2xl font-black text-primary dark:text-white mb-1 tracking-tight">{workCategory === 'CONSTRUCTION' ? 'Estrutura' : 'Tipo de Reforma'}</h2><p className="text-slate-500 dark:text-slate-400 text-sm font-bold">{workCategory === 'CONSTRUCTION' ? 'Detalhe os cômodos.' : 'Selecione o modelo.'}</p></div>
                            <button onClick={() => setWorkCategory(null)} className="text-xs font-black uppercase tracking-wider text-secondary hover:underline bg-secondary/5 px-3 py-1.5 rounded-lg transition-colors"><i className="fa-solid fa-rotate-left mr-1"></i> Mudar</button>
                        </div>
                        {workCategory === 'RENOVATION' && (
                             <div className="grid grid-cols-2 gap-4 mb-8">
                                {WORK_TEMPLATES.filter(t => t.id !== 'CONSTRUCAO').map(template => (
                                    <button key={template.id} type="button" onClick={() => setSelectedTemplateId(template.id)} className={`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col gap-3 group ${selectedTemplateId === template.id ? 'border-secondary bg-secondary/5 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-secondary/50'}`}>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-colors ${selectedTemplateId === template.id ? 'bg-secondary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:text-secondary'}`}><i className={`fa-solid ${template.icon}`}></i></div>
                                        <div><h3 className={`font-black text-sm mb-1 ${selectedTemplateId === template.id ? 'text-primary dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{template.label}</h3><p className="text-[10px] font-bold text-slate-400 leading-tight">{template.description}</p></div>
                                    </button>
                                ))}
                            </div>
                        )}
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
                                         <input type="checkbox" name="hasLeisureArea" checked={formData.hasLeisureArea} onChange={handleChange} className="hidden" />
                                         <span className="text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-white transition-colors">Possui área de lazer / piscina?</span>
                                     </label>
                                 </div>
                             </div>
                        )}
                        
                        <div>
                            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase mb-2 tracking-widest pl-1">Data de Início</label>
                            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="w-full px-5 py-4 text-base font-bold border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" />
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
          <button onClick={() => currentStep === 1 ? navigate('/') : setCurrentStep(prev => prev - 1)} className="text-slate-400 hover:text-primary dark:hover:text-white transition-colors"><i className="fa-solid fa-arrow-left text-xl"></i></button>
          <div className="flex gap-2">
              {[1, 2].map(s => (
                  <div key={s} className={`h-2 rounded-full transition-all duration-500 ${s <= currentStep ? 'w-8 bg-secondary' : 'w-2 bg-slate-200 dark:bg-slate-700'}`}></div>
              ))}
          </div>
          <div className="w-6"></div>
      </div>

      <form onSubmit={handleSubmit}>
          {renderStepContent()}
          
          <div className="mt-8 flex justify-end">
              {currentStep < totalSteps ? (
                  <button type="button" onClick={() => { if(validateStep(currentStep)) setCurrentStep(prev => prev + 1); }} className="px-8 py-4 bg-primary text-white font-bold rounded-2xl shadow-lg hover:bg-primary-light transition-all flex items-center gap-3">
                      Próximo <i className="fa-solid fa-arrow-right"></i>
                  </button>
              ) : (
                  <button type="submit" disabled={loading} className="px-8 py-4 bg-gradient-gold text-white font-bold rounded-2xl shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-70 disabled:scale-100">
                      {loading ? 'Gerando...' : 'Criar Obra'} <i className="fa-solid fa-check"></i>
                  </button>
              )}
          </div>
      </form>
    </div>
  );
};

export default CreateWork;

