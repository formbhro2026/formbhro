import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "./auth";
import { documentsCount, listDocuments } from "./documents";
import { listNews, listNotifications, unreadNotificationCount } from "./notifications";
import { getActiveRequest, listRequests } from "./requests";
import type { ActivityLogRow } from "./types";

/** Single round of parallel reads that powers the User dashboard (no N+1). */
export async function loadUserDashboard() {
  const [profile, activeRequest, recent, notifications, unread, news, docs] = await Promise.all([
    getMyProfile(),
    getActiveRequest(),
    listRequests({ limit: 5 }),
    listNotifications(20),
    unreadNotificationCount(),
    listNews(),
    documentsCount(),
  ]);

  let latestUpdate: ActivityLogRow | null = null;
  if (activeRequest) {
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("request_id", activeRequest.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestUpdate = data;
  }

  return {
    profile,
    activeRequest,
    hasActiveRequest: Boolean(activeRequest),
    recentRequests: recent,
    notifications,
    unreadNotifications: unread,
    news,
    documentsCount: docs,
    latestUpdate,
  };
}

/** Team dashboard: assigned work only (RLS scoped). */
export async function loadTeamDashboard() {
  const [profile, assigned, notifications, unread, documents] = await Promise.all([
    getMyProfile(),
    listRequests({ limit: 100 }),
    listNotifications(20),
    unreadNotificationCount(),
    listDocuments({ limit: 100 }),
  ]);

  return {
    profile,
    requests: assigned,
    pending: assigned.filter((r) => r.status === "pending" || r.status === "assigned").length,
    inProgress: assigned.filter((r) => r.status === "in_progress" || r.status === "under_review").length,
    completed: assigned.filter((r) => r.status === "completed").length,
    notifications,
    unreadNotifications: unread,
    documents,
  };
}
