"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "../../lib/supabase-browser";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <span className="text-xl font-bold gradient-text">BhavishAI</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="/#how-it-works" className="text-muted hover:text-foreground transition-colors text-sm">
              How It Works
            </a>
            <a href="/#features" className="text-muted hover:text-foreground transition-colors text-sm">
              Features
            </a>
            <a href="/#pricing" className="text-muted hover:text-foreground transition-colors text-sm">
              Pricing
            </a>
            <a href="/#faq" className="text-muted hover:text-foreground transition-colors text-sm">
              FAQ
            </a>

            {!loading && user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-muted hover:text-foreground transition-colors text-sm"
                >
                  My Reports
                </Link>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-primary text-sm font-bold">
                        {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-muted hover:text-foreground text-sm transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : !loading ? (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 border border-border hover:border-primary-light text-foreground px-4 py-2 rounded-full text-sm font-medium transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in
              </button>
            ) : null}

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
              <a href="/#how-it-works" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                How It Works
              </a>
              <a href="/#features" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                Features
              </a>
              <a href="/#pricing" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                Pricing
              </a>
              <a href="/#faq" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                FAQ
              </a>

              {user ? (
                <>
                  <Link href="/dashboard" className="text-muted hover:text-foreground transition-colors" onClick={() => setMobileOpen(false)}>
                    My Reports
                  </Link>
                  <button onClick={handleLogout} className="text-left text-muted hover:text-foreground transition-colors">
                    Logout ({user.user_metadata?.full_name || user.email})
                  </button>
                </>
              ) : (
                <button onClick={handleLogin} className="text-left text-muted hover:text-foreground transition-colors">
                  Sign in with Google
                </button>
              )}

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
