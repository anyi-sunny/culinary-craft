import { useState, useEffect, useCallback } from "react";
import { fetchAllRecipes, setHeart, deleteRecipe } from "./db";
import { isHearted, heartedByList } from "./recipeUtils";

// Recompute a recipe's heartedBy array after toggling a user in/out.
function withHeart(recipe, userId, on) {
    const set = new Set(heartedByList(recipe));
    if (on) set.add(userId);
    else set.delete(userId);
    return { ...recipe, heartedBy: [...set] };
}

/**
 * Shared recipe data layer used by Explore, My Recipes and Favorites.
 * Holds the full recipe list and exposes optimistic heart/delete mutations.
 */
export function useRecipes() {
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setRecipes(await fetchAllRecipes());
        } catch (err) {
            console.error("Error fetching recipes:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const toggleHeart = useCallback(async (recipe, userId) => {
        if (!userId) return;
        const on = !isHearted(recipe, userId);
        // Optimistic update so the UI feels instant.
        setRecipes((prev) =>
            prev.map((r) =>
                r.recipeId === recipe.recipeId ? withHeart(r, userId, on) : r
            )
        );
        try {
            await setHeart(recipe.recipeId, userId, on);
        } catch (err) {
            console.error("Heart toggle failed:", err);
            // Revert on failure.
            setRecipes((prev) =>
                prev.map((r) =>
                    r.recipeId === recipe.recipeId ? withHeart(r, userId, !on) : r
                )
            );
        }
    }, []);

    const removeRecipe = useCallback(async (recipe) => {
        try {
            await deleteRecipe(recipe.recipeId);
            setRecipes((prev) => prev.filter((r) => r.recipeId !== recipe.recipeId));
            return true;
        } catch (err) {
            console.error("Delete failed:", err);
            return false;
        }
    }, []);

    return { recipes, loading, refresh, toggleHeart, removeRecipe };
}
