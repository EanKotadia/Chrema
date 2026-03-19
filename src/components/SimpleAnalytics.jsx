import { useEffect, useState } from "react";
import { fetchAnalyticsData, enrichArticles, formatDuration } from "../utils/analytics";
import "./SimpleAnalytics.css";

// ── tiny bar used for completion rate inline ──────────────
function MiniBar({ pct, color = "#e8ff47" }) {
  return (
    <div className="sa-mini-bar-wrap">
      <div className="sa-mini-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
    </div>
  );
}

// ── category pill ─────────────────────────────────────────
function Pill({ label }) {
  if (!label) return <span className="sa-muted">—</span>;
  return <span className="sa-pill">{label}</span>;
}

export default function SimpleAnalytics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    fetchAnalyticsData()
      .then(d => {
        setData({
          ...d,
          articles: enrichArticles(d.articles, d.scrolls, d.times, d.impressions),
        });
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="sa-center">
      <div className="sa-spinner" />
      <span className="sa-loading-text">Loading analytics…</span>
    </div>
  );

  if (error) return (
    <div className="sa-center">
      <div className="sa-error-box">
        <span className="sa-error-icon">⚠</span>
        <p>{error}</p>
      </div>
    </div>
  );

  const { articles, submissions, views } = data;

  const totalViews = views.length;
  const sessions   = new Set(views.map(v => v.session_id).filter(Boolean)).size;
  const allTime    = articles.reduce((s, a) => s + (Number(a.view_count) || 0), 0);
  const pending    = submissions.filter(s => s.status === "pending").length;
  const approved   = submissions.filter(s => s.status === "approved").length;
  const rejected   = submissions.filter(s => s.status === "rejected").length;
  const acceptRate = submissions.length > 0
    ? Math.round((approved / submissions.length) * 100)
    : null;

  const avgCompletion = articles.filter(a => a.completionRate > 0).length > 0
    ? Math.round(articles.reduce((s, a) => s + (a.completionRate || 0), 0) / articles.filter(a => a.completionRate > 0).length)
    : null;

  const filtered = search
    ? articles.filter(a =>
        a.title?.toLowerCase().includes(search.toLowerCase()) ||
        a.author?.toLowerCase().includes(search.toLowerCase()) ||
        a.category?.toLowerCase().includes(search.toLowerCase())
      )
    : articles;

  const now = new Date().toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });

  return (
    <div className="sa-page">

      {/* ── Header ── */}
      <div className="sa-header">
        <div className="sa-header-left">
          <p className="sa-eyebrow">Admin · Analytics</p>
          <h1 className="sa-title">Performance Overview</h1>
        </div>
        <div className="sa-header-right">
          <span className="sa-date">{now}</span>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="sa-kpi-strip">
        <div className="sa-kpi sa-kpi--accent">
          <span className="sa-kpi-value">{totalViews.toLocaleString()}</span>
          <span className="sa-kpi-label">Page Views</span>
          <span className="sa-kpi-sub">last 90 days</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-value">{sessions > 0 ? sessions.toLocaleString() : "—"}</span>
          <span className="sa-kpi-label">Unique Visitors</span>
          <span className="sa-kpi-sub">anonymous sessions</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-value">{allTime.toLocaleString()}</span>
          <span className="sa-kpi-label">All-time Views</span>
          <span className="sa-kpi-sub">across all articles</span>
        </div>
        <div className="sa-kpi">
          <span className="sa-kpi-value">{articles.length}</span>
          <span className="sa-kpi-label">Published</span>
          <span className="sa-kpi-sub">articles</span>
        </div>
        {avgCompletion !== null && (
          <div className="sa-kpi">
            <span className="sa-kpi-value">{avgCompletion}%</span>
            <span className="sa-kpi-label">Avg Completion</span>
            <span className="sa-kpi-sub">readers to 75%+</span>
          </div>
        )}
        <div className="sa-kpi">
          <span className="sa-kpi-value">{acceptRate !== null ? `${acceptRate}%` : "—"}</span>
          <span className="sa-kpi-label">Accept Rate</span>
          <span className="sa-kpi-sub">submissions</span>
        </div>
      </div>

      {/* ── Two-col layout ── */}
      <div className="sa-body">

        {/* ── Articles ── */}
        <div className="sa-main">
          <div className="sa-card">
            <div className="sa-card-header">
              <div className="sa-card-title-row">
                <h2 className="sa-card-title">Articles</h2>
                <span className="sa-badge">{articles.length}</span>
              </div>
              <div className="sa-search-wrap">
                <span className="sa-search-icon">⌕</span>
                <input
                  className="sa-search"
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button className="sa-search-clear" onClick={() => setSearch("")}>✕</button>
                )}
              </div>
            </div>

            {filtered.length === 0
              ? <p className="sa-empty">No articles match.</p>
              : (
                <div className="sa-table">
                  <div className="sa-table-head">
                    <span>Title</span>
                    <span>Category</span>
                    <span>Published</span>
                    <span>Views</span>
                    <span>Avg Read</span>
                    <span>Completion</span>
                  </div>
                  {filtered.map(a => (
                    <div key={a.id} className="sa-table-row">
                      <div className="sa-title-cell">
                        <a href={`/article/${a.id}`} target="_blank" rel="noreferrer">
                          {a.title || "—"}
                        </a>
                        {a.author && <span className="sa-author">{a.author}</span>}
                      </div>
                      <span><Pill label={a.category} /></span>
                      <span className="sa-muted">
                        {a.published_at
                          ? new Date(a.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })
                          : <em>Draft</em>}
                      </span>
                      <span className="sa-views">{(Number(a.view_count) || 0).toLocaleString()}</span>
                      <span className="sa-stat">{formatDuration(a.avgReadSeconds)}</span>
                      <div className="sa-completion-cell">
                        {a.completionRate > 0
                          ? <>
                              <MiniBar pct={a.completionRate}
                                color={a.completionRate >= 60 ? "#4ade80" : a.completionRate >= 30 ? "#e8ff47" : "#f87171"} />
                              <span className="sa-completion-pct">{a.completionRate}%</span>
                            </>
                          : <span className="sa-muted">—</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="sa-side">

          {/* Submissions */}
          <div className="sa-card">
            <div className="sa-card-header">
              <div className="sa-card-title-row">
                <h2 className="sa-card-title">Submissions</h2>
                <span className="sa-badge">{submissions.length}</span>
              </div>
            </div>
            {submissions.length === 0
              ? <p className="sa-empty">No submissions yet.</p>
              : (
                <>
                  <div className="sa-sub-stats">
                    <div className="sa-sub-stat">
                      <span className="sa-sub-num" style={{ color: "#e8ff47" }}>{pending}</span>
                      <span className="sa-sub-label">Pending</span>
                    </div>
                    <div className="sa-sub-stat">
                      <span className="sa-sub-num" style={{ color: "#4ade80" }}>{approved}</span>
                      <span className="sa-sub-label">Approved</span>
                    </div>
                    <div className="sa-sub-stat">
                      <span className="sa-sub-num" style={{ color: "#f87171" }}>{rejected}</span>
                      <span className="sa-sub-label">Rejected</span>
                    </div>
                  </div>
                  <div className="sa-funnel-track-wide">
                    {[
                      { value: pending,  color: "#e8ff47" },
                      { value: approved, color: "#4ade80" },
                      { value: rejected, color: "#f87171" },
                    ].map((b, i) => (
                      <div key={i} className="sa-funnel-seg" style={{
                        width: `${Math.round((b.value / submissions.length) * 100)}%`,
                        background: b.color,
                      }} />
                    ))}
                  </div>
                  {acceptRate !== null && (
                    <p className="sa-accept-rate">
                      <span style={{ color: "#4ade80" }}>{acceptRate}%</span> acceptance rate
                    </p>
                  )}
                </>
              )
            }
          </div>

          {/* Top articles by views */}
          <div className="sa-card">
            <div className="sa-card-header">
              <div className="sa-card-title-row">
                <h2 className="sa-card-title">Top Articles</h2>
                <span className="sa-badge">by views</span>
              </div>
            </div>
            {articles.length === 0
              ? <p className="sa-empty">No articles yet.</p>
              : (
                <div className="sa-top-list">
                  {[...articles]
                    .sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0))
                    .slice(0, 5)
                    .map((a, i) => {
                      const maxViews = Number(articles[0]?.view_count) || 1;
                      const pct = Math.round(((Number(a.view_count) || 0) / maxViews) * 100);
                      return (
                        <div key={a.id} className="sa-top-row">
                          <span className="sa-top-rank">{i + 1}</span>
                          <div className="sa-top-info">
                            <a href={`/article/${a.id}`} target="_blank" rel="noreferrer"
                              className="sa-top-title">{a.title || "—"}</a>
                            <div className="sa-mini-bar-wrap" style={{ marginTop: "4px" }}>
                              <div className="sa-mini-bar-fill" style={{ width: `${pct}%`, background: "#e8ff47", opacity: 0.7 }} />
                            </div>
                          </div>
                          <span className="sa-top-views">{(Number(a.view_count) || 0).toLocaleString()}</span>
                        </div>
                      );
                    })
                  }
                </div>
              )
            }
          </div>

          {/* Publishing by category */}
          {articles.length > 0 && (() => {
            const catMap = {};
            articles.forEach(a => {
              const c = a.category || "Uncategorised";
              catMap[c] = (catMap[c] || 0) + 1;
            });
            const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
            const catMax = cats[0]?.[1] || 1;
            return (
              <div className="sa-card">
                <div className="sa-card-header">
                  <div className="sa-card-title-row">
                    <h2 className="sa-card-title">By Category</h2>
                    <span className="sa-badge">articles</span>
                  </div>
                </div>
                <div className="sa-cat-list">
                  {cats.map(([cat, count]) => (
                    <div key={cat} className="sa-cat-row">
                      <span className="sa-cat-label">{cat}</span>
                      <div className="sa-mini-bar-wrap sa-mini-bar-wrap--lg">
                        <div className="sa-mini-bar-fill" style={{ width: `${Math.round((count / catMax) * 100)}%`, background: "#e8ff47", opacity: 0.6 }} />
                      </div>
                      <span className="sa-cat-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
