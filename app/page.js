import Link from "next/link";
import Header from "./components/Header";
import Footer from "./components/Footer";

export const metadata = {
  title: "BhavishAI - AI-Powered Vedic Astrology Reports | Janam Kundli Online",
  description:
    "Get your personalized 20-page Vedic astrology report in 60 seconds. AI-powered Janam Kundli, career predictions, marriage compatibility, and life guidance based on your birth chart.",
  keywords:
    "kundli, janam kundli, vedic astrology, birth chart, astrology report, AI astrology, kundli online, rashifal, horoscope, marriage compatibility",
  openGraph: {
    title: "BhavishAI - Your Future, Revealed by AI",
    description:
      "Get a detailed 20-page Vedic astrology report personalized to your exact birth details. Powered by AI + ancient wisdom.",
    url: "https://bhavishai.in",
    siteName: "BhavishAI",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "BhavishAI - AI-Powered Vedic Astrology Reports",
    description:
      "Your personalized 20-page birth chart report in 60 seconds. Career, love, health & spiritual guidance.",
  },
  alternates: {
    canonical: "https://bhavishai.in",
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
        text: "BhavishAI is an AI-powered Vedic astrology platform that generates personalized 20-page birth chart reports based on your exact date, time, and place of birth. It combines ancient Jyotish wisdom with modern AI technology.",
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
        text: "A complete 20-page personalized Vedic astrology report costs just Rs 199. You get a free preview of the first page before purchasing the full report.",
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
        text: "Your personalized 20-page report is generated in approximately 60 seconds using our AI engine. You can view the free preview instantly and access the full report immediately after payment.",
      },
    },
  ],
};

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "BhavishAI Vedic Astrology Report",
  description: "AI-powered personalized 20-page Vedic astrology birth chart report",
  brand: { "@type": "Brand", name: "BhavishAI" },
  offers: {
    "@type": "Offer",
    price: "199",
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: "https://bhavishai.in/get-report",
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

      <Header />

      <main className="flex flex-col min-h-screen">
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
          <div className="absolute inset-0 stars-bg opacity-30"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0f]/50 to-[#0a0a0f]"></div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-sm text-muted">10,000+ reports generated</span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Your{" "}
              <span className="gradient-text">Bhavishya</span>
              <br />
              Revealed by AI
            </h1>

            <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10">
              Get a personalized <strong className="text-foreground">20-page Vedic astrology report</strong> in 60 seconds. 
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
                  icon: "&#x1F4DD;",
                  title: "Enter Birth Details",
                  desc: "Provide your name, date of birth, exact birth time, and place of birth.",
                },
                {
                  step: "2",
                  icon: "&#x1F916;",
                  title: "AI Generates Report",
                  desc: "Our AI analyzes planetary positions and generates your personalized 20-page report in 60 seconds.",
                },
                {
                  step: "3",
                  icon: "&#x1F4D6;",
                  title: "Read & Unlock",
                  desc: "Preview the first page free. Pay just Rs 199 to unlock your complete life report instantly.",
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

        {/* Features / What You Get */}
        <section id="features" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                What&apos;s In Your 20-Page Report
              </h2>
              <p className="text-muted text-lg max-w-xl mx-auto">
                A complete life guide based on Vedic Jyotish principles
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: "&#x2600;&#xFE0F;", title: "Rashi & Lagna Analysis", desc: "Your Sun sign, Moon sign, and Ascendant with detailed personality insights" },
                { icon: "&#x1F48D;", title: "Marriage & Love", desc: "Relationship compatibility, ideal partner traits, and marriage timing predictions" },
                { icon: "&#x1F4BC;", title: "Career & Finance", desc: "Best career paths, wealth yogas, and financial growth periods in your chart" },
                { icon: "&#x1F3E5;", title: "Health & Wellness", desc: "Physical and mental health tendencies based on planetary placements" },
                { icon: "&#x1F52E;", title: "Mahadasha & Timing", desc: "Current and upcoming Dasha periods with predictions for the next 10 years" },
                { icon: "&#x1F3AF;", title: "Lucky Factors", desc: "Lucky numbers, colors, gemstones, mantras, and favorable days personalized for you" },
                { icon: "&#x1F31F;", title: "Nakshatra Details", desc: "Your birth star analysis with character traits and life path guidance" },
                { icon: "&#x1F4AB;", title: "Doshas & Remedies", desc: "Manglik dosha, Kaal Sarp, and other yoga analysis with practical remedies" },
                { icon: "&#x1F4C5;", title: "2026-2027 Forecast", desc: "Month-by-month predictions for the coming year based on planetary transits" },
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

            <div className="max-w-md mx-auto">
              <div className="relative bg-surface border-2 border-primary rounded-2xl p-8 text-center glow">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold">
                  MOST POPULAR
                </div>
                <h3 className="text-2xl font-bold mb-2 mt-2">Complete Life Report</h3>
                <p className="text-muted mb-6">20-page personalized Vedic astrology report</p>
                
                <div className="mb-6">
                  <span className="text-5xl font-bold text-foreground">&#x20B9;199</span>
                  <span className="text-muted ml-2">one-time</span>
                </div>

                <ul className="text-left space-y-3 mb-8">
                  {[
                    "Complete Rashi & Lagna analysis",
                    "Career & finance predictions",
                    "Marriage & compatibility insights",
                    "Health & wellness guidance",
                    "10-year Mahadasha forecast",
                    "Lucky numbers, colors & gems",
                    "Dosha analysis & remedies",
                    "2026-2027 monthly predictions",
                    "Instant digital delivery",
                    "Email backup copy",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <svg className="w-5 h-5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      <span className="text-muted">{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/get-report"
                  className="block w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-full font-semibold text-lg transition-all glow-hover"
                >
                  Get Free Preview First &rarr;
                </Link>

                <p className="text-muted text-xs mt-4">
                  No payment needed for preview. Pay only for full report.
                </p>
              </div>
            </div>

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
                  <p className="text-foreground font-bold">&#x20B9;199</p>
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
                  a: "BhavishAI is an AI-powered Vedic astrology platform that generates personalized 20-page birth chart reports based on your exact date, time, and place of birth. It combines ancient Jyotish wisdom with modern AI technology to give you accurate, detailed life insights.",
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
                  q: "Is the first page really free?",
                  a: "Yes! You can generate your report and view the complete first page (Rashi & personality overview) absolutely free. No payment details required. You only pay Rs 199 if you want to unlock the remaining 19 pages.",
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
