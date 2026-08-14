import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Check, Undo2, Trash2, ShoppingCart } from 'lucide-react';
import SplashTransition from '../SplashTransition';
import TopNav from '../nav/TopNav';
import { useAuthModal } from '../auth/authModalContext';
import { addInventoryItem } from '../../lib/inventoryDb';
import { createShoppingList, updateShoppingList, getShoppingList } from '../../lib/shoppingListApi';
import '../explore/Explore.css'; // .gate
import './ShoppingList.css';

const SHOPPING_LIST_ID_KEY = 'culinary_craft_current_shopping_list_id';

const ShoppingList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { authStatus, user } = useAuthenticator((ctx) => [ctx.authStatus, ctx.user]);
  const { requireLogin } = useAuthModal();

  const [shoppingList, setShoppingList] = useState([]);
  const [shoppingListId, setShoppingListId] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [undoStack, setUndoStack] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeShoppingList = async () => {
      setLoading(true);
      try {
        // Check if we have a shopping list from navigation state
        const list = location.state?.shoppingList;

        if (list && list.length > 0 && user?.userId) {
          // Create new shopping list from navigation state
          const savedList = await createShoppingList(list);
          setShoppingListId(savedList.shoppingListId);
          localStorage.setItem(SHOPPING_LIST_ID_KEY, savedList.shoppingListId);
          setShoppingList(list);

          // Initialize checked state
          const checked = {};
          list.forEach(item => {
            checked[item.id] = false;
          });
          setCheckedItems(checked);
        } else {
          // Try to load existing shopping list from localStorage or backend
          const storedId = localStorage.getItem(SHOPPING_LIST_ID_KEY);
          if (storedId && user?.userId) {
            try {
              const loadedList = await getShoppingList(storedId);
              if (loadedList && loadedList.items) {
                setShoppingListId(storedId);
                setShoppingList(loadedList.items);

                // Initialize checked state from loaded items
                const checked = {};
                loadedList.items.forEach((item, idx) => {
                  checked[item.id || idx] = item.checked || false;
                });
                setCheckedItems(checked);
              }
            } catch (err) {
              console.error('Error loading shopping list:', err);
              // If list doesn't exist, clear the stored ID
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

  const handleCheckItem = (itemId) => {
    const newChecked = { ...checkedItems, [itemId]: !checkedItems[itemId] };
    setCheckedItems(newChecked);

    // Add to undo stack
    setUndoStack(prev => [...prev, { itemId, action: 'toggle' }]);

    // Save to backend
    if (shoppingListId && user?.userId) {
      saveShoppingListToBackend(shoppingList, newChecked);
    }
  };

  const saveShoppingListToBackend = async (list = shoppingList, checked = checkedItems) => {
    if (!shoppingListId) {
      console.warn('No shopping list ID to save');
      return;
    }

    try {
      const updatedItems = list.map(item => ({
        ...item,
        checked: checked[item.id] || false
      }));

      console.log('Saving shopping list:', { shoppingListId, itemCount: updatedItems.length });
      await updateShoppingList(shoppingListId, { items: updatedItems });
      console.log('Shopping list saved successfully');
    } catch (err) {
      console.error('Error saving shopping list:', err);
      alert('Failed to save shopping list. Please try again.');
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    if (lastAction.action === 'toggle') {
      setCheckedItems(prev => ({
        ...prev,
        [lastAction.itemId]: !prev[lastAction.itemId]
      }));
    } else if (lastAction.action === 'add') {
      setShoppingList(prev => prev.filter(item => item.id !== lastAction.itemId));
      setCheckedItems(prev => {
        const newState = { ...prev };
        delete newState[lastAction.itemId];
        return newState;
      });
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
        unit: '',
        notes: 'Added from shopping list'
      });

      // Mark as added to inventory
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

  const handleRemoveItem = (itemId) => {
    const newList = shoppingList.filter(item => item.id !== itemId);
    const newChecked = { ...checkedItems };
    delete newChecked[itemId];
    setShoppingList(newList);
    setCheckedItems(newChecked);

    // Add to undo stack
    setUndoStack(prev => [...prev, { itemId, action: 'remove' }]);

    // Save to backend
    if (shoppingListId && user?.userId) {
      saveShoppingListToBackend(newList, newChecked);
    }
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = shoppingList.length;

  // The list is tied to the signed-in account (created, loaded and saved
  // against the caller's userId), so anonymous visitors get a login gate.
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

          {shoppingList.length === 0 ? (
            <div className="empty-shopping-list">
              <p>Your shopping list is empty</p>
              <button className="btn btn-primary" onClick={() => navigate('/explore')}>
                Browse Recipes
              </button>
            </div>
          ) : (
            <div className="shopping-list-content">
              <div className="shopping-items">
                {shoppingList.map(item => {
                  const isChecked = checkedItems[item.id] || false;
                  const addedToInventory = item.addedToInventory || false;

                  return (
                    <div
                      key={item.id}
                      className={`shopping-item ${isChecked ? 'checked' : ''} ${
                        addedToInventory ? 'added' : ''
                      }`}
                    >
                      <div className="item-left">
                        <label className="item-checkbox">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleCheckItem(item.id)}
                            disabled={addedToInventory}
                          />
                          <span className="checkmark" />
                        </label>
                        <div className="item-details">
                          <span className="item-name">{item.name}</span>
                          {item.quantity && (
                            <span className="item-quantity">Qty: {item.quantity}</span>
                          )}
                        </div>
                      </div>

                      <div className="item-actions">
                        {isChecked && !addedToInventory && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleAddToInventory(item.id)}
                            disabled={loading}
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
                            className="btn btn-sm btn-danger btn-remove-item"
                            onClick={() => handleRemoveItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={15} strokeWidth={2} />
                            <span className="remove-label">Remove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Undo Button */}
              {undoStack.length > 0 && (
                <button className="btn-undo" onClick={handleUndo} title="Undo last action">
                  <Undo2 size={14} strokeWidth={2.2} /> Undo
                </button>
              )}
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
