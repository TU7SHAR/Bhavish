import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-border py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">✨</span>
              <span className="text-xl font-bold gradient-text">BhavishAI</span>
            </div>
            <p className="text-muted text-sm max-w-md">
              AI-powered Vedic astrology reports based on your exact birth details. 
              Get personalized insights about your life, career, relationships, and future 
              powered by ancient wisdom and modern AI technology.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-foreground font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/get-report" className="text-muted hover:text-primary-light transition-colors">Get Your Report</Link></li>
              <li><a href="#how-it-works" className="text-muted hover:text-primary-light transition-colors">How It Works</a></li>
              <li><a href="#features" className="text-muted hover:text-primary-light transition-colors">Features</a></li>
              <li><a href="#pricing" className="text-muted hover:text-primary-light transition-colors">Pricing</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-foreground font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="text-muted hover:text-primary-light transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-muted hover:text-primary-light transition-colors">Terms of Service</Link></li>
              <li><Link href="/refund" className="text-muted hover:text-primary-light transition-colors">Refund Policy</Link></li>
              <li><a href="mailto:support@bhavishai.in" className="text-muted hover:text-primary-light transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted text-sm">
            &copy; {new Date().getFullYear()} BhavishAI. All rights reserved.
          </p>
          <p className="text-muted text-xs">
            For entertainment purposes. Consult professionals for major life decisions.
          </p>
        </div>
      </div>
    </footer>
  );
}
