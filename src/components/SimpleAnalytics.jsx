import { useEffect, useState } from "react";
import { fetchAnalyticsData } from "../utils/analytics";
import "./SimpleAnalytics.css";

export default function SimpleAnalytics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetchAnalyticsData()
      .then(d  => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <div className="sa-center"><div className="sa-spinner" /></div>;
  if (error)   return <div className="sa-center sa-error">⚠ {error}</div>;

  const { articles, submissions, views } = data;

  const totalViews   = views.length;
  const allTime      = articles.reduce((s, a) => s + (Number(a.view_count) || 0), 0);
  const pending      = submissions.filter(s => s.status === "pending").length;
  const approved     = submissions.filter(s => s.status === "approved").length;
  const rejected     = submissions.filter(s => s.status === "rejected").length;
  const acceptRate   = submissions.length > 0
    ? Math.round((approved / submissions.length) * 100) + "%"
    : "—";

  const kpis = [
    { label: "Page Views",    value: totalViews.toLocaleString(),  sub: "last 90 days",       accent: true },
    { label: "All-time Views",value: allTime.toLocaleString(),     sub: "across all articles" },
    { label: "Published",     value: articles.length,              sub: "articles"            },
    { label: "Pending",       value: pending,                      sub: "submissions"         },
    { label: "Approved",      value: approved,                     sub: "submissions"         },
    { label: "Accept Rate",   value: acceptRate,                   sub: "of all submissions"  },
  ];

  return (
    <div className="sa-page">

      <div className="sa-header">
        <p className="sa-eyebrow">Admin · Analytics</p>
        <h1 className="sa-title">Performance Overview</h1>
      </div>

      {/* KPI grid */}
      <div className="sa-kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className={`sa-kpi ${k.accent ? "sa-kpi--accent" : ""}`}>
            <span className="sa-kpi-value">{k.value}</span>
            <span className="sa-kpi-label">{k.label}</span>
            <span className="sa-kpi-sub">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Articles */}
      <div className="sa-section">
        <div className="sa-section-header">
          <h2 className="sa-section-title">Articles</h2>
          <span className="sa-section-count">{articles.length} total</span>
        </div>
        {articles.length === 0
          ? <p className="sa-empty">No articles yet.</p>
          : (
            <div className="sa-table">
              <div className="sa-table-head">
                <span>Title</span>
                <span>Author</span>
                <span>Category</span>
                <span>Published</span>
                <span>Views</span>
              </div>
              {articles.map(a => (
                <div key={a.id} className="sa-table-row">
                  <span className="sa-article-title">
                    <a href={`/article/${a.id}`} target="_blank" rel="noreferrer">{a.title || "—"}</a>
                  </span>
                  <span>{a.author    || "—"}</span>
                  <span>{a.category  || "—"}</span>
                  <span>{a.published_at ? new Date(a.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Draft"}</span>
                  <span className="sa-views">{(Number(a.view_count) || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Submissions */}
      <div className="sa-section">
        <div className="sa-section-header">
          <h2 className="sa-section-title">Submissions</h2>
          <span className="sa-section-count">{submissions.length} total</span>
        </div>
        <div className="sa-bars">
          {[
            { label: "Pending",  value: pending,  color: "#e8ff47" },
            { label: "Approved", value: approved, color: "#4ade80" },
            { label: "Rejected", value: rejected, color: "#f87171" },
          ].map(b => (
            <div key={b.label} className="sa-bar-row">
              <span className="sa-bar-label">{b.label}</span>
              <div className="sa-bar-track">
                <div className="sa-bar-fill" style={{
                  width: submissions.length > 0 ? `${Math.round((b.value / submissions.length) * 100)}%` : "0%",
                  background: b.color,
                }} />
              </div>
              <span className="sa-bar-val">{b.value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
