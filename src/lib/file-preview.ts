/**
 * Client-side preview generation for uploads: image thumbnails via object URLs
 * and PDF first-page rasterisation via pdf.js (loaded lazily, browser only).
 */
export type FilePreview = {
  previewUrl?: string;
  pageCount?: number;
  dimensions?: string;
};

const THUMB_WIDTH = 480;

async function imagePreview(file: File): Promise<FilePreview> {
  const previewUrl = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = `${bitmap.width} × ${bitmap.height}`;
    bitmap.close?.();
    return { previewUrl, dimensions };
  } catch {
    return { previewUrl };
  }
}

async function pdfPreview(file: File): Promise<FilePreview> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(2, THUMB_WIDTH / base.width) });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) return { pageCount: doc.numPages };

  await page.render({ canvasContext: context, viewport }).promise;
  const previewUrl = canvas.toDataURL("image/jpeg", 0.8);
  const dimensions = `${Math.round(base.width)} × ${Math.round(base.height)} pt`;
  await doc.cleanup();
  return { previewUrl, pageCount: doc.numPages, dimensions };
}

export async function buildFilePreview(file: File, kind: "image" | "pdf" | "doc"): Promise<FilePreview> {
  if (typeof window === "undefined") return {};
  try {
    if (kind === "image") return await imagePreview(file);
    if (kind === "pdf") return await pdfPreview(file);
  } catch (error) {
    console.warn("Preview generation failed", error);
    return {};
  }
  return {};
}
