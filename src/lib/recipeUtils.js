// Pure helpers shared across the recipe UI.

/** Display title, tolerating legacy records that used `recipe_name`. */
export function recipeTitle(recipe) {
    return recipe?.title || recipe?.recipe_name || "Untitled Recipe";
}

/**
 * Normalize `heartedBy` to a plain array of userIds. DynamoDB string sets come
 * back from lib-dynamodb as a JS Set, but older/edited items may be arrays.
 */
export function heartedByList(recipe) {
    const h = recipe?.heartedBy;
    if (!h) return [];
    if (Array.isArray(h)) return h;
    if (h instanceof Set) return [...h];
    if (typeof h.values === "function") return [...h.values()]; // SetLike
    return [];
}

/** Has this user hearted this recipe? */
export function isHearted(recipe, userId) {
    if (!userId) return false;
    return heartedByList(recipe).includes(userId);
}

/**
 * Can this user manually edit/delete the recipe?
 * Legacy recipes (no ownerId) stay editable by anyone; owned recipes are
 * restricted to their owner.
 */
export function canEdit(recipe, userId) {
    if (!recipe?.ownerId) return true;
    return recipe.ownerId === userId;
}

/** Does this user own the recipe (false for legacy/owner-less recipes)? */
export function isOwner(recipe, userId) {
    return Boolean(recipe?.ownerId) && recipe.ownerId === userId;
}

/**
 * Is this recipe visible on Explore? New recipes start private until their
 * owner publishes them; recipes predating the flag are public.
 * The backend applies the same rule when it decides what to return.
 */
export function isPublished(recipe) {
    return recipe?.published !== false;
}
