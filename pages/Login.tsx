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
    <div className="flex min-h-screen w-full bg-surface dark:bg-black relative overflow-hidden font-sans">
      
      {/* MOBILE BACKGROUND (Premium Dark Gradient) */}
      <div className="absolute inset-0 lg:hidden bg-gradient-premium z-0">
          <div className="absolute top-[-20%] right-[-20%] w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-primary-light/40 rounded-full blur-[80px]"></div>
      </div>

      {/* LEFT SIDE (Desktop Visual) */}
      <div className="hidden lg:flex w-5/12 bg-gradient-premium relative overflow-hidden flex-col justify-between p-16 text-white z-10 border-r border-white/5">
          {/* Decorative Orbs */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
          
          {/* Logo Area */}
          <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-gold rounded-2xl flex items-center justify-center shadow-glow">
                  <i className="fa-solid fa-helmet-safety text-white text-xl"></i>
              </div>
              <div>
                  <h1 className="font-extrabold text-2xl tracking-tight leading-none">MÃOS DA<br/>OBRA</h1>
              </div>
          </div>

          {/* Hero Copy */}
          <div className="relative z-10 max-w-md">
              <div className="inline-block px-3 py-1 mb-6 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
                  <span className="text-xs font-bold text-secondary tracking-widest uppercase">Versão 2.0 Premium</span>
              </div>
              <h2 className="text-5xl font-bold leading-tight mb-6 tracking-tight">
                  Construa com <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-yellow-200">Maestria.</span>
              </h2>
              <p className="text-lg text-slate-300 leading-relaxed font-light border-l-2 border-secondary pl-6">
                  Gestão profissional de obras simplificada para proprietários exigentes. Cronograma, custos e materiais em um só lugar.
              </p>
          </div>

          {/* Footer Info */}
          <div className="relative z-10 flex items-center gap-6 text-xs font-medium text-slate-500 uppercase tracking-widest">
              <span>© 2024 Mãos da Obra Inc.</span>
              <div className="h-1 w-1 rounded-full bg-slate-600"></div>
              <span>Privacidade & Termos</span>
          </div>
      </div>

      {/* RIGHT SIDE (Form) */}
      <div className="w-full lg:w-7/12 flex flex-col justify-center items-center p-6 lg:p-20 relative z-10">
          
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white dark:bg-slate-900 shadow-lg flex items-center justify-center text-slate-400 hover:text-secondary transition-colors"
          >
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>

          {/* Floating Card Container */}
          <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-8 lg:p-10 rounded-[2.5rem] shadow-2xl border border-white/50 dark:border-white/5 animate-in fade-in slide-in-from-bottom-8 duration-700">
              
              {/* Mobile Logo */}
              <div className="lg:hidden flex flex-col items-center mb-10">
                  <div className="w-16 h-16 bg-gradient-gold rounded-2xl flex items-center justify-center text-white text-2xl mb-4 shadow-glow">
                      <i className="fa-solid fa-helmet-safety"></i>
                  </div>
                  <h1 className="text-2xl font-extrabold text-white tracking-tight">MÃOS DA OBRA</h1>
              </div>

              <div className="mb-10 text-center lg:text-left">
                  <h2 className="text-3xl font-bold text-primary dark:text-white mb-2 tracking-tight">
                      {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400">
                      {isLogin ? 'Acesse o painel de controle da sua obra.' : 'Comece a economizar tempo e dinheiro hoje.'}
                  </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {!isLogin && (
                    <div className="group animate-in fade-in slide-in-from-top-2">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <i className="fa-regular fa-user text-slate-400 group-focus-within:text-secondary transition-colors"></i>
                            </div>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nome Completo"
                                className="block w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-primary dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all outline-none"
                            />
                        </div>
                    </div>
                  )}

                  <div className="group">
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                              <i className="fa-regular fa-envelope text-slate-400 group-focus-within:text-secondary transition-colors"></i>
                          </div>
                          <input 
                              type="email" 
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="Seu melhor e-mail"
                              className="block w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-primary dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all outline-none"
                          />
                      </div>
                  </div>

                  {!isLogin && (
                     <div className="group animate-in fade-in slide-in-from-top-2">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                <i className="fa-brands fa-whatsapp text-slate-400 group-focus-within:text-secondary transition-colors"></i>
                            </div>
                            <input 
                                type="tel" 
                                value={whatsapp}
                                onChange={(e) => setWhatsapp(e.target.value)}
                                placeholder="WhatsApp (Opcional)"
                                className="block w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-primary dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all outline-none"
                            />
                        </div>
                    </div>
                  )}

                  <div className="group">
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                              <i className="fa-solid fa-lock text-slate-400 group-focus-within:text-secondary transition-colors"></i>
                          </div>
                          <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Sua senha secreta"
                              className="block w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-primary dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-secondary/20 focus:border-secondary transition-all outline-none"
                          />
                      </div>
                  </div>

                  {isLogin && (
                      <div className="flex justify-end">
                          <a href="#" className="text-xs font-bold text-secondary hover:text-secondary-dark transition-colors">Esqueceu a senha?</a>
                      </div>
                  )}

                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 bg-gradient-gold hover:bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/25 transform active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg disabled:opacity-70 disabled:cursor-wait mt-4"
                  >
                      {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : (isLogin ? 'Acessar Painel' : 'Criar Conta Grátis')}
                      {!loading && <i className="fa-solid fa-arrow-right"></i>}
                  </button>

              </form>

              <div className="relative my-10">
                  <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                      <span className="bg-white dark:bg-slate-900 px-4 text-slate-400">Ou entre com</span>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <button 
                      onClick={() => handleSocialLogin('google')} 
                      className="flex items-center justify-center gap-3 h-14 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:-translate-y-1 shadow-sm"
                  >
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                      <span className="text-sm font-bold text-slate-700 dark:text-white">Google</span>
                  </button>

                  <button 
                      onClick={() => handleSocialLogin('apple')} 
                      className="flex items-center justify-center gap-3 h-14 rounded-2xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-all hover:-translate-y-1 shadow-lg"
                  >
                      <i className="fa-brands fa-apple text-xl mb-1"></i>
                      <span className="text-sm font-bold">Apple</span>
                  </button>
              </div>

              <p className="text-center mt-10 text-sm text-slate-500 dark:text-slate-400">
                  {isLogin ? 'Ainda não tem conta?' : 'Já possui cadastro?'}
                  <button 
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-2 font-bold text-primary dark:text-white hover:text-secondary dark:hover:text-secondary transition-colors underline decoration-secondary decoration-2 underline-offset-4"
                  >
                      {isLogin ? 'Cadastre-se' : 'Faça Login'}
                  </button>
              </p>
          </div>

          <div className="mt-8 text-center opacity-50">
               <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Demo: demo@maos.com / (sem senha)</p>
          </div>
      </div>
    </div>
  );
};

export default Login;