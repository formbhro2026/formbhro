import { ArrowRight, ClipboardCheck, ShieldCheck, PenLine, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";


export function CTASection() {
  return (
    <section id="pricing" className="scroll-mt-24 py-12 sm:py-16">
      <span id="cta" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-brand/40 bg-surface-1 p-8 sm:p-12 shadow-lg">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_50%,rgba(255,122,0,0.18),transparent_60%)]"
          />
          <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Ready to Get Started?</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-text sm:text-4xl">
                Let Us Handle the Forms,
                <br /> You Focus on What Matters.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-text-secondary sm:text-base">
                Start your request now and experience a smooth, secure, and stress-free application process.
              </p>
              <Link
                to="/app"
                search={{ fill: true }}
                aria-label="Fill Now — start a new request"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-dark to-brand-light px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(255,122,0,0.7)] transition-transform hover:scale-[1.02] active:scale-95"
              >
                Fill Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>

            </div>

            {/* Decorative document illustration */}
            <div className="relative hidden h-64 lg:block">
              <div
                aria-hidden
                className="absolute inset-x-6 bottom-0 h-16 rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,122,0,0.35),transparent)]"
              />
              <div className="absolute right-8 top-2 w-48 rotate-3 rounded-xl border border-white/10 bg-surface-2 p-4 shadow-2xl">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-brand" />
                  <div className="h-2 w-20 rounded bg-white/5" />
                </div>
                <ul className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand" />
                      <div className="h-1.5 flex-1 rounded bg-white/5" />
                    </li>
                  ))}
                </ul>
                <PenLine className="absolute -bottom-3 -right-3 h-8 w-8 rotate-45 text-brand" />
              </div>
              <div className="absolute left-4 top-16 grid h-14 w-14 place-items-center rounded-2xl border border-brand/40 bg-surface-2 shadow-md">
                <ShieldCheck className="h-7 w-7 text-brand" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
