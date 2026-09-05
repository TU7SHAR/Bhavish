import ClusterLanding from "../../components/ClusterLanding";

const BASE_URL = "https://www.bhavishai.in";
const URL = `${BASE_URL}/marriage/manglik-dosha`;

export const metadata = {
  title: "Manglik Dosha — Meaning, Houses, Effects & Remedies (2026)",
  description:
    "Manglik Dosha (Mangal Dosha) explained: which houses cause it, its effect on marriage, cancellations and remedies. Check your Manglik status free with our calculator.",
  keywords: [
    "manglik dosha",
    "mangal dosha",
    "manglik dosha meaning",
    "manglik dosha remedies",
    "manglik dosha effects on marriage",
    "mangal dosha cancellation",
    "is manglik dosha bad",
  ],
  alternates: { canonical: URL },
  openGraph: {
    title: "Manglik Dosha — Meaning, Effects & Remedies | BhavishAI",
    description: "What Manglik (Mangal) Dosha is, the houses that cause it, its effect on marriage, and remedies. Free calculator included.",
    url: URL,
    type: "article",
  },
};

export default function Page() {
  return (
    <ClusterLanding
      breadcrumbTrail={[
        { name: "Home", url: "/" },
        { name: "Marriage", url: "/marriage/manglik-dosha" },
        { name: "Manglik Dosha", url: "/marriage/manglik-dosha" },
      ]}
      h1="Manglik Dosha (Mangal Dosha): Meaning, Effects & Remedies"
      intro="Manglik Dosha — also called Mangal Dosha or Kuja Dosha — is a placement of Mars that is traditionally examined before marriage. Here's what it actually means, which houses cause it, whether it's really a problem, and how it can be balanced."
      primaryCta={{ href: "/tools/manglik-calculator", label: "Check My Manglik Status (Free) →", sub: "Instant · no sign-up · uses our full astronomical engine" }}
      sections={[
        {
          heading: "What is Manglik Dosha?",
          body: (
            <p>Manglik Dosha occurs when Mars sits in the <strong>1st, 2nd, 4th, 7th, 8th or 12th house</strong> — counted from the Ascendant (Lagna), the Moon, or Venus. Mars governs energy, drive and conflict, so these placements are traditionally weighed when assessing marriage and long-term harmony.</p>
          ),
        },
        {
          heading: "Which houses cause it (and a common myth)",
          body: (
            <p>The Manglik houses are <strong>1, 2, 4, 7, 8 and 12</strong>. A widespread myth is that the 9th house causes Manglik Dosha — it does not. Our calculator checks Mars against the correct houses from all three reference points, exactly as classical Jyotish prescribes.</p>
          ),
        },
        {
          heading: "Does it really affect marriage?",
          body: (
            <>
              <p>Not automatically. Classical astrology recognises many <strong>cancellations</strong> (Manglik dosha bhanga) — certain signs, aspects, or a partner who is also Manglik can neutralise it. The real impact depends on the strength of Mars, the 7th house and its lord, and current Dasha periods.</p>
              <p>In other words, &quot;Am I Manglik?&quot; is only the first question. &quot;How strong is it, is it cancelled, and what does my full chart say?&quot; is what actually matters.</p>
            </>
          ),
        },
        {
          heading: "Remedies",
          body: (
            <p>Traditional, safe remedies include specific mantras, charitable acts, and discipline-based practices — always chosen in the context of your full chart rather than applied blindly. Our full report provides remedies matched to <em>your</em> Mars placement.</p>
          ),
        },
      ]}
      faqs={[
        { q: "Which houses cause Manglik Dosha?", a: "The 1st, 2nd, 4th, 7th, 8th and 12th houses — from the Ascendant, Moon or Venus. The 9th house does NOT cause Manglik Dosha." },
        { q: "How do I check if I am Manglik?", a: "Use our free Manglik calculator — enter your date, time and place of birth and it computes whether Mars falls in a Manglik house." },
        { q: "Is Manglik Dosha always bad?", a: "No. There are recognised cancellations, and its real effect depends on the whole chart. Many Manglik people have long, happy marriages." },
        { q: "Can two Manglik people marry?", a: "In classical astrology, when both partners are Manglik the dosha is often considered mutually cancelled. A full chart comparison is still recommended." },
      ]}
      related={[
        { href: "/tools/manglik-calculator", label: "Free Manglik Dosha calculator →" },
        { href: "/blog/what-is-manglik-dosha", label: "Deep dive: What is Manglik Dosha? →" },
        { href: "/blog/kundli-matching-for-marriage", label: "Kundli matching for marriage →" },
        { href: "/kundli/janam-kundli", label: "What is a Janam Kundli? →" },
      ]}
    />
  );
}
