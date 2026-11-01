import React from "react";
import { Bell, ShieldCheck, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface NativeAlertModalProps {
  open: boolean;
  type: "notification" | "battery";
  onAction: () => void;
  onDismiss: () => void;
}

export function NativeAlertModal({ open, type, onAction, onDismiss }: NativeAlertModalProps) {
  const isBattery = type === "battery";

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onDismiss()}>
      <DialogContent className="max-w-[340px] rounded-3xl border border-white/10 bg-surface-1 p-6 text-center shadow-2xl backdrop-blur-xl sm:max-w-[380px]">
        {/* Android style Icon Header */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 border border-brand/20 shadow-inner">
          {isBattery ? (
            <Zap className="h-8 w-8 text-brand animate-pulse" />
          ) : (
            <Bell className="h-8 w-8 text-brand" />
          )}
        </div>

        <DialogHeader className="mt-4 space-y-2">
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            {isBattery ? "Enable Background Alerts" : "Allow Push Notifications"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-text-muted">
            {isBattery
              ? "Formbhro needs permission to run in the background so you never miss urgent calls, status updates, or chat messages when the app is minimized."
              : "Turn on notification bar alerts so you receive live updates, messages, and calls directly on your screen even when your phone is locked."}
          </DialogDescription>
        </DialogHeader>

        {/* Feature Highlights */}
        <div className="mt-4 space-y-2 rounded-2xl border border-border-subtle bg-surface-2/60 p-3 text-left">
          <div className="flex items-center gap-2.5 text-xs text-text-secondary">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Real-time instant chat delivery</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-text-secondary">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Reliable background sync</span>
          </div>
        </div>

        {/* Action Buttons styled like Android Native Material Sheet */}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onAction}
            className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-dark active:scale-[0.98]"
          >
            {isBattery ? "Allow Background Activity" : "Turn On Alerts"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-xl py-2.5 text-xs font-semibold text-text-muted hover:text-white transition-colors"
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

