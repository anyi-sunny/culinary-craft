import React, { useEffect } from "react";
import { Authenticator, useAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { formFields } from "./authConfig";
import "./auth.css";

/**
 * Shared login/sign-up modal. Closes itself once the user is authenticated.
 *
 * The auth-status effect lives here in the modal body (a real component) rather
 * than inside the <Authenticator> render-prop, which previously caused a React
 * hooks-rules violation in Welcome.jsx and Chat.jsx.
 */
function CloseOnAuth({ onClose }) {
    const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
    useEffect(() => {
        if (authStatus === "authenticated") onClose();
    }, [authStatus, onClose]);
    return null;
}

export default function LoginModal({ open, onClose }) {
    // Close on Escape for keyboard users.
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="auth-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <button className="auth-close" onClick={onClose} aria-label="Close">
                    ✕
                </button>
                <CloseOnAuth onClose={onClose} />
                <Authenticator formFields={formFields} />
            </div>
        </div>
    );
}
