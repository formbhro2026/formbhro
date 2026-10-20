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

/**
 * Formats a last date string (e.g. "2026-11-06T00:00:00+00:00" or "2026-11-06")
 * into a clean readable date format like "06 November 2026".
 * Strips time and timezone, and handles fallback gracefully.
 */
export function formatLastDate(rawDate?: string | null): string {
  if (!rawDate) return "Open";
  const trimmed = rawDate.trim();
  if (!trimmed || trimmed.toLowerCase() === "open" || trimmed.toLowerCase() === "check notice") {
    return "Open";
  }

  // Extract YYYY-MM-DD if ISO string or timestamp
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const month = parseInt(dateOnlyMatch[2], 10) - 1; // 0-indexed
    const day = parseInt(dateOnlyMatch[3], 10);
    const dateObj = new Date(year, month, day);
    if (!isNaN(dateObj.getTime())) {
      const dayStr = String(day).padStart(2, "0");
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      return `${dayStr} ${monthNames[month]} ${year}`;
    }
  }

  // Fallback to Date parser
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const dayStr = String(d.getDate()).padStart(2, "0");
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      return `${dayStr} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    }
  } catch (_) {}

  // Strip any T... or +... if parsing fails
  return trimmed.split("T")[0];
}

