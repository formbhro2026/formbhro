import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Tag, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateRequestTags } from "@/lib/api/requests";
import { toast } from "sonner";

export const PRESET_TAGS = [
  { label: "Important", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { label: "Follow-up", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { label: "Pending", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { label: "Urgent", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { label: "Completed", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
] as const;

export function getTagStyle(tag: string) {
  const preset = PRESET_TAGS.find((p) => p.label.toLowerCase() === tag.toLowerCase());
  return preset?.color ?? "bg-brand/20 text-brand-light border-brand/30";
}

export function ChatTagBadges({ tags, className }: { tags?: string[]; className?: string }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((t) => (
        <span
          key={t}
          className={cn(
            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight",
            getTagStyle(t),
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function ChatTagButton({
  requestId,
  currentTags = [],
  onTagsUpdated,
  className,
}: {
  requestId: string;
  currentTags?: string[];
  onTagsUpdated?: (newTags: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(currentTags);
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customInput.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setCustomInput("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateRequestTags(requestId, tags);
      onTagsUpdated?.(tags);
      toast.success("Chat tags updated");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update tags");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTags(currentTags);
          setOpen(true);
        }}
        title="Manage Chat Tags"
        aria-label="Manage Chat Tags"
        className={cn(
          "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition-colors",
          currentTags.length > 0
            ? "border-brand/40 bg-brand/10 text-brand-light hover:bg-brand/20"
            : "border-white/10 bg-surface-2 text-text-secondary hover:bg-white/5 hover:text-white",
          className,
        )}
      >
        <Tag className="h-4 w-4" />
        {currentTags.length > 0 && <span>{currentTags.length}</span>}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm max-w-[calc(100vw-2rem)] rounded-2xl border border-border-subtle bg-surface-2 p-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-brand" />
                  <h3 className="text-sm font-bold text-white">Chat Labels & Tags</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 text-text-muted hover:bg-surface-3 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Preset Tags */}
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Presets
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_TAGS.map((preset) => {
                    const active = tags.includes(preset.label);
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => toggleTag(preset.label)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                          preset.color,
                          active
                            ? "ring-2 ring-white/50 font-bold scale-[1.03]"
                            : "opacity-60 hover:opacity-100",
                        )}
                      >
                        {preset.label}
                        {active && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Tags Section */}
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Custom Tag
                </p>
                <form onSubmit={handleAddCustom} className="flex gap-2">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="e.g. VIP, Verification..."
                    className="h-8 flex-1 rounded-lg border border-border-subtle bg-surface-3 px-2.5 text-xs text-white placeholder:text-text-muted outline-none focus:border-brand/50"
                  />
                  <button
                    type="submit"
                    disabled={!customInput.trim()}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface-3 px-3 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </form>

                {/* Active Custom Tags */}
                {tags.filter((t) => !PRESET_TAGS.some((p) => p.label === t)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags
                      .filter((t) => !PRESET_TAGS.some((p) => p.label === t))
                      .map((customTag) => (
                        <span
                          key={customTag}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/15 px-2.5 py-1 text-xs text-brand-light"
                        >
                          {customTag}
                          <button
                            type="button"
                            onClick={() => toggleTag(customTag)}
                            className="text-text-muted hover:text-white ml-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-hover disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Tags
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
