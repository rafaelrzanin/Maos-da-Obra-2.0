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
  signup: (name: string, email: string, whatsapp?: string, password?: string) => Promise<void>;
  logout: () => void;
  updatePlan: (plan: PlanType) => Promise<void>;
  refreshUser: () => Promise<void>;
  isSubscriptionValid: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isSubscriptionValid, setIsSubscriptionValid] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
        // 1. Try Local Storage first (instant load for perceived performance)
        const localUser = dbService.getCurrentUser();
        if (localUser) {
            setUser(localUser);
            setIsSubscriptionValid(dbService.isSubscriptionActive(localUser));
        }

        // 2. Check Supabase Session (Handles OAuth Redirect & Session Validity)
        const sbUser = await dbService.syncSession();
        if (sbUser) {
            setUser(sbUser);
            setIsSubscriptionValid(dbService.isSubscriptionActive(sbUser));
        }
    };
    
    initAuth();

    // 3. Listen for real-time auth changes (Sign In / Sign Out / Token Refresh)
    const unsubscribe = dbService.onAuthChange((u) => {
        setUser(u);
        if (u) setIsSubscriptionValid(dbService.isSubscriptionActive(u));
    });

    return () => {
        unsubscribe();
    };
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

  const signup = async (name: string, email: string, whatsapp?: string, password?: string) => {
    const u = await dbService.signup(name, email, whatsapp, password);
    if (u) {
        setUser(u);
        setIsSubscriptionValid(dbService.isSubscriptionActive(u));
    }
  };

  const logout = () => {
    dbService.logout();
    setUser(null);
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      await dbService.updatePlan(user.id, plan);
      // Recarregar user para obter nova data de expiração
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
  const { user, logout, isSubscriptionValid } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 1. Check Login
  if (!user) return <Navigate to="/login" />;

  // 2. Check Subscription (Except on Settings/Payment page)
  const isSettingsPage = location.pathname === '/settings';
  if (!isSubscriptionValid && !isSettingsPage) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl max-w-md text-center shadow-2xl">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 text-2xl mx-auto mb-4">
                      <i className="fa-solid fa-lock"></i>
                  </div>
                  <h2 className="text-2xl font-bold text-primary dark:text-white mb-2">Assinatura Expirada</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">
                      Seu período de acesso terminou. Renove seu plano para continuar gerenciando suas obras.
                  </p>
                  <div className="flex flex-col gap-3">
                      <button 
                          onClick={() => navigate('/settings')}
                          className="w-full py-3 bg-secondary text-white font-bold rounded-xl shadow-lg hover:bg-orange-600 transition-colors"
                      >
                          Renovar Agora
                      </button>
                      <button 
                          onClick={logout}
                          className="text-sm text-slate-400 hover:text-slate-500 font-bold"
                      >
                          Sair da Conta
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  const navItems = [
    { label: 'Painel Geral', path: '/', icon: 'fa-house' },
    { label: 'Nova Obra', path: '/create', icon: 'fa-plus' },
    // Item ocultado temporariamente conforme solicitado
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
      
      {/* Mobile Header (Premium Dark) */}
      <div className="md:hidden bg-primary dark:bg-slate-900 text-white p-4 flex justify-between items-center shadow-md print:hidden z-50 sticky top-0 border-b border-white/5 dark:border-slate-800">
        <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <span className="bg-secondary text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-glow">
                <i className="fa-solid fa-helmet-safety text-sm"></i>
            </span>
            <span>MÃOS DA OBRA</span>
        </h1>
        
        {/* Mobile Menu Trigger */}
        <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
            <i className="fa-solid fa-bars text-lg"></i>
        </button>
      </div>

      {/* MOBILE FULL SCREEN MENU OVERLAY */}
      {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[100] bg-surface dark:bg-slate-950 animate-in slide-in-from-right duration-300 flex flex-col">
              
              {/* Menu Header */}
              <div className="p-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <h2 className="text-lg font-bold text-primary dark:text-white flex items-center gap-2">
                      <i className="fa-solid fa-bars text-secondary"></i> Menu
                  </h2>
                  <button 
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors"
                  >
                      <i className="fa-solid fa-xmark text-lg"></i>
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50 dark:bg-slate-950">
                  
                  {/* User Profile Card (Mobile) */}
                  <div className="bg-gradient-premium p-6 rounded-2xl shadow-xl text-white border border-white/5">
                      <div className="flex items-center gap-4 mb-4">
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-white/20 flex items-center justify-center text-white font-bold text-xl shadow-inner">
                              {user.name.charAt(0)}
                          </div>
                          <div>
                              <p className="font-bold text-lg leading-tight">{user.name}</p>
                              <p className="text-xs text-secondary uppercase font-bold tracking-widest mt-1">{user.plan}</p>
                          </div>
                      </div>
                      <div className="h-[1px] w-full bg-white/10 mb-4"></div>
                      <p className="text-xs text-slate-400">Logado como: {user.email}</p>
                  </div>

                  {/* Navigation Links */}
                  <nav className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Navegação</p>
                      {navItems.map(item => {
                          const isActive = location.pathname === item.path;
                          return (
                              <button
                                  key={item.path}
                                  onClick={() => handleMobileNav(item.path)}
                                  className={`w-full flex items-center p-4 rounded-xl text-base font-semibold transition-all ${
                                      isActive 
                                      ? 'bg-primary dark:bg-slate-800 text-white shadow-lg' 
                                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                              >
                                  <div className={`w-8 flex justify-center mr-2 ${isActive ? 'text-secondary' : 'text-slate-400 dark:text-slate-500'}`}>
                                      <i className={`fa-solid ${item.icon}`}></i>
                                  </div>
                                  {item.label}
                              </button>
                          );
                      })}
                  </nav>

                  {/* Actions (Theme & Logout) */}
                  <div className="mt-auto space-y-3">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">Opções</p>
                      
                      <button 
                          onClick={toggleTheme}
                          className="w-full flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                      >
                          <span className="flex items-center gap-3 font-medium">
                              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} w-5 text-center`}></i>
                              Modo {theme === 'dark' ? 'Claro' : 'Escuro'}
                          </span>
                          <div className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-secondary' : 'bg-slate-300'}`}>
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-6' : 'left-1'}`}></div>
                          </div>
                      </button>

                      <button 
                          onClick={logout}
                          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                      >
                          <i className="fa-solid fa-right-from-bracket"></i>
                          Sair da Conta
                      </button>
                  </div>

                  <div className="text-center text-[10px] text-slate-400 uppercase font-bold tracking-widest opacity-50 pb-4">
                      Versão 2.0 Premium
                  </div>
              </div>
          </div>
      )}

      {/* Sidebar (Desktop Premium) */}
      <aside className="hidden md:flex flex-col w-72 bg-gradient-premium text-white h-screen sticky top-0 shadow-2xl z-50 transition-colors duration-300 print:hidden border-r border-white/5">
        
        {/* Logo Area */}
        <div className="p-8 pb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 transform rotate-3 shrink-0">
             <i className="fa-solid fa-helmet-safety text-2xl"></i>
          </div>
          <div>
            <h1 className="font-extrabold text-white tracking-tight leading-none text-xl">MÃOS DA<br/>OBRA</h1>
            <p className="text-[10px] text-secondary/90 font-semibold tracking-wide mt-1 leading-tight">O controle da sua obra na palma da sua mão</p>
          </div>
        </div>
        
        {/* Nav Items */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center p-3.5 rounded-xl text-sm font-semibold transition-all duration-300 group ${
                  isActive 
                    ? 'bg-white/10 text-white shadow-lg border border-white/5 relative overflow-hidden' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary"></div>}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 transition-colors ${isActive ? 'bg-secondary text-white shadow-glow' : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-secondary'}`}>
                    <i className={`fa-solid ${item.icon}`}></i>
                </div>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User & Settings */}
        <div className="p-4 mx-4 mb-4 rounded-2xl bg-black/20 border border-white/5 backdrop-blur-sm">
           <div className="flex items-center gap-3 mb-4">
               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10 flex items-center justify-center text-white font-bold shadow-inner">
                   {user.name.charAt(0)}
               </div>
               <div className="min-w-0 flex-1">
                   <p className="text-sm font-bold text-white truncate">{user.name}</p>
                   <p className="text-[10px] text-secondary uppercase font-bold tracking-wider">{user.plan}</p>
               </div>
               <button onClick={toggleTheme} className="text-slate-400 hover:text-secondary transition-colors">
                   <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
               </button>
           </div>
           
           <button 
             onClick={logout} 
             className="w-full py-2 rounded-lg bg-white/5 hover:bg-red-500/10 hover:text-red-400 text-xs text-slate-400 font-bold transition-colors flex items-center justify-center gap-2"
           >
             <i className="fa-solid fa-power-off"></i> Encerrar Sessão
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-auto min-h-[calc(100vh-64px)] md:min-h-screen bg-surface dark:bg-slate-950 transition-colors duration-300 print:overflow-visible print:h-auto print:min-h-0 print:block print:p-0 print:bg-white scroll-smooth">
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
