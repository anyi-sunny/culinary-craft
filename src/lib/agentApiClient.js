import { fetchAuthSession } from "aws-amplify/auth";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

/**
 * The agent endpoints sit behind an API Gateway JWT authorizer (they spend
 * real money), so the Authorization header must carry the verified Cognito
 * ID token — a raw userId or anonymous ID is rejected at the gateway.
 */
async function getAuthToken() {
    try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();
        if (token) return token;
    } catch {
        // fall through to the login error below
    }
    const err = new Error("Please log in to use the recipe assistant.");
    err.status = 401;
    throw err;
}

async function apiCall(method, path, body = null) {
    console.log("📡 API call:", method, path);
    const token = await getAuthToken();

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    console.log("📤 Sending request to:", `${API_ENDPOINT}${path}`);
    const response = await fetch(`${API_ENDPOINT}${path}`, options);

    console.log("📨 Response status:", response.status);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("❌ API error:", error);
        const err = new Error(error.error || `API error: ${response.status}`);
        err.status = response.status;
        throw err;
    }

    const result = await response.json();
    console.log("✅ API response received");
    return result;
}

/**
 * Chat with the recipe assistant (Claude API via backend).
 *
 * The backend is stateless: `messages` is the full conversation so far,
 * ending with the newest user turn — [{role: 'user'|'assistant', content}].
 *
 * @returns {Promise<{output: string, recipe: object|null, verify: {valid: boolean, issues: string[]}}>}
 *   output  — the assistant's Markdown reply for the chat transcript
 *   recipe  — structured recipe ({title, servings, tags, components,
 *             ingredients, instructions}) when the reply contains one
 *   verify  — QA result for the recipe (advisory; issues surface in the UI)
 */
export async function invokeAgent(messages) {
    try {
        const result = await apiCall('POST', '/agent/invoke', { messages });
        // Debug aid for the degenerate-reply investigation: the exact payload
        // the backend handed us (the Lambda logs the raw model text and the
        // parsed object on its side).
        console.log("🤖 Agent payload:", result);
        return result;
    } catch (err) {
        console.error("Error invoking agent:", err);
        throw err;
    }
}
