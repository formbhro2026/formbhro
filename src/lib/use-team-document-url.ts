import { useEffect, useState } from "react";
import type { TeamDocument } from "@/data/team-module";
import { resolveDocumentUrl } from "@/lib/doc-access";

/**
 * Resolves a viewable URL for a team document.
 * Live documents live in a private bucket, so we mint a short-lived signed URL
 * on mount; demo documents just use their inline preview URL.
 */
export function useTeamDocumentUrl(doc: Pick<TeamDocument, "name" | "previewUrl" | "storagePath"> | null | undefined) {
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
    void resolveDocumentUrl({ name: name ?? "document", storagePath }).then((next) => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
    };
  }, [storagePath, previewUrl, name]);

  return url;
}
