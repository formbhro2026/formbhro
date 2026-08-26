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

/* ---------------- News ---------------- */

export async function listNews(): Promise<NewsRow[]> {
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}

/** Admin only (RLS). */
export async function createNews(input: {
  title: string;
  description: string;
  category?: string;
  featured?: boolean;
  image_url?: string;
}) {
  const { data, error } = await supabase.from("news").insert(input).select().single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function updateNews(
  id: string,
  patch: Partial<
    Pick<NewsRow, "title" | "description" | "category" | "featured" | "published" | "image_url">
  >,
) {
  const { data, error } = await supabase.from("news").update(patch).eq("id", id).select().single();
  if (error) throw new ApiError(error.message, error.code);
  return data;
}

export async function deleteNews(id: string) {
  const { error } = await supabase.from("news").delete().eq("id", id);
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
