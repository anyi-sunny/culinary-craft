import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { fetchUserInventory, addInventoryItem } from '../../../lib/inventoryDb';
import './ConsultInventoryModal.css';

// Simple semantic matching: ingredient and inventory item match when either
// contains the other, or they share a word longer than 2 characters.
const matchesInventoryItem = (ingredient, items) => {
  const normalized = ingredient.toLowerCase().trim();
  return items.some((item) => {
    const itemName = (item.name || '').toLowerCase().trim();
    if (!itemName) return false;
    return (
      normalized.includes(itemName) ||
      itemName.includes(normalized) ||
      normalized.split(/\s+/).some((word) => word.length > 2 && itemName.includes(word))
    );
  });
};

const ConsultInventoryModal = ({ recipe, userId, onClose }) => {
  const navigate = useNavigate();
  const [shoppingList, setShoppingList] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [ingredientStatus, setIngredientStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [addingToInventory, setAddingToInventory] = useState(false);

  // Parse and clean ingredients (strip leading dashes, drop blank lines)
  const ingredients = useMemo(
    () =>
      (recipe.ingredients || '')
        .split('\n')
        .map((line) => line.replace(/^-\s*/, '').trim())
        .filter((line) => line.length > 0),
    [recipe.ingredients]
  );

  // Load inventory and mark ingredients that are already in stock
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadAndMatch = async () => {
      try {
        const items = await fetchUserInventory(userId);
        if (cancelled) return;
        setInventoryItems(items);

        const status = {};
        ingredients.forEach((ingredient, idx) => {
          const matched = matchesInventoryItem(ingredient, items);
          status[idx] = { checked: matched, aiMatched: matched, quantity: '' };
        });
        setIngredientStatus(status);
      } catch (err) {
        console.error('Error loading inventory:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAndMatch();
    return () => {
      cancelled = true;
    };
  }, [userId, ingredients]);

  const handleAddToShoppingList = async (idx) => {
    const ingredient = ingredients[idx];
    const currentStatus = ingredientStatus[idx];

    if (currentStatus.aiMatched && currentStatus.checked) {
      // If AI matched but user wants to buy more, ask about removing from inventory
      const shouldRemove = window.confirm(
        `This ingredient (${ingredient}) is in your inventory. Would you like to remove it temporarily until you go shopping?`
      );

      if (shouldRemove) {
        // TODO: Remove from inventory
        setInventoryItems(inventoryItems.filter(item => item.name !== ingredient));
      } else {
        // Ask for clarification
        const reason = prompt(
          'Is this ingredient:\n1. Not the same as the one listed\n2. Other\n\nEnter "not the same" or "other":'
        );
        if (!reason) return;
      }
    }

    // Add to shopping list
    setShoppingList(prev => [
      ...prev,
      {
        id: `${idx}-${Date.now()}`,
        name: ingredient,
        quantity: currentStatus.quantity || '',
        checked: false
      }
    ]);

    // Mark as added to shopping list
    setIngredientStatus(prev => ({
      ...prev,
      [idx]: { ...prev[idx], inShoppingList: true }
    }));
  };

  const handleRemoveFromShoppingList = (shoppingListId) => {
    setShoppingList(prev => prev.filter(item => item.id !== shoppingListId));

    // Find which ingredient this was and update status
    const shoppingItem = shoppingList.find(item => item.id === shoppingListId);
    if (shoppingItem) {
      const ingredientIdx = ingredients.findIndex(ing => ing === shoppingItem.name);
      if (ingredientIdx !== -1) {
        setIngredientStatus(prev => ({
          ...prev,
          [ingredientIdx]: { ...prev[ingredientIdx], inShoppingList: false }
        }));
      }
    }
  };

  const handleAddCheckedItemsToInventory = async () => {
    if (!userId) {
      alert('Please log in to add items to inventory');
      return;
    }

    setAddingToInventory(true);
    try {
      // Find all checked items in shopping list
      const checkedItems = shoppingList.filter(item => {
        const ingredientIdx = ingredients.findIndex(ing => ing === item.name);
        return ingredientStatus[ingredientIdx]?.checked;
      });

      // Add each checked item to inventory
      for (const item of checkedItems) {
        await addInventoryItem(userId, {
          name: item.name,
          category: 'pantry',
          quantity: item.quantity || '',
          unit: '',
          notes: 'Added from shopping list',
        });
      }

      // Remove checked items from shopping list
      setShoppingList(prev => {
        const updatedList = prev.filter(item => {
          const ingredientIdx = ingredients.findIndex(ing => ing === item.name);
          return !ingredientStatus[ingredientIdx]?.checked;
        });
        return updatedList;
      });

      // Uncheck all items
      const newStatus = {};
      ingredients.forEach((ing, idx) => {
        newStatus[idx] = { ...ingredientStatus[idx], checked: false };
      });
      setIngredientStatus(newStatus);
    } catch (err) {
      console.error('Error adding items to inventory:', err);
      alert('Failed to add items to inventory');
    } finally {
      setAddingToInventory(false);
    }
  };

  const handleSaveAndGoToShoppingList = () => {
    if (shoppingList.length === 0) {
      alert('No items in shopping list. Add some ingredients first!');
      return;
    }
    navigate('/shopping-list', { state: { shoppingList, userId } });
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content consult-inventory-modal" onClick={e => e.stopPropagation()} data-lenis-prevent>
          <div className="loading">Checking inventory...</div>
        </div>
      </div>
    );
  }

  const checkedCount = shoppingList.filter(item => {
    const ingredientIdx = ingredients.findIndex(ing => ing === item.name);
    return ingredientStatus[ingredientIdx]?.checked;
  }).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content consult-inventory-modal" onClick={e => e.stopPropagation()} data-lenis-prevent>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="consult-inventory-header">
          <h2>Consult Inventory</h2>
          <p className="modal-subtitle">Check what you have and build your shopping list</p>
        </div>

        <div className="progress-section">
          <div className="progress-info">
            <span className="checked-count">{checkedCount} item{checkedCount !== 1 ? 's' : ''} ready to add</span>
          </div>
          <button
            className="btn btn-success"
            onClick={handleAddCheckedItemsToInventory}
            disabled={checkedCount === 0 || addingToInventory}
          >
            Add to Inventory
          </button>
        </div>

        <div className="consult-inventory-content">
          {/* Ingredients List */}
          <div className="ingredients-section">
            <h3>Recipe Ingredients</h3>
            <div className="ingredients-list">
              {ingredients.map((ingredient, idx) => {
                const status = ingredientStatus[idx] || {};
                const isInShoppingList = status.inShoppingList;

                return (
                  <div key={idx} className="ingredient-item">
                    <div className="ingredient-info">
                      <label className="ingredient-checkbox">
                        <input
                          type="checkbox"
                          checked={status.checked || false}
                          onChange={(e) => {
                            setIngredientStatus(prev => ({
                              ...prev,
                              [idx]: { ...prev[idx], checked: e.target.checked }
                            }));
                          }}
                          disabled={isInShoppingList}
                        />
                        <span className={status.aiMatched ? 'ai-matched' : ''}>
                          {ingredient}
                          {status.aiMatched && (
                            <span className="ai-matched-tag">
                              <Check size={13} strokeWidth={2.5} /> found in inventory
                            </span>
                          )}
                        </span>
                      </label>
                    </div>

                    {!isInShoppingList && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleAddToShoppingList(idx)}
                      >
                        Add to List
                      </button>
                    )}
                    {isInShoppingList && (
                      <span className="badge-in-list">In List</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shopping List */}
          <div className="shopping-list-section">
            <h3>Shopping List ({shoppingList.length})</h3>
            {shoppingList.length === 0 ? (
              <p className="empty-shopping-list">Add ingredients from the list above</p>
            ) : (
              <div className="shopping-items">
                {shoppingList.map(item => {
                  const ingredientIdx = ingredients.findIndex(ing => ing === item.name);
                  const isChecked = ingredientStatus[ingredientIdx]?.checked || false;

                  return (
                    <div key={item.id} className={`shopping-item ${isChecked ? 'checked' : ''}`}>
                      <span className="shopping-item-name">{item.name}</span>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveFromShoppingList(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSaveAndGoToShoppingList}
            disabled={shoppingList.length === 0}
          >
            Save & Go to Shopping List
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultInventoryModal;
