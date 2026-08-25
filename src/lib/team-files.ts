import type { TeamDocument } from "@/data/team-module";
import { resolveDocumentUrl } from "@/lib/doc-access";

/**
 * Documents are served through a controlled blob handoff so raw storage URLs
 * are never exposed to the browser address bar or the DOM.
 */
function toBlob(doc: TeamDocument) {
  if (doc.kind === "html" && doc.html) {
    return new Blob([`<!doctype html><meta charset="utf-8"><title>${doc.name}</title>${doc.html}`], { type: "text/html" });
  }
  const body = `Formbhro secure document\n\nFile: ${doc.name}\nRequest: ${doc.requestId}\nUploaded by: ${doc.uploadedBy}\nUploaded: ${doc.uploadedAt}\nSize: ${doc.size}\n`;
  return new Blob([body], { type: "text/plain" });
}

/**
 * Resolves the readable URL for a document: live documents get a short-lived
 * signed URL from private storage, demo documents fall back to a local blob.
 */
export async function resolveTeamDocumentUrl(doc: TeamDocument, download = false) {
  if (doc.storagePath) return resolveDocumentUrl({ name: doc.name, storagePath: doc.storagePath }, download);
  return URL.createObjectURL(toBlob(doc));
}

/** One-click download — no extra confirmation. */
export async function downloadDocument(doc: TeamDocument) {
  const url = await resolveTeamDocumentUrl(doc, true);
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function openDocumentInNewTab(doc: TeamDocument) {
  const url = await resolveTeamDocumentUrl(doc, false);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
  if (url.startsWith("blob:")) window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function kindFromFile(file: File): TeamDocument["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "text/html") return "html";
  return "doc";
}
