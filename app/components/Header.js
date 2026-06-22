"use client";

import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">&#x2728;</span>
            <span className="text-xl font-bold gradient-text">BhavishAI</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-muted hover:text-foreground transition-colors text-sm">
              How It Works
            </a>
            <a href="#features" className="text-muted hover:text-foreground transition-colors text-sm">
              Features
            </a>
            <a href="#pricing" className="text-muted hover:text-foreground transition-colors text-sm">
              Pricing
            </a>
            <a href="#faq" className="text-muted hover:text-foreground transition-colors text-sm">
              FAQ
            </a>
            <Link
              href="/get-report"
              className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-full text-sm font-medium transition-all glow-hover"
            >
              Get Your Report
            </Link>
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              <a href="#how-it-works" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                How It Works
              </a>
              <a href="#features" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                Features
              </a>
              <a href="#pricing" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                Pricing
              </a>
              <a href="#faq" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                FAQ
              </a>
              <Link
                href="/get-report"
                className="bg-primary hover:bg-primary-dark text-white px-5 py-2 rounded-full text-sm font-medium text-center transition-all"
                onClick={() => setMobileOpen(false)}
              >
                Get Your Report
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
