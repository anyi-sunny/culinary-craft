import { useEffect } from 'react';

export const SITE_URL = 'https://culinarycraft.sp-devs.com';
const SITE = 'Culinary Craft';
// Matches the static <title> in index.html so the homepage title is
// identical before and after hydration.
const HOME_TITLE = `${SITE} — AI Recipe Generator`;
// Likewise matches the static <meta name="description"> in index.html.
const DEFAULT_DESCRIPTION =
  'Chat with AI to generate and refine recipes, scale servings, build shopping lists, and explore dishes shared by other home cooks.';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

/* index.html ships these tags statically; upsert so we update those same
   tags rather than appending duplicates Google would have to guess between. */
const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setCanonical = (url) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
};

/**
 * Sets everything search engines and link scrapers read from <head>:
 * title, meta description, canonical URL, and Open Graph tags.
 *
 * - `usePageMeta({ title: 'About', description: '…' })`
 *     → "About | Culinary Craft"
 * - `usePageMeta()` → the homepage title + default description
 * - `usePageMeta({ title: null })` → leaves <head> untouched (use while a
 *     dynamic page is still loading the data its meta comes from)
 *
 * `path` defaults to the current pathname; pass it explicitly on dynamic
 * pages so the canonical URL never captures a stale in-transition route.
 * `image` (absolute URL) overrides the logo as the link-preview image.
 */
export function usePageMeta({ title, description, path, image } = {}) {
  useEffect(() => {
    if (title === null) return;
    const fullTitle = title ? `${title} | ${SITE}` : HOME_TITLE;
    const desc = description || DEFAULT_DESCRIPTION;
    const url = `${SITE_URL}${path ?? window.location.pathname}`;

    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setCanonical(url);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image || DEFAULT_IMAGE);
  }, [title, description, path, image]);
}
