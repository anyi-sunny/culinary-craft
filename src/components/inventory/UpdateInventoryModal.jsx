import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2, Plus, Minus, ChevronDown } from 'lucide-react';
import { updateInventoryItem } from '../../lib/inventoryApiClient';
import './UpdateInventoryModal.css';

export default function UpdateInventoryModal({ recipe, inventoryItems, onClose, onSave }) {
  const [items, setItems] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const addedTimeoutRef = useRef(null);
  const itemsContainerRef = useRef(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflowY;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflowY = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflowY = prevHtml;
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearTimeout(addedTimeoutRef.current);
  }, []);

  // Extract recipe ingredients and find matching inventory items
  useEffect(() => {
    if (!recipe?.ingredients && !recipe?.components) {
      setItems([]);
      return;
    }

    const recipeIngredients = extractRecipeIngredients();
    const matched = [];
    const matchedItemIds = new Set();

    // For each recipe ingredient, find matching inventory items
    for (const recipeIng of recipeIngredients) {
      for (const invItem of inventoryItems) {
        if (matchedItemIds.has(invItem.itemId)) continue;
        if (matchIngredient(recipeIng, invItem.name)) {
          matched.push({
            id: matched.length,
            itemId: invItem.itemId,
            name: invItem.name,
            quantity: invItem.quantity || '',
            unit: invItem.unit || '',
            originalQuantity: invItem.quantity || '',
            originalUnit: invItem.unit || '',
          });
          matchedItemIds.add(invItem.itemId);
          break;
        }
      }
    }

    setItems(matched);
  }, [recipe, inventoryItems]);

  function extractRecipeIngredients() {
    const ingredients = [];

    if (recipe.components && Array.isArray(recipe.components)) {
      for (const component of recipe.components) {
        if (Array.isArray(component.ingredients)) {
          ingredients.push(...component.ingredients.filter(i => i.trim()));
        }
      }
    } else if (recipe.ingredients) {
      const lines = String(recipe.ingredients)
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.match(/^for the\s+.+:$/i));

      for (const line of lines) {
        const cleaned = line
          .replace(/^[-*•]\s+/, '')
          .replace(/^\d+[.)]\s+/, '')
          .trim();
        if (cleaned) ingredients.push(cleaned);
      }
    }

    return ingredients;
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function matchIngredient(ingredientLine, inventoryName) {
    const ing = ingredientLine.toLowerCase();
    const inv = inventoryName.toLowerCase();
    return ing.includes(inv) || inv.includes(ing) ||
           ing.split(/[\s\-,()]+/).some(w => w.length >= 3 && inv.includes(w));
  }

  function updateQuantity(id, quantity) {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  }

  function updateUnit(id, unit) {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, unit } : item
    ));
  }

  function deleteItem(id) {
    setItems(prev => prev.filter(item => item.id !== id));
  }

  function addQuantity(id, amount) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const current = parseFloat(item.quantity) || 0;
      const newQty = Math.max(0, current + amount);
      return { ...item, quantity: newQty > 0 ? newQty.toString() : '' };
    }));
  }

  function getFilteredItems() {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    const alreadyAdded = new Set(items.map(i => i.itemId));
    return inventoryItems.filter(item =>
      !alreadyAdded.has(item.itemId) &&
      item.name.toLowerCase().includes(term)
    );
  }

  function addItemFromDropdown(inventoryItem) {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 0;
    setItems(prev => [...prev, {
      id: newId,
      itemId: inventoryItem.itemId,
      name: inventoryItem.name,
      quantity: inventoryItem.quantity || '',
      unit: inventoryItem.unit || '',
      originalQuantity: inventoryItem.quantity || '',
      originalUnit: inventoryItem.unit || '',
    }]);
    setSearchTerm('');
    setSearchOpen(false);

    // Show "item added" feedback
    setJustAdded(newId);
    clearTimeout(addedTimeoutRef.current);
    addedTimeoutRef.current = setTimeout(() => setJustAdded(null), 2000);

    // Auto-scroll to bottom to show the newly added item
    setTimeout(() => {
      if (itemsContainerRef.current) {
        itemsContainerRef.current.scrollTop = itemsContainerRef.current.scrollHeight;
      }
    }, 0);
  }

  async function handleSave() {
    setIsSaving(true);
    setError('');

    try {
      // Update items that have changed
      for (const item of items) {
        const quantityChanged = item.quantity !== item.originalQuantity;
        const unitChanged = item.unit !== item.originalUnit;

        if (quantityChanged || unitChanged) {
          await updateInventoryItem(item.itemId, item.quantity || null);
        }
      }

      if (onSave) {
        onSave();
      }
      onClose();
    } catch (err) {
      console.error('Error saving inventory:', err);
      setError(err.message || 'Failed to update inventory');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="update-inventory-overlay" onClick={onClose} data-lenis-prevent>
      <div className="update-inventory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="update-inventory-header">
          <h2>Update Your Inventory</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>

        <div className="update-inventory-body">
          <p className="update-inventory-intro">
            Your inventory items that match this recipe's ingredients. Adjust quantities or add more items.
          </p>

          {error && <div className="update-inventory-error">{error}</div>}

          <div className="update-inventory-items" ref={itemsContainerRef}>
            {items.length === 0 ? (
              <p className="update-inventory-empty">No ingredients to update</p>
            ) : (
              items.map(item => (
                <div key={item.id} className="update-inventory-item">
                  <div className="update-inventory-item-name">{item.name}</div>

                  <div className="update-inventory-item-controls">
                    <button
                      className="qty-btn qty-btn-minus"
                      onClick={() => addQuantity(item.id, -1)}
                      disabled={!item.quantity || parseFloat(item.quantity) === 0}
                      aria-label={`Decrease quantity for ${item.name}`}
                    >
                      <Minus size={14} strokeWidth={2.2} />
                    </button>

                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, e.target.value)}
                      placeholder="Qty"
                      className="qty-input"
                      inputMode="decimal"
                    />

                    <button
                      className="qty-btn qty-btn-plus"
                      onClick={() => addQuantity(item.id, 1)}
                      aria-label={`Increase quantity for ${item.name}`}
                    >
                      <Plus size={14} strokeWidth={2.2} />
                    </button>

                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => updateUnit(item.id, e.target.value)}
                      placeholder="Unit"
                      className="unit-input"
                    />

                    <button
                      className="delete-btn"
                      onClick={() => deleteItem(item.id)}
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="update-inventory-search-container" ref={dropdownRef}>
            <label className="update-inventory-search-label">Add from inventory</label>
            <div className="update-inventory-search-wrapper">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search your inventory..."
                className="update-inventory-search-input"
              />
              <ChevronDown size={16} className="search-chevron" />

              {searchOpen && (
                <div className="update-inventory-dropdown">
                  {getFilteredItems().length === 0 ? (
                    <div className="dropdown-empty">
                      {searchTerm.trim() ? 'No items found' : 'Type to search'}
                    </div>
                  ) : (
                    <ul>
                      {getFilteredItems().slice(0, 8).map(item => (
                        <li key={item.itemId}>
                          <button
                            className="dropdown-item"
                            onClick={() => addItemFromDropdown(item)}
                          >
                            <span className="dropdown-item-name">{item.name}</span>
                            {item.quantity && (
                              <span className="dropdown-item-qty">
                                {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {justAdded !== null && (
            <div className="update-inventory-feedback">
              {items.find(i => i.id === justAdded)?.name} added
            </div>
          )}
        </div>

        <div className="update-inventory-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
