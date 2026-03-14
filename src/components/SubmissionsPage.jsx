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

function ConfirmModal({ item, action, onConfirm, onCancel }) {
  const isApprove = action === "approve";
  const isRestore = action === "restore";
  const isPerm = action === "permanent";

  const icon = isApprove ? "✓" : isRestore ? "↩" : "✕";
  const title = isApprove
    ? "Publish this article?"
    : isRestore
    ? "Restore this submission?"
    : isPerm
    ? "Permanently delete?"
    : "Move to Trash?";

  const body = isApprove
    ? <><strong>"{item.title}"</strong> by {item.name} will go live on Chréma immediately.</>
    : isRestore
    ? <><strong>"{item.title}"</strong> will be moved back to Pending submissions.</>
    : isPerm
    ? <><strong>"{item.title}"</strong> will be permanently deleted. This cannot be undone.</>
    : <><strong>"{item.title}"</strong> by {item.name} will be moved to Trash. You can restore it later.</>;

  const btnClass = isApprove
    ? "modal-btn--approve"
    : isPerm
    ? "modal-btn--reject"
    : "modal-btn--neutral";

  const btnLabel = isApprove
    ? "Yes, Publish"
    : isRestore
    ? "Yes, Restore"
    : isPerm
    ? "Delete Forever"
    : "Move to Trash";

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-icon ${isApprove ? "modal-icon--approve" : isPerm ? "modal-icon--reject" : "modal-icon--neutral"}`}>
          {icon}
        </div>
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

function Drawer({ item, onClose, onApprove, onReject, onRestore, onPermanentDelete, isTrash, loading }) {
  const paragraphs = (item.body || "").split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const dateLabel = isTrash ? "Trashed" : "Submitted";
  const dateVal = isTrash ? item.trashed_at : item.submitted_at;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-meta">
            {isTrash
              ? <span className="sub-status status--rejected">Trashed</span>
              : <span className={`sub-status ${STATUS_COLORS[item.status] || ""}`}>{STATUS_LABELS[item.status] || item.status}</span>
            }
            {item.category && <span className="drawer-category">{item.category}</span>}
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="drawer-body">
          <h2 className="drawer-title">{item.title}</h2>
          <div className="drawer-author-row">
            <div className="drawer-avatar">{item.name?.[0]?.toUpperCase() || "?"}</div>
            <div>
              <div className="drawer-author-name">{item.name}</div>
              <a href={`mailto:${item.email}`} className="drawer-author-email">{item.email}</a>
            </div>
            <div className="drawer-submitted">{dateLabel} {formatDate(dateVal)}</div>
          </div>
          {item.bio && (
            <div className="drawer-bio">
              <span className="drawer-section-label">Author Bio</span>
              <p>{item.bio}</p>
            </div>
          )}
          {item.excerpt && (
            <div className="drawer-excerpt">
              <span className="drawer-section-label">Summary</span>
              <p>{item.excerpt}</p>
            </div>
          )}
          <div className="drawer-rule" />
          <div className="drawer-article-body">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>

        <div className="drawer-footer">
          {isTrash ? (
            <>
              <button className="action-btn action-btn--reject" onClick={() => onPermanentDelete(item)} disabled={loading}>
                ✕ Delete Forever
              </button>
              <button className="action-btn action-btn--restore" onClick={() => onRestore(item)} disabled={loading}>
                ↩ Restore
              </button>
            </>
          ) : item.status === "pending" ? (
            <>
              <button className="action-btn action-btn--reject" onClick={() => onReject(item)} disabled={loading}>
                🗑 Move to Trash
              </button>
              <button className="action-btn action-btn--approve" onClick={() => onApprove(item)} disabled={loading}>
                ✓ Publish Article
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function SubmissionsPage({ embedded }) {
  const [submissions, setSubmissions] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [subs, trash] = await Promise.all([getSubmissions(), getTrash()]);
      setSubmissions(Array.isArray(subs) ? subs : []);
      setTrashItems(Array.isArray(trash) ? trash : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleConfirm = async () => {
    const { item, action } = confirm;
    setConfirm(null);
    setActionLoading(true);
    try {
      if (action === "approve") {
        const created = await createArticle({
          title: item.title,
          category: item.category || null,
          excerpt: item.excerpt || null,
          body: item.body,
          author: item.name,
          published_at: new Date().toISOString(),
        });
        await updateSubmission(item.id, { status: "approved" });
        setSubmissions((prev) => prev.map((s) => s.id === item.id ? { ...s, status: "approved" } : s));
        showToast(`"${item.title}" is now live on Chrema.`, "success");
        // Send congrats email — don't block UI if it fails
        const articleId = Array.isArray(created) ? created[0]?.id : created?.id;
        sendApprovalEmail({
          name: item.name,
          email: item.email,
          title: item.title,
          articleId: articleId || "",
        }).catch((e) => console.warn("Approval email failed:", e));

      } else if (action === "reject") {
        await trashSubmission(item);
        setSubmissions((prev) => prev.filter((s) => s.id !== item.id));
        const trashed = await getTrash();
        setTrashItems(Array.isArray(trashed) ? trashed : []);
        showToast(`Moved to Trash.`, "error");
        // Send rejection email
        sendRejectionEmail({
          name: item.name,
          email: item.email,
          title: item.title,
        }).catch((e) => console.warn("Rejection email failed:", e));

      } else if (action === "restore") {
        await restoreFromTrash(item);
        setTrashItems((prev) => prev.filter((t) => t.id !== item.id));
        const subs = await getSubmissions();
        setSubmissions(Array.isArray(subs) ? subs : []);
        showToast(`"${item.title}" restored to Pending.`, "success");

      } else if (action === "permanent") {
        await permanentlyDelete(item.id);
        setTrashItems((prev) => prev.filter((t) => t.id !== item.id));
        showToast(`Permanently deleted.`, "error");
      }

      setSelected(null);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const isTrashView = filter === "trash";
  const displayItems = isTrashView
    ? trashItems
    : submissions.filter((s) => filter === "all" ? true : s.status === filter);

  const counts = {
    pending: submissions.filter((s) => s.status === "pending").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    trash: trashItems.length,
  };

  const tabs = [
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "approved", label: "Approved", count: counts.approved },
    { key: "all", label: "All", count: null },
    { key: "trash", label: "🗑 Trash", count: counts.trash },
  ];

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
            <div className="stat">
              <span className="stat-num stat-num--pending">{counts.pending}</span>
              <span className="stat-label">Pending</span>
            </div>
            <div className="stat">
              <span className="stat-num stat-num--approved">{counts.approved}</span>
              <span className="stat-label">Approved</span>
            </div>
            <div className="stat">
              <span className="stat-num stat-num--rejected">{counts.trash}</span>
              <span className="stat-label">Trash</span>
            </div>
          </div>
        </div>

        <div className="subs-tabs">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              className={`subs-tab ${filter === key ? "active" : ""} ${key === "trash" ? "subs-tab--trash" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
              {count !== null && <span className="tab-count">{count}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>Loading…</span>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="subs-empty">
            {isTrashView
              ? <><div className="trash-empty-icon">🗑</div><p>Trash is empty.</p></>
              : <p>No {filter === "all" ? "" : filter} submissions yet.</p>
            }
          </div>
        ) : (
          <div className="subs-list">
            {displayItems.map((item) => (
              <div key={item.id} className={`sub-row ${isTrashView ? "sub-row--trash" : ""}`} onClick={() => setSelected(item)}>
                <div className="sub-row-left">
                  <div className="sub-avatar">{item.name?.[0]?.toUpperCase() || "?"}</div>
                  <div className="sub-info">
                    <h3 className="sub-title">{item.title}</h3>
                    <div className="sub-meta">
                      <span>{item.name}</span>
                      <span className="sub-dot">·</span>
                      <span>{item.email}</span>
                      {item.category && <><span className="sub-dot">·</span><span>{item.category}</span></>}
                      <span className="sub-dot">·</span>
                      <span>{formatDate(isTrashView ? item.trashed_at : item.submitted_at)}</span>
                    </div>
                    {item.excerpt && <p className="sub-excerpt">{item.excerpt}</p>}
                  </div>
                </div>

                <div className="sub-row-right" onClick={(e) => e.stopPropagation()}>
                  {isTrashView ? (
                    <span className="sub-status status--rejected">Trashed</span>
                  ) : (
                    <span className={`sub-status ${STATUS_COLORS[item.status] || ""}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  )}
                  {!isTrashView && item.status === "pending" && (
                    <div className="sub-actions">
                      <button
                        className="quick-btn quick-btn--reject"
                        onClick={() => setConfirm({ item, action: "reject" })}
                        title="Move to Trash"
                      >🗑</button>
                      <button
                        className="quick-btn quick-btn--approve"
                        onClick={() => setConfirm({ item, action: "approve" })}
                        title="Approve & Publish"
                      >✓</button>
                    </div>
                  )}
                  {isTrashView && (
                    <div className="sub-actions">
                      <button
                        className="quick-btn quick-btn--reject"
                        onClick={() => setConfirm({ item, action: "permanent" })}
                        title="Delete Forever"
                      >✕</button>
                      <button
                        className="quick-btn quick-btn--approve"
                        onClick={() => setConfirm({ item, action: "restore" })}
                        title="Restore"
                      >↩</button>
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
          onApprove={(i) => setConfirm({ item: i, action: "approve" })}
          onReject={(i) => setConfirm({ item: i, action: "reject" })}
          onRestore={(i) => setConfirm({ item: i, action: "restore" })}
          onPermanentDelete={(i) => setConfirm({ item: i, action: "permanent" })}
          loading={actionLoading}
        />
      )}

      {confirm && (
        <ConfirmModal
          item={confirm.item}
          action={confirm.action}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast--error" : "toast--success"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
