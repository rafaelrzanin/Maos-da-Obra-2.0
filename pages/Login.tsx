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
      
      {/* MOBILE BACKGROUND & BRANDING (Hyper Premium Dark Gradient) */}
      <div className="absolute inset-0 lg:hidden bg-slate-950 z-0">
          <div className="absolute inset-0 bg-gradient-premium opacity-90"></div>
          {/* Animated Orbs */}
          <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-secondary/20 rounded-full blur-[80px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-blue-600/20 rounded-full blur-[60px]"></div>
          
          {/* Texture Overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-soft-light"></div>
      </div>

      {/* MOBILE HEADER (Logo & Name) - Absolute Positioned for Premium Layout */}
      <div className="lg:hidden absolute top-0 left-0 right-0 p-8 pt-16 flex flex-col items-center z-20 animate-in slide-in-from-top-10 duration-700">
          <div className="w-24 h-24 bg-gradient-gold rounded-3xl flex items-center justify-center text-white text-4xl mb-6 shadow-glow transform rotate-3 border border-white/10 ring-4 ring-white/5">
              <i className="fa-solid fa-helmet-safety"></i>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-lg text-center leading-none">
            MÃOS DA<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-200">OBRA</span>
          </h1>
          <div className="flex items-center gap-2 mt-3 opacity-80">
             <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-slate-400"></div>
             <p className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.3em]">Premium Edition</p>
             <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-slate-400"></div>
          </div>
      </div>

      {/* DESKTOP LEFT SIDE (Unchanged) */}
      <div className="hidden lg:flex w-5/12 bg-gradient-premium relative overflow-hidden flex-col justify-between p-16 text-white z-10 border-r border-white/5">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-gold rounded-2xl flex items-center justify-center shadow-glow">
                  <i className="fa-solid fa-helmet-safety text-white text-xl"></i>
              </div>
              <div>
                  <h1 className="font-extrabold text-2xl tracking-tight leading-none">MÃOS DA<br/>OBRA</h1>
              </div>
          </div>

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

          <div className="relative z-10 flex items-center gap-6 text-xs font-medium text-slate-500 uppercase tracking-widest">
              <span>© 2024 Mãos da Obra Inc.</span>
              <div className="h-1 w-1 rounded-full bg-slate-600"></div>
              <span>Privacidade & Termos</span>
          </div>
      </div>

      {/* RIGHT SIDE (Form Container) */}
      <div className="w-full lg:w-7/12 flex flex-col justify-end lg:justify-center items-center p-4 sm:p-6 lg:p-20 relative z-10 h-full">
          
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="absolute top-6 right-6 lg:top-8 lg:right-8 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-white/10 lg:bg-white lg:dark:bg-slate-900 backdrop-blur-md shadow-lg flex items-center justify-center text-white lg:text-slate-400 hover:text-secondary transition-colors border border-white/10 lg:border-none z-30"
          >
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>

          {/* Floating Card Container */}
          <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl p-8 lg:p-10 rounded-t-[2.5rem] lg:rounded-[2.5rem] shadow-2xl border-t lg:border border-white/50 dark:border-white/10 animate-in fade-in slide-in-from-bottom-16 duration-700 relative overflow-hidden mt-[35vh] lg:mt-0">
              
              {/* Top Highlight Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-secondary to-transparent opacity-70"></div>

              <div className="mb-8 text-center lg:text-left">
                  <h2 className="text-2xl lg:text-3xl font-bold text-primary dark:text-white mb-2 tracking-tight">
                      {isLogin ? 'Bem-vindo de volta' : 'Criar Conta Premium'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      {isLogin ? 'Entre para gerenciar sua obra.' : 'Comece a economizar tempo e dinheiro hoje.'}
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
                              placeholder="Seu e-mail principal"
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

              <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                      <span className="bg-white dark:bg-slate-900 px-4 text-slate-400">Ou continue com</span>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <button 
                      onClick={() => handleSocialLogin('google')} 
                      className="flex items-center justify-center gap-3 h-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:-translate-y-0.5 shadow-sm"
                  >
                      <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                      <span className="text-xs font-bold text-slate-700 dark:text-white">Google</span>
                  </button>

                  <button 
                      onClick={() => handleSocialLogin('apple')} 
                      className="flex items-center justify-center gap-3 h-12 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-lg"
                  >
                      <i className="fa-brands fa-apple text-lg mb-0.5"></i>
                      <span className="text-xs font-bold">Apple</span>
                  </button>
              </div>

              <p className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
                  {isLogin ? 'Ainda não tem conta?' : 'Já possui cadastro?'}
                  <button 
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-2 font-bold text-secondary hover:text-orange-600 transition-colors underline decoration-secondary decoration-2 underline-offset-4"
                  >
                      {isLogin ? 'Cadastre-se' : 'Faça Login'}
                  </button>
              </p>
          </div>

          <div className="mt-6 text-center opacity-40 lg:hidden pb-4">
               <p className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Demo: demo@maos.com</p>
          </div>
      </div>
    </div>
  );
};

export default Login;
