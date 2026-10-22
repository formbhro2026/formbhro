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
import { initializeFCM, deleteFCMToken, resetFCMInitialization, isCapacitor } from "@/lib/fcm";

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
    const raw = localStorage.getItem(CACHE_KEY) || sessionStorage.getItem(CACHE_KEY);
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
      resetFCMInitialization();
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
      const lastWorkspace =
        typeof window !== "undefined" ? localStorage.getItem("formbhro:last_workspace") : null;
      let nextRole: AppRole = "user";
      if (lastWorkspace === "team" && roles.includes("team")) {
        nextRole = "team";
      } else if (lastWorkspace === "admin" && roles.includes("admin")) {
        nextRole = "admin";
      } else if (roles.includes("admin")) {
        nextRole = "admin";
      } else if (roles.includes("team")) {
        nextRole = "team";
      }
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
        let {
          data: { session },
        } = await supabase.auth.getSession();

        // On cold start / app resume from background, if getSession is momentarily empty, retry briefly
        if (!session) {
          await new Promise((r) => setTimeout(r, 120));
          const retry = await supabase.auth.getSession();
          if (retry.data?.session) {
            session = retry.data.session;
          }
        }
        console.log(
          `[PERF][SESSION] T2: getSession resolved in ${Date.now() - t0}ms, user=${session?.user?.id ?? "none"}`,
        );

        if (active) {
          if (session?.user) {
            setUser(session.user);
            lastHandledUserIdRef.current = session.user.id;
            // Strict account isolation: Only hydrate cache if it matches the current user
            const ensureUserFCMToken = (uid: string) => {
              void initializeFCM(uid).then((success) => {
                if (success) {
                  fcmInitializedUserIdRef.current = uid;
                } else {
                  setTimeout(() => {
                    if (lastHandledUserIdRef.current === uid && fcmInitializedUserIdRef.current !== uid) {
                      void initializeFCM(uid).then((retrySuccess) => {
                        if (retrySuccess) fcmInitializedUserIdRef.current = uid;
                      });
                    }
                  }, 2500);
                }
              });
            };

            const cached = getCachedSession();
            if (cached && cached.userId === session.user.id) {
              console.log("[PERF][SESSION] Instant cache hit: unblocking UI immediately");
              setProfile(cached.profile);
              setRole(cached.role);
              // Unblock UI immediately with validated cached data
              setLoading(false);
              setInitialized(true);
              if (fcmInitializedUserIdRef.current !== session.user.id) {
                ensureUserFCMToken(session.user.id);
              }
              // Background sync fresh data
              void load(session.user);
              return;
            } else {
              if (fcmInitializedUserIdRef.current !== session.user.id) {
                ensureUserFCMToken(session.user.id);
              }
              await load(session.user);
            }
          } else {
            const cached = getCachedSession();
            if (!cached) {
              setCachedSession(null);
              await load(null);
            }
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

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && lastHandledUserIdRef.current) {
        void initializeFCM(lastHandledUserIdRef.current).then((success) => {
          if (success) fcmInitializedUserIdRef.current = lastHandledUserIdRef.current;
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        lastHandledUserIdRef.current = null;
        fcmInitializedUserIdRef.current = null;
        await load(null);
        return;
      }

      // If user is updated, or initial session recovered from disk, or signed in as new user:
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED" ||
        session.user.id !== lastHandledUserIdRef.current
      ) {
        setUser(session.user);
        await load(session.user);
        setLoading(false);
        setInitialized(true);
      }

      // Initialize FCM token registration and notification channels idempotently
      if (session.user && fcmInitializedUserIdRef.current !== session.user.id) {
        void initializeFCM(session.user.id).then((success) => {
          if (success) fcmInitializedUserIdRef.current = session.user.id;
        });
      }
    });

    const onFcmTokenReady = () => {
      if (lastHandledUserIdRef.current) {
        void initializeFCM(lastHandledUserIdRef.current).then((success) => {
          if (success) fcmInitializedUserIdRef.current = lastHandledUserIdRef.current;
        });
      }
    };
    window.addEventListener("formbhro:fcm_token_ready", onFcmTokenReady);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("formbhro:fcm_token_ready", onFcmTokenReady);
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
    resetFCMInitialization();
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
