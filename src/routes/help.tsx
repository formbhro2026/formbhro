import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/help")({
  component: HelpSupport,
});

function HelpSupport() {
  return (
    <div className="min-h-screen bg-bg text-white antialiased px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-brand hover:underline text-sm font-medium mb-6 inline-block">
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-bold mb-6">Help & Support</h1>

        <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Frequently Asked Questions</h2>

            <div className="space-y-4 mt-4">
              <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle">
                <h3 className="font-medium text-white mb-1">How do I create a new request?</h3>
                <p>
                  You can create a new request by clicking the "New Request" button on your
                  dashboard. Fill in the form details and our team will get back to you.
                </p>
              </div>

              <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle">
                <h3 className="font-medium text-white mb-1">Are my documents safe?</h3>
                <p>
                  Yes, all documents you upload are securely stored in a private bucket. Only
                  authorized team members and yourself can access them.
                </p>
              </div>

              <div className="bg-surface-2 p-4 rounded-xl border border-border-subtle">
                <h3 className="font-medium text-white mb-1">
                  How long does it take to process a form?
                </h3>
                <p>
                  Processing times vary depending on the type of request. Our team will keep you
                  updated in the chat associated with your request.
                </p>
              </div>
            </div>
          </section>

          <section className="pt-4">
            <h2 className="text-lg font-semibold text-white mb-2">Need more help?</h2>
            <p>
              If you couldn't find the answer to your question, feel free to reach out to our
              support team directly at <strong>support@formbhro.com</strong> or call us at{" "}
              <strong>+91 XXXXX XXXXX</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
