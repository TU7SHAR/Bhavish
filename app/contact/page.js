import Header from "../components/Header";
import Footer from "../components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Contact Us",
  description:
    "Have questions about your Vedic astrology report? Contact BhavishAI for support, feedback, or partnership inquiries.",
  alternates: { canonical: "https://www.bhavishai.in/contact" },
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Contact Us</h1>
            <p className="text-muted text-lg">
              Have questions, feedback, or need help? We&apos;re here for you.
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {/* Email */}
            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl">📧</span>
              </div>
              <h3 className="font-semibold mb-1">Email Us</h3>
              <p className="text-muted text-sm mb-3">For support, refunds, or general queries</p>
              <a
                href="mailto:support@bhavishai.in"
                className="text-primary-light hover:text-primary font-medium text-sm transition-colors"
              >
                support@bhavishai.in
              </a>
            </div>

            {/* Response time */}
            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="font-semibold mb-1">Fast Response</h3>
              <p className="text-muted text-sm mb-3">We typically respond within 24 hours</p>
              <span className="text-accent text-sm font-medium">Mon – Sat, 10 AM – 7 PM IST</span>
            </div>
          </div>

          {/* FAQ-style common questions */}
          <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 mb-8">
            <h2 className="text-lg font-bold mb-5">Common Questions</h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-medium text-foreground mb-1">I paid but didn&apos;t receive my report. What do I do?</h3>
                <p className="text-muted text-sm">
                  Email us at support@bhavishai.in with your name and payment ID (from your Razorpay receipt). We&apos;ll send your report within hours.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Can I get a refund?</h3>
                <p className="text-muted text-sm">
                  Since the report is a digital product delivered instantly, refunds are handled on a case-by-case basis. See our{" "}
                  <Link href="/refund" className="text-primary-light hover:underline">Refund Policy</Link> for details.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">My report seems inaccurate. Is my birth time important?</h3>
                <p className="text-muted text-sm">
                  Yes! Even a few minutes&apos; difference in birth time can change your Lagna and house placements. Double-check your birth certificate for the exact time.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">I want to collaborate or partner with BhavishAI.</h3>
                <p className="text-muted text-sm">
                  We&apos;re open to partnerships! Email us at support@bhavishai.in with the subject &ldquo;Partnership&rdquo; and tell us about your idea.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-muted text-sm mb-4">Haven&apos;t tried BhavishAI yet?</p>
            <Link
              href="/get-report"
              className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full font-medium transition-all"
            >
              Get Your Free Preview →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
