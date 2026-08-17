import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Check, Undo2, Trash2, ShoppingCart, ChevronDown, Edit2 } from 'lucide-react';
import SplashTransition from '../SplashTransition';
import TopNav from '../nav/TopNav';
import { useAuthModal } from '../auth/authModalContext';
import { usePageMeta } from '../../lib/usePageMeta';
import { addInventoryItem } from '../../lib/inventoryDb';
import { createShoppingList, updateShoppingList, getShoppingList } from '../../lib/shoppingListApi';
import { deduplicateShoppingList } from '../../lib/shoppingListUtils';
import { searchRecipes } from '../../lib/recipeSearch';
import { useRecipes } from '../../lib/useRecipes';
import '../explore/Explore.css'; // .gate
import './ShoppingList.css';

const SHOPPING_LIST_ID_KEY = 'culinary_craft_current_shopping_list_id';

const ShoppingListItemDetail = ({ item, isExpanded, onToggleExpand, onCheckItem, onEdit, onDelete, onAddToInventory, isChecked, addedToInventory, isLoading }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(item.name);

  const handleSaveEdit = () => {
    onEdit(item.id, editedName);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedName(item.name);
    setIsEditing(false);
  };

  return (
    <>
      <div className="shopping-item-main">
        <div className="item-left">
          <label className="item-checkbox">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => onCheckItem(item.id)}
              disabled={addedToInventory}
            />
            <span className="checkmark" />
          </label>
          <div className="item-display">
            <span className="item-name">{item.name}</span>
            {item.isLinked && (item.recipeName || item.linkedRecipes?.length > 0) ? (
              <span className="item-linked-badge">
                from {item.linkedRecipes && item.linkedRecipes.length > 1
                  ? `${item.linkedRecipes.length} recipes`
                  : item.linkedRecipes?.[0]?.name || item.recipeName}
              </span>
            ) : (
              <span className="item-linked-badge other">other</span>
            )}
          </div>
        </div>

        <div className="item-actions">
          {isChecked && !addedToInventory && (
            <button
              className="btn btn-sm btn-success"
              onClick={() => onAddToInventory(item.id)}
              disabled={isLoading}
            >
              <Check size={14} strokeWidth={2.5} /> Add to Inventory
            </button>
          )}
          {addedToInventory && (
            <span className="badge-success">
              <Check size={13} strokeWidth={2.5} /> Added to Inventory
            </span>
          )}
          {!isChecked && (
            <button
              className="btn btn-sm btn-icon"
              onClick={() => onToggleExpand(item.id)}
              title={isExpanded ? 'Hide details' : 'Show details'}
            >
              <ChevronDown size={16} className={isExpanded ? 'rotated' : ''} />
            </button>
          )}
        </div>
      </div>

      {isExpanded && !addedToInventory && (
        <div className="shopping-item-details">
          {item.quantity || item.unit ? (
            <div className="detail-row">
              <span className="detail-label">Quantity:</span>
              <span className="detail-value">{`${item.quantity || ''} ${item.unit || ''}`.trim()}</span>
            </div>
          ) : null}

          {(item.isLinked || item.recipeName || item.linkedRecipes?.length > 0) && (
            <div className="detail-row">
              <span className="detail-label">From:</span>
              <div className="linked-recipes">
                {item.linkedRecipes && item.linkedRecipes.length > 0 ? (
                  item.linkedRecipes.map((recipe, idx) => (
                    <span key={idx} className="recipe-badge">{recipe.name}</span>
                  ))
                ) : item.recipeName ? (
                  <span className="recipe-badge">{item.recipeName}</span>
                ) : (
                  <span className="recipe-badge other">other</span>
                )}
              </div>
            </div>
          )}

          <div className="detail-actions">
            <button
              className="btn btn-xs btn-secondary"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 size={12} /> Edit Item Name
            </button>
            {item.isLinked && (
              <button
                className="btn btn-xs btn-danger"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>

          {isEditing && (
            <div className="edit-mode">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder="Item name"
                autoFocus
              />
              <div className="edit-actions">
                <button className="btn btn-xs btn-secondary" onClick={handleCancelEdit}>
                  Cancel
                </button>
                <button className="btn btn-xs btn-primary" onClick={handleSaveEdit}>
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

const ShoppingList = () => {
  usePageMeta({
    title: 'Shopping List',
    description: 'Turn any recipe into an ingredient shopping list you can check off as you go.',
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { authStatus, user } = useAuthenticator((ctx) => [ctx.authStatus, ctx.user]);
  const { requireLogin } = useAuthModal();
  const { recipes } = useRecipes();

  const [shoppingList, setShoppingList] = useState([]);
  const [shoppingListId, setShoppingListId] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [expandedItems, setExpandedItems] = useState({});
  const [undoStack, setUndoStack] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({ name: '', quantity: '', unit: '', linkedRecipe: null });
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeSearchResults, setRecipeSearchResults] = useState([]);
  const [showRecipeDropdown, setShowRecipeDropdown] = useState(false);

  useEffect(() => {
    const initializeShoppingList = async () => {
      setLoading(true);
      try {
        const incomingList = location.state?.shoppingList;
        const storedId = localStorage.getItem(SHOPPING_LIST_ID_KEY);

        if (incomingList && incomingList.length > 0 && user?.userId) {
          // New items coming from ConsultInventoryModal or other source
          if (storedId) {
            // Merge with existing list
            try {
              const existingList = await getShoppingList(storedId);
              if (existingList && existingList.items) {
                // Combine incoming and existing items, then deduplicate
                const mergedList = deduplicateShoppingList([...existingList.items, ...incomingList]);
                setShoppingListId(storedId);
                setShoppingList(mergedList);

                const checked = {};
                mergedList.forEach((item, idx) => {
                  checked[item.id || idx] = item.checked || false;
                });
                setCheckedItems(checked);

                // Save merged list to backend
                await updateShoppingList(storedId, { items: mergedList });
              }
            } catch (err) {
              console.error('Error merging with existing list, creating new:', err);
              // Fallback: create new list
              const deduplicatedList = deduplicateShoppingList(incomingList);
              const savedList = await createShoppingList(deduplicatedList);
              setShoppingListId(savedList.shoppingListId);
              localStorage.setItem(SHOPPING_LIST_ID_KEY, savedList.shoppingListId);
              setShoppingList(deduplicatedList);

              const checked = {};
              deduplicatedList.forEach(item => {
                checked[item.id] = false;
              });
              setCheckedItems(checked);
            }
          } else {
            // No existing list, create new one
            const deduplicatedList = deduplicateShoppingList(incomingList);
            const savedList = await createShoppingList(deduplicatedList);
            setShoppingListId(savedList.shoppingListId);
            localStorage.setItem(SHOPPING_LIST_ID_KEY, savedList.shoppingListId);
            setShoppingList(deduplicatedList);

            const checked = {};
            deduplicatedList.forEach(item => {
              checked[item.id] = false;
            });
            setCheckedItems(checked);
          }
        } else {
          // No incoming list, load existing if available
          if (storedId && user?.userId) {
            try {
              const loadedList = await getShoppingList(storedId);
              if (loadedList && loadedList.items) {
                setShoppingListId(storedId);
                setShoppingList(loadedList.items);

                const checked = {};
                loadedList.items.forEach((item, idx) => {
                  checked[item.id || idx] = item.checked || false;
                });
                setCheckedItems(checked);
              }
            } catch (err) {
              console.error('Error loading shopping list:', err);
              localStorage.removeItem(SHOPPING_LIST_ID_KEY);
              setShoppingList([]);
            }
          } else {
            setShoppingList([]);
          }
        }
      } catch (err) {
        console.error('Error initializing shopping list:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeShoppingList();
  }, [location.state, user?.userId]);

  // Auto-save shopping list when items or checked state changes
  useEffect(() => {
    if (shoppingListId && user?.userId && shoppingList.length > 0) {
      // Debounce saves to avoid too many requests
      const saveTimeout = setTimeout(() => {
        saveShoppingListToBackend();
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [shoppingList, checkedItems, shoppingListId, user?.userId]);

  const handleCheckItem = (itemId) => {
    const newChecked = { ...checkedItems, [itemId]: !checkedItems[itemId] };
    setCheckedItems(newChecked);
    setUndoStack(prev => [...prev, { itemId, action: 'toggle', wasChecked: checkedItems[itemId] }]);

    if (shoppingListId && user?.userId) {
      saveShoppingListToBackend(shoppingList, newChecked);
    }
  };

  const handleToggleExpand = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleEditItemName = (itemId, newName) => {
    const updatedList = shoppingList.map(item =>
      item.id === itemId ? { ...item, name: newName } : item
    );
    setShoppingList(updatedList);
    setUndoStack(prev => [...prev, { itemId, action: 'edit', oldName: shoppingList.find(i => i.id === itemId).name }]);

    if (shoppingListId && user?.userId) {
      saveShoppingListToBackend(updatedList, checkedItems);
    }
  };

  const handleRemoveItem = (itemId) => {
    const removedItem = shoppingList.find(i => i.id === itemId);
    const newList = shoppingList.filter(item => item.id !== itemId);
    const newChecked = { ...checkedItems };
    delete newChecked[itemId];

    setShoppingList(newList);
    setCheckedItems(newChecked);
    setUndoStack(prev => [...prev, { itemId, action: 'remove', item: removedItem }]);

    if (shoppingListId && user?.userId) {
      saveShoppingListToBackend(newList, newChecked);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];
    const newStack = undoStack.slice(0, -1);
    setUndoStack(newStack);

    // Perform the undo action and save to backend
    if (lastAction.action === 'toggle') {
      const newChecked = {
        ...checkedItems,
        [lastAction.itemId]: lastAction.wasChecked
      };
      setCheckedItems(newChecked);
      if (shoppingListId && user?.userId) {
        saveShoppingListToBackend(shoppingList, newChecked);
      }
    } else if (lastAction.action === 'edit') {
      const undoList = shoppingList.map(item =>
        item.id === lastAction.itemId ? { ...item, name: lastAction.oldName } : item
      );
      setShoppingList(undoList);
      if (shoppingListId && user?.userId) {
        saveShoppingListToBackend(undoList, checkedItems);
      }
    } else if (lastAction.action === 'remove' && lastAction.item) {
      const undoList = [...shoppingList, lastAction.item];
      setShoppingList(undoList);
      const newChecked = {
        ...checkedItems,
        [lastAction.itemId]: false
      };
      setCheckedItems(newChecked);
      if (shoppingListId && user?.userId) {
        saveShoppingListToBackend(undoList, newChecked);
      }
    }
  };

  const saveShoppingListToBackend = async (list = shoppingList, checked = checkedItems) => {
    if (!shoppingListId) {
      console.warn('No shopping list ID to save');
      return;
    }

    if (!user?.userId) {
      console.warn('No user ID to save');
      return;
    }

    try {
      const updatedItems = list.map(item => ({
        ...item,
        checked: checked[item.id] || false
      }));

      console.log(`Saving ${updatedItems.length} items to shopping list ${shoppingListId}`);
      await updateShoppingList(shoppingListId, { items: updatedItems });
      console.log('Shopping list saved successfully');
    } catch (err) {
      console.error('Error saving shopping list:', err);
      // Don't alert user on every save error, just log it
    }
  };

  const handleAddToInventory = async (itemId) => {
    const item = shoppingList.find(i => i.id === itemId);
    if (!item) return;

    if (!user?.userId) {
      alert('Please log in to add items to inventory');
      return;
    }

    setLoading(true);
    try {
      await addInventoryItem(user.userId, {
        name: item.name,
        category: 'pantry',
        quantity: item.quantity || '',
        unit: item.unit || '',
        notes: 'Added from shopping list'
      });

      setShoppingList(prev =>
        prev.map(i =>
          i.id === itemId ? { ...i, addedToInventory: true } : i
        )
      );
    } catch (err) {
      console.error('Error adding to inventory:', err);
      alert('Failed to add to inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleRecipeSearch = (query) => {
    setRecipeSearch(query);
    if (query.trim().length > 0) {
      const results = searchRecipes(recipes, query);
      setRecipeSearchResults(results);
      setShowRecipeDropdown(true);
    } else {
      setRecipeSearchResults([]);
      setShowRecipeDropdown(false);
    }
  };

  const handleSelectRecipe = (recipe) => {
    setAddFormData(prev => ({
      ...prev,
      linkedRecipe: { id: recipe.recipeId, name: recipe.title }
    }));
    setRecipeSearch('');
    setRecipeSearchResults([]);
    setShowRecipeDropdown(false);
  };

  const handleClearRecipe = () => {
    setAddFormData(prev => ({
      ...prev,
      linkedRecipe: null
    }));
  };

  const handleAddItem = () => {
    if (!addFormData.name.trim()) {
      alert('Please enter an item name');
      return;
    }

    const newItem = {
      id: `manual-${Date.now()}`,
      name: addFormData.name.trim(),
      quantity: addFormData.quantity.trim(),
      unit: addFormData.unit.trim(),
      recipeId: addFormData.linkedRecipe?.id,
      recipeName: addFormData.linkedRecipe?.name,
      isLinked: !!addFormData.linkedRecipe,
      checked: false,
      addedToInventory: false
    };

    // Deduplicate after adding
    const updatedList = deduplicateShoppingList([...shoppingList, newItem]);
    setShoppingList(updatedList);

    // Update checked items for any new items
    const newCheckedItems = { ...checkedItems };
    updatedList.forEach(item => {
      if (!(item.id in newCheckedItems)) {
        newCheckedItems[item.id] = false;
      }
    });
    setCheckedItems(newCheckedItems);

    setUndoStack(prev => [...prev, { itemId: newItem.id, action: 'add', item: newItem }]);
    setAddFormData({ name: '', quantity: '', unit: '', linkedRecipe: null });
    setRecipeSearch('');
    setAddFormOpen(false);

    if (shoppingListId && user?.userId) {
      saveShoppingListToBackend(updatedList, newCheckedItems);
    }
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = shoppingList.length;

  if (authStatus !== 'authenticated') {
    return (
      <SplashTransition>
        <div className="page shopping-page">
          <TopNav />
          <div className="gate">
            <div className="gate-icon">
              <ShoppingCart size={36} strokeWidth={1.6} />
            </div>
            <h2>Your shopping list</h2>
            <p>
              Log in to build a shopping list from any recipe and check items
              off as you shop.
            </p>
            <button className="btn btn-primary" onClick={requireLogin}>
              Log in
            </button>
          </div>
        </div>
      </SplashTransition>
    );
  }

  return (
    <SplashTransition>
      <div className="page shopping-page">
        <TopNav />

        <div className="shopping-list-container">
          <div className="shopping-list-header">
            <div className="header-top">
              <h1>Shopping List</h1>
              {undoStack.length > 0 && (
                <button className="btn-undo" onClick={handleUndo} title="Undo last action">
                  <Undo2 size={14} strokeWidth={2.2} /> Undo
                </button>
              )}
            </div>
            <p className="progress-text">
              {checkedCount} of {totalCount} items purchased
            </p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          {shoppingList.length === 0 ? (
            <div className="empty-shopping-list">
              <p>Your shopping list is empty</p>
              <button className="btn btn-primary" onClick={() => navigate('/explore')}>
                Browse Recipes
              </button>
            </div>
          ) : (
            <div className="shopping-list-content">
              {/* Add Item Form */}
              <div className="add-item-section">
                {!addFormOpen ? (
                  <button className="btn btn-secondary btn-sm" onClick={() => setAddFormOpen(true)}>
                    + Add Item
                  </button>
                ) : (
                  <div className="add-item-form">
                    <div className="form-row">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={addFormData.name}
                        onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                        autoFocus
                      />
                    </div>
                    <div className="form-row">
                      <input
                        type="text"
                        placeholder="Quantity (optional)"
                        value={addFormData.quantity}
                        onChange={(e) => setAddFormData({ ...addFormData, quantity: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Unit (optional)"
                        value={addFormData.unit}
                        onChange={(e) => setAddFormData({ ...addFormData, unit: e.target.value })}
                      />
                    </div>

                    {/* Recipe Search */}
                    <div className="form-recipe-search">
                      <label className="search-label">Link to recipe (optional)</label>
                      {addFormData.linkedRecipe ? (
                        <div className="selected-recipe">
                          <span className="recipe-name">{addFormData.linkedRecipe.name}</span>
                          <button
                            className="btn btn-xs btn-secondary"
                            onClick={handleClearRecipe}
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="recipe-search-container">
                          <input
                            type="text"
                            placeholder="Search recipes..."
                            value={recipeSearch}
                            onChange={(e) => handleRecipeSearch(e.target.value)}
                            onFocus={() => recipeSearch && setShowRecipeDropdown(true)}
                          />
                          {showRecipeDropdown && recipeSearchResults.length > 0 && (
                            <div className="recipe-dropdown">
                              {recipeSearchResults.slice(0, 5).map(recipe => (
                                <button
                                  key={recipe.recipeId}
                                  className="recipe-option"
                                  onClick={() => handleSelectRecipe(recipe)}
                                >
                                  {recipe.title}
                                </button>
                              ))}
                            </div>
                          )}
                          {recipeSearch && recipeSearchResults.length === 0 && (
                            <div className="recipe-dropdown">
                              <div className="recipe-no-results">No recipes found</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="form-actions">
                      <button className="btn btn-xs btn-secondary" onClick={() => {
                        setAddFormOpen(false);
                        setRecipeSearch('');
                        setRecipeSearchResults([]);
                      }}>
                        Cancel
                      </button>
                      <button className="btn btn-xs btn-primary" onClick={handleAddItem}>
                        Add to List
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="shopping-items">
                {shoppingList.map(item => {
                  const isChecked = checkedItems[item.id] || false;
                  const addedToInventory = item.addedToInventory || false;
                  const isExpanded = expandedItems[item.id] || false;

                  return (
                    <div
                      key={item.id}
                      className={`shopping-item ${isChecked ? 'checked' : ''} ${
                        addedToInventory ? 'added' : ''
                      } ${isExpanded ? 'expanded' : ''}`}
                    >
                      <ShoppingListItemDetail
                        item={item}
                        isExpanded={isExpanded}
                        isChecked={isChecked}
                        addedToInventory={addedToInventory}
                        isLoading={loading}
                        onToggleExpand={handleToggleExpand}
                        onCheckItem={handleCheckItem}
                        onEdit={handleEditItemName}
                        onDelete={handleRemoveItem}
                        onAddToInventory={handleAddToInventory}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="shopping-list-footer">
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/explore')}
            >
              Back to Recipes
            </button>
            {shoppingList.length > 0 && (
              <div className="footer-stats">
                <p>{checkedCount} items ready to add to inventory</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SplashTransition>
  );
};

export default ShoppingList;
