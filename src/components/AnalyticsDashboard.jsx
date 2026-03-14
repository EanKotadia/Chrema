import { useEffect, useState, useCallback } from "react";
import {
  getAnalytics, getEvents, getEventSubmissions,
  getPageViewStats, getArticlesWithViews,
} from "../utils/supabase";
import { formatDate } from "../utils/dateUtils";
import "./AnalyticsDashboard.css";

// ── Excel export (pure JS, no library needed) ─────────────
function exportToExcel(data) {
  const { articles, views, submissions, eventSubs } = data;

  // Build all sheets as CSV strings then package into a multi-sheet .xlsx
  // Using the simplest approach: generate an HTML table workbook (opens natively in Excel)
  const now = new Date().toLocaleDateString("en-GB");

  const escCell = v => {
    if (v == null) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // Sheet 1: Article performance
  const artSheet = [
    ["Article Performance Report — Chréma Magazine", `Generated: ${now}`],
    [],
    ["Title", "Author", "Category", "Published", "Total Views", "Est. Unique Readers"],
    ...articles.map(a => [
      a.title, a.author || "—", a.category || "—",
      a.published_at ? new Date(a.published_at).toLocaleDateString("en-GB") : "Draft",
      a.view_count || 0,
      Math.round((a.view_count || 0) * 0.72), // ~72% unique ratio
    ]),
    [],
    ["TOTALS", "", "", "",
      articles.reduce((s, a) => s + (a.view_count || 0), 0),
      Math.round(articles.reduce((s, a) => s + (a.view_count || 0), 0) * 0.72),
    ],
  ];

  // Sheet 2: Traffic overview
  const dailyMap = {};
  views.forEach(v => {
    const day = v.viewed_at.slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { views: 0, sessions: new Set() };
    dailyMap[day].views++;
    dailyMap[day].sessions.add(v.session_id);
  });
  const trafficSheet = [
    ["Daily Traffic — Last 90 Days", `Generated: ${now}`],
    [],
    ["Date", "Page Views", "Unique Sessions", "Avg. Session Views"],
    ...Object.entries(dailyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, d]) => [
        date, d.views, d.sessions.size,
        (d.views / d.sessions.size).toFixed(1),
      ]),
  ];

  // Sheet 3: Device & referrer breakdown
  const devices = {};
  const referrers = {};
  views.forEach(v => {
    devices[v.device_type || "unknown"]   = (devices[v.device_type || "unknown"]   || 0) + 1;
    referrers[v.referrer || "direct"] = (referrers[v.referrer || "direct"] || 0) + 1;
  });
  const audienceSheet = [
    ["Audience Report", `Generated: ${now}`],
    [],
    ["Device Type", "Views", "Share %"],
    ...Object.entries(devices).sort((a,b) => b[1]-a[1]).map(([k, v]) => [
      k, v, `${((v / views.length) * 100).toFixed(1)}%`,
    ]),
    [],
    ["Traffic Source", "Views", "Share %"],
    ...Object.entries(referrers).sort((a,b) => b[1]-a[1]).map(([k, v]) => [
      k, v, `${((v / views.length) * 100).toFixed(1)}%`,
    ]),
  ];

  // Sheet 4: Submissions pipeline
  const subSheet = [
    ["Submissions Pipeline", `Generated: ${now}`],
    [],
    ["Status", "Count", "% of Total"],
    ...["pending","approved","rejected"].map(s => {
      const n = submissions.filter(x => x.status === s).length;
      return [s, n, `${((n / Math.max(submissions.length, 1)) * 100).toFixed(1)}%`];
    }),
    [],
    ["Category", "Submissions"],
    ...Object.entries(
      submissions.reduce((acc, s) => {
        acc[s.category || "Uncategorised"] = (acc[s.category || "Uncategorised"] || 0) + 1;
        return acc;
      }, {})
    ).sort((a,b) => b[1]-a[1]).map(([k,v]) => [k, v]),
  ];

  // Sheet 5: Event submissions
  const eventSubSheet = [
    ["Event Submissions", `Generated: ${now}`],
    [],
    ["Event", "Name", "Grade", "School", "Type", "Title", "Status", "Submitted"],
    ...eventSubs.map(s => [
      s.event_slug || "—", s.name, s.grade || "—", s.school || "—",
      s.type, s.title, s.status,
      new Date(s.submitted_at).toLocaleDateString("en-GB"),
    ]),
  ];

  // Pack everything into an HTML workbook that Excel opens natively
  const sheetToHTML = (name, rows) => `
    <table>
      ${rows.map((row, ri) => `<tr>${row.map((cell, ci) => {
        const isHeader = ri === 0 || (ri === 2 && rows[0][0].includes("Report"));
        return `<td${isHeader ? ' style="font-weight:bold;background:#e8ff47"' : ''}>${cell == null ? "" : cell}</td>`;
      }).join("")}</tr>`).join("")}
    </table>`;

  const workbook = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
    <x:ExcelWorksheet><x:Name>Articles</x:Name><x:WorksheetOptions><x:Selected/></x:WorksheetOptions></x:ExcelWorksheet>
    <x:ExcelWorksheet><x:Name>Traffic</x:Name></x:ExcelWorksheet>
    <x:ExcelWorksheet><x:Name>Audience</x:Name></x:ExcelWorksheet>
    <x:ExcelWorksheet><x:Name>Submissions</x:Name></x:ExcelWorksheet>
    <x:ExcelWorksheet><x:Name>Event Entries</x:Name></x:ExcelWorksheet>
  </x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
  ${sheetToHTML("Articles", artSheet)}
  ${sheetToHTML("Traffic", trafficSheet)}
  ${sheetToHTML("Audience", audienceSheet)}
  ${sheetToHTML("Submissions", subSheet)}
  ${sheetToHTML("Event Entries", eventSubSheet)}
</body></html>`;

  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `chrema-analytics-${new Date().toISOString().slice(0,10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Metric card ───────────────────────────────────────────
function KPI({ value, label, sub, delta, color, fmt = v => v }) {
  const isPos = delta > 0;
  const isNeg = delta < 0;
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-value" style={color ? { color } : {}}>{fmt(value)}</span>
        {delta !== undefined && (
          <span className={`kpi-delta ${isPos ? "kpi-delta--up" : isNeg ? "kpi-delta--down" : ""}`}>
            {isPos ? "↑" : isNeg ? "↓" : "→"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

// ── Horizontal bar ────────────────────────────────────────
function HBar({ rows, color = "var(--accent)" }) {
  if (!rows?.length) return <p className="ad-empty">No data yet.</p>;
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="hbar">
      {rows.map((r, i) => (
        <div key={i} className="hbar-row">
          <span className="hbar-key" title={r.key}>{r.key}</span>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${Math.max((r.value/max)*100, r.value>0?2:0)}%`, background: color }} />
          </div>
          <span className="hbar-val">{r.value.toLocaleString()}</span>
          {r.sub && <span className="hbar-sub">{r.sub}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────
function Spark({ points, color = "var(--accent)", height = 48 }) {
  if (!points?.length) return null;
  const max = Math.max(...points, 1);
  const W = 100, H = height;
  const pts = points.map((v, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * W;
    const y = H - (v / max) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  // Area fill path
  const first = `0,${H}`;
  const last  = `${W},${H}`;
  const area  = `${first} ${pts} ${last}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%", height:`${H}px`, display:"block", overflow:"visible" }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sg)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Mini donut ────────────────────────────────────────────
function Donut({ segments }) {
  // segments: [{value, color, label}]
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const R = 28, C = 2 * Math.PI * R;
  return (
    <div className="donut-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80">
        {segments.map((s, i) => {
          const pct = s.value / total;
          const dash = pct * C;
          const el = (
            <circle
              key={i}
              cx="40" cy="40" r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="10"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset * C + C * 0.25}
              strokeLinecap="butt"
            />
          );
          offset += pct;
          return el;
        })}
        <circle cx="40" cy="40" r="22" fill="var(--bg)" />
        <text x="40" y="44" textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="var(--font-display)" fontWeight="700">
          {total.toLocaleString()}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div key={i} className="donut-row">
            <span className="donut-dot" style={{ background: s.color }} />
            <span className="donut-label">{s.label}</span>
            <span className="donut-val">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [raw, setRaw]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError]     = useState(null);
  const [range, setRange]     = useState(30); // days

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getAnalytics(),
      getArticlesWithViews(),
      getPageViewStats(),
      getEvents().catch(() => []),
      getEventSubmissions(null).catch(() => []),
    ]).then(([analytics, articlesWithViews, views, events, eventSubs]) => {
      setRaw({
        articles:     Array.isArray(articlesWithViews)       ? articlesWithViews       : [],
        submissions:  Array.isArray(analytics.submissions)   ? analytics.submissions   : [],
        trash:        Array.isArray(analytics.trash)         ? analytics.trash         : [],
        views:        Array.isArray(views)                   ? views                   : [],
        events:       Array.isArray(events)                  ? events                  : [],
        eventSubs:    Array.isArray(eventSubs)               ? eventSubs               : [],
      });
      setLoading(false);
    }).catch(err => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try { exportToExcel(raw); }
    finally { setTimeout(() => setExporting(false), 800); }
  };

  if (loading) return (
    <div className="loading-state"><div className="loading-spinner" /><span>Loading analytics…</span></div>
  );
  if (error) return (
    <div className="ad-error"><span>⚠</span><p>Failed to load: {error}</p></div>
  );

  const { articles, submissions, views, eventSubs } = raw;

  // ── Computed metrics ──────────────────────────────────
  const now        = Date.now();
  const rangeMs    = range * 24 * 60 * 60 * 1000;
  const prevMs     = 2 * rangeMs;

  const windowViews = views.filter(v => now - new Date(v.viewed_at) < rangeMs);
  const prevViews   = views.filter(v => {
    const age = now - new Date(v.viewed_at);
    return age >= rangeMs && age < prevMs;
  });

  const totalViews    = windowViews.length;
  const prevTotalViews = prevViews.length;
  const viewDelta     = prevTotalViews > 0
    ? Math.round(((totalViews - prevTotalViews) / prevTotalViews) * 100) : null;

  const uniqueSessions = new Set(windowViews.map(v => v.session_id)).size;
  const prevSessions   = new Set(prevViews.map(v => v.session_id)).size;
  const sessionDelta   = prevSessions > 0
    ? Math.round(((uniqueSessions - prevSessions) / prevSessions) * 100) : null;

  const avgSessionDepth = uniqueSessions > 0
    ? (totalViews / uniqueSessions).toFixed(1) : "0";

  const totalArticleViews = articles.reduce((s, a) => s + (a.view_count || 0), 0);

  // CTR: sessions that read at least one article / all sessions (within range)
  // Here we use views/unique as engagement rate (articles per visitor)
  // Bounce-proxy: sessions with exactly 1 view
  const sessionViewMap = {};
  windowViews.forEach(v => { sessionViewMap[v.session_id] = (sessionViewMap[v.session_id] || 0) + 1; });
  const bounceSessions = Object.values(sessionViewMap).filter(n => n === 1).length;
  const bounceRate = uniqueSessions > 0
    ? `${Math.round((bounceSessions / uniqueSessions) * 100)}%` : "—";

  // Daily views for spark (range days)
  const dayLabels = Array.from({ length: range }, (_, i) => {
    const d = new Date(now - (range - 1 - i) * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const dailyViews = dayLabels.map(day =>
    windowViews.filter(v => v.viewed_at.startsWith(day)).length
  );
  const dailyLabels = dayLabels.map((d, i) =>
    (i === 0 || i === Math.floor(range/2) || i === range - 1)
      ? new Date(d).toLocaleDateString("en-GB", { day:"numeric", month:"short" }) : ""
  );

  // Top articles
  const topArticles = [...articles]
    .filter(a => (a.view_count || 0) > 0)
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 8);

  // Category performance
  const catViews = articles.reduce((acc, a) => {
    const cat = a.category || "Uncategorised";
    acc[cat] = (acc[cat] || 0) + (a.view_count || 0);
    return acc;
  }, {});
  const catData = Object.entries(catViews)
    .sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([key, value]) => ({ key, value }));

  // Device breakdown
  const deviceMap = { mobile: 0, tablet: 0, desktop: 0 };
  windowViews.forEach(v => { if (v.device_type) deviceMap[v.device_type] = (deviceMap[v.device_type] || 0) + 1; });

  // Referrer breakdown
  const refMap = {};
  windowViews.forEach(v => {
    const r = v.referrer || "direct";
    refMap[r] = (refMap[r] || 0) + 1;
  });
  const refData = Object.entries(refMap).sort((a,b) => b[1]-a[1]).slice(0, 6)
    .map(([key, value]) => ({ key, value, sub: `${Math.round((value/totalViews)*100)}%` }));

  // Submissions funnel
  const subPending  = submissions.filter(s => s.status === "pending").length;
  const subApproved = submissions.filter(s => s.status === "approved").length;
  const subRejected = submissions.filter(s => s.status === "rejected").length;
  const subAcceptRate = submissions.length > 0
    ? `${Math.round((subApproved / submissions.length) * 100)}%` : "—";

  // Monthly publishing
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5-i), 1);
    const label = d.toLocaleString("default", { month: "short" });
    const count = articles.filter(a => {
      if (!a.published_at) return false;
      const p = new Date(a.published_at);
      return p.getMonth() === d.getMonth() && p.getFullYear() === d.getFullYear();
    }).length;
    return { key: label, value: count };
  });

  return (
    <div className="ad-page">

      {/* Header */}
      <div className="ad-header">
        <div className="ad-header-left">
          <span className="ad-eyebrow">Admin · Analytics</span>
          <h1 className="ad-title">Performance Overview</h1>
        </div>
        <div className="ad-header-right">
          <div className="ad-range-toggle">
            {[7, 30, 90].map(d => (
              <button key={d} className={`ad-range-btn ${range === d ? "active" : ""}`} onClick={() => setRange(d)}>
                {d}d
              </button>
            ))}
          </div>
          <button className="ad-export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? "Preparing…" : "↓ Export Excel"}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="ad-kpi-row">
        <KPI value={totalViews.toLocaleString()}   label="Page Views"       sub={`Last ${range} days`}      delta={viewDelta}    color="var(--accent)" />
        <KPI value={uniqueSessions.toLocaleString()} label="Unique Visitors" sub="anonymous sessions"       delta={sessionDelta} />
        <KPI value={avgSessionDepth}               label="Pages / Visit"    sub="engagement depth" />
        <KPI value={bounceRate}                    label="Bounce Rate"      sub="single-page sessions" />
        <KPI value={totalArticleViews.toLocaleString()} label="All-time Views" sub="across all articles" />
        <KPI value={articles.length}               label="Published"        sub="articles total" />
        <KPI value={subPending}                    label="Pending"          sub="submissions" />
        <KPI value={subAcceptRate}                 label="Accept Rate"      sub="submissions approved" />
      </div>

      {/* Traffic sparkline */}
      <div className="ad-card ad-card--wide">
        <div className="ad-card-header">
          <span className="ad-card-title">Traffic — Last {range} Days</span>
          <span className="ad-card-sub">{totalViews.toLocaleString()} views · {uniqueSessions.toLocaleString()} visitors</span>
        </div>
        {totalViews === 0
          ? <p className="ad-empty ad-empty--center">No views recorded yet. Views will appear here once readers visit articles.</p>
          : <>
              <Spark points={dailyViews} height={72} />
              <div className="ad-spark-labels">
                {dailyLabels.map((l, i) => <span key={i}>{l}</span>)}
              </div>
            </>
        }
      </div>

      {/* Main grid */}
      <div className="ad-grid">

        {/* Left col */}
        <div className="ad-col">

          {/* Top articles */}
          <div className="ad-card">
            <div className="ad-card-header">
              <span className="ad-card-title">Top Articles by Views</span>
              <span className="ad-card-sub">{topArticles.length} with data</span>
            </div>
            {topArticles.length === 0
              ? <p className="ad-empty">Views will appear here once articles are read.</p>
              : <div className="ad-articles-table">
                  <div className="ad-table-header">
                    <span>Article</span><span>Views</span><span>Est. Readers</span>
                  </div>
                  {topArticles.map((a, i) => (
                    <a key={a.id} href={`/article/${a.id}`} target="_blank" rel="noreferrer" className="ad-article-row">
                      <span className="ad-article-rank">{i + 1}</span>
                      <div className="ad-article-info">
                        <span className="ad-article-title">{a.title}</span>
                        <span className="ad-article-meta">
                          {a.author && <span>{a.author}</span>}
                          {a.category && <span className="ad-cat">{a.category}</span>}
                        </span>
                      </div>
                      <span className="ad-article-views">{(a.view_count||0).toLocaleString()}</span>
                      <span className="ad-article-readers">{Math.round((a.view_count||0)*0.72).toLocaleString()}</span>
                    </a>
                  ))}
                </div>
            }
          </div>

          {/* Category views */}
          <div className="ad-card">
            <div className="ad-card-header">
              <span className="ad-card-title">Views by Category</span>
            </div>
            <HBar rows={catData} color="var(--accent)" />
          </div>

        </div>

        {/* Right col */}
        <div className="ad-col">

          {/* Device + Traffic sources */}
          <div className="ad-two-col">
            <div className="ad-card">
              <div className="ad-card-header">
                <span className="ad-card-title">Devices</span>
              </div>
              {totalViews === 0
                ? <p className="ad-empty">No data yet.</p>
                : <Donut segments={[
                    { value: deviceMap.desktop, color: "var(--accent)",  label: "Desktop" },
                    { value: deviceMap.mobile,  color: "#a78bfa",         label: "Mobile"  },
                    { value: deviceMap.tablet,  color: "#38bdf8",         label: "Tablet"  },
                  ]} />
              }
            </div>

            <div className="ad-card">
              <div className="ad-card-header">
                <span className="ad-card-title">Traffic Sources</span>
              </div>
              <HBar rows={refData} color="#a78bfa" />
            </div>
          </div>

          {/* Publishing velocity */}
          <div className="ad-card">
            <div className="ad-card-header">
              <span className="ad-card-title">Publishing Velocity</span>
              <span className="ad-card-sub">Last 6 months</span>
            </div>
            <div className="ad-month-grid">
              {months6.map(m => (
                <div key={m.key} className="ad-month-cell">
                  <div className="ad-month-bar-wrap">
                    <div className="ad-month-bar"
                      style={{ height: `${Math.max((m.value / Math.max(...months6.map(x=>x.value), 1)) * 100, m.value > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className="ad-month-n">{m.value}</span>
                  <span className="ad-month-l">{m.key}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Submissions funnel */}
          <div className="ad-card">
            <div className="ad-card-header">
              <span className="ad-card-title">Submissions Funnel</span>
              <span className="ad-card-sub">{submissions.length} total · {subAcceptRate} acceptance</span>
            </div>
            <div className="ad-funnel">
              {[
                { label: "Received",  value: submissions.length, color: "rgba(255,255,255,.15)", pct: 100 },
                { label: "Pending",   value: subPending,  color: "var(--accent)",  pct: Math.round((subPending/Math.max(submissions.length,1))*100) },
                { label: "Approved",  value: subApproved, color: "#4ade80",         pct: Math.round((subApproved/Math.max(submissions.length,1))*100) },
                { label: "Rejected",  value: subRejected, color: "var(--accent2)",  pct: Math.round((subRejected/Math.max(submissions.length,1))*100) },
              ].map(row => (
                <div key={row.label} className="ad-funnel-row">
                  <span className="ad-funnel-label">{row.label}</span>
                  <div className="ad-funnel-track">
                    <div className="ad-funnel-fill" style={{ width: `${row.pct}%`, background: row.color }} />
                  </div>
                  <span className="ad-funnel-val">{row.value}</span>
                  <span className="ad-funnel-pct">{row.pct}%</span>
                </div>
              ))}
            </div>

            {/* Event entries */}
            {eventSubs.length > 0 && (
              <>
                <div className="ad-card-header" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                  <span className="ad-card-title">Event Entries</span>
                  <span className="ad-card-sub">{eventSubs.length} total</span>
                </div>
                <div className="ad-funnel">
                  {["pending","approved","rejected"].map(s => {
                    const n = eventSubs.filter(x => x.status === s).length;
                    return (
                      <div key={s} className="ad-funnel-row">
                        <span className="ad-funnel-label" style={{ textTransform: "capitalize" }}>{s}</span>
                        <div className="ad-funnel-track">
                          <div className="ad-funnel-fill" style={{
                            width: `${Math.round((n/Math.max(eventSubs.length,1))*100)}%`,
                            background: s==="approved"?"#4ade80":s==="rejected"?"var(--accent2)":"var(--accent)"
                          }} />
                        </div>
                        <span className="ad-funnel-val">{n}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* All articles table */}
      <div className="ad-card ad-card--wide">
        <div className="ad-card-header">
          <span className="ad-card-title">All Articles — Performance Table</span>
          <span className="ad-card-sub">{articles.length} articles</span>
        </div>
        <div className="ad-full-table">
          <div className="ad-full-header">
            <span>Title</span><span>Author</span><span>Category</span>
            <span>Published</span><span>Views</span><span>Est. Readers</span>
          </div>
          {[...articles].sort((a,b) => (b.view_count||0)-(a.view_count||0)).map(a => (
            <div key={a.id} className="ad-full-row">
              <span className="ad-full-title">
                <a href={`/article/${a.id}`} target="_blank" rel="noreferrer">{a.title}</a>
              </span>
              <span className="ad-full-author">{a.author || "—"}</span>
              <span className="ad-full-cat">
                {a.category ? <span className="ad-cat">{a.category}</span> : "—"}
              </span>
              <span className="ad-full-date">{a.published_at ? formatDate(a.published_at) : "Draft"}</span>
              <span className="ad-full-views">{(a.view_count||0).toLocaleString()}</span>
              <span className="ad-full-readers">{Math.round((a.view_count||0)*0.72).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
