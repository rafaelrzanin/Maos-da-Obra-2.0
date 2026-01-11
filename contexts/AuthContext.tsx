
import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, useRef } from 'react';
import { User, PlanType, DBNotification } from '../types.ts';
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
  signup: (name: string, email: string, whatsapp: string, password?: string, cpf?: string) => Promise<boolean>; // REMOVED planType
  logout: () => void;
  updatePlan: (plan: PlanType) => Promise<void>;
  refreshUser: () => Promise<void>;
  isSubscriptionValid: boolean;
  isNewAccount: boolean;
  trialDaysRemaining: number | null;
  unreadNotificationsCount: number; // NEW: Unread notifications count
  refreshNotifications: () => Promise<void>; // NEW: Function to refresh notification count
  requestPushNotificationPermission: () => Promise<void>; // NEW: Function to request push permission
  pushSubscriptionStatus: 'idle' | 'prompting' | 'granted' | 'denied' | 'error'; // NEW: Status of push notifications
}

const AuthContext = createContext<AuthContextType | null>(null); // CRITICAL FIX: Allow null initially
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Em desenvolvimento, lança um erro claro.
    // FIX CRÍTICO: Usar import.meta.env.DEV para garantir que o erro só seja lançado em modo dev.
    if (import.meta.env.DEV) {
      throw new Error('useAuth must be used within an AuthProvider');
    }
    // Em produção, retorna um objeto seguro (fallback) para evitar crashes.
    console.error('AuthContext used outside AuthProvider in production. Returning fallback values.');
    return {
      user: null,
      authLoading: false,
      isUserAuthFinished: true, // Assume finished to avoid infinite loading
      login: async () => false,
      signup: async () => false,
      logout: () => {},
      updatePlan: async () => {},
      refreshUser: async () => {},
      isSubscriptionValid: false,
      isNewAccount: true,
      trialDaysRemaining: null,
      unreadNotificationsCount: 0,
      refreshNotifications: async () => {},
      requestPushNotificationPermission: async () => {},
      pushSubscriptionStatus: 'idle',
    };
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Initial state: true, as we're loading auth
  const [isUserAuthFinished, setIsUserAuthFinished] = useState(false); // NEW: Initially false
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0); // NEW
  const [pushSubscriptionStatus, setPushSubscriptionStatus] = useState<'idle' | 'prompting' | 'granted' | 'denied' | 'error'>('idle'); // NEW

  // NEW: Refs for push notification logic
  const promptCountRef = useRef(0);
  const MAX_PROMPT_ATTEMPTS = 3;

  console.log("[AuthContext] Render AuthProvider:", { authLoading, isUserAuthFinished, user: user?.id });

  // Add more verbose logging for state changes
  useEffect(() => {
    console.log("[AuthContext] State Change: authLoading =", authLoading);
  }, [authLoading]);

  useEffect(() => {
    console.log("[AuthContext] State Change: isUserAuthFinished =", isUserAuthFinished);
  }, [isUserAuthFinished]);

  useEffect(() => {
    console.log("[AuthContext] State Change: user =", user?.id);
  }, [user]);


  const refreshNotifications = useCallback(async () => {
    console.log("[AuthContext] refreshNotifications triggered. User:", user?.id);
    if (user?.id) {
      try {
        const notifications = await dbService.getNotifications(user.id);
        setUnreadNotificationsCount(notifications.length);
        console.log(`[AuthContext] Unread notifications count: ${notifications.length}`);
      } catch (error) {
        console.error("Error refreshing notifications:", error);
        setUnreadNotificationsCount(0);
      }
    } else {
      setUnreadNotificationsCount(0);
    }
  }, [user]); // Depends on `user`

  // Helper to manage the actual push subscription process (getting/subscribing and saving to DB)
  const ensurePushSubscription = useCallback(async (): Promise<void> => {
    if (!user?.id || !('serviceWorker' in navigator) || !('Notification' in window)) {
      console.warn("[AuthContext - ensurePushSubscription] Prerequisites not met for subscription.");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        console.log("[AuthContext - ensurePushSubscription] No existing subscription, attempting to create one.");
        // Ensure VAPID_PUBLIC_KEY is correctly defined in vite.config.ts and available
        const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!applicationServerKey) {
            console.error("VITE_VAPID_PUBLIC_KEY is not defined. Cannot subscribe to push notifications.");
            setPushSubscriptionStatus('error');
            return;
        }
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey,
        });
        console.log("[AuthContext - ensurePushSubscription] New subscription created.");
      } else {
        console.log("[AuthContext - ensurePushSubscription] Existing subscription found.");
      }

      await dbService.savePushSubscription(user.id, subscription.toJSON());
      setPushSubscriptionStatus('granted');
      console.log("[AuthContext - ensurePushSubscription] Push subscription saved to DB.");

    } catch (err) {
      console.error("[AuthContext - ensurePushSubscription] Error managing push subscription:", err);
      setPushSubscriptionStatus('error');
    }
  }, [user]); // Only depends on user

  // NEW: Push Notification Permission Logic
  const requestPushNotificationPermission = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !user?.id) {
      console.warn("Push notifications not supported by this browser or user not logged in.");
      setPushSubscriptionStatus('error');
      return;
    }

    console.log(`[AuthContext - Push Notif] Current Notification.permission: ${Notification.permission}`);
    const hasPromptedOnce = localStorage.getItem('hasPromptedPushOnce');
    console.log(`[AuthContext - Push Notif] Has prompted before (localStorage): ${hasPromptedOnce}`);

    if (Notification.permission === 'granted') {
      setPushSubscriptionStatus('granted');
      console.log("[AuthContext - Push Notif] Notification permission already granted. Ensuring subscription is active.");
      await ensurePushSubscription(); // Call helper
      return;
    }

    if (Notification.permission === 'denied') {
      setPushSubscriptionStatus('denied');
      console.warn("[AuthContext - Push Notif] Notification permission previously denied by user.");
      return;
    }

    // Only prompt if permission is 'default' and we haven't prompted before in this session/app lifetime
    // And if we are within the maximum number of prompt attempts
    if (Notification.permission === 'default' && !hasPromptedOnce && (promptCountRef.current < MAX_PROMPT_ATTEMPTS)) {
      setPushSubscriptionStatus('prompting');
      try {
        const permissionResult = await Notification.requestPermission();
        localStorage.setItem('hasPromptedPushOnce', 'true'); // Set flag immediately after asking
        if (permissionResult === 'granted') {
          setPushSubscriptionStatus('granted');
          console.log("[AuthContext - Push Notif] Notification permission granted by user!");
          await ensurePushSubscription(); // Call helper
        } else {
          setPushSubscriptionStatus('denied');
          console.warn("[AuthContext - Push Notif] Notification permission denied by user.");
        }
      } catch (err) {
        console.error("[AuthContext - Push Notif] Error requesting notification permission:", err);
        setPushSubscriptionStatus('error');
      } finally {
        promptCountRef.current++; // Increment count regardless of outcome
      }
    } else if (Notification.permission === 'default' && hasPromptedOnce) {
        console.log("[AuthContext - Push Notif] Notification permission is default, but already prompted once. Not prompting again.");
    }
  }, [user, ensurePushSubscription, promptCountRef, MAX_PROMPT_ATTEMPTS]); // Dependencies corrected

  useEffect(() => {
    let mounted = true;
    console.log("[AuthContext] Main useEffect for auth setup triggered.");

    // Initial auth check
    const checkInitialAuth = async () => {
      console.log("[AuthContext - checkInitialAuth] Starting initial auth check.");
      setAuthLoading(true); // Começa com loading
      try {
        console.log("[AuthContext - checkInitialAuth] Calling dbService.getCurrentUser().");
        const currentUser = await dbService.getCurrentUser();
        if (mounted) {
          setUser(currentUser);
          if (currentUser) {
            console.log("[AuthContext - checkInitialAuth] User found, refreshing notifications.");
            await refreshNotifications(); // Refresh notifications on initial load
          } else {
            console.log("[AuthContext - checkInitialAuth] No user found.");
          }
        }
      } catch (error) {
        console.error("[AuthContext - checkInitialAuth] Error during initial auth check:", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          setAuthLoading(false); // Termina o loading inicial
          setIsUserAuthFinished(true); // Marca que a checagem inicial foi concluída
          console.log("[AuthContext - checkInitialAuth] Initial auth check finished. authLoading=false, isUserAuthFinished=true.");
        }
      }
    };
    checkInitialAuth();


    // Supabase auth state change listener (deve rodar apenas uma vez para registrar o listener)
    // FIX: dbService.onAuthChange now directly returns the unsubscribe function.
    const unsubscribe = dbService.onAuthChange(async (userFromDbService: User | null) => {
      if (!mounted) return;

      // The dbService.onAuthChange already handles session and ensures the user profile.
      // We just receive the final User | null object here.
      console.log(`[AuthContext] onAuthChange event received from dbService. User: ${userFromDbService?.id || 'null'}.`);

      if (mounted) {
        setUser(userFromDbService); // This will trigger user useEffect
        if (userFromDbService) {
          console.log("[AuthContext - onAuthChange] User updated, refreshing notifications.");
          await refreshNotifications(); 
          // A chamada a requestPushNotificationPermission será feita no Dashboard
        } else {
          console.log("[AuthContext - onAuthChange] No user after auth change (logout/no session). Clearing notifications and resetting push status.");
          setUnreadNotificationsCount(0); // Limpa notificações no logout
          setPushSubscriptionStatus('idle'); // Reset push status on logout
        }
        // Always set these to false/true at the end of onAuthChange to signify auth state is stable.
        setAuthLoading(false); 
        setIsUserAuthFinished(true); 
        console.log("[AuthContext - onAuthChange] Auth change handler finished. authLoading=false, isUserAuthFinished=true.");
      }
    });

    return () => {
      mounted = false;
      unsubscribe(); // Now this is correctly calling the unsubscribe function
      console.log("[AuthContext] Main useEffect cleanup: Auth listener unsubscribed.");
    };
  }, []); // CRITICAL FIX: Empty dependency array to ensure this effect runs only once on mount.

  // Defensive check added here for isSubscriptionValid
  const isSubscriptionValid = useMemo(() => {
      if (!user) return false;
      // Defensive check: ensure dbService.isSubscriptionActive is actually a function
      if (typeof dbService.isSubscriptionActive === 'function') {
          return dbService.isSubscriptionActive(user);
      }
      // Log a warning if the function is missing (should not happen with correct dbService setup)
      console.warn("[AuthContext] dbService.isSubscriptionActive is not a function. Returning false for subscription validity.");
      return false; // Safe fallback
  }, [user]);

  const isNewAccount = useMemo(() => user ? !user.plan : true, [user]); // Changed from subscriptionExpiresAt to plan
  
  const trialDaysRemaining = useMemo(() => {
      if (user?.isTrial && user.subscriptionExpiresAt) {
          const now = new Date();
          now.setHours(0, 0, 0, 0); // Normalize to start of day
          const expires = new Date(user.subscriptionExpiresAt);
          expires.setHours(0, 0, 0, 0); // Normalize to start of day

          const diffTime = expires.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          return Math.max(0, diffDays); // Ensure it's not negative
      }
      return null;
  }, [user]);

  const refreshUser = async () => {
      console.log("[AuthContext] refreshUser called.");
      setAuthLoading(true); // Indicate active loading
      try {
          const currentUser = await dbService.syncSession();
          if (currentUser) {
            setUser(currentUser);
            await refreshNotifications(); // Refresh notifications after user data is refreshed
            // A chamada a requestPushNotificationPermission será feita no Dashboard
          } else {
            setUser(null); // Clear user if session sync fails
            setUnreadNotificationsCount(0); // Clear notifications
            setPushSubscriptionStatus('idle'); // Reset push status
          }
      } finally {
          setAuthLoading(false); // Loading complete
          console.log("[AuthContext] refreshUser finished. Setting authLoading to false.");
      }
  };

  const login = async (email: string, password?: string) => {
    console.log("[AuthContext] login called.");
    setAuthLoading(true); // Indicate active loading
    try {
        const success = await dbService.login(email, password);
        
        if (success) {
            // The `dbService.login` returns a boolean. The actual user object will be set by the onAuthChange listener.
            await refreshNotifications(); // Refresh notifications on successful login
            // A chamada a requestPushNotificationPermission será feita no Dashboard
            console.log("[AuthContext] login successful."); // Adjusted log
            return true;
        }
        console.log("[AuthContext] login failed. No user returned.");
        return false;
    } catch (e: any) {
        console.error("[AuthContext] Login exception:", e);
        return false;
    } finally {
        setAuthLoading(false); // Loading complete
        console.log("[AuthContext] login finished. Setting authLoading to false.");
    }
  };

  // This function might not be directly used in the current UI (Login.tsx uses dbService directly for social)
  // but keeping it for completeness if a button calls it
  async function loginSocial(provider: 'google') {
    console.log("[AuthContext] loginSocial called.");
    setAuthLoading(true); // Indicate active loading
    try {
        const { error } = await dbService.loginSocial(provider);

        if (error) {
            console.error("[AuthContext] Error in social login:", error);
            return false;
        } 
        return true;
    } catch (e) {
        console.error("[AuthContext] Social login exception:", e);
        return false;
    } finally {
        setAuthLoading(false); // Ensure loading is set to false in finally block
        console.log("[AuthContext] loginSocial finished. Redirect/onAuthChange will handle final authLoading state.");
    }
  };

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string) => { // REMOVED planType parameter
    console.log("[AuthContext] signup called.");
    setAuthLoading(true); // Indicate active loading
    try {
        const success = await dbService.signup(name, email, whatsapp, password, cpf); // REMOVED planType argument
        if (success) {
            // The `dbService.signup` returns a boolean. The actual user object will be set by the onAuthChange listener.
            await refreshNotifications(); // Refresh notifications on successful signup
            // A chamada a requestPushNotificationPermission será feita no Dashboard
            console.log("[AuthContext] signup successful."); // Adjusted log
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
    // 1. Immediately update local state to reflect logout and trigger loading state
    setUser(null); 
    setAuthLoading(true); 
    setIsUserAuthFinished(false);
    setUnreadNotificationsCount(0); // Clear notifications on logout
    localStorage.removeItem('hasPromptedPushOnce'); // Clear push notification prompt status on logout
    setPushSubscriptionStatus('idle'); // Reset push status on logout

    // 2. Perform the actual backend logout, which will trigger onAuthChange listener
    dbService.logout();
    
    console.log("[AuthContext] logout initiated. Auth states reset to loading/null.");
  };

  const updatePlan = async (plan: PlanType) => {
    if (user) {
      console.log("[AuthContext] updatePlan called for user:", user.email, "Plan:", plan);
      setAuthLoading(true); // Indicate active loading
      try {
          await dbService.updatePlan(user.id, plan);
          await refreshUser(); // Refresh user to get updated plan details
          await refreshNotifications(); // NEW: Refresh notifications after plan update
      } finally {
          setAuthLoading(false); // Loading complete
          console.log("[AuthContext] updatePlan finished. Setting authLoading to false.");
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, isUserAuthFinished, login, signup, logout, updatePlan, refreshUser, isSubscriptionValid, isNewAccount, trialDaysRemaining, unreadNotificationsCount, refreshNotifications, requestPushNotificationPermission, pushSubscriptionStatus }}>
      {children}
    </AuthContext.Provider>
  );
};
