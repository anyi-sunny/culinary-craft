import React, { useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import TopNav from '../nav/TopNav';
import { sanitizeInput } from '../../lib/sanitizer';
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
import './Inventory.css';

const Inventory = () => {
    const { user } = useAuthenticator();
    const navigate = useNavigate();

    const [inventoryItems, setInventoryItems] = useState([]);
    const [userCategories, setUserCategories] = useState([]);
    const [allCategories, setAllCategories] = useState(PREDEFINED_CATEGORIES);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Form states
    const [showAddForm, setShowAddForm] = useState(false);
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

    // Redirect unauthenticated users
    useEffect(() => {
        if (!user) {
            navigate('/');
        }
    }, [user, navigate]);

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

    const handleAddItem = async (e) => {
        e.preventDefault();
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

            setInventoryItems([...inventoryItems, newItem]);
            setFormData({
                name: '',
                category: PREDEFINED_CATEGORIES[0].id,
                quantity: '',
                unit: '',
                notes: '',
            });
            setShowAddForm(false);
            setError('');
        } catch (err) {
            console.error('Error adding item:', err);
            setError('Failed to add item');
        }
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

    const groupedItems = allCategories.reduce((acc, cat) => {
        acc[cat.id] = inventoryItems.filter((item) => item.category === cat.id);
        return acc;
    }, {});

    // Render nothing while redirecting
    if (!user) {
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
                <header className="inventory-header">
                    <h1>My Inventory</h1>
                    <p>Manage your ingredients and kitchen supplies</p>
                </header>

                {error && <div className="error-banner">{error}</div>}

                <div className="inventory-controls">
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        {showAddForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Add Item</>}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowCategoryForm(!showCategoryForm)}
                    >
                        {showCategoryForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Custom Category</>}
                    </button>
                </div>

                {showAddForm && (
                    <motion.form
                        className="add-item-form"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleAddItem}
                    >
                        <div className="form-group">
                            <label>Item Name *</label>
                            <input
                                type="text"
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

                        <button type="submit" className="btn btn-success">
                            Add Item
                        </button>
                    </motion.form>
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
                    </motion.form>
                )}

                {loading ? (
                    <div className="loading">Loading inventory...</div>
                ) : (
                    <div className="inventory-grid">
                        {allCategories.map((category) => (
                            <div key={category.id} className="category-section">
                                <h2 className="category-title">{category.label}</h2>

                                {groupedItems[category.id].length === 0 ? (
                                    <p className="empty-category">No items yet</p>
                                ) : (
                                    <div className="items-list">
                                        {groupedItems[category.id].map((item) => (
                                            <motion.div
                                                key={item.itemId}
                                                className="inventory-item"
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 10 }}
                                            >
                                                {editingItem?.itemId === item.itemId ? (
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
                                                                <p className="item-qty">
                                                                    {item.quantity}
                                                                    {item.unit ? ` ${item.unit}` : ''}
                                                                </p>
                                                            )}
                                                            {item.notes && (
                                                                <p className="item-notes">
                                                                    {item.notes}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="item-actions">
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={() =>
                                                                    setEditingItem(item)
                                                                }
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() =>
                                                                    handleDeleteItem(
                                                                        item.itemId
                                                                    )
                                                                }
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default Inventory;
