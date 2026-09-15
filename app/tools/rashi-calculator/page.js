import ToolPageShell from "../ToolPageShell";
import RashiCalculator from "./RashiCalculator";

const URL = "https://www.bhavishai.in/tools/rashi-calculator";

export const metadata = {
  title: "Free Moon Sign (Rashi) Calculator — By Date of Birth & Time",
  description:
    "Find your Vedic Moon sign (Rashi) instantly by date, time and place of birth. Free, no sign-up — computed with a high-precision astronomical engine.",
  keywords: ["rashi calculator", "moon sign calculator", "my moon sign", "rashi by date of birth", "chandra rashi", "moon sign by date of birth"],
  alternates: { canonical: URL },
  openGraph: { title: "Free Moon Sign (Rashi) Calculator | BhavishAI", description: "Find your Vedic Moon sign (Rashi) by date, time and place of birth. Free, no sign-up.", url: URL, type: "website" },
};

export default function Page() {
  return (
    <ToolPageShell
      slug="rashi-calculator"
      crumb="Rashi Calculator"
      h1="Free Moon Sign (Rashi) Calculator"
      intro={<p>Find your <strong>Vedic Moon sign (Rashi)</strong> — the sign the Moon occupied at your birth. In Vedic astrology the Rashi governs your mind and emotions and is used for most daily and monthly predictions. Enter your birth details below.</p>}
      calculator={<RashiCalculator />}
      sections={[
        { h2: "What is a Rashi (Moon sign)?", body: <p>Your <strong>Rashi</strong> is the zodiac sign occupied by the Moon at the exact moment of your birth. Unlike the Western Sun sign, Vedic astrology treats the Moon as the most important reference for the mind, emotions and instinctive nature. This is the sign most Indians mean when they say &ldquo;my rashi.&rdquo;</p> },
        { h2: "Why the Moon sign matters more in Vedic astrology", body: <p>The Moon moves quickly — about one sign every 2.25 days — so your Rashi is sensitive to your birth date. Because it represents the mind, most rashifal (horoscope) predictions and remedies are based on the Moon sign rather than the Sun sign used in Western astrology.</p> },
      ]}
      faq={[
        { q: "How do I find my Rashi (Moon sign)?", a: "Enter your date of birth, time of birth and place of birth. The calculator computes the Moon's exact position and returns the sign it occupied — your Rashi." },
        { q: "Is Rashi the same as my zodiac sun sign?", a: "No. Your Rashi is your Vedic Moon sign; the common 'zodiac sign' is usually the Western Sun sign. Vedic astrology relies primarily on the Moon sign." },
        { q: "Do I need my exact birth time for my Rashi?", a: "The Moon changes sign roughly every 2.25 days, so an accurate date is most important, but a correct time removes any ambiguity near a sign change." },
      ]}
      related={[
        { href: "/tools/nakshatra-calculator", label: "Nakshatra (birth star) calculator →" },
        { href: "/tools/manglik-calculator", label: "Manglik Dosha calculator →" },
        { href: "/tools/lucky-factors", label: "Lucky number, colour & gemstone →" },
      ]}
    />
  );
}
