import { useEffect, useState } from "react";
import { fetchAnalyticsData, enrichArticles, formatDuration } from "../utils/analytics";
import "./SimpleAnalytics.css";

// ── Excel export ──────────────────────────────────────────
function exportToExcel(articles, submissions, views) {
  try {
    const now = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });

    const artRows = [
      ["Chréma — Article Performance", `Generated: ${now}`],
      [],
      ["Title", "Author", "Category", "Published", "Views", "Avg Read", "Completion %", "CTR %"],
      ...articles.map(a => [
        a.title || "—",
        a.author || "—",
        a.category || "—",
        a.published_at ? new Date(a.published_at).toLocaleDateString("en-IN") : "Draft",
        Number(a.view_count) || 0,
        formatDuration(a.avgReadSeconds),
        a.completionRate || 0,
        a.ctr ?? "—",
      ]),
      [],
      ["TOTAL VIEWS", "", "", "", articles.reduce((s, a) => s + (Number(a.view_count) || 0), 0)],
    ];

    const subRows = [
      ["Submissions", `Generated: ${now}`],
      [],
      ["Status", "Count", "% of Total"],
      ...["pending", "approved", "rejected", "needs_edit"].map(s => {
        const n = submissions.filter(x => x.status === s).length;
        return [s, n, submissions.length > 0 ? `${Math.round((n / submissions.length) * 100)}%` : "0%"];
      }),
    ];

    const toTable = rows =>
      `<table>${rows.map((row, ri) =>
        `<tr>${row.map(cell => {
          const h = ri === 0 || ri === 2;
          return `<td${h ? ' style="font-weight:bold;background:#e8ff47"' : ""}>${cell ?? ""}</td>`;
        }).join("")}</tr>`
      ).join("")}</table>`;

    const wb = `<html lang="en" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>
<x:ExcelWorksheet><x:Name>Articles</x:Name></x:ExcelWorksheet>
<x:ExcelWorksheet><x:Name>Submissions</x:Name></x:ExcelWorksheet>
</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>${toTable(artRows)}${toTable(subRows)}</body></html>`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([wb], { type: "application/vnd.ms-excel;charset=utf-8" }));
    a.download = `chrema-analytics-${new Date().toISOString().slice(0, 10)}.xls`;
    a.click();
  } catch (e) { console.error("Export failed:", e); }
}

// ── Horizontal bar ────────────────────────────────────────
function HBar({ value, max, color = "var(--accent)" }) {
  const pct = Math.max((value / Math.max(max, 1)) * 100, value > 0 ? 1 : 0);
  return (
    <div className="sa-hbar-track">
      <div className="sa-hbar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ── Spark bars (daily views) ──────────────────────────────
function SparkBars({ data, color = "var(--accent)" }) {
  if (!data?.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="sa-spark-bars">
      {data.map((v, i) => (
        <div key={i} className="sa-spark-bar-col">
          <div className="sa-spark-bar"
            style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 0)}%`, background: color, opacity: 0.75 }} />
        </div>
      ))}
    </div>
  );
}

// ── Score chip ────────────────────────────────────────────
function Score({ value, hi = 60, mid = 30, suffix = "%" }) {
  if (value == null || value === 0) return <span className="sa-nil">—</span>;
  const color = value >= hi ? "var(--green)" : value >= mid ? "var(--yellow)" : "var(--red)";
  return <span style={{ color, fontWeight: 500 }}>{value}{suffix}</span>;
}

// ── Donut ─────────────────────────────────────────────────
function Donut({ slices, size = 88 }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 30, C = 2 * Math.PI * R;
  let cum = 0;
  return (
    <div className="sa-donut-wrap">
      <svg width={size} height={size} viewBox="0 0 88 88">
        {slices.map((s, i) => {
          const pct  = s.value / total;
          const dash = pct * C;
          const off  = C * 0.25 - cum * C;
          cum += pct;
          return (
            <circle key={i} cx="44" cy="44" r={R} fill="none"
              stroke={s.color} strokeWidth="10"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={off} strokeLinecap="butt" />
          );
        })}
        <circle cx="44" cy="44" r="24" fill="#111" />
        <text x="44" y="48" textAnchor="middle" fill="#f0f0f0"
          fontSize="11" fontFamily="'DM Mono', monospace" fontWeight="600">
          {total}
        </text>
      </svg>
      <div className="sa-donut-legend">
        {slices.map((s, i) => (
          <div key={i} className="sa-donut-row">
            <span className="sa-donut-dot" style={{ background: s.color }} />
            <span className="sa-donut-label">{s.label}</span>
            <span className="sa-donut-val">{total > 0 ? `${Math.round((s.value / total) * 100)}%` : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function SimpleAnalytics() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [tab,       setTab]       = useState("overview");
  const [search,    setSearch]    = useState("");
  const [sortCol,   setSortCol]   = useState("views");
  const [sortDir,   setSortDir]   = useState("desc");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAnalyticsData()
      .then(d => {
        setData({ ...d, articles: enrichArticles(d.articles, d.scrolls, d.times, d.impressions) });
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="sa-center">
      <div className="sa-spinner" />
      <p className="sa-nil" style={{ marginTop: "1rem"}}>Loading analytics…</p>
    </div>
  );
  if (error) return (
    <div className="sa-center">
      <div className="sa-error-box">⚠ {error}</div>
    </div>
  );

  const { articles, submissions, views } = data;

  // ── computed ──────────────────────────────────────────
  const totalViews = views.length;
  const sessions   = new Set(views.map(v => v.session_id).filter(Boolean)).size;
  const allTime    = articles.reduce((s, a) => s + (Number(a.view_count) || 0), 0);
  const pending    = submissions.filter(s => s.status === "pending").length;
  const approved   = submissions.filter(s => s.status === "approved").length;
  const rejected   = submissions.filter(s => s.status === "rejected").length;
  const needsEdit  = submissions.filter(s => s.status === "needs_edit").length;
  const acceptPct  = submissions.length > 0 ? Math.round((approved / submissions.length) * 100) : null;

  const articlesWithCompletion = articles.filter(a => a.completionRate > 0);
  const avgCompletion = articlesWithCompletion.length > 0
    ? Math.round(articlesWithCompletion.reduce((s, a) => s + a.completionRate, 0) / articlesWithCompletion.length)
    : null;

  // daily views — last 30 days
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const d30ago = new Date(today); d30ago.setDate(d30ago.getDate() - 29);
  const dailyViews = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(d30ago); d.setDate(d.getDate() + i);
    const str = d.toISOString().slice(0, 10);
    return views.filter(v => v.viewed_at?.startsWith(str)).length;
  });

  // devices
  const devs = { desktop: 0, mobile: 0, tablet: 0 };
  views.forEach(v => { if (v.device_type in devs) devs[v.device_type]++; });

  // referrers
  const refMap = {};
  views.forEach(v => { const r = v.referrer || "direct"; refMap[r] = (refMap[r] || 0) + 1; });
  const refs = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const refMax = refs[0]?.[1] || 1;

  // categories
  const catMap = {};
  articles.forEach(a => { const c = a.category || "Uncategorised"; catMap[c] = (catMap[c] || 0) + 1; });
  const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const catMax = cats[0]?.[1] || 1;

  // views by category
  const catViewMap = {};
  articles.forEach(a => { const c = a.category || "Uncategorised"; catViewMap[c] = (catViewMap[c] || 0) + (Number(a.view_count) || 0); });
  const catViews = Object.entries(catViewMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const catViewMax = catViews[0]?.[1] || 1;

  // top 5
  const top5 = [...articles].sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0)).slice(0, 5);
  const top5Max = Number(top5[0]?.view_count) || 1;

  // leaderboard sort + filter
  const q = search.toLowerCase();
  let board = search
    ? articles.filter(a => a.title?.toLowerCase().includes(q) || a.author?.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q))
    : [...articles];

  board.sort((a, b) => {
    if (sortCol === "title")  { const d = (a.title || "").localeCompare(b.title || ""); return sortDir === "asc" ? d : -d; }
    if (sortCol === "author") { const d = (a.author || "").localeCompare(b.author || ""); return sortDir === "asc" ? d : -d; }
    const va = sortCol === "completion" ? (a.completionRate || 0)
             : sortCol === "read"       ? (a.avgReadSeconds || 0)
             : sortCol === "ctr"        ? (a.ctr ?? -1)
             : (Number(a.view_count) || 0);
    const vb = sortCol === "completion" ? (b.completionRate || 0)
             : sortCol === "read"       ? (b.avgReadSeconds || 0)
             : sortCol === "ctr"        ? (b.ctr ?? -1)
             : (Number(b.view_count) || 0);
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  };
  const TH = ({ col, label, num }) => (
    <span className={`sa-th ${num ? "sa-th--r" : ""} sa-sortable`} onClick={() => toggleSort(col)}>
      {label}
      <span className="sa-sort-icon">
        {sortCol === col ? (sortDir === "desc" ? " ↓" : " ↑") : " ↕"}
      </span>
    </span>
  );

  const handleExport = () => {
    setExporting(true);
    exportToExcel(articles, submissions, views);
    setTimeout(() => setExporting(false), 800);
  };

  const TABS = [
    { id: "overview",     label: "Overview"     },
    { id: "leaderboard",  label: "Leaderboard"  },
    { id: "traffic",      label: "Traffic"      },
    { id: "submissions",  label: "Submissions"  },
  ];

  return (
    <div className="sa-page">

      {/* ── Header ── */}
      <div className="sa-header">
        <div>
          <p className="sa-eyebrow">Admin · Analytics</p>
          <h1 className="sa-title">Performance Overview</h1>
        </div>
        <div className="sa-header-actions">
          <span className="sa-nil" style={{ fontSize: "11px" }}>
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
          </span>
          <button className="sa-export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? "Preparing…" : "↓ Export"}
          </button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="sa-kpis">
        <div className="sa-kpi sa-kpi--accent">
          <span className="sa-kpi-val">{totalViews.toLocaleString()}</span>
          <span className="sa-kpi-name">Page Views</span>
          <span className="sa-kpi-sub">last 90 days</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-val">{sessions > 0 ? sessions.toLocaleString() : "—"}</span>
          <span className="sa-kpi-name">Visitors</span>
          <span className="sa-kpi-sub">unique sessions</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-val">{allTime.toLocaleString()}</span>
          <span className="sa-kpi-name">All-time Views</span>
          <span className="sa-kpi-sub">across all articles</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-val">{articles.length}</span>
          <span className="sa-kpi-name">Published</span>
          <span className="sa-kpi-sub">articles</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-val" style={{ color: avgCompletion >= 60 ? "var(--green)" : avgCompletion >= 30 ? "var(--yellow)" : "var(--nil)" }}>
            {avgCompletion != null ? `${avgCompletion}%` : "—"}
          </span>
          <span className="sa-kpi-name">Avg Completion</span>
          <span className="sa-kpi-sub">readers to 75%+</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-val" style={{ color: acceptPct >= 50 ? "var(--green)" : "var(--nil)" }}>
            {acceptPct != null ? `${acceptPct}%` : "—"}
          </span>
          <span className="sa-kpi-name">Accept Rate</span>
          <span className="sa-kpi-sub">{submissions.length} total</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sa-tabs-wrap">
        <div className="sa-tabs">
          {TABS.map(t => (
            <button key={t.id}
              className={`sa-tab ${tab === t.id ? "sa-tab--active" : ""}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          TAB: OVERVIEW
      ══════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="sa-tab-content">

          {/* Daily traffic spark */}
          <div className="sa-card sa-card--wide">
            <div className="sa-card-top">
              <div className="sa-card-heading">Daily Traffic <span className="sa-count">last 30 days</span></div>
              <span className="sa-nil" style={{ fontSize: "11px" }}>{totalViews.toLocaleString()} views · {sessions.toLocaleString()} visitors</span>
            </div>
            <SparkBars data={dailyViews} />
            <div className="sa-spark-labels">
              <span>{new Date(d30ago).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              <span>Today</span>
            </div>
          </div>

          <div className="sa-two-col">

            {/* Top 5 articles */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Top Articles <span className="sa-count">by views</span></div>
              </div>
              <div className="sa-top-list">
                {top5.map((a, i) => (
                  <div key={a.id} className="sa-top-item">
                    <span className="sa-top-rank">#{i + 1}</span>
                    <div className="sa-top-body">
                      <a href={`/article/${a.id}`} target="_blank" rel="noreferrer" className="sa-top-link">{a.title || "—"}</a>
                      {a.author && <span className="sa-nil" style={{ fontSize: "10px" }}>by {a.author}</span>}
                      <HBar value={Number(a.view_count) || 0} max={top5Max} />
                    </div>
                    <span className="sa-top-num">{(Number(a.view_count) || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Views by category */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Views by Category</div>
              </div>
              <div className="sa-hbar-list">
                {catViews.map(([cat, count]) => (
                  <div key={cat} className="sa-hbar-item">
                    <span className="sa-hbar-label">{cat}</span>
                    <HBar value={count} max={catViewMax} />
                    <span className="sa-hbar-val">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="sa-three-col">

            {/* Devices donut */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Devices</div>
              </div>
              {totalViews === 0
                ? <p className="sa-nil">No data yet.</p>
                : <Donut slices={[
                    { label: "Desktop", value: devs.desktop, color: "var(--accent)"  },
                    { label: "Mobile",  value: devs.mobile,  color: "#a78bfa"        },
                    { label: "Tablet",  value: devs.tablet,  color: "#38bdf8"        },
                  ]} />
              }
            </div>

            {/* Articles by category count */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Articles by Category</div>
              </div>
              <div className="sa-hbar-list">
                {cats.map(([cat, count]) => (
                  <div key={cat} className="sa-hbar-item">
                    <span className="sa-hbar-label">{cat}</span>
                    <HBar value={count} max={catMax} color="#a78bfa" />
                    <span className="sa-hbar-val">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Publishing velocity */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Publishing Velocity <span className="sa-count">last 6mo</span></div>
              </div>
              {(() => {
                const months = Array.from({ length: 6 }, (_, i) => {
                  const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
                  const count = articles.filter(a => {
                    if (!a.published_at) return false;
                    const p = new Date(a.published_at);
                    return p.getMonth() === d.getMonth() && p.getFullYear() === d.getFullYear();
                  }).length;
                  return { label: d.toLocaleString("default", { month: "short" }), count };
                });
                const mMax = Math.max(...months.map(m => m.count), 1);
                return (
                  <div className="sa-vel-bars">
                    {months.map((m, i) => (
                      <div key={i} className="sa-vel-col">
                        <span className="sa-vel-val">{m.count || ""}</span>
                        <div className="sa-vel-track">
                          <div className="sa-vel-fill" style={{ height: `${Math.max((m.count / mMax) * 100, m.count > 0 ? 6 : 0)}%` }} />
                        </div>
                        <span className="sa-vel-label">{m.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: LEADERBOARD
      ══════════════════════════════════════════ */}
      {tab === "leaderboard" && (
        <div className="sa-tab-content">
          <div className="sa-card sa-card--wide">
            <div className="sa-card-top">
              <div className="sa-card-heading">
                Article Leaderboard
                <span className="sa-count">{articles.length} articles</span>
              </div>
              <div className="sa-search-wrap">
                <span className="sa-search-icon">⌕</span>
                <input className="sa-search" placeholder="Search title, author, category…"
                  value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button className="sa-search-x" onClick={() => setSearch("")}>✕</button>}
              </div>
            </div>

            {board.length === 0
              ? <p className="sa-nil" style={{ padding: "2rem 0" }}>No articles match.</p>
              : (
                <div className="sa-board">
                  <div className="sa-board-head">
                    <span className="sa-th sa-th--rank">#</span>
                    <TH col="title"      label="Title / Author" />
                    <span className="sa-th">Category</span>
                    <span className="sa-th">Published</span>
                    <TH col="views"      label="Views"      num />
                    <TH col="read"       label="Avg Read"   num />
                    <TH col="completion" label="Completion" num />
                    <TH col="ctr"        label="CTR"        num />
                  </div>

                  {board.map((a, i) => (
                    <div key={a.id} className={`sa-board-row ${i === 0 && sortDir === "desc" ? "sa-board-row--top" : ""}`}>
                      <span className="sa-board-rank">
                        {i === 0 && sortDir === "desc" ? "🥇" : i === 1 && sortDir === "desc" ? "🥈" : i === 2 && sortDir === "desc" ? "🥉" : i + 1}
                      </span>
                      <div className="sa-board-title-cell">
                        <a href={`/article/${a.id}`} target="_blank" rel="noreferrer" className="sa-board-link">
                          {a.title || "Untitled"}
                        </a>
                        {a.author && <span className="sa-board-author">by {a.author}</span>}
                      </div>
                      <span>
                        {a.category ? <span className="sa-cat-pill">{a.category}</span> : <span className="sa-nil">—</span>}
                      </span>
                      <span className="sa-nil" style={{ fontSize: "11px" }}>
                        {a.published_at
                          ? new Date(a.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
                          : "Draft"}
                      </span>
                      <span className="sa-board-num sa-hi">{(Number(a.view_count) || 0).toLocaleString()}</span>
                      <span className="sa-board-num sa-nil">{formatDuration(a.avgReadSeconds)}</span>
                      <span className="sa-board-num"><Score value={a.completionRate} hi={60} mid={30} /></span>
                      <span className="sa-board-num"><Score value={a.ctr} hi={5} mid={2} /></span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: TRAFFIC
      ══════════════════════════════════════════ */}
      {tab === "traffic" && (
        <div className="sa-tab-content">

          <div className="sa-card sa-card--wide">
            <div className="sa-card-top">
              <div className="sa-card-heading">Daily Views <span className="sa-count">last 30 days</span></div>
              <span className="sa-nil" style={{ fontSize: "11px" }}>{totalViews.toLocaleString()} total</span>
            </div>
            <SparkBars data={dailyViews} />
            <div className="sa-spark-labels">
              <span>{new Date(d30ago).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              <span>Today</span>
            </div>
          </div>

          <div className="sa-two-col">

            {/* Traffic sources */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Traffic Sources</div>
              </div>
              {refs.length === 0
                ? <p className="sa-nil">No data yet.</p>
                : (
                  <div className="sa-hbar-list">
                    {refs.map(([ref, count]) => (
                      <div key={ref} className="sa-hbar-item">
                        <span className="sa-hbar-label">{ref}</span>
                        <HBar value={count} max={refMax} color="#a78bfa" />
                        <span className="sa-hbar-val">{count}</span>
                        <span className="sa-nil" style={{ fontSize: "10px", width: "36px", textAlign: "right" }}>
                          {totalViews > 0 ? `${Math.round((count / totalViews) * 100)}%` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Device breakdown */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Device Breakdown</div>
              </div>
              {totalViews === 0
                ? <p className="sa-nil">No data yet.</p>
                : (
                  <>
                    <Donut slices={[
                      { label: "Desktop", value: devs.desktop, color: "var(--accent)" },
                      { label: "Mobile",  value: devs.mobile,  color: "#a78bfa"       },
                      { label: "Tablet",  value: devs.tablet,  color: "#38bdf8"       },
                    ]} size={110} />
                    <div className="sa-hbar-list" style={{ marginTop: "1.5rem" }}>
                      {[["Desktop", devs.desktop, "var(--accent)"], ["Mobile", devs.mobile, "#a78bfa"], ["Tablet", devs.tablet, "#38bdf8"]].map(([label, val, color]) => (
                        <div key={label} className="sa-hbar-item">
                          <span className="sa-hbar-label">{label}</span>
                          <HBar value={val} max={totalViews} color={color} />
                          <span className="sa-hbar-val">{val.toLocaleString()}</span>
                          <span className="sa-nil" style={{ fontSize: "10px", width: "36px", textAlign: "right" }}>
                            {totalViews > 0 ? `${Math.round((val / totalViews) * 100)}%` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              }
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: SUBMISSIONS
      ══════════════════════════════════════════ */}
      {tab === "submissions" && (
        <div className="sa-tab-content">
          <div className="sa-two-col">

            {/* Funnel */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Pipeline <span className="sa-count">{submissions.length} total</span></div>
              </div>
              {submissions.length === 0
                ? <p className="sa-nil">No submissions yet.</p>
                : (
                  <>
                    <div className="sa-sub-grid">
                      {[
                        { label: "Pending",    value: pending,   color: "var(--yellow)" },
                        { label: "Needs Edit", value: needsEdit, color: "#38bdf8"       },
                        { label: "Approved",   value: approved,  color: "var(--green)"  },
                        { label: "Rejected",   value: rejected,  color: "var(--red)"    },
                      ].map(s => (
                        <div key={s.label} className="sa-sub-tile">
                          <span className="sa-sub-big" style={{ color: s.color }}>{s.value}</span>
                          <span className="sa-sub-name">{s.label}</span>
                          <span className="sa-nil" style={{ fontSize: "10px" }}>
                            {submissions.length > 0 ? `${Math.round((s.value / submissions.length) * 100)}%` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* stacked bar */}
                    <div className="sa-stacked-bar">
                      {pending   > 0 && <div style={{ flex: pending,   background: "var(--yellow)", opacity: 0.75 }} title={`Pending: ${pending}`}   />}
                      {needsEdit > 0 && <div style={{ flex: needsEdit, background: "#38bdf8",       opacity: 0.75 }} title={`Needs Edit: ${needsEdit}`} />}
                      {approved  > 0 && <div style={{ flex: approved,  background: "var(--green)",  opacity: 0.75 }} title={`Approved: ${approved}`}  />}
                      {rejected  > 0 && <div style={{ flex: rejected,  background: "var(--red)",    opacity: 0.75 }} title={`Rejected: ${rejected}`}  />}
                    </div>
                    <div className="sa-stacked-legend">
                      {[["Pending", "var(--yellow)"], ["Needs Edit", "#38bdf8"], ["Approved", "var(--green)"], ["Rejected", "var(--red)"]].map(([l, c]) => (
                        <span key={l} className="sa-legend-item">
                          <span className="sa-legend-dot" style={{ background: c }} />{l}
                        </span>
                      ))}
                    </div>

                    {acceptPct != null && (
                      <p className="sa-accept-note">
                        <span style={{ color: "var(--green)", fontWeight: 600 }}>{acceptPct}%</span> acceptance rate
                      </p>
                    )}
                  </>
                )
              }
            </div>

            {/* Donut */}
            <div className="sa-card">
              <div className="sa-card-top">
                <div className="sa-card-heading">Status Breakdown</div>
              </div>
              {submissions.length === 0
                ? <p className="sa-nil">No submissions yet.</p>
                : <Donut size={120} slices={[
                    { label: "Pending",    value: pending,   color: "var(--yellow)" },
                    { label: "Needs Edit", value: needsEdit, color: "#38bdf8"       },
                    { label: "Approved",   value: approved,  color: "var(--green)"  },
                    { label: "Rejected",   value: rejected,  color: "var(--red)"    },
                  ]} />
              }
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
