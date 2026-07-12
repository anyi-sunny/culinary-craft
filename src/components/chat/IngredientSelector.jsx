import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchUserInventory, PREDEFINED_CATEGORIES } from '../../lib/inventoryDb';
import './IngredientSelector.css';

const IngredientSelector = ({ userId, isOpen, onConfirm, onCancel }) => {
    const [inventoryItems, setInventoryItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState({});
    const [mode, setMode] = useState('none'); // 'none', 'some', 'solely'
    const [loading, setLoading] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState({});

    useEffect(() => {
        if (!isOpen) return;
        loadInventory();
    }, [isOpen, userId]);

    const loadInventory = async () => {
        try {
            setLoading(true);
            const items = await fetchUserInventory(userId);
            setInventoryItems(items);
            // Initialize expanded categories for all
            const expanded = {};
            PREDEFINED_CATEGORIES.forEach((cat) => {
                expanded[cat.id] = true;
            });
            setExpandedCategories(expanded);
        } catch (err) {
            console.error('Error loading inventory:', err);
        } finally {
            setLoading(false);
        }
    };

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
                                ✕
                            </button>
                        </div>

                        <div className="selector-mode">
                            <p>How do you want to use your inventory?</p>
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
                                    <span>Any ingredients are fine</span>
                                </label>
                                <label className="mode-label">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="some"
                                        checked={mode === 'some'}
                                        onChange={(e) => setMode(e.target.value)}
                                    />
                                    <span>Use some of my ingredients and additional if necessary</span>
                                </label>
                                <label className="mode-label">
                                    <input
                                        type="radio"
                                        name="mode"
                                        value="solely"
                                        checked={mode === 'solely'}
                                        onChange={(e) => setMode(e.target.value)}
                                    />
                                    <span>Use ONLY my selected ingredients - I do not plan on getting more groceries!</span>
                                </label>
                            </div>
                        </div>

                        {mode !== 'none' && (
                            <div className="selector-content">
                                {loading ? (
                                    <div className="selector-loading">Loading inventory...</div>
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
