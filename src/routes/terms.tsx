import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  ssr: false,
  component: TermsOfUse,
  head: () => ({
    meta: [
      { title: "Terms of Use — Formbhro" },
      {
        name: "description",
        content:
          "Formbhro Terms of Use: understand your rights and responsibilities when using our digital form assistance platform.",
      },
    ],
  }),
});

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: [
      "By accessing or using Formbhro (\"Platform\", \"Service\"), you confirm that you have read, understood, and agree to be bound by these Terms of Use (\"Terms\"), our Privacy Policy, and any applicable laws of India.",
      "If you are accessing the Platform on behalf of an organisation, you represent that you have the authority to bind that organisation to these Terms.",
      "We reserve the right to modify these Terms at any time. Continued use of the Platform after changes become effective constitutes acceptance of the revised Terms. We will notify you of material changes at least 15 days in advance.",
      "Users must be at least 18 years of age, or have a parent/guardian's consent, to use this Platform.",
    ],
  },
  {
    title: "2. Nature of Our Service",
    body: [
      "Formbhro is a digital facilitation and assistance platform. We help you prepare, review, and submit applications to government portals, examination authorities, and other institutions.",
      "Formbhro is NOT an official government body or portal. We act as an intermediary facilitation agent. Submission of applications through our Platform does not guarantee acceptance, approval, or any particular outcome by the relevant authority.",
      "All final decisions regarding your application — including acceptance, rejection, seat allotment, or certificate issuance — rest solely with the concerned government or institutional authority.",
      "Our team members are trained facilitators, not licensed legal advisors, solicitors, or government officials. Information provided by our team should not be construed as legal advice.",
    ],
  },
  {
    title: "3. User Accounts & Security",
    body: [
      "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
      "You must provide accurate, current, and complete information during registration and keep it updated.",
      "Notify us immediately at formbhro@gmail.com if you suspect any unauthorized use of your account.",
      "We are not liable for any loss or damage arising from your failure to comply with these security obligations.",
    ],
  },
  {
    title: "4. User Responsibilities & Accuracy",
    body: [
      "You are solely responsible for the accuracy, authenticity, and completeness of all information and documents you provide to Formbhro.",
      "Submission of false, forged, tampered, or misleading documents is strictly prohibited and may constitute a criminal offence under the Indian Penal Code, 1860, and the Information Technology Act, 2000.",
      "Formbhro is not liable for rejection, cancellation, or adverse outcomes resulting from inaccurate information or documents provided by you.",
      "You must not use the Platform for any illegal, fraudulent, or unauthorised purpose.",
    ],
  },
  {
    title: "5. Fees, Payments & Refund Policy",
    body: [
      "Platform Service Fee: Formbhro charges a service fee for assistance with form submission. This fee is separate from any government-mandated application fee.",
      "Government Application Fees: Any official fee required by a government portal, exam board, or institution is your responsibility and must be paid directly to the relevant authority. Formbhro may facilitate this payment but is not the ultimate payee.",
      "Refund Policy: Our service fee is non-refundable once our team has commenced work on your request (i.e., once a team member has been assigned). If work has not yet begun, you may request a refund within 24 hours of payment.",
      "Dispute Resolution for Payments: Payment disputes must be raised within 7 days of the transaction. Contact us at formbhro@gmail.com with proof of payment.",
      "We reserve the right to revise our fee structure with 7 days' notice published on the Platform.",
    ],
  },
  {
    title: "6. Document Uploads & Vault",
    body: [
      "By uploading documents to our Platform, you grant Formbhro a limited, non-exclusive licence to use those documents solely for the purpose of processing your service request.",
      "You represent and warrant that you have the legal right to upload and share the documents, and that they do not infringe the rights of any third party.",
      "Uploaded documents are stored in a secure Document Vault. Access is restricted by Row Level Security policies. See our Privacy Policy for full details on storage and retention.",
      "Documents are retained for up to 12 months from the date of upload. You may request deletion by contacting us.",
    ],
  },
  {
    title: "7. Prohibited Activities",
    body: [
      "You may not: (a) attempt to circumvent, hack, or exploit any security feature of the Platform; (b) use automated bots, scrapers, or crawlers to access the Platform; (c) impersonate another person or entity; (d) upload or transmit malicious code, viruses, or harmful content; (e) use the Platform to harass, threaten, or harm any other user or team member; (f) upload documents belonging to another person without their explicit consent; (g) engage in any activity that disrupts or interferes with the Platform.",
      "Violation of these prohibitions may result in immediate account suspension, reporting to law enforcement, and civil/criminal proceedings.",
    ],
  },
  {
    title: "8. Intellectual Property",
    body: [
      "All content on the Platform — including but not limited to logos, text, graphics, software, and code — is the intellectual property of Formbhro or its licensors and is protected under applicable Indian and international intellectual property laws.",
      "You may not copy, reproduce, distribute, modify, or create derivative works from any Platform content without our prior written consent.",
      "You retain ownership of the personal data and documents you upload. By uploading, you grant us only the limited licence described in Section 6.",
    ],
  },
  {
    title: "9. Disclaimer of Warranties",
    body: [
      "The Platform is provided on an \"as is\" and \"as available\" basis. Formbhro makes no warranties, express or implied, including but not limited to fitness for a particular purpose, merchantability, or non-infringement.",
      "We do not warrant that: (a) the Platform will be uninterrupted, error-free, or free of viruses; (b) any specific application submitted through our Platform will be accepted or approved; (c) government portal outages or technical issues on third-party systems will not affect your application timeline.",
      "Formbhro is not responsible for decisions made by exam boards, government departments, or any third-party authority regarding seat allotment, quota classification, certificate issuance, or any other administrative outcome.",
    ],
  },
  {
    title: "10. Limitation of Liability",
    body: [
      "To the maximum extent permitted by applicable law, Formbhro, its directors, officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of the Platform.",
      "Our total aggregate liability to you for any claim arising out of or relating to these Terms or the Service shall not exceed the amount you paid to Formbhro in the 3 months preceding the event giving rise to the claim.",
      "Nothing in these Terms limits our liability for death or personal injury caused by our negligence, or for fraud or fraudulent misrepresentation.",
    ],
  },
  {
    title: "11. Governing Law & Dispute Resolution",
    body: [
      "These Terms are governed by and construed in accordance with the laws of India.",
      "Any disputes arising from or in connection with these Terms shall first be attempted to be resolved through mutual negotiation within 30 days.",
      "If unresolved, disputes shall be subject to the exclusive jurisdiction of the courts located at Bhubaneswar, Odisha, India.",
      "For minor disputes, we encourage users to use our in-app support or email formbhro@gmail.com before initiating any formal proceedings.",
    ],
  },
  {
    title: "12. Termination",
    body: [
      "We may suspend or terminate your account and access to the Platform at any time, with or without notice, if you breach these Terms or if we have reason to believe you have engaged in fraudulent or illegal activity.",
      "You may terminate your account at any time by contacting us at formbhro@gmail.com. Termination does not entitle you to a refund for any fees already paid.",
      "Upon termination, your right to use the Platform ceases immediately. Provisions of these Terms that by their nature should survive termination (including but not limited to Sections 4, 8, 10, and 11) shall survive.",
    ],
  },
  {
    title: "13. Contact Us",
    body: [
      "For any questions, complaints, or notices under these Terms, please contact us:",
      "Email: formbhro@gmail.com",
      "Phone: +91 9817359195",
      "Address: Bhubaneswar, Odisha, India",
      "Working Hours: Monday – Saturday, 10:00 AM – 6:00 PM IST",
    ],
  },
];

function TermsOfUse() {
  return (
    <div className="min-h-screen bg-[#050505] text-white antialiased">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-r from-indigo-500/10 via-transparent to-transparent">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-500/30">
              <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
          </div>
          <p className="text-text-secondary text-sm leading-relaxed">
            Last updated: <strong className="text-white">September 2026</strong> · Applicable to all users of Formbhro in India
          </p>
          <p className="mt-2 text-text-secondary text-sm leading-relaxed max-w-2xl">
            Please read these Terms carefully before using our Platform. By using Formbhro, you agree to be bound by these Terms.
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
              <h2 className="text-base font-semibold text-indigo-300 mb-3">{section.title}</h2>
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
            Have questions about these Terms? Email us at{" "}
            <a href="mailto:formbhro@gmail.com" className="text-brand hover:underline">
              formbhro@gmail.com
            </a>
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-text-muted">
            <Link to="/privacy" className="hover:text-brand transition-colors">Privacy Policy</Link>
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
