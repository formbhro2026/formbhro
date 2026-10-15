import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Pin,
  Trash2,
  Image,
  AlertCircle,
  X,
  Check,
  Upload,
  Loader2,
  SlidersHorizontal,
  Plus,
  Tag,
  Calendar,
  GraduationCap,
  Building2,
  Briefcase,
  Users,
  ExternalLink,
} from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Button, Field, Panel, Pill, formatDate, inputClass } from "@/components/admin/AdminUI";
import * as notificationsApi from "@/lib/api/notifications";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrl, uploadNewsBanner } from "@/lib/api/admin.functions";
import { DEFAULT_QUALIFICATIONS, JOB_GROUPS } from "@/data/vacancy-groups";
import { QualificationMultiSelect } from "@/components/common/QualificationMultiSelect";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_shell/news")({ component: AdminNews });

function isValidHttpUrl(string: string) {
  if (!string.trim()) return false;
  try {
    const url = new URL(string.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AdminNews() {
  const { news, refresh } = useAdmin();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Jobs Update",
    published: true,
    featured: false,
    image_url: "",
    organization: "",
    qualification: "Graduation",
    min_age: "18",
    max_age: "45",
    vacancy_status: "live",
    application_last_date: "",
    vacancies_count: "",
    application_url: "",
    custom_fields: {} as Record<string, any>,
  });
  const [previewError, setPreviewError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "error" } | null>(null);

  // Upload and resolver states
  const [uploading, setUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [editResolvingUrl, setEditResolvingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<{
    id: string;
    title: string;
    description: string;
    category: string;
    published: boolean;
    featured: boolean;
    image_url: string;
    organization?: string;
    qualification?: string;
    min_age?: number | string;
    max_age?: number | string;
    vacancy_status?: string;
    application_last_date?: string;
    vacancies_count?: number | string;
    application_url?: string;
    custom_fields?: Record<string, any>;
  } | null>(null);
  const [editPreviewError, setEditPreviewError] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // Custom vacancy filters managed by Admin
  const [customFields, setCustomFields] = useState<notificationsApi.CustomFieldRow[]>([]);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [newFieldForm, setNewFieldForm] = useState({
    field_name: "",
    field_label: "",
    field_type: "dropdown" as const,
    options: "",
    is_required: false,
    is_filter: true,
  });
  const [savingFilter, setSavingFilter] = useState(false);

  const loadCustomFields = async () => {
    try {
      const data = await notificationsApi.listCustomFields();
      setCustomFields(data);
    } catch (_) {}
  };

  useEffect(() => {
    void loadCustomFields();
  }, []);

  const handleFileUpload = async (file: File, isEdit: boolean = false) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (PNG, JPG, WebP, etc.).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image size should be less than 10MB.");
      return;
    }

    if (isEdit) {
      setEditUploading(true);
      setEditPreviewError(false);
    } else {
      setUploading(true);
      setPreviewError(false);
    }

    try {
      let publicUrl = "";
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (uid) {
          const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".jpg";
          const nameWithoutExt = file.name.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name;
          const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
          const storagePath = `${uid}/banner-${Date.now()}-${safeName}${ext}`;

          const { error: uploadError } = await supabase.storage.from("avatars").upload(storagePath, file, {
            contentType: file.type || "image/jpeg",
            upsert: true,
          });

          if (!uploadError) {
            const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);
            if (data?.publicUrl) publicUrl = data.publicUrl;
          }
        }
      } catch (clientErr) {
        console.warn("[AdminNews] Direct storage upload failed, attempting server upload:", clientErr);
      }

      if (!publicUrl) {
        const base64 = await fileToBase64(file);
        const res = await uploadNewsBanner({
          data: {
            fileName: file.name,
            fileBase64: base64,
            mimeType: file.type || "image/jpeg",
          },
        });
        publicUrl = res.url;
      }

      if (publicUrl) {
        if (isEdit) {
          setEditingItem((prev) => (prev ? { ...prev, image_url: publicUrl } : null));
          setEditPreviewError(false);
        } else {
          setForm((prev) => ({ ...prev, image_url: publicUrl }));
          setPreviewError(false);
        }
      }
    } catch (err) {
      console.error("[AdminNews] Banner upload failed:", err);
      alert(err instanceof Error ? err.message : "Failed to upload banner image. Please try again.");
    } finally {
      if (isEdit) setEditUploading(false);
      else setUploading(false);
    }
  };

  const handleUrlChange = async (urlVal: string, isEdit: boolean = false) => {
    let finalUrl = urlVal;

    const gDriveMatch = finalUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gDriveMatch) {
      finalUrl = `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
    } else if (finalUrl.includes("dropbox.com")) {
      finalUrl = finalUrl.replace(/[?&]dl=0/, "").replace(/[?&]raw=1/, "") + (finalUrl.includes("?") ? "&raw=1" : "?raw=1");
    } else {
      const imgurMatch = finalUrl.match(/imgur\.com\/(?:a\/|gallery\/)?([a-zA-Z0-9]+)$/);
      if (imgurMatch) finalUrl = `https://i.imgur.com/${imgurMatch[1]}.jpg`;
    }

    if (isEdit) {
      setEditingItem((prev) => (prev ? { ...prev, image_url: finalUrl } : null));
      setEditPreviewError(false);
    } else {
      setForm((prev) => ({ ...prev, image_url: finalUrl }));
      setPreviewError(false);
    }

    // Auto-resolve ImgBB viewer page link (e.g. ibb.co/m5BvK5z8) to direct image URL
    if (finalUrl.includes("ibb.co/") && !finalUrl.includes("i.ibb.co/")) {
      if (isEdit) setEditResolvingUrl(true);
      else setResolvingUrl(true);
      try {
        const resolved = await resolveImageUrl({ data: { url: finalUrl } });
        if (resolved?.url && resolved.url !== finalUrl) {
          if (isEdit) {
            setEditingItem((prev) => (prev ? { ...prev, image_url: resolved.url } : null));
            setEditPreviewError(false);
          } else {
            setForm((prev) => ({ ...prev, image_url: resolved.url }));
            setPreviewError(false);
          }
        }
      } catch (e) {
        console.warn("[AdminNews] Error resolving URL:", e);
      } finally {
        if (isEdit) setEditResolvingUrl(false);
        else setResolvingUrl(false);
      }
    }
  };

  const isVacancyCategory =
    form.category === "Jobs Update" ||
    form.category === "Hidden Jobs Update" ||
    form.category.toLowerCase().includes("job") ||
    form.category.toLowerCase().includes("vacancy");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    // Mandatory vacancy fields validation (Requirement 6B)
    if (isVacancyCategory) {
      if (!form.qualification.trim()) {
        setMsg({ text: "Mandatory: Please select or enter the required qualification.", type: "error" });
        setBusy(false);
        return;
      }
      if (!form.min_age || !form.max_age) {
        setMsg({ text: "Mandatory: Please specify the applicable age limit (Min & Max age).", type: "error" });
        setBusy(false);
        return;
      }
      if (!form.vacancy_status) {
        setMsg({ text: "Mandatory: Please specify the Vacancy Status (Live or Closed).", type: "error" });
        setBusy(false);
        return;
      }
      if (!form.application_last_date) {
        setMsg({ text: "Mandatory: Please specify the Application Last Date deadline.", type: "error" });
        setBusy(false);
        return;
      }

      // Check required admin custom filters
      for (const cf of customFields) {
        if (cf.is_required && !form.custom_fields[cf.field_name]) {
          setMsg({ text: `Mandatory: Please fill in required filter "${cf.field_label}".`, type: "error" });
          setBusy(false);
          return;
        }
      }
    }

    let trimmedUrl = form.image_url.trim();
    if (trimmedUrl && trimmedUrl.includes("ibb.co/") && !trimmedUrl.includes("i.ibb.co/")) {
      try {
        const resolved = await resolveImageUrl({ data: { url: trimmedUrl } });
        if (resolved?.url) trimmedUrl = resolved.url;
      } catch (_) {}
    }

    if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
      setMsg({
        text: "Please enter a valid Image URL starting with http:// or https://",
        type: "error",
      });
      setBusy(false);
      return;
    }

    try {
      let target = "jobs_updates";
      let groupId: string | undefined = undefined;

      if (form.category === "Group: jobs-update") {
        target = "group";
        groupId = "jobs-update";
      } else if (form.category === "Group: hidden-jobs-update") {
        target = "group";
        groupId = "hidden-jobs-update";
      }

      const customFieldsPayload = {
        ...form.custom_fields,
        target,
        ...(groupId ? { group_id: groupId } : {}),
      };

      await notificationsApi.createNews({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "Jobs Update",
        published: form.published,
        featured: form.featured,
        image_url: trimmedUrl || undefined,
        organization: form.organization.trim() || undefined,
        qualification: form.qualification.trim() || undefined,
        min_age: form.min_age ? parseInt(form.min_age, 10) : null,
        max_age: form.max_age ? parseInt(form.max_age, 10) : null,
        vacancy_status: (form.vacancy_status as any) || "live",
        application_last_date: form.application_last_date || null,
        total_vacancies: form.vacancies_count ? parseInt(form.vacancies_count, 10) : null,
        apply_url: form.application_url.trim() || undefined,
        custom_fields: customFieldsPayload,
      });

      setForm({
        title: "",
        description: "",
        category: "Jobs Update",
        published: true,
        featured: false,
        image_url: "",
        organization: "",
        qualification: "Graduation",
        min_age: "18",
        max_age: "45",
        vacancy_status: "live",
        application_last_date: "",
        vacancies_count: "",
        application_url: "",
        custom_fields: {},
      });
      setPreviewError(false);
      await refresh();
      setMsg({
        text: form.published
          ? "Published vacancy update — users notified in realtime."
          : "Saved as draft.",
        type: "ok",
      });
    } catch (e2) {
      setMsg({
        text: e2 instanceof Error ? e2.message : "Could not save this announcement.",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditBusy(true);

    let trimmedUrl = editingItem.image_url.trim();
    if (trimmedUrl && trimmedUrl.includes("ibb.co/") && !trimmedUrl.includes("i.ibb.co/")) {
      try {
        const resolved = await resolveImageUrl({ data: { url: trimmedUrl } });
        if (resolved?.url) trimmedUrl = resolved.url;
      } catch (_) {}
    }

    if (trimmedUrl && !isValidHttpUrl(trimmedUrl)) {
      alert("Please enter a valid Image URL starting with http:// or https://");
      setEditBusy(false);
      return;
    }

    try {
      let target = "jobs_updates";
      let groupId: string | undefined = undefined;

      if (editingItem.category === "Group: jobs-update") {
        target = "group";
        groupId = "jobs-update";
      } else if (editingItem.category === "Group: hidden-jobs-update") {
        target = "group";
        groupId = "hidden-jobs-update";
      }

      const customFieldsPayload = {
        ...(editingItem.custom_fields || {}),
        target,
        ...(groupId ? { group_id: groupId } : {}),
      };

      await notificationsApi.updateNews(editingItem.id, {
        title: editingItem.title.trim(),
        description: editingItem.description.trim(),
        category: editingItem.category.trim() || "Jobs Update",
        published: editingItem.published,
        featured: editingItem.featured,
        image_url: trimmedUrl || undefined,
        organization: editingItem.organization?.trim() || undefined,
        qualification: editingItem.qualification?.trim() || undefined,
        min_age: editingItem.min_age ? parseInt(String(editingItem.min_age), 10) : null,
        max_age: editingItem.max_age ? parseInt(String(editingItem.max_age), 10) : null,
        vacancy_status: (editingItem.vacancy_status as any) || "live",
        application_last_date: editingItem.application_last_date || null,
        total_vacancies: editingItem.vacancies_count ? parseInt(String(editingItem.vacancies_count), 10) : null,
        apply_url: editingItem.application_url?.trim() || undefined,
        custom_fields: customFieldsPayload,
      });
      setEditingItem(null);
      await refresh();
      toast.success("Updated successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update announcement.");
    } finally {
      setEditBusy(false);
    }
  };

  const patch = async (id: string, next: Parameters<typeof notificationsApi.updateNews>[1]) => {
    await notificationsApi.updateNews(id, next);
    await refresh();
  };

  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldForm.field_name.trim() || !newFieldForm.field_label.trim()) {
      toast.error("Please enter both filter field name and display label.");
      return;
    }
    setSavingFilter(true);
    try {
      const opts =
        newFieldForm.field_type === "dropdown" && newFieldForm.options.trim()
          ? newFieldForm.options.split(",").map((s) => s.trim()).filter(Boolean)
          : [];

      await notificationsApi.upsertCustomField({
        field_name: newFieldForm.field_name.trim().toLowerCase().replace(/\s+/g, "_"),
        field_label: newFieldForm.field_label.trim(),
        field_type: newFieldForm.field_type,
        options: opts,
        is_required: newFieldForm.is_required,
        is_filter: newFieldForm.is_filter,
        is_active: true,
        sort_order: customFields.length + 1,
      });

      toast.success("Vacancy filter created successfully.");
      setNewFieldForm({
        field_name: "",
        field_label: "",
        field_type: "dropdown",
        options: "",
        is_required: false,
        is_filter: true,
      });
      await loadCustomFields();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create filter.");
    } finally {
      setSavingFilter(false);
    }
  };

  const handleDeleteCustomField = async (id: string) => {
    if (!confirm("Are you sure you want to remove this vacancy filter?")) return;
    try {
      await notificationsApi.deleteCustomField(id);
      toast.success("Filter deleted.");
      await loadCustomFields();
    } catch (err) {
      toast.error("Failed to delete filter.");
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Panel title="Post News, Update or Vacancy">
        {msg && (
          <div
            className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] ${
              msg.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            {msg.type === "ok" ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
            )}
            <p>{msg.text}</p>
          </div>
        )}
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <Field label="Publish Destination / Channel *">
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="Jobs Update">Jobs Updates Section (Public Vacancies Feed - /app/news)</option>
              <option value="Group: jobs-update">Jobs Update Group (Dedicated Group Feed Only - /app/groups)</option>
              <option value="Group: hidden-jobs-update">Hidden Jobs Update Group (Dedicated Group Feed Only - /app/groups)</option>
              <option value="Service Announcement">Service Announcement (Public)</option>
              <option value="General Notice">General Notice (Public)</option>
            </select>
          </Field>

          <Field label="Title">
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. SSC CGL 2026 Notification Released"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={3}
              className={`${inputClass} resize-y py-2`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide complete vacancy overview, syllabus, exam dates…"
            />
          </Field>

          {/* Structured Vacancy Details (Mandatory when posting Vacancies) */}
          {isVacancyCategory && (
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-brand/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-brand" />
                  Mandatory Vacancy Details
                </span>
                <span className="text-[10px] text-brand uppercase tracking-wider font-semibold">
                  Required by System
                </span>
              </div>

              <Field label="Recruitment Board / Organization">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                  <input
                    className={`${inputClass} pl-8.5`}
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    placeholder="e.g. Staff Selection Commission (SSC), UPSC, RRB"
                  />
                </div>
              </Field>

              <div className="space-y-1">
                <QualificationMultiSelect
                  value={form.qualification}
                  onChange={(val) => setForm({ ...form, qualification: val })}
                  error={!form.qualification.trim() ? "Please select at least one qualification" : undefined}
                />
              </div>

              <div>
                <Field label="Vacancy Status *">
                  <select
                    className={inputClass}
                    value={form.vacancy_status}
                    onChange={(e) => setForm({ ...form, vacancy_status: e.target.value })}
                  >
                    <option value="live">Live Now / Open</option>
                    <option value="closed">Closed / Expired</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Min Age *">
                  <input
                    type="number"
                    min="14"
                    max="65"
                    className={inputClass}
                    value={form.min_age}
                    onChange={(e) => setForm({ ...form, min_age: e.target.value })}
                    placeholder="18"
                  />
                </Field>
                <Field label="Max Age *">
                  <input
                    type="number"
                    min="14"
                    max="65"
                    className={inputClass}
                    value={form.max_age}
                    onChange={(e) => setForm({ ...form, max_age: e.target.value })}
                    placeholder="45"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Last Date to Apply *">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.application_last_date}
                    onChange={(e) => setForm({ ...form, application_last_date: e.target.value })}
                  />
                </Field>
                <Field label="Total Vacancies (Count)">
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    value={form.vacancies_count}
                    onChange={(e) => setForm({ ...form, vacancies_count: e.target.value })}
                    placeholder="e.g. 5200"
                  />
                </Field>
              </div>

              <Field label="Application Link (Portal URL)">
                <input
                  type="url"
                  className={inputClass}
                  value={form.application_url}
                  onChange={(e) => setForm({ ...form, application_url: e.target.value })}
                  placeholder="https://ssc.gov.in/apply"
                />
              </Field>

              {/* Dynamic Admin-Configured Filters */}
              {customFields.length > 0 && (
                <div className="pt-2 border-t border-brand/10 space-y-2">
                  <p className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                    <SlidersHorizontal className="h-3 w-3 text-brand" /> Additional Admin Filters
                  </p>
                  {customFields.map((cf) => (
                    <Field key={cf.id} label={`${cf.field_label} ${cf.is_required ? "*" : ""}`}>
                      {cf.field_type === "dropdown" ? (
                        <select
                          className={inputClass}
                          value={form.custom_fields[cf.field_name] || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              custom_fields: {
                                ...form.custom_fields,
                                [cf.field_name]: e.target.value,
                              },
                            })
                          }
                        >
                          <option value="">Select option</option>
                          {cf.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={cf.field_type === "number" ? "number" : cf.field_type === "date" ? "date" : "text"}
                          className={inputClass}
                          value={form.custom_fields[cf.field_name] || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              custom_fields: {
                                ...form.custom_fields,
                                [cf.field_name]: e.target.value,
                              },
                            })
                          }
                          placeholder={`Enter ${cf.field_label}…`}
                        />
                      )}
                    </Field>
                  ))}
                </div>
              )}
            </div>
          )}

          <Field label="Banner Image (Displays on App Banners)">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file, false);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploading || resolvingUrl || busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-subtle px-3 py-2 text-xs font-medium text-text-primary transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-brand" />
                      <span>Uploading banner…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-brand" />
                      <span>Upload Banner File</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-text-muted">or paste direct image link</span>
              </div>

              <div className="relative">
                <input
                  type="url"
                  placeholder="https://example.com/banner.jpg"
                  className={`${inputClass} pr-8`}
                  value={form.image_url}
                  onChange={(e) => void handleUrlChange(e.target.value, false)}
                />
                {resolvingUrl && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  </div>
                )}
                {form.image_url && !resolvingUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, image_url: "" }));
                      setPreviewError(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white p-1"
                    title="Clear URL"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </Field>

          {/* Live Image Preview */}
          {form.image_url.trim() && (
            <div className="rounded-xl border border-border-subtle bg-surface-2 p-2.5 overflow-hidden">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5 text-brand" /> Live Preview
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, image_url: "" }));
                    setPreviewError(false);
                  }}
                  className="text-[10px] text-danger hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
              {previewError ? (
                <div className="rounded-lg bg-danger/10 border border-danger/20 p-2.5 text-[11px] text-danger space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Unable to load image from this URL.</span>
                  </div>
                  <p className="text-[10px] text-text-muted">
                    Tip: Use the <strong>Upload Banner File</strong> button above to upload directly.
                  </p>
                </div>
              ) : (
                <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-black/40 max-h-48">
                  <img
                    src={form.image_url.trim()}
                    alt="Preview"
                    className="w-full h-44 object-cover"
                    onError={() => setPreviewError(true)}
                    onLoad={() => setPreviewError(false)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4 text-[11px] text-text-secondary">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />{" "}
              Publish now
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />{" "}
              Pin to top
            </label>
          </div>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Publishing…" : form.published ? "Publish Vacancy / Update" : "Save as Draft"}
          </Button>
        </form>
      </Panel>

      <Panel
        title={`All Announcements & Vacancies (${news.length})`}
        action={
          <Button
            variant="ghost"
            onClick={() => setShowFiltersModal(true)}
            className="flex items-center gap-1.5 text-xs text-brand border border-brand/30 hover:bg-brand/10"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Manage Vacancy Filters</span>
          </Button>
        }
      >
        <ul className="space-y-3">
          {news.map((n) => {
            const nAny = n as any;
            const isLive = nAny.vacancy_status !== "closed" && nAny.vacancy_status !== "expired";

            return (
              <li key={n.id} className="rounded-xl border border-border-subtle bg-bg p-3.5 space-y-2">
                <div className="flex flex-wrap items-start gap-3">
                  {n.image_url ? (
                    <img
                      src={n.image_url}
                      alt=""
                      className="h-14 w-24 rounded-lg object-cover bg-surface-2 border border-border-subtle shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-14 w-20 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-text-muted shrink-0">
                      <Image className="h-5 w-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 text-xs font-bold text-white line-clamp-1">{n.title}</p>
                      <Pill tone={n.published ? "ok" : "warn"}>
                        {n.published ? "Published" : "Draft"}
                      </Pill>
                      {n.featured && <Pill tone="brand">Pinned</Pill>}
                      {nAny.vacancy_status && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isLive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/10 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {isLive ? "Live / Open" : "Closed"}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-text-muted">
                      <span className="font-semibold text-brand px-1.5 py-0.5 rounded bg-brand/10">
                        {n.category}
                      </span>
                      {nAny.organization && (
                        <span className="flex items-center gap-1 text-text-secondary">
                          <Building2 className="h-3 w-3" /> {nAny.organization}
                        </span>
                      )}
                      {nAny.qualification && (
                        <span className="flex items-center gap-1 text-emerald-300">
                          <GraduationCap className="h-3 w-3" /> {nAny.qualification}
                        </span>
                      )}
                      {(nAny.min_age || nAny.max_age) && (
                        <span>
                          Age: {nAny.min_age ?? 18}–{nAny.max_age ?? 45} yrs
                        </span>
                      )}
                      {nAny.application_last_date && (
                        <span className="flex items-center gap-1 text-amber-300">
                          <Calendar className="h-3 w-3" /> Last Date:{" "}
                          {new Date(nAny.application_last_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="line-clamp-2 text-[11px] text-text-secondary leading-relaxed">
                  {n.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-[10px] text-text-muted">
                  <span>Posted {formatDate(n.published_at)}</span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {nAny.application_url && (
                      <a
                        href={nAny.application_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded px-2 py-1 bg-surface-2 text-text-secondary hover:text-white"
                      >
                        <ExternalLink className="h-3 w-3" /> Portal
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => void patch(n.id, { published: !n.published })}
                    >
                      {n.published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button variant="ghost" onClick={() => void patch(n.id, { featured: !n.featured })}>
                      <Pin className="h-3 w-3" aria-hidden="true" /> {n.featured ? "Unpin" : "Pin"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingItem({
                          id: n.id,
                          title: n.title,
                          description: n.description,
                          category: n.category,
                          published: n.published,
                          featured: n.featured,
                          image_url: n.image_url || "",
                          organization: nAny.organization || "",
                          qualification: nAny.qualification || "Graduation",
                          min_age: nAny.min_age ?? "18",
                          max_age: nAny.max_age ?? "45",
                          vacancy_status: nAny.vacancy_status || "live",
                          application_last_date: nAny.application_last_date
                            ? nAny.application_last_date.split("T")[0]
                            : "",
                          vacancies_count: nAny.vacancies_count || "",
                          application_url: nAny.application_url || "",
                          custom_fields: nAny.custom_fields || {},
                        });
                        setEditPreviewError(false);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (window.confirm("Delete this announcement permanently?")) {
                          void notificationsApi.deleteNews(n.id).then(() => refresh());
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
          {!news.length && (
            <li className="py-8 text-center text-xs text-text-muted">No announcements yet.</li>
          )}
        </ul>
      </Panel>

      {/* Edit Announcement Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-sm font-bold text-white">Edit Announcement / Vacancy</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-3">
              <Field label="Publish Destination / Channel *">
                <select
                  className={inputClass}
                  value={editingItem.category}
                  onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                >
                  <option value="Jobs Update">Jobs Updates Section (Public Vacancies Feed - /app/news)</option>
                  <option value="Group: jobs-update">Jobs Update Group (Dedicated Group Feed Only - /app/groups)</option>
                  <option value="Group: hidden-jobs-update">Hidden Jobs Update Group (Dedicated Group Feed Only - /app/groups)</option>
                  <option value="Service Announcement">Service Announcement (Public)</option>
                  <option value="General Notice">General Notice (Public)</option>
                </select>
              </Field>

              <Field label="Title">
                <input
                  required
                  className={inputClass}
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                />
              </Field>

              <Field label="Description">
                <textarea
                  rows={3}
                  className={`${inputClass} resize-y py-2`}
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                />
              </Field>

              {/* Vacancy Fields in Edit Modal */}
              <div className="rounded-xl border border-border-subtle bg-surface-2 p-3 space-y-2.5">
                <p className="text-xs font-semibold text-text-primary">Vacancy Details</p>

                <Field label="Organization">
                  <input
                    className={inputClass}
                    value={editingItem.organization || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, organization: e.target.value })}
                    placeholder="e.g. UPSC, SSC"
                  />
                </Field>

                <div className="space-y-1">
                  <QualificationMultiSelect
                    value={editingItem.qualification || ""}
                    onChange={(val) => setEditingItem({ ...editingItem, qualification: val })}
                  />
                </div>

                <div>
                  <Field label="Vacancy Status">
                    <select
                      className={inputClass}
                      value={editingItem.vacancy_status || "live"}
                      onChange={(e) => setEditingItem({ ...editingItem, vacancy_status: e.target.value })}
                    >
                      <option value="live">Live Now / Open</option>
                      <option value="closed">Closed</option>
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Min Age">
                    <input
                      type="number"
                      className={inputClass}
                      value={editingItem.min_age ?? ""}
                      onChange={(e) => setEditingItem({ ...editingItem, min_age: e.target.value })}
                    />
                  </Field>
                  <Field label="Max Age">
                    <input
                      type="number"
                      className={inputClass}
                      value={editingItem.max_age ?? ""}
                      onChange={(e) => setEditingItem({ ...editingItem, max_age: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Last Date">
                    <input
                      type="date"
                      className={inputClass}
                      value={editingItem.application_last_date || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, application_last_date: e.target.value })}
                    />
                  </Field>
                  <Field label="Total Vacancies">
                    <input
                      type="number"
                      className={inputClass}
                      value={editingItem.vacancies_count ?? ""}
                      onChange={(e) => setEditingItem({ ...editingItem, vacancies_count: e.target.value })}
                    />
                  </Field>
                </div>

                <Field label="Portal Link">
                  <input
                    type="url"
                    className={inputClass}
                    value={editingItem.application_url || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, application_url: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Banner Image">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={editFileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleFileUpload(file, true);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={editUploading || editResolvingUrl || editBusy}
                      onClick={() => editFileInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-subtle px-3 py-2 text-xs font-medium text-text-primary transition-colors disabled:opacity-50"
                    >
                      {editUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-brand" />
                          <span>Uploading…</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 text-brand" />
                          <span>Upload Banner File</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-text-muted">or paste link below</span>
                  </div>

                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://example.com/banner.jpg"
                      className={`${inputClass} pr-8`}
                      value={editingItem.image_url}
                      onChange={(e) => void handleUrlChange(e.target.value, true)}
                    />
                    {editResolvingUrl && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-brand" />
                      </div>
                    )}
                    {editingItem.image_url && !editResolvingUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem((prev) => (prev ? { ...prev, image_url: "" } : null));
                          setEditPreviewError(false);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-white p-1"
                        title="Clear URL"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </Field>

              {editingItem.image_url.trim() && (
                <div className="rounded-xl border border-border-subtle bg-surface-2 p-2.5 overflow-hidden">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                      <Image className="h-3.5 w-3.5 text-brand" /> Live Preview
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem((prev) => (prev ? { ...prev, image_url: "" } : null));
                        setEditPreviewError(false);
                      }}
                      className="text-[10px] text-danger hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                  {editPreviewError ? (
                    <div className="rounded-lg bg-danger/10 border border-danger/20 p-2.5 text-[11px] text-danger space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Unable to load image from this URL.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-black/40 max-h-48">
                      <img
                        src={editingItem.image_url.trim()}
                        alt="Preview"
                        className="w-full h-40 object-cover"
                        onError={() => setEditPreviewError(true)}
                        onLoad={() => setEditPreviewError(false)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 text-[11px] text-text-secondary pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.published}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, published: e.target.checked })
                    }
                  />{" "}
                  Published
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.featured}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, featured: e.target.checked })
                    }
                  />{" "}
                  Pinned
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <Button variant="ghost" type="button" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editBusy}>
                  {editBusy ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Controlled Filters Management Modal (Requirement 6D) */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-brand" />
                  Admin Vacancy Filter Controls
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Configure custom vacancy filter fields available to team publishers and user searches.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Existing Filters List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-text-primary">Configured Filters ({customFields.length})</h4>
              {customFields.length === 0 ? (
                <div className="rounded-xl border border-border-subtle bg-surface-2 p-4 text-center text-xs text-text-muted">
                  No custom vacancy filters configured yet. Default filters (Qualification, Age, Status, Deadline) are active.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {customFields.map((cf) => (
                    <div
                      key={cf.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-border-subtle bg-surface-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{cf.field_label}</span>
                          <span className="text-[10px] font-mono text-text-muted">({cf.field_name})</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-brand/10 text-brand font-semibold">
                            {cf.field_type}
                          </span>
                          {cf.is_required && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-danger/10 text-danger font-semibold">
                              Required
                            </span>
                          )}
                        </div>
                        {cf.options && cf.options.length > 0 && (
                          <p className="text-[10px] text-text-muted mt-0.5">
                            Options: {cf.options.join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCustomField(cf.id)}
                        className="text-text-muted hover:text-danger p-1 rounded transition-colors"
                        title="Delete filter"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create New Filter Form */}
            <form onSubmit={(e) => void handleCreateCustomField(e)} className="pt-3 border-t border-border-subtle space-y-3">
              <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-brand" /> Add New Vacancy Filter
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Field Key (e.g. state_domicile)">
                  <input
                    required
                    className={inputClass}
                    value={newFieldForm.field_name}
                    onChange={(e) => setNewFieldForm({ ...newFieldForm, field_name: e.target.value })}
                    placeholder="e.g. department"
                  />
                </Field>
                <Field label="Display Label">
                  <input
                    required
                    className={inputClass}
                    value={newFieldForm.field_label}
                    onChange={(e) => setNewFieldForm({ ...newFieldForm, field_label: e.target.value })}
                    placeholder="e.g. Department / Ministry"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Filter Type">
                  <select
                    className={inputClass}
                    value={newFieldForm.field_type}
                    onChange={(e) =>
                      setNewFieldForm({ ...newFieldForm, field_type: e.target.value as any })
                    }
                  >
                    <option value="dropdown">Dropdown Select</option>
                    <option value="text">Free Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                </Field>

                <div className="flex items-center gap-4 pt-5 text-xs text-text-secondary">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldForm.is_required}
                      onChange={(e) => setNewFieldForm({ ...newFieldForm, is_required: e.target.checked })}
                    />
                    Required field
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newFieldForm.is_filter}
                      onChange={(e) => setNewFieldForm({ ...newFieldForm, is_filter: e.target.checked })}
                    />
                    Search Filter
                  </label>
                </div>
              </div>

              {newFieldForm.field_type === "dropdown" && (
                <Field label="Dropdown Options (Comma-separated)">
                  <input
                    className={inputClass}
                    value={newFieldForm.options}
                    onChange={(e) => setNewFieldForm({ ...newFieldForm, options: e.target.value })}
                    placeholder="e.g. All India, North Zone, South Zone, West Zone"
                  />
                </Field>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowFiltersModal(false)}>
                  Close
                </Button>
                <Button type="submit" disabled={savingFilter}>
                  {savingFilter ? "Saving Filter…" : "Add Filter to System"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
