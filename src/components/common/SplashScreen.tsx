import { useState, useEffect } from "react";
import logoAsset from "@/assets/logo.png.asset.json";
import { isCapacitor } from "@/lib/fcm";

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(false);

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
    const isMobile = window.innerWidth < 768;
    const hasSeenSplash = typeof sessionStorage !== "undefined" && sessionStorage.getItem("formbhro:splash_dismissed");

    if (isMobile && !hasSeenSplash) {
      setIsVisible(true);
      sessionStorage.setItem("formbhro:splash_dismissed", "true");

      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505] overflow-hidden pointer-events-none transition-opacity duration-300">
      {/* Background/Logo matching the splash reference */}
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        <img 
          src={logoAsset.url} 
          alt="Formbhro" 
          className="w-44 h-auto mb-6 relative z-10 animate-pulse"
        />

        {/* Quick loading bar */}
        <div className="flex flex-col items-center gap-3 z-10 px-10 max-w-[240px]">
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-brand animate-[loading_0.5s_ease-in-out_forwards] shadow-[0_0_12px_var(--color-brand)] will-change-transform" />
          </div>
          <span className="text-brand font-bold text-[10px] tracking-[0.2em] uppercase">Loading...</span>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { width: 0%; opacity: 0.5; }
          50% { width: 70%; opacity: 1; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
