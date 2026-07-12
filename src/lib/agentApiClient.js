import { getCurrentUser } from "aws-amplify/auth";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;
const ANONYMOUS_USER_KEY = "culinary_craft_anonymous_id";

/**
 * Get user ID - either from authenticated session or generate anonymous ID
 * Authenticated users: real userId from Cognito
 * Anonymous users: temporary ID stored in localStorage for testing
 */
async function getAuthToken() {
    try {
        console.log("🔐 Checking for authenticated user...");
        const user = await getCurrentUser();
        console.log("👤 Current user:", user);
        if (user && user.userId) {
            console.log("✅ User authenticated:", user.userId);
            return user.userId;
        }
    } catch (err) {
        console.log("ℹ️ User not authenticated (this is OK for testing)");
    }

    // Generate/retrieve anonymous ID for guest users
    console.log("👻 Generating anonymous user ID for testing...");
    let anonId = localStorage.getItem(ANONYMOUS_USER_KEY);
    if (!anonId) {
        anonId = `anonymous-${crypto.randomUUID()}`;
        localStorage.setItem(ANONYMOUS_USER_KEY, anonId);
        console.log("✅ Created new anonymous ID:", anonId.substring(0, 20) + "...");
    } else {
        console.log("✅ Using existing anonymous ID:", anonId.substring(0, 20) + "...");
    }
    return anonId;
}

async function apiCall(method, path, body = null) {
    console.log("📡 API call:", method, path);
    const token = await getAuthToken();

    console.log("🔑 Using user ID:", token.substring(0, 20) + "...");
    console.log("🌐 API endpoint:", API_ENDPOINT);

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
        throw new Error(error.error || `API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ API response received");
    return result;
}

/**
 * Invoke Bedrock Agent through backend API
 */
export async function invokeAgent(sessionId, inputText, files = []) {
    try {
        const result = await apiCall('POST', '/agent/invoke', {
            sessionId,
            inputText,
            files,
        });
        return result.output;
    } catch (err) {
        console.error("Error invoking agent:", err);
        throw err;
    }
}
