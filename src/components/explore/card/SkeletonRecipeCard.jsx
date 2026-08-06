import React from "react";
import "./SkeletonRecipeCard.css";

export default function SkeletonRecipeCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-image" />
      <div className="skeleton-content">
        <div className="skeleton-title" />
        <div className="skeleton-creator" />
      </div>
    </div>
  );
}
