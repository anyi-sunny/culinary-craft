import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Check, Undo2, Trash2, ChevronDown, Edit2, AlertCircle } from 'lucide-react';
import SplashTransition from '../SplashTransition';
import TopNav from '../nav/TopNav';
import PreviewBanner from '../previews/PreviewBanner';
import { useAuthModal } from '../auth/authModalContext';
import { usePageMeta } from '../../lib/usePageMeta';
import { DEMO_SHOPPING_LIST } from '../../lib/demoData';
import { addInventoryItem, deleteInventoryItem } from '../../lib/inventoryDb';
import { createShoppingList, updateShoppingList, getShoppingList, SHOPPING_LIST_ID_KEY } from '../../lib/shoppingListApi';
import { deduplicateShoppingList } from '../../lib/shoppingListUtils';
import { searchRecipes } from '../../lib/recipeSearch';
import { useRecipes } from '../../lib/useRecipes';
import './ShoppingList.css';

// readOnly (guest preview): the edit button defers to onEdit directly (the
// login prompt) instead of opening the inline editor.
const ShoppingListItemDetail = ({ item, isExpanded, onToggleExpand, onCheckItem, onEdit, onDelete, onAddToInventory, isChecked, addedToInventory, isLoading, readOnly = false }) => {
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
              onClick={() => (readOnly ? onEdit() : setIsEditing(true))}
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
  const [bulkAddInProgress, setBulkAddInProgress] = useState(false);
  const [bulkAddResult, setBulkAddResult] = useState(null);

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

    // Add to undo stack
    setUndoStack(prev => [...prev, {
      action: 'delete',
      item: removedItem
    }]);

    if (shoppingListId && user?.userId) {
      saveShoppingListToBackend(newList, newChecked);
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];
    const newStack = undoStack.slice(0, -1);

    setLoading(true);
    try {
      if (lastAction.action === 'add') {
        // Undo adding items - remove them from shopping list
        const itemIdsToRemove = new Set(lastAction.items.map(item => item.id));
        const updatedList = shoppingList.filter(item => !itemIdsToRemove.has(item.id));
        setShoppingList(updatedList);

        const newChecked = { ...checkedItems };
        lastAction.items.forEach(item => {
          delete newChecked[item.id];
        });
        setCheckedItems(newChecked);

        if (shoppingListId && user?.userId) {
          saveShoppingListToBackend(updatedList, newChecked);
        }
      } else if (lastAction.action === 'delete') {
        // Undo deleting items - restore them to shopping list
        const restoredItem = lastAction.item;
        const updatedList = [...shoppingList, restoredItem];
        setShoppingList(updatedList);

        const newChecked = { ...checkedItems, [restoredItem.id]: false };
        setCheckedItems(newChecked);

        if (shoppingListId && user?.userId) {
          saveShoppingListToBackend(updatedList, newChecked);
        }
      } else if (lastAction.action === 'addToInventory') {
        // Undo adding to inventory - delete from inventory and restore to shopping list
        await Promise.all(
          lastAction.inventoryItems.map(invItem =>
            deleteInventoryItem(user.userId, invItem.itemId)
          )
        );

        const restoredItems = lastAction.shoppingItems;
        const updatedList = [...shoppingList, ...restoredItems];
        setShoppingList(updatedList);

        const newChecked = { ...checkedItems };
        restoredItems.forEach(item => {
          newChecked[item.id] = false;
        });
        setCheckedItems(newChecked);

        if (shoppingListId && user?.userId) {
          saveShoppingListToBackend(updatedList, newChecked);
        }
      }

      setUndoStack(newStack);
    } catch (err) {
      console.error('Error undoing action:', err);
      alert('Failed to undo action');
    } finally {
      setLoading(false);
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
      const inventoryItem = await addInventoryItem(user.userId, {
        name: item.name,
        category: 'pantry',
        quantity: item.quantity || '',
        unit: item.unit || '',
        notes: 'Added from shopping list'
      });

      // Remove from shopping list visually
      const newList = shoppingList.filter(i => i.id !== itemId);
      setShoppingList(newList);

      const newChecked = { ...checkedItems };
      delete newChecked[itemId];
      setCheckedItems(newChecked);

      // Add to undo stack
      setUndoStack(prev => [...prev, {
        action: 'addToInventory',
        inventoryItems: [{ itemId: inventoryItem.itemId || inventoryItem.id }],
        shoppingItems: [item]
      }]);

      // Save updated shopping list
      if (shoppingListId && user?.userId) {
        saveShoppingListToBackend(newList, newChecked);
      }
    } catch (err) {
      console.error('Error adding to inventory:', err);
      alert('Failed to add to inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllToInventory = async () => {
    const checkedItemIds = Object.keys(checkedItems).filter(id => checkedItems[id]);
    if (checkedItemIds.length === 0) {
      alert('Please check items to add to inventory');
      return;
    }

    if (!user?.userId) {
      alert('Please log in to add items to inventory');
      return;
    }

    setBulkAddInProgress(true);
    setBulkAddResult(null);

    try {
      // Get all checked items
      const itemsToAdd = checkedItemIds
        .map(id => shoppingList.find(i => i.id === id))
        .filter(Boolean);

      // Add all items concurrently using Promise.all
      const addPromises = itemsToAdd.map(item =>
        addInventoryItem(user.userId, {
          name: item.name,
          category: 'pantry',
          quantity: item.quantity || '',
          unit: item.unit || '',
          notes: 'Added from shopping list'
        }).catch(err => ({ error: err, itemName: item.name }))
      );

      const results = await Promise.all(addPromises);

      // Count successes and failures
      const failures = results.filter(r => r.error);
      const successCount = itemsToAdd.length - failures.length;
      const successfulItems = itemsToAdd.filter((item, idx) => !results[idx].error);
      const successfulInvItems = results
        .map((result) => !result.error ? { itemId: result.itemId || result.id } : null)
        .filter(Boolean);

      // Remove successfully added items from shopping list
      const newList = shoppingList.filter(
        item => !checkedItemIds.includes(item.id) || failures.some(f => f.itemName === item.name)
      );
      setShoppingList(newList);

      const newChecked = { ...checkedItems };
      successfulItems.forEach(item => {
        delete newChecked[item.id];
      });
      setCheckedItems(newChecked);

      // Add to undo stack
      if (successfulItems.length > 0) {
        setUndoStack(prev => [...prev, {
          action: 'addToInventory',
          inventoryItems: successfulInvItems,
          shoppingItems: successfulItems
        }]);
      }

      // Save updated shopping list
      if (shoppingListId && user?.userId) {
        saveShoppingListToBackend(newList, newChecked);
      }

      // Show result summary
      setBulkAddResult({
        successCount,
        totalCount: itemsToAdd.length,
        failures: failures.map(f => f.itemName)
      });
    } catch (err) {
      console.error('Error adding items to inventory:', err);
      setBulkAddResult({
        successCount: 0,
        totalCount: 0,
        error: 'Failed to add items to inventory'
      });
    } finally {
      setBulkAddInProgress(false);
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

    // Add to undo stack (track the added item for potential undo)
    setUndoStack(prev => [...prev, {
      action: 'add',
      items: [newItem] // Single item added
    }]);

    setAddFormData({ name: '', quantity: '', unit: '', linkedRecipe: null });
    setRecipeSearch('');
    setRecipeSearchResults([]);
    setAddFormOpen(false);

    if (shoppingListId && user?.userId) {
      saveShoppingListToBackend(updatedList, newCheckedItems);
    }
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = shoppingList.length;

  // Guest preview: example items showing the recipe linkage — expandable
  // details work, everything that would write routes to the login modal.
  if (authStatus !== 'authenticated') {
    const demoTotal = DEMO_SHOPPING_LIST.length;
    const demoChecked = DEMO_SHOPPING_LIST.filter((item) => item.checked).length;

    return (
      <SplashTransition>
        <div className="page shopping-page">
          <TopNav />
          {authStatus === 'unauthenticated' && (
            <div className="shopping-list-container">
              <PreviewBanner message="This is an example list. Log in to build a shopping list from any recipe and check items off as you shop." />

              <div className="shopping-list-header">
                <h1>Shopping List</h1>
                <p className="progress-text">
                  {demoChecked} of {demoTotal} items purchased
                </p>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(demoChecked / demoTotal) * 100}%` }}
                  />
                </div>
              </div>

              <div className="shopping-list-content">
                <div className="add-item-section">
                  <div className="add-item-header">
                    <button className="btn btn-secondary btn-sm" onClick={requireLogin}>
                      + Add Item
                    </button>
                  </div>
                </div>

                <div className="shopping-items fade-in-stagger">
                  {DEMO_SHOPPING_LIST.map((item) => (
                    <div
                      key={item.id}
                      className={`shopping-item ${item.checked ? 'checked' : ''} ${
                        expandedItems[item.id] ? 'expanded' : ''
                      }`}
                    >
                      <ShoppingListItemDetail
                        item={item}
                        isExpanded={expandedItems[item.id] || false}
                        isChecked={item.checked}
                        addedToInventory={false}
                        isLoading={false}
                        readOnly
                        onToggleExpand={handleToggleExpand}
                        onCheckItem={requireLogin}
                        onEdit={requireLogin}
                        onDelete={requireLogin}
                        onAddToInventory={requireLogin}
                      />
                    </div>
                  ))}
                </div>

                <div className="shopping-list-footer">
                  <button className="btn btn-secondary" onClick={() => navigate('/explore')}>
                    Back to Recipes
                  </button>
                </div>
              </div>
            </div>
          )}
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
            <h1>Shopping List</h1>
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
            <div className="shopping-list-content">
              {/* Add Item Form */}
              <div className="add-item-section">
                <div className="add-item-header">
                  {!addFormOpen ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => setAddFormOpen(true)}>
                      + Add Item
                    </button>
                  ) : null}
                </div>
                {addFormOpen && (
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
                        Done
                      </button>
                      <button className="btn btn-xs btn-primary" onClick={handleAddItem}>
                        Add Item
                      </button>
                    </div>
                  </div>
                )}
                {/* Action Buttons */}
                {(undoStack.length > 0 || checkedCount > 0) && (
                  <div className="add-item-actions">
                    {undoStack.length > 0 && (
                      <button className="btn btn-secondary btn-sm" onClick={handleUndo} title="Undo last inventory addition">
                        <Undo2 size={14} strokeWidth={2.2} /> Undo
                      </button>
                    )}
                    {checkedCount > 0 && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={handleAddAllToInventory}
                        disabled={bulkAddInProgress}
                        title={`Add ${checkedCount} checked items to inventory`}
                      >
                        <Check size={14} strokeWidth={2.5} /> Add All to Inventory
                      </button>
                    )}
                  </div>
                )}
              </div>

          {shoppingList.length === 0 ? (
            <div className="empty-shopping-list fade-in">
              <p>Your shopping list is empty</p>
              <button className="btn btn-primary" onClick={() => navigate('/explore')}>
                Browse Recipes
              </button>
            </div>
          ) : (
              <div className="shopping-items fade-in-stagger">
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
            )}
          {/* Footer Actions */}
          <div className="shopping-list-footer">
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/explore')}
            >
              Back to Recipes
            </button>
            <div className="footer-right">
              {shoppingList.length > 0 && (
                <div className="footer-stats">
                  <p>{checkedCount} items ready to add to inventory</p>
                </div>
              )}
              {shoppingList.length > 10 && checkedCount > 0 && (
                <button
                  className="btn btn-success"
                  onClick={handleAddAllToInventory}
                  disabled={bulkAddInProgress}
                  title={`Add ${checkedCount} checked items to inventory`}
                >
                  <Check size={16} strokeWidth={2.5} /> Add All to Inventory
                </button>
              )}
            </div>
          </div>

          {/* Bulk Add Result Modal */}
          {bulkAddResult && (
            <div className="modal-overlay" onClick={() => setBulkAddResult(null)}>
              <div className="modal-content bulk-add-result" onClick={e => e.stopPropagation()}>
                {bulkAddResult.error ? (
                  <>
                    <AlertCircle size={32} className="result-icon error" />
                    <h2>Error Adding Items</h2>
                    <p className="result-message">{bulkAddResult.error}</p>
                  </>
                ) : (
                  <>
                    <Check size={32} className="result-icon success" />
                    <h2>Items Added to Inventory</h2>
                    <p className="result-count">
                      {bulkAddResult.successCount} of {bulkAddResult.totalCount} items added
                    </p>
                    {bulkAddResult.failures.length > 0 && (
                      <div className="result-failures">
                        <p className="failure-label">Failed to add:</p>
                        <ul>
                          {bulkAddResult.failures.map((name, idx) => (
                            <li key={idx}>{name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                <button className="btn btn-primary" onClick={() => setBulkAddResult(null)}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </SplashTransition>
  );
};

export default ShoppingList;
