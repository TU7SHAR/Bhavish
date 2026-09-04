import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { JsonLd, breadcrumbSchema } from "../../../lib/schema";
import ManglikCalculator from "./ManglikCalculator";

const BASE_URL = "https://www.bhavishai.in";
const URL = `${BASE_URL}/tools/manglik-calculator`;

export const metadata = {
  title: "Free Manglik Dosha Calculator — Check by Date of Birth & Time",
  description:
    "Free Manglik (Mangal Dosha) calculator. Enter your date, time and place of birth to instantly check if you are Manglik, based on high-precision astronomical calculations. No sign-up.",
  keywords: [
    "manglik calculator",
    "manglik dosha calculator",
    "mangal dosha calculator",
    "am i manglik",
    "manglik dosha check",
    "manglik by date of birth",
    "manglik dosha calculator by date of birth and time",
    "check manglik status",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: "Free Manglik Dosha Calculator | BhavishAI",
    description:
      "Instantly check your Manglik (Mangal Dosha) status by date, time and place of birth. Free, no sign-up.",
    url: URL,
    type: "website",
  },
};

// FAQPage schema — targets Manglik answer-box queries.
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Manglik Dosha (Mangal Dosha)?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Manglik Dosha, or Mangal Dosha, occurs when Mars is placed in the 1st, 2nd, 4th, 7th, 8th or 12th house — counted from the Ascendant (Lagna), the Moon, or Venus. It is traditionally considered in the context of marriage.",
      },
    },
    {
      "@type": "Question",
      name: "How do I check if I am Manglik?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Enter your exact date of birth, time of birth and place of birth. The calculator computes your chart and checks whether Mars falls in a Manglik house (1, 2, 4, 7, 8, 12) from the Ascendant, Moon or Venus.",
      },
    },
    {
      "@type": "Question",
      name: "Is Manglik Dosha permanent?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Manglik status itself is a placement of Mars, but classical astrology recognises several cancellations (Manglik dosha bhanga) and remedies. Whether it materially affects a marriage depends on the full chart, not Manglik status alone.",
      },
    },
    {
      "@type": "Question",
      name: "Which houses cause Manglik Dosha?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The Manglik houses are the 1st, 2nd, 4th, 7th, 8th and 12th. The 9th house is NOT a Manglik house — a common misconception.",
      },
    },
  ],
};

const breadcrumbs = breadcrumbSchema([
  { name: "Home", url: BASE_URL },
  { name: "Tools", url: `${BASE_URL}/tools` },
  { name: "Manglik Dosha Calculator", url: URL },
]);

export default function ManglikCalculatorPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbs} />
      <Header />

      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
          {/* Breadcrumb trail (visible) */}
          <nav className="text-xs text-muted mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary-light">Home</Link>
            <span className="mx-1">/</span>
            <span>Tools</span>
            <span className="mx-1">/</span>
            <span className="text-foreground">Manglik Calculator</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            Free Manglik Dosha Calculator
          </h1>
          <p className="text-muted mb-8 leading-relaxed">
            Check your <strong>Manglik (Mangal Dosha)</strong> status in seconds. Enter your
            date, time and place of birth and we&apos;ll compute your chart with the same
            high-precision astronomical engine used in our full report — then tell you exactly
            which house Mars occupies and whether that makes you Manglik.
          </p>

          <ManglikCalculator />

          {/* Educational content — the SEO body + supports the schema */}
          <div className="mt-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-3">What is Manglik Dosha?</h2>
              <p className="text-foreground/90 leading-relaxed">
                Manglik Dosha (also called Mangal Dosha or Kuja Dosha) is a placement of the
                planet Mars in specific houses of the birth chart. It is considered present when
                Mars sits in the <strong>1st, 2nd, 4th, 7th, 8th or 12th house</strong>, counted
                from the Ascendant (Lagna), the Moon, or Venus. Because Mars governs energy,
                assertiveness and conflict, these placements are traditionally examined in the
                context of marriage and long-term compatibility.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">Which houses make you Manglik?</h2>
              <p className="text-foreground/90 leading-relaxed">
                The Manglik houses are <strong>1, 2, 4, 7, 8 and 12</strong>. A very common
                misconception is that the 9th house causes Manglik Dosha — it does not. This
                calculator checks Mars against the correct houses from three reference points
                (Lagna, Moon and Venus) exactly as classical Jyotish prescribes.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-3">Is being Manglik a problem?</h2>
              <p className="text-foreground/90 leading-relaxed">
                Not necessarily. Classical astrology recognises many <em>cancellations</em>
                (Manglik dosha bhanga) — for example, certain sign placements, aspects, or a
                partner who is also Manglik. Whether the dosha has any real effect depends on
                your <strong>complete chart</strong>: the strength of Mars, the 7th house and its
                lord, current dasha periods, and more. Manglik status on its own is only the
                first line of the story.
              </p>
            </div>

            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <h2 className="text-xl font-bold mb-2">Want the full picture?</h2>
              <p className="text-muted mb-4 leading-relaxed">
                Our personalized 20-page report analyses your Manglik status <em>in context</em> —
                cancellations, remedies, marriage timing, dashas, and compatibility — all computed
                from your exact birth chart.
              </p>
              <Link
                href="/get-report"
                className="inline-block rounded-full bg-primary hover:opacity-90 text-white font-semibold px-8 py-3 transition"
              >
                Get My Full Kundli Report →
              </Link>
              <p className="text-xs text-muted mt-2">From ₹299 · ready in 60 seconds</p>
            </div>

            {/* Related tools / internal linking (cluster wiring for later tools) */}
            <div>
              <h2 className="text-2xl font-bold mb-3">Related</h2>
              <ul className="list-disc list-inside text-primary-light space-y-1">
                <li><Link href="/blog" className="hover:underline">Read our Vedic astrology guides →</Link></li>
                <li><Link href="/get-report" className="hover:underline">Generate your free Kundli preview →</Link></li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
