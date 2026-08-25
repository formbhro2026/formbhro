import type { ActivityEntry } from "@/data/user-module";

export function RequestTimeline({ activity }: { activity: ActivityEntry[] }) {
  return (
    <ol className="relative ml-1.5 border-l border-border-subtle pl-5">
      {activity.map((a, i) => (
        <li key={`${a.label}-${i}`} className="relative pb-6 last:pb-0">
          <span
            aria-hidden
            className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface-1 ${
              i === 0 ? "bg-brand ring-4 ring-brand/20" : "bg-surface-3"
            }`}
          />
          <p className="text-xs font-bold text-white leading-none">{a.label}</p>
          <p className="mt-1.5 text-[10px] font-bold text-text-muted uppercase tracking-tight">{a.time}</p>
        </li>
      ))}
    </ol>
  );
}
