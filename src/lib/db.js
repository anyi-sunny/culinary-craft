// API client for backend DynamoDB operations
// All operations now go through the backend API instead of direct DynamoDB access
import { fetchAllRecipes as apiFetchAllRecipes, saveRecipe as apiSaveRecipe, deleteRecipe as apiDeleteRecipe, setHeart as apiSetHeart } from './apiClient';

export const RECIPES_TABLE = import.meta.env.VITE_RECIPES_TABLE || "CulinaryCraftBackendStack-RecipesTable058A1F33-1GRXYSW38KE1I";

/** Fetch every recipe */
export async function fetchAllRecipes() {
    try {
        return await apiFetchAllRecipes();
    } catch (err) {
        console.error("Error fetching recipes from API:", err);
        return [];
    }
}

/** Create or overwrite a recipe item */
export async function saveRecipe(item) {
    return apiSaveRecipe(item);
}

/** Delete a recipe by id (owner only) */
export async function deleteRecipe(recipeId, _userId) {
    // userId is passed for backwards compatibility but handled server-side
    return apiDeleteRecipe(recipeId);
}

/** Toggle a heart for a user on a recipe */
export async function setHeart(recipeId, userId, on) {
    // userId is passed for backwards compatibility but handled server-side
    return apiSetHeart(recipeId, on);
}
