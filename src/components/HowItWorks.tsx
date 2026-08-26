import {
  FilePen,
  Headphones,
  CloudUpload,
  MessageSquareText,
  CircleCheck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { STEPS } from "@/data/landing";

const iconMap: Record<string, LucideIcon> = {
  FilePen,
  Headphones,
  CloudUpload,
  MessageSquareText,
  CircleCheck,
};

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-extrabold text-text sm:text-4xl">
            Your Journey to Hassle-Free Applications
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-14 rounded-full bg-brand shadow-[0_0_10px_rgba(255,122,0,0.5)]" />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => {
            const Icon = iconMap[s.icon];
            return (
              <div key={s.n} className="relative">
                <div className="group h-full rounded-2xl border border-white/10 bg-surface-1 p-5 transition-colors hover:border-brand/40 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                      {s.n}
                    </span>
                    <Icon className="h-6 w-6 text-brand" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-semibold text-text">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    className="absolute top-1/2 -right-3 hidden h-4 w-4 -translate-y-1/2 text-brand lg:block"
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
