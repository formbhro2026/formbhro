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
  requests: RequestRow[];
  documents: DocumentRow[];
  notifications: NotificationRow[];
  activity: ActivityRow[];
  news: NewsRow[];
  settings: SettingsRow | null;
  rooms: Tables<"chat_rooms">[];
}

const EMPTY: AdminData = {
  profiles: [],
  roles: [],
  team: [],
  requests: [],
  documents: [],
  notifications: [],
  activity: [],
  news: [],
  settings: null,
  rooms: [],
};

interface AdminStore extends AdminData {
  ready: boolean;
  loading: boolean;
  authed: boolean;
  error: string | null;
  stats: {
    requests: { total: number; pending: number; completed: number };
    users: number;
    team: number;
    documents: number;
  } | null;
  signIn: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refresh: (silent?: boolean) => Promise<void>;
  profileOf: (id: string | null | undefined) => ProfileRow | undefined;
  roleOf: (id: string | null | undefined) => string;
}

const Ctx = createContext<AdminStore | null>(null);

async function loadAll(): Promise<AdminData> {
  const [profiles, roles, team, requests, activity, news, settings, rooms] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("user_roles").select("*"),
    supabase.from("team_members").select("*"),
    supabase.from("requests").select("*").order("last_activity_at", { ascending: false }),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("news").select("*").order("published_at", { ascending: false }),
    supabase.from("settings").select("*").maybeSingle(),
    supabase.from("chat_rooms").select("*"),
  ]);

  let notifications: NotificationRow[] = [];
  try {
    notifications = (await listAllNotifications({ data: { limit: 150 } })) as NotificationRow[];
  } catch {
    notifications = [];
  }

  // Ensure every auth user has a profile and role record for admin visibility.
  // In development, the 'profiles' table might lag behind auth.users.
  return {
    profiles: profiles.data ?? [],
    roles: roles.data ?? [],
    team: team.data ?? [],
    requests: requests.data ?? [],
    documents: [], // Disabled for admin privacy
    activity: activity.data ?? [],
    news: news.data ?? [],
    settings: settings.data ?? null,
    rooms: rooms.data ?? [],
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

  const refresh = useCallback(async (silent = false) => {
    // Silent refresh: don't show loading spinner (used for real-time updates)
    if (!silent) setLoading(true);
    try {
      const [allData, statsData] = await Promise.all([loadAll(), getAdminAnalytics()]);
      setData(allData);
      setStats(statsData);
      setError(null);
      setHasLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load admin data");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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

  // Realtime: any change in the platform refreshes the admin snapshot (debounced).
  useEffect(() => {
    if (!authed) return;
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      // Use silent=true so the UI doesn't flicker on real-time updates
      timer.current = setTimeout(() => void refresh(true), 400);
    };
    const channel = supabase.channel("admin-live");
    const tables = [
      "requests",
      "messages",
      "documents",
      "notifications",
      "profiles",
      "user_roles",
      "team_members",
      "activity_logs",
      "news",
      "chat_rooms",
      "settings",
    ];

    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [authed, refresh]);

  const signIn = useCallback<AdminStore["signIn"]>(
    async (username, password) => {
      try {
        const res = await ensureAdminAccount({ data: { username: username.trim(), password } });
        if (!res.ok) return { ok: false, error: "Invalid admin credentials." };

        // Use standard signInWithPassword to establish the session.
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: res.email!,
          password: res.password!,
        });

        if (signInError) return { ok: false, error: signInError.message };

        // Wait for the session to be reflected.
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
      signIn,
      signOut,
      refresh,
      profileOf: (id) => (id ? profileMap.get(id) : undefined),
      roleOf: (id) => (id ? (roleMap.get(id) ?? "user") : "user"),
    };
  }, [data, ready, loading, authed, error, stats, signIn, signOut, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
