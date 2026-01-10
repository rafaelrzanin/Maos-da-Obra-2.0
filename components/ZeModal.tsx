

import React from 'react';
import { ZE_AVATAR, ZE_AVATAR_FALLBACK } from '../services/standards.ts';

export interface ZeModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string; // Made optional
  cancelText?: string; // Made optional
  type?: 'DANGER' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  // Fix: Allow onConfirm to accept an optional React.FormEvent
  onConfirm?: (e?: React.FormEvent) => Promise<void>; 
  // FIX: Allow onCancel to accept an optional event argument to match onClick signature
  onCancel: (e?: React.FormEvent) => void; 
  isConfirming?: boolean; // NEW: To disable confirm button during async ops
  // Add children prop explicitly
  children?: React.ReactNode; 
}

export const ZeModal: React.FC<ZeModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Confirmar", // Default to "Confirmar" for actions
  cancelText = "Cancelar", 
  type = 'INFO', // Default to INFO
  // Fix: Changed default onConfirm to accept an optional event argument
  onConfirm = async (_e?: React.FormEvent) => {}, 
  // FIX: Changed default onCancel to accept an optional event argument
  onCancel = (_e?: React.FormEvent) => {},
  isConfirming = false, // NEW: Default to false
  children // Destructure children
}) => {
  if (!isOpen) return null;
  
  const isDangerOrWarning = type === 'DANGER' || type === 'WARNING' || type === 'ERROR';
  // A modal é um "alerta simples" se não há uma ação real de `onConfirm` definida,
  // ou seja, se o `onConfirm` passado é o default no-op e o texto é "Entendido".
  // Ou se o type é 'ERROR' (transformado em alerta de erro)
  const isSimpleAlert = (onConfirm.toString() === (async () => {}).toString() && confirmText === "Entendido") || type === 'ERROR';

  // O handler do botão principal será onConfirm se não for um alerta simples,
  // ou onCancel se for um alerta simples (para fechar o modal).
  // Fix: Ensure primaryButtonHandler can accept event if onConfirm takes it
  const primaryButtonHandler = isSimpleAlert ? onCancel : onConfirm;
  const primaryButtonText = isSimpleAlert ? "Entendido" : confirmText;


  // Determine background color for the message box based on type
  let messageBoxBgClass = 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';
  if (type === 'DANGER') {
    messageBoxBgClass = 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900 text-red-800 dark:text-red-200';
  } else if (type === 'WARNING') {
    messageBoxBgClass = 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-200';
  } else if (type === 'SUCCESS') {
    messageBoxBgClass = 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900 text-green-800 dark:text-green-200';
  } else if (type === 'ERROR') {
    messageBoxBgClass = 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900 text-red-800 dark:text-red-200';
  }


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-white/20 transform scale-100 transition-all relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Glow Effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        {/* Content wrapper without padding, now just acting as a flex container for header, body, footer */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0"> {/* Added min-h-0 here */}
            {/* Header with its own padding and bottom border */}
            <div className="flex gap-5 py-6 px-6 shrink-0 border-b border-slate-100 dark:border-slate-800">
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
                    <h3 className="text-xl font-bold text-primary dark:text-white leading-tight mb-1">Atenção</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
                </div>
            </div>
            
            {/* Scrollable content area (no direct padding here) */}
            {children ? (
                <div className="flex-1 overflow-y-auto min-h-0"> 
                    {/* Inner div for padding */}
                    <div className="py-4 px-6">
                        {children}
                    </div>
                </div>
            ) : (
                <div className={`flex-1 overflow-y-auto min-h-0`}> 
                    {/* Inner div for padding and message box styles */}
                    <div className={`py-4 px-6 p-4 rounded-2xl text-sm leading-relaxed border ${messageBoxBgClass}`}>
                        <p>{message}</p>
                    </div>
                </div>
            )}

            {/* Footer with its own padding and top border */}
            <div className="flex flex-col gap-3 pt-6 px-6 shrink-0 border-t border-slate-100 dark:border-slate-800">
                <button 
                    // Fix: Pass an optional event object to primaryButtonHandler
                    onClick={(e) => primaryButtonHandler(e)} 
                    disabled={isConfirming} // NEW: Disable button while confirming
                    className={`w-full py-4 rounded-xl text-white font-bold transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isDangerOrWarning ? 'bg-danger hover:bg-red-700 shadow-red-500/20' : 'bg-primary hover:bg-slate-800 shadow-slate-500/20'}`}
                >
                    {isConfirming ? <i className="fa-solid fa-circle-notch fa-spin"></i> : primaryButtonText} {/* NEW: Show spinner */}
                </button>
                {!isSimpleAlert && ( // Only show cancel button if it's not a simple alert
                    <button 
                        onClick={(e) => onCancel(e)} // FIX: Pass event to onCancel
                        disabled={isConfirming} // NEW: Disable cancel button too
                        className="w-full py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
