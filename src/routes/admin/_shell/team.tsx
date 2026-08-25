import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { useAdmin } from "@/lib/admin-store";
import { Button, EmptyRow, Field, Panel, Pill, SearchBox, TableWrap, formatDate, inputClass } from "@/components/admin/AdminUI";
import {
  createTeamMember,
  deleteTeamMember,
  resetTeamPassword,
  setTeamMemberActive,
  updateTeamMember,
  assignRequestToTeam,
} from "@/lib/api/admin.functions";

export const Route = createFileRoute("/admin/_shell/team")({ component: AdminTeam });

const BLANK = {
  full_name: "",
  email: "",
  phone: "",
  avatar_url: "",
  password: "FBH-Team@2026",
  job_title: "Support Executive",
  role: "team" as "team" | "admin",
  active: true,
};


function AdminTeam() {
  const { team, profiles, requests, refresh, profileOf } = useAdmin();
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ ...BLANK });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return team
      .map((t) => ({ member: t, profile: profiles.find((p) => p.id === t.id) }))
      .filter(({ member, profile }) => {
        if (!term) return true;
        return (
          (profile?.full_name ?? "").toLowerCase().includes(term) ||
          (profile?.email ?? "").toLowerCase().includes(term) ||
          member.job_title.toLowerCase().includes(term) ||
          member.team_code.toLowerCase().includes(term)
        );
      });
  }, [team, profiles, q]);

  const detail = team.find((t) => t.id === selected) ?? null;
  const detailProfile = profileOf(detail?.id);
  const detailRequests = requests.filter((r) => r.assigned_team_id === detail?.id);
  const unassigned = requests.filter((r) => !r.assigned_team_id && !["completed", "cancelled"].includes(r.status));

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await refresh();
      setMsg({ tone: "ok", text: ok });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Action failed" });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await createTeamMember({ data: { ...form, phone: form.phone || undefined, avatar_url: form.avatar_url || undefined } });
      setForm({ ...BLANK });
      setShowForm(false);
    }, "Team member created. Share their special access code for them to sign in.");
  };

  return (
    <div className="space-y-4">
      {msg && (
        <p
          role="status"
          className={`rounded-xl border px-3 py-2 text-[11px] ${
            msg.tone === "ok" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-red-400/30 bg-red-400/10 text-red-300"
          }`}
        >
          {msg.text}
        </p>
      )}

      <Panel
        title={`Team members (${team.length})`}
        action={
          <Button onClick={() => setShowForm((s) => !s)}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> {showForm ? "Cancel" : "Add member"}
          </Button>
        }
      >
        {showForm && (
          <form onSubmit={(e) => void submit(e)} className="mb-4 grid gap-3 rounded-xl border border-border-subtle bg-bg p-3 sm:grid-cols-2">
            <Field label="Full name">
              <input required className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Photo URL">
              <input className={inputClass} value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
            </Field>
            <Field label="Password (Default for new members)">
              <input required minLength={8} type="text" className={`${inputClass} font-mono text-brand-light opacity-80`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>

            <Field label="Department / job title">
              <input className={inputClass} value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
            </Field>
            <Field label="Role">
              <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "team" | "admin" })}>
                <option value="team">Team</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={form.active ? "active" : "suspended"} onChange={(e) => setForm({ ...form, active: e.target.value === "active" })}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create team member"}
              </Button>
            </div>
          </form>
        )}

        <div className="mb-3">
          <SearchBox value={q} onChange={setQ} label="Search team" placeholder="Name, email, code…" />
        </div>

        <TableWrap>
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Department</th>
              <th className="px-3 py-2 font-medium">Assigned</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, profile }) => {
              const mine = requests.filter((r) => r.assigned_team_id === member.id);
              return (
                <tr key={member.id} className="border-t border-border-subtle/50">
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => setSelected(member.id)} className="text-left text-xs font-semibold text-white hover:text-brand-light">
                      {profile?.full_name || "Unnamed"}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-[#ff7a00] bg-[#ff7a00]/10 border border-[#ff7a00]/20 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(255,122,0,0.1)]">
                        {member.team_code}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(member.team_code);
                          const btn = e.currentTarget;
                          const oldText = btn.innerText;
                          btn.innerText = "Copied!";
                          setTimeout(() => { btn.innerText = oldText; }, 2000);
                        }}
                        className="text-[9px] font-medium text-text-muted hover:text-brand-light transition-colors px-1.5 py-0.5 bg-surface-2 rounded border border-border-subtle"
                        title="Copy Code"
                      >
                        Copy
                      </button>
                      <span className="text-[10px] text-text-muted">·</span>
                      <span className="text-[10px] text-text-muted font-mono">{profile?.email}</span>

                    </div>

                  </td>
                  <td className="px-3 py-2.5 text-text-secondary">{member.job_title}</td>
                  <td className="px-3 py-2.5 text-text-secondary">
                    {mine.length} · {mine.filter((r) => r.status === "completed").length} done
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill tone={member.is_active ? "ok" : "bad"}>{member.is_active ? "Active" : "Suspended"}</Pill>
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">{formatDate(member.created_at)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" onClick={() => setSelected(member.id)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <EmptyRow colSpan={6} text="No team members yet." />}
          </tbody>
        </TableWrap>
      </Panel>

      {detail && detailProfile && (
        <Panel
          title={`Team profile — ${detailProfile.full_name}`}
          action={
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          }
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 rounded-xl border border-border-subtle bg-bg p-3 text-xs">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Team Access Code</p>
                <div className="mt-1.5 flex items-center justify-between rounded-lg border border-[#ff7a00]/20 bg-[#ff7a00]/5 p-2 font-mono text-[11px]">
                  <span className="text-[#ff7a00] font-bold">{detail.team_code}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(detail.team_code);
                      alert("Code copied to clipboard!");
                    }}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-[#ff7a00]/10 hover:bg-[#ff7a00]/20 text-[#ff7a00]"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <p className="text-text-secondary">Phone: {detailProfile.phone ?? "—"}</p>
                <p className="text-text-secondary">Department: {detail.job_title}</p>
                <p className="text-text-secondary">Code: {detail.team_code}</p>
                <p className="text-text-secondary">Joined: {formatDate(detail.created_at)}</p>
              </div>
              <p className="text-text-secondary">
                Completion rate:{" "}
                {detailRequests.length
                  ? Math.round((detailRequests.filter((r) => r.status === "completed").length / detailRequests.length) * 100)
                  : 0}
                %
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant={detail.is_active ? "danger" : "primary"}
                  disabled={busy}
                  onClick={() => void run(() => setTeamMemberActive({ data: { id: detail.id, active: !detail.is_active } }), "Status updated.")}
                >
                  {detail.is_active ? "Suspend" : "Activate"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    const pwd = window.prompt("New password (min 8 characters)");
                    if (pwd) void run(() => resetTeamPassword({ data: { id: detail.id, password: pwd } }), "Password reset.");
                  }}
                >
                  Reset password
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    const title = window.prompt("Department / job title", detail.job_title);
                    if (title) void run(() => updateTeamMember({ data: { id: detail.id, job_title: title } }), "Team member updated.");
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("Delete this team member? Their requests will be unassigned.")) {
                      void run(() => deleteTeamMember({ data: { id: detail.id } }), "Team member removed.");
                      setSelected(null);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-xl border border-border-subtle bg-bg p-3">
                <h3 className="mb-2 text-xs font-semibold text-white">Assign a request</h3>
                <div className="flex flex-wrap gap-2">
                  <select className={`${inputClass} sm:max-w-xs`} value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Select request">
                    <option value="">Select an unassigned request…</option>
                    {unassigned.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.reference} — {r.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={!assignTo || busy}
                    onClick={() =>
                      void run(async () => {
                        await assignRequestToTeam({ data: { request_id: assignTo, team_member_id: detail.id } });
                        setAssignTo("");
                      }, "Request assigned.")
                    }
                  >
                    Assign
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-white">Assigned requests ({detailRequests.length})</h3>
                <ul className="space-y-2">
                  {detailRequests.map((r) => (
                    <li key={r.id} className="rounded-xl border border-border-subtle bg-bg px-3 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-white">{r.title}</span>
                        <Pill tone={r.status === "completed" ? "ok" : "brand"}>{r.status}</Pill>
                      </div>
                      <p className="mt-1 text-[11px] text-text-muted">
                        {r.reference} · {formatDate(r.last_activity_at)}
                      </p>
                    </li>
                  ))}
                  {!detailRequests.length && <li className="py-6 text-center text-xs text-text-muted">Nothing assigned yet.</li>}
                </ul>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
