import { useEffect, useState, lazy, Suspense } from "react";
import Navbar from "./components/Navbar";
import HeroFeature from "./components/HeroFeature";
import LatestTicker from "./components/LatestTicker";
import ArticleGrid from "./components/ArticleGrid";
import CategoryRow from "./components/CategoryRow";
import Footer from "./components/Footer";
import { SUPABASE_URL, headers } from "./utils/supabase";
import "./styles.css";


const AdminShell  = lazy(() => import("./components/AdminShell"));
const ArticlePage = lazy(() => import("./components/ArticlePage"));
const SubmitPage  = lazy(() => import("./components/SubmitPage"));
const AboutPage      = lazy(() => import("./components/AboutPage"));
const EventPage      = lazy(() => import("./components/EventPage"));
const EventsArchive  = lazy(() => import("./components/EventsArchive"));
const TermsPopup  = lazy(() => import("./components/TermsPopup"));

// ── Minimal spinner shown while a lazy chunk loads ──
function PageLoader() {
  return (
    <div className="loading-state" style={{ minHeight: "100vh" }}>
      <div className="loading-spinner" />
    </div>
  );
}

// ── Cache key ──
const CACHE_KEY = "chrema_articles_v1";
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function getCached() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function setCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

function App() {
  const [articles, setArticles] = useState(() => getCached() || []);
  const [loading, setLoading]   = useState(!getCached());
  const [activeCategory, setActiveCategory] = useState("All");
  const [termsAccepted, setTermsAccepted]   = useState(
    () => localStorage.getItem("chrema_terms") === "true"
  );

  // Redirect from 404.html SPA trick
  const redirect = sessionStorage.getItem("redirect");
  if (redirect) {
    sessionStorage.removeItem("redirect");
    window.history.replaceState(null, "", redirect);
  }

  const path = window.location.pathname;
  const isAdmin   = path === "/admin" || path === "/admin/submissions";
  const isSubmit  = path === "/submit";
  const isAbout   = path === "/about";
  const articleMatch = path.match(/^\/article\/(.+)$/);
  const articleId    = articleMatch ? articleMatch[1] : null;
  const eventMatch   = path.match(/^\/events\/(.+)$/);
  const eventSlug    = eventMatch ? eventMatch[1] : null;
  const isEvents     = path === "/events";
  const isStaticPage = isAdmin || isSubmit || isAbout || !!articleId || !!eventSlug || isEvents;

  const initialAdminView = path === "/admin/submissions" ? "submissions" : "publish";

  useEffect(() => {
    if (isStaticPage) return;
    const cached = getCached();
    if (cached) { setArticles(cached); setLoading(false); return; }

    // Only fetch the fields the homepage actually needs
    fetch(
      `${SUPABASE_URL}/rest/v1/articles?select=id,title,excerpt,category,author,published_at,image_url&order=published_at.desc&limit=40`,
      { headers }
    )
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setCache(arr);
        setArticles(arr);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isStaticPage]);

  const handleAcceptTerms = () => {
    localStorage.setItem("chrema_terms", "true");
    setTermsAccepted(true);
  };

  // Static pages
  if (isAdmin)    return <Suspense fallback={<PageLoader />}><AdminShell initialView={initialAdminView} /></Suspense>;
  if (isSubmit)   return <Suspense fallback={<PageLoader />}><SubmitPage /></Suspense>;
  if (isAbout)    return <Suspense fallback={<PageLoader />}><AboutPage /></Suspense>;
  if (articleId)  return <Suspense fallback={<PageLoader />}><ArticlePage id={articleId} /></Suspense>;
  if (eventSlug)  return <Suspense fallback={<PageLoader />}><EventPage slug={eventSlug} /></Suspense>;
  if (isEvents)   return <Suspense fallback={<PageLoader />}><EventsArchive /></Suspense>;

  const categories = ["All", ...new Set(articles.map((a) => a.category).filter(Boolean))];
  const filtered   = activeCategory === "All" ? articles : articles.filter((a) => a.category === activeCategory);
  const hero       = filtered[0] || null;
  const secondary  = filtered.slice(1, 4);
  const rest       = filtered.slice(4);

  return (
    <div className="app">
      {!termsAccepted && (
        <Suspense fallback={null}>
          <TermsPopup onAccept={handleAcceptTerms} />
        </Suspense>
      )}

      <Navbar
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
      />
      <LatestTicker articles={articles.slice(0, 8)} />

      <main className="main-content">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>Loading Chréma…</span>
          </div>
        ) : articles.length === 0 ? (
          <div className="empty-state"><p>No articles published yet.</p></div>
        ) : (
          <>
            <HeroFeature article={hero} secondary={secondary} />
            {rest.length > 0 && <ArticleGrid articles={rest} />}
            <CategoryRow articles={articles} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
