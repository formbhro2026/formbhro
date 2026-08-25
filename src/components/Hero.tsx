import { ArrowRight, Play, MessageCircle, ShieldCheck, FileText, BarChart3 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { ProductMockup } from "./ProductMockup";

const benefits = [
  { icon: MessageCircle, label: "Real-time Support" },
  { icon: ShieldCheck, label: "Secure & Private" },
  { icon: FileText, label: "Document Sharing" },
  { icon: BarChart3, label: "Track Every Step" },
];

export function Hero() {
  return (
    <section id="home" className="scroll-mt-24 relative overflow-hidden pt-28 pb-16 sm:pt-32 lg:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,122,0,0.12),transparent_60%)]"
      />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:px-8">
        <div className="min-w-0 text-center lg:text-left">
          <span className="inline-flex items-center rounded-full border border-brand/40 px-3 py-1 text-xs font-medium text-brand-light">
            Smart Form Assistance Platform
          </span>
          <h1 className="mt-5 text-[clamp(2rem,7vw,3.75rem)] font-extrabold leading-[1.06] tracking-tight text-text">
            Forms Made Simple.
            <br />
            <span className="bg-gradient-to-r from-brand-dark to-brand-light bg-clip-text text-transparent">
              Assistance Made Personal.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg lg:mx-0">
            Get expert help with your forms, share documents securely, and track your application in real time — all
            from one trusted platform.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              to="/app"
              search={{ fill: true }}
              aria-label="Fill Now — start a new request"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-dark to-brand-light px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(255,122,0,0.7)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              Fill Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <a
              href="#how-it-works"
              aria-label="Watch product demo"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
            >
              <Play className="h-4 w-4 fill-white text-white" aria-hidden="true" /> Watch Demo
            </a>
          </div>

          <ul className="mx-auto mt-10 grid max-w-xl grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:mx-0 lg:max-w-none">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.label} className="flex min-w-0 flex-col items-center gap-2 lg:items-start">
                  <Icon className="h-5 w-5 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />
                  <span className="text-xs font-medium text-text-secondary">{b.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mx-auto flex w-full min-w-0 justify-center lg:justify-end">
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}
