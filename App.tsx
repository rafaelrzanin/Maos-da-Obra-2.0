
import React, { useState, useEffect, createContext, useContext, useMemo, Suspense, lazy, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, PlanType } from './types';
import { dbService } from './services/db';

// --- Lazy Loading (Melhora a velocidade inicial) ---
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateWork = lazy(() => import('./pages/CreateWork'));
const WorkDetail = lazy(() => import('./pages/WorkDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const Profile = lazy(() => import('./pages/Profile'));
const VideoTutorials = lazy(() => import('./pages/VideoTutorials'));
const Checkout = lazy(() => import('./pages/Checkout'));

// --- Componente de Carregamento (Evita tela branca) ---
const LoadingScreen = () => (
  <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
    <div className="relative">
        <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-800 border-t-secondary rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-secondary">
            <i className="fa-solid fa-helmet-safety"></i>
        </div>
    </div>
    <p className="mt-4 text-sm font-bold text-slate-400 animate-pulse">Carregando...</p>
  </div>
);

// --- Theme Context ---
type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType>(null!);
export const useTheme = () => useContext(ThemeContext);

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('maos_theme') as Theme) || 'light');
  useEffect(() => {
    const root = window.document.documentElement;
    theme === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
    localStorage.setItem('maos_theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => Promise<boolean>;
  logout: () => void;
  updatePlan: (plan: PlanType) => Promise<void>;
  refreshUser: () => Promise<void>;
  isSubscriptionValid: boolean;
  isNewAccount: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Otimização: Se já temos user no localStorage, NÃO começamos com loading true.
  // Isso permite que a UI carregue instantaneamente enquanto validamos o token em background.
  const [user, setUserState] = useState<User | null>(() => dbService.getCurrentUser());
  const [loading, setLoading] = useState(() => !dbService.getCurrentUser());
  
  // Ref para evitar loops de atualizações com o mesmo objeto
  const userRef = useRef<string>(JSON.stringify(user));

  const setUser = (newUser: User | null) => {
      const newStr = JSON.stringify(newUser);
      if (newStr !== userRef.current) {
          userRef.current = newStr;
          setUserState(newUser);
      }
  };

  const isSubscriptionValid = useMemo(() => user ? dbService.isSubscriptionActive(user) : false, [user]);
  const isNewAccount = useMemo(() => user ? !user.subscriptionExpiresAt : true, [user]);

  useEffect(() => {
    const sync = async () => {
        try {
            const sbUser = await dbService.syncSession();
            if (sbUser) setUser(sbUser);
            else if (user) setUser(null); // Logout se sessão expirou no servidor
        } catch (e) {
            console.error("Auth Sync Error", e);
        } finally {
            setLoading(false);
        }
    };
    sync();

    const unsubscribe = dbService.onAuthChange((u: User | null) => {
        setUser(u);
        setLoading(false);
    });
    return () => { unsubscribe(); };
  }, []); // Dependência vazia para rodar apenas no mount

  const refreshUser = async () => {
      const currentUser = await dbService.syncSession(); // Força busca no servidor
      if (currentUser) setUser(currentUser);
  };

  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
        const u = await dbService.login(email, password);
        if (u) {
            setUser(u);
            return true;
        }
        return false;
    } finally {
        setLoading(false);
    }
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    setLoading(true);
    try {
        const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
        if (u) {
            setUser(u);
            return true;
        }
        return false;
    } finally {
        setLoading(false);
    }
  };

  const logout = () => {
    dbService.logout();
    setUser(null);
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      await dbService.updatePlan(user.id, plan);
      await refreshUser();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid, isNewAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

// Layout Component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, logout, isSubscriptionValid, isNewAccount, updatePlan } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const status = params.get('status');
      const planParam = params.get('plan') as PlanType | null;

      if (status === 'success' && user) {
          if (planParam) {
              updatePlan(planParam).then(() => {
                  alert("Pagamento confirmado! Plano atualizado com sucesso.");
                  navigate(location.pathname, { replace: true });
              });
          } else {
              navigate(location.pathname, { replace: true });
          }
      }
  }, [location.search, user, updatePlan, navigate, location.pathname]);

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;

  const isSettingsPage = location.pathname === '/settings';
  const isCheckoutPage = location.pathname === '/checkout';
  
  if (!isSubscriptionValid && !isSettingsPage && !isCheckoutPage) {
      return <Navigate to="/settings" replace />;
  }

  const navItems = [
    { label: 'Painel Geral', path: '/', icon: 'fa-house' },
    { label: 'Nova Obra', path: '/create', icon: 'fa-plus' },
    { label: 'Configurações', path: '/profile', icon: 'fa-gear' },
    { label: 'Assinatura', path: '/settings', icon: 'fa-id-card' },
  ];

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 flex flex-col md:flex-row font-sans text-text-body dark:text-slate-300 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden bg-primary dark:bg-slate-900 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-50 shrink-0">
        <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <span className="bg-secondary text-white w-8 h-8 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-helmet-safety text-sm"></i>
            </span>
            <span>MÃOS DA OBRA</span>
        </h1>
        {isSubscriptionValid && (
            <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center active:scale-95 transition-transform"
            >
                <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-lg`}></i>
            </button>
        )}
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && isSubscriptionValid && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm pt-[72px]" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xl p-4 animate-in slide-in-from-top-5 rounded-b-2xl" onClick={e => e.stopPropagation()}>
                <nav className="flex flex-col gap-2">
                    {navItems.map(item => (
                        <button 
                            key={item.path} 
                            onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }} 
                            className={`flex items-center gap-4 p-4 rounded-xl font-bold transition-colors ${location.pathname === item.path ? 'bg-primary text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${location.pathname === item.path ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                <i className={`fa-solid ${item.icon}`}></i>
                            </div>
                            {item.label}
                        </button>
                    ))}
                    
                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-slate-800 text-white flex items-center justify-center font-bold shadow-sm">
                                {user.name.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-primary dark:text-white truncate max-w-[120px]">{user.name.split(' ')[0]}</p>
                                <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">{user.plan}</p>
                            </div>
                        </div>
                        <button onClick={toggleTheme} className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-white shadow-sm border border-slate-200 dark:border-slate-600">
                            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                        </button>
                    </div>

                    <button onClick={logout} className="w-full py-4 mt-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                        <i className="fa-solid fa-arrow-right-from-bracket"></i> Sair do App
                    </button>
                </nav>
            </div>
        </div>
      )}

      {/* Sidebar Desktop - FIXED LAYOUT */}
      {isSubscriptionValid && (
      <aside className="hidden md:flex flex-col w-72 bg-gradient-premium text-white h-screen sticky top-0 border-r border-white/5 overflow-hidden">
        {/* Header Logo */}
        <div className="p-8 pb-4 flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center transform rotate-3 shrink-0"><i className="fa-solid fa-helmet-safety text-2xl"></i></div>
          <h1 className="font-extrabold tracking-tight leading-none text-xl">MÃOS DA<br/>OBRA</h1>
        </div>
        
        {/* Scrollable Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map(item => (
              <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center p-3.5 rounded-xl text-sm font-semibold transition-all ${location.pathname === item.path ? 'bg-white/10 shadow-lg border border-white/5 relative' : 'text-slate-400 hover:text-white'}`}>
                {location.pathname === item.path && <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary"></div>}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${location.pathname === item.path ? 'bg-secondary text-white' : 'bg-white/5'}`}><i className={`fa-solid ${item.icon}`}></i></div>{item.label}
              </button>
          ))}
        </nav>
        
        {/* Fixed Footer Card */}
        <div className="p-4 shrink-0">
            <div className="rounded-2xl bg-black/20 border border-white/5 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 border border-white/10 flex items-center justify-center font-bold shrink-0">{user.name.charAt(0)}</div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate">{user.name}</p>
                        <p className="text-[10px] text-secondary font-bold">{user.plan || 'Bloqueado'}</p>
                    </div>
                    <button onClick={toggleTheme} className="text-slate-400 hover:text-white shrink-0"><i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i></button>
                </div>
                <button onClick={logout} className="w-full py-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-xs font-bold transition-colors">Sair</button>
            </div>
        </div>
      </aside>
      )}

      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen">
        <React.Suspense fallback={<div className="h-full w-full flex items-center justify-center"><div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div></div>}>
            {!isSubscriptionValid && isSettingsPage && (
                <div className={`p-4 rounded-xl mb-6 flex items-center justify-between shadow-lg ${
                    isNewAccount 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' 
                        : 'bg-danger text-white'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                            <i className={`fa-solid ${isNewAccount ? 'fa-rocket' : 'fa-lock'}`}></i>
                        </div>
                        <div>
                            <p className="text-sm font-bold uppercase tracking-wide opacity-90">
                                {isNewAccount ? 'Falta pouco!' : 'Acesso Bloqueado'}
                            </p>
                            <p className="text-sm font-bold">
                                {isNewAccount ? 'Escolha um plano para começar a usar.' : 'Sua assinatura expirou. Renove para continuar.'}
                            </p>
                        </div>
                    </div>
                    <button onClick={logout} className="text-xs bg-white/20 px-3 py-2 rounded-lg font-bold hover:bg-white/30 transition-colors">Sair</button>
                </div>
            )}
            {children}
        </React.Suspense>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Layout><Dashboard /></Layout>} />
                <Route path="/create" element={<Layout><CreateWork /></Layout>} />
                <Route path="/work/:id" element={<Layout><WorkDetail /></Layout>} />
                <Route path="/settings" element={<Layout><Settings /></Layout>} />
                <Route path="/checkout" element={<Layout><Checkout /></Layout>} />
                <Route path="/profile" element={<Layout><Profile /></Layout>} />
                <Route path="/tutorials" element={<Layout><VideoTutorials /></Layout>} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};
export default App;
