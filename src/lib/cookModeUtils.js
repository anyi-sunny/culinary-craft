/**
 * Helpers for Cook Mode: turn a recipe's plain-text fields into slides and
 * detect timed steps ("bake 25-30 minutes" -> 25-minute timer).
 */

/** Split a plain-text block into clean list items (strips bullets/numbers). */
export function splitList(text = "") {
    return String(text)
        .split("\n")
        .map((line) =>
            line
                .replace(/^\s*[-*•]\s*/, "")
                .replace(/^\s*\d+[.)]\s*/, "")
                .trim()
        )
        .filter(Boolean);
}

/**
 * Find a duration in a step. Returns seconds, or null when the step has no
 * time in it. Ranges ("25-30 minutes", "1 to 2 hours") use the LOWER bound —
 * the cook can always add time.
 */
export function parseTimerSeconds(text = "") {
    const m = String(text).match(
        /(\d+)(?:\s*(?:-|–|—|\bto\b)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i
    );
    if (!m) return null;
    const amount = parseInt(m[1], 10);
    const unit = m[3].toLowerCase();
    if (unit.startsWith("h")) return amount * 3600;
    if (unit.startsWith("m")) return amount * 60;
    return amount;
}

/** Build the cook-mode slide deck: ingredients overview first, then steps. */
export function buildSlides(recipe) {
    const ingredients = splitList(recipe?.ingredients);
    const steps = splitList(recipe?.instructions);
    const slides = [
        { type: "ingredients", items: ingredients },
        ...steps.map((text) => ({
            type: "step",
            text,
            timerSeconds: parseTimerSeconds(text),
        })),
    ];
    return slides;
}

export function formatClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    return `${h > 0 ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
}
