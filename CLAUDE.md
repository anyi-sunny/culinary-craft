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

**Data Flow:**
1. User signs in via Cognito (frontend calls Amplify)
2. Frontend invokes Bedrock Agent (via `InvokeAgentCommand`)
3. Agent processes chat, may call Lambda via action group
4. Lambda reads/writes DynamoDB recipes table
5. Frontend fetches recipes directly from DynamoDB using SDK credentials

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
VITE_AWS_REGION=us-east-1                    # AWS region
VITE_AWS_ACCESS_KEY_ID=...                   # AWS credentials (for DynamoDB + Bedrock)
VITE_AWS_SECRET_ACCESS_KEY=...
VITE_AGENT_ID=JYWISMTDL9                     # Bedrock Agent ID (from CDK output)
VITE_AGENT_ALIAS_ID=TSTALIASID               # Bedrock Agent Alias ID
VITE_USER_POOL_ID=us-east-1_...              # Cognito User Pool ID
VITE_CLIENT_ID=...                           # Cognito App Client ID
VITE_RECIPES_TABLE=CulinaryCraftBackendStack-RecipesTable... # (optional) DynamoDB table name
```

The agent and user pool IDs are output by `cdk deploy`. Get them with:
```bash
cdk deploy | grep -E "AgentId|UserPoolId|UserPoolClientId"
```

### Backend AWS Credentials

CDK needs AWS credentials in your environment. Either:
- Configure `~/.aws/credentials` and `~/.aws/config` (recommended)
- Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` env vars

## Critical Files & Architecture Decisions

### Frontend Structure

- **`src/App.jsx`** — Router setup (page layout is handled here)
- **`src/lib/db.js`** — Single source of truth for DynamoDB operations (ScanCommand for recipes, PutCommand for saves, UpdateCommand for hearts). **All DynamoDB calls must go through here.**
- **`src/components/chat/Chat.jsx`** — Main chat interface, invokes Bedrock Agent via `InvokeAgentCommand`, streams responses
- **`src/components/auth/`** — Cognito integration (Amplify Authenticator, auth context)
- **`src/components/explore/Explore.jsx`** — Browse all recipes, with pagination
- **`src/components/favorites/Favorites.jsx`** — User's hearted recipes
- **`src/components/myrecipes/MyRecipes.jsx`** — Recipes created by the current user

**Key Pattern: Markdown Stripping** — Chat responses may include Markdown (`**bold**`, headings, code ticks). The `stripMarkdown()` utility in Chat.jsx removes these before saving to DynamoDB, since the saved fields are plain text. Review modal rendering requires the cleaned text.

### Backend Structure

- **`culinary_craft_backend_stack.py`** — Entire CDK stack definition:
  - DynamoDB recipes table (partition key: `recipeId`)
  - Bedrock Agent (`RecipeArchitect`) with instruction prompt
  - Lambda function (`recipe_handler/index.py`) as action group executor
  - Cognito User Pool + App Client
  - All resource outputs (agent ID, pool ID, etc.) logged as CfnOutput
  
- **`lambda/recipe_handler/index.py`** — Action group handler:
  - Parses `actionGroup`, `function`, and `parameters` from Bedrock
  - `save_recipe` — Creates new recipe with UUID, or updates if recipeId provided
  - `delete_recipe` — Removes recipe from table
  - Returns structured action response for agent to acknowledge

**Key Pattern: Lambda ARN Extraction** — Frontend env vars can contain full ARNs (e.g., `arn:aws:bedrock:...`) or just IDs. `getIdFromArn()` in Chat.jsx handles both.

**Agent Instruction Contract** — The agent has detailed instructions about:
1. Wait before saving (ask user first)
2. Output Markdown during chat, but **plain text only** when preparing for the review modal
3. Use specific tags (`TITLE:`, `INGREDIENTS:`, `INSTRUCTIONS:`) in review mode
4. Support edit mode when a `recipeId` is provided in initial message

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

## Staying Productive

- **Frontend HMR:** Vite hot-reloads on file save; CSS and JSX changes appear instantly
- **ESLint:** Run `npm run lint` before committing; fix warnings to keep CI clean
- **Lambda Testing:** Modify `lambda/recipe_handler/index.py`, run `cdk synth`, then `cdk deploy` to test
- **Agent Tweaks:** Edit the `instruction` string in the Stack, redeploy, and re-test in chat
