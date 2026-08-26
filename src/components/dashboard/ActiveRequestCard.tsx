import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { SupportRequest } from "@/data/user-module";

export function ActiveRequestCard({
  request,
  documentCount,
}: {
  request: SupportRequest;
  documentCount: number;
}) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        Your Active Request
      </h2>
      <div className="mt-3 rounded-2xl border border-white/10 bg-surface-1 p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white sm:text-base">
              {request.title}
            </h3>
            <p className="mt-1 text-[11px] text-text-muted">Request ID: {request.id}</p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-[11px] text-text-muted">Assigned To</dt>
            <dd className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-white">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
              <span className="truncate">{request.assignedTo}</span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] text-text-muted">Last Update</dt>
            <dd className="mt-0.5 truncate text-xs text-white">{request.lastUpdate}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] text-text-muted">Documents</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-white">
              <FileText className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
              {documentCount} uploaded
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] text-text-muted">Progress</dt>
            <dd className="mt-1.5">
              <div
                role="progressbar"
                aria-valuenow={request.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Request progress"
                className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-dark to-brand-light"
                  style={{ width: `${request.progress}%` }}
                />
              </div>
            </dd>
          </div>
        </dl>

        <Link
          to="/app/chats/$requestId"
          params={{ requestId: request.id }}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-5 py-2.5 text-sm font-semibold text-brand-light transition-colors duration-200 hover:bg-brand/15"
        >
          Continue Chat <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
