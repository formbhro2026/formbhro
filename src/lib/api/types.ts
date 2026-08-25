import type { Tables, Enums } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type UserRoleRow = Tables<"user_roles">;
export type TeamMemberRow = Tables<"team_members">;
export type RequestRow = Tables<"requests">;
export type ChatRoomRow = Tables<"chat_rooms">;
export type MessageRow = Tables<"messages">;
export type DocumentRow = Tables<"documents">;
export type NotificationRow = Tables<"notifications">;
export type ActivityLogRow = Tables<"activity_logs">;
export type StatusHistoryRow = Tables<"request_status_history">;
export type NewsRow = Tables<"news"> & { image_url?: string | null };
export type QuickReplyRow = Tables<"quick_replies">;
export type UserSettingsRow = Tables<"user_settings">;

export type AppRole = Enums<"app_role">;
export type DbRequestStatus = Enums<"request_status">;
export type DbRequestPriority = Enums<"request_priority">;
export type SenderRole = Enums<"message_sender">;

export const ACTIVE_DB_STATUSES: DbRequestStatus[] = [
  "pending",
  "assigned",
  "waiting_documents",
  "under_review",
  "in_progress",
];

export const STATUS_LABEL: Record<DbRequestStatus, string> = {
  pending: "Pending",
  assigned: "Assigned",
  waiting_documents: "Waiting for Documents",
  under_review: "Under Review",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Thrown by the service layer so the UI can show a graceful message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function unwrap<T>(result: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (result.error) throw new ApiError(result.error.message, result.error.code);
  if (result.data === null) throw new ApiError("No data returned");
  return result.data;
}
