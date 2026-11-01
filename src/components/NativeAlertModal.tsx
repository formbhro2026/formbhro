import React from "react";
import { Bell, Zap, ShieldCheck, CheckCircle2, BatteryCharging, X } from "lucide-react";
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
      <DialogContent className="max-w-[92vw] sm:max-w-[400px] rounded-3xl border border-white/10 bg-zinc-950/95 p-6 text-center shadow-2xl backdrop-blur-2xl overflow-hidden text-white">
        {/* Subtle background glow effect */}
        <div
          className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isBattery ? "bg-amber-500" : "bg-orange-500"
          }`}
        />

        {/* Top Icon with pulsing gradient badge */}
        <div className="relative mx-auto mt-2 flex h-20 w-20 items-center justify-center">
          <div
            className={`absolute inset-0 rounded-2xl opacity-25 blur-md ${
              isBattery ? "bg-amber-500 animate-pulse" : "bg-orange-500 animate-pulse"
            }`}
          />
          <div
            className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner ${
              isBattery
                ? "bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400"
                : "bg-gradient-to-br from-orange-500/20 to-red-500/10 border-orange-500/30 text-orange-400"
            }`}
          >
            {isBattery ? (
              <Zap className="h-8 w-8 text-amber-400 fill-amber-400/20" />
            ) : (
              <Bell className="h-8 w-8 text-orange-400 fill-orange-400/20" />
            )}
          </div>
        </div>

        {/* Header Content */}
        <DialogHeader className="mt-4 space-y-2 text-center sm:text-center">
          <div className="inline-flex items-center justify-center gap-1.5 mx-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-white/5 border border-white/10 text-zinc-300">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span>Recommended for real-time updates</span>
          </div>

          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            {isBattery ? "Enable Background Alerts" : "Turn On Notifications"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-zinc-400 max-w-[320px] mx-auto">
            {isBattery
              ? "Allow Formbhro to run in the background so you receive instant updates, customer chats, and call alerts even when the app is closed."
              : "Allow notifications to receive immediate message alerts, task status updates, and audio calls directly on your lock screen."}
          </DialogDescription>
        </DialogHeader>

        {/* Feature Benefits List */}
        <div className="mt-4 space-y-2 rounded-2xl border border-white/5 bg-zinc-900/60 p-3.5 text-left text-xs">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-full p-0.5 bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-semibold text-zinc-200">Real-Time Chat & Calls</p>
              <p className="text-[11px] text-zinc-400">Receive alerts instantly without missing important inquiries.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-full p-0.5 bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="font-semibold text-zinc-200">Zero Idle Battery Drain</p>
              <p className="text-[11px] text-zinc-400">Smart background sync stays asleep until a push notification arrives.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Allow vs Decline */}
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onAction}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer"
          >
            <span>{isBattery ? "Allow Background Alerts" : "Allow Notifications"}</span>
            <CheckCircle2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-xl border border-white/10 bg-zinc-900/40 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900/80 transition-colors cursor-pointer"
          >
            Decline (Not Now)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
