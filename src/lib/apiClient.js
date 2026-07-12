import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

async function getAuthToken() {
    try {
        // Get current user to extract userId
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

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    // Add Authorization header if we have a token
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

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
 * Fetch all recipes
 */
export async function fetchAllRecipes() {
    const result = await apiCall('GET', '/recipes');
    return result.recipes || [];
}

/**
 * Save a recipe (create or update)
 */
export async function saveRecipe(item) {
    try {
        const result = await apiCall('POST', '/recipes', item);
        return result.recipe;
    } catch (err) {
        console.error("Error saving recipe:", err);
        throw err;
    }
}

/**
 * Delete a recipe by ID
 */
export async function deleteRecipe(recipeId) {
    try {
        await apiCall('DELETE', `/recipes/${recipeId}`);
    } catch (err) {
        console.error("Error deleting recipe:", err);
        throw err;
    }
}

/**
 * Toggle heart on a recipe
 */
export async function setHeart(recipeId, on) {
    try {
        await apiCall('PUT', `/recipes/${recipeId}/heart`, { on });
    } catch (err) {
        console.error("Error toggling heart:", err);
        throw err;
    }
}
