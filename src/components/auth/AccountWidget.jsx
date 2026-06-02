import React from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { useAuthModal } from "./authModalContext";
import "./auth.css";

/**
 * Consistent login-status control for the top-right of every page.
 * Logged out -> "Log in" button (opens shared LoginModal).
 * Logged in  -> email pill + "Sign out".
 */
export default function AccountWidget({ variant = "light" }) {
    const { authStatus, user, signOut } = useAuthenticator((ctx) => [
        ctx.authStatus,
        ctx.user,
    ]);
    const { requireLogin } = useAuthModal();

    const email = user?.signInDetails?.loginId || "Chef";

    if (authStatus === "authenticated") {
        return (
            <div className={`account-widget account-widget--${variant}`}>
                <span className="account-email" title={email}>
                    {email}
                </span>
                <button className="account-btn account-btn--ghost" onClick={signOut}>
                    Sign out
                </button>
            </div>
        );
    }

    return (
        <div className={`account-widget account-widget--${variant}`}>
            <button className="account-btn account-btn--solid" onClick={requireLogin}>
                Log in
            </button>
        </div>
    );
}
