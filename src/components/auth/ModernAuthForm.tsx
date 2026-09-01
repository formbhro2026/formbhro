import { useState } from "react";
import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo.png.asset.json";
import { ShieldCheck, Smartphone, Zap, Loader2, ArrowLeft, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle, signUpWithEmail } from "@/lib/api/auth";
import { isCapacitor } from "@/lib/fcm";

type AuthMode = "login" | "signup" | "otp";

export function ModernAuthForm({
  onSuccess,
  isLoading: externalLoading,
}: {
  onSuccess?: () => void;
  isLoading?: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isReadingOtp, setIsReadingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await signInWithGoogle();
      if (
        res &&
        ("user" in res ||
          "session" in res ||
          (res as any)?.data?.user ||
          (res as any)?.data?.session)
      ) {
        onSuccess?.();
      }
    } catch (err) {
      console.error("[ModernAuthForm] Google Sign In error:", err);
      setError(err instanceof Error ? err.message : "Google sign in failed. Please try again.");
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (mode === "login") {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (authError) {
          if (authError.message.toLowerCase().includes("invalid login credentials")) {
            setError(
              "Invalid email or password. If you registered using Google, please use 'Sign in with Google' above. If you just signed up with email, please check your inbox for confirmation.",
            );
          } else {
            setError(authError.message);
          }
          return;
        }

        if (data?.user) {
          // Check role for redirection
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id);

          const roleList = (roles ?? []).map((r) => r.role);
          let dest = "/app";
          if (roleList.includes("admin")) dest = "/admin";
          else if (roleList.includes("team")) dest = "/team";

          if (onSuccess) {
            onSuccess();
          } else {
            window.location.href = dest;
          }
        }
      } else if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role: "user",
            },
          },
        });

        if (authError) {
          setError(authError.message);
          return;
        }

        if (data?.session) {
          setSuccessMessage("Account created successfully!");
          onSuccess?.();
        } else if (data?.user) {
          setMode("login");
          setSuccessMessage("Account created successfully! Please sign in with your email and password.");
        }
      }
    } catch (e) {
      console.error("[ModernAuthForm] Error:", e);
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string[]) => {
    const code = codeToVerify || otp;
    if (code.some((d) => !d)) return;

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    onSuccess?.();
    setIsSubmitting(false);
  };

  const isLoading = externalLoading || isSubmitting;

  return (
    <div className="w-full max-w-[420px] px-4">
      <div className="mb-10 flex flex-col items-center text-center">
        <img src={logoAsset.url} alt="Formbhro" className="h-14 w-auto mb-2" />
        <p className="text-gray-500 text-sm font-medium">Haryana का No.1 Digital CSC</p>
      </div>

      <div className="relative rounded-[32px] border border-gray-100 bg-white p-8 shadow-2xl">
        {mode === "login" ? (
          <div key="login" className="relative">
            <div className="mb-8 text-center">
              <h3 className="text-xl font-bold text-gray-900">Welcome Back</h3>
              <p className="text-gray-500 text-sm mt-1">Sign in to your Formbhro account</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white py-4 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98] shadow-sm mb-8 disabled:opacity-70 cursor-pointer"
            >
              {isGoogleSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              ) : (
                <>
                  <img src="/google.svg" alt="Google" className="h-5 w-5" />
                  Sign in with Google
                </>
              )}
            </button>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                <span className="bg-white px-4 text-gray-400">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-4 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                  required
                />
              </div>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-4 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full cursor-pointer rounded-2xl bg-brand py-4 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-brand/20 flex items-center justify-center"
              >
                {isSubmitting || isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Don't have an account?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="font-bold text-brand hover:underline"
                >
                  Sign Up
                </button>
              </p>
            </div>

            {error && <p className="mt-4 text-center text-xs font-medium text-red-500">{error}</p>}
            {successMessage && (
              <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-50 p-3 text-center text-xs font-medium text-emerald-700">
                {successMessage}
              </p>
            )}

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/5 text-brand">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <span className="text-sm font-bold text-gray-900">Secure</span>
                <span className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wider">
                  Encrypted
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/5 text-brand">
                  <Zap className="h-6 w-6" />
                </div>
                <span className="text-sm font-bold text-gray-900">Quick</span>
                <span className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wider">
                  Verified
                </span>
              </div>
            </div>
          </div>
        ) : mode === "signup" ? (
          <div key="signup" className="relative">
            <div className="mb-8 text-center">
              <h3 className="text-xl font-bold text-gray-900">Create Account</h3>
              <p className="text-gray-500 text-sm mt-1">Join Haryana's No.1 Digital CSC</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white py-4 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98] shadow-sm mb-8 disabled:opacity-70 cursor-pointer"
            >
              {isGoogleSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              ) : (
                <>
                  <img src="/google.svg" alt="Google" className="h-5 w-5" />
                  Sign up with Google
                </>
              )}
            </button>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100"></div>
              </div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                <span className="bg-white px-4 text-gray-400">Or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-4 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                  required
                />
              </div>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-4 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                  required
                />
              </div>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-4 pl-12 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-2xl bg-brand py-4 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-brand/20"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Sign Up"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="font-bold text-brand hover:underline"
                >
                  Sign In
                </button>
              </p>
            </div>

            {error && <p className="mt-4 text-center text-xs font-medium text-red-500">{error}</p>}
            {successMessage && (
              <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-50 p-3 text-center text-xs font-medium text-emerald-700">
                {successMessage}
              </p>
            )}

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/5 text-brand">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <span className="text-sm font-bold text-gray-900">Secure</span>
                <span className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wider">
                  Encrypted
                </span>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/5 text-brand">
                  <Zap className="h-6 w-6" />
                </div>
                <span className="text-sm font-bold text-gray-900">Quick</span>
                <span className="text-[10px] font-medium text-gray-400 mt-1 uppercase tracking-wider">
                  Verified
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 text-center">
            <button
              onClick={() => setMode("login")}
              className="absolute left-6 top-6 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900">Verify OTP</h3>
              <p className="text-gray-500 text-sm mt-1">We sent a code to {phone}</p>
            </div>

            <div className="mb-8 flex justify-between gap-2">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  className="h-12 w-10 sm:h-14 sm:w-12 rounded-2xl border border-gray-100 bg-gray-50 text-center text-xl font-bold text-gray-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                />
              ))}
            </div>

            <p className="mb-8 text-sm font-medium text-gray-400">
              Didn't receive code?{" "}
              <button className="font-bold text-brand hover:underline">Resend</button>
            </p>

            <button
              onClick={() => handleVerifyOtp()}
              disabled={isLoading || otp.some((d) => !d)}
              className="w-full rounded-2xl bg-brand py-4 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:opacity-70 shadow-lg shadow-brand/20"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "Verify & Continue"
              )}
            </button>

            <div
              className={`mt-6 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider py-2 rounded-xl transition-colors ${isReadingOtp ? "bg-brand/5 text-brand animate-pulse" : "bg-emerald-50 text-emerald-500"}`}
            >
              {isReadingOtp ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Smartphone className="h-3 w-3" />
              )}
              {isReadingOtp ? "Waiting for OTP..." : "Verified automatically"}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        <div className="flex gap-4">
          <Link to="/admin/login" className="text-brand hover:underline">
            Admin Login
          </Link>
          <span className="text-gray-100">|</span>
          <Link to="/team/login" className="hover:text-gray-900 transition-colors">
            Team Login
          </Link>
          <span className="text-gray-100">|</span>
          <Link to="/privacy" className="hover:text-gray-900 transition-colors">
            Privacy Policy
          </Link>
          <span className="text-gray-100">|</span>
          <Link to="/help" className="hover:text-gray-900 transition-colors">
            Help
          </Link>
        </div>
        <p className="text-gray-300">© 2026 Formbhro. Haryana's No.1 Digital CSC.</p>
      </div>
    </div>
  );
}
