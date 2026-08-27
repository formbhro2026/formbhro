import { createFileRoute } from "@tanstack/react-router";
import { UserHeader } from "@/components/layout/UserHeader";
import { ChatList } from "@/components/chat/ChatList";
import { useUserStore } from "@/lib/user-store";

export const Route = createFileRoute("/app/chats/")({
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
  const { requests, refresh } = useUserStore();

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <UserHeader title="My Chats" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        <PullToRefresh onRefresh={refresh}>
          <h1 className="text-xl font-bold text-white tracking-tight">My Chats</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Track and continue your active form requests.
          </p>
          <div className="mt-6">
            <ChatList requests={requests} />
          </div>
        </PullToRefresh>
      </main>
    </div>
  );
}
