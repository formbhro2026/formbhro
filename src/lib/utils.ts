import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function canShareScreen(): boolean {
  // Always return true to ensure the button renders in the mobile APK.
  // Note: True screen sharing is not supported natively in Android WebViews,
  // but since the current implementation only triggers an alert, we can safely render it.
  return true;
}
