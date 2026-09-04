import Link from "next/link";
import Header from "./Header";
import Footer from "./Footer";
import { JsonLd, breadcrumbSchema } from "../../lib/schema";

const BASE_URL = "https://www.bhavishai.in";

// Reusable SEO landing-page ("money page") layout for topic clusters.
// Server component. Renders: breadcrumb (visible + schema), H1 + intro,
// primary CTA into the funnel, a body of H2 sections, an FAQ block
// (rendered + FAQPage schema), related internal links, and a final CTA.
//
// Props:
//   breadcrumbTrail: [{ name, url }]           — for BreadcrumbList schema + visible trail
//   h1, intro                                  — page hero
//   primaryCta: { href, label, sub }           — hero CTA (defaults to /get-report)
//   sections: [{ heading, body }]              — main content (body may be string or JSX)
//   faqs: [{ q, a }]                           — rendered + emitted as FAQPage schema
//   related: [{ href, label }]                 — internal links (tools, blog, other clusters)
export default function ClusterLanding({
  breadcrumbTrail = [],
  h1,
  intro,
  primaryCta = { href: "/get-report", label: "Get My Free Kundli Preview →", sub: "From ₹299 · ready in 60 seconds · no sign-up for the preview" },
  sections = [],
  faqs = [],
  related = [],
}) {
  const breadcrumbs = breadcrumbSchema(
    breadcrumbTrail.map((b) => ({ name: b.name, url: b.url.startsWith("http") ? b.url : `${BASE_URL}${b.url}` }))
  );

  const faqSchema = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }
    : null;

  return (
    <>
      <JsonLd data={breadcrumbs} />
      {faqSchema && <JsonLd data={faqSchema} />}
      <Header />

      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
          {/* Visible breadcrumb */}
          <nav className="text-xs text-muted mb-4" aria-label="Breadcrumb">
            {breadcrumbTrail.map((b, i) => (
              <span key={b.url}>
                {i > 0 && <span className="mx-1">/</span>}
                {i < breadcrumbTrail.length - 1 ? (
                  <Link href={b.url} className="hover:text-primary-light">{b.name}</Link>
                ) : (
                  <span className="text-foreground">{b.name}</span>
                )}
              </span>
            ))}
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold mb-4">{h1}</h1>
          <p className="text-muted mb-6 leading-relaxed text-lg">{intro}</p>

          <div className="mb-10">
            <Link
              href={primaryCta.href}
              className="inline-block rounded-full bg-primary hover:opacity-90 text-white font-semibold px-8 py-3 transition"
            >
              {primaryCta.label}
            </Link>
            {primaryCta.sub && <p className="text-xs text-muted mt-2">{primaryCta.sub}</p>}
          </div>

          {/* Body sections */}
          <div className="space-y-8">
            {sections.map((s) => (
              <section key={s.heading}>
                <h2 className="text-2xl font-bold mb-3">{s.heading}</h2>
                <div className="text-foreground/90 leading-relaxed space-y-3">{s.body}</div>
              </section>
            ))}
          </div>

          {/* FAQ */}
          {faqs.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
              <div className="space-y-3">
                {faqs.map((f) => (
                  <details key={f.q} className="bg-surface border border-border rounded-xl p-5 group">
                    <summary className="font-medium cursor-pointer list-none flex items-center justify-between">
                      {f.q}
                      <span className="text-muted group-open:rotate-180 transition-transform">⌄</span>
                    </summary>
                    <p className="text-muted text-sm mt-3 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Final CTA */}
          <section className="mt-12 bg-surface border border-border rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold mb-2">See it in your own chart</h2>
            <p className="text-muted mb-4 leading-relaxed">
              Get a personalized 20-page report computed from your exact date, time and place of birth.
            </p>
            <Link
              href={primaryCta.href}
              className="inline-block rounded-full bg-primary hover:opacity-90 text-white font-semibold px-8 py-3 transition"
            >
              {primaryCta.label}
            </Link>
          </section>

          {/* Related / internal links */}
          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-bold mb-3">Related</h2>
              <ul className="list-disc list-inside text-primary-light space-y-1">
                {related.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className="hover:underline">{r.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </main>

      <Footer />
    </>
  );
}
