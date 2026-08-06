import { getCurrentUser } from "aws-amplify/auth";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;
const ANONYMOUS_USER_KEY = "culinary_craft_anonymous_id";

async function getAuthToken() {
    try {
        const user = await getCurrentUser();
        if (user && user.userId) {
            return user.userId;
        }
    } catch {
        console.debug("User not authenticated");
    }

    let anonId = localStorage.getItem(ANONYMOUS_USER_KEY);
    if (!anonId) {
        anonId = `anonymous-${crypto.randomUUID()}`;
        localStorage.setItem(ANONYMOUS_USER_KEY, anonId);
    }
    return anonId;
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

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_ENDPOINT}${path}`, options);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const err = new Error(error.error || `API error: ${response.status}`);
        err.status = response.status;
        throw err;
    }

    return response.json();
}

/**
 * Get all shopping lists for user
 */
export async function getShoppingLists() {
    const result = await apiCall('GET', '/shopping-list');
    return result.shoppingLists || [];
}

/**
 * Get specific shopping list by ID
 */
export async function getShoppingList(shoppingListId) {
    const result = await apiCall('GET', `/shopping-list/${shoppingListId}`);
    return result.shoppingList;
}

/**
 * Create new shopping list
 */
export async function createShoppingList(items) {
    const result = await apiCall('POST', '/shopping-list', { items });
    return result.shoppingList;
}

/**
 * Update shopping list
 */
export async function updateShoppingList(shoppingListId, updates) {
    await apiCall('PUT', `/shopping-list/${shoppingListId}`, updates);
}

/**
 * Delete shopping list
 */
export async function deleteShoppingList(shoppingListId) {
    await apiCall('DELETE', `/shopping-list/${shoppingListId}`);
}
