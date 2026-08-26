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
import { supabase } from "@/integrations/supabase/client";
import {
  ensureAdminAccount,
  listAllNotifications,
  getAdminAnalytics,
  type AdminAnalyticsStats,
} from "@/lib/api/admin.functions";
import type { Tables } from "@/integrations/supabase/types";

export type ProfileRow = Tables<"profiles">;
export type RequestRow = Tables<"requests">;
export type DocumentRow = Tables<"documents">;
export type MessageRow = Tables<"messages">;
export type NotificationRow = Tables<"notifications">;
export type ActivityRow = Tables<"activity_logs">;
export type NewsRow = Tables<"news">;
export type TeamRow = Tables<"team_members">;
export type SettingsRow = Tables<"settings">;
export type RoleRow = Tables<"user_roles">;

export interface AdminData {
  profiles: ProfileRow[];
  roles: RoleRow[];
  team: TeamRow[];
  documents: DocumentRow[];
  notifications: NotificationRow[];
  activity: ActivityRow[];
  news: NewsRow[];
  settings: SettingsRow | null;
}

const EMPTY: AdminData = {
  profiles: [],
  roles: [],
  team: [],
  documents: [],
  notifications: [],
  activity: [],
  news: [],
  settings: null,
};

interface AdminStore extends AdminData {
  ready: boolean;
  loading: boolean;
  authed: boolean;
  error: string | null;
  stats: AdminAnalyticsStats | null;
  requestsPage: RequestRow[];
  requestsTotal: number;
  fetchRequestsPage: (
    page: number,
    filters?: { status?: string[]; search?: string; limit?: number },
  ) => Promise<void>;
  signIn: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  profileOf: (id: string | null | undefined) => ProfileRow | undefined;
  roleOf: (id: string | null | undefined) => string;
}

const Ctx = createContext<AdminStore | null>(null);

async function loadAll(): Promise<AdminData> {
  const [team, activity, news, settings] = await Promise.all([
    supabase.from("team_members").select("*"),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("news").select("*").order("published_at", { ascending: false }).limit(100),
    supabase.from("settings").select("*").maybeSingle(),
  ]);

  let notifications: NotificationRow[] = [];
  try {
    notifications = (await listAllNotifications({ data: { limit: 150 } })) as NotificationRow[];
  } catch {
    notifications = [];
  }

  return {
    profiles: [], // loaded dynamically
    roles: [], // loaded dynamically
    team: team.data ?? [],
    documents: [],
    activity: activity.data ?? [],
    news: news.data ?? [],
    settings: settings.data ?? null,
    notifications,
  };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStore["stats"]>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hasLoaded, setHasLoaded] = useState(false);
  const [requestsPage, setRequestsPage] = useState<RequestRow[]>([]);
  const [requestsTotal, setRequestsTotal] = useState(0);

  const activeGen = useRef(0);
  const lastFetchParams = useRef<{ page: number; filters?: any }>({ page: 1 });

  const fetchRequestsPage = useCallback(
    async (page: number, filters?: { status?: string[]; search?: string; limit?: number }) => {
      const gen = ++activeGen.current;
      lastFetchParams.current = { page, filters };

      const limit = filters?.limit ?? 50;
      const offset = (page - 1) * limit;

      let query = supabase
        .from("requests")
        .select("*", { count: "exact" })
        .order("last_activity_at", { ascending: false });
      if (filters?.status?.length) query = query.in("status", filters.status as any[]);
      if (filters?.search)
        query = query.or(`title.ilike.%${filters.search}%,reference.ilike.%${filters.search}%`);

      const { data: fetchedData, count } = await query.range(offset, offset + limit - 1);
      if (gen !== activeGen.current) return; // guard against race conditions

      const pageRows = fetchedData ?? [];

      // dynamically fetch missing profiles and roles
      const userIds = Array.from(new Set(pageRows.map((r) => r.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const [{ data: profs }, { data: rolesData }] = await Promise.all([
          supabase.from("profiles").select("*").in("id", userIds),
          supabase.from("user_roles").select("*").in("user_id", userIds),
        ]);

        if (gen !== activeGen.current) return;

        setData((prev) => {
          let updated = false;

          const profileMap = new Map(prev.profiles.map((p) => [p.id, p]));
          if (profs) {
            for (const p of profs) {
              if (profileMap.get(p.id)?.updated_at !== p.updated_at) {
                profileMap.set(p.id, p);
                updated = true;
              }
            }
          }

          const roleMap = new Map(prev.roles.map((r) => [r.user_id, r]));
          if (rolesData) {
            for (const r of rolesData) {
              if (roleMap.get(r.user_id)?.role !== r.role) {
                roleMap.set(r.user_id, r);
                updated = true;
              }
            }
          }

          if (updated) {
            return {
              ...prev,
              profiles: Array.from(profileMap.values()),
              roles: Array.from(roleMap.values()),
            };
          }
          return prev;
        });
      }

      setRequestsPage(pageRows);
      setRequestsTotal(count ?? 0);
    },
    [],
  );

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [allData, statsData] = await Promise.all([loadAll(), getAdminAnalytics()]);
        setData((prev) => ({
          ...allData,
          profiles: prev.profiles, // preserve dynamically loaded profiles
          roles: prev.roles, // preserve dynamically loaded roles
        }));
        setStats(statsData);
        setReady(true);
        setHasLoaded(true);
        setError(null);
        // also re-fetch the current page to ensure everything is perfectly synced
        await fetchRequestsPage(lastFetchParams.current.page, lastFetchParams.current.filters);
      } catch (err) {
        console.error(err);
        setError("Failed to load admin data.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [fetchRequestsPage],
  );

  const check = useCallback(async () => {
    const { data: rpc } = await supabase.rpc("is_admin");
    const ok = rpc === true;
    setAuthed(ok);
    if (ok) await refresh();
    setReady(true);
    return ok;
  }, [refresh]);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    if (!authed) return;
    const schedulePage = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fetchRequestsPage(lastFetchParams.current.page, lastFetchParams.current.filters);
        void getAdminAnalytics().then(setStats).catch(console.error);
      }, 400);
    };

    const channel = supabase.channel("admin-live");

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "requests" },
      schedulePage,
    );

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs" }, (payload) => {
      setData((prev) => ({
        ...prev,
        activity: [payload.new as ActivityRow, ...prev.activity].slice(0, 200)
      }));
    });

    channel.on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
      setData((prev) => {
        const p = payload as any;
        if (p.eventType === "INSERT") {
          return { ...prev, notifications: [p.new as NotificationRow, ...prev.notifications].slice(0, 150) };
        } else if (p.eventType === "UPDATE") {
          return { ...prev, notifications: prev.notifications.map(n => n.id === p.new.id ? (p.new as NotificationRow) : n) };
        } else if (p.eventType === "DELETE") {
          return { ...prev, notifications: prev.notifications.filter(n => n.id !== p.old.id) };
        }
        return prev;
      });
    });

    channel.on("postgres_changes", { event: "*", schema: "public", table: "news" }, (payload) => {
      setData((prev) => {
        const p = payload as any;
        if (p.eventType === "INSERT") {
          return { ...prev, news: [p.new as NewsRow, ...prev.news].sort((a, b) => new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()).slice(0, 100) };
        } else if (p.eventType === "UPDATE") {
          return { ...prev, news: prev.news.map(n => n.id === p.new.id ? (p.new as NewsRow) : n) };
        } else if (p.eventType === "DELETE") {
          return { ...prev, news: prev.news.filter(n => n.id !== p.old.id) };
        }
        return prev;
      });
    });

    channel.on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, (payload) => {
      setData((prev) => {
        const p = payload as any;
        if (p.eventType === "INSERT") {
          return { ...prev, team: [...prev.team, p.new as TeamRow] };
        } else if (p.eventType === "UPDATE") {
          return { ...prev, team: prev.team.map(n => n.id === p.new.id ? (p.new as TeamRow) : n) };
        } else if (p.eventType === "DELETE") {
          return { ...prev, team: prev.team.filter(n => n.id !== p.old.id) };
        }
        return prev;
      });
    });
    
    channel.on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, (payload) => {
      setData((prev) => {
        const p = payload as any;
        if (p.eventType === "INSERT") {
          return { ...prev, roles: [...prev.roles.filter(r => r.user_id !== p.new.user_id), p.new as RoleRow] };
        } else if (p.eventType === "UPDATE") {
          return { ...prev, roles: prev.roles.map(r => r.id === p.new.id ? (p.new as RoleRow) : r) };
        } else if (p.eventType === "DELETE") {
          return { ...prev, roles: prev.roles.filter(n => n.id !== p.old.id) };
        }
        return prev;
      });
    });

    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (payload) => {
      setData((prev) => ({ ...prev, settings: payload.new as SettingsRow }));
    });

    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [authed, fetchRequestsPage]);

  const signIn = useCallback<AdminStore["signIn"]>(
    async (username, password) => {
      try {
        const res = await ensureAdminAccount({ data: { username: username.trim(), password } });
        if (!res.ok) return { ok: false, error: "Invalid admin credentials." };

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: res.email!,
          password: res.password!,
        });

        if (signInError) return { ok: false, error: signInError.message };

        let ok = false;
        for (let i = 0; i < 5; i++) {
          const { data: rpc } = await supabase.rpc("is_admin");
          if (rpc === true) {
            ok = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        if (ok) {
          setAuthed(true);
          await refresh();
          return { ok: true };
        }
        return { ok: false, error: "This account does not have admin access." };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Sign in failed." };
      }
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthed(false);
    setData(EMPTY);
  }, []);

  const value = useMemo<AdminStore>(() => {
    const profileMap = new Map(data.profiles.map((p) => [p.id, p]));
    const roleMap = new Map(data.roles.map((r) => [r.user_id, r.role as string]));
    return {
      ...data,
      ready,
      loading,
      authed,
      error,
      stats,
      requestsPage,
      requestsTotal,
      fetchRequestsPage,
      signIn,
      signOut,
      refresh,
      profileOf: (id) => (id ? profileMap.get(id) : undefined),
      roleOf: (id) => (id ? (roleMap.get(id) ?? "user") : "user"),
    };
  }, [
    data,
    ready,
    loading,
    authed,
    error,
    stats,
    requestsPage,
    requestsTotal,
    fetchRequestsPage,
    signIn,
    signOut,
    refresh,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
