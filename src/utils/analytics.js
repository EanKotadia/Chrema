const BASE = process.env.REACT_APP_SUPABASE_URL;
const KEY  = process.env.REACT_APP_SUPABASE_KEY;

const H = {
    apikey:        KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
};

// ── Dashboard data ────────────────────────────────────────

export async function fetchAnalyticsData() {
    const [articlesRes, subsRes, viewsRes, scrollRes, timeRes, impRes] = await Promise.all([
        fetch(`${BASE}/rest/v1/articles?select=id,title,author,category,published_at,view_count&order=published_at.desc`, { headers: H }),
        fetch(`${BASE}/rest/v1/submissions?select=id,status,submitted_at`, { headers: H }),
        fetch(`${BASE}/rest/v1/analytics_views?select=article_id,session_id,device_type,referrer,viewed_at&order=viewed_at.desc&limit=5000`, { headers: H }),
        fetch(`${BASE}/rest/v1/scroll_events?select=article_id,depth`, { headers: H }),
        fetch(`${BASE}/rest/v1/time_on_page?select=article_id,seconds`, { headers: H }),
        fetch(`${BASE}/rest/v1/impressions?select=article_id,clicked`, { headers: H }),
    ]);

    const articles    = articlesRes.ok ? await articlesRes.json().catch(() => []) : [];
    const submissions = subsRes.ok     ? await subsRes.json().catch(() => [])     : [];
    const views       = viewsRes.ok    ? await viewsRes.json().catch(() => [])    : [];
    const scrolls     = scrollRes.ok   ? await scrollRes.json().catch(() => [])   : [];
    const times       = timeRes.ok     ? await timeRes.json().catch(() => [])     : [];
    const impressions = impRes.ok      ? await impRes.json().catch(() => [])      : [];

    return {
        articles:    Array.isArray(articles)    ? articles    : [],
        submissions: Array.isArray(submissions) ? submissions : [],
        views:       Array.isArray(views)       ? views       : [],
        scrolls:     Array.isArray(scrolls)     ? scrolls     : [],
        times:       Array.isArray(times)       ? times       : [],
        impressions: Array.isArray(impressions) ? impressions : [],
    };
}

// ── Page view tracking ────────────────────────────────────
// Call this when an article page loads
//
// Usage in your article page:
//   useEffect(() => { trackPageView({ article_id: id, article_slug: slug }); }, [id]);

export async function trackPageView({ article_id, article_slug }) {
    try {
        let session_id = sessionStorage.getItem("chrema_sid");
        if (!session_id) {
            session_id = Math.random().toString(36).slice(2) + Date.now().toString(36);
            sessionStorage.setItem("chrema_sid", session_id);
        }

        // don't double-count same article in same session
        const key = `pv_${article_id}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");

        const w = window.innerWidth;
        const device_type = w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";

        await fetch(`${BASE}/rest/v1/analytics_views`, {
            method:  "POST",
            headers: { ...H, Prefer: "return=minimal" },
            body: JSON.stringify({
                article_id,
                article_slug,
                session_id,
                device_type,
                referrer: document.referrer
                    ? new URL(document.referrer).hostname
                    : "direct",
            }),
        });
    } catch (_) {
        // never block the article page
    }
}

// ── Scroll depth tracking ─────────────────────────────────
// Fires at 25%, 50%, 75%, 100% scroll milestones
// Shows you if people are actually reading vs bouncing after the intro
//
// Usage in your article page:
//   useEffect(() => trackScrollDepth(articleId), [articleId]);
//
// The function returns a cleanup function so React can remove the listener

export function trackScrollDepth(articleId) {
    const milestones = [25, 50, 75, 100];
    const reached    = new Set();

    const handler = async () => {
        const scrolled = window.scrollY + window.innerHeight;
        const total    = document.documentElement.scrollHeight;
        const pct      = Math.round((scrolled / total) * 100);

        for (const m of milestones) {
            if (pct >= m && !reached.has(m)) {
                reached.add(m);
                try {
                    await fetch(`${BASE}/rest/v1/scroll_events`, {
                        method:  "POST",
                        headers: { ...H, Prefer: "return=minimal" },
                        body: JSON.stringify({ article_id: articleId, depth: m }),
                    });
                } catch (_) {}
            }
        }
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
}

// ── Time on page tracking ─────────────────────────────────
// Records seconds spent on the article when the reader leaves
// 30 seconds vs 4 minutes is a huge signal for content quality
//
// Usage in your article page:
//   useEffect(() => trackTimeOnPage(articleId), [articleId]);

export function trackTimeOnPage(articleId) {
    const start = Date.now();

    const send = () => {
        const seconds = Math.round((Date.now() - start) / 1000);
        if (seconds < 3) return; // ignore accidental bounces

        // sendBeacon works even as the page is closing
        const body = JSON.stringify({ article_id: articleId, seconds });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(`${BASE}/rest/v1/time_on_page`, body);
        } else {
            fetch(`${BASE}/rest/v1/time_on_page`, {
                method: "POST", headers: { ...H, Prefer: "return=minimal" },
                body, keepalive: true,
            }).catch(() => {});
        }
    };

    window.addEventListener("beforeunload", send);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") send();
    });

    return () => window.removeEventListener("beforeunload", send);
}

// ── Impression + CTR tracking ─────────────────────────────
// trackImpression  — call when an article card enters the viewport
// trackCardClick   — call when the card is clicked
// CTR = clicks / impressions, useful if you have a homepage feed
//
// Usage on your article card:
//   const ref = useRef();
//   useEffect(() => {
//     const observer = new IntersectionObserver(([entry]) => {
//       if (entry.isIntersecting) {
//         trackImpression(article.id);
//         observer.disconnect();
//       }
//     });
//     if (ref.current) observer.observe(ref.current);
//     return () => observer.disconnect();
//   }, [article.id]);
//
//   <div ref={ref} onClick={() => trackCardClick(article.id)}>...</div>

export async function trackImpression(articleId) {
    try {
        const key = `imp_${articleId}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");

        await fetch(`${BASE}/rest/v1/impressions`, {
            method:  "POST",
            headers: { ...H, Prefer: "return=minimal" },
            body: JSON.stringify({ article_id: articleId, clicked: false }),
        });
    } catch (_) {}
}

export async function trackCardClick(articleId) {
    try {
        await fetch(`${BASE}/rest/v1/impressions`, {
            method:  "POST",
            headers: { ...H, Prefer: "return=minimal" },
            body: JSON.stringify({ article_id: articleId, clicked: true }),
        });
    } catch (_) {}
}

// ── Enrich articles with computed stats ───────────────────
// Call this in your dashboard to get per-article metrics
//
// Usage:
//   const enriched = enrichArticles(articles, scrolls, times, impressions);
//
// Each article gets these extra fields:
//   avgReadSeconds  — average time spent reading (use formatDuration to display)
//   completionRate  — % of viewers who scrolled to 75%+ (meaningful read)
//   ctr             — click-through rate % (null if no impression data yet)
//   impressionCount — how many times the card was seen

export function enrichArticles(articles, scrolls, times, impressions) {
    return articles.map(a => {
        const id = a.id;

        // avg time on page
        const articleTimes   = times.filter(t => t.article_id === id).map(t => t.seconds);
        const avgReadSeconds = articleTimes.length > 0
            ? Math.round(articleTimes.reduce((s, t) => s + t, 0) / articleTimes.length)
            : 0;

        // completion rate — readers who hit 75%+ scroll depth
        const articleViews   = a.view_count || 0;
        const deepReads      = scrolls.filter(s => s.article_id === id && s.depth >= 75).length;
        const completionRate = articleViews > 0
            ? Math.round((deepReads / articleViews) * 100)
            : 0;

        // CTR from impressions table
        const articleImps   = impressions.filter(i => i.article_id === id);
        const impressionCount = articleImps.length;
        const clickCount    = articleImps.filter(i => i.clicked).length;
        const ctr           = impressionCount > 0
            ? Math.round((clickCount / impressionCount) * 100)
            : null;

        return { ...a, avgReadSeconds, completionRate, ctr, impressionCount };
    });
}

// ── Format seconds as "2m 14s" ────────────────────────────
export function formatDuration(seconds) {
    if (!seconds || seconds < 1) return "—";
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
}