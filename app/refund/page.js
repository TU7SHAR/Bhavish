import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata = {
  title: "Refund Policy",
  description: "BhavishAI Refund Policy - Our policy on refunds for digital astrology reports.",
};

export default function RefundPolicy() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-8">Refund Policy</h1>
          <p className="text-muted mb-6">Last updated: June 2026</p>

          <div className="prose prose-invert max-w-none space-y-6 text-muted leading-relaxed">
            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Digital Product — No Refund Policy</h2>
              <p>BhavishAI provides <strong className="text-foreground">digital products</strong> (AI-generated astrology reports) that are delivered instantly upon payment. Due to the nature of digital goods:</p>
              <div className="bg-surface border border-border rounded-xl p-6 mt-4">
                <p className="text-foreground font-medium">Once a report is generated and delivered, refunds are generally not available.</p>
              </div>
              <p className="mt-4">This is because:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The report is delivered instantly — you receive the product immediately</li>
                <li>AI computing resources are consumed during generation</li>
                <li>The content is personalized and cannot be &ldquo;returned&rdquo;</li>
                <li>You get a free preview before purchasing to make an informed decision</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Free Preview — Try Before You Buy</h2>
              <p>We provide a <strong className="text-foreground">free preview</strong> (first page of your report) specifically so you can evaluate the quality and relevance before making a purchase. This ensures you know exactly what you&apos;re paying for.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Exceptions — When We WILL Refund</h2>
              <p>We will issue a full refund in the following cases:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-foreground">Technical failure:</strong> If you paid but did not receive your report due to a system error</li>
                <li><strong className="text-foreground">Duplicate payment:</strong> If you were charged twice for the same report</li>
                <li><strong className="text-foreground">Report not generated:</strong> If our system fails to generate your report after payment</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. How to Request a Refund</h2>
              <p>If you believe you qualify for a refund under the exceptions above:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Email us at <a href="mailto:support@bhavishai.in" className="text-primary-light hover:underline">support@bhavishai.in</a></li>
                <li>Include your Report ID (format: RPT-XXXXX-XXXXX)</li>
                <li>Include your payment ID or transaction reference</li>
                <li>Describe the issue you experienced</li>
              </ol>
              <p className="mt-4">We will review your request within 48-72 hours and process eligible refunds within 5-7 business days.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Refund Processing</h2>
              <p>Approved refunds will be credited back to the original payment method:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-foreground">UPI:</strong> Refund within 24-48 hours</li>
                <li><strong className="text-foreground">Credit/Debit Card:</strong> Refund within 5-7 business days</li>
                <li><strong className="text-foreground">Net Banking:</strong> Refund within 5-7 business days</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Chargebacks</h2>
              <p>We request that you contact us directly before initiating a chargeback with your bank. We are committed to resolving any legitimate issues quickly and fairly. Unauthorized chargebacks for delivered digital products may result in account restrictions.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Contact Us</h2>
              <p>For refund requests or questions about this policy:</p>
              <p className="mt-2">Email: <a href="mailto:support@bhavishai.in" className="text-primary-light hover:underline">support@bhavishai.in</a></p>
              <p className="mt-1">Response time: Within 48 hours</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
