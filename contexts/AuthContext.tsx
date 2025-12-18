
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { User, PlanType } from '../types.ts';
import { dbService } from '../services/db.ts';

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
    console.log("[AuthContext] useEffect mounted, initAuth called. Initial loading:", loading);

    const initAuth = async () => {
      try {
        const timeoutDuration = 10000; // 10 seconds
        const authPromise = dbService.getCurrentUser();
        
        const resultPromise = Promise.race([
            authPromise,
            new Promise<User | null | 'TIMEOUT_SIGNAL'>((resolve) => 
                setTimeout(() => resolve('TIMEOUT_SIGNAL'), timeoutDuration) 
            )
        ]);

        const result = await resultPromise;
        
        if (mounted) {
            if (result !== 'TIMEOUT_SIGNAL') {
                setUser(result); 
                console.log("[AuthContext] initAuth resolved with user:", result?.email, "Setting loading to false.");
            } else {
                console.warn(`[AuthContext] initAuth timed out after ${timeoutDuration / 1000}s. Displaying UI, awaiting onAuthChange.`);
            }
            setLoading(false); // Crucial: Stop initial loading spinner here.
        }
      } catch (error) {
        console.error("[AuthContext] Erro during initAuth:", error);
        if (mounted) {
            setUser(null);
            setLoading(false); 
        }
      }
    };

    initAuth();

    const unsubscribe = dbService.onAuthChange((u) => {
      if (mounted) {
        setUser(u);
        console.log("[AuthContext] onAuthChange event. User:", u?.email, "Current loading:", loading);
        if (loading) { // Only set loading to false if it's still true, to avoid unnecessary re-renders
            setLoading(false);
            console.log("[AuthContext] onAuthChange setting loading to false.");
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      console.log("[AuthContext] useEffect cleanup. Unsubscribed from auth changes.");
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
    console.log("[AuthContext] login called. Setting loading to true.");
    try {
        const loginPromise = dbService.login(email, password);
        // Timeout de segurança no login manual
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Tempo limite excedido. Verifique sua conexão.")), 15000)
        );
        
        const u = await Promise.race([loginPromise, timeoutPromise]) as User | null;
        
        if (u) {
            setUser(u);
            console.log("[AuthContext] login successful. User:", u?.email);
            return true;
        }
        console.log("[AuthContext] login failed.");
        return false;
    } catch (e) {
        console.error("[AuthContext] Login exception:", e);
        return false;
    } finally {
        setLoading(false);
        console.log("[AuthContext] login finished. Setting loading to false.");
    }
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    setLoading(true);
    console.log("[AuthContext] signup called. Setting loading to true.");
    try {
        const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
        if (u) {
            setUser(u);
            console.log("[AuthContext] signup successful. User:", u?.email);
            return true;
        }
        console.log("[AuthContext] signup failed.");
        return false;
    } finally {
        setLoading(false);
        console.log("[AuthContext] signup finished. Setting loading to false.");
    }
  };

  const logout = () => {
    console.log("[AuthContext] logout called.");
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
