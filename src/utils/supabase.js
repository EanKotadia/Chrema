export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

export const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;

export const BUCKET = "article-images";

export const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// ── Storage ──────────────────────────────────────────────

export async function uploadImage(file) {
  const ext = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Upload failed");
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}`;
}

// ── Articles ─────────────────────────────────────────────

export async function getArticles() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/articles?select=*&order=published_at.desc`,
    { headers }
  );
  if (!res.ok) throw new Error("Failed to fetch articles");
  return res.json();
}

export async function createArticle(article) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(article),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create article");
  }
  return res.json();
}

export async function updateArticle(id, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update article");
  }
  return res.json();
}

export async function deleteArticle(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to delete article");
  }
}

// ── Submissions ───────────────────────────────────────────

export async function getSubmissions() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/submissions?select=*&order=submitted_at.desc`,
    { headers }
  );
  if (!res.ok) throw new Error("Failed to fetch submissions");
  return res.json();
}

export async function submitArticle(submission) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(submission),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to submit article");
  }
  return res.json();
}

export async function updateSubmission(id, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update submission");
  }
  return res.json();
}

// ── Trash ─────────────────────────────────────────────────

export async function trashSubmission(submission) {
  const trashRes = await fetch(`${SUPABASE_URL}/rest/v1/trash`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      original_id: submission.id,
      name: submission.name,
      email: submission.email,
      title: submission.title,
      category: submission.category || null,
      excerpt: submission.excerpt || null,
      body: submission.body,
      bio: submission.bio || null,
      submitted_at: submission.submitted_at,
      trashed_at: new Date().toISOString(),
    }),
  });
  if (!trashRes.ok) {
    const err = await trashRes.json().catch(() => ({}));
    throw new Error(err.message || "Failed to move to trash");
  }

  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/submissions?id=eq.${submission.id}`,
    { method: "DELETE", headers }
  );
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    throw new Error(err.message || "Failed to delete submission");
  }
}

export async function getTrash() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trash?select=*&order=trashed_at.desc`,
    { headers }
  );
  if (!res.ok) throw new Error("Failed to fetch trash");
  return res.json();
}

export async function restoreFromTrash(item) {
  const restoreRes = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      name: item.name,
      email: item.email,
      title: item.title,
      category: item.category || null,
      excerpt: item.excerpt || null,
      body: item.body,
      bio: item.bio || null,
      submitted_at: item.submitted_at,
      status: "pending",
    }),
  });
  if (!restoreRes.ok) {
    const err = await restoreRes.json().catch(() => ({}));
    throw new Error(err.message || "Failed to restore");
  }

  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/trash?id=eq.${item.id}`,
    { method: "DELETE", headers }
  );
  if (!delRes.ok) {
    const err = await delRes.json().catch(() => ({}));
    throw new Error(err.message || "Failed to remove from trash");
  }
}

export async function permanentlyDelete(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trash?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to permanently delete");
  }
}

// ── Analytics ─────────────────────────────────────────────

export async function getAnalytics() {
  const [articlesRes, submissionsRes, trashRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/articles?select=id,title,category,author,published_at&order=published_at.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/submissions?select=id,status,submitted_at,category`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/trash?select=id,trashed_at`, { headers }),
  ]);
  const [articles, submissions, trash] = await Promise.all([
    articlesRes.json(),
    submissionsRes.json(),
    trashRes.json(),
  ]);
  return { articles, submissions, trash };
}

// ── Events ────────────────────────────────────────────────

export async function getEvents(status) {
  const filter = status ? `&status=eq.${status}` : "";
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?select=*&order=created_at.desc${filter}`,
    { headers }
  );
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function getEventBySlug(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/events?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
    { headers }
  );
  if (!res.ok) throw new Error("Failed to fetch event");
  const data = await res.json();
  return data[0] || null;
}

export async function createEvent(event) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create event");
  }
  return res.json();
}

export async function updateEvent(id, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update event");
  }
  return res.json();
}

export async function deleteEvent(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}`, {
    method: "DELETE", headers,
  });
  if (!res.ok) throw new Error("Failed to delete event");
}

// ── Event Submissions ─────────────────────────────────────

export async function getEventSubmissions(eventId) {
  const filter = eventId ? `&event_id=eq.${eventId}` : "";
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/event_submissions?select=*&order=submitted_at.desc${filter}`,
    { headers }
  );
  if (!res.ok) throw new Error("Failed to fetch event submissions");
  return res.json();
}

export async function submitEventEntry(entry) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/event_submissions`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to submit entry");
  }
  return res.json();
}

export async function updateEventSubmission(id, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/event_submissions?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update submission");
  return res.json();
}

export async function deleteEventSubmission(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/event_submissions?id=eq.${id}`, {
    method: "DELETE", headers,
  });
  if (!res.ok) throw new Error("Failed to delete submission");
}


// ── Analytics / Page Views ────────────────────────────────

export async function trackPageView({ article_id, article_slug }) {
  try {
    // Get or create a session ID (anonymous visitor proxy)
    let session_id = sessionStorage.getItem("chrema_sid");
    if (!session_id) {
      session_id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("chrema_sid", session_id);
    }

    // Throttle: don't double-count the same article in one session
    const throttleKey = `pv_${article_id}`;
    if (sessionStorage.getItem(throttleKey)) return;
    sessionStorage.setItem(throttleKey, "1");

    // Detect device type
    const w = window.innerWidth;
    const device_type = w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";

    await fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        article_id,
        article_slug,
        session_id,
        referrer: document.referrer ? new URL(document.referrer).hostname : "direct",
        device_type,
      }),
    });
  } catch (_) {
    // Never block the article page if tracking fails
  }
}

export async function getPageViewStats() {
  // Fetch recent 90 days of views for analytics
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/page_views?select=article_id,session_id,device_type,referrer,viewed_at&viewed_at=gte.${since}&order=viewed_at.desc`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getArticlesWithViews() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/articles?select=id,title,author,category,published_at,view_count&order=published_at.desc`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

