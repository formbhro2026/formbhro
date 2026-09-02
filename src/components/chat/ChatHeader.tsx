import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Info, Monitor, Phone, Search, Video } from "lucide-react";
import { canShareScreen } from "@/lib/utils";
import type { SupportRequest } from "@/data/user-module";

export function ChatHeader({
  request,
  onOpenDetails,
  onOpenDocuments,
  documentCount = 0,
  onStartCall,
  onToggleSearch,
  isSearching = false,
}: {
  request: SupportRequest;
  onOpenDetails: () => void;
  onOpenDocuments?: () => void;
  documentCount?: number;
  onStartCall?: (type: "audio" | "video" | "screen") => void;
  onToggleSearch?: () => void;
  isSearching?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-surface-1/95 backdrop-blur-sm py-1 pt-[max(0.25rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-4">
        <Link
          to="/app/chats"
          aria-label="Back to chats"
          className="inline-flex h-9 w-9 items-center justify-center text-text-secondary transition-colors duration-200 xl:hidden"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-3">
            <div className="flex h-full w-full items-center justify-center text-brand">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
              </svg>
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold text-white">{request.title}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-text-muted font-bold tracking-tight uppercase">
              <span className="truncate">{request.assigneeOnline ? "Online" : "Support Team"}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => onStartCall?.("audio")}
            className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-2 hover:text-brand"
            title="Start Audio Call"
          >
            <Phone className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onStartCall?.("video")}
            className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-2 hover:text-brand"
            title="Start Video Call"
          >
            <Video className="h-4 w-4" />
          </button>

          {canShareScreen() && (
            <button
              type="button"
              onClick={() => onStartCall?.("screen")}
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-2 hover:text-brand"
              title="Share Screen"
            >
              <Monitor className="h-4 w-4" />
            </button>
          )}

          {onToggleSearch && (
            <button
              type="button"
              onClick={onToggleSearch}
              className={`inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-2 hover:text-brand ${isSearching ? "bg-surface-2 text-brand" : ""}`}
              title="Search in this conversation"
              aria-label="Search in this conversation"
            >
              <Search className="h-4 w-4" />
            </button>
          )}

          {onOpenDocuments && (
            <button
              type="button"
              onClick={onOpenDocuments}
              aria-label={`Documents in this request (${documentCount})`}
              aria-haspopup="dialog"
              className="relative inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-2 2xl:hidden"
            >
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenDetails}
            aria-label="Request details"
            aria-haspopup="dialog"
            className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-2 2xl:hidden"
          >
            <Info className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
