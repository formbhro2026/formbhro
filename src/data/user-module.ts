export type RequestStatus =
  | "new"
  | "pending"
  | "assigned"
  | "in-progress"
  | "waiting-documents"
  | "under-review"
  | "completed";

export const STATUS_META: Record<
  RequestStatus,
  { label: string; icon: string; tone: "amber" | "orange" | "green" | "neutral" }
> = {
  new: { label: "New", icon: "Sparkle", tone: "neutral" },
  pending: { label: "Pending", icon: "Clock", tone: "amber" },
  assigned: { label: "Assigned", icon: "UserCheck", tone: "neutral" },
  "in-progress": { label: "In Progress", icon: "Loader", tone: "orange" },
  "waiting-documents": { label: "Waiting for Documents", icon: "Upload", tone: "amber" },
  "under-review": { label: "Under Review", icon: "Search", tone: "neutral" },
  completed: { label: "Completed", icon: "CircleCheck", tone: "green" },
};

export const ACTIVE_STATUSES: RequestStatus[] = [
  "new",
  "pending",
  "assigned",
  "in-progress",
  "waiting-documents",
  "under-review",
];

export type FileKind = "pdf" | "image" | "doc";

export interface CallLogData {
  call_session_id: string;
  call_type: "audio" | "video";
  status: "completed" | "missed" | "declined" | "cancelled";
  caller_id: string;
  receiver_id?: string;
  duration_seconds?: number;
  created_at?: string;
}

export type ChatMessage = {
  id: string;
  requestId: string;
  senderId?: string;
  author: "user" | "support";
  authorName: string;
  time: string;
  text?: string;
  isSystem?: boolean;
  callLog?: CallLogData;
  file?: {
    id: string;
    name: string;
    kind: FileKind;
    size: string;
    previewColor?: string;
    previewUrl?: string;
    pageCount?: number;
    dimensions?: string;
    storagePath?: string;
  };
  state?: "sent" | "delivered" | "read" | "sending" | "failed";
};

export type ActivityEntry = { label: string; time: string };

export type SupportRequest = {
  id: string;
  title: string;
  status: RequestStatus;
  createdAt: string;
  assignedTo: string;
  reference?: string;
  assigneeOnline: boolean;
  lastUpdate: string;
  lastMessage: string;
  unread: number;
  progress: number;
  notes: string[];
  activity: ActivityEntry[];
};

export type UserDocument = {
  id: string;
  name: string;
  kind: FileKind;
  size: string;
  requestId: string;
  requestTitle: string;
  uploadedBy: string;
  date: string;
  previewUrl?: string;
  pageCount?: number;
  dimensions?: string;
  /** Private storage object path — reads go through short-lived signed URLs. */
  storagePath?: string;
};

export type AppNotification = {
  id: string;
  type: "message" | "document" | "status" | "completed" | "announcement";
  text: string;
  time: string;
  read: boolean;
  requestId?: string;
  to: "chat" | "news";
};

export type NewsItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  featured?: boolean;
};

export const USER_PROFILE = {
  id: "USR-001",
  name: "Ananya Mishra",
  full_name: "Ananya Mishra",
  initials: "AM",
  email: "ananya.mishra@gmail.com",
  phone: "+91 76570 26275",
  createdAt: "12 January 2026",
  authProvider: "google" as "google" | "password",
  avatarUrl: undefined as string | undefined,
};

/**
 * Demo content only. A single request / single chat so the demo shows the
 * "one request = one chat room" rule clearly. Real accounts start empty and
 * are filled from the backend instead of this file.
 */
export const SEED_REQUESTS: SupportRequest[] = [];
export const SEED_MESSAGES: ChatMessage[] = [];
export const SEED_DOCUMENTS: UserDocument[] = [];
export const SEED_NOTIFICATIONS: AppNotification[] = [];

export const NEWS_ITEMS: NewsItem[] = [];

export const REQUEST_TYPES = [
  "Passport Application Assistance",
  "PAN Card Correction",
  "Driving Licence Renewal",
  "Voter ID Assistance",
  "Other Form Assistance",
];
