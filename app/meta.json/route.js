import { NextResponse } from "next/server";

// Serves /meta.json — metadata file consumed by Meta/Facebook's crawler
// (facebookexternalHit). Without this, Facebook's bot repeatedly hits the
// URL and gets 404s, polluting Vercel logs.
//
// This provides Facebook with structured site metadata for:
// - Domain verification context
// - Open Graph defaults
// - Ad pixel association
// - Business information for ad account linking
// - Content classification for better ad targeting

export const dynamic = "force-static";
export const revalidate = 86400; // Revalidate once per day

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

  const metadata = {
    // Site identification
    name: "BhavishAI",
    short_name: "BhavishAI",
    description:
      "AI-powered Vedic astrology platform. Get a personalized 20-page Janam Kundli report in 60 seconds based on Swiss Ephemeris calculations.",
    url: baseUrl,
    start_url: "/",
    display: "standalone",
    lang: "en-IN",

    // Business information
    business: {
      name: "BhavishAI",
      category: "Technology / Astrology Services",
      subcategory: "AI-Powered Vedic Astrology",
      country: "IN",
      currency: "INR",
      contact_email: "support@bhavishai.in",
      website: baseUrl,
    },

    // Open Graph defaults (used when Facebook scrapes pages without explicit OG tags)
    og: {
      title: "BhavishAI - Your Future, Revealed by AI",
      description:
        "Get a personalized 20-page Vedic astrology report in 60 seconds. Career, love, health & spiritual guidance based on Swiss Ephemeris calculations.",
      type: "website",
      url: baseUrl,
      site_name: "BhavishAI",
      locale: "en_IN",
    },

    // Meta Pixel / Facebook Ads integration
    pixel: {
      id: pixelId,
      events: [
        {
          name: "PageView",
          trigger: "page_load",
          description: "Fires on every page view",
        },
        {
          name: "Lead",
          trigger: "form_submission",
          page: "/get-report",
          description: "User submits birth details form",
        },
        {
          name: "ViewContent",
          trigger: "page_view",
          page: "/report/preview",
          description: "User views their free preview report",
        },
        {
          name: "InitiateCheckout",
          trigger: "button_click",
          page: "/report/preview",
          description: "User clicks the payment button",
        },
        {
          name: "Purchase",
          trigger: "payment_success",
          page: "/report/preview",
          description: "Payment verified successfully via Razorpay",
          value_currency: "INR",
          value_range: "299-448",
        },
      ],
    },

    // Product / service catalog information (helps Meta Ads with targeting)
    products: [
      {
        id: "vedic_report_full",
        name: "Complete Vedic Astrology Report (20 Pages)",
        description:
          "AI-powered personalized Janam Kundli with career, marriage, health, dasha analysis, remedies, and monthly predictions.",
        price: 299,
        currency: "INR",
        availability: "in_stock",
        category: "Astrology > Birth Chart > Vedic",
        url: `${baseUrl}/get-report`,
      },
      {
        id: "12_month_guidance",
        name: "12-Month Personal Guidance Pack",
        description:
          "Monthly personalized predictions and remedies delivered every month for 12 months based on your birth chart.",
        price: 149,
        currency: "INR",
        availability: "in_stock",
        category: "Astrology > Monthly Predictions > Vedic",
        url: `${baseUrl}/get-report`,
      },
      {
        id: "founder_membership",
        name: "Lifetime Founder Membership",
        description:
          "Unlimited report generations, priority support, and all future premium features for life.",
        price: 999,
        currency: "INR",
        availability: "in_stock",
        category: "Astrology > Membership > Premium",
        url: `${baseUrl}/founder-upgrade`,
      },
    ],

    // Conversion funnel structure (for Facebook CAPI / event matching)
    funnel: {
      stages: [
        { name: "landing", path: "/", event: "PageView" },
        { name: "form", path: "/get-report", event: "Lead" },
        { name: "preview", path: "/report/preview", event: "ViewContent" },
        { name: "checkout", path: "/report/preview", event: "InitiateCheckout" },
        { name: "purchase", path: "/report/preview", event: "Purchase" },
        { name: "upsell", path: "/founder-upgrade", event: "ViewContent" },
      ],
      average_time_to_purchase: "3-5 minutes",
      primary_conversion: "Purchase",
    },

    // Content pages (helps Facebook understand site structure)
    pages: [
      { path: "/", title: "Home", type: "landing_page" },
      { path: "/get-report", title: "Get Your Report", type: "lead_form" },
      { path: "/report/preview", title: "Report Preview", type: "product_page" },
      { path: "/report/full", title: "Full Report", type: "content" },
      { path: "/founder-upgrade", title: "Founder Upgrade", type: "upsell" },
      { path: "/blog", title: "Blog", type: "blog_index" },
      { path: "/contact", title: "Contact", type: "contact" },
      { path: "/privacy", title: "Privacy Policy", type: "legal" },
      { path: "/terms", title: "Terms of Service", type: "legal" },
      { path: "/refund", title: "Refund Policy", type: "legal" },
    ],

    // Target audience (helps Meta optimize ad delivery)
    audience: {
      primary_country: "IN",
      languages: ["en", "hi"],
      age_range: "18-55",
      interests: [
        "Vedic astrology",
        "Horoscope",
        "Kundli",
        "Spirituality",
        "Rashifal",
        "Janam Kundli",
        "Astrology predictions",
        "Marriage compatibility",
        "Career guidance",
      ],
    },

    // Technical metadata
    technical: {
      framework: "Next.js",
      hosting: "Vercel",
      ssl: true,
      responsive: true,
      pwa_capable: false,
      spa: false,
    },

    // Schema version
    version: "1.0.0",
    last_updated: new Date().toISOString().split("T")[0],
  };

  return NextResponse.json(metadata, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}
