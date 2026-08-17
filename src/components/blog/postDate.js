/**
 * The date shown on a post: when it went live, falling back to when it was
 * started (drafts have no publishedAt yet).
 */
export function formatPostDate(post) {
    const stamp = post?.publishedAt || post?.createdAt;
    if (!stamp) return "";
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
