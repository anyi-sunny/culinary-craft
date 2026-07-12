import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { saveRecipe } from "../../../lib/db";
import { recipeTitle, isOwner, isHearted } from "../../../lib/recipeUtils";
import { uploadImageToS3, getPlaceholderColor, validateImage } from "../../../lib/imageUtils";
import OwnerActions from "./OwnerActions";
import NonOwnerActions from "./NonOwnerActions";
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
    const imageInputRef = useRef(null);
    // Local heart state for instant feedback inside the modal.
    const [hearted, setHearted] = useState(isHearted(recipe, userId));

    const isRecipeOwner = isOwner(recipe, userId);

    useEffect(() => {
        if (recipe) {
            setEditedRecipe({ ...recipe });
            setHearted(isHearted(recipe, userId));
        }
    }, [recipe, userId]);

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

                {/* Image Section - Sticky at top */}
                <div
                    className="recipe-image-container"
                    style={{
                        backgroundColor: !editedRecipe.recipeImage
                            ? getPlaceholderColor(editedRecipe.recipeId || "default")
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
                        <div className="recipe-image-placeholder">
                            <span className="placeholder-text">Recipe Image</span>
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
                        <>
                            <h2 className="modal-title">{recipeTitle(recipe)}</h2>
                            <button
                                className={`heart-btn modal-heart${hearted ? " hearted" : ""}`}
                                title={hearted ? "Remove from favorites" : "Add to favorites"}
                                onClick={handleHeart}
                            >
                                {hearted ? "★" : "☆"}
                            </button>
                        </>
                    )}
                </div>

                {/* Actions */}
                <div className="modal-actions">
                    {isRecipeOwner ? (
                        <OwnerActions
                            recipe={recipe}
                            isEditing={isEditing}
                            isSaving={isSaving}
                            onEdit={() => setIsEditing(true)}
                            onDelete={handleDelete}
                            onSave={handleManualSave}
                            onCancel={() => {
                                setIsEditing(false);
                                setEditedRecipe({ ...recipe });
                            }}
                        />
                    ) : (
                        <NonOwnerActions
                            recipe={recipe}
                            onCopyAndEdit={handleCopyAndEdit}
                            onCopyAndImprove={handleCopyAndImprove}
                        />
                    )}
                    {!isEditing && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => {
                                onClose?.();
                                navigate(`/recipe/${recipe.recipeId}`);
                            }}
                        >
                            View Full Recipe
                        </button>
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
        </div>
    );
};

export default RecipeModal;
