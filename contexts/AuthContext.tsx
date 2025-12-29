
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
  authLoading: boolean; // True if any auth operation (initial check, login, refresh) is in progress
  isUserAuthFinished: boolean; // NEW: True once the *initial* auth check has completed
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
  const [authLoading, setAuthLoading] = useState(true); // Initial state: true, as we're loading auth
  const [isUserAuthFinished, setIsUserAuthFinished] = useState(false); // NEW: Initially false

  console.log("[AuthProvider] Component rendered. Initial authLoading:", authLoading, "isUserAuthFinished:", isUserAuthFinished);

  useEffect(() => {
    let mounted = true;
    console.log("[AuthContext] useEffect mounted, initAuth called. Mounted:", mounted);

    const initAuth = async () => {
        try {
            console.log("[AuthContext] initAuth: Calling dbService.getCurrentUser()");
            const currentUser = await dbService.getCurrentUser();
            if (mounted) {
                setUser(currentUser);
                console.log("[AuthContext] initAuth resolved. User:", currentUser ? currentUser.email : 'null');
            }
        } catch (error) {
            console.error("[AuthContext] Erro during initAuth:", error);
            if (mounted) {
                setUser(null);
            }
        } finally {
            if (mounted) {
                setAuthLoading(false); // Initial loading is done
                setIsUserAuthFinished(true); // The initial auth check is now complete
                console.log("[AuthContext] initAuth finally block. Setting authLoading to false and isUserAuthFinished to true.");
            }
        }
    };

    initAuth();

    const unsubscribe = dbService.onAuthChange(async (u) => {
      if (mounted) {
        console.log("[AuthContext] onAuthChange event. User:", u ? u.email : 'null');
        // onAuthChange updates the user, but we don't set authLoading=true here
        // as it's a passive listener, not an active operation initiated by the UI.
        // It signals that the auth state has changed, which is why we update `user`.
        setUser(u); 
        // Ensure `isUserAuthFinished` is true, as a change means state is now known.
        setIsUserAuthFinished(true); 
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
      console.log("[AuthContext] refreshUser called.");
      setAuthLoading(true); // Indicate active loading
      try {
          const currentUser = await dbService.syncSession();
          setUser(currentUser);
      } finally {
          setAuthLoading(false); // Loading complete
          console.log("[AuthContext] refreshUser finished. Setting authLoading to false.");
      }
  };

  const login = async (email: string, password?: string) => {
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] login called. Setting authLoading to true.");
    try {
        const u = await dbService.login(email, password);
        
        if (u) {
            setUser(u);
            console.log("[AuthContext] login successful. User:", u ? u.email : 'null');
            return true;
        }
        console.log("[AuthContext] login failed. No user returned.");
        return false;
    } catch (e: any) {
        console.error("[AuthContext] Login exception:", e);
        // dbService.login already throws, catch and return false to indicate failure.
        // The calling component (Login.tsx) will handle the specific error message.
        return false;
    } finally {
        setAuthLoading(false); // Loading complete
        console.log("[AuthContext] login finished. Setting authLoading to false.");
    }
  };

  async function loginSocial(provider: 'google') {
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] loginSocial called. Setting authLoading to true.");
    try {
        const { error } = await dbService.loginSocial(provider);

        if (error) {
            console.error("[AuthContext] Error in social login:", error);
            // Alert is handled by Login.tsx
            return false;
        } 
        // If successful, Supabase handles the redirect automatically.
        // The onAuthChange listener should pick it up and set user/authLoading.
        return true;
    } catch (e) {
        console.error("[AuthContext] Social login exception:", e);
        return false;
    } finally {
        // We don't setAuthLoading(false) here, as the page redirect
        // and subsequent onAuthChange will manage the state.
        console.log("[AuthContext] loginSocial finished. Redirect/onAuthChange will handle final authLoading state.");
    }
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] signup called. Setting authLoading to true.");
    try {
        const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
        if (u) {
            setUser(u);
            console.log("[AuthContext] signup successful. User:", u ? u.email : 'null');
            return true;
        }
        console.log("[AuthContext] signup failed. No user returned.");
        return false;
    } catch (e: any) {
        console.error("[AuthContext] Signup exception:", e);
        return false;
    } finally {
        setAuthLoading(false); // Loading complete
        console.log("[AuthContext] signup finished. Setting authLoading to false.");
    }
  };

  const logout = () => {
    console.log("[AuthContext] logout called.");
    dbService.logout();
    setUser(null); // Clear user immediately
    // onAuthChange will also be triggered, confirming the null user state
    setAuthLoading(false); // Explicitly set to false after logout operation
    setIsUserAuthFinished(true); // Still ready, just no user.
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      console.log("[AuthContext] updatePlan called for user:", user.email, "Plan:", plan);
      setAuthLoading(true); // Indicate active loading
      try {
          await dbService.updatePlan(user.id, plan);
          await refreshUser(); // Refresh user to get updated plan details
      } finally {
          setAuthLoading(false); // Loading complete
          console.log("[AuthContext] updatePlan finished. Setting authLoading to false.");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, isUserAuthFinished, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid, isNewAccount, trialDaysRemaining }}>
      {children}
    </AuthContext.Provider>
  );
};