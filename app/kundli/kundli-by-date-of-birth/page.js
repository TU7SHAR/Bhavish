import ClusterLanding from "../../components/ClusterLanding";

const BASE_URL = "https://www.bhavishai.in";
const URL = `${BASE_URL}/kundli/kundli-by-date-of-birth`;

export const metadata = {
  title: "Kundli by Date of Birth and Time — Free Online (2026)",
  description:
    "Generate your Janam Kundli by date of birth and time online, free. Enter your birth details to get an accurate Vedic birth chart — planets, Rashi, Lagna, Nakshatra and Dasha — in 60 seconds.",
  keywords: [
    "kundli by date of birth",
    "kundli by date of birth and time",
    "janam kundli by date of birth",
    "kundli online by date of birth",
    "birth chart by date of birth",
    "free kundli by date of birth and time",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: "Kundli by Date of Birth and Time — Free | BhavishAI",
    description: "Accurate Vedic Janam Kundli from your exact date, time and place of birth. Free preview in 60 seconds.",
    url: URL,
    type: "article",
  },
};

export default function Page() {
  return (
    <ClusterLanding
      breadcrumbTrail={[
        { name: "Home", url: "/" },
        { name: "Kundli", url: "/kundli/janam-kundli" },
        { name: "Kundli by Date of Birth", url: "/kundli/kundli-by-date-of-birth" },
      ]}
      h1="Kundli by Date of Birth and Time"
      intro="Your Janam Kundli (birth chart) is calculated from three things: your date of birth, your exact time of birth, and your place of birth. Enter them and BhavishAI computes your chart with a high-precision astronomical engine — no guesswork, no generic sun-sign templates."
      sections={[
        {
          heading: "Why your birth time matters",
          body: (
            <>
              <p>Your date of birth fixes the positions of the planets, but your <strong>time of birth</strong> fixes your Ascendant (Lagna) and the 12 houses — which is what makes a chart truly yours. Even a 15–20 minute difference can shift the Lagna into a different sign and change house-based predictions.</p>
              <p>If you only know your date but not your exact time, you&apos;ll still get accurate planetary positions and Rashi (Moon sign), but house-specific predictions will be approximate. Check your birth certificate or hospital records for the most accurate result.</p>
            </>
          ),
        },
        {
          heading: "What your Kundli reveals",
          body: (
            <>
              <p>A complete Janam Kundli by date of birth and time includes your Ascendant (Lagna), Moon sign (Rashi), birth star (Nakshatra), the positions of all nine planets across the twelve houses, your Vimshottari Dasha timeline, and any doshas or yogas present in the chart.</p>
              <p>Together these describe your personality, career direction, relationships and marriage, finances, health tendencies, and — through the Dasha system — the <em>timing</em> of major life events.</p>
            </>
          ),
        },
        {
          heading: "How BhavishAI calculates it",
          body: (
            <p>We geocode your birthplace to exact coordinates, compute planetary positions with a high-precision astronomical engine, apply the Lahiri ayanamsa and Whole-Sign house system, and derive your Nakshatra, Dasha, Manglik status and classical yogas deterministically. The AI then interprets these <em>calculated</em> facts — it never guesses your chart.</p>
          ),
        },
      ]}
      faqs={[
        { q: "Can I get my Kundli with only my date of birth?", a: "Yes — you'll get accurate planetary positions and your Moon sign (Rashi). But for the Ascendant (Lagna) and house-based predictions, your exact time of birth is required." },
        { q: "Is the Kundli free?", a: "The preview is free — you can generate your chart and read the first section with no payment. The full 20-page personalized report starts at ₹299." },
        { q: "How accurate is it?", a: "Planetary positions are computed with a high-precision astronomical engine and the Lahiri ayanamsa. Accuracy of house-based predictions depends on how precise your birth time is." },
        { q: "What is the difference between Rashi and Lagna?", a: "Rashi is your Moon sign; Lagna (Ascendant) is the sign rising on the eastern horizon at your birth time. Both are used in a full reading." },
      ]}
      related={[
        { href: "/kundli/janam-kundli", label: "What is a Janam Kundli? →" },
        { href: "/blog/rashi-vs-lagna-difference", label: "Rashi vs Lagna: the difference →" },
        { href: "/blog/best-time-of-birth-accuracy-astrology", label: "Why birth-time accuracy matters →" },
        { href: "/tools/manglik-calculator", label: "Free Manglik Dosha calculator →" },
      ]}
    />
  );
}
