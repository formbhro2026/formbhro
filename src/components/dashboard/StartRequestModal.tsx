import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

export function StartRequestModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (category: string) => void;
}) {
  const panelRef = useDialogA11y<HTMLDivElement>(onClose);
  const [selected, setSelected] = useState<string>("Government Form");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["active_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("name, description")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Pick<Category, "name" | "description">[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 sm:items-center">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-request-title"
        className="relative w-full max-w-md animate-in slide-in-from-bottom-4 fade-in duration-200 rounded-2xl border border-border-subtle bg-surface-1 p-6 shadow-2xl sm:slide-in-from-bottom-0 sm:zoom-in-95"
      >
        <h2 id="start-request-title" className="text-xl font-bold text-white mb-2">
          What do you need help with?
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          Select a category so we can assign the right team member to assist you.
        </p>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {categories?.length === 0 ? (
              <p className="text-sm text-text-muted">
                No categories available. Please proceed with the default.
              </p>
            ) : (
              categories?.map((cat) => (
                <label
                  key={cat.name}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    selected === cat.name
                      ? "border-brand bg-brand/10"
                      : "border-border-strong bg-surface-2 hover:bg-surface-3"
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.name}
                    checked={selected === cat.name}
                    onChange={() => setSelected(cat.name)}
                    className="mt-0.5 shrink-0 h-4 w-4 text-brand bg-surface-3 border-border-strong focus:ring-brand"
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">{cat.name}</div>
                    {cat.description && (
                      <div className="text-xs text-text-secondary mt-1">{cat.description}</div>
                    )}
                  </div>
                </label>
              ))
            )}

            {/* Fallback Option */}
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                selected === "General Inquiry"
                  ? "border-brand bg-brand/10"
                  : "border-border-strong bg-surface-2 hover:bg-surface-3"
              }`}
            >
              <input
                type="radio"
                name="category"
                value="General Inquiry"
                checked={selected === "General Inquiry"}
                onChange={() => setSelected("General Inquiry")}
                className="mt-0.5 shrink-0 h-4 w-4 text-brand bg-surface-3 border-border-strong focus:ring-brand"
              />
              <div>
                <div className="text-sm font-semibold text-white">General Inquiry</div>
                <div className="text-xs text-text-secondary mt-1">
                  If your request does not fit any of the above categories.
                </div>
              </div>
            </label>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold text-text-secondary hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(selected)}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white shadow-lg shadow-brand/20 active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" />
            Start Request
          </button>
        </div>
      </div>
    </div>
  );
}
