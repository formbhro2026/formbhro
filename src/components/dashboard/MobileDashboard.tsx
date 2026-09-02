import { useUserStore } from "@/lib/user-store";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronRight,
  MessageSquare,
  Plus,
  FileText,
  Briefcase,
  GraduationCap,
  ClipboardList,
  Megaphone,
  Bell,
  LayoutGrid,
  History,
  Info,
  User,
  LifeBuoy,
  Newspaper,
  Loader2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useFillNow } from "@/components/layout/FillNowProvider";
import { cn } from "@/lib/utils";

export function MobileDashboard() {
  const { requests, profile, loading } = useUserStore();
  const { openFillNow, isStartingChat } = useFillNow();
  const [announcements, setAnnouncements] = useState<
    Array<{ id: string; title: string; category?: string; image_url?: string | null }>
  >([]);

  useEffect(() => {
    const fetchNews = async () => {
      const { data } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) setAnnouncements(data);
    };
    fetchNews();
  }, []);

  const recentRequest = requests[0];
  const activeRequest = requests.find((r) => r.status !== "completed");

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 pb-24 bg-bg min-h-full animate-pulse">
        {/* Skeleton Greeting Header */}
        <section className="py-2 space-y-2">
          <div className="h-7 w-48 rounded-lg bg-surface-2" />
          <div className="h-4 w-64 rounded-md bg-surface-2" />
        </section>

        {/* Skeleton Banner */}
        <section className="rounded-2xl bg-surface-2 aspect-[16/7] border border-border-subtle" />

        {/* Skeleton Primary Card */}
        <section className="rounded-[24px] bg-surface-1 border border-border-subtle p-6 space-y-4">
          <div className="space-y-2">
            <div className="h-6 w-52 rounded-lg bg-surface-2" />
            <div className="h-4 w-72 rounded-md bg-surface-2" />
          </div>
          <div className="h-14 w-full rounded-2xl bg-surface-2" />
        </section>

        {/* Skeleton Recent Requests */}
        <section className="space-y-3">
          <div className="h-4 w-32 rounded bg-surface-2" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 w-full rounded-[20px] bg-surface-1 border border-border-subtle"
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pb-24 bg-bg min-h-full">
      {/* Greeting Header */}
      <section className="flex items-center justify-between py-2">
        <div>
          <h1 className="text-xl font-bold text-text">
            Good Morning, {profile?.full_name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-sm text-text-secondary mt-1">How can we help you today?</p>
        </div>
      </section>

      {/* Announcements / News Section */}
      {announcements.length > 0 && (
        <section className="relative overflow-hidden rounded-2xl bg-surface-2 aspect-[16/7] border border-border-subtle shadow-xl group cursor-pointer">
          <Link to="/app/news" className="absolute inset-0 block">
            {announcements[0].image_url ? (
              <img
                src={announcements[0].image_url}
                alt={announcements[0].title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-surface-2" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
              <span className="text-[9px] font-bold text-brand uppercase tracking-widest mb-1">
                {announcements[0].category}
              </span>
              <h2 className="text-sm font-bold leading-tight text-white line-clamp-2">
                {announcements[0].title}
              </h2>
            </div>
          </Link>
        </section>
      )}

      {announcements.length === 0 && (
        <section className="relative overflow-hidden rounded-2xl bg-surface-2 aspect-[16/7] flex items-center px-6 border border-border-subtle shadow-xl">
          <div className="z-10 max-w-[65%] space-y-2">
            <h2 className="text-lg font-bold leading-tight text-white">Latest Platform Updates</h2>
            <p className="text-xs text-text-secondary font-medium">
              Stay updated with latest opportunities
            </p>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-[35%] flex items-center justify-center opacity-40 overflow-hidden pointer-events-none">
            <Megaphone className="h-24 w-24 text-brand rotate-[-15deg]" strokeWidth={1} />
          </div>
        </section>
      )}

      {/* PRIMARY ACTION CARD */}
      <section className="relative overflow-hidden rounded-[24px] bg-surface-1 border border-border-subtle p-6 shadow-2xl">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/5 blur-3xl" />
        <div className="relative z-10 space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-text">Need Help With a Form?</h2>
            <p className="text-sm text-text-secondary">
              Start a request and connect with our support team for assistance.
            </p>
          </div>

          <button
            type="button"
            disabled={isStartingChat}
            onClick={() => void openFillNow()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-brand py-4 px-6 text-white font-bold shadow-lg shadow-brand/20 active:scale-95 transition-all disabled:opacity-70"
          >
            {isStartingChat ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-lg">Starting Chat...</span>
              </>
            ) : (
              <>
                <span className="text-lg">Fill Now</span>
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </section>

      {/* ACTIVE REQUEST CARD (If exists) */}
      {activeRequest && (
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
            Your Active Request
          </h3>
          <Link
            to="/app/chats/$requestId"
            params={{ requestId: activeRequest.id }}
            className="block overflow-hidden rounded-[24px] bg-surface-1 border-strong border-opacity-40 border p-5 transition-all active:scale-[0.98] shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0 flex-1">
                <h4 className="text-base font-bold text-text truncate">{activeRequest.title}</h4>
                <p className="text-[10px] text-text-muted mt-0.5">
                  ID: {activeRequest.reference || "FBH-2026-0000"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 text-brand border border-brand/20">
                <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {activeRequest.status}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-surface-2 flex items-center justify-center text-brand">
                  <User className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-text-muted leading-none mb-1 uppercase tracking-tight font-bold">
                    Assigned To
                  </p>
                  <p className="text-xs font-bold text-text">Support Team</p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-bold text-brand text-sm group">
                Continue Chat
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* LATEST UPDATE */}
      {recentRequest && (
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
            Latest Update
          </h3>
          <div className="rounded-[24px] bg-surface-1 border border-border-subtle p-5 flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-surface-3 flex items-center justify-center text-brand">
              <Bell className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text leading-snug">
                "Your documents have been received."
              </p>
              <p className="text-xs text-text-secondary mt-1 truncate">{recentRequest.title}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[10px] font-medium text-text-muted">Today • 10:33 AM</span>
                <Link
                  to="/app/chats/$requestId"
                  params={{ requestId: recentRequest.id }}
                  className="text-[10px] font-bold text-brand hover:underline"
                >
                  View Conversation
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* QUICK ACCESS GRID */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
          Quick Access
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "My Chats", to: "/app/chats", icon: MessageSquare },
            { label: "My Documents", to: "/app/documents", icon: FileText },
            { label: "Updates", to: "/app/news", icon: Newspaper },
            { label: "Support", to: "/app/profile", hash: "help", icon: LifeBuoy },
          ].map((item, i) => (
            <Link
              key={i}
              to={item.to}
              className="flex items-center gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4 active:bg-surface-2 transition-colors group"
            >
              <div className="h-10 w-10 shrink-0 rounded-xl bg-surface-3 flex items-center justify-center text-text-secondary group-active:text-brand transition-colors">
                <item.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <span className="text-sm font-bold text-text">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* RECENT REQUESTS LIST */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
            Recent Requests
          </h3>
          <Link to="/app/chats" className="text-xs font-bold text-brand hover:underline">
            View All Chats
          </Link>
        </div>

        <div className="space-y-3">
          {requests.length > 0 ? (
            requests.slice(0, 3).map((r) => (
              <Link
                key={r.id}
                to="/app/chats/$requestId"
                params={{ requestId: r.id }}
                className="flex items-center gap-4 rounded-[20px] bg-surface-1 p-4 border border-border-subtle group active:bg-surface-2"
              >
                <div
                  className={cn(
                    "h-12 w-12 shrink-0 rounded-xl flex items-center justify-center ",
                    r.status === "completed"
                      ? "bg-success/10 text-success"
                      : "bg-brand/10 text-brand",
                  )}
                >
                  {r.status === "completed" ? (
                    <ClipboardList className="h-6 w-6" strokeWidth={2} />
                  ) : (
                    <FileText className="h-6 w-6" strokeWidth={2} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-bold text-text">{r.title}</h4>
                    <span className="text-[10px] font-medium text-text-muted whitespace-nowrap">
                      10:33 AM
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="truncate text-xs text-text-secondary">
                      "Please upload your address proof..."
                    </p>
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full bg-brand",
                        r.status === "completed" ? "hidden" : "block",
                      )}
                    />
                  </div>
                </div>
                <ChevronRight
                  className="h-5 w-5 text-text-muted group-hover:text-text transition-colors"
                  strokeWidth={2}
                />
              </Link>
            ))
          ) : (
            <div className="py-10 text-center rounded-[24px] border border-dashed border-border-subtle">
              <Info className="h-10 w-10 text-text-muted mx-auto mb-3" strokeWidth={1} />
              <p className="text-sm font-bold text-text">No requests yet</p>
              <p className="text-xs text-text-secondary mt-1">
                Need help with a form? Start your first request.
              </p>
              <button
                type="button"
                disabled={isStartingChat}
                onClick={() => void openFillNow()}
                className="mt-4 text-xs font-bold text-brand border-b border-brand disabled:opacity-50"
              >
                {isStartingChat ? "Starting Chat..." : "Fill Your First Form"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
