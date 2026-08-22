import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Plus, ArrowRight, ArrowLeft, Pencil, Trash2, ShoppingCart, Undo2, AlertTriangle, AlertCircle } from 'lucide-react';
import { fetchUserInventory, addInventoryItem, deleteInventoryItem } from '../../../lib/inventoryDb';
import { findInventoryMatch } from '../../../lib/inventoryMatcher';
import { parseIngredient, formatShoppingListQuantity } from '../../../lib/ingredientParser';
import {
  getShoppingList,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  SHOPPING_LIST_ID_KEY,
} from '../../../lib/shoppingListApi';
import { deduplicateShoppingList } from '../../../lib/shoppingListUtils';
import './ConsultInventoryModal.css';

// Match-confidence tag: green = exact match, yellow = you have a variant of
// it ("garlic" -> "Garlic Powder"), red = loose word overlap only ("tomato
// paste" -> "Tomatoes")
const CONFIDENCE_TAGS = {
  exact: { Icon: Check, title: 'Exact match in your inventory' },
  partial: { Icon: AlertTriangle, title: 'Close match — check it is the form this recipe needs' },
  weak: { Icon: AlertCircle, title: 'Loose word match — you may still need to buy this' },
};

const rowMotion = {
  layout: true,
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: { duration: 0.25, ease: 'easeOut' },
};

const ConsultInventoryModal = ({ recipe, userId, onClose }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  // Ingredients the matcher found in the user's inventory: {id, line, matchedName}
  const [haveRows, setHaveRows] = useState([]);
  // Ingredients to buy, staged as shopping-list items: {id, line, name, quantity, unit, added}
  const [needRows, setNeedRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: '', quantity: '', unit: '' });
  const [savingId, setSavingId] = useState(null);
  const [addingAll, setAddingAll] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [undoing, setUndoing] = useState(false);
  const [highlightAddAll, setHighlightAddAll] = useState(false);
  const addAllBtnRef = useRef(null);
  const exitWarnedRef = useRef(false);

  // Parse and clean ingredients (strip bullets/headers, drop blank lines)
  const ingredients = useMemo(
    () =>
      (recipe.ingredients || '')
        .split('\n')
        .map((line) => line.replace(/^[-*•]\s*/, '').trim())
        .filter((line) => line.length > 0 && !/^for the\s+.+:$/i.test(line)),
    [recipe.ingredients]
  );

  const toShoppingRow = (id, line) => {
    const parsed = parseIngredient(line);
    return {
      id,
      line,
      name: parsed.name || line,
      quantity: parsed.quantity || '',
      unit: parsed.unit || '',
      added: false,
    };
  };

  // Load inventory and split ingredients into have / need columns
  useEffect(() => {
    let cancelled = false;
    const loadAndMatch = async () => {
      try {
        const items = userId ? await fetchUserInventory(userId) : [];
        if (cancelled) return;

        const have = [];
        const need = [];
        ingredients.forEach((line, idx) => {
          // Match on the parsed core name ("2 tbsp tomato paste" -> "tomato
          // paste") so quantities and prep notes don't skew the confidence
          const coreName = parseIngredient(line).name || line;
          const match = findInventoryMatch(coreName, items);
          if (match) {
            have.push({
              id: `ing-${idx}`,
              line,
              matchedName: match.item.name,
              confidence: match.confidence,
            });
          } else {
            need.push(toShoppingRow(`ing-${idx}`, line));
          }
        });
        setHaveRows(have);
        setNeedRows(need);
      } catch (err) {
        console.error('Error loading inventory:', err);
        if (!cancelled) {
          setNeedRows(ingredients.map((line, idx) => toShoppingRow(`ing-${idx}`, line)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAndMatch();
    return () => {
      cancelled = true;
    };
  }, [userId, ingredients]);

  // Merge rows into the user's current shopping list (same list the Shopping
  // List page loads); creates one if none exists yet. Returns what undo needs
  // to revert the write: the pre-merge snapshot, or the id of a created list.
  const persistRows = async (rows) => {
    const stamp = Date.now();
    const payload = rows.map((row, i) => ({
      id: `${recipe.recipeId || 'recipe'}-${stamp}-${i}`,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      recipeId: recipe.recipeId,
      recipeName: recipe.title,
      isLinked: true,
      checked: false,
      addedToInventory: false,
    }));

    const storedId = localStorage.getItem(SHOPPING_LIST_ID_KEY);
    if (storedId) {
      try {
        const existing = await getShoppingList(storedId);
        const prevItems = existing?.items || [];
        const merged = deduplicateShoppingList([...prevItems, ...payload]);
        await updateShoppingList(storedId, { items: merged });
        return { listId: storedId, prevItems };
      } catch (err) {
        console.error('Error merging with existing shopping list, creating new:', err);
        localStorage.removeItem(SHOPPING_LIST_ID_KEY);
      }
    }
    const saved = await createShoppingList(deduplicateShoppingList(payload));
    localStorage.setItem(SHOPPING_LIST_ID_KEY, saved.shoppingListId);
    return { createdListId: saved.shoppingListId };
  };

  // "This match is wrong" escape hatch: slide the ingredient over to the
  // shopping-list column as a regular stageable item
  const handleMoveToList = (row) => {
    const index = haveRows.findIndex((r) => r.id === row.id);
    setHaveRows((prev) => prev.filter((r) => r.id !== row.id));
    setNeedRows((prev) => [...prev, toShoppingRow(row.id, row.line)]);
    setUndoStack((prev) => [...prev, { type: 'move', haveRow: row, index }]);
  };

  // "I actually have this" escape hatch: record it in the inventory and slide
  // the row over to the inventory column
  const handleAddToInventory = async (row) => {
    if (!userId) {
      alert('Please log in to add items to inventory');
      return;
    }
    setSavingId(row.id);
    try {
      const created = await addInventoryItem(userId, {
        name: row.name,
        category: 'pantry',
        quantity: row.quantity || '',
        unit: row.unit || '',
        notes: 'Added while checking a recipe',
      });
      // No match tag: this row is here because the user just said so, not
      // because the matcher found it. Next visit the matcher sees the new
      // inventory item and tags it normally.
      const haveRow = { id: row.id, line: row.line || row.name, userAdded: true };
      setNeedRows((prev) => prev.filter((r) => r.id !== row.id));
      setHaveRows((prev) => [...prev, haveRow]);
      setUndoStack((prev) => [
        ...prev,
        { type: 'inventory', needRow: row, haveRow, inventoryItemId: created.itemId || created.id },
      ]);
    } catch (err) {
      console.error('Error adding to inventory:', err);
      alert('Failed to add to inventory');
    } finally {
      setSavingId(null);
    }
  };

  const handleAddOne = async (row) => {
    setSavingId(row.id);
    try {
      const undoInfo = await persistRows([row]);
      setNeedRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, added: true } : r)));
      setUndoStack((prev) => [...prev, { type: 'add', rowIds: [row.id], ...undoInfo }]);
    } catch (err) {
      console.error('Error adding to shopping list:', err);
      alert('Failed to add to shopping list');
    } finally {
      setSavingId(null);
    }
  };

  const handleAddAll = async () => {
    const pending = needRows.filter((r) => !r.added);
    if (pending.length === 0) return;

    setAddingAll(true);
    setHighlightAddAll(false);
    try {
      const undoInfo = await persistRows(pending);
      setNeedRows((prev) => prev.map((r) => ({ ...r, added: true })));
      setUndoStack((prev) => [...prev, { type: 'add', rowIds: pending.map((r) => r.id), ...undoInfo }]);
    } catch (err) {
      console.error('Error adding items to shopping list:', err);
      alert('Failed to add items to shopping list');
    } finally {
      setAddingAll(false);
    }
  };

  const handleDelete = (rowId) => {
    const index = needRows.findIndex((r) => r.id === rowId);
    if (index === -1) return;
    setUndoStack((prev) => [...prev, { type: 'delete', row: needRows[index], index }]);
    setNeedRows((prev) => prev.filter((r) => r.id !== rowId));
    if (editingId === rowId) setEditingId(null);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditDraft({ name: row.name, quantity: row.quantity, unit: row.unit });
  };

  const saveEdit = () => {
    if (!editDraft.name.trim()) return;
    setNeedRows((prev) =>
      prev.map((r) =>
        r.id === editingId
          ? { ...r, name: editDraft.name.trim(), quantity: editDraft.quantity.trim(), unit: editDraft.unit.trim() }
          : r
      )
    );
    setEditingId(null);
  };

  const handleUndo = async () => {
    if (undoStack.length === 0 || undoing) return;
    const action = undoStack[undoStack.length - 1];

    setUndoing(true);
    try {
      if (action.type === 'move') {
        // Restore the row to the inventory column at its original spot
        setNeedRows((prev) => prev.filter((r) => r.id !== action.haveRow.id));
        setHaveRows((prev) => {
          const next = [...prev];
          next.splice(Math.min(action.index, next.length), 0, action.haveRow);
          return next;
        });
        if (editingId === action.haveRow.id) setEditingId(null);
      } else if (action.type === 'delete') {
        setNeedRows((prev) => {
          const next = [...prev];
          next.splice(Math.min(action.index, next.length), 0, action.row);
          return next;
        });
      } else if (action.type === 'add') {
        // Revert the backend list to its pre-add snapshot (or remove the list
        // entirely if this add was the one that created it)
        if (action.createdListId) {
          await deleteShoppingList(action.createdListId);
          localStorage.removeItem(SHOPPING_LIST_ID_KEY);
        } else {
          await updateShoppingList(action.listId, { items: action.prevItems });
        }
        setNeedRows((prev) =>
          prev.map((r) => (action.rowIds.includes(r.id) ? { ...r, added: false } : r))
        );
      } else if (action.type === 'inventory') {
        await deleteInventoryItem(userId, action.inventoryItemId);
        setHaveRows((prev) => prev.filter((r) => r.id !== action.haveRow.id));
        setNeedRows((prev) => [...prev, action.needRow]);
      }
      setUndoStack((prev) => prev.slice(0, -1));
    } catch (err) {
      console.error('Error undoing action:', err);
      alert('Failed to undo');
    } finally {
      setUndoing(false);
    }
  };

  // Leaving with staged items that were never added to the shopping list:
  // the first attempt scrolls to and highlights the Add All button instead of
  // leaving; a second attempt leaves anyway.
  const guardExit = (leave) => {
    if (needRows.some((r) => !r.added) && !exitWarnedRef.current) {
      exitWarnedRef.current = true;
      setHighlightAddAll(true);
      addAllBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    leave();
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content consult-inventory-modal" onClick={(e) => e.stopPropagation()} data-lenis-prevent>
          <div className="loading">Checking inventory...</div>
        </div>
      </div>
    );
  }

  const totalCount = haveRows.length + needRows.length;
  const pendingCount = needRows.filter((r) => !r.added).length;

  return (
    <div className="modal-overlay" onClick={() => guardExit(onClose)}>
      <div className="modal-content consult-inventory-modal fade-in-stagger" onClick={(e) => e.stopPropagation()} data-lenis-prevent>
        <button className="close-btn" onClick={() => guardExit(onClose)} aria-label="Close">
          <X size={18} />
        </button>

        <div className="consult-inventory-header">
          <h2>Consult Inventory</h2>
          <p className="modal-subtitle">
            We found {haveRows.length} of {totalCount} ingredient{totalCount !== 1 ? 's' : ''} in your
            inventory using word matching — double-check the matches and send anything you still need
            to your shopping list.
          </p>
        </div>

        <div className="consult-inventory-content">
          {/* In Your Inventory */}
          <div className="consult-column have-column">
            <h3>
              In Your Inventory <span className="column-count">{haveRows.length}</span>
            </h3>
            <div className="consult-rows">
              <AnimatePresence initial={false}>
                {haveRows.map((row) => {
                  const tag = row.confidence
                    ? CONFIDENCE_TAGS[row.confidence] || CONFIDENCE_TAGS.weak
                    : null;
                  return (
                  <motion.div key={row.id} className="consult-row have-row" {...rowMotion}>
                    <div className="consult-row-text">
                      <span className="consult-row-name">{row.line}</span>
                      {tag && (
                        <span className={`have-match-tag ${row.confidence}`} title={tag.title}>
                          <tag.Icon size={12} strokeWidth={2.5} /> {row.matchedName}
                        </span>
                      )}
                    </div>
                    <button
                      className="move-to-list-btn"
                      onClick={() => handleMoveToList(row)}
                      title="Not actually in your inventory? Send it to the shopping list"
                    >
                      Add to shopping list <ArrowRight size={14} />
                    </button>
                  </motion.div>
                  );
                })}
              </AnimatePresence>
              {haveRows.length === 0 && (
                <p className="consult-empty">Nothing from this recipe is in your inventory yet.</p>
              )}
            </div>
          </div>

          {/* Shopping List */}
          <div className="consult-column need-column">
            <h3>
              Shopping List <span className="column-count">{needRows.length}</span>
            </h3>
            <div className="consult-rows">
              <AnimatePresence initial={false}>
                {needRows.map((row) => {
                  const qty = formatShoppingListQuantity(row);
                  return (
                    <motion.div
                      key={row.id}
                      className={`consult-row need-row ${row.added ? 'added' : ''}`}
                      {...rowMotion}
                    >
                      {editingId === row.id ? (
                        <div className="need-row-edit">
                          <input
                            type="text"
                            value={editDraft.name}
                            onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            placeholder="Item name"
                            autoFocus
                          />
                          <div className="edit-qty-row">
                            <input
                              type="text"
                              value={editDraft.quantity}
                              onChange={(e) => setEditDraft({ ...editDraft, quantity: e.target.value })}
                              placeholder="Quantity"
                            />
                            <input
                              type="text"
                              value={editDraft.unit}
                              onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })}
                              placeholder="Unit"
                            />
                          </div>
                          <div className="edit-actions">
                            <button className="btn btn-xs btn-secondary" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                            <button className="btn btn-xs btn-primary" onClick={saveEdit}>
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            className={`row-add-btn ${row.added ? 'added' : ''}`}
                            onClick={() => handleAddOne(row)}
                            disabled={row.added || savingId === row.id || addingAll}
                            aria-label={row.added ? 'Added to shopping list' : `Add ${row.name} to shopping list`}
                            title={row.added ? 'Added to shopping list' : 'Add to shopping list'}
                          >
                            {row.added ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
                          </button>
                          <div className="consult-row-text">
                            <span className="consult-row-name">{row.name}</span>
                            {qty && <span className="consult-row-qty">{qty}</span>}
                          </div>
                          {row.added ? (
                            <span className="added-tag">Added</span>
                          ) : (
                            <div className="need-row-actions">
                              <button
                                className="row-icon-btn"
                                onClick={() => handleAddToInventory(row)}
                                disabled={savingId === row.id}
                                aria-label={`Already have ${row.name}? Add it to your inventory`}
                                title="Already have this? Add it to your inventory"
                              >
                                <ArrowLeft size={14} />
                              </button>
                              <button
                                className="row-icon-btn"
                                onClick={() => startEdit(row)}
                                aria-label={`Edit ${row.name}`}
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="row-icon-btn danger"
                                onClick={() => handleDelete(row.id)}
                                aria-label={`Remove ${row.name}`}
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {needRows.length === 0 && (
                <p className="consult-empty">You have everything you need for this recipe.</p>
              )}
            </div>
            {needRows.length > 0 && (
              <div className="need-column-footer">
                <button
                  ref={addAllBtnRef}
                  className={`btn btn-success add-all-btn ${highlightAddAll ? 'attention' : ''}`}
                  onClick={handleAddAll}
                  disabled={pendingCount === 0 || addingAll}
                >
                  <ShoppingCart size={15} />
                  {pendingCount > 0
                    ? `Add all to shopping list (${pendingCount})`
                    : 'All added to shopping list'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          {undoStack.length > 0 && (
            <button
              className="btn btn-secondary undo-btn"
              onClick={handleUndo}
              disabled={undoing}
              title="Undo last action"
            >
              <Undo2 size={14} strokeWidth={2.2} /> Undo
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => guardExit(onClose)}>
            Close
          </button>
          <button className="btn btn-primary" onClick={() => guardExit(() => navigate('/shopping-list'))}>
            View Shopping List
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultInventoryModal;
