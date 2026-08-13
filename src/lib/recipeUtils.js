// Pure helpers shared across the recipe UI.

/** Display title, tolerating legacy records that used `recipe_name`. */
export function recipeTitle(recipe) {
    return recipe?.title || recipe?.recipe_name || "Untitled Recipe";
}

/**
 * Who to credit on a recipe. The backend resolves `creatorUsername` from the
 * author's profile on every read, so a rename shows up everywhere at once;
 * authors with no profile (anonymous saves) fall back to a generic label.
 * Returns null when there is nothing to credit at all.
 */
export function creatorName(recipe) {
    if (recipe?.creatorUsername) return recipe.creatorUsername;
    return recipe?.ownerId ? "Anonymous chef" : null;
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
