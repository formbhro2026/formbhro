import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/team/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

export function CategorySelect({
  requestId,
  category,
  className,
}: {
  requestId: string;
  category: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["active_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Pick<Category, "name">[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: async (newCategory: string) => {
      const { error } = await supabase
        .from("requests")
        .update({ category: newCategory })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      // The realtime subscription in team-store should handle the UI update,
      // but we can invalidate just in case
      queryClient.invalidateQueries({ queryKey: ["team_requests"] });
      toast.success("Category updated successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update category");
    },
  });

  const confirm = () => {
    if (!pending) return;
    updateMutation.mutate(pending);
    setPending(null);
  };

  const currentDisplay = category || "Select Category";

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isLoading || updateMutation.isPending}
        className="inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-xl border border-border-strong bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/5 disabled:opacity-50"
      >
        {updateMutation.isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating...
          </span>
        ) : (
          <span className="truncate">{currentDisplay}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
      </button>

      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            aria-label="Request category"
            className="absolute right-0 z-50 mt-1 w-52 max-h-64 overflow-y-auto rounded-xl border border-border-subtle bg-surface-1 py-1 shadow-2xl"
          >
            {categories?.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.name === category}
                  onClick={() => {
                    setOpen(false);
                    if (c.name !== category) setPending(c.name);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-white transition-colors hover:bg-white/5"
                >
                  <span className="truncate">{c.name}</span>
                  {c.name === category && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {pending && (
        <ConfirmDialog
          title="Change request category?"
          description={`Category of ${requestId} will change to "${pending}".`}
          confirmLabel="Change category"
          onConfirm={confirm}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
