import { createArticle } from "../utils/supabase";
import ArticleEditor from "./ArticleEditor";
import "./AdminPage.css";

export default function AdminPage({ embedded }) {
  const handleSave = async (formData) => {
    await createArticle(formData);
  };

  return (
    <div className="admin-page-wrap" style={{ height: embedded ? "calc(100vh - 56px)" : "100vh", display: "flex", flexDirection: "column" }}>
      {!embedded && (
        <div style={{ padding: "12px 28px", borderBottom: "1px solid var(--border)" }}>
          <a href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--text-dim)" }}>
            ← Back to Chréma
          </a>
        </div>
      )}
      <ArticleEditor
        mode="create"
        saveLabel="Publish Article"
        onSave={handleSave}
      />
    </div>
  );
}
