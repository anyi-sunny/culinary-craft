import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { fetchUserInventory, PREDEFINED_CATEGORIES } from '../../lib/inventoryDb';
import './IngredientSelector.css';

const allExpanded = () => {
    const expanded = {};
    PREDEFINED_CATEGORIES.forEach((cat) => {
        expanded[cat.id] = true;
    });
    return expanded;
};

// `items`: optionally pass an already-loaded inventory (e.g. from the
// Inventory page) to skip the fetch entirely. Without it, the inventory is
// loaded lazily — only once the user moves off the default "start from
// scratch" mode — so the modal itself opens instantly.
const IngredientSelector = ({ userId, isOpen, onConfirm, onCancel, items = null }) => {
    const [inventoryItems, setInventoryItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState({});
    const [mode, setMode] = useState('none'); // 'none', 'some', 'solely'
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState({});

    // Caller already has the inventory: mirror it (kept in sync if it changes).
    useEffect(() => {
        if (!Array.isArray(items)) return;
        setInventoryItems(items);
        setExpandedCategories(allExpanded());
        setLoaded(true);
    }, [items]);

    // Lazy fetch: only when the user actually wants to pick from inventory.
    useEffect(() => {
        if (!isOpen || mode === 'none' || loaded || Array.isArray(items)) return;

        let cancelled = false;
        const loadInventory = async () => {
            try {
                setLoading(true);
                const fetched = await fetchUserInventory(userId);
                if (cancelled) return;
                setInventoryItems(fetched);
                setExpandedCategories(allExpanded());
                setLoaded(true);
            } catch (err) {
                console.error('Error loading inventory:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadInventory();
        return () => {
            cancelled = true;
        };
    }, [isOpen, mode, loaded, items, userId]);

    const toggleCategory = (categoryId) => {
        setExpandedCategories((prev) => ({
            ...prev,
            [categoryId]: !prev[categoryId],
        }));
    };

    const toggleItemSelection = (itemId) => {
        setSelectedItems((prev) => {
            const updated = { ...prev };
            if (updated[itemId]) {
                delete updated[itemId];
            } else {
                // Initialize with full quantity
                const item = inventoryItems.find((i) => i.itemId === itemId);
                updated[itemId] = {
                    quantity: item?.quantity || '',
                    unit: item?.unit || '',
                    maxQuantity: item?.quantity || '',
                };
            }
            return updated;
        });
    };

    const updateItemQuantity = (itemId, quantity) => {
        setSelectedItems((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                quantity,
            },
        }));
    };

    const handleConfirm = () => {
        if (mode === 'none') {
            onConfirm(mode, []);
        } else {
            const selectedList = Object.entries(selectedItems).map(
                ([itemId, details]) => {
                    const item = inventoryItems.find((i) => i.itemId === itemId);
                    return {
                        itemId,
                        name: item?.name,
                        category: item?.category,
                        quantity: details.quantity,
                        unit: details.unit,
                    };
                }
            );
            onConfirm(mode, selectedList);
        }
    };

    const groupedItems = PREDEFINED_CATEGORIES.reduce((acc, cat) => {
        acc[cat.id] = {
            label: cat.label,
            items: inventoryItems.filter((item) => item.category === cat.id),
        };
        return acc;
    }, {});

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="ingredient-selector-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onCancel}
                    />
                    <motion.div
                        className="ingredient-selector-modal"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="selector-header">
                            <h2>Select Ingredients for Recipe</h2>
                            <button
                                className="selector-close"
                                onClick={onCancel}
                                aria-label="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="selector-mode">
                            <p>Would you like to use your inventory?</p>
                            <div className="mode-options">
                                <label className="mode-label">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="none"
                                        checked={mode === 'none'}
                                        onChange={(e) => {
                                            setMode(e.target.value);
                                            setSelectedItems({});
                                        }}
                                    />
                                    <span>Nope&mdash;Ignore the inventory and start from scratch</span>
                                </label>
                                <label className="mode-label">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="some"
                                        checked={mode === 'some'}
                                        onChange={(e) => setMode(e.target.value)}
                                    />
                                    <span>A little&mdash;Pick some ingredients from the inventory we must use</span>
                                </label>
                                <label className="mode-label">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="solely"
                                        checked={mode === 'solely'}
                                        onChange={(e) => setMode(e.target.value)}
                                    />
                                    <span>Only&mdash;use exclusively ingredients in my inventory <br /><small>Optional: select ingredients we must use</small></span>
                                </label>
                            </div>
                        </div>

                        {mode !== 'none' && (
                            /* data-lenis-prevent: without it the Lenis smooth-scroll
                               wrapper swallows wheel events and scrolls the page
                               behind the modal instead of this list. */
                            <div className="selector-content" data-lenis-prevent>
                                {loading ? (
                                    <div className="selector-loading" role="status">
                                        <div className="selector-loading-dots" aria-hidden="true">
                                            <span />
                                            <span />
                                            <span />
                                        </div>
                                        Loading inventory
                                    </div>
                                ) : inventoryItems.length === 0 ? (
                                    <div className="selector-empty">
                                        Your inventory is empty. Add items in the Inventory page first.
                                    </div>
                                ) : (
                                    <div className="selector-categories">
                                        {PREDEFINED_CATEGORIES.map((cat) => {
                                            const categoryData = groupedItems[cat.id];
                                            if (categoryData.items.length === 0) return null;

                                            return (
                                                <div
                                                    key={cat.id}
                                                    className="selector-category"
                                                >
                                                    <button
                                                        className="category-toggle"
                                                        onClick={() =>
                                                            toggleCategory(cat.id)
                                                        }
                                                    >
                                                        <span className="toggle-arrow">
                                                            {expandedCategories[cat.id]
                                                                ? '▼'
                                                                : '▶'}
                                                        </span>
                                                        {categoryData.label}
                                                        <span className="item-count">
                                                            (
                                                            {
                                                                categoryData.items.filter(
                                                                    (i) =>
                                                                        selectedItems[i.itemId]
                                                                ).length
                                                            }
                                                            /{categoryData.items.length})
                                                        </span>
                                                    </button>

                                                    {expandedCategories[cat.id] && (
                                                        <div className="category-items">
                                                            {categoryData.items.map(
                                                                (item) => (
                                                                    <div
                                                                        key={item.itemId}
                                                                        className="selector-item"
                                                                    >
                                                                        <label className="item-checkbox">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={
                                                                                    !!selectedItems[
                                                                                        item.itemId
                                                                                    ]
                                                                                }
                                                                                onChange={() =>
                                                                                    toggleItemSelection(
                                                                                        item.itemId
                                                                                    )
                                                                                }
                                                                            />
                                                                            <span>
                                                                                {item.name}
                                                                            </span>
                                                                        </label>

                                                                        {selectedItems[
                                                                            item.itemId
                                                                        ] && (
                                                                            <div className="item-quantity-input">
                                                                                <input
                                                                                    type="text"
                                                                                    value={
                                                                                        selectedItems[
                                                                                            item
                                                                                                .itemId
                                                                                        ]
                                                                                            ?.quantity ||
                                                                                        ''
                                                                                    }
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        updateItemQuantity(
                                                                                            item.itemId,
                                                                                            e
                                                                                                .target
                                                                                                .value
                                                                                        )
                                                                                    }
                                                                                    placeholder="Qty"
                                                                                />
                                                                                {item.unit && (
                                                                                    <span className="item-unit">
                                                                                        {item.unit}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="selector-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleConfirm}
                            >
                                Confirm & Start Cooking
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default IngredientSelector;
