// Canonical category tags shared by the filter UI, the review/save flow, the
// manual edit checklists and the tag ovals. The backend carries the same list
// (ALLOWED_CATEGORY_TAGS in lambda/recipes_api/index.py and the structured
// output schema in claude_client.py) — keep them in sync when editing.
export const CATEGORY_OPTIONS = [
    "Breakfast",
    "Dessert",
    "Drinks",
    "Small Bites",
    "Savory",
    "Pasta",
    "Soups & Stews",
    "Salads",
    "Baked Goods",
    "Seafood",
    "Vegetarian",
    "Quick & Easy",
];

// Loose key so "quick and easy" / "QUICK & EASY" both resolve to the
// canonical "Quick & Easy" spelling.
const looseKey = (value) =>
    String(value)
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/\s+/g, " ")
        .trim();

const CANONICAL_BY_KEY = new Map(
    CATEGORY_OPTIONS.map((tag) => [looseKey(tag), tag])
);

/**
 * Map a raw list of tag strings onto the canonical list: unknown entries are
 * dropped, spellings are canonicalized, duplicates removed, and the result is
 * ordered like CATEGORY_OPTIONS so tags always render in a stable order.
 */
export function normalizeTags(rawTags) {
    if (!Array.isArray(rawTags)) return [];
    const matched = new Set();
    for (const raw of rawTags) {
        const canonical = CANONICAL_BY_KEY.get(looseKey(raw));
        if (canonical) matched.add(canonical);
    }
    return CATEGORY_OPTIONS.filter((tag) => matched.has(tag));
}
