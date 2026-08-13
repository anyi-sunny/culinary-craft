// Parsing helpers for the plain-text recipe blocks the agents emit.
//
// Two agents produce these: the Architect's review-modal output (TITLE /
// INGREDIENTS / INSTRUCTIONS, closing remarks after a "|") and the Portion
// Architect's rescale output (same tags plus SERVES and NOTES). Both are
// contracted to plain text, but models drift, so parse defensively.

/**
 * Strips markdown formatting that an agent sometimes adds (e.g. **bold**, #
 * headings, `code`). Review fields are plain <input>/<textarea> and the saved
 * record is plain text, so leftover markdown would show up literally.
 */
export function stripMarkdown(text = "") {
    return String(text)
        .replace(/\*\*/g, "")           // bold markers
        .replace(/__/g, "")             // alt bold / underline
        .replace(/`/g, "")              // inline code ticks
        .replace(/^\s*#{1,6}\s*/gm, "") // ATX headings
        .split("\n")
        .map((line) => line.replace(/\s+$/, "")) // trailing whitespace per line
        // collapse runs of blank lines down to a single blank line
        .filter((line, idx, arr) => !(line.trim() === "" && (arr[idx - 1]?.trim() ?? "") === ""))
        .join("\n")
        .trim();
}

/**
 * Pull a TITLE / INGREDIENTS / INSTRUCTIONS block out of an agent response.
 * Returns null when the response doesn't carry all three (the caller then
 * falls back to showing the raw reply).
 *
 * Optional trailing sections (SERVES:, NOTES:) are captured when present and
 * kept out of the instructions text.
 */
export function parseRecipeBlock(text) {
    // Strip markdown BEFORE matching so wrapped tags like "**TITLE:**" parse.
    const clean = stripMarkdown(text ?? "");

    const title = clean.match(/(?:TITLE|RECIPE_NAME):\s*(.*)/i);
    const ingredients = clean.match(
        /(?:INGREDIENTS|RECIPE_INGREDIENTS):\s*([\s\S]*?)(?=INSTRUCTIONS|RECIPE_INSTRUCTIONS|$)/i
    );
    const instructions = clean.match(
        /(?:INSTRUCTIONS|RECIPE_INSTRUCTIONS):\s*([\s\S]*?)(?=\n\s*NOTES:|$)/i
    );
    if (!title || !ingredients || !instructions) return null;

    const serves = clean.match(/(?:SERVES|SERVINGS):\s*(\d+)/i);
    const notes = clean.match(/NOTES:\s*([\s\S]*)/i);

    return {
        title: stripMarkdown(title[1]),
        ingredients: stripMarkdown(ingredients[1]),
        instructions: stripMarkdown(instructions[1]),
        servings: serves ? Number(serves[1]) : null,
        notes: notes ? stripMarkdown(notes[1]) : "",
    };
}
