// Canonical category tags shared by the filter UI, the review/save flow, the
// manual edit checklists and the tag ovals. The Bedrock agent prompt (backend
// CDK stack) carries the same list — keep the two in sync when editing.
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

// The agent appends its selected tags behind this marker so they can be
// stripped from the chat transcript and cached instead of shown to the user.
// Example agent output line: @@TAGS: Breakfast, Quick & Easy@@
const TAGS_MARKER_RE = /\n?\s*@@TAGS:([^@]*)@@\s*/gi;

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

/**
 * Pull the agent's hidden @@TAGS: ...@@ marker out of a response.
 * Returns the cleaned text (safe to display/parse) and the canonical tag list
 * (empty when the response carried no marker).
 */
export function extractCategoryTags(text) {
    const source = String(text ?? "");
    const found = [];
    const cleaned = source
        .replace(TAGS_MARKER_RE, (_, inner) => {
            found.push(...inner.split(","));
            return "\n";
        })
        .trim();
    return { text: cleaned, tags: normalizeTags(found) };
}
