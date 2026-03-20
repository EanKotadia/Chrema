import { useEffect, useRef } from "react";
import { formatDate } from "../utils/dateUtils";
import { trackImpression, trackCardClick } from "../utils/analytics";

function ArticleCard({ article, large }) {
  const ref = useRef(null);

  // fire trackImpression once when card enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        trackImpression(article.id);
        observer.disconnect();
      }
    }, { threshold: 0.5 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [article.id]);

  return (
    <a
      ref={ref}
      href={`/article/${article.id}`}
      className={`article-card ${large ? "article-card--large" : ""}`}
      onClick={() => trackCardClick(article.id)}
    >
      <div className="card-image-wrap">
        {article.image_url ? (
          <img src={article.image_url} alt={article.title} className="card-img" loading="lazy" decoding="async" />
        ) : (
          <div className="card-img-placeholder" />
        )}
      </div>
      <div className="card-body">
        {article.category && (
          <span className="card-category">{article.category}</span>
        )}
        <h3 className="card-title">{article.title}</h3>
        {article.excerpt && large && (
          <p className="card-excerpt">{article.excerpt}</p>
        )}
        <div className="card-meta">
          {article.author && <span className="card-author">By {article.author}</span>}
          {(article.published_at || article.created_at) && (
            <span className="card-date">
              {formatDate(article.published_at || article.created_at)}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

export default function ArticleGrid({ articles }) {
  if (!articles.length) return null;

  return (
    <section className="article-grid-section">
      <div className="section-header">
        <h2 className="section-heading">More Stories</h2>
        <div className="section-line" />
      </div>
      <div className="article-grid">
        {articles.map((article, i) => (
          <ArticleCard key={article.id} article={article} large={i === 0} />
        ))}
      </div>
    </section>
  );
}
