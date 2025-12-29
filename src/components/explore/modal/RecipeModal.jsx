import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import './RecipeModal.css';

// Setup DB Client for direct manual saves (Explore Mode)
const dbClient = new DynamoDBClient({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocumentClient.from(dbClient);

const RecipeModal = ({ recipe, onClose, onRefresh, onSave, isEditing: initialIsEditing = false }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  
  // Initialize state with the passed recipe (including emoji)
  const [editedRecipe, setEditedRecipe] = useState({ ...recipe });
  
  // Allow the parent to force edit mode (e.g., from Chat)
  const [isEditing, setIsEditing] = useState(initialIsEditing);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if the prop recipe changes
  useEffect(() => {
    if (recipe) {
        setEditedRecipe({ ...recipe });
    }
  }, [recipe]);

  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  if (!recipe) return null;

  const handleImprove = (mode) => {
    // Send the current recipe context to the chat for AI improvements
    navigate('/chat', { state: { recipeToImprove: recipe, saveMode: mode } });
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    
    // If a custom onSave prop is provided (like from Chat.jsx), use it
    if (onSave) {
        await onSave(editedRecipe);
        setIsSaving(false);
        return;
    }

    // Otherwise, perform the direct DynamoDB update (Explore Mode)
    try {
      // Ensure we preserve the ID or generate a fallback
      const finalItem = {
          ...editedRecipe,
          recipeId: editedRecipe.recipeId || recipe.recipeId,
          emoji: editedRecipe.emoji || '🥘' // Default fallback
      };

      await docClient.send(new PutCommand({
        TableName: "CulinaryCraftBackendStack-RecipesTable058A1F33-1GRXYSW38KE1I",
        Item: finalItem 
      }));
      
      setIsEditing(false);

      // Refresh the background grid in Explore
      if (onRefresh) await onRefresh(); 
      
      alert("Changes saved!");
      
    } catch (err) {
      console.error("Manual save failed:", err);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        
        {/* --- Header Section (Emoji + Title) --- */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
            {isEditing ? (
                <>
                    {/* EDIT MODE: Emoji Input */}
                    <input 
                        className="edit-input-emoji"
                        style={{
                            fontSize: '2rem',
                            width: '60px',
                            height: '50px',
                            textAlign: 'center',
                            borderRadius: '12px',
                            border: '2px solid #dee2e6',
                            background: 'white',
                            flexShrink: 0
                        }}
                        value={editedRecipe.emoji || '🥘'}
                        onChange={(e) => setEditedRecipe({...editedRecipe, emoji: e.target.value})}
                    />
                    {/* EDIT MODE: Title Input */}
                    <input 
                        className="edit-input-title"
                        style={{ margin: 0 }} // Override default margin for flex layout
                        value={editedRecipe.title}
                        onChange={(e) => setEditedRecipe({...editedRecipe, title: e.target.value})}
                    />
                </>
            ) : (
                <>
                    {/* VIEW MODE: Display Emoji + Title */}
                    <span style={{ fontSize: '2.5rem' }}>{recipe.emoji || '🥘'}</span>
                    <h2 style={{ margin: 0, textAlign: 'left' }}>{recipe.title || "Untitled Recipe"}</h2>
                </>
            )}
        </div>
        
        {/* --- Action Buttons --- */}
        <div className="modal-actions" style={{marginBottom: '20px', display: 'flex', gap: '10px'}}>
          {!isEditing ? (
            <>
              <div style={{position: 'relative'}} ref={dropdownRef}>
                <button className="action-btn ai-btn" onClick={() => setShowDropdown(!showDropdown)}>
                  Improve with AI
                </button>
                {showDropdown && (
                  <div className="dropdown-menu">
                    <button onClick={() => handleImprove('UPDATE')}>Edit this version</button>
                    <button onClick={() => handleImprove('NEW')}>Start a Copy</button>
                  </div>
                )}
              </div>
              <button className="action-btn manual-btn" onClick={() => setIsEditing(true)}>
                Manual Edit
              </button>
            </>
          ) : (
            <>
              <button className="action-btn save-btn" onClick={handleManualSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
              <button className="action-btn cancel-btn" onClick={() => {setIsEditing(false); setEditedRecipe({...recipe});}}>
                Cancel
              </button>
            </>
          )}
        </div>

        {/* --- Body Content --- */}
        <div className="modal-body">
          <h3>Ingredients</h3>
          {isEditing ? (
            <textarea 
              className="edit-textarea"
              value={editedRecipe.ingredients}
              onChange={(e) => setEditedRecipe({...editedRecipe, ingredients: e.target.value})}
            />
          ) : (
            <ReactMarkdown>{recipe.ingredients || "_No ingredients listed_"}</ReactMarkdown>
          )}
          
          <h3>Instructions</h3>
          {isEditing ? (
            <textarea 
              className="edit-textarea"
              value={editedRecipe.instructions}
              onChange={(e) => setEditedRecipe({...editedRecipe, instructions: e.target.value})}
            />
          ) : (
            <ReactMarkdown>{recipe.instructions || "_No instructions listed_"}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeModal;