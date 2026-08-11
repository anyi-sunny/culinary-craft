import React from "react";
import { CATEGORY_OPTIONS } from "../../lib/categories";
import "./CategoryTags.css";

/** Faint oval chips showing a recipe's category tags. Renders nothing when untagged. */
export function TagOvals({ tags, className = "" }) {
    const list = Array.isArray(tags) ? tags : [];
    if (list.length === 0) return null;
    return (
        <div className={`tag-ovals${className ? ` ${className}` : ""}`}>
            {list.map((tag) => (
                <span key={tag} className="tag-oval">
                    {tag}
                </span>
            ))}
        </div>
    );
}

/**
 * Checkbox list over the full canonical category list.
 * `selected` is the array of checked tag names; `onToggle(tag)` flips one.
 */
export function CategoryChecklist({ selected = [], onToggle }) {
    return (
        <div className="category-checklist">
            {CATEGORY_OPTIONS.map((cat) => (
                <label key={cat} className="category-check">
                    <input
                        type="checkbox"
                        checked={selected.includes(cat)}
                        onChange={() => onToggle(cat)}
                    />
                    <span>{cat}</span>
                </label>
            ))}
        </div>
    );
}
