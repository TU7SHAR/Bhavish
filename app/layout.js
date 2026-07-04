import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import AttributionCapture from "./components/AttributionCapture";
import VisitorTracker from "./components/VisitorTracker";
import { organizationSchema, websiteSchema } from "../lib/schema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://www.bhavishai.in"),
  title: {
    default: "BhavishAI - AI-Powered Vedic Astrology Reports | Janam Kundli Online",
    template: "%s | BhavishAI",
  },
  description:
    "Get your personalized 20-page Vedic astrology report in 60 seconds. AI-powered Janam Kundli, career predictions, marriage compatibility, and life guidance based on Swiss Ephemeris calculations.",
  keywords: [
    "kundli",
    "janam kundli",
    "vedic astrology",
    "birth chart",
    "astrology report",
    "AI astrology",
    "rashifal",
    "horoscope",
    "kundli online",
    "free kundli",
    "kundli matching",
    "career astrology",
    "marriage prediction",
    "AI kundli",
    "vedic horoscope",
    "janam patrika",
    "dasha prediction",
    "nakshatra analysis",
  ],
  authors: [{ name: "BhavishAI" }],
  creator: "BhavishAI",
  publisher: "BhavishAI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || "",
  },
  alternates: {
    canonical: "https://www.bhavishai.in",
  },
  openGraph: {
    title: "BhavishAI - Your Future, Revealed by AI",
    description: "Get a personalized 20-page Vedic astrology report in 60 seconds. Career, love, health & spiritual guidance based on Swiss Ephemeris calculations.",
    url: "https://www.bhavishai.in",
    siteName: "BhavishAI",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "BhavishAI - AI-Powered Vedic Astrology Reports",
    description: "Your personalized 20-page birth chart report in 60 seconds. Career, love, health & spiritual guidance.",
  },
};

export default function RootLayout({ children }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <head>
        {/* Global structured data: Organization + WebSite (SEO/AEO/LLM) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        {/* Google Analytics */}
        {gaId && gaId !== "your_ga_id_here" && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
        {/* Meta Pixel Code */}
        {pixelId && pixelId !== "your_meta_pixel_id_here" && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${pixelId}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Suspense fallback={null}><AttributionCapture /></Suspense>
        <Suspense fallback={null}><VisitorTracker /></Suspense>
        <Analytics />
        <SpeedInsights />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
