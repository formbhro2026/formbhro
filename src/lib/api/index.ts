/**
 * Formbhro service layer.
 *
 * All app data access goes through these modules so the UI never talks to the
 * database directly. Row Level Security enforces the same rules server-side:
 *   user  -> own requests, chats, documents, notifications
 *   team  -> only requests assigned to them
 *   admin -> everything
 */
export * from "./types";
export * as authApi from "./auth";
export * as requestsApi from "./requests";
export * as messagesApi from "./messages";
export * as documentsApi from "./documents";
export * as notificationsApi from "./notifications";
export * as realtimeApi from "./realtime";
export * as dashboardApi from "./dashboard";
