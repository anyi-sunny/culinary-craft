import React, { useState } from "react";
import { motion } from "framer-motion";
import { recipeTitle, isOwner, isHearted, heartedByList } from "../../../lib/recipeUtils";
import { getPlaceholderColor } from "../../../lib/imageUtils";
import "./RecipeCard.css";

const RecipeCard = ({ recipe, onClick, onDelete, onToggleHeart, onCopyAndEdit, userId }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const name = recipeTitle(recipe);
    const hearted = isHearted(recipe, userId);
    const heartCount = heartedByList(recipe).length;
    const ownsRecipe = isOwner(recipe, userId);
    const showDelete = onDelete && ownsRecipe;

    return (
        <motion.div
            className="recipe-card"
            onClick={onClick}
            whileHover={{ y: -4 }}
            transition={{ type: "tween", duration: 0.18 }}
        >
            <div className="card-top">
                <button
                    className={`heart-btn${hearted ? " hearted" : ""}`}
                    title={hearted ? "Remove from favorites" : "Add to favorites"}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleHeart?.(recipe);
                    }}
                >
                    <motion.span
                        key={hearted ? "on" : "off"}
                        initial={{ scale: 0.6 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    >
                        {hearted ? "★" : "☆"}
                    </motion.span>
                    {heartCount > 0 && <span className="heart-count">{heartCount}</span>}
                </button>

                {ownsRecipe ? (
                    showDelete && (
                        <button
                            className="delete-btn-overlay"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(recipe);
                            }}
                            title="Delete Recipe"
                        >
                            ×
                        </button>
                    )
                ) : (
                    <div className="dropdown-container">
                        <button
                            className="dropdown-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDropdown(!showDropdown);
                            }}
                            title="Make your own copy"
                        >
                            ⋮
                        </button>
                        {showDropdown && (
                            <div className="dropdown-menu">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopyAndEdit?.(recipe, 'edit');
                                        setShowDropdown(false);
                                    }}
                                >
                                    Create Copy & Edit
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopyAndEdit?.(recipe, 'improve');
                                        setShowDropdown(false);
                                    }}
                                >
                                    Create Copy & Improve with AI
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div
                className="card-image"
                style={{
                    backgroundColor: !recipe.recipeImage
                        ? getPlaceholderColor(recipe.recipeId || "default")
                        : "transparent",
                }}
            >
                {recipe.recipeImage ? (
                    <img
                        src={recipe.recipeImage}
                        alt={name}
                        className="card-image-img"
                    />
                ) : (
                    <div className="card-image-placeholder">
                        {recipe.emoji || "🍳"}
                    </div>
                )}
            </div>

            <h3 className="card-title">{name}</h3>
            {(recipe.creatorEmail || recipe.ownerId) && (
                <p className="card-creator">by {recipe.creatorEmail || 'Unknown creator'}</p>
            )}
            <span className="view-btn">View Recipe →</span>
        </motion.div>
    );
};

export default RecipeCard;
