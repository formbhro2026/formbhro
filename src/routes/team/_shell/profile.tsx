import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, LogOut, Mail, Pencil, ShieldCheck } from "lucide-react";
import { TeamHeader } from "@/components/team/TeamHeader";
import { ConfirmDialog } from "@/components/team/ConfirmDialog";
import { useTeamStore } from "@/lib/team-store";
import { toast } from "sonner";

export const Route = createFileRoute("/team/_shell/profile")({
  component: TeamProfile,
  head: () => ({
    meta: [
      { title: "My Team Profile — Formbhro" },
      {
        name: "description",
        content: "Your Formbhro team member profile, performance summary and account actions.",
      },
      { property: "og:title", content: "My Team Profile — Formbhro" },
      { property: "og:description", content: "Team member profile and performance summary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function TeamProfile() {
  const { member, requests, updateMember, signOut } = useTeamStore();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member?.name ?? "");
  const [confirmOut, setConfirmOut] = useState(false);

  const completed = requests.filter((r) => r.status === "completed").length;
  const pending = requests.filter((r) => r.status !== "completed").length;
  const rate = requests.length ? Math.round((completed / requests.length) * 100) : 0;

  const performance = [
    { label: "Total Forms Filled", value: String(completed + 18) },
    { label: "Total Assigned", value: String(requests.length) },
    { label: "Completed", value: String(completed) },
    { label: "Pending", value: String(pending) },
    { label: "Average Response Time", value: "8m 42s" },
    { label: "Completion Rate", value: `${rate}%` },
  ];

  const details = [
    { label: "Email", value: member?.email ?? "" },
    { label: "Role", value: member?.role ?? "" },
    { label: "Team ID", value: member?.teamId ?? "" },
    { label: "Member Since", value: member?.memberSince ?? "" },
  ];

  return (
    <>
      <TeamHeader title="Profile" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
        <section className="rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-lg font-bold text-brand-light">
              {member?.initials}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-white">{member?.name}</h2>
              <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-text-secondary sm:justify-start">
                <ShieldCheck className="h-3.5 w-3.5 text-brand" aria-hidden="true" /> {member?.role}
              </p>
              <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] text-text-muted sm:justify-start">
                <Mail className="h-3 w-3" aria-hidden="true" /> {member?.email}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.map((d) => (
              <div
                key={d.label}
                className="rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-2.5"
              >
                <dt className="text-[11px] text-text-muted">{d.label}</dt>
                <dd className="mt-0.5 truncate text-xs font-semibold text-white">{d.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-4 rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <h3 className="text-sm font-semibold text-white">Performance</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {performance.map((p) => (
              <div
                key={p.label}
                className="rounded-xl border border-border-subtle bg-surface-2 px-3.5 py-3"
              >
                <dd className="text-base font-bold tabular-nums text-white">{p.value}</dd>
                <dt className="mt-0.5 text-[11px] leading-tight text-text-muted">{p.label}</dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setName(member?.name ?? "");
              setEditing(true);
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 text-xs font-semibold text-white transition-colors hover:bg-white/5"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit Profile
          </button>
          <button
            type="button"
            onClick={() =>
              toast.info(
                "Password changes are admin controlled. Please contact your administrator.",
              )
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 text-xs font-semibold text-white transition-colors hover:bg-white/5"
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Change Password
          </button>
          <button
            type="button"
            onClick={() => setConfirmOut(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-dark to-brand-light px-4 text-xs font-semibold text-white active:scale-95"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Logout
          </button>
        </section>
      </main>

      {editing && (
        <ConfirmDialog
          title="Edit profile"
          description="Your role, team ID and email are managed by your administrator."
          confirmLabel="Save changes"
          onConfirm={() => {
            updateMember({ name: name.trim() || member?.name });
            setEditing(false);
            toast.success("Profile updated.");
          }}
          onClose={() => setEditing(false)}
        >
          <div className="mt-4">
            <label htmlFor="edit-name" className="text-[11px] font-semibold text-text-secondary">
              Display name
            </label>
            <input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-border-subtle bg-surface-2 px-3 text-sm text-white focus:border-brand/50"
            />
          </div>
        </ConfirmDialog>
      )}

      {confirmOut && (
        <ConfirmDialog
          title="Log out of the team panel?"
          description="You will need your administrator issued credentials to sign in again."
          confirmLabel="Log out"
          tone="danger"
          onConfirm={() => {
            setConfirmOut(false);
            signOut();
            navigate({ to: "/team/login", replace: true });
          }}
          onClose={() => setConfirmOut(false)}
        />
      )}
    </>
  );
}
