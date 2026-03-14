import { useState } from "react";

export default function Navbar({ categories, activeCategory, setActiveCategory }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="navbar-inner">

        {/* Mobile hamburger */}
        <button className="nav-hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>

        {/* Logo */}
        <a href="/public" className="navbar-logo">CHRÈMA</a>

        {/* Category pills — scrollable */}
        <nav className={`navbar-cats ${menuOpen ? "open" : ""}`}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`cat-btn ${activeCategory === cat ? "active" : ""}`}
              onClick={() => { setActiveCategory(cat); setMenuOpen(false); }}
            >
              {cat}
            </button>
          ))}
        </nav>

        {/* Right links */}
        <div className="navbar-right">
          <a href="/events" className="navbar-link navbar-link--events">
            <span className="navbar-link-dot" />
            Events
          </a>
          <a href="/submit" className="navbar-link">Write for Us</a>
          <a href="/about" className="navbar-link navbar-link--dim">About</a>

        </div>

      </div>
    </header>
  );
}
