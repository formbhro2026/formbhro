import { createFileRoute } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import { UserHeader } from "@/components/layout/UserHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useUserStore } from "@/lib/user-store";

export const Route = createFileRoute("/app/news")({
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
  const featured = news.find((n) => n.featured);
  const rest = news.filter((n) => !n.featured);

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
                <article className="relative overflow-hidden rounded-2xl border border-brand/30 bg-surface-1 p-5">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.14),transparent_65%)]"
                  />
                  <span className="inline-flex rounded-full border border-brand/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-light">
                    {featured.category}
                  </span>
                  <h2 className="mt-3 text-base font-bold text-white sm:text-lg">
                    {featured.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {featured.description}
                  </p>
                  <p className="mt-3 text-[11px] text-text-muted">{featured.date}</p>
                </article>
              )}

              <ul className="space-y-3">
                {rest.map((n) => (
                  <li key={n.id}>
                    <article className="rounded-2xl border border-border-subtle bg-surface-1 p-4 transition-colors duration-200 hover:border-border-strong">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                          {n.category}
                        </span>
                        <span className="text-[11px] text-text-muted">{n.date}</span>
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
