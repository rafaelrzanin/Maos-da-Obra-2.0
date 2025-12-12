
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
  trialDaysRemaining: number | null; // Novo campo
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Correctly handle async user fetching: start with null and loading true
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
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
  
  const trialDaysRemaining = useMemo(() => {
      if (user?.isTrial && user.subscriptionExpiresAt) {
          const now = new Date();
          const expires = new Date(user.subscriptionExpiresAt);
          const diffTime = expires.getTime() - now.getTime();
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      }
      return null;
  }, [user]);

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
    
    // Safety timeout para loading infinito no login
    const safetyTimer = setTimeout(() => {
        setLoading(false);
    }, 5000);

    sync().then(() => clearTimeout(safetyTimer));

    const unsubscribe = dbService.onAuthChange((u: User | null) => {
        setUser(u);
        setLoading(false);
    });
    return () => { unsubscribe(); clearTimeout(safetyTimer); };
  }, []); 

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
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid, isNewAccount, trialDaysRemaining }}>
      {children}
    </AuthContext.Provider>
  );
};

// Layout Component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, logout, isSubscriptionValid, updatePlan, trialDaysRemaining } = useAuth();
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
    { label: 'Configurações', path: '/settings', icon: 'fa-gear' },
    { label: 'Tutoriais', path: '/tutorials', icon: 'fa-circle-play' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Mobile Header */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-10 h-10 bg-gradient-to-br from-secondary to-orange-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg">
                <i className="fa-solid fa-helmet-safety"></i>
              </div>
              <span className="font-black text-xl tracking-tight text-primary dark:text-white">MÃOS DA <span className="text-secondary">OBRA</span></span>
            </div>
            
            <div className="hidden md:flex items-center gap-6">
                {navItems.map(item => (
                    <button key={item.path} onClick={() => navigate(item.path)} className={`text-sm font-bold transition-colors flex items-center gap-2 ${location.pathname === item.path ? 'text-secondary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                        <i className={`fa-solid ${item.icon}`}></i> {item.label}
                    </button>
                ))}
                <button onClick={() => navigate('/profile')} className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-700">
                    <div className="text-right">
                        <p className="text-xs font-bold text-primary dark:text-white">{user.name.split(' ')[0]}</p>
                        <p className="text-[10px] text-slate-400 uppercase">{user.plan || 'Free'}</p>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-secondary border border-slate-200 dark:border-slate-700">
                        <i className="fa-solid fa-user"></i>
                    </div>
                </button>
                <button onClick={toggleTheme} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
                </button>
                <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors"><i className="fa-solid fa-right-from-bracket"></i></button>
            </div>

            <div className="md:hidden flex items-center gap-4">
               <button onClick={toggleTheme} className="text-slate-500 dark:text-slate-400">
                    {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
               </button>
               <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-primary dark:text-white p-2">
                  <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-xl`}></i>
               </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 w-full bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-xl animate-in slide-in-from-top-2">
                <div className="px-4 pt-4 pb-6 space-y-2">
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl mb-4" onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }}>
                        <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-secondary text-xl shadow-sm">
                            <i className="fa-solid fa-user"></i>
                        </div>
                        <div>
                            <p className="font-bold text-primary dark:text-white">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                    </div>
                    {navItems.map(item => (
                        <button key={item.path} onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }} className={`w-full p-4 rounded-xl flex items-center gap-4 font-bold transition-colors ${location.pathname === item.path ? 'bg-secondary/10 text-secondary' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            <i className={`fa-solid ${item.icon} w-6 text-center`}></i> {item.label}
                        </button>
                    ))}
                    <button onClick={logout} className="w-full p-4 rounded-xl flex items-center gap-4 font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                        <i className="fa-solid fa-right-from-bracket w-6 text-center"></i> Sair
                    </button>
                </div>
            </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="pt-20 min-h-screen">
        {user.isTrial && trialDaysRemaining !== null && trialDaysRemaining <= 5 && isSubscriptionValid && (
            <div className="max-w-4xl mx-auto px-4 mb-4">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center justify-between text-sm font-bold animate-in fade-in slide-in-from-top-2 cursor-pointer hover:brightness-110 transition-all" onClick={() => navigate('/settings')}>
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-stopwatch animate-pulse"></i>
                        <span>Teste Grátis: Restam {trialDaysRemaining} dias. Assine agora para não perder o acesso.</span>
                    </div>
                    <i className="fa-solid fa-chevron-right"></i>
                </div>
            </div>
        )}
        {children}
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
              <Route path="/checkout" element={<Layout><Checkout /></Layout>} />
              <Route path="/" element={<Layout><Dashboard /></Layout>} />
              <Route path="/create" element={<Layout><CreateWork /></Layout>} />
              <Route path="/work/:id" element={<Layout><WorkDetail /></Layout>} />
              <Route path="/settings" element={<Layout><Settings /></Layout>} />
              <Route path="/profile" element={<Layout><Profile /></Layout>} />
              <Route path="/tutorials" element={<Layout><VideoTutorials /></Layout>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
