// Recipe search utility - reuses the same logic as the Explore page

export function searchRecipes(recipes, query) {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const queryLower = query.toLowerCase().trim();

  return recipes.filter(r => {
    // Search in recipe title and ingredients
    const haystack = `${r.title || ''} ${r.ingredients || ''}`.toLowerCase();
    return haystack.includes(queryLower);
  });
}
