import * as documentsApi from "@/lib/api/documents";
import type { UserDocument } from "@/data/user-module";

type Openable = Pick<UserDocument, "name" | "previewUrl"> & { storagePath?: string };

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
  if (!url) return false;
  if (download) {
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}
