import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Shield, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Database } from "@/integrations/supabase/types";
import { useSession } from "@/lib/session";


type Policy = Database["public"]["Tables"]["policies"]["Row"];

function PoliciesPage() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    type: "terms",
    version: "1.0",
    content: "",
    is_active: false,
  });

  const { data: policies, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["admin_policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Policy[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (
      newPolicy: Omit<Policy, "id" | "created_at" | "published_at" | "created_by" | "updated_at">,
    ) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("policies")
        .insert({
          ...newPolicy,
          created_by: user.id,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_policies"] });
      toast.success("Policy created successfully");
      setIsCreating(false);
      setFormData({ type: "terms", version: "1.0", content: "", is_active: false });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create policy");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("policies").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_policies"] });
      toast.success("Policy status updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update policy");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
        <h2 className="font-bold mb-2">Error Loading Policies</h2>
        <p className="font-mono text-sm">{queryError?.message || "Unknown error occurred"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Shield className="h-6 w-6 text-brand" />
            Policies & Terms
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage terms of service, privacy policies, and track user acknowledgments.
          </p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            New Policy
          </Button>
        )}
      </div>

      {isCreating && (
        <div className="bg-card border border-border-subtle rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Create New Policy</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Policy Type</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-border-subtle bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
                  required
                >
                  <option value="terms">Terms</option>
                  <option value="privacy">Privacy</option>
                  <option value="delivery">Delivery</option>
                  <option value="cookie">Cookie</option>
                  <option value="help">Help</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="e.g. 1.0, 2024-01"
                  className="bg-bg"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content (Markdown supported)</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Enter policy content..."
                className="min-h-[200px] bg-bg font-mono text-sm"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">
                Set as active (users will be prompted to acknowledge)
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreating(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Policy
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {policies?.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border-subtle rounded-xl text-text-muted">
            No policies created yet.
          </div>
        ) : (
          policies?.map((policy) => (
            <div
              key={policy.id}
              className={`bg-card border rounded-xl p-5 shadow-sm transition-colors ${
                policy.is_active ? "border-brand/50 ring-1 ring-brand/20" : "border-border-subtle"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-text-primary capitalize">
                      {policy.type} Policy
                    </h3>
                    <span className="px-2 py-0.5 rounded text-xs font-mono bg-bg text-text-secondary border border-border-subtle">
                      v{policy.version}
                    </span>
                    {policy.is_active && (
                      <span className="flex items-center gap-1 text-xs font-medium text-brand px-2 py-0.5 bg-brand/10 rounded">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">
                    Published: {(() => {
                      const dateStr = policy.published_at || policy.created_at;
                      if (!dateStr) return "Unknown Date";
                      const d = new Date(dateStr);
                      return isNaN(d.getTime()) ? "Invalid Date" : format(d, "PPP p");
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Label htmlFor={`active-${policy.id}`} className="text-sm cursor-pointer">
                    {policy.is_active ? "Active" : "Inactive"}
                  </Label>
                  <Switch
                    id={`active-${policy.id}`}
                    checked={!!policy.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: policy.id, is_active: checked })
                    }
                    disabled={toggleActiveMutation.isPending}
                  />
                </div>
              </div>

              <div className="mt-4 p-4 bg-bg rounded-lg border border-border-subtle">
                <div className="text-sm text-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                  {policy.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 m-4 bg-red-950/30 border border-red-500 rounded-xl text-red-200 font-mono">
          <h2 className="font-bold text-lg mb-2">Component Crashed</h2>
          <p className="whitespace-pre-wrap text-xs">{this.state.error.stack || this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Route = createFileRoute("/admin/_shell/policies")({
  component: () => (
    <ErrorBoundary>
      <PoliciesPage />
    </ErrorBoundary>
  ),
});
