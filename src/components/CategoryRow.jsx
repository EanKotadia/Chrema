import { useState } from "react";
import { formatDate } from "../utils/dateUtils";

export default function CategoryRow({ articles }) {
  const categories = [...new Set(articles.map((a) => a.category).filter(Boolean))];
  const [active, setActive] = useState(categories[0] || null);

  if (!categories.length) return null;

  const filtered = articles.filter((a) => a.category === active).slice(0, 4);

  return (
    <section className="cat-row-section">
      <div className="cat-row-header">
        <span className="cat-row-label">Chréma Picks</span>
        <div className="cat-row-tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`cat-tab ${active === cat ? "active" : ""}`}
              onClick={() => setActive(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="cat-row-grid">
        {filtered.map((article) => (
          <a key={article.id} href={`/article/${article.id}`} className="cat-card">
            <div className="cat-card-img-wrap">
              {article.image_url ? (
                <img src={article.image_url} alt={article.title} className="cat-card-img" loading="lazy" decoding="async" />
              ) : (
                <div className="cat-card-img-placeholder" />
              )}
            </div>
            <div className="cat-card-body">
              <h4 className="cat-card-title">{article.title}</h4>
              <span className="cat-card-meta">
                {article.author && `By ${article.author}`}
                {article.published_at && ` · ${formatDate(article.published_at)}`}
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
