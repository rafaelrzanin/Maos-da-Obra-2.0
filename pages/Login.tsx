
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
    // In a real app with Supabase, you would call supabase.auth.signInWithOAuth({ provider })
    const socialEmail = provider === 'google' ? 'usuario.google@gmail.com' : 'usuario.apple@icloud.com';
    const socialName = provider === 'google' ? 'Usuário Google' : 'Usuário Apple';
    
    setLoading(true);
    // Simulating social logic mapping to our service
    const existingUser = await dbService.login(socialEmail);
    if (existingUser) {
      await login(socialEmail);
    } else {
      await signup(socialName, socialEmail);
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-surface dark:bg-slate-950 p-4 font-sans transition-colors duration-200">
      
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full bg-white dark:bg-slate-800 text-text-muted dark:text-slate-400 shadow-md hover:text-primary transition-all"
        title="Mudar tema"
      >
        <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
      </button>

      <div className="w-full max-w-md space-y-8">
        
        <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl shadow-primary/30">
                <i className="fa-solid fa-helmet-safety text-3xl"></i>
            </div>
        </div>

        <h1 className="text-text-main dark:text-white tracking-tight text-3xl font-bold leading-tight text-center">
            {isLogin ? 'Entrar na minha obra' : 'Criar meu cadastro'}
        </h1>

        <div className="space-y-6">
          {!isLogin && (
            <div className="flex flex-col">
              <label className="text-text-main dark:text-slate-200 text-base font-medium leading-normal pb-2" htmlFor="name">Meu nome completo</label>
              <input 
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-text-main dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 h-14 placeholder:text-text-muted dark:placeholder:text-slate-500 p-[15px] text-base font-normal leading-normal transition-colors" 
                id="name" 
                placeholder="Ex: Maria Silva" 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col">
            <label className="text-text-main dark:text-slate-200 text-base font-medium leading-normal pb-2" htmlFor="email">Meu e-mail</label>
            <input 
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-text-main dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 h-14 placeholder:text-text-muted dark:placeholder:text-slate-500 p-[15px] text-base font-normal leading-normal transition-colors" 
              id="email" 
              placeholder="Digite seu email aqui" 
              type="text" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div className="flex flex-col">
              <label className="text-text-main dark:text-slate-200 text-base font-medium leading-normal pb-2" htmlFor="whatsapp">Meu WhatsApp</label>
              <input 
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-text-main dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 h-14 placeholder:text-text-muted dark:placeholder:text-slate-500 p-[15px] text-base font-normal leading-normal transition-colors" 
                id="whatsapp" 
                placeholder="(11) 99999-9999" 
                type="tel" 
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col">
            <label className="text-text-main dark:text-slate-200 text-base font-medium leading-normal pb-2" htmlFor="password">Minha senha</label>
            <div className="relative flex w-full items-center">
              <input 
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-text-main dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 h-14 placeholder:text-text-muted dark:placeholder:text-slate-500 p-[15px] pr-12 text-base font-normal leading-normal transition-colors" 
                id="password" 
                placeholder="Digite sua senha" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-white text-base font-bold leading-normal tracking-[0.015em] shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70 disabled:cursor-wait"
          >
            <span className="truncate">{loading ? 'Carregando...' : (isLogin ? 'Entrar agora' : 'Criar minha conta')}</span>
          </button>
          
          {isLogin && (
            <div className="text-center">
                <a className="text-primary font-medium text-sm hover:underline cursor-pointer">Não lembro minha senha</a>
            </div>
          )}
        </div>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-slate-300 dark:border-slate-700"></div>
          <span className="flex-shrink mx-4 text-sm text-text-muted dark:text-slate-500">Ou use sua rede social</span>
          <div className="flex-grow border-t border-slate-300 dark:border-slate-700"></div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => handleSocialLogin('google')}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 h-12 px-5 text-text-main dark:text-white text-sm font-medium hover:bg-surface dark:hover:bg-slate-700 transition-colors"
          >
            <i className="fa-brands fa-google text-red-500 text-lg"></i>
            <span>Google</span>
          </button>
          <button 
            onClick={() => handleSocialLogin('apple')}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 h-12 px-5 text-text-main dark:text-white text-sm font-medium hover:bg-surface dark:hover:bg-slate-700 transition-colors"
          >
            <i className="fa-brands fa-apple text-black dark:text-white text-lg"></i>
            <span>Apple</span>
          </button>
        </div>

        <div className="text-center pt-4">
          <p className="text-sm text-text-muted dark:text-slate-400">
            {isLogin ? 'Ainda não tem cadastro? ' : 'Já tenho conta. '}
            <button onClick={() => setIsLogin(!isLogin)} className="font-bold text-primary hover:underline">
              {isLogin ? 'Criar conta grátis' : 'Fazer login'}
            </button>
          </p>
        </div>

        {isLogin && (
            <div className="mt-4 text-center text-xs text-text-muted dark:text-slate-500 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                Para testar, use: <strong>demo@maos.com</strong> (sem senha)
            </div>
        )}
      </div>
    </div>
  );
};

export default Login;
