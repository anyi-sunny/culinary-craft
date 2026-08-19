// Parse ingredient strings into structured components
// Input: "1 1/2 sticks butter, softened" or "2 cups all-purpose flour"
// Output: { quantity: "1 1/2", unit: "sticks", name: "butter" }

const COMMON_UNITS = new Set([
  // Weight
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'mg', 'milligram', 'milligrams',

  // Volume
  'ml', 'milliliter', 'milliliters', 'l', 'liter', 'liters',
  'tsp', 'teaspoon', 'teaspoons', 't',
  'tbsp', 'tablespoon', 'tablespoons', 'tb', 'tbs',
  'cup', 'cups', 'c',
  'fl oz', 'fl. oz', 'fluid ounce', 'fluid ounces',
  'pint', 'pints', 'pt',
  'quart', 'quarts', 'qt',
  'gallon', 'gallons', 'gal',

  // Count/discrete
  'stick', 'sticks',
  'slice', 'slices',
  'clove', 'cloves',
  'piece', 'pieces',
  'piece', 'pieces',
  'head', 'heads',
  'bulb', 'bulbs',
  'bunch', 'bunches',
  'leaf', 'leaves',
  'sprig', 'sprigs',
  'fillet', 'fillets',
  'can', 'cans',
  'jar', 'jars',
  'package', 'packages', 'pkg', 'pkgs',
  'egg', 'eggs',
  'pinch', 'pinches',
  'dash', 'dashes',

  // Other
  'sheet', 'sheets',
  'strip', 'strips',
]);

// One numeric token: "1", "1.5", "1/2", "½", "1½"
const QUANT_TOKEN = String.raw`(?:\d+\s*\/\s*\d+|\d*[¼½¾⅐-⅞]|\d+(?:\.\d+)?)`;
// A token or a range of tokens ("1–2", "1 - 2"), any dash style
const QUANT_PART = `${QUANT_TOKEN}(?:\\s*[-–—]\\s*${QUANT_TOKEN})?`;
// Leading quantity, possibly a mixed number ("1 1/2", "1 ½"), then the rest
const LEADING_QUANT_REGEX = new RegExp(`^(${QUANT_PART}(?:\\s+${QUANT_PART})*)\\s+(.*)$`);

// Extract unit from the remaining part of the ingredient string
function extractUnit(remaining) {
  if (!remaining) return '';

  const words = remaining.split(/\s+/);
  let unit = '';
  let startIdx = 0;

  // Check for multi-word units first (e.g., "fl oz")
  for (let i = 0; i < Math.min(2, words.length); i++) {
    const candidate = words.slice(0, i + 1).join(' ').toLowerCase();
    if (COMMON_UNITS.has(candidate)) {
      unit = words.slice(0, i + 1).join(' ');
      startIdx = i + 1;
    }
  }

  return { unit, nameStartIdx: startIdx };
}

export function parseIngredient(ingredientStr) {
  if (!ingredientStr || typeof ingredientStr !== 'string') {
    return { quantity: '', unit: '', name: ingredientStr || '' };
  }

  const trimmed = ingredientStr.trim();
  if (!trimmed) {
    return { quantity: '', unit: '', name: '' };
  }

  // Drop parentheticals before the comma split — "Juice of ½ lemon (1–2 tbsp,
  // or more to taste)" must not be truncated at the comma inside the parens
  const noParens = trimmed.replace(/\([^)]*\)/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Split by comma to remove trailing descriptors (e.g., "butter, softened" -> "butter")
  const basePart = noParens.split(',')[0].trim();

  // Try to extract quantity at the start
  const quantMatch = basePart.match(LEADING_QUANT_REGEX);

  let quantity = '';
  let remaining = basePart;

  if (quantMatch) {
    quantity = quantMatch[1].trim();
    remaining = quantMatch[2].trim();
  }

  // Extract unit from the remaining part
  const { unit, nameStartIdx } = extractUnit(remaining);

  // Name is everything after the quantity and unit
  const words = remaining.split(/\s+/);
  const name = words.slice(nameStartIdx).join(' ').trim();

  return {
    quantity: quantity || '',
    unit: unit || '',
    name: name || remaining || ''
  };
}

// Format a parsed ingredient back to a display string
export function formatIngredient(parsed) {
  const { quantity = '', unit = '', name = '' } = parsed;

  const parts = [];
  if (quantity) parts.push(quantity);
  if (unit) parts.push(unit);
  if (name) parts.push(name);

  return parts.join(' ');
}

// Format for shopping list display (quantity + unit only, if available)
export function formatShoppingListQuantity(parsed) {
  const { quantity = '', unit = '' } = parsed;

  if (!quantity && !unit) return '';

  const parts = [];
  if (quantity) parts.push(quantity);
  if (unit) parts.push(unit);

  return parts.join(' ') || '';
}
