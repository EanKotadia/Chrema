import { trackPageView, trackScrollDepth, trackTimeOnPage } from "../utils/analytics";
import { useEffect, useState } from "react";
import { SUPABASE_URL, headers} from "../utils/supabase";
import { formatDate } from "../utils/dateUtils";
import Footer from "./Footer";
import "./ArticlePage.css";

export default function ArticlePage({ id }) {
  const [article, setArticle] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
   useEffect(() => {
       trackPageView({ article_id: article.id, article_slug: article.slug });
       const cleanupScroll = trackScrollDepth(article.id);
       const cleanupTime   = trackTimeOnPage(article.id);
       return () => { cleanupScroll(); cleanupTime(); };
    },[article.id, article.slug]);
  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/articles?id=eq.${id}&select=*`,
          { headers }
        );
        const data = await res.json();
        if (!data || data.length === 0) {
          setNotFound(true);
          return;
        }
        const art = data[0];
        setArticle(art);
        trackPageView({ article_id: art.id, article_slug: art.title });

        // Fetch related articles (same category, excluding this one)
        if (art.category) {
          const relRes = await fetch(
            `${SUPABASE_URL}/rest/v1/articles?category=eq.${encodeURIComponent(art.category)}&id=neq.${id}&select=*&limit=3&order=published_at.desc`,
            { headers }
          );
          const relData = await relRes.json();
          setRelated(Array.isArray(relData) ? relData : []);
        }
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="article-page">
        <div className="loading-state">
          <div className="loading-spinner" />
          <span>Loading article…</span>
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="article-page">
        <div className="article-not-found">
          <span className="not-found-code">404</span>
          <h2>Article not found</h2>
          <a href="/" className="not-found-back">← Back to Chréma</a>
        </div>
      </div>
    );
  }

  // Render body — preserve line breaks, detect paragraphs
  const paragraphs = (article.body || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="article-page">
      {/* Minimal nav bar */}
      <header className="article-nav">
        <a href="/" className="article-nav-logo">CHRÈMA</a>
        <a href="/" className="article-nav-back">← All Stories</a>
      </header>

      <article className="article-body-wrap">
        {/* Hero image */}
        {article.image_url && (
          <div className="article-hero-img-wrap">
            <img
              src={article.image_url}
              alt={article.title}
              className="article-hero-img"
            />
          </div>
        )}

        {/* Article header */}
        <div className="article-header">
          {article.category && (
            <span className="article-category-tag">{article.category}</span>
          )}
          <h1 className="article-headline">{article.title}</h1>
          {article.excerpt && (
            <p className="article-dek">{article.excerpt}</p>
          )}
          <div className="article-byline">
            <div className="byline-left">
              <div className="byline-avatar">
                {article.author ? article.author[0].toUpperCase() : "C"}
              </div>
              <div className="byline-info">
                {article.author && (
                  <span className="byline-name">By {article.author}</span>
                )}
                {(article.published_at || article.created_at) && (
                  <span className="byline-date">
                    {formatDate(article.published_at || article.created_at)}
                  </span>
                )}
              </div>
            </div>
            <div className="byline-share">
              <button
                className="share-btn"
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                title="Copy link"
              >
                Copy link
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="article-rule" />

        {/* Body text — supports plain paragraphs or HTML from editor */}
        <div className="article-content">
          {paragraphs.length > 0 ? (
            paragraphs.map((para, i) => {
              const isHtml = /<[a-z][\s\S]*>/i.test(para);
              return isHtml
                ? <div key={i} className={i === 0 ? "article-first-para" : "article-html-block"} dangerouslySetInnerHTML={{ __html: para }} />
                : <p key={i} className={i === 0 ? "article-first-para" : ""}>{para}</p>;
            })
          ) : (
            <p className="article-no-body">No content available.</p>
          )}
        </div>
      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="related-section">
          <div className="related-inner">
            <div className="section-header">
              <h2 className="section-heading">More in {article.category}</h2>
              <div className="section-line" />
            </div>
            <div className="related-grid">
              {related.map((rel) => (
                <a key={rel.id} href={`/article/${rel.id}`} className="related-card">
                  <div className="related-img-wrap">
                    {rel.image_url ? (
                      <img src={rel.image_url} alt={rel.title} className="related-img" />
                    ) : (
                      <div className="related-img-placeholder" />
                    )}
                  </div>
                  <div className="related-info">
                    <h3 className="related-title">{rel.title}</h3>
                    <span className="related-meta">
                      By {rel.author}
                      {rel.published_at && ` · ${formatDate(rel.published_at)}`}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
