import { useState, useEffect } from "react";
import {
  getEvents, createEvent, updateEvent, deleteEvent,
  getEventSubmissions, updateEventSubmission, deleteEventSubmission,
  uploadImage,
} from "../utils/supabase";
import "./AdminEvents.css";

const ACCENT_OPTIONS = [
  "#e8ff47","#ff6b6b","#4ecdc4","#a78bfa","#fb923c","#38bdf8","#f472b6","#34d399",
];

// ── start_date added here ─────────────────────────────────
const EMPTY_EVENT = {
  title: "", slug: "", tagline: "", description: "", rules: "", prizes: "",
  accent_color: "#e8ff47", grade_min: 8,
  start_date: "",   // ← NEW
  deadline: "",
  status: "draft", allow_articles: true, allow_drawings: true, banner_url: "",
};

// ── Slug generator ────────────────────────────────────────
function toSlug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Event form (create / edit) ────────────────────────────
function EventForm({ initial, onSave, onCancel }) {
  const normalizeForForm = (ev) => {
    if (!ev) return EMPTY_EVENT;
    return {
      ...ev,
      // Convert ISO strings → datetime-local format (YYYY-MM-DDTHH:mm)
      start_date: ev.start_date ? new Date(ev.start_date).toISOString().slice(0, 16) : "",
      deadline:   ev.deadline   ? new Date(ev.deadline).toISOString().slice(0, 16)   : "",
    };
  };

  const [form, setForm]       = useState(() => normalizeForForm(initial));
  const [saving, setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]     = useState("");

  const set  = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setB = k => e => setForm(p => ({ ...p, [k]: e.target.checked }));

  const handleTitleChange = e => {
    const v = e.target.value;
    setForm(p => ({
      ...p,
      title: v,
      slug: initial?.slug ? p.slug : toSlug(v) + (new Date().getFullYear() > 2024 ? `-${new Date().getFullYear()}` : ""),
    }));
  };

  const handleBanner = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm(p => ({ ...p, banner_url: url }));
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.title || !form.slug) { setError("Title and slug are required."); return; }

    // Validate: start_date must be before deadline if both set
    if (form.start_date && form.deadline && new Date(form.start_date) >= new Date(form.deadline)) {
      setError("Submissions open date must be before the deadline."); return;
    }

    setSaving(true); setError("");
    try {
      const payload = {
        ...form,
        grade_min:  parseInt(form.grade_min) || 8,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null, // ← NEW
        deadline:   form.deadline   ? new Date(form.deadline).toISOString()   : null,
        banner_url: form.banner_url || null,
      };
      await onSave(payload);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="aev-form">
      <div className="aev-form-row">
        <div className="aev-field">
          <label className="aev-label">Event Title *</label>
          <input className="aev-input" value={form.title} onChange={handleTitleChange} placeholder="e.g. World Liver Day Writing Contest" />
        </div>
        <div className="aev-field">
          <label className="aev-label">URL Slug *</label>
          <div className="aev-slug-wrap">
            <span className="aev-slug-prefix">/events/</span>
            <input className="aev-input aev-slug-input" value={form.slug} onChange={set("slug")} placeholder="world-liver-day-2025" />
          </div>
        </div>
      </div>

      <div className="aev-field">
        <label className="aev-label">Tagline</label>
        <input className="aev-input" value={form.tagline} onChange={set("tagline")} placeholder="Short punchy line shown on banner" />
      </div>

      <div className="aev-field">
        <label className="aev-label">Description</label>
        <textarea className="aev-input aev-textarea" rows={4} value={form.description} onChange={set("description")} placeholder="Full description of the event…" />
      </div>

      <div className="aev-form-row">
        <div className="aev-field">
          <label className="aev-label">Rules (one per line)</label>
          <textarea className="aev-input aev-textarea" rows={5} value={form.rules} onChange={set("rules")} placeholder={"Open to Grade 8+\nOriginal work only\n300–1500 words for articles"} />
        </div>
        <div className="aev-field">
          <label className="aev-label">Prizes / Recognition</label>
          <textarea className="aev-input aev-textarea" rows={5} value={form.prizes} onChange={set("prizes")} placeholder="Top submissions featured on homepage, digital certificate…" />
        </div>
      </div>

      {/* ── Submission window — start + end side by side ── */}
      <div className="aev-form-row">
        <div className="aev-field">
          <label className="aev-label">
            Submissions Open
            <span className="aev-field-hint">Leave blank to open immediately</span>
          </label>
          <input
            className="aev-input"
            type="datetime-local"
            value={form.start_date}
            onChange={set("start_date")}
          />
        </div>
        <div className="aev-field">
          <label className="aev-label">
            Submissions Close (Deadline)
            <span className="aev-field-hint">Leave blank for no deadline</span>
          </label>
          <input
            className="aev-input"
            type="datetime-local"
            value={form.deadline}
            onChange={set("deadline")}
          />
        </div>
      </div>

      {/* Preview of the window so the admin can sanity-check */}
      {(form.start_date || form.deadline) && (
        <div className="aev-window-preview">
          <span className="aev-window-preview-label">Submission window</span>
          <span className="aev-window-preview-val">
            {form.start_date
              ? new Date(form.start_date).toLocaleString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
              : "Now"}
            {" → "}
            {form.deadline
              ? new Date(form.deadline).toLocaleString("en-GB", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
              : "No end date"}
          </span>
        </div>
      )}

      <div className="aev-form-row">
        <div className="aev-field">
          <label className="aev-label">Minimum Grade</label>
          <select className="aev-input" value={form.grade_min} onChange={set("grade_min")}>
            {[6,7,8,9,10,11,12].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="aev-field">
          <label className="aev-label">Status</label>
          <select className="aev-input" value={form.status} onChange={set("status")}>
            <option value="draft">Draft (hidden)</option>
            <option value="active">Active (public)</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div className="aev-form-row">
        <div className="aev-field">
          <label className="aev-label">Accent Colour</label>
          <div className="aev-accent-swatches">
            {ACCENT_OPTIONS.map(c => (
              <button
                key={c} type="button"
                className={`aev-swatch ${form.accent_color === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => setForm(p => ({ ...p, accent_color: c }))}
              />
            ))}
            <input type="color" className="aev-color-picker" value={form.accent_color} onChange={set("accent_color")} />
          </div>
        </div>
      </div>

      <div className="aev-checkboxes">
        <label className="aev-check">
          <input type="checkbox" checked={form.allow_articles} onChange={setB("allow_articles")} />
          Accept article submissions
        </label>
        <label className="aev-check">
          <input type="checkbox" checked={form.allow_drawings} onChange={setB("allow_drawings")} />
          Accept artwork / drawing submissions
        </label>
      </div>

      <div className="aev-field">
        <label className="aev-label">Banner Image</label>
        {form.banner_url && (
          <div className="aev-banner-preview">
            <img src={form.banner_url} alt="banner" />
            <button className="aev-remove-banner" onClick={() => setForm(p => ({ ...p, banner_url: "" }))}>Remove</button>
          </div>
        )}
        <label className="aev-upload-btn">
          {uploading ? "Uploading…" : "Upload banner image"}
          <input type="file" accept="image/*" onChange={handleBanner} style={{display:"none"}} />
        </label>
      </div>

      {error && <p className="aev-error">{error}</p>}

      <div className="aev-form-actions">
        <button className="aev-btn aev-btn--cancel" onClick={onCancel}>Cancel</button>
        <button className="aev-btn aev-btn--save" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Event"}
        </button>
      </div>
    </div>
  );
}

// ── Submission review row ─────────────────────────────────
function SubRow({ sub, onApprove, onReject, onNeedsEdit, onSaveEdit, onDelete }) {
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: sub.title || "",
    body:  sub.body  || "",
    name:  sub.name  || "",
    grade: sub.grade || "",
    school: sub.school || "",
    admin_note: sub.admin_note || "",
  });
  const [saving, setSaving] = useState(false);

  const setF = k => e => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    await onSaveEdit(sub.id, editForm);
    setSaving(false);
    setEditing(false);
  };

  const statusLabel = {
    pending:    "Pending",
    approved:   "Approved",
    rejected:   "Rejected",
    needs_edit: "Needs Edit",
  }[sub.status] || sub.status;

  return (
    <>
      <div className={`aev-sub-row ${open || editing ? "expanded" : ""}`}>
        <div className="aev-sub-type">
          <span className={`aev-type-tag aev-type-${sub.type}`}>{sub.type}</span>
        </div>
        <div className="aev-sub-name">
          {sub.name}<span className="aev-sub-grade"> · Grade {sub.grade}</span>
        </div>
        <div className="aev-sub-title">{sub.title}</div>
        <div className="aev-sub-date">{new Date(sub.submitted_at).toLocaleDateString()}</div>
        <div className="aev-sub-status">
          <span className={`aev-status aev-status--${sub.status}`}>{statusLabel}</span>
        </div>
        <div className="aev-sub-actions">
          <button className="aev-action-btn" onClick={() => { setOpen(o => !o); setEditing(false); }} title="View">
            {open ? "▲" : "▼"}
          </button>
          <button
            className={`aev-action-btn aev-action-btn--edit ${editing ? "active" : ""}`}
            onClick={() => { setEditing(e => !e); setOpen(false); }}
            title="Edit submission"
          >✎</button>
          {sub.status !== "approved" && (
            <button className="aev-action-btn aev-action-btn--approve" onClick={() => onApprove(sub)} title="Approve">✓</button>
          )}
          {sub.status !== "rejected" && (
            <button className="aev-action-btn aev-action-btn--reject" onClick={() => onReject(sub)} title="Reject">✕</button>
          )}
          {sub.status !== "needs_edit" && (
            <button className="aev-action-btn aev-action-btn--needs-edit" onClick={() => onNeedsEdit(sub)} title="Needs Edit">⚑</button>
          )}
          <button className="aev-action-btn aev-action-btn--delete" onClick={() => onDelete(sub)} title="Delete">🗑</button>
        </div>
      </div>

      {open && !editing && (
        <div className="aev-sub-detail">
          {sub.image_url && <img src={sub.image_url} alt={sub.title} className="aev-sub-img" />}
          {sub.body && <p className="aev-sub-body">{sub.body}</p>}
          {sub.admin_note && (
            <div className="aev-admin-note">
              <span className="aev-admin-note-label">Admin note</span>
              <p>{sub.admin_note}</p>
            </div>
          )}
          <p className="aev-sub-email">
            Email: <a href={`mailto:${sub.email}`}>{sub.email}</a> · School: {sub.school || "—"}
          </p>
        </div>
      )}

      {editing && (
        <div className="aev-sub-edit">
          <div className="aev-sub-edit-header">
            <span className="aev-eyebrow">Editing Submission</span>
            <span className="aev-sub-edit-hint">Changes save directly to Supabase and update the public gallery if approved.</span>
          </div>
          <div className="aev-edit-row">
            <div className="aev-edit-field">
              <label className="aev-label">Submitter Name</label>
              <input className="aev-input" value={editForm.name} onChange={setF("name")} />
            </div>
            <div className="aev-edit-field">
              <label className="aev-label">Grade</label>
              <input className="aev-input" value={editForm.grade} onChange={setF("grade")} />
            </div>
            <div className="aev-edit-field">
              <label className="aev-label">School</label>
              <input className="aev-input" value={editForm.school} onChange={setF("school")} />
            </div>
          </div>
          <div className="aev-edit-field">
            <label className="aev-label">Title</label>
            <input className="aev-input" value={editForm.title} onChange={setF("title")} />
          </div>
          {sub.type === "article" && (
            <div className="aev-edit-field">
              <label className="aev-label">
                Article Body
                <span className="aev-word-count">
                  {editForm.body.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </label>
              <textarea
                className="aev-input aev-textarea aev-textarea--tall"
                value={editForm.body}
                onChange={setF("body")}
                rows={16}
              />
            </div>
          )}
          <div className="aev-edit-field">
            <label className="aev-label">
              Internal Admin Note
              <span className="aev-edit-hint-inline">Visible only in admin panel</span>
            </label>
            <textarea
              className="aev-input aev-textarea"
              value={editForm.admin_note}
              onChange={setF("admin_note")}
              rows={3}
              placeholder="e.g. Asked student to trim conclusion — recheck before approving"
            />
          </div>
          <div className="aev-edit-actions">
            <button className="aev-btn aev-btn--cancel" onClick={() => setEditing(false)}>Cancel</button>
            <button className="aev-btn aev-btn--needs-edit" onClick={() => { onNeedsEdit(sub); setEditing(false); }}>
              Mark as Needs Edit
            </button>
            <button className="aev-btn aev-btn--save" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

// ── Main AdminEvents ──────────────────────────────────────
export default function AdminEvents() {
  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [creating, setCreating]       = useState(false);
  const [editing, setEditing]         = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [subFilter, setSubFilter]     = useState("pending");
  const [toast, setToast]             = useState(null);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    getEvents().then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const loadSubs = (ev) => {
    setActiveEvent(ev);
    getEventSubmissions(ev.id).then(data => setSubmissions(Array.isArray(data) ? data : []));
  };

  const handleCreate = async (payload) => { await createEvent(payload); load(); setCreating(false); showToast("Event created."); };
  const handleEdit   = async (payload) => { await updateEvent(editing.id, payload); load(); setEditing(null); showToast("Event updated."); };
  const handleDelete = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    await deleteEvent(ev.id); load(); showToast("Event deleted.", "error");
  };
  const handleArchive = async (ev) => {
    await updateEvent(ev.id, { status: ev.status === "active" ? "archived" : "active" });
    load(); showToast(ev.status === "active" ? "Event archived." : "Event re-activated.");
  };
  const handleApprove    = async (sub) => { await updateEventSubmission(sub.id, { status: "approved" });   setSubmissions(p => p.map(s => s.id === sub.id ? { ...s, status: "approved" }   : s)); showToast("Entry approved — now visible in gallery."); };
  const handleReject     = async (sub) => { await updateEventSubmission(sub.id, { status: "rejected" });   setSubmissions(p => p.map(s => s.id === sub.id ? { ...s, status: "rejected" }   : s)); showToast("Entry rejected."); };
  const handleNeedsEdit  = async (sub) => { await updateEventSubmission(sub.id, { status: "needs_edit" }); setSubmissions(p => p.map(s => s.id === sub.id ? { ...s, status: "needs_edit" } : s)); showToast("Marked as needs edit."); };
  const handleSaveEdit   = async (id, fields) => { await updateEventSubmission(id, fields); setSubmissions(p => p.map(s => s.id === id ? { ...s, ...fields } : s)); showToast("Submission updated."); };
  const handleDeleteSub  = async (sub) => {
    if (!window.confirm("Permanently delete this submission?")) return;
    await deleteEventSubmission(sub.id); setSubmissions(p => p.filter(s => s.id !== sub.id)); showToast("Submission deleted.", "error");
  };

  const filteredSubs = subFilter === "all" ? submissions : submissions.filter(s => s.status === subFilter);

  // ── Create / Edit form view ───────────────────────────
  if (creating || editing) {
    return (
      <div className="aev-page">
        <div className="aev-page-header">
          <span className="aev-eyebrow">Admin · Events</span>
          <h1 className="aev-title">{editing ? "Edit Event" : "New Event"}</h1>
        </div>
        <EventForm
          initial={editing || null}
          onSave={editing ? handleEdit : handleCreate}
          onCancel={() => { setCreating(false); setEditing(null); }}
        />
      </div>
    );
  }

  // ── Submissions view ──────────────────────────────────
  if (activeEvent) {
    const counts = {
      pending:    submissions.filter(s => s.status === "pending").length,
      approved:   submissions.filter(s => s.status === "approved").length,
      "needs edit": submissions.filter(s => s.status === "needs_edit").length,
      rejected:   submissions.filter(s => s.status === "rejected").length,
    };
    return (
      <div className="aev-page">
        <div className="aev-page-header">
          <div>
            <button className="aev-back-btn" onClick={() => setActiveEvent(null)}>← Back to Events</button>
            <h1 className="aev-title">{activeEvent.title}</h1>
          </div>
          <a href={`/events/${activeEvent.slug}`} target="_blank" rel="noreferrer" className="aev-view-link">View public page ↗</a>
        </div>

        <div className="aev-sub-stats">
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="aev-sub-stat">
              <span className="aev-sub-stat-n">{v}</span>
              <span className="aev-sub-stat-l">{k}</span>
            </div>
          ))}
        </div>

        <div className="aev-sub-filters">
          {[
            { key: "pending",    label: "Pending" },
            { key: "needs_edit", label: "Needs Edit" },
            { key: "approved",   label: "Approved" },
            { key: "rejected",   label: "Rejected" },
            { key: "all",        label: "All" },
          ].map(({ key, label }) => (
            <button key={key} className={`aev-filter-btn ${subFilter === key ? "active" : ""}`} onClick={() => setSubFilter(key)}>
              {label} {key !== "all" && `(${submissions.filter(s => s.status === key).length})`}
            </button>
          ))}
        </div>

        <div className="aev-sub-list">
          <div className="aev-sub-header">
            <span>Type</span><span>Name</span><span>Title</span><span>Date</span><span>Status</span><span>Actions</span>
          </div>
          {filteredSubs.length === 0
            ? <div className="aev-empty">No {subFilter} submissions.</div>
            : filteredSubs.map(s => (
                <SubRow key={s.id} sub={s} onApprove={handleApprove} onReject={handleReject} onNeedsEdit={handleNeedsEdit} onSaveEdit={handleSaveEdit} onDelete={handleDeleteSub} />
              ))
          }
        </div>

        {toast && <div className={`toast ${toast.type === "error" ? "toast--error" : "toast--success"}`}>{toast.msg}</div>}
      </div>
    );
  }

  // ── Event list view ───────────────────────────────────
  return (
    <div className="aev-page">
      <div className="aev-page-header">
        <div>
          <span className="aev-eyebrow">Admin</span>
          <h1 className="aev-title">Events</h1>
        </div>
        <button className="aev-btn aev-btn--save" onClick={() => setCreating(true)}>+ New Event</button>
      </div>

      {loading ? (
        <div className="loading-state"><div className="loading-spinner" /></div>
      ) : events.length === 0 ? (
        <div className="aev-empty">No events yet. Create your first one.</div>
      ) : (
        <div className="aev-event-list">
          {events.map(ev => {
            const now = Date.now();
            const beforeStart = ev.start_date && now < new Date(ev.start_date).getTime();
            const afterEnd    = ev.deadline   && now > new Date(ev.deadline).getTime();
            const windowLabel = (() => {
              if (beforeStart) return `Opens ${fmtDate(ev.start_date)}`;
              if (afterEnd)    return `Closed ${fmtDate(ev.deadline)}`;
              if (ev.start_date && ev.deadline) return `${fmtDate(ev.start_date)} → ${fmtDate(ev.deadline)}`;
              if (ev.deadline)   return `Closes ${fmtDate(ev.deadline)}`;
              if (ev.start_date) return `Opens ${fmtDate(ev.start_date)}`;
              return "No dates set";
            })();
            return (
              <div key={ev.id} className="aev-event-row">
                <div className="aev-event-accent" style={{ background: ev.accent_color }} />
                <div className="aev-event-info">
                  <span className={`aev-status aev-status--${ev.status}`}>{ev.status}</span>
                  <h3 className="aev-event-name">{ev.title}</h3>
                  <span className="aev-event-slug">/events/{ev.slug}</span>
                </div>
                <div className="aev-event-deadline">
                  <span className="aev-event-window-label">Submissions</span>
                  <span className={`aev-event-window-val ${beforeStart ? "aev-event-window--soon" : afterEnd ? "aev-event-window--closed" : ""}`}>
                    {windowLabel}
                  </span>
                </div>
                <div className="aev-event-actions">
                  <button className="aev-row-btn" onClick={() => loadSubs(ev)}>Submissions</button>
                  <button className="aev-row-btn" onClick={() => setEditing(ev)}>Edit</button>
                  <button className="aev-row-btn" onClick={() => handleArchive(ev)}>
                    {ev.status === "active" ? "Archive" : "Activate"}
                  </button>
                  <button className="aev-row-btn aev-row-btn--danger" onClick={() => handleDelete(ev)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && <div className={`toast ${toast.type === "error" ? "toast--error" : "toast--success"}`}>{toast.msg}</div>}
    </div>
  );
}
