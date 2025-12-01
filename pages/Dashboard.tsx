
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { dbService } from '../services/db';
import { Work, Notification } from '../types';
import { ZE_AVATAR } from '../services/standards';
import { ZeModal } from '../components/ZeModal';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [works, setWorks] = useState<Work[]>([]);
  const [focusWork, setFocusWork] = useState<Work | null>(null);
  const [stats, setStats] = useState({ totalSpent: 0, progress: 0, delayedSteps: 0 });
  const [dailySummary, setDailySummary] = useState({ completedSteps: 0, delayedSteps: 0, pendingMaterials: 0, totalSteps: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dropdown State
  const [showWorkSelector, setShowWorkSelector] = useState(false);
  
  // Delete Modal State
  const [zeModal, setZeModal] = useState<{isOpen: boolean, title: string, message: string, workId?: string}>({isOpen: false, title: '', message: ''});

  useEffect(() => {
    const loadDashboard = async () => {
        if (user) {
            setLoading(true);
            const data = await dbService.getWorks(user.id);
            setWorks(data);

            if (data.length > 0) {
                // Default to first work
                handleSwitchWork(data[0]);
            } else {
                setLoading(false);
            }
        }
    };
    loadDashboard();
  }, [user]);

  const handleSwitchWork = async (work: Work) => {
      setFocusWork(work);
      setShowWorkSelector(false);
      setLoading(true);
      
      try {
        const [workStats, summary, notifs] = await Promise.all([
            dbService.calculateWorkStats(work.id),
            dbService.getDailySummary(work.id),
            dbService.getNotifications(user!.id)
        ]);

        setStats(workStats);
        setDailySummary(summary);
        setNotifications(notifs);

        // Run smart check (fire and forget)
        dbService.generateSmartNotifications(user!.id, work.id);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteClick = (e: React.MouseEvent, workId: string, workName: string) => {
      e.stopPropagation(); // Prevent switching work when clicking delete
      setZeModal({
          isOpen: true,
          title: "Apagar Obra",
          message: `Tem certeza, chefe? Ao apagar a obra "${workName}", você perde todo o histórico de gastos, compras e cronograma. Não tem volta!`,
          workId: workId
      });
  };

  const confirmDelete = async () => {
      if (zeModal.workId) {
          await dbService.deleteWork(zeModal.workId);
          
          // Refresh List
          const updatedWorks = works.filter(w => w.id !== zeModal.workId);
          setWorks(updatedWorks);
          setZeModal({isOpen: false, title: '', message: ''});

          // Handle Focus
          if (focusWork && focusWork.id === zeModal.workId) {
              if (updatedWorks.length > 0) {
                  handleSwitchWork(updatedWorks[0]);
              } else {
                  setFocusWork(null);
                  setLoading(false);
              }
          }
      }
  };

  if (loading && !focusWork && works.length === 0) return (
      <div className="flex items-center justify-center h-screen text-secondary">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
  );

  // EMPTY STATE
  if (!focusWork && !loading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
            <div className="w-24 h-24 bg-gradient-gold rounded-[2rem] flex items-center justify-center text-white mb-8 shadow-glow transform rotate-3">
                <i className="fa-solid fa-helmet-safety text-5xl"></i>
            </div>
            <h2 className="text-3xl font-bold text-primary dark:text-white mb-4 tracking-tight">Bem-vindo ao Mãos da Obra</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-10 leading-relaxed">
                Gestão profissional para sua construção. Simples, visual e direto ao ponto. Vamos começar sua primeira obra?
            </p>
            <button 
                onClick={() => navigate('/create')}
                className="bg-primary hover:bg-primary-dark dark:bg-white dark:hover:bg-slate-200 text-white dark:text-primary font-bold py-4 px-10 rounded-2xl shadow-xl transition-all flex items-center gap-3 text-lg"
            >
                <i className="fa-solid fa-plus"></i> Iniciar Projeto
            </button>
        </div>
      );
  }

  if (!focusWork) return null;

  // CALCULATIONS FOR UI
  const budgetUsage = focusWork.budgetPlanned > 0 ? (stats.totalSpent / focusWork.budgetPlanned) * 100 : 0;
  const budgetPercentage = Math.round(budgetUsage);
  
  // UX Logic
  const hasDelay = dailySummary.delayedSteps > 0;
  const isOverBudget = budgetPercentage > 100;
  const isNearBudget = budgetPercentage > 85;
  
  // Dynamic Styles
  let statusGradient = 'from-secondary to-yellow-500'; // Default Gold
  let statusIcon = 'fa-thumbs-up';
  let statusMessage = 'Tudo sob controle';
  
  if (hasDelay || isOverBudget) {
      statusGradient = 'from-red-600 to-red-400';
      statusIcon = 'fa-triangle-exclamation';
      statusMessage = 'Atenção necessária';
  } else if (isNearBudget || dailySummary.pendingMaterials > 2) {
      statusGradient = 'from-orange-500 to-amber-400';
      statusIcon = 'fa-circle-exclamation';
      statusMessage = 'Pontos de atenção';
  }

  return (
    <div className="max-w-4xl mx-auto pb-28 pt-6 px-4 md:px-0 font-sans">
      
      {/* Header Area */}
      <div className="mb-8 flex items-end justify-between relative z-20">
          <div>
            <p className="text-xs text-secondary font-bold uppercase tracking-widest mb-1">Painel de Controle</p>
            <h1 className="text-3xl md:text-4xl font-extrabold text-primary dark:text-white leading-tight tracking-tight">
                Olá, {user?.name.split(' ')[0]}
            </h1>
          </div>
          {works.length > 0 && (
             <div className="relative">
                 <button 
                    onClick={() => setShowWorkSelector(!showWorkSelector)}
                    className="text-sm text-primary dark:text-white font-bold bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-secondary transition-all flex items-center gap-2"
                 >
                     <i className="fa-solid fa-building text-secondary"></i>
                     <span className="max-w-[100px] truncate">{focusWork.name}</span> 
                     <i className={`fa-solid fa-chevron-down text-xs transition-transform ${showWorkSelector ? 'rotate-180' : ''}`}></i>
                 </button>
                 
                 {showWorkSelector && (
                     <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                         <div className="p-3 bg-slate-50 dark:bg-black/20 border-b border-slate-100 dark:border-slate-800">
                             <p className="text-xs font-bold text-slate-500 uppercase">Minhas Obras</p>
                         </div>
                         {works.map(w => (
                             <div
                                key={w.id}
                                className={`w-full px-5 py-4 text-sm font-medium border-b last:border-0 border-slate-50 dark:border-slate-800 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${focusWork.id === w.id ? 'bg-slate-50 dark:bg-slate-800/50' : ''}`}
                                onClick={() => handleSwitchWork(w)}
                             >
                                <span className={`flex-1 truncate ${focusWork.id === w.id ? 'text-secondary font-bold' : 'text-slate-600 dark:text-slate-300'}`}>{w.name}</span>
                                <div className="flex items-center gap-3">
                                    {focusWork.id === w.id && <i className="fa-solid fa-check text-secondary"></i>}
                                    <button 
                                        onClick={(e) => handleDeleteClick(e, w.id, w.name)}
                                        className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-red-100 hover:text-red-500 flex items-center justify-center transition-colors"
                                    >
                                        <i className="fa-solid fa-trash text-xs"></i>
                                    </button>
                                </div>
                             </div>
                         ))}
                         <button
                            onClick={() => navigate('/create')}
                            className="w-full text-left px-5 py-4 text-sm font-bold text-secondary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-3"
                         >
                            <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center">
                                <i className="fa-solid fa-plus text-xs"></i>
                            </div>
                            Nova Obra
                         </button>
                     </div>
                 )}
             </div>
          )}
      </div>
      
      {/* ZÉ DA OBRA TIP (Glassmorphism) */}
      <div className="mb-8 relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 shadow-sm group hover:shadow-md transition-all">
           <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl translate-x-10 -translate-y-10 group-hover:bg-secondary/20 transition-all"></div>
           <div className="flex items-center gap-5 p-5 relative z-10">
                <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-300 dark:from-slate-700 dark:to-slate-800 shrink-0 shadow-inner">
                        <img 
                        src={ZE_AVATAR} 
                        alt="Zé" 
                        className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-900"
                        onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=Ze+Obra&background=0F172A&color=fff'; }}
                        />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-secondary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Dica do Mestre</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 italic">
                        "Nunca pague 100% adiantado para mão de obra. Combine pagamentos semanais conforme o serviço fica pronto!"
                    </p>
                </div>
           </div>
      </div>

      {/* Access Button (Floating CTA) - MOVED HERE */}
      <button 
        onClick={() => navigate(`/work/${focusWork.id}`)}
        className="group w-full mb-8 relative overflow-hidden rounded-2xl bg-primary dark:bg-white text-white dark:text-primary shadow-2xl hover:shadow-glow transition-all active:scale-[0.98]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 dark:bg-primary/10 flex items-center justify-center">
                    <i className="fa-solid fa-arrow-right-to-bracket text-xl"></i>
                </div>
                <div className="text-left">
                    <h3 className="text-lg font-bold">Acessar Minha Obra</h3>
                    <p className="text-xs opacity-70 font-medium">Gerenciar etapas, compras e gastos</p>
                </div>
            </div>
            <i className="fa-solid fa-chevron-right text-xl opacity-50 group-hover:translate-x-1 transition-transform"></i>
        </div>
      </button>

      {/* MAIN HUD (Heads Up Display) */}
      <div className="glass-panel rounded-3xl p-1 shadow-2xl mb-8 relative z-0">
          <div className="bg-white/50 dark:bg-black/40 rounded-[1.4rem] p-6 lg:p-8 backdrop-blur-xl">
              
              {/* Status Header */}
              <div className="flex items-center gap-4 mb-8">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${statusGradient} flex items-center justify-center text-white text-3xl shadow-lg transform -rotate-3`}>
                      <i className={`fa-solid ${statusIcon}`}></i>
                  </div>
                  <div>
                      <h2 className="text-2xl font-bold text-primary dark:text-white leading-tight">{statusMessage}</h2>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">Resumo de hoje</p>
                  </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  {/* Card 1: Tarefas */}
                  <div 
                    onClick={() => navigate(`/work/${focusWork.id}`)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg bg-white dark:bg-slate-800 ${hasDelay ? 'border-red-500/30' : 'border-white/10'}`}
                  >
                      <div className="flex justify-between items-start mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasDelay ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                               <i className="fa-solid fa-list-check"></i>
                          </div>
                          {hasDelay && <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>}
                      </div>
                      <p className="text-3xl font-extrabold text-primary dark:text-white mb-1">
                          {hasDelay ? dailySummary.delayedSteps : dailySummary.completedSteps}
                      </p>
                      <p className={`text-xs font-bold uppercase tracking-wider ${hasDelay ? 'text-red-500' : 'text-slate-500'}`}>
                          {hasDelay ? 'Atrasadas' : 'Concluídas'}
                      </p>
                  </div>

                  {/* Card 2: Compras */}
                  <div 
                    onClick={() => navigate(`/work/${focusWork.id}`)}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg"
                  >
                      <div className="flex justify-between items-start mb-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-secondary flex items-center justify-center">
                               <i className="fa-solid fa-cart-shopping"></i>
                          </div>
                      </div>
                      <p className="text-3xl font-extrabold text-primary dark:text-white mb-1">
                          {dailySummary.pendingMaterials}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Pendentes
                      </p>
                  </div>

                  {/* Card 3: Progresso (Full width on mobile) */}
                  <div className="col-span-2 md:col-span-1 p-5 rounded-2xl bg-gradient-to-br from-primary to-slate-800 text-white shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-3">
                             <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                <i className="fa-solid fa-chart-pie"></i>
                             </div>
                             <span className="font-bold text-lg">{stats.progress}%</span>
                        </div>
                        <div className="h-2 bg-black/20 rounded-full overflow-hidden mb-2">
                             <div className="h-full bg-secondary shadow-[0_0_10px_rgba(217,119,6,0.5)]" style={{ width: `${stats.progress}%` }}></div>
                        </div>
                        <p className="text-[10px] uppercase tracking-wider opacity-70 font-bold">Progresso Geral</p>
                      </div>
                  </div>
              </div>

              {/* Financial Strip */}
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-6 border border-slate-200 dark:border-white/5 relative overflow-hidden">
                  {/* Background Bar */}
                  <div className="absolute bottom-0 left-0 h-1 bg-slate-200 dark:bg-slate-700 w-full"></div>
                  <div className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${isOverBudget ? 'bg-danger shadow-[0_0_15px_red]' : 'bg-success shadow-[0_0_15px_lime]'}`} style={{ width: `${Math.min(budgetPercentage, 100)}%` }}></div>

                  <div className="flex justify-between items-end mb-2 relative z-10">
                      <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Orçamento Utilizado</p>
                          <p className="text-xl font-bold text-primary dark:text-white">
                              R$ {stats.totalSpent.toLocaleString('pt-BR')} 
                              <span className="text-sm font-normal text-slate-400 mx-2">/</span>
                              <span className="text-sm text-slate-400">R$ {focusWork.budgetPlanned.toLocaleString('pt-BR')}</span>
                          </p>
                      </div>
                      <div className={`px-3 py-1 rounded-lg text-sm font-bold ${isOverBudget ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {budgetPercentage}%
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Notifications Section */}
      <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <i className="fa-regular fa-bell"></i> Avisos Recentes
          </h3>
          
          <div className="space-y-3">
              {notifications.length > 0 ? (
                  notifications.map(notif => (
                      <div key={notif.id} className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${
                          notif.type === 'WARNING' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30' :
                          'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}>
                          <div className={`mt-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                              notif.type === 'WARNING' ? 'bg-amber-100 text-amber-600' :
                              'bg-blue-100 text-blue-600'
                          }`}>
                              <i className={`fa-solid ${
                                  notif.type === 'WARNING' ? 'fa-bolt' : 'fa-info'
                              } text-sm`}></i>
                          </div>
                          <div className="flex-1">
                              <h4 className="text-sm font-bold text-primary dark:text-white mb-0.5">{notif.title}</h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug">
                                  {notif.message}
                              </p>
                          </div>
                      </div>
                  ))
              ) : (
                  <div className="text-center py-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                      <p className="text-slate-400 text-sm font-medium">
                          Nenhum aviso urgente. Tudo em paz! 🍃
                      </p>
                  </div>
              )}
          </div>
      </div>

      <button 
        onClick={() => navigate('/create')}
        className="fixed bottom-6 right-6 md:hidden w-16 h-16 rounded-full bg-gradient-gold text-white shadow-2xl flex items-center justify-center z-50 hover:scale-110 transition-transform active:scale-90"
      >
        <i className="fa-solid fa-plus text-2xl"></i>
      </button>

      {/* ZÉ DA OBRA MODAL (DELETE) */}
      <ZeModal 
        isOpen={zeModal.isOpen}
        title={zeModal.title}
        message={zeModal.message}
        confirmText="Sim, apagar obra"
        onConfirm={confirmDelete}
        onCancel={() => setZeModal({isOpen: false, title: '', message: ''})}
      />

    </div>
  );
};

export default Dashboard;
