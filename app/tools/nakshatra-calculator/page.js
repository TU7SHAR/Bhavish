import ToolPageShell from "../ToolPageShell";
import NakshatraCalculator from "./NakshatraCalculator";

const URL = "https://www.bhavishai.in/tools/nakshatra-calculator";

export const metadata = {
  title: "Free Nakshatra Calculator — Find Your Birth Star by Time of Birth",
  description:
    "Find your Nakshatra (birth star) and pada instantly by date, time and place of birth. Free, no sign-up — high-precision astronomical calculation.",
  keywords: ["nakshatra calculator", "moon nakshatra", "nakshatra by time of birth", "birth star calculator", "janma nakshatra", "nakshatra finder"],
  alternates: { canonical: URL },
  openGraph: { title: "Free Nakshatra Calculator | BhavishAI", description: "Find your Nakshatra (birth star) and pada by date, time and place of birth. Free, no sign-up.", url: URL, type: "website" },
};

export default function Page() {
  return (
    <ToolPageShell
      slug="nakshatra-calculator"
      crumb="Nakshatra Calculator"
      h1="Free Nakshatra (Birth Star) Calculator"
      intro={<p>Discover your <strong>Nakshatra</strong> — the lunar mansion the Moon occupied at your birth — along with your <strong>pada</strong> (quarter) and its ruling planet. The 27 Nakshatras are the backbone of Vedic timing, dasha and compatibility. Enter your birth details below.</p>}
      calculator={<NakshatraCalculator />}
      sections={[
        { h2: "What is a Nakshatra?", body: <p>The zodiac is divided into <strong>27 Nakshatras</strong> (lunar mansions), each spanning 13°20′. Your birth Nakshatra is the one the Moon occupied when you were born. Each Nakshatra has a ruling planet and four <em>padas</em> (quarters), which refine your personality, career tendencies and compatibility.</p> },
        { h2: "Why your Nakshatra matters", body: <p>Your Nakshatra determines your <strong>Vimshottari Dasha sequence</strong> (the planetary periods that time the events of your life), plays a central role in <strong>marriage matching</strong> (Nakshatra/Guna Milan), and shapes remedies and muhurat. It is one of the most practically used points in Jyotish.</p> },
      ]}
      faq={[
        { q: "How do I find my Nakshatra?", a: "Enter your date, time and place of birth. The calculator computes the Moon's exact longitude and returns your Nakshatra, its pada, and the ruling planet." },
        { q: "What is a pada?", a: "Each Nakshatra is divided into four quarters called padas (each 3°20′). Your pada adds finer detail to your Nakshatra's meaning and is used in Navamsa and matching." },
        { q: "Do I need my exact birth time?", a: "Yes, ideally. The Moon moves through a Nakshatra in roughly a day, and the pada changes every few hours, so an accurate time gives the most reliable result." },
      ]}
      related={[
        { href: "/tools/rashi-calculator", label: "Moon sign (Rashi) calculator →" },
        { href: "/tools/dasha-calculator", label: "Current Vimshottari Dasha calculator →" },
        { href: "/tools/manglik-calculator", label: "Manglik Dosha calculator →" },
      ]}
    />
  );
}
