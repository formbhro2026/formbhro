import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

function getCachedSession(): {
  profile: Profile | null;
  role: AppRole | null;
  userId: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY) || localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedSession(
  data: { profile: Profile | null; role: AppRole | null; userId: string } | null,
) {
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
  // If already wrapped in a parent SessionProvider (e.g. from __root.tsx), pass through transparently
  const parent = useContext(SessionContext);
  if (parent) {
    return <>{children}</>;
  }

  return <SessionProviderInner>{children}</SessionProviderInner>;
}

function SessionProviderInner({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  // In-flight deduplication ref to prevent duplicate profiles + user_roles queries
  const inFlightLoadRef = useRef<{ userId: string; promise: Promise<void> } | null>(null);
  const lastHandledUserIdRef = useRef<string | null>(null);
  const fcmInitializedUserIdRef = useRef<string | null>(null);

  const load = useCallback(async (nextUser: User | null) => {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setRole(null);
      setCachedSession(null);
      inFlightLoadRef.current = null;
      lastHandledUserIdRef.current = null;
      fcmInitializedUserIdRef.current = null;
      return;
    }

    if (inFlightLoadRef.current && inFlightLoadRef.current.userId === nextUser.id) {
      return inFlightLoadRef.current.promise;
    }

    const fetchPromise = (async () => {
      const t0 = Date.now();
      console.log(`[PERF][PROFILE] T3: Fetching profile & role for user=${nextUser.id}`);

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
      const nextRole: AppRole = roles.includes("admin")
        ? "admin"
        : roles.includes("team")
          ? "team"
          : "user";
      setRole(nextRole);

      console.log(`[PERF][ROLE] T4: Resolved role=${nextRole} in ${Date.now() - t0}ms`);

      setCachedSession({
        profile: nextProfile,
        role: nextRole,
        userId: nextUser.id,
      });

      lastHandledUserIdRef.current = nextUser.id;

      // BAN ENFORCEMENT: Immediately log out users whose profile is suspended
      if (profileResult?.data && profileResult.data.is_active === false) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setRole(null);
        setCachedSession(null);
        return;
      }
    })();

    inFlightLoadRef.current = { userId: nextUser.id, promise: fetchPromise };
    try {
      await fetchPromise;
    } finally {
      if (inFlightLoadRef.current?.userId === nextUser.id) {
        inFlightLoadRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Initial load
    const init = async () => {
      const t0 = Date.now();
      try {
        console.log("[PERF][SESSION] T2: getSession starting...");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log(`[PERF][SESSION] T2: getSession resolved in ${Date.now() - t0}ms`);

        if (active) {
          if (session?.user) {
            setUser(session.user);
            lastHandledUserIdRef.current = session.user.id;
            // Strict account isolation: Only hydrate cache if it matches the current user
            const cached = getCachedSession();
            if (cached && cached.userId === session.user.id) {
              console.log("[PERF][SESSION] Instant cache hit: unblocking UI immediately");
              setProfile(cached.profile);
              setRole(cached.role);
              // Unblock UI immediately with validated cached data
              setLoading(false);
              setInitialized(true);
              if (fcmInitializedUserIdRef.current !== session.user.id) {
                fcmInitializedUserIdRef.current = session.user.id;
                void initializeFCM(session.user.id);
              }
              // Background sync fresh data
              void load(session.user);
              return;
            } else {
              setCachedSession(null);
              if (fcmInitializedUserIdRef.current !== session.user.id) {
                fcmInitializedUserIdRef.current = session.user.id;
                void initializeFCM(session.user.id);
              }
              await load(session.user);
            }
          } else {
            setCachedSession(null);
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;

      // Skip INITIAL_SESSION as init() is already running the startup hydration
      if (event === "INITIAL_SESSION") {
        return;
      }

      if (event === "SIGNED_OUT" || !session?.user) {
        lastHandledUserIdRef.current = null;
        fcmInitializedUserIdRef.current = null;
        await load(null);
        return;
      }

      // If user is updated, or signed in as a new user, hydrate fresh profile & role
      if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        session.user.id !== lastHandledUserIdRef.current
      ) {
        await load(session.user);
      }

      // Initialize FCM token registration and notification channels idempotently
      if (session.user && fcmInitializedUserIdRef.current !== session.user.id) {
        fcmInitializedUserIdRef.current = session.user.id;
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
    inFlightLoadRef.current = null;
    lastHandledUserIdRef.current = null;
    fcmInitializedUserIdRef.current = null;
    setUser(null);
    setProfile(null);
    setRole(null);
    setCachedSession(null);
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
