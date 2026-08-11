import React from "react";
import { motion } from "framer-motion";
import { Bookmark, ArrowRight } from "lucide-react";
import { recipeTitle, isHearted, heartedByList } from "../../../lib/recipeUtils";
import { getPlaceholderGradient } from "../../../lib/imageUtils";
import { TagOvals } from "../../tags/CategoryTags";
import "./RecipeCard.css";

const RecipeCard = ({ recipe, onClick, onToggleHeart, userId }) => {
    const name = recipeTitle(recipe);
    const hearted = isHearted(recipe, userId);
    const heartCount = heartedByList(recipe).length;
    const monogram = (name || "R").trim().charAt(0).toUpperCase();

    return (
        <motion.article
            className="recipe-card"
            onClick={onClick}
            whileHover={{ y: -6 }}
            transition={{ type: "tween", duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="card-media">
                {recipe.recipeImage ? (
                    <img
                        src={recipe.recipeImage}
                        alt={name}
                        className="card-image-img"
                        loading="lazy"
                    />
                ) : (
                    <div
                        className="card-image-placeholder"
                        style={{ background: getPlaceholderGradient(recipe.recipeId) }}
                        aria-hidden="true"
                    >
                        <span className="card-monogram">{monogram}</span>
                    </div>
                )}

                <button
                    className={`heart-btn card-heart${hearted ? " hearted" : ""}`}
                    title={hearted ? "Remove from saved" : "Save recipe"}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleHeart?.(recipe);
                    }}
                >
                    <motion.span
                        className="heart-icon-wrap"
                        key={hearted ? "on" : "off"}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 16 }}
                    >
                        <Bookmark
                            size={15}
                            strokeWidth={2}
                            fill={hearted ? "currentColor" : "none"}
                        />
                    </motion.span>
                    {heartCount > 0 && <span className="heart-count">{heartCount}</span>}
                </button>
            </div>

            <div className="card-body">
                <h3 className="card-title">{name}</h3>
                {(recipe.creatorEmail || recipe.ownerId) && (
                    <p className="card-creator">by {recipe.creatorEmail || "Unknown creator"}</p>
                )}
                <TagOvals tags={recipe.tags} className="card-tags" />
                <span className="view-btn">
                    View Recipe
                    <ArrowRight size={15} strokeWidth={2.2} className="view-arrow" />
                </span>
            </div>
        </motion.article>
    );
};

export default RecipeCard;
