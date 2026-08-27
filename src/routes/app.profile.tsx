import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Camera,
  Settings,
} from "lucide-react";
import { UserHeader } from "@/components/layout/UserHeader";
import { useUserStore } from "@/lib/user-store";
import { useSession } from "@/lib/session";
import { CONTACT } from "@/data/landing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/profile")({
  component: Profile,
  head: () => ({
    meta: [
      { title: "Profile — Formbhro" },
      {
        name: "description",
        content: "Manage your Formbhro profile information, account details and security settings.",
      },
      { property: "og:title", content: "Profile — Formbhro" },
      { property: "og:description", content: "Manage your Formbhro profile and account settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Profile() {
  const { profile, updateProfile, uploadAvatar } = useUserStore();
  const { signOut } = useSession();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        if (uploadAvatar) {
          await uploadAvatar(file);
        } else {
          updateProfile({ avatarUrl: URL.createObjectURL(file) });
        }
      } catch (err) {
        console.error("Image upload failed:", err);
      }
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        ...form,
        initials: form.name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
      });
      setEditing(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save profile. Please try again.");
    }
  };

  const field =
    "w-full rounded-2xl border border-border-subtle bg-surface-2 px-4 py-3 text-sm text-white placeholder:text-text-muted focus:border-brand/40 focus:ring-1 focus:ring-brand/10 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <UserHeader title="My Profile" />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 pb-28 pt-8 sm:px-6 lg:pb-16">
        {/* Profile Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-surface-1 p-8 shadow-2xl shadow-black/20">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <User size={120} strokeWidth={1} />
          </div>

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:text-left text-center">
            <div className="relative group">
              <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-2 border-brand/20 bg-brand/5 text-2xl font-bold text-brand shadow-lg shadow-brand/10 transition-transform duration-300 group-hover:scale-105">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
                ) : (
                  profile.initials
                )}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-surface-3 text-brand border border-border-subtle shadow-lg transition-all hover:scale-110 active:scale-95"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="truncate text-2xl font-bold text-white tracking-tight">
                {profile.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider border border-border-subtle">
                  <ShieldCheck className="h-3 w-3 text-brand" /> Verified User
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider border border-border-subtle">
                  ID: {profile.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <section className="rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-lg shadow-black/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Settings className="h-4 w-4 text-brand" /> Settings
            </h2>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-[10px] font-bold text-brand uppercase tracking-widest hover:text-white transition-colors"
              >
                Modify
              </button>
            ) : null}
          </div>

          <form onSubmit={save} className="mt-6 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="p-name"
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1"
                >
                  Full Identity
                </label>
                <input
                  id="p-name"
                  value={form.name}
                  disabled={!editing}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={cn("mt-2", field)}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label
                  htmlFor="p-email"
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1"
                >
                  Communications
                </label>
                <div className="relative mt-2">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="p-email"
                    type="email"
                    value={form.email}
                    disabled={!editing}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={cn(field, "pl-11")}
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="p-phone"
                  className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1"
                >
                  Contact Line
                </label>
                <div className="relative mt-2">
                  <Phone
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="p-phone"
                    type="tel"
                    maxLength={10}
                    value={form.phone}
                    disabled={!editing}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 10) setForm({ ...form, phone: val });
                    }}
                    className={cn(field, "pl-11")}
                    placeholder="10-digit phone number"
                  />
                </div>
              </div>
            </div>

            {editing && (
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-brand py-3 text-[10px] font-bold text-white uppercase tracking-widest shadow-lg shadow-brand/20 transition-all hover:bg-brand-light active:scale-[0.98]"
                >
                  Commit Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ name: profile.name, email: profile.email, phone: profile.phone });
                    setEditing(false);
                  }}
                  className="rounded-2xl border border-border-subtle bg-surface-2 px-6 py-3 text-[10px] font-bold text-white uppercase tracking-widest transition-all hover:bg-surface-3 active:scale-[0.98]"
                >
                  Discard
                </button>
              </div>
            )}
          </form>
        </section>

        {/* Security & Support Grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          <section className="rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-lg shadow-black/10">
            <h2 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand" /> Security
            </h2>
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-tight">
                  Active Since
                </span>
                <span className="text-[11px] font-bold text-white">{profile.createdAt}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-tight">
                  Provider
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-brand">
                  {profile.authProvider === "google" ? "Google Sync" : "Email Secure"}
                </span>
              </div>

              {profile.authProvider !== "google" && (
                <button className="w-full mt-2 rounded-2xl border border-border-subtle bg-surface-2 py-3 text-[10px] font-bold text-white uppercase tracking-widest transition-all hover:bg-surface-3 active:scale-[0.98]">
                  Reset Passkey
                </button>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-border-subtle bg-surface-1 p-6 shadow-lg shadow-black/10">
            <h2 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-brand" /> Concierge
            </h2>
            <p className="mt-4 text-[10px] font-bold text-text-secondary uppercase leading-relaxed tracking-tight">
              Assistance is live Mon–Sat, 9AM – 9PM IST.
            </p>
            <div className="mt-4 space-y-2">
              <a
                href={`tel:${CONTACT.phone}`}
                className="flex items-center justify-between py-2 border-b border-white/5 group"
              >
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-tight">
                  Phone
                </span>
                <span className="text-[11px] font-bold text-white group-hover:text-brand transition-colors">
                  {CONTACT.phone}
                </span>
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className="flex items-center justify-between py-2 border-b border-white/5 group"
              >
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-tight">
                  Support
                </span>
                <span className="text-[11px] font-bold text-white group-hover:text-brand transition-colors">
                  {CONTACT.email}
                </span>
              </a>
            </div>
          </section>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={() => void signOut().then(() => navigate({ to: "/" }))}
          className="w-full rounded-3xl border border-red-500/20 bg-red-500/5 py-4 text-[11px] font-bold text-red-500 uppercase tracking-[0.2em] transition-all hover:bg-red-500 hover:text-white shadow-lg active:scale-[0.99]"
        >
          <span className="flex items-center justify-center gap-3">
            <LogOut className="h-4 w-4" /> Terminal Session
          </span>
        </button>
      </main>
    </div>
  );
}
