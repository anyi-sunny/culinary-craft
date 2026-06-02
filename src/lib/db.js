// Single source of truth for talking to the recipes table.
// Previously the DynamoDB client + table name were copy-pasted across
// Explore.jsx, RecipeModal.jsx and Chat.jsx. This consolidates all of that.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    ScanCommand,
    PutCommand,
    DeleteCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

// Falls back to the literal table name so no Amplify env change is required,
// but can be overridden with VITE_RECIPES_TABLE.
export const RECIPES_TABLE =
    import.meta.env.VITE_RECIPES_TABLE ||
    "CulinaryCraftBackendStack-RecipesTable058A1F33-1GRXYSW38KE1I";

const dbClient = new DynamoDBClient({
    region: import.meta.env.VITE_AWS_REGION,
    credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    },
});

export const docClient = DynamoDBDocumentClient.from(dbClient, {
    // Drop empty strings/undefined instead of erroring, and keep Sets intact.
    marshallOptions: { removeUndefinedValues: true },
});

/** Fetch every recipe (small dataset; a full scan is fine here). */
export async function fetchAllRecipes() {
    const res = await docClient.send(new ScanCommand({ TableName: RECIPES_TABLE }));
    return res.Items || [];
}

/** Create or overwrite a recipe item. */
export async function saveRecipe(item) {
    await docClient.send(new PutCommand({ TableName: RECIPES_TABLE, Item: item }));
    return item;
}

/** Delete a recipe by id. */
export async function deleteRecipe(recipeId) {
    await docClient.send(
        new DeleteCommand({ TableName: RECIPES_TABLE, Key: { recipeId } })
    );
}

/**
 * Toggle a heart for a user on a recipe. Uses an atomic ADD/DELETE on the
 * `heartedBy` string set so concurrent hearts don't clobber each other.
 */
export async function setHeart(recipeId, userId, on) {
    await docClient.send(
        new UpdateCommand({
            TableName: RECIPES_TABLE,
            Key: { recipeId },
            UpdateExpression: on ? "ADD heartedBy :u" : "DELETE heartedBy :u",
            ExpressionAttributeValues: { ":u": new Set([userId]) },
        })
    );
}
