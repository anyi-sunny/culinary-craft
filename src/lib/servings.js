// Approximate serving size, estimated by the Bedrock agent. Like category
// tags, the agent appends a hidden marker line to every full-recipe response
// (the agent prompt in the backend CDK stack carries the contract — keep in
// sync): @@SERVINGS: 12@@
// N is a whole number: piece count for discrete bakes (12 cupcakes), standard
// servings for dishes that are hard to count (soup, pasta).
const SERVINGS_MARKER_RE = /\n?\s*@@SERVINGS:([^@]*)@@\s*/gi;

/** Coerce any raw value to a plausible whole serving count, or null. */
export function normalizeServings(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1 || n > 999) return null;
    return n;
}

/**
 * Pull the agent's hidden @@SERVINGS: N@@ marker out of a response.
 * Returns the cleaned text (safe to display/parse) and the serving count
 * (null when the response carried no usable marker).
 */
export function extractServings(text) {
    const source = String(text ?? "");
    let servings = null;
    const cleaned = source
        .replace(SERVINGS_MARKER_RE, (_, inner) => {
            const digits = inner.match(/\d+/);
            if (digits) servings = normalizeServings(digits[0]) ?? servings;
            return "\n";
        })
        .trim();
    return { text: cleaned, servings };
}

/** Display copy for the faint serving-size line; null when unknown. */
export function formatServings(value) {
    const n = normalizeServings(value);
    return n === null ? null : `Serves ${n}`;
}
