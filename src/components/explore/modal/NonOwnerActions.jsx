import React, { useState, useRef, useEffect } from "react";

export default function NonOwnerActions({
    recipe,
    onCopyAndEdit,
    onCopyAndImprove
}) {
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showDropdown &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showDropdown]);

    const handleCopyEdit = () => {
        onCopyAndEdit?.(recipe);
        setShowDropdown(false);
    };

    const handleCopyImprove = () => {
        onCopyAndImprove?.(recipe);
        setShowDropdown(false);
    };

    return (
        <div style={{ position: "relative" }} ref={dropdownRef}>
            <button
                className="btn btn-primary"
                onClick={() => setShowDropdown(!showDropdown)}
            >
                Create Copy ⋯
            </button>
            {showDropdown && (
                <div className="dropdown-menu">
                    <button onClick={handleCopyEdit}>
                        Copy & Edit
                    </button>
                    <button onClick={handleCopyImprove}>
                        Copy & Improve with AI
                    </button>
                </div>
            )}
        </div>
    );
}
