import Link from "next/link";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ConstellationBackground from "./components/ConstellationBackground";

export const metadata = {
  title: "BhavishAI - AI-Powered Vedic Astrology Reports | Janam Kundli Online",
  description:
    "Get your personalized Vedic astrology report in 60 seconds, from ₹299. AI-powered Janam Kundli, career predictions, marriage compatibility, and life guidance based on your birth chart.",
  keywords:
    "kundli, janam kundli, vedic astrology, birth chart, astrology report, AI astrology, kundli online, rashifal, horoscope, marriage compatibility",
  openGraph: {
    title: "BhavishAI - Your Future, Revealed by AI",
    description:
      "Get a detailed Vedic astrology report personalized to your exact birth details, from ₹299. Powered by AI + ancient wisdom.",
    url: "https://www.bhavishai.in",
    siteName: "BhavishAI",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "BhavishAI - AI-Powered Vedic Astrology Reports",
    description:
      "Your personalized birth chart report in 60 seconds, from ₹299. Career, love, health & spiritual guidance.",
  },
  alternates: {
    canonical: "https://www.bhavishai.in",
  },
};

// FAQ Schema for AEO/GEO
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is BhavishAI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "BhavishAI is an AI-powered Vedic astrology platform that generates detailed, personalized birth chart reports based on your exact date, time, and place of birth. It combines ancient Jyotish wisdom with modern AI technology.",
      },
    },
    {
      "@type": "Question",
      name: "How accurate is the AI astrology report?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "BhavishAI uses precise astronomical calculations for planetary positions combined with classical Vedic astrology principles (Brihat Parashara Hora Shastra). The AI interprets these positions to provide detailed personalized insights.",
      },
    },
    {
      "@type": "Question",
      name: "How much does a full astrology report cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Reports start at Rs 299 (Essential). Premium is Rs 499 (full 20-section analysis plus a year of month-by-month guidance) and Master is Rs 999 (adds a specialized deep-dive on your biggest concern plus a 24-month roadmap). You get a free preview before purchasing.",
      },
    },
    {
      "@type": "Question",
      name: "What information do I need to generate my report?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You need your full name, date of birth, exact time of birth, and place of birth. The more accurate your birth time, the more precise your report will be.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take to generate the report?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your personalized report is generated in approximately 60 seconds using our AI engine. You can view the free preview instantly and access the full report immediately after payment.",
      },
    },
  ],
};

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "BhavishAI Vedic Astrology Report",
  description: "AI-powered, personalized Vedic astrology birth chart report (Essential, Premium & Master tiers)",
  brand: { "@type": "Brand", name: "BhavishAI" },
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "299",
    highPrice: "999",
    priceCurrency: "INR",
    offerCount: "3",
    availability: "https://schema.org/InStock",
    url: "https://www.bhavishai.in/get-report",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "2147",
    bestRating: "5",
    worstRating: "1",
  },
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "AI Vedic Astrology Report",
  provider: { "@type": "Organization", name: "BhavishAI" },
  areaServed: "IN",
  description:
    "Personalized Vedic astrology (Janam Kundli) reports generated from your exact birth details using high-precision astronomical calculations and classical Jyotish principles. Available in Essential, Premium and Master tiers.",
  offers: {
    "@type": "Offer",
    price: "299",
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: "https://www.bhavishai.in/get-report",
  },
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />

      <Header />

      <main className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
          {/* Constellation shader (high-end) or CSS stars (low-end) */}
          <ConstellationBackground />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0f]/30 to-[#0a0a0f] z-[2]"></div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-sm text-muted">✨ 10,000+ reports generated</span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Your{" "}
              <span className="gradient-text">Bhavishya</span>
              <br />
              Revealed by AI
            </h1>

            <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10">
              Get a personalized <strong className="text-foreground">Vedic astrology report</strong> in 60 seconds, from ₹299.
              Career, love, health, and spiritual guidance based on your exact birth chart.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/get-report"
                className="bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-full text-lg font-semibold transition-all pulse-glow w-full sm:w-auto"
              >
                Get Free Preview &rarr;
              </Link>
              <a
                href="#how-it-works"
                className="border border-border hover:border-primary-light text-foreground px-8 py-4 rounded-full text-lg font-medium transition-all w-full sm:w-auto"
              >
                See How It Works
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                First page FREE
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Ready in 60 seconds
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                Secure payment via UPI
              </span>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How It Works
              </h2>
              <p className="text-muted text-lg max-w-xl mx-auto">
                Get your complete Vedic astrology report in 3 simple steps
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  icon: "📝",
                  title: "Enter Birth Details",
                  desc: "Provide your name, date of birth, exact birth time, and place of birth.",
                },
                {
                  step: "2",
                  icon: "🤖",
                  title: "AI Generates Report",
                  desc: "Our AI analyzes planetary positions and generates your personalized report in 60 seconds.",
                },
                {
                  step: "3",
                  icon: "📖",
                  title: "Read & Unlock",
                  desc: "Preview the first section free. Unlock your complete life report from Rs 299, instantly.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="relative bg-background border border-border rounded-2xl p-8 text-center card-hover"
                >
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {item.step}
                  </div>
                  <div className="text-4xl mb-4 mt-2">{item.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why BhavishAI — Credibility Section */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why BhavishAI?
              </h2>
              <p className="text-muted text-lg">
                Not another generic horoscope app. Here&apos;s what makes us different.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: "🪐", title: "High-Precision Astronomy", desc: "Planetary positions computed with a high-precision astronomical engine and Lahiri ayanamsa — real math, not tables." },
                { icon: "📍", title: "Exact Birth Coordinates", desc: "We geocode your birthplace to exact latitude/longitude for accurate house calculations." },
                { icon: "🕉️", title: "Vedic Astrology System", desc: "Lahiri Ayanamsa, Whole Sign houses, Vimshottari Dasha — classical Jyotish methodology." },
                { icon: "🎯", title: "Personalized to YOUR Chart", desc: "Every prediction references your specific planets, houses, and degrees. Not sun-sign-level." },
                { icon: "📊", title: "Structured, In-Depth Analysis", desc: "Career, marriage, health, doshas, remedies, timing — organized into actionable sections." },
                { icon: "🚫", title: "Not a Generic AI Response", desc: "We calculate first, then interpret. The AI reads real data — it doesn't guess your chart." },
              ].map((item) => (
                <div key={item.title} className="bg-surface border border-border rounded-xl p-5 card-hover">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features / What You Get */}
        <section id="features" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                What&apos;s In Your Report
              </h2>
              <p className="text-muted text-lg max-w-xl mx-auto">
                A complete life guide based on Vedic Jyotish principles
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: "☀️", title: "Rashi & Lagna Analysis", desc: "Your Sun sign, Moon sign, and Ascendant with detailed personality insights" },
                { icon: "💍", title: "Marriage & Love", desc: "Relationship compatibility, ideal partner traits, and marriage timing predictions" },
                { icon: "💼", title: "Career & Finance", desc: "Best career paths, wealth yogas, and financial growth periods in your chart" },
                { icon: "🏥", title: "Health & Wellness", desc: "Physical and mental health tendencies based on planetary placements" },
                { icon: "🔮", title: "Mahadasha & Timing", desc: "Current and upcoming Dasha periods with predictions for the next 10 years" },
                { icon: "🎯", title: "Lucky Factors", desc: "Lucky numbers, colors, gemstones, mantras, and favorable days personalized for you" },
                { icon: "🌟", title: "Nakshatra Details", desc: "Your birth star analysis with character traits and life path guidance" },
                { icon: "💫", title: "Doshas & Remedies", desc: "Manglik dosha, Kaal Sarp, and other yoga analysis with practical remedies" },
                { icon: "📅", title: "2026-2027 Forecast", desc: "Month-by-month predictions for the coming year based on planetary transits" },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="bg-surface border border-border rounded-xl p-6 card-hover"
                >
                  <div className="text-3xl mb-3">{feature.icon}</div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-20 bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                What Our Users Say
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  name: "Priya S.",
                  location: "Mumbai",
                  text: "The career section was incredibly accurate. It predicted my job change timing perfectly. Worth every rupee!",
                  rating: 5,
                },
                {
                  name: "Rahul M.",
                  location: "Delhi",
                  text: "I was skeptical about AI astrology but this report knew things about my personality that even I hadn't realized. Very detailed.",
                  rating: 5,
                },
                {
                  name: "Anita K.",
                  location: "Bangalore",
                  text: "Used it for marriage compatibility. The insights were so detailed that our families were impressed. Better than a pandit visit!",
                  rating: 5,
                },
              ].map((review) => (
                <div
                  key={review.name}
                  className="bg-background border border-border rounded-xl p-6"
                >
                  <div className="flex items-center gap-1 mb-3">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                      </svg>
                    ))}
                  </div>
                  <p className="text-muted text-sm mb-4">&ldquo;{review.text}&rdquo;</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary text-sm font-bold">
                      {review.name[0]}
                    </div>
                    <div>
                      <p className="text-foreground text-sm font-medium">{review.name}</p>
                      <p className="text-muted text-xs">{review.location}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-muted text-lg">
                Preview for free. Pay only if you want the full report.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch max-w-4xl mx-auto">
              {[
                {
                  name: "Essential",
                  price: "299",
                  tagline: "Your key answer, clearly explained",
                  points: ["10 core personalized sections", "Direct answer to your question", "Remedies & lucky factors", "Add 12-month guidance for ₹149"],
                },
                {
                  name: "Premium",
                  price: "499",
                  highlight: true,
                  badge: "MOST POPULAR",
                  tagline: "The complete experience",
                  points: ["20 in-depth sections", "Direct answer to your question", "12-month month-by-month guidance", "Full dashas, yogas & remedies"],
                },
                {
                  name: "Master",
                  price: "999",
                  badge: "MOST COMPLETE",
                  tagline: "For your biggest concern",
                  points: ["Everything in Premium", "7-part deep-dive on your concern", "24-month personalized roadmap", "Best-action & caution timing"],
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`relative bg-surface border rounded-2xl p-6 flex flex-col text-left ${
                    plan.highlight ? "border-primary glow md:-mt-2 md:mb-2" : "border-border"
                  }`}
                >
                  {plan.badge && (
                    <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap ${plan.highlight ? "bg-primary text-white" : "bg-accent text-black"}`}>
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="text-xl font-bold mt-2">{plan.name}</h3>
                  <div className="mt-1 mb-1">
                    <span className="text-3xl font-bold text-foreground">&#x20B9;{plan.price}</span>
                    <span className="text-muted text-sm ml-1">one-time</span>
                  </div>
                  <p className="text-muted text-sm mb-4">{plan.tagline}</p>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.points.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        <span className="text-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/get-report"
                    className={`block w-full text-center py-3 rounded-full font-semibold text-sm transition-all ${plan.highlight ? "bg-primary hover:bg-primary-dark text-white pulse-glow" : "bg-primary/15 hover:bg-primary/25 text-primary-light"}`}
                  >
                    Get Free Preview &rarr;
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-muted text-sm mt-6">
              Start with a free preview — no payment needed. You choose your plan after seeing your chart.
            </p>

            {/* Comparison with alternatives */}
            <div className="mt-12 max-w-2xl mx-auto">
              <p className="text-center text-muted text-sm mb-6">Compare with alternatives:</p>
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-muted mb-1">Local Pandit</p>
                  <p className="text-foreground font-bold">&#x20B9;500-2000</p>
                  <p className="text-muted text-xs mt-1">Takes 2-3 days</p>
                </div>
                <div className="bg-surface border-2 border-primary rounded-xl p-4">
                  <p className="text-primary-light mb-1 font-medium">BhavishAI</p>
                  <p className="text-foreground font-bold">from &#x20B9;299</p>
                  <p className="text-muted text-xs mt-1">Ready in 60 sec</p>
                </div>
                <div className="bg-surface border border-border rounded-xl p-4">
                  <p className="text-muted mb-1">Astrology Apps</p>
                  <p className="text-foreground font-bold">&#x20B9;300-999</p>
                  <p className="text-muted text-xs mt-1">Generic reports</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-surface">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "What is BhavishAI?",
                  a: "BhavishAI is an AI-powered Vedic astrology platform that generates detailed, personalized birth chart reports based on your exact date, time, and place of birth. It combines ancient Jyotish wisdom with modern AI technology to give you accurate, detailed life insights.",
                },
                {
                  q: "How accurate is the AI astrology report?",
                  a: "Our reports use precise astronomical calculations for planetary positions combined with classical Vedic astrology principles from Brihat Parashara Hora Shastra. The AI interprets these positions to provide deeply personalized insights. The accuracy depends on having your correct birth time.",
                },
                {
                  q: "What do I need to generate my report?",
                  a: "You need your full name, date of birth, exact time of birth (check your birth certificate), and place of birth. The more accurate your birth time, the more precise your report will be.",
                },
                {
                  q: "Is the preview really free?",
                  a: "Yes! You can generate your report and view the first section (Rashi & personality overview) absolutely free. No payment details required. You only pay — from Rs 299 — if you want to unlock your complete report.",
                },
                {
                  q: "What payment methods are accepted?",
                  a: "We accept UPI (Google Pay, PhonePe, Paytm), credit/debit cards, net banking, and wallets through our secure Razorpay payment gateway.",
                },
                {
                  q: "How long does it take to get my report?",
                  a: "Your report is generated in approximately 60 seconds. After payment, you get instant access on-screen and a backup copy is emailed to you.",
                },
                {
                  q: "Is my data safe?",
                  a: "Absolutely. We use industry-standard encryption. Your birth details are used only to generate your report and are never shared with third parties. Payments are processed securely through Razorpay.",
                },
              ].map((faq) => (
                <details
                  key={faq.q}
                  className="bg-background border border-border rounded-xl p-6 group cursor-pointer"
                >
                  <summary className="flex items-center justify-between font-medium text-foreground list-none">
                    {faq.q}
                    <svg className="w-5 h-5 text-muted group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="text-muted text-sm mt-4 leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Discover Your <span className="gradient-text">Bhavishya</span>?
            </h2>
            <p className="text-muted text-lg mb-8 max-w-xl mx-auto">
              Join 10,000+ users who have unlocked insights about their life, career, and relationships through AI-powered Vedic astrology.
            </p>
            <Link
              href="/get-report"
              className="inline-block bg-primary hover:bg-primary-dark text-white px-10 py-4 rounded-full text-lg font-semibold transition-all pulse-glow"
            >
              Generate My Free Report &rarr;
            </Link>
            <p className="text-muted text-sm mt-4">No signup required. Get your preview in 60 seconds.</p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
