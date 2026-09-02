import { createFileRoute } from "@tanstack/react-router";
import { UserHeader } from "@/components/layout/UserHeader";
import { ChatList } from "@/components/chat/ChatList";
import { useUserStore } from "@/lib/user-store";

export const Route = createFileRoute("/app/chats/")({
  ssr: false,
  component: MyChats,
  head: () => ({
    meta: [
      { title: "My Chats — Formbhro Support" },
      {
        name: "description",
        content: "View and continue your Formbhro support conversations, filtered by status.",
      },
      { property: "og:title", content: "My Chats — Formbhro Support" },
      { property: "og:description", content: "View and continue your support conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

import { PullToRefresh } from "@/components/common/PullToRefresh";

function MyChats() {
  const { requests, refresh, loading } = useUserStore();

  return (
    <div className="flex min-h-full flex-col bg-bg text-text">
      <UserHeader title="My Chats" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        <PullToRefresh onRefresh={refresh}>
          <h1 className="text-xl font-bold text-text tracking-tight">My Chats</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Track and continue your active form requests.
          </p>
          <div className="mt-6">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-20 w-full rounded-[20px] bg-surface-1 border border-border-subtle"
                  />
                ))}
              </div>
            ) : (
              <ChatList requests={requests} />
            )}
          </div>
        </PullToRefresh>
      </main>
    </div>
  );
}
