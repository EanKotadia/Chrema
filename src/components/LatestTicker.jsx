import { formatDistanceToNow } from "../utils/dateUtils";

export default function LatestTicker({ articles }) {
  if (!articles.length) return null;

  // Duplicate for seamless loop
  const items = [...articles, ...articles];

  return (
    <div className="ticker-wrap">
      <span className="ticker-label">LATEST</span>
      <div className="ticker-track">
        <div className="ticker-inner">
          {items.map((article, i) => (
            <a
              key={`${article.id}-${i}`}
              href={`/article/${article.id}`}
              className="ticker-item"
            >
              <span className="ticker-time">
                {formatDistanceToNow(article.published_at || article.created_at)}
              </span>
              <span className="ticker-title">{article.title}</span>
              <span className="ticker-sep">·</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
