import ToolPageShell from "../ToolPageShell";
import KaalSarpCalculator from "./KaalSarpCalculator";

const URL = "https://www.bhavishai.in/tools/kaal-sarp-calculator";

export const metadata = {
  title: "Free Kaal Sarp Dosha Calculator — Check by Date of Birth & Time",
  description:
    "Check your Kaal Sarp Dosha instantly by date, time and place of birth. Free, no sign-up — computed by checking all planets against the Rahu–Ketu axis.",
  keywords: ["kaal sarp dosha calculator", "kaalsarp dosha check", "kaal sarp dosh calculator", "kaal sarp yoga calculator", "check kaal sarp dosha"],
  alternates: { canonical: URL },
  openGraph: { title: "Free Kaal Sarp Dosha Calculator | BhavishAI", description: "Check your Kaal Sarp Dosha by date, time and place of birth. Free, no sign-up.", url: URL, type: "website" },
};

export default function Page() {
  return (
    <ToolPageShell
      slug="kaal-sarp-calculator"
      crumb="Kaal Sarp Calculator"
      h1="Free Kaal Sarp Dosha Calculator"
      intro={<p>Check whether your chart has <strong>Kaal Sarp Dosha (Yoga)</strong> — the placement where all seven planets fall on one side of the Rahu–Ketu axis. Enter your birth details and we&apos;ll compute it deterministically from your exact planetary positions.</p>}
      calculator={<KaalSarpCalculator />}
      sections={[
        { h2: "What is Kaal Sarp Dosha?", body: <p><strong>Kaal Sarp Dosha</strong> forms when all seven classical planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn) are hemmed between the shadow points <strong>Rahu and Ketu</strong>. Traditionally it is associated with delays, sudden ups and downs, and intensity — though its real effect always depends on the complete chart.</p> },
        { h2: "How this calculator checks it", body: <p>We compute the exact longitude of every planet and Rahu/Ketu, then check whether all seven planets fall on a single side of the Rahu–Ketu axis. If even one planet sits on the other side, there is <strong>no</strong> Kaal Sarp Dosha — not even a partial one, a common misconception.</p> },
      ]}
      faq={[
        { q: "How do I check for Kaal Sarp Dosha?", a: "Enter your date, time and place of birth. The tool computes all planetary positions and checks them against the Rahu–Ketu axis to determine whether Kaal Sarp Dosha is present, and its type." },
        { q: "Is Kaal Sarp Dosha always bad?", a: "No. It is one factor among many. Classical astrology notes that a strong chart, favourable dashas and remedies can greatly reduce any effect. Many successful people have this yoga." },
        { q: "What are the types of Kaal Sarp Dosha?", a: "There are twelve named types (Anant, Kulik, Vasuki, Shankhpal, Padma, Mahapadma, Takshak, Karkotak, Shankhachud, Ghatak, Vishdhar, Sheshnag) based on which house Rahu occupies." },
      ]}
      related={[
        { href: "/tools/manglik-calculator", label: "Manglik Dosha calculator →" },
        { href: "/tools/dasha-calculator", label: "Current Vimshottari Dasha calculator →" },
        { href: "/tools/rashi-calculator", label: "Moon sign (Rashi) calculator →" },
      ]}
    />
  );
}
