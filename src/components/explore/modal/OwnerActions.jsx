import React from "react";

export default function OwnerActions({
    isEditing,
    isSaving,
    onEdit,
    onDelete,
    onSave,
    onCancel
}) {
    return (
        <>
            {!isEditing ? (
                <>
                    <button
                        className="btn btn-secondary"
                        onClick={onEdit}
                    >
                        Manual Edit
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={onDelete}
                    >
                        Delete
                    </button>
                </>
            ) : (
                <>
                    <button
                        className="btn btn-primary"
                        onClick={onSave}
                        disabled={isSaving}
                    >
                        {isSaving ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                </>
            )}
        </>
    );
}
