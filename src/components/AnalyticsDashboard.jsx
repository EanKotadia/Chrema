import { useEffect, useState, useCallback, useMemo, useRef, useId } from "react";
import {
  getAnalytics, getEvents, getEventSubmissions,
  getPageViewStats, getArticlesWithViews,
} from "../utils/supabase";
import { formatDate } from "../utils/dateUtils";
import "./AnalyticsDashboard.css";

// ── Safe helpers ──────────────────────────────────────────
const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeNum = (v) => (typeof v === "number" && isFinite(v) ? v : 0);

// ── Excel export ──────────────────────────────────────────
function exportToExcel(data) {
  try {
    const articles = safeArr(data?.articles);
    const subs     = safeArr(data?.submissions);
    const now       = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

    const sheetToHTML = (rows) =>
      `<table>${rows.map((row, ri) =>
        `<tr>${safeArr(row).map((cell) => {
          const h = ri === 0 || ri === 2;
          return `<td${h ? ' style="font-weight:bold;background:#e8ff47"' : ""}>${cell == null ? "" : cell}</td>`;
        }).join("")}</tr>`
      ).join("")}</table>`;

    const artSheet = [
      ["Article Performance Report — Chréma", `Generated: ${now}`], [],
      ["Title", "Author", "Category", "Published", "Views", "Est. Readers"],
      ...articles.map(a => [
        a.title, a.author || "—", a.category || "—",
        a.published_at ? new Date(a.published_at).toLocaleDateString("en-IN") : "Draft",
        safeNum(a.view_count),
        Math.round(safeNum(a.view_count) * 0.72),
      ]),
    ];

    const subSheet = [
      ["Submissions", `Generated: ${now}`], [],
      ["Status", "Count"],
      ...["pending", "approved", "rejected"].map(s => [
        s, subs.filter(x => x.status === s).length,
      ]),
    ];

    const workbook = `<html lang="en" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Articles</x:Name></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>Submissions</x:Name></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>${sheetToHTML(artSheet)}${sheetToHTML(subSheet)}</body></html>`;

    const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `chrema-analytics-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Export failed:", e);
  }
}

// ── KPI Card ──────────────────────────────────────────────
function KPI({ value, label, sub, delta, accent = false }) {
  const isPos   = delta > 0;
  const neutral = delta === 0 || delta == null;
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

// ── Sparkline ─────────────────────────────────────────────
function CompareChart({ current, previous, height = 96 }) {
  const uid  = useId().replace(/:/g, "");
  const cur  = safeArr(current);
  const prev = safeArr(previous);
  if (!cur.length) return <p className="ad-empty ad-empty--center">No views recorded yet.</p>;

  const allVals = [...cur, ...prev];
  const max = Math.max(...allVals, 1);
  const W = 200, H = height;

  const toPoints = (pts) =>
    pts.map((v, i) => {
      const x = (i / Math.max(pts.length - 1, 1)) * W;
      const y = H - (safeNum(v) / max) * H * 0.9;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

  const toArea   = (pts) => `0,${H} ${toPoints(pts)} ${W},${H}`;
  const curPts   = toPoints(cur);
  const curArea  = toArea(cur);
  const prevPts  = prev.length ? toPoints(prev) : null;
  const prevArea = prev.length ? toArea(prev)   : null;

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
      {prevPts  && <polyline points={prevPts} fill="none" stroke="var(--muted)" strokeWidth="1"
        strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />}
      <polygon points={curArea} fill={`url(#cg-${uid})`} />
      <polyline points={curPts} fill="none" stroke="var(--accent)" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Bar chart ─────────────────────────────────────────────
function BarChart({ rows, color = "var(--accent)", compareRows, compareColor = "var(--muted)" }) {
  const r = safeArr(rows);
  if (!r.length) return <p className="ad-empty">No data yet.</p>;
  const allVals = [...r.map(x => safeNum(x.value)), ...safeArr(compareRows).map(x => safeNum(x.value))];
  const max = Math.max(...allVals, 1);
  return (
    <div className="hbar">
      {r.map((row, i) => {
        const cmp = safeArr(compareRows)[i];
        return (
          <div key={i} className="hbar-row">
            <span className="hbar-key" title={row.key}>{row.key}</span>
            <div className="hbar-track">
              {cmp && <div className="hbar-fill hbar-fill--cmp"
                style={{ width: `${(safeNum(cmp.value) / max) * 100}%`, background: compareColor }} />}
              <div className="hbar-fill"
                style={{ width: `${Math.max((safeNum(row.value) / max) * 100, row.value > 0 ? 2 : 0)}%`, background: color }} />
            </div>
            <span className="hbar-val">{safeNum(row.value).toLocaleString()}</span>
            {row.sub && <span className="hbar-sub">{row.sub}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────
function Donut({ segments }) {
  const segs  = safeArr(segments);
  const total = segs.reduce((s, x) => s + safeNum(x.value), 0) || 1;
  const R = 30, C = 2 * Math.PI * R;
  let cumPct = 0;
  return (
    <div className="donut-wrap">
      <svg width="88" height="88" viewBox="0 0 88 88">
        {segs.map((s, i) => {
          const pct    = safeNum(s.value) / total;
          const dash   = pct * C;
          const offset = C * 0.25 - cumPct * C;
          cumPct += pct;
          return (
            <circle key={i} cx="44" cy="44" r={R} fill="none"
              stroke={s.color} strokeWidth="10"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset} strokeLinecap="butt" />
          );
        })}
        <circle cx="44" cy="44" r="24" fill="var(--surface)" />
        <text x="44" y="48" textAnchor="middle" fill="var(--text)"
          fontSize="12" fontFamily="var(--font-mono)" fontWeight="700">
          {total.toLocaleString()}
        </text>
      </svg>
      <div className="donut-legend">
        {segs.map((s, i) => (
          <div key={i} className="donut-row">
            <span className="donut-dot" style={{ background: s.color }} />
            <span className="donut-label">{s.label}</span>
            <span className="donut-pct">{`${Math.round((safeNum(s.value) / total) * 100)}%`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Column bar ────────────────────────────────────────────
function ColBar({ rows }) {
  const r   = safeArr(rows);
  const max = Math.max(...r.map(x => safeNum(x.value)), 1);
  return (
    <div className="colbar">
      {r.map((row, i) => (
        <div key={i} className="colbar-col">
          <span className="colbar-val">{row.value || ""}</span>
          <div className="colbar-track">
            <div className="colbar-fill"
              style={{ height: `${Math.max((safeNum(row.value) / max) * 100, row.value > 0 ? 6 : 0)}%` }} />
          </div>
          <span className="colbar-label">{row.key}</span>
        </div>
      ))}
    </div>
  );
}

// ── Author panel ──────────────────────────────────────────
function AuthorPanel({ articles }) {
  const [sortBy, setSortBy] = useState("views");
  const arts = safeArr(articles);

  const rows = useMemo(() => {
    const map = {};
    arts.forEach(a => {
      const author = a.author || "Unknown";
      if (!map[author]) map[author] = { articles: 0, views: 0, categories: new Set() };
      map[author].articles++;
      map[author].views += safeNum(a.view_count);
      if (a.category) map[author].categories.add(a.category);
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        articles:   d.articles,
        views:      d.views,
        avgViews:   d.articles > 0 ? Math.round(d.views / d.articles) : 0,
        categories: [...d.categories].join(", "),
      }))
      .sort((a, b) => safeNum(b[sortBy]) - safeNum(a[sortBy]));
  }, [arts, sortBy]);

  const maxViews = Math.max(...rows.map(r => r.views), 1);

  return (
    <div className="author-panel">
      <div className="author-sort">
        {[["views", "By Views"], ["articles", "By Articles"], ["avgViews", "By Avg"]].map(([k, l]) => (
          <button key={k} className={`sort-btn ${sortBy === k ? "active" : ""}`}
            onClick={() => setSortBy(k)}>{l}</button>
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
  const [open,      setOpen]      = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd,   setTempEnd]   = useState(endDate);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyPreset = (days) => {
    const end   = new Date();
    const start = new Date(Date.now() - days * 86400000);
    onChange(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    setOpen(false);
  };

  const fmt = (d) => {
    try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }); }
    catch { return d; }
  };

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
            {[["7d", 7], ["30d", 30], ["90d", 90], ["All", 365]].map(([label, days]) => (
              <button key={label} className="drp-preset" onClick={() => applyPreset(days)}>{label}</button>
            ))}
          </div>
          <div className="drp-custom">
            <label>From <input type="date" value={tempStart} onChange={e => setTempStart(e.target.value)} /></label>
            <label>To   <input type="date" value={tempEnd}   onChange={e => setTempEnd(e.target.value)} /></label>
            <button className="drp-apply" onClick={() => { onChange(tempStart, tempEnd); setOpen(false); }}>Apply</button>
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
      {safeArr(tabs).map(t => (
        <button key={t.id} className={`tab-btn ${active === t.id ? "active" : ""}`}
          onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [raw,           setRaw]           = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [exporting,     setExporting]     = useState(false);
  const [error,         setError]         = useState(null);
  const [activeTab,     setActiveTab]     = useState("traffic");
  const [articleSearch, setArticleSearch] = useState("");
  const [articleCat,    setArticleCat]    = useState("All");
  const [articleSort,   setArticleSort]   = useState("views");
  const [articleSortDir,setArticleSortDir]= useState("desc");
  const [showCompare,   setShowCompare]   = useState(true);

  const initEnd   = new Date().toISOString().slice(0, 10);
  const initStart = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(initStart);
  const [endDate,   setEndDate]   = useState(initEnd);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getAnalytics().catch(() => ({ articles: [], submissions: [], trash: [] })),
      getArticlesWithViews().catch(() => []),
      getPageViewStats().catch(() => []),
      getEvents().catch(() => []),
      getEventSubmissions(null).catch(() => []),
    ]).then(([analytics, articlesWithViews, views, events, eventSubs]) => {
      setRaw({
        articles:    safeArr(articlesWithViews),
        submissions: safeArr(analytics?.submissions),
        trash:       safeArr(analytics?.trash),
        views:       safeArr(views),
        events:      safeArr(events),
        eventSubs:   safeArr(eventSubs),
      });
    }).catch(err => {
      setError(err?.message || "Unknown error");
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── All hooks run unconditionally ──
  const articles    = safeArr(raw?.articles);
  const submissions = safeArr(raw?.submissions);
  const views       = safeArr(raw?.views);
  const eventSubs   = safeArr(raw?.eventSubs);

  const startMs   = (() => { try { return new Date(startDate).getTime(); } catch { return Date.now() - 30 * 86400000; } })();
  const endMs     = (() => { try { return new Date(endDate).getTime() + 86400000; } catch { return Date.now(); } })();
  const rangeDays = Math.max(Math.round((endMs - startMs) / 86400000), 1);
  const prevStart = startMs - (endMs - startMs);

  const windowViews = useMemo(() =>
    views.filter(v => { try { const t = new Date(v.viewed_at).getTime(); return t >= startMs && t < endMs; } catch { return false; } }),
    [views, startMs, endMs]);

  const prevViews = useMemo(() =>
    views.filter(v => { try { const t = new Date(v.viewed_at).getTime(); return t >= prevStart && t < startMs; } catch { return false; } }),
    [views, prevStart, startMs]);

  const dayLabels = useMemo(() =>
    Array.from({ length: rangeDays }, (_, i) => new Date(startMs + i * 86400000).toISOString().slice(0, 10)),
    [startMs, rangeDays]);

  const prevDayLabels = useMemo(() =>
    Array.from({ length: rangeDays }, (_, i) => new Date(prevStart + i * 86400000).toISOString().slice(0, 10)),
    [prevStart, rangeDays]);

  const dailyViews     = useMemo(() => dayLabels.map(day => windowViews.filter(v => v.viewed_at?.startsWith(day)).length), [dayLabels, windowViews]);
  const prevDailyViews = useMemo(() => prevDayLabels.map(day => prevViews.filter(v => v.viewed_at?.startsWith(day)).length), [prevDayLabels, prevViews]);

  const filteredArticles = useMemo(() => {
    let arr = [...articles];
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
      if (articleSort === "title") {
        const ta = a.title || "", tb = b.title || "";
        return articleSortDir === "asc" ? ta.localeCompare(tb) : tb.localeCompare(ta);
      }
      if (articleSort === "author") {
        const ta = a.author || "", tb = b.author || "";
        return articleSortDir === "asc" ? ta.localeCompare(tb) : tb.localeCompare(ta);
      }
      const va = articleSort === "published"
        ? (a.published_at ? new Date(a.published_at).getTime() : 0)
        : safeNum(a.view_count);
      const vb = articleSort === "published"
        ? (b.published_at ? new Date(b.published_at).getTime() : 0)
        : safeNum(b.view_count);
      return articleSortDir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [articles, articleSearch, articleCat, articleSort, articleSortDir]);

  if (loading) return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <span>Loading analytics…</span>
    </div>
  );

  if (error) return (
    <div className="ad-error">
      <span>⚠</span>
      <p>Failed to load: {error}</p>
      <button onClick={load} style={{ marginLeft: "1rem", cursor: "pointer" }}>Retry</button>
    </div>
  );

  // ── KPIs ──────────────────────────────────────────────
  const totalViews     = windowViews.length;
  const prevTotalViews = prevViews.length;
  const viewDelta      = prevTotalViews > 0 ? Math.round(((totalViews - prevTotalViews) / prevTotalViews) * 100) : null;

  const uniqueSessions = new Set(windowViews.map(v => v.session_id)).size;
  const prevSessions   = new Set(prevViews.map(v => v.session_id)).size;
  const sessionDelta   = prevSessions > 0 ? Math.round(((uniqueSessions - prevSessions) / prevSessions) * 100) : null;

  const avgDepth = uniqueSessions > 0 ? (totalViews / uniqueSessions).toFixed(1) : "0";

  const sessionViewMap = {};
  windowViews.forEach(v => { sessionViewMap[v.session_id] = (sessionViewMap[v.session_id] || 0) + 1; });
  const bounceSessions = Object.values(sessionViewMap).filter(n => n === 1).length;
  const bounceRate     = uniqueSessions > 0 ? `${Math.round((bounceSessions / uniqueSessions) * 100)}%` : "—";

  const subPending    = submissions.filter(s => s.status === "pending").length;
  const subApproved   = submissions.filter(s => s.status === "approved").length;
  const subRejected   = submissions.filter(s => s.status === "rejected").length;
  const subAcceptRate = submissions.length > 0 ? `${Math.round((subApproved / submissions.length) * 100)}%` : "—";

  const totalArticleViews = articles.reduce((s, a) => s + safeNum(a.view_count), 0);

  const sparkLabels = dayLabels.map((d, i) =>
    (i === 0 || i === Math.floor(rangeDays / 2) || i === rangeDays - 1)
      ? (() => { try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }); } catch { return d; } })()
      : "");

  const allCategories = ["All", ...new Set(articles.map(a => a.category).filter(Boolean))];

  const catViews = articles.reduce((acc, a) => {
    const cat = a.category || "Uncategorised";
    acc[cat] = (acc[cat] || 0) + safeNum(a.view_count);
    return acc;
  }, {});
  const catData = Object.entries(catViews).sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([key, value]) => ({ key, value }));

  const prevCatViews = {};
  prevViews.forEach(v => {
    const art = articles.find(a => a.id === v.article_id);
    if (art) { const cat = art.category || "Uncategorised"; prevCatViews[cat] = (prevCatViews[cat] || 0) + 1; }
  });
  const catCompareData = catData.map(r => ({ key: r.key, value: prevCatViews[r.key] || 0 }));

  const deviceMap = { mobile: 0, tablet: 0, desktop: 0 };
  windowViews.forEach(v => { if (v.device_type in deviceMap) deviceMap[v.device_type]++; });

  const refMap = {};
  windowViews.forEach(v => { const r = v.referrer || "direct"; refMap[r] = (refMap[r] || 0) + 1; });
  const refData = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([key, value]) => ({ key, value, sub: totalViews > 0 ? `${Math.round((value / totalViews) * 100)}%` : "0%" }));

  const months6 = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
    const key = d.toLocaleString("default", { month: "short" });
    const value = articles.filter(a => {
      if (!a.published_at) return false;
      try { const p = new Date(a.published_at); return p.getMonth() === d.getMonth() && p.getFullYear() === d.getFullYear(); }
      catch { return false; }
    }).length;
    return { key, value };
  });

  const toggleSort = (col) => {
    if (articleSort === col) setArticleSortDir(d => d === "desc" ? "asc" : "desc");
    else { setArticleSort(col); setArticleSortDir("desc"); }
  };

  const SortIcon = ({ col }) =>
    articleSort !== col
      ? <span className="sort-icon sort-icon--inactive">↕</span>
      : <span className="sort-icon">{articleSortDir === "desc" ? "↓" : "↑"}</span>;

  const fmtIST = (d) => { try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }); } catch { return ""; } };

  return (
    <div className="ad-page">

      {/* Header */}
      <div className="ad-header">
        <div className="ad-header-left">
          <span className="ad-eyebrow">Admin · Analytics</span>
          <h1 className="ad-title">Performance Overview</h1>
        </div>
        <div className="ad-header-right">
          <DateRangePicker startDate={startDate} endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <button className="ad-compare-toggle" onClick={() => setShowCompare(c => !c)}>
            {showCompare ? "Hide" : "Show"} comparison
          </button>
          <button className="ad-export-btn"
            onClick={() => { setExporting(true); exportToExcel(raw); setTimeout(() => setExporting(false), 800); }}
            disabled={exporting}>
            {exporting ? "Preparing…" : "↓ Export"}
          </button>
        </div>
      </div>

      {showCompare && (
        <div className="ad-compare-banner">
          <span className="compare-label">Comparing to previous period</span>
          <span className="compare-range">{fmtIST(prevStart)} – {fmtIST(startMs - 86400000)}</span>
          <span className="compare-legend">
            <span className="legend-dot legend-dot--current" /> Current
            <span className="legend-dot legend-dot--prev" /> Previous
          </span>
        </div>
      )}

      {/* KPI Row */}
      <div className="ad-kpi-row">
        <KPI value={totalViews.toLocaleString()}        label="Page Views"      sub={`${rangeDays}d window`}       delta={viewDelta}    accent />
        <KPI value={uniqueSessions.toLocaleString()}    label="Unique Visitors" sub="anonymous sessions"          delta={sessionDelta} />
        <KPI value={avgDepth}                           label="Pages / Visit"   sub="engagement depth" />
        <KPI value={bounceRate}                         label="Bounce Rate"     sub="single-page sessions" />
        <KPI value={totalArticleViews.toLocaleString()} label="All-time Views"  sub="across all articles" />
        <KPI value={articles.length}                    label="Published"       sub="articles total" />
        <KPI value={subPending}                         label="Pending"         sub="submissions" />
        <KPI value={subAcceptRate}                      label="Accept Rate"     sub="submissions approved" />
      </div>

      {/* Tabs */}
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

      {/* Traffic */}
      {activeTab === "traffic" && (
        <div className="tab-content">
          <div className="ad-card ad-card--wide">
            <div className="ad-card-header">
              <span className="ad-card-title">Daily Traffic</span>
              <span className="ad-card-sub">{totalViews.toLocaleString()} views · {uniqueSessions.toLocaleString()} visitors</span>
            </div>
            <CompareChart current={dailyViews} previous={showCompare ? prevDailyViews : null} height={96} />
            <div className="ad-spark-labels">
              {sparkLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>
          <div className="ad-grid">
            <div className="ad-col">
              <div className="ad-card">
                <div className="ad-card-header"><span className="ad-card-title">Devices</span></div>
                {totalViews === 0
                  ? <p className="ad-empty">No data yet.</p>
                  : <Donut segments={[
                      { value: deviceMap.desktop, color: "var(--accent)", label: "Desktop" },
                      { value: deviceMap.mobile,  color: "#a78bfa",       label: "Mobile"  },
                      { value: deviceMap.tablet,  color: "#38bdf8",       label: "Tablet"  },
                    ]} />
                }
              </div>
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Publishing Velocity</span>
                  <span className="ad-card-sub">Last 6 months</span>
                </div>
                <ColBar rows={months6} />
              </div>
            </div>
            <div className="ad-col">
              <div className="ad-card">
                <div className="ad-card-header"><span className="ad-card-title">Traffic Sources</span></div>
                <BarChart rows={refData} color="#a78bfa" />
              </div>
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Views by Category</span>
                  {showCompare && <span className="ad-card-sub">vs. previous period</span>}
                </div>
                <BarChart rows={catData} color="var(--accent)"
                  compareRows={showCompare ? catCompareData : null}
                  compareColor="rgba(255,255,255,0.12)" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === "content" && (
        <div className="tab-content">
          <div className="article-toolbar">
            <div className="article-search-wrap">
              <span className="search-icon">⌕</span>
              <input className="article-search" placeholder="Search articles, authors, categories…"
                value={articleSearch} onChange={e => setArticleSearch(e.target.value)} />
              {articleSearch && <button className="search-clear" onClick={() => setArticleSearch("")}>✕</button>}
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
              {filteredArticles.length === 0
                ? <div className="ad-empty ad-empty--center" style={{ padding: "2rem" }}>No articles match your filters.</div>
                : filteredArticles.map(a => (
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
                    <span className="ad-full-views">{safeNum(a.view_count).toLocaleString()}</span>
                    <span className="ad-full-readers">{Math.round(safeNum(a.view_count) * 0.72).toLocaleString()}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Authors */}
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

      {/* Submissions */}
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
                              background: s === "approved" ? "#4ade80" : s === "rejected" ? "#f87171" : "var(--accent)",
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
