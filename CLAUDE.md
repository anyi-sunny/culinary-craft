# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CulinaryCraft** is a full-stack web application for recipe generation and management. The frontend is a React + Vite SPA; the backend uses AWS CDK (Python) with a unified API Lambda that calls the first-party Claude API for all AI work, DynamoDB for persistence, and Cognito for authentication.

The app is designed around a core user flow: users authenticate via Cognito, chat with a Claude-powered assistant to iteratively refine recipes, save recipes to DynamoDB, and browse/favorite recipes in an explore view.

### Architecture at a Glance

**Frontend (`culinary-craft-frontend/`):**
- React 19 + Vite for bundling and HMR
- AWS Amplify for Cognito UI and auth context
- Router-driven pages: Welcome, Chat, Explore, MyRecipes, Favorites
- Framer Motion for page transitions and animations

**Backend (`culinary-craft-backend/`):**
- AWS CDK (Python) infrastructure-as-code in `culinary_craft_backend/culinary_craft_backend_stack.py`
- Claude API integration in `lambda/recipes_api/claude_client.py`: three "agents" that are just system prompts + JSON schemas — chat (recipe assistant), scale (portion rescaler), verify (recipe QA). Migrated from Bedrock Agents Aug 2026; the API key lives in SSM Parameter Store (SecureString), and the `anthropic` SDK ships as a Lambda layer built by `scripts/build_anthropic_layer.sh` (must run before `cdk deploy`)
- DynamoDB tables for recipes/inventory/usage/profiles, Cognito User Pool for auth
- Outputs stack IDs needed by frontend (user pool ID, API endpoint, etc.)

**Data Flow (Security-First Architecture):**
1. User signs in via Cognito OR generates temporary anonymous ID (localStorage)
2. Frontend makes API calls via backend (no direct AWS SDK usage)
3. Backend Lambda (`RecipesApiLambda`) handles all AWS service calls
4. Backend extracts userId from Authorization Bearer token
5. Backend calls the Claude API (structured outputs), manages DynamoDB, generates S3 presigned URLs
6. S3 images use public read access (permanent storage, no expiration)

## Development Commands

### Frontend

```bash
cd culinary-craft-frontend
npm install                # Install dependencies (run once)
npm run dev               # Start Vite dev server with HMR (http://localhost:5173)
npm run build             # Production build to `dist/`
npm run lint              # ESLint with React rules
npm run preview           # Preview production build locally
```

### Backend

```bash
cd culinary-craft-backend
source .venv/bin/activate # Activate Python virtualenv (macOS/Linux)
pip install -r requirements.txt # Install/update dependencies

cdk synth                 # Emit CloudFormation template to `cdk.out/`
cdk deploy                # Deploy to AWS (requires AWS credentials configured)
cdk diff                  # Show what would change if deployed
cdk destroy               # Tear down the stack (cleans up all AWS resources)
```

### Testing

Currently minimal test setup. Backend has a stub test file (`tests/unit/`); no frontend tests configured.

## Environment Setup

### Frontend `.env.local`

Vite loads environment variables prefixed with `VITE_`. The frontend requires:

```
VITE_AWS_REGION=us-east-1                         # AWS region (for Amplify)
VITE_USER_POOL_ID=us-east-1_...                   # Cognito User Pool ID
VITE_CLIENT_ID=...                                # Cognito App Client ID
VITE_API_ENDPOINT=https://xxxxx.execute-api.us-east-1.amazonaws.com  # Backend HTTP API Gateway URL

# Note: VITE_IDENTITY_POOL_ID is no longer used — the frontend authenticates
# with user pool tokens only; all AWS service calls go through the backend.
```

**Security Note:** No AWS credentials are stored in the frontend. All AWS service calls go through the backend API.

Get these values from CDK output:
```bash
cd culinary-craft-backend
cdk deploy | grep -E "ApiEndpoint|UserPoolId|UserPoolClientId|IdentityPoolId"
```

### Backend AWS Credentials

CDK needs AWS credentials in your environment. Either:
- Configure `~/.aws/credentials` and `~/.aws/config` (recommended)
- Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` env vars

## Critical Files & Architecture Decisions

### Frontend Structure

**Core Routing:**
- **`src/App.jsx`** — Router setup, page layout
- **`src/main.jsx`** — Amplify config setup

**API Client Layer (Backend Proxy):**
- **`src/lib/apiClient.js`** — Recipe API calls (fetch, save, delete, heart toggle). Extracts user email for creator attribution.
- **`src/lib/agentApiClient.js`** — Chat assistant calls via backend (`POST /agent/invoke`). Stateless contract: sends the full conversation (`messages` array) each turn; returns `{output, recipe, verify}`. Supports authenticated and anonymous users (localStorage temp IDs).
- **`src/lib/scaleApiClient.js`** — Serving-size rescale calls (`POST /agent/scale`). Stateless: retries send `previousAdjusted` + feedback explicitly. Prefers the structured `recipe` in the response, falls back to `parseRecipeBlock(output)`.
- **`src/lib/blogApiClient.js`** — Blog reads (unauthenticated `GET /blog`, `GET /blog/:slug`) and admin writes (`/admin/blog*`, Cognito ID token like agentApiClient — the JWT authorizer requires it).
- **`src/lib/inventoryApiClient.js`** — Inventory management via backend API
- **`src/lib/db.js`** — Wrapper that delegates to apiClient (maintains backward compatibility)

**Components:**
- **`src/components/chat/Chat.jsx`** — Main chat interface. Keeps two parallel transcripts: `messages` (display) and `historyRef` (the actual API conversation with injected ingredient/recipe context), both cached to localStorage so refresh/sleep restores everything (the backend is stateless — no session to lose, no memory probe). Caches the latest structured recipe in `latestRecipeRef`; Save opens the review modal straight from it (no reformat round-trip). Verify findings render as an amber `.verify-warning` under the recipe message and again (dismissible) in the review modal. Supports ingredient selector (authenticated only).
- **`src/components/chat/IngredientSelector.jsx`** — Modal for selecting ingredients before recipe generation
- **`src/components/explore/Explore.jsx`** — Browse all recipes
- **`src/components/explore/RecipeGrid.jsx`** — Shared grid + search + modal used by Explore/MyRecipes/Favorites. Search row has a Filter panel (categories + ingredients) and a Sort dropdown (Most Saved / Most Recent / Oldest / A to Z / Z to A; defaults to Most Recent, all client-side). Recency uses `recipeStamp()`: server-stamped `createdAt` (new records), else the ms timestamp in legacy `recipe-<ms>` ids, else `updatedAt`.
- **`src/components/explore/RecipeCard.jsx`** — Card shows recipe with grey heart (no border). Displays creator email. No edit/delete buttons (moved to modal).
- **`src/components/explore/modal/RecipeModal.jsx`** — Modal opened from card. Shows recipe details and action buttons.
  - **`OwnerActions.jsx`** — Edit/Delete buttons for recipe owners
  - **`NonOwnerActions.jsx`** — Dropdown to copy & edit or copy & improve with AI
- **`src/components/explore/RecipeDetail.jsx`** — Full page view of recipe with edit/delete/copy options
- **`src/components/inventory/Inventory.jsx`** — Inventory management page
- **`src/components/auth/`** — Cognito integration (Amplify Authenticator, auth context)
- **`src/components/favorites/Favorites.jsx`** — User's hearted recipes
- **`src/components/about/About.jsx`** — the About page, two tabs sharing one component: `/about` (About the Developer) and `/blog` (Blog). The tab lives in the URL, not state — both routes render `About`, `.about-tabs` (styled like the profile/comments tabs) navigates between them, and AnimatedRoutes maps `/blog` to the `/about` animation key so switching tabs doesn't replay the page crossfade. Linked from the navbar ("About", lit for `/blog*` too via `activePrefixes` in `NAV_ITEMS`) and teased by the Welcome page's `.welcome-story` section.
  - **`DeveloperStory.jsx`** — the original About content (extracted verbatim). Portrait (`public/about/portrait.jpg`, placeholder frame until uploaded) floats top-right *inside* the origin-story card with text wrapping around it (centered block above the text on mobile); engineering-story card below. Cards are plain block flow so they grow with their text.
- **Blog (`src/components/blog/`)** — the developer journal on the About page's Blog tab. `BlogList.jsx` renders published posts as `BlogPostCard`s (cover image or monogram-over-gradient, date, title, excerpt); clicking a card opens `/blog/:slug` (`BlogPost.jsx` — full page, markdown body via ReactMarkdown, BlogPosting JSON-LD). Admin-only (`profile.isAdmin`, derived server-side): a "Write a post" button, a settings button on each card, an Edit button on the post page, and drafts (visible with a "Draft" badge via the `/admin/blog` list). `BlogEditor.jsx` is a modal (canonical `.modal-content` chrome): title, optional subtitle, cover photo (same `uploadImageToS3` presigned-POST flow as recipes), markdown textarea with write/preview toggle, published checkbox, delete with inline confirm; warns before discarding unsaved changes. `blogApiClient.js` splits auth: reads are unauthenticated, writes send the Cognito ID token (JWT authorizer). Non-admins see none of the authoring UI and the backend rejects them anyway.
- **`src/components/myrecipes/MyRecipes.jsx`** — Recipes created by current user
- **Public chef profiles:** `/chef/:username` (`src/components/profile/PublicProfile.jsx`, open to guests) renders `PublicProfileView.jsx` — avatar/username/stats card (never email or real name) plus the chef's five most-saved published recipes (zero-save recipes are omitted entirely; an `AdCard` always rides in the grid). The own-profile page (`Profile.jsx`) has `.profile-tabs` (Edit Profile | Public Preview, styled like the recipe feedback/questions tabs) where Preview renders the same `PublicProfileView`. Creator bylines on card/modal/detail are `.creator-link` buttons (App.css) navigating to `/chef/:username` when `creatorUsername` exists.

**Utilities:**
- **`src/lib/recipeUtils.js`** — `isOwner()`, `canEdit()`, `isHearted()`, `heartedByList()`
- **`src/lib/imageUtils.js`** — S3 image upload, placeholder colors, image validation
- **`src/lib/inventoryDb.js`** — Inventory data layer (delegates to inventoryApiClient)
- **`src/lib/recipeValidator.js`** — Recipe field validation
- **`src/lib/lenis.js`** — Registry for the app's Lenis instance (registered by SmoothScroll). `scrollToTop()` jumps past the smooth-scroll inertia; AnimatedRoutes calls it in `onExitComplete` so every route change opens at the top of the page, with the jump landing between the exit and entrance fades.

**Key Patterns:**
- **SEO:** The site lives at `https://culinarycraft.sp-devs.com` (Amplify Hosting, domain DNS in Route 53). Every routed page calls `usePageMeta()` (`src/lib/usePageMeta.js`) — title/description/canonical/OG per page; `src/lib/seo.js` + `src/components/seo/JsonLd.jsx` add schema.org/Recipe JSON-LD on the detail page (published recipes only). Crawlers that don't run JS are served real `<head>` tags three ways: `scripts/prerender.mjs` (runs in `npm run build`) writes `dist/<route>/index.html` for the static public routes; Amplify 200-rewrites proxy `/recipe/<*>` and `/chef/<*>` to the backend's `/page/...` Lambda routes, which return the live SPA shell with injected meta + JSON-LD (404 + noindex for missing, noindex for private); and `/sitemap.xml` is proxied to the Lambda, which regenerates it from DynamoDB on request. `public/robots.txt` blocks the gated pages. Copy in `prerender.mjs` must be kept in sync with the `usePageMeta()` calls; the line-splitting and description logic in `seo.js` is mirrored in the Lambda.
- **Structured Recipes (Claude API, Aug 2026):** Chat responses are structured JSON end-to-end — `POST /agent/invoke` returns `{output: <markdown chat reply>, recipe: <structured|null>, verify: {valid, issues[]}}`. The nullable `recipe` field is the router: the model converses freely (recipe stays null) and only fills it when the reply contains a complete recipe, so there is no separate orchestrator and no reformat round-trip on save. The old `@@TAGS@@`/`@@SERVINGS@@` markers, the review-modal `TITLE:/INGREDIENTS:/INSTRUCTIONS:` reformat prompt, and the `split('|')` hack are all gone.
- **Recipe Components:** The structured recipe is `{title, servings, tags, components: [{name, ingredients: [], steps: []}]}` — parts like "Cupcake Batter" / "Vanilla Icing" are separate components, with the **component name as the sole shared identifier** between a part's ingredients and its directions. Simple recipes use one component named after the dish. The flat `- `-bulleted `ingredients`/`instructions` strings every existing consumer reads (Cook Mode, seo.js, ConsultInventoryModal) are **derived** server-side (`render_flat` in the backend's `claude_client.py`): single component → identical to the old shape; multi-component → `For the <name>:` headers before each group. RecipeModal and RecipeDetail render grouped sections instead: `recipeParts()` in `src/lib/recipeParts.js` prefers `components` and falls back to parsing the flat text (headers + bullets), and `src/components/recipes/RecipeParts.jsx` draws per-part sub-headers, copper ingredient dots, and per-part step numbering. `components` is stored on the record (passed through `POST /recipes`) but only when the flat text wasn't hand-edited after generation (a manual edit makes them stale — Chat's `commitSave`, ServingsAdjuster's `applyEdit`, and the manual-edit saves in RecipeModal/RecipeDetail all drop them when the text changed). Old records without `components` remain valid; future consumers must null-check. This unlocks shopping-list ingredient dedup later.
- **Recipe Verification:** Whenever a chat turn produces a recipe, the backend runs a cheap Haiku QA pass against the conversation *before responding* — fidelity to user intent (exclusions honored, latest version), ingredient/step consistency, component consistency. Advisory and fail-open: issues render as an amber warning under the recipe message and again (dismissible) in the review modal, but never block anything; verify infrastructure errors return `{valid: true, issues: [], degraded: true}`.
- **Category Tags:** Canonical tag list lives in `src/lib/categories.js` (kept in sync with `ALLOWED_CATEGORY_TAGS` in `lambda/recipes_api/index.py` and the structured-output schema in `claude_client.py`). The model picks tags as part of the structured recipe (`recipe.tags`, schema-enforced enum + server-side whitelist); Chat.jsx caches them for the review modal, where they appear as a pre-checked checkbox list. Recipes store `tags` as an array of canonical strings; cards/modal/detail render them as faint oval chips (`src/components/tags/CategoryTags.jsx`), owners can edit them in manual-edit mode, and RecipeGrid's category filter matches against them.
- **Cook Mode Phase Tracks:** Multi-part recipes cook as one slideshow track per phase (`buildTracks` in `src/lib/cookModeUtils.js`, built on `recipeParts()`): each track opens with its own ingredients slide, numbers its steps independently, and keeps its own timers (timers tick on tracks you're not viewing; a hidden ringing track pulses a dot on its tab). The layout reads like an open book: slide content sits flat on the background (no card chrome), phase names live only in a persistent About/Blog-style tab strip (shown in both wide and narrow views), and every page carries a top nav row — back/forward arrows flanking the "Step x of y" label and progress dots. Wide screens (≥960px) show two pages side by side separated by a single spine line — click focuses a page (the other takes a faint shade), arrow keys/Enter drive the focused page, and with 3+ phases the tabs swap the least-recently-focused page out. Single-part recipes render as one page with no tabs; `CookMode`'s props are unchanged. Step slides show "In this step" quantity-reminder pills from the record's server-derived `stepIngredients` (see below) — `buildTracks` aligns it to phases by name (position as fallback) and slides carry it as `ingredientRefs`; records without the field just show no pills.
- **Per-Step Ingredient Mentions (`stepIngredients`):** deterministic string matching, no AI — `lambda/recipes_api/step_ingredients.py` cleans each ingredient line to its name (drops amounts/units/prep notes) and matches steps by full name, head noun, or any significant 4+ letter word (singular/plural folded), with same-head-noun disambiguation so "add the brown sugar" lists only brown sugar while a bare "add the sugar" lists both sugars. Matching is phase-scoped (a step only matches its own component's ingredients). Server-owned and recomputed on every `POST /recipes` (client value ignored → hand-edits can't leave it stale) and attached by `_shape_recipe` to `/agent/invoke` and `/agent/scale` recipes so unsaved scale adjustments get pills in Cook With These. The module's `parse_flat_section` mirrors `parseFlatSection` in `src/lib/recipeParts.js` — keep them in sync. Legacy records: `scripts/backfill_step_ingredients.py` in the backend repo derives the field for pre-existing recipes (idempotent, `--dry-run` supported); run it once after deploying the lambda.
- **Serving Size:** The model estimates `recipe.servings` in its structured output (whole number; piece count for discrete items like cupcakes, standard servings for soup/pasta) and mentions the yield naturally in chat prose. Chat.jsx caches it for the review modal (editable number input). Recipes store `servings` as a number; modal and detail page render it as a faint "Serves N" line under the title, and owners can edit it in manual-edit mode (manual edit is the source of truth for what a recipe yields). Backend sanitizes it in `sanitize_servings` (lambda); `_json_default` in the lambda's `response()` converts DynamoDB `Decimal` (and sets) for every endpoint, so numeric attributes can't break serialization.
- **Serving-Size Conversion (temporary, any user):** "Change Serving Size" in the kebab on the full recipe page opens `src/components/servings/ServingsAdjuster.jsx` — a stepper (min 1) → `POST /agent/scale` → a result modal. The result is ephemeral and never touches the original record, so non-owners can use it too. The result modal offers Manual Edit, Try Again (feedback box — the retry sends `previousAdjusted` + feedback explicitly, the backend is stateless), Change Serving Size, Cook With These (Cook Mode on the unsaved version), and Save to My Creations (a new private recipe owned by the current user); closing warns that the adjustment is unsaved. The backend's scale role rescales quantities, adjusts cooking times/pan sizes/batch counts, and converts awkward amounts into household measures (1/8 cup → 2 tbsp), preserving component structure. The response carries both the structured `recipe` and a legacy plain-text `output` block rendered deterministically server-side (`parseRecipeBlock` in `src/lib/recipeText.js` remains as the rollout fallback parser).
- **Publishing:** Recipes carry a `published` boolean. New recipes are saved private (`published: false`, set server-side); recipes predating the flag are treated as published, and all existing records were backfilled to `true`. `GET /recipes` returns published recipes plus all of the caller's own, so My Creations stays complete while Explore/Featured filter with `isPublished()` (`src/lib/recipeUtils.js`). Only `PUT /recipes/{id}/publish` (owner-gated) changes the flag — `POST /recipes` ignores any `published` in the body. Owners get a green Publish button (card, modal, detail page), a "Private" badge, and "Hide from Explore" in the kebab; `useRecipes().togglePublish` updates optimistically.
- **Recipe Slug URLs (Aug 2026):** recipes are addressed as `/recipe/<slug>` (e.g. `/recipe/fluffy-banana-bread`) instead of `/recipe/<uuid>`. The slug is server-owned, generated from the title on first save (`unique_recipe_slug` in the lambda — blog-style: chosen once, never rewritten, so retitling a published recipe doesn't break links; duplicate titles get `-2`, `-3`, ... suffixes, uuid-hex after 25). Lookups go through the `slug-index` GSI on RecipesTable (KEYS_ONLY like `username-index`, handler re-reads the base table). The frontend builds every recipe link with `recipePath()` in `src/lib/recipeUtils.js` (`slug || recipeId`), and RecipeDetail resolves the `:id` param against both fields, so legacy `/recipe/<uuid>` links keep working; `handle_page_recipe` accepts both too and 301s published id-URLs to the slug URL (private recipes never redirect — the slug would leak the title). The sitemap emits slug URLs. Legacy records get slugs from `scripts/backfill_recipe_slugs.py` in the backend repo (idempotent, `--dry-run`), or lazily on their next edit.
- **Server-Owned Recipe Fields:** `POST /recipes` on an existing recipe does a full `put_item`, so `ownerId`, `creatorEmail`, `creatorUsername`, `createdAt`, `heartedBy`, `slug` and `published` are always re-read from the stored item and never taken from the request body. Without this, an edit dropped `ownerId` (breaking later publish/delete) and rewrote the `heartedBy` string set as a list, which was the cause of the heart-toggle 500s.
- **Authorization (split model):** The agent endpoints (`/agent/invoke`, `/agent/scale`) and the blog-authoring endpoints (`/admin/blog*`) sit behind an API Gateway **JWT authorizer** — the frontend sends the Cognito ID token (`fetchAuthSession()`), the gateway verifies it, and the Lambda uses the verified `sub` claim as the userId. Agent endpoints spend Anthropic dollars; blog writes publish site-owner-attributed content, and additionally require the verified sub's profile username to be in `ADMIN_USERNAMES` (Lambda env var, default `anyi_sunny`). Forged IDs are rejected before the Lambda runs. All other endpoints still take a raw Bearer userId (Cognito ID or anonymous temp ID) on the open catch-all route — public reads (including `GET /blog*`) and the SEO routes must stay unauthenticated.
- **Admin flag:** `GET /profile` and `PUT /profile` responses carry a derived (never stored) `isAdmin` boolean. The frontend uses `profile.isAdmin` purely to show/hide authoring UI (blog editor, drafts); every actual write re-checks server-side, so faking it client-side buys nothing.
- **Markdown Stripping:** Chat responses cleaned before saving to DynamoDB (plain text only)
- **Creator Attribution:** Recipes are credited to the author's profile username, never an email. `GET /recipes` resolves `creatorUsername` live from `UserProfilesTable` (one batched read keyed on the distinct `ownerId`s in the result set), so a rename updates every recipe at once; `POST /recipes` also snapshots the username onto the record as a fallback for authors with no profile (anonymous saves, legacy records). Both fields are server-owned — the lambda drops any `creatorEmail`/`creatorUsername` in the request body and strips `creatorEmail` from every response, so emails never reach the client. The frontend reads it through `creatorName()` in `src/lib/recipeUtils.js` (falls back to "Anonymous chef") and renders "by …" on the card, modal, and detail page. `scripts/backfill_creator_username.py` in the backend repo stamped all 28 pre-existing recipes with `anyi_sunny`.
- **Copy Recipes:** Non-owners can create copies via dropdown in modal. New recipes have no recipeId (backend generates), allowing users to make their own versions.
- **Guest Previews (gated pages):** Guests visiting `/chat`, `/inventory`, or `/shopping-list` no longer hit a lock screen — each page renders a read-only preview filled with example data from `src/lib/demoData.js` (demo conversation, demo inventory chips, demo shopping list showing recipe linkage), topped by `src/components/previews/PreviewBanner.jsx` whose CTA (and every mutating control) opens the login modal. TopNav lets guests navigate to nav items flagged `preview: true` (lock icon stays). Nothing in a preview ever writes to the backend.
- **Build a Recipe from Inventory:** The Inventory page's "Build a Recipe" button opens the chat's `IngredientSelector` (passed the already-loaded `items` so it opens instantly) and hands the result to `/chat` via router state (`location.state.ingredientContext = {mode, selectedItems}`), which skips the chat's own selector and any cached conversation. The selector itself lazy-loads: the modal opens immediately in "start from scratch" mode and only fetches the inventory (bouncing-dots "Loading inventory" in the list container) when the user picks an inventory-based mode — Chat.jsx no longer pre-fetches inventory before showing it, and it opens even for users with an empty inventory (the empty state shows inside the modal).

### Backend Structure

**CDK Stack (`culinary_craft_backend_stack.py`):**
- HTTP API Gateway with catch-all `/{proxy+}` routing
- Cognito User Pool + Identity Pool + App Client
- DynamoDB tables:
  - `RecipesTable` (partition key: `recipeId`)
  - `UserInventoryTable` (partition key: `userId`, sort key: `itemId`)
  - `UserInventoryCategoriesTable` (partition key: `userId`, sort key: `categoryId`)
- S3 bucket for recipe images (public read access)
- `AnthropicSdkLayer` — the `anthropic` SDK as a Lambda layer (built by `scripts/build_anthropic_layer.sh`, which must run before `cdk deploy`)
- SSM SecureString `/culinary-craft/anthropic-api-key` (created out-of-band) with read granted to the API Lambda
- Per-role Claude config as env vars: `CHAT_MODEL_ID` (`claude-sonnet-5`), `SCALE_MODEL_ID` (`claude-sonnet-5`), `VERIFY_MODEL_ID` (`claude-haiku-4-5`), `CHAT_EFFORT`/`SCALE_EFFORT` (`medium`)

**RecipesApiLambda (`lambda/recipes_api/index.py`):**
The unified API handler for all frontend operations. Extracts userId from Authorization Bearer token.

*Routes:*
- `POST /recipes` — Save recipe (creates new with UUID or updates existing)
- `GET /recipes` — Published recipes plus all of the caller's own (converts heartedBy set to list for JSON)
- `DELETE /recipes/{id}` — Delete recipe (owner-gated)
- `PUT /recipes/{id}/heart` — Toggle heart/favorite status
- `PUT /recipes/{id}/publish` — Show/hide a recipe on Explore (owner-gated; the only way `published` changes)
- `GET /profiles/{username}` — Public chef profile (unauthenticated; case-insensitive via the `username-index` GSI, which is KEYS_ONLY so the handler re-reads the base table). Returns only `userId`, `username`, `icon`, `iconBg`, `createdAt` — never email or real name.
- `POST /agent/invoke` — Chat turn: `{messages: [...]}` in, `{output, recipe, verify}` out (legacy `{sessionId, inputText}` still accepted). Runs the Haiku verify pass whenever a recipe is produced.
- `POST /agent/scale` — Rescale a recipe: `{recipe, targetServings, feedback?, previousAdjusted?}` in, `{output: <legacy block>, recipe, targetServings}` out (ephemeral; saves nothing)
- `POST /generate-upload-url` — Generate S3 presigned POST URL for image upload
- `GET /blog` / `GET /blog/{slug}` — Published blog posts (unauthenticated; list returns card shapes with a server-built `excerpt`, detail returns the full post; drafts 404 on the public detail route)
- `/admin/blog` + `/admin/blog/{slug}` — Blog authoring (JWT authorizer + `is_admin()` check: the verified `sub`'s profile username must be in the `ADMIN_USERNAMES` env var, default `anyi_sunny`). `GET` list-with-drafts / `POST` create, `GET` one (drafts included, powers draft preview) / `PUT` edit / `DELETE`. The slug is generated from the title at creation (`unique_slug`) and never changes; `publishedAt` is stamped on first publish and never moves.
- `GET /page/blog/{slug}` — SPA shell with the post's real `<head>` + BlogPosting JSON-LD (SEO, mirrors `/page/recipe`); drafts/missing get noindex
- `/inventory/*` — Inventory CRUD operations

*Key Implementation Details:*
- Path extraction: Uses `rawPath` instead of `pathParameters` (catch-all routing doesn't populate pathParameters)
- Heart toggle: ADD for favoriting, DELETE with condition expression for unfavoriting
- Image upload: Generates presigned URLs, stores permanent public S3 URLs in DynamoDB
- Anonymous users: Backend accepts any userId from Authorization header (frontend generates/stores in localStorage)

**Claude API layer (`lambda/recipes_api/claude_client.py`):**
Three roles, each a system prompt + JSON schema on the Claude Messages API (structured outputs; the model cannot break the shape):
- **Chat** (`claude-sonnet-5`): the CulinaryCraft Architect. Replies `{message: <markdown>, recipe: <structured|null>}` — recipe only when the turn contains a complete one; reminds the user the green save button does the saving (the model has no tools and cannot save).
- **Scale** (`claude-sonnet-5`): the Portion Architect. Stateless rescale honoring household measures, countable items, non-linear cook times; preserves component structure.
- **Verify** (`claude-haiku-4-5`): QA pass returning `{valid, issues[]}`; advisory, fail-open.
The SDK client uses `timeout=25.0, max_retries=1` (API Gateway caps responses at 30s) and `cache_control` on the static system prompts (prompt caching). Upstream Anthropic 429s map to **503** — HTTP 429 is reserved for the user-quota paywall.

**Database Schema (all DynamoDB tables):**
- **RecipesTable** (PK: `recipeId` string; GSI: `slug-index` on `slug`, KEYS_ONLY)
  - `title` (string): recipe name
  - `slug` (string): URL segment derived from the title on first save (server-owned, never rewritten — public links survive retitles); legacy records without one fall back to recipeId URLs until backfilled/edited
  - `ingredients` (string): flat markdown-formatted ingredient list (or use structured `components` if multi-part)
  - `instructions` (string): flat markdown-formatted cooking steps
  - `servings` (number): yield, whole-number pieces or standard portions
  - `tags` (list of strings): canonical category tags (e.g., "Dessert", "Vegetarian")
  - `components` (nullable list): structured recipe parts `[{name, ingredients: [], steps: []}]`; populated only if the model generated a multi-part recipe and the user hasn't hand-edited after generation. Flat text derived server-side on read; older recipes without this field are valid and remain in flat-only format.
  - `stepIngredients` (nullable list): server-derived per-step ingredient mentions `[{name: <phase name or "">, steps: [[<full ingredient lines>], ...]}]`, one entry per phase, recomputed on every save (never read from the request body); omitted when nothing matches. Cook Mode renders these as quantity-reminder pills. Records predating the field are valid — backfill via `scripts/backfill_step_ingredients.py`.
  - `recipeImage` (string, optional): S3 URL of the recipe photo
  - `ownerId` (string): Cognito user ID of the author; server-owned (read from stored record on update)
  - `creatorEmail` (string, deprecated): never written; stripped from responses server-side
  - `creatorUsername` (string, optional): display name of the author (resolved live from `UserProfilesTable` on read, fallback from this field if profile doesn't exist)
  - `createdAt` (ISO 8601 string): server timestamp of first save (never changes, enables recency sort)
  - `updatedAt` (ISO 8601 string): server timestamp of last edit
  - `heartedBy` (DynamoDB string set): Cognito user IDs of users who've favorited this recipe (converted to JSON list for responses)
  - `published` (boolean): `true` for recipes visible on Explore; `false` for private. New recipes default to `false`; existing pre-dating this flag are `true` (backfilled Aug 2026).

- **UserInventoryTable** (PK: `userId` string, SK: `itemId` string)
  - `name` (string): ingredient name (e.g., "Chicken Breast")
  - `category` (string): category ID (e.g., "produce", or a UUID for custom categories)
  - `quantity` (string, optional): amount (e.g., "2", "500g")
  - `unit` (string, optional): unit of measure (e.g., "cups", "grams")
  - `notes` (string, optional): user annotations
  - `createdAt` (ISO 8601 string): server timestamp
  - GSI: `userIdCategoryIndex` on `(userId, category)` for filtering items by category within a user's inventory

- **UserInventoryCategoriesTable** (PK: `userId` string, SK: `categoryId` string)
  - `name` (string): display label
  - `description` (string): optional description
  - `isPredefined` (boolean): `true` for system-seeded categories (Produce, Dairy, etc.), `false` for user-created ones
  - `createdAt` (ISO 8601 string): server timestamp (omitted for predefined categories)

- **ShoppingListTable** (PK: `userId` string, SK: `shoppingListId` string)
  - `items` (list): array of `{name, quantity, unit, category, checked}` strings representing line items
  - `status` (string): "active" or other status markers
  - `createdAt` (ISO 8601 string): server timestamp
  - `updatedAt` (ISO 8601 string): server timestamp

- **UserProfilesTable** (PK: `userId` string)
  - `username` (string, unique): handle (3–20 chars, alphanumeric + dots/dashes/underscores); required to create/update a profile
  - `usernameLower` (string): lowercase version for case-insensitive uniqueness checks; indexed via `username-index` GSI
  - `name` (string, optional): display name
  - `email` (string, optional): never returned to clients; for backend reference only
  - `icon` (string, optional): chosen avatar icon identifier
  - `iconBg` (string, optional): background color or hex code for the avatar
  - `createdAt` (ISO 8601 string): server timestamp
  - `updatedAt` (ISO 8601 string): server timestamp
  - GSI: `username-index` on `usernameLower` (KEYS_ONLY, requires re-read on public profile fetch)

- **UsageTable** (PK: `userId` string)
  - `agentCalls` (number): cumulative count of `/agent/invoke` and `/agent/scale` calls (incremented via ADD on every chat/scale turn)

- **RecipeCommentsTable** (PK: `recipeId` string, SK: `commentId` string)
  - `userId` (string): Cognito user ID of commenter
  - `username` (string): display name of commenter (resolved live or snapshot)
  - `type` (string): "feedback" or "question"
  - `text` (string): the comment body
  - `createdAt` (ISO 8601 string): server timestamp

- **BlogPostsTable** (PK: `slug` string)
  - `slug` (string): URL segment derived from the title at creation (`unique_slug`); doubles as the key and never changes, so published links survive retitles
  - `title` (string), `subtitle` (string, optional dek shown on the card), `body` (string, markdown, ≤60k chars)
  - `coverImage` (string, optional): S3 URL via the shared presigned-upload flow; empty string clears it
  - `published` (boolean): drafts (`false`) are invisible to everyone but the admin
  - `publishedAt` (ISO 8601 string): stamped the first time the post goes live, never moves (blog sort key); `createdAt`/`updatedAt` as usual
  - `authorId` / `authorUsername` (strings): the admin who wrote it (server-owned)

## Deployment & CI/CD

No CI/CD pipeline configured yet. Manual deployment:

1. **Frontend:** Run `npm run build`, then deploy the `dist/` folder to a static host (S3 + CloudFront, Netlify, Vercel, etc.)
2. **Backend:** Run `cdk deploy` from the backend directory

Both frontend and backend must be deployed for the app to function. Backend deploys require `scripts/build_anthropic_layer.sh` to have run first (the Anthropic SDK Lambda layer is gitignored).

## Important Implementation Notes

### Multi-User Support
`RecipesTable` is keyed on `recipeId` alone (ownership lives in the `ownerId` attribute). All per-user tables added since — `UserInventoryTable` (`userId` + `itemId`), `UserInventoryCategoriesTable` (`userId` + `categoryId`), `ShoppingListTable` (`userId` + `shoppingListId`) — are partitioned by `userId`, and every handler queries/mutates with the caller's userId plus an ownership check on update/delete. New tables must follow the same pattern. Caveat: outside `/agent/*`, the userId comes from the raw Bearer header (unverified — see the split authorization model), so per-user isolation on these routes is not enforced against a forged header.

### Conversation State
The backend is fully stateless: Chat.jsx maintains the API conversation (`historyRef` — augmented user turns + assistant replies) and sends the recent window (~30 turns, backend caps at 40) with every `/agent/invoke` call. Both the display transcript and the API history are cached to localStorage, so refresh/sleep restores the whole conversation with no server round-trip. There are no sessions, no expiry, and no memory-probe/replay logic.

### DynamoDB Queries
Currently uses `ScanCommand` to fetch all recipes (works fine for small datasets but won't scale). Future pagination / user-specific queries should use `QueryCommand` with the appropriate key condition.

### Error Handling
The backend returns clean, user-safe error strings; Chat.jsx surfaces them as-is (`formatAgentError`). Status codes carry meaning: 429 is exclusively the user-quota paywall (Chat sets `quotaExceeded`); upstream Claude API problems arrive as 502/503 and never trigger the paywall. Refusals return a friendly in-chat message with `recipe: null`.

## Configuration & Debugging

### Check Agent Status
```bash
cdk deploy --quiet  # Skip stack summary
cdk ls             # List stacks
cdk diff           # Compare current code to deployed stack
```

### Common Issues

- **Missing `.env.local`:** Vite will throw a missing-config error on startup
- **AI calls failing after a key rotation:** warm Lambdas cache the SSM key at cold start — force cold starts (redeploy or bump an env var on the Lambda)
- **`cdk synth` fails with a missing-asset error:** run `scripts/build_anthropic_layer.sh` in the backend repo first
- **DynamoDB Credentials:** Ensure the deployer's IAM user has `dynamodb:*` and SSM read permissions

## Recent Changes & Known Issues

### Completed (Recent)
- ✅ Claude API migration (Aug 2026): Bedrock Agents (RecipeArchitect/PortionArchitect), their broken action groups, and both executor lambdas removed; all AI runs on the first-party Claude API (Sonnet 5 chat/scale, Haiku 4.5 verify) with structured JSON output, recipe components, generation-time verification, client-side conversation history (memory-probe hack deleted), and the API key in SSM SecureString. The `@@TAGS@@`/`@@SERVINGS@@` markers and review-modal reformat round-trip are gone.
- ✅ Security overhaul: Removed all AWS credentials from frontend
- ✅ Backend API layer: All AWS service calls now go through `RecipesApiLambda`
- ✅ Anonymous user support: Unauthenticated users get temporary IDs stored in localStorage
- ✅ Image handling: S3 presigned URLs, permanent public access, fixed display in RecipeDetail
- ✅ Creator attribution: recipes are credited by profile username (resolved live from `UserProfilesTable`), shown on cards, modal and detail page; emails are no longer written or returned, and all pre-existing recipes were backfilled to `anyi_sunny`
- ✅ Copy recipes: Non-owners can create their own versions via modal dropdown
- ✅ Ownership detection: Fixed `isOwner()` vs `canEdit()` distinction
- ✅ UI reorganization: Edit/delete buttons moved to modal, recipe cards simplified
- ✅ Heart button styling: Borderless stars, grey default, yellow on hover/when hearted
- ✅ Tutorial modal: Now only shows for unauthenticated users (fixed refresh bug)
- ✅ Serving-size conversion: `PortionArchitect` agent + `ServingsAdjuster` modal flow (temporary, open to non-owners)
- ✅ Publishing: recipes save private by default; owner-gated publish/hide, existing recipes backfilled to published
- ✅ Heart toggle 500 fixed: a recipe edit was overwriting the `heartedBy` string set with a JSON list (and dropping `ownerId`). `POST /recipes` now re-reads server-owned fields from the stored item.
- ✅ Decimal serialization fixed: `json.dumps` now uses `_json_default`, so numeric attributes like `servings` can't 500 a response
- ✅ SEO Phases 1–2 (Aug 2026): per-page meta, Recipe JSON-LD, robots.txt, dynamic sitemap, prerendered static routes, server-side head injection for recipe/chef pages — verified end to end with Google's Rich Results Test (see the SEO key pattern above and the roadmap below)
- ✅ About tabs + blog (Aug 2026): About page split into About the Developer / Blog tabs (`/about`, `/blog`); admin-only authoring (`ADMIN_USERNAMES` behind the JWT authorizer), markdown posts with cover photos at `/blog/:slug`, drafts, BlogPosting JSON-LD + `/page/blog` head injection + sitemap entries. Needs the two new Amplify rewrites (see SEO section) after deploy.

### Current Issues
- None open.

### Not Yet Implemented
- Admin access control (planned but not started)
- Meal planner feature (reference in memory)
- Shopping assistant feature (reference in memory)
- Recipe search/filtering (basic search exists, advanced filters TODO)
- User profile/settings page

## SEO Roadmap

The mechanics live in the "SEO" key pattern above; this section tracks what's done, what's deliberately deferred, and when to revisit.

### Done (Phases 1–2, Aug 2026)
- Per-page `<head>` meta, Recipe/ProfilePage JSON-LD, robots.txt, Lambda-generated `/sitemap.xml`, build-time prerender of static routes, and server-side head injection for `/recipe/:id` + `/chef/:username` via Amplify 200-rewrites.
- Google Search Console: Domain property `sp-devs.com`, verified via a TXT record on the root of the Route 53 zone (`Z0854508ESB4ZKPCXHMF`) — do not delete that record, Google rechecks it. Sitemap submitted.
- Amplify rewrite order matters: `/sitemap.xml`, `/recipe/<*>`, `/chef/<*>`, `/blog/<*>` proxies and the static-route rewrites (now five, including `/blog` → `/blog/index.html`) must all sit **above** the `404-200` SPA catch-all in the console's rewrite list. `/blog/<*>` proxies to the backend `/page/blog/<*>` route and must sit **below** the plain `/blog` rewrite so the list page stays static.
- Note: bare `sp-devs.com` points at the same CloudFront distribution and serves this app too; every page's canonical tag points at `culinarycraft.sp-devs.com`, which is what keeps Google treating that host as the real one.

### Phase 3 — measure and iterate (ongoing, no code)
- Watch Search Console over the coming weeks: Pages report (sitemap URLs moving to "Indexed"), Performance report (queries/impressions), and Enhancements → Recipes (rich-result eligibility).
- **Recipes need a real photo to be rich-result eligible** — `image` is required by Google and the JSON-LD only includes it when `recipeImage` exists. Never substitute the logo or a placeholder; the image must depict the dish. Photoless recipes still index as normal pages.
- Iterate on meta descriptions that get impressions but no clicks.

### Known follow-ups (not yet done)
- **Crawlable internal links:** every recipe/chef navigation in the app is a `navigate()` in an `onClick` — there are no real `<a href>` links for crawlers to follow, so discovery rides entirely on the sitemap. Converting cards/bylines to react-router `<Link>`s would pass internal link equity.
- Owner nudge on photoless published recipes ("add a photo to help this recipe get found").
- Richer JSON-LD (`prepTime`, `cookTime`, `nutrition`, `aggregateRating`) if those fields are ever added to the recipe data model.

### Option D — full SSR migration (deliberately deferred)
Rewriting onto an SSR framework was evaluated and rejected for now: the app is ~90% login-gated (SSR helps none of it), and the five public routes are already fully covered by the prerender + head-injection setup. Revisit only when SEO becomes a growth strategy — hundreds of recipes, content pages, real Search Console impressions worth compounding. When that day comes, the cheapest path is **React Router v7 framework mode** (already on react-router, so an upgrade rather than a Next.js rewrite); everything from Phases 1–2 (JSON-LD builders, sitemap, meta copy, Search Console history) carries over unchanged. Expect the migration's main cost in browser-only code: AnimatePresence transitions, Lenis, localStorage anonymous IDs, and Amplify auth all need SSR guards.

## Staying Productive

- **Frontend HMR:** Vite hot-reloads on file save; CSS and JSX changes appear instantly
- **Backend testing:** After editing `lambda/recipes_api/index.py`, run `cdk deploy`, then test via frontend
- **CloudWatch logs:** View Lambda output: AWS Console → CloudWatch → Logs → search for `/aws/lambda/RecipesApiLambda`
- **Authorization debugging:** All API calls include Bearer token with userId. Verify token in browser DevTools → Network → request headers
- **Recipe data inspection:** Use AWS Console → DynamoDB → RecipesTable to view recipe structure and heartedBy sets
