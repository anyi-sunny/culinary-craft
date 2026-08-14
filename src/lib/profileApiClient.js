import { getCurrentUser } from "aws-amplify/auth";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

async function getAuthToken() {
    const user = await getCurrentUser();
    return user.userId;
}

async function apiCall(method, path, body = null) {
    const token = await getAuthToken();
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
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

/** Fetch the signed-in user's profile. Throws err.status 404 if none exists. */
export async function getProfile() {
    const result = await apiCall('GET', '/profile');
    return result.profile;
}

/**
 * Create or update the profile. Accepts { username, name, icon, iconBg, email }.
 * Throws err.status 409 when the username is taken.
 */
export async function upsertProfile(updates) {
    const result = await apiCall('PUT', '/profile', updates);
    return result.profile;
}

/** Delete the profile record (used during account deletion). */
export async function deleteProfile() {
    await apiCall('DELETE', '/profile');
}

/**
 * Fetch a chef's public profile by username — no auth, guests included.
 * Returns { userId, username, icon, iconBg, createdAt }; the backend never
 * exposes email or real name on this endpoint. Throws err.status 404 when
 * no such username exists.
 */
export async function getPublicProfile(username) {
    const response = await fetch(
        `${API_ENDPOINT}/profiles/${encodeURIComponent(username)}`
    );
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const err = new Error(error.error || `API error: ${response.status}`);
        err.status = response.status;
        throw err;
    }
    const result = await response.json();
    return result.profile;
}
