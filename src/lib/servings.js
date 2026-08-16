// Approximate serving size, estimated by the recipe assistant as part of its
// structured output ({recipe: {servings: N}}). N is a whole number: piece
// count for discrete bakes (12 cupcakes), standard servings for dishes that
// are hard to count (soup, pasta).

/** Coerce any raw value to a plausible whole serving count, or null. */
export function normalizeServings(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1 || n > 999) return null;
    return n;
}

/** Display copy for the faint serving-size line; null when unknown. */
export function formatServings(value) {
    const n = normalizeServings(value);
    return n === null ? null : `Serves ${n}`;
}
