"use client";

import { useState, useEffect, useMemo } from "react";

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const [actionLoading, setActionLoading] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = async (t, secret) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/data?tab=${t}`, {
        headers: { Authorization: `Bearer ${secret || password}` },
      });
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setLastRefresh(new Date());
      } else {
        if (res.status === 401) {
          setAuthed(false);
          setLoginError("Wrong secret. Try again.");
        }
        setData({ error: json.error });
      }
    } catch (err) {
      setData({ error: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authed && tab !== "actions" && tab !== "analytics") fetchData(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);


  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoginError("");
    setLoading(true);
    // Validate against the API before entering
    try {
      const res = await fetch(`/api/admin/data?tab=overview`, {
        headers: { Authorization: `Bearer ${password}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
        setAuthed(true);
      } else {
        setLoginError("Wrong secret. Access denied.");
      }
    } catch (err) {
      setLoginError(err.message);
    }
    setLoading(false);
  };

  const runAction = async (url, key) => {
    setActionResult(null);
    setActionLoading(key);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${password}` } });
      const json = await res.json();
      setActionResult({ key, ...json });
    } catch (err) {
      setActionResult({ key, error: err.message });
    }
    setActionLoading("");
  };


  // ---------- LOGIN SCREEN ----------
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#070710] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px]" />

        <form onSubmit={handleLogin} className="relative bg-[#11111f]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-purple-500/30">
              🔮
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">BhavishAI</h1>
              <p className="text-[11px] uppercase tracking-widest text-purple-400 font-semibold">Super Admin</p>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-5 mb-5">Restricted area. Enter your master key to continue.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Master key..."
            autoFocus
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white mb-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
          {loginError && <p className="text-red-400 text-sm mb-3">⛔ {loginError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-purple-600/30"
          >
            {loading ? "Verifying..." : "Unlock Dashboard →"}
          </button>
        </form>
      </div>
    );
  }


  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "analytics", label: "Analytics", icon: "🔬" },
    { id: "leads", label: "Leads", icon: "👥" },
    { id: "paid-details", label: "Paid People", icon: "💎" },
    { id: "all-details", label: "Everyone", icon: "🔍" },
    { id: "payments", label: "Payments", icon: "💰" },
    { id: "emails", label: "Emails", icon: "📧" },
    { id: "blog", label: "Blog", icon: "📝" },
    { id: "actions", label: "Actions", icon: "⚡" },
  ];

  // ---------- MAIN SHELL ----------
  return (
    <div className="min-h-screen bg-[#070710] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#070710]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              🔮
            </div>
            <div>
              <h1 className="font-bold leading-tight">BhavishAI</h1>
              <p className="text-[10px] uppercase tracking-widest text-purple-400 font-semibold">Super Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[11px] text-gray-500 hidden sm:block">
                Updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button
              onClick={() => fetchData(tab)}
              className="text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              ↻ Refresh
            </button>
            <button
              onClick={() => { setAuthed(false); setPassword(""); setData(null); }}
              className="text-sm px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto pb-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                tab === t.id
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto p-4">
        {loading && <LoadingState />}
        {data?.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
            Error: {data.error}
          </div>
        )}
        {!loading && data && !data.error && (
          <>
            {tab === "overview" && <OverviewTab data={data.overview} />}
            {tab === "analytics" && <AnalyticsTab password={password} />}
            {tab === "leads" && <LeadsTab leads={data.leads} />}
            {tab === "paid-details" && <PaidDetailsTab paid={data.paid} password={password} />}
            {tab === "all-details" && <AllDetailsTab all={data.all} password={password} />}
            {tab === "payments" && <PaymentsTab payments={data.payments} />}
            {tab === "emails" && <EmailsTab emails={data.emails} />}
            {tab === "blog" && <BlogTab blogPosts={data.blogPosts} password={password} onRefresh={() => fetchData("blog")} />}
            {tab === "actions" && <ActionsTab runAction={runAction} actionResult={actionResult} actionLoading={actionLoading} />}
          </>
        )}
      </main>
    </div>
  );
}


// ---------- SHARED ----------
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      <p className="text-gray-500 text-sm animate-pulse">Loading data...</p>
    </div>
  );
}

function StatCard({ label, value, sub, accent = "purple", icon }) {
  const accents = {
    purple: "from-purple-500/10 to-transparent border-purple-500/20",
    green: "from-green-500/10 to-transparent border-green-500/20",
    blue: "from-blue-500/10 to-transparent border-blue-500/20",
    amber: "from-amber-500/10 to-transparent border-amber-500/20",
    pink: "from-pink-500/10 to-transparent border-pink-500/20",
  };
  return (
    <div className={`bg-gradient-to-br ${accents[accent]} bg-[#11111f] border rounded-2xl p-4 transition-transform hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">{label}</p>
        {icon && <span className="text-sm opacity-60">{icon}</span>}
      </div>
      <p className="text-2xl font-bold mt-1.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-purple-400 mb-3 flex items-center gap-2">
      <span className="w-6 h-px bg-purple-500/50" />{children}
    </h2>
  );
}


// ---------- OVERVIEW ----------
function OverviewTab({ data }) {
  const [dateFilter, setDateFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  if (!data) return null;

  // Calculate filtered stats based on date selection
  const getFilteredStats = () => {
    const reports = data.reportDates || [];
    if (reports.length === 0) return { leads: 0, paid: 0, revenue: 0, net: 0, conversion: "0" };

    // IST offset
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_OFFSET);

    let fromDate = null;
    let toDate = null;

    if (dateFilter === "today") {
      fromDate = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_OFFSET);
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(nowIST);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      fromDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()) - IST_OFFSET);
      toDate = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_OFFSET);
    } else if (dateFilter === "7days") {
      fromDate = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    } else if (dateFilter === "30days") {
      fromDate = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    } else if (dateFilter === "custom" && customFrom) {
      fromDate = new Date(customFrom + "T00:00:00+05:30");
      if (customTo) toDate = new Date(customTo + "T23:59:59+05:30");
    }
    // "all" = no filter

    const filtered = reports.filter((r) => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });

    const leads = filtered.length;
    const paid = filtered.filter((r) => r.payment_status === "paid").length;
    const founders = filtered.filter((r) => r.is_founder_member).length;
    const guidance = filtered.filter((r) => r.has_12_month_guidance).length;
    const gross = (paid * 299) + (founders * 999) + (guidance * 149);
    const fees = Math.round(gross * 2.36 / 100);
    const net = gross - fees;
    const conversion = leads > 0 ? ((paid / leads) * 100).toFixed(1) : "0";

    return { leads, paid, gross, net, fees, conversion, founders, guidance };
  };

  const filtered = getFilteredStats();

  // When a filter is active, use filtered stats for the hero banner
  const display = dateFilter === "all" ? {
    revenue: data.totalRevenue || 0,
    net: data.netRevenue || 0,
    fees: data.totalFees || 0,
    paid: data.totalPaid,
    leads: data.totalLeads,
    conversion: data.conversionRate,
  } : {
    revenue: filtered.gross,
    net: filtered.net,
    fees: filtered.fees,
    paid: filtered.paid,
    leads: filtered.leads,
    conversion: filtered.conversion,
  };

  return (
    <div className="space-y-8">
      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "today", label: "Today" },
          { id: "yesterday", label: "Yesterday" },
          { id: "7days", label: "Last 7 Days" },
          { id: "30days", label: "Last 30 Days" },
          { id: "all", label: "All Time" },
          { id: "custom", label: "Custom" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setDateFilter(f.id)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
              dateFilter === f.id
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500 text-white shadow-lg shadow-purple-600/20"
                : "bg-[#11111f] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
            }`}
          >
            {f.label}
          </button>
        ))}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-[#11111f] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"
            />
            <span className="text-gray-500 text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-[#11111f] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"
            />
          </div>
        )}
        {dateFilter !== "all" && (
          <span className="text-[11px] text-purple-400 ml-2">Showing filtered stats</span>
        )}
      </div>

      {/* Hero revenue banner — updates based on date filter */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 via-indigo-600/10 to-transparent p-6">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="relative grid grid-cols-2 md:grid-cols-5 gap-6">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Gross Revenue</p>
            <p className="text-3xl md:text-4xl font-bold mt-1 bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">₹{display.revenue.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">In Your Account</p>
            <p className="text-3xl md:text-4xl font-bold mt-1 text-green-400">₹{display.net.toLocaleString("en-IN")}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">after Razorpay fees (₹{display.fees.toLocaleString("en-IN")})</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Paid Customers</p>
            <p className="text-3xl md:text-4xl font-bold mt-1">{display.paid}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Total Leads</p>
            <p className="text-3xl md:text-4xl font-bold mt-1">{display.leads}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Conversion</p>
            <p className="text-3xl md:text-4xl font-bold mt-1 text-green-400">{display.conversion}%</p>
          </div>
        </div>
      </div>

      {/* Settlement Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[#11111f] border border-green-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">Settled (in your bank)</p>
            <span className="text-sm opacity-60">🏦</span>
          </div>
          <p className="text-2xl font-bold mt-1.5 text-green-400">₹{(data.settledAmount || 0).toLocaleString("en-IN")}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">gross ₹{(data.settledGross || 0).toLocaleString("en-IN")} − fees ₹{(data.settledFees || 0).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-[#11111f] border border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">Pending Settlement</p>
            <span className="text-sm opacity-60">⏳</span>
          </div>
          <p className="text-2xl font-bold mt-1.5 text-amber-400">₹{(data.pendingAmount || 0).toLocaleString("en-IN")}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">last 3 days — settles T+2 business days</p>
        </div>
        <div className="bg-[#11111f] border border-red-500/20 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">Razorpay Fees (total)</p>
            <span className="text-sm opacity-60">💸</span>
          </div>
          <p className="text-2xl font-bold mt-1.5 text-red-400">₹{(data.totalFees || 0).toLocaleString("en-IN")}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">2% + GST = 2.36% per transaction</p>
        </div>
      </div>

      <div>
        <SectionTitle>Today</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Leads Today" value={data.todayLeads} accent="blue" icon="👥" />
          <StatCard label="Paid Today" value={data.todayPaid} accent="green" icon="✅" />
          <StatCard label="Revenue Today" value={`₹${(data.todayPaid * 299).toLocaleString("en-IN")}`} accent="purple" icon="💰" />
          <StatCard label="7-Day Leads" value={data.recentLeads} sub={`${data.recentPaid} paid`} accent="amber" icon="📈" />
        </div>
      </div>

      <div>
        <SectionTitle>Sales Breakdown</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Unpaid Leads" value={data.totalUnpaid} accent="amber" />
          <StatCard label="Founder Members" value={data.founderMembers} sub="₹999 upgrade" accent="pink" />
          <StatCard label="12-Mo Guidance" value={data.with12MonthGuidance} sub="₹149 add-on" accent="blue" />
          <StatCard label="Avg / Customer" value={`₹${data.totalPaid ? Math.round(data.totalRevenue / data.totalPaid) : 0}`} accent="green" />
        </div>
      </div>

      <div>
        <SectionTitle>Email Engine</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="With Email" value={data.withEmail} accent="blue" />
          <StatCard label="Drafts Ready" value={data.withDrafts} accent="purple" />
          <StatCard label="Emails Sent" value={data.totalEmailsSent} accent="green" />
          <StatCard label="Open Rate" value={`${data.openRate}%`} sub={`${data.totalOpens} opens`} accent="pink" icon="👁" />
        </div>
      </div>

      <div>
        <SectionTitle>Paid Customer Emails</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Report Emails Opened" value={data.paidReportOpened || 0} sub={`of ${data.totalPaid} paid`} accent="green" icon="📄" />
          <StatCard label="Thank You Sent" value={data.paidThankYouSent || 0} sub={`of ${data.totalPaid} paid`} accent="pink" icon="🙏" />
          <StatCard label="Thank You Opened" value={data.paidThankYouOpened || 0} sub={data.paidThankYouSent ? `${Math.round((data.paidThankYouOpened / data.paidThankYouSent) * 100)}% open rate` : "—"} accent="purple" icon="👁" />
        </div>
      </div>
    </div>
  );
}


// ---------- FILTER BAR ----------
function FilterBar({ search, setSearch, children, count, total }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="relative flex-1 min-w-[200px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email..."
          className="w-full bg-[#11111f] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
      </div>
      {children}
      <span className="text-xs text-gray-500 ml-auto">
        {count} of {total}
      </span>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
        active
          ? "bg-purple-600 border-purple-500 text-white"
          : "bg-[#11111f] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}


// ---------- ANALYTICS ----------
function AnalyticsTab({ password }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("peak");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/analytics", { headers: { Authorization: `Bearer ${password}` } });
        if (res.ok) setData(await res.json());
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [password]);

  if (loading) return <LoadingState />;
  if (!data) return <p className="text-gray-500 text-center py-12">Failed to load analytics.</p>;

  const subTabs = [
    { id: "peak", label: "Peak Hours", icon: "⏰" },
    { id: "demographics", label: "Demographics", icon: "👤" },
    { id: "geography", label: "Geography", icon: "📍" },
    { id: "questions-paid", label: "Questions (Paid)", icon: "💰" },
    { id: "questions-unpaid", label: "Questions (Unpaid)", icon: "👀" },
    { id: "funnel", label: "Conversion Speed", icon: "⚡" },
    { id: "sources", label: "Source Performance", icon: "📣" },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tab nav */}
      <div className="flex flex-wrap gap-2">
        {subTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
              subTab === t.id
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500 text-white"
                : "bg-[#11111f] border-white/10 text-gray-400 hover:text-white hover:border-white/20"
            }`}
          >
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Peak Hours */}
      {subTab === "peak" && (
        <div className="space-y-6">
          <SectionTitle>Hourly Activity (IST)</SectionTitle>
          <div className="bg-[#11111f] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-400 mb-4">Leads (blue) vs Conversions (green) by hour of day</p>
            <div className="flex items-end gap-1 h-40">
              {data.peakHours.hourlyLeads.map((count, i) => {
                const maxVal = Math.max(...data.peakHours.hourlyLeads, 1);
                const paidCount = data.peakHours.hourlyPaid[i] || 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${i}:00 IST — ${count} leads, ${paidCount} paid`}>
                    <div className="w-full flex flex-col items-center justify-end h-32">
                      <div className="w-full bg-blue-500/40 rounded-t" style={{ height: `${(count / maxVal) * 100}%`, minHeight: count > 0 ? "2px" : "0" }}></div>
                      {paidCount > 0 && <div className="w-full bg-green-500 rounded-t mt-0.5" style={{ height: `${(paidCount / maxVal) * 100}%`, minHeight: "2px" }}></div>}
                    </div>
                    <span className="text-[9px] text-gray-600">{i}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500/40 rounded"></span> Leads</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-500 rounded"></span> Paid</span>
            </div>
          </div>

          <SectionTitle>Day of Week</SectionTitle>
          <div className="grid grid-cols-7 gap-2">
            {data.peakHours.dayNames.map((day, i) => (
              <div key={day} className="bg-[#11111f] border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 font-medium">{day}</p>
                <p className="text-lg font-bold mt-1">{data.peakHours.dailyLeads[i]}</p>
                <p className="text-[10px] text-green-400">{data.peakHours.dailyPaid[i]} paid</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demographics */}
      {subTab === "demographics" && (
        <div className="space-y-6">
          <SectionTitle>Gender Breakdown</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(data.demographics.genderStats).map(([gender, stats]) => (
              <div key={gender} className="bg-[#11111f] border border-white/10 rounded-2xl p-5">
                <p className="text-gray-400 text-xs uppercase tracking-wider capitalize">{gender}</p>
                <p className="text-3xl font-bold mt-2">{stats.leads}</p>
                <p className="text-sm text-green-400 mt-1">{stats.paid} paid ({stats.leads > 0 ? ((stats.paid / stats.leads) * 100).toFixed(1) : 0}%)</p>
              </div>
            ))}
          </div>

          <SectionTitle>Device Breakdown</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(data.demographics.deviceStats).map(([device, stats]) => (
              <div key={device} className="bg-[#11111f] border border-white/10 rounded-2xl p-5">
                <p className="text-gray-400 text-xs uppercase tracking-wider">{device === "mobile" ? "📱 Mobile" : "💻 Desktop"}</p>
                <p className="text-3xl font-bold mt-2">{stats.leads} <span className="text-lg text-gray-500">leads</span></p>
                <p className="text-sm text-green-400 mt-1">{stats.paid} converted ({stats.leads > 0 ? ((stats.paid / stats.leads) * 100).toFixed(1) : 0}% conv rate)</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geography */}
      {subTab === "geography" && (
        <div>
          <SectionTitle>Top Cities (Leads vs Conversions)</SectionTitle>
          <div className="bg-[#11111f] border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                  <th className="p-3">#</th>
                  <th className="p-3">City</th>
                  <th className="p-3 text-center">Leads</th>
                  <th className="p-3 text-center">Paid</th>
                  <th className="p-3 text-center">Conv %</th>
                </tr>
              </thead>
              <tbody>
                {data.geography.topCities.map((c, i) => (
                  <tr key={c.city} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-3 text-gray-500">{i + 1}</td>
                    <td className="p-3 font-medium">{c.city}</td>
                    <td className="p-3 text-center">{c.leads}</td>
                    <td className="p-3 text-center text-green-400">{c.paid}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${parseFloat(c.convRate) > 5 ? "bg-green-500/20 text-green-400" : parseFloat(c.convRate) > 0 ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-gray-500"}`}>
                        {c.convRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Questions (Paid) */}
      {subTab === "questions-paid" && (
        <div>
          <SectionTitle>What Paying Customers Ask ({data.questions.paidTotal} questions)</SectionTitle>
          <p className="text-gray-400 text-sm mb-4">These are the pain points people will actually PAY to solve. Use these themes in your ad copy.</p>
          <div className="space-y-3">
            {data.questions.paidCategories.map((cat) => (
              <div key={cat.category} className="bg-[#11111f] border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-green-400">{cat.category}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-green-500/20 text-green-400 font-medium">{cat.count} paid</span>
                </div>
                <div className="space-y-1.5">
                  {cat.examples.map((q, i) => (
                    <p key={i} className="text-xs text-gray-400 pl-3 border-l-2 border-green-500/30">&ldquo;{q}&rdquo;</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Questions (Unpaid) */}
      {subTab === "questions-unpaid" && (
        <div>
          <SectionTitle>What Non-Paying Leads Ask ({data.questions.unpaidTotal} questions)</SectionTitle>
          <p className="text-gray-400 text-sm mb-4">These people were interested but didn&apos;t convert. Compare with paid questions to understand what&apos;s different.</p>
          <div className="space-y-3">
            {data.questions.unpaidCategories.map((cat) => (
              <div key={cat.category} className="bg-[#11111f] border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-amber-400">{cat.category}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/20 text-amber-400 font-medium">{cat.count} unpaid</span>
                </div>
                <div className="space-y-1.5">
                  {cat.examples.map((q, i) => (
                    <p key={i} className="text-xs text-gray-400 pl-3 border-l-2 border-amber-500/30">&ldquo;{q}&rdquo;</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversion Speed */}
      {subTab === "funnel" && (
        <div className="space-y-6">
          <SectionTitle>How Fast Do People Pay?</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Average Time" value={data.funnel.avgTimeToPay ? `${data.funnel.avgTimeToPay}m` : "—"} sub="minutes from preview" accent="purple" icon="⏱" />
            <StatCard label="Median Time" value={data.funnel.medianTimeToPay ? `${data.funnel.medianTimeToPay}m` : "—"} sub="half pay faster than this" accent="blue" icon="📊" />
            <StatCard label="Under 5 min" value={data.funnel.under5min} sub={`of ${data.funnel.total} (${data.funnel.total ? Math.round(data.funnel.under5min / data.funnel.total * 100) : 0}%)`} accent="green" icon="⚡" />
            <StatCard label="Over 1 hour" value={data.funnel.over1hr} sub="slow deciders" accent="amber" icon="🐢" />
          </div>
          <div className="bg-[#11111f] border border-white/10 rounded-2xl p-5">
            <p className="text-sm text-gray-300 mb-2">Insight:</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              {data.funnel.under5min > data.funnel.total * 0.5
                ? "Most of your customers are impulse buyers — they decide within 5 minutes. Your preview/paywall is working well for quick conversions."
                : data.funnel.over1hr > data.funnel.total * 0.3
                ? "A significant portion takes over an hour to decide. Your email nurture sequence is important for these slow deciders."
                : "Your customers have mixed decision speeds. Both the immediate paywall and the nurture emails are contributing to conversions."}
            </p>
          </div>
        </div>
      )}

      {/* Source Performance */}
      {subTab === "sources" && (
        <div>
          <SectionTitle>Traffic Source Performance</SectionTitle>
          <div className="bg-[#11111f] border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                  <th className="p-3">Source</th>
                  <th className="p-3 text-center">Leads</th>
                  <th className="p-3 text-center">Paid</th>
                  <th className="p-3 text-center">Conv %</th>
                  <th className="p-3 text-center">Revenue (net)</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.source} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-3 font-medium">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        s.source === "facebook" || s.source === "fb" || s.source === "ig" ? "bg-blue-600/20 text-blue-400" :
                        s.source === "google" ? "bg-red-500/20 text-red-400" :
                        "bg-white/10 text-gray-400"
                      }`}>{s.source}</span>
                    </td>
                    <td className="p-3 text-center">{s.leads}</td>
                    <td className="p-3 text-center text-green-400">{s.paid}</td>
                    <td className="p-3 text-center">{s.convRate}%</td>
                    <td className="p-3 text-center text-green-400">₹{Math.round(s.paid * 299 * 0.9764).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


// ---------- LEADS ----------
const ALL_COLUMNS = [
  { id: "name", label: "Name", default: true },
  { id: "email", label: "Email", default: true },
  { id: "city", label: "City", default: true },
  { id: "status", label: "Status", default: true },
  { id: "device", label: "Device", default: true },
  { id: "emails", label: "Emails", default: true },
  { id: "opens", label: "Opens", default: true },
  { id: "source", label: "Source", default: true },
  { id: "question", label: "Question", default: true },
  { id: "generated", label: "Generated At", default: true },
  { id: "gender", label: "Gender", default: false },
  { id: "dob", label: "DOB", default: false },
  { id: "place", label: "Place", default: false },
];

function LeadsTab({ leads }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [visibleCols, setVisibleCols] = useState(() => ALL_COLUMNS.filter((c) => c.default).map((c) => c.id));
  const [showColPicker, setShowColPicker] = useState(false);

  const toggleCol = (id) => {
    setVisibleCols((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const filtered = useMemo(() => {
    if (!leads) return [];
    let out = leads.filter((l) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || (l.name || "").toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q) || (l.city || "").toLowerCase().includes(q);
      const matchesStatus =
        status === "all" ? true :
        status === "paid" ? l.payment_status === "paid" :
        status === "unpaid" ? l.payment_status === "unpaid" :
        status === "founder" ? l.is_founder_member :
        status === "mobile" ? l.device_type === "mobile" :
        status === "desktop" ? l.device_type === "desktop" :
        status === "hasQuestion" ? (l.personal_question && l.personal_question.trim()) :
        status === "opened" ? (Array.isArray(l.email_opens) && l.email_opens.length > 0) : true;
      return matchesSearch && matchesStatus;
    });
    out.sort((a, b) => {
      if (sort === "recent") return new Date(b.created_at) - new Date(a.created_at);
      if (sort === "oldest") return new Date(a.created_at) - new Date(b.created_at);
      if (sort === "emails") return (b.emails_sent_count || 0) - (a.emails_sent_count || 0);
      if (sort === "opens") return (Array.isArray(b.email_opens) ? b.email_opens.length : 0) - (Array.isArray(a.email_opens) ? a.email_opens.length : 0);
      return 0;
    });
    return out;
  }, [leads, search, status, sort]);

  function getSource(lead) {
    if (!lead.attribution) return null;
    return lead.attribution.utm_source || (lead.attribution.fbclid ? "facebook" : lead.attribution.gclid ? "google" : null);
  }

  const show = (id) => visibleCols.includes(id);

  if (!leads) return null;
  return (
    <div>
      <FilterBar search={search} setSearch={setSearch} count={filtered.length} total={leads.length}>
        <Pill active={status === "all"} onClick={() => setStatus("all")}>All</Pill>
        <Pill active={status === "paid"} onClick={() => setStatus("paid")}>Paid</Pill>
        <Pill active={status === "unpaid"} onClick={() => setStatus("unpaid")}>Unpaid</Pill>
        <Pill active={status === "founder"} onClick={() => setStatus("founder")}>Founder</Pill>
        <Pill active={status === "mobile"} onClick={() => setStatus("mobile")}>Mobile</Pill>
        <Pill active={status === "desktop"} onClick={() => setStatus("desktop")}>Desktop</Pill>
        <Pill active={status === "hasQuestion"} onClick={() => setStatus("hasQuestion")}>Has Question</Pill>
        <Pill active={status === "opened"} onClick={() => setStatus("opened")}>Opened email</Pill>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-[#11111f] border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="recent">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="emails">Most emails sent</option>
          <option value="opens">Most opens</option>
        </select>
        {/* Column picker toggle */}
        <button
          onClick={() => setShowColPicker(!showColPicker)}
          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${showColPicker ? "bg-purple-600 border-purple-500 text-white" : "bg-[#11111f] border-white/10 text-gray-400 hover:text-white"}`}
        >
          ⚙️ Columns
        </button>
      </FilterBar>

      {/* Column visibility picker */}
      {showColPicker && (
        <div className="mb-4 bg-[#11111f] border border-white/10 rounded-xl p-3 flex flex-wrap gap-2">
          {ALL_COLUMNS.map((col) => (
            <label key={col.id} className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={visibleCols.includes(col.id)}
                onChange={() => toggleCol(col.id)}
                className="w-3 h-3 accent-purple-500"
              />
              <span className={visibleCols.includes(col.id) ? "text-gray-200" : "text-gray-500"}>{col.label}</span>
            </label>
          ))}
        </div>
      )}

      <div className="bg-[#11111f] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                {show("name") && <th className="p-3 font-medium">Name</th>}
                {show("email") && <th className="p-3 font-medium">Email</th>}
                {show("city") && <th className="p-3 font-medium">City</th>}
                {show("status") && <th className="p-3 font-medium">Status</th>}
                {show("device") && <th className="p-3 font-medium text-center">Device</th>}
                {show("emails") && <th className="p-3 font-medium text-center">Emails</th>}
                {show("opens") && <th className="p-3 font-medium text-center">Opens</th>}
                {show("source") && <th className="p-3 font-medium">Source</th>}
                {show("question") && <th className="p-3 font-medium">Question</th>}
                {show("generated") && <th className="p-3 font-medium">Generated At</th>}
                {show("gender") && <th className="p-3 font-medium">Gender</th>}
                {show("dob") && <th className="p-3 font-medium">DOB</th>}
                {show("place") && <th className="p-3 font-medium">Place</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const source = getSource(lead);
                return (
                  <tr key={lead.report_id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    {show("name") && <td className="p-3 font-medium whitespace-nowrap">{lead.name}</td>}
                    {show("email") && <td className="p-3 text-gray-400 text-xs">{lead.email || "—"}</td>}
                    {show("city") && <td className="p-3 text-gray-300 text-xs whitespace-nowrap">{lead.city || "—"}</td>}
                    {show("status") && <td className="p-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${lead.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"}`}>{lead.payment_status}</span>
                      {lead.is_founder_member && <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-pink-500/20 text-pink-400">F</span>}
                    </td>}
                    {show("device") && <td className="p-3 text-center">
                      {lead.device_type === "mobile" ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">📱</span>
                      : lead.device_type === "desktop" ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">💻</span>
                      : <span className="text-gray-600">—</span>}
                    </td>}
                    {show("emails") && <td className="p-3 text-center text-gray-300">{lead.emails_sent_count || 0}<span className="text-gray-600">/10</span></td>}
                    {show("opens") && <td className="p-3 text-center">
                      {Array.isArray(lead.email_opens) && lead.email_opens.length > 0 ? <span className="text-green-400 font-medium">{lead.email_opens.length}</span> : <span className="text-gray-600">0</span>}
                    </td>}
                    {show("source") && <td className="p-3 text-xs whitespace-nowrap">
                      {source ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${source === "facebook" || source === "fb" || source === "ig" ? "bg-blue-600/20 text-blue-400" : source === "google" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-gray-400"}`}>{source}</span> : <span className="text-gray-600">organic</span>}
                    </td>}
                    {show("question") && <td className="p-3 text-xs max-w-[200px]">
                      {lead.personal_question ? (
                        <details className="cursor-pointer">
                          <summary className="text-gray-400 truncate list-none">{lead.personal_question.length > 35 ? lead.personal_question.substring(0, 35) + "..." : lead.personal_question}</summary>
                          <p className="text-gray-300 mt-1 whitespace-normal bg-black/40 rounded-lg p-2 text-[11px] leading-relaxed">{lead.personal_question}</p>
                        </details>
                      ) : <span className="text-gray-600">—</span>}
                    </td>}
                    {show("generated") && <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{new Date(lead.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</td>}
                    {show("gender") && <td className="p-3 text-gray-400 text-xs capitalize">{lead.gender || "—"}</td>}
                    {show("dob") && <td className="p-3 text-gray-400 text-xs">{lead.date_of_birth || "—"}</td>}
                    {show("place") && <td className="p-3 text-gray-400 text-xs">{lead.place_of_birth || "—"}</td>}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={visibleCols.length} className="p-8 text-center text-gray-500">No leads match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ---------- PAYMENTS ----------
function PaymentsTab({ payments }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const filtered = useMemo(() => {
    if (!payments) return [];
    return payments.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q) || (p.payment_id || "").toLowerCase().includes(q);
      const matchesType =
        type === "all" ? true :
        type === "founder" ? p.is_founder_member :
        type === "guidance" ? p.has_12_month_guidance :
        type === "base" ? (!p.is_founder_member && !p.has_12_month_guidance) : true;
      return matchesSearch && matchesType;
    });
  }, [payments, search, type]);

  if (!payments) return null;
  const totalRevenue = payments.length * 299;
  const founderRevenue = payments.filter((p) => p.is_founder_member).length * 999;
  const guidanceRevenue = payments.filter((p) => p.has_12_month_guidance).length * 149;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Payments" value={payments.length} accent="green" icon="💳" />
        <StatCard label="Base Revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} sub="₹299 each" accent="purple" />
        <StatCard label="Founder Revenue" value={`₹${founderRevenue.toLocaleString("en-IN")}`} sub="₹999 each" accent="pink" />
        <StatCard label="Guidance Revenue" value={`₹${guidanceRevenue.toLocaleString("en-IN")}`} sub="₹149 each" accent="blue" />
      </div>

      <FilterBar search={search} setSearch={setSearch} count={filtered.length} total={payments.length}>
        <Pill active={type === "all"} onClick={() => setType("all")}>All</Pill>
        <Pill active={type === "base"} onClick={() => setType("base")}>Base only</Pill>
        <Pill active={type === "founder"} onClick={() => setType("founder")}>Founder</Pill>
        <Pill active={type === "guidance"} onClick={() => setType("guidance")}>Guidance</Pill>
      </FilterBar>

      <div className="bg-[#11111f] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Payment ID</th>
                <th className="p-3 font-medium">Add-ons</th>
                <th className="p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.report_id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-gray-400 text-xs">{p.email || "—"}</td>
                  <td className="p-3 text-xs font-mono text-gray-500">{p.payment_id || "—"}</td>
                  <td className="p-3">
                    {p.is_founder_member && <span className="px-2 py-0.5 rounded-full text-[11px] bg-pink-500/20 text-pink-400 mr-1">Founder ₹999</span>}
                    {p.has_12_month_guidance && <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/20 text-blue-400">Guidance ₹149</span>}
                    {!p.is_founder_member && !p.has_12_month_guidance && <span className="text-gray-600 text-xs">Base only</span>}
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No payments match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// ---------- EMAILS ----------
function EmailsTab({ emails }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    if (!emails) return [];
    return emails.filter((e) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || (e.name || "").toLowerCase().includes(q) || (e.email || "").toLowerCase().includes(q);
      const opens = Array.isArray(e.email_opens) ? e.email_opens.length : 0;
      const matchesFilter =
        filter === "all" ? true :
        filter === "opened" ? opens > 0 :
        filter === "notopened" ? (opens === 0 && (e.emails_sent_count || 0) > 0) :
        filter === "active" ? e.email_sequence_status === "active" :
        filter === "completed" ? e.email_sequence_status === "completed" : true;
      return matchesSearch && matchesFilter;
    });
  }, [emails, search, filter]);

  if (!emails) return null;
  return (
    <div>
      <FilterBar search={search} setSearch={setSearch} count={filtered.length} total={emails.length}>
        <Pill active={filter === "all"} onClick={() => setFilter("all")}>All</Pill>
        <Pill active={filter === "opened"} onClick={() => setFilter("opened")}>Opened</Pill>
        <Pill active={filter === "notopened"} onClick={() => setFilter("notopened")}>Not opened</Pill>
        <Pill active={filter === "active"} onClick={() => setFilter("active")}>Active</Pill>
        <Pill active={filter === "completed"} onClick={() => setFilter("completed")}>Completed</Pill>
      </FilterBar>

      <div className="bg-[#11111f] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Progress</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Last Sent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const opens = Array.isArray(e.email_opens) ? e.email_opens : [];
                const openNums = opens.map((o) => o.num);
                return (
                  <tr key={e.report_id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-3 font-medium">{e.name}</td>
                    <td className="p-3 text-gray-400 text-xs">{e.email}</td>
                    <td className="p-3">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div
                            key={i}
                            title={`Email ${i + 1}: ${i < (e.emails_sent_count || 0) ? (openNums.includes(i + 1) ? "Opened ✓" : "Sent, not opened") : "Not sent"}`}
                            className={`w-2.5 h-5 rounded-sm ${
                              openNums.includes(i + 1) ? "bg-green-500"
                              : i < (e.emails_sent_count || 0) ? "bg-amber-500/70"
                              : "bg-white/10"
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                        e.email_sequence_status === "completed" ? "bg-green-500/20 text-green-400"
                        : e.email_sequence_status === "active" ? "bg-blue-500/20 text-blue-400"
                        : "bg-gray-500/20 text-gray-400"
                      }`}>{e.email_sequence_status || "pending"}</span>
                    </td>
                    <td className="p-3 text-gray-500 text-xs">
                      {e.last_email_sent_at ? new Date(e.last_email_sent_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No emails match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-gray-500 flex flex-wrap items-center gap-4 mt-3">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-5 bg-green-500 rounded-sm inline-block" /> Opened</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-5 bg-amber-500/70 rounded-sm inline-block" /> Sent, not opened</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-5 bg-white/10 rounded-sm inline-block" /> Not sent yet</span>
      </div>
    </div>
  );
}


// ---------- ACTIONS ----------
function ActionCard({ title, desc, btnLabel, color, onClick, loading }) {
  const colors = {
    purple: "from-purple-600 to-indigo-600 shadow-purple-600/30",
    red: "from-red-600 to-rose-600 shadow-red-600/30",
    blue: "from-blue-600 to-cyan-600 shadow-blue-600/30",
    green: "from-green-600 to-emerald-600 shadow-green-600/30",
  };
  return (
    <div className="bg-[#11111f] border border-white/10 rounded-2xl p-5 flex flex-col">
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <p className="text-gray-400 text-sm mb-4 flex-1">{desc}</p>
      <button
        onClick={onClick}
        disabled={loading}
        className={`bg-gradient-to-r ${colors[color]} hover:opacity-90 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg self-start`}
      >
        {loading ? "Running..." : btnLabel}
      </button>
    </div>
  );
}

function ActionsTab({ runAction, actionResult, actionLoading }) {
  return (
    <div className="space-y-5">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-300 text-sm">
        ⚠️ These actions send real emails to real leads. Use Force Send carefully.
      </div>

      <SectionTitle>Scheduled Sends</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="📬 Send All Due Emails"
          desc="Checks the schedule (12h, 1d, 3d, 5d...) and sends ONLY emails that are due right now. Safe to run anytime — won't double-send."
          btnLabel="Send Due Now"
          color="purple"
          loading={actionLoading === "send"}
          onClick={() => runAction("/api/manual-send-emails", "send")}
        />
        <ActionCard
          title="📩 Send to Fresh Leads (0 emails)"
          desc="Sends Email #1 ONLY to leads who haven't received ANY email yet. Won't touch anyone who already has emails going."
          btnLabel="Send First Email to New Leads Only"
          color="blue"
          loading={actionLoading === "fresh"}
          onClick={() => runAction("/api/manual-send-emails?fresh=true&force=true", "fresh")}
        />
      </div>

      <SectionTitle>Dangerous Actions</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="🚀 Force Next Email (ALL Leads)"
          desc="Ignores schedule — sends the NEXT email in each lead's sequence immediately. If lead got 2 emails, sends #3 now regardless of timing."
          btnLabel="Force Send Everyone"
          color="red"
          loading={actionLoading === "force"}
          onClick={() => runAction("/api/manual-send-emails?force=true", "force")}
        />
        <ActionCard
          title="⏰ Trigger Cron (9s budget)"
          desc="Runs the same job Vercel auto-triggers twice daily. Has a 9-second time limit — stops early and picks up rest next run. For testing."
          btnLabel="Simulate Cron Run"
          color="blue"
          loading={actionLoading === "cron"}
          onClick={() => runAction("/api/cron/send-nurture-emails", "cron")}
        />
      </div>

      <SectionTitle>System Maintenance</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard
          title="🔄 Backfill Email Drafts"
          desc="For leads that don't have pre-generated email drafts yet. Calls Gemini to generate all 10 email drafts. Processes 3 leads per click."
          btnLabel="Generate Drafts (3 Leads)"
          color="green"
          loading={actionLoading === "backfill"}
          onClick={() => runAction("/api/backfill-email-drafts", "backfill")}
        />
      </div>

      {actionResult && (
        <div className="bg-[#11111f] border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300">Result</h3>
            {actionResult.sent !== undefined && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-green-500/20 text-green-400 font-medium">
                {actionResult.sent} sent{actionResult.errors?.length ? `, ${actionResult.errors.length} failed` : ""}
              </span>
            )}
          </div>
          <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
            {JSON.stringify(actionResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}


// ---------- DETAIL CARD (shared expandable card for full person view) ----------
function DetailCard({ person, expanded, onToggle, password }) {
  const opens = Array.isArray(person.email_opens) ? person.email_opens : [];
  const drafts = Array.isArray(person.email_drafts) ? person.email_drafts : [];
  const [emailAction, setEmailAction] = useState(null); // {status, message}
  const [emailLoading, setEmailLoading] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [showFullReport, setShowFullReport] = useState(false);

  const sendLeadEmail = async (mode) => {
    setEmailLoading(mode);
    setEmailAction(null);
    try {
      const body = mode === "custom"
        ? { reportId: person.report_id, mode, customSubject, customBody }
        : { reportId: person.report_id, mode };
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setEmailAction({ status: "success", message: `✅ Sent email #${json.emailNum || "custom"} to ${json.email}` });
        if (mode === "custom") { setShowCustom(false); setCustomSubject(""); setCustomBody(""); }
      } else {
        setEmailAction({ status: "error", message: `❌ ${json.error}` });
      }
    } catch (err) {
      setEmailAction({ status: "error", message: `❌ ${err.message}` });
    }
    setEmailLoading("");
  };

  const sendAdminAction = async (action) => {
    setEmailLoading(action);
    setEmailAction(null);
    try {
      const url = action === "resend-report" ? "/api/admin/resend-report" : "/api/admin/send-thankyou";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
        body: JSON.stringify({ reportId: person.report_id }),
      });
      const json = await res.json();
      if (res.ok) {
        const msg = action === "resend-report"
          ? `✅ Report re-sent to ${json.email}`
          : `✅ Thank you email sent to ${json.email}`;
        setEmailAction({ status: "success", message: msg });
        // Update local state to show thank you was sent
        if (action === "thankyou") person.thankyou_sent_at = new Date().toISOString();
      } else {
        setEmailAction({ status: "error", message: `❌ ${json.error}` });
      }
    } catch (err) {
      setEmailAction({ status: "error", message: `❌ ${err.message}` });
    }
    setEmailLoading("");
  };

  return (
    <div className="bg-[#11111f] border border-white/10 rounded-2xl overflow-hidden transition-all">
      {/* Header row — always visible */}
      <button onClick={onToggle} className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
            {(person.name || "?")[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate">{person.name}</p>
            <p className="text-gray-400 text-xs truncate">{person.email || "No email"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-500 text-[11px]">{person.emails_sent_count || 0}/10</span>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
            person.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
          }`}>{person.payment_status}</span>
          {person.is_founder_member && <span className="px-2 py-0.5 rounded-full text-[11px] bg-pink-500/20 text-pink-400">Founder</span>}
          <span className="text-gray-500 text-lg">{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-5">

          {/* === EMAIL ACTION BUTTONS === */}
          {person.email && person.email.trim() && (
            <div>
              <SectionTitle>Email Actions</SectionTitle>
              <div className="flex flex-wrap gap-2 mb-2">
                {/* Paid-only actions: resend report + thank you */}
                {person.payment_status === "paid" && (
                  <>
                    <button
                      onClick={() => sendAdminAction("resend-report")}
                      disabled={!!emailLoading}
                      className="px-3 py-2 rounded-xl text-xs font-medium bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white transition-colors"
                    >
                      {emailLoading === "resend-report" ? "Sending..." : "📄 Resend Report"}
                    </button>
                    <button
                      onClick={() => sendAdminAction("thankyou")}
                      disabled={!!emailLoading || person.thankyou_sent_at}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        person.thankyou_sent_at
                          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                          : "bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white"
                      }`}
                    >
                      {emailLoading === "thankyou" ? "Sending..." : person.thankyou_sent_at ? `✅ Thank You Sent (${new Date(person.thankyou_sent_at).toLocaleDateString("en-IN", {day: "numeric", month: "short"})})` : "🙏 Send Thank You (from Founder)"}
                    </button>
                  </>
                )}
                {/* Nurture sequence actions (for unpaid or all) */}
                <button
                  onClick={() => sendLeadEmail("scheduled")}
                  disabled={!!emailLoading}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition-colors"
                >
                  {emailLoading === "scheduled" ? "Sending..." : `📬 Send Scheduled (#${(person.emails_sent_count || 0) + 1})`}
                </button>
                <button
                  onClick={() => sendLeadEmail("force")}
                  disabled={!!emailLoading}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition-colors"
                >
                  {emailLoading === "force" ? "Sending..." : `🚀 Force Next (#${(person.emails_sent_count || 0) + 1})`}
                </button>
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/20 text-gray-200 border border-white/10 transition-colors"
                >
                  ✏️ Custom Email
                </button>
              </div>

              {/* Custom email form */}
              {showCustom && (
                <div className="bg-black/30 rounded-xl p-3 space-y-2 mb-2">
                  <input
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Subject line..."
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder="Email body (plain text, use line breaks)..."
                    rows={4}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                  <button
                    onClick={() => sendLeadEmail("custom")}
                    disabled={!customSubject || !customBody || !!emailLoading}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-purple-600 to-indigo-600 disabled:opacity-50 text-white transition-all"
                  >
                    {emailLoading === "custom" ? "Sending..." : "Send Custom Email →"}
                  </button>
                </div>
              )}

              {/* Action result */}
              {emailAction && (
                <p className={`text-xs px-3 py-2 rounded-lg ${emailAction.status === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {emailAction.message}
                </p>
              )}
            </div>
          )}

          {/* Personal Info */}
          <div>
            <SectionTitle>Personal Info</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoItem label="Full Name" value={person.name} />
              <InfoItem label="Email" value={person.email || "—"} />
              <InfoItem label="Gender" value={person.gender || "—"} />
              <InfoItem label="Date of Birth" value={person.date_of_birth || "—"} />
              <InfoItem label="Time of Birth" value={person.time_of_birth || "—"} />
              <InfoItem label="Place of Birth" value={person.place_of_birth || "—"} />
              <InfoItem label="Report ID" value={person.report_id} mono />
              <InfoItem label="User ID" value={person.user_id || "Guest"} mono />
            </div>
          </div>

          {/* Payment Info */}
          <div>
            <SectionTitle>Payment & Revenue</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoItem label="Payment Status" value={person.payment_status} badge={person.payment_status === "paid" ? "green" : "amber"} />
              <InfoItem label="Payment ID" value={person.payment_id || "—"} mono />
              <InfoItem label="Founder Member" value={person.is_founder_member ? "Yes ₹999" : "No"} badge={person.is_founder_member ? "pink" : null} />
              <InfoItem label="Founder Payment" value={person.founder_upgrade_payment_id || "—"} mono />
              <InfoItem label="12-Mo Guidance" value={person.has_12_month_guidance ? "Yes ₹149" : "No"} badge={person.has_12_month_guidance ? "blue" : null} />
              <InfoItem label="Guidance Start" value={person.guidance_start_date ? new Date(person.guidance_start_date).toLocaleDateString("en-IN") : "—"} />
              <InfoItem label="Guidance End" value={person.guidance_end_date ? new Date(person.guidance_end_date).toLocaleDateString("en-IN") : "—"} />
              <InfoItem label="Created At" value={person.created_at ? new Date(person.created_at).toLocaleString("en-IN") : "—"} />
            </div>
          </div>

          {/* Paid Email Status */}
          {person.payment_status === "paid" && (
            <div>
              <SectionTitle>Paid Email Status</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoItem
                  label="Report Email"
                  value={Array.isArray(person.email_opens) && person.email_opens.some((o) => o.type === "report") ? "Opened ✅" : "Not opened"}
                  badge={Array.isArray(person.email_opens) && person.email_opens.some((o) => o.type === "report") ? "green" : null}
                />
                <InfoItem
                  label="Thank You Email"
                  value={
                    !person.thankyou_sent_at ? "Not sent" :
                    Array.isArray(person.email_opens) && person.email_opens.some((o) => o.type === "thankyou") ? "Opened ✅" : "Sent, not opened"
                  }
                  badge={
                    !person.thankyou_sent_at ? null :
                    Array.isArray(person.email_opens) && person.email_opens.some((o) => o.type === "thankyou") ? "green" : "amber"
                  }
                />
                <InfoItem label="Thank You Sent At" value={person.thankyou_sent_at ? new Date(person.thankyou_sent_at).toLocaleString("en-IN") : "—"} />
                <InfoItem
                  label="Report Opened At"
                  value={(() => {
                    const opens = Array.isArray(person.email_opens) ? person.email_opens : [];
                    const reportOpen = opens.find((o) => o.type === "report");
                    return reportOpen ? new Date(reportOpen.opened_at).toLocaleString("en-IN") : "—";
                  })()}
                />
              </div>
            </div>
          )}

          {/* Email Sequence */}
          <div>
            <SectionTitle>Email Sequence</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <InfoItem label="Emails Sent" value={`${person.emails_sent_count || 0} / 10`} />
              <InfoItem label="Sequence Status" value={person.email_sequence_status || "pending"} />
              <InfoItem label="Last Email Sent" value={person.last_email_sent_at ? new Date(person.last_email_sent_at).toLocaleString("en-IN") : "Never"} />
              <InfoItem label="Opens" value={opens.length} />
            </div>
            {/* Visual progress */}
            <div className="flex gap-1 mb-2">
              {Array.from({ length: 10 }, (_, i) => {
                const openNums = opens.map((o) => o.num);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-6 rounded ${
                      openNums.includes(i + 1) ? "bg-green-500" : i < (person.emails_sent_count || 0) ? "bg-amber-500/70" : "bg-white/10"
                    }`} />
                    <span className="text-[9px] text-gray-500">{i + 1}</span>
                  </div>
                );
              })}
            </div>
            {/* Opens detail */}
            {opens.length > 0 && (
              <div className="bg-black/30 rounded-xl p-3 text-xs">
                <p className="text-gray-400 mb-1 font-medium">Open timestamps:</p>
                {opens.map((o, i) => (
                  <p key={i} className="text-gray-500">Email #{o.num} — {new Date(o.opened_at).toLocaleString("en-IN")}</p>
                ))}
              </div>
            )}
          </div>

          {/* Email Drafts */}
          {drafts.length > 0 && (
            <div>
              <SectionTitle>Email Drafts ({drafts.length})</SectionTitle>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {drafts.map((d, i) => (
                  <div key={i} className="bg-black/30 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-medium">#{d.num || i + 1}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">{d.psychology}</span>
                      {i < (person.emails_sent_count || 0) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Sent</span>}
                    </div>
                    <p className="text-sm font-medium text-gray-200">{d.subject}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report — formatted like user would see */}
          {person.summary && (
            <div>
              <SectionTitle>Their Report</SectionTitle>
              <div className="bg-gradient-to-br from-[#0d0d1a] to-[#11111f] border border-white/10 rounded-2xl p-5 space-y-4">
                {/* Summary */}
                <div className="border-b border-white/10 pb-4">
                  <p className="text-purple-300 text-xs uppercase tracking-wider mb-1 font-semibold">Summary</p>
                  <p className="text-gray-200 text-sm leading-relaxed">{person.summary}</p>
                </div>

                {/* Sections — formatted */}
                {Array.isArray(person.sections) && person.sections.length > 0 && (
                  <>
                    {person.sections.slice(0, showFullReport ? 999 : 3).map((s, i) => (
                      <div key={i} className="border-b border-white/5 pb-4 last:border-0">
                        <h4 className="text-sm font-semibold text-purple-200 mb-2 flex items-center gap-2">
                          <span className="text-purple-500/60 text-xs">{i + 1}.</span>
                          {s.title}
                        </h4>
                        <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{s.content}</p>
                      </div>
                    ))}
                    {person.sections.length > 3 && (
                      <button
                        onClick={() => setShowFullReport(!showFullReport)}
                        className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                      >
                        {showFullReport ? "▴ Show less" : `▾ Show all ${person.sections.length} sections`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Attribution / Source */}
          {person.attribution && (
            <div>
              <SectionTitle>Attribution / Source</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoItem label="UTM Source" value={person.attribution.utm_source || "—"} />
                <InfoItem label="UTM Medium" value={person.attribution.utm_medium || "—"} />
                <InfoItem label="UTM Campaign" value={person.attribution.utm_campaign || "—"} />
                <InfoItem label="UTM Content" value={person.attribution.utm_content || "—"} />
                <InfoItem label="UTM Term" value={person.attribution.utm_term || "—"} />
                <InfoItem label="Facebook Click ID" value={person.attribution.fbclid ? person.attribution.fbclid.substring(0, 20) + "..." : "—"} mono />
                <InfoItem label="Google Click ID" value={person.attribution.gclid ? person.attribution.gclid.substring(0, 20) + "..." : "—"} mono />
                <InfoItem label="Referrer" value={person.attribution.referrer || "Direct"} />
                <InfoItem label="Landing Page" value={person.attribution.landing_page || "—"} />
                <InfoItem label="Landed At" value={person.attribution.landed_at ? new Date(person.attribution.landed_at).toLocaleString("en-IN") : "—"} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, mono, badge }) {
  const badgeColors = {
    green: "bg-green-500/20 text-green-400",
    amber: "bg-amber-500/20 text-amber-400",
    pink: "bg-pink-500/20 text-pink-400",
    blue: "bg-blue-500/20 text-blue-400",
  };
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      {badge ? (
        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${badgeColors[badge]}`}>{value}</span>
      ) : (
        <p className={`text-sm mt-0.5 ${mono ? "font-mono text-gray-400 text-xs break-all" : "text-gray-200"}`}>{value}</p>
      )}
    </div>
  );
}


// ---------- PAID PEOPLE (full detail) ----------
function PaidDetailsTab({ paid, password }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() => {
    if (!paid) return [];
    const q = search.toLowerCase();
    return paid.filter((p) => {
      return !q || (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q) || (p.payment_id || "").includes(q);
    });
  }, [paid, search]);

  if (!paid) return null;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search paid customers..."
            className="w-full bg-[#11111f] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <span className="text-xs text-gray-500">{filtered.length} paid customers</span>
      </div>

      <div className="space-y-3">
        {filtered.map((person) => (
          <DetailCard
            key={person.report_id}
            person={person}
            expanded={expanded === person.report_id}
            onToggle={() => setExpanded(expanded === person.report_id ? null : person.report_id)}
            password={password}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-12">No paid customers found.</div>
        )}
      </div>
    </div>
  );
}

// ---------- EVERYONE (full detail for every single lead) ----------
function AllDetailsTab({ all, password }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const filtered = useMemo(() => {
    if (!all) return [];
    const q = search.toLowerCase();
    return all.filter((p) => {
      const matchesSearch = !q || (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q) || (p.report_id || "").includes(q);
      const matchesStatus =
        status === "all" ? true :
        status === "paid" ? p.payment_status === "paid" :
        status === "unpaid" ? p.payment_status === "unpaid" :
        status === "founder" ? p.is_founder_member :
        status === "noemail" ? (!p.email || !p.email.trim()) : true;
      return matchesSearch && matchesStatus;
    });
  }, [all, search, status]);

  if (!all) return null;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search anyone by name, email, or report ID..."
            className="w-full bg-[#11111f] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        <Pill active={status === "all"} onClick={() => setStatus("all")}>All</Pill>
        <Pill active={status === "paid"} onClick={() => setStatus("paid")}>Paid</Pill>
        <Pill active={status === "unpaid"} onClick={() => setStatus("unpaid")}>Unpaid</Pill>
        <Pill active={status === "founder"} onClick={() => setStatus("founder")}>Founder</Pill>
        <Pill active={status === "noemail"} onClick={() => setStatus("noemail")}>No email</Pill>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} of {all.length}</span>
      </div>

      <div className="space-y-3">
        {filtered.map((person) => (
          <DetailCard
            key={person.report_id}
            person={person}
            expanded={expanded === person.report_id}
            onToggle={() => setExpanded(expanded === person.report_id ? null : person.report_id)}
            password={password}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-12">No one matches your filters.</div>
        )}
      </div>
    </div>
  );
}


// ---------- BLOG (AI article generator + manager) ----------
function BlogTab({ blogPosts, password, onRefresh }) {
  const [topic, setTopic] = useState("");
  const [keyword, setKeyword] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const generate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${password}` },
        body: JSON.stringify({ topic, keyword }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ status: "success", message: `✅ Published: "${json.title}"`, url: json.url });
        setTopic("");
        setKeyword("");
        if (onRefresh) onRefresh();
      } else {
        setResult({ status: "error", message: `❌ ${json.error}${json.details ? " — " + json.details : ""}` });
      }
    } catch (err) {
      setResult({ status: "error", message: `❌ ${err.message}` });
    }
    setGenerating(false);
  };

  const ideas = [
    "What is Sade Sati and how does it affect you",
    "Understanding the 7th house in your birth chart",
    "Gemstones in Vedic astrology and who should wear them",
    "What is Pitra Dosha? Causes and remedies",
    "How to read your career from your Janam Kundli",
    "Saturn (Shani) in astrology: lessons and timing",
  ];

  return (
    <div className="space-y-6">
      {/* Generator */}
      <div className="bg-[#11111f] border border-white/10 rounded-2xl p-5">
        <SectionTitle>Generate New SEO Article</SectionTitle>
        <p className="text-gray-400 text-sm mb-4">
          Enter a topic. AI writes a full SEO-optimized article and publishes it to your blog instantly. Each new article = another page Google &amp; AI engines can rank.
        </p>
        <div className="space-y-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Article topic, e.g. 'What is Sade Sati?'"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Primary SEO keyword (optional), e.g. 'sade sati'"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={generate}
            disabled={generating || !topic.trim()}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-purple-600/30"
          >
            {generating ? "Writing article... (~15s)" : "✨ Generate & Publish Article"}
          </button>
        </div>

        {result && (
          <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${result.status === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {result.message}
            {result.url && (
              <a href={result.url} target="_blank" rel="noreferrer" className="ml-2 underline">View →</a>
            )}
          </div>
        )}

        {/* Idea chips */}
        <div className="mt-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Ideas (click to use)</p>
          <div className="flex flex-wrap gap-2">
            {ideas.map((idea) => (
              <button
                key={idea}
                onClick={() => setTopic(idea)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Published AI articles */}
      <div>
        <SectionTitle>AI-Generated Articles ({blogPosts ? blogPosts.length : 0})</SectionTitle>
        {!blogPosts || blogPosts.length === 0 ? (
          <div className="bg-[#11111f] border border-white/10 rounded-2xl p-6 text-center text-gray-500 text-sm">
            No AI-generated articles yet. Generate your first one above.
            <br />
            <span className="text-xs text-gray-600">(Your 10 hand-written articles live in the code and are always published.)</span>
          </div>
        ) : (
          <div className="space-y-2">
            {blogPosts.map((p) => (
              <div key={p.slug} className="bg-[#11111f] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.title}</p>
                  <p className="text-gray-500 text-xs truncate">{p.description}</p>
                  <p className="text-gray-600 text-[11px] mt-1">
                    {p.read_minutes} min · {new Date(p.created_at).toLocaleDateString("en-IN")} · {p.published ? "Published" : "Draft"}
                  </p>
                </div>
                <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="shrink-0 text-purple-400 hover:text-purple-300 text-sm font-medium">
                  View →
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
