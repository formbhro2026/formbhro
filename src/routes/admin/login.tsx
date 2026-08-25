import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Info, Lock, ShieldCheck, User } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { useAdmin } from "@/lib/admin-store";
import { Button, Field, inputClass } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  component: AdminLogin,
});

function AdminLogin() {
  const { signIn, authed, ready } = useAdmin();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && authed) navigate({ to: "/admin", replace: true });
  }, [ready, authed, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn(username, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Sign in failed.");
      return;
    }
    navigate({ to: "/admin", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-white antialiased">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <img src={logoAsset.url} alt="Formbhro" width={140} height={40} className="h-8 w-auto" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-surface-1 p-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand-light">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Super Admin
          </span>
          <h1 className="mt-3 text-xl font-bold">Admin console sign in</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
            Restricted access. Every action is logged in the activity trail.
          </p>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4" noValidate>
            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-[11px] text-red-300">
                {error}
              </p>
            )}

            <Field label="Username">
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  className={`${inputClass} pl-9`}
                  value={username}
                  autoComplete="username"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                />
              </div>
            </Field>

            <Field label="Password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
                <input
                  className={`${inputClass} pl-9 pr-10`}
                  type={show ? "text" : "password"}
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                >
                  {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </Field>

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-text-secondary">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
            Temporary credentials: <strong className="text-white">admin</strong> / <strong className="text-white">ADMIN@2026</strong>. These
            will be replaced by Supabase admin accounts.
          </p>
        </div>
      </div>
    </main>
  );
}
