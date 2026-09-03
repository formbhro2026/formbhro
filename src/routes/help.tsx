import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  MessageSquare,
  Mail,
  Phone,
  ShieldCheck,
  ArrowLeft,
  Headphones,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { CONTACT } from "@/data/landing";

export const Route = createFileRoute("/help")({
  component: HelpSupport,
  head: () => ({
    meta: [
      { title: "Help & Support — Formbhro" },
      {
        name: "description",
        content:
          "Get help with your applications, contact Formbhro support or start a direct chat with our team.",
      },
    ],
  }),
});

function HelpSupport() {
  const navigate = useNavigate();

  const handleDirectChat = () => {
    // Open chat or auth
    void navigate({ to: "/auth", search: { redirect_to: "/app" } });
  };

  return (
    <div className="min-h-screen bg-bg text-white antialiased px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-brand hover:text-brand-light text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-light mb-3">
            <Headphones className="h-3.5 w-3.5" /> 24/7 Dedicated Support
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            Help &amp; Support
          </h1>
          <p className="mt-2 text-base text-text-secondary">
            Need assistance with your form or application? We're here to help you every step of the
            way.
          </p>
        </header>

        {/* Action Cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-10">
          <div className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-surface-1 p-6 flex flex-col justify-between shadow-lg shadow-black/20">
            <div>
              <div className="h-10 w-10 rounded-xl bg-brand/20 flex items-center justify-center text-brand-light mb-4">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Direct Chat with Admin</h3>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Connect directly with the admin support team for instant assistance and personalized
                form filling guidance.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDirectChat}
              className="mt-5 w-full rounded-xl bg-brand py-3 text-xs font-bold text-white uppercase tracking-wider shadow-lg shadow-brand/20 transition-all hover:bg-brand-light active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <MessageSquare className="h-4 w-4" /> Start Direct Chat
            </button>
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface-1 p-6 flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-surface-2 border border-border-subtle flex items-center justify-center text-brand mb-4">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Email Support</h3>
              <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                Send us an email anytime and our customer support team will reply within 24 hours.
              </p>
              <p className="mt-3 text-sm font-semibold text-brand-light font-mono">
                formbhro@gmail.com
              </p>
            </div>
            <a
              href="mailto:formbhro@gmail.com"
              className="mt-5 w-full rounded-xl border border-border-strong bg-surface-2 py-3 text-xs font-bold text-white uppercase tracking-wider transition-all hover:bg-white/5 active:scale-[0.98] flex items-center justify-center gap-2 text-center"
            >
              <Mail className="h-4 w-4" /> Send Email
            </a>
          </div>
        </div>

        {/* Contact Info bar */}
        <div className="rounded-2xl border border-border-subtle bg-surface-2 p-5 mb-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-surface-3 flex items-center justify-center text-brand">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-text-muted font-medium">Helpline Number</p>
              <p className="text-sm font-bold text-white font-mono">{CONTACT.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-surface-3 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-text-muted font-medium">Data Protection</p>
              <p className="text-sm font-bold text-white">100% Secure & Private</p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-brand" /> Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            <div className="bg-surface-1 p-5 rounded-2xl border border-border-subtle">
              <h3 className="font-semibold text-white mb-1.5 text-sm">
                How do I create a new request?
              </h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                Simply sign in and click the "Fill Now" or "New Request" button on your dashboard.
                Choose your form category and our dedicated team member will connect with you in
                live chat.
              </p>
            </div>

            <div className="bg-surface-1 p-5 rounded-2xl border border-border-subtle">
              <h3 className="font-semibold text-white mb-1.5 text-sm">
                Are my uploaded documents safe?
              </h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                Yes, absolutely! All documents are stored in encrypted private storage buckets. Only
                you and your authorized assigned team member can securely access them.
              </p>
            </div>

            <div className="bg-surface-1 p-5 rounded-2xl border border-border-subtle">
              <h3 className="font-semibold text-white mb-1.5 text-sm">
                How long does it take to complete an application?
              </h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                Most standard requests are processed within a few hours. You can track real-time
                progress and receive instant updates in your chat room.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
