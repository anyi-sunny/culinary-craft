import React, { useState, useRef, useLayoutEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { sanitizeInput } from '../../lib/sanitizer';
import './PhaseEditor.css';

/* Grows to fit its content instead of scrolling internally (same trick as
   RecipeDetail's edit textareas; collapsed phases re-measure on expand
   because the value dependency re-runs when React remounts the reveal). */
function AutoGrowTextarea({ value, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    // scrollHeight excludes borders; add them back for border-box sizing.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);
  return <textarea ref={ref} value={value} {...props} />;
}

/**
 * Manual-edit UI for a recipe's phases, shared by RecipeModal and
 * RecipeDetail. Phases come from editablePhases() and go back out through
 * phasesToRecipeFields().
 *
 * A single-phase recipe renders as plain Ingredients/Directions fields —
 * no accordion chrome, no title input — with an "Add a phase" button
 * below. With two or more phases each one collapses under its title:
 * the first starts open, the rest closed, and expanding one reveals its
 * editable title, ingredients and directions.
 */
export default function PhaseEditor({ phases, onChange }) {
  const multi = phases.length > 1;
  // Sparse array of collapsed flags; missing entries mean open, so newly
  // added phases start expanded. Index-aligned with `phases` (adds and
  // removals below keep it in step).
  const [collapsed, setCollapsed] = useState(() => phases.map((_, i) => i !== 0));

  const isOpen = (i) => !multi || !collapsed[i];

  const toggle = (i) =>
    setCollapsed((c) => {
      const next = [...c];
      next[i] = !next[i];
      return next;
    });

  const update = (i, field, value) =>
    onChange(
      phases.map((p, j) => (j === i ? { ...p, [field]: sanitizeInput(value) } : p))
    );

  const addPhase = () => {
    setCollapsed((c) => {
      const next = [...c];
      next[phases.length] = false;
      return next;
    });
    onChange([...phases, { name: '', ingredients: '', steps: '' }]);
  };

  const removePhase = (i) => {
    setCollapsed((c) => c.filter((_, j) => j !== i));
    onChange(phases.filter((_, j) => j !== i));
  };

  return (
    <div className="phase-editor">
      {phases.map((phase, i) => (
        <section
          key={i}
          className={`phase-editor-item${multi ? '' : ' single'}${isOpen(i) ? ' open' : ''}`}
        >
          {multi && (
            <button
              type="button"
              className="phase-editor-toggle"
              onClick={() => toggle(i)}
              aria-expanded={isOpen(i)}
            >
              <span className="phase-editor-toggle-name">
                {phase.name.trim() || `Phase ${i + 1}`}
              </span>
              <ChevronDown size={18} strokeWidth={2} className="phase-editor-chevron" />
            </button>
          )}
          <div className="phase-editor-reveal">
            <div className="phase-editor-reveal-inner">
              <div className="phase-editor-fields">
              {multi && (
                <label className="phase-editor-field">
                  Phase Title
                  <input
                    type="text"
                    value={phase.name}
                    placeholder={`Phase ${i + 1}`}
                    onChange={(e) => update(i, 'name', e.target.value)}
                  />
                </label>
              )}
              <label className="phase-editor-field">
                Ingredients
                <AutoGrowTextarea
                  value={phase.ingredients}
                  placeholder="One ingredient per line"
                  onChange={(e) => update(i, 'ingredients', e.target.value)}
                />
              </label>
              <label className="phase-editor-field">
                Directions
                <AutoGrowTextarea
                  value={phase.steps}
                  placeholder="One step per line"
                  onChange={(e) => update(i, 'steps', e.target.value)}
                />
              </label>
              {multi && (
                <button
                  type="button"
                  className="phase-editor-remove"
                  onClick={() => removePhase(i)}
                >
                  Remove this phase
                </button>
              )}
              </div>
            </div>
          </div>
        </section>
      ))}
      <button type="button" className="phase-editor-add" onClick={addPhase}>
        <Plus size={16} strokeWidth={2.2} /> Add a phase
      </button>
    </div>
  );
}
