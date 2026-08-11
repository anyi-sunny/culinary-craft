import React, { useState, useRef, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Bookmark, Package, Pencil, Sparkles, Trash2, Copy, ChefHat, Camera, MessageSquare } from 'lucide-react';
import SplashTransition from '../SplashTransition';
import TopNav from '../nav/TopNav';
import RecipeActionsMenu from './RecipeActionsMenu';
import RecipeComments from './RecipeComments';
import CookMode from '../cook/CookMode';
import { useRecipes } from '../../lib/useRecipes';
import { useAuthModal } from '../auth/authModalContext';
import { saveRecipe } from '../../lib/db';
import { sanitizeInput, sanitizeObject } from '../../lib/sanitizer';
import { normalizeTags } from '../../lib/categories';
import { TagOvals, CategoryChecklist } from '../tags/CategoryTags';
import { getPlaceholderGradient, uploadImageToS3, validateImage } from '../../lib/imageUtils';
import { fireConfetti } from '../../lib/confetti';
import ConsultInventoryModal from './modal/ConsultInventoryModal';
import './RecipeDetail.css';

/* Grows to fit its content instead of scrolling internally. */
function AutoGrowTextarea({ value, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight excludes borders; add them back for border-box sizing.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);
  return <textarea ref={ref} value={value} {...props} />;
}

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthenticator((ctx) => [ctx.user]);
  const userId = user?.userId || null;
  const { recipes, toggleHeart, removeRecipe } = useRecipes();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showConsultInventory, setShowConsultInventory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState('');
  const imageInputRef = useRef(null);
  // Local edits shadow the fetched record until the next refetch.
  const [localEdits, setLocalEdits] = useState(null);

  // Cook mode + finish flow
  const [showCookMode, setShowCookMode] = useState(false);
  const [showFinishPopup, setShowFinishPopup] = useState(false);
  const [offerPhoto, setOfferPhoto] = useState(false);
  const [finishPhotoBusy, setFinishPhotoBusy] = useState(false);
  const [commentsFocus, setCommentsFocus] = useState(null);
  const finishPhotoRef = useRef(null);
  const { requireLogin } = useAuthModal();

  // Derive the recipe from the shared list instead of mirroring it in state.
  const recipe = localEdits ?? recipes.find((r) => r.recipeId === id) ?? null;

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

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImageError('');
      await validateImage(file);
      const imageUrl = await uploadImageToS3(file, userId);
      setEditData((prev) => ({ ...prev, recipeImage: imageUrl }));
    } catch (err) {
      setImageError(err.message);
    }
  };

  const handleRemoveImage = () => {
    setEditData((prev) => ({ ...prev, recipeImage: null }));
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleSaveEdit = async () => {
    // Sanitize recipe fields before saving
    const sanitized = sanitizeObject(editData, ['title', 'ingredients', 'instructions', 'notes']);
    const finalItem = {
      ...sanitized,
      recipeId: recipe.recipeId,
      // Preserve ownership; manual edit never re-owns a recipe.
      ownerId: recipe.ownerId,
      tags: normalizeTags(sanitized.tags),
    };
    delete finalItem.emoji;

    setIsSaving(true);
    try {
      await saveRecipe(finalItem);
      setLocalEdits(finalItem);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save recipe edits:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyAndEdit = async () => {
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

  const handleFinishCooking = () => {
    setShowCookMode(false);
    fireConfetti();
    // Offer the photo prompt to owners whose recipe has no photo yet;
    // feedback is always offered.
    setOfferPhoto(isOwner && !recipe.recipeImage);
    setShowFinishPopup(true);
  };

  const handleFinishPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFinishPhotoBusy(true);
    try {
      await validateImage(file);
      const imageUrl = await uploadImageToS3(file, userId);
      const updated = { ...recipe, recipeImage: imageUrl, ownerId: recipe.ownerId };
      delete updated.emoji;
      await saveRecipe(updated);
      setLocalEdits(updated);
      setShowFinishPopup(false);
    } catch (err) {
      console.error('Error saving finish photo:', err);
      alert(err.message || 'Could not upload the photo.');
    } finally {
      setFinishPhotoBusy(false);
    }
  };

  // Owners improve their own recipe in place (UPDATE preserves ownership).
  const handleImproveWithAI = () => {
    navigate('/chat', { state: { recipeToImprove: { ...recipe }, saveMode: 'UPDATE' } });
  };

  const menuItems = isOwner
    ? [
        { label: 'Consult Inventory', icon: Package, onClick: () => setShowConsultInventory(true) },
        {
          label: 'Manual Edit',
          icon: Pencil,
          onClick: () => {
            setEditData(recipe);
            setIsEditing(true);
          },
        },
        { label: 'Improve with AI', icon: Sparkles, onClick: handleImproveWithAI },
        { label: 'Delete', icon: Trash2, danger: true, onClick: handleDelete },
      ]
    : [
        { label: 'Consult Inventory', icon: Package, onClick: () => setShowConsultInventory(true) },
        { label: 'Copy & Edit', icon: Copy, onClick: handleCopyAndEdit },
        { label: 'Copy & Improve with AI', icon: Sparkles, onClick: handleCopyAndEdit },
      ];

  return (
    <SplashTransition>
      {showConsultInventory && (
        <ConsultInventoryModal
          recipe={recipe}
          userId={userId}
          onClose={() => setShowConsultInventory(false)}
        />
      )}

      <div className="page">
        <TopNav />
        <div className="recipe-detail-container">
          <button className="recipe-detail-back" onClick={() => navigate(-1)}>
            ← Back
          </button>

          {/* Image Section (editable when in edit mode) */}
          <div className="recipe-detail-image-container">
            {(isEditing ? editData.recipeImage : recipe.recipeImage) ? (
              <img
                src={isEditing ? editData.recipeImage : recipe.recipeImage}
                alt={recipe.title}
              />
            ) : (
              <div
                className="recipe-detail-placeholder"
                style={{ background: getPlaceholderGradient(recipe.recipeId) }}
                aria-hidden="true"
              >
                <span className="detail-monogram">
                  {(recipe.title || 'R').trim().charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {isEditing && (
              <div className="detail-image-upload-overlay">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                <button
                  className="btn-upload-image"
                  onClick={() => imageInputRef.current?.click()}
                >
                  Upload Image
                </button>
                {editData.recipeImage && (
                  <button className="btn-remove-image" onClick={handleRemoveImage}>
                    Remove Image
                  </button>
                )}
              </div>
            )}
            {isEditing && imageError && (
              <div className="detail-image-error">{imageError}</div>
            )}
          </div>

          {/* Main Content */}
          <div className="recipe-detail-content">
            {/* Header with title and heart */}
            <div className="recipe-detail-header">
              <div>
                <h1>{recipe.title}</h1>
                {!isEditing && <TagOvals tags={recipe.tags} className="detail-tags" />}
              </div>
              <div className="recipe-detail-actions">
                {!isEditing && (
                  <button
                    className="btn btn-primary start-cooking-btn"
                    onClick={() => setShowCookMode(true)}
                  >
                    <ChefHat size={16} strokeWidth={2.2} /> Start Cooking
                  </button>
                )}
                <button
                  className={`heart-btn ${isHearted ? 'hearted' : ''}`}
                  onClick={handleToggleHeart}
                  title={isHearted ? 'Remove from saved' : 'Save recipe'}
                >
                  <Bookmark size={19} strokeWidth={2} fill={isHearted ? 'currentColor' : 'none'} />
                </button>
                {!isEditing && <RecipeActionsMenu items={menuItems} />}
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
                    onChange={(e) => setEditData({ ...editData, title: sanitizeInput(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Ingredients</label>
                  <AutoGrowTextarea
                    value={editData.ingredients || ''}
                    onChange={(e) => setEditData({ ...editData, ingredients: sanitizeInput(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Instructions</label>
                  <AutoGrowTextarea
                    value={editData.instructions || ''}
                    onChange={(e) => setEditData({ ...editData, instructions: sanitizeInput(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Categories</label>
                  <CategoryChecklist
                    selected={editData.tags || []}
                    onToggle={(tag) =>
                      setEditData((prev) => ({
                        ...prev,
                        tags: (prev.tags || []).includes(tag)
                          ? prev.tags.filter((t) => t !== tag)
                          : [...(prev.tags || []), tag],
                      }))
                    }
                  />
                </div>
                <div className="recipe-detail-edit-actions">
                  <button className="btn btn-primary" onClick={handleSaveEdit} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                </div>
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

          {/* Feedback / Questions card */}
          <RecipeComments
            recipe={recipe}
            userId={userId}
            onRequireLogin={requireLogin}
            focusRequest={commentsFocus}
          />
        </div>
      </div>

      {showCookMode && (
        <CookMode
          recipe={recipe}
          onExit={() => setShowCookMode(false)}
          onFinish={handleFinishCooking}
        />
      )}

      {showFinishPopup && (
        <div className="cook-finish-overlay" onClick={() => setShowFinishPopup(false)}>
          <div className="cook-finish-popup" onClick={(e) => e.stopPropagation()}>
            <h2>Beautifully done, chef</h2>
            <p>
              {offerPhoto
                ? 'This recipe has no photo yet — show off what you made, or let others know how it went.'
                : 'Hope it turned out delicious. Let others know how it went!'}
            </p>
            <div className="cook-finish-actions">
              {offerPhoto && (
                <>
                  <input
                    ref={finishPhotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFinishPhoto}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => finishPhotoRef.current?.click()}
                    disabled={finishPhotoBusy}
                  >
                    <Camera size={16} strokeWidth={2.2} />{' '}
                    {finishPhotoBusy ? 'Uploading…' : 'Upload a photo of your dish'}
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowFinishPopup(false);
                  setCommentsFocus({ tab: 'feedback', ts: Date.now() });
                }}
              >
                <MessageSquare size={16} strokeWidth={2.2} /> Leave feedback
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowFinishPopup(false)}
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </SplashTransition>
  );
}
