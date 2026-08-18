import React from 'react';
import './RecipeParts.css';

/**
 * Renders one grouped recipe section (ingredients or steps) from
 * recipeParts() groups. Multi-part recipes get a named sub-header per
 * part; steps number themselves per part.
 */
export default function RecipeParts({ groups, ordered = false, emptyText = 'Nothing listed yet' }) {
  if (!groups?.length) {
    return <p className="recipe-parts-empty">{emptyText}</p>;
  }
  const List = ordered ? 'ol' : 'ul';
  return (
    <div className="recipe-parts">
      {groups.map((group, i) => (
        <div className="recipe-part" key={`${group.name ?? ''}-${i}`}>
          {group.name && <h4 className="recipe-part-name">{group.name}</h4>}
          <List className={ordered ? 'recipe-part-steps' : 'recipe-part-ingredients'}>
            {group.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </List>
        </div>
      ))}
    </div>
  );
}
