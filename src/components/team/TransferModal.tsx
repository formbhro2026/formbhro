import { useState, useEffect } from "react";
import { X, ArrowRightLeft, User, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { getActiveTeamMembers } from "@/lib/api/requests";
import { useTeamStore } from "@/lib/team-store";
import type { TeamRequest } from "@/data/team-module";

export function TransferButton({ request }: { request: TeamRequest }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const { transferChat } = useTeamStore();

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError("");
      getActiveTeamMembers()
        .then((data) => {
          setMembers(data);
          if (data.length > 0) setSelectedId(data[0].id);
        })
        .catch(() => setError("Failed to load active team members."))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleTransfer = async () => {
    if (!selectedId) return;
    setTransferring(true);
    setError("");
    try {
      await transferChat(request.id, selectedId);
      setOpen(false);
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Failed to transfer chat.");
      setTransferring(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Transfer Chat"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors"
      >
        <ArrowRightLeft className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface-2 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Transfer Chat</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-white"
                disabled={transferring}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-sm text-text-muted">
              Select a team member to transfer <strong>{request.id.slice(0, 8)}</strong> to. You
              will immediately lose access.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            ) : members.length === 0 ? (
              <div className="mb-4 text-sm text-text-muted italic">
                No other active team members available to transfer to.
              </div>
            ) : (
              <div className="mb-4 space-y-2 max-h-48 overflow-y-auto pr-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedId === m.id
                        ? "border-brand bg-brand/10"
                        : "border-border-subtle bg-surface-1 hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-3">
                      <User className="h-4 w-4 text-text-muted" />
                    </div>
                    <span className="text-sm font-semibold text-white">{m.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                disabled={transferring}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!selectedId || transferring || loading}
                className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-50"
              >
                {transferring && <Loader2 className="h-4 w-4 animate-spin" />}
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Escalate button — shown in the conversation toolbar for the assigned Team Member. */
export function EscalateButton({ request }: { request: TeamRequest }) {
  const [open, setOpen] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [done, setDone] = useState(request.isEscalated);
  const [error, setError] = useState("");
  const { escalateChat } = useTeamStore();

  // Sync external isEscalated changes (e.g. realtime UPDATE eviction reversal)
  if (request.isEscalated !== done && !escalating) {
    setDone(request.isEscalated);
  }

  const handleEscalate = async () => {
    setEscalating(true);
    setError("");
    try {
      await escalateChat(request.id);
      setDone(true);
      setOpen(false);
    } catch (err) {
      const e = err as Error;
      setError(e.message || "Failed to escalate.");
      setEscalating(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (done ? undefined : setOpen(true))}
        title={done ? "Escalated to Admin" : "Escalate to Admin"}
        aria-pressed={done}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
          done
            ? "border-amber-500/50 bg-amber-500/10 text-amber-400 cursor-default"
            : "border-white/10 text-white hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
        }`}
      >
        <AlertTriangle className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface-2 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Escalate to Admin
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-white"
                disabled={escalating}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-sm text-text-muted">
              Flag <strong>{request.id.slice(0, 8)}</strong> for Admin attention. You will remain
              assigned until an Admin takes over. This action is logged.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-500 border border-red-500/20">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
                disabled={escalating}
              >
                Cancel
              </button>
              <button
                onClick={handleEscalate}
                disabled={escalating}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {escalating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Confirm Escalation
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
