"use client";

import { useState, useEffect } from "react";

const ADMIN_SECRET = "bhavishai_made_it_big";

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  // Simple password gate (client-side, API is still protected by header)
  const handleLogin = (e) => {
    e.preventDefault();
    if (password) {
      setAuthed(true);
      fetchData("overview", password);
    }
  };


  const fetchData = async (t, secret) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/data?tab=${t}`, {
        headers: { Authorization: `Bearer ${secret || password}` },
      });
      const json = await res.json();
      if (res.ok) setData(json);
      else setData({ error: json.error });
    } catch (err) {
      setData({ error: err.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authed) fetchData(tab);
  }, [tab]);

  const runAction = async (url) => {
    setActionResult(null);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${password}` },
      });
      const json = await res.json();
      setActionResult(json);
    } catch (err) {
      setActionResult({ error: err.message });
    }
  };


  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-2xl p-8 max-w-sm w-full">
          <h1 className="text-2xl font-bold text-white mb-2">🔐 Admin Access</h1>
          <p className="text-gray-400 text-sm mb-6">Enter your admin secret to continue</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin secret..."
            className="w-full bg-[#0a0a0f] border border-[#2a2a4a] rounded-xl px-4 py-3 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold transition-colors">
            Enter Dashboard
          </button>
        </form>
      </div>
    );
  }


  const tabs = [
    { id: "overview", label: "📊 Overview" },
    { id: "leads", label: "👥 Leads" },
    { id: "payments", label: "💰 Payments" },
    { id: "emails", label: "📧 Emails" },
    { id: "actions", label: "⚡ Actions" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-[#2a2a4a] p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">BhavishAI Admin</h1>
          <span className="text-xs text-gray-500">Super Admin Panel</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#2a2a4a]">
        <div className="max-w-7xl mx-auto flex gap-1 p-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a2e]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4">
        {loading && <p className="text-gray-400 animate-pulse">Loading...</p>}
        {data?.error && <p className="text-red-400">Error: {data.error}</p>}
        {!loading && data && !data.error && (
          <>
            {tab === "overview" && <OverviewTab data={data.overview} />}
            {tab === "leads" && <LeadsTab leads={data.leads} />}
            {tab === "payments" && <PaymentsTab payments={data.payments} />}
            {tab === "emails" && <EmailsTab emails={data.emails} />}
            {tab === "actions" && <ActionsTab runAction={runAction} actionResult={actionResult} />}
          </>
        )}
      </div>
    </div>
  );
}


function StatCard({ label, value, sub }) {
  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-4">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function OverviewTab({ data }) {
  if (!data) return null;
  return (
    <div className="space-y-6">
      {/* Today */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-purple-300">Today</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Leads Today" value={data.todayLeads} />
          <StatCard label="Paid Today" value={data.todayPaid} />
          <StatCard label="Revenue Today" value={`₹${data.todayPaid * 299}`} />
          <StatCard label="Conv. Rate" value={`${data.conversionRate}%`} sub="All time" />
        </div>
      </div>

      {/* All Time */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-purple-300">All Time</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Leads" value={data.totalLeads} />
          <StatCard label="Total Paid" value={data.totalPaid} />
          <StatCard label="Total Revenue" value={`₹${data.totalRevenue}`} />
          <StatCard label="Unpaid" value={data.totalUnpaid} />
          <StatCard label="Founder Members" value={data.founderMembers} />
          <StatCard label="12-Month Guidance" value={data.with12MonthGuidance} />
          <StatCard label="Last 7 Days Leads" value={data.recentLeads} />
          <StatCard label="Last 7 Days Paid" value={data.recentPaid} />
        </div>
      </div>

      {/* Email Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-purple-300">Email Engine</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Leads with Email" value={data.withEmail} />
          <StatCard label="Drafts Generated" value={data.withDrafts} />
          <StatCard label="Sequences Active" value={data.emailsActive} />
          <StatCard label="Sequences Done" value={data.emailsCompleted} />
          <StatCard label="Total Emails Sent" value={data.totalEmailsSent} />
          <StatCard label="Total Opens" value={data.totalOpens} />
          <StatCard label="Leads Who Opened" value={data.withOpens} />
          <StatCard label="Open Rate" value={`${data.openRate}%`} sub="Opens / Sent" />
        </div>
      </div>
    </div>
  );
}


function LeadsTab({ leads }) {
  if (!leads) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">All Leads ({leads.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a4a] text-gray-400 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Status</th>
              <th className="p-2">Emails Sent</th>
              <th className="p-2">Opens</th>
              <th className="p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.report_id} className="border-b border-[#1a1a2e] hover:bg-[#1a1a2e]">
                <td className="p-2 font-medium">{lead.name}</td>
                <td className="p-2 text-gray-400 text-xs">{lead.email || "—"}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    lead.payment_status === "paid"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {lead.payment_status}
                  </span>
                  {lead.is_founder_member && <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">Founder</span>}
                </td>
                <td className="p-2 text-center">{lead.emails_sent_count || 0}/10</td>
                <td className="p-2 text-center">{Array.isArray(lead.email_opens) ? lead.email_opens.length : 0}</td>
                <td className="p-2 text-gray-400 text-xs">{new Date(lead.created_at).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function PaymentsTab({ payments }) {
  if (!payments) return null;
  const totalRevenue = payments.length * 299;
  const founderRevenue = payments.filter((p) => p.is_founder_member).length * 999;
  const guidanceRevenue = payments.filter((p) => p.has_12_month_guidance).length * 149;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Payments" value={payments.length} />
        <StatCard label="Base Revenue" value={`₹${totalRevenue}`} sub="@ ₹299 each" />
        <StatCard label="Founder Upgrades" value={`₹${founderRevenue}`} sub="@ ₹999 each" />
        <StatCard label="Guidance Add-ons" value={`₹${guidanceRevenue}`} sub="@ ₹149 each" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a4a] text-gray-400 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Payment ID</th>
              <th className="p-2">Add-ons</th>
              <th className="p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.report_id} className="border-b border-[#1a1a2e] hover:bg-[#1a1a2e]">
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2 text-gray-400 text-xs">{p.email || "—"}</td>
                <td className="p-2 text-xs font-mono text-gray-500">{p.payment_id || "—"}</td>
                <td className="p-2">
                  {p.is_founder_member && <span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400 mr-1">Founder ₹999</span>}
                  {p.has_12_month_guidance && <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">Guidance ₹149</span>}
                  {!p.is_founder_member && !p.has_12_month_guidance && <span className="text-gray-500">Base only</span>}
                </td>
                <td className="p-2 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function EmailsTab({ emails }) {
  if (!emails) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Email Sequences ({emails.length} leads)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a4a] text-gray-400 text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Sent</th>
              <th className="p-2">Opens</th>
              <th className="p-2">Status</th>
              <th className="p-2">Last Sent</th>
              <th className="p-2">Drafts</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => {
              const opens = Array.isArray(e.email_opens) ? e.email_opens : [];
              const openNums = opens.map((o) => o.num);
              return (
                <tr key={e.report_id} className="border-b border-[#1a1a2e] hover:bg-[#1a1a2e]">
                  <td className="p-2 font-medium">{e.name}</td>
                  <td className="p-2 text-gray-400 text-xs">{e.email}</td>
                  <td className="p-2 text-center">{e.emails_sent_count || 0}/10</td>
                  <td className="p-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div
                          key={i}
                          title={`Email ${i + 1}: ${i < (e.emails_sent_count || 0) ? (openNums.includes(i + 1) ? "Opened" : "Sent, not opened") : "Not sent"}`}
                          className={`w-3 h-3 rounded-sm ${
                            openNums.includes(i + 1)
                              ? "bg-green-500"
                              : i < (e.emails_sent_count || 0)
                              ? "bg-yellow-500"
                              : "bg-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      e.email_sequence_status === "completed" ? "bg-green-500/20 text-green-400"
                      : e.email_sequence_status === "active" ? "bg-blue-500/20 text-blue-400"
                      : "bg-gray-500/20 text-gray-400"
                    }`}>
                      {e.email_sequence_status || "pending"}
                    </span>
                  </td>
                  <td className="p-2 text-gray-400 text-xs">
                    {e.last_email_sent_at ? new Date(e.last_email_sent_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="p-2 text-xs text-gray-500">
                    {e.email_drafts ? `${e.email_drafts.length} ready` : "None"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500 flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm inline-block" /> Opened</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded-sm inline-block" /> Sent, not opened</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-700 rounded-sm inline-block" /> Not sent yet</span>
      </div>
    </div>
  );
}


function ActionsTab({ runAction, actionResult }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Manual Actions</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Send scheduled emails */}
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5">
          <h3 className="font-semibold mb-2">📬 Send Due Emails</h3>
          <p className="text-gray-400 text-sm mb-4">Sends all emails that are due based on schedule. Same as cron but no time limit.</p>
          <button
            onClick={() => runAction("/api/manual-send-emails")}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Send Scheduled
          </button>
        </div>

        {/* Force send */}
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5">
          <h3 className="font-semibold mb-2">🚀 Force Send Next Email</h3>
          <p className="text-gray-400 text-sm mb-4">Ignores schedule — sends the next email in sequence to ALL leads immediately.</p>
          <button
            onClick={() => runAction("/api/manual-send-emails?force=true")}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Force Send All
          </button>
        </div>

        {/* Trigger cron */}
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5">
          <h3 className="font-semibold mb-2">⏰ Trigger Cron</h3>
          <p className="text-gray-400 text-sm mb-4">Runs the normal cron job (with time budget). Same as Vercel auto-triggers.</p>
          <button
            onClick={() => runAction("/api/cron/send-nurture-emails")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Run Cron
          </button>
        </div>

        {/* Backfill */}
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5">
          <h3 className="font-semibold mb-2">🔄 Backfill Drafts</h3>
          <p className="text-gray-400 text-sm mb-4">Generates email drafts for leads that dont have them yet. Processes 3 at a time.</p>
          <button
            onClick={() => runAction("/api/backfill-email-drafts")}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Backfill 3 Leads
          </button>
        </div>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-4 mt-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Result:</h3>
          <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(actionResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
