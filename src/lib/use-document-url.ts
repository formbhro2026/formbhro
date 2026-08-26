import { useEffect, useState } from "react";
import type { UserDocument } from "@/data/user-module";
import { resolveDocumentUrl } from "@/lib/doc-access";

/**
 * Resolves a viewable URL for a user document: live documents sit in a private
 * bucket and get a short-lived signed URL, demo documents use their inline preview.
 */
export function useDocumentUrl(
  doc: Pick<UserDocument, "name" | "previewUrl" | "storagePath"> | null | undefined,
) {
  const [url, setUrl] = useState<string | null>(doc?.previewUrl ?? null);
  const storagePath = doc?.storagePath;
  const previewUrl = doc?.previewUrl;
  const name = doc?.name;

  useEffect(() => {
    if (!storagePath) {
      setUrl(previewUrl ?? null);
      return;
    }
    let active = true;
    void resolveDocumentUrl({ name: name ?? "document", previewUrl, storagePath }).then((next) => {
      if (active) setUrl(next ?? previewUrl ?? null);
    });
    return () => {
      active = false;
    };
  }, [storagePath, previewUrl, name]);

  return url;
}
