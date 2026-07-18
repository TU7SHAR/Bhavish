import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "Plans & Pricing",
  description:
    "Simple, one-time pricing for BhavishAI. Choose Essential (₹299), Premium (₹499) or Master (₹999) — personalized Vedic astrology reports based on your exact birth chart.",
  alternates: { canonical: "https://www.bhavishai.in/plans" },
};

// Three one-time tiers. Every CTA funnels into the working /get-report flow;
// the actual plan is chosen on the preview/paywall after the free preview.
const TIERS = [
  {
    id: "essential",
    name: "Essential",
    price: "299",
    tagline: "For one important question.",
    features: [
      "10 core personalized sections",
      "Direct answer to your question",
      "Career, love, money, health & timing",
      "Remedies & lucky factors",
      "Swiss Ephemeris precision + Vedic analysis",
      "PDF download & lifetime access",
    ],
    note: "Add 12-month guidance for ₹149 at checkout.",
    cta: { label: "Get My Report →", href: "/get-report" },
  },
  {
    id: "premium",
    name: "Premium",
    price: "499",
    highlight: true,
    badge: "Most Popular",
    tagline: "The complete experience.",
    features: [
      "20 in-depth personalized sections",
      "Direct answer to your question",
      "12-month month-by-month guidance",
      "Full career, marriage, wealth & health analysis",
      "Dashas, yogas, doshas & remedies",
      "PDF download & lifetime access",
    ],
    cta: { label: "Get My Report →", href: "/get-report" },
  },
  {
    id: "master",
    name: "Master",
    price: "999",
    badge: "Most Complete",
    tagline: "For the concern keeping you up at night.",
    features: [
      "Everything in Premium",
      "A 7-part deep-dive on your biggest concern",
      "(career, marriage, wealth, relationship or health)",
      "24-month personalized roadmap",
      "Best-action & caution timing windows",
      "PDF download & lifetime access",
    ],
    cta: { label: "Get My Report →", href: "/get-report" },
  },
];

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function PlansPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Plans &amp; Pricing</h1>
            <p className="text-muted max-w-xl mx-auto">
              Start with a free preview of your chart — no account needed. When you&apos;re ready, choose how
              deeply you want your report analysed. One-time payment, lifetime access, no subscription.
            </p>
          </div>

          {/* Three tiers */}
          <section className="mb-14">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
              {TIERS.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-surface border rounded-2xl p-6 flex flex-col ${
                    plan.highlight ? "border-primary glow md:-mt-2 md:mb-2" : "border-border"
                  }`}
                >
                  {plan.badge && (
                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                        plan.highlight ? "bg-primary text-white" : "bg-accent text-black"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <div className="mt-2 mb-1">
                    <span className="text-3xl font-bold">₹{plan.price}</span>
                    <span className="text-muted text-sm ml-1">one-time</span>
                  </div>
                  <p className="text-muted text-sm mb-4">{plan.tagline}</p>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted">
                        <CheckIcon />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.note && <p className="text-[11px] text-muted/80 italic mb-3">{plan.note}</p>}

                  <Link
                    href={plan.cta.href}
                    className={`w-full text-center py-3 rounded-full font-semibold text-sm transition-all ${
                      plan.highlight
                        ? "bg-primary hover:bg-primary-dark text-white pulse-glow"
                        : "bg-primary/15 hover:bg-primary/25 text-primary-light"
                    }`}
                  >
                    {plan.cta.label}
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-muted text-sm mt-6">
              You choose your plan on the next step, after seeing your free chart preview.
            </p>
          </section>

          {/* Trust / FAQ strip */}
          <section className="bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-sm font-bold mb-4 text-primary-light text-center">Good to know</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {[
                {
                  q: "Do I need an account?",
                  a: "No. You can get a report with just your birth details. Sign in with Google only if you want to save reports to a dashboard — you'll also get a private link to your report by email.",
                },
                {
                  q: "What's the difference between the plans?",
                  a: "Essential answers your key question with 10 core sections. Premium adds the full 20-section analysis plus a year of month-by-month guidance. Master adds a specialized deep-dive on your biggest concern and a 24-month roadmap.",
                },
                {
                  q: "What does \u201clifetime access\u201d mean?",
                  a: "Each report you buy stays available to you — revisit or re-download it anytime with your private link. It refers to that report, not unlimited reports.",
                },
                {
                  q: "Is payment secure?",
                  a: "Yes. All payments are processed securely by Razorpay (UPI, cards, net banking). We never store your payment details.",
                },
              ].map((item) => (
                <div key={item.q}>
                  <p className="font-semibold text-foreground mb-1">{item.q}</p>
                  <p className="text-muted leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
