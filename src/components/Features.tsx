import {
  MessageCircle,
  ShieldCheck,
  BarChart3,
  Bell,
  History,
  Users,
  type LucideIcon,
} from "lucide-react";
import { FEATURES } from "@/data/landing";

const iconMap: Record<string, LucideIcon> = {
  MessageCircle,
  ShieldCheck,
  BarChart3,
  Bell,
  History,
  Users,
};

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Features</p>
          <h2 className="mt-3 text-3xl font-extrabold text-text sm:text-4xl">
            Everything You Need, All in One Place
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = iconMap[f.icon];
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/10 bg-surface-1 p-5 transition-all hover:border-brand/40 hover:bg-surface-2 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-dark to-brand-light shadow-[0_8px_24px_-8px_rgba(255,122,0,0.6)]">
                    <Icon className="h-6 w-6 text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-text">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{f.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
