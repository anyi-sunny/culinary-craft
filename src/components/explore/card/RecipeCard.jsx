import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bookmark, ArrowRight, EyeOff, Globe } from "lucide-react";
import { recipeTitle, isHearted, heartedByList, isOwner, isPublished, creatorName } from "../../../lib/recipeUtils";
import { getPlaceholderGradient } from "../../../lib/imageUtils";
import { TagOvals } from "../../tags/CategoryTags";
import "./RecipeCard.css";

const RecipeCard = ({ recipe, onClick, onToggleHeart, onTogglePublish, userId }) => {
    const navigate = useNavigate();
    const name = recipeTitle(recipe);
    const hearted = isHearted(recipe, userId);
    const heartCount = heartedByList(recipe).length;
    const monogram = (name || "R").trim().charAt(0).toUpperCase();
    const creator = creatorName(recipe);
    // Only the owner ever sees an unpublished recipe, so the private badge
    // and publish shortcut are theirs alone.
    const showPrivate = isOwner(recipe, userId) && !isPublished(recipe);

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

                {showPrivate && (
                    <span className="card-private-badge">
                        <EyeOff size={12} strokeWidth={2.2} /> Private
                    </span>
                )}
            </div>

            <div className="card-body">
                <h3 className="card-title">{name}</h3>
                {creator && (
                    <p className="card-creator">
                        by{" "}
                        {recipe.creatorUsername ? (
                            <button
                                className="creator-link"
                                title={`View ${creator}'s public profile`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/chef/${recipe.creatorUsername}`);
                                }}
                            >
                                {creator}
                            </button>
                        ) : (
                            creator
                        )}
                    </p>
                )}
                <TagOvals tags={recipe.tags} className="card-tags" />
                <div className="card-footer">
                    <span className="view-btn">
                        View Recipe
                        <ArrowRight size={15} strokeWidth={2.2} className="view-arrow" />
                    </span>
                    {showPrivate && onTogglePublish && (
                        <button
                            className="card-publish-btn"
                            title="Show this recipe on Explore"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTogglePublish(recipe, true);
                            }}
                        >
                            <Globe size={13} strokeWidth={2.2} /> Publish
                        </button>
                    )}
                </div>
            </div>
        </motion.article>
    );
};

export default RecipeCard;
