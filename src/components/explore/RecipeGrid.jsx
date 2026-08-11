import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import RecipeCard from "./card/RecipeCard";
import SkeletonRecipeCard from "./card/SkeletonRecipeCard";
import RecipeModal from "./modal/RecipeModal";
import { recipeTitle } from "../../lib/recipeUtils";
import { CATEGORY_OPTIONS } from "../../lib/categories";
import "./Explore.css";

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Shared search + filters + grid + modal used by Explore, My Recipes and Favorites.
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
    const [selected, setSelected] = useState(null);
    const [query, setQuery] = useState("");

    // Filter UI state: draft edits live in the panel until "Apply Filters".
    const [filterOpen, setFilterOpen] = useState(false);
    const [catDropdownOpen, setCatDropdownOpen] = useState(false);
    const [draftCategories, setDraftCategories] = useState([]);
    const [draftIngredients, setDraftIngredients] = useState([]);
    const [ingredientQuery, setIngredientQuery] = useState("");
    const [applied, setApplied] = useState({ categories: [], ingredients: [] });

    const filtersDirty =
        !sameSet(draftCategories, applied.categories) ||
        !sameSet(draftIngredients, applied.ingredients);
    const appliedCount = applied.categories.length + applied.ingredients.length;

    const toggleCategory = (cat) => {
        setDraftCategories((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        );
    };

    const addIngredient = () => {
        const value = ingredientQuery.trim();
        if (!value) return;
        const exists = draftIngredients.some(
            (i) => i.toLowerCase() === value.toLowerCase()
        );
        if (!exists) setDraftIngredients((prev) => [...prev, value]);
        setIngredientQuery("");
    };

    const removeDraftIngredient = (ing) => {
        setDraftIngredients((prev) => prev.filter((i) => i !== ing));
    };

    const applyFilters = () => {
        setApplied({
            categories: [...draftCategories],
            ingredients: [...draftIngredients],
        });
        setFilterOpen(false);
        setCatDropdownOpen(false);
    };

    // Removing an applied chip takes effect immediately (draft stays in sync).
    const removeAppliedFilter = (type, value) => {
        if (type === "category") {
            setDraftCategories((prev) => prev.filter((c) => c !== value));
            setApplied((prev) => ({
                ...prev,
                categories: prev.categories.filter((c) => c !== value),
            }));
        } else {
            setDraftIngredients((prev) => prev.filter((i) => i !== value));
            setApplied((prev) => ({
                ...prev,
                ingredients: prev.ingredients.filter((i) => i !== value),
            }));
        }
    };

    const filtered = recipes.filter((r) => {
        const haystack = `${recipeTitle(r)} ${r.ingredients || ""}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;

        const ingredientText = (r.ingredients || "").toLowerCase();
        const ingredientsOk = applied.ingredients.every((tag) =>
            ingredientText.includes(tag.toLowerCase())
        );
        if (!ingredientsOk) return false;

        if (applied.categories.length > 0) {
            // Set membership keeps the tag check O(1) per applied filter.
            // Untagged recipes simply don't match category filters (they
            // remain findable by ingredient/text search).
            const tagSet = new Set((r.tags || []).map((t) => String(t).toLowerCase()));
            if (!applied.categories.some((c) => tagSet.has(c.toLowerCase()))) {
                return false;
            }
        }
        return true;
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

    const renderChip = (label, onRemove, ingredient = false) => (
        <span
            key={label}
            className={`filter-chip${ingredient ? " filter-chip--ingredient" : ""}`}
        >
            {label}
            <button
                className="filter-chip-remove"
                onClick={onRemove}
                aria-label={`Remove ${label} filter`}
            >
                <X size={12} strokeWidth={2.4} />
            </button>
        </span>
    );

    return (
        <>
            <div className="grid-search-row">
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

                <button
                    className={`filter-btn${filterOpen || appliedCount > 0 ? " active" : ""}`}
                    onClick={() => setFilterOpen((v) => !v)}
                    aria-expanded={filterOpen}
                >
                    <SlidersHorizontal size={15} strokeWidth={2.2} />
                    <span className="filter-btn-label">Filter</span>
                    {appliedCount > 0 && (
                        <span className="filter-count">{appliedCount}</span>
                    )}
                </button>
            </div>

            <AnimatePresence>
                {filterOpen && (
                    <motion.div
                        className="filter-panel"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="filter-section">
                            <span className="filter-label">Categories</span>
                            <div className="cat-dropdown">
                                <button
                                    className="cat-dropdown-toggle"
                                    onClick={() => setCatDropdownOpen((v) => !v)}
                                    aria-expanded={catDropdownOpen}
                                >
                                    {draftCategories.length > 0
                                        ? `${draftCategories.length} selected`
                                        : "Select categories"}
                                    <ChevronDown
                                        size={14}
                                        strokeWidth={2.2}
                                        className={`cat-dropdown-chevron${catDropdownOpen ? " open" : ""}`}
                                    />
                                </button>
                                {catDropdownOpen && (
                                    <div className="cat-dropdown-menu">
                                        {CATEGORY_OPTIONS.map((cat) => (
                                            <label key={cat} className="cat-option">
                                                <input
                                                    type="checkbox"
                                                    checked={draftCategories.includes(cat)}
                                                    onChange={() => toggleCategory(cat)}
                                                />
                                                {cat}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="filter-section">
                            <span className="filter-label">Ingredients</span>
                            <div className="ingredient-add">
                                <input
                                    type="text"
                                    className="ingredient-input"
                                    placeholder="e.g. chicken, basil, honey..."
                                    value={ingredientQuery}
                                    onChange={(e) => setIngredientQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            addIngredient();
                                        }
                                    }}
                                />
                                <button
                                    className="ingredient-add-btn"
                                    onClick={addIngredient}
                                    disabled={!ingredientQuery.trim()}
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        {(draftCategories.length > 0 || draftIngredients.length > 0) && (
                            <div className="filter-chips">
                                {draftCategories.map((cat) =>
                                    renderChip(cat, () => toggleCategory(cat))
                                )}
                                {draftIngredients.map((ing) =>
                                    renderChip(ing, () => removeDraftIngredient(ing), true)
                                )}
                            </div>
                        )}

                        <div className="filter-actions">
                            <button
                                className="apply-filters-btn"
                                onClick={applyFilters}
                                disabled={!filtersDirty}
                            >
                                Apply Filters
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Active filters stay visible (and removable) once the panel closes */}
            {!filterOpen && appliedCount > 0 && (
                <div className="filter-chips filter-chips--active">
                    {applied.categories.map((cat) =>
                        renderChip(cat, () => removeAppliedFilter("category", cat))
                    )}
                    {applied.ingredients.map((ing) =>
                        renderChip(ing, () => removeAppliedFilter("ingredient", ing), true)
                    )}
                </div>
            )}

            <div className="recipe-grid">
                {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                        <SkeletonRecipeCard key={`skeleton-${index}`} />
                    ))
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <p>
                            {query || appliedCount > 0
                                ? "No matches found for your search."
                                : emptyText}
                        </p>
                    </div>
                ) : (
                    filtered.map((recipe, index) => (
                        <RecipeCard
                            key={recipe.recipeId || index}
                            recipe={recipe}
                            userId={userId}
                            onClick={() => setSelected(recipe)}
                            onToggleHeart={handleHeart}
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
                    onDelete={onDelete ? handleDelete : undefined}
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
