import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { isCapacitor } from "@/lib/fcm";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { Stats } from "@/components/Stats";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/")({
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
        content: "Get expert help with your forms, share documents securely, and track your application in real time.",
      },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isCapacitor()) {
      void navigate({ to: "/app", replace: true });
    }
  }, [navigate]);

  if (typeof window !== "undefined" && isCapacitor()) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen scroll-smooth bg-bg text-text antialiased selection:bg-brand/30 selection:text-white dark">
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Hero />
        <div className="cv-auto bg-surface-1/50"><HowItWorks /></div>
        <div className="cv-auto"><Features /></div>
        <div className="cv-auto bg-surface-1/50"><Stats /></div>
        <div className="cv-auto"><CTASection /></div>
      </main>
      <Footer />
    </div>
  );
}
