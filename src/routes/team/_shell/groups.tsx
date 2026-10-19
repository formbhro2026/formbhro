import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Users,
  Briefcase,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  ExternalLink,
  Calendar,
  Clock,
  Building2,
  GraduationCap,
  Trash2,
  Edit2,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Share2,
} from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useTeamStore } from "@/lib/team-store";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import * as notificationsApi from "@/lib/api/notifications";
import {
  JOB_GROUPS,
  DEFAULT_QUALIFICATIONS,
  isVacancyLive,
  type JobGroupId,
} from "@/data/vacancy-groups";
import { QualificationMultiSelect } from "@/components/common/QualificationMultiSelect";
import { uploadNewsBanner } from "@/lib/api/admin.functions";

export const Route = createFileRoute("/team/_shell/groups")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { groupId?: string } => ({
    groupId: typeof search.groupId === "string" ? search.groupId : undefined,
  }),
  component: TeamJobGroups,
  head: () => ({
    meta: [
      { title: "Job Groups & Updates — Formbhro Team" },
      {
        name: "description",
        content: "Manage and publish exclusive vacancies inside WhatsApp-style recruitment groups.",
      },
    ],
  }),
});

interface GroupPostItem {
  id: string;
  title: string;
  description: string;
  category: string;
  organization?: string;
  qualification?: string;
  min_age?: number;
  max_age?: number;
  vacancy_status?: string;
  application_last_date?: string;
  total_vacancies?: number | null;
  apply_url?: string;
  notification_url?: string;
  image_url?: string | null;
  published: boolean;
  published_at: string;
  author_name?: string;
  custom_fields?: any;
}

function TeamJobGroups() {
  const { member } = useTeamStore();
  const searchParams = Route.useSearch();
  const navigate = useNavigate();

  const activeGroupId = (searchParams.groupId as JobGroupId | undefined) ?? null;
  const activeGroup = activeGroupId ? JOB_GROUPS.find((g) => g.id === activeGroupId) ?? null : null;

  // Data state
  const [posts, setPosts] = useState<GroupPostItem[]>([]);
  const [allGroupPosts, setAllGroupPosts] = useState<Record<string, GroupPostItem[]>>({
    "jobs-update": [],
    "hidden-jobs-update": [],
  });
  const [loading, setLoading] = useState(false);

  // Group Feed Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQualification, setSelectedQualification] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "live" | "closed">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Post Vacancy Modal state
  const [showModal, setShowModal] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    organization: "",
    qualification: "Graduation",
    min_age: "18",
    max_age: "45",
    vacancy_status: "Live",
    application_last_date: "",
    vacancies_count: "",
    application_url: "",
    notification_url: "",
    image_url: "",
  });

  // Check permission
  const canPublish =
    member?.role === "Administrator" ||
    (member?.permissions as any)?.can_post_news !== false;

  // Load feed for active group
  const fetchActiveGroupPosts = async (groupId: JobGroupId) => {
    setLoading(true);
    try {
      const data = await notificationsApi.listGroupUpdates(groupId, 100);
      const mapped: GroupPostItem[] = (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        organization: row.organization,
        qualification: row.qualification,
        min_age: row.min_age,
        max_age: row.max_age,
        vacancy_status: row.vacancy_status,
        application_last_date: row.application_last_date,
        total_vacancies: row.total_vacancies ?? row.vacancies_count,
        apply_url: row.apply_url ?? row.application_url,
        notification_url: row.notification_url,
        image_url: row.image_url,
        published: row.published,
        published_at: row.published_at || row.created_at,
        author_name:
          row.author_name ||
          row.custom_fields?.author_name ||
          (member?.name ? member.name : "Formbhro Team"),
        custom_fields: row.custom_fields,
      }));
      setPosts(mapped);
      setAllGroupPosts((prev) => ({ ...prev, [groupId]: mapped }));
    } catch (err) {
      console.error("Error loading group feed:", err);
      toast.error("Failed to load group updates.");
    } finally {
      setLoading(false);
    }
  };

  // Load counts for main directory
  const loadCounts = async () => {
    try {
      const [jobs, hidden] = await Promise.all([
        notificationsApi.listGroupUpdates("jobs-update", 50),
        notificationsApi.listGroupUpdates("hidden-jobs-update", 50),
      ]);
      setAllGroupPosts({
        "jobs-update": (jobs as any[]) || [],
        "hidden-jobs-update": (hidden as any[]) || [],
      });
    } catch (_) {}
  };

  useEffect(() => {
    if (activeGroupId) {
      void fetchActiveGroupPosts(activeGroupId);
    } else {
      void loadCounts();
    }
  }, [activeGroupId]);

  const handleOpenGroup = (groupId: JobGroupId) => {
    setSearchQuery("");
    setSelectedQualification("All");
    setSelectedStatus("all");
    setFiltersOpen(false);
    void navigate({
      to: "/team/groups",
      search: { groupId },
    });
  };

  const handleBackToList = () => {
    void navigate({
      to: "/team/groups",
      search: {},
    });
  };

  // Handle Banner Upload
  const handleBannerUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }
    setUploadingBanner(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      let publicUrl = "";

      if (uid) {
        const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".jpg";
        const safeName = file.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
        const path = `${uid}/group-banner-${Date.now()}-${safeName}${ext}`;

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
        setForm((prev) => ({ ...prev, image_url: publicUrl }));
        toast.success("Banner image attached!");
      }
    } catch (_) {
      toast.error("Failed to upload image. You can also paste an image URL.");
    } finally {
      setUploadingBanner(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingPostId(null);
    setForm({
      title: "",
      description: "",
      organization: "",
      qualification: "Graduation",
      min_age: "18",
      max_age: "45",
      vacancy_status: "Live",
      application_last_date: "",
      vacancies_count: "",
      application_url: "",
      notification_url: "",
      image_url: "",
    });
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (post: GroupPostItem) => {
    setEditingPostId(post.id);
    setForm({
      title: post.title,
      description: post.description,
      organization: post.organization || "",
      qualification: post.qualification || "Graduation",
      min_age: post.min_age ? String(post.min_age) : "18",
      max_age: post.max_age ? String(post.max_age) : "45",
      vacancy_status: post.vacancy_status || "Live",
      application_last_date: post.application_last_date || "",
      vacancies_count: post.total_vacancies ? String(post.total_vacancies) : "",
      application_url: post.apply_url || "",
      notification_url: post.notification_url || "",
      image_url: post.image_url || "",
    });
    setShowModal(true);
  };

  // Delete Post
  const handleDeletePost = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this post from the group?")) return;
    try {
      await notificationsApi.deleteNews(id);
      toast.success("Post removed from group.");
      if (activeGroupId) void fetchActiveGroupPosts(activeGroupId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete post.");
    }
  };

  // Submit Post Inside Group
  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroupId) return;

    if (!canPublish) {
      toast.error("You do not have permission to publish in groups.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Please enter a vacancy title.");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Please enter vacancy details or instructions.");
      return;
    }
    const minAge = parseInt(form.min_age, 10);
    const maxAge = parseInt(form.max_age, 10);
    if (isNaN(minAge) || isNaN(maxAge) || minAge > maxAge) {
      toast.error("Please enter a valid age limit (e.g. 18 to 45).");
      return;
    }

    setSubmitting(true);
    try {
      const authorName = member?.name || "Formbhro Team";
      const customPayload = {
        target: "group",
        group_id: activeGroupId,
        author_name: authorName,
        author_role: member?.role || "Support Executive",
        posted_from: "team_panel",
      };

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: `Group: ${activeGroupId}`,
        published: true,
        featured: false,
        organization: form.organization.trim() || undefined,
        qualification: form.qualification.trim(),
        min_age: minAge,
        max_age: maxAge,
        vacancy_status: form.vacancy_status as any,
        application_last_date: form.application_last_date,
        total_vacancies: form.vacancies_count ? parseInt(form.vacancies_count, 10) : null,
        apply_url: form.application_url.trim() || undefined,
        notification_url: form.notification_url.trim() || undefined,
        image_url: form.image_url.trim() || undefined,
        custom_fields: customPayload,
      };

      if (editingPostId) {
        await notificationsApi.updateNews(editingPostId, payload);
        toast.success(`Updated post in ${activeGroup?.name}!`);
      } else {
        await notificationsApi.createNews(payload);
        toast.success(`Published post in ${activeGroup?.name}! Visible only to this group.`);
      }

      setShowModal(false);
      void fetchActiveGroupPosts(activeGroupId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to publish post.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Posts inside group feed
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (selectedQualification !== "All") {
        if (!post.qualification || !post.qualification.includes(selectedQualification)) {
          return false;
        }
      }
      if (selectedStatus !== "all") {
        const isLive = isVacancyLive(post as any);
        if (selectedStatus === "live" && !isLive) return false;
        if (selectedStatus === "closed" && isLive) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const full = `${post.title} ${post.description} ${post.organization || ""} ${
          post.qualification || ""
        } ${post.author_name || ""}`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
  }, [posts, selectedQualification, selectedStatus, searchQuery]);

  // =========================================================================
  // VIEW 1: DEDICATED GROUP SCREEN (WhatsApp Group Feed)
  // =========================================================================
  if (activeGroup && activeGroupId) {
    const isHiddenGroup = activeGroupId === "hidden-jobs-update";

    return (
      <div className="flex min-h-screen flex-col bg-bg text-text">
        <TeamHeader title={activeGroup.name} />

        {/* Dedicated Group Top Bar */}
        <header className="sticky top-16 z-20 border-b border-border-subtle bg-bg/95 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleBackToList}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border-subtle text-text-muted transition-colors hover:border-brand/40 hover:bg-surface-2 hover:text-white"
                title="Back to Groups Directory"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-white shadow-sm",
                  isHiddenGroup
                    ? "border-purple-500/40 bg-gradient-to-br from-purple-600 to-indigo-800"
                    : "border-brand/40 bg-gradient-to-br from-brand-dark to-brand-light",
                )}
              >
                {isHiddenGroup ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  <Briefcase className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-sm font-bold text-white sm:text-base">
                    {activeGroup.name}
                  </h1>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                      isHiddenGroup
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                        : "bg-brand/20 text-brand border border-brand/30",
                    )}
                  >
                    {activeGroup.badge}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{posts.length} posts in this group</span>
                </p>
              </div>
            </div>

            {/* Post Vacancy Action Button */}
            {canPublish && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-brand/20 hover:bg-brand-light transition-all active:scale-95 shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Post Vacancy in this Group</span>
                <span className="sm:hidden">Post Vacancy</span>
              </button>
            )}
          </div>
        </header>

        {/* Group Feed Content */}
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-4 sm:px-6">
          {/* Group Notice Banner */}
          <div
            className={cn(
              "rounded-2xl border p-4 mb-4 relative overflow-hidden",
              isHiddenGroup
                ? "border-purple-500/30 bg-purple-950/20 text-purple-100"
                : "border-brand/30 bg-brand/5 text-brand-light",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "p-2 rounded-xl shrink-0 mt-0.5",
                  isHiddenGroup ? "bg-purple-500/20 text-purple-300" : "bg-brand/20 text-brand",
                )}
              >
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider block">
                  Dedicated {activeGroup.name} Channel
                </span>
                <p className="text-xs text-text mt-0.5 leading-relaxed">
                  {activeGroup.description} Posts published here appear exclusively inside this group and will never leak into general Jobs Updates.
                </p>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="rounded-2xl border border-border-subtle bg-surface-1 p-3 shadow-sm mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeGroup.name} posts, organization, author...`}
                  className="h-10 w-full rounded-xl border border-border-subtle bg-surface-2 pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all shrink-0",
                  filtersOpen || selectedQualification !== "All" || selectedStatus !== "all"
                    ? "border-brand bg-brand/10 text-brand-light"
                    : "border-border-subtle bg-surface-2 text-text-secondary hover:text-white",
                )}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>

            {/* Collapsible Filter Row */}
            {filtersOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-border-subtle">
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-1">
                    Qualification
                  </label>
                  <select
                    value={selectedQualification}
                    onChange={(e) => setSelectedQualification(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-border-subtle bg-surface-2 px-2 text-xs text-white focus:border-brand/50 outline-none"
                  >
                    <option value="All">All Qualifications</option>
                    {DEFAULT_QUALIFICATIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-1">
                    Vacancy Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as any)}
                    className="w-full h-8.5 rounded-lg border border-border-subtle bg-surface-2 px-2 text-xs text-white focus:border-brand/50 outline-none"
                  >
                    <option value="all">All Vacancies</option>
                    <option value="live">Live Only</option>
                    <option value="closed">Closed / Expired</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Posts Feed */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
              <p className="text-xs text-text-muted">Loading {activeGroup.name} feed...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-8 text-center space-y-3">
              <div className="grid h-12 w-12 mx-auto place-items-center rounded-2xl bg-surface-2 text-text-muted">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No posts in this group yet</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Be the first to post a verified vacancy or announcement inside this group channel.
              </p>
              {canPublish && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-light transition-all shadow-md shadow-brand/20"
                >
                  <Plus className="h-4 w-4" /> Post Vacancy
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => {
                const isLive = isVacancyLive(post as any);

                return (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-border-subtle bg-surface-1 p-4 sm:p-5 shadow-sm transition-all hover:border-brand/30 hover:bg-surface-1/90 relative"
                  >
                    {/* Top row: Organization + Status Badge + Actions */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {post.organization && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-text-secondary border border-border-subtle">
                            <Building2 className="h-3 w-3" />
                            {post.organization}
                          </span>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                            isLive
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700",
                          )}
                        >
                          {isLive ? "Live Vacancy" : "Closed"}
                        </span>
                      </div>

                      {canPublish && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(post)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-text-muted hover:text-white hover:bg-surface-2 transition-colors"
                            title="Edit Post"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            className="grid h-7 w-7 place-items-center rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-2 transition-colors"
                            title="Delete Post"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Post Title */}
                    <h2 className="text-base font-bold text-white mb-1.5 leading-snug">
                      {post.title}
                    </h2>

                    {/* Post Description */}
                    <p className="text-xs text-text-secondary leading-relaxed mb-3 line-clamp-3">
                      {post.description}
                    </p>

                    {/* Key Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-surface-2 p-2.5 text-xs mb-3 border border-border-subtle">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                          Qualification
                        </span>
                        <span className="font-semibold text-white mt-0.5 block truncate">
                          {post.qualification || "Not specified"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                          Age Limit
                        </span>
                        <span className="font-semibold text-white mt-0.5 block truncate">
                          {post.min_age && post.max_age ? `${post.min_age} - ${post.max_age} Years` : "As per rules"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                          Last Date
                        </span>
                        <span className="font-semibold text-brand-light mt-0.5 block truncate">
                          {post.application_last_date || "Open"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                          Total Posts
                        </span>
                        <span className="font-semibold text-white mt-0.5 block truncate">
                          {post.total_vacancies ? `${post.total_vacancies} Posts` : "Multiple"}
                        </span>
                      </div>
                    </div>

                    {/* Footer: Author Name + Publication Timestamp + Action Links */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-border-subtle/50">
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                        <span className="font-semibold text-text-secondary">
                          Posted by {post.author_name || "Formbhro Team"}
                        </span>
                        <span>•</span>
                        <time>{new Date(post.published_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}</time>
                      </div>

                      <div className="flex items-center gap-2">
                        {post.apply_url && (
                          <a
                            href={post.apply_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand-light hover:bg-brand hover:text-white transition-all"
                          >
                            Apply Link <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {post.notification_url && (
                          <a
                            href={post.notification_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs font-semibold text-text-secondary hover:text-white transition-colors"
                          >
                            PDF Notice
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {/* Post Vacancy Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg rounded-2xl border border-border-subtle bg-surface-1 p-5 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/15 text-brand">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {editingPostId ? "Edit Vacancy Post" : `Post Vacancy in ${activeGroup.name}`}
                    </h3>
                    <p className="text-[10px] text-text-muted">
                      Will be published exclusively inside {activeGroup.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg p-1 text-text-muted hover:text-white hover:bg-surface-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitPost} className="space-y-3.5 pt-3">
                {/* Title */}
                <div>
                  <label className="block text-[11px] font-bold text-white mb-1">
                    Vacancy Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. SSC CGL 2026 Notification"
                    className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
                  />
                </div>

                {/* Organization & Total Posts */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Organization / Dept
                    </label>
                    <input
                      value={form.organization}
                      onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))}
                      placeholder="e.g. Staff Selection Commission"
                      className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Total Posts
                    </label>
                    <input
                      type="number"
                      value={form.vacancies_count}
                      onChange={(e) => setForm((p) => ({ ...p, vacancies_count: e.target.value }))}
                      placeholder="e.g. 14500"
                      className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
                    />
                  </div>
                </div>

                {/* Qualification & Status */}
                <div className="space-y-2">
                  <QualificationMultiSelect
                    value={form.qualification}
                    onChange={(val) => setForm((p) => ({ ...p, qualification: val }))}
                    error={!form.qualification.trim() ? "Please select at least one qualification" : undefined}
                  />

                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Status <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={form.vacancy_status}
                      onChange={(e) => setForm((p) => ({ ...p, vacancy_status: e.target.value }))}
                      className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 px-2 text-xs text-text focus:border-brand/50 outline-none"
                    >
                      <option value="Live">Live Vacancy</option>
                      <option value="Closed">Closed / Expired</option>
                    </select>
                  </div>
                </div>

                {/* Age Limit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Min Age
                    </label>
                    <input
                      type="number"
                      value={form.min_age}
                      onChange={(e) => setForm((p) => ({ ...p, min_age: e.target.value }))}
                      placeholder="18"
                      className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs text-white focus:border-brand/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Max Age
                    </label>
                    <input
                      type="number"
                      value={form.max_age}
                      onChange={(e) => setForm((p) => ({ ...p, max_age: e.target.value }))}
                      placeholder="45"
                      className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs text-white focus:border-brand/50 outline-none"
                    />
                  </div>
                </div>

                {/* Links */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Apply Online URL
                    </label>
                    <input
                      type="url"
                      value={form.application_url}
                      onChange={(e) => setForm((p) => ({ ...p, application_url: e.target.value }))}
                      placeholder="https://..."
                      className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-text-muted mb-1">
                      Notification PDF URL
                    </label>
                    <input
                      type="url"
                      value={form.notification_url}
                      onChange={(e) => setForm((p) => ({ ...p, notification_url: e.target.value }))}
                      placeholder="https://..."
                      className="h-9 w-full rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-white mb-1">
                    Description & Details <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Enter eligibility, selection process, fee details, and important notes..."
                    className="w-full rounded-xl border border-border-subtle bg-surface-2 p-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none resize-none"
                  />
                </div>

                {/* Banner Upload */}
                <div>
                  <label className="block text-[10px] font-semibold text-text-muted mb-1">
                    Banner Image (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-white cursor-pointer">
                      <ImageIcon className="h-4 w-4" />
                      <span>{uploadingBanner ? "Uploading..." : "Upload File"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingBanner}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleBannerUpload(file);
                        }}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="url"
                      value={form.image_url}
                      onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                      placeholder="Or paste banner image URL..."
                      className="h-9 flex-1 rounded-xl border border-border-subtle bg-surface-2 px-3 text-xs text-white placeholder:text-text-muted focus:border-brand/50 outline-none"
                    />
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || uploadingBanner}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white hover:bg-brand-light transition-all disabled:opacity-60 shadow-md shadow-brand/20"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>{editingPostId ? "Save Changes" : "Publish to Group"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MAIN GROUPS DIRECTORY (WhatsApp Community / Group List)
  // Does NOT display group posts directly below group cards on this page!
  // =========================================================================
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <TeamHeader title="Job Groups" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4 sm:px-6">
        {/* Navigation Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white sm:text-2xl flex items-center gap-2">
              <Users className="h-6 w-6 text-brand" /> Team Vacancy Groups
            </h1>
            <p className="mt-0.5 text-xs text-text-secondary">
              Official WhatsApp-style recruitment group channels verified by Formbhro.
            </p>
          </div>
          <Link
            to="/team/news"
            className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
          >
            Jobs Updates Newsroom <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* WhatsApp-Style Group Channels List */}
        <div className="space-y-3.5">
          {JOB_GROUPS.map((group) => {
            const count = (allGroupPosts[group.id] || []).length;
            const isHiddenGroup = group.id === "hidden-jobs-update";

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => handleOpenGroup(group.id)}
                className="w-full text-left rounded-2xl border border-border-subtle bg-surface-1 p-4 sm:p-5 transition-all duration-200 hover:border-brand/40 hover:bg-surface-2 hover:shadow-lg hover:shadow-brand/5 active:scale-[0.99] group relative overflow-hidden"
              >
                <div className="flex items-start gap-4">
                  {/* Left Avatar */}
                  <div
                    className={cn(
                      "grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-white shadow-md transition-transform duration-200 group-hover:scale-105",
                      isHiddenGroup
                        ? "border-purple-500/40 bg-gradient-to-br from-purple-600 to-indigo-800"
                        : "border-brand/40 bg-gradient-to-br from-brand-dark to-brand-light",
                    )}
                  >
                    {isHiddenGroup ? (
                      <Sparkles className="h-7 w-7" />
                    ) : (
                      <Briefcase className="h-7 w-7" />
                    )}
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h2 className="text-base font-bold text-white group-hover:text-brand transition-colors truncate">
                          {group.name}
                        </h2>
                        <span className="text-brand">
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                          isHiddenGroup
                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                            : "bg-brand/20 text-brand border border-brand/30",
                        )}
                      >
                        {group.badge}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {group.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-border-subtle/40">
                      <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="font-medium text-emerald-400">
                          {count} {count === 1 ? "Update" : "Updates"} available
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand group-hover:translate-x-0.5 transition-transform">
                        Open Group <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
