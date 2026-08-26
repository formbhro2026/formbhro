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

export async function listDocuments(opts?: {
  requestId?: string;
  limit?: number;
}): Promise<DocumentRow[]> {
  let query = supabase.from("documents").select("*").order("created_at", { ascending: false });
  if (opts?.requestId) query = query.eq("request_id", opts.requestId);
  const { data, error } = await query.limit(opts?.limit ?? 100);
  if (error) throw new ApiError(error.message, error.code);
  return data ?? [];
}

export async function documentsCount(): Promise<number> {
  const { count, error } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true });
  if (error) throw new ApiError(error.message, error.code);
  return count ?? 0;
}
