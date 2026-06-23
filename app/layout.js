import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://bhavishai.in"),
  title: {
    default: "BhavishAI - AI-Powered Vedic Astrology Reports",
    template: "%s | BhavishAI",
  },
  description:
    "Get your personalized 20-page Vedic astrology report in 60 seconds. AI-powered Janam Kundli, career predictions, marriage compatibility, and life guidance.",
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
    // Add your verification codes here when ready
    // google: "your-google-verification-code",
  },
};

export default function RootLayout({ children }) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
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
        <Analytics />
        <SpeedInsights />
        {children}
      </body>
    </html>
  );
}
