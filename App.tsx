import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, PlanType } from './types';
import { dbService } from './services/db';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateWork from './pages/CreateWork';
import WorkDetail from './pages/WorkDetail';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import VideoTutorials from './pages/VideoTutorials';
import Checkout from './pages/Checkout';
import Register from './pages/Register'; // <-- Linha 10: IMPORTAÇÃO CRÍTICA

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
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => dbService.getCurrentUser());
  const [loading, setLoading] = useState(true);

  const isSubscriptionValid = useMemo(() => user ? dbService.isSubscriptionActive(user) : false, [user]);

  useEffect(() => {
    const sync = async () => {
        const sbUser = await dbService.syncSession();
        if (sbUser) setUser(sbUser);
        setLoading(false);
    };
    sync();
    const unsubscribe = dbService.onAuthChange((u) => setUser(u));
    return () => { unsubscribe(); };
  }, []);

  const refreshUser = async () => {
      const currentUser = dbService.getCurrentUser();
      if (currentUser) setUser(currentUser);
  };

  const login = async (email: string, password?: string) => {
    const u = await dbService.login(email, password);
    if (u) {
        setUser(u);
        return true;
    }
    return false;
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
    if (u) {
        setUser(u);
        return true;
    }
    return false;
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
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid }}>
      {children}
    </AuthContext.Provider>
  );
};

// Layout Component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, logout, isSubscriptionValid, updatePlan } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
      const params = new URLSearchParams(location.search);
      if (params.get('status') === 'success' && user) {
          updatePlan(user.plan || PlanType.MENSAL).then(() => {
              alert("Pagamento confirmado!");
              navigate(location.pathname, { replace: true });
          });
      }
  }, [location.search, user, updatePlan, navigate, location.pathname]);

  if (loading) return null;
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
    <div className="min-h-screen bg-surface dark:bg-slate-950 flex flex-col md:flex-row font-sans text-text-body dark:text-slate-300">
      {/* Mobile Header */}
      <div className="md:hidden bg-primary dark:bg-slate-900 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-50">
        <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <span className="bg-secondary text-white w-8 h-8 rounded-lg flex items-center justify-center">
                <i className="fa-solid fa-helmet-safety text-sm"></i>
            </span>
            <span>MÃOS DA OBRA</span>
        </h1>
      </div>

      {/* Sidebar Desktop */}
      {isSubscriptionValid && (
      <aside className="hidden md:flex flex-col w-72 bg-gradient-premium text-white h-screen sticky top-0 border-r border-white/5">
        <div className="p-8 pb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center transform rotate-3 shrink-0"><i className="fa-solid fa-helmet-safety text-2xl"></i></div>
          <h1 className="font-extrabold tracking-tight leading-none text-xl">MÃOS DA<br/>OBRA</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map(item => (
              <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center p-3.5 rounded-xl text-sm font-semibold transition-all ${location.pathname === item.path ? 'bg-white/10 shadow-lg border border-white/5 relative' : 'text-slate-400 hover:text-white'}`}>
                {location.pathname === item.path && <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary"></div>}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${location.pathname === item.path ? 'bg-secondary text-white' : 'bg-white/5'}`}><i className={`fa-solid ${item.icon}`}></i></div>{item.label}
              </button>
          ))}
        </nav>
        <div className="p-4 mx-4 mb-4 rounded-2xl bg-black/20 border border-white/5">
           <div className="flex items-center gap-3 mb-4">
               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 border border-white/10 flex items-center justify-center font-bold">{user.name.charAt(0)}</div>
               <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{user.name}</p><p className="text-[10px] text-secondary font-bold">{user.plan || 'Bloqueado'}</p></div>
               <button onClick={toggleTheme} className="text-slate-400"><i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i></button>
           </div>
           <button onClick={logout} className="w-full py-2 rounded-lg bg-white/5 hover:text-red-400 text-xs font-bold transition-colors">Sair</button>
        </div>
      </aside>
      )}

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {!isSubscriptionValid && isSettingsPage && (
            <div className="bg-danger text-white p-4 rounded-xl mb-6 flex items-center justify-between shadow-lg">
                <p className="text-sm font-bold"><i className="fa-solid fa-lock mr-2"></i> Assinatura Inativa. Escolha um plano abaixo para liberar o acesso.</p>
                <button onClick={logout} className="text-xs bg-white/20 px-3 py-2 rounded-lg font-bold">Sair</button>
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
         <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} /> 
                <Route path="/checkout" element={<Checkout />} /> {/* MOVIDO PARA FORA DO LAYOUT */}
                
                {/* ROTAS PROTEGIDAS (DENTRO DO LAYOUT) */}
                <Route path="/" element={<Layout><Dashboard /></Layout>} />
                <Route path="/create" element={<Layout><CreateWork /></Layout>} />
                <Route path="/work/:id" element={<Layout><WorkDetail /></Layout>} />
                <Route path="/settings" element={<Layout><Settings /></Layout>} />
                <Route path="/profile" element={<Layout><Profile /></Layout>} />
                <Route path="/tutorials" element={<Layout><VideoTutorials /></Layout>} />
            </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};
export default App;
