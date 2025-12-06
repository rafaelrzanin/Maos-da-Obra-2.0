import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, PlanType } from './types';
import { dbService } from './services/db';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateWork from './pages/CreateWork';
import WorkDetail from './pages/WorkDetail';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import VideoTutorials from './pages/VideoTutorials';

// --- Theme Context ---
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>(null!);

export const useTheme = () => useContext(ThemeContext);

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('maos_theme');
    return (saved as Theme) || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('maos_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<boolean>;
  signup: (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => Promise<void>;
  logout: () => void;
  updatePlan: (plan: PlanType) => Promise<void>;
  refreshUser: () => Promise<void>;
  isSubscriptionValid: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isSubscriptionValid, setIsSubscriptionValid] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
        const localUser = dbService.getCurrentUser();
        if (localUser) {
            setUser(localUser);
            setIsSubscriptionValid(dbService.isSubscriptionActive(localUser));
        }
        const sbUser = await dbService.syncSession();
        if (sbUser) {
            setUser(sbUser);
            setIsSubscriptionValid(dbService.isSubscriptionActive(sbUser));
        }
    };
    initAuth();
    const unsubscribe = dbService.onAuthChange((u) => {
        setUser(u);
        if (u) setIsSubscriptionValid(dbService.isSubscriptionActive(u));
        else setIsSubscriptionValid(false);
    });
    return () => { unsubscribe(); };
  }, []);

  const refreshUser = async () => {
      const currentUser = dbService.getCurrentUser();
      if (currentUser) {
          setUser(currentUser);
          setIsSubscriptionValid(dbService.isSubscriptionActive(currentUser));
      }
  };

  const login = async (email: string, password?: string) => {
    const u = await dbService.login(email, password);
    if (u) {
        setUser(u);
        setIsSubscriptionValid(dbService.isSubscriptionActive(u));
        return true;
    }
    return false;
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
    if (u) {
        setUser(u);
        setIsSubscriptionValid(dbService.isSubscriptionActive(u));
    }
  };

  const logout = () => {
    dbService.logout();
    setUser(null);
    setIsSubscriptionValid(false);
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      await dbService.updatePlan(user.id, plan);
      await refreshUser();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid }}>
      {children}
    </AuthContext.Provider>
  );
};

// Layout Component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isSubscriptionValid, refreshUser, updatePlan } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 1. Check for Payment Success Callback FIRST
  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const status = params.get('status');
      
      const handlePaymentSuccess = async () => {
          if (status === 'success' && user) {
              const planToActivate = user.plan || PlanType.MENSAL;
              
              await updatePlan(planToActivate);
              // Force refresh to ensure state is synced
              await refreshUser();
              
              alert("Pagamento confirmado! Sua assinatura está ativa.");
              
              // Clear URL params to avoid re-triggering
              navigate(location.pathname, { replace: true });
          }
      };
      
      handlePaymentSuccess();
  }, [location.search, user, updatePlan, refreshUser, navigate, location.pathname]);

  // 2. Check Login
  if (!user) return <Navigate to="/login" />;

  // 3. Check Subscription (Strict Blockade)
  const isSettingsPage = location.pathname === '/settings';
  if (!isSubscriptionValid && !isSettingsPage) {
      return <Navigate to="/settings" replace />;
  }

  // 4. Determine if navigation should be shown
  const showNavigation = isSubscriptionValid;

  const navItems = [
    { label: 'Painel Geral', path: '/', icon: 'fa-house' },
    { label: 'Nova Obra', path: '/create', icon: 'fa-plus' },
    // { label: 'Tutoriais', path: '/tutorials', icon: 'fa-circle-play' },
    { label: 'Configurações', path: '/profile', icon: 'fa-gear' },
    { label: 'Assinatura', path: '/settings', icon: 'fa-id-card' },
  ];

  const handleMobileNav = (path: string) => {
      navigate(path);
      setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 flex flex-col md:flex-row font-sans text-text-body dark:text-slate-300 transition-colors duration-300 print:block print:bg-white">
      
      {/* Mobile Header (Only if nav allowed or on settings to logout) */}
      <div className="md:hidden bg-primary dark:bg-slate-900 text-white p-4 flex justify-between items-center shadow-md print:hidden z-50 sticky top-0 border-b border-white/5 dark:border-slate-800">
        <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <span className="bg-secondary text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-glow">
                <i className="fa-solid fa-helmet-safety text-sm"></i>
            </span>
            <span>MÃOS DA OBRA</span>
        </h1>
        
        {/* Mobile Menu Trigger (Only show if allowed) */}
        {showNavigation && (
            <button 
                onClick={() => setIsMobileMenuOpen(true)} 
                className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
                <i className="fa-solid fa-bars text-lg"></i>
            </button>
        )}
        {!showNavigation && (
             <button onClick={logout} className="text-xs font-bold bg-white/10 px-3 py-2 rounded-lg">Sair</button>
        )}
      </div>

      {/* MOBILE MENU OVERLAY */}
      {isMobileMenuOpen && showNavigation && (
          <div className="md:hidden fixed inset-0 z-[100] bg-surface dark:bg-slate-950 animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <h2 className="text-lg font-bold text-primary dark:text-white flex items-center gap-2">
                      <i className="fa-solid fa-bars text-secondary"></i> Menu
                  </h2>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary flex items-center justify-center"><i className="fa-solid fa-xmark text-lg"></i></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50 dark:bg-slate-950">
                  <div className="bg-gradient-premium p-6 rounded-2xl shadow-xl text-white border border-white/5">
                      <div className="flex items-center gap-4 mb-4">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-white/20 flex items-center justify-center text-white font-bold text-xl shadow-inner">{user.name.charAt(0)}</div>
                          <div><p className="font-bold text-lg leading-tight">{user.name}</p><p className="text-xs text-secondary uppercase font-bold tracking-widest mt-1">{user.plan || 'Sem Plano'}</p></div>
                      </div>
                      <p className="text-xs text-slate-400">Logado como: {user.email}</p>
                  </div>
                  <nav className="space-y-3">
                      {navItems.map(item => (
                          <button key={item.path} onClick={() => handleMobileNav(item.path)} className={`w-full flex items-center p-4 rounded-xl text-base font-semibold transition-all ${location.pathname === item.path ? 'bg-primary dark:bg-slate-800 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'}`}>
                              <div className={`w-8 flex justify-center mr-2 ${location.pathname === item.path ? 'text-secondary' : 'text-slate-400'}`}><i className={`fa-solid ${item.icon}`}></i></div>{item.label}
                          </button>
                      ))}
                  </nav>
                  <div className="mt-auto space-y-3">
                      <button onClick={toggleTheme} className="w-full flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"><span className="flex items-center gap-3 font-medium"><i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} w-5 text-center`}></i> Modo {theme === 'dark' ? 'Claro' : 'Escuro'}</span></button>
                      <button onClick={logout} className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold border border-red-100 dark:border-red-900/30 hover:bg-red-100 transition-colors"><i className="fa-solid fa-right-from-bracket"></i> Sair da Conta</button>
                  </div>
              </div>
          </div>
      )}

      {/* Sidebar (Desktop Premium) */}
      {showNavigation && (
      <aside className="hidden md:flex flex-col w-72 bg-gradient-premium text-white h-screen sticky top-0 shadow-2xl z-50 transition-colors duration-300 print:hidden border-r border-white/5">
        <div className="p-8 pb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 transform rotate-3 shrink-0"><i className="fa-solid fa-helmet-safety text-2xl"></i></div>
          <div><h1 className="font-extrabold text-white tracking-tight leading-none text-xl">MÃOS DA<br/>OBRA</h1></div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map(item => (
              <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center p-3.5 rounded-xl text-sm font-semibold transition-all duration-300 group ${location.pathname === item.path ? 'bg-white/10 text-white shadow-lg border border-white/5 relative overflow-hidden' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                {location.pathname === item.path && <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary"></div>}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors ${location.pathname === item.path ? 'bg-secondary text-white shadow-glow' : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-secondary'}`}><i className={`fa-solid ${item.icon}`}></i></div>{item.label}
              </button>
          ))}
        </nav>
        <div className="p-4 mx-4 mb-4 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-sm">
           <div className="flex items-center gap-3 mb-4">
               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-white font-bold shadow-inner">{user.name.charAt(0)}</div>
               <div className="min-w-0 flex-1"><p className="text-sm font-bold text-white truncate">{user.name}</p><p className="text-[10px] text-secondary uppercase font-bold tracking-wider">{user.plan || 'Bloqueado'}</p></div>
               <button onClick={toggleTheme} className="text-slate-400 hover:text-secondary transition-colors"><i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i></button>
           </div>
           <button onClick={logout} className="w-full py-2 rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-xs text-slate-400 font-bold transition-colors flex items-center justify-center gap-2"><i className="fa-solid fa-power-off"></i> Encerrar Sessão</button>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-auto min-h-[calc(100vh-64px)] md:min-h-screen bg-surface dark:bg-slate-950 transition-colors duration-300 print:overflow-visible print:h-auto print:min-h-0 print:block print:p-0 print:bg-white scroll-smooth">
        {/* If blocked, show a header indicating why */}
        {!isSubscriptionValid && isSettingsPage && (
            <div className="bg-red-500 text-white p-4 rounded-xl mb-6 shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <i className="fa-solid fa-lock text-2xl"></i>
                    <div>
                        <h2 className="font-bold text-lg">Acesso Bloqueado</h2>
                        <p className="text-sm opacity-90">Para liberar o aplicativo, escolha um plano abaixo e finalize o pagamento.</p>
                    </div>
                </div>
                <button onClick={logout} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg font-bold">Sair</button>
            </div>
        )}
        {children}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/create" element={<Layout><CreateWork /></Layout>} />
            <Route path="/work/:id" element={<Layout><WorkDetail /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="/profile" element={<Layout><Profile /></Layout>} />
            <Route path="/tutorials" element={<Layout><VideoTutorials /></Layout>} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
};

export default App;
