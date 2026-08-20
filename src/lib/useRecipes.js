import { useState, useEffect, useCallback } from "react";
import { fetchAllRecipes, setHeart, deleteRecipe, setPublished } from "./db";
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

        // Refetch when the page becomes visible (user switches tabs/windows)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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

    // Publish/hide a recipe on Explore. Optimistic like hearts, since the
    // owner sees the badge flip on the card they just clicked.
    const togglePublish = useCallback(async (recipe, published) => {
        const id = recipe.recipeId;
        setRecipes((prev) =>
            prev.map((r) => (r.recipeId === id ? { ...r, published } : r))
        );
        try {
            await setPublished(id, published);
            return true;
        } catch (err) {
            console.error("Publish toggle failed:", err);
            setRecipes((prev) =>
                prev.map((r) => (r.recipeId === id ? { ...r, published: !published } : r))
            );
            return false;
        }
    }, []);

    const removeRecipe = useCallback(async (recipe, userId) => {
        if (!userId) throw new Error("Must be logged in to delete recipes");
        try {
            await deleteRecipe(recipe.recipeId, userId);
            setRecipes((prev) => prev.filter((r) => r.recipeId !== recipe.recipeId));
            return true;
        } catch (err) {
            console.error("Delete failed:", err);
            return false;
        }
    }, []);

    return { recipes, loading, refresh, toggleHeart, togglePublish, removeRecipe };
}
