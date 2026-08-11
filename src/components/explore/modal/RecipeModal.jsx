import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Bookmark, Package, Pencil, Sparkles, Trash2, Copy } from "lucide-react";
import { saveRecipe } from "../../../lib/db";
import { recipeTitle, isOwner, isHearted } from "../../../lib/recipeUtils";
import { uploadImageToS3, getPlaceholderGradient, validateImage } from "../../../lib/imageUtils";
import { sanitizeInput, sanitizeObject } from "../../../lib/sanitizer";
import { normalizeTags } from "../../../lib/categories";
import { TagOvals, CategoryChecklist } from "../../tags/CategoryTags";
import RecipeActionsMenu from "../RecipeActionsMenu";
import ConsultInventoryModal from "./ConsultInventoryModal";
import "./RecipeModal.css";

const RecipeModal = ({
    recipe,
    userId,
    onClose,
    onRefresh,
    onToggleHeart,
    onRequireLogin,
    onDelete,
    isEditing: initialIsEditing = false,
}) => {
    const navigate = useNavigate();

    const [editedRecipe, setEditedRecipe] = useState({ ...recipe });
    const [isEditing, setIsEditing] = useState(initialIsEditing);
    const [isSaving, setIsSaving] = useState(false);
    const [imageError, setImageError] = useState("");
    const [showConsultInventory, setShowConsultInventory] = useState(false);
    const imageInputRef = useRef(null);
    // Local heart state for instant feedback inside the modal.
    const [hearted, setHearted] = useState(isHearted(recipe, userId));

    const isRecipeOwner = isOwner(recipe, userId);

    useEffect(() => {
        if (recipe) {
            setEditedRecipe({ ...recipe });
            setHearted(isHearted(recipe, userId));
        }
    }, [recipe, recipe?.heartedBy, userId]);

    if (!recipe) return null;

    const handleDelete = async () => {
        if (window.confirm('Delete this recipe? This cannot be undone.')) {
            await onDelete?.(recipe, userId);
            onClose?.();
        }
    };

    const handleCopyAndEdit = (recipeToEdit) => {
        if (!userId) {
            onRequireLogin?.();
            return;
        }
        const copy = {
            title: recipeToEdit.title,
            ingredients: recipeToEdit.ingredients,
            instructions: recipeToEdit.instructions,
            recipeImage: recipeToEdit.recipeImage,
            notes: recipeToEdit.notes,
        };
        navigate('/chat', { state: { recipeToImprove: copy, saveMode: 'CREATE' } });
        onClose?.();
    };

    const handleCopyAndImprove = (recipeToImprove) => {
        if (!userId) {
            onRequireLogin?.();
            return;
        }
        const copy = {
            title: recipeToImprove.title,
            ingredients: recipeToImprove.ingredients,
            instructions: recipeToImprove.instructions,
            recipeImage: recipeToImprove.recipeImage,
            notes: recipeToImprove.notes,
        };
        navigate('/chat', { state: { recipeToImprove: copy, saveMode: 'CREATE' } });
        onClose?.();
    };

    const handleHeart = () => {
        if (!userId) {
            onRequireLogin?.();
            return;
        }
        setHearted((h) => !h); // optimistic local toggle
        onToggleHeart?.(recipe);
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setImageError("");
            await validateImage(file);
            // Upload to S3 and get the public URL
            const imageUrl = await uploadImageToS3(file, userId);
            setEditedRecipe({ ...editedRecipe, recipeImage: imageUrl });
        } catch (err) {
            setImageError(err.message);
        }
    };

    const handleRemoveImage = () => {
        setEditedRecipe({ ...editedRecipe, recipeImage: null });
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    };

    const handleManualSave = async () => {
        setIsSaving(true);
        try {
            // Sanitize recipe fields before saving
            const sanitized = sanitizeObject(editedRecipe, ['title', 'ingredients', 'instructions', 'notes']);

            const finalItem = {
                ...sanitized,
                recipeId: sanitized.recipeId || recipe.recipeId,
                // Preserve ownership; manual edit never re-owns a recipe.
                ownerId: recipe.ownerId,
                tags: normalizeTags(sanitized.tags),
            };
            // Recipes no longer carry a decorative emoji field.
            delete finalItem.emoji;
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

    // Owners improve their own recipe in place (UPDATE); the chat preserves
    // ownership and recipeId through this flow.
    const handleImproveWithAI = () => {
        if (!userId) {
            onRequireLogin?.();
            return;
        }
        navigate('/chat', { state: { recipeToImprove: { ...recipe }, saveMode: 'UPDATE' } });
        onClose?.();
    };

    const menuItems = isRecipeOwner
        ? [
              { label: "Consult Inventory", icon: Package, onClick: () => setShowConsultInventory(true) },
              { label: "Manual Edit", icon: Pencil, onClick: () => setIsEditing(true) },
              { label: "Improve with AI", icon: Sparkles, onClick: handleImproveWithAI },
              ...(onDelete ? [{ label: "Delete", icon: Trash2, danger: true, onClick: handleDelete }] : []),
          ]
        : [
              { label: "Consult Inventory", icon: Package, onClick: () => setShowConsultInventory(true) },
              { label: "Copy & Edit", icon: Copy, onClick: () => handleCopyAndEdit(recipe) },
              { label: "Copy & Improve with AI", icon: Sparkles, onClick: () => handleCopyAndImprove(recipe) },
          ];

    if (showConsultInventory) {
        return (
            <ConsultInventoryModal
                recipe={recipe}
                userId={userId}
                onClose={() => setShowConsultInventory(false)}
            />
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content recipe-modal" onClick={(e) => e.stopPropagation()} data-lenis-prevent>
                <button className="close-btn" onClick={onClose} aria-label="Close">
                    ×
                </button>

                {/* Image Section - Sticky at top */}
                <div
                    className="recipe-image-container"
                    style={{
                        background: !editedRecipe.recipeImage
                            ? getPlaceholderGradient(editedRecipe.recipeId)
                            : "transparent",
                    }}
                >
                    {editedRecipe.recipeImage ? (
                        <img
                            src={editedRecipe.recipeImage}
                            alt={recipeTitle(editedRecipe)}
                            className="recipe-image"
                        />
                    ) : (
                        <div className="recipe-image-placeholder" aria-hidden="true">
                            <span className="modal-monogram">
                                {(recipeTitle(editedRecipe) || "R").trim().charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}

                    {isEditing && (
                        <div className="image-upload-overlay">
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleImageSelect}
                                style={{ display: "none" }}
                            />
                            <button
                                className="btn-upload-image"
                                onClick={() => imageInputRef.current?.click()}
                            >
                                Upload Image
                            </button>
                            {editedRecipe.recipeImage && (
                                <button
                                    className="btn-remove-image"
                                    onClick={handleRemoveImage}
                                >
                                    Remove Image
                                </button>
                            )}
                        </div>
                    )}
                    {imageError && <div className="image-error">{imageError}</div>}
                </div>

                {/* Scrollable Content Area */}
                <div className="modal-scrollable">
                    {/* Header: title + heart */}
                    <div className="modal-header">
                    {isEditing ? (
                        <input
                            className="edit-input-title"
                            value={editedRecipe.title ?? recipeTitle(editedRecipe)}
                            onChange={(e) =>
                                setEditedRecipe({ ...editedRecipe, title: e.target.value })
                            }
                        />
                    ) : (
                        <h2 className="modal-title">{recipeTitle(recipe)}</h2>
                    )}
                </div>

                {!isEditing && <TagOvals tags={recipe.tags} className="modal-tags" />}

                {/* Actions: View Full Recipe stays standalone; everything else
                    lives in the three-dot menu. Editing swaps in Save/Cancel. */}
                <div className="modal-actions">
                    {isEditing ? (
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
                    ) : (
                        <>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    onClose?.();
                                    navigate(`/recipe/${recipe.recipeId}`);
                                }}
                            >
                                View Full Recipe
                            </button>
                            <button
                                className={`modal-actions-heart${hearted ? " hearted" : ""}`}
                                title={hearted ? "Remove from saved" : "Save recipe"}
                                aria-label={hearted ? "Remove from saved" : "Save recipe"}
                                onClick={handleHeart}
                            >
                                <Bookmark
                                    size={18}
                                    strokeWidth={2}
                                    fill={hearted ? "currentColor" : "none"}
                                />
                            </button>
                            <RecipeActionsMenu items={menuItems} />
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
                                setEditedRecipe({ ...editedRecipe, ingredients: sanitizeInput(e.target.value) })
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
                                setEditedRecipe({ ...editedRecipe, instructions: sanitizeInput(e.target.value) })
                            }
                        />
                    ) : (
                        <ReactMarkdown>
                            {recipe.instructions || "_No instructions listed_"}
                        </ReactMarkdown>
                    )}

                    {isEditing && isRecipeOwner && (
                        <>
                            <h3>Categories</h3>
                            <CategoryChecklist
                                selected={editedRecipe.tags || []}
                                onToggle={(tag) =>
                                    setEditedRecipe((prev) => ({
                                        ...prev,
                                        tags: (prev.tags || []).includes(tag)
                                            ? prev.tags.filter((t) => t !== tag)
                                            : [...(prev.tags || []), tag],
                                    }))
                                }
                            />
                        </>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
};

export default RecipeModal;
