import { useEffect, useState } from "react";
import { getArticles, deleteArticle, updateArticle } from "../utils/supabase";
import ArticleEditor from "./ArticleEditor";
import { formatDate } from "../utils/dateUtils";
import "./ArticlesManager.css";

function EditDrawer({ article, onClose, onSave, onDelete }) {
  const handleSave = async (formData) => {
    await onSave(article.id, {
      title:        formData.title,
      author:       formData.author,
      category:     formData.category,
      excerpt:      formData.excerpt,
      body:         formData.body,
      image_url:    formData.image_url,
      published_at: formData.published_at,
    });
    onClose();
  };

  const initial = {
    title:        article.title        || "",
    author:       article.author       || "",
    category:     article.category     || "",
    excerpt:      article.excerpt      || "",
    body:         article.body         || "",
    image_url:    article.image_url    || "",
    published_at: article.published_at ? article.published_at.slice(0, 16) : "",
  };

  return (
    <div className="edit-backdrop" onClick={onClose}>
      <div className="edit-drawer edit-drawer--full" onClick={e => e.stopPropagation()}>
        <ArticleEditor
          mode="edit"
          initial={initial}
          saveLabel="Save Changes"
          onSave={handleSave}
          onDelete={() => onDelete(article)}
        />
      </div>
    </div>
  );
}

export default function ArticlesManager() {
  const [articles, setArticles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [deleting, setDeleting]   = useState(null);
  const [editing, setEditing]     = useState(null);
  const [toast, setToast]         = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getArticles();
      setArticles(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    const article = deleting;
    setDeleting(null);
    try {
      await deleteArticle(article.id);
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
      showToast(`"${article.title}" deleted.`, "error");
    } catch (err) { showToast(err.message, "error"); }
  };

  const handleSave = async (id, updates) => {
    try {
      await updateArticle(id, updates);
      setArticles((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
      setEditing(null);
      showToast("Article saved.", "success");
    } catch (err) {
      showToast(err.message, "error");
      throw err;
    }
  };

  const filtered = articles.filter((a) =>
    !search ||
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.author?.toLowerCase().includes(search.toLowerCase()) ||
    a.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="am-page">
      <div className="am-inner">
        <div className="am-header">
          <div>
            <span className="am-eyebrow">Admin</span>
            <h1 className="am-title">Articles</h1>
          </div>
          <span className="am-count">{articles.length} published</span>
        </div>

        <div className="am-search-wrap">
          <span className="am-search-icon">⌕</span>
          <input className="am-search" type="text"
            placeholder="Search by title, author, or category…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button className="am-search-clear" onClick={() => setSearch("")}>✕</button>}
        </div>

        {loading ? (
          <div className="loading-state"><div className="loading-spinner" /><span>Loading articles…</span></div>
        ) : filtered.length === 0 ? (
          <div className="am-empty">
            {search ? <p>No articles match "{search}".</p> : <p>No articles published yet.</p>}
          </div>
        ) : (
          <div className="am-list">
            <div className="am-list-header">
              <span>Title</span>
              <span>Author</span>
              <span>Category</span>
              <span>Published</span>
              <span>Actions</span>
            </div>
            {filtered.map((article) => (
              <div key={article.id} className="am-row">
                <div className="am-row-title">
                  <a href={`/article/${article.id}`} target="_blank" rel="noreferrer" className="am-article-link">
                    {article.title}<span className="am-link-icon">↗</span>
                  </a>
                </div>
                <div className="am-row-author">{article.author || "—"}</div>
                <div className="am-row-category">
                  {article.category
                    ? <span className="am-cat-tag">{article.category}</span>
                    : <span className="am-none">—</span>}
                </div>
                <div className="am-row-date">
                  {article.published_at ? formatDate(article.published_at) : "Draft"}
                </div>
                <div className="am-row-actions">
                  <button className="am-edit-btn" onClick={() => setEditing(article)} title="Edit">✎</button>
                  <button className="am-delete-btn" onClick={() => setDeleting(article)} title="Delete">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditDrawer
          article={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={(article) => { setEditing(null); setDeleting(article); }}
        />
      )}

      {deleting && (
        <div className="modal-backdrop" onClick={() => setDeleting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon modal-icon--reject">✕</div>
            <h3 className="modal-title">Delete this article?</h3>
            <p className="modal-body">
              <strong>"{deleting.title}"</strong> will be permanently removed.
            </p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn--cancel" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="modal-btn modal-btn--reject" onClick={handleDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast--error" : "toast--success"}`}>{toast.msg}</div>
      )}
    </div>
  );
}
