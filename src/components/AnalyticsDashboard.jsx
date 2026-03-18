import { useEffect, useState } from "react";
import { getAnalytics, getArticlesWithViews, getPageViewStats } from "../utils/supabase";
import { formatDate } from "../utils/dateUtils";
import "./AnalyticsDashboard.css";

export default function AnalyticsDashboard() {
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [articles,    setArticles]    = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [views,       setViews]       = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [analytics, arts, pageViews] = await Promise.all([
          getAnalytics().catch(() => ({ submissions: [] })),
          getArticlesWithViews().catch(() => []),
          getPageViewStats().catch(() => []),
        ]);
        setArticles(Array.isArray(arts) ? arts : []);
        setSubmissions(Array.isArray(analytics?.submissions) ? analytics.submissions : []);
        setViews(Array.isArray(pageViews) ? pageViews : []);
      } catch (e) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <span>Loading analytics…</span>
    </div>
  );

  if (error) return (
    <div className="ad-error"><span>⚠</span><p>{error}</p></div>
  );

  const totalViews    = views.length;
  const sessions      = new Set(views.map(v => v.session_id)).size;
  const pending       = submissions.filter(s => s.status === "pending").length;
  const approved      = submissions.filter(s => s.status === "approved").length;
  const allTimeViews  = articles.reduce((s, a) => s + (Number(a.view_count) || 0), 0);

  return (
    <div className="ad-page">

      <div className="ad-header">
        <div className="ad-header-left">
          <span className="ad-eyebrow">Admin · Analytics</span>
          <h1 className="ad-title">Performance Overview</h1>
        </div>
      </div>

      {/* KPIs */}
      <div className="ad-kpi-row">
        <div className="kpi-card kpi-card--accent">
          <span className="kpi-value">{totalViews.toLocaleString()}</span>
          <span className="kpi-label">Page Views</span>
          <span className="kpi-sub">last 90 days</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{sessions.toLocaleString()}</span>
          <span className="kpi-label">Unique Visitors</span>
          <span className="kpi-sub">anonymous sessions</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{allTimeViews.toLocaleString()}</span>
          <span className="kpi-label">All-time Views</span>
          <span className="kpi-sub">across all articles</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{articles.length}</span>
          <span className="kpi-label">Published</span>
          <span className="kpi-sub">articles total</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">{pending}</span>
          <span className="kpi-label">Pending</span>
          <span className="kpi-sub">submissions</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-value">
            {submissions.length > 0 ? `${Math.round((approved / submissions.length) * 100)}%` : "—"}
          </span>
          <span className="kpi-label">Accept Rate</span>
          <span className="kpi-sub">submissions approved</span>
        </div>
      </div>

      {/* Articles table */}
      <div className="ad-card ad-card--wide" style={{ marginTop: "1.5rem" }}>
        <div className="ad-card-header">
          <span className="ad-card-title">Articles</span>
          <span className="ad-card-sub">{articles.length} total</span>
        </div>
        <div className="ad-full-table">
          <div className="ad-full-header">
            <span>Title</span>
            <span>Author</span>
            <span>Category</span>
            <span>Published</span>
            <span>Views</span>
            <span>Est. Readers</span>
          </div>
          {articles.length === 0
            ? <div className="ad-empty ad-empty--center" style={{ padding: "2rem" }}>No articles yet.</div>
            : articles.map(a => (
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
                <span className="ad-full-views">{(Number(a.view_count) || 0).toLocaleString()}</span>
                <span className="ad-full-readers">{Math.round((Number(a.view_count) || 0) * 0.72).toLocaleString()}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Submissions */}
      <div className="ad-card ad-card--wide" style={{ marginTop: "1rem" }}>
        <div className="ad-card-header">
          <span className="ad-card-title">Submissions</span>
          <span className="ad-card-sub">{submissions.length} total</span>
        </div>
        <div className="ad-funnel">
          {[
            { label: "Pending",  value: pending,                                           color: "#e8ff47" },
            { label: "Approved", value: approved,                                          color: "#4ade80" },
            { label: "Rejected", value: submissions.filter(s => s.status === "rejected").length, color: "#f87171" },
          ].map(row => (
            <div key={row.label} className="ad-funnel-row">
              <span className="ad-funnel-label">{row.label}</span>
              <div className="ad-funnel-track">
                <div className="ad-funnel-fill" style={{
                  width: `${submissions.length > 0 ? Math.round((row.value / submissions.length) * 100) : 0}%`,
                  background: row.color,
                }} />
              </div>
              <span className="ad-funnel-val">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
