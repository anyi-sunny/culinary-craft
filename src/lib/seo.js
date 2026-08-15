import { creatorName } from './recipeUtils';

/* Ingredients/instructions are stored as one multiline string; split into
   clean lines, dropping list markers ("-", "1.", "•") the agent may emit. */
const toLines = (text) =>
  (text || '')
    .split('\n')
    .map((line) => line.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter(Boolean);

/**
 * The ~155-character summary shown under the blue link in search results
 * (and in link previews). Built from what the recipe actually contains.
 */
export function recipeMetaDescription(recipe) {
  const parts = [`A recipe by ${creatorName(recipe)}`];
  if (recipe.servings) parts.push(`serves ${recipe.servings}`);
  const ingredients = toLines(recipe.ingredients).slice(0, 4).join(', ');
  let text = parts.join(', ') + (ingredients ? `. Made with ${ingredients}` : '') + '.';
  if (text.length > 160) text = `${text.slice(0, 157)}...`;
  return text;
}

/**
 * schema.org/Recipe structured data — what makes Google eligible to show
 * this page as a recipe rich result (photo card with yield/keywords)
 * instead of a plain blue link.
 */
export function recipeJsonLd(recipe) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    author: { '@type': 'Person', name: creatorName(recipe) },
    description: recipeMetaDescription(recipe),
    recipeIngredient: toLines(recipe.ingredients),
    recipeInstructions: toLines(recipe.instructions).map((text) => ({
      '@type': 'HowToStep',
      text,
    })),
  };
  if (recipe.recipeImage) data.image = [recipe.recipeImage];
  if (recipe.servings) data.recipeYield = `${recipe.servings} servings`;
  if (recipe.tags?.length) data.keywords = recipe.tags.join(', ');
  if (recipe.createdAt) data.datePublished = recipe.createdAt;
  return data;
}
