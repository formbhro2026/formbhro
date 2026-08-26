import { Facebook, Instagram, Twitter, Linkedin, Phone, Mail, MapPin } from "lucide-react";
import { Logo } from "./Logo";
import { CONTACT } from "@/data/landing";
import { Link } from "@tanstack/react-router";

const platform = ["How It Works", "Features", "For Businesses", "Pricing", "Contact"];
const support = ["Help Center", "Privacy Policy", "Terms & Conditions", "Refund Policy"];

export function Footer() {
  return (
    <footer id="contact" className="scroll-mt-24 border-t border-white/10 bg-[#050505]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-text-secondary">
              Smart form assistance platform that connects you with experts, simplifies processes,
              and delivers results.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {[Facebook, Instagram, Twitter, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="Social link"
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-text-secondary transition-colors hover:border-brand/40 hover:text-brand"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <FooterCol title="Platform" items={platform} />
          <FooterCol title="Support" items={support} />

          <div>
            <h4 className="text-sm font-semibold text-text">Contact Us</h4>
            <ul className="mt-4 space-y-3 text-sm text-text-secondary">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand" /> {CONTACT.phone}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-brand" /> {CONTACT.email}
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand" /> {CONTACT.address}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-text-muted">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link to="/admin/login" className="text-text-muted hover:text-brand transition-colors">
              Admin Login
            </Link>
            <span className="text-text-muted">|</span>
            <Link to="/team/login" className="text-text-muted hover:text-brand transition-colors">
              Team Login
            </Link>
          </div>
          © 2026 Formbhro. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-text">{title}</h4>
      <ul className="mt-4 space-y-2.5 text-sm">
        {items.map((it) => (
          <li key={it}>
            <a href="#" className="text-text-secondary transition-colors hover:text-brand">
              {it}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
