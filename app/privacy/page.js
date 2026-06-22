import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "Privacy Policy",
  description: "BhavishAI Privacy Policy - How we collect, use, and protect your personal information.",
};

export default function PrivacyPolicy() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Privacy Policy</h1>
          <p className="text-muted mb-6">Last updated: June 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-muted leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Information We Collect</h2>
              <p>When you use BhavishAI, we collect the following information:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-foreground">Birth Details:</strong> Name, date of birth, time of birth, place of birth, and gender — used solely to generate your astrology report.</li>
                <li><strong className="text-foreground">Email Address:</strong> Optional — used only to send you a backup copy of your purchased report.</li>
                <li><strong className="text-foreground">Payment Information:</strong> Processed securely by Razorpay. We do NOT store your card/UPI details.</li>
                <li><strong className="text-foreground">Usage Data:</strong> Anonymous analytics (page views, device type) to improve our service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>To generate your personalized Vedic astrology report</li>
                <li>To deliver your report via email (if email provided)</li>
                <li>To process your payment through Razorpay</li>
                <li>To improve our AI model and service quality</li>
                <li>To send transactional emails related to your purchase</li>
              </ul>
              <p className="mt-4">We do NOT use your data for marketing without your explicit consent. We do NOT sell your personal information to third parties.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Data Storage & Security</h2>
              <p>Your data is stored securely using industry-standard encryption (TLS/SSL). Birth details are used in real-time to generate reports and are not permanently stored in our databases unless required for report re-delivery. Payment processing is handled entirely by Razorpay, a PCI-DSS compliant payment gateway.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. Third-Party Services</h2>
              <p>We use the following third-party services:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-foreground">Google Gemini AI:</strong> For generating astrology report content</li>
                <li><strong className="text-foreground">Razorpay:</strong> For secure payment processing</li>
                <li><strong className="text-foreground">Resend:</strong> For email delivery</li>
                <li><strong className="text-foreground">Vercel:</strong> For website hosting and analytics</li>
                <li><strong className="text-foreground">Meta Pixel:</strong> For advertising analytics (anonymized)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Cookies & Tracking</h2>
              <p>We use essential cookies for website functionality and the Meta Pixel for advertising purposes. You can disable cookies in your browser settings, though some features may not work correctly.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Request access to your personal data</li>
                <li>Request deletion of your data</li>
                <li>Opt out of marketing communications</li>
                <li>Request a copy of your data in portable format</li>
              </ul>
              <p className="mt-4">To exercise these rights, email us at <a href="mailto:support@bhavishai.in" className="text-primary-light hover:underline">support@bhavishai.in</a></p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Children&apos;s Privacy</h2>
              <p>BhavishAI is not intended for users under 13 years of age. We do not knowingly collect information from children under 13.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Changes to This Policy</h2>
              <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of our service constitutes acceptance of the updated policy.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Contact Us</h2>
              <p>For questions about this Privacy Policy, contact us at:</p>
              <p className="mt-2">Email: <a href="mailto:support@bhavishai.in" className="text-primary-light hover:underline">support@bhavishai.in</a></p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
