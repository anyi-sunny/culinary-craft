import React, { useState, useEffect, useRef } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Plus, Box, Pencil, Trash2, ChevronDown, ChefHat } from 'lucide-react';
import TopNav from '../nav/TopNav';
import { useAuthModal } from '../auth/authModalContext';
import { usePageMeta } from '../../lib/usePageMeta';
import { sanitizeInput } from '../../lib/sanitizer';
import { DEMO_INVENTORY_ITEMS } from '../../lib/demoData';
import {
    fetchUserInventory,
    fetchUserCategories,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    addCustomCategory,
    PREDEFINED_CATEGORIES,
} from '../../lib/inventoryDb';
import { initializeUserCategories } from '../../lib/inventoryInit';
import SuggestedItemsModal from './SuggestedItemsModal';
import IngredientSelector from '../chat/IngredientSelector';
import PreviewBanner from '../previews/PreviewBanner';
import './Inventory.css';

// Muted per-category tint applied to each chip via the --chip CSS variable
// (border, hover fill, and name text are derived from it with color-mix).
const CATEGORY_CHIP_COLORS = {
    produce: '#4a7c59',
    seasoning: '#c98f2d',
    baking: '#b9663f',
    dairy: '#5b7fa6',
    meat: '#a64a5f',
    pantry: '#8a6fa8',
};
const CHIP_COLOR_CYCLE = Object.values(CATEGORY_CHIP_COLORS);

// Custom categories (UUID ids) get a stable color from the same palette
const chipColor = (categoryId = '') =>
    CATEGORY_CHIP_COLORS[categoryId] ||
    CHIP_COLOR_CYCLE[
        [...categoryId].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % CHIP_COLOR_CYCLE.length
    ];

// Rotating flavor lines under the loading dots, so the wait feels alive.
const LOADING_PHRASES = [
    'Opening the pantry',
    'Counting the spices',
    'Checking the crisper',
    'Taking stock',
];

const InventoryLoading = () => {
    const [phraseIdx, setPhraseIdx] = useState(0);

    useEffect(() => {
        const timer = setInterval(
            () => setPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length),
            1800
        );
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="inventory-loading" role="status">
            <div className="inventory-loading-dots" aria-hidden="true">
                <span />
                <span />
                <span />
            </div>
            {/* key remounts the line so its fade-in replays on each phrase */}
            <p key={phraseIdx} className="inventory-loading-phrase">
                {LOADING_PHRASES[phraseIdx]}
            </p>
        </div>
    );
};

const Inventory = () => {
  usePageMeta({
    title: 'Inventory',
    description: 'Track the ingredients in your kitchen and cook from what you already have.',
  });
    const { authStatus, user } = useAuthenticator((ctx) => [ctx.authStatus, ctx.user]);
    const { requireLogin } = useAuthModal();
    const navigate = useNavigate();

    // Guests see a read-only preview filled with example data; every
    // mutating control routes to the login modal instead.
    const isGuest = authStatus === 'unauthenticated';

    const [inventoryItems, setInventoryItems] = useState([]);
    const [userCategories, setUserCategories] = useState([]);
    const [allCategories, setAllCategories] = useState(PREDEFINED_CATEGORIES);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form states
    const [showAddMenu, setShowAddMenu] = useState(false);
    const addMenuRef = useRef(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [lastAddedName, setLastAddedName] = useState('');
    const nameInputRef = useRef(null);
    const [formData, setFormData] = useState({
        name: '',
        category: PREDEFINED_CATEGORIES[0].id,
        quantity: '',
        unit: '',
        notes: '',
    });

    const [editingItem, setEditingItem] = useState(null);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    // Build a Recipe: reuses the chat's ingredient selector, then hands the
    // picked constraints to /chat via router state.
    const [showRecipeBuilder, setShowRecipeBuilder] = useState(false);

    // Close the Add Items dropdown on outside click
    useEffect(() => {
        if (!showAddMenu) return;
        const onDown = (e) => {
            if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
                setShowAddMenu(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [showAddMenu]);

    // Close the open chip dropdown on outside click or Escape
    useEffect(() => {
        if (!openMenuId) return;
        const onDown = (e) => {
            const chip = e.target.closest('[data-chip-id]');
            if (!chip || chip.dataset.chipId !== openMenuId) {
                setOpenMenuId(null);
            }
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpenMenuId(null);
        };
        document.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [openMenuId]);

    // Load inventory on mount
    useEffect(() => {
        if (!user?.userId) return;

        const loadInventory = async () => {
            try {
                setLoading(true);
                // Initialize predefined categories for this user (idempotent)
                await initializeUserCategories(user.userId);

                const items = await fetchUserInventory(user.userId);
                const customCats = await fetchUserCategories(user.userId);

                setInventoryItems(items);
                setUserCategories(customCats);
                setAllCategories([
                    ...PREDEFINED_CATEGORIES,
                    ...customCats.map((cat) => ({ id: cat.categoryId, label: cat.name })),
                ]);
            } catch (err) {
                console.error('Error loading inventory:', err);
                setError('Failed to load inventory');
            } finally {
                setLoading(false);
            }
        };

        loadInventory();
    }, [user?.userId]);

    // keepOpen: "Save & Add More" — reset the fields (keeping the category)
    // and leave the modal open for the next item.
    const saveNewItem = async (keepOpen) => {
        if (!formData.name.trim() || !formData.category) {
            setError('Name and category are required');
            return;
        }

        try {
            // Sanitize inputs to prevent injection attacks
            const sanitizedData = {
                name: sanitizeInput(formData.name),
                category: formData.category,
                quantity: sanitizeInput(formData.quantity),
                unit: sanitizeInput(formData.unit),
                notes: sanitizeInput(formData.notes),
            };

            const newItem = await addInventoryItem(user.userId, sanitizedData);

            setInventoryItems((prev) => [...prev, newItem]);
            setFormData({
                name: '',
                category: keepOpen ? formData.category : PREDEFINED_CATEGORIES[0].id,
                quantity: '',
                unit: '',
                notes: '',
            });
            setError('');
            if (keepOpen) {
                setLastAddedName(sanitizedData.name);
                nameInputRef.current?.focus();
            } else {
                setLastAddedName('');
                setShowAddModal(false);
            }
        } catch (err) {
            console.error('Error adding item:', err);
            setError('Failed to add item');
        }
    };

    const handleAddItem = (e) => {
        e.preventDefault();
        saveNewItem(false);
    };

    const handleUpdateItem = async (itemId) => {
        try {
            await updateInventoryItem(user.userId, itemId, editingItem);
            setInventoryItems(
                inventoryItems.map((item) =>
                    item.itemId === itemId ? { ...item, ...editingItem } : item
                )
            );
            setEditingItem(null);
            setError('');
        } catch (err) {
            console.error('Error updating item:', err);
            setError('Failed to update item');
        }
    };

    const handleDeleteItem = async (itemId) => {
        try {
            await deleteInventoryItem(user.userId, itemId);
            setInventoryItems(inventoryItems.filter((item) => item.itemId !== itemId));
            setError('');
        } catch (err) {
            console.error('Error deleting item:', err);
            setError('Failed to delete item');
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) {
            setError('Category name is required');
            return;
        }

        try {
            // Sanitize category name
            const sanitizedName = sanitizeInput(newCategoryName);
            const newCat = await addCustomCategory(user.userId, {
                name: sanitizedName,
                description: '',
            });

            setUserCategories([...userCategories, newCat]);
            setAllCategories([
                ...allCategories,
                { id: newCat.categoryId, label: newCat.name },
            ]);
            setNewCategoryName('');
            setShowCategoryForm(false);
            setError('');
        } catch (err) {
            console.error('Error adding category:', err);
            setError('Failed to add category');
        }
    };

    // Guests browse example data; the real inventory never loads for them.
    const displayItems = isGuest ? DEMO_INVENTORY_ITEMS : inventoryItems;
    const showLoading = isGuest ? false : loading;

    const groupedItems = allCategories.reduce((acc, cat) => {
        acc[cat.id] = displayItems.filter((item) => item.category === cat.id);
        return acc;
    }, {});

    // On a hard refresh authStatus passes through 'configuring' (user still
    // null) while Amplify rehydrates the session — render nothing until it
    // settles into authenticated or the guest preview.
    if (!isGuest && !user) {
        return null;
    }

    return (
        <motion.div
            className="inventory-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            <TopNav />

            <div className="inventory-content">
                {isGuest && (
                    <PreviewBanner message="This is an example inventory. Log in to track your own ingredients and build recipes from them." />
                )}

                <header className="inventory-header">
                    <h1>My Inventory</h1>
                    <p>Manage your ingredients and kitchen supplies</p>
                </header>

                {error && <div className="error-banner">{error}</div>}

                <div className="inventory-controls">
                    <button
                        className="btn btn-primary"
                        onClick={() => (isGuest ? requireLogin() : setShowRecipeBuilder(true))}
                    >
                        <ChefHat size={15} /> Build a Recipe
                    </button>
                    <div className={`add-items-dropdown${showAddMenu ? ' open' : ''}`} ref={addMenuRef}>
                        <button
                            className="btn btn-primary"
                            onClick={() => (isGuest ? requireLogin() : setShowAddMenu((v) => !v))}
                            aria-haspopup="menu"
                            aria-expanded={showAddMenu}
                        >
                            Edit Inventory <ChevronDown size={15} className="add-items-chevron" />
                        </button>
                        {showAddMenu && (
                            <div className="chip-menu add-items-menu" role="menu">
                                <button
                                    role="menuitem"
                                    className="chip-menu-item"
                                    onClick={() => {
                                        setShowAddMenu(false);
                                        setShowAddModal(true);
                                    }}
                                >
                                    <Pencil size={14} strokeWidth={2} /> Add My Own Items
                                </button>
                                <button
                                    role="menuitem"
                                    className="chip-menu-item"
                                    onClick={() => {
                                        setShowAddMenu(false);
                                        setShowSuggestions(true);
                                    }}
                                >
                                    <Plus size={14} strokeWidth={2} /> Commonly Added Ingredients
                                </button>
                                <button
                                    role="menuitem"
                                    className="chip-menu-item"
                                    onClick={() => {
                                        setShowAddMenu(false);
                                        setShowCategoryForm(true);
                                    }}
                                >
                                    <Box size={14} strokeWidth={2} /> Add Custom Category
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {showAddModal && (
                    <div
                        className="modal-overlay"
                        onClick={() => {
                            setShowAddModal(false);
                            setError('');
                            setLastAddedName('');
                        }}
                    >
                        <div
                            className="modal-content add-item-modal"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="add-item-modal-header">
                                <h2>Add Item</h2>
                                <button
                                    className="add-item-modal-close"
                                    onClick={() => {
                                        setShowAddModal(false);
                                        setError('');
                                        setLastAddedName('');
                                    }}
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            {error && <div className="error-banner">{error}</div>}
                            <form className="add-item-form" onSubmit={handleAddItem}>
                                <div className="form-group">
                                    <label>Item Name *</label>
                                    <input
                                        type="text"
                                        ref={nameInputRef}
                                        value={formData.name}
                                        onChange={(e) =>
                                            setFormData({ ...formData, name: sanitizeInput(e.target.value) })
                                        }
                                        placeholder="e.g., Chicken Breast, Olive Oil"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Category *</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) =>
                                            setFormData({ ...formData, category: e.target.value })
                                        }
                                    >
                                        {allCategories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Quantity</label>
                                        <input
                                            type="text"
                                            value={formData.quantity}
                                            onChange={(e) =>
                                                setFormData({ ...formData, quantity: sanitizeInput(e.target.value) })
                                            }
                                            placeholder="e.g., 2, 500g"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Unit</label>
                                        <input
                                            type="text"
                                            value={formData.unit}
                                            onChange={(e) =>
                                                setFormData({ ...formData, unit: sanitizeInput(e.target.value) })
                                            }
                                            placeholder="e.g., cups, grams"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) =>
                                            setFormData({ ...formData, notes: sanitizeInput(e.target.value) })
                                        }
                                        placeholder="Any additional notes..."
                                        rows="2"
                                    />
                                </div>

                                <div className="add-item-actions">
                                    {lastAddedName && (
                                        <span className="add-item-added-hint">
                                            Added {lastAddedName}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => saveNewItem(true)}
                                    >
                                        Save & Add More
                                    </button>
                                    <button type="submit" className="btn btn-success">
                                        Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showCategoryForm && (
                    <motion.form
                        className="add-category-form"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleAddCategory}
                    >
                        <div className="form-group">
                            <label>Category Name *</label>
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(sanitizeInput(e.target.value))}
                                placeholder="e.g., Frozen Foods"
                            />
                        </div>
                        <button type="submit" className="btn btn-success">
                            Create Category
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setShowCategoryForm(false);
                                setNewCategoryName('');
                            }}
                        >
                            <X size={15} /> Cancel
                        </button>
                    </motion.form>
                )}

                {showLoading ? (
                    <InventoryLoading />
                ) : (
                    <div className="inventory-grid">
                        {allCategories.map((category) => (
                            <div key={category.id} className="category-section">
                                <h2 className="category-title">{category.label}</h2>

                                {groupedItems[category.id].length === 0 ? (
                                    <p className="empty-category">No items yet</p>
                                ) : (
                                    <div className="items-list">
                                        {groupedItems[category.id].map((item) => {
                                            const isEditing = editingItem?.itemId === item.itemId;
                                            const isOpen = openMenuId === item.itemId;
                                            // Guest preview chips are inert display-only pills.
                                            const interactive = !isGuest && !isEditing;
                                            return (
                                            <motion.div
                                                key={item.itemId}
                                                className={`inventory-item${isEditing ? ' editing' : ''}${isOpen ? ' open' : ''}${isGuest ? ' readonly' : ''}`}
                                                style={{ '--chip': chipColor(item.category) }}
                                                data-chip-id={item.itemId}
                                                role={interactive ? 'button' : undefined}
                                                tabIndex={interactive ? 0 : undefined}
                                                aria-haspopup={interactive ? 'menu' : undefined}
                                                aria-expanded={interactive ? isOpen : undefined}
                                                onClick={
                                                    interactive
                                                        ? () => setOpenMenuId(isOpen ? null : item.itemId)
                                                        : undefined
                                                }
                                                onKeyDown={
                                                    interactive
                                                        ? (e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setOpenMenuId(isOpen ? null : item.itemId);
                                                            }
                                                        }
                                                        : undefined
                                                }
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                            >
                                                {isEditing ? (
                                                    <div className="item-edit-form">
                                                        <input
                                                            type="text"
                                                            value={editingItem.quantity || ''}
                                                            onChange={(e) =>
                                                                setEditingItem({
                                                                    ...editingItem,
                                                                    quantity: sanitizeInput(e.target.value),
                                                                })
                                                            }
                                                            placeholder="Quantity"
                                                        />
                                                        <textarea
                                                            value={editingItem.notes || ''}
                                                            onChange={(e) =>
                                                                setEditingItem({
                                                                    ...editingItem,
                                                                    notes: sanitizeInput(e.target.value),
                                                                })
                                                            }
                                                            placeholder="Notes"
                                                            rows="2"
                                                        />
                                                        <div className="edit-actions">
                                                            <button
                                                                className="btn btn-sm btn-success"
                                                                onClick={() =>
                                                                    handleUpdateItem(
                                                                        item.itemId
                                                                    )
                                                                }
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={() =>
                                                                    setEditingItem(null)
                                                                }
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="item-info">
                                                            <h3>{item.name}</h3>
                                                            {item.quantity && (
                                                                <span className="item-qty">
                                                                    {item.quantity}
                                                                    {item.unit ? ` ${item.unit}` : ''}
                                                                </span>
                                                            )}
                                                            {item.notes && (
                                                                <span
                                                                    className="item-notes"
                                                                    title={item.notes}
                                                                >
                                                                    {item.notes}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {!isGuest && (
                                                            <span className="chip-chevron" aria-hidden="true">
                                                                <ChevronDown size={15} strokeWidth={2.2} />
                                                            </span>
                                                        )}
                                                        {isOpen && (
                                                            <motion.div
                                                                className="chip-menu"
                                                                role="menu"
                                                                initial={{ opacity: 0, y: -6 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <button
                                                                    role="menuitem"
                                                                    className="chip-menu-item"
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        setEditingItem(item);
                                                                    }}
                                                                >
                                                                    <Pencil size={14} strokeWidth={2} /> Edit
                                                                </button>
                                                                <button
                                                                    role="menuitem"
                                                                    className="chip-menu-item danger"
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        handleDeleteItem(item.itemId);
                                                                    }}
                                                                >
                                                                    <Trash2 size={14} strokeWidth={2} /> Delete
                                                                </button>
                                                            </motion.div>
                                                        )}
                                                    </>
                                                )}
                                            </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <SuggestedItemsModal
                isOpen={showSuggestions}
                userId={user?.userId}
                inventoryItems={inventoryItems}
                onAdded={(added) => setInventoryItems((prev) => [...prev, ...added])}
                onClose={() => setShowSuggestions(false)}
            />

            {!isGuest && (
                <IngredientSelector
                    userId={user?.userId}
                    items={inventoryItems}
                    isOpen={showRecipeBuilder}
                    onConfirm={(mode, selectedItems) =>
                        navigate('/chat', {
                            state: { ingredientContext: { mode, selectedItems } },
                        })
                    }
                    onCancel={() => setShowRecipeBuilder(false)}
                />
            )}
        </motion.div>
    );
};

export default Inventory;
