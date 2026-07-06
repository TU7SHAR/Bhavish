"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const email = (searchParams.get("email") || "").trim();

  const [status, setStatus] = useState("idle"); // idle | loading | done | error | resubscribed
  const [message, setMessage] = useState("");

  const call = async (resubscribe) => {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resubscribe }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setStatus(resubscribe ? "resubscribed" : "done");
        setMessage(json.message || (resubscribe ? "You're subscribed again." : "You've been unsubscribed."));
      } else {
        setStatus("error");
        setMessage(json.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6">
        <div className="bg-surface border border-border rounded-2xl p-8 text-center">
          {/* No email in the link */}
          {!email && (
            <>
              <div className="text-4xl mb-4">✉️</div>
              <h1 className="text-2xl font-bold mb-2">Manage Email Preferences</h1>
              <p className="text-muted text-sm">
                We couldn&apos;t find an email address in this link. If you&apos;d like to
                unsubscribe, please open the unsubscribe link from one of our emails,
                or write to{" "}
                <a href="mailto:support@bhavishai.in" className="text-primary-light hover:text-primary">
                  support@bhavishai.in
                </a>{" "}
                and we&apos;ll take care of it.
              </p>
            </>
          )}

          {/* Confirm screen (explicit action — avoids email-scanner auto-unsubscribes) */}
          {email && (status === "idle" || status === "loading" || status === "error") && (
            <>
              <div className="text-4xl mb-4">🔕</div>
              <h1 className="text-2xl font-bold mb-2">Unsubscribe</h1>
              <p className="text-muted text-sm mb-1">
                You&apos;re about to stop receiving guidance and reminder emails at:
              </p>
              <p className="text-foreground font-medium mb-6 break-all">{email}</p>

              {status === "error" && (
                <p className="text-red-400 text-sm mb-4">{message}</p>
              )}

              <button
                onClick={() => call(false)}
                disabled={status === "loading"}
                className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-3 rounded-full font-semibold transition-all"
              >
                {status === "loading" ? "Unsubscribing..." : "Unsubscribe me"}
              </button>

              <p className="text-muted text-xs mt-4">
                Changed your mind?{" "}
                <Link href="/" className="text-primary-light hover:text-primary">
                  Return to BhavishAI
                </Link>
              </p>
            </>
          )}

          {/* Done screen */}
          {email && status === "done" && (
            <>
              <div className="text-4xl mb-4">✅</div>
              <h1 className="text-2xl font-bold text-green-400 mb-2">You&apos;re unsubscribed</h1>
              <p className="text-muted text-sm mb-1">
                {email} will no longer receive our guidance and reminder emails.
              </p>
              <p className="text-muted text-xs mb-6">
                You may still receive essential messages related to a report you purchased.
              </p>

              <button
                onClick={() => call(true)}
                disabled={status === "loading"}
                className="w-full bg-surface-light hover:bg-border text-foreground py-2.5 rounded-full text-sm font-medium transition-all border border-border"
              >
                Actually, resubscribe me
              </button>

              <p className="text-muted text-xs mt-4">
                <Link href="/" className="text-primary-light hover:text-primary">
                  Return to BhavishAI
                </Link>
              </p>
            </>
          )}

          {/* Resubscribed screen */}
          {email && status === "resubscribed" && (
            <>
              <div className="text-4xl mb-4">🔔</div>
              <h1 className="text-2xl font-bold text-primary-light mb-2">You&apos;re subscribed again</h1>
              <p className="text-muted text-sm mb-6">
                {email} will continue receiving our guidance emails.
              </p>
              <p className="text-muted text-xs">
                <Link href="/" className="text-primary-light hover:text-primary">
                  Return to BhavishAI
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
            <div className="text-muted text-sm">Loading...</div>
          </main>
        }
      >
        <UnsubscribeInner />
      </Suspense>
      <Footer />
    </>
  );
}
