import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Tag, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/_shell/categories")({
  component: CategoriesPage,
});

type Category = Database["public"]["Tables"]["categories"]["Row"];

function CategoriesPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newCategory: Omit<Category, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("categories")
        .insert(newCategory)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_categories"] });
      toast.success("Category created successfully");
      setIsCreating(false);
      setFormData({ name: "", description: "", is_active: true });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create category");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("categories").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_categories"] });
      toast.success("Category status updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update category");
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Tag className="h-6 w-6 text-brand" />
            Request Categories
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage the categories that users can select when creating a new request.
          </p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            New Category
          </Button>
        )}
      </div>

      {isCreating && (
        <div className="bg-card border border-border-subtle rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Create New Category</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Visa Support, Taxation"
                  className="bg-bg"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this category"
                  className="bg-bg"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active (available for selection)</Label>
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
                Save Category
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories?.length === 0 ? (
          <div className="col-span-full text-center py-12 border border-dashed border-border-subtle rounded-xl text-text-muted">
            No categories created yet.
          </div>
        ) : (
          categories?.map((category) => (
            <div
              key={category.id}
              className={`bg-card border rounded-xl p-5 shadow-sm transition-colors ${
                category.is_active ? "border-border-subtle" : "border-border-subtle opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">{category.name}</h3>
                    {category.is_active && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-brand px-1.5 py-0.5 bg-brand/10 rounded">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                  {category.description && (
                    <p className="text-sm text-text-muted">{category.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={category.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: category.id, is_active: checked })
                    }
                    disabled={toggleActiveMutation.isPending}
                    aria-label="Toggle active status"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
