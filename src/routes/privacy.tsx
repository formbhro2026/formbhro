import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  ssr: false,
  component: PrivacyPolicy,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Formbhro" },
      {
        name: "description",
        content:
          "Formbhro Privacy Policy: how we collect, use, store, and protect your personal data in accordance with the Digital Personal Data Protection Act 2023 and the Information Technology Act 2000.",
      },
    ],
  }),
});

const SECTIONS = [
  {
    title: "1. About Us & Scope",
    body: [
      "Formbhro (\"Platform\", \"we\", \"us\", \"our\") is a digital facilitation service operated from Bhubaneswar, Odisha, India. We help individuals submit government, examination, and institutional application forms through real-time expert assistance.",
      "This Privacy Policy governs the collection, use, storage, sharing, and protection of personal data provided by users (\"you\") when you access or use our website (formbhro-oa2i.vercel.app), mobile application, or any associated services.",
      "By using Formbhro you agree to this policy. If you do not agree, please refrain from using the Platform.",
    ],
  },
  {
    title: "2. Legal Basis & Compliance",
    body: [
      "We process your personal data in compliance with the Digital Personal Data Protection Act, 2023 (DPDPA) and the Information Technology Act, 2000 (IT Act) along with its allied rules and amendments.",
      "As a Data Fiduciary under the DPDPA, we collect and process personal data only for defined, lawful purposes and only with your explicit or implied consent where required.",
    ],
  },
  {
    title: "3. Categories of Data Collected",
    body: [
      "Identity Data: Full name, date of birth, gender, Aadhaar number (partially masked), PAN number, and other government identifiers you provide when filling an application.",
      "Contact Data: Email address, phone number, and residential address.",
      "Document Data: Scanned copies, photographs, or PDFs of government-issued documents (e.g., Aadhaar, marksheets, income certificates, caste certificates) that you upload to our secure Document Vault.",
      "Usage & Device Data: IP address, device model, browser type, operating system, session duration, and pages visited — collected automatically for security and analytics purposes.",
      "Communication Data: Chat messages, voice/video call recordings (where applicable), and support ticket content exchanged between you and our team members.",
    ],
  },
  {
    title: "4. Purpose of Processing",
    body: [
      "Service Delivery: Processing your form assistance requests, verifying documents, and submitting applications to the relevant government or institutional portals on your behalf.",
      "Communication: Sending you status updates, notifications, and support messages via in-app chat, email, or SMS.",
      "Security: Detecting and preventing fraud, unauthorized access, and abuse of our platform.",
      "Analytics & Improvement: Understanding how users interact with the Platform to improve our product and support quality. All analytics are aggregated and anonymised where possible.",
      "Legal Compliance: Meeting our obligations under applicable laws, including responding to lawful requests from government authorities.",
    ],
  },
  {
    title: "5. Document Vault & Storage Security",
    body: [
      "Documents uploaded by you are stored in private Supabase Storage buckets protected by Row Level Security (RLS) policies. No person — including Formbhro employees — can access your documents without an authenticated session tied to your account.",
      "Access URLs are short-lived signed URLs (typically valid for 60 minutes) generated on demand. They expire automatically and cannot be shared or accessed after expiry.",
      "We do not store raw documents in any publicly accessible location. All data is encrypted at rest using AES-256 and in transit using TLS 1.3.",
    ],
  },
  {
    title: "6. Sharing of Data",
    body: [
      "We do NOT sell, rent, or trade your personal data to any third party.",
      "Government & Institutional Portals: We share only the data strictly necessary to complete your application on official portals (e.g., NIC, exam boards, state government websites). This is done solely to fulfil the service you have requested.",
      "Service Providers: We use Supabase (database and storage), Vercel (hosting), Firebase Cloud Messaging (push notifications), and Razorpay (payment processing). Each provider processes data under strict data processing agreements and their own privacy frameworks.",
      "Legal Requirements: We may disclose data if required by law, court order, or a lawful request from a competent government authority.",
    ],
  },
  {
    title: "7. Data Retention",
    body: [
      "Account and request data is retained for a minimum of 3 years after your last interaction to comply with government record-keeping requirements and to resolve potential disputes.",
      "Document Vault: Uploaded documents are retained for 12 months from the date of upload. You may request earlier deletion by contacting us at formbhro@gmail.com.",
      "Chat and communication logs are retained for 1 year.",
      "After the retention period, data is securely deleted or anonymised.",
    ],
  },
  {
    title: "8. Your Rights Under DPDPA 2023",
    body: [
      "Right to Access: You may request a copy of the personal data we hold about you.",
      "Right to Correction: You may request that we correct inaccurate or incomplete personal data.",
      "Right to Erasure: You may request deletion of your personal data, subject to legal retention obligations.",
      "Right to Withdraw Consent: Where processing is based on consent, you may withdraw it at any time; this will not affect the lawfulness of prior processing.",
      "Right to Grievance Redressal: If you have a complaint about how we handle your data, you can contact our Grievance Officer (details in Section 11).",
      "To exercise any of these rights, email us at formbhro@gmail.com with the subject line \"DPDPA Data Request\". We will respond within 30 days.",
    ],
  },
  {
    title: "9. Cookies & Push Notifications",
    body: [
      "We use minimal first-party cookies for session management and authentication. We do not use third-party advertising cookies.",
      "Push notifications are delivered via Firebase Cloud Messaging. You can opt out by disabling notifications in your device or browser settings. Opting out will not affect your ability to use core Platform features.",
    ],
  },
  {
    title: "10. Children's Privacy",
    body: [
      "Our Platform is not directed to children under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has provided us with personal data, please contact us immediately and we will delete the data.",
    ],
  },
  {
    title: "11. Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time. We will notify you of material changes via in-app notice or email at least 15 days before they take effect. Continued use of the Platform after changes take effect constitutes your acceptance of the updated policy.",
    ],
  },
  {
    title: "12. Grievance Officer & Contact",
    body: [
      "Grievance Officer: Formbhro Support Team",
      "Email: formbhro@gmail.com",
      "Phone: +91 9817359195",
      "Address: Bhubaneswar, Odisha, India",
      "Working Hours: Monday – Saturday, 10:00 AM – 6:00 PM IST",
      "Response Time: We aim to acknowledge all grievances within 48 hours and resolve them within 30 days.",
    ],
  },
];

function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-brand/10 via-transparent to-transparent">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-light transition-colors mb-6"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 border border-brand/30">
              <svg className="h-5 w-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          </div>
          <p className="text-text-secondary text-sm leading-relaxed">
            Last updated: <strong className="text-white">September 2026</strong> · Effective for all Formbhro users in India
          </p>
          <p className="mt-2 text-text-secondary text-sm leading-relaxed max-w-2xl">
            This policy is drafted in compliance with India's <strong className="text-white">Digital Personal Data Protection Act, 2023 (DPDPA)</strong> and the <strong className="text-white">Information Technology Act, 2000</strong>.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div
              key={section.title}
              className="rounded-2xl border border-white/8 bg-white/3 p-6 backdrop-blur-sm hover:border-white/15 transition-colors"
            >
              <h2 className="text-base font-semibold text-brand-light mb-3">{section.title}</h2>
              <div className="space-y-2">
                {section.body.map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-text-secondary">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-12 border-t border-white/10 pt-8 text-center space-y-3">
          <p className="text-xs text-text-muted">
            Questions about this policy? Contact us at{" "}
            <a href="mailto:formbhro@gmail.com" className="text-brand hover:underline">
              formbhro@gmail.com
            </a>
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-text-muted">
            <Link to="/terms" className="hover:text-brand transition-colors">Terms of Use</Link>
            <span>·</span>
            <Link to="/help" className="hover:text-brand transition-colors">Help & Support</Link>
            <span>·</span>
            <Link to="/" className="hover:text-brand transition-colors">Home</Link>
          </div>
          <p className="text-[11px] text-text-muted">© 2026 Formbhro. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
