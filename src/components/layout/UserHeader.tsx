import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Menu } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { useUserStore } from "@/lib/user-store";
import { NotificationPanel } from "@/components/notifications/NotificationPanel";


export function UserHeader({ title }: { title?: string }) {
  const { notifications, profile, setSidebarOpen } = useUserStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.some((n) => !n.read);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 bg-surface-1 border-b border-border-subtle">
      <div className="flex h-16 lg:h-14 items-center justify-between gap-3 px-4 sm:px-6">
        {/* Mobile Sidebar Toggle */}
        <button 
          type="button" 
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 text-white active:bg-surface-2 rounded-lg transition-colors" 
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" strokeWidth={1.5} />
        </button>

        {/* Logo - Centered on mobile, Left on desktop */}
        <div className="flex min-w-0 flex-1 items-center justify-center lg:justify-start gap-3">
          <Link to="/app" aria-label="Formbhro home">
            <img 
              src={logoAsset.url} 
              alt="Formbhro" 
              width={140} 
              height={40} 
              className="h-6 w-auto" 
            />
          </Link>
          {title && <h1 className="hidden truncate text-sm font-semibold text-white lg:block">{title}</h1>}
        </div>

        {/* Notifications & Profile */}
        <div className="flex items-center gap-2">
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={unread ? "Notifications, unread" : "Notifications"}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="relative inline-flex h-10 w-10 items-center justify-center text-white transition-colors duration-200 hover:bg-surface-2 rounded-xl"
            >
              <Bell className="h-6 w-6 lg:h-5 lg:w-5" strokeWidth={1.5} aria-hidden="true" />
              {unread && (
                <span 
                  aria-hidden="true" 
                  className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-surface-1 bg-brand lg:right-2.5 lg:top-2.5 lg:h-2 lg:w-2" 
                />
              )}
            </button>
            {open && <NotificationPanel onClose={() => setOpen(false)} />}
          </div>
          
          <Link
            to="/app/profile"
            aria-label="Your profile"
            className="hidden lg:grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-xs font-bold text-brand"
          >
            {profile.initials}
          </Link>
        </div>
      </div>
    </header>
  );
}

