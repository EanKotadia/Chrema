import { useState } from "react";
import AdminPage from "./AdminPage";
import SubmissionsPage from "./SubmissionsPage";
import AnalyticsDashboard from "./AnalyticsDashboard";
import AdminEvents from "./AdminEvents";
import ArticlesManager from "./ArticlesManager";
import "./AdminAuth.css";
import "./AdminShell.css";

const PASSCODE = process.env.REACT_APP_PASSCODE || "chréma2025";

const TABS = [
  { key: "analytics",   label: "Analytics",   icon: "▲" },
  { key: "articles",    label: "Articles",     icon: "◈" },
  { key: "publish",     label: "Publish",      icon: "+" },
  { key: "submissions", label: "Submissions",  icon: "◎" },
  { key: "events",      label: "Events",       icon: "◆" },
];

export default function AdminShell({ initialView }) {
  const [authed, setAuthed] = useState(
    () => localStorage.getItem("chrema_admin") === "true"
  );
  const [input, setInput]   = useState("");
  const [error, setError]   = useState(false);
  const [view, setView]     = useState(initialView || "analytics");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogin = () => {
    if (input === PASSCODE) {
      localStorage.setItem("chrema_admin", "true");
      setAuthed(true); setError(false);
    } else {
      setError(true); setInput("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("chrema_admin");
    setAuthed(false); setInput("");
  };

  if (!authed) {
    return (
      <div className="auth-page">
        <div className="auth-box">
          <a href="/" className="auth-logo">CHRÈMA</a>
          <div className="auth-badge">Admin</div>
          <h1 className="auth-title">Welcome back.</h1>
          <p className="auth-sub">Enter your passcode to access the dashboard.</p>
          <div className={`auth-field ${error ? "auth-field--error" : ""}`}>
            <input
              className="auth-input"
              type="password"
              placeholder="Passcode"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
          </div>
          {error && <p className="auth-error">Incorrect passcode.</p>}
          <button className="auth-btn" onClick={handleLogin}>Enter →</button>
          <a href="/" className="auth-back">← Back to magazine</a>
        </div>
      </div>
    );
  }

  const activeTab = TABS.find(t => t.key === view);

  return (
    <div className={`admin-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>

      {/* Sidebar */}
      <aside className="shell-sidebar">
        <div className="shell-sidebar-top">
          <a href="/" className="shell-logo">
            <span className="shell-logo-mark">C</span>
            <span className="shell-logo-text">HRÈMA</span>
          </a>
          <button className="shell-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? "←" : "→"}
          </button>
        </div>

        <div className="shell-sidebar-label">Navigation</div>

        <nav className="shell-nav-list">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`shell-nav-item ${view === key ? "active" : ""}`}
              onClick={() => setView(key)}
            >
              <span className="shell-nav-icon">{icon}</span>
              <span className="shell-nav-label">{label}</span>

            </button>
          ))}
        </nav>

        <div className="shell-sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer" className="shell-visit-link">
            <span className="shell-nav-icon">↗</span>
            <span className="shell-nav-label">View Site</span>
          </a>
          <button className="shell-logout-btn" onClick={handleLogout}>
            <span className="shell-nav-icon">⏻</span>
            <span className="shell-nav-label">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="shell-main">
        {/* Top bar */}
        <div className="shell-topbar">
          <div className="shell-topbar-left">
            <span className="shell-topbar-icon">{activeTab?.icon}</span>
            <h1 className="shell-topbar-title">{activeTab?.label}</h1>
          </div>
          <div className="shell-topbar-right">
            <span className="shell-topbar-user">Admin</span>
          </div>
        </div>

        {/* Page content */}
        <div className="shell-content">
          {view === "analytics"   && <AnalyticsDashboard />}
          {view === "articles"    && <ArticlesManager />}
          {view === "publish"     && <AdminPage embedded />}
          {view === "submissions" && <SubmissionsPage embedded />}
          {view === "events"      && <AdminEvents />}
        </div>
      </div>

    </div>
  );
}
