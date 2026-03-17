import { useState, useEffect } from "react";
import { getEvents } from "../utils/supabase";
import Footer from "./Footer";
import "./EventsArchive.css";

export default function EventsArchive() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents().then(data => {
      setEvents(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const active   = events.filter(e => e.status === "active");
  const archived = events.filter(e => e.status === "archived");

  return (
    <div className="archive-page">
      <header className="archive-nav">
        <a href="/public" className="archive-nav-logo">CHRÈMA</a>
        <a href="/public" className="archive-nav-back">← Back to Magazine</a>
      </header>

      <section className="archive-hero">
        <div className="archive-hero-inner">
          <span className="archive-eyebrow">Events</span>
          <h1 className="archive-title">Contests &<br /><em>Special Events</em></h1>
          <p className="archive-sub">Student writing competitions, art contests, and special submission events hosted by Chréma Magazine.</p>
        </div>
      </section>

      <div className="archive-content">
        {loading ? (
          <div className="loading-state"><div className="loading-spinner" /></div>
        ) : (
          <>
            {active.length > 0 && (
              <section className="archive-section">
                <span className="archive-section-label">Open Now</span>
                <div className="archive-grid">
                  {active.map(e => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}

            {archived.length > 0 && (
              <section className="archive-section">
                <span className="archive-section-label">Past Events</span>
                <div className="archive-grid">
                  {archived.map(e => <EventCard key={e.id} event={e} archived />)}
                </div>
              </section>
            )}

            {!active.length && !archived.length && (
              <div className="archive-empty">
                <p>No events yet. Check back soon.</p>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

function EventCard({ event, archived }) {
  const accent = event.accent_color || "#e8ff47";
  return (
    <a href={`/events/${event.slug}`} className="ev-card" style={{"--ev-accent": accent}}>
      {event.banner_url && (
        <div className="ev-card-img-wrap">
          <img src={event.banner_url} alt={event.title} className="ev-card-img" loading="lazy" />
          <div className="ev-card-img-overlay" />
        </div>
      )}
      <div className="ev-card-body" style={{borderTop: `2px solid ${accent}`}}>
        <div className="ev-card-top">
          <span className="ev-card-badge" style={{color: accent, borderColor: `${accent}44`}}>
            {archived ? "Archived" : "Open"}
          </span>
          {event.deadline && !archived && (
            <span className="ev-card-deadline">
              Closes {new Date(event.deadline).toLocaleDateString("en-GB", {day:"numeric", month:"short"})}
            </span>
          )}
        </div>
        <h3 className="ev-card-title">{event.title}</h3>
        <p className="ev-card-tagline">{event.tagline}</p>
        <div className="ev-card-footer">
          <span className="ev-card-grade">Grade {event.grade_min}+</span>
          <span className="ev-card-link">View event →</span>
        </div>
      </div>
    </a>
  );
}
