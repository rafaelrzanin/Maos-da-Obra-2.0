
import React, { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { User, PlanType, DBNotification } from './types.ts';
import { dbService } from './services/db.ts';

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
  unreadNotificationsCount: number; // NEW: Unread notifications count
  refreshNotifications: () => Promise<void>; // NEW: Function to refresh notification count
  requestPushNotificationPermission: () => Promise<void>; // NEW: Function to request push permission
  pushSubscriptionStatus: 'idle' | 'prompting' | 'granted' | 'denied' | 'error'; // NEW: Status of push notifications
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Initial state: true, as we're loading auth
  const [isUserAuthFinished, setIsUserAuthFinished] = useState(false); // NEW: Initially false
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0); // NEW
  const [pushSubscriptionStatus, setPushSubscriptionStatus] = useState<'idle' | 'prompting' | 'granted' | 'denied' | 'error'>('idle'); // NEW

  console.log("[AuthProvider] Component rendered. Initial authLoading:", authLoading, "isUserAuthFinished:", isUserAuthFinished);

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

  // NEW: Push Notification Permission Logic
  const requestPushNotificationPermission = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || !user?.id) {
      console.warn("Push notifications not supported by this browser or user not logged in.");
      setPushSubscriptionStatus('error');
      return;
    }

    console.log(`[Push Notif] Current Notification.permission: ${Notification.permission}`);
    const hasPromptedOnce = localStorage.getItem('hasPromptedPushOnce');
    console.log(`[Push Notif] Has prompted before (localStorage): ${hasPromptedOnce}`);

    if (Notification.permission === 'granted') {
      setPushSubscriptionStatus('granted');
      console.log("[Push Notif] Notification permission already granted. Ensuring subscription is active.");
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          console.log("[Push Notif] No existing push subscription found, creating a new one.");
          const newSubscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY, // Use VITE_ prefix for client
          });
          await dbService.savePushSubscription(user.id, newSubscription.toJSON());
        } else {
          console.log("[Push Notif] Existing push subscription found.");
        }
      } catch (err) {
        console.error("[Push Notif] Error managing push subscription:", err);
        setPushSubscriptionStatus('error');
      }
      return;
    }

    if (Notification.permission === 'denied') {
      setPushSubscriptionStatus('denied');
      console.warn("[Push Notif] Notification permission previously denied by user.");
      return;
    }

    // Only prompt if permission is 'default' and we haven't prompted before in this session/app lifetime
    if (Notification.permission === 'default' && !hasPromptedOnce) {
      setPushSubscriptionStatus('prompting');
      console.log("[Push Notif] Requesting notification permission from user...");
      localStorage.setItem('hasPromptedPushOnce', 'true'); // Set flag immediately

      try {
        const permissionResult = await Notification.requestPermission();
        if (permissionResult === 'granted') {
          setPushSubscriptionStatus('granted');
          console.log("[Push Notif] Notification permission granted by user!");
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY, // Use VITE_ prefix for client
          });
          await dbService.savePushSubscription(user.id, subscription.toJSON());
        } else {
          setPushSubscriptionStatus('denied');
          console.warn("[Push Notif] Notification permission denied by user.");
        }
      } catch (err) {
        console.error("[Push Notif] Error requesting notification permission:", err);
        setPushSubscriptionStatus('error');
      }
    } else if (Notification.permission === 'default' && hasPromptedOnce) {
        console.log("[Push Notif] Notification permission is default, but already prompted once. Not prompting again.");
    }
  }, [user]); // Only re-create if `user` changes

  useEffect(() => {
    let mounted = true;
    console.log("[AuthContext] Main useEffect for auth setup triggered.");

    // Initial auth check
    const checkInitialAuth = async () => {
      setAuthLoading(true); // Começa com loading
      try {
        console.log("[AuthContext] checkInitialAuth: Calling dbService.getCurrentUser().");
        const currentUser = await dbService.getCurrentUser();
        if (mounted) {
          setUser(currentUser);
          if (currentUser) {
            await refreshNotifications(); // Refresh notifications on initial load
          }
        }
      } catch (error) {
        console.error("[AuthContext] Error during initial auth check:", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) {
          setAuthLoading(false); // Termina o loading inicial
          setIsUserAuthFinished(true); // Marca que a checagem inicial foi concluída
          console.log("[AuthContext] checkInitialAuth: Initial auth check finished.");
        }
      }
    };
    checkInitialAuth();


    // Supabase auth state change listener (deve rodar apenas uma vez para registrar o listener)
    const unsubscribe = dbService.onAuthChange(async (user: User | null) => {
      if (!mounted) return;

      console.log("[AuthContext] onAuthChange event received.", { user: user?.id });

      if (mounted) {
        setUser(user);
        if (user) {
          await refreshNotifications(); 
          // A chamada a requestPushNotificationPermission será feita no Dashboard
        } else {
          setUnreadNotificationsCount(0); // Limpa notificações no logout
          setPushSubscriptionStatus('idle'); // Reset push status on logout
        }
        setIsUserAuthFinished(true); // Garante que auth esteja marcado como finished após qualquer evento
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      console.log("[AuthContext] Main useEffect cleanup: Auth listener unsubscribed.");
    };
  }, [refreshNotifications]); 

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
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] login called. Setting authLoading to true.");
    try {
        const u = await dbService.login(email, password);
        
        if (u) {
            setUser(u);
            await refreshNotifications(); // Refresh notifications on successful login
            // A chamada a requestPushNotificationPermission será feita no Dashboard
            console.log("[AuthContext] login successful. User:", u ? u.email : 'null');
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

  async function loginSocial(provider: 'google') {
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] loginSocial called. Setting authLoading to true.");
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

  const signup = async (name: string, email: string, whatsapp: string, password?: string, cpf?: string, planType?: string | null) => {
    setAuthLoading(true); // Indicate active loading
    console.log("[AuthContext] signup called. Setting authLoading to true.");
    try {
        const u = await dbService.signup(name, email, whatsapp, password, cpf, planType);
        if (u) {
            setUser(u);
            await refreshNotifications(); // Refresh notifications on successful signup
            // A chamada a requestPushNotificationPermission será feita no Dashboard
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
    setUnreadNotificationsCount(0); // Clear notifications on logout
    localStorage.removeItem('hasPromptedPushOnce'); // NEW: Clear push notification prompt status on logout
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
    