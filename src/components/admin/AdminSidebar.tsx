import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Inbox,
  MessagesSquare,
  Megaphone,
  BarChart3,
  LogOut,
  Menu,
  X,
  Bell,
  MessageSquareText,
  FileText,
  Tag,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/logo.png.asset.json";
import { useAdmin } from "@/lib/admin-store";
import { setTeamMemberAvailability } from "@/lib/api/admin.functions";

export const ADMIN_NAV = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Users", to: "/admin/users", icon: Users, exact: false },
  { label: "Team Members", to: "/admin/team", icon: UserCog, exact: false },
  { label: "Requests", to: "/admin/requests", icon: Inbox, exact: false },
  { label: "Chats", to: "/admin/chats", icon: MessagesSquare, exact: false },
  { label: "Templates", to: "/admin/templates", icon: MessageSquareText, exact: false },
  { label: "Announcements", to: "/admin/news", icon: Megaphone, exact: false },
  { label: "Categories", to: "/admin/categories", icon: Tag, exact: false },
  { label: "Policies", to: "/admin/policies", icon: FileText, exact: false },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3, exact: false },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Admin navigation">
      {ADMIN_NAV.map(({ label, to, icon: Icon, exact }) => {
        const active = exact ? pathname === to : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-medium transition-colors duration-200",
              active
                ? "bg-brand/10 text-white"
                : "text-text-secondary hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon
              className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-text-muted")}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SignOutButton({ onDone }: { onDone?: () => void }) {
  const { signOut } = useAdmin();
  return (
    <button
      type="button"
      onClick={() => {
        void signOut();
        onDone?.();
      }}
      className="m-2 flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-medium text-text-secondary transition-colors duration-200 hover:bg-white/5 hover:text-white"
    >
      <LogOut className="h-4 w-4 text-text-muted" strokeWidth={1.75} aria-hidden="true" />
      Logout
    </button>
  );
}

function AvailabilitySelector() {
  const [status, setStatus] = useState<"online" | "away" | "offline">("online");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Read canonical status from team_members table, not user_metadata
    import("@/integrations/supabase/client")
      .then(({ supabase }) =>
        supabase.auth
          .getUser()
          .then(({ data }) => {
            const uid = data.user?.id;
            if (!uid) return;
            return supabase
              .from("team_members")
              .select("availability_status")
              .eq("id", uid)
              .maybeSingle()
              .then(({ data: member }) => {
                const s = member?.availability_status;
                if (s === "online" || s === "away" || s === "offline") {
                  setStatus(s);
                }
              });
          })
          .catch(console.error),
      )
      .catch(console.error);
  }, []);

  const handleChange = async (newStatus: "online" | "away" | "offline") => {
    setBusy(true);
    try {
      await setTeamMemberAvailability({ data: { status: newStatus } });
      setStatus(newStatus);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="m-2 px-3 py-2 text-xs flex items-center justify-between border border-border-subtle rounded-xl bg-bg-surface">
      <span className="text-text-secondary">Status:</span>
      <select
        className="bg-transparent text-white text-xs outline-none cursor-pointer"
        value={status}
        disabled={busy}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "online" || val === "away" || val === "offline") {
            void handleChange(val);
          }
        }}
      >
        <option value="online">Online</option>
        <option value="away">Away</option>
        <option value="offline">Offline</option>
      </select>
    </div>
  );
}

export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border-subtle bg-bg lg:flex xl:w-64">
      <div className="flex h-14 items-center gap-2 border-b border-border-subtle px-4">
        <img src={logoAsset.url} alt="Formbhro" width={120} height={32} className="h-6 w-auto" />
        <span className="rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-light">
          Admin
        </span>
      </div>
      <NavList />
      <div className="border-t border-border-subtle mt-auto">
        <AvailabilitySelector />
        <SignOutButton />
      </div>
    </aside>
  );
}

export function AdminTopbar({ title }: { title: string }) {
  const [navOpen, setNavOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const { loading } = useAdmin();
  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-border-subtle bg-bg/95 px-4 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="grid h-9 w-9 place-items-center rounded-xl border border-border-subtle text-text-secondary lg:hidden"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
        <h1 className="truncate text-sm font-semibold text-white">{title}</h1>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="relative grid h-9 w-9 place-items-center rounded-xl border border-border-subtle text-text-secondary hover:bg-white/5 hover:text-white"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" />
            </button>
            {open && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/20"
                  onClick={() => setOpen(false)}
                />
                <div className="fixed inset-x-3 top-[calc(3.75rem+env(safe-area-inset-top))] z-50 max-w-sm rounded-2xl border border-border-subtle bg-bg shadow-2xl overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-80">
                  <div className="border-b border-border-subtle px-4 py-3">
                    <h3 className="text-xs font-bold text-white">System Notifications</h3>
                  </div>
                  <div className="p-8 text-center text-[11px] text-text-muted">
                    No new system alerts.
                  </div>
                </div>
              </>
            )}
          </div>

          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-text-muted">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                loading ? "bg-amber-400" : "bg-emerald-400",
              )}
              aria-hidden="true"
            />
            {loading ? "Syncing" : "Live"}
          </span>
        </div>
      </header>

      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
            className="absolute inset-0 bg-black/70"
          />

          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border-subtle bg-bg">
            <div className="flex h-14 items-center justify-between border-b border-border-subtle px-4">
              <img
                src={logoAsset.url}
                alt="Formbhro"
                width={120}
                height={32}
                className="h-6 w-auto"
              />
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation"
                className="text-text-secondary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <NavList onNavigate={() => setNavOpen(false)} />
            <div className="border-t border-border-subtle mt-auto">
              <AvailabilitySelector />
              <SignOutButton onDone={() => setNavOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
