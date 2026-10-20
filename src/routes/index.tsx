import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isCapacitor } from "@/lib/fcm";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { Stats } from "@/components/Stats";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
  head: () => ({
    meta: [
      { title: "Formbhro — Forms Made Simple. Assistance Made Personal." },
      {
        name: "description",
        content:
          "Formbhro is a smart form assistance platform that connects you with experts, simplifies processes, and tracks your application in real time.",
      },
      { property: "og:title", content: "Formbhro — Smart Form Assistance Platform" },
      {
        property: "og:description",
        content:
          "Get expert help with your forms, share documents securely, and track your application in real time.",
      },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // If arriving on root route with OAuth tokens or code, forward to /auth so handoff to APK occurs
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      if (
        hash.includes("access_token=") ||
        search.includes("access_token=") ||
        hash.includes("code=") ||
        search.includes("code=")
      ) {
        window.location.href = `/auth${search}${hash}`;
        return;
      }
    }

    const lastWorkspace =
      typeof window !== "undefined" ? localStorage.getItem("formbhro:last_workspace") : null;
    let target = "/app";
    if (lastWorkspace === "team") target = "/team/work";
    else if (lastWorkspace === "admin") target = "/admin";

    if (isCapacitor()) {
      void navigate({ to: target as "/app" | "/team/work" | "/admin", replace: true });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void navigate({ to: target as "/app" | "/team/work" | "/admin", replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen scroll-smooth bg-bg text-text antialiased selection:bg-brand/30 selection:text-white dark">
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <div className="cv-auto bg-surface-1/50">
          <HowItWorks />
        </div>
        <div className="cv-auto">
          <Features />
        </div>
        <div className="cv-auto bg-surface-1/50">
          <Stats />
        </div>
        <div className="cv-auto">
          <CTASection />
        </div>
      </main>
      <Footer />
    </div>
  );
}
