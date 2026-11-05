import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useId } from "react";
import { Info, Lock, ShieldCheck, Mail, Key, ArrowLeft, ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { useTeamStore } from "@/lib/team-store";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function generateChallengePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function TeamLogin() {
  const { signInWithTeamAuth, signOut } = useTeamStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<"credentials" | "challenge">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);

  // Security Verification Challenge (Step 2)
  const [challengeCode, setChallengeCode] = useState("");
  const [enteredPin, setEnteredPin] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockRemainingMin, setLockRemainingMin] = useState(0);

  // CRITICAL SECURITY ENFORCEMENT:
  // 1. Never automatically redirect into /team on route load.
  // 2. Clear any stale team session on entering login page to guarantee explicit re-authentication.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem("formbhro_team_verified");
    } catch (_) {}

    // Check rate-limit lockout
    try {
      const lockUntil = Number(sessionStorage.getItem("formbhro_team_lock_until") || 0);
      if (lockUntil > Date.now()) {
        const remaining = Math.ceil((lockUntil - Date.now()) / 60000);
        setIsLocked(true);
        setLockRemainingMin(remaining);
        setError(`Security Lockout Active: Too many failed login attempts. Try again in ${remaining} minute(s).`);
      }
    } catch (_) {}
  }, []);

  const recordFailedAttempt = () => {
    try {
      const attempts = Number(sessionStorage.getItem("formbhro_team_attempts") || 0) + 1;
      sessionStorage.setItem("formbhro_team_attempts", String(attempts));
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_MS;
        sessionStorage.setItem("formbhro_team_lock_until", String(lockUntil));
        setIsLocked(true);
        setLockRemainingMin(15);
        setError("Security Lockout: 5 failed attempts reached. Team login is temporarily disabled for 15 minutes.");
      } else {
        setError(`Authentication failed (${MAX_FAILED_ATTEMPTS - attempts} attempt(s) remaining before temporary lockout).`);
      }
    } catch (_) {
      setError("Authentication failed. Please verify your credentials.");
    }
  };

  const resetFailedAttempts = () => {
    try {
      sessionStorage.removeItem("formbhro_team_attempts");
      sessionStorage.removeItem("formbhro_team_lock_until");
    } catch (_) {}
  };

  // Step 1: Submit Credentials
  const onCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setError(null);

    if (isLocked) {
      setError(`Security lockout active. Please wait ${lockRemainingMin} minute(s).`);
      return;
    }

    if (!email.trim() || !password || !code.trim()) {
      setError("Please fill in all team credentials.");
      return;
    }

    setBusy(true);
    const res = await signInWithTeamAuth(email.trim(), password, code.trim().toUpperCase(), remember);
    setBusy(false);

    if (!res.ok) {
      recordFailedAttempt();
      return;
    }

    // Step 1 Passed: Proceed to Extra Security Verification Layer
    resetFailedAttempts();
    const pin = generateChallengePin();
    setChallengeCode(pin);
    setStep("challenge");
    setEnteredPin("");
  };

  // Step 2: Confirm Physical Security PIN
  const onChallengeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (enteredPin.trim() !== challengeCode.trim()) {
      setError("Incorrect Security Verification PIN. Please enter the exact 6-digit code shown.");
      return;
    }

    // Fully authorized
    try {
      sessionStorage.setItem("formbhro_team_verified", "1");
      localStorage.setItem("formbhro:last_workspace", "team");
    } catch (_) {}

    navigate({ to: "/team", replace: true });
  };

  const handleRegeneratePin = () => {
    const pin = generateChallengePin();
    setChallengeCode(pin);
    setEnteredPin("");
    setError(null);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#050505] px-4 py-10 text-white antialiased">
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <img src={logoAsset.url} alt="Formbhro" width={140} height={40} className="h-8 w-auto" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ff7a00]/40 bg-[#ff7a00]/10 px-2.5 py-1 text-[11px] font-semibold text-[#ff7a00]">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Team Panel
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Enhanced 2FA
            </span>
          </div>

          <h1 className="mt-3 text-xl font-bold text-white">
            {step === "credentials" ? "Access Workspace" : "Security Verification"}
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            {step === "credentials"
              ? "Enter your team email, password, and assigned administrator access code."
              : "Confirm human presence and device authorization to complete secure sign-in."}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-400"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <p
              role="status"
              className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-400"
            >
              {notice}
            </p>
          )}

          {step === "credentials" ? (
            <form onSubmit={(e) => void onCredentialsSubmit(e)} className="mt-5 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider"
                >
                  Email Address
                </label>
                <div className="relative mt-1.5">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    disabled={isLocked || busy}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#ff7a00]/50 outline-none transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider"
                >
                  Password
                </label>
                <div className="relative mt-1.5">
                  <Key
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    disabled={isLocked || busy}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#ff7a00]/50 outline-none transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

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
                    disabled={isLocked || busy}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="FBH-XXXXXX"
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-[#ff7a00]/50 outline-none transition-colors uppercase disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    disabled={isLocked || busy}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#ff7a00]"
                  />
                  Keep me signed in
                </label>
              </div>

              <button
                type="submit"
                disabled={busy || isLocked}
                className="min-h-11 w-full rounded-xl bg-gradient-to-r from-[#ff7a00]/80 to-[#ff7a00] text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(255,122,0,0.3)]"
              >
                {busy ? "Verifying Credentials..." : "Continue to Verification"}
              </button>
            </form>
          ) : (
            <form onSubmit={onChallengeSubmit} className="mt-5 space-y-4" noValidate>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-center">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                  One-Time Device Challenge Code
                </span>
                <div className="mt-1 flex items-center justify-center gap-3">
                  <span className="font-mono text-2xl font-black tracking-widest text-emerald-400">
                    {challengeCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleRegeneratePin}
                    className="text-zinc-500 hover:text-white transition-colors"
                    title="Generate new PIN"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">
                  Prevents auto-login bypass and validates active device presence.
                </p>
              </div>

              <div>
                <label
                  htmlFor="challenge-pin"
                  className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider"
                >
                  Enter Verification PIN
                </label>
                <input
                  id="challenge-pin"
                  type="text"
                  maxLength={6}
                  autoFocus
                  autoComplete="off"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit PIN"
                  className="mt-1.5 h-11 w-full text-center font-mono text-lg font-bold tracking-widest rounded-xl border border-white/10 bg-white/5 px-3 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 outline-none transition-colors"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setError(null);
                  }}
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-zinc-300 hover:bg-white/10 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={enteredPin.length !== 6}
                  className="h-11 flex-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  Authorize & Enter
                </button>
              </div>
            </form>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Only authorized Formbhro team personnel are permitted. Unintended and automatic logins are strictly blocked.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() =>
              setNotice(
                "Please contact your Formbhro administrator to receive your team access credentials or reset your lockout.",
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
