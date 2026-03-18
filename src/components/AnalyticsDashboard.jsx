import { useEffect, useState, useCallback, useMemo, useRef, useId } from "react";
import {
  getAnalytics, getEvents, getEventSubmissions,
  getPageViewStats, getArticlesWithViews,
} from "../utils/supabase";
import { formatDate } from "../utils/dateUtils";
import "./AnalyticsDashboard.css";

// ── Excel export ──────────────────────────────────────────
function exportToExcel(data) {
  const { articles, views, submissions, eventSubs } = data;
  const now = new Date().toLocaleDateString("en-GB");

  const artSheet = [
    ["Article Performance Report — Chréma Magazine", `Generated: ${now}`],
    [],
    ["Title", "Author", "Category", "Published", "Total Views", "Est. Unique Readers"],
    ...articles.map(a => [
      a.title, a.author || "—", a.category || "—",
      a.published_at ? new Date(a.published_at).toLocaleDateString("en-GB") : "Draft",
      a.view_count || 0,
      Math.round((a.view_count || 0) * 0.72),
    ]),
    [],
    ["TOTALS", "", "", "",
      articles.reduce((s, a) => s + (a.view_count || 0), 0),
      Math.round(articles.reduce((s, a) => s + (a.view_count || 0), 0) * 0.72),
    ],
  ];

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
      .map(([date, d]) => [date, d.views, d.sessions.size, (d.views / d.sessions.size).toFixed(1)]),
  ];

  const devices = {};
  const referrers = {};
  views.forEach(v => {
    devices[v.device_type || "unknown"] = (devices[v.device_type || "unknown"] || 0) + 1;
    referrers[v.referrer || "direct"] = (referrers[v.referrer || "direct"] || 0) + 1;
  });
  const audienceSheet = [
    ["Audience Report", `Generated: ${now}`],
    [],
    ["Device Type", "Views", "Share %"],
    ...Object.entries(devices).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, `${((v / views.length) * 100).toFixed(1)}%`]),
    [],
    ["Traffic Source", "Views", "Share %"],
    ...Object.entries(referrers).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, `${((v / views.length) * 100).toFixed(1)}%`]),
  ];

  const subSheet = [
    ["Submissions Pipeline", `Generated: ${now}`],
    [],
    ["Status", "Count", "% of Total"],
    ...["pending", "approved", "rejected"].map(s => {
      const n = submissions.filter(x => x.status === s).length;
      return [s, n, `${((n / Math.max(submissions.length, 1)) * 100).toFixed(1)}%`];
    }),
  ];

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

  const sheetToHTML = (name, rows) => `<table>${rows.map((row, ri) =>
    `<tr>${row.map((cell) => {
      const isHeader = ri === 0 || ri === 2;
      return `<td${isHeader ? ' style="font-weight:bold;background:#e8ff47"' : ''}>${cell == null ? "" : cell}</td>`;
    }).join("")}</tr>`).join("")}</table>`;

  const workbook = `<html lang="en" xmlns:x="urn:schemas-microsoft-com:office:excel"
xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Articles</x:Name><x:WorksheetOptions><x:Selected/></x:WorksheetOptions></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>Traffic</x:Name></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>Audience</x:Name></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>Submissions</x:Name></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>Event Entries</x:Name></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>
${sheetToHTML("Articles", artSheet)}
${sheetToHTML("Traffic", trafficSheet)}
${sheetToHTML("Audience", audienceSheet)}
${sheetToHTML("Submissions", subSheet)}
${sheetToHTML("Event Entries", eventSubSheet)}
</body></html>`;

  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chrema-analytics-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card ──────────────────────────────────────────────
function KPI({ value, label, sub, delta, accent = false }) {
  const isPos = delta > 0;
  const neutral = delta === 0 || delta === null || delta === undefined;
  return (
    <div className={`kpi-card${accent ? " kpi-card--accent" : ""}`}>
      <div className="kpi-top">
        <span className="kpi-value">{value}</span>
        {!neutral && (
          <span className={`kpi-delta ${isPos ? "up" : "down"}`}>
            {isPos ? "↑" : "↓"}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

// ── Comparison Sparkline ──────────────────────────────────
function CompareChart({ current, previous, height = 96 }) {
  const uid = useId().replace(/:/g, "");
  if (!current?.length) return <p className="ad-empty ad-empty--center">No views recorded yet.</p>;
  const allVals = [...current, ...(previous || [])];
  const max = Math.max(...allVals, 1);
  const W = 200, H = height;

  const toPoints = (pts) => pts.map((v, i) => {
    const x = (i / Math.max(pts.length - 1, 1)) * W;
    const y = H - (v / max) * H * 0.9;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");

  const toArea = (pts) => {
    const line = toPoints(pts);
    return `0,${H} ${line} ${W},${H}`;
  };

  const curPts = toPoints(current);
  const curArea = toArea(current);
  const prevPts = previous?.length ? toPoints(previous) : null;
  const prevArea = previous?.length ? toArea(previous) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ width: "100%", height: `${H}px`, display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`cg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pg-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--muted)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--muted)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {prevArea && <polygon points={prevArea} fill={`url(#pg-${uid})`} />}
      {prevPts && <polyline points={prevPts} fill="none" stroke="var(--muted)" strokeWidth="1"
        strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />}
      <polygon points={curArea} fill={`url(#cg-${uid})`} />
      <polyline points={curPts} fill="none" stroke="var(--accent)" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Bar chart ─────────────────────────────────────────────
function BarChart({ rows, color = "var(--accent)", compareRows, compareColor = "var(--muted)" }) {
  if (!rows?.length) return <p className="ad-empty">No data yet.</p>;
  const allVals = [...rows.map(r => r.value), ...(compareRows || []).map(r => r.value)];
  const max = Math.max(...allVals, 1);
  return (
    <div className="hbar">
      {rows.map((r, i) => {
        const cmp = compareRows?.[i];
        return (
          <div key={i} className="hbar-row">
            <span className="hbar-key" title={r.key}>{r.key}</span>
            <div className="hbar-track">
              {cmp && (
                <div className="hbar-fill hbar-fill--cmp"
                  style={{ width: `${(cmp.value / max) * 100}%`, background: compareColor }} />
              )}
              <div className="hbar-fill"
                style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%`, background: color }} />
            </div>
            <span className="hbar-val">{r.value.toLocaleString()}</span>
            {r.sub && <span className="hbar-sub">{r.sub}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────
function Donut({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 30, C = 2 * Math.PI * R;
  let cumPct = 0;
  return (
    <div className="donut-wrap">
      <svg width="88" height="88" viewBox="0 0 88 88">
        {segments.map((s, i) => {
          const pct = s.value / total;
          const dash = pct * C;
          const offset = C * 0.25 - cumPct * C;
          cumPct += pct;
          return (
            <circle key={i} cx="44" cy="44" r={R} fill="none"
              stroke={s.color} strokeWidth="10"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              strokeLinecap="butt" />
          );
        })}
        <circle cx="44" cy="44" r="24" fill="var(--surface)" />
        <text x="44" y="48" textAnchor="middle" fill="var(--text)"
          fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
          {total.toLocaleString()}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div key={i} className="donut-row">
            <span className="donut-dot" style={{ background: s.color }} />
            <span className="donut-label">{s.label}</span>
            <span className="donut-pct">{total > 0 ? `${Math.round((s.value / total) * 100)}%` : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Column bar (publishing velocity) ─────────────────────
function ColBar({ rows }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="colbar">
      {rows.map((r, i) => (
        <div key={i} className="colbar-col">
          <span className="colbar-val">{r.value || ""}</span>
          <div className="colbar-track">
            <div className="colbar-fill"
              style={{ height: `${Math.max((r.value / max) * 100, r.value > 0 ? 6 : 0)}%` }} />
          </div>
          <span className="colbar-label">{r.key}</span>
        </div>
      ))}
    </div>
  );
}

// ── Author breakdown ──────────────────────────────────────
function AuthorPanel({ articles }) {
  const [sortBy, setSortBy] = useState("views");

  const authorMap = useMemo(() => {
    const map = {};
    articles.forEach(a => {
      const author = a.author || "Unknown";
      if (!map[author]) map[author] = { articles: 0, views: 0, categories: new Set() };
      map[author].articles++;
      map[author].views += a.view_count || 0;
      if (a.category) map[author].categories.add(a.category);
    });
    return map;
  }, [articles]);

  const rows = Object.entries(authorMap)
    .map(([name, d]) => ({
      name,
      articles: d.articles,
      views: d.views,
      avgViews: d.articles > 0 ? Math.round(d.views / d.articles) : 0,
      categories: [...d.categories].join(", "),
    }))
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const maxViews = Math.max(...rows.map(r => r.views), 1);

  return (
    <div className="author-panel">
      <div className="author-sort">
        {[["views", "By Views"], ["articles", "By Articles"], ["avgViews", "By Avg Views"]].map(([k, l]) => (
          <button key={k} className={`sort-btn ${sortBy === k ? "active" : ""}`} onClick={() => setSortBy(k)}>{l}</button>
        ))}
      </div>
      <div className="author-table">
        {rows.map((r, i) => (
          <div key={r.name} className="author-row">
            <span className="author-rank">#{i + 1}</span>
            <div className="author-info">
              <span className="author-name">{r.name}</span>
              {r.categories && <span className="author-cats">{r.categories}</span>}
            </div>
            <div className="author-bar-wrap">
              <div className="author-bar" style={{ width: `${(r.views / maxViews) * 100}%` }} />
            </div>
            <div className="author-stats">
              <span className="author-stat">{r.views.toLocaleString()} <em>views</em></span>
              <span className="author-stat">{r.articles} <em>articles</em></span>
              <span className="author-stat">{r.avgViews.toLocaleString()} <em>avg</em></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Date range picker ─────────────────────────────────────
function DateRangePicker({ startDate, endDate, onChange }) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const presets = [
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
    { label: "All", days: 365 },
  ];

  const applyPreset = (days) => {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    onChange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    setOpen(false);
  };

  const applyCustom = () => {
    onChange(tempStart, tempEnd);
    setOpen(false);
  };

  const fmt = d => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });

  return (
    <div className="drp" ref={ref}>
      <button className="drp-trigger" onClick={() => setOpen(o => !o)}>
        <span className="drp-icon">📅</span>
        <span>{fmt(startDate)} – {fmt(endDate)}</span>
        <span className="drp-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="drp-panel">
          <div className="drp-presets">
            {presets.map(p => (
              <button key={p.label} className="drp-preset" onClick={() => applyPreset(p.days)}>{p.label}</button>
            ))}
          </div>
          <div className="drp-custom">
            <label>From <input type="date" value={tempStart} onChange={e => setTempStart(e.target.value)} /></label>
            <label>To <input type="date" value={tempEnd} onChange={e => setTempEnd(e.target.value)} /></label>
            <button className="drp-apply" onClick={applyCustom}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(t => (
        <button key={t.id} className={`tab-btn ${active === t.id ? "active" : ""}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("traffic");
  const [articleSearch, setArticleSearch] = useState("");
  const [articleCat, setArticleCat] = useState("All");
  const [articleSort, setArticleSort] = useState("views");
  const [articleSortDir, setArticleSortDir] = useState("desc");
  const [showCompare, setShowCompare] = useState(true);

  // Date range state
  const initEnd = new Date().toISOString().slice(0, 10);
  const initStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(initStart);
  const [endDate, setEndDate] = useState(initEnd);

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
        articles:    Array.isArray(articlesWithViews)     ? articlesWithViews     : [],
        submissions: Array.isArray(analytics.submissions) ? analytics.submissions : [],
        trash:       Array.isArray(analytics.trash)       ? analytics.trash       : [],
        views:       Array.isArray(views)                 ? views                 : [],
        events:      Array.isArray(events)                ? events                : [],
        eventSubs:   Array.isArray(eventSubs)             ? eventSubs             : [],
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

  const handleRangeChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  // ── Hooks that must run unconditionally (before any early return) ──
  const filteredArticles = useMemo(() => {
    const articles_safe = raw?.articles ?? [];
    let arr = [...articles_safe];
    if (articleSearch) {
      const q = articleSearch.toLowerCase();
      arr = arr.filter(a =>
        a.title?.toLowerCase().includes(q) ||
        a.author?.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q)
      );
    }
    if (articleCat !== "All") arr = arr.filter(a => a.category === articleCat);
    arr.sort((a, b) => {
      let va, vb;
      if (articleSort === "views") { va = a.view_count || 0; vb = b.view_count || 0; }
      else if (articleSort === "title") { va = a.title || ""; vb = b.title || ""; return articleSortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va); }
      else if (articleSort === "published") { va = a.published_at ? new Date(a.published_at).getTime() : 0; vb = b.published_at ? new Date(b.published_at).getTime() : 0; }
      else if (articleSort === "author") { va = a.author || ""; vb = b.author || ""; return articleSortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va); }
      return articleSortDir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [raw?.articles, articleSearch, articleCat, articleSort, articleSortDir]);

  if (loading) return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <span>Loading analytics…</span>
    </div>
  );
  if (error) return (
    <div className="ad-error"><span>⚠</span><p>Failed to load: {error}</p></div>
  );

    const articles    = raw?.articles    ?? [];
    const submissions = raw?.submissions ?? [];
    const views       = raw?.views       ?? [];
    const eventSubs   = raw?.eventSubs   ?? [];
  const startMs = new Date(startDate).getTime();
  const endMs   = new Date(endDate).getTime() + 86400000;
  const rangeDays = Math.round((endMs - startMs) / 86400000);

  const windowViews = views.filter(v => {
    const t = new Date(v.viewed_at).getTime();
    return t >= startMs && t < endMs;
  });

  const prevStart = startMs - (endMs - startMs);
  const prevViews = views.filter(v => {
    const t = new Date(v.viewed_at).getTime();
    return t >= prevStart && t < startMs;
  });

  // ── KPI computation ──────────────────────────────────
  const totalViews      = windowViews.length;
  const prevTotalViews  = prevViews.length;
  const viewDelta       = prevTotalViews > 0 ? Math.round(((totalViews - prevTotalViews) / prevTotalViews) * 100) : null;

  const uniqueSessions  = new Set(windowViews.map(v => v.session_id)).size;
  const prevSessions    = new Set(prevViews.map(v => v.session_id)).size;
  const sessionDelta    = prevSessions > 0 ? Math.round(((uniqueSessions - prevSessions) / prevSessions) * 100) : null;

  const avgDepth = uniqueSessions > 0 ? (totalViews / uniqueSessions).toFixed(1) : "0";

  const sessionViewMap = {};
  windowViews.forEach(v => { sessionViewMap[v.session_id] = (sessionViewMap[v.session_id] || 0) + 1; });
  const bounceSessions = Object.values(sessionViewMap).filter(n => n === 1).length;
  const bounceRate = uniqueSessions > 0 ? `${Math.round((bounceSessions / uniqueSessions) * 100)}%` : "—";

  const subPending  = submissions.filter(s => s.status === "pending").length;
  const subApproved = submissions.filter(s => s.status === "approved").length;
  const subRejected = submissions.filter(s => s.status === "rejected").length;
  const subAcceptRate = submissions.length > 0 ? `${Math.round((subApproved / submissions.length) * 100)}%` : "—";

  // ── Daily views for compare chart ────────────────────
  const dayLabels = Array.from({ length: rangeDays }, (_, i) => {
    const d = new Date(startMs + i * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const prevDayLabels = Array.from({ length: rangeDays }, (_, i) => {
    const d = new Date(prevStart + i * 86400000);
    return d.toISOString().slice(0, 10);
  });

  const dailyViews = dayLabels.map(day => windowViews.filter(v => v.viewed_at.startsWith(day)).length);
  const prevDailyViews = prevDayLabels.map(day => prevViews.filter(v => v.viewed_at.startsWith(day)).length);

  const sparkLabels = dayLabels
    .map((d, i) => (i === 0 || i === Math.floor(rangeDays / 2) || i === rangeDays - 1)
      ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

  // ── Categories ────────────────────────────────────────
  const allCategories = ["All", ...new Set(articles.map(a => a.category).filter(Boolean))];

  const catViews = articles.reduce((acc, a) => {
    const cat = a.category || "Uncategorised";
    acc[cat] = (acc[cat] || 0) + (a.view_count || 0);
    return acc;
  }, {});
  const catData = Object.entries(catViews).sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([key, value]) => ({ key, value }));

  // Previous period category data for comparison
  const prevCatViews = {};
  prevViews.forEach(v => {
    const art = articles.find(a => a.id === v.article_id);
    if (art) {
      const cat = art.category || "Uncategorised";
      prevCatViews[cat] = (prevCatViews[cat] || 0) + 1;
    }
  });
  const catCompareData = catData.map(r => ({ key: r.key, value: prevCatViews[r.key] || 0 }));

  // ── Devices & referrers ───────────────────────────────
  const deviceMap = { mobile: 0, tablet: 0, desktop: 0 };
  windowViews.forEach(v => { if (v.device_type) deviceMap[v.device_type] = (deviceMap[v.device_type] || 0) + 1; });

  const refMap = {};
  windowViews.forEach(v => {
    const r = v.referrer || "direct";
    refMap[r] = (refMap[r] || 0) + 1;
  });
  const refData = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([key, value]) => ({ key, value, sub: totalViews > 0 ? `${Math.round((value / totalViews) * 100)}%` : "0%" }));

  // ── Publishing velocity ───────────────────────────────
  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
    const label = d.toLocaleString("default", { month: "short" });
    const count = articles.filter(a => {
      if (!a.published_at) return false;
      const p = new Date(a.published_at);
      return p.getMonth() === d.getMonth() && p.getFullYear() === d.getFullYear();
    }).length;
    return { key: label, value: count };
  });

  const toggleSort = (col) => {
    if (articleSort === col) setArticleSortDir(d => d === "desc" ? "asc" : "desc");
    else { setArticleSort(col); setArticleSortDir("desc"); }
  };

  const SortIcon = ({ col }) => {
    if (articleSort !== col) return <span className="sort-icon sort-icon--inactive">↕</span>;
    return <span className="sort-icon">{articleSortDir === "desc" ? "↓" : "↑"}</span>;
  };

  const totalArticleViews = articles.reduce((s, a) => s + (a.view_count || 0), 0);

  return (
    <div className="ad-page">

      {/* ── Header ── */}
      <div className="ad-header">
        <div className="ad-header-left">
          <span className="ad-eyebrow">Admin · Analytics</span>
          <h1 className="ad-title">Performance Overview</h1>
        </div>
        <div className="ad-header-right">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={handleRangeChange} />
          <button className="ad-compare-toggle" onClick={() => setShowCompare(c => !c)}>
            {showCompare ? "Hide" : "Show"} comparison
          </button>
          <button className="ad-export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? "Preparing…" : "↓ Export"}
          </button>
        </div>
      </div>

      {showCompare && (
        <div className="ad-compare-banner">
          <span className="compare-label">Comparing to previous period</span>
          <span className="compare-range">
            {new Date(prevStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
            {new Date(startMs - 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
          <span className="compare-legend">
            <span className="legend-dot legend-dot--current" /> Current
            <span className="legend-dot legend-dot--prev" /> Previous
          </span>
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="ad-kpi-row">
        <KPI value={totalViews.toLocaleString()}        label="Page Views"      sub={`${rangeDays}d window`}        delta={viewDelta}    accent />
        <KPI value={uniqueSessions.toLocaleString()}    label="Unique Visitors" sub="anonymous sessions"           delta={sessionDelta} />
        <KPI value={avgDepth}                           label="Pages / Visit"   sub="engagement depth" />
        <KPI value={bounceRate}                         label="Bounce Rate"     sub="single-page sessions" />
        <KPI value={totalArticleViews.toLocaleString()} label="All-time Views" sub="across all articles" />
        <KPI value={articles.length}                    label="Published"       sub="articles total" />
        <KPI value={subPending}                         label="Pending"         sub="submissions" />
        <KPI value={subAcceptRate}                      label="Accept Rate"     sub="submissions approved" />
      </div>

      {/* ── Tabbed main sections ── */}
      <div className="ad-tabs-wrap">
        <Tabs
          tabs={[
            { id: "traffic",     label: "Traffic" },
            { id: "content",     label: "Content" },
            { id: "authors",     label: "Authors" },
            { id: "submissions", label: "Submissions" },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* ── Traffic tab ── */}
      {activeTab === "traffic" && (
        <div className="tab-content">
          {/* Traffic chart */}
          <div className="ad-card ad-card--wide">
            <div className="ad-card-header">
              <span className="ad-card-title">Daily Traffic</span>
              <span className="ad-card-sub">
                {totalViews.toLocaleString()} views · {uniqueSessions.toLocaleString()} visitors
              </span>
            </div>
            <CompareChart
              current={dailyViews}
              previous={showCompare ? prevDailyViews : null}
              height={96}
            />
            <div className="ad-spark-labels">
              {sparkLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>

          <div className="ad-grid">
            <div className="ad-col">
              {/* Devices */}
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

              {/* Publishing velocity */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Publishing Velocity</span>
                  <span className="ad-card-sub">Last 6 months</span>
                </div>
                <ColBar rows={months6} />
              </div>
            </div>

            <div className="ad-col">
              {/* Traffic sources */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Traffic Sources</span>
                </div>
                <BarChart rows={refData} color="#a78bfa" />
              </div>

              {/* Category performance with comparison */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Views by Category</span>
                  {showCompare && <span className="ad-card-sub">vs. previous period</span>}
                </div>
                <BarChart
                  rows={catData}
                  color="var(--accent)"
                  compareRows={showCompare ? catCompareData : null}
                  compareColor="rgba(255,255,255,0.12)"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Content tab ── */}
      {activeTab === "content" && (
        <div className="tab-content">
          {/* Search + filter toolbar */}
          <div className="article-toolbar">
            <div className="article-search-wrap">
              <span className="search-icon">⌕</span>
              <input
                className="article-search"
                placeholder="Search articles, authors, categories…"
                value={articleSearch}
                onChange={e => setArticleSearch(e.target.value)}
              />
              {articleSearch && (
                <button className="search-clear" onClick={() => setArticleSearch("")}>✕</button>
              )}
            </div>
            <select className="article-cat-select" value={articleCat} onChange={e => setArticleCat(e.target.value)}>
              {allCategories.map(c => <option key={c}>{c}</option>)}
            </select>
            <span className="article-count">{filteredArticles.length} articles</span>
          </div>

          <div className="ad-card ad-card--wide">
            <div className="ad-full-table">
              <div className="ad-full-header">
                <span className="sortable" onClick={() => toggleSort("title")}>Title <SortIcon col="title" /></span>
                <span className="sortable" onClick={() => toggleSort("author")}>Author <SortIcon col="author" /></span>
                <span>Category</span>
                <span className="sortable" onClick={() => toggleSort("published")}>Published <SortIcon col="published" /></span>
                <span className="sortable" onClick={() => toggleSort("views")}>Views <SortIcon col="views" /></span>
                <span>Est. Readers</span>
              </div>
              {filteredArticles.length === 0 ? (
                <div className="ad-empty ad-empty--center" style={{ padding: "2rem" }}>
                  No articles match your filters.
                </div>
              ) : (
                filteredArticles.map(a => (
                  <div key={a.id} className="ad-full-row">
                    <span className="ad-full-title">
                      <a href={`/article/${a.id}`} target="_blank" rel="noreferrer">{a.title}</a>
                    </span>
                    <span className="ad-full-author">{a.author || "—"}</span>
                    <span className="ad-full-cat">
                      {a.category ? <span className="ad-cat">{a.category}</span> : "—"}
                    </span>
                    <span className="ad-full-date">
                      {a.published_at ? formatDate(a.published_at) : <em className="ad-draft">Draft</em>}
                    </span>
                    <span className="ad-full-views">{(a.view_count || 0).toLocaleString()}</span>
                    <span className="ad-full-readers">{Math.round((a.view_count || 0) * 0.72).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Authors tab ── */}
      {activeTab === "authors" && (
        <div className="tab-content">
          <div className="ad-card ad-card--wide">
            <div className="ad-card-header">
              <span className="ad-card-title">Author Performance</span>
              <span className="ad-card-sub">{new Set(articles.map(a => a.author).filter(Boolean)).size} authors</span>
            </div>
            <AuthorPanel articles={articles} />
          </div>
        </div>
      )}

      {/* ── Submissions tab ── */}
      {activeTab === "submissions" && (
        <div className="tab-content">
          <div className="ad-grid">
            <div className="ad-col">
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Submissions Funnel</span>
                  <span className="ad-card-sub">{submissions.length} total · {subAcceptRate} acceptance</span>
                </div>
                <div className="ad-funnel">
                  {[
                    { label: "Received", value: submissions.length, color: "rgba(255,255,255,.12)", pct: 100 },
                    { label: "Pending",  value: subPending,  color: "var(--accent)", pct: Math.round((subPending  / Math.max(submissions.length, 1)) * 100) },
                    { label: "Approved", value: subApproved, color: "#4ade80",        pct: Math.round((subApproved / Math.max(submissions.length, 1)) * 100) },
                    { label: "Rejected", value: subRejected, color: "#f87171",        pct: Math.round((subRejected / Math.max(submissions.length, 1)) * 100) },
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
              </div>
            </div>

            <div className="ad-col">
              {eventSubs.length > 0 && (
                <div className="ad-card">
                  <div className="ad-card-header">
                    <span className="ad-card-title">Event Entries</span>
                    <span className="ad-card-sub">{eventSubs.length} total</span>
                  </div>
                  <div className="ad-funnel">
                    {["pending", "approved", "rejected"].map(s => {
                      const n = eventSubs.filter(x => x.status === s).length;
                      return (
                        <div key={s} className="ad-funnel-row">
                          <span className="ad-funnel-label" style={{ textTransform: "capitalize" }}>{s}</span>
                          <div className="ad-funnel-track">
                            <div className="ad-funnel-fill" style={{
                              width: `${Math.round((n / Math.max(eventSubs.length, 1)) * 100)}%`,
                              background: s === "approved" ? "#4ade80" : s === "rejected" ? "#f87171" : "var(--accent)"
                            }} />
                          </div>
                          <span className="ad-funnel-val">{n}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
