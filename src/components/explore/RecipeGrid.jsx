import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import RecipeCard from "./card/RecipeCard";
import RecipeModal from "./modal/RecipeModal";
import { recipeTitle } from "../../lib/recipeUtils";
import "./Explore.css";

/**
 * Shared search + grid + modal used by Explore, My Recipes and Favorites.
 *
 * Props:
 *  - recipes, loading
 *  - userId            current user id (or null)
 *  - onRequireLogin()  prompt login when a guest tries to heart
 *  - onToggleHeart(r)  toggle a heart (login already ensured)
 *  - onDelete(r)       delete a recipe (owner-gated by the card)
 *  - onRefresh()       refetch after a modal save
 *  - emptyText         message when there are no recipes
 */
export default function RecipeGrid({
    recipes,
    loading,
    userId,
    onRequireLogin,
    onToggleHeart,
    onDelete,
    onRefresh,
    emptyText = "No recipes found.",
}) {
    const navigate = useNavigate();
    const [selected, setSelected] = useState(null);
    const [query, setQuery] = useState("");

    const filtered = recipes.filter((r) => {
        const haystack = `${recipeTitle(r)} ${r.ingredients || ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
    });

    const handleHeart = (recipe) => {
        if (!userId) {
            onRequireLogin?.();
            return;
        }
        onToggleHeart?.(recipe);
    };

    const handleDelete = async (recipe) => {
        const ok = window.confirm(
            `Are you sure you want to delete "${recipeTitle(recipe)}"?`
        );
        if (ok) await onDelete?.(recipe, userId);
    };

    const handleCopyAndEdit = (recipe, mode) => {
        if (!userId) {
            onRequireLogin?.();
            return;
        }

        const copy = {
            title: recipe.title,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions,
            recipeImage: recipe.recipeImage,
            notes: recipe.notes,
        };

        navigate('/chat', { state: { recipeToImprove: copy, saveMode: 'CREATE' } });
    };

    return (
        <>
            <div className="grid-search">
                <input
                    type="text"
                    placeholder="Search by name or ingredient..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="search-input"
                />
                {query && (
                    <button className="clear-search" onClick={() => setQuery("")}>
                        ×
                    </button>
                )}
            </div>

            <div className="recipe-grid">
                {loading ? (
                    <p className="loading-text">Loading…</p>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <p>{query ? "No matches found for your search." : emptyText}</p>
                    </div>
                ) : (
                    filtered.map((recipe, index) => (
                        <RecipeCard
                            key={recipe.recipeId || index}
                            recipe={recipe}
                            userId={userId}
                            onClick={() => setSelected(recipe)}
                            onToggleHeart={handleHeart}
                            onDelete={onDelete ? handleDelete : undefined}
                            onCopyAndEdit={handleCopyAndEdit}
                        />
                    ))
                )}
            </div>

            {selected && (
                <RecipeModal
                    recipe={selected}
                    userId={userId}
                    onRequireLogin={onRequireLogin}
                    onToggleHeart={handleHeart}
                    onClose={() => setSelected(null)}
                    onRefresh={() => {
                        onRefresh?.();
                        setSelected(null);
                    }}
                />
            )}
        </>
    );
}
