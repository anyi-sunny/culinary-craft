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
 * The recipe's phases in an editable shape: ingredient and step groups
 * merged by name (position order preserved), items joined one-per-line so
 * each phase can back a pair of textareas. Always returns at least one
 * phase (blank for an empty recipe) so the phase editor has something to
 * render; a lone phase keeps its (possibly empty) name.
 * @returns {Array<{name: string, ingredients: string, steps: string}>}
 */
export function editablePhases(recipe) {
  const { ingredients, steps } = recipeParts(recipe);
  const order = [];
  const byName = new Map();
  const phaseFor = (name) => {
    const key = name || '';
    if (!byName.has(key)) {
      byName.set(key, { name: name || '', ingredients: [], steps: [] });
      order.push(key);
    }
    return byName.get(key);
  };
  ingredients.forEach((g) => phaseFor(g.name).ingredients.push(...g.items));
  steps.forEach((g) => phaseFor(g.name).steps.push(...g.items));
  const phases = order.map((key) => {
    const phase = byName.get(key);
    return {
      name: phase.name,
      ingredients: phase.ingredients.join('\n'),
      steps: phase.steps.join('\n'),
    };
  });
  return phases.length ? phases : [{ name: '', ingredients: '', steps: '' }];
}

function linesToItems(text) {
  return String(text || '')
    .split('\n')
    .map(cleanItem)
    .filter(Boolean);
}

/**
 * Serialize edited phases back into recipe fields. The flat strings mirror
 * the backend's render_flat ("For the <name>:" headers + "- " bullets when
 * multi-part) so they round-trip through parseFlatSection. `components` is
 * rebuilt from the same lines when multi-part — the phase editor's output
 * is the structure, so it's never stale — and null otherwise (single-part
 * flat text carries no structure worth storing). Phases emptied of both
 * ingredients and steps are dropped; the backend requires component names,
 * so a blanked title falls back to "Phase N".
 * @returns {{ingredients: string, instructions: string, components: Array|null}}
 */
export function phasesToRecipeFields(phases) {
  const cleaned = (phases || [])
    .map((p, i) => ({
      name: String(p.name || '').trim() || `Phase ${i + 1}`,
      ingredients: linesToItems(p.ingredients),
      steps: linesToItems(p.steps),
    }))
    .filter((p) => p.ingredients.length || p.steps.length);
  const multi = cleaned.length > 1;
  const ingLines = [];
  const stepLines = [];
  for (const c of cleaned) {
    if (multi) {
      const header = `For the ${c.name}:`;
      ingLines.push(header);
      stepLines.push(header);
    }
    c.ingredients.forEach((item) => ingLines.push(`- ${item}`));
    c.steps.forEach((step) => stepLines.push(`- ${step}`));
  }
  return {
    ingredients: ingLines.join('\n'),
    instructions: stepLines.join('\n'),
    components: multi ? cleaned : null,
  };
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
