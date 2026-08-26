import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-bg text-white antialiased px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-brand hover:underline text-sm font-medium mb-6 inline-block">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

        <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Introduction</h2>
            <p>
              Welcome to Formbhro. We value your privacy and are committed to protecting your
              personal data. This Privacy Policy explains how we collect, use, and safeguard your
              information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Data We Collect</h2>
            <p>
              We may collect personal information such as your name, email address, phone number,
              and any documents you upload to our platform to process your requests.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. How We Use Your Data</h2>
            <p>
              We use your information exclusively to provide our services, process government forms
              on your behalf, communicate with you regarding your requests, and improve our
              platform's functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Data Security</h2>
            <p>
              All uploaded documents are stored in secure, private storage buckets. Access to these
              documents is restricted using short-lived signed URLs, ensuring that only authorized
              personnel and yourself can view them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <strong>support@formbhro.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
