import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { JsonLd, breadcrumbSchema } from "../../lib/schema";

const BASE_URL = "https://www.bhavishai.in";

// Shared layout + SEO shell for a free tool page. Keeps every /tools/* page
// consistent (breadcrumb, H1, intro, the calculator, an educational body, FAQ
// schema, related-tools links, footer) without repeating boilerplate.
//
// Props:
//   slug       - e.g. "rashi-calculator"
//   crumb      - short breadcrumb label
//   h1, intro  - page heading + intro paragraph (intro may be JSX)
//   calculator - the client calculator component (already imported by the page)
//   sections   - [{ h2, body }] educational content
//   faq        - [{ q, a }] rendered as visible FAQ + FAQPage schema
//   related    - [{ href, label }] internal links
export default function ToolPageShell({ slug, crumb, h1, intro, calculator, sections = [], faq = [], related = [] }) {
  const url = `${BASE_URL}/tools/${slug}`;

  const faqSchema = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  const breadcrumbs = breadcrumbSchema([
    { name: "Home", url: BASE_URL },
    { name: "Tools", url: `${BASE_URL}/tools` },
    { name: crumb, url },
  ]);

  return (
    <>
      {faqSchema && <JsonLd data={faqSchema} />}
      <JsonLd data={breadcrumbs} />
      <Header />
      <main className="flex-1">
        <section className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
          <nav className="text-xs text-muted mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary-light">Home</Link>
            <span className="mx-1">/</span>
            <span>Tools</span>
            <span className="mx-1">/</span>
            <span className="text-foreground">{crumb}</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{h1}</h1>
          <div className="text-muted mb-8 leading-relaxed">{intro}</div>

          {calculator}

          <div className="mt-12 space-y-8">
            {sections.map((s, i) => (
              <div key={i}>
                <h2 className="text-2xl font-bold mb-3">{s.h2}</h2>
                <div className="text-foreground/90 leading-relaxed">{s.body}</div>
              </div>
            ))}

            {faq.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-3">Frequently asked questions</h2>
                <div className="space-y-4">
                  {faq.map((f, i) => (
                    <div key={i}>
                      <h3 className="font-semibold text-foreground">{f.q}</h3>
                      <p className="text-foreground/80 leading-relaxed">{f.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <h2 className="text-xl font-bold mb-2">Want your complete birth chart reading?</h2>
              <p className="text-muted mb-4 leading-relaxed">
                Our personalized report analyses your entire chart — career, marriage, dashas,
                remedies and your year ahead — computed from your exact birth details.
              </p>
              <Link href="/get-report" className="inline-block rounded-full bg-primary hover:opacity-90 text-white font-semibold px-8 py-3 transition">
                Get My Full Kundli Report →
              </Link>
              <p className="text-xs text-muted mt-2">From ₹299 · ready in 60 seconds</p>
            </div>

            {related.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-3">Related free tools</h2>
                <ul className="list-disc list-inside text-primary-light space-y-1">
                  {related.map((r, i) => (
                    <li key={i}><Link href={r.href} className="hover:underline">{r.label}</Link></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
