import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Bookmark, Package, Pencil, Sparkles, Trash2, Copy, ChefHat, Camera, MessageSquare, Users, EyeOff, Globe, Link2, Check } from 'lucide-react';
import SplashTransition from '../SplashTransition';
import TopNav from '../nav/TopNav';
import RecipeActionsMenu from './RecipeActionsMenu';
import RecipeComments from './RecipeComments';
import CookMode from '../cook/CookMode';
import ServingsAdjuster from '../servings/ServingsAdjuster';
import { useRecipes } from '../../lib/useRecipes';
import { useAuthModal } from '../auth/authModalContext';
import { saveRecipe } from '../../lib/db';
import { sanitizeInput, sanitizeObject } from '../../lib/sanitizer';
import { normalizeTags } from '../../lib/categories';
import { isPublished, creatorName } from '../../lib/recipeUtils';
import { normalizeServings, formatServings } from '../../lib/servings';
import { TagOvals, CategoryChecklist } from '../tags/CategoryTags';
import { getPlaceholderGradient, uploadImageToS3, validateImage } from '../../lib/imageUtils';
import { fireConfetti } from '../../lib/confetti';
import { usePageMeta } from '../../lib/usePageMeta';
import { recipeParts, editablePhases, phasesToRecipeFields } from '../../lib/recipeParts';
import RecipeParts from '../recipes/RecipeParts';
import PhaseEditor from '../recipes/PhaseEditor';
import { recipeMetaDescription, recipeJsonLd } from '../../lib/seo';
import JsonLd from '../seo/JsonLd';
import ConsultInventoryModal from './modal/ConsultInventoryModal';
import './RecipeDetail.css';

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthenticator((ctx) => [ctx.user]);
  const userId = user?.userId || null;
  const { recipes, loading, refresh, toggleHeart, togglePublish, removeRecipe } = useRecipes();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  // Ingredients/directions are edited per phase (PhaseEditor), not as the
  // flat strings; (re)parsed from the record each time editing starts.
  const [editPhases, setEditPhases] = useState(null);
  const [showConsultInventory, setShowConsultInventory] = useState(false);
  const [showServingsAdjuster, setShowServingsAdjuster] = useState(false);
  // A serving-size adjustment the user chose to cook without saving.
  const [cookOverride, setCookOverride] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState('');
  const imageInputRef = useRef(null);
  // Local edits shadow the fetched record until the next refetch.
  const [localEdits, setLocalEdits] = useState(null);

  // "Link copied" feedback on the share button.
  const [linkCopied, setLinkCopied] = useState(false);
  const copyResetRef = useRef(null);
  useEffect(() => () => clearTimeout(copyResetRef.current), []);

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
  usePageMeta(
    recipe
      ? {
          title: recipe.title,
          description: recipeMetaDescription(recipe),
          path: `/recipe/${recipe.recipeId}`,
          image: recipe.recipeImage,
        }
      : { title: loading ? null : 'Recipe Not Found' }
  );

  // While the recipe list is still being fetched we can't know yet whether
  // this id exists — show the loading dots instead of a premature not-found.
  // A failed fetch ends with an empty list, which falls through to not-found.
  if (!recipe && loading) {
    return (
      <SplashTransition>
        <div className="page">
          <TopNav />
          <div className="recipe-detail-container">
            <div className="recipe-detail-loading" role="status">
              <div className="loading-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p>Fetching your recipe</p>
            </div>
          </div>
        </div>
      </SplashTransition>
    );
  }

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
  const published = isPublished(recipe);
  const parts = recipeParts(recipe);

  const handleToggleHeart = () => {
    toggleHeart(recipe, userId);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/recipe/${recipe.recipeId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API needs a secure context; fall back to a hidden textarea.
      const el = document.createElement('textarea');
      el.value = url;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setLinkCopied(true);
    clearTimeout(copyResetRef.current);
    copyResetRef.current = setTimeout(() => setLinkCopied(false), 1600);
  };

  const handleTogglePublish = async (next) => {
    const ok = await togglePublish(recipe, next);
    if (!ok) {
      alert(next ? 'Could not publish this recipe.' : 'Could not hide this recipe.');
      return;
    }
    // The page reads from the shared list, which the hook already updated
    // optimistically; keep any local edit shadow in sync too.
    setLocalEdits((prev) => (prev ? { ...prev, published: next } : prev));
  };

  // Saving an adjusted copy creates a brand-new recipe; refetch so the
  // detail page can resolve it, and drop any stale local edit shadow.
  const handleAdjustedSaved = async (saved) => {
    setShowServingsAdjuster(false);
    setLocalEdits(null);
    await refresh();
    if (saved?.recipeId) navigate(`/recipe/${saved.recipeId}`);
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
      servings: normalizeServings(sanitized.servings),
    };
    delete finalItem.emoji;
    // The phase editor is the edit UI, so the flat strings are serialized
    // from it — and `components` is rebuilt from the same lines, so unlike
    // the old free-text edit it never goes stale. stepIngredients still
    // drops on change: the server recomputes it on save, but this object
    // also becomes the local shadow Cook Mode reads until refetch.
    const fields = phasesToRecipeFields(editPhases ?? editablePhases(recipe));
    finalItem.ingredients = fields.ingredients;
    finalItem.instructions = fields.instructions;
    if (
      finalItem.ingredients !== recipe.ingredients ||
      finalItem.instructions !== recipe.instructions
    ) {
      if (fields.components) finalItem.components = fields.components;
      else delete finalItem.components;
      delete finalItem.stepIngredients;
    }

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
    // feedback is always offered. A photo of an unsaved serving adjustment
    // would land on the original recipe, so skip the offer in that case.
    setOfferPhoto(isOwner && !recipe.recipeImage && !cookOverride);
    setCookOverride(null);
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

  // Changing the serving size is open to everyone: the adjustment is
  // temporary and never touches the original recipe.
  const adjustServingsItem = {
    label: 'Change Serving Size',
    icon: Users,
    onClick: () => {
      if (!userId) {
        requireLogin();
        return;
      }
      setShowServingsAdjuster(true);
    },
  };

  const menuItems = isOwner
    ? [
        // Inventory + shopping list are account features; prompt guests to log in.
        { label: 'Consult Inventory', icon: Package, onClick: () => (userId ? setShowConsultInventory(true) : requireLogin()) },
        adjustServingsItem,
        {
          label: 'Manual Edit',
          icon: Pencil,
          onClick: () => {
            setEditData(recipe);
            setEditPhases(editablePhases(recipe));
            setIsEditing(true);
          },
        },
        { label: 'Improve with AI', icon: Sparkles, onClick: handleImproveWithAI },
        ...(published
          ? [{ label: 'Hide from Explore', icon: EyeOff, onClick: () => handleTogglePublish(false) }]
          : []),
        { label: 'Delete', icon: Trash2, danger: true, onClick: handleDelete },
      ]
    : [
        // Inventory + shopping list are account features; prompt guests to log in.
        { label: 'Consult Inventory', icon: Package, onClick: () => (userId ? setShowConsultInventory(true) : requireLogin()) },
        adjustServingsItem,
        { label: 'Copy & Edit', icon: Copy, onClick: handleCopyAndEdit },
        { label: 'Copy & Improve with AI', icon: Sparkles, onClick: handleCopyAndEdit },
      ];

  return (
    <SplashTransition>
      {isPublished(recipe) && <JsonLd id="recipe-jsonld" data={recipeJsonLd(recipe)} />}
      {showConsultInventory && (
        <ConsultInventoryModal
          recipe={recipe}
          userId={userId}
          onClose={() => setShowConsultInventory(false)}
        />
      )}

      {showServingsAdjuster && (
        <ServingsAdjuster
          recipe={recipe}
          onClose={() => setShowServingsAdjuster(false)}
          onSaved={handleAdjustedSaved}
          onCook={(adjusted) => {
            setShowServingsAdjuster(false);
            setCookOverride(adjusted);
            setShowCookMode(true);
          }}
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
                {!isEditing && creatorName(recipe) && (
                  <p className="detail-creator">
                    by{' '}
                    {recipe.creatorUsername ? (
                      <button
                        className="creator-link"
                        title={`View ${creatorName(recipe)}'s public profile`}
                        onClick={() => navigate(`/chef/${recipe.creatorUsername}`)}
                      >
                        {creatorName(recipe)}
                      </button>
                    ) : (
                      creatorName(recipe)
                    )}
                  </p>
                )}
                {!isEditing && formatServings(recipe.servings) && (
                  <p className="detail-servings">{formatServings(recipe.servings)}</p>
                )}
                {!isEditing && <TagOvals tags={recipe.tags} className="detail-tags" />}
                {!isEditing && isOwner && !published && (
                  <p className="detail-unpublished">
                    <EyeOff size={13} strokeWidth={2} /> Only you can see this recipe — publish it to
                    share it on Explore.
                  </p>
                )}
              </div>
              <div className="recipe-detail-actions">
                {!isEditing && isOwner && !published && (
                  <button
                    className="btn btn-success publish-btn"
                    onClick={() => handleTogglePublish(true)}
                    title="Show this recipe on Explore for everyone"
                  >
                    <Globe size={16} strokeWidth={2.2} /> Publish
                  </button>
                )}
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
                <button
                  className={`heart-btn copy-link-btn${linkCopied ? ' copied' : ''}`}
                  onClick={handleCopyLink}
                  title={linkCopied ? 'Link copied!' : 'Copy link to this recipe'}
                  aria-label={linkCopied ? 'Link copied' : 'Copy link to this recipe'}
                >
                  {linkCopied ? (
                    <Check size={19} strokeWidth={2.2} />
                  ) : (
                    <Link2 size={19} strokeWidth={2} />
                  )}
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
                {editPhases && (
                  <PhaseEditor phases={editPhases} onChange={setEditPhases} />
                )}
                <div className="form-group">
                  <label>Serving Size (approx.)</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    className="detail-servings-input"
                    value={editData.servings ?? ''}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        servings: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
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
                  <RecipeParts groups={parts.ingredients} emptyText="No ingredients listed" />
                </div>

                <div className="recipe-detail-section">
                  <h2>Instructions</h2>
                  <RecipeParts groups={parts.steps} ordered emptyText="No instructions listed" />
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
          recipe={cookOverride ?? recipe}
          onExit={() => {
            setShowCookMode(false);
            setCookOverride(null);
          }}
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
