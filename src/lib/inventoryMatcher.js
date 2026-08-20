// Match recipe ingredients to inventory items using word matching logic
// Similar to the step ingredients matcher but for inventory lookup

function normalizeForMatching(text) {
  return String(text || '').toLowerCase().trim();
}

// Measurement and prep words that appear in ingredient lines but say nothing
// about which food it is — without this list "2 large eggs" would match a
// "Large Macaroni" inventory item on the word "large".
const STOPWORDS = new Set([
  'and', 'the', 'with', 'for', 'into', 'plus', 'taste', 'optional', 'divided',
  'cup', 'cups', 'tbsp', 'tsp', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons',
  'ounce', 'ounces', 'pound', 'pounds', 'gram', 'grams', 'kilogram', 'kilograms',
  'pinch', 'dash', 'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces',
  'small', 'medium', 'large', 'extra', 'fresh', 'freshly', 'dried', 'frozen',
  'chopped', 'minced', 'diced', 'sliced', 'grated', 'shredded', 'peeled',
  'finely', 'thinly', 'roughly', 'softened', 'melted', 'room', 'temperature',
]);

function extractWords(text) {
  return text
    .toLowerCase()
    .split(/[\s\-,()]+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

function wordMatch(ingredientLine, inventoryName) {
  const ingWords = extractWords(ingredientLine);
  const invWords = extractWords(inventoryName);

  if (ingWords.length === 0 || invWords.length === 0) {
    return normalizeForMatching(ingredientLine) === normalizeForMatching(inventoryName);
  }

  // Check if any significant word from the ingredient appears in inventory name
  const matches = ingWords.some(w => invWords.some(inv => inv === w || inv.startsWith(w)));
  return matches;
}

/**
 * Match recipe ingredients to user's inventory items.
 * Returns a map of inventory item IDs to their matched ingredient lines.
 * @param {Array<string>} ingredientLines - Flat list of ingredient strings from recipe
 * @param {Array<object>} inventoryItems - User's inventory items {itemId, name, quantity, unit, ...}
 * @returns {Array<{itemId, name, quantity, unit, ingredientLine, isMatched}>}
 */
export function matchIngredientsToInventory(ingredientLines, inventoryItems) {
  const matched = [];
  const matchedItemIds = new Set();

  // For each ingredient line, find the best matching inventory item
  for (const ingLine of ingredientLines) {
    if (!ingLine.trim()) continue;

    let bestMatch = null;
    let bestScore = 0;

    for (const item of inventoryItems) {
      if (matchedItemIds.has(item.itemId)) continue;
      if (!wordMatch(ingLine, item.name)) continue;

      // Score higher for exact substring matches
      const ingNorm = normalizeForMatching(ingLine);
      const itemNorm = normalizeForMatching(item.name);
      const score = itemNorm.includes(ingNorm)
        ? 2
        : ingNorm.includes(itemNorm)
          ? 1.5
          : 1;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch) {
      matched.push({
        itemId: bestMatch.itemId,
        name: bestMatch.name,
        quantity: bestMatch.quantity || '',
        unit: bestMatch.unit || '',
        ingredientLine: ingLine,
        isMatched: true,
      });
      matchedItemIds.add(bestMatch.itemId);
    }
  }

  return matched;
}

/**
 * Extract ingredient names from a recipe (flattened).
 * Handles both flat text and structured components.
 */
export function extractRecipeIngredients(recipe) {
  const ingredients = [];

  if (recipe?.components && Array.isArray(recipe.components)) {
    // Structured components
    for (const component of recipe.components) {
      if (Array.isArray(component.ingredients)) {
        ingredients.push(...component.ingredients);
      }
    }
  } else if (recipe?.ingredients) {
    // Flat text - parse lines
    const lines = String(recipe.ingredients)
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.match(/^for the\s+.+:$/i));

    ingredients.push(
      ...lines.map(line => line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim()).filter(Boolean)
    );
  }

  return ingredients;
}
