import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "Plans & Pricing",
  description:
    "Simple, transparent pricing for BhavishAI. Start with a single personalized Vedic astrology report for ₹299, add 12-month guidance, or unlock Founder Access.",
  alternates: { canonical: "https://www.bhavishai.in/plans" },
};

// One-time products — every CTA funnels into the working /get-report flow.
// (Founder is intentionally NOT a direct public checkout — it's a special
//  post-payment upgrade, so here it just points people to get their first report.)
const ONE_TIME = [
  {
    id: "single",
    name: "Single Report",
    price: "299",
    tagline: "Best for one important question.",
    highlight: true,
    badge: "Most Popular",
    features: [
      "One personalized 20-page report",
      "Direct answer to your question",
      "Career, love, money, marriage or life decision",
      "Swiss Ephemeris precision + Vedic analysis",
      "PDF download & lifetime access to this report",
    ],
    cta: { label: "Get My Report →", href: "/get-report" },
  },
  {
    id: "guidance",
    name: "12-Month Guidance Add-on",
    price: "149",
    tagline: "Best for timing windows after your main report.",
    features: [
      "Month-by-month guidance for the next 12 months",
      "Career, money, relationships & health timing",
      "Caution periods and best action windows",
      "Practical monthly advice you can follow",
    ],
    note: "Added at checkout when you buy your report.",
    cta: { label: "Start with a Report →", href: "/get-report" },
  },
  {
    id: "founder",
    name: "Founder Access",
    price: "999",
    tagline: "Best for ongoing questions over time.",
    features: [
      "5 personalized reports every month",
      "Valid for 2 full years (up to 120 reports)",
      "Ask about career, love, money, family & more",
      "Generate for yourself or close family",
      "Priority support & early access to new features",
    ],
    note: "A special upgrade offered right after your first report.",
    cta: { label: "Get Your First Report →", href: "/get-report" },
  },
];

// Monthly subscriptions — shown so people can see what's coming, but recurring
// billing isn't live yet. Kept honest with a "Coming Soon" state.
const MONTHLY = [
  {
    id: "basic",
    name: "Basic",
    price: "299",
    per: "/month",
    reports: "1 report / month",
    features: ["1 personalized report every month", "Lifetime access to each report", "Cancel anytime"],
  },
  {
    id: "plus",
    name: "Plus",
    price: "499",
    per: "/month",
    reports: "3 reports / month",
    highlight: true,
    features: ["3 personalized reports every month", "Lifetime access to each report", "Cancel anytime"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "999",
    per: "/month",
    reports: "8 reports / month",
    features: ["8 personalized reports every month", "Lifetime access to each report", "Cancel anytime"],
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
              Start simple. Ask one question and get your personalized report for ₹299 — no account or subscription
              required. Explore more options below whenever you&apos;re ready.
            </p>
          </div>

          {/* Section 1: One-time */}
          <section className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-primary-light">One-Time</h2>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {ONE_TIME.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-surface border rounded-2xl p-6 flex flex-col ${
                    plan.highlight ? "border-primary glow" : "border-border"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap">
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
          </section>

          {/* Section 2: Monthly (Coming Soon) */}
          <section className="mb-14">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-primary-light">Monthly Plans</h2>
              <span className="h-px flex-1 bg-border" />
              <span className="bg-accent/15 text-accent text-[11px] font-semibold px-3 py-1 rounded-full">
                Coming Soon
              </span>
            </div>
            <p className="text-muted text-sm mb-5">
              Recurring plans for people who ask questions regularly. Launching soon — for now, start with a single
              report anytime.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {MONTHLY.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-surface/60 border rounded-2xl p-6 flex flex-col ${
                    plan.highlight ? "border-primary/40" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {plan.highlight && (
                      <span className="text-[10px] font-semibold text-primary-light bg-primary/15 px-2 py-0.5 rounded-full">
                        Best Value
                      </span>
                    )}
                  </div>
                  <div className="mt-2 mb-1">
                    <span className="text-3xl font-bold">₹{plan.price}</span>
                    <span className="text-muted text-sm ml-1">{plan.per}</span>
                  </div>
                  <p className="text-primary-light text-sm font-medium mb-4">{plan.reports}</p>

                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted">
                        <CheckIcon />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled
                    className="w-full text-center py-3 rounded-full font-semibold text-sm bg-white/5 text-muted cursor-not-allowed border border-border"
                  >
                    Coming Soon
                  </button>
                </div>
              ))}
            </div>

            <div className="text-center mt-6">
              <Link
                href="/get-report"
                className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full text-sm font-medium transition-all"
              >
                Start with a Single Report — ₹299 →
              </Link>
            </div>
          </section>

          {/* Trust / FAQ strip */}
          <section className="bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-sm font-bold mb-4 text-primary-light text-center">Good to know</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              {[
                {
                  q: "Do I need an account?",
                  a: "No. You can get a report with just your birth details. Sign in with Google only if you want to save reports to a dashboard.",
                },
                {
                  q: "What does \u201clifetime access\u201d mean?",
                  a: "Each report you buy stays available to you — you can revisit or re-download it anytime. It refers to that report, not unlimited reports.",
                },
                {
                  q: "How is Founder Access different?",
                  a: "It\u2019s a special one-time upgrade offered right after your first purchase — 5 reports/month for 2 years, ideal for ongoing questions.",
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
