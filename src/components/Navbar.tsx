import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Logo } from "./Logo";
import { NAV_LINKS } from "@/data/landing";

const SECTION_IDS = NAV_LINKS.map((l) => l.href.replace("#", ""));

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(SECTION_IDS[0]);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy: highlight the section currently in view
  useEffect(() => {
    const elements = SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;

    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target.id, entry.intersectionRatio);
        }
        let bestId = activeId;
        let bestRatio = 0;
        for (const [id, ratio] of visibility) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestRatio > 0) setActiveId(bestId);
      },
      {
        rootMargin: "-96px 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );
    elements.forEach((el) => observer.observe(el));

    // Bottom-of-page: force last section active
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 4) {
        setActiveId(SECTION_IDS[SECTION_IDS.length - 1]);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mobilePanelRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape handling for the mobile menu.
  useEffect(() => {
    if (!open) return;
    const panel = mobilePanelRef.current;
    const getFocusable = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null)
        : [];

    firstMobileLinkRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Restore focus to the toggle button whenever the menu closes.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      toggleRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  const closeMenu = useCallback(() => setOpen(false), []);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      const id = href.startsWith("#") ? href.slice(1) : "";
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      e.preventDefault();
      const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", href);
      setActiveId(id);
      setOpen(false);
    },
    []
  );


  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-black/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Logo />

        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((l) => {
            const id = l.href.replace("#", "");
            const isActive = id === activeId;
            return (
              <li key={l.label}>
                <a
                  href={l.href}
                  onClick={(e) => handleNavClick(e, l.href)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative rounded-sm text-sm font-medium transition-colors hover:text-white ${
                    isActive ? "text-white" : "text-text-secondary"
                  }`}
                >
                  {l.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-brand"
                    />
                  )}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            to="/app"
            search={{ fill: true }}
            aria-label="Fill Now — start a new request"
            className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-brand-dark to-brand-light px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_24px_-6px_rgba(255,122,0,0.55)] transition-transform hover:scale-[1.02] active:scale-95 sm:inline-flex"
          >
            Fill Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <button
            ref={toggleRef}
            type="button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 text-white hover:bg-white/5 lg:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        ref={mobilePanelRef}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        className="border-t border-white/10 bg-black/95 backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
          {NAV_LINKS.map((l, i) => {
            const id = l.href.replace("#", "");
            const isActive = id === activeId;
            return (
              <li key={l.label}>
                <a
                  ref={i === 0 ? firstMobileLinkRef : undefined}
                  href={l.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={(e) => {
                    handleNavClick(e, l.href);
                    closeMenu();
                  }}
                  className={`block rounded-lg px-3 py-3 text-sm font-medium ${
                    isActive
                      ? "bg-white/5 text-white"
                      : "text-text-secondary hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {l.label}
                </a>
              </li>
            );
          })}
          <li className="mt-2">
            <Link
              to="/app"
              search={{ fill: true }}
              onClick={closeMenu}
              aria-label="Fill Now — start a new request"
              className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-dark to-brand-light px-5 py-3 text-sm font-semibold text-white"
            >
              Fill Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

          </li>
        </ul>
      </div>
    </header>
  );
}

