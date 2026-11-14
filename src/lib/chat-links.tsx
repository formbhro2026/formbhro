import * as React from "react";
import { Browser } from "@capacitor/browser";
import { isCapacitor } from "@/lib/fcm";
import { ExternalLink } from "lucide-react";

/**
 * Universal safe external link opener.
 * Seamlessly opens links in Android system browser via native Intent or Capacitor Browser,
 * preventing WebView navigation lockups or blank popups.
 */
export async function openExternalLink(rawUrl: string): Promise<void> {
  if (!rawUrl || typeof rawUrl !== "string") return;
  let targetUrl = rawUrl.trim();

  // Prepend protocol if missing (e.g. www.google.com -> https://www.google.com)
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  // 1. Native Android JavascriptInterface bridge if available
  if (typeof window !== "undefined") {
    const bridge = (window as any).FormbharoNativeBridge;
    if (bridge && typeof bridge.openExternalUrl === "function") {
      try {
        bridge.openExternalUrl(targetUrl);
        return;
      } catch (e) {
        console.warn("[ChatLinks] FormbharoNativeBridge.openExternalUrl failed:", e);
      }
    }
  }

  // 2. Capacitor InApp Browser plugin
  if (isCapacitor()) {
    try {
      await Browser.open({ url: targetUrl });
      return;
    } catch (e) {
      console.warn("[ChatLinks] Browser.open failed, falling back to window.open:", e);
    }
  }

  // 3. Browser fallback
  try {
    const newWindow = window.open(targetUrl, "_blank", "noopener,noreferrer");
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      // Popup blocked or WebView strict mode: navigate safely via anchor click
      const a = document.createElement("a");
      a.href = targetUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } catch (err) {
    console.error("[ChatLinks] Failed to open link:", err);
  }
}

// Regex to capture http://, https://, and www. links
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;

interface RenderOptions {
  highlightQuery?: string;
  activeMatch?: boolean;
}

/**
 * Renders chat message text with clickable links and optional query highlighting.
 */
export function renderMessageWithLinks(
  text: string,
  options?: RenderOptions,
): React.ReactNode {
  if (!text) return null;

  const parts = text.split(URL_REGEX);
  if (parts.length === 1 && !options?.highlightQuery) {
    return text;
  }

  return parts.map((part, index) => {
    const isUrl = /^https?:\/\//i.test(part) || /^www\./i.test(part);
    if (isUrl) {
      const fullUrl = /^https?:\/\//i.test(part) ? part : `https://${part}`;
      return (
        <a
          key={`link-${index}`}
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            const hasBridge =
              typeof window !== "undefined" &&
              typeof (window as any).FormbharoNativeBridge?.openExternalUrl === "function";
            if (isCapacitor() || hasBridge) {
              e.preventDefault();
              e.stopPropagation();
              void openExternalLink(fullUrl);
            }
          }}
          className="inline-flex items-center gap-0.5 font-medium text-brand-light underline underline-offset-2 hover:text-white break-all transition-colors cursor-pointer"
          title={`Open ${fullUrl}`}
        >
          <span>{part}</span>
          <ExternalLink className="inline-block h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
        </a>
      );
    }

    if (options?.highlightQuery && options.highlightQuery.trim()) {
      return (
        <HighlightSegment
          key={`text-${index}`}
          text={part}
          query={options.highlightQuery}
          active={options.activeMatch}
        />
      );
    }

    return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
  });
}

function HighlightSegment({
  text,
  query,
  active,
}: {
  text: string;
  query: string;
  active?: boolean;
}) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const index = lower.indexOf(q);
  if (index === -1) return <>{text}</>;

  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = text.slice(index + q.length);

  return (
    <>
      {before}
      <mark
        className={`rounded px-1 py-0.5 font-semibold text-black transition-all ${
          active
            ? "bg-amber-400 ring-2 ring-amber-300 ring-offset-1 ring-offset-surface-1"
            : "bg-amber-300/80"
        }`}
      >
        {match}
      </mark>
      <HighlightSegment text={after} query={query} active={active} />
    </>
  );
}

