import { creatorName } from './recipeUtils';

/* Ingredients/instructions are stored as one multiline string; split into
   clean lines, dropping list markers ("- ", "1. ", "2) ") the agent may
   emit while keeping quantities like "1/2 cup". */
const toLines = (text) =>
  (text || '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]+|\d+[.)])\s+/, '').trim())
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

/**
 * The summary for a blog post: the author's own subtitle when they wrote one,
 * otherwise the opening of the body with markdown syntax stripped. Mirrors
 * blog_excerpt() in the backend lambda, which builds the same text for
 * crawlers that never run JS.
 */
export function blogMetaDescription(post) {
  let text = (post.subtitle || '').trim();
  if (!text) {
    text = (post.body || '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links/images -> their text
      .replace(/[#*_`>|-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .join(' ');
  }
  if (text.length > 160) text = `${text.slice(0, 157)}...`;
  return text || 'A post from the Culinary Craft blog.';
}

/** schema.org/BlogPosting structured data for a blog post page. */
export function blogPostJsonLd(post, canonical) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: blogMetaDescription(post),
    author: { '@type': 'Person', name: post.authorUsername || 'Anyi Sun' },
    mainEntityOfPage: canonical,
  };
  if (post.coverImage) data.image = [post.coverImage];
  const publishedAt = post.publishedAt || post.createdAt;
  if (publishedAt) data.datePublished = publishedAt;
  if (post.updatedAt) data.dateModified = post.updatedAt;
  return data;
}
