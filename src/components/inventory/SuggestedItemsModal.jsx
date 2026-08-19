import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { PREDEFINED_CATEGORIES, addInventoryItem } from '../../lib/inventoryDb';
import { SUGGESTED_ITEMS, CATEGORY_FALLBACK_ICONS } from '../../lib/suggestedItems';
import './SuggestedItemsModal.css';

const normalize = (name) => name.trim().toLowerCase();

const SuggestedItemsModal = ({ isOpen, userId, inventoryItems, onAdded, onClose }) => {
    const [selected, setSelected] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const ownedNames = useMemo(
        () => new Set(inventoryItems.map((item) => normalize(item.name || ''))),
        [inventoryItems]
    );

    // Items already in the inventory aren't rendered at all; categories with
    // nothing left to suggest disappear with them.
    const grouped = useMemo(
        () =>
            PREDEFINED_CATEGORIES.map((cat) => ({
                ...cat,
                items: SUGGESTED_ITEMS.filter(
                    (item) =>
                        item.category === cat.id && !ownedNames.has(normalize(item.name))
                ),
            })).filter((cat) => cat.items.length > 0),
        [ownedNames]
    );

    const allAdded = grouped.length === 0;

    const selectedNames = Object.keys(selected).filter((name) => selected[name]);

    const toggleItem = (name) => {
        setSelected((prev) => ({ ...prev, [name]: !prev[name] }));
    };

    const handleClose = () => {
        if (saving) return;
        setSelected({});
        setError('');
        onClose();
    };

    const handleAdd = async () => {
        const toAdd = SUGGESTED_ITEMS.filter((item) => selected[item.name]);
        if (toAdd.length === 0) return;

        setSaving(true);
        setError('');
        // Sequential on purpose: each call's CORS preflight is a Lambda
        // invocation, and a parallel burst gets throttled into 503 preflights.
        const added = [];
        const failed = [];
        for (const item of toAdd) {
            try {
                added.push(
                    await addInventoryItem(userId, {
                        name: item.name,
                        category: item.category,
                    })
                );
            } catch (err) {
                console.error(`Error adding suggested item "${item.name}":`, err);
                failed.push(item.name);
            }
        }
        if (added.length > 0) {
            onAdded(added);
        }
        setSaving(false);
        if (failed.length === 0) {
            setSelected({});
            onClose();
        } else {
            // Keep only the failed items selected so a retry re-sends just those
            setSelected(Object.fromEntries(failed.map((name) => [name, true])));
            setError(`Couldn't add ${failed.join(', ')}. Please try again.`);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClose}
                >
                    <motion.div
                        className="modal-content suggested-items-modal"
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 12 }}
                        transition={{ duration: 0.25 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="suggested-header">
                            <div>
                                <h2>Add Suggested Items</h2>
                                {!allAdded && (
                                    <p>Common staples most kitchens keep on hand. Select what you already have.</p>
                                )}
                            </div>
                            <button
                                className="suggested-close"
                                onClick={handleClose}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {error && <div className="suggested-error">{error}</div>}

                        {allAdded ? (
                            <div className="suggested-all-added">
                                All suggested items have been added to your inventory.
                            </div>
                        ) : (
                            <>
                                {/* data-lenis-prevent: keeps the Lenis wrapper from
                                   scrolling the page behind the modal instead of this list. */}
                                <div className="suggested-body" data-lenis-prevent>
                                    {grouped.map((cat) => (
                                        <section key={cat.id} className="suggested-category">
                                            <h3>{cat.label}</h3>
                                            <div className="suggested-grid">
                                                {cat.items.map((item) => {
                                                    const isSelected = !!selected[item.name];
                                                    const Icon = item.icon || CATEGORY_FALLBACK_ICONS[cat.id];
                                                    return (
                                                        <button
                                                            key={item.name}
                                                            type="button"
                                                            className={`suggested-chip${isSelected ? ' selected' : ''}`}
                                                            onClick={() => toggleItem(item.name)}
                                                            aria-pressed={isSelected}
                                                        >
                                                            <Icon size={18} stroke={1.75} aria-hidden="true" />
                                                            <span className="chip-name">{item.name}</span>
                                                            {isSelected && (
                                                                <Check size={14} className="chip-check" aria-hidden="true" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    ))}
                                </div>

                                <div className="suggested-footer">
                                    <span className="suggested-count">
                                        {selectedNames.length === 0
                                            ? 'Items you already have are hidden'
                                            : `${selectedNames.length} item${selectedNames.length === 1 ? '' : 's'} selected`}
                                    </span>
                                    <div className="suggested-actions">
                                        <button className="btn btn-secondary" onClick={handleClose} disabled={saving}>
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleAdd}
                                            disabled={saving || selectedNames.length === 0}
                                        >
                                            {saving
                                                ? 'Adding...'
                                                : selectedNames.length === 0
                                                    ? 'Add Items'
                                                    : `Add ${selectedNames.length} Item${selectedNames.length === 1 ? '' : 's'}`}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SuggestedItemsModal;
