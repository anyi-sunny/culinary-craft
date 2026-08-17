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

// Regex to match fractions
const FRACTION_REGEX = /^(\d+)\s*\/\s*(\d+)$/;

// Parse a string that may contain fractions like "1 1/2"
function parseQuantity(quantStr) {
  if (!quantStr) return '';

  const parts = quantStr.trim().split(/\s+/);
  const result = [];

  for (const part of parts) {
    if (FRACTION_REGEX.test(part)) {
      result.push(part);
    } else if (/^\d+$/.test(part)) {
      result.push(part);
    } else if (/^\d*\.?\d+$/.test(part)) {
      result.push(part);
    } else {
      break; // Stop when we hit non-numeric
    }
  }

  return result.join(' ');
}

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

  // Split by comma to remove trailing descriptors (e.g., "butter, softened" -> "butter")
  const basePart = trimmed.split(',')[0].trim();

  // Try to extract quantity at the start
  const quantMatch = basePart.match(/^((?:\d+\s*\/\s*\d+|\d+\.?\d*)\s*(?:\d+\s*\/\s*\d+|\d+\.?\d*)*)\s+(.*)/);

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
