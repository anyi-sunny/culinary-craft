// Grouped view of a recipe's ingredients and steps, one group per part
// ("Cupcake Batter", "Vanilla Icing"). Prefers the structured `components`
// field; recipes without it (legacy records, hand-edited flat text) fall
// back to parsing the flat strings, including the server-derived
// "For the <name>:" headers, so both shapes render identically.

const BULLET_RE = /^[-*•]\s+/;
const NUMBER_RE = /^\d+[.)]\s+/;
// A short, non-bulleted line ending in a colon introduces a part.
// render_flat emits "For the <name>:"; hand-written text often uses a
// bare "<name>:" — both collapse to the name alone.
const HEADER_RE = /^(?:for the\s+)?(.{1,80}?):$/i;

function cleanItem(line) {
  // List markers come off because the renderer draws its own; a numbered
  // step kept as "1. Preheat…" would double-number inside the <ol>.
  return line.replace(BULLET_RE, '').replace(NUMBER_RE, '').trim();
}

/**
 * Parse one flat text section (ingredients or instructions) into groups.
 * @returns {Array<{name: string|null, items: string[]}>}
 */
export function parseFlatSection(text) {
  const groups = [];
  let current = { name: null, items: [] };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const isItem = BULLET_RE.test(line) || NUMBER_RE.test(line);
    const header = !isItem && line.match(HEADER_RE);
    if (header) {
      if (current.items.length) groups.push(current);
      current = { name: header[1].trim(), items: [] };
    } else {
      const item = cleanItem(line);
      if (item) current.items.push(item);
    }
  }
  if (current.items.length) groups.push(current);
  return groups;
}

function validComponents(components) {
  return (
    Array.isArray(components) &&
    components.length > 0 &&
    components.every(
      (c) =>
        c &&
        typeof c === 'object' &&
        (Array.isArray(c.ingredients) || Array.isArray(c.steps))
    )
  );
}

/**
 * Grouped ingredients and steps for a recipe record.
 * Single-part recipes get a null group name (no sub-header to draw).
 * @returns {{ingredients: Array<{name, items}>, steps: Array<{name, items}>}}
 */
export function recipeParts(recipe) {
  const components = recipe?.components;
  if (validComponents(components)) {
    const multi = components.length > 1;
    const toGroups = (key) =>
      components
        .map((c) => ({
          name: multi ? String(c.name || '').trim() || null : null,
          items: (Array.isArray(c[key]) ? c[key] : [])
            .map((s) => String(s).trim())
            .filter(Boolean),
        }))
        .filter((g) => g.items.length);
    const ingredients = toGroups('ingredients');
    const steps = toGroups('steps');
    if (ingredients.length || steps.length) return { ingredients, steps };
  }
  return {
    ingredients: parseFlatSection(recipe?.ingredients),
    steps: parseFlatSection(recipe?.instructions),
  };
}
