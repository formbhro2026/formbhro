import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CallLogData } from "@/data/user-module";

interface CallEventBubbleProps {
  callLog: CallLogData;
  time?: string;
  currentUserId?: string;
  onCallBack?: (type: "audio" | "video") => void;
}

export function CallEventBubble({
  callLog,
  time,
  currentUserId,
  onCallBack,
}: CallEventBubbleProps) {
  const isCaller = currentUserId ? callLog.caller_id === currentUserId : false;
  const isVideo = callLog.call_type === "video";
  const isMissed = callLog.status === "missed";
  const isDeclined = callLog.status === "declined";
  const isCancelled = callLog.status === "cancelled";
  const isCompleted = callLog.status === "completed";

  // Direction & Label
  let title = isVideo ? "Video Call" : "Voice Call";
  let subtitle = isCaller ? "Outgoing" : "Incoming";

  if (isMissed) {
    title = isVideo ? "Missed Video Call" : "Missed Voice Call";
    subtitle = isCaller ? "No answer" : "Missed";
  } else if (isDeclined) {
    title = isVideo ? "Declined Video Call" : "Declined Voice Call";
    subtitle = "Declined";
  } else if (isCancelled) {
    title = isVideo ? "Cancelled Video Call" : "Cancelled Voice Call";
    subtitle = "Cancelled";
  } else if (isCompleted && callLog.duration_seconds !== undefined) {
    const mins = Math.floor(callLog.duration_seconds / 60);
    const secs = callLog.duration_seconds % 60;
    const durLabel = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    subtitle = `${isCaller ? "Outgoing" : "Incoming"} • ${durLabel}`;
  }

  // Icon selection
  const Icon = isVideo
    ? Video
    : isMissed
      ? PhoneMissed
      : isCaller
        ? PhoneOutgoing
        : PhoneIncoming;

  const isFailedOrMissed = isMissed || isDeclined;

  return (
    <div className="flex w-full justify-center my-2 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface-2/95 px-3.5 py-2.5 shadow-md backdrop-blur-sm max-w-xs sm:max-w-sm">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
            isFailedOrMissed
              ? "bg-danger/15 text-danger border border-danger/20"
              : isCompleted
                ? "bg-brand/15 text-brand border border-brand/20"
                : "bg-surface-3 text-text-muted border border-border-subtle",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-bold truncate",
              isFailedOrMissed ? "text-danger-light" : "text-white",
            )}
          >
            {title}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted mt-0.5">
            <span>{subtitle}</span>
            {time && (
              <>
                <span>•</span>
                <span>{time}</span>
              </>
            )}
          </div>
        </div>

        {onCallBack && (
          <button
            type="button"
            onClick={() => onCallBack(callLog.call_type)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-3 border border-border-subtle text-text-secondary hover:border-brand/40 hover:text-brand hover:bg-surface-4 transition-colors active:scale-95"
            title={`Call back (${callLog.call_type})`}
            aria-label={`Call back (${callLog.call_type})`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
