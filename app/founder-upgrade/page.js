"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";

// Founder Access is no longer sold to new customers (replaced by the three-tier
// Essential / Premium / Master model). Existing Founder members are grandfathered
// and keep their access via the dashboard (/founder/new).
//
// This page previously hosted the ₹999 post-purchase Founder upsell. It now
// simply forwards buyers to their full report so no old link 404s.
export default function FounderUpgradeRetired() {
  const router = useRouter();

  useEffect(() => {
    const paymentVerified =
      sessionStorage.getItem("paymentVerified") || localStorage.getItem("paymentVerified_backup");
    router.replace(paymentVerified ? "/report/full" : "/");
  }, [router]);

  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted">Taking you to your report...</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
