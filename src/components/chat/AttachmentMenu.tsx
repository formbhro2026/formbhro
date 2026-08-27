import { useEffect, useRef } from "react";
import { FileImage, FileText, File, Camera } from "lucide-react";

export type PickKind = "image" | "pdf" | "doc";

const OPTIONS: {
  label: string;
  kind: PickKind;
  icon: typeof File;
  accept: string;
  capture?: "environment";
}[] = [
  { label: "Take Photo", kind: "image", icon: Camera, accept: "image/*", capture: "environment" },
  { label: "Upload Image", kind: "image", icon: FileImage, accept: "image/*" },
];

export function AttachmentMenu({
  onPick,
  onClose,
}: {
  onPick: (opt: { kind: PickKind; accept: string; capture?: "environment" }) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const items = () =>
      Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      const list = items();
      if (list.length === 0) return;
      const index = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape" || e.key === "Tab") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(index + 1 + list.length) % list.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(index - 1 + list.length) % list.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1].focus();
      }
    };

    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Attachment options"
      className="absolute bottom-16 left-0 z-30 w-56 overflow-hidden rounded-2xl border border-border-subtle bg-surface-1 shadow-2xl duration-200 animate-in fade-in slide-in-from-bottom-2"
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.label}
            type="button"
            role="menuitem"
            onClick={() => onPick({ kind: o.kind, accept: o.accept, capture: o.capture })}
            className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3.5 text-left text-xs font-bold text-white transition-all duration-200 last:border-0 hover:bg-surface-2 active:bg-surface-3 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
              <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            </div>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
