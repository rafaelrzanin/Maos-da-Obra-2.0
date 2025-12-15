
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { User, PlanType } from '../types';
import { dbService } from '../services/db';

// --- Theme Context ---
type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType>(null!);
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  trialDaysRemaining: number | null;
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Aumentado timeout para 10s para evitar logout indevido em conexões lentas ou cold start
        const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => resolve('TIMEOUT'), 10000) 
        );
        const authPromise = dbService.getCurrentUser();
        
        const result = await Promise.race([authPromise, timeoutPromise]);
        
        if (mounted) {
            if (result === 'TIMEOUT') {
                console.warn("Auth check timed out, waiting for listener...");
                // Não setamos null aqui para não forçar logout, deixamos o listener do onAuthChange resolver
            } else {
                setUser(result as User | null);
            }
        }
      } catch (error) {
        console.error("Erro auth inicial:", error);
      } finally {
        // Só removemos o loading se já tivermos uma resposta definitiva ou se o listener assumir
        if (mounted && user !== null) setLoading(false);
      }
    };

    initAuth();

    const unsubscribe = dbService.onAuthChange((u) => {
      if (mounted) {
        setUser(u);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

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

  const refreshUser = async () => {
      const currentUser = await dbService.syncSession();
      if (currentUser) setUser(currentUser);
  };

  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
        const loginPromise = dbService.login(email, password);
        // Timeout de segurança no login manual
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Tempo limite excedido. Verifique sua conexão.")), 15000)
        );
        
        const u = await Promise.race([loginPromise, timeoutPromise]) as User | null;
        
        if (u) {
            setUser(u);
            return true;
        }
        return false;
    } catch (e) {
        console.error("Login exception:", e);
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

