import { useState, useMemo } from "react";
import { Check, Plus, X, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export const STANDARD_QUALIFICATIONS = [
  "10th",
  "12th",
  "ITI",
  "Diploma",
  "Graduation",
  "Post-Graduation",
  "B.Tech / BE",
  "Any Degree",
] as const;

export interface QualificationMultiSelectProps {
  value: string; // e.g. "10th, 12th, Graduation"
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  error?: string;
}

export function QualificationMultiSelect({
  value,
  onChange,
  label = "Applicable Qualifications (Select all that apply)",
  className,
  error,
}: QualificationMultiSelectProps) {
  const [customInput, setCustomInput] = useState("");

  // Parse comma-separated string into an array of trimmed, unique qualifications
  const selectedList = useMemo(() => {
    if (!value) return [];
    return value
      .split(",")
      .map((q) => q.trim())
      .filter(Boolean);
  }, [value]);

  const toggleQualification = (qual: string) => {
    const trimmed = qual.trim();
    if (!trimmed) return;

    const exists = selectedList.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    let next: string[];
    if (exists) {
      next = selectedList.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
    } else {
      next = [...selectedList, trimmed];
    }
    onChange(next.join(", "));
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!selectedList.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...selectedList, trimmed].join(", "));
    }
    setCustomInput("");
  };

  const removeQualification = (qual: string) => {
    const next = selectedList.filter((s) => s.toLowerCase() !== qual.toLowerCase());
    onChange(next.join(", "));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-text flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-brand" />
            {label}
          </label>
          {selectedList.length > 0 && (
            <span className="text-[11px] font-bold text-brand">
              {selectedList.length} selected
            </span>
          )}
        </div>
      )}

      {/* Selected Tags Display */}
      {selectedList.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-surface-2 border border-border-subtle">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider pl-1">
            Selected:
          </span>
          {selectedList.map((qual) => (
            <span
              key={qual}
              className="inline-flex items-center gap-1 rounded-lg bg-brand/15 text-brand border border-brand/30 px-2.5 py-1 text-xs font-bold transition-all"
            >
              <span>{qual}</span>
              <button
                type="button"
                onClick={() => removeQualification(qual)}
                className="hover:text-red-400 p-0.5 rounded transition-colors"
                title={`Remove ${qual}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Standard Qualification Toggle Chips (Checkboxes) */}
      <div className="flex flex-wrap gap-2">
        {STANDARD_QUALIFICATIONS.map((qual) => {
          const isSelected = selectedList.some((s) => s.toLowerCase() === qual.toLowerCase());
          return (
            <button
              key={qual}
              type="button"
              onClick={() => toggleQualification(qual)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all select-none cursor-pointer active:scale-95",
                isSelected
                  ? "border-brand bg-brand text-white shadow-sm shadow-brand/20 font-bold"
                  : "border-border-subtle bg-surface-1 text-text-secondary hover:border-brand/40 hover:text-text hover:bg-surface-2"
              )}
            >
              <span
                className={cn(
                  "grid h-3.5 w-3.5 place-items-center rounded border transition-colors",
                  isSelected
                    ? "border-white bg-white/20 text-white"
                    : "border-border-subtle bg-surface-2"
                )}
              >
                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
              </span>
              <span>{qual}</span>
            </button>
          );
        })}
      </div>

      {/* Optional: Add custom qualification */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Add custom qualification (e.g. B.Sc Nursing, LLB, CA)..."
          className="flex-1 h-9 rounded-xl border border-border-subtle bg-surface-1 px-3 text-xs text-text placeholder:text-text-muted focus:border-brand/50 outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddCustom(e);
            }
          }}
        />
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customInput.trim()}
          className="inline-flex h-9 items-center gap-1 rounded-xl bg-surface-2 px-3 text-xs font-semibold text-text border border-border-subtle hover:bg-surface-3 transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5 text-brand" /> Add
        </button>
      </div>

      {error && <p className="text-[11px] font-medium text-red-400">{error}</p>}
    </div>
  );
}
