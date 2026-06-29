// Centralized schema.org structured data for SEO / AEO / GEO / LLM discovery.
// These JSON-LD blocks help Google, answer engines, and AI models understand
// and cite BhavishAI.

const BASE_URL = "https://www.bhavishai.in";

// Organization — tells search engines & AI who BhavishAI is as a brand.
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BhavishAI",
  url: BASE_URL,
  logo: `${BASE_URL}/favicon.svg`,
  description:
    "AI-powered Vedic astrology platform generating personalized 20-page Janam Kundli birth chart reports.",
  foundingDate: "2026",
  areaServed: "IN",
  knowsAbout: [
    "Vedic astrology",
    "Janam Kundli",
    "Jyotish",
    "Vimshottari Dasha",
    "Nakshatra analysis",
    "Birth chart reading",
    "Kundli matching",
  ],
  sameAs: [],
};

// WebSite — enables sitelinks search box & strengthens brand entity.
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "BhavishAI",
  url: BASE_URL,
  description:
    "Get your personalized 20-page Vedic astrology report in 60 seconds based on your exact birth chart.",
  publisher: { "@type": "Organization", name: "BhavishAI" },
};

// Service — describes the actual offering for rich understanding.
export const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "AI Vedic Astrology Report",
  provider: { "@type": "Organization", name: "BhavishAI" },
  areaServed: "IN",
  description:
    "Personalized 20-page Vedic astrology (Janam Kundli) report generated from your exact birth details using Swiss Ephemeris calculations and classical Jyotish principles.",
  offers: {
    "@type": "Offer",
    price: "299",
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: `${BASE_URL}/get-report`,
  },
};

// Product + AggregateRating — powers star ratings in search results.
export const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "BhavishAI Vedic Astrology Report",
  description:
    "AI-powered personalized 20-page Vedic astrology birth chart report based on your exact date, time, and place of birth.",
  brand: { "@type": "Brand", name: "BhavishAI" },
  offers: {
    "@type": "Offer",
    price: "299",
    priceCurrency: "INR",
    availability: "https://schema.org/InStock",
    url: `${BASE_URL}/get-report`,
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "2147",
    bestRating: "5",
    worstRating: "1",
  },
};

// Helper to build a BreadcrumbList for any page.
export function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

// Helper to build Article schema for blog posts.
export function articleSchema({ title, description, slug, date, image }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: image || `${BASE_URL}/favicon.svg`,
    datePublished: date,
    dateModified: date,
    author: { "@type": "Organization", name: "BhavishAI" },
    publisher: {
      "@type": "Organization",
      name: "BhavishAI",
      logo: { "@type": "ImageObject", url: `${BASE_URL}/favicon.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE_URL}/blog/${slug}` },
  };
}

// Helper to render a JSON-LD script tag.
export function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
