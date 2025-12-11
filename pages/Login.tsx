
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { useNavigate, useLocation } from 'react-router-dom';
import { dbService } from '../services/db';

const Login: React.FC = () => {
  const { login, signup, user, loading: authLoading, isSubscriptionValid } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Password Recovery State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<'IDLE' | 'SENDING' | 'SENT' | 'ERROR'>('IDLE');

  // Detect plan from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const plan = params.get('plan');
    if (plan) {
      setSelectedPlan(plan);
      setIsLogin(false);
    }
  }, [location.search]);

  // Main redirect logic
  useEffect(() => {
    // Only redirect if user exists and auth is done loading
    if (user && !authLoading) {
        // 1. Se tem um plano selecionado na URL (fluxo de compra), vai pro Checkout
        if (selectedPlan) {
            navigate('/checkout', { replace: true });
        } 
        // 2. Se já tem assinatura válida (Vitalício ou Ativo), vai pro Dashboard
        else if (isSubscriptionValid) {
            navigate('/', { replace: true });
        } 
        // 3. Se é conta nova ou expirada sem plano selecionado, vai para Configurações escolher
        else {
            navigate('/settings', { replace: true });
        }
    }
  }, [user, navigate, selectedPlan, authLoading, isSubscriptionValid]);

  // Helper for CPF mask
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      
      if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      
      setCpf(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
        if (isLogin) {
            const success = await login(email, password);
            if (!success) {
                alert('Dados incorretos ou usuário não encontrado.');
                setLoading(false); // Stop loading on error to allow retry
            } 
            // If success, useEffect will handle redirect.
        } else {
            // Signup Flow
            const cleanCpf = cpf.replace(/\D/g, '');
            
            if (!name || cleanCpf.length !== 11) {
                alert('Nome e um CPF válido (11 números) são obrigatórios.');
                setLoading(false);
                return;
            }
            
            const success = await signup(name, email, whatsapp, password, cpf, selectedPlan);
            if (!success) {
                alert("Falha ao criar conta. Tente novamente.");
                setLoading(false);
            }
            // If success, user state updates, triggering useEffect -> navigate
        }
    } catch (error) {
        alert("Erro no sistema. Verifique sua conexão.");
        console.error(error);
        setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google') => {
    setLoading(true);
    // loginSocial now returns { user, error } so we can update context if needed
    // However, App.tsx AuthContext listens to dbService changes implicitly or we need to trigger a refresh.
    // In dbService.loginSocial we now update localStorage, so calling refreshUser from context is ideal, 
    // but a simple window reload or context refetch works too. 
    // The cleanest way in this architecture without exposing 'setUser' is relying on the fact 
    // that dbService.loginSocial now mimics a login. We should call `login` with a special flag 
    // or just assume if it returns success, we reload page or wait for useEffect.
    
    const { user: socialUser, error } = await dbService.loginSocial(provider);
    
    if (error) {
        alert("Erro no login Google.");
        setLoading(false);
    } else if (socialUser) {
        // Force auth refresh in App context
        window.location.reload(); 
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!forgotEmail) return;
      
      setForgotStatus('SENDING');
      try {
          const exists = await dbService.resetPassword(forgotEmail);
          setForgotStatus('SENT');
          // In production, checking 'exists' might reveal registered emails, but for MVP it's fine.
          if (!exists) {
              // Optionally handle "user not found" message differently if desired
          }
      } catch (e) {
          setForgotStatus('ERROR');
      }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-slate-900 font-sans">
      <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070" 
            className="w-full h-full object-cover opacity-60"
            alt="Background"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30"></div>
      </div>

      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95">
          <div className="text-center mb-8 flex flex-col items-center">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center text-white text-3xl mb-4 shadow-xl rotate-6">
                  <i className="fa-solid fa-helmet-safety"></i>
              </div>
              <h1 className="text-3xl font-black text-white">
                  MÃOS DA <span className="text-amber-400">OBRA</span>
              </h1>
              <p className="text-white/90 text-sm mt-2 font-medium">Controle na palma da sua mão</p>
          </div>

          <div className="backdrop-blur-xl bg-black/70 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
              <h2 className="text-xl font-bold text-white text-center mb-6">
                  {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <>
                        <input type="text" placeholder="Nome Completo" value={name} onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                        <input type="text" placeholder="CPF" value={cpf} onChange={handleCpfChange}
                            className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                    </>
                  )}
                  <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                  {!isLogin && (
                    <input type="tel" placeholder="WhatsApp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                  )}
                  <div className="relative">
                    <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white outline-none focus:border-amber-500/50" />
                    {isLogin && (
                        <div className="flex justify-end mt-2">
                            <button 
                                type="button" 
                                onClick={() => { setShowForgotModal(true); setForgotStatus('IDLE'); setForgotEmail(email); }}
                                className="text-xs text-slate-300 hover:text-white underline"
                            >
                                Esqueci minha senha
                            </button>
                        </div>
                    )}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full py-4 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-400 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait">
                      {loading ? (
                        <>
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                            <span>Acessando...</span>
                        </>
                      ) : (isLogin ? 'Entrar' : 'Cadastrar')}
                  </button>
                  
                  <div className="mt-4 flex flex-col gap-3">
                      <button type="button" disabled={loading} onClick={() => handleSocialLogin('google')} 
                          className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                          <span className="text-sm font-bold">Entrar com Google</span>
                      </button>
                      <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-amber-400 text-sm font-bold underline">
                        {isLogin ? 'Criar uma conta' : 'Já tenho conta'}
                      </button>
                  </div>
              </form>
          </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                  <button onClick={() => setShowForgotModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><i className="fa-solid fa-xmark text-xl"></i></button>
                  
                  <div className="text-center mb-6">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-500 mx-auto mb-3">
                          <i className="fa-solid fa-key"></i>
                      </div>
                      <h3 className="text-lg font-bold text-white">Recuperar Senha</h3>
                      <p className="text-sm text-slate-400">Digite seu e-mail para receber as instruções.</p>
                  </div>

                  {forgotStatus === 'SENT' ? (
                      <div className="text-center py-4">
                          <div className="text-green-500 text-4xl mb-2"><i className="fa-solid fa-envelope-circle-check"></i></div>
                          <p className="text-white font-bold">E-mail enviado!</p>
                          <p className="text-xs text-slate-400 mt-2">Verifique sua caixa de entrada (e spam).</p>
                          <button onClick={() => setShowForgotModal(false)} className="mt-4 w-full py-3 bg-slate-800 text-white rounded-xl font-bold">Fechar</button>
                      </div>
                  ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                          <input 
                              type="email" 
                              required
                              placeholder="seu@email.com" 
                              value={forgotEmail} 
                              onChange={e => setForgotEmail(e.target.value)}
                              className="w-full px-4 py-3 bg-black/30 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500" 
                          />
                          <button 
                              type="submit" 
                              disabled={forgotStatus === 'SENDING'}
                              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                          >
                              {forgotStatus === 'SENDING' ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Enviar Recuperação'}
                          </button>
                      </form>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
export default Login;
