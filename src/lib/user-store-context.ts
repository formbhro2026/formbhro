import { createContext } from "react";
import type {
  USER_PROFILE,
  AppNotification,
  ChatMessage,
  NewsItem,
  SupportRequest,
  UserDocument,
} from "@/data/user-module";

export type Profile = typeof USER_PROFILE;

export type UserStore = {
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  requests: SupportRequest[];
  messages: ChatMessage[];
  documents: UserDocument[];
  notifications: AppNotification[];
  news: NewsItem[];
  activeRequest: SupportRequest | null;
  getRequest: (id: string) => SupportRequest | undefined;
  messagesFor: (id: string) => ChatMessage[];
  documentsFor: (id: string) => UserDocument[];
  createRequest: (title: string, category?: string) => SupportRequest | Promise<SupportRequest>;
  refresh: () => Promise<void>;
  sendMessage: (requestId: string, text: string) => void;
  retryMessage: (messageId: string) => void;
  attachFile: (
    requestId: string,
    name: string,
    kind: UserDocument["kind"],
    size: string,
    preview?: { previewUrl?: string; pageCount?: number; dimensions?: string },
    file?: File,
  ) => void;
  /** Uploads a standalone document to "My Documents" without creating a request. */
  uploadPersonalDocument: (file: File, name: string) => Promise<void>;
  /** Removes a document from the system safely. */
  removeFile: (id: string, storagePath?: string) => Promise<void>;
  addNote: (requestId: string, note: string) => void;
  markRead: (requestId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  /** True when the store is backed by the live backend instead of demo data. */
  live: boolean;
  loading?: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  rooms?: any;
  /** True while the assigned team member is typing in this request's room. */
  isPeerTyping?: (requestId: string) => boolean;
  /** Broadcast that the user is typing in this request's room (throttled). */
  notifyTyping?: (requestId: string) => void;
};

export const UserStoreContext = createContext<UserStore | null>(null);
