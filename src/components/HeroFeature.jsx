import { formatDate } from "../utils/dateUtils";

export default function HeroFeature({ article, secondary }) {
  if (!article) return null;

  return (
    <section className="hero-section">
      <div className="hero-grid">
        {/* Main hero */}
        <a href={`/article/${article.id}`} className="hero-main">
          <div className="hero-image-wrap">
            {article.image_url ? (
              <img src={article.image_url} alt={article.title} className="hero-img" />
            ) : (
              <div className="hero-img-placeholder" />
            )}
            <div className="hero-gradient" />
          </div>
          <div className="hero-meta">
            {article.category && (
              <span className="hero-category">{article.category}</span>
            )}
            <h1 className="hero-title">{article.title}</h1>
            {article.excerpt && (
              <p className="hero-excerpt">{article.excerpt}</p>
            )}
            <div className="hero-byline">
              {article.author && <span>By {article.author}</span>}
              {article.published_at && (
                <span>{formatDate(article.published_at)}</span>
              )}
            </div>
          </div>
        </a>

        {/* Secondary stack — text only, no images */}
        {secondary.length > 0 && (
          <div className="hero-secondary">
            {secondary.map((art, i) => (
              <a key={art.id} href={`/article/${art.id}`} className="secondary-card">
                <div className="secondary-index">{String(i + 1).padStart(2, "0")}</div>
                <div className="secondary-info">
                  {art.category && (
                    <span className="secondary-category">{art.category}</span>
                  )}
                  <h3 className="secondary-title">{art.title}</h3>
                  <span className="secondary-author">By {art.author}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
