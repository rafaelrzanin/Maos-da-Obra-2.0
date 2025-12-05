import React, { useState, useEffect } from 'react';
import { useAuth, useTheme } from '../App';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/db';

const Login: React.FC = () => {
  const { login, signup, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isLogin) {
      const success = await login(email, password);
      if (!success) alert('Falha ao entrar. Verifique seus dados.');
    } else {
      if (!name) { alert('Preciso saber seu nome.'); setLoading(false); return; }
      await signup(name, email, whatsapp, password);
    }
    setLoading(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    const socialEmail = provider === 'google' ? 'usuario.google@gmail.com' : 'usuario.apple@icloud.com';
    const socialName = provider === 'google' ? 'Usuário Google' : 'Usuário Apple';
    
    setLoading(true);
    const existingUser = await dbService.login(socialEmail);
    if (existingUser) {
      await login(socialEmail);
    } else {
      await signup(socialName, socialEmail);
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans flex items-center justify-center p-4">
      
      {/* 1. BACKGROUND LAYER (Cinematic Photo) */}
      <div className="absolute inset-0 z-0">
          {/* High-end architectural dark background */}
          <img 
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop" 
            className="w-full h-full object-cover animate-[pulse_10s_ease-in-out_infinite_alternate] scale-105"
            alt="Luxury Background"
          />
          {/* Sophisticated Overlay (Gradient from Black to Transparent) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-slate-900/80 to-slate-900/60 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
      </div>

      {/* Theme Toggle (Absolute Top Right) */}
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
      >
        <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
      </button>

      {/* 2. GLASS CONTENT WRAPPER */}
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-700">
          
          {/* Logo Header - Floating above the glass */}
          <div className="text-center mb-8 flex flex-col items-center drop-shadow-2xl">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center text-white text-3xl mb-4 shadow-[0_0_30px_rgba(217,119,6,0.6)] transform rotate-6 border-2 border-white/20 ring-4 ring-black/20">
                  <i className="fa-solid fa-helmet-safety"></i>
              </div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none">
                  MÃOS DA <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-400">OBRA</span>
              </h1>
              <p className="text-white/60 text-xs font-bold uppercase tracking-[0.3em] mt-2">Premium Edition</p>
          </div>

          {/* 3. THE GLASS CARD (Vitrificação) */}
          <div className="backdrop-blur-xl bg-white/10 dark:bg-black/30 border border-white/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
              
              {/* Shine Effect on Glass */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50"></div>
              <div className="absolute -top-[100px] -left-[100px] w-[200px] h-[200px] bg-white/5 rounded-full blur-[50px] pointer-events-none"></div>

              <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-white mb-1">
                      {isLogin ? 'Bem-vindo de volta' : 'Criar Conta Exclusiva'}
                  </h2>
                  <p className="text-sm text-slate-300">
                      {isLogin ? 'Gerencie sua obra com maestria.' : 'Comece a construir seu sonho.'}
                  </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {!isLogin && (
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="fa-solid fa-user text-white/40 group-focus-within:text-amber-400 transition-colors"></i>
                        </div>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nome Completo"
                            className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 focus:bg-black/40 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        />
                    </div>
                  )}

                  <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <i className="fa-solid fa-envelope text-white/40 group-focus-within:text-amber-400 transition-colors"></i>
                      </div>
                      <input 
                          type="email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="E-mail"
                          className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 focus:bg-black/40 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                      />
                  </div>

                  {!isLogin && (
                     <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <i className="fa-brands fa-whatsapp text-white/40 group-focus-within:text-amber-400 transition-colors"></i>
                        </div>
                        <input 
                            type="tel" 
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            placeholder="WhatsApp"
                            className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 focus:bg-black/40 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                        />
                    </div>
                  )}

                  <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <i className="fa-solid fa-lock text-white/40 group-focus-within:text-amber-400 transition-colors"></i>
                      </div>
                      <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Senha"
                          className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/30 focus:bg-black/40 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all outline-none"
                      />
                  </div>

                  {isLogin && (
                      <div className="flex justify-end">
                          <a href="#" className="text-xs font-bold text-white/60 hover:text-white transition-colors">Esqueceu a senha?</a>
                      </div>
                  )}

                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-900/30 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-white/10 disabled:opacity-70 disabled:cursor-wait"
                  >
                      {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (isLogin ? 'Entrar Agora' : 'Cadastrar Grátis')}
                      {!loading && <i className="fa-solid fa-arrow-right"></i>}
                  </button>

                  {/* Divider */}
                  <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10"></div>
                      </div>
                      <div className="relative flex justify-center">
                          <span className="bg-transparent px-2 text-[10px] text-white/40 uppercase tracking-widest bg-slate-900/50 backdrop-blur-sm rounded-full">Ou entre com</span>
                      </div>
                  </div>

                  {/* Social Login - Glass Style */}
                  <div className="grid grid-cols-2 gap-3">
                      <button 
                          onClick={() => handleSocialLogin('google')} 
                          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all hover:-translate-y-0.5"
                      >
                          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="Google" />
                          <span className="text-xs font-bold">Google</span>
                      </button>

                      <button 
                          onClick={() => handleSocialLogin('apple')} 
                          className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all hover:-translate-y-0.5"
                      >
                          <i className="fa-brands fa-apple text-sm"></i>
                          <span className="text-xs font-bold">Apple</span>
                      </button>
                  </div>
              </form>
          </div>
          
          {/* Footer Text */}
          <div className="text-center mt-6">
              <p className="text-sm text-white/50">
                  {isLogin ? 'Não tem conta?' : 'Já é membro?'}
                  <button 
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-2 font-bold text-amber-400 hover:text-amber-300 transition-colors underline decoration-amber-400/50 underline-offset-4"
                  >
                      {isLogin ? 'Criar conta' : 'Fazer Login'}
                  </button>
              </p>
          </div>

      </div>
    </div>
  );
};

export default Login;
