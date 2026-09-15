import ToolPageShell from "../ToolPageShell";
import DashaCalculator from "./DashaCalculator";

const URL = "https://www.bhavishai.in/tools/dasha-calculator";

export const metadata = {
  title: "Free Vimshottari Dasha Calculator — Your Current Dasha & Antardasha",
  description:
    "Find your current Vimshottari Mahadasha and Antardasha by date, time and place of birth. Free, no sign-up — high-precision astronomical calculation.",
  keywords: ["vimshottari dasha calculator", "current dasha", "dasha bhukti calculator", "mahadasha calculator", "antardasha calculator", "my current dasha"],
  alternates: { canonical: URL },
  openGraph: { title: "Free Vimshottari Dasha Calculator | BhavishAI", description: "Find your current Mahadasha and Antardasha by date, time and place of birth. Free, no sign-up.", url: URL, type: "website" },
};

export default function Page() {
  return (
    <ToolPageShell
      slug="dasha-calculator"
      crumb="Dasha Calculator"
      h1="Free Vimshottari Dasha Calculator"
      intro={<p>Find the <strong>Mahadasha</strong> and <strong>Antardasha</strong> you are running right now. The Vimshottari Dasha is Vedic astrology&apos;s primary timing system — it reveals <em>when</em> the potential in your chart tends to unfold. Enter your birth details below.</p>}
      calculator={<DashaCalculator />}
      sections={[
        { h2: "What is the Vimshottari Dasha?", body: <p>The <strong>Vimshottari Dasha</strong> divides life into a 120-year cycle split among the nine planets. Each planet rules a stretch of time called a <strong>Mahadasha</strong>, subdivided into <strong>Antardashas</strong>. The planet ruling your current period strongly colours the themes and events of that phase.</p> },
        { h2: "Why the current dasha matters", body: <p>Two people with similar charts can have very different years because they are running different dashas. Knowing your current Mahadasha and Antardasha is the first step to understanding the <em>timing</em> of career moves, marriage, and major changes — which your full report maps out in detail.</p> },
      ]}
      faq={[
        { q: "How do I find my current dasha?", a: "Enter your date, time and place of birth. Because the dasha sequence starts from your birth Nakshatra, an accurate birth time gives the most reliable current period." },
        { q: "What is the difference between Mahadasha and Antardasha?", a: "The Mahadasha is the main planetary period (years long); the Antardasha is a sub-period within it (months to a couple of years) ruled by another planet, refining the theme." },
        { q: "Why is birth time important for dasha?", a: "The dasha sequence is anchored to the Moon's exact position at birth (your Nakshatra), which depends on the birth time — so an accurate time matters for correct dates." },
      ]}
      related={[
        { href: "/tools/nakshatra-calculator", label: "Nakshatra (birth star) calculator →" },
        { href: "/tools/rashi-calculator", label: "Moon sign (Rashi) calculator →" },
        { href: "/tools/kaal-sarp-calculator", label: "Kaal Sarp Dosha calculator →" },
      ]}
    />
  );
}
