import { RequestRow, DocumentRow, MessageRow, NotificationRow, ChatRoomRow } from "./types";
import { supabase } from "@/integrations/supabase/client";

/**
 * Common data helpers for User and Team panels.
 */

export const initialsOf = (name: string) => {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "U"
  );
};

export const timeLabel = (iso?: string | null) => {
  return new Date(iso ?? Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const dayLabel = (iso?: string | null) => {
  return new Date(iso ?? Date.now()).toLocaleDateString([], {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const sizeLabel = (bytes?: number | null) => {
  const b = bytes ?? 0;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
};

export async function fetchUserNames(userIds: string[]) {
  if (!userIds.length) return {};
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
  const names: Record<string, string> = {};
  for (const p of data ?? []) names[p.id] = p.full_name || p.email || "User";
  return names;
}
