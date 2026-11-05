import * as documentsApi from "@/lib/api/documents";
import type { UserDocument } from "@/data/user-module";
import { toast } from "sonner";

type Openable = Pick<UserDocument, "name" | "previewUrl"> & { storagePath?: string };

/**
 * Universal file downloader that works seamlessly across desktop web,
 * mobile browsers, and Android Capacitor WebViews.
 * Cross-origin signed URLs are fetched into a local Blob so the browser
 * honors the exact requested filename instead of ignoring the download attribute.
 */
export async function triggerFileDownload(url: string, filename: string): Promise<boolean> {
  try {
    toast.info(`Downloading ${filename}…`);

    // 0. Native Android bridge via system DownloadManager
    if (typeof window !== "undefined") {
      const bridge = (window as any).FormbharoNativeBridge;
      if (bridge && typeof bridge.downloadFile === "function") {
        bridge.downloadFile(url, filename);
        return true;
      }
    }

    // 1. Direct blob or data URL
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    }

    // 2. Fetch as Blob for guaranteed same-origin filename download
    try {
      const response = await fetch(url, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        return true;
      }
    } catch (fetchErr) {
      console.warn("[triggerFileDownload] Blob fetch failed, falling back to direct navigation:", fetchErr);
    }

    // 3. Fallback: anchor click with target blank
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (err) {
    console.error("[triggerFileDownload] Failed to trigger download:", err);
    // 4. Ultimate fallback: window.open
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
}

/**
 * Documents live in a private bucket, so every read goes through a short-lived
 * signed URL. Demo documents fall back to their inline preview URL.
 */
export async function resolveDocumentUrl(doc: Openable, download = false): Promise<string | null> {
  if (doc.storagePath) {
    try {
      return await documentsApi.getSignedUrl(doc.storagePath, 300, download);
    } catch {
      return null;
    }
  }
  return doc.previewUrl ?? null;
}

export async function openDocument(doc: Openable, download = false) {
  const url = await resolveDocumentUrl(doc, download);
  if (!url) {
    toast.error("Could not access document. Please try again.");
    return false;
  }
  if (download) {
    return await triggerFileDownload(url, doc.name);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}
