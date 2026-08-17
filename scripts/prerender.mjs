/**
 * Post-build prerender for the public static routes.
 *
 * Writes dist/<route>/index.html with that page's real <head> tags (title,
 * description, canonical, OG), so crawlers and link scrapers that never run
 * JS see correct metadata on the very first fetch. Amplify serves these via
 * explicit 200 rewrites (e.g. /about -> /about/index.html) placed above the
 * SPA catch-all. Dynamic pages (/recipe/:id, /chef/:username) are handled
 * server-side by the backend's /page/... Lambda routes instead.
 *
 * Route copy mirrors the usePageMeta() calls in the page components — keep
 * them in sync when editing either.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://culinarycraft.sp-devs.com';
const SITE = 'Culinary Craft';

const ROUTES = [
  {
    path: '/about',
    title: 'About',
    description:
      'The story behind Culinary Craft — why a home cook built an AI recipe app, and the engineering underneath it.',
  },
  {
    // The Blog tab of the About page. Individual posts (/blog/:slug) are
    // handled server-side by the backend's /page/blog/... Lambda route.
    path: '/blog',
    title: 'Blog',
    description:
      "Notes from the kitchen — what I'm cooking, what I'm learning, and how Culinary Craft is coming along.",
  },
  {
    path: '/chat',
    title: 'Create a Recipe',
    description:
      'Describe a craving or the ingredients you have on hand, and refine a recipe step by step with an AI chef.',
  },
  {
    path: '/explore',
    title: 'Explore Recipes',
    description:
      'Browse featured and most-saved recipes created by the Culinary Craft community.',
  },
  {
    path: '/explore/all',
    title: 'All Recipes',
    description:
      'Search and filter every published Culinary Craft recipe by name, category, or ingredient.',
  },
];

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const shell = readFileSync(join(dist, 'index.html'), 'utf8');

const setMeta = (html, attr, key, value) =>
  html.replace(
    new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`),
    (_, open, close) => open + value + close
  );

for (const { path, title, description } of ROUTES) {
  const fullTitle = `${title} | ${SITE}`;
  const url = `${SITE_URL}${path}`;
  let html = shell.replace(/<title>[^<]*<\/title>/, `<title>${fullTitle}</title>`);
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:title', fullTitle);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'property', 'og:url', url);
  html = html.replace('</head>', `  <link rel="canonical" href="${url}" />\n  </head>`);

  const out = join(dist, ...path.slice(1).split('/'), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`prerendered ${path}`);
}
