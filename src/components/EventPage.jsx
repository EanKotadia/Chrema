import { useState, useEffect, useRef } from "react";
import { getEventBySlug, submitEventEntry, uploadImage, getEventSubmissions } from "../utils/supabase";
import Footer from "./Footer";
import "./EventPage.css";

// ── Countdown ─────────────────────────────────────────────
function Countdown({ deadline }) {
  const [t, setT] = useState(null);
  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline) - Date.now();
      if (diff <= 0) return setT({ expired: true });
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setT({ d, h, m, s });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  if (!t) return null;
  if (t.expired) return <div className="cd-expired">Submissions closed</div>;
  return (
    <div className="countdown">
      {[["d","Days"],["h","Hrs"],["m","Min"],["s","Sec"]].map(([k, l]) => (
        <div key={k} className="cd-unit">
          <span className="cd-n">{String(t[k]).padStart(2,"0")}</span>
          <span className="cd-l">{l}</span>
        </div>
      ))}
    </div>
  );
}

// ── Gallery ───────────────────────────────────────────────
function Gallery({ submissions }) {
  const [light, setLight] = useState(null);
  const approved = submissions.filter(s => s.status === "approved");
  if (!approved.length) return (
    <div className="gallery-empty">
      <p>Approved submissions will appear here.</p>
    </div>
  );
  return (
    <>
      <div className="gallery-grid">
        {approved.map(s => (
          <div key={s.id} className="gallery-card" onClick={() => setLight(s)}>
            {s.image_url
              ? <img src={s.image_url} alt={s.title} className="gallery-img" loading="lazy" />
              : <div className="gallery-article-thumb">
                  <span className="gallery-type-tag">Article</span>
                  <p className="gallery-article-title">{s.title}</p>
                </div>
            }
            <div className="gallery-card-footer">
              <span className="gallery-name">{s.name}</span>
              <span className="gallery-grade">Grade {s.grade}</span>
            </div>
          </div>
        ))}
      </div>
      {light && (
        <div className="lightbox" onClick={() => setLight(null)}>
          <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLight(null)}>✕</button>
            {light.image_url
              ? <img src={light.image_url} alt={light.title} className="lightbox-img" />
              : <div className="lightbox-article">
                  <h3>{light.title}</h3>
                  <p className="lightbox-body">{light.body}</p>
                </div>
            }
            <div className="lightbox-meta">
              <strong>{light.name}</strong>
              <span>Grade {light.grade} · {light.school}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Submission form ───────────────────────────────────────
const EMPTY_FORM = { name:"", email:"", grade:"", school:"", type:"article", title:"", body:"" };

function SubmitForm({ event, onSuccess }) {
  const [form, setForm]           = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const fileRef = useRef(null);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleFile = e => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError("Max 10MB"); return; }
    setImageFile(f);
    const r = new FileReader();
    r.onload = ev => setImagePreview(ev.target.result);
    r.readAsDataURL(f);
  };

  const valid = form.name && form.email && form.grade && form.title &&
    (form.type === "drawing" ? imageFile : form.body.trim().length > 50);

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true); setError("");
    try {
      let image_url = null;
      if (imageFile) {
        setUploading(true);
        image_url = await uploadImage(imageFile);
        setUploading(false);
      }
      await submitEventEntry({
        event_id:   event.id,
        event_slug: event.slug,
        name:       form.name,
        email:      form.email,
        grade:      form.grade,
        school:     form.school || null,
        type:       form.type,
        title:      form.title,
        body:       form.type === "article" ? form.body : null,
        image_url,
        status:     "pending",
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="event-form">
      <div className="event-form-type-toggle">
        {event.allow_articles && (
          <button
            className={`type-btn ${form.type === "article" ? "active" : ""}`}
            onClick={() => setForm(p => ({ ...p, type: "article" }))}
          >Article</button>
        )}
        {event.allow_drawings && (
          <button
            className={`type-btn ${form.type === "drawing" ? "active" : ""}`}
            onClick={() => setForm(p => ({ ...p, type: "drawing" }))}
          >Artwork / Drawing</button>
        )}
      </div>

      <div className="ef-row">
        <div className="ef-field">
          <label className="ef-label">Full Name *</label>
          <input className="ef-input" value={form.name} onChange={set("name")} placeholder="Your name" />
        </div>
        <div className="ef-field">
          <label className="ef-label">Email *</label>
          <input className="ef-input" type="email" value={form.email} onChange={set("email")} placeholder="your@email.com" />
        </div>
      </div>
      <div className="ef-row">
        <div className="ef-field">
          <label className="ef-label">Grade *</label>
          <select className="ef-input" value={form.grade} onChange={set("grade")}>
            <option value="">Select grade</option>
            {Array.from({length: 5}, (_,i) => i + event.grade_min).map(g => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
            <option value="12+">Grade 12+</option>
          </select>
        </div>
        <div className="ef-field">
          <label className="ef-label">School (optional)</label>
          <input className="ef-input" value={form.school} onChange={set("school")} placeholder="Your school name" />
        </div>
      </div>

      <div className="ef-field">
        <label className="ef-label">Title *</label>
        <input className="ef-input" value={form.title} onChange={set("title")}
          placeholder={form.type === "drawing" ? "Name your artwork" : "Article title"} />
      </div>

      {form.type === "article" && (
        <div className="ef-field">
          <label className="ef-label">Your Article * <span className="ef-hint">300–1500 words</span></label>
          <textarea
            className="ef-input ef-textarea"
            rows={12}
            value={form.body}
            onChange={set("body")}
            placeholder="Write your article here…"
          />
          <span className="ef-word-count">
            {form.body.trim().split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      )}

      <div className="ef-field">
        <label className="ef-label">
          {form.type === "drawing" ? "Upload Artwork *" : "Cover Image (optional)"}
        </label>
        <div className="ef-dropzone" onClick={() => fileRef.current?.click()}>
          {imagePreview
            ? <img src={imagePreview} alt="preview" className="ef-preview" />
            : <span className="ef-drop-hint">Click to upload · JPG, PNG · Max 10MB</span>
          }
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}} />
        </div>
      </div>

      {error && <p className="ef-error">{error}</p>}

      <button
        className="ef-submit-btn"
        onClick={handleSubmit}
        disabled={!valid || submitting}
        style={{ "--ev-accent": event.accent_color }}
      >
        {uploading ? "Uploading image…" : submitting ? "Submitting…"
          : `Submit ${form.type === "drawing" ? "Artwork" : "Article"} →`}
      </button>
    </div>
  );
}

// ── "Opens in" panel shown on submit tab before start_date ─
function OpensIn({ startDate }) {
  const fmtDate = new Date(startDate).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  return (
    <div className="event-not-open-wrap">
      <div className="event-not-open-card">
        <span className="eno-icon">🗓</span>
        <h3 className="eno-heading">Submissions open on {fmtDate}</h3>
        <p className="eno-sub">Check back then to submit your entry.</p>
        <div className="eno-countdown-label">Opens in</div>
        <Countdown deadline={startDate} />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────
function fmtUTCDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

// ── Main page ─────────────────────────────────────────────
export default function EventPage({ slug }) {
  const [event, setEvent]             = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [tab, setTab]                 = useState("about");
  const [submitted, setSubmitted]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);

  useEffect(() => {
    Promise.all([
      getEventBySlug(slug),
      getEventSubmissions(null),
    ]).then(([ev, subs]) => {
      if (!ev) { setNotFound(true); setLoading(false); return; }
      setEvent(ev);
      setSubmissions(subs.filter(s => s.event_slug === slug));
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [slug]);

  if (loading) return (
    <div className="loading-state" style={{minHeight:"100vh"}}>
      <div className="loading-spinner"/>
    </div>
  );
  if (notFound) return (
    <div className="event-not-found">
      <a href="/" className="enf-logo">CHRÈMA</a>
      <h1>Event not found</h1>
      <a href="/" className="enf-back">← Back to Magazine</a>
    </div>
  );

  const now           = Date.now();
  const accent        = event.accent_color || "#e8ff47";
  const approvedCount = submissions.filter(s => s.status === "approved").length;

  const startDate  = event.start_date ? new Date(event.start_date) : null;
  const deadline   = event.deadline   ? new Date(event.deadline)   : null;

  const beforeStart = startDate && now < startDate.getTime();
  const afterEnd    = deadline  && now > deadline.getTime();
  const isArchived  = event.status === "archived";
  const isOpen      = event.status === "active" && !beforeStart && !afterEnd;

  const submitTabLabel = (() => {
    if (isArchived || afterEnd) return "Submissions Closed";
    if (beforeStart)            return `Opens ${fmtUTCDate(event.start_date)}`;
    return "Submit Entry";
  })();

  const submitTabDisabled = isArchived || afterEnd;

  return (
    <div className="event-page" style={{"--ev-accent": accent}}>

      {/* Nav */}
      <header className="event-nav">
        <a href="/" className="event-nav-logo">CHRÈMA</a>
        <div className="event-nav-right">
          {isArchived && <span className="event-archive-badge">Archived Event</span>}
          <a href="/events" className="event-nav-back">All Events →</a>
        </div>
      </header>

      {/* Banner */}
      <section className="event-banner">
        {event.banner_url && (
          <div className="event-banner-bg">
            <img src={event.banner_url} alt="" />
            <div className="event-banner-overlay" />
          </div>
        )}
        <div className="event-banner-inner">
          <div className="event-banner-left">
            <span className="event-eyebrow" style={{color: accent}}>Special Event</span>
            <h1 className="event-title">{event.title}</h1>
            <p className="event-tagline">{event.tagline}</p>
            <div className="event-meta-pills">
              <span className="event-pill">Grade {event.grade_min}+</span>
              {event.allow_articles && <span className="event-pill">Articles</span>}
              {event.allow_drawings && <span className="event-pill">Artwork</span>}
              {isOpen      && <span className="event-pill event-pill--open">Open</span>}
              {beforeStart && <span className="event-pill event-pill--soon">Opening Soon</span>}
              {(isArchived || afterEnd) && <span className="event-pill event-pill--archived">Closed</span>}
            </div>
          </div>

          <div className="event-banner-right">
            {isOpen && deadline && (
              <div className="event-countdown-wrap">
                <span className="event-countdown-label">Closes in</span>
                <Countdown deadline={event.deadline} />
              </div>
            )}
            {beforeStart && (
              <div className="event-countdown-wrap">
                <span className="event-countdown-label">Opens in</span>
                <Countdown deadline={event.start_date} />
              </div>
            )}
            {(startDate || deadline) && (
              <div className="event-window">
                {startDate && (
                  <div className="event-window-row">
                    <span className="event-window-label">Opens</span>
                    <span className="event-window-date">{fmtUTCDate(event.start_date)}</span>
                  </div>
                )}
                {deadline && (
                  <div className="event-window-row">
                    <span className="event-window-label">Closes</span>
                    <span className="event-window-date">{fmtUTCDate(event.deadline)}</span>
                  </div>
                )}
              </div>
            )}
            {approvedCount > 0 && (
              <div className="event-stat">
                <span className="event-stat-n">{approvedCount}</span>
                <span className="event-stat-l">Published entries</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tab bar */}
      <div className="event-tabs">
        {[
          { key: "about",   label: "About",             disabled: false },
          { key: "submit",  label: submitTabLabel,       disabled: submitTabDisabled },
          { key: "gallery", label: `Gallery${approvedCount ? ` (${approvedCount})` : ""}`, disabled: false },
        ].map(({ key, label, disabled }) => (
          <button
            key={key}
            className={`ev-tab ${tab === key ? "active" : ""} ${disabled ? "disabled" : ""}`}
            onClick={() => !disabled && setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Announcement bar ── */}
      {beforeStart && (
        <div className="event-opens-bar">
          <div className="event-opens-bar-left">
            <p className="event-opens-bar-eyebrow">⏳ Submissions not yet open</p>
            <p className="event-opens-bar-headline">
              You can submit from <strong>{fmtUTCDate(event.start_date)}</strong>
              {deadline && <>{" "}until <strong>{fmtUTCDate(event.deadline)}</strong></>}
            </p>
          </div>
          <div className="event-opens-bar-right">
            <p className="event-opens-bar-countdown-label">Opens in</p>
            <Countdown deadline={event.start_date} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="event-content">

        {/* ── About ── */}
        {tab === "about" && (
          <div className="event-about">
            <div className="event-about-inner">
              <div className="event-about-main">
                <span className="ev-section-label">About this event</span>
                <p className="event-description">{event.description}</p>

                {event.rules && (
                  <div className="event-rules">
                    <span className="ev-section-label">Rules & Eligibility</span>
                    <ul>
                      {event.rules.split("\n").filter(r => r.trim()).map((r, i) => (
                        <li key={i}>{r.replace(/^[-•·]\s*/, "").trim()}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {event.prizes && (
                  <div className="event-prizes">
                    <span className="ev-section-label">Recognition</span>
                    <ul className="event-prizes-list">
                      {event.prizes.split("\n").filter(r => r.trim()).map((r, i) => (
                        <li key={i}>{r.replace(/^[-•·]\s*/, "").trim()}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="event-about-side">
                <div className="event-side-card">
                  <span className="ev-section-label">Submission Window</span>

                  {beforeStart ? (
                    <>
                      <div className="event-side-opens-hero">
                        <span className="event-side-opens-label">Submissions open</span>
                        <span className="event-side-opens-date" style={{color: accent}}>
                          {fmtUTCDate(event.start_date)}
                        </span>
                      </div>
                      {deadline && (
                        <div className="event-side-date-row">
                          <span className="event-side-date-label">Closes</span>
                          <span className="event-side-date-val">{fmtUTCDate(event.deadline)}</span>
                        </div>
                      )}
                      <p className="event-side-note">Opens in</p>
                      <Countdown deadline={event.start_date} />
                      <button className="event-cta-btn event-cta-btn--disabled" disabled>
                        Not yet open
                      </button>
                    </>
                  ) : (
                    <>
                      {startDate && (
                        <div className="event-side-date-row">
                          <span className="event-side-date-label">Opens</span>
                          <span className="event-side-date-val">{fmtUTCDate(event.start_date)}</span>
                        </div>
                      )}
                      {deadline && (
                        <div className="event-side-date-row">
                          <span className="event-side-date-label">Closes</span>
                          <span className="event-side-date-val">{fmtUTCDate(event.deadline)}</span>
                        </div>
                      )}
                      {isOpen && deadline && (
                        <>
                          <p className="event-side-note">Closes in</p>
                          <Countdown deadline={event.deadline} />
                        </>
                      )}
                      {isOpen && (
                        <button
                          className="event-cta-btn"
                          style={{"--ev-accent": accent}}
                          onClick={() => setTab("submit")}
                        >
                          Submit Now →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        {tab === "submit" && (
          <div className="event-submit-wrap">
            {beforeStart ? (
              <OpensIn startDate={event.start_date} />
            ) : submitted ? (
              <div className="event-success">
                <h2>Submission received.</h2>
                <p>Thank you for participating. We'll review your entry and it may appear in the gallery once approved.</p>
                <button className="event-cta-btn" style={{"--ev-accent": accent}} onClick={() => setTab("gallery")}>
                  View Gallery →
                </button>
              </div>
            ) : (
              <>
                <div className="event-submit-header">
                  <h2>Submit your entry</h2>
                  <p>Grade {event.grade_min} and above. Your submission will be reviewed before appearing in the gallery.</p>
                </div>
                <SubmitForm event={event} onSuccess={() => setSubmitted(true)} />
              </>
            )}
          </div>
        )}

        {/* ── Gallery ── */}
        {tab === "gallery" && (
          <div className="event-gallery-wrap">
            <div className="event-gallery-header">
              <h2>Submissions Gallery</h2>
              <p>{approvedCount
                ? `${approvedCount} published ${approvedCount === 1 ? "entry" : "entries"}`
                : "No approved submissions yet."}</p>
            </div>
            <Gallery submissions={submissions} />
          </div>
        )}

      </div>

      <Footer />
    </div>
  );
}
