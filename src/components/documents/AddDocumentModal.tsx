import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Check,
  RotateCcw,
  AlertCircle,
  SwitchCamera,
} from "lucide-react";
import { useUserStore } from "@/lib/user-store";
import { cn } from "@/lib/utils";

type AddDocumentModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Step = "select" | "camera" | "preview" | "saving" | "success" | "error";

export function AddDocumentModal({ isOpen, onClose }: AddDocumentModalProps) {
  const { uploadPersonalDocument } = useUserStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("select");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputFallbackRef = useRef<HTMLInputElement>(null);

  // Stop camera tracks helper
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on close or unmount
  const resetAndClose = useCallback(() => {
    stopCameraStream();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileName("");
    setErrorMessage(null);
    setValidationError(null);
    setStep("select");
    onClose();
  }, [stopCameraStream, previewUrl, onClose]);

  // Start live camera stream
  const startCamera = useCallback(
    async (mode: "environment" | "user" = "environment") => {
      stopCameraStream();
      setErrorMessage(null);
      setValidationError(null);

      // Check if mediaDevices is supported
      if (!navigator.mediaDevices?.getUserMedia) {
        // Fallback to HTML input capture
        cameraInputFallbackRef.current?.click();
        return;
      }

      try {
        setStep("camera");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Check available video devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoDevices.length > 1);
      } catch (err: unknown) {
        console.warn(
          "[AddDocument] Camera stream access failed, falling back to capture input:",
          err,
        );
        stopCameraStream();
        const errName = err instanceof Error ? err.name : "";
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          setErrorMessage(
            "Camera permission was denied. Please allow camera access or choose 'Upload Image'.",
          );
          setStep("error");
        } else {
          // Trigger file input capture fallback
          cameraInputFallbackRef.current?.click();
        }
      }
    },
    [stopCameraStream],
  );

  // Switch between front/rear camera
  const toggleCamera = useCallback(() => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  }, [facingMode, startCamera]);

  // Take photo from video stream
  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCameraStream();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMessage("Failed to capture photo frame. Please try again.");
          setStep("error");
          return;
        }
        const file = new File([blob], `Capture_${new Date().toISOString().slice(0, 10)}.jpg`, {
          type: "image/jpeg",
        });
        const url = URL.createObjectURL(file);
        setSelectedFile(file);
        setPreviewUrl(url);
        setFileName(
          `Document ${new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`,
        );
        setStep("preview");
      },
      "image/jpeg",
      0.92,
    );
  }, [stopCameraStream]);

  // Handle file selection from file input
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setValidationError("Please select a valid image file (JPG, PNG, WebP).");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(url);

    // Clean name without extension as default
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    setFileName(cleanName);
    setValidationError(null);
    setErrorMessage(null);
    setStep("preview");
  };

  // Handle Save
  const handleSave = async () => {
    if (!selectedFile) {
      setValidationError("Please select or capture an image first.");
      return;
    }

    const trimmedName = fileName.trim();
    if (!trimmedName) {
      setValidationError("Please enter a file name.");
      return;
    }

    setValidationError(null);
    setErrorMessage(null);
    setStep("saving");

    try {
      await uploadPersonalDocument(selectedFile, trimmedName);
      setStep("success");
      setTimeout(() => {
        resetAndClose();
        navigate({ to: "/app/documents" });
      }, 1000);
    } catch (err: unknown) {
      console.error("[AddDocument] Save failed:", err);
      const msg = err instanceof Error ? err.message : "";
      setErrorMessage(msg || "Failed to save document. Please check your connection and retry.");
      setStep("error");
    }
  };

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        resetAndClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, resetAndClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-border-subtle bg-surface-1 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <h2 className="text-base font-bold text-white">
            {step === "select" && "Add Document"}
            {step === "camera" && "Camera"}
            {step === "preview" && "Document Details"}
            {step === "saving" && "Saving Document"}
            {step === "success" && "Document Saved"}
            {step === "error" && "Document Error"}
          </h2>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Hidden Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
        />
        <input
          ref={cameraInputFallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Step 1: Select Option */}
        {step === "select" && (
          <div className="flex flex-col gap-4 p-6">
            <p className="text-sm text-text-secondary leading-relaxed">
              Choose how you want to add your document to{" "}
              <span className="font-semibold text-white">My Documents</span>.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-2">
              <button
                type="button"
                onClick={() => startCamera("environment")}
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-surface-2/60 p-6 text-center transition-all hover:border-brand hover:bg-brand/5 active:scale-95"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition-colors shadow-lg shadow-brand/10">
                  <Camera className="h-7 w-7" strokeWidth={2} />
                </div>
                <div>
                  <span className="block text-sm font-bold text-white group-hover:text-brand transition-colors">
                    Capture through Camera
                  </span>
                  <span className="block text-[11px] text-text-muted mt-0.5">
                    Take a clear photo
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border-subtle bg-surface-2/60 p-6 text-center transition-all hover:border-brand hover:bg-brand/5 active:scale-95"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition-colors shadow-lg shadow-brand/10">
                  <Upload className="h-7 w-7" strokeWidth={2} />
                </div>
                <div>
                  <span className="block text-sm font-bold text-white group-hover:text-brand transition-colors">
                    Upload Image
                  </span>
                  <span className="block text-[11px] text-text-muted mt-0.5">
                    Choose from library
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Camera Viewfinder */}
        {step === "camera" && (
          <div className="relative flex flex-col items-center bg-black">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Overlay Frame */}
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/40 border-dashed" />
            </div>

            <div className="flex w-full items-center justify-around bg-surface-1 px-6 py-5 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setStep("select");
                }}
                className="rounded-xl bg-surface-2 px-4 py-2.5 text-xs font-bold text-text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                aria-label="Capture Photo"
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-brand text-white shadow-xl hover:scale-105 active:scale-95 transition-transform"
              >
                <div className="h-11 w-11 rounded-full bg-white/20" />
              </button>

              {hasMultipleCameras ? (
                <button
                  type="button"
                  onClick={toggleCamera}
                  title="Switch Camera"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-text-secondary hover:text-white transition-colors"
                >
                  <SwitchCamera className="h-5 w-5" />
                </button>
              ) : (
                <div className="w-10" />
              )}
            </div>
          </div>
        )}

        {/* Step 3: Naming & Preview */}
        {step === "preview" && (
          <div className="flex flex-col p-6">
            {previewUrl && (
              <div className="relative mb-5 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border-subtle bg-surface-2 shadow-inner">
                <img
                  src={previewUrl}
                  alt="Captured or selected preview"
                  className="h-full w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setStep("select");
                  }}
                  title="Retake or choose different image"
                  className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-black/70 backdrop-blur-md px-3 py-1.5 text-[11px] font-bold text-white hover:bg-black transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Change
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="document-file-name"
                  className="block text-xs font-bold text-white uppercase tracking-wider mb-2"
                >
                  File Name <span className="text-brand">*</span>
                </label>
                <input
                  id="document-file-name"
                  type="text"
                  value={fileName}
                  onChange={(e) => {
                    setFileName(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="e.g. GST Invoice August 2026"
                  autoFocus
                  className={cn(
                    "w-full rounded-xl border bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-text-muted outline-none transition-all",
                    validationError
                      ? "border-danger focus:ring-1 focus:ring-danger"
                      : "border-border-subtle focus:border-brand focus:ring-1 focus:ring-brand",
                  )}
                />
                {validationError && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {validationError}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="flex-1 rounded-xl bg-surface-2 py-3 text-xs font-bold text-text-secondary hover:text-white transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 rounded-xl bg-brand py-3 text-xs font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-light active:scale-95"
                >
                  Save to Documents
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Saving Loading State */}
        {step === "saving" && (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className="relative mb-6 flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            </div>
            <h3 className="text-base font-bold text-white mb-1">Saving Document</h3>
            <p className="text-xs text-text-secondary max-w-xs">
              Uploading {fileName.trim() || "document"} to your private storage...
            </p>
          </div>
        )}

        {/* Step 5: Success State */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success animate-in zoom-in-75 duration-300">
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Saved Successfully</h3>
            <p className="text-xs text-text-secondary">
              "{fileName.trim()}" is now available in My Documents.
            </p>
          </div>
        )}

        {/* Step 6: Error State */}
        {step === "error" && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Something went wrong</h3>
            <p className="text-xs text-text-secondary mb-6 max-w-xs">
              {errorMessage || "We couldn't save your document. Please try again."}
            </p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={resetAndClose}
                className="flex-1 rounded-xl bg-surface-2 py-3 text-xs font-bold text-text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  if (selectedFile) {
                    setStep("preview");
                  } else {
                    setStep("select");
                  }
                }}
                className="flex-1 rounded-xl bg-brand py-3 text-xs font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-light active:scale-95"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
