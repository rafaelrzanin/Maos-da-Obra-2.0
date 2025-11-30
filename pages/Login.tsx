
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
    <div className="flex min-h-screen w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative lg:overflow-hidden">
      
      {/* BACKGROUND FOR MOBILE (Gradient + Blobs) */}
      <div className="absolute inset-0 lg:hidden bg-gradient-to-br from-[#0F2933] to-[#1E3A45] z-0">
          <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[200px] h-[200px] bg-[#3B7C8C]/20 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* LEFT SIDE - BRAND VISUAL (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#0F2933] to-[#1E3A45] relative overflow-hidden flex-col justify-between p-12 text-white z-10">
          {/* Abstract Pattern */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#3B7C8C]/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
          
          {/* Logo Area */}
          <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                  <i className="fa-solid fa-helmet-safety text-white"></i>
              </div>
              <span className="font-bold text-xl tracking-wide">MÃOS DA OBRA</span>
          </div>

          {/* Hero Text */}
          <div className="relative z-10 max-w-lg mb-20">
              <h1 className="text-5xl font-bold leading-tight mb-6">
                  Construa seu sonho <br/>
                  <span className="text-[#8AD6E9]">sem pesadelos.</span>
              </h1>
              <p className="text-lg text-slate-300 leading-relaxed">
                  A ferramenta definitiva para quem quer controle total sobre cronograma, orçamento e materiais. Simples, visual e profissional.
              </p>
              
              <div className="mt-8 flex items-center gap-4">
                  <div className="flex -space-x-3">
                      <div className="w-10 h-10 rounded-full border-2 border-[#1E3A45] bg-slate-200 flex items-center justify-center overflow-hidden">
                         <i className="fa-solid fa-user text-slate-400 mt-2"></i>
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-[#1E3A45] bg-slate-300 flex items-center justify-center overflow-hidden">
                         <i className="fa-solid fa-user text-slate-500 mt-2"></i>
                      </div>
                      <div className="w-10 h-10 rounded-full border-2 border-[#1E3A45] bg-slate-400 flex items-center justify-center overflow-hidden">
                         <i className="fa-solid fa-user text-slate-600 mt-2"></i>
                      </div>
                  </div>
                  <div className="text-sm font-medium">
                      <span className="block text-white">Mais de 10.000 obras</span>
                      <span className="text-slate-400">gerenciadas com sucesso.</span>
                  </div>
              </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 text-xs text-slate-500">
              © 2024 Mãos da Obra Inc. Todos os direitos reservados.
          </div>
      </div>

      {/* RIGHT SIDE - FORM CONTAINER */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-4 lg:p-6 relative z-10">
          
          {/* Theme Toggle (Absolute) */}
          <button 
            onClick={toggleTheme}
            className="absolute top-6 right-6 w-10 h-10 rounded-full lg:bg-slate-100 lg:dark:bg-slate-800 bg-white/10 backdrop-blur-md text-white lg:text-slate-500 lg:dark:text-slate-400 hover:text-primary transition-colors flex items-center justify-center border border-white/10 lg:border-transparent z-50"
          >
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>

          {/* MAIN CARD (White on Mobile, Transparent on Desktop) */}
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700 bg-white dark:bg-slate-900 lg:bg-transparent lg:dark:bg-transparent p-8 lg:p-0 rounded-3xl shadow-2xl lg:shadow-none">
              
              {/* Mobile Header Logo */}
              <div className="lg:hidden text-center mb-8">
                  <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-primary/30">
                      <i className="fa-solid fa-helmet-safety text-2xl"></i>
                  </div>
                  <h1 className="text-xl font-bold text-primary dark:text-white tracking-wide">MÃOS DA OBRA</h1>
              </div>

              <div className="text-center lg:text-left mb-8">
                  <h2 className="text-3xl font-bold text-text-main dark:text-white mb-2 tracking-tight">
                      {isLogin ? 'Bem-vindo de volta' : 'Comece sua jornada'}
                  </h2>
                  <p className="text-text-muted dark:text-slate-400">
                      {isLogin ? 'Entre para gerenciar sua obra.' : 'Crie sua conta em segundos. É grátis.'}
                  </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {!isLogin && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-xs font-bold text-text-main dark:text-slate-300 uppercase mb-1.5 ml-1">Nome Completo</label>
                        <div className="relative group">
                            <i className="fa-regular fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"></i>
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Seu nome"
                                className="w-full h-14 pl-11 pr-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-text-main dark:text-white placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                  )}

                  <div>
                      <label className="block text-xs font-bold text-text-main dark:text-slate-300 uppercase mb-1.5 ml-1">E-mail</label>
                      <div className="relative group">
                          <i className="fa-regular fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"></i>
                          <input 
                              type="email" 
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="seu@email.com"
                              className="w-full h-14 pl-11 pr-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-text-main dark:text-white placeholder:text-slate-400"
                          />
                      </div>
                  </div>

                  {!isLogin && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <label className="block text-xs font-bold text-text-main dark:text-slate-300 uppercase mb-1.5 ml-1">WhatsApp</label>
                        <div className="relative group">
                            <i className="fa-brands fa-whatsapp absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"></i>
                            <input 
                                type="tel" 
                                value={whatsapp}
                                onChange={(e) => setWhatsapp(e.target.value)}
                                placeholder="(00) 00000-0000"
                                className="w-full h-14 pl-11 pr-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-text-main dark:text-white placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                  )}

                  <div>
                      <div className="flex justify-between items-center mb-1.5 ml-1">
                          <label className="block text-xs font-bold text-text-main dark:text-slate-300 uppercase">Senha</label>
                          {isLogin && <a className="text-xs font-medium text-primary hover:underline cursor-pointer">Esqueceu?</a>}
                      </div>
                      <div className="relative group">
                          <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors"></i>
                          <input 
                              type="password" 
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full h-14 pl-11 pr-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-text-main dark:text-white placeholder:text-slate-400"
                          />
                      </div>
                  </div>

                  <button 
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl shadow-xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-wait text-lg"
                  >
                      {loading && <i className="fa-solid fa-circle-notch fa-spin"></i>}
                      {isLogin ? 'Entrar Agora' : 'Criar Minha Conta'}
                  </button>

              </form>

              <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white dark:bg-slate-900 px-4 text-slate-400">Ou continue com</span>
                  </div>
              </div>

              {/* PREMIUM SOCIAL BUTTONS */}
              <div className="grid grid-cols-2 gap-4">
                  {/* Google Button */}
                  <button 
                      onClick={() => handleSocialLogin('google')} 
                      className="group flex items-center justify-center gap-3 h-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                  >
                      <i className="fa-brands fa-google text-xl text-slate-700 dark:text-white group-hover:text-red-500 transition-colors"></i>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">Google</span>
                  </button>

                  {/* Apple Button */}
                  <button 
                      onClick={() => handleSocialLogin('apple')} 
                      className="group flex items-center justify-center gap-3 h-14 rounded-xl bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-200 text-white dark:text-black transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  >
                      <i className="fa-brands fa-apple text-xl mb-0.5 transition-transform group-hover:scale-110"></i>
                      <span className="text-sm font-bold">Apple</span>
                  </button>
              </div>

              <p className="text-center mt-8 text-sm text-text-muted dark:text-slate-400">
                  {isLogin ? 'Novo por aqui?' : 'Já tem uma conta?'}
                  <button 
                    onClick={() => setIsLogin(!isLogin)}
                    className="ml-2 font-bold text-primary hover:underline transition-all"
                  >
                      {isLogin ? 'Crie uma conta' : 'Fazer Login'}
                  </button>
              </p>

              {isLogin && (
                  <div className="mt-8 text-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      <p className="text-xs text-slate-500">Conta de teste: <strong className="text-slate-700 dark:text-slate-300">demo@maos.com</strong> (sem senha)</p>
                  </div>
              )}
          </div>
          
          {/* Mobile Footer Text */}
          <div className="lg:hidden mt-8 text-center opacity-60">
              <p className="text-[10px] text-white/70">Mãos da Obra Inc © 2024</p>
          </div>
      </div>
    </div>
  );
};

export default Login;
