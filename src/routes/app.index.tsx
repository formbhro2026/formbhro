import { createFileRoute } from "@tanstack/react-router";
import { UserHeader } from "@/components/layout/UserHeader";
import { WelcomeSection } from "@/components/dashboard/WelcomeSection";
import { FillNowCard } from "@/components/dashboard/FillNowCard";
import { ActiveRequestCard } from "@/components/dashboard/ActiveRequestCard";
import { LatestUpdate } from "@/components/dashboard/LatestUpdate";
import { RecentRequests } from "@/components/dashboard/RecentRequests";
import { QuickAccess } from "@/components/dashboard/QuickAccess";
import { MobileDashboard } from "@/components/dashboard/MobileDashboard";
import { useUserStore } from "@/lib/user-store";

export const Route = createFileRoute("/app/")({
  component: UserHome,
  head: () => ({
    meta: [
      { title: "Home — Formbhro Support Dashboard" },
      {
        name: "description",
        content:
          "Start a form assistance request, continue your chat with the Formbhro support team, and track your request status.",
      },
      { property: "og:title", content: "Formbhro — Your Support Dashboard" },
      {
        property: "og:description",
        content:
          "Start a request, chat with support, share documents and track progress in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

import { PullToRefresh } from "@/components/common/PullToRefresh";

function UserHome() {
  const { requests, activeRequest, messagesFor, refresh } = useUserStore();

  const latestRequest = activeRequest ?? requests[0];
  const latestMessages = latestRequest ? messagesFor(latestRequest.id) : [];
  const latestMessage = latestMessages[latestMessages.length - 1];

  return (
    <div className="flex min-h-screen flex-col bg-bg text-white">
      <UserHeader title="Home" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-0 pb-28 pt-0 sm:px-6 lg:pb-10 lg:pt-5">
        <PullToRefresh onRefresh={refresh}>
          <MobileDashboard />
        </PullToRefresh>
      </main>
    </div>
  );
}
