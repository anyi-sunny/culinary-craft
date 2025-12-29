import React from 'react';
import './RecipeCard.css';

const RecipeCard = ({ recipe, onClick, onDelete }) => {
  const name = recipe.title || "Untitled Recipe";

  return (
    <div className="recipe-card" onClick={onClick} style={{ position: 'relative' }}>
      {/* Delete Button */}
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

      <div className="card-emoji">
        {recipe.emoji || '🥘'}
      </div>
      <h3>{name}</h3>
      <span className="view-btn">View Recipe</span>
    </div>
  );
};

export default RecipeCard;