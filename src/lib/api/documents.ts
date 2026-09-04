import { supabase } from "@/integrations/supabase/client";
import { ApiError, type DocumentRow, type SenderRole } from "./types";

const BUCKET = "request-documents";
const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED = [
  "image/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];

export function kindOf(mime: string): "pdf" | "image" | "doc" | "zip" {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("zip")) return "zip";
  return "doc";
}

function safeName(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
}

/**
 * Uploads to private storage, then records the document row.
 * Storage URLs are never exposed — reads go through short-lived signed URLs.
 */
export async function uploadDocument(input: {
  file: File;
  /** Omit for a personal document that is not attached to any request. */
  requestId?: string;
  chatRoomId?: string;
  uploaderRole: SenderRole;
  /** Optional display name override (extension is preserved from the file). */
  fileName?: string;
  onProgress?: (percent: number) => void;
}): Promise<DocumentRow> {
  const { file, requestId } = input;
  if (file.size > MAX_BYTES)
    throw new ApiError("File is larger than the 25 MB limit.", "file_too_large");
  if (!ALLOWED.some((prefix) => file.type.startsWith(prefix))) {
    throw new ApiError(
      "Unsupported file type. Upload an image, PDF, DOC, DOCX or ZIP.",
      "unsupported_type",
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Session expired. Please sign in again.", "unauthenticated");

  const displayName = input.fileName?.trim() ? safeName(input.fileName.trim()) : file.name;
  const folder = requestId ?? uid;
  const path = `${folder}/${crypto.randomUUID()}-${safeName(displayName)}`;
  input.onProgress?.(10);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw new ApiError("Upload failed. Please try again.", "storage_failure");
  input.onProgress?.(75);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      request_id: requestId ?? null,
      chat_room_id: input.chatRoomId ?? null,
      uploaded_by: uid,
      uploader_role: input.uploaderRole,
      file_name: displayName,
      storage_path: path,
      mime_type: file.type || "application/octet-stream",
      kind: kindOf(file.type),
      size_bytes: file.size,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    if (error.message.includes("RATE_LIMIT_EXCEEDED")) {
      throw new ApiError("Too many uploads. Please try again shortly.", "RATE_LIMIT_EXCEEDED");
    }
    throw new ApiError(error.message, error.code);
  }
  input.onProgress?.(100);
  return data;
}

/** Short-lived signed URL for preview or download. */
export async function getSignedUrl(storagePath: string, expiresInSeconds = 300, download = false) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds, download ? { download: true } : undefined);
  if (error || !data)
    throw new ApiError("Could not open this document. Please try again.", "storage_failure");
  return data.signedUrl;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(val?: string | null): val is string {
  return typeof val === "string" && UUID_REGEX.test(val.trim());
}

export async function listDocuments(opts?: {
  requestId?: string;
  userId?: string;
  limit?: number;
}): Promise<DocumentRow[]> {
  let resolvedRequestId = opts?.requestId?.trim();
  let resolvedUserId = opts?.userId?.trim();

  // If requestId is provided but not a UUID (e.g. reference 'FRM-2663A63'), resolve it
  if (resolvedRequestId && !isUuid(resolvedRequestId)) {
    try {
      const { data: req } = await supabase
        .from("requests")
        .select("id, user_id")
        .eq("reference", resolvedRequestId)
        .maybeSingle();
      if (req) {
        resolvedRequestId = req.id;
        if (!resolvedUserId && req.user_id) {
          resolvedUserId = req.user_id;
        }
      } else {
        // Not a UUID and not found by reference; reset so we don't query a Postgres UUID column with invalid text
        resolvedRequestId = undefined;
      }
    } catch {
      resolvedRequestId = undefined;
    }
  }

  // If both requestId and userId are available, query separately in parallel and merge
  // to prevent PostgREST .or() comma-parsing bugs and ensure maximum reliability.
  if (resolvedRequestId && resolvedUserId) {
    try {
      const [reqRes, userRes] = await Promise.all([
        supabase
          .from("documents")
          .select("*")
          .eq("request_id", resolvedRequestId)
          .order("created_at", { ascending: false })
          .limit(opts?.limit ?? 100),
        supabase
          .from("documents")
          .select("*")
          .eq("uploaded_by", resolvedUserId)
          .order("created_at", { ascending: false })
          .limit(opts?.limit ?? 100),
      ]);
      const seen = new Set<string>();
      const combined: DocumentRow[] = [];
      for (const d of [...(reqRes.data ?? []), ...(userRes.data ?? [])]) {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          combined.push(d);
        }
      }
      return combined;
    } catch (err) {
      console.error("[listDocuments] error fetching combined documents:", err);
      return [];
    }
  }

  let query = supabase.from("documents").select("*").order("created_at", { ascending: false });
  if (resolvedRequestId && isUuid(resolvedRequestId)) {
    query = query.eq("request_id", resolvedRequestId);
  } else if (resolvedUserId) {
    query = query.eq("uploaded_by", resolvedUserId);
  }

  const { data, error } = await query.limit(opts?.limit ?? 100);
  if (error) {
    console.error("[listDocuments] query error:", error);
    throw new ApiError(error.message, error.code);
  }
  return data ?? [];
}

export async function documentsCount(): Promise<number> {
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true });
  if (error) throw new ApiError(error.message, error.code);
  return count ?? 0;
}

export async function deleteDocument(id: string, storagePath?: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new ApiError("Session expired. Please sign in again.", "unauthenticated");

  // Delete DB row first. If this fails due to RLS or not found, it prevents orphaned DB entries.
  const { error: dbError } = await supabase.from("documents").delete().eq("id", id);
  // Note: RLS handles the uploaded_by = auth.uid() OR team/admin check.

  if (dbError) throw new ApiError("Failed to remove document record", dbError.code);

  // Remove from storage bucket if path is available
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (storageError) {
      console.warn("Storage deletion failed after DB row was deleted:", storageError);
    }
  }
}

export async function linkDocumentToRequest(id: string, requestId: string) {
  const { error } = await supabase
    .from("documents")
    .update({ request_id: requestId })
    .eq("id", id);
  if (error) {
    console.warn("Failed to link document to request:", error);
  }
}

