import { Link } from "@tanstack/react-router";
import { ArrowRight, Megaphone } from "lucide-react";
import type { ChatMessage, SupportRequest } from "@/data/user-module";

export function LatestUpdate({
  request,
  message,
}: {
  request: SupportRequest;
  message: ChatMessage;
}) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Latest Update
      </h2>
      <div className="mt-3 rounded-2xl border border-white/10 bg-surface-1 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-surface-2">
            <Megaphone className="h-4 w-4 text-brand" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-white">
              {message.text ?? `Shared ${message.file?.name}`}
            </p>
            <p className="mt-1 truncate text-[11px] text-text-muted">
              {request.title} • Today • {message.time}
            </p>
          </div>
        </div>
        <Link
          to="/app/chats/$requestId"
          params={{ requestId: request.id }}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-light transition-colors duration-200 hover:text-brand"
        >
          View Conversation <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
