/**
 * useArticleTracking(articleId, articleSlug?)
 *
 * Drop this into any article page component. It:
 *   1. Records a page view (deduped per session)
 *   2. Fires an impression (deduped per session)
 *   3. Tracks scroll milestones (25 / 50 / 75 / 100 %)
 *   4. Tracks time on page — flushes on unmount, tab hide, or beforeunload
 *
 * Usage:
 *   import useArticleTracking from "../hooks/useArticleTracking";
 *   // inside your article component:
 *   useArticleTracking(article.id, article.slug);
 */

import { useEffect } from "react";
import {
    trackPageView,
    trackScrollDepth,
    trackTimeOnPage,
    trackImpression,
} from "../utils/analytics";

export default function useArticleTracking(articleId, articleSlug) {
    useEffect(() => {
        if (!articleId) return;

        // Fire-and-forget — both are internally deduped via sessionStorage
        trackPageView({ article_id: articleId, article_slug: articleSlug });
        trackImpression(articleId);

        // Both return cleanup functions
        const cleanupScroll = trackScrollDepth(articleId);
        const cleanupTime   = trackTimeOnPage(articleId);

        return () => {
            cleanupScroll();
            cleanupTime(); // also flushes time before unmount
        };
    }, [articleId, articleSlug]);
}
