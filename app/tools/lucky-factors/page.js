import ToolPageShell from "../ToolPageShell";
import LuckyFactors from "./LuckyFactors";

const URL = "https://www.bhavishai.in/tools/lucky-factors";

export const metadata = {
  title: "Free Lucky Number, Colour & Gemstone Calculator (by Birth Chart)",
  description:
    "Find your lucky number, colour, gemstone and day from your Vedic birth chart. Free, no sign-up — based on your Ascendant, computed with high precision.",
  keywords: ["lucky number calculator", "lucky gemstone for rashi", "zodiac lucky number", "lucky colour astrology", "gemstone by date of birth", "lucky day astrology"],
  alternates: { canonical: URL },
  openGraph: { title: "Free Lucky Number, Colour & Gemstone Calculator | BhavishAI", description: "Find your lucky number, colour, gemstone and day from your Vedic birth chart. Free, no sign-up.", url: URL, type: "website" },
};

export default function Page() {
  return (
    <ToolPageShell
      slug="lucky-factors"
      crumb="Lucky Factors"
      h1="Free Lucky Number, Colour & Gemstone Calculator"
      intro={<p>Discover your <strong>lucky gemstone, colour, numbers and day</strong> — derived from your Ascendant (Lagna) and its ruling planet in Vedic astrology. Enter your birth details below.</p>}
      calculator={<LuckyFactors />}
      sections={[
        { h2: "How are lucky factors decided?", body: <p>In Vedic astrology your luckiest energies are tied to your <strong>Ascendant (Lagna)</strong> and its ruling planet. That planet&apos;s gemstone, colour, numbers and weekday are considered supportive for you. This tool reads your exact Ascendant and returns the classical associations for it.</p> },
        { h2: "A note on gemstones", body: <p>Gemstones are powerful remedies in Jyotish and are traditionally chosen after studying the <em>whole</em> chart — not the Ascendant alone. Treat this as a helpful starting point; wear a primary gemstone only after a full chart review, which your personalized report provides.</p> },
      ]}
      faq={[
        { q: "How do you calculate my lucky number and colour?", a: "We compute your Ascendant from your date, time and place of birth, then return the gemstone, colour, lucky numbers and day traditionally associated with your Ascendant lord." },
        { q: "Should I wear the gemstone shown?", a: "This is a general indication from your Ascendant. A primary gemstone is best confirmed against your full chart (planet strengths, dashas), which the complete report covers." },
        { q: "Do I need my birth time?", a: "Yes — the Ascendant changes roughly every two hours, so an accurate birth time is needed for correct lucky factors." },
      ]}
      related={[
        { href: "/tools/rashi-calculator", label: "Moon sign (Rashi) calculator →" },
        { href: "/tools/nakshatra-calculator", label: "Nakshatra (birth star) calculator →" },
        { href: "/tools/manglik-calculator", label: "Manglik Dosha calculator →" },
      ]}
    />
  );
}
