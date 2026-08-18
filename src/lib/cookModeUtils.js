/**
 * Helpers for Cook Mode: turn a recipe into per-phase slide decks and
 * detect timed steps ("bake 25-30 minutes" -> 25-minute timer).
 */

import { recipeParts } from "./recipeParts";

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

/**
 * Build the cook-mode decks: one track per recipe phase (component), each
 * with its own ingredients overview slide followed by its steps. Single-part
 * recipes produce exactly one track (the old single-deck behavior).
 *
 * Phases come from recipeParts(), which prefers structured `components` and
 * falls back to parsing the flat text — the ingredient and step groups of a
 * phase are matched up by name.
 *
 * Step slides carry `ingredientRefs`: the step's mentioned ingredients
 * (full lines, with quantities) from the record's server-derived
 * `stepIngredients` field (computed on save by the backend's
 * step_ingredients.py; absent on records that predate it until the
 * backfill runs). Aligned to phases by name, by position as a fallback.
 *
 * @returns {Array<{name: string|null, slides: [], stepCount: number}>}
 */
export function buildTracks(recipe) {
    const { ingredients, steps } = recipeParts(recipe);
    const order = [];
    const byName = new Map();
    const phaseFor = (name) => {
        const key = name || "";
        if (!byName.has(key)) {
            byName.set(key, { name: name || null, ingredients: [], steps: [] });
            order.push(key);
        }
        return byName.get(key);
    };
    ingredients.forEach((g) => phaseFor(g.name).ingredients.push(...g.items));
    steps.forEach((g) => phaseFor(g.name).steps.push(...g.items));

    const refPhases = Array.isArray(recipe?.stepIngredients) ? recipe.stepIngredients : [];
    const refsFor = (phase, pi) =>
        refPhases.find(
            (p) => String(p?.name || "").toLowerCase() === String(phase.name || "").toLowerCase()
        ) ?? (refPhases.length === order.length ? refPhases[pi] : null);

    return order
        .map((key, pi) => {
            const phase = byName.get(key);
            const refPhase = refsFor(phase, pi);
            const slides = [];
            if (phase.ingredients.length) {
                slides.push({ type: "ingredients", items: phase.ingredients });
            }
            phase.steps.forEach((text, i) =>
                slides.push({
                    type: "step",
                    text,
                    stepNumber: i + 1,
                    timerSeconds: parseTimerSeconds(text),
                    ingredientRefs: (Array.isArray(refPhase?.steps?.[i]) ? refPhase.steps[i] : []).filter(
                        (s) => typeof s === "string" && s
                    ),
                })
            );
            return { name: phase.name, slides, stepCount: phase.steps.length };
        })
        .filter((t) => t.slides.length);
}

export function formatClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    return `${h > 0 ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
}
