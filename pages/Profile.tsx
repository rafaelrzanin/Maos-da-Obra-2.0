
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dbService } from '../services/db';

const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
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
        
        // Timeout para evitar travamento eterno
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

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
            </div>
            
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
                <input 
                    type="text" 
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Alterar Senha</h3>
                <div className="p-3 mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                    <i className="fa-solid fa-info-circle mr-2"></i>
                    A senha é protegida pelo sistema de autenticação e não fica visível.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Senha</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Deixe em branco para manter"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Senha</label>
                        <input 
                            type="password" 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repita a nova senha"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-primary dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                </div>
            </div>

            {errorMsg && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in">
                    <i className="fa-solid fa-triangle-exclamation"></i> {errorMsg}
                </div>
            )}
            
            {successMsg && (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-300 rounded-xl flex items-center gap-2 animate-in fade-in">
                <i className="fa-solid fa-check-circle"></i> {successMsg}
            </div>
            )}

            <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
            {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-save"></i>}
            {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;

