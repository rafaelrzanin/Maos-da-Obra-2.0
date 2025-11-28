
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { dbService } from '../services/db';
import { Work, Notification } from '../types';

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

  useEffect(() => {
    const loadDashboard = async () => {
        if (user) {
            setLoading(true);
            const data = await dbService.getWorks(user.id);
            setWorks(data);

            if (data.length > 0) {
                const currentWork = data[0];
                setFocusWork(currentWork);
                
                // Fetch all stats async
                const [workStats, summary, notifs] = await Promise.all([
                    dbService.calculateWorkStats(currentWork.id),
                    dbService.getDailySummary(currentWork.id),
                    dbService.getNotifications(user.id)
                ]);

                setStats(workStats);
                setDailySummary(summary);
                setNotifications(notifs);

                // Run smart check (fire and forget)
                dbService.generateSmartNotifications(user.id, currentWork.id);
            }
            setLoading(false);
        }
    };
    loadDashboard();
  }, [user]);

  if (loading) return (
      <div className="flex items-center justify-center h-screen text-primary">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
      </div>
  );

  // EMPTY STATE
  if (!focusWork) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
                <i className="fa-solid fa-helmet-safety text-4xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-text-main dark:text-white mb-2">Bem-vindo ao Mãos da Obra!</h2>
            <p className="text-text-muted dark:text-slate-400 max-w-md mb-8">
                Estou aqui para te ajudar a economizar e não ter dor de cabeça com sua obra. Vamos começar?
            </p>
            <button 
                onClick={() => navigate('/create')}
                className="bg-primary hover:bg-primary-dark text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-primary/30 transition-all flex items-center gap-3"
            >
                <i className="fa-solid fa-plus"></i> Começar minha primeira obra
            </button>
        </div>
      );
  }

  // CALCULATIONS FOR UI
  const budgetUsage = focusWork.budgetPlanned > 0 ? (stats.totalSpent / focusWork.budgetPlanned) * 100 : 0;
  const budgetPercentage = Math.round(budgetUsage);
  
  // UX Logic
  const hasDelay = dailySummary.delayedSteps > 0;
  const isOverBudget = budgetPercentage > 100;
  const isNearBudget = budgetPercentage > 85;
  
  let statusColor = 'bg-primary';
  let statusIcon = 'fa-thumbs-up';
  let statusMessage = 'Tudo correndo bem!';
  
  if (hasDelay || isOverBudget) {
      statusColor = 'bg-danger';
      statusIcon = 'fa-triangle-exclamation';
      statusMessage = 'Atenção necessária hoje';
  } else if (isNearBudget || dailySummary.pendingMaterials > 2) {
      statusColor = 'bg-warning';
      statusIcon = 'fa-circle-exclamation';
      statusMessage = 'Alguns pontos de atenção';
  }

  const isPerfectWeek = !hasDelay && !isOverBudget && stats.progress > 0;

  return (
    <div className="max-w-3xl mx-auto pb-24 pt-4 md:pt-8 px-4 md:px-0 font-sans">
      
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-sm text-text-muted dark:text-slate-400 font-medium mb-1">Olá, {user?.name.split(' ')[0]}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-text-main dark:text-white leading-tight">
                Painel da Obra
            </h1>
          </div>
          {works.length > 1 && (
             <button className="text-sm text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                 Ver outra obra <i className="fa-solid fa-chevron-down ml-1"></i>
             </button>
          )}
      </div>

      {/* DAILY SUMMARY CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 mb-8 overflow-hidden">
          
          <div className="p-6 pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-black/5 shrink-0 ${statusColor}`}>
                          <i className={`fa-solid ${statusIcon}`}></i>
                      </div>
                      <div>
                          <h2 className="text-lg font-bold text-text-main dark:text-white leading-tight mb-1">{statusMessage}</h2>
                          <p className="text-sm text-text-muted dark:text-slate-400 font-medium">{focusWork.name}</p>
                      </div>
                  </div>

                  <button 
                    onClick={() => navigate(`/work/${focusWork.id}`)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-base font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                  >
                    <span>Acessar Minha Obra</span>
                    <i className="fa-solid fa-arrow-right-long mt-0.5"></i>
                  </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  
                  <div 
                    onClick={() => navigate(`/work/${focusWork.id}`)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${hasDelay ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}
                  >
                      <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold uppercase tracking-wider ${hasDelay ? 'text-red-600 dark:text-red-400' : 'text-text-muted dark:text-slate-400'}`}>
                              Tarefas
                          </span>
                          <i className={`fa-solid ${hasDelay ? 'fa-clock text-red-400' : 'fa-list-check text-slate-300'}`}></i>
                      </div>
                      <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-black ${hasDelay ? 'text-red-700 dark:text-red-300' : 'text-text-main dark:text-white'}`}>
                              {hasDelay ? dailySummary.delayedSteps : dailySummary.completedSteps}
                          </span>
                          <span className="text-xs font-medium text-text-body dark:text-slate-400">
                              {hasDelay ? 'atrasadas' : 'concluídas'}
                          </span>
                      </div>
                  </div>

                  <div 
                    onClick={() => navigate(`/work/${focusWork.id}`)}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-primary/30 transition-colors"
                  >
                      <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase tracking-wider">Compras</span>
                          <i className="fa-solid fa-cart-shopping text-slate-300"></i>
                      </div>
                      <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-text-main dark:text-white">
                              {dailySummary.pendingMaterials}
                          </span>
                          <span className="text-xs font-medium text-text-body dark:text-slate-400">
                              pendentes
                          </span>
                      </div>
                  </div>

                  <div className="col-span-2 md:col-span-1 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-text-muted dark:text-slate-400 uppercase tracking-wider">Avanço</span>
                          <i className="fa-solid fa-chart-pie text-slate-300"></i>
                      </div>
                      <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-text-main dark:text-white">
                              {stats.progress}%
                          </span>
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-success" style={{ width: `${stats.progress}%` }}></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isOverBudget ? 'bg-danger' : isNearBudget ? 'bg-warning' : 'bg-primary'}`}></div>
                      <span className="text-sm font-bold text-text-main dark:text-white">Orçamento</span>
                  </div>
                  <span className={`text-xs font-bold ${isOverBudget ? 'text-danger' : 'text-text-muted dark:text-slate-400'}`}>
                      {budgetPercentage}% utilizado
                  </span>
              </div>
              
              <div className="relative h-4 bg-white dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 mb-2">
                   <div 
                      className={`h-full rounded-full transition-all duration-1000 ${isOverBudget ? 'bg-danger' : isNearBudget ? 'bg-warning' : 'bg-primary'}`} 
                      style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                   ></div>
              </div>
              
              <div className="flex justify-between text-xs text-text-muted dark:text-slate-500">
                  <span>Gasto: <strong>R$ {stats.totalSpent.toLocaleString('pt-BR')}</strong></span>
                  <span>Meta: R$ {focusWork.budgetPlanned.toLocaleString('pt-BR')}</span>
              </div>
          </div>
      </div>

      {isPerfectWeek && (
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="absolute top-0 right-0 opacity-10 transform translate-x-4 -translate-y-4">
                  <i className="fa-solid fa-medal text-9xl"></i>
              </div>
              <div className="relative z-10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-yellow-300 text-xl">
                      <i className="fa-solid fa-star"></i>
                  </div>
                  <div>
                    <h3 className="text-base font-bold mb-0.5">Semana perfeita!</h3>
                    <p className="text-purple-100 text-sm leading-tight">
                        Obra no prazo e orçamento controlado. Continue assim! 🎯
                    </p>
                  </div>
              </div>
          </div>
      )}

      <div>
          <h3 className="text-lg font-bold text-text-main dark:text-white mb-4 pl-1 flex items-center gap-2">
              <i className="fa-regular fa-bell"></i> Avisos Importantes
          </h3>
          
          <div className="space-y-3">
              {notifications.length > 0 ? (
                  notifications.map(notif => (
                      <div key={notif.id} className={`p-4 rounded-2xl border flex items-start gap-4 transition-all ${
                          notif.type === 'WARNING' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900' :
                          notif.type === 'ERROR' ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900' :
                          'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      }`}>
                          <div className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              notif.type === 'WARNING' ? 'bg-orange-100 text-orange-600' :
                              notif.type === 'ERROR' ? 'bg-red-100 text-red-600' :
                              'bg-blue-100 text-blue-600'
                          }`}>
                              <i className={`fa-solid ${
                                  notif.type === 'WARNING' ? 'fa-triangle-exclamation' :
                                  notif.type === 'ERROR' ? 'fa-circle-xmark' :
                                  'fa-circle-info'
                              } text-sm`}></i>
                          </div>
                          <div className="flex-1">
                              <h4 className={`text-sm font-bold mb-1 ${
                                  notif.type === 'WARNING' ? 'text-orange-800 dark:text-orange-200' :
                                  notif.type === 'ERROR' ? 'text-red-800 dark:text-red-200' :
                                  'text-text-main dark:text-white'
                              }`}>{notif.title}</h4>
                              <p className="text-sm text-text-body dark:text-slate-400 leading-snug">
                                  {notif.message}
                              </p>
                              <span className="text-[10px] text-text-muted dark:text-slate-500 mt-2 block opacity-70 uppercase font-bold tracking-wider">
                                  {new Date(notif.date).toLocaleDateString('pt-BR')}
                              </span>
                          </div>
                      </div>
                  ))
              ) : (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-dashed border border-slate-200 dark:border-slate-700">
                      <p className="text-text-muted dark:text-slate-400 text-sm">
                          Nenhum aviso urgente. Tudo tranquilo por aqui! 🍃
                      </p>
                  </div>
              )}
          </div>
      </div>

      <button 
        onClick={() => navigate('/create')}
        className="fixed bottom-6 right-6 md:hidden flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all z-50"
        title="Nova Obra"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>add</span>
      </button>

    </div>
  );
};

export default Dashboard;
