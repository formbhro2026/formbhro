import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import {
  Newspaper,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Calendar,
  User,
  Image as ImageIcon,
  CheckCircle,
  Archive,
  RefreshCw,
  Eye,
  X,
  Loader2,
  Briefcase,
  Building2,
  GraduationCap,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  Edit3,
  Megaphone,
  AlertCircle,
  Upload,
} from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn, formatLastDate } from "@/lib/utils";
import * as notificationsApi from "@/lib/api/notifications";
import { DEFAULT_QUALIFICATIONS, JOB_GROUPS, isVacancyLive } from "@/data/vacancy-groups";
import { QualificationMultiSelect } from "@/components/common/QualificationMultiSelect";
import { uploadNewsBanner, resolveImageUrl } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/team/_shell/news")({
  ssr: false,
  component: TeamNewsAndVacancies,
  head: () => ({
    meta: [
      { title: "News, Updates & Vacancies — Formbhro Team" },
      {
        name: "description",
        content: "Publish job vacancies to user groups and manage operational bulletins.",
      },
    ],
  }),
});

export interface InternalNewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  author_id: string | null;
  author_name?: string;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  is_read?: boolean;
}

export interface PublicVacancyItem {
  id: string;
  title: string;
  description: string;
  category: string;
  image_url?: string | null;
  published: boolean;
  featured: boolean;
  published_at?: string;
  organization?: string | null;
  qualification?: string | null;
  min_age?: number | null;
  max_age?: number | null;
  vacancy_status?: string | null;
  application_last_date?: string | null;
  vacancies_count?: number | null;
  application_url?: string | null;
  custom_fields?: Record<string, any>;
}

function TeamNewsAndVacancies() {
  const { member } = useTeamStore();
  const [activeTab, setActiveTab] = useState<"vacancies" | "internal">("vacancies");

  // Vacancy updates state
  const [vacancies, setVacancies] = useState<PublicVacancyItem[]>([]);
  const [loadingVacancies, setLoadingVacancies] = useState(true);
  const [vacancySearch, setVacancySearch] = useState("");
  const [vacancyGroupFilter, setVacancyGroupFilter] = useState<string>("all");
  const [vacancyQualFilter, setVacancyQualFilter] = useState<string>("all");
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState<string>("all");

  // Internal bulletins state
  const [internalItems, setInternalItems] = useState<InternalNewsItem[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [internalFilter, setInternalFilter] = useState<"all" | "pinned" | "archived">("all");

  // Post Vacancy Modal
  const [showVacancyModal, setShowVacancyModal] = useState(false);
  const [editingVacancyId, setEditingVacancyId] = useState<string | null>(null);
  const [publishingVacancy, setPublishingVacancy] = useState(false);
  const [customFields, setCustomFields] = useState<notificationsApi.CustomFieldRow[]>([]);
  const vacancyFileRef = useRef<HTMLInputElement>(null);
  const [uploadingVacancyBanner, setUploadingVacancyBanner] = useState(false);

  // Vacancy Form State (with Mandatory Details)
  const [vacancyForm, setVacancyForm] = useState({
    category: "Jobs Update",
    title: "",
    description: "",
    organization: "",
    qualification: "Graduation",
    min_age: "18",
    max_age: "45",
    vacancy_status: "live" as "live" | "closed",
    application_last_date: "",
    vacancies_count: "",
    application_url: "",
    image_url: "",
    published: true,
    featured: false,
    custom_fields: {} as Record<string, any>,
  });
  const [previewError, setPreviewError] = useState(false);
  const [resolvingUrl, setResolvingUrl] = useState(false);

  // Post Internal Bulletin Modal
  const [showInternalModal, setShowInternalModal] = useState(false);
  const [publishingInternal, setPublishingInternal] = useState(false);
  const [internalFormTitle, setInternalFormTitle] = useState("");
  const [internalFormContent, setInternalFormContent] = useState("");
  const [internalFormImageUrl, setInternalFormImageUrl] = useState("");
  const [internalFormPinned, setInternalFormPinned] = useState(false);
  const [internalImagePreview, setInternalImagePreview] = useState<string | null>(null);

  // Permission check for posting news/vacancies
  const canPostVacancies = member?.permissions?.can_post_news !== false;

  const fetchVacancies = async () => {
    setLoadingVacancies(true);
    try {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .order("published_at", { ascending: false });
      if (!error && data) {
        setVacancies(data as any);
      }
    } catch (err) {
      console.warn("[TeamNews] Error loading vacancies:", err);
    } finally {
      setLoadingVacancies(false);
    }
  };

  const fetchInternalNews = async () => {
    setLoadingInternal(true);
    try {
      const { data, error } = await (supabase as any)
        .from("internal_news")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rawItems = (data ?? []) as InternalNewsItem[];

      const authorIds = Array.from(new Set(rawItems.map((i) => i.author_id).filter(Boolean))) as string[];
      let authorMap = new Map<string, string>();
      if (authorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds);
        profs?.forEach((p) => authorMap.set(p.id, p.full_name));
      }

      setInternalItems(
        rawItems.map((item) => ({
          ...item,
          author_name: item.author_id ? authorMap.get(item.author_id) || "Team Member" : "System",
        }))
      );
    } catch (err) {
      console.warn("[TeamNews] Error fetching internal news:", err);
      setInternalItems([]);
    } finally {
      setLoadingInternal(false);
    }
  };

  const loadCustomFields = async () => {
    try {
      const list = await notificationsApi.listCustomFields();
      setCustomFields(list);
    } catch (_) {}
  };

  useEffect(() => {
    void fetchVacancies();
    void fetchInternalNews();
    void loadCustomFields();
  }, []);

  // Filtered Vacancies List
  const filteredVacancies = useMemo(() => {
    return vacancies.filter((item) => {
      // Channel filter
      if (vacancyGroupFilter !== "all") {
        const cat = (item.category || "").toLowerCase();
        const target = (item.custom_fields as any)?.target;
        const groupId = (item.custom_fields as any)?.group_id;

        if (vacancyGroupFilter === "jobs_updates") {
          if (cat.startsWith("group:") || target === "group" || groupId || cat.includes("announcement") || cat.includes("notice") || target === "announcements") return false;
        } else if (vacancyGroupFilter === "jobs-update") {
          const match =
            cat === "group: jobs-update" ||
            cat === "jobs update group" ||
            (target === "group" && groupId === "jobs-update") ||
            groupId === "jobs-update";
          if (!match) return false;
        } else if (vacancyGroupFilter === "hidden-jobs-update") {
          const match =
            cat === "group: hidden-jobs-update" ||
            cat === "hidden jobs update" ||
            cat.includes("hidden") ||
            (target === "group" && groupId === "hidden-jobs-update") ||
            groupId === "hidden-jobs-update";
          if (!match) return false;
        } else if (vacancyGroupFilter === "announcements") {
          const match =
            cat.includes("announcement") ||
            cat.includes("notice") ||
            target === "announcements";
          if (!match) return false;
        }
      }
      // Status filter
      if (vacancyStatusFilter !== "all") {
        const isLive = isVacancyLive(item);
        if (vacancyStatusFilter === "live" && !isLive) return false;
        if (vacancyStatusFilter === "closed" && isLive) return false;
      }
      // Qualification filter
      if (vacancyQualFilter !== "all") {
        if (
          !item.qualification ||
          !item.qualification.toLowerCase().includes(vacancyQualFilter.toLowerCase())
        ) {
          return false;
        }
      }
      // Search
      if (vacancySearch.trim()) {
        const q = vacancySearch.trim().toLowerCase();
        const full = `${item.title} ${item.description} ${item.organization || ""} ${
          item.qualification || ""
        }`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
  }, [vacancies, vacancyGroupFilter, vacancyStatusFilter, vacancyQualFilter, vacancySearch]);

  // Filtered Internal List
  const filteredInternalItems = useMemo(() => {
    return internalItems.filter((item) => {
      if (internalFilter === "pinned") return item.is_pinned && !item.is_archived;
      if (internalFilter === "archived") return item.is_archived;
      return !item.is_archived;
    });
  }, [internalItems, internalFilter]);

  // Handle Vacancy Banner File Upload
  const handleVacancyBannerUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size must be less than 10MB.");
      return;
    }
    setUploadingVacancyBanner(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      let publicUrl = "";

      if (uid) {
        const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".jpg";
        const safeName = file.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
        const path = `${uid}/banner-${Date.now()}-${safeName}${ext}`;

        const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: true,
        });
        if (!upErr) {
          const { data } = supabase.storage.from("avatars").getPublicUrl(path);
          if (data?.publicUrl) publicUrl = data.publicUrl;
        }
      }

      if (!publicUrl) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((res, rej) => {
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
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
        setVacancyForm((prev) => ({ ...prev, image_url: publicUrl }));
        setPreviewError(false);
        toast.success("Banner image attached!");
      }
    } catch (err) {
      toast.error("Failed to upload banner image. Please try again or paste image link.");
    } finally {
      setUploadingVacancyBanner(false);
    }
  };

  const handleUrlChange = async (urlVal: string) => {
    let finalUrl = urlVal;

    const gDriveMatch = finalUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (gDriveMatch) {
      finalUrl = `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
    } else if (finalUrl.includes("dropbox.com")) {
      finalUrl =
        finalUrl.replace(/[?&]dl=0/, "").replace(/[?&]raw=1/, "") +
        (finalUrl.includes("?") ? "&raw=1" : "?raw=1");
    } else {
      const imgurMatch = finalUrl.match(/imgur\.com\/(?:a\/|gallery\/)?([a-zA-Z0-9]+)$/);
      if (imgurMatch) finalUrl = `https://i.imgur.com/${imgurMatch[1]}.jpg`;
    }

    setVacancyForm((prev) => ({ ...prev, image_url: finalUrl }));
    setPreviewError(false);

    if (finalUrl.includes("ibb.co/") && !finalUrl.includes("i.ibb.co/")) {
      setResolvingUrl(true);
      try {
        const resolved = await resolveImageUrl({ data: { url: finalUrl } });
        if (resolved?.url && resolved.url !== finalUrl) {
          setVacancyForm((prev) => ({ ...prev, image_url: resolved.url }));
          setPreviewError(false);
        }
      } catch (e) {
        console.warn("[TeamNews] Error resolving URL:", e);
      } finally {
        setResolvingUrl(false);
      }
    }
  };

  // Submit Vacancy Post (Requirement 6B: Mandatory Details Validated Before Publishing)
  const handlePublishVacancy = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canPostVacancies) {
      toast.error("You do not have permission to publish vacancies. Please contact Admin.");
      return;
    }

    // 1. Mandatory Title and Description
    if (!vacancyForm.title.trim()) {
      toast.error("Mandatory: Please enter vacancy title.");
      return;
    }
    if (!vacancyForm.description.trim()) {
      toast.error("Mandatory: Please enter vacancy description.");
      return;
    }

    const isVacancyCat =
      vacancyForm.category === "Jobs Update" ||
      vacancyForm.category === "Group: jobs-update" ||
      vacancyForm.category === "Group: hidden-jobs-update" ||
      vacancyForm.category.toLowerCase().includes("job") ||
      vacancyForm.category.toLowerCase().includes("vacancy");

    let minAge: number | null = null;
    let maxAge: number | null = null;

    if (isVacancyCat) {
      // 2. Mandatory Qualification
      if (!vacancyForm.qualification.trim()) {
        toast.error("Mandatory: Please select the required Qualification (e.g. 10th, 12th, Graduation).");
        return;
      }

      // 3. Mandatory Age Limit
      if (!vacancyForm.min_age || !vacancyForm.max_age) {
        toast.error("Mandatory: Please enter valid Age Limit criteria (Min & Max Age).");
        return;
      }
      minAge = parseInt(vacancyForm.min_age, 10);
      maxAge = parseInt(vacancyForm.max_age, 10);
      if (isNaN(minAge) || isNaN(maxAge) || minAge > maxAge) {
        toast.error("Please enter a valid age range (e.g. 18 to 45).");
        return;
      }

      // 4. Mandatory Vacancy Status
      if (!vacancyForm.vacancy_status) {
        toast.error("Mandatory: Please specify Vacancy Status (Live or Closed).");
        return;
      }

      // 5. Mandatory Application Last Date
      if (!vacancyForm.application_last_date) {
        toast.error("Mandatory: Please specify the Application Last Date deadline.");
        return;
      }

      // 6. Check required custom filters
      for (const cf of customFields) {
        if (cf.is_required && !vacancyForm.custom_fields[cf.field_name]) {
          toast.error(`Mandatory: Please fill in required filter "${cf.field_label}".`);
          return;
        }
      }
    } else {
      if (vacancyForm.min_age) minAge = parseInt(vacancyForm.min_age, 10);
      if (vacancyForm.max_age) maxAge = parseInt(vacancyForm.max_age, 10);
    }

    setPublishingVacancy(true);
    try {
      let target = "jobs_updates";
      let groupId: string | undefined = undefined;

      if (vacancyForm.category === "Group: jobs-update") {
        target = "group";
        groupId = "jobs-update";
      } else if (vacancyForm.category === "Group: hidden-jobs-update") {
        target = "group";
        groupId = "hidden-jobs-update";
      } else if (vacancyForm.category === "Service Announcement" || vacancyForm.category === "General Notice") {
        target = "announcements";
      }

      const customPayload = {
        ...vacancyForm.custom_fields,
        target,
        ...(groupId ? { group_id: groupId } : {}),
      };

      const payload = {
        title: vacancyForm.title.trim(),
        description: vacancyForm.description.trim(),
        category: vacancyForm.category,
        published: vacancyForm.published,
        featured: vacancyForm.featured,
        organization: vacancyForm.organization.trim() || undefined,
        qualification: isVacancyCat ? vacancyForm.qualification.trim() : (vacancyForm.qualification?.trim() || undefined),
        min_age: minAge,
        max_age: maxAge,
        vacancy_status: isVacancyCat ? vacancyForm.vacancy_status : (vacancyForm.vacancy_status || "live"),
        application_last_date: vacancyForm.application_last_date || null,
        total_vacancies: vacancyForm.vacancies_count ? parseInt(vacancyForm.vacancies_count, 10) : null,
        apply_url: vacancyForm.application_url.trim() || undefined,
        image_url: vacancyForm.image_url.trim() || undefined,
        custom_fields: customPayload,
      };

      if (editingVacancyId) {
        await notificationsApi.updateNews(editingVacancyId, payload);
        toast.success(`Updated post "${vacancyForm.title}"!`);
      } else {
        await notificationsApi.createNews(payload);
        toast.success(`Published to "${vacancyForm.category}"! Visible in selected channel.`);
      }

      setShowVacancyModal(false);
      setEditingVacancyId(null);
      setVacancyForm({
        category: "Jobs Update",
        title: "",
        description: "",
        organization: "",
        qualification: "Graduation",
        min_age: "18",
        max_age: "45",
        vacancy_status: "live",
        application_last_date: "",
        vacancies_count: "",
        application_url: "",
        image_url: "",
        published: true,
        featured: false,
        custom_fields: {},
      });
      setPreviewError(false);
      setResolvingUrl(false);
      await fetchVacancies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish vacancy.");
    } finally {
      setPublishingVacancy(false);
    }
  };

  const handleEditVacancy = (v: PublicVacancyItem) => {
    setEditingVacancyId(v.id);
    setVacancyForm({
      category: v.category || "Jobs Update",
      title: v.title || "",
      description: v.description || "",
      organization: v.organization || "",
      qualification: v.qualification || "Graduation",
      min_age: v.min_age ? String(v.min_age) : "18",
      max_age: v.max_age ? String(v.max_age) : "45",
      vacancy_status: ((v.vacancy_status as any) || "live").toLowerCase() === "closed" ? "closed" : "live",
      application_last_date: v.application_last_date || "",
      vacancies_count: v.vacancies_count ? String(v.vacancies_count) : "",
      application_url: v.application_url || "",
      image_url: v.image_url || "",
      published: v.published ?? true,
      featured: v.featured ?? false,
      custom_fields: v.custom_fields || {},
    });
    setPreviewError(false);
    setResolvingUrl(false);
    setShowVacancyModal(true);
  };

  const handleDeleteVacancy = async (v: PublicVacancyItem) => {
    if (!confirm(`Are you sure you want to permanently delete "${v.title}"?`)) return;
    try {
      await notificationsApi.deleteNews(v.id);
      setVacancies((prev) => prev.filter((item) => item.id !== v.id));
      toast.success("Vacancy removed successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete vacancy.");
    }
  };

  // Internal Bulletin Publishing
  const handlePublishInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalFormTitle.trim() || !internalFormContent.trim()) {
      toast.error("Please enter both title and content.");
      return;
    }
    setPublishingInternal(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id || null;

      const { error } = await (supabase as any).from("internal_news").insert({
        title: internalFormTitle.trim(),
        content: internalFormContent.trim(),
        image_url: internalFormImageUrl.trim() || null,
        is_pinned: internalFormPinned,
        author_id: uid,
      });

      if (error) throw error;
      toast.success("Internal bulletin published!");
      setShowInternalModal(false);
      setInternalFormTitle("");
      setInternalFormContent("");
      setInternalFormImageUrl("");
      setInternalImagePreview(null);
      setInternalFormPinned(false);
      await fetchInternalNews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish bulletin.");
    } finally {
      setPublishingInternal(false);
    }
  };

  const togglePinInternal = async (item: InternalNewsItem) => {
    try {
      const { error } = await (supabase as any)
        .from("internal_news")
        .update({ is_pinned: !item.is_pinned })
        .eq("id", item.id);
      if (error) throw error;
      setInternalItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_pinned: !i.is_pinned } : i))
      );
      toast.success(item.is_pinned ? "Bulletin unpinned" : "Bulletin pinned");
    } catch (err) {
      toast.error("Failed to update pin state");
    }
  };

  const deleteInternal = async (item: InternalNewsItem) => {
    if (!confirm("Are you sure you want to permanently delete this internal bulletin?")) return;
    try {
      const { error } = await (supabase as any)
        .from("internal_news")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      setInternalItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Bulletin deleted");
    } catch (err) {
      toast.error("Failed to delete bulletin");
    }
  };

  return (
    <>
      <TeamHeader title="News & Job Vacancy Management" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
        {/* Top Header & Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-brand" />
              News, Updates &amp; Job Groups
            </h1>
            <p className="mt-1 text-xs text-text-secondary">
              Publish structured vacancies to "Jobs Update" and "Hidden Jobs Update" groups, and manage internal bulletins.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void fetchVacancies();
                void fetchInternalNews();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-3 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", (loadingVacancies || loadingInternal) && "animate-spin")} />
              Refresh
            </button>

            {activeTab === "vacancies" ? (
              <button
                disabled={!canPostVacancies}
                onClick={() => {
                  setEditingVacancyId(null);
                  setVacancyForm({
                    category: "Jobs Update",
                    title: "",
                    description: "",
                    organization: "",
                    qualification: "Graduation",
                    min_age: "18",
                    max_age: "45",
                    vacancy_status: "live",
                    application_last_date: "",
                    vacancies_count: "",
                    application_url: "",
                    image_url: "",
                    custom_fields: {},
                  });
                  setShowVacancyModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-light transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
                title={canPostVacancies ? "Post new vacancy" : "Posting disabled by Admin"}
              >
                <Plus className="h-4 w-4" />
                Post Job Update
              </button>
            ) : (
              <button
                onClick={() => setShowInternalModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-3 border border-border-subtle px-4 py-2 text-xs font-bold text-white hover:bg-surface-2 transition-all"
              >
                <Plus className="h-4 w-4" />
                Post Internal Bulletin
              </button>
            )}
          </div>
        </div>

        {/* Primary Tabs */}
        <div className="mt-6 flex items-center gap-2 border-b border-border-subtle pb-3">
          <button
            onClick={() => setActiveTab("vacancies")}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "vacancies"
                ? "bg-brand text-black shadow-md shadow-brand/20"
                : "text-text-secondary hover:text-white bg-surface-2"
            )}
          >
            <Briefcase className="h-4 w-4" />
            Job Vacancy Updates ({vacancies.length})
          </button>
          <button
            onClick={() => setActiveTab("internal")}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-2",
              activeTab === "internal"
                ? "bg-brand text-black shadow-md shadow-brand/20"
                : "text-text-secondary hover:text-white bg-surface-2"
            )}
          >
            <Newspaper className="h-4 w-4" />
            Internal Team Bulletins ({internalItems.length})
          </button>
        </div>

        {/* TAB 1: JOB VACANCY UPDATES & USER GROUPS */}
        {activeTab === "vacancies" && (
          <div className="mt-5 space-y-4">
            {/* Filter Controls for Vacancies */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-border-subtle bg-surface-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search vacancies by title, qualification, or department…"
                  className="w-full rounded-xl border border-border-subtle bg-surface-2 pl-8.5 pr-3 py-1.5 text-xs text-white placeholder:text-text-muted outline-none focus:border-brand/40"
                  value={vacancySearch}
                  onChange={(e) => setVacancySearch(e.target.value)}
                />
              </div>

              {/* Channel filter */}
              <select
                className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs text-white outline-none focus:border-brand/40"
                value={vacancyGroupFilter}
                onChange={(e) => setVacancyGroupFilter(e.target.value)}
              >
                <option value="all">All Channels</option>
                <option value="jobs_updates">Jobs Updates Section (/app/news)</option>
                <option value="jobs-update">Jobs Update Group (/app/groups)</option>
                <option value="hidden-jobs-update">Hidden Jobs Update Group (/app/groups)</option>
                <option value="announcements">Service Announcements & Notices</option>
              </select>

              {/* Qualification filter */}
              <select
                className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs text-white outline-none focus:border-brand/40"
                value={vacancyQualFilter}
                onChange={(e) => setVacancyQualFilter(e.target.value)}
              >
                <option value="all">All Qualifications</option>
                {DEFAULT_QUALIFICATIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs text-white outline-none focus:border-brand/40"
                value={vacancyStatusFilter}
                onChange={(e) => setVacancyStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="live">Live Now / Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Vacancies List */}
            {loadingVacancies ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
              </div>
            ) : filteredVacancies.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No vacancies match your filters."
                description="Post new vacancy updates to 'Jobs Update' or 'Hidden Jobs Update' to help candidates."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredVacancies.map((v) => {
                  const isLive = isVacancyLive(v);

                  return (
                    <div
                      key={v.id}
                      className="rounded-2xl border border-border-subtle bg-surface-1 p-4 flex flex-col justify-between space-y-3 shadow-md hover:border-brand/30 transition-all"
                    >
                      <div className="space-y-2">
                        {/* Group and Status Row */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              v.category === "Hidden Jobs Update"
                                ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                                : "bg-brand/15 text-brand border border-brand/30"
                            )}
                          >
                            {v.category || "Jobs Update"}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              isLive
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/15 text-red-400 border border-red-500/30"
                            )}
                          >
                            {isLive ? "Live Now" : "Closed"}
                          </span>
                        </div>

                        {/* Title and Org */}
                        <div>
                          <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
                            {v.title}
                          </h3>
                          {v.organization && (
                            <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-text-muted" />
                              {v.organization}
                            </p>
                          )}
                        </div>

                        <p className="text-xs text-text-muted whitespace-pre-wrap break-words leading-relaxed">
                          {v.description}
                        </p>

                        {/* Structured Vacancy Attributes */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                          {v.qualification && (
                            <span className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-emerald-300 border border-emerald-500/20">
                              <GraduationCap className="h-3 w-3" />
                              {v.qualification}
                            </span>
                          )}
                          {(v.min_age != null || v.max_age != null) && (
                            <span className="rounded-md bg-surface-2 px-2 py-1 text-text-secondary border border-border-subtle">
                              Age: {v.min_age ?? 18}–{v.max_age ?? 45} yrs
                            </span>
                          )}
                          {v.application_last_date && (
                            <span className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-amber-300 border border-amber-500/20">
                              <Calendar className="h-3 w-3" />
                              Last Date: {formatLastDate(v.application_last_date)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-[11px] text-text-muted">
                        <div className="flex items-center gap-2">
                          <span>
                            {v.published_at ? new Date(v.published_at).toLocaleDateString() : "Active"}
                          </span>
                          {canPostVacancies && (
                            <div className="flex items-center gap-1 border-l border-border-subtle pl-2">
                              <button
                                type="button"
                                onClick={() => handleEditVacancy(v)}
                                className="rounded p-1 text-text-muted hover:text-white hover:bg-surface-2 transition-colors"
                                title="Edit Vacancy Update"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVacancy(v)}
                                className="rounded p-1 text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete Vacancy Update"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {v.application_url && (
                          <a
                            href={v.application_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Portal Link
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INTERNAL TEAM BULLETINS */}
        {activeTab === "internal" && (
          <div className="mt-5 space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
              <button
                onClick={() => setInternalFilter("all")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  internalFilter === "all"
                    ? "bg-brand/15 text-brand border border-brand/30"
                    : "text-text-muted hover:text-white"
                )}
              >
                Active Updates ({internalItems.filter((i) => !i.is_archived).length})
              </button>
              <button
                onClick={() => setInternalFilter("pinned")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
                  internalFilter === "pinned"
                    ? "bg-brand/15 text-brand border border-brand/30"
                    : "text-text-muted hover:text-white"
                )}
              >
                <Pin className="h-3 w-3" />
                Pinned ({internalItems.filter((i) => i.is_pinned && !i.is_archived).length})
              </button>
              <button
                onClick={() => setInternalFilter("archived")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5",
                  internalFilter === "archived"
                    ? "bg-brand/15 text-brand border border-brand/30"
                    : "text-text-muted hover:text-white"
                )}
              >
                <Archive className="h-3 w-3" />
                Archived ({internalItems.filter((i) => i.is_archived).length})
              </button>
            </div>

            {loadingInternal ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
              </div>
            ) : filteredInternalItems.length === 0 ? (
              <EmptyState
                icon={Newspaper}
                title="No internal announcements."
                description="New operational bulletins and internal guidelines will appear here."
              />
            ) : (
              <div className="space-y-3">
                {filteredInternalItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{item.title}</h3>
                          {item.is_pinned && (
                            <span className="flex items-center gap-1 text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded-full font-bold">
                              <Pin className="h-3 w-3" /> Pinned
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                          {item.content}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => void togglePinInternal(item)}
                          className="rounded-lg p-1.5 text-text-muted hover:text-brand hover:bg-surface-2"
                          title={item.is_pinned ? "Unpin" : "Pin"}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void deleteInternal(item)}
                          className="rounded-lg p-1.5 text-text-muted hover:text-danger hover:bg-surface-2"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2 text-[10px] text-text-muted">
                      <span>By {item.author_name}</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: POST JOB VACANCY UPDATE (Mandatory Vacancy Details Form) */}
        {showVacancyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-brand" />
                    {editingVacancyId ? "Edit Announcement / Vacancy" : "Post Announcement / Vacancy"}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {vacancyForm.category === "Service Announcement" || vacancyForm.category === "General Notice"
                      ? "Publish official announcements and notices to user applications."
                      : "Enter mandatory qualification, age, status, and deadline before publishing."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVacancyModal(false)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handlePublishVacancy} className="space-y-3">
                {/* Target Channel Selector */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Select Target Publishing Channel *
                  </label>
                  <select
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                    value={vacancyForm.category}
                    onChange={(e) => setVacancyForm({ ...vacancyForm, category: e.target.value })}
                  >
                    <option value="Jobs Update">Jobs Updates Section (Public Vacancies Feed - /app/news)</option>
                    <option value="Group: jobs-update">Jobs Update Group (Dedicated Group Feed Only - /app/groups)</option>
                    <option value="Group: hidden-jobs-update">Hidden Jobs Update Group (Dedicated Group Feed Only - /app/groups)</option>
                    <option value="Service Announcement">Service Announcement (Public)</option>
                    <option value="General Notice">General Notice (Public)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    {vacancyForm.category === "Service Announcement" || vacancyForm.category === "General Notice"
                      ? "Announcement Title *"
                      : "Vacancy Title *"}
                  </label>
                  <input
                    required
                    type="text"
                    value={vacancyForm.title}
                    onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })}
                    placeholder="e.g. UPSC Civil Services Prelims 2026 Notification"
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Description &amp; Important Details *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={vacancyForm.description}
                    onChange={(e) => setVacancyForm({ ...vacancyForm, description: e.target.value })}
                    placeholder="Provide full vacancy summary, eligibility, exam stages, syllabus overview..."
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40 resize-y"
                  />
                </div>

                {/* Mandatory Vacancy Fields Box (Requirement 6B) - Only for Vacancy categories */}
                {(vacancyForm.category === "Jobs Update" ||
                  vacancyForm.category === "Group: jobs-update" ||
                  vacancyForm.category === "Group: hidden-jobs-update" ||
                  vacancyForm.category.toLowerCase().includes("job") ||
                  vacancyForm.category.toLowerCase().includes("vacancy")) && (
                <div className="rounded-xl border border-brand/20 bg-brand/5 p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-brand/10">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                      Mandatory Vacancy Details
                    </span>
                    <span className="text-[10px] text-brand uppercase tracking-wider font-bold">
                      Required for Publishing
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Organization / Department Name
                    </label>
                    <input
                      type="text"
                      value={vacancyForm.organization}
                      onChange={(e) => setVacancyForm({ ...vacancyForm, organization: e.target.value })}
                      placeholder="e.g. Union Public Service Commission / Railway Recruitment Board"
                      className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                    />
                  </div>

                  <div>
                    <QualificationMultiSelect
                      value={vacancyForm.qualification}
                      onChange={(val) => setVacancyForm({ ...vacancyForm, qualification: val })}
                      error={!vacancyForm.qualification.trim() ? "Please select at least one qualification" : undefined}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Vacancy Status *
                    </label>
                    <select
                      required
                      className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-text outline-none focus:border-brand/40"
                      value={vacancyForm.vacancy_status}
                      onChange={(e) =>
                        setVacancyForm({
                          ...vacancyForm,
                          vacancy_status: e.target.value as "live" | "closed",
                        })
                      }
                    >
                      <option value="live">Live Now / Open</option>
                      <option value="closed">Closed / Expired</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Min Age Limit *
                      </label>
                      <input
                        required
                        type="number"
                        min="14"
                        max="65"
                        value={vacancyForm.min_age}
                        onChange={(e) => setVacancyForm({ ...vacancyForm, min_age: e.target.value })}
                        placeholder="18"
                        className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Max Age Limit *
                      </label>
                      <input
                        required
                        type="number"
                        min="14"
                        max="65"
                        value={vacancyForm.max_age}
                        onChange={(e) => setVacancyForm({ ...vacancyForm, max_age: e.target.value })}
                        placeholder="45"
                        className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Last Date to Apply *
                      </label>
                      <input
                        required
                        type="date"
                        value={vacancyForm.application_last_date}
                        onChange={(e) =>
                          setVacancyForm({ ...vacancyForm, application_last_date: e.target.value })
                        }
                        className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1">
                        Total Vacancies (Count)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={vacancyForm.vacancies_count}
                        onChange={(e) =>
                          setVacancyForm({ ...vacancyForm, vacancies_count: e.target.value })
                        }
                        placeholder="e.g. 1056"
                        className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Official Application Link (URL)
                    </label>
                    <input
                      type="url"
                      value={vacancyForm.application_url}
                      onChange={(e) =>
                        setVacancyForm({ ...vacancyForm, application_url: e.target.value })
                      }
                      placeholder="https://upsconline.nic.in"
                      className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                    />
                  </div>

                  {/* Dynamic Custom Filters from Admin */}
                  {customFields.length > 0 && (
                    <div className="pt-2 border-t border-brand/10 space-y-2">
                      <p className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                        <SlidersHorizontal className="h-3 w-3 text-brand" /> Additional Admin Filters
                      </p>
                      {customFields.map((cf) => (
                        <div key={cf.id}>
                          <label className="block text-xs font-semibold text-text-secondary mb-1">
                            {cf.field_label} {cf.is_required ? "*" : ""}
                          </label>
                          {cf.field_type === "dropdown" ? (
                            <select
                              className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                              value={vacancyForm.custom_fields[cf.field_name] || ""}
                              onChange={(e) =>
                                setVacancyForm({
                                  ...vacancyForm,
                                  custom_fields: {
                                    ...vacancyForm.custom_fields,
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
                              type={
                                cf.field_type === "number"
                                  ? "number"
                                  : cf.field_type === "date"
                                  ? "date"
                                  : "text"
                              }
                              className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                              value={vacancyForm.custom_fields[cf.field_name] || ""}
                              onChange={(e) =>
                                setVacancyForm({
                                  ...vacancyForm,
                                  custom_fields: {
                                    ...vacancyForm.custom_fields,
                                    [cf.field_name]: e.target.value,
                                  },
                                })
                              }
                              placeholder={`Enter ${cf.field_label}…`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

                {/* Banner Image */}
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Banner Image (Shows on Mobile Banners)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="file"
                      ref={vacancyFileRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleVacancyBannerUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingVacancyBanner || resolvingUrl || publishingVacancy}
                      onClick={() => vacancyFileRef.current?.click()}
                      className="rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs font-semibold text-white hover:bg-surface-3 transition-colors flex items-center gap-1.5"
                    >
                      {uploadingVacancyBanner ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                          <span>Uploading…</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5 text-brand" />
                          <span>Upload Banner</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-text-muted">or paste image link</span>
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      value={vacancyForm.image_url}
                      onChange={(e) => void handleUrlChange(e.target.value)}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 pr-8 text-xs text-white outline-none focus:border-brand/40"
                    />
                    {resolvingUrl && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                      </div>
                    )}
                    {vacancyForm.image_url && !resolvingUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setVacancyForm((prev) => ({ ...prev, image_url: "" }));
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

                {vacancyForm.image_url.trim() && (
                  <div className="rounded-xl border border-border-subtle bg-surface-2 p-2.5 overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-brand" /> Live Preview
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setVacancyForm((prev) => ({ ...prev, image_url: "" }));
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
                      </div>
                    ) : (
                      <div className="relative rounded-lg overflow-hidden border border-border-subtle bg-black/40 max-h-48">
                        <img
                          src={vacancyForm.image_url.trim()}
                          alt="Preview"
                          className="w-full h-40 object-cover"
                          onError={() => setPreviewError(true)}
                          onLoad={() => setPreviewError(false)}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4 text-[11px] text-text-secondary pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vacancyForm.published}
                      onChange={(e) =>
                        setVacancyForm({ ...vacancyForm, published: e.target.checked })
                      }
                    />{" "}
                    Published
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vacancyForm.featured}
                      onChange={(e) =>
                        setVacancyForm({ ...vacancyForm, featured: e.target.checked })
                      }
                    />{" "}
                    Pinned to top
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setShowVacancyModal(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/5"
                    disabled={publishingVacancy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={publishingVacancy}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-black hover:bg-brand-light disabled:opacity-50 shadow-lg shadow-brand/20"
                  >
                    {publishingVacancy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {publishingVacancy
                      ? "Saving..."
                      : editingVacancyId
                        ? "Save Changes"
                        : "Publish Vacancy Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: POST INTERNAL BULLETIN */}
        {showInternalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-brand" />
                  Post Internal Team Bulletin
                </h3>
                <button
                  type="button"
                  onClick={() => setShowInternalModal(false)}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handlePublishInternal} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Bulletin Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={internalFormTitle}
                    onChange={(e) => setInternalFormTitle(e.target.value)}
                    placeholder="e.g. Server Maintenance Notice / Document Review SOP"
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Bulletin Message *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={internalFormContent}
                    onChange={(e) => setInternalFormContent(e.target.value)}
                    placeholder="Provide operational guidance, announcements, or policies..."
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-xs text-white outline-none focus:border-brand/40 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pin-internal"
                    checked={internalFormPinned}
                    onChange={(e) => setInternalFormPinned(e.target.checked)}
                    className="rounded border-border-subtle bg-surface-2 text-brand focus:ring-0"
                  />
                  <label htmlFor="pin-internal" className="text-xs text-text-secondary cursor-pointer">
                    Pin this bulletin to the top of internal news
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setShowInternalModal(false)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/5"
                    disabled={publishingInternal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={publishingInternal}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-black hover:bg-brand-light disabled:opacity-50"
                  >
                    {publishingInternal && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Publish Bulletin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
