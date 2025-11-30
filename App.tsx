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
    if (currentUser) setUser(currentUser);
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
    { label: 'Painel Geral', path: '/', icon: 'fa-house' },
    { label: 'Nova Obra', path: '/create', icon: 'fa-plus' },
    { label: 'Assinatura', path: '/settings', icon: 'fa-id-card' },
  ];

  return (
    <div className="min-h-screen bg-surface dark:bg-slate-950 flex flex-col md:flex-row font-sans text-text-body dark:text-slate-300 transition-colors duration-300 print:block print:bg-white">
      
      {/* Mobile Header (Premium Dark) */}
      <div className="md:hidden bg-primary dark:bg-black text-white p-4 flex justify-between items-center shadow-md print:hidden z-50 sticky top-0 border-b border-white/5">
        <h1 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <span className="bg-secondary text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-glow">
                <i className="fa-solid fa-helmet-safety text-sm"></i>
            </span>
            <span>MÃOS DA OBRA</span>
        </h1>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-secondary hover:bg-white/20 transition-colors">
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <button onClick={logout} className="text-slate-400 hover:text-white transition-colors"><i className="fa-solid fa-right-from-bracket"></i></button>
        </div>
      </div>

      {/* Sidebar (Desktop Premium) */}
      <aside className="hidden md:flex flex-col w-72 bg-gradient-premium text-white h-screen sticky top-0 shadow-2xl z-50 transition-colors duration-300 print:hidden border-r border-white/5">
        
        {/* Logo Area */}
        <div className="p-8 pb-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-gold rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20 transform rotate-3">
             <i className="fa-solid fa-helmet-safety text-2xl"></i>
          </div>
          <div>
            <h1 className="font-extrabold text-white tracking-tight leading-none text-xl">MÃOS DA<br/>OBRA</h1>
            <p className="text-[10px] text-secondary tracking-widest uppercase font-bold mt-1">Premium Edition</p>
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
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
};

export default App;