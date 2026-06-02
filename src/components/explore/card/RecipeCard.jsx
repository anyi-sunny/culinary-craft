import React from "react";
import { motion } from "framer-motion";
import { recipeTitle, canEdit, isHearted, heartedByList } from "../../../lib/recipeUtils";
import "./RecipeCard.css";

const RecipeCard = ({ recipe, onClick, onDelete, onToggleHeart, userId }) => {
    const name = recipeTitle(recipe);
    const hearted = isHearted(recipe, userId);
    const heartCount = heartedByList(recipe).length;
    const showDelete = onDelete && canEdit(recipe, userId);

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
                        {hearted ? "❤️" : "🤍"}
                    </motion.span>
                    {heartCount > 0 && <span className="heart-count">{heartCount}</span>}
                </button>

                {showDelete && (
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
                )}
            </div>

            <div className="card-emoji">{recipe.emoji || "🥘"}</div>
            <h3 className="card-title">{name}</h3>
            <span className="view-btn">View Recipe →</span>
        </motion.div>
    );
};

export default RecipeCard;
