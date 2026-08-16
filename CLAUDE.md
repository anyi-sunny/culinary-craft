# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CulinaryCraft** is a full-stack web application for recipe generation and management. The frontend is a React + Vite SPA, and the backend uses AWS CDK (Python) to provision a multi-agent system powered by Bedrock Claude models, DynamoDB for persistence, and Cognito for authentication.

The app is designed around a core user flow: users authenticate via Cognito, chat with a Bedrock agent to iteratively refine recipes, save recipes to DynamoDB, and browse/favorite recipes in an explore view.

### Architecture at a Glance

**Frontend (`culinary-craft-frontend/`):**
- React 19 + Vite for bundling and HMR
- AWS Amplify for Cognito UI and auth context
- AWS SDK (v3) for DynamoDB and Bedrock Agent Runtime
- Router-driven pages: Welcome, Chat, Explore, MyRecipes, Favorites
- Framer Motion for page transitions and animations

**Backend (`culinary-craft-backend/`):**
- AWS CDK (Python) infrastructure-as-code in `culinary_craft_backend/culinary_craft_backend_stack.py`
- Bedrock Agent (`RecipeArchitect`) that processes user prompts and calls action groups
- Lambda function (`recipe_handler/index.py`) backing the RecipeManagement action group
- DynamoDB table for recipes, Cognito User Pool for auth
- Outputs stack IDs needed by frontend (agent ID, user pool ID, etc.)

**Data Flow (Security-First Architecture):**
1. User signs in via Cognito OR generates temporary anonymous ID (localStorage)
2. Frontend makes API calls via backend (no direct AWS SDK usage)
3. Backend Lambda (`RecipesApiLambda`) handles all AWS service calls
4. Backend extracts userId from Authorization Bearer token
5. Backend invokes Bedrock Agent, manages DynamoDB, generates S3 presigned URLs
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
- **`src/lib/agentApiClient.js`** — Bedrock Agent invocation via backend. Supports authenticated and anonymous users (localStorage temp IDs).
- **`src/lib/inventoryApiClient.js`** — Inventory management via backend API
- **`src/lib/db.js`** — Wrapper that delegates to apiClient (maintains backward compatibility)

**Components:**
- **`src/components/chat/Chat.jsx`** — Main chat interface. Calls agentApiClient for agent invocation. Supports ingredient selector (authenticated only).
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
- **`src/components/about/About.jsx`** — `/about`: the story behind the app. Portrait (`public/about/portrait.jpg`, editorial placeholder frame until uploaded) floats top-right *inside* the origin-story card with the text wrapping around it (drops to a centered block above the text on mobile); engineering-story card below. Cards are plain block flow so they grow with their text. Teased on the Welcome page by the `.welcome-story` section ("Read more" links here).
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
- **Category Tags:** Canonical tag list lives in `src/lib/categories.js` (kept in sync with the agent prompt in the backend CDK stack and `ALLOWED_CATEGORY_TAGS` in `lambda/recipes_api/index.py`). The agent appends `@@TAGS: tag1, tag2@@` to any response containing a full recipe; Chat.jsx strips the marker before display and caches the tags for the review modal, where they appear as a pre-checked checkbox list. Recipes store `tags` as an array of canonical strings; cards/modal/detail render them as faint oval chips (`src/components/tags/CategoryTags.jsx`), owners can edit them in manual-edit mode, and RecipeGrid's category filter matches against them.
- **Serving Size:** The agent appends `@@SERVINGS: N@@` (whole number; piece count for discrete items like cupcakes, standard servings for soup/pasta) after the `@@TAGS@@` line on any full-recipe response, and also mentions the yield naturally in chat prose. `src/lib/servings.js` strips/normalizes the marker; Chat.jsx caches it for the review modal (editable number input). Recipes store `servings` as a number; modal and detail page render it as a faint "Serves N" line under the title, and owners can edit it in manual-edit mode (manual edit is the source of truth for what a recipe yields). Backend sanitizes it in `sanitize_servings` (lambda); `_json_default` in the lambda's `response()` converts DynamoDB `Decimal` (and sets) for every endpoint, so numeric attributes can't break serialization.
- **Serving-Size Conversion (temporary, any user):** "Change Serving Size" in the kebab on the full recipe page opens `src/components/servings/ServingsAdjuster.jsx` — a stepper (min 1) → `POST /agent/scale` → a result modal. The result is ephemeral and never touches the original record, so non-owners can use it too. The result modal offers Manual Edit, Try Again (feedback box, same agent session), Change Serving Size, Cook With These (Cook Mode on the unsaved version), and Save to My Creations (a new private recipe owned by the current user); closing warns that the adjustment is unsaved. A second Bedrock agent, `PortionArchitect` (CDK stack, no action groups), does the work: it rescales quantities, adjusts cooking times/pan sizes/batch counts, and converts awkward amounts into household measures (1/8 cup → 2 tbsp). It replies in a strict `TITLE / SERVES / INGREDIENTS / INSTRUCTIONS / NOTES` block parsed by `parseRecipeBlock` in `src/lib/recipeText.js` (shared with Chat's review-modal parsing).
- **Publishing:** Recipes carry a `published` boolean. New recipes are saved private (`published: false`, set server-side); recipes predating the flag are treated as published, and all existing records were backfilled to `true`. `GET /recipes` returns published recipes plus all of the caller's own, so My Creations stays complete while Explore/Featured filter with `isPublished()` (`src/lib/recipeUtils.js`). Only `PUT /recipes/{id}/publish` (owner-gated) changes the flag — `POST /recipes` ignores any `published` in the body. Owners get a green Publish button (card, modal, detail page), a "Private" badge, and "Hide from Explore" in the kebab; `useRecipes().togglePublish` updates optimistically.
- **Server-Owned Recipe Fields:** `POST /recipes` on an existing recipe does a full `put_item`, so `ownerId`, `creatorEmail`, `creatorUsername`, `createdAt`, `heartedBy` and `published` are always re-read from the stored item and never taken from the request body. Without this, an edit dropped `ownerId` (breaking later publish/delete) and rewrote the `heartedBy` string set as a list, which was the cause of the heart-toggle 500s.
- **Authorization:** Bearer token in Authorization header contains userId (Cognito ID or anonymous temp ID)
- **Markdown Stripping:** Chat responses cleaned before saving to DynamoDB (plain text only)
- **Creator Attribution:** Recipes are credited to the author's profile username, never an email. `GET /recipes` resolves `creatorUsername` live from `UserProfilesTable` (one batched read keyed on the distinct `ownerId`s in the result set), so a rename updates every recipe at once; `POST /recipes` also snapshots the username onto the record as a fallback for authors with no profile (anonymous saves, legacy records). Both fields are server-owned — the lambda drops any `creatorEmail`/`creatorUsername` in the request body and strips `creatorEmail` from every response, so emails never reach the client. The frontend reads it through `creatorName()` in `src/lib/recipeUtils.js` (falls back to "Anonymous chef") and renders "by …" on the card, modal, and detail page. `scripts/backfill_creator_username.py` in the backend repo stamped all 28 pre-existing recipes with `anyi_sunny`.
- **Copy Recipes:** Non-owners can create copies via dropdown in modal. New recipes have no recipeId (backend generates), allowing users to make their own versions.

### Backend Structure

**CDK Stack (`culinary_craft_backend_stack.py`):**
- Bedrock Agent (`RecipeArchitect`) with detailed instruction prompt
- HTTP API Gateway with catch-all `/{proxy+}` routing
- Cognito User Pool + Identity Pool + App Client
- DynamoDB tables:
  - `RecipesTable` (partition key: `recipeId`)
  - `UserInventoryTable` (partition key: `userId`, sort key: `itemId`)
  - `UserInventoryCategoriesTable` (partition key: `userId`, sort key: `categoryId`)
- S3 bucket for recipe images (public read access)
- Lambda execution roles with permissions for Bedrock, DynamoDB, S3

**RecipesApiLambda (`lambda/recipes_api/index.py`):**
The unified API handler for all frontend operations. Extracts userId from Authorization Bearer token.

*Routes:*
- `POST /recipes` — Save recipe (creates new with UUID or updates existing)
- `GET /recipes` — Published recipes plus all of the caller's own (converts heartedBy set to list for JSON)
- `DELETE /recipes/{id}` — Delete recipe (owner-gated)
- `PUT /recipes/{id}/heart` — Toggle heart/favorite status
- `PUT /recipes/{id}/publish` — Show/hide a recipe on Explore (owner-gated; the only way `published` changes)
- `GET /profiles/{username}` — Public chef profile (unauthenticated; case-insensitive via the `username-index` GSI, which is KEYS_ONLY so the handler re-reads the base table). Returns only `userId`, `username`, `icon`, `iconBg`, `createdAt` — never email or real name.
- `POST /agent/invoke` — Invoke Bedrock Agent, stream response
- `POST /agent/scale` — Rescale a recipe to a new serving count via the PortionArchitect agent (ephemeral; saves nothing)
- `POST /generate-upload-url` — Generate S3 presigned POST URL for image upload
- `/inventory/*` — Inventory CRUD operations

*Key Implementation Details:*
- Path extraction: Uses `rawPath` instead of `pathParameters` (catch-all routing doesn't populate pathParameters)
- Heart toggle: ADD for favoriting, DELETE with condition expression for unfavoriting
- Image upload: Generates presigned URLs, stores permanent public S3 URLs in DynamoDB
- Anonymous users: Backend accepts any userId from Authorization header (frontend generates/stores in localStorage)

**Bedrock Agent (`PortionArchitect`):**
- Single-purpose agent for the serving-size flow; no action groups, no tools, never saves
- Rescales quantities, adjusts cook times / pan sizes / batch counts, converts awkward amounts to household measures
- Replies with a strict `TITLE / SERVES / INGREDIENTS / INSTRUCTIONS / NOTES` plain-text block
- Reached only via `POST /agent/scale`; `SCALER_AGENT_ID` / `SCALER_AGENT_ALIAS_ID` env vars on the API Lambda

**Bedrock Agent (`RecipeArchitect`):**
- Receives user prompts and conversation history from frontend
- Calls Lambda via action group for recipe operations
- Instruction prompt includes:
  1. Ask before saving recipes
  2. Use Markdown in chat, plain text in review mode
  3. Support edit mode when recipeId provided in initial message
  4. Generate valid recipe formats with TITLE, INGREDIENTS, INSTRUCTIONS tags

## Deployment & CI/CD

No CI/CD pipeline configured yet. Manual deployment:

1. **Frontend:** Run `npm run build`, then deploy the `dist/` folder to a static host (S3 + CloudFront, Netlify, Vercel, etc.)
2. **Backend:** Run `cdk deploy` from the backend directory

Both frontend and backend must be deployed for the app to function; they communicate via AWS SDK calls to Bedrock and DynamoDB.

## Important Implementation Notes

### Multi-User Support
The current implementation stores all recipes in a single DynamoDB table without a user ID partition key. Moving forward (e.g., for the upcoming inventory feature), new tables must include `userId` as part of the partition key or as a leading sort key to ensure users only see their own data.

### Bedrock Agent State
Bedrock agents are stateless; conversation history is maintained by the frontend (Chat.jsx manages the message list). Each invocation sends the full history.

### DynamoDB Queries
Currently uses `ScanCommand` to fetch all recipes (works fine for small datasets but won't scale). Future pagination / user-specific queries should use `QueryCommand` with the appropriate key condition.

### Error Handling
Bedrock errors are formatted in Chat.jsx with fallback messages for common failures (marketplace subscription, access denied, etc.). Lambda errors are returned in the action response; the agent acknowledges them in chat.

## Configuration & Debugging

### Check Agent Status
```bash
cdk deploy --quiet  # Skip stack summary
cdk ls             # List stacks
cdk diff           # Compare current code to deployed stack
```

### Common Issues

- **Missing `.env.local`:** Vite will throw `Missing Bedrock config` error
- **Old Agent Alias:** If you redeploy the backend, get the new Agent Alias ID from CDK output
- **DynamoDB Credentials:** Ensure IAM user has `dynamodb:*` and `bedrock-agent-runtime:InvokeAgent` permissions
- **Bedrock Model Access:** Ensure Claude model (Sonnet 4.5) is enabled in your AWS account's Bedrock model access settings

## Recent Changes & Known Issues

### Completed (Recent)
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
- Amplify rewrite order matters: `/sitemap.xml`, `/recipe/<*>`, `/chef/<*>` proxies and the four static-route rewrites must all sit **above** the `404-200` SPA catch-all in the console's rewrite list.
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
