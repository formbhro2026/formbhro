import { supabase } from "@/integrations/supabase/client";
import {
  ApiError,
  type NewsRow,
  type NotificationRow,
  type QuickReplyRow,
  type UserSettingsRow,
} from "./types";

/* ---------------- Notifications ---------------- */

export async function listNotifications(limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}

export async function unreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw new ApiError(error.message, error.code);
  return count ?? 0;
}

export async function markNotificationRead(id: string, isRead = true) {
  const { error } = await supabase.from("notifications").update({ is_read: isRead }).eq("id", id);
  if (error) throw new ApiError(error.message, error.code);
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  if (error) throw new ApiError(error.message, error.code);
}

/* ---------------- News & Vacancies ---------------- */

export type VacancyInput = {
  title: string;
  description: string;
  category?: string;
  featured?: boolean;
  published?: boolean;
  image_url?: string;
  organization?: string;
  qualification?: string;
  min_age?: number | null;
  max_age?: number | null;
  vacancy_status?: "live" | "upcoming" | "closed" | "expired";
  application_start_date?: string | null;
  application_last_date?: string | null;
  total_vacancies?: number | null;
  location?: string | null;
  apply_url?: string | null;
  notification_url?: string | null;
  custom_fields?: Record<string, any>;
};

export type CustomFieldRow = {
  id: string;
  field_name: string;
  field_label: string;
  field_type: "text" | "number" | "date" | "dropdown" | "multiselect" | "boolean";
  options?: string[];
  is_required: boolean;
  is_filter: boolean;
  is_active: boolean;
  sort_order: number;
};

export async function listNews(): Promise<NewsRow[]> {
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}

/** Fetches public job vacancy notifications strictly for the Jobs Updates section (excludes all groups). */
export async function listJobsUpdates(limit = 100): Promise<NewsRow[]> {
  try {
    const { data, error } = await (supabase as any).rpc("get_public_job_updates", { p_limit: limit });
    if (!error && data) return data;
  } catch (_) {}

  // Fallback: direct table query with strict filter
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new ApiError(error.message, error.code);
  return (data ?? []).filter((item: any) => {
    const cat = (item.category || "").toLowerCase();
    const target = item.custom_fields?.target;
    const groupId = item.custom_fields?.group_id;
    return !cat.startsWith("group:") && target !== "group" && !groupId;
  });
}

/** Fetches updates targeted strictly to a specific group channel. */
export async function listGroupUpdates(
  groupId: "jobs-update" | "hidden-jobs-update",
  limit = 100
): Promise<NewsRow[]> {
  try {
    const { data, error } = await (supabase as any).rpc("get_group_feed", {
      p_group_id: groupId,
      p_limit: limit,
    });
    if (!error && data) return data;
  } catch (_) {}

  // Fallback: direct table query with strict group filter
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new ApiError(error.message, error.code);
  return (data ?? []).filter((item: any) => {
    const cat = (item.category || "").toLowerCase();
    const target = item.custom_fields?.target;
    const itemGroupId = item.custom_fields?.group_id;
    if (groupId === "jobs-update") {
      return (
        cat === "group: jobs-update" ||
        cat === "jobs update group" ||
        (target === "group" && itemGroupId === "jobs-update") ||
        itemGroupId === "jobs-update"
      );
    } else {
      return (
        cat === "group: hidden-jobs-update" ||
        cat === "hidden jobs update" ||
        cat.includes("hidden") ||
        (target === "group" && itemGroupId === "hidden-jobs-update") ||
        itemGroupId === "hidden-jobs-update"
      );
    }
  });
}

/** Admin and authorized team publishing. */
export async function createNews(input: VacancyInput) {
  const payload: any = { ...input };
  if (input.total_vacancies !== undefined && payload.vacancies_count === undefined) {
    payload.vacancies_count = input.total_vacancies;
  }
  if (input.apply_url !== undefined && payload.application_url === undefined) {
    payload.application_url = input.apply_url;
  }
  const { data, error } = await supabase.from("news").insert(payload as any).select().single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function updateNews(id: string, patch: Partial<VacancyInput>) {
  const payload: any = { ...patch };
  if (patch.total_vacancies !== undefined && payload.vacancies_count === undefined) {
    payload.vacancies_count = patch.total_vacancies;
  }
  if (patch.apply_url !== undefined && payload.application_url === undefined) {
    payload.application_url = patch.apply_url;
  }
  const { data, error } = await supabase.from("news").update(payload as any).eq("id", id).select().single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function deleteNews(id: string) {
  const { error } = await supabase.from("news").delete().eq("id", id);
  if (error) throw new ApiError(error.message, error.code);
}

export async function listCustomFields(): Promise<CustomFieldRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("vacancy_custom_fields")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && Array.isArray(data)) {
      return data.map((d: any) => ({
        id: d.id,
        field_name: d.field_name || d.name || "",
        field_label: d.field_label || d.label || "",
        field_type: (d.field_type === "select" ? "dropdown" : d.field_type) as CustomFieldRow["field_type"],
        options: Array.isArray(d.options)
          ? d.options
          : typeof d.options === "string"
          ? JSON.parse(d.options)
          : [],
        is_required: Boolean(d.is_required),
        is_filter: d.is_filter !== false,
        is_active: d.is_active !== false,
        sort_order: d.sort_order ?? 0,
      }));
    }
  } catch (_) {}
  return [];
}

export async function upsertCustomField(field: Partial<CustomFieldRow> & Record<string, any>) {
  const row: any = {
    name: (field.field_name || field.name || "").toLowerCase().replace(/\s+/g, "_"),
    label: field.field_label || field.label || "",
    field_type: field.field_type === "dropdown" ? "select" : (field.field_type || "select"),
    options: Array.isArray(field.options) ? field.options : [],
    is_required: Boolean(field.is_required),
    is_filter: field.is_filter !== false,
    is_active: field.is_active !== false,
    sort_order: field.sort_order ?? 0,
  };
  if (field.id) row.id = field.id;
  const { data, error } = await (supabase as any)
    .from("vacancy_custom_fields")
    .upsert(row)
    .select()
    .single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function deleteCustomField(id: string) {
  const { error } = await (supabase as any)
    .from("vacancy_custom_fields")
    .delete()
    .eq("id", id);
  if (error) throw new ApiError(error.message, error.code);
}

/* ---------------- Quick replies ---------------- */

export async function listQuickReplies(): Promise<QuickReplyRow[]> {
  const { data, error } = await supabase.from("quick_replies").select("*").order("created_at");
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}

export async function createQuickReply(title: string, body: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Session expired.", "unauthenticated");
  const { data, error } = await supabase
    .from("quick_replies")
    .insert({ owner_id: uid, title, body })
    .select()
    .single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function updateQuickReply(id: string, title: string, body: string) {
  const { data, error } = await supabase
    .from("quick_replies")
    .update({ title, body })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function deleteQuickReply(id: string) {
  const { error } = await supabase.from("quick_replies").delete().eq("id", id);
  if (error) throw new ApiError(error.message, error.code);
}

/* ---------------- Settings ---------------- */

export async function getMySettings(): Promise<UserSettingsRow | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function updateMySettings(
  patch: Partial<Omit<UserSettingsRow, "user_id" | "updated_at">>,
) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Session expired.", "unauthenticated");
  const { data, error } = await supabase
    .from("user_settings")
    .upsert({ user_id: uid, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}
