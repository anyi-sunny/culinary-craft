// Utility functions for shopping list management

// Check if two items should be merged (same name, case-insensitive)
export function shouldMergeItems(item1, item2) {
  return item1.name.toLowerCase().trim() === item2.name.toLowerCase().trim();
}

// Try to add quantities (e.g., "1.5" + "2" = "3.5")
function tryAddQuantities(qty1, qty2) {
  try {
    const num1 = parseFloat(qty1 || '0');
    const num2 = parseFloat(qty2 || '0');
    if (isNaN(num1) || isNaN(num2)) return null;
    const sum = num1 + num2;
    return sum.toString();
  } catch (e) {
    return null;
  }
}

// Format a fraction from a decimal (e.g., 1.5 -> "1 1/2", 0.5 -> "1/2")
function decimalToFraction(decimal) {
  const num = parseFloat(decimal);
  if (Number.isInteger(num)) return num.toString();

  // Handle common fractions
  const whole = Math.floor(num);
  const frac = num - whole;

  if (Math.abs(frac - 0.5) < 0.01) {
    return whole > 0 ? `${whole} 1/2` : '1/2';
  } else if (Math.abs(frac - 0.25) < 0.01) {
    return whole > 0 ? `${whole} 1/4` : '1/4';
  } else if (Math.abs(frac - 0.75) < 0.01) {
    return whole > 0 ? `${whole} 3/4` : '3/4';
  } else if (Math.abs(frac - 0.33) < 0.01) {
    return whole > 0 ? `${whole} 1/3` : '1/3';
  } else if (Math.abs(frac - 0.67) < 0.01) {
    return whole > 0 ? `${whole} 2/3` : '2/3';
  }

  return decimal;
}

// Merge two shopping list items (combine quantities and linked recipes)
export function mergeShoppingListItems(newItem, existingItem) {
  // Combine quantities if both have units and units match
  let mergedQuantity = existingItem.quantity;
  if (newItem.quantity && existingItem.quantity && newItem.unit === existingItem.unit) {
    const combined = tryAddQuantities(newItem.quantity, existingItem.quantity);
    if (combined !== null) {
      mergedQuantity = decimalToFraction(combined);
    }
  }

  // Combine linked recipes
  const linkedRecipes = [...(existingItem.linkedRecipes || [])];
  if (newItem.isLinked && newItem.recipeId && newItem.recipeName) {
    // Check if this recipe is already linked
    const alreadyLinked = linkedRecipes.some(r => r.id === newItem.recipeId);
    if (!alreadyLinked) {
      linkedRecipes.push({
        id: newItem.recipeId,
        name: newItem.recipeName
      });
    }
  }

  return {
    ...existingItem,
    quantity: mergedQuantity,
    linkedRecipes: linkedRecipes,
    isLinked: linkedRecipes.length > 0
  };
}

// Deduplicate shopping list items by name
export function deduplicateShoppingList(items) {
  const merged = [];
  const nameMap = new Map(); // Track by lowercase name for matching

  for (const item of items) {
    const nameLower = item.name.toLowerCase().trim();
    const existingIndex = nameMap.get(nameLower);

    if (existingIndex !== undefined) {
      // Merge with existing item
      merged[existingIndex] = mergeShoppingListItems(item, merged[existingIndex]);
    } else {
      // New item
      nameMap.set(nameLower, merged.length);
      merged.push({
        ...item,
        linkedRecipes: item.isLinked && item.recipeId ? [{
          id: item.recipeId,
          name: item.recipeName
        }] : (item.linkedRecipes || [])
      });
    }
  }

  return merged;
}
