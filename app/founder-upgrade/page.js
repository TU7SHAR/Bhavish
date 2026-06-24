"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function FounderUpgrade() {
  const router = useRouter();
  const [reportId, setReportId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    const storedReportId = sessionStorage.getItem("upgradeReportId");
    const storedUser = sessionStorage.getItem("userData") || localStorage.getItem("userData_backup");
    const paymentVerified = sessionStorage.getItem("paymentVerified") || localStorage.getItem("paymentVerified_backup");

    // Must have paid to see this page
    if (!paymentVerified || !storedReportId) {
      router.push("/");
      return;
    }

    setReportId(storedReportId);
    if (storedUser) setUserData(JSON.parse(storedUser));
    setLoading(false);
  }, [router]);

  const goToReport = () => {
    router.push("/report/full");
  };

  const handleUpgrade = async () => {
    if (upgradeLoading) return;
    setUpgradeLoading(true);

    try {
      const orderRes = await fetch("/api/create-upgrade-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          email: userData?.email,
          name: userData?.name,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BhavishAI",
        description: "Lifetime Founder Member Upgrade",
        order_id: orderData.orderId,
        handler: async function (response) {
          const verifyRes = await fetch("/api/verify-upgrade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              reportId,
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            // Fire Meta Pixel for upgrade purchase
            if (typeof window !== "undefined" && window.fbq) {
              window.fbq("track", "Purchase", {
                value: parseInt(process.env.NEXT_PUBLIC_PRICE_UPGRADE || "999"),
                currency: "INR",
                content_type: "upgrade",
                content_ids: [reportId],
              });
            }
            // Notify owner of the upgrade sale
            fetch("/api/notify-sale", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reportId,
                customerName: userData?.name,
                customerEmail: userData?.email,
                paymentId: response.razorpay_payment_id,
                amount: process.env.NEXT_PUBLIC_PRICE_UPGRADE || "999",
                placeOfBirth: "FOUNDER UPGRADE",
                dateOfBirth: "-",
              }),
            }).catch(console.error);

            router.push("/report/full");
          } else {
            alert("Upgrade verification failed. Your report is still available.");
            router.push("/report/full");
          }
        },
        prefill: {
          name: userData?.name || "",
          email: userData?.email || "",
        },
        theme: { color: "#8b5cf6" },
        config: {
          display: {
            blocks: {
              upi: { name: "Pay via UPI", instruments: [{ method: "upi", flows: ["intent", "collect", "qr"] }] },
              other: { name: "Other Methods", instruments: [{ method: "card" }, { method: "netbanking" }, { method: "wallet" }] },
            },
            sequence: ["block.upi", "block.other"],
            preferences: { show_default_blocks: false },
          },
        },
        modal: {
          ondismiss: function () { setUpgradeLoading(false); },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      alert(error.message || "Something went wrong.");
      setUpgradeLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      <Header />
      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-surface border-2 border-accent rounded-2xl p-8 text-center glow">
            <div className="text-5xl mb-4">🎖️</div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Founding Member Upgrade</h1>
            <p className="text-muted mb-6">Thank you for joining BhavishAI.</p>

            <p className="text-foreground mb-6 leading-relaxed">
              Before you view your report, lock in <strong>lifetime access</strong> to all future reports and premium guidance.
            </p>

            <div className="bg-background border border-border rounded-xl p-6 mb-6">
              <p className="text-muted text-sm mb-1">Normal Value</p>
              <p className="text-2xl text-muted line-through mb-2">₹3,599</p>
              <p className="text-muted text-sm mb-1">Today Only</p>
              <p className="text-5xl font-bold gradient-text">₹999</p>
            </div>

            <ul className="text-left space-y-2 mb-8 text-sm">
              {[
                "Lifetime access to all your reports",
                "Unlimited report regenerations",
                "Priority report generation",
                "All future premium features included",
                "Founding member badge",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-muted">
                  <svg className="w-5 h-5 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="w-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-white py-4 rounded-full font-semibold text-lg transition-all pulse-glow mb-3"
            >
              {upgradeLoading ? "Processing..." : "Upgrade My Account — ₹999"}
            </button>

            <button
              onClick={goToReport}
              className="w-full text-muted hover:text-foreground text-sm transition-colors py-2"
            >
              No thanks, show my report
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
