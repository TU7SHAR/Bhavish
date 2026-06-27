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
    if (authed) fetchData(tab);
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
    { id: "leads", label: "Leads", icon: "👥" },
    { id: "payments", label: "Payments", icon: "💰" },
    { id: "emails", label: "Emails", icon: "📧" },
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
            {tab === "leads" && <LeadsTab leads={data.leads} />}
            {tab === "payments" && <PaymentsTab payments={data.payments} />}
            {tab === "emails" && <EmailsTab emails={data.emails} />}
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
  if (!data) return null;
  return (
    <div className="space-y-8">
      {/* Hero revenue banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-purple-600/20 via-indigo-600/10 to-transparent p-6">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Total Revenue</p>
            <p className="text-3xl md:text-4xl font-bold mt-1 bg-gradient-to-r from-purple-300 to-indigo-300 bg-clip-text text-transparent">₹{data.totalRevenue.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Paid Customers</p>
            <p className="text-3xl md:text-4xl font-bold mt-1">{data.totalPaid}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Total Leads</p>
            <p className="text-3xl md:text-4xl font-bold mt-1">{data.totalLeads}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wider">Conversion</p>
            <p className="text-3xl md:text-4xl font-bold mt-1 text-green-400">{data.conversionRate}%</p>
          </div>
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


// ---------- LEADS ----------
function LeadsTab({ leads }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");

  const filtered = useMemo(() => {
    if (!leads) return [];
    let out = leads.filter((l) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || (l.name || "").toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q);
      const matchesStatus =
        status === "all" ? true :
        status === "paid" ? l.payment_status === "paid" :
        status === "unpaid" ? l.payment_status === "unpaid" :
        status === "founder" ? l.is_founder_member :
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

  if (!leads) return null;
  return (
    <div>
      <FilterBar search={search} setSearch={setSearch} count={filtered.length} total={leads.length}>
        <Pill active={status === "all"} onClick={() => setStatus("all")}>All</Pill>
        <Pill active={status === "paid"} onClick={() => setStatus("paid")}>Paid</Pill>
        <Pill active={status === "unpaid"} onClick={() => setStatus("unpaid")}>Unpaid</Pill>
        <Pill active={status === "founder"} onClick={() => setStatus("founder")}>Founder</Pill>
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
      </FilterBar>

      <div className="bg-[#11111f] border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-gray-400 text-left text-xs uppercase tracking-wider">
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-center">Emails</th>
                <th className="p-3 font-medium text-center">Opens</th>
                <th className="p-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.report_id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-3 font-medium">{lead.name}</td>
                  <td className="p-3 text-gray-400 text-xs">{lead.email || "—"}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      lead.payment_status === "paid" ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"
                    }`}>{lead.payment_status}</span>
                    {lead.is_founder_member && <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-pink-500/20 text-pink-400">Founder</span>}
                  </td>
                  <td className="p-3 text-center text-gray-300">{lead.emails_sent_count || 0}<span className="text-gray-600">/10</span></td>
                  <td className="p-3 text-center">
                    {Array.isArray(lead.email_opens) && lead.email_opens.length > 0
                      ? <span className="text-green-400 font-medium">{lead.email_opens.length}</span>
                      : <span className="text-gray-600">0</span>}
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No leads match your filters.</td></tr>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActionCard title="📬 Send Due Emails" desc="Sends all emails currently due per the schedule. No time limit (unlike cron)." btnLabel="Send Scheduled" color="purple" loading={actionLoading === "send"} onClick={() => runAction("/api/manual-send-emails", "send")} />
        <ActionCard title="🚀 Force Send Next" desc="Ignores schedule — sends the next email in sequence to ALL leads right now." btnLabel="Force Send All" color="red" loading={actionLoading === "force"} onClick={() => runAction("/api/manual-send-emails?force=true", "force")} />
        <ActionCard title="⏰ Trigger Cron" desc="Runs the normal cron (with 9s time budget). Same as Vercel auto-trigger." btnLabel="Run Cron" color="blue" loading={actionLoading === "cron"} onClick={() => runAction("/api/cron/send-nurture-emails", "cron")} />
        <ActionCard title="🔄 Backfill Drafts" desc="Generates email drafts for leads missing them. Processes 3 at a time." btnLabel="Backfill 3 Leads" color="green" loading={actionLoading === "backfill"} onClick={() => runAction("/api/backfill-email-drafts", "backfill")} />
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
