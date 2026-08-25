import { Users, MessageCircle, FileText, Star, type LucideIcon } from "lucide-react";
import { STATS } from "@/data/landing";

const iconMap: Record<string, LucideIcon> = { Users, MessageCircle, FileText, Star };

export function Stats() {
  return (
    <section id="for-businesses" className="scroll-mt-24 pb-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-brand/40 bg-surface-1 p-6 sm:p-8 shadow-md">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_50%,rgba(255,122,0,0.10),transparent_70%)]"
          />
          <div className="relative grid grid-cols-2 gap-6 lg:grid-cols-4">
            {STATS.map((s) => {
              const Icon = iconMap[s.icon];
              return (
                <div key={s.label} className="flex items-center gap-4">
                  <Icon className="h-9 w-9 shrink-0 text-brand" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <div className="text-2xl font-extrabold text-text sm:text-3xl">{s.value}</div>
                    <div className="text-xs text-text-secondary sm:text-sm">{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
