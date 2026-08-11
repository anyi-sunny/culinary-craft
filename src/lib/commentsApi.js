import { getCurrentUser } from "aws-amplify/auth";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

async function authHeader() {
    try {
        const user = await getCurrentUser();
        if (user?.userId) return { Authorization: `Bearer ${user.userId}` };
    } catch {
        // Guests can read comments without auth.
    }
    return {};
}

/** All comments for a recipe (both feedback and questions). */
export async function getComments(recipeId) {
    const res = await fetch(`${API_ENDPOINT}/recipes/${recipeId}/comments`, {
        headers: await authHeader(),
    });
    if (!res.ok) throw new Error(`Failed to load comments (${res.status})`);
    const data = await res.json();
    return data.comments || [];
}

/** Post a comment. type: 'feedback' | 'question'. Requires login. */
export async function addComment(recipeId, type, text) {
    const res = await fetch(`${API_ENDPOINT}/recipes/${recipeId}/comments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(await authHeader()),
        },
        body: JSON.stringify({ type, text }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to post comment (${res.status})`);
    }
    const data = await res.json();
    return data.comment;
}
