import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, Search } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { useTeamStore } from "@/lib/team-store";
import { TeamNotificationPanel } from "@/components/team/TeamNotificationPanel";

export function TeamHeader({ title, onOpenNav }: { title?: string; onOpenNav?: () => void }) {
  const { unreadNotifications, member } = useTeamStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const unread = unreadNotifications > 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          {onOpenNav && (
            <button
              type="button"
              onClick={onOpenNav}
              aria-label="Open navigation"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle text-white hover:bg-white/5 lg:hidden"
            >
              <Menu className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <div className="hidden lg:block">
            <h1 className="text-base font-bold text-white">
              {title === "Home" ? <>Good Morning, {member?.name.split(" ")[0]} 👋</> : title}
            </h1>
            {title === "Home" && (
              <p className="text-[10px] text-text-muted">
                Here's what's happening with your assigned requests today.
              </p>
            )}
          </div>
          <Link to="/team" aria-label="Formbhro team home" className="shrink-0 lg:hidden">
            <img
              src={logoAsset.url}
              alt="Formbhro"
              width={140}
              height={40}
              className="h-6 w-auto"
            />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3 max-w-2xl">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/team/work", search: { q: query || undefined } });
            }}
            className="hidden flex-1 sm:block max-w-md"
          >
            <label htmlFor="team-global-search" className="sr-only">
              Search anything...
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                id="team-global-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anything..."
                className="h-10 w-full rounded-xl border border-border-subtle bg-surface-2 pl-9 pr-3 text-[11px] text-white placeholder:text-text-muted focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all"
              />
            </div>
          </form>

          <div className="flex items-center gap-3 border-l border-border-subtle pl-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle text-white hover:bg-white/5 transition-colors"
              >
                <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
                {unread && (
                  <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              {open && (
                <div className="fixed right-4 top-[4.5rem] z-50 sm:absolute sm:right-0 sm:top-12">
                  <TeamNotificationPanel onClose={() => setOpen(false)} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-2 py-1 pl-1 pr-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <span className="h-1 w-1 rounded-full bg-emerald-400" /> Online
              </span>
              <div className="h-4 w-px bg-border-subtle" />
              <Link to="/team/profile" className="flex items-center gap-2 group">
                <div className="grid h-7 w-7 place-items-center rounded-full border border-brand/40 bg-brand/10 text-[10px] font-bold text-brand-light">
                  {member?.initials}
                </div>
                <div className="hidden xl:block text-left">
                  <p className="text-[10px] font-bold text-white leading-tight group-hover:text-brand-light transition-colors">
                    {member?.name}
                  </p>
                  <p className="text-[9px] text-text-muted leading-tight uppercase tracking-wider">
                    {member?.role}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
