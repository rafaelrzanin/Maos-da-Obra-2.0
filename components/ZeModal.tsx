
import React from 'react';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

export interface ZeModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string; // Made optional
  cancelText?: string; // Made optional
  type?: 'DANGER' | 'INFO' | 'SUCCESS' | 'WARNING'; // Added WARNING for consistency
  onConfirm?: () => void; // Made optional
  onCancel: () => void; // Still required as the primary way to close
}

export const ZeModal: React.FC<ZeModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Entendido", // Default to "Entendido" for all simple cases
  cancelText = "Cancelar", 
  type = 'INFO', // Default to INFO
  onConfirm, 
  onCancel 
}) => {
  if (!isOpen) return null;
  
  const isDangerOrWarning = type === 'DANGER' || type === 'WARNING';
  const isSimpleAlert = !onConfirm; 

  const finalConfirmText = isSimpleAlert ? "Entendido" : confirmText;
  const confirmButtonHandler = isSimpleAlert ? onCancel : onConfirm;

  // These are not used directly as the user explicitly asked to NOT change UI/UX/aesthetics,
  // and the existing layout within ZeModal uses a fixed style for the info block.
  // Kept here for potential future flexibility without violating current rules.
  /*
  let iconClass = 'fa-solid fa-info-circle text-blue-600';
  let bgColorClass = 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900 text-blue-800 dark:text-blue-200';

  if (type === 'DANGER') {
    iconClass = 'fa-solid fa-triangle-exclamation text-red-600';
    bgColorClass = 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900 text-red-800 dark:text-red-200';
  } else if (type === 'WARNING') {
    iconClass = 'fa-solid fa-exclamation-triangle text-amber-600';
    bgColorClass = 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-200';
  } else if (type === 'SUCCESS') {
    iconClass = 'fa-solid fa-check-circle text-green-600';
    bgColorClass = 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900 text-green-800 dark:text-green-200';
  }
  */

  // Determine background color for the message box based on type
  let messageBoxBgClass = 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';
  if (type === 'DANGER') {
    messageBoxBgClass = 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900 text-red-800 dark:text-red-200';
  } else if (type === 'WARNING') {
    messageBoxBgClass = 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-200';
  } else if (type === 'SUCCESS') {
    messageBoxBgClass = 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900 text-green-800 dark:text-green-200';
  }


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
                <div className="flex-1">
                    {/* The original structure had h3 "Atenção" and p "{title}". 
                        To keep consistency and address the user's request for no layout changes,
                        we'll maintain this structure, using `title` as the subtitle. */}
                    <h3 className="text-xl font-bold text-primary dark:text-white leading-tight mb-1">Atenção</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                </div>
            </div>
            
            <div className={`mb-8 p-4 rounded-2xl text-sm leading-relaxed border ${messageBoxBgClass}`}>
                <p>{message}</p>
            </div>

            <div className="flex flex-col gap-3">
                <button 
                    onClick={() => confirmButtonHandler && confirmButtonHandler()} 
                    className={`w-full py-4 rounded-xl text-white font-bold transition-all shadow-lg active:scale-[0.98] ${isDangerOrWarning ? 'bg-danger hover:bg-red-700 shadow-red-500/20' : 'bg-primary hover:bg-slate-800 shadow-slate-500/20'}`}
                >
                    {finalConfirmText}
                </button>
                {!isSimpleAlert && ( 
                    <button 
                        onClick={onCancel} 
                        className="w-full py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                        {cancelText}
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
