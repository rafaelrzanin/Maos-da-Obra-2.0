
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { dbService } from '../services/db.ts';

// Helper para formatar valores monetários (apenas para exibição estática)
const formatCurrency = (value: number | string | undefined): string => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 'R$ 0,00';
  }
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// NEW: Helper para formatar um número para exibição em um input (e.g., "1.250.000,00")
const formatInputReal = (rawNumericString: string): string => {
  if (!rawNumericString) return '';
  const num = parseFloat(rawNumericString);
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// NEW: Helper para parsear uma string formatada (e.g., "1.250.000,00") para um número puro em string (e.g., "1250000.00")
const parseInputReal = (displayString: string): string => {
  if (!displayString) return '';

  let cleaned = displayString.replace(/[^0-9,]/g, '');

  const parts = cleaned.split(',');
  if (parts.length > 2) {
    cleaned = parts.slice(0, -1).join('') + ',' + parts[parts.length - 1];
  }
  
  cleaned = cleaned.replace(',', '.');
  
  const num = parseFloat(cleaned);
  if (isNaN(num)) return '';

  return cleaned.toString();
};


const Profile = () => {
  const { user, refreshUser, authLoading } = useAuth();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setWhatsapp(user.whatsapp || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (password && password !== confirmPassword) {
        setErrorMsg("Senhas não conferem.");
        setLoading(false);
        return;
    }

    try {
        if (!user) throw new Error("Usuário não identificado.");
        
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
        
        await Promise.race([
            dbService.updateUser(user.id, { name, whatsapp }, password || undefined),
            timeoutPromise
        ]);

        await refreshUser();
        setSuccessMsg("Perfil atualizado com sucesso!");
        setPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        console.error("Erro no Profile:", error);
        setErrorMsg(error.message === "Timeout" ? "O servidor demorou para responder, mas seus dados podem ter sido salvos." : `Erro: ${error.message}`);
    } finally {
        setLoading(false);
    }
  };

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-[80vh] text-primary dark:text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl"></i>
    </div>
  );
  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto pb-12 pt-4 px-4 font-sans animate-in fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xl text-slate-500 dark:text-slate-300">
            <i className="fa-solid fa-user"></i>
        </div>
        <div>
            <h1 className="text-2xl font-bold text-primary dark:text-white">Meu Perfil</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie seus dados pessoais e assinatura.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm dark:shadow-card-dark-subtle border border-slate-200 dark:border-slate-800 mb-8">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold">
                {user.name.charAt(0)}
            </div>
            <div>
                <h2 className="text-xl font-bold text-primary dark:text-white">{user.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                    <span className="bg-secondary/10 text-secondary text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border border-secondary/20">
                        {user.plan || 'Gratuito'}
                    </span>
                    {user.subscriptionExpiresAt && (
                        <span className="text-xs text-slate-400">
                            Vence em: {new Date(user.subscriptionExpiresAt).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="profileName" className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                <input 
                    id="profileName"
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    aria-label="Nome Completo"
                />
            </div>
            
            <div>
                <label htmlFor="profileWhatsapp" className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
                <input 
                    id="profileWhatsapp"
                    type="text" 
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                    aria-label="WhatsApp"
                />
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4"> {/* OE #004: Added pt-6 */}
                <h3 className="text-lg font-bold text-primary dark:text-white">Alterar Senha</h3>
                
                {/* REMOVED: "Proteja sua senha..." message as per OE-1 */}
                
                <div>
                    <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Senha</label>
                    <input 
                        id="password"
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                        placeholder="Deixe em branco para não alterar"
                        aria-label="Nova Senha"
                        autoComplete="new-password"
                    />
                </div>
                <div>
                    <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Nova Senha</label>
                    <input 
                        id="confirmPassword"
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all"
                        placeholder="Deixe em branco para não alterar"
                        aria-label="Confirmar Nova Senha"
                        autoComplete="new-password"
                    />
                </div>
            </div>

            {successMsg && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 text-green-600 dark:text-green-400 rounded-xl text-base font-bold flex items-center gap-2 animate-in fade-in" role="status">
                    <i className="fa-solid fa-check-circle"></i> {successMsg}
                </div>
            )}
            {errorMsg && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-xl text-base font-bold flex items-center gap-2 animate-in fade-in" role="alert">
                    <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
                </div>
            )}

            <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                aria-label="Salvar Alterações do Perfil"
            >
                {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>} Salvar Alterações
            </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
