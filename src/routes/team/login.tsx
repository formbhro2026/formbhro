import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Info, Lock, ShieldCheck } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { useTeamStore } from "@/lib/team-store";

function TeamLogin() {
  const { signInWithCode, member, hydrated } = useTeamStore();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (hydrated && member) navigate({ to: "/team", replace: true });
  }, [hydrated, member, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!code.trim()) {
      setError("Please enter your team access code.");
      return;
    }
    setBusy(true);
    const res = await signInWithCode(code.trim().toUpperCase(), remember);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Invalid access code.");
      return;
    }
    setError(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 py-10 text-white antialiased">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <img src={logoAsset.url} alt="Formbhro" width={140} height={40} className="h-8 w-auto" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff7a00]/40 bg-[#ff7a00]/10 px-2.5 py-1 text-[11px] font-semibold text-[#ff7a00]">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Team Panel
          </span>
          <h1 className="mt-3 text-xl font-bold text-white">Access Workspace</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Enter the special team code issued by your administrator to access the panel.
          </p>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4" noValidate>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-400"
              >
                {notice}
              </p>
            )}

            <div>
              <label
                htmlFor="team-code"
                className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider"
              >
                Team Access Code
              </label>
              <div className="relative mt-1.5">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                  aria-hidden="true"
                />
                <input
                  id="team-code"
                  type="text"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="FBH-XXXXXX"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#ff7a00]/50 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#ff7a00]"
                />
                Keep me signed in
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-xl bg-gradient-to-r from-[#ff7a00]/80 to-[#ff7a00] text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(255,122,0,0.3)]"
            >
              {busy ? "Verifying..." : "Enter Workspace"}
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Only authorized team members can access this area. If you don't have a code, contact
              your supervisor.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() =>
              setNotice(
                "Please contact your administrator to receive your special team access code.",
              )
            }
            className="text-[11px] font-medium text-zinc-500 hover:text-[#ff7a00] transition-colors"
          >
            Need help accessing your account?
          </button>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/team/login")({
  ssr: false,
  component: TeamLogin,
  head: () => ({
    meta: [
      { title: "Team Sign In — Formbhro" },
      {
        name: "description",
        content:
          "Formbhro team members sign in with the credentials issued by their administrator.",
      },
      { property: "og:title", content: "Team Sign In — Formbhro" },
      { property: "og:description", content: "Secure sign in for Formbhro support team members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});


