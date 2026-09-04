import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, Loader2, Search, X, Zap, CornerDownLeft, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserHeader } from "@/components/layout/UserHeader";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatList } from "@/components/chat/ChatList";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { RequestDetails } from "@/components/chat/RequestDetails";
import { RequestDetailsSheet } from "@/components/chat/RequestDetailsSheet";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { EmptyState } from "@/components/common/EmptyState";
import { useUserStore } from "@/lib/user-store";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import { useChatScroll } from "@/lib/use-chat-scroll";
import { useGlobalCall } from "@/lib/call-store";
import { setActiveChat } from "@/lib/active-chat-tracker";
import { listQuickReplies } from "@/lib/api/notifications";
import type { QuickReplyRow } from "@/lib/api/types";
import { toast } from "sonner";

export const Route = createFileRoute("/app/chats/$requestId")({
  ssr: false,
  component: ChatScreen,
  head: () => ({
    meta: [
      { title: "Conversation — Formbhro Support" },
      {
        name: "description",
        content:
          "Chat with the Formbhro support team, share documents and track your request status.",
      },
      { property: "og:title", content: "Conversation — Formbhro Support" },
      {
        property: "og:description",
        content: "Chat with support, share documents and follow your request.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ChatScreen() {
  const { requestId } = Route.useParams();
  const store = useUserStore() as any;
  const {
    requests,
    getRequest,
    messagesFor,
    documentsFor,
    documents,
    sendMessage,
    retryMessage,
    attachFile,
    addNote,
    markRead,
    loading,
  } = store;
  const [sheetTab, setSheetTab] = useState<"details" | "documents" | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReplyRow[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { height: viewportHeight, keyboardOpen } = useVisualViewport();
  const openSheet = useCallback((tab: "details" | "documents") => setSheetTab(tab), []);

  const request = getRequest(requestId);
  const messages = messagesFor(requestId);
  const requestDocs = documentsFor(requestId);
  const preview = documents.find((d: any) => d.id === previewId) ?? null;
  const { startCall, setActiveRoomId } = useGlobalCall();

  const {
    containerRef: scrollContainerRef,
    handleScroll,
    scrollToBottom,
    isAtBottom,
    hasNewUnseen,
  } = useChatScroll<HTMLDivElement>({
    items: messages,
    chatId: request?.id || requestId,
  });

  const handleShareDocument = useCallback(
    async (doc: any) => {
      const room = store.rooms?.current?.[requestId];
      if (!room?.chatRoomId) {
        toast.error("Chat is connecting. Please try again in a moment.");
        return;
      }
      try {
        const { sendMessageWithRetry } = await import("@/lib/api/messages");
        const { linkDocumentToRequest } = await import("@/lib/api/documents");
        if (!doc.requestId || doc.requestId === "Personal Document") {
          void linkDocumentToRequest(doc.id, room.requestId).catch(() => {});
        }
        await sendMessageWithRetry({
          chatRoomId: room.chatRoomId,
          requestId: room.requestId,
          attachmentId: doc.id,
          senderRole: "user",
        });
        toast.success(`Shared "${doc.name}" in chat`);
        scrollToBottom("smooth");
      } catch (err) {
        console.error("Failed to share document:", err);
        toast.error("Failed to send document in chat");
      }
    },
    [requestId, store.rooms, scrollToBottom],
  );

  const handleDeleteDocument = useCallback(
    async (id: string, storagePath?: string) => {
      try {
        await store.removeFile(id, storagePath);
        toast.success("Document deleted successfully");
      } catch (err) {
        console.error("Failed to delete document:", err);
        toast.error("Failed to delete document");
      }
    },
    [store],
  );

  const handleUploadDocument = useCallback(
    async (file: File, name: string) => {
      if (store.uploadPersonalDocument) {
        await store.uploadPersonalDocument(file, name);
      } else {
        await attachFile(
          requestId,
          name,
          "doc",
          `${Math.round(file.size / 1024)} KB`,
          undefined,
          file,
        );
      }
    },
    [store, attachFile, requestId],
  );

  useEffect(() => {
    void listQuickReplies().then(setQuickReplies).catch(() => {});
    store.loadChat?.(requestId);
  }, [requestId, store]);

  const isQuickChatSearch = searchQuery.startsWith("/");
  const quickChatFilter = isQuickChatSearch ? searchQuery.slice(1).trim().toLowerCase() : "";

  const filteredQuickReplies = useMemo(() => {
    if (!isQuickChatSearch) return [];
    if (!quickChatFilter) return quickReplies;
    return quickReplies.filter(
      (qr) =>
        qr.title.toLowerCase().includes(quickChatFilter) ||
        qr.body.toLowerCase().includes(quickChatFilter),
    );
  }, [isQuickChatSearch, quickChatFilter, quickReplies]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim() || isQuickChatSearch) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m: any) => {
      const matchText = (m.text || "").toLowerCase().includes(q);
      const matchAuthor = (m.authorName || "").toLowerCase().includes(q);
      const matchFile = (m.file?.name || "").toLowerCase().includes(q);
      return matchText || matchAuthor || matchFile;
    });
  }, [messages, searchQuery, isQuickChatSearch]);

  useEffect(() => {
    if (request?.id) {
      setActiveRoomId(request.id);
    }
    setActiveChat({
      requestId: request?.id || requestId,
      requestRef: request?.reference || requestId,
      chatRoomId: request?.chatRoomId || null,
    });
    return () => {
      setActiveChat(null);
    };
  }, [request?.id, request?.reference, request?.chatRoomId, requestId, setActiveRoomId]);

  useEffect(() => {
    markRead(requestId);
  }, [requestId, markRead]);

  if (!request) {
    if (loading) {
      return (
        <div className="flex min-h-screen flex-col bg-bg text-white">
          <UserHeader title="Conversation" />
          <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand mb-3" />
            <p className="text-sm font-medium text-text-secondary">Loading conversation…</p>
          </main>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col bg-bg text-white">
        <UserHeader title="Conversation" />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-8">
          <EmptyState
            icon={MessageSquareText}
            title="Conversation not found."
            description="This request may have been moved. Open My Chats to find your conversations."
            action={
              <Link
                to="/app/chats"
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white hover:bg-white/5"
              >
                Go to My Chats
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-bg h-full flex-1 min-h-0 overflow-hidden"
      style={
        viewportHeight
          ? { height: `${viewportHeight}px`, maxHeight: `${viewportHeight}px` }
          : undefined
      }
    >
      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,20rem)]">
        {/* Conversation list (desktop) */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-white/10 p-4 xl:flex">
          <ChatList requests={requests} activeId={requestId} compact />
        </aside>

        {/* Active conversation */}
        <section className="flex min-h-0 min-w-0 flex-col">
          <ChatHeader
            request={request}
            onOpenDetails={() => openSheet("documents")}
            onOpenDocuments={() => openSheet("documents")}
            documentCount={documents.length}
            onStartCall={(type) => startCall(type, request.id)}
            onToggleSearch={() => {
              setSearchOpen((prev) => {
                const next = !prev;
                if (next) {
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                } else {
                  setSearchQuery("");
                }
                return next;
              });
            }}
            isSearching={searchOpen}
          />

          {searchOpen && (
            <div className="relative border-b border-border-subtle bg-surface-1/95 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }
                    }}
                    type="search"
                    placeholder="Search messages or type '/' for Quick Custom Chats..."
                    aria-label="Search in this conversation"
                    className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 pl-8 pr-3 text-xs text-white placeholder:text-text-muted outline-none focus:border-brand/40 transition-colors"
                  />
                </div>
                {searchQuery.trim() && !isQuickChatSearch && (
                  <span className="shrink-0 text-[10px] text-text-muted">
                    {filteredMessages.length} {filteredMessages.length === 1 ? "result" : "results"}
                  </span>
                )}
                {isQuickChatSearch && (
                  <span className="shrink-0 rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    Quick Chats ({filteredQuickReplies.length})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-white transition-colors"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Selectable Quick Custom Chats List on "/" */}
              {isQuickChatSearch && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border-subtle bg-surface-2 p-1.5 shadow-2xl space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-brand" /> Quick Custom Chats
                  </div>
                  {filteredQuickReplies.length === 0 ? (
                    <div className="p-3 text-center text-xs text-text-muted">
                      No quick custom chats match "{quickChatFilter}"
                    </div>
                  ) : (
                    filteredQuickReplies.map((qr) => (
                      <button
                        key={qr.id}
                        type="button"
                        onClick={() => {
                          sendMessage(requestId, qr.body);
                          setSearchQuery("");
                          setSearchOpen(false);
                          scrollToBottom("smooth");
                        }}
                        className="w-full text-left rounded-lg p-2.5 hover:bg-surface-3 transition-colors group flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white group-hover:text-brand transition-colors">
                            {qr.title}
                          </p>
                          <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">
                            {qr.body}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          Send <CornerDownLeft className="h-2.5 w-2.5" />
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-chat-bg px-3 py-4 pb-4 sm:px-4 relative"
            style={{
              backgroundImage:
                'url("https://w0.peakpx.com/wallpaper/580/650/HD-wallpaper-whatsapp-background-cool-dark-grey-google-material-minimal-white.jpg")',
              backgroundBlendMode: "soft-light",
              backgroundSize: "400px",
              opacity: 1,
            }}
          >
            <div className="sticky top-0 z-10 flex justify-center pb-4 pointer-events-none">
              <p className="rounded-lg bg-surface-2/90 backdrop-blur-sm px-3 py-1 text-[11px] font-bold text-text-muted shadow-sm uppercase tracking-wider">
                TODAY
              </p>
            </div>
            {filteredMessages.map((m: any) => (
              <MessageBubble
                key={m.id}
                message={m}
                onRetry={retryMessage}
                onViewFile={setPreviewId}
                currentUserId={store.profile?.id}
                onCallBack={(type) => startCall(type)}
              />
            ))}

            {!isAtBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="sticky bottom-2 ml-auto mr-0 z-20 flex items-center gap-1.5 rounded-full bg-surface-2/95 px-3 py-1.5 text-[11px] font-semibold text-white shadow-xl backdrop-blur-md border border-border-subtle hover:bg-surface-3 transition-all animate-in fade-in slide-in-from-bottom-2"
                aria-label="Scroll to latest messages"
              >
                {hasNewUnseen && (
                  <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
                )}
                <span>{hasNewUnseen ? "New message" : "Latest"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
              </button>
            )}
          </div>
          <div
            className={cn(
              "transition-[padding] bg-surface-1",
              keyboardOpen ? "pb-0" : "pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-3",
            )}
          >
            <MessageComposer
              requestLabel={request.id}
              onSend={(text) => {
                sendMessage(requestId, text);
                scrollToBottom("smooth");
              }}
              onUpload={(name, kind, size, preview, file) =>
                attachFile(requestId, name, kind, size, preview, file)
              }
              onOpenSavedDocs={() => openSheet("documents")}
              onTyping={() => {
                const room = store.rooms?.current?.[requestId];
                if (room?.chatRoomId) {
                  import("@/lib/api/realtime").then((api) => {
                    api.sendTyping(room.chatRoomId, {
                      userId: store.profile.id,
                      name: store.profile.full_name || store.profile.name,
                      typing: true,
                    });
                  });
                }
              }}
            />
          </div>
        </section>

        {/* Request details (large desktop) */}
        <aside className="hidden min-h-0 overflow-y-auto border-l border-white/10 2xl:block">
          <RequestDetails
            request={request}
            documents={requestDocs}
            allDocuments={documents}
            onAddNote={(note) => addNote(requestId, note)}
            onViewDocument={setPreviewId}
            onDeleteDocument={handleDeleteDocument}
            onShareDocument={handleShareDocument}
          />
        </aside>
      </div>

      {/* Details bottom sheet (mobile) / side drawer (tablet) */}
      {sheetTab && (
        <RequestDetailsSheet
          request={request}
          documents={requestDocs}
          allDocuments={documents}
          initialTab={sheetTab}
          onAddNote={(note) => addNote(requestId, note)}
          onViewDocument={(id) => {
            setSheetTab(null);
            setPreviewId(id);
          }}
          onDeleteDocument={handleDeleteDocument}
          onShareDocument={handleShareDocument}
          onUploadDocument={handleUploadDocument}
          onClose={() => setSheetTab(null)}
        />
      )}

      {preview && <DocumentPreview document={preview} onClose={() => setPreviewId(null)} />}
    </div>
  );
}
