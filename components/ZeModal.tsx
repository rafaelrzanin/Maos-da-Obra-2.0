
import React from 'react';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards';

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

export const ZeModal: React.FC<ZeModalProps> = ({ isOpen, title, message, confirmText = "Sim, confirmar", cancelText = "Cancelar", type = 'DANGER', onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  const isDanger = type === 'DANGER';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-white/20 transform scale-100 transition-all relative overflow-hidden">
        {/* Glow Effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10">
            <div className="flex gap-5 mb-6">
                <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-lg shrink-0">
                    <img 
                    src={ZE_AVATAR} 
                    alt="Zeca da Obra" 
                    className="w-full h-full object-cover rounded-full border-2 border-white dark:border-slate-800"
                    onError={(e) => { 
                        const target = e.currentTarget;
                        if (target.src !== ZE_AVATAR_FALLBACK) {
                            target.src = ZE_AVATAR_FALLBACK;
                        }
                    }}
                    />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-primary dark:text-white leading-tight mb-1">Atenção</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                </div>
            </div>
            
            <div className={`mb-8 p-4 rounded-2xl text-sm leading-relaxed border ${isDanger ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900 text-red-800 dark:text-red-200' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                <p>{message}</p>
            </div>

            <div className="flex flex-col gap-3">
                <button 
                    onClick={onConfirm} 
                    className={`w-full py-4 rounded-xl text-white font-bold transition-all shadow-lg active:scale-[0.98] ${isDanger ? 'bg-danger hover:bg-red-700 shadow-red-500/20' : 'bg-primary hover:bg-slate-800 shadow-slate-500/20'}`}
                >
                    {confirmText}
                </button>
                <button 
                    onClick={onCancel} 
                    className="w-full py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    {cancelText}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
