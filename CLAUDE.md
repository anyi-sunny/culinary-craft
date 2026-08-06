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
VITE_IDENTITY_POOL_ID=us-east-1:uuid...           # Cognito Identity Pool ID
VITE_API_ENDPOINT=https://xxxxx.execute-api.us-east-1.amazonaws.com  # Backend HTTP API Gateway URL
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
- **`src/components/explore/RecipeGrid.jsx`** — Shared grid + search + modal used by Explore/MyRecipes/Favorites
- **`src/components/explore/RecipeCard.jsx`** — Card shows recipe with grey heart (no border). Displays creator email. No edit/delete buttons (moved to modal).
- **`src/components/explore/modal/RecipeModal.jsx`** — Modal opened from card. Shows recipe details and action buttons.
  - **`OwnerActions.jsx`** — Edit/Delete buttons for recipe owners
  - **`NonOwnerActions.jsx`** — Dropdown to copy & edit or copy & improve with AI
- **`src/components/explore/RecipeDetail.jsx`** — Full page view of recipe with edit/delete/copy options
- **`src/components/inventory/Inventory.jsx`** — Inventory management page
- **`src/components/auth/`** — Cognito integration (Amplify Authenticator, auth context)
- **`src/components/favorites/Favorites.jsx`** — User's hearted recipes
- **`src/components/myrecipes/MyRecipes.jsx`** — Recipes created by current user

**Utilities:**
- **`src/lib/recipeUtils.js`** — `isOwner()`, `canEdit()`, `isHearted()`, `heartedByList()`
- **`src/lib/imageUtils.js`** — S3 image upload, placeholder colors, image validation
- **`src/lib/inventoryDb.js`** — Inventory data layer (delegates to inventoryApiClient)
- **`src/lib/recipeValidator.js`** — Recipe field validation

**Key Patterns:**
- **Authorization:** Bearer token in Authorization header contains userId (Cognito ID or anonymous temp ID)
- **Markdown Stripping:** Chat responses cleaned before saving to DynamoDB (plain text only)
- **Creator Attribution:** All new recipes store `creatorEmail` (extracted from Cognito). Recipe cards display this in grey text.
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
- `GET /recipes` — Fetch all recipes (converts heartedBy set to list for JSON)
- `DELETE /recipes/{id}` — Delete recipe (owner-gated)
- `PUT /recipes/{id}/heart` — Toggle heart/favorite status
- `POST /agent/invoke` — Invoke Bedrock Agent, stream response
- `POST /generate-upload-url` — Generate S3 presigned POST URL for image upload
- `/inventory/*` — Inventory CRUD operations

*Key Implementation Details:*
- Path extraction: Uses `rawPath` instead of `pathParameters` (catch-all routing doesn't populate pathParameters)
- Heart toggle: ADD for favoriting, DELETE with condition expression for unfavoriting
- Image upload: Generates presigned URLs, stores permanent public S3 URLs in DynamoDB
- Anonymous users: Backend accepts any userId from Authorization header (frontend generates/stores in localStorage)

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
- ✅ Creator attribution: All recipes store `creatorEmail`, displayed on cards
- ✅ Copy recipes: Non-owners can create their own versions via modal dropdown
- ✅ Ownership detection: Fixed `isOwner()` vs `canEdit()` distinction
- ✅ UI reorganization: Edit/delete buttons moved to modal, recipe cards simplified
- ✅ Heart button styling: Borderless stars, grey default, yellow on hover/when hearted
- ✅ Tutorial modal: Now only shows for unauthenticated users (fixed refresh bug)

### Current Issues
- 🔴 Heart toggle returns 500 error: DynamoDB DELETE operation failing when `heartedBy` attribute doesn't exist. Backend logging added (`❤️` prefix in CloudWatch).
  - **Workaround:** Check CloudWatch logs for actual error: `cdk deploy --quiet && npm run dev`, then test and view Lambda logs in AWS Console
  - **Fix in progress:** Handling missing `heartedBy` attribute gracefully

### Not Yet Implemented
- Admin access control (planned but not started)
- Meal planner feature (reference in memory)
- Shopping assistant feature (reference in memory)
- Recipe search/filtering (basic search exists, advanced filters TODO)
- User profile/settings page

## Staying Productive

- **Frontend HMR:** Vite hot-reloads on file save; CSS and JSX changes appear instantly
- **Backend testing:** After editing `lambda/recipes_api/index.py`, run `cdk deploy`, then test via frontend
- **CloudWatch logs:** View Lambda output: AWS Console → CloudWatch → Logs → search for `/aws/lambda/RecipesApiLambda`
- **Authorization debugging:** All API calls include Bearer token with userId. Verify token in browser DevTools → Network → request headers
- **Recipe data inspection:** Use AWS Console → DynamoDB → RecipesTable to view recipe structure and heartedBy sets
