const URL = process.env.REACT_APP_SUPABASE_URL;
const KEY = process.env.REACT_APP_SUPABASE_KEY;

const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

export async function fetchAnalyticsData() {
  const [articlesRes, subsRes, viewsRes] = await Promise.all([
    fetch(`${URL}/rest/v1/articles?select=id,title,author,category,published_at,view_count&order=published_at.desc`, { headers: H }),
    fetch(`${URL}/rest/v1/submissions?select=id,status,submitted_at`, { headers: H }),
    fetch(`${URL}/rest/v1/analytics_views?select=article_id,viewed_at&order=viewed_at.desc&limit=5000`, { headers: H }),
  ]);

  const articles    = articlesRes.ok  ? await articlesRes.json().catch(() => []) : [];
  const submissions = subsRes.ok      ? await subsRes.json().catch(() => [])     : [];
  const views       = viewsRes.ok     ? await viewsRes.json().catch(() => [])    : [];

  return {
    articles:    Array.isArray(articles)    ? articles    : [],
    submissions: Array.isArray(submissions) ? submissions : [],
    views:       Array.isArray(views)       ? views       : [],
  };
}
