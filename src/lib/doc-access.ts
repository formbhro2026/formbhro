import * as documentsApi from "@/lib/api/documents";
import type { UserDocument } from "@/data/user-module";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Openable = Pick<UserDocument, "name" | "previewUrl"> & { id?: string; storagePath?: string };

/**
 * Universal file downloader that works seamlessly across desktop web,
 * mobile browsers, and Android Capacitor WebViews.
 */
export async function triggerFileDownload(url: string, filename: string): Promise<boolean> {
  try {
    const cleanFilename = (filename || "document").replace(/[^\w.\- ]+/g, "_");
    toast.info(`Downloading ${cleanFilename}…`);

    // 1. Direct blob or data URL — handled directly in client DOM
    if (url.startsWith("blob:") || url.startsWith("data:")) {
      const a = document.createElement("a");
      a.href = url;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    }

    // 2. Native Android bridge via system DownloadManager (for remote http/https URLs)
    if (typeof window !== "undefined") {
      const bridge = (window as any).FormbharoNativeBridge;
      if (bridge && typeof bridge.downloadFile === "function") {
        bridge.downloadFile(url, cleanFilename);
        return true;
      }
    }

    // 3. Fetch as Blob for guaranteed same-origin filename download in browsers
    try {
      const response = await fetch(url, { mode: "cors" });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        return true;
      }
    } catch (fetchErr) {
      console.warn("[triggerFileDownload] Blob fetch failed, falling back to direct navigation:", fetchErr);
    }

    // 4. Fallback: anchor click with target blank
    const a = document.createElement("a");
    a.href = url;
    a.download = cleanFilename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch (err) {
    console.error("[triggerFileDownload] Failed to trigger download:", err);
    // 5. Ultimate fallback: window.open
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
}

/**
 * Documents live in a private bucket, so every read goes through a short-lived
 * signed URL. Demo documents fall back to their inline preview URL.
 */
export async function resolveDocumentUrl(doc: Openable, download = false): Promise<string | null> {
  let path = doc.storagePath;

  // If storagePath is missing on the attachment object, lookup by ID in DB
  if (!path && doc.id) {
    try {
      const { data } = await supabase
        .from("documents")
        .select("storage_path")
        .eq("id", doc.id)
        .maybeSingle();
      if (data?.storage_path) {
        path = data.storage_path;
        doc.storagePath = path;
      }
    } catch (_) {}
  }

  if (path) {
    try {
      return await documentsApi.getSignedUrl(path, 600, download);
    } catch (err) {
      console.warn("[resolveDocumentUrl] getSignedUrl error:", err);
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
