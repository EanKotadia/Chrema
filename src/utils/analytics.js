const BASE = process.env.REACT_APP_SUPABASE_URL;
const KEY  = process.env.REACT_APP_SUPABASE_KEY;

const H = {
    apikey:         KEY,
    Authorization:  `Bearer ${KEY}`,
    "Content-Type": "application/json",
};

// ─── Read ──────────────────────────────────────────────────────────────────

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

// ─── Session ───────────────────────────────────────────────────────────────
// Persists for the browser tab lifetime. A new tab = new session.

function getSession() {
    let sid = sessionStorage.getItem("chrema_sid");
    if (!sid) {
        sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
        sessionStorage.setItem("chrema_sid", sid);
    }
    return sid;
}

function getDevice() {
    const w = window.innerWidth;
    return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

function getReferrer() {
    try {
        return document.referrer ? new URL(document.referrer).hostname : "direct";
    } catch {
        return "direct";
    }
}

// ─── Page view ─────────────────────────────────────────────────────────────
// Cooldown: same article won't count twice within VIEW_COOLDOWN_MS.
// This lets genuine return visits register while preventing rapid reloads
// from inflating counts. Site-level events (terms accept) use key "site".
// Set to 0 to disable the cooldown entirely and count every single load.

const VIEW_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export async function trackPageView({ article_id = null, article_slug = null } = {}) {
    try {
        const cooldownKey = `pv_ts_${article_id ?? "site"}`;
        const lastSeen    = parseInt(localStorage.getItem(cooldownKey) || "0", 10);

        if (VIEW_COOLDOWN_MS > 0 && Date.now() - lastSeen < VIEW_COOLDOWN_MS) return;
        localStorage.setItem(cooldownKey, String(Date.now()));

        const body = {
            session_id:  getSession(),
            device_type: getDevice(),
            referrer:    getReferrer(),
        };
        if (article_id)   body.article_id   = article_id;
        if (article_slug) body.article_slug = article_slug;

        await fetch(`${BASE}/rest/v1/analytics_views`, {
            method:  "POST",
            headers: { ...H, Prefer: "return=minimal" },
            body:    JSON.stringify(body),
        });
    } catch (_) {}
}

// ─── Scroll depth ──────────────────────────────────────────────────────────
// Tracks every SCROLL_GRANULARITY_PCT percent band, not just 4 milestones.
// Each band fires once per page load. Lower the number for finer resolution.

const SCROLL_GRANULARITY_PCT = 10; // fire at 10, 20, 30 … 100

export function trackScrollDepth(articleId) {
    const reached = new Set();

    const handler = async () => {
        const scrolled = window.scrollY + window.innerHeight;
        const total    = document.documentElement.scrollHeight;
        const pct      = Math.round((scrolled / total) * 100);

        // Round down to nearest band boundary
        const band = Math.floor(pct / SCROLL_GRANULARITY_PCT) * SCROLL_GRANULARITY_PCT;

        if (band > 0 && !reached.has(band)) {
            reached.add(band);
            try {
                await fetch(`${BASE}/rest/v1/scroll_events`, {
                    method:  "POST",
                    headers: { ...H, Prefer: "return=minimal" },
                    body:    JSON.stringify({ article_id: articleId, depth: band }),
                });
            } catch (_) {}
        }
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
}

// ─── Time on page ──────────────────────────────────────────────────────────
// Uses fetch({ keepalive: true }) — NOT sendBeacon.
// sendBeacon cannot send custom headers so Supabase rejects it with 401.

export function trackTimeOnPage(articleId) {
    const start = Date.now();
    let   sent  = false;

    const send = () => {
        if (sent) return;
        const seconds = Math.round((Date.now() - start) / 1000);
        if (seconds < 3) return;
        sent = true;

        fetch(`${BASE}/rest/v1/time_on_page`, {
            method:    "POST",
            headers:   { ...H, Prefer: "return=minimal" },
            body:      JSON.stringify({ article_id: articleId, seconds }),
            keepalive: true,
        }).catch(() => {});
    };

    const onUnload     = () => send();
    const onVisibility = () => { if (document.visibilityState === "hidden") send(); };

    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
        send();
        window.removeEventListener("beforeunload", onUnload);
        document.removeEventListener("visibilitychange", onVisibility);
    };
}

// ─── Impressions ───────────────────────────────────────────────────────────
// One impression per page load (not per session) so article list re-renders
// and fresh navigations all register.

export async function trackImpression(articleId) {
    try {
        await fetch(`${BASE}/rest/v1/impressions`, {
            method:  "POST",
            headers: { ...H, Prefer: "return=minimal" },
            body:    JSON.stringify({ article_id: articleId, clicked: false }),
        });
    } catch (_) {}
}

export async function trackCardClick(articleId) {
    try {
        await fetch(`${BASE}/rest/v1/impressions`, {
            method:  "POST",
            headers: { ...H, Prefer: "return=minimal" },
            body:    JSON.stringify({ article_id: articleId, clicked: true }),
        });
    } catch (_) {}
}

// ─── Enrichment ────────────────────────────────────────────────────────────

export function enrichArticles(articles, scrolls, times, impressions) {
    return articles.map(a => {
        const id = a.id;

        const articleTimes   = times.filter(t => t.article_id === id).map(t => t.seconds);
        const avgReadSeconds = articleTimes.length > 0
            ? Math.round(articleTimes.reduce((s, t) => s + t, 0) / articleTimes.length)
            : 0;

        const articleViews   = a.view_count || 0;
        // Completion = reached 75%+ scroll depth
        const deepReads      = scrolls.filter(s => s.article_id === id && s.depth >= 75).length;
        const completionRate = articleViews > 0
            ? Math.round((deepReads / articleViews) * 100)
            : 0;

        const articleImps     = impressions.filter(i => i.article_id === id);
        const impressionCount = articleImps.length;
        const clickCount      = articleImps.filter(i => i.clicked).length;
        const ctr             = impressionCount > 0
            ? Math.round((clickCount / impressionCount) * 100)
            : null;

        return { ...a, avgReadSeconds, completionRate, ctr, impressionCount };
    });
}

export function formatDuration(seconds) {
    if (!seconds || seconds < 1) return "—";
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
