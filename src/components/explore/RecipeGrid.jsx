import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, ChevronDown, ArrowUpDown, Check, X } from "lucide-react";
import RecipeCard from "./card/RecipeCard";
import SkeletonRecipeCard from "./card/SkeletonRecipeCard";
import RecipeModal from "./modal/RecipeModal";
import AdCard from "../ads/AdCard";
import { recipeTitle, heartedByList } from "../../lib/recipeUtils";
import { CATEGORY_OPTIONS } from "../../lib/categories";
import { AD_CARD_INTERVAL } from "../../lib/ads";
import "./Explore.css";

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Cards rendered per page; more are revealed via the Load More button so the
// initial render (and its interleaved ads) stays small.
const PAGE_SIZE = 24;

/**
 * Best-effort creation time for sorting. Newer recipes carry a server-stamped
 * createdAt; older records don't, so fall back to the timestamp embedded in
 * legacy ids ("recipe-<ms>"), then updatedAt (edits bump it, but it's the
 * only signal left), then epoch.
 */
const recipeStamp = (recipe) => {
    if (recipe?.createdAt) {
        const t = Date.parse(recipe.createdAt);
        if (!Number.isNaN(t)) return t;
    }
    const legacy = /^recipe-(\d+)$/.exec(recipe?.recipeId || "");
    if (legacy) return Number(legacy[1]);
    if (recipe?.updatedAt) {
        const t = Date.parse(recipe.updatedAt);
        if (!Number.isNaN(t)) return t;
    }
    return 0;
};

const SORT_OPTIONS = [
    { key: "mostSaved", label: "Most Saved" },
    { key: "recent", label: "Most Recent" },
    { key: "oldest", label: "Oldest" },
    { key: "az", label: "A to Z" },
    { key: "za", label: "Z to A" },
];

const SORT_COMPARATORS = {
    // Save-count ties break toward the newer recipe.
    mostSaved: (a, b) =>
        heartedByList(b).length - heartedByList(a).length ||
        recipeStamp(b) - recipeStamp(a),
    recent: (a, b) => recipeStamp(b) - recipeStamp(a),
    oldest: (a, b) => recipeStamp(a) - recipeStamp(b),
    az: (a, b) => recipeTitle(a).localeCompare(recipeTitle(b)),
    za: (a, b) => recipeTitle(b).localeCompare(recipeTitle(a)),
};

/**
 * Shared search + filters + grid + modal used by Explore, My Recipes and Favorites.
 *
 * Props:
 *  - recipes, loading
 *  - userId            current user id (or null)
 *  - onRequireLogin()  prompt login when a guest tries to heart
 *  - onToggleHeart(r)  toggle a heart (login already ensured)
 *  - onTogglePublish(r, published)  show/hide an owned recipe on Explore
 *  - onDelete(r)       delete a recipe (owner-gated by the card)
 *  - onRefresh()       refetch after a modal save
 *  - emptyText         message when there are no recipes
 *  - emptyAction       { label, to } CTA button shown under emptyText
 *  - showAds           interleave an AdSense card every few recipes (Explore only)
 */
export default function RecipeGrid({
    recipes,
    loading,
    userId,
    onRequireLogin,
    onToggleHeart,
    onTogglePublish,
    onDelete,
    onRefresh,
    emptyText = "No recipes found.",
    emptyAction = null,
    showAds = false,
}) {
    const navigate = useNavigate();
    // Track the open recipe by id, not by value, so the modal re-renders with
    // the list (e.g. after a publish toggle) instead of showing a stale copy.
    const [selectedId, setSelectedId] = useState(null);
    const selected = recipes.find((r) => r.recipeId === selectedId) ?? null;
    const [query, setQuery] = useState("");

    // Sort dropdown: closes on outside click; newest-first by default.
    const [sortKey, setSortKey] = useState("recent");
    const [sortOpen, setSortOpen] = useState(false);
    const sortRef = useRef(null);
    useEffect(() => {
        if (!sortOpen) return;
        const onClick = (e) => {
            if (sortRef.current && !sortRef.current.contains(e.target)) {
                setSortOpen(false);
            }
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [sortOpen]);

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

    const shown = [...filtered].sort(SORT_COMPARATORS[sortKey]);
    const sortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label;

    // Paginate the result list; a new search/filter/sort starts back at page 1
    // (state adjusted during render, per React's derived-state guidance).
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const resultsKey = JSON.stringify([query, applied, sortKey]);
    const [prevResultsKey, setPrevResultsKey] = useState(resultsKey);
    if (resultsKey !== prevResultsKey) {
        setPrevResultsKey(resultsKey);
        setVisibleCount(PAGE_SIZE);
    }
    const visible = shown.slice(0, visibleCount);
    const hasMore = shown.length > visibleCount;

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
        if (ok) {
            const success = await onDelete?.(recipe, userId);
            if (success === false) {
                alert('Failed to delete recipe. Please try again.');
            }
        }
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

                <div className="sort-dropdown" ref={sortRef}>
                    <button
                        className={`filter-btn${sortOpen ? " active" : ""}`}
                        onClick={() => setSortOpen((v) => !v)}
                        aria-expanded={sortOpen}
                        aria-haspopup="listbox"
                    >
                        <ArrowUpDown size={15} strokeWidth={2.2} />
                        <span className="filter-btn-label">{sortLabel}</span>
                        <ChevronDown
                            size={14}
                            strokeWidth={2.2}
                            className={`cat-dropdown-chevron${sortOpen ? " open" : ""}`}
                        />
                    </button>
                    {sortOpen && (
                        <div className="sort-menu" role="listbox">
                            {SORT_OPTIONS.map((option) => (
                                <button
                                    key={option.key}
                                    role="option"
                                    aria-selected={option.key === sortKey}
                                    className={`sort-option${option.key === sortKey ? " active" : ""}`}
                                    onClick={() => {
                                        setSortKey(option.key);
                                        setSortOpen(false);
                                    }}
                                >
                                    {option.label}
                                    {option.key === sortKey && (
                                        <Check size={14} strokeWidth={2.4} />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
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

            <div className={`recipe-grid${loading ? "" : " fade-in-stagger"}`}>
                {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                        <SkeletonRecipeCard key={`skeleton-${index}`} />
                    ))
                ) : shown.length === 0 ? (
                    <div className="empty-state">
                        <p>
                            {query || appliedCount > 0
                                ? "No matches found for your search."
                                : emptyText}
                        </p>
                        {emptyAction && !query && appliedCount === 0 && (
                            <button
                                className="btn btn-primary"
                                onClick={() => navigate(emptyAction.to)}
                            >
                                {emptyAction.label}
                            </button>
                        )}
                    </div>
                ) : (
                    visible.flatMap((recipe, index) => {
                        const nodes = [
                            <RecipeCard
                                key={recipe.recipeId || index}
                                recipe={recipe}
                                userId={userId}
                                onClick={() => setSelectedId(recipe.recipeId)}
                                onToggleHeart={handleHeart}
                                onTogglePublish={onTogglePublish}
                            />,
                        ];
                        // Slot an ad after every AD_CARD_INTERVAL-th recipe.
                        if (showAds && (index + 1) % AD_CARD_INTERVAL === 0) {
                            nodes.push(<AdCard key={`ad-${index}`} />);
                        }
                        return nodes;
                    })
                )}
            </div>

            {!loading && hasMore && (
                <div className="load-more-row">
                    <button
                        className="load-more-btn"
                        onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    >
                        Load More Recipes
                    </button>
                    <span className="load-more-count">
                        Showing {visible.length} of {shown.length}
                    </span>
                </div>
            )}

            {selected && (
                <RecipeModal
                    recipe={selected}
                    userId={userId}
                    onRequireLogin={onRequireLogin}
                    onToggleHeart={handleHeart}
                    onTogglePublish={onTogglePublish}
                    onDelete={onDelete ? handleDelete : undefined}
                    onClose={() => setSelectedId(null)}
                    onRefresh={() => {
                        onRefresh?.();
                        setSelectedId(null);
                    }}
                />
            )}
        </>
    );
}
