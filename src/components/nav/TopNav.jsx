import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthenticator } from "@aws-amplify/ui-react";
import AccountWidget from "../auth/AccountWidget";
import { useAuthModal } from "../auth/authModalContext";
import "./TopNav.css";

const LINKS = [
    { label: "Home", path: "/", icon: "🏠" },
    { label: "Explore", path: "/explore", icon: "🧭" },
    { label: "Start Crafting", path: "/chat", icon: "✨" },
    { label: "My Recipes", path: "/my-recipes", icon: "📖", auth: true },
    { label: "Favorites", path: "/favorites", icon: "❤️", auth: true },
];

export default function TopNav({ title = "Culinary Craft" }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
    const { requireLogin } = useAuthModal();
    const isAuthed = authStatus === "authenticated";

    // Close the drawer on Escape.
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const go = (link) => {
        setOpen(false);
        if (link.auth && !isAuthed) {
            requireLogin();
            return;
        }
        navigate(link.path);
    };

    return (
        <>
            <header className="topnav">
                <div className="topnav-left">
                    <button
                        className="hamburger"
                        aria-label="Open menu"
                        onClick={() => setOpen(true)}
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                    <button className="topnav-brand" onClick={() => navigate("/")}>
                        <span className="brand-mark">🍳</span>
                        {title}
                    </button>
                </div>
                <AccountWidget variant="light" />
            </header>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            className="drawer-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setOpen(false)}
                        />
                        <motion.aside
                            className="drawer"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "tween", duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <div className="drawer-header">
                                <span className="brand-mark">🍳</span>
                                <span className="drawer-title">Culinary Craft</span>
                                <button
                                    className="drawer-close"
                                    aria-label="Close menu"
                                    onClick={() => setOpen(false)}
                                >
                                    ✕
                                </button>
                            </div>

                            <nav className="drawer-links">
                                {LINKS.map((link) => {
                                    const active = location.pathname === link.path;
                                    const locked = link.auth && !isAuthed;
                                    return (
                                        <button
                                            key={link.path}
                                            className={`drawer-link${active ? " active" : ""}`}
                                            onClick={() => go(link)}
                                        >
                                            <span className="drawer-link-icon">{link.icon}</span>
                                            <span>{link.label}</span>
                                            {locked && <span className="drawer-lock">🔒</span>}
                                        </button>
                                    );
                                })}
                            </nav>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
