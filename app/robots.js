export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/report/full", "/admin"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
