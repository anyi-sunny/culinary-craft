import { fetchAuthSession } from "aws-amplify/auth";
import { parseRecipeBlock } from "./recipeText";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

// /agent/scale sits behind an API Gateway JWT authorizer — the header must
// carry the verified Cognito ID token, not a raw userId.
async function getAuthToken() {
    try {
        const session = await fetchAuthSession();
        return session.tokens?.idToken?.toString() || null;
    } catch {
        // Anonymous visitors can't scale — the endpoint requires a user.
    }
    return null;
}

/**
 * Ask the Portion Architect to rescale a recipe (Claude API via backend).
 *
 * The adjustment is ephemeral: nothing is written to DynamoDB unless the user
 * later saves it as their own recipe. Any signed-in user can scale any recipe,
 * owned or not.
 *
 * Fully stateless: a "Try Again" retry sends the previous adjustment plus the
 * user's feedback explicitly — there is no server-side session.
 *
 * @param {object} opts
 * @param {object} opts.recipe             the recipe as shown on the full page
 * @param {number} opts.targetServings
 * @param {string} [opts.feedback]         follow-up notes for a retry
 * @param {object} [opts.previousAdjusted] the adjustment being revised on retry
 * @returns {Promise<{title, ingredients, instructions, servings, notes, components, raw}>}
 */
export async function scaleRecipe({ recipe, targetServings, feedback, previousAdjusted }) {
    const token = await getAuthToken();
    if (!token) throw new Error("Please log in to adjust serving sizes.");

    const res = await fetch(`${API_ENDPOINT}/agent/scale`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            targetServings,
            feedback: feedback || "",
            recipe: {
                title: recipe.title,
                ingredients: recipe.ingredients,
                instructions: recipe.instructions,
                servings: recipe.servings ?? null,
                components: recipe.components ?? null,
            },
            previousAdjusted: previousAdjusted
                ? {
                      title: previousAdjusted.title,
                      servings: previousAdjusted.servings ?? null,
                      components: previousAdjusted.components ?? [],
                      notes: previousAdjusted.notes || "",
                  }
                : null,
        }),
    });

    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const err = new Error(payload.error || `Adjustment failed (${res.status})`);
        err.status = res.status;
        throw err;
    }

    const result = await res.json();

    // Preferred: the structured recipe from the new backend.
    if (result.recipe) {
        const r = result.recipe;
        return {
            title: r.title,
            ingredients: r.ingredients,
            instructions: r.instructions,
            servings: r.servings ?? targetServings,
            notes: r.notes || "",
            components: r.components || [],
            raw: result.output,
        };
    }

    // Fallback: parse the legacy plain-text block (old backend during rollout).
    const parsed = parseRecipeBlock(result.output);
    if (!parsed) {
        throw new Error("The assistant's adjustment came back in an unexpected format. Try again.");
    }
    return { ...parsed, servings: parsed.servings ?? targetServings, components: [], raw: result.output };
}
