import { cn } from "@/lib/utils";

/**
 * Evaluates whether a team member is online based on heartbeat timestamp and status.
 */
export function isOnline(availability?: string | null, lastSeenAt?: string | null): boolean {
  if (availability === "offline") return false;
  if (!lastSeenAt) return availability === "online";
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  // Considered online if heartbeat received within the last 90 seconds (heartbeat runs every 25s)
  return diff < 90000 && availability !== "away";
}

export function getPresenceStatus(
  availability?: string | null,
  lastSeenAt?: string | null,
): "online" | "away" | "offline" {
  if (availability === "offline") return "offline";
  if (availability === "away") return "away";
  return isOnline(availability, lastSeenAt) ? "online" : "offline";
}

export function PresenceDot({
  availability,
  lastSeenAt,
  showLabel = false,
  className,
}: {
  availability?: string | null;
  lastSeenAt?: string | null;
  showLabel?: boolean;
  className?: string;
}) {
  const status = getPresenceStatus(availability, lastSeenAt);
  const online = status === "online";
  const isAway = status === "away";

  const statusText = online ? "Online" : isAway ? "Away" : "Offline";
  const colorClass = online
    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
    : isAway
      ? "bg-amber-400"
      : "bg-zinc-500";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex h-2 w-2">
        {online && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={cn("relative inline-flex rounded-full h-2 w-2", colorClass)} />
      </span>
      {showLabel && (
        <span
          className={cn(
            "text-[10px] font-semibold tracking-tight",
            online ? "text-emerald-400" : isAway ? "text-amber-400" : "text-text-muted",
          )}
        >
          {statusText}
        </span>
      )}
    </span>
  );
}
