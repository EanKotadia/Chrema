import { useState, useRef, useCallback, useEffect } from "react";
import { uploadImage } from "../utils/supabase";
import "./ArticleEditor.css";

const CATEGORIES = [
  "Technology","Science","Design","Research","Culture","Opinion",
  "Literature","History","Business","Global Affairs","Politics",
  "Philosophy","Environment","Health","Sports","Arts",
];

// ── Toolbar config ────────────────────────────────────────
const TOOLBAR = [
  { group: "text", items: [
    { id:"b",      keys:"Ctrl+B",  icon:"B",     title:"Bold",       style:{fontWeight:800} },
    { id:"i",      keys:"Ctrl+I",  icon:"I",     title:"Italic",     style:{fontStyle:"italic"} },
    { id:"u",      keys:"Ctrl+U",  icon:"U",     title:"Underline",  style:{textDecoration:"underline"} },
    { id:"s",      keys:"",        icon:"S̶",     title:"Strikethrough" },
  ]},
  { group: "headings", items: [
    { id:"h2", icon:"H2", title:"Heading 2" },
    { id:"h3", icon:"H3", title:"Heading 3" },
    { id:"h4", icon:"H4", title:"Heading 4" },
  ]},
  { group: "blocks", items: [
    { id:"blockquote", icon:"❝",  title:"Pull quote" },
    { id:"ul",         icon:"≡",  title:"Bullet list" },
    { id:"ol",         icon:"1.", title:"Numbered list" },
    { id:"code",       icon:"<>", title:"Inline code",  style:{fontFamily:"monospace"} },
    { id:"pre",        icon:"{ }", title:"Code block" },
    { id:"hr",         icon:"—",  title:"Divider / section break" },
  ]},
  { group: "inline", items: [
    { id:"link",   icon:"↗",  title:"Hyperlink" },
    { id:"img",    icon:"⬚",  title:"Inline image URL" },
  ]},
];

function wrap(tag, sel, extras = "") {
  if (!sel) {
    const placeholders = {
      b:"bold text", i:"italic text", u:"underlined", s:"strikethrough",
      h2:"Heading", h3:"Subheading", h4:"Sub-subheading",
      blockquote:"Pull quote here",
      ul:"<li>First item</li>\n  <li>Second item</li>",
      ol:"<li>First item</li>\n  <li>Second item</li>",
      code:"code", pre:"// code block",
    };
    sel = placeholders[tag] || "text";
  }
  if (tag === "ul" || tag === "ol") return `\n\n<${tag}>\n  ${sel}\n</${tag}>\n\n`;
  if (tag === "pre") return `\n\n<pre><code>${sel}</code></pre>\n\n`;
  if (tag === "h2" || tag === "h3" || tag === "h4" || tag === "blockquote")
    return `\n\n<${tag}>${sel}</${tag}>\n\n`;
  if (tag === "hr") return `\n\n<hr />\n\n`;
  return `<${tag}${extras}>${sel}</${tag}>`;
}

// ── Rich text toolbar ─────────────────────────────────────
function Toolbar({ editorRef, value, onChange }) {
  const exec = useCallback((id) => {
    const ta = editorRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const sel    = value.slice(start, end);
    const before = value.slice(0, start);
    const after  = value.slice(end);

    let replacement = "";
    if (id === "link") {
      const url = prompt("Enter URL:", "https://");
      if (!url) return;
      replacement = `<a href="${url}">${sel || url}</a>`;
    } else if (id === "img") {
      const url = prompt("Image URL:", "https://");
      if (!url) return;
      replacement = `\n\n<img src="${url}" alt="${sel || "image"}" />\n\n`;
    } else if (id === "hr") {
      replacement = `\n\n<hr />\n\n`;
    } else if (id === "s") {
      replacement = `<s>${sel || "strikethrough"}</s>`;
    } else if (id === "u") {
      replacement = wrap("u", sel);
    } else {
      replacement = wrap(id, sel);
    }

    const newVal = before + replacement + after;
    onChange(newVal);
    const cursor = start + replacement.length;
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = cursor;
    }, 0);
  }, [editorRef, value, onChange]);

  useEffect(() => {
    const ta = editorRef.current;
    if (!ta) return;
    const handler = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const map = { b:"b", i:"i", u:"u", k:"link" };
      if (map[e.key]) { e.preventDefault(); exec(map[e.key]); }
    };
    ta.addEventListener("keydown", handler);
    return () => ta.removeEventListener("keydown", handler);
  }, [editorRef, exec]);

  return (
    <div className="ae-toolbar">
      {TOOLBAR.map((group, gi) => (
        <div key={gi} className="ae-toolbar-group">
          {group.items.map(btn => (
            <button
              key={btn.id}
              type="button"
              className="ae-toolbar-btn"
              title={`${btn.title}${btn.keys ? ` (${btn.keys})` : ""}`}
              onMouseDown={e => { e.preventDefault(); exec(btn.id); }}
              style={btn.style || {}}
            >
              {btn.icon}
            </button>
          ))}
        </div>
      ))}
      <div className="ae-toolbar-hint">Select text, then apply</div>
    </div>
  );
}

// ── Image drop zone ───────────────────────────────────────
function ImageZone({ value, onChange, onError }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) { onError("Please upload an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { onError("Max 10MB."); return; }
    setUploading(true); onError("");
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) { onError(err.message); }
    finally { setUploading(false); }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`ae-image-zone ${dragOver ? "dragover" : ""} ${value ? "has-image" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !value && fileRef.current?.click()}
    >
      {value ? (
        <div className="ae-image-preview-wrap">
          <img src={value} alt="Cover" className="ae-image-preview" />
          <div className="ae-image-actions">
            <button type="button" className="ae-img-btn" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
              Change
            </button>
            <button type="button" className="ae-img-btn ae-img-btn--remove" onClick={e => { e.stopPropagation(); onChange(""); }}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="ae-image-placeholder">
          {uploading
            ? <><div className="ae-upload-spinner"/><span>Uploading…</span></>
            : <>
                <span className="ae-image-icon">↑</span>
                <span className="ae-image-label">Drop image or click to upload</span>
                <span className="ae-image-hint">JPG, PNG, WebP · Max 10MB · Recommended 1600×900</span>
              </>
          }
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
        onChange={e => handleFile(e.target.files[0])} />
    </div>
  );
}

// ── Reading time ──────────────────────────────────────────
function readTime(body) {
  const words = body.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return { words, mins: Math.max(1, Math.round(words / 200)) };
}

// ── Tags input — pill UI ──────────────────────────────────
// Stores as comma-separated string internally, displays as pills.
function TagsInput({ value, onChange }) {
  const [input, setInput] = useState("");

  // Parse current tags from the comma string
  const tags = value
    ? value.split(",").map(t => t.trim()).filter(Boolean)
    : [];

  const addTag = (raw) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || tags.includes(tag)) { setInput(""); return; }
    onChange([...tags, tag].join(", "));
    setInput("");
  };

  const removeTag = (tag) => {
    onChange(tags.filter(t => t !== tag).join(", "));
  };

  const handleKeyDown = (e) => {
    if (["Enter", ",", "Tab"].includes(e.key)) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className="ae-tags-wrap">
      {tags.map(tag => (
        <span key={tag} className="ae-tag-pill">
          {tag}
          <button type="button" className="ae-tag-remove" onClick={() => removeTag(tag)}>×</button>
        </span>
      ))}
      <input
        className="ae-tags-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input && addTag(input)}
        placeholder={tags.length === 0 ? "Add tags… (press Enter or comma)" : ""}
      />
    </div>
  );
}

// ── Live HTML preview ─────────────────────────────────────
function Preview({ form }) {
  const { words, mins } = readTime(form.body);
  const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
  return (
    <div className="ae-preview">
      <div className="ae-preview-meta">
        {form.category && <span className="ae-preview-cat">{form.category}</span>}
        <span className="ae-preview-read">{mins} min read · {words.toLocaleString()} words</span>
      </div>
      {form.image_url && (
        <img src={form.image_url} alt={form.title} className="ae-preview-cover" />
      )}
      <h1 className="ae-preview-title">{form.title || "Untitled"}</h1>
      {form.excerpt && <p className="ae-preview-excerpt">{form.excerpt}</p>}
      {form.author && <p className="ae-preview-author">By {form.author}</p>}
      {tags.length > 0 && (
        <div className="ae-preview-tags">
          {tags.map(t => <span key={t} className="ae-preview-tag">{t}</span>)}
        </div>
      )}
      <div className="ae-preview-body"
        dangerouslySetInnerHTML={{ __html: form.body || "<p style='color:var(--text-dim);font-style:italic'>Body will appear here…</p>" }}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────
// Convert comma string → clean array for Supabase text[] column.
// Returns null if empty so the column stores NULL rather than {}.
function tagsToArray(str) {
  if (!str) return null;
  const arr = str.split(",").map(t => t.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
  return arr.length ? arr : null;
}

// Convert text[] from Supabase → comma string for the input.
function arrayToTags(arr) {
  if (!arr || !Array.isArray(arr)) return "";
  return arr.join(", ");
}

// ── Main editor ───────────────────────────────────────────
export default function ArticleEditor({
  initial = {},
  onSave,
  onDelete,
  saveLabel = "Publish Article",
  mode = "create",
}) {
  const EMPTY = {
    title: "", excerpt: "", body: "", author: "",
    category: "", published_at: new Date().toISOString().slice(0, 16),
    image_url: "", tags: "",
  };

  // Normalise initial: convert tags array → string for the form
  const normalised = {
    ...EMPTY,
    ...initial,
    tags: arrayToTags(initial.tags),
  };

  const [form, setForm]         = useState(normalised);
  const [imgError, setImgError] = useState("");
  const [saving, setSaving]     = useState(false);
  const [status, setStatus]     = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [tab, setTab]           = useState("write");
  const bodyRef = useRef(null);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setBody = useCallback(v => setForm(p => ({ ...p, body: v })), []);

  const { words, mins } = readTime(form.body);
  const excerptLen = form.excerpt.length;

  const handleSave = async () => {
    if (!form.title.trim()) { setStatus("error"); setStatusMsg("Title is required."); return; }
    setSaving(true); setStatus(null);
    try {
      await onSave({
        ...form,
        image_url:    form.image_url    || null,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
        author:       form.author       || null,
        category:     form.category     || null,
        excerpt:      form.excerpt      || null,
        tags:         tagsToArray(form.tags), // ← converts "india, economy" → ["india","economy"] or null
      });
      setStatus("success");
      setStatusMsg(mode === "create" ? "Article published!" : "Changes saved.");
      if (mode === "create") { setForm(EMPTY); setImgError(""); }
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setStatus("error"); setStatusMsg(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`ae-root ${showPreview ? "ae-root--preview" : ""}`}>

      {/* Top bar */}
      <div className="ae-topbar">
        <div className="ae-topbar-left">
          <span className="ae-mode-badge">{mode === "edit" ? "Editing" : "New Article"}</span>
          {form.title && <span className="ae-topbar-title">{form.title}</span>}
        </div>
        <div className="ae-topbar-right">
          <span className="ae-wc">{words.toLocaleString()} words · {mins} min read</span>
          <button className={`ae-preview-toggle ${showPreview ? "active" : ""}`} onClick={() => setShowPreview(p => !p)}>
            {showPreview ? "Hide Preview" : "Preview"}
          </button>
          {mode === "edit" && onDelete && (
            deleteConfirm
              ? <div className="ae-delete-confirm">
                  <span>Delete?</span>
                  <button className="ae-btn ae-btn--danger" onClick={onDelete}>Yes</button>
                  <button className="ae-btn ae-btn--ghost" onClick={() => setDeleteConfirm(false)}>No</button>
                </div>
              : <button className="ae-btn ae-btn--ghost ae-btn--del" onClick={() => setDeleteConfirm(true)}>Delete</button>
          )}
          <button className="ae-btn ae-btn--save" onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? "Saving…" : saveLabel}
          </button>
        </div>
      </div>

      {/* Status bar */}
      {status && (
        <div className={`ae-status ae-status--${status}`}>
          {status === "success" ? "✓" : "✕"} {statusMsg}
        </div>
      )}

      <div className="ae-body">

        {/* Editor pane */}
        <div className="ae-editor-pane">

          {/* Tabs */}
          <div className="ae-tabs">
            {[
              { key:"write",  label:"Write" },
              { key:"meta",   label:"Metadata" },
              { key:"cover",  label:"Cover Image" },
            ].map(({ key, label }) => (
              <button key={key} className={`ae-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                {label}
                {key === "meta" && (!form.author || !form.category) && (
                  <span className="ae-tab-dot" title="Incomplete" />
                )}
              </button>
            ))}
          </div>

          {/* ── Write tab ── */}
          {tab === "write" && (
            <div className="ae-write-pane">
              <div className="ae-title-wrap">
                <textarea
                  className="ae-title-input"
                  placeholder="Article title…"
                  value={form.title}
                  onChange={set("title")}
                  rows={2}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); bodyRef.current?.focus(); } }}
                />
                <div className="ae-title-meta">
                  {form.title.length > 0 && (
                    <span className={`ae-title-len ${form.title.length > 80 ? "warn" : ""}`}>
                      {form.title.length}/80 chars
                    </span>
                  )}
                </div>
              </div>

              <div className="ae-excerpt-wrap">
                <textarea
                  className="ae-excerpt-input"
                  placeholder="Short summary shown in cards and search results (recommended: 120–160 chars)…"
                  value={form.excerpt}
                  onChange={set("excerpt")}
                  rows={2}
                />
                <span className={`ae-excerpt-len ${excerptLen > 160 ? "warn" : excerptLen > 0 ? "ok" : ""}`}>
                  {excerptLen}/160
                </span>
              </div>

              <div className="ae-body-editor">
                <Toolbar editorRef={bodyRef} value={form.body} onChange={setBody} />
                <textarea
                  ref={bodyRef}
                  className="ae-body-input"
                  placeholder={"Start writing…\n\nUse double line breaks for new paragraphs. Use the toolbar above to insert headings, quotes, lists, and links. HTML tags are supported and rendered on the article page."}
                  value={form.body}
                  onChange={e => setBody(e.target.value)}
                  spellCheck
                />
              </div>
            </div>
          )}

          {/* ── Meta tab ── */}
          {tab === "meta" && (
            <div className="ae-meta-pane">

              <div className="ae-meta-row">
                <div className="ae-field">
                  <label className="ae-label">Author <span className="ae-required">*</span></label>
                  <input className="ae-input" value={form.author} onChange={set("author")} placeholder="Full name" />
                </div>
                <div className="ae-field">
                  <label className="ae-label">Publish Date</label>
                  <input className="ae-input" type="datetime-local" value={form.published_at} onChange={set("published_at")} />
                </div>
              </div>

              <div className="ae-field">
                <label className="ae-label">Category <span className="ae-required">*</span></label>
                <div className="ae-cat-grid">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat} type="button"
                      className={`ae-cat-pill ${form.category === cat ? "active" : ""}`}
                      onClick={() => setForm(p => ({ ...p, category: p.category === cat ? "" : cat }))}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ae-field">
                <label className="ae-label">
                  Tags
                  <span className="ae-label-hint">optional — press Enter or comma to add</span>
                </label>
                <TagsInput
                  value={form.tags}
                  onChange={v => setForm(p => ({ ...p, tags: v }))}
                />
              </div>

              <div className="ae-meta-preview-card">
                <span className="ae-label">Search / Card Preview</span>
                <div className="ae-seo-card">
                  {form.category && <span className="ae-seo-cat">{form.category}</span>}
                  <p className="ae-seo-title">{form.title || "Untitled article"}</p>
                  <p className="ae-seo-desc">{form.excerpt || "No excerpt — add one in the Write tab."}</p>
                  {form.author && <p className="ae-seo-author">By {form.author}</p>}
                </div>
              </div>

            </div>
          )}

          {/* ── Cover tab ── */}
          {tab === "cover" && (
            <div className="ae-cover-pane">
              <div className="ae-field">
                <label className="ae-label">Cover Image</label>
                <ImageZone
                  value={form.image_url}
                  onChange={v => setForm(p => ({ ...p, image_url: v }))}
                  onError={setImgError}
                />
                {imgError && <span className="ae-img-error">{imgError}</span>}
              </div>
              <div className="ae-field">
                <label className="ae-label">Or paste image URL directly</label>
                <input className="ae-input" value={form.image_url} onChange={set("image_url")} placeholder="https://…" />
              </div>
              <p className="ae-cover-hint">Recommended: 1600×900px, JPG or WebP, under 1MB for fast loading.</p>
            </div>
          )}

        </div>

        {/* Preview pane */}
        {showPreview && (
          <div className="ae-preview-pane">
            <div className="ae-preview-header">
              <span>Live Preview</span>
              <button className="ae-preview-close" onClick={() => setShowPreview(false)}>✕</button>
            </div>
            <Preview form={form} />
          </div>
        )}

      </div>
    </div>
  );
}
