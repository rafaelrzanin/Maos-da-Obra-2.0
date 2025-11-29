
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, PlanType } from './types';
import { dbService } from './services/db';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateWork from './pages/CreateWork';
import WorkDetail from './pages/WorkDetail';
import Settings from './pages/Settings';

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
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const currentUser = dbService.getCurrentUser();
    if (currentUser) {
        // --- FORÇAR VITALICIO SE JÁ ESTIVER LOGADO (MODO CONFIGURAÇÃO) ---
        if (currentUser.plan !== PlanType.VITALICIO) {
            currentUser.plan = PlanType.VITALICIO;
            // Atualiza o cache local para não piscar
            localStorage.setItem('maos_session_v1', JSON.stringify(currentUser));
        }
        setUser(currentUser);
    }
  }, []);

  const login = async (email: string, password?: string) => {
    const u = await dbService.login(email, password);
    if (u) {
        setUser(u);
        return true;
    }
    return false;
  };

  const signup = async (name: string, email: string, whatsapp?: string, password?: string) => {
    const u = await dbService.signup(name, email, whatsapp, password);
    if (u) setUser(u);
  };

  const logout = () => {
    dbService.logout();
    setUser(null);
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      await dbService.updatePlan(user.id, plan);
      setUser({ ...user, plan });
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updatePlan }}>
      {children}
    </AuthContext.Provider>
  );
};

// Layout Component
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return <Navigate to="/login" />;

  const navItems = [
    { label: 'Painel', path: '/', icon: 'fa-house' },
    { label: 'Nova Obra', path: '/create', icon: 'fa-plus' },
    { label: 'Meu Plano', path: '/settings', icon: 'fa-id-card' },
  ];

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 flex flex-col md:flex-row font-sans text-text-body dark:text-slate-300 transition-colors duration-200 print:block print:bg-white">
      {/* Mobile Header */}
      <div className="md:hidden bg-primary dark:bg-slate-900 text-white p-4 flex justify-between items-center shadow-md print:hidden">
        <h1 className="font-bold text-lg tracking-tight"><i className="fa-solid fa-helmet-safety mr-2"></i>MÃOS DA OBRA</h1>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="text-white opacity-80 hover:opacity-100">
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button onClick={logout} className="text-white opacity-80 hover:opacity-100"><i className="fa-solid fa-right-from-bracket"></i></button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-primary dark:bg-slate-900 text-white h-screen sticky top-0 shadow-xl z-50 transition-colors duration-200 print:hidden">
        <div className="p-6 border-b border-primary-dark dark:border-slate-800 flex items-center">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white mr-3 shadow-inner">
             <i className="fa-solid fa-helmet-safety text-xl"></i>
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight leading-tight">MÃOS DA<br/>OBRA</h1>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 mt-2">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center p-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? 'bg-success text-white shadow-lg' 
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <i className={`fa-solid ${item.icon} w-6 text-center mr-2 ${isActive ? 'text-white' : 'opacity-70'}`}></i>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Dark Mode Toggle Desktop */}
        <div className="px-4 pb-2">
           <button 
             onClick={toggleTheme}
             className="w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors"
           >
             <div className="flex items-center">
               <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} w-6 text-center mr-2`}></i>
               <span>Modo {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
             </div>
             <div className={`w-8 h-4 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-success' : 'bg-slate-600'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${theme === 'dark' ? 'left-4.5' : 'left-0.5'}`} style={{ left: theme === 'dark' ? '18px' : '2px' }}></div>
             </div>
           </button>
        </div>

        <div className="p-4 border-t border-primary-dark dark:border-slate-800 bg-primary-dark/30 dark:bg-slate-800/30">
          <div className="flex items-center mb-3">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-white font-bold mr-3 border-2 border-primary">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.plan.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="w-full text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200 p-2 rounded text-left flex items-center transition-colors"
          >
            <i className="fa-solid fa-right-from-bracket mr-2"></i> Sair da conta
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-auto min-h-[calc(100vh-64px)] md:min-h-screen bg-surface dark:bg-slate-950 transition-colors duration-200 print:overflow-visible print:h-auto print:min-h-0 print:block print:p-0 print:bg-white">
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
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
};

export default App;
