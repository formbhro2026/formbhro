import { createFileRoute } from "@tanstack/react-router";
import { Newspaper, Share2, Check } from "lucide-react";
import { useState } from "react";
import { UserHeader } from "@/components/layout/UserHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useUserStore } from "@/lib/user-store";
import { toast } from "sonner";

export const Route = createFileRoute("/app/news")({
  ssr: false,
  component: NewsUpdates,
  head: () => ({
    meta: [
      { title: "News & Updates — Formbhro" },
      {
        name: "description",
        content:
          "Platform announcements, service updates and new form availability from the Formbhro team.",
      },
      { property: "og:title", content: "News & Updates — Formbhro" },
      {
        property: "og:description",
        content: "Platform announcements and service updates from Formbhro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function NewsUpdates() {
  const { news } = useUserStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const featured = news.find((n) => n.featured);
  const rest = news.filter((n) => !n.featured);

  const handleShare = async (item: {
    id: string;
    title: string;
    description: string;
    category?: string;
  }) => {
    const url = typeof window !== "undefined" ? window.location.href : "https://formbhro.com/app/news";
    const shareText = `📢 *${item.title}*\n\n${item.description}\n\nStay updated with Formbhro: ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: shareText,
          url,
        });
        toast.success("Shared successfully!");
        return;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.warn("Native share failed, falling back to clipboard:", err);
        } else {
          return;
        }
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
      toast.success("News copied to clipboard! You can share it anywhere.");
    } catch (e) {
      // Direct WhatsApp share fallback
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, "_blank");
    }
  };

  return (
    <>
      <UserHeader title="News & Updates" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          News &amp; Updates
        </h1>
        <p className="mt-1 text-sm text-text-secondary">Announcements from the Formbhro team.</p>

        <div className="mt-5 space-y-4">
          {news.length === 0 ? (
            <EmptyState icon={Newspaper} title="No new updates right now." />
          ) : (
            <>
              {featured && (
                <article className="relative overflow-hidden rounded-2xl border border-brand/30 bg-surface-1 p-5 shadow-lg shadow-black/20">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.14),transparent_65%)]"
                  />
                  {featured.image_url && (
                    <div className="mb-4 overflow-hidden rounded-xl border border-white/10 max-h-64 bg-surface-2">
                      <img
                        src={featured.image_url}
                        alt={featured.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Gracefully hide broken remote image
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex rounded-full border border-brand/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-light">
                      {featured.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleShare(featured)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-light hover:bg-brand/20 hover:text-white transition-colors"
                      title="Share News"
                    >
                      {copiedId === featured.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[11px] text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="h-3.5 w-3.5" />
                          <span className="text-[11px]">Share</span>
                        </>
                      )}
                    </button>
                  </div>
                  <h2 className="mt-3 text-base font-bold text-white sm:text-lg">
                    {featured.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {featured.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                    <p className="text-[11px] text-text-muted">{featured.date}</p>
                  </div>
                </article>
              )}

              <ul className="space-y-3">
                {rest.map((n) => (
                  <li key={n.id}>
                    <article className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 p-4 transition-colors duration-200 hover:border-border-strong">
                      {n.image_url && (
                        <div className="mb-3 overflow-hidden rounded-xl border border-white/5 max-h-48 bg-surface-2">
                          <img
                            src={n.image_url}
                            alt={n.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                            {n.category}
                          </span>
                          <span className="text-[11px] text-text-muted">{n.date}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleShare(n)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary hover:border-brand/40 hover:text-white transition-colors"
                          title="Share News"
                        >
                          {copiedId === n.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-[11px] text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-3.5 w-3.5" />
                              <span className="text-[11px]">Share</span>
                            </>
                          )}
                        </button>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-white">{n.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                        {n.description}
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
    </>
  );
}
