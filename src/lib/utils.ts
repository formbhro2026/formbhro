import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { isCapacitor } from "./fcm";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function canShareScreen(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  // Not supported on mobile apps wrapped via Capacitor natively yet without custom plugins
  if (isCapacitor()) return false;

  // Basic check for browser support
  return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
}
