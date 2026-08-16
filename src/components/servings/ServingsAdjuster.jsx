import React, { useState } from "react";
import { Minus, Plus, X, Pencil, RefreshCw, Users, BookmarkPlus, ChefHat } from "lucide-react";
import { saveRecipe } from "../../lib/db";
import { sanitizeInput, sanitizeObject } from "../../lib/sanitizer";
import { normalizeServings } from "../../lib/servings";
import { normalizeTags } from "../../lib/categories";
import { scaleRecipe } from "../../lib/scaleApiClient";
// Reuses the shared .edit-input-title / .edit-textarea / .edit-input-servings
// field styling, same as Chat's review modal.
import "../explore/modal/RecipeModal.css";
import "./ServingsAdjuster.css";

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 999;

const clampServings = (n) =>
    Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(Number(n) || MIN_SERVINGS)));

/**
 * "Change Serving Size" flow, opened from the kebab on the full recipe page.
 *
 * Any signed-in user can run it, owner or not — the adjustment is ephemeral
 * and lives only in this component until they explicitly save it as their own
 * recipe. The original record is never touched.
 *
 * Steps: pick a target count -> the Portion Architect rescales -> review the
 * result, where it can be edited by hand, retried with feedback, rescaled
 * again, saved as a new recipe, or cooked as-is.
 */
export default function ServingsAdjuster({ recipe, onClose, onSaved, onCook }) {
    const [step, setStep] = useState("pick"); // pick | loading | result
    const [target, setTarget] = useState(() => clampServings(recipe.servings ?? 4));
    const [adjusted, setAdjusted] = useState(null);
    const [error, setError] = useState("");

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(null);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const runAdjustment = async (servings, feedbackText = "") => {
        setStep("loading");
        setError("");
        try {
            const result = await scaleRecipe({
                recipe,
                targetServings: servings,
                feedback: feedbackText,
                // Retries revise the previous adjustment rather than
                // rescaling from scratch — the backend is stateless, so the
                // prior result travels with the request.
                previousAdjusted: feedbackText ? adjusted : null,
            });
            setAdjusted(result);
            setIsEditing(false);
            setFeedbackOpen(false);
            setFeedback("");
            setStep("result");
        } catch (err) {
            console.error("Serving adjustment failed:", err);
            setError(err.message || "Could not adjust this recipe. Please try again.");
            // Fall back to whichever screen the user came from.
            setStep(adjusted ? "result" : "pick");
        }
    };

    // Closing mid-flow throws the adjustment away — say so before it happens.
    const handleClose = () => {
        if (adjusted && !window.confirm("These adjustments haven't been saved. Close anyway?")) {
            return;
        }
        onClose?.();
    };

    const startEdit = () => {
        setDraft({ ...adjusted });
        setIsEditing(true);
    };

    const applyEdit = () => {
        // A hand edit to the flat text makes the structured components stale —
        // drop them rather than save a mismatched pair.
        const textChanged =
            draft.ingredients !== adjusted.ingredients ||
            draft.instructions !== adjusted.instructions;
        setAdjusted({
            ...draft,
            components: textChanged ? [] : draft.components,
            servings: clampServings(draft.servings ?? target),
        });
        setIsEditing(false);
    };

    const handleSaveToMyCreations = async () => {
        setIsSaving(true);
        setError("");
        try {
            const sanitized = sanitizeObject(adjusted, ["title", "ingredients", "instructions"]);
            // No recipeId: this is a new recipe of the current user's, saved
            // unpublished like every other creation.
            const saved = await saveRecipe({
                title: sanitized.title,
                ingredients: sanitized.ingredients,
                instructions: sanitized.instructions,
                servings: normalizeServings(adjusted.servings) ?? target,
                tags: normalizeTags(recipe.tags),
                recipeImage: recipe.recipeImage ?? null,
                // Structured components ride along; applyEdit drops them when
                // a manual edit makes them stale.
                ...(adjusted.components?.length ? { components: adjusted.components } : {}),
            });
            onSaved?.(saved);
        } catch (err) {
            console.error("Saving adjusted recipe failed:", err);
            setError("Could not save this recipe. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const originalLine =
        normalizeServings(recipe.servings) === null
            ? "This recipe doesn't list a serving size — the assistant will estimate it."
            : `This recipe currently serves ${normalizeServings(recipe.servings)}.`;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div
                className="modal-content servings-modal"
                onClick={(e) => e.stopPropagation()}
                data-lenis-prevent
            >
                <button className="close-btn servings-close" onClick={handleClose} aria-label="Close">
                    <X size={18} strokeWidth={2.2} />
                </button>

                {step === "pick" && (
                    <div className="servings-pick">
                        <h2>Change Serving Size</h2>
                        <p className="servings-sub">{originalLine}</p>

                        <div className="servings-stepper">
                            <button
                                className="servings-step-btn"
                                onClick={() => setTarget((n) => clampServings(n - 1))}
                                disabled={target <= MIN_SERVINGS}
                                aria-label="One fewer serving"
                            >
                                <Minus size={18} strokeWidth={2.4} />
                            </button>
                            <input
                                className="servings-input"
                                type="number"
                                min={MIN_SERVINGS}
                                max={MAX_SERVINGS}
                                value={target}
                                onChange={(e) =>
                                    setTarget(e.target.value === "" ? "" : Number(e.target.value))
                                }
                                onBlur={() => setTarget((n) => clampServings(n))}
                                aria-label="New serving size"
                            />
                            <button
                                className="servings-step-btn"
                                onClick={() => setTarget((n) => clampServings(n + 1))}
                                disabled={target >= MAX_SERVINGS}
                                aria-label="One more serving"
                            >
                                <Plus size={18} strokeWidth={2.4} />
                            </button>
                        </div>
                        <p className="servings-hint">
                            Quantities, cooking times and measurements are all adjusted — nothing is
                            saved to the original recipe.
                        </p>

                        {error && <p className="servings-error">{error}</p>}

                        <div className="servings-actions servings-actions--end">
                            {adjusted && (
                                <button className="btn btn-secondary" onClick={() => setStep("result")}>
                                    Back
                                </button>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={() => runAdjustment(clampServings(target))}
                                disabled={!target}
                            >
                                Adjust Recipe
                            </button>
                        </div>
                    </div>
                )}

                {step === "loading" && (
                    <div className="servings-loading">
                        <div className="servings-spinner" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                        </div>
                        <h2>Rescaling your recipe</h2>
                        <p className="servings-sub">
                            Working out quantities, timings and measurements for {clampServings(target)}{" "}
                            {clampServings(target) === 1 ? "serving" : "servings"}…
                        </p>
                    </div>
                )}

                {step === "result" && adjusted && (
                    <>
                        <div className="servings-result-head">
                            <h2>{isEditing ? "Edit adjusted recipe" : adjusted.title}</h2>
                            <p className="servings-sub">
                                Adjusted to serve {adjusted.servings ?? target} · not saved yet
                            </p>
                        </div>

                        <div className="servings-result-body" data-lenis-prevent>
                            {isEditing ? (
                                <>
                                    <label className="servings-label" htmlFor="adj-title">Title</label>
                                    <input
                                        id="adj-title"
                                        className="edit-input-title"
                                        value={draft.title || ""}
                                        onChange={(e) =>
                                            setDraft({ ...draft, title: sanitizeInput(e.target.value) })
                                        }
                                    />
                                    <label className="servings-label" htmlFor="adj-servings">Serves</label>
                                    <input
                                        id="adj-servings"
                                        className="edit-input-servings"
                                        type="number"
                                        min={MIN_SERVINGS}
                                        max={MAX_SERVINGS}
                                        value={draft.servings ?? ""}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                servings: e.target.value === "" ? null : Number(e.target.value),
                                            })
                                        }
                                    />
                                    <label className="servings-label" htmlFor="adj-ingredients">Ingredients</label>
                                    <textarea
                                        id="adj-ingredients"
                                        className="edit-textarea"
                                        value={draft.ingredients || ""}
                                        onChange={(e) =>
                                            setDraft({ ...draft, ingredients: sanitizeInput(e.target.value) })
                                        }
                                    />
                                    <label className="servings-label" htmlFor="adj-instructions">Instructions</label>
                                    <textarea
                                        id="adj-instructions"
                                        className="edit-textarea servings-instructions"
                                        value={draft.instructions || ""}
                                        onChange={(e) =>
                                            setDraft({ ...draft, instructions: sanitizeInput(e.target.value) })
                                        }
                                    />
                                </>
                            ) : (
                                <>
                                    <h3>Ingredients</h3>
                                    <p className="servings-text">{adjusted.ingredients}</p>
                                    <h3>Instructions</h3>
                                    <p className="servings-text">{adjusted.instructions}</p>
                                    {adjusted.notes && (
                                        <div className="servings-notes">
                                            <h4>What changed</h4>
                                            <p>{adjusted.notes}</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {feedbackOpen && !isEditing && (
                                <div className="servings-feedback">
                                    <label className="servings-label" htmlFor="adj-feedback">
                                        What should the assistant change?
                                    </label>
                                    <textarea
                                        id="adj-feedback"
                                        className="edit-textarea servings-feedback-input"
                                        placeholder="e.g. keep the sauce quantities as they were, or use a 9x13 pan instead"
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                    />
                                    <div className="servings-actions servings-actions--end">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setFeedbackOpen(false);
                                                setFeedback("");
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() =>
                                                runAdjustment(
                                                    clampServings(adjusted.servings ?? target),
                                                    feedback.trim()
                                                )
                                            }
                                            disabled={!feedback.trim()}
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {error && <p className="servings-error">{error}</p>}

                        <div className="servings-actions servings-result-actions">
                            {isEditing ? (
                                <>
                                    <button className="btn btn-primary" onClick={applyEdit}>
                                        Done Editing
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button className="btn btn-secondary" onClick={startEdit}>
                                        <Pencil size={15} strokeWidth={2} /> Manual Edit
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setFeedbackOpen(true)}
                                        disabled={feedbackOpen}
                                    >
                                        <RefreshCw size={15} strokeWidth={2} /> Try Again
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setStep("pick")}>
                                        <Users size={15} strokeWidth={2} /> Change Serving Size
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => onCook?.(adjusted)}
                                    >
                                        <ChefHat size={15} strokeWidth={2} /> Cook With These
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSaveToMyCreations}
                                        disabled={isSaving}
                                    >
                                        <BookmarkPlus size={15} strokeWidth={2} />{" "}
                                        {isSaving ? "Saving…" : "Save to My Creations"}
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
