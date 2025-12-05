import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { dbService } from '../services/db';

const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  
  // Password State
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setWhatsapp(user.whatsapp || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    if (!user) return;

    // Validate Password
    if (newPass) {
      if (newPass !== confirmPass) {
        alert("As senhas não coincidem.");
        return;
      }
      if (newPass.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
    }

    setLoading(true);
    try {
      await dbService.updateUser(user.id, { name, whatsapp }, newPass || undefined);
      await refreshUser();
      setSuccessMsg("Perfil atualizado com sucesso!");
      setNewPass('');
      setConfirmPass('');
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar perfil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-12 pt-4 px-4 font-sans">
      <h1 className="text-2xl font-bold text-text-main dark:text-white mb-2">Configurações</h1>
      <p className="text-text-muted dark:text-slate-400 mb-8">Gerencie seus dados e segurança.</p>

      <form onSubmit={handleSave} className="space-y-8">
        
        {/* PERSONAL DATA */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-user text-secondary"></i> Meus Dados
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-text-main dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail (Login)</label>
              <input 
                type="email" 
                value={email} 
                disabled
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
              <input 
                type="tel" 
                value={whatsapp} 
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-text-main dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* SECURITY */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-lg font-bold text-primary dark:text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-lock text-secondary"></i> Segurança
          </h2>
          <p className="text-xs text-slate-500 mb-4">Preencha apenas se quiser alterar sua senha.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nova Senha</label>
              <input 
                type="password" 
                value={newPass} 
                onChange={e => setNewPass(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-text-main dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Nova Senha</label>
              <input 
                type="password" 
                value={confirmPass} 
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="Repita a senha"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-text-main dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </div>

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
          Salvar Alterações
        </button>

      </form>
    </div>
  );
};

export default Profile;
