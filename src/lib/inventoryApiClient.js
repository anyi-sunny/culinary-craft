import { getCurrentUser } from "aws-amplify/auth";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

async function getAuthToken() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.userId) {
            console.debug("No authenticated user found");
            return null;
        }
        return user.userId;
    } catch (err) {
        console.debug("User not authenticated:", err.message);
        return null;
    }
}

async function apiCall(method, path, body = null) {
    const token = await getAuthToken();

    if (!token) {
        throw new Error("Not authenticated. Please log in.");
    }

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
        throw new Error(error.error || `API error: ${response.status}`);
    }

    return response.json();
}

/**
 * Initialize predefined categories for a new user (idempotent)
 */
export async function initializeCategories() {
    try {
        await apiCall('POST', '/inventory/categories/init');
    } catch (err) {
        console.error("Error initializing categories:", err);
        throw err;
    }
}

/**
 * Fetch user's inventory categories
 */
export async function fetchCategories() {
    try {
        const result = await apiCall('GET', '/inventory/categories');
        return result.categories || [];
    } catch (err) {
        console.error("Error fetching categories:", err);
        throw err;
    }
}

/**
 * Add a custom category
 */
export async function addCategory(name, description = '') {
    try {
        const result = await apiCall('POST', '/inventory/categories', {
            name,
            description,
        });
        return result.category;
    } catch (err) {
        console.error("Error adding category:", err);
        throw err;
    }
}

/**
 * Fetch user's inventory items
 */
export async function fetchInventoryItems() {
    try {
        const result = await apiCall('GET', '/inventory/items');
        return result.items || [];
    } catch (err) {
        console.error("Error fetching inventory items:", err);
        throw err;
    }
}

/**
 * Add an inventory item
 */
export async function addInventoryItem(name, category, quantity = '', unit = '', notes = '') {
    try {
        const result = await apiCall('POST', '/inventory/items', {
            name,
            category,
            quantity,
            unit,
            notes,
        });
        return result.item;
    } catch (err) {
        console.error("Error adding inventory item:", err);
        throw err;
    }
}

/**
 * Update an inventory item. `updates` may carry any of {quantity, unit,
 * notes}; only the fields present are written, and an empty string is a
 * real value (it clears the field) — omit a field to leave it unchanged.
 */
export async function updateInventoryItem(itemId, updates = {}) {
    try {
        const body = {};
        if (updates.quantity !== undefined && updates.quantity !== null) body.quantity = updates.quantity;
        if (updates.unit !== undefined && updates.unit !== null) body.unit = updates.unit;
        if (updates.notes !== undefined && updates.notes !== null) body.notes = updates.notes;

        await apiCall('PUT', `/inventory/items/${itemId}`, body);
    } catch (err) {
        console.error("Error updating inventory item:", err);
        throw err;
    }
}

/**
 * Delete an inventory item
 */
export async function deleteInventoryItem(itemId) {
    try {
        await apiCall('DELETE', `/inventory/items/${itemId}`);
    } catch (err) {
        console.error("Error deleting inventory item:", err);
        throw err;
    }
}
