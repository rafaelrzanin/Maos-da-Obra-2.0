

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';
import { supabase } from '../services/supabase.ts'; // Import supabase directly
import { type DBNotification } from '../types.ts';

const Notifications: React.FC = () => {
  const { user, authLoading, isUserAuthFinished, refreshNotifications } = useAuth();
  const [allNotifications, setAllNotifications] = useState<DBNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRead, setFilterRead] = useState<'all' | 'unread'>('unread');

  const loadNotifications = useCallback(async () => {
    if (!user?.id || !isUserAuthFinished || authLoading) return;

    setLoading(true);
    try {
      // Fetch all notifications, including read ones, for this dedicated page
      const { data, error } = await supabase // Use imported supabase directly
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) {
        console.error("Erro ao buscar todas as notificações:", error);
        setAllNotifications([]);
      } else {
        setAllNotifications(data || []);
      }
      refreshNotifications(); // Ensure AuthContext's count is up-to-date
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
      setAllNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [user, isUserAuthFinished, authLoading, refreshNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleDismissNotification = async (notificationId: string) => {
    await dbService.dismissNotification(notificationId);
    await loadNotifications(); // Reload to reflect changes
  };

  const handleClearAllNotifications = async () => {
    if (user?.id && window.confirm("Tem certeza que deseja marcar TODAS as notificações como lidas?")) {
      await dbService.clearAllNotifications(user.id);
      await loadNotifications(); // Reload to reflect changes
    }
  };

  const filteredNotifications = allNotifications.filter(n => 
    filterRead === 'all' || !n.read
  );

  const parseDateDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (loading || authLoading) return (
    <div className="flex items-center justify-center min-h-[70vh] text-primary dark:text-white">
      <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-12 pt-4 px-4 font-sans animate-in fade-in">
      <h1 className="text-3xl font-black text-primary dark:text-white mb-6 tracking-tight">Suas Notificações</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-2xl mb-8">
        Aqui você encontra todos os alertas e informações importantes sobre suas obras.
      </p>

      <div className="flex items-center justify-between mb-6 bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterRead('unread')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterRead === 'unread' ? 'bg-secondary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            Não Lidas
          </button>
          <button
            onClick={() => setFilterRead('all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${filterRead === 'all' ? 'bg-secondary text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            Todas
          </button>
        </div>
        <button
          onClick={handleClearAllNotifications}
          className="text-sm font-bold text-slate-500 hover:text-red-500 transition-colors"
          disabled={allNotifications.filter(n => !n.read).length === 0}
        >
          Marcar todas como lidas
        </button>
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center text-slate-400 py-10 italic text-lg">
            {filterRead === 'unread' ? 'Nenhuma notificação não lida. Tudo certo por aqui!' : 'Nenhuma notificação encontrada.'}
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border ${notification.read ? 'border-slate-200 dark:border-slate-800' : 'border-secondary/50 dark:border-amber-700/50 ring-1 ring-secondary/20'} flex items-start gap-4 transition-all`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shrink-0 ${
                notification.type === 'WARNING' ? 'bg-amber-500' :
                notification.type === 'ERROR' ? 'bg-red-500' :
                notification.type === 'SUCCESS' ? 'bg-green-500' :
                'bg-primary'
              }`}>
                <i className={`fa-solid ${
                  notification.type === 'WARNING' ? 'fa-triangle-exclamation' :
                  notification.type === 'ERROR' ? 'fa-exclamation-circle' :
                  notification.type === 'SUCCESS' ? 'fa-check-circle' :
                  'fa-info-circle'
                }`}></i>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-primary dark:text-white text-lg leading-tight">{notification.title}</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">{notification.message}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                  <span><i className="fa-regular fa-clock mr-1"></i> {parseDateDisplay(notification.date)}</span>
                  {notification.workId && <span><i className="fa-solid fa-house-chimney-crack mr-1"></i> Obra ID: {notification.workId.substring(0, 8)}...</span>}
                </div>
              </div>
              {!notification.read && (
                <button
                  onClick={() => handleDismissNotification(notification.id)}
                  className="px-3 py-1 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary-dark transition-colors shrink-0"
                >
                  Marcar como lida
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
