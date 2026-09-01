import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Profile } from "@/lib/api/types";
import { initializeFCM, deleteFCMToken, isCapacitor } from "@/lib/fcm";

type SessionValue = {
  loading: boolean;
  initialized: boolean;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

const CACHE_KEY = "formbhro:auth_session_cache";

function getCachedSession(): { profile: Profile | null; role: AppRole | null; userId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedSession(data: { profile: Profile | null; role: AppRole | null; userId: string } | null) {
  if (typeof window === "undefined") return;
  try {
    if (!data) {
      sessionStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_KEY);
    } else {
      const json = JSON.stringify(data);
      sessionStorage.setItem(CACHE_KEY, json);
      localStorage.setItem(CACHE_KEY, json);
    }
  } catch {}
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const cached = getCachedSession();
  const [loading, setLoading] = useState(!cached);
  const [initialized, setInitialized] = useState(Boolean(cached));
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(cached?.profile ?? null);
  const [role, setRole] = useState<AppRole | null>(cached?.role ?? null);

  const load = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setRole(null);
      setCachedSession(null);
      return;
    }
    let retries = 2;
    let profileResult, rolesResult;

    while (retries > 0) {
      [profileResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", nextUser.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", nextUser.id),
      ]);

      if (!profileResult.error && !rolesResult.error) {
        break;
      }

      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const nextProfile = profileResult?.data ?? null;
    setProfile(nextProfile);
    const roles = (rolesResult?.data ?? []).map((r) => r.role);
    if (rolesResult?.error) console.error("[Session] roles error:", rolesResult.error);
    const nextRole: AppRole = roles.includes("admin") ? "admin" : roles.includes("team") ? "team" : "user";
    setRole(nextRole);

    setCachedSession({
      profile: nextProfile,
      role: nextRole,
      userId: nextUser.id,
    });

    // BAN ENFORCEMENT: Immediately log out users whose profile is suspended
    if (profileResult?.data && profileResult.data.is_active === false) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setRole(null);
      setCachedSession(null);
      return;
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Initial load
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (active) {
          if (session?.user) {
            setUser(session.user);
            void initializeFCM(session.user.id);
            // Quick background sync
            void load(session.user);
          } else {
            await load(null);
          }
        }
      } catch (e) {
        console.error("[Session] Init error:", e);
      } finally {
        if (active) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;

      await load(session?.user ?? null);

      // Initialize FCM token registration and notification channels
      if (session?.user) {
        void initializeFCM(session.user.id);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    await load(data.user ?? null);
  }, [load]);

  const signOut = useCallback(async () => {
    // Remove FCM device token before signing out (stops push notifications to this device)
    if (isCapacitor()) {
      await deleteFCMToken();
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ loading, initialized, user, profile, role, refresh, signOut }),
    [loading, initialized, user, profile, role, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
