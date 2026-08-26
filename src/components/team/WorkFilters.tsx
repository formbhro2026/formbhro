import { useId, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { PRIORITY_META, type Priority } from "@/data/team-module";
import { cn } from "@/lib/utils";

export type WorkFilterValues = {
  q: string;
  user: string;
  rid: string;
  type: string;
  state: "all" | "pending" | "completed";
  priority: "all" | Priority;
  sort: "newest" | "oldest";
};

const STATES = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
] as const;

export function WorkFilters({
  values,
  users,
  types,
  shown,
  total,
  onChange,
  onReset,
}: {
  values: WorkFilterValues;
  users: string[];
  types: string[];
  shown: number;
  total: number;
  onChange: (patch: Partial<WorkFilterValues>) => void;
  onReset: () => void;
}) {
  const id = useId();
  const activeCount =
    (values.user ? 1 : 0) +
    (values.rid ? 1 : 0) +
    (values.type ? 1 : 0) +
    (values.priority !== "all" ? 1 : 0) +
    (values.state !== "all" ? 1 : 0);
  const [open, setOpen] = useState(activeCount > 0);

  const selectClass =
    "h-9 w-full rounded-lg border border-border-subtle bg-surface-2 px-2 text-[11px] text-white focus:border-brand/50";

  return (
    <div className="border-b border-border-subtle p-3">
      <div className="relative">
        <label htmlFor={`${id}-q`} className="sr-only">
          Search assigned requests by user, request ID or type
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <input
          id={`${id}-q`}
          value={values.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search user, request ID, type"
          className="h-10 w-full rounded-xl border border-border-subtle bg-surface-2 pl-9 pr-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50"
        />
      </div>

      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1">
        {STATES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={values.state === s.key}
            onClick={() => onChange({ state: s.key })}
            className={cn(
              "min-h-8 shrink-0 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
              values.state === s.key
                ? "border-brand/40 bg-brand/10 text-brand-light"
                : "border-border-strong px-2.5 text-text-secondary hover:bg-white/5",
            )}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "ml-auto inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
            activeCount > 0
              ? "border-brand/40 bg-brand/10 text-brand-light"
              : "border-border-strong px-2.5 text-text-secondary hover:bg-white/5",
          )}
        >
          <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span aria-label={`${activeCount} filters active`}>({activeCount})</span>
          )}
        </button>
      </div>

      {open && (
        <div
          id={`${id}-panel`}
          className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-surface-2/60 p-2"
        >
          <div>
            <label
              htmlFor={`${id}-user`}
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted"
            >
              User
            </label>
            <select
              id={`${id}-user`}
              value={values.user}
              onChange={(e) => onChange({ user: e.target.value })}
              className={selectClass}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${id}-type`}
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted"
            >
              Request type
            </label>
            <select
              id={`${id}-type`}
              value={values.type}
              onChange={(e) => onChange({ type: e.target.value })}
              className={selectClass}
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={`${id}-rid`}
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted"
            >
              Request ID
            </label>
            <input
              id={`${id}-rid`}
              value={values.rid}
              onChange={(e) => onChange({ rid: e.target.value })}
              placeholder="e.g. FBH-1042"
              className="h-9 w-full rounded-lg border border-border-subtle bg-surface-2 px-2 text-[11px] text-white placeholder:text-text-muted focus:border-brand/50"
            />
          </div>

          <div>
            <label
              htmlFor={`${id}-priority`}
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted"
            >
              Priority
            </label>
            <select
              id={`${id}-priority`}
              value={values.priority}
              onChange={(e) =>
                onChange({ priority: e.target.value as WorkFilterValues["priority"] })
              }
              className={selectClass}
            >
              <option value="all">Any priority</option>
              {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label
              htmlFor={`${id}-sort`}
              className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-text-muted"
            >
              Sort
            </label>
            <select
              id={`${id}-sort`}
              value={values.sort}
              onChange={(e) => onChange({ sort: e.target.value as WorkFilterValues["sort"] })}
              className={selectClass}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <p aria-live="polite" className="text-[11px] text-text-muted">
          Showing <span className="font-semibold text-white">{shown}</span> of {total}{" "}
          {total === 1 ? "request" : "requests"}
        </p>
        {(activeCount > 0 || values.q) && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border-strong px-2.5 text-[11px] font-semibold text-text-secondary hover:bg-white/5"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
