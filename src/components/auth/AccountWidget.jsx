import React, { useState, useEffect, useRef } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { fetchUserAttributes } from "aws-amplify/auth";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CircleUserRound } from "lucide-react";
import { useAuthModal } from "./authModalContext";
import "./auth.css";

/**
 * Consistent login-status control for the top-right of every page.
 * Logged out -> "Log in" button (opens shared LoginModal).
 * Logged in  -> name pill (desktop) / person icon (mobile), both opening
 *               a dropdown with "Signed in as <email>" and Sign out.
 */
export default function AccountWidget({ variant = "light" }) {
    const { authStatus, user, signOut } = useAuthenticator((ctx) => [
        ctx.authStatus,
        ctx.user,
    ]);
    const { requireLogin } = useAuthModal();

    const [open, setOpen] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const widgetRef = useRef(null);

    const email = user?.signInDetails?.loginId || "";

    // Prefer the Cognito `name` attribute; fall back to the email's local part.
    useEffect(() => {
        if (authStatus !== "authenticated") return;
        let cancelled = false;
        (async () => {
            try {
                const attrs = await fetchUserAttributes();
                if (!cancelled && attrs?.name) {
                    setDisplayName(attrs.name);
                    return;
                }
            } catch {
                // Attribute fetch is best-effort; the fallback below covers it.
            }
            if (!cancelled) setDisplayName((email || "Chef").split("@")[0]);
        })();
        return () => { cancelled = true; };
    }, [authStatus, email]);

    // Close the menu on outside click or Escape.
    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (widgetRef.current && !widgetRef.current.contains(e.target)) {
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

    if (authStatus !== "authenticated") {
        return (
            <div className={`account-widget account-widget--${variant}`}>
                <button className="account-btn account-btn--solid" onClick={requireLogin}>
                    Log in
                </button>
            </div>
        );
    }

    return (
        <div className={`account-widget account-widget--${variant}`} ref={widgetRef}>
            {/* Desktop trigger: name + chevron */}
            <button
                className="account-trigger account-trigger--name"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
            >
                <span className="account-name">{displayName || "Chef"}</span>
                <ChevronDown
                    size={14}
                    strokeWidth={2.2}
                    className={`account-chevron${open ? " open" : ""}`}
                />
            </button>

            {/* Mobile trigger: person icon */}
            <button
                className="account-trigger account-trigger--icon"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label="Account"
            >
                <CircleUserRound size={22} strokeWidth={1.8} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        className="account-menu"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        role="menu"
                    >
                        <div className="account-menu-label">Signed in as</div>
                        <div className="account-menu-email" title={email}>
                            {email || "Unknown"}
                        </div>
                        <div className="account-menu-divider" />
                        <button
                            className="account-menu-signout"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                signOut();
                            }}
                        >
                            Sign out
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
