import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, ShieldCheck, User, Users } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { useAdmin } from "@/lib/admin-store";
import { Button, Field, inputClass } from "@/components/admin/AdminUI";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  component: AdminLogin,
  head: () => ({
    meta: [
      { title: "Admin Console Sign In — Formbhro" },
      { name: "robots", content: "noindex" },
    ],
  }),
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

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      void navigate({ to: "/" });
    }
  };

  const handleClearSession = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("formbhro:last_workspace");
      localStorage.removeItem("formbhro:redirect");
      sessionStorage.clear();
    } catch (_) {}
    setError(null);
    void navigate({ to: "/auth" });
  };

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
    localStorage.setItem("formbhro:last_workspace", "admin");
    navigate({ to: "/admin", replace: true });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10 text-white antialiased">
      {/* Top Navigation */}
      <div className="absolute top-5 left-4 right-4 max-w-sm mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <Link
          to="/"
          className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          Home
        </Link>
      </div>

      <div className="w-full max-w-sm pt-6">
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
              <p
                role="alert"
                className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-[11px] text-red-300"
              >
                {error}
              </p>
            )}

            <Field label="Username">
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                  aria-hidden="true"
                />
                <input
                  className={`${inputClass} pl-9`}
                  value={username}
                  autoComplete="username"
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                />
              </div>
            </Field>

            <Field label="Password">
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                  aria-hidden="true"
                />
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
                  {show ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </Field>

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {/* Quick Portal Switcher */}
          <div className="mt-6 border-t border-white/5 pt-5 space-y-2.5">
            <div className="text-[11px] font-medium text-text-muted text-center">
              Looking for a different portal?
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/auth"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-brand/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5 text-brand" />
                User Login
              </Link>
              <Link
                to="/team/login"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:border-[#ff7a00]/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Users className="h-3.5 w-3.5 text-[#ff7a00]" />
                Team Login
              </Link>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => void handleClearSession()}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 underline transition-colors cursor-pointer"
              >
                Reset session & switch account
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
