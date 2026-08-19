import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical } from "lucide-react";
import "./RecipeActionsMenu.css";

/**
 * Circular three-dot (kebab) button opening a dropdown of recipe actions.
 * Shared by the recipe modal and the full recipe page.
 *
 * items: [{ label, icon: LucideComponent, danger?: bool, onClick }]
 * icon: trigger icon component (defaults to the three-dot kebab)
 */
export default function RecipeActionsMenu({ items, ariaLabel = "Recipe actions", icon: TriggerIcon = MoreVertical }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="recipe-actions-menu" ref={rootRef}>
            <button
                className={`kebab-btn${open ? " open" : ""}`}
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={ariaLabel}
            >
                <TriggerIcon size={18} strokeWidth={2.2} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="kebab-menu"
                        role="menu"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {items.map(({ label, icon: Icon, danger, onClick }) => (
                            <button
                                key={label}
                                role="menuitem"
                                className={`kebab-item${danger ? " kebab-item--danger" : ""}`}
                                onClick={() => {
                                    setOpen(false);
                                    onClick();
                                }}
                            >
                                {Icon && <Icon size={15} strokeWidth={2} />}
                                {label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
