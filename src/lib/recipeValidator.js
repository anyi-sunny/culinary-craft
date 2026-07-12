// Recipe validation utility for checking ingredient constraints

/**
 * Extracts ingredients from a recipe text (comma or dash separated)
 */
export function extractRecipeIngredients(recipeText) {
    if (!recipeText) return [];

    // Try to find INGREDIENTS section first
    const ingredientsMatch = recipeText.match(/ingredients:\s*([\s\S]*?)(?=instructions:|$/i);
    const ingredientSection = ingredientsMatch ? ingredientsMatch[1] : recipeText;

    // Split by common delimiters
    const ingredients = ingredientSection
        .split(/[,\n-]/)
        .map((ing) => ing.trim())
        .filter((ing) => ing.length > 2)
        .map((ing) => {
            // Remove quantities and units (e.g., "2 cups flour" -> "flour")
            return ing
                .replace(/^[\d\s\/\.]+/, '') // Remove leading numbers
                .replace(/^\s*(cups?|tbsp|tsp|grams?|oz|ml|lbs?|kg)\s+/i, '') // Remove units
                .toLowerCase()
                .trim();
        })
        .filter((ing) => ing.length > 0);

    return [...new Set(ingredients)]; // Remove duplicates
}

/**
 * Checks if a recipe ingredient matches a user-selected ingredient (loose matching)
 */
function ingredientMatches(recipeIng, userIng) {
    const recipe = recipeIng.toLowerCase();
    const user = userIng.toLowerCase();

    // Exact match
    if (recipe === user) return true;

    // Substring match (e.g., "chicken breast" contains "chicken")
    if (recipe.includes(user) || user.includes(recipe)) return true;

    // Common variations
    const variations = {
        chicken: ['poultry', 'bird', 'meat'],
        beef: ['steak', 'chuck', 'ground beef'],
        pork: ['ham', 'bacon', 'sausage'],
        fish: ['salmon', 'tuna', 'cod', 'bass'],
        flour: ['wheat', 'grain'],
        sugar: ['sweetener'],
        oil: ['butter', 'fat', 'grease'],
        milk: ['cream', 'dairy', 'lactose'],
    };

    for (const [key, alts] of Object.entries(variations)) {
        if (recipe.includes(key) && alts.some((alt) => user.includes(alt))) return true;
        if (user.includes(key) && alts.some((alt) => recipe.includes(alt))) return true;
    }

    return false;
}

/**
 * Validates a recipe against selected ingredients
 * mode: 'solely' | 'some' | 'none'
 * selectedIngredients: array of { name, quantity, unit }
 */
export function validateRecipe(recipeText, mode, selectedIngredients, excludedIngredients = []) {
    if (mode === 'none') {
        // No constraints
        return { isValid: true, matchPercentage: 100, issues: [] };
    }

    const recipeIngs = extractRecipeIngredients(recipeText);
    const selectedNames = selectedIngredients.map((i) => i.name.toLowerCase());
    const excludedNames = excludedIngredients.map((i) => i.toLowerCase());

    // Check for excluded ingredients
    const usesExcluded = recipeIngs.filter((recipeIng) =>
        excludedNames.some((excluded) => ingredientMatches(recipeIng, excluded))
    );

    if (usesExcluded.length > 0) {
        return {
            isValid: false,
            matchPercentage: 0,
            issues: [
                `Recipe contains excluded ingredient(s): ${usesExcluded.join(', ')}`,
            ],
        };
    }

    if (mode === 'some') {
        // User ingredients are suggestions, not requirements
        const matched = recipeIngs.filter((recipeIng) =>
            selectedNames.some((selected) =>
                ingredientMatches(recipeIng, selected)
            )
        );

        const matchPercentage = Math.round((matched.length / recipeIngs.length) * 100);

        return {
            isValid: true,
            matchPercentage,
            matchedCount: matched.length,
            totalCount: recipeIngs.length,
            matched: matched,
            missing: recipeIngs.filter((ing) => !matched.includes(ing)),
            issues: matchPercentage < 30 ? [`Only ${matchPercentage}% of recipe ingredients from your inventory`] : [],
        };
    }

    if (mode === 'solely') {
        // All recipe ingredients must be from selected list
        const matched = recipeIngs.filter((recipeIng) =>
            selectedNames.some((selected) =>
                ingredientMatches(recipeIng, selected)
            )
        );

        const unmatched = recipeIngs.filter((ing) => !matched.includes(ing));

        const issues = [];
        if (unmatched.length > 0) {
            issues.push(`Recipe uses ingredients not in your inventory: ${unmatched.join(', ')}`);
        }

        const matchPercentage = recipeIngs.length === 0 ? 100 : Math.round((matched.length / recipeIngs.length) * 100);

        return {
            isValid: unmatched.length === 0,
            matchPercentage,
            matchedCount: matched.length,
            totalCount: recipeIngs.length,
            matched: matched,
            missing: unmatched,
            issues,
        };
    }

    return { isValid: false, matchPercentage: 0, issues: ['Unknown validation mode'] };
}
