import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import SplashTransition from '../SplashTransition';
import TopNav from '../nav/TopNav';
import { useRecipes } from '../../lib/useRecipes';
import { useAuthModal } from '../auth/authModalContext';
import './RecipeDetail.css';

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthenticator((ctx) => [ctx.user]);
  const userId = user?.userId || null;
  const { recipes, toggleHeart, removeRecipe } = useRecipes();
  const [recipe, setRecipe] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);

  useEffect(() => {
    const found = recipes.find((r) => r.recipeId === id);
    if (found) {
      setRecipe(found);
      setEditData(found);
    }
  }, [id, recipes]);

  if (!recipe) {
    return (
      <SplashTransition>
        <div className="page">
          <TopNav />
          <div className="recipe-detail-container">
            <div className="recipe-not-found">
              <h2>Recipe not found</h2>
              <p>The recipe you're looking for doesn't exist.</p>
              <button className="btn btn-primary" onClick={() => navigate('/explore')}>
                Back to Explore
              </button>
            </div>
          </div>
        </div>
      </SplashTransition>
    );
  }

  const isOwner = recipe.ownerId === userId;
  const isHearted = recipe.heartedBy && recipe.heartedBy.includes(userId);

  const handleToggleHeart = () => {
    toggleHeart(recipe, userId);
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this recipe? This cannot be undone.')) {
      await removeRecipe(recipe, userId);
      navigate('/explore');
    }
  };

  const handleSaveEdit = async () => {
    setRecipe(editData);
    setIsEditing(false);
    // Save is handled by the parent through useRecipes
  };

  const handleCopyAndEdit = async (mode) => {
    if (!userId) {
      alert('Please log in to create a copy of this recipe');
      return;
    }

    const copy = {
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      recipeImage: recipe.recipeImage,
      notes: recipe.notes,
    };

    navigate('/chat', { state: { recipeToImprove: copy, saveMode: 'CREATE' } });
  };

  return (
    <SplashTransition>
      <div className="page">
        <TopNav />
        <div className="recipe-detail-container">
          <button className="recipe-detail-back" onClick={() => navigate(-1)}>
            ← Back
          </button>

          {/* Image Section */}
          <div className="recipe-detail-image-container">
            {recipe.recipeImage ? (
              <img src={recipe.recipeImage} alt={recipe.title} />
            ) : (
              <div className="recipe-detail-placeholder">
                <span>📷</span>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="recipe-detail-content">
            {/* Header with title and heart */}
            <div className="recipe-detail-header">
              <div>
                <h1>{recipe.title}</h1>
              </div>
              <div className="recipe-detail-actions">
                <button
                  className={`heart-btn ${isHearted ? 'hearted' : ''}`}
                  onClick={handleToggleHeart}
                  title={isHearted ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isHearted ? '★' : '☆'}
                </button>
                {isOwner ? (
                  <>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                    <button className="btn btn-danger" onClick={handleDelete}>
                      Delete
                    </button>
                  </>
                ) : (
                  <div className="detail-copy-dropdown">
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                    >
                      Make a Copy ⋯
                    </button>
                    {showCopyDropdown && (
                      <div className="copy-dropdown-menu">
                        <button
                          className="copy-option"
                          onClick={() => {
                            handleCopyAndEdit('edit');
                            setShowCopyDropdown(false);
                          }}
                        >
                          Create Copy & Edit
                        </button>
                        <button
                          className="copy-option"
                          onClick={() => {
                            handleCopyAndEdit('improve');
                            setShowCopyDropdown(false);
                          }}
                        >
                          Create Copy & Improve with AI
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Edit or View Mode */}
            {isEditing ? (
              <div className="recipe-detail-edit">
                <div className="form-group">
                  <label>Title</label>
                  <input
                    type="text"
                    value={editData.title || ''}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Ingredients</label>
                  <textarea
                    value={editData.ingredients || ''}
                    onChange={(e) => setEditData({ ...editData, ingredients: e.target.value })}
                    rows={6}
                  />
                </div>
                <div className="form-group">
                  <label>Instructions</label>
                  <textarea
                    value={editData.instructions || ''}
                    onChange={(e) => setEditData({ ...editData, instructions: e.target.value })}
                    rows={8}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleSaveEdit}>
                  Save Changes
                </button>
              </div>
            ) : (
              <div className="recipe-detail-view">
                <div className="recipe-detail-section">
                  <h2>Ingredients</h2>
                  <p className="recipe-detail-text">{recipe.ingredients}</p>
                </div>

                <div className="recipe-detail-section">
                  <h2>Instructions</h2>
                  <p className="recipe-detail-text">{recipe.instructions}</p>
                </div>

                {recipe.notes && (
                  <div className="recipe-detail-section">
                    <h2>Notes</h2>
                    <p className="recipe-detail-text">{recipe.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </SplashTransition>
  );
}
