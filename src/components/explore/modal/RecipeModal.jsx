import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { saveRecipe } from "../../../lib/db";
import { recipeTitle, canEdit, isHearted } from "../../../lib/recipeUtils";
import "./RecipeModal.css";

const RecipeModal = ({
    recipe,
    userId,
    onClose,
    onRefresh,
    onToggleHeart,
    onRequireLogin,
    isEditing: initialIsEditing = false,
}) => {
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    const [editedRecipe, setEditedRecipe] = useState({ ...recipe });
    const [isEditing, setIsEditing] = useState(initialIsEditing);
    const [showDropdown, setShowDropdown] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Local heart state for instant feedback inside the modal.
    const [hearted, setHearted] = useState(isHearted(recipe, userId));

    const editable = canEdit(recipe, userId);

    useEffect(() => {
        if (recipe) {
            setEditedRecipe({ ...recipe });
            setHearted(isHearted(recipe, userId));
        }
    }, [recipe, userId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showDropdown &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showDropdown]);

    if (!recipe) return null;

    const handleImprove = (mode) => {
        navigate("/chat", { state: { recipeToImprove: recipe, saveMode: mode } });
    };

    const handleHeart = () => {
        if (!userId) {
            onRequireLogin?.();
            return;
        }
        setHearted((h) => !h); // optimistic local toggle
        onToggleHeart?.(recipe);
    };

    const handleManualSave = async () => {
        setIsSaving(true);
        try {
            const finalItem = {
                ...editedRecipe,
                recipeId: editedRecipe.recipeId || recipe.recipeId,
                emoji: editedRecipe.emoji || "🥘",
                // Preserve ownership; manual edit never re-owns a recipe.
                ownerId: recipe.ownerId,
            };
            await saveRecipe(finalItem);
            setIsEditing(false);
            if (onRefresh) await onRefresh();
            else alert("Changes saved!");
        } catch (err) {
            console.error("Manual save failed:", err);
            alert("Failed to save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>
                    ×
                </button>

                {/* Header: emoji + title + heart */}
                <div className="modal-header">
                    {isEditing ? (
                        <>
                            <input
                                className="edit-input-emoji"
                                value={editedRecipe.emoji || "🥘"}
                                onChange={(e) =>
                                    setEditedRecipe({ ...editedRecipe, emoji: e.target.value })
                                }
                            />
                            <input
                                className="edit-input-title"
                                style={{ margin: 0 }}
                                value={editedRecipe.title ?? recipeTitle(editedRecipe)}
                                onChange={(e) =>
                                    setEditedRecipe({ ...editedRecipe, title: e.target.value })
                                }
                            />
                        </>
                    ) : (
                        <>
                            <span className="modal-emoji">{recipe.emoji || "🥘"}</span>
                            <h2 className="modal-title">{recipeTitle(recipe)}</h2>
                            <button
                                className={`heart-btn modal-heart${hearted ? " hearted" : ""}`}
                                title={hearted ? "Remove from favorites" : "Add to favorites"}
                                onClick={handleHeart}
                            >
                                {hearted ? "❤️" : "🤍"}
                            </button>
                        </>
                    )}
                </div>

                {/* Actions */}
                <div className="modal-actions">
                    {!isEditing ? (
                        <>
                            <div style={{ position: "relative" }} ref={dropdownRef}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowDropdown(!showDropdown)}
                                >
                                    Improve with AI
                                </button>
                                {showDropdown && (
                                    <div className="dropdown-menu">
                                        {editable && (
                                            <button onClick={() => handleImprove("UPDATE")}>
                                                Edit this version
                                            </button>
                                        )}
                                        <button onClick={() => handleImprove("NEW")}>
                                            Start a copy
                                        </button>
                                    </div>
                                )}
                            </div>
                            {editable && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setIsEditing(true)}
                                >
                                    Manual Edit
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <button
                                className="btn btn-primary"
                                onClick={handleManualSave}
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving…" : "Save Changes"}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditedRecipe({ ...recipe });
                                }}
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>

                {/* Body */}
                <div className="modal-body">
                    <h3>Ingredients</h3>
                    {isEditing ? (
                        <textarea
                            className="edit-textarea"
                            value={editedRecipe.ingredients || ""}
                            onChange={(e) =>
                                setEditedRecipe({ ...editedRecipe, ingredients: e.target.value })
                            }
                        />
                    ) : (
                        <ReactMarkdown>
                            {recipe.ingredients || "_No ingredients listed_"}
                        </ReactMarkdown>
                    )}

                    <h3>Instructions</h3>
                    {isEditing ? (
                        <textarea
                            className="edit-textarea"
                            value={editedRecipe.instructions || ""}
                            onChange={(e) =>
                                setEditedRecipe({ ...editedRecipe, instructions: e.target.value })
                            }
                        />
                    ) : (
                        <ReactMarkdown>
                            {recipe.instructions || "_No instructions listed_"}
                        </ReactMarkdown>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecipeModal;
