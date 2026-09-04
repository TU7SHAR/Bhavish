import ClusterLanding from "../../components/ClusterLanding";

const BASE_URL = "https://www.bhavishai.in";
const URL = `${BASE_URL}/kundli/janam-kundli`;

export const metadata = {
  title: "Janam Kundli — What It Is & How to Make One Online (2026)",
  description:
    "What is a Janam Kundli (birth chart)? Learn what it contains — Lagna, Rashi, Nakshatra, houses, planets and Dasha — and generate your own accurate Janam Kundli online in 60 seconds.",
  keywords: [
    "janam kundli",
    "janam kundli online",
    "what is janam kundli",
    "kundli",
    "birth chart",
    "vedic birth chart",
    "janam patrika",
    "free janam kundli",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: "Janam Kundli — What It Is & How to Make One | BhavishAI",
    description: "Understand your Janam Kundli (Vedic birth chart) and generate an accurate one online, free, in 60 seconds.",
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
      ]}
      h1="Janam Kundli: Your Vedic Birth Chart Explained"
      intro="A Janam Kundli (also called a birth chart or janam patrika) is a snapshot of the sky at the exact moment and place you were born. In Vedic astrology it is the foundation of every prediction — personality, career, marriage, wealth, health and the timing of life events."
      sections={[
        {
          heading: "What is a Janam Kundli?",
          body: (
            <p>A Janam Kundli maps the positions of the nine planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, and the lunar nodes Rahu and Ketu) across the twelve houses and twelve signs, as seen from your birthplace at your birth time. Unlike a sun-sign horoscope, it is unique to you.</p>
          ),
        },
        {
          heading: "The key parts of a Kundli",
          body: (
            <>
              <p><strong>Lagna (Ascendant):</strong> the sign rising on the eastern horizon at birth — the anchor of the whole chart and the 1st house.</p>
              <p><strong>Rashi (Moon sign):</strong> the sign your Moon occupies — central to Vedic astrology and to your emotional nature.</p>
              <p><strong>Nakshatra:</strong> the lunar mansion (birth star) the Moon sits in, with its four padas.</p>
              <p><strong>Houses &amp; planets:</strong> the twelve houses cover areas of life; the planets in them (and their lords) drive the predictions.</p>
              <p><strong>Vimshottari Dasha:</strong> the planetary time-periods that reveal <em>when</em> events are likely.</p>
            </>
          ),
        },
        {
          heading: "How to make your Janam Kundli online",
          body: (
            <p>Enter your date of birth, exact time of birth, and place of birth. BhavishAI geocodes your birthplace, computes the chart with a high-precision astronomical engine and the Lahiri ayanamsa, and generates a detailed, personalized report — the free preview shows your Rashi and personality overview instantly.</p>
          ),
        },
      ]}
      faqs={[
        { q: "What is a Janam Kundli?", a: "A Janam Kundli is your Vedic birth chart — the positions of the planets across the houses and signs at your exact birth time and place. It is the basis of all Vedic astrology predictions." },
        { q: "How do I make a Janam Kundli online?", a: "Provide your date, exact time and place of birth. The chart is computed from precise planetary positions; BhavishAI generates a personalized report with a free preview." },
        { q: "Is a Janam Kundli the same as a horoscope?", a: "A Janam Kundli is the full birth chart. A daily horoscope is a general sun-sign forecast. The Kundli is far more personalized and accurate." },
        { q: "Do I need my exact birth time?", a: "For the Lagna and house-based predictions, yes. Without it you can still get accurate planetary positions and your Rashi." },
      ]}
      related={[
        { href: "/kundli/kundli-by-date-of-birth", label: "Get your Kundli by date of birth & time →" },
        { href: "/blog/what-is-janam-kundli", label: "Deep dive: What is Janam Kundli? →" },
        { href: "/blog/rashi-vs-lagna-difference", label: "Rashi vs Lagna →" },
        { href: "/marriage/manglik-dosha", label: "Manglik Dosha explained →" },
        { href: "/tools/manglik-calculator", label: "Free Manglik Dosha calculator →" },
      ]}
    />
  );
}
