export type TeamStatus = "pending" | "waiting-user" | "under-review" | "completed";

export const TEAM_STATUS_META: Record<
  TeamStatus,
  { label: string; icon: string; tone: "amber" | "orange" | "green" | "neutral" }
> = {
  pending: { label: "Pending", icon: "Clock", tone: "amber" },
  "waiting-user": { label: "Waiting For User", icon: "Hourglass", tone: "neutral" },
  "under-review": { label: "Under Review", icon: "Search", tone: "orange" },
  completed: { label: "Completed", icon: "CircleCheck", tone: "green" },
};

export const TEAM_STATUS_ORDER: TeamStatus[] = [
  "pending",
  "waiting-user",
  "under-review",
  "completed",
];

export type Priority = "low" | "medium" | "high";

export const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "border-white/15 bg-white/5 text-text-secondary" },
  medium: { label: "Medium", className: "border-amber-400/30 bg-amber-400/10 text-amber-300" },
  high: { label: "High", className: "border-red-400/30 bg-red-400/10 text-red-300" },
};

export type TeamFileKind = "pdf" | "image" | "doc" | "html";

export type TeamDocument = {
  id: string;
  name: string;
  kind: TeamFileKind;
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  requestId: string;
  previewUrl?: string;
  html?: string;
  /** Private storage object path; reads go through short-lived signed URLs. */
  storagePath?: string;
};

export type TeamDelivery = "sending" | "sent" | "delivered" | "read" | "retrying" | "failed";

/** Aggregated emoji reaction on a message. `mine` marks the signed-in member's own vote. */
export type TeamReaction = { emoji: string; by: string[]; mine: boolean };

/** A single person who has read a message. */
export type TeamReadReceipt = { name: string; initials: string; role: "user" | "team"; at: string };

/** One saved revision of a message body, oldest first (index 0 = original). */
export type TeamMessageVersion = { text: string; at: string };

export type TeamMessage = {
  id: string;
  requestId: string;
  author: "user" | "team";
  authorName: string;
  time: string;
  text?: string;
  documentId?: string;
  /** For user messages: whether the assigned team member has read it. */
  read?: boolean;
  /** Timestamp label shown on the read receipt. */
  readAt?: string;
  /** Aggregated emoji reactions on this message. */
  reactions?: TeamReaction[];
  /** Delivery state for messages sent by the team member. */
  delivery?: TeamDelivery;
  /** How many send attempts have been made (auto-resend counter). */
  attempts?: number;
  /** Human readable reason for the last delivery failure. */
  deliveryError?: string;
  /** True once the body has been edited at least once. */
  edited?: boolean;
  /** Time label of the most recent edit. */
  editedAt?: string;
  /** Previous versions of the body, oldest first (index 0 = original). */
  history?: TeamMessageVersion[];
  /** Everyone who has read this message, in the order they read it. */
  readBy?: TeamReadReceipt[];
  /** True when the message is pinned to the top of the thread. */
  pinned?: boolean;
  /** Time label of when the message was pinned. */
  pinnedAt?: string;
};

export type TeamTimelineEntry = { label: string; time: string };

export type TeamRequest = {
  id: string;
  title: string;
  category: string;
  userName: string;
  userInitials: string;
  status: TeamStatus;
  priority: Priority;
  createdOn: string;
  assignedAt: string;
  lastUpdated: string;
  lastMessage: string;
  unread: number;
  progress: number;
  assigneeId: string;
  timeline: TeamTimelineEntry[];
  /** True if this request has been flagged for Admin attention. */
  isEscalated: boolean;
};

export type TeamNotification = {
  id: string;
  type: "assigned" | "message" | "document" | "status" | "admin";
  text: string;
  time: string;
  read: boolean;
  requestId?: string;
};

export type TeamAccount = {
  id: string;
  name: string;
  initials: string;
  email: string;
  password: string;
  role: string;
  teamId: string;
  memberSince: string;
  avatarColor: string;
};

/** Accounts are created by the Admin only. There is no public signup. */
export const TEAM_ACCOUNTS: TeamAccount[] = [
  {
    id: "tm-01",
    name: "Rahul Verma",
    initials: "RV",
    email: "rahul@formbhro.com",
    password: "Team@123",
    role: "Support Executive",
    teamId: "FBH-TM-014",
    memberSince: "04 February 2026",
    avatarColor: "#ff7a00",
  },
  {
    id: "tm-02",
    name: "Priya Sharma",
    initials: "PS",
    email: "priya@formbhro.com",
    password: "Team@123",
    role: "Senior Support Executive",
    teamId: "FBH-TM-009",
    memberSince: "12 December 2025",
    avatarColor: "#ff8a1f",
  },
];

/**
 * Demo content only — one assigned chat per teammate. Real team accounts
 * created by the Admin load their assigned work from the backend instead.
 */
export const TEAM_REQUESTS: TeamRequest[] = [];

export const TEAM_DOCUMENTS: TeamDocument[] = [];

export const TEAM_MESSAGES: TeamMessage[] = [];

export const TEAM_NOTIFICATIONS: TeamNotification[] = [];
