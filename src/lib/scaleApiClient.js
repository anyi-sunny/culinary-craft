import { getCurrentUser } from "aws-amplify/auth";
import { parseRecipeBlock } from "./recipeText";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

async function getAuthToken() {
    try {
        const user = await getCurrentUser();
        if (user?.userId) return user.userId;
    } catch {
        // Anonymous visitors can't scale — the endpoint requires a user.
    }
    return null;
}

/**
 * Ask the Portion Architect agent to rescale a recipe.
 *
 * The adjustment is ephemeral: nothing is written to DynamoDB unless the user
 * later saves it as their own recipe. Any signed-in user can scale any recipe,
 * owned or not.
 *
 * @param {object} opts
 * @param {string} opts.sessionId    stable per adjustment conversation, so
 *                                   "try again" feedback keeps its context
 * @param {object} opts.recipe       the recipe as shown on the full page
 * @param {number} opts.targetServings
 * @param {string} [opts.feedback]   follow-up notes for a retry
 * @returns {Promise<{title, ingredients, instructions, servings, notes, raw}>}
 */
export async function scaleRecipe({ sessionId, recipe, targetServings, feedback }) {
    const token = await getAuthToken();
    if (!token) throw new Error("Please log in to adjust serving sizes.");

    const res = await fetch(`${API_ENDPOINT}/agent/scale`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            sessionId,
            targetServings,
            feedback: feedback || "",
            recipe: {
                title: recipe.title,
                ingredients: recipe.ingredients,
                instructions: recipe.instructions,
                servings: recipe.servings ?? null,
            },
        }),
    });

    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const err = new Error(payload.error || `Adjustment failed (${res.status})`);
        err.status = res.status;
        throw err;
    }

    const { output } = await res.json();
    const parsed = parseRecipeBlock(output);
    if (!parsed) {
        throw new Error("The assistant's adjustment came back in an unexpected format. Try again.");
    }
    return { ...parsed, servings: parsed.servings ?? targetServings, raw: output };
}
