import { useState, useEffect } from "react";
import logoAsset from "@/assets/logo.png.asset.json";
import { isCapacitor } from "@/lib/fcm";

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // 1. Immediately hide native Capacitor splash screen when web app mounts
    if (isCapacitor()) {
      import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => {
          SplashScreen.hide().catch(() => {});
        })
        .catch(() => {});
    }

    // 2. Only show splash screen once per session on mobile to prevent delays on navigation
    const isMobile = window.innerWidth < 768 || isCapacitor();
    const hasSeenSplash = typeof sessionStorage !== "undefined" && sessionStorage.getItem("formbhro:splash_dismissed");

    if (isMobile && !hasSeenSplash) {
      setIsVisible(true);
      sessionStorage.setItem("formbhro:splash_dismissed", "true");

      // Start fade out after 1.2s
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
      }, 1200);

      // Remove from DOM after fade completes (300ms fade)
      const removeTimer = setTimeout(() => {
        setIsVisible(false);
      }, 1500);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505] overflow-hidden pointer-events-none"
      style={{
        opacity: isFading ? 0 : 1,
        transition: "opacity 300ms ease-out",
      }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-brand/10 blur-[80px]" />
      </div>

      <div className="relative w-full h-full flex flex-col items-center justify-center">
        <img
          src={logoAsset.url}
          alt="Formbhro"
          className="w-44 h-auto mb-6 relative z-10"
          style={{ animation: "splashPulse 1.5s ease-in-out infinite" }}
        />

        {/* Loading bar */}
        <div className="flex flex-col items-center gap-3 z-10 px-10 max-w-[240px]">
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-brand shadow-[0_0_12px_var(--color-brand)] will-change-transform"
              style={{ animation: "loadingBar 1.2s ease-in-out forwards" }}
            />
          </div>
          <span className="text-brand font-bold text-[10px] tracking-[0.2em] uppercase">Loading...</span>
        </div>
      </div>

      <style>{`
        @keyframes loadingBar {
          0%   { width: 0%;   opacity: 0.6; }
          60%  { width: 80%;  opacity: 1;   }
          100% { width: 100%; opacity: 1;   }
        }
        @keyframes splashPulse {
          0%, 100% { opacity: 1;   transform: scale(1);    }
          50%       { opacity: 0.8; transform: scale(0.97); }
        }
      `}</style>
    </div>
  );
}
