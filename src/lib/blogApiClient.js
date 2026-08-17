import { fetchAuthSession } from "aws-amplify/auth";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

/**
 * Blog API. Two halves with deliberately different auth:
 *
 *  - Reads (`/blog`, `/blog/:slug`) are unauthenticated. Guests, logged-out
 *    visitors and crawlers all need them, so they carry no header at all.
 *  - Writes (`/admin/blog/...`) sit behind the API Gateway JWT authorizer, so
 *    they must carry the verified Cognito ID token — the raw userId the rest
 *    of apiClient.js sends is forgeable and would not be enough to publish.
 *
 * The backend re-checks the verified token's profile username against its
 * admin list on every write, so `profile.isAdmin` is only a UI hint.
 */

async function publicCall(path) {
    const response = await fetch(`${API_ENDPOINT}${path}`);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const err = new Error(error.error || `API error: ${response.status}`);
        err.status = response.status;
        throw err;
    }
    return response.json();
}

async function adminCall(method, path, body = null) {
    let token;
    try {
        const session = await fetchAuthSession();
        token = session.tokens?.idToken?.toString();
    } catch {
        // fall through to the login error below
    }
    if (!token) {
        const err = new Error("Please log in to manage blog posts.");
        err.status = 401;
        throw err;
    }

    const options = {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_ENDPOINT}${path}`, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const err = new Error(error.error || `API error: ${response.status}`);
        err.status = response.status;
        throw err;
    }
    return response.json();
}

/** Published posts, newest first. Cards only — no `body` field. */
export async function fetchBlogPosts() {
    const result = await publicCall("/blog");
    return result.posts || [];
}

/** One published post, in full. Throws err.status 404 for drafts. */
export async function fetchBlogPost(slug) {
    const result = await publicCall(`/blog/${encodeURIComponent(slug)}`);
    return result.post;
}

/** Every post including drafts, newest first (admin). Cards only. */
export async function fetchAdminBlogPosts() {
    const result = await adminCall("GET", "/admin/blog");
    return result.posts || [];
}

/** One post including drafts, in full — what the editor loads (admin). */
export async function fetchAdminBlogPost(slug) {
    const result = await adminCall("GET", `/admin/blog/${encodeURIComponent(slug)}`);
    return result.post;
}

/**
 * Create a post (admin). Accepts { title, subtitle, body, coverImage,
 * published }; the server assigns the slug from the title and owns the
 * timestamps. Returns the saved post.
 */
export async function createBlogPost(fields) {
    const result = await adminCall("POST", "/admin/blog", fields);
    return result.post;
}

/**
 * Edit a post (admin). The slug is the record's key and never changes, so
 * published URLs keep working through any number of retitles.
 */
export async function updateBlogPost(slug, fields) {
    const result = await adminCall("PUT", `/admin/blog/${encodeURIComponent(slug)}`, fields);
    return result.post;
}

/** Delete a post (admin). */
export async function deleteBlogPost(slug) {
    return adminCall("DELETE", `/admin/blog/${encodeURIComponent(slug)}`);
}
