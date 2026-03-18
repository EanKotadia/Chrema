import { useEffect, useState } from "react";
import {
  getAnalytics,
  getPageViewStats,
  getArticlesWithViews,
  getEvents,
  getEventSubmissions,
} from "../utils/supabase";
import { formatDate } from "../utils/dateUtils";
import "./AnalyticsDashboard.css";

// ─── tiny helpers ────────────────────────────────────────
const arr  = (v) => (Array.isArray(v) ? v : []);
const num  = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt  = (ms) => {
  try {
    return new Date(ms).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", timeZone: "Asia/Kolkata",
    });
  } catch { return ""; }
};

// ─── sub-components ──────────────────────────────────────

function KpiCard({ value, label, sub, delta, accent }) {
  const up      = delta > 0;
  const hasDelta = delta != null && delta !== 0;
  return (
    <div className={`kpi-card${accent ? " kpi-card--accent" : ""}`}>
      <div className="kpi-top">
        <span className="kpi-value">{value}</span>
        {hasDelta && (
          <span className={`kpi-delta ${up ? "up" : "down"}`}>
            {up ? "↑" : "↓"}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function Sparkline({ data, prevData, height = 96 }) {
  const d = arr(data);
  if (!d.length) return <p className="ad-empty ad-empty--center">No data yet.</p>;
  const p   = arr(prevData);
  const all = [...d, ...p];
  const max = Math.max(...all, 1);
  const W = 400, H = height;

  const pts = (vals) =>
    vals.map((v, i) => {
      const x = (i / Math.max(vals.length - 1, 1)) * W;
      const y = H - (num(v) / max) * H * 0.88;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  const area = (vals) => `0,${H} ${pts(vals)} ${W},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}>
      {p.length > 0 && (
        <>
          <polygon points={area(p)}
            fill="rgba(255,255,255,0.04)" />
          <polyline points={pts(p)}
            fill="none" stroke="rgba(255,255,255,0.2)"
            strokeWidth="1.5" strokeDasharray="4 3" />
        </>
      )}
      <polygon points={area(d)} fill="rgba(232,255,71,0.12)" />
      <polyline points={pts(d)}
        fill="none" stroke="#e8ff47" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function HBar({ label, value, max, pct, color = "#e8ff47", sub }) {
  return (
    <div className="hbar-row">
      <span className="hbar-key" title={label}>{label}</span>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width: `${Math.max((num(value) / Math.max(num(max), 1)) * 100, value > 0 ? 2 : 0)}%`, background: color }} />
      </div>
      <span className="hbar-val">{num(value).toLocaleString()}</span>
      {sub && <span className="hbar-sub">{sub}</span>}
    </div>
  );
}

function FunnelBar({ label, value, total, color }) {
  const pct = Math.round((num(value) / Math.max(num(total), 1)) * 100);
  return (
    <div className="ad-funnel-row">
      <span className="ad-funnel-label">{label}</span>
      <div className="ad-funnel-track">
        <div className="ad-funnel-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="ad-funnel-val">{value}</span>
      <span className="ad-funnel-pct">{pct}%</span>
    </div>
  );
}

// ─── main component ───────────────────────────────────────
export default function AnalyticsDashboard() {
  const [state, setState] = useState({
    loading:  true,
    error:    null,
    articles: [],
    submissions: [],
    views:    [],
    eventSubs: [],
  });

  const [tab,     setTab]     = useState("traffic");
  const [compare, setCompare] = useState(true);
  const [search,  setSearch]  = useState("");
  const [cat,     setCat]     = useState("All");
  const [sort,    setSort]    = useState({ col: "views", dir: "desc" });
  const [exporting, setExporting] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const d30Str   = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [start,  setStart]  = useState(d30Str);
  const [end,    setEnd]    = useState(todayStr);

  // ── fetch ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const [analytics, articles, views, , eventSubs] = await Promise.all([
          getAnalytics().catch(() => ({ submissions: [], trash: [] })),
          getArticlesWithViews().catch(() => []),
          getPageViewStats().catch(() => []),
          getEvents().catch(() => []),
          getEventSubmissions(null).catch(() => []),
        ]);

        if (cancelled) return;

        setState({
          loading:     false,
          error:       null,
          articles:    arr(articles),
          submissions: arr(analytics?.submissions),
          views:       arr(views),
          eventSubs:   arr(eventSubs),
        });
      } catch (e) {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: e?.message || "Load failed" }));
      }
    }

    void fetch();
    return () => { cancelled = true; };
  }, []);

  // ── early returns ─────────────────────────────────────
  if (state.loading) return (
    <div className="loading-state">
      <div className="loading-spinner" /><span>Loading analytics…</span>
    </div>
  );

  if (state.error) return (
    <div className="ad-error">
      <span>⚠</span>
      <p>{state.error}</p>
    </div>
  );

  // ── data ──────────────────────────────────────────────
  const { articles, submissions, views, eventSubs } = state;

  const startMs   = new Date(start).getTime();
  const endMs     = new Date(end).getTime() + 86400000;
  const rangeDays = Math.max(Math.round((endMs - startMs) / 86400000), 1);
  const prevMs    = startMs - (endMs - startMs);

  const winViews  = views.filter(v => { const t = new Date(v.viewed_at).getTime(); return t >= startMs && t < endMs; });
  const prevViews = views.filter(v => { const t = new Date(v.viewed_at).getTime(); return t >= prevMs  && t < startMs; });

  const totalViews   = winViews.length;
  const prevTotal    = prevViews.length;
  const viewDelta    = prevTotal > 0 ? Math.round(((totalViews - prevTotal) / prevTotal) * 100) : null;

  const sessions     = new Set(winViews.map(v => v.session_id)).size;
  const prevSessions = new Set(prevViews.map(v => v.session_id)).size;
  const sessDelta    = prevSessions > 0 ? Math.round(((sessions - prevSessions) / prevSessions) * 100) : null;

  const avgDepth   = sessions > 0 ? (totalViews / sessions).toFixed(1) : "0";
  const sessMap    = {};
  winViews.forEach(v => { sessMap[v.session_id] = (sessMap[v.session_id] || 0) + 1; });
  const bounceRate = sessions > 0 ? `${Math.round((Object.values(sessMap).filter(n => n === 1).length / sessions) * 100)}%` : "—";

  const pending  = submissions.filter(s => s.status === "pending").length;
  const approved = submissions.filter(s => s.status === "approved").length;
  const rejected = submissions.filter(s => s.status === "rejected").length;
  const acceptRate = submissions.length > 0 ? `${Math.round((approved / submissions.length) * 100)}%` : "—";
  const allTimeViews = articles.reduce((s, a) => s + num(a.view_count), 0);

  // daily arrays for sparkline
  const days     = Array.from({ length: rangeDays }, (_, i) => new Date(startMs + i * 86400000).toISOString().slice(0, 10));
  const prevDays = Array.from({ length: rangeDays }, (_, i) => new Date(prevMs   + i * 86400000).toISOString().slice(0, 10));
  const dailyCur  = days.map(d => winViews.filter(v  => v.viewed_at?.startsWith(d)).length);
  const dailyPrev = prevDays.map(d => prevViews.filter(v => v.viewed_at?.startsWith(d)).length);

  const sparkLabels = days.map((d, i) =>
    (i === 0 || i === Math.floor(rangeDays / 2) || i === rangeDays - 1) ? fmt(new Date(d).getTime()) : "");

  // devices
  const devs = { desktop: 0, mobile: 0, tablet: 0 };
  winViews.forEach(v => { if (v.device_type in devs) devs[v.device_type]++; });

  // referrers
  const refMap = {};
  winViews.forEach(v => { const r = v.referrer || "direct"; refMap[r] = (refMap[r] || 0) + 1; });
  const refRows = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, value]) => ({ label, value, sub: totalViews > 0 ? `${Math.round((value / totalViews) * 100)}%` : "0%" }));
  const refMax = Math.max(...refRows.map(r => r.value), 1);

  // categories
  const catMap = {};
  articles.forEach(a => { const c = a.category || "Uncategorised"; catMap[c] = (catMap[c] || 0) + num(a.view_count); });
  const catRows = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 7)
    .map(([label, value]) => ({ label, value }));
  const catMax = Math.max(...catRows.map(r => r.value), 1);

  // months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleString("default", { month: "short" }),
      value: articles.filter(a => {
        if (!a.published_at) return false;
        const p = new Date(a.published_at);
        return p.getMonth() === d.getMonth() && p.getFullYear() === d.getFullYear();
      }).length,
    };
  });
  const monthMax = Math.max(...months.map(m => m.value), 1);

  // filtered articles
  const allCats = ["All", ...new Set(articles.map(a => a.category).filter(Boolean))];
  let filtered = [...articles];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(a =>
      a.title?.toLowerCase().includes(q) ||
      a.author?.toLowerCase().includes(q) ||
      a.category?.toLowerCase().includes(q)
    );
  }
  if (cat !== "All") filtered = filtered.filter(a => a.category === cat);
  filtered.sort((a, b) => {
    if (sort.col === "title")  { const d = (a.title  || "").localeCompare(b.title  || ""); return sort.dir === "asc" ? d : -d; }
    if (sort.col === "author") { const d = (a.author || "").localeCompare(b.author || ""); return sort.dir === "asc" ? d : -d; }
    const va = sort.col === "published" ? (a.published_at ? new Date(a.published_at).getTime() : 0) : num(a.view_count);
    const vb = sort.col === "published" ? (b.published_at ? new Date(b.published_at).getTime() : 0) : num(b.view_count);
    return sort.dir === "asc" ? va - vb : vb - va;
  });

  const toggleSort = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }));
  const SIcon = ({ col }) => sort.col !== col
    ? <span className="sort-icon sort-icon--inactive">↕</span>
    : <span className="sort-icon">{sort.dir === "desc" ? "↓" : "↑"}</span>;

  // export
  const doExport = () => {
    try {
      setExporting(true);
      const now = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
      const rows = [
        ["Chréma Analytics Export", `Generated: ${now}`], [],
        ["Title", "Author", "Category", "Published", "Views"],
        ...articles.map(a => [
          a.title, a.author || "—", a.category || "—",
          a.published_at ? new Date(a.published_at).toLocaleDateString("en-IN") : "Draft",
          num(a.view_count),
        ]),
      ];
      const html = `<html lang="en"><head><meta charset="UTF-8"></head><body><table>${
        rows.map((r, ri) => `<tr>${r.map(c => `<td${ri < 3 ? ' style="font-weight:bold"' : ""}>${c ?? ""}</td>`).join("")}</tr>`).join("")
      }</table></body></html>`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }));
      a.download = `chrema-${new Date().toISOString().slice(0, 10)}.xls`;
      a.click();
    } catch (e) { console.error(e); }
    finally { setTimeout(() => setExporting(false), 800); }
  };

  // ── render ────────────────────────────────────────────
  return (
    <div className="ad-page">

      {/* Header */}
      <div className="ad-header">
        <div className="ad-header-left">
          <span className="ad-eyebrow">Admin · Analytics</span>
          <h1 className="ad-title">Performance Overview</h1>
        </div>
        <div className="ad-header-right">
          {/* simple inline date picker */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "11px", color: "var(--text-muted)" }}>
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", padding: "0.4rem 0.6rem", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
            <span>–</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--text)", padding: "0.4rem 0.6rem", fontFamily: "var(--font-mono)", fontSize: "11px" }} />
          </div>
          <button className="ad-compare-toggle" onClick={() => setCompare(c => !c)}>
            {compare ? "Hide" : "Show"} comparison
          </button>
          <button className="ad-export-btn" onClick={doExport} disabled={exporting}>
            {exporting ? "Preparing…" : "↓ Export"}
          </button>
        </div>
      </div>

      {compare && (
        <div className="ad-compare-banner">
          <span className="compare-label">Comparing to previous period</span>
          <span className="compare-range">{fmt(prevMs)} – {fmt(startMs - 86400000)}</span>
          <span className="compare-legend">
            <span className="legend-dot legend-dot--current" /> Current
            <span className="legend-dot legend-dot--prev" /> Previous
          </span>
        </div>
      )}

      {/* KPIs */}
      <div className="ad-kpi-row">
        <KpiCard value={totalViews.toLocaleString()}       label="Page Views"      sub={`${rangeDays}d window`}      delta={viewDelta} accent />
        <KpiCard value={sessions.toLocaleString()}         label="Unique Visitors" sub="anonymous sessions"         delta={sessDelta} />
        <KpiCard value={avgDepth}                          label="Pages / Visit"   sub="engagement depth" />
        <KpiCard value={bounceRate}                        label="Bounce Rate"     sub="single-page sessions" />
        <KpiCard value={allTimeViews.toLocaleString()}     label="All-time Views"  sub="across all articles" />
        <KpiCard value={articles.length}                   label="Published"       sub="articles total" />
        <KpiCard value={pending}                           label="Pending"         sub="submissions" />
        <KpiCard value={acceptRate}                        label="Accept Rate"     sub="submissions approved" />
      </div>

      {/* Tabs */}
      <div className="ad-tabs-wrap">
        <div className="tabs">
          {["traffic", "content", "authors", "submissions"].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Traffic ── */}
      {tab === "traffic" && (
        <div className="tab-content">
          <div className="ad-card ad-card--wide">
            <div className="ad-card-header">
              <span className="ad-card-title">Daily Traffic</span>
              <span className="ad-card-sub">{totalViews.toLocaleString()} views · {sessions.toLocaleString()} visitors</span>
            </div>
            <Sparkline data={dailyCur} prevData={compare ? dailyPrev : []} height={96} />
            <div className="ad-spark-labels">
              {sparkLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>
          </div>

          <div className="ad-grid">
            <div className="ad-col">
              {/* Devices */}
              <div className="ad-card">
                <div className="ad-card-header"><span className="ad-card-title">Devices</span></div>
                {totalViews === 0 ? <p className="ad-empty">No data yet.</p> : (
                  <div className="hbar">
                    {[["Desktop", devs.desktop, "#e8ff47"], ["Mobile", devs.mobile, "#a78bfa"], ["Tablet", devs.tablet, "#38bdf8"]].map(([label, value, color]) => (
                      <HBar key={label} label={label} value={value} max={totalViews} color={color}
                        sub={totalViews > 0 ? `${Math.round((num(value) / totalViews) * 100)}%` : "0%"} />
                    ))}
                  </div>
                )}
              </div>

              {/* Publishing velocity */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Publishing Velocity</span>
                  <span className="ad-card-sub">Last 6 months</span>
                </div>
                <div className="colbar">
                  {months.map((m, i) => (
                    <div key={i} className="colbar-col">
                      <span className="colbar-val">{m.value || ""}</span>
                      <div className="colbar-track">
                        <div className="colbar-fill"
                          style={{ height: `${Math.max((m.value / monthMax) * 100, m.value > 0 ? 8 : 0)}%` }} />
                      </div>
                      <span className="colbar-label">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ad-col">
              {/* Traffic sources */}
              <div className="ad-card">
                <div className="ad-card-header"><span className="ad-card-title">Traffic Sources</span></div>
                {refRows.length === 0 ? <p className="ad-empty">No data yet.</p> : (
                  <div className="hbar">
                    {refRows.map((r, i) => (
                      <HBar key={i} label={r.label} value={r.value} max={refMax} color="#a78bfa" sub={r.sub} />
                    ))}
                  </div>
                )}
              </div>

              {/* Categories */}
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Views by Category</span>
                </div>
                {catRows.length === 0 ? <p className="ad-empty">No data yet.</p> : (
                  <div className="hbar">
                    {catRows.map((r, i) => (
                      <HBar key={i} label={r.label} value={r.value} max={catMax} color="#e8ff47" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {tab === "content" && (
        <div className="tab-content">
          <div className="article-toolbar">
            <div className="article-search-wrap">
              <span className="search-icon">⌕</span>
              <input className="article-search" placeholder="Search articles…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="search-clear" onClick={() => setSearch("")}>✕</button>}
            </div>
            <select className="article-cat-select" value={cat} onChange={e => setCat(e.target.value)}>
              {allCats.map(c => <option key={c}>{c}</option>)}
            </select>
            <span className="article-count">{filtered.length} articles</span>
          </div>

          <div className="ad-card ad-card--wide">
            <div className="ad-full-table">
              <div className="ad-full-header">
                <span className="sortable" onClick={() => toggleSort("title")}>Title <SIcon col="title" /></span>
                <span className="sortable" onClick={() => toggleSort("author")}>Author <SIcon col="author" /></span>
                <span>Category</span>
                <span className="sortable" onClick={() => toggleSort("published")}>Published <SIcon col="published" /></span>
                <span className="sortable" onClick={() => toggleSort("views")}>Views <SIcon col="views" /></span>
                <span>Est. Readers</span>
              </div>
              {filtered.length === 0
                ? <div className="ad-empty ad-empty--center" style={{ padding: "2rem" }}>No articles match.</div>
                : filtered.map(a => (
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
                    <span className="ad-full-views">{num(a.view_count).toLocaleString()}</span>
                    <span className="ad-full-readers">{Math.round(num(a.view_count) * 0.72).toLocaleString()}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Authors ── */}
      {tab === "authors" && (
        <div className="tab-content">
          <div className="ad-card ad-card--wide">
            <div className="ad-card-header">
              <span className="ad-card-title">Author Performance</span>
              <span className="ad-card-sub">{new Set(articles.map(a => a.author).filter(Boolean)).size} authors</span>
            </div>
            <AuthorTable articles={articles} />
          </div>
        </div>
      )}

      {/* ── Submissions ── */}
      {tab === "submissions" && (
        <div className="tab-content">
          <div className="ad-grid">
            <div className="ad-col">
              <div className="ad-card">
                <div className="ad-card-header">
                  <span className="ad-card-title">Submissions Funnel</span>
                  <span className="ad-card-sub">{submissions.length} total · {acceptRate} acceptance</span>
                </div>
                <div className="ad-funnel">
                  <FunnelBar label="Received" value={submissions.length} total={submissions.length} color="rgba(255,255,255,.15)" />
                  <FunnelBar label="Pending"  value={pending}  total={submissions.length} color="#e8ff47" />
                  <FunnelBar label="Approved" value={approved} total={submissions.length} color="#4ade80" />
                  <FunnelBar label="Rejected" value={rejected} total={submissions.length} color="#f87171" />
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
                    {["pending", "approved", "rejected"].map(s => (
                      <FunnelBar key={s}
                        label={s.charAt(0).toUpperCase() + s.slice(1)}
                        value={eventSubs.filter(x => x.status === s).length}
                        total={eventSubs.length}
                        color={s === "approved" ? "#4ade80" : s === "rejected" ? "#f87171" : "#e8ff47"} />
                    ))}
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

// ── AuthorTable (kept separate to avoid bloating main) ────
function AuthorTable({ articles }) {
  const [sortBy, setSortBy] = useState("views");
  const arts = arr(articles);

  const map = {};
  arts.forEach(a => {
    const k = a.author || "Unknown";
    if (!map[k]) map[k] = { articles: 0, views: 0, cats: new Set() };
    map[k].articles++;
    map[k].views += num(a.view_count);
    if (a.category) map[k].cats.add(a.category);
  });

  const rows = Object.entries(map)
    .map(([name, d]) => ({ name, articles: d.articles, views: d.views, avg: d.articles > 0 ? Math.round(d.views / d.articles) : 0, cats: [...d.cats].join(", ") }))
    .sort((a, b) => num(b[sortBy]) - num(a[sortBy]));

  const maxV = Math.max(...rows.map(r => r.views), 1);

  return (
    <div className="author-panel">
      <div className="author-sort">
        {[["views", "By Views"], ["articles", "By Articles"], ["avg", "By Avg"]].map(([k, l]) => (
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
              {r.cats && <span className="author-cats">{r.cats}</span>}
            </div>
            <div className="author-bar-wrap">
              <div className="author-bar" style={{ width: `${(r.views / maxV) * 100}%` }} />
            </div>
            <div className="author-stats">
              <span className="author-stat">{r.views.toLocaleString()} <em>views</em></span>
              <span className="author-stat">{r.articles} <em>articles</em></span>
              <span className="author-stat">{r.avg.toLocaleString()} <em>avg</em></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
