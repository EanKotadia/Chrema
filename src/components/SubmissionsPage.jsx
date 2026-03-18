import { useEffect, useState } from "react";
import {
  getSubmissions, updateSubmission, createArticle,
  trashSubmission, getTrash, restoreFromTrash, permanentlyDelete
} from "../utils/supabase";
import { formatDate } from "../utils/dateUtils";
import { sendApprovalEmail, sendRejectionEmail } from "../utils/email";
import "./SubmissionsPage.css";

const STATUS_COLORS = { pending: "status--pending", approved: "status--approved" };
const STATUS_LABELS = { pending: "Pending", approved: "Approved" };

const CATEGORIES = [
  "Technology","Science","Design","Research","Culture","Opinion",
  "Literature","History","Business","Global Affairs","Politics",
  "Philosophy","Environment","Health","Sports","Arts",
];

// ── Confirm modal ─────────────────────────────────────────
function ConfirmModal({ item, action, onConfirm, onCancel }) {
  const isApprove = action === "approve";
  const isRestore = action === "restore";
  const isPerm    = action === "permanent";

  const icon     = isApprove ? "✓" : isRestore ? "↩" : "✕";
  const title    = isApprove ? "Publish this article?" : isRestore ? "Restore this submission?" : isPerm ? "Permanently delete?" : "Move to Trash?";
  const btnClass = isApprove ? "modal-btn--approve" : isPerm ? "modal-btn--reject" : "modal-btn--neutral";
  const btnLabel = isApprove ? "Yes, Publish" : isRestore ? "Yes, Restore" : isPerm ? "Delete Forever" : "Move to Trash";

  const body = isApprove
    ? <><strong>"{item.title}"</strong> by {item.name} will go live on Chréma immediately.</>
    : isRestore
    ? <><strong>"{item.title}"</strong> will be moved back to Pending submissions.</>
    : isPerm
    ? <><strong>"{item.title}"</strong> will be permanently deleted. This cannot be undone.</>
    : <><strong>"{item.title}"</strong> by {item.name} will be moved to Trash. You can restore it later.</>;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className={`modal-icon ${isApprove ? "modal-icon--approve" : isPerm ? "modal-icon--reject" : "modal-icon--neutral"}`}>{icon}</div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-body">{body}</p>
        <div className="modal-actions">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className={`modal-btn ${btnClass}`} onClick={onConfirm}>{btnLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────
function Drawer({ item, onClose, onApprove, onReject, onRestore, onPermanentDelete, onSave, isTrash, loading }) {
  const [mode, setMode]       = useState("read"); // "read" | "edit"
  const [editForm, setEditForm] = useState({
    title:    item.title    || "",
    name:     item.name     || "",
    excerpt:  item.excerpt  || "",
    body:     item.body     || "",
    category: item.category || "",
    bio:      item.bio      || "",
  });
  const [saving, setSaving] = useState(false);

  const setF = k => e => setEditForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(item.id, editForm);
    setSaving(false);
    setMode("read");
  };

  const dateLabel  = isTrash ? "Trashed" : "Submitted";
  const dateVal    = isTrash ? item.trashed_at : item.submitted_at;

  // Use edited values for display in read mode after save
  const display = mode === "read" ? { ...item, ...editForm } : item;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-meta">
            {isTrash
              ? <span className="sub-status status--rejected">Trashed</span>
              : <span className={`sub-status ${STATUS_COLORS[item.status] || ""}`}>{STATUS_LABELS[item.status] || item.status}</span>
            }
            {editForm.category && <span className="drawer-category">{editForm.category}</span>}
          </div>
          <div className="drawer-header-right">
            {!isTrash && (
              <button
                className={`drawer-edit-toggle ${mode === "edit" ? "active" : ""}`}
                onClick={() => setMode(m => m === "edit" ? "read" : "edit")}
                title="Edit submission"
              >
                {mode === "edit" ? "← Back" : "✎ Edit"}
              </button>
            )}
            <button className="drawer-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Read mode ── */}
        {mode === "read" && (
          <>
            <div className="drawer-body">
              <h2 className="drawer-title">{display.title}</h2>
              <div className="drawer-author-row">
                <div className="drawer-avatar">{display.name?.[0]?.toUpperCase() || "?"}</div>
                <div>
                  <div className="drawer-author-name">{display.name}</div>
                  <a href={`mailto:${item.email}`} className="drawer-author-email">{item.email}</a>
                </div>
                <div className="drawer-submitted">{dateLabel} {formatDate(dateVal)}</div>
              </div>
              {display.bio && (
                <div className="drawer-bio">
                  <span className="drawer-section-label">Author Bio</span>
                  <p>{display.bio}</p>
                </div>
              )}
              {display.excerpt && (
                <div className="drawer-excerpt">
                  <span className="drawer-section-label">Summary</span>
                  <p>{display.excerpt}</p>
                </div>
              )}
              <div className="drawer-rule" />
              <div className="drawer-article-body">
                {(display.body || "").split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>

            <div className="drawer-footer">
              {isTrash ? (
                <>
                  <button className="action-btn action-btn--reject" onClick={() => onPermanentDelete(item)} disabled={loading}>✕ Delete Forever</button>
                  <button className="action-btn action-btn--restore" onClick={() => onRestore(item)} disabled={loading}>↩ Restore</button>
                </>
              ) : item.status === "pending" ? (
                <>
                  <button className="action-btn action-btn--reject" onClick={() => onReject(item)} disabled={loading}>🗑 Move to Trash</button>
                  <button className="action-btn action-btn--approve" onClick={() => onApprove({ ...item, ...editForm })} disabled={loading}>✓ Publish Article</button>
                </>
              ) : null}
            </div>
          </>
        )}

        {/* ── Edit mode ── */}
        {mode === "edit" && (
          <div className="drawer-edit-body">
            <div className="drawer-edit-hint">
              Changes are saved to the submission. When you publish, the edited version goes live.
            </div>

            <div className="de-field">
              <label className="de-label">Title</label>
              <input className="de-input" value={editForm.title} onChange={setF("title")} />
            </div>

            <div className="de-field">
              <label className="de-label">Author Name</label>
              <input className="de-input" value={editForm.name} onChange={setF("name")} />
            </div>

            <div className="de-field">
              <label className="de-label">
                Category <span className="de-required">*</span>
                {!editForm.category && <span className="de-missing"> — required before publishing</span>}
              </label>
              <div className="de-cat-grid">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat} type="button"
                    className={`de-cat-pill ${editForm.category === cat ? "active" : ""}`}
                    onClick={() => setEditForm(p => ({ ...p, category: p.category === cat ? "" : cat }))}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="de-field">
              <label className="de-label">
                Excerpt / Summary
                <span className="de-hint">{editForm.excerpt.length}/160</span>
              </label>
              <textarea className="de-input de-textarea" rows={3} value={editForm.excerpt} onChange={setF("excerpt")}
                placeholder="Short summary shown in article cards…" />
            </div>

            <div className="de-field">
              <label className="de-label">
                Article Body
                <span className="de-hint">{editForm.body.trim().split(/\s+/).filter(Boolean).length} words</span>
              </label>
              <textarea className="de-input de-textarea de-textarea--tall" rows={16} value={editForm.body} onChange={setF("body")} />
            </div>

            <div className="de-field">
              <label className="de-label">Author Bio <span className="de-optional">(optional)</span></label>
              <textarea className="de-input de-textarea" rows={3} value={editForm.bio} onChange={setF("bio")}
                placeholder="Short bio about the author…" />
            </div>

            <div className="drawer-footer drawer-footer--edit">
              <button className="action-btn action-btn--cancel" onClick={() => setMode("read")}>Cancel</button>
              <button className="action-btn action-btn--save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function SubmissionsPage({ embedded }) {
  const [submissions, setSubmissions]   = useState([]);
  const [trashItems, setTrashItems]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState("pending");
  const [selected, setSelected]         = useState(null);
  const [confirm, setConfirm]           = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]               = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [subs, trash] = await Promise.all([getSubmissions(), getTrash()]);
      setSubmissions(Array.isArray(subs) ? subs : []);
      setTrashItems(Array.isArray(trash) ? trash : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // Save edits to submission
  const handleSaveEdit = async (id, fields) => {
    try {
      await updateSubmission(id, fields);
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, ...fields } : s));
      // Update selected so drawer reflects new values
      setSelected(prev => prev?.id === id ? { ...prev, ...fields } : prev);
      showToast("Submission updated.", "success");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleConfirm = async () => {
    const { item, action } = confirm;
    setConfirm(null);
    setActionLoading(true);
    try {
      if (action === "approve") {
        // Use latest submission data (may have been edited)
        const latest = submissions.find(s => s.id === item.id) || item;
        if (!latest.category) {
          showToast("Please set a category before publishing.", "error");
          setActionLoading(false);
          return;
        }
        const created = await createArticle({
          title:        latest.title,
          category:     latest.category,
          excerpt:      latest.excerpt,
          body:         latest.body,
          author:       latest.name,
          published_at: new Date().toISOString(),
        });
        await updateSubmission(latest.id, { status: "approved" });
        setSubmissions(prev => prev.map(s => s.id === latest.id ? { ...s, status: "approved" } : s));
        showToast(`"${latest.title}" is now live on Chréma.`, "success");
        const articleId = Array.isArray(created) ? created[0]?.id : created?.id;
        sendApprovalEmail({ name: latest.name, email: latest.email, title: latest.title, articleId: articleId || "" })
          .catch(e => console.warn("Approval email failed:", e));

      } else if (action === "reject") {
        await trashSubmission(item);
        setSubmissions(prev => prev.filter(s => s.id !== item.id));
        const trashed = await getTrash();
        setTrashItems(Array.isArray(trashed) ? trashed : []);
        showToast("Moved to Trash.", "error");
        sendRejectionEmail({ name: item.name, email: item.email, title: item.title })
          .catch(e => console.warn("Rejection email failed:", e));

      } else if (action === "restore") {
        await restoreFromTrash(item);
        setTrashItems(prev => prev.filter(t => t.id !== item.id));
        const subs = await getSubmissions();
        setSubmissions(Array.isArray(subs) ? subs : []);
        showToast(`"${item.title}" restored to Pending.`, "success");

      } else if (action === "permanent") {
        await permanentlyDelete(item.id);
        setTrashItems(prev => prev.filter(t => t.id !== item.id));
        showToast("Permanently deleted.", "error");
      }
      setSelected(null);
    } catch (err) { showToast(err.message, "error"); }
    finally { setActionLoading(false); }
  };

  const isTrashView   = filter === "trash";
  const displayItems  = isTrashView ? trashItems : submissions.filter(s => filter === "all" ? true : s.status === filter);
  const counts = {
    pending:  submissions.filter(s => s.status === "pending").length,
    approved: submissions.filter(s => s.status === "approved").length,
    trash:    trashItems.length,
  };

  return (
    <div className="subs-page">
      {!embedded && (
        <header className="subs-nav">
          <a href="/public" className="subs-nav-logo">CHREMA</a>
          <div className="subs-nav-links">
            <a href="/admin" className="subs-nav-link">+ New Article</a>
          </div>
        </header>
      )}

      <div className="subs-inner">
        <div className="subs-header">
          <div>
            <span className="subs-eyebrow">Admin</span>
            <h1 className="subs-title">Submissions</h1>
          </div>
          <div className="subs-stats">
            <div className="stat"><span className="stat-num stat-num--pending">{counts.pending}</span><span className="stat-label">Pending</span></div>
            <div className="stat"><span className="stat-num stat-num--approved">{counts.approved}</span><span className="stat-label">Approved</span></div>
            <div className="stat"><span className="stat-num stat-num--rejected">{counts.trash}</span><span className="stat-label">Trash</span></div>
          </div>
        </div>

        <div className="subs-tabs">
          {[
            { key: "pending",  label: "Pending",  count: counts.pending },
            { key: "approved", label: "Approved", count: counts.approved },
            { key: "all",      label: "All",      count: null },
            { key: "trash",    label: "🗑 Trash",  count: counts.trash },
          ].map(({ key, label, count }) => (
            <button key={key}
              className={`subs-tab ${filter === key ? "active" : ""} ${key === "trash" ? "subs-tab--trash" : ""}`}
              onClick={() => setFilter(key)}>
              {label}
              {count !== null && <span className="tab-count">{count}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-state"><div className="loading-spinner" /><span>Loading…</span></div>
        ) : displayItems.length === 0 ? (
          <div className="subs-empty">
            {isTrashView
              ? <><div className="trash-empty-icon">🗑</div><p>Trash is empty.</p></>
              : <p>No {filter === "all" ? "" : filter} submissions yet.</p>}
          </div>
        ) : (
          <div className="subs-list">
            {displayItems.map(item => (
              <div key={item.id} className={`sub-row ${isTrashView ? "sub-row--trash" : ""}`} onClick={() => setSelected(item)}>
                <div className="sub-row-left">
                  <div className="sub-avatar">{item.name?.[0]?.toUpperCase() || "?"}</div>
                  <div className="sub-info">
                    <h3 className="sub-title">{item.title}</h3>
                    <div className="sub-meta">
                      <span>{item.name}</span>
                      <span className="sub-dot">·</span>
                      <span>{item.email}</span>
                      {item.category
                        ? <><span className="sub-dot">·</span><span className="sub-cat-tag">{item.category}</span></>
                        : <><span className="sub-dot">·</span><span className="sub-cat-missing">No category</span></>
                      }
                      <span className="sub-dot">·</span>
                      <span>{formatDate(isTrashView ? item.trashed_at : item.submitted_at)}</span>
                    </div>
                    {item.excerpt && <p className="sub-excerpt">{item.excerpt}</p>}
                  </div>
                </div>
                <div className="sub-row-right" onClick={e => e.stopPropagation()}>
                  {isTrashView ? (
                    <span className="sub-status status--rejected">Trashed</span>
                  ) : (
                    <span className={`sub-status ${STATUS_COLORS[item.status] || ""}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  )}
                  {!isTrashView && item.status === "pending" && (
                    <div className="sub-actions">
                      <button className="quick-btn quick-btn--reject" onClick={() => setConfirm({ item, action: "reject" })} title="Move to Trash">🗑</button>
                      <button className="quick-btn quick-btn--approve" onClick={() => setConfirm({ item, action: "approve" })} title="Approve & Publish">✓</button>
                    </div>
                  )}
                  {isTrashView && (
                    <div className="sub-actions">
                      <button className="quick-btn quick-btn--reject" onClick={() => setConfirm({ item, action: "permanent" })} title="Delete Forever">✕</button>
                      <button className="quick-btn quick-btn--approve" onClick={() => setConfirm({ item, action: "restore" })} title="Restore">↩</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <Drawer
          item={selected}
          isTrash={isTrashView}
          onClose={() => setSelected(null)}
          onApprove={i => setConfirm({ item: i, action: "approve" })}
          onReject={i  => setConfirm({ item: i, action: "reject" })}
          onRestore={i => setConfirm({ item: i, action: "restore" })}
          onPermanentDelete={i => setConfirm({ item: i, action: "permanent" })}
          onSave={handleSaveEdit}
          loading={actionLoading}
        />
      )}

      {confirm && <ConfirmModal item={confirm.item} action={confirm.action} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
      {toast && <div className={`toast ${toast.type === "error" ? "toast--error" : "toast--success"}`}>{toast.msg}</div>}
    </div>
  );
}
