import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquareText } from "lucide-react";
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
import { useWebRTCCall } from "@/hooks/use-webrtc-call";
import { CallOverlay } from "@/components/chat/CallOverlay";

export const Route = createFileRoute("/app/chats/$requestId")({
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
  } = store;
  const [sheetTab, setSheetTab] = useState<"details" | "documents" | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { height: viewportHeight, keyboardOpen } = useVisualViewport();
  const openSheet = useCallback((tab: "details" | "documents") => setSheetTab(tab), []);

  const request = getRequest(requestId);
  const messages = messagesFor(requestId);
  const requestDocs = documentsFor(requestId);
  const preview = documents.find((d: any) => d.id === previewId) ?? null;
  const { session, startCall, acceptCall, hangup } = useWebRTCCall(requestId);

  useEffect(() => {
    markRead(requestId);
  }, [requestId, markRead]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (!request) {
    return (
      <>
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
      </>
    );
  }

  return (
    <div
      className="flex flex-col bg-bg"
      style={{ height: viewportHeight ? `${viewportHeight}px` : "100dvh" }}
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
            onOpenDetails={() => openSheet("details")}
            onOpenDocuments={() => openSheet("documents")}
            documentCount={requestDocs.length}
            onStartCall={startCall}
          />

          <div
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
            {messages.map((m: any) => (
              <MessageBubble
                key={m.id}
                message={m}
                onRetry={retryMessage}
                onViewFile={setPreviewId}
              />
            ))}
            <div ref={endRef} />
          </div>
          <div
            className={cn(
              "transition-[padding] bg-surface-1",
              keyboardOpen ? "pb-0" : "pb-[76px] lg:pb-0",
            )}
          >
            <MessageComposer
              requestLabel={request.id}
              onSend={(text) => sendMessage(requestId, text)}
              onUpload={(name, kind, size, preview, file) =>
                attachFile(requestId, name, kind, size, preview, file)
              }
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
            onAddNote={(note) => addNote(requestId, note)}
            onViewDocument={setPreviewId}
          />
        </aside>
      </div>

      {/* Details bottom sheet (mobile) / side drawer (tablet) */}
      {sheetTab && (
        <RequestDetailsSheet
          request={request}
          documents={requestDocs}
          initialTab={sheetTab}
          onAddNote={(note) => addNote(requestId, note)}
          onViewDocument={(id) => {
            setSheetTab(null);
            setPreviewId(id);
          }}
          onClose={() => setSheetTab(null)}
        />
      )}

      {preview && <DocumentPreview document={preview} onClose={() => setPreviewId(null)} />}
      <CallOverlay session={session} onAccept={acceptCall} onHangup={hangup} />
    </div>
  );
}
