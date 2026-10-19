import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, Search, ChevronDown, X } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { useTeamStore } from "@/lib/team-store";
import { TeamNotificationPanel } from "@/components/team/TeamNotificationPanel";
import { PresenceDot } from "@/components/team/PresenceDot";
import { cn } from "@/lib/utils";

export function TeamHeader({ title, onOpenNav }: { title?: string; onOpenNav?: () => void }) {
  const { unreadNotifications, member, availabilityStatus, setAvailabilityStatus } = useTeamStore();
  const [open, setOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const unread = unreadNotifications > 0;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setMobileSearchOpen(false);
    void navigate({ to: "/team/work", search: { q: query.trim() } });
  };

  return (
    <header
      className={cn(
        "sticky top-0 border-b border-border-subtle bg-bg/85 backdrop-blur-xl pt-[env(safe-area-inset-top)] transition-all",
        open ? "z-[60]" : "z-30",
      )}
    >
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
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

        <div className="flex flex-1 items-center justify-end gap-2.5 max-w-2xl">
          {/* Desktop Search Bar */}
          <form
            role="search"
            onSubmit={handleSearchSubmit}
            className="hidden flex-1 sm:block max-w-md"
          >
            <label htmlFor="team-global-search" className="sr-only">
              Search chats by ID or User...
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
                placeholder="Search Chat ID (FRM-XXXX), User ID, name..."
                className="h-10 w-full rounded-xl border border-border-subtle bg-surface-2 pl-9 pr-3 text-[11px] text-white placeholder:text-text-muted focus:border-brand/50 focus:ring-1 focus:ring-brand/20 transition-all outline-none"
              />
            </div>
          </form>

          {/* Mobile Search Button */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen((o) => !o)}
            aria-label="Search chats"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle text-text-muted hover:text-white hover:bg-white/5 sm:hidden transition-colors"
          >
            <Search className="h-4.5 w-4.5" />
          </button>

          <div className="flex items-center gap-2.5 border-l border-border-subtle pl-2.5">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle text-white hover:bg-white/5 transition-colors"
                title="Notifications"
              >
                <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
                {unread && (
                  <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                    {unreadNotifications}
                  </span>
                )}
              </button>
              {open && <TeamNotificationPanel onClose={() => setOpen(false)} />}
            </div>

            {/* Live Presence Status Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStatusMenu((o) => !o)}
                className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 py-1.5 pl-2.5 pr-2 hover:border-brand/40 transition-colors"
                title="Change Availability Status"
              >
                <PresenceDot
                  availability={availabilityStatus}
                  lastSeenAt={new Date().toISOString()}
                  showLabel
                />
                <ChevronDown className="h-3 w-3 text-text-muted" />
              </button>

              {showStatusMenu && (
                <div className="absolute right-0 top-full mt-2 z-50 w-36 rounded-2xl border border-border-subtle bg-surface-1 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      void setAvailabilityStatus("online");
                      setShowStatusMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      availabilityStatus === "online"
                        ? "bg-emerald-500/15 text-emerald-400 font-bold"
                        : "text-text-secondary hover:text-white hover:bg-surface-2",
                    )}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Online</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setAvailabilityStatus("away");
                      setShowStatusMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      availabilityStatus === "away"
                        ? "bg-amber-400/15 text-amber-400 font-bold"
                        : "text-text-secondary hover:text-white hover:bg-surface-2",
                    )}
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span>Away</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setAvailabilityStatus("busy");
                      setShowStatusMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      availabilityStatus === "busy"
                        ? "bg-red-400/15 text-red-400 font-bold"
                        : "text-text-secondary hover:text-white hover:bg-surface-2",
                    )}
                  >
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <span>Busy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void setAvailabilityStatus("offline");
                      setShowStatusMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors",
                      availabilityStatus === "offline"
                        ? "bg-zinc-500/15 text-zinc-300 font-bold"
                        : "text-text-secondary hover:text-white hover:bg-surface-2",
                    )}
                  >
                    <span className="h-2 w-2 rounded-full bg-zinc-400" />
                    <span>Offline</span>
                  </button>
                </div>
              )}
            </div>

            {/* Team Member Profile Avatar */}
            <Link to="/team/profile" className="flex items-center gap-2 group">
              <div className="grid h-8 w-8 place-items-center rounded-full border border-brand/40 bg-brand/10 text-[11px] font-bold text-brand-light group-hover:scale-105 transition-transform">
                {member?.initials || "TM"}
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

      {/* Expandable Mobile Search Bar */}
      {mobileSearchOpen && (
        <div className="border-t border-border-subtle bg-surface-1 p-3 sm:hidden animate-in slide-in-from-top-2 duration-150">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Chat ID (FRM-XXXX), User ID, name..."
                className="h-10 w-full rounded-xl border border-border-subtle bg-surface-2 pl-9 pr-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white hover:bg-brand-light transition-colors shrink-0"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-border-subtle text-text-muted hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
