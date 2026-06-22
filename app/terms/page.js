import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "Terms of Service",
  description: "BhavishAI Terms of Service - Rules and conditions for using our AI astrology service.",
};

export default function TermsOfService() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Terms of Service</h1>
          <p className="text-muted mb-6">Last updated: June 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-muted leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Acceptance of Terms</h2>
              <p>By accessing and using BhavishAI (&ldquo;the Service&rdquo;), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Description of Service</h2>
              <p>BhavishAI provides AI-generated Vedic astrology reports based on user-provided birth details. Our reports are generated using artificial intelligence and astronomical calculations. The service includes:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Free preview of the first page of your astrology report</li>
                <li>Paid access to the complete 20-page personalized report</li>
                <li>Email delivery of purchased reports (optional)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Entertainment Disclaimer</h2>
              <p className="font-medium text-accent">IMPORTANT: BhavishAI reports are provided for entertainment and informational purposes only.</p>
              <p className="mt-2">Our AI-generated astrology reports should NOT be used as a substitute for professional advice including but not limited to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Medical or health decisions</li>
                <li>Financial or investment decisions</li>
                <li>Legal decisions</li>
                <li>Major life decisions (marriage, career changes, etc.)</li>
              </ul>
              <p className="mt-4">We do not guarantee the accuracy of predictions. Astrology is a belief system and results may vary.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. Payment & Pricing</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The complete report is available for a one-time payment of ₹199 (or as displayed at the time of purchase)</li>
                <li>Payments are processed securely through Razorpay</li>
                <li>Prices may change without prior notice for future purchases</li>
                <li>All prices are inclusive of applicable taxes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Digital Product Delivery</h2>
              <p>Upon successful payment:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your full report is delivered instantly on-screen</li>
                <li>A backup copy is emailed to your provided email address (if provided)</li>
                <li>You can print or save the report for personal use</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. User Responsibilities</h2>
              <p>You agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide accurate birth details for report generation</li>
                <li>Not redistribute, resell, or commercially use generated reports</li>
                <li>Not attempt to reverse-engineer or exploit our AI system</li>
                <li>Not use the service for any unlawful purpose</li>
                <li>Be at least 13 years of age to use this service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Intellectual Property</h2>
              <p>All content on BhavishAI, including design, text, graphics, logos, and AI-generated reports, is the property of BhavishAI. You receive a personal, non-transferable license to use your purchased report for personal purposes only.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Limitation of Liability</h2>
              <p>BhavishAI and its creators shall not be liable for any damages arising from the use or inability to use our service. This includes but is not limited to damages from reliance on report content, service interruptions, or data loss.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Modifications to Service</h2>
              <p>We reserve the right to modify, suspend, or discontinue any part of the service at any time without notice. We are not liable to you or any third party for any modification, suspension, or discontinuance.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">10. Governing Law</h2>
              <p>These Terms are governed by the laws of India. Any disputes shall be resolved in the courts of [Your City], India.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">11. Contact</h2>
              <p>For questions about these Terms, contact us at:</p>
              <p className="mt-2">Email: <a href="mailto:support@bhavishai.in" className="text-primary-light hover:underline">support@bhavishai.in</a></p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
