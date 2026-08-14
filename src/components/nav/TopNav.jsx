import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { X, Lock, ChevronDown } from "lucide-react";
import AccountWidget from "../auth/AccountWidget";
import { useAuthModal } from "../auth/authModalContext";
import "./TopNav.css";

const NAV_ITEMS = [
    { label: "Home", path: "/" },
    { label: "Create Recipe", path: "/chat" },
    {
        label: "Explore Recipes",
        path: "/explore", // clicking the group itself opens the explore hub
        children: [
            { label: "All", path: "/explore/all" },
            { label: "Saved", path: "/favorites", auth: true },
            { label: "My Creations", path: "/my-recipes", auth: true },
        ],
    },
    { label: "Inventory", path: "/inventory", auth: true },
    { label: "Shopping List", path: "/shopping-list", auth: true },
];

export default function TopNav({ title = "Culinary Craft", overlay = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    // Overlay mode (home hero): transparent while at the top of the page,
    // solid espresso once the user scrolls.
    const [solid, setSolid] = useState(false);

    useEffect(() => {
        if (!overlay) return;
        const onScroll = () => setSolid(window.scrollY > 50);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [overlay]);
    const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
    const { requireLogin } = useAuthModal();
    const isAuthed = authStatus === "authenticated";
    const dropdownRef = useRef(null);

    const exploreGroup = NAV_ITEMS.find((item) => item.children);
    const isGroupActive = (group) =>
        location.pathname === group.path ||
        group.children.some((child) => location.pathname === child.path);

    // Desktop dropdown opens on hover; a short close delay bridges the
    // pointer gap between the trigger and the panel.
    const closeTimerRef = useRef(null);
    const openDropdown = () => {
        clearTimeout(closeTimerRef.current);
        setDropdownOpen(true);
    };
    const scheduleDropdownClose = () => {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => setDropdownOpen(false), 180);
    };
    useEffect(() => () => clearTimeout(closeTimerRef.current), []);

    // Expand the drawer group when one of its pages is open.
    const [drawerGroupOpen, setDrawerGroupOpen] = useState(
        () => isGroupActive(exploreGroup)
    );

    // Close the drawer and dropdown on Escape.
    useEffect(() => {
        if (!open && !dropdownOpen) return;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setOpen(false);
                setDropdownOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, dropdownOpen]);

    // Close the desktop dropdown when clicking anywhere else.
    useEffect(() => {
        if (!dropdownOpen) return;
        const onClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [dropdownOpen]);

    const go = (link) => {
        setOpen(false);
        setDropdownOpen(false);
        if (link.auth && !isAuthed) {
            requireLogin();
            return;
        }
        navigate(link.path);
    };

    const renderLock = () => (
        <span className="nav-lock">
            <Lock size={12} strokeWidth={2} />
        </span>
    );

    return (
        <>
            <header className={`topnav${overlay ? " topnav--overlay" : ""}${overlay && solid ? " topnav--solid" : ""}`}>
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
                        <img src="/logo.png" alt="Logo" className="brand-logo" />
                        {title}
                    </button>

                    {/* Inline links on wide screens */}
                    <nav className="topnav-links">
                        {NAV_ITEMS.map((item) => {
                            if (item.children) {
                                const groupActive = isGroupActive(item);
                                return (
                                    <div
                                        key={item.label}
                                        className="nav-dropdown"
                                        ref={dropdownRef}
                                        onMouseEnter={openDropdown}
                                        onMouseLeave={scheduleDropdownClose}
                                    >
                                        <button
                                            className={`topnav-link${groupActive ? " active" : ""}${dropdownOpen ? " open" : ""}`}
                                            onClick={() => go(item)}
                                            aria-expanded={dropdownOpen}
                                        >
                                            {item.label}
                                            <ChevronDown size={14} strokeWidth={2.2} className="nav-chevron" />
                                        </button>
                                        <AnimatePresence>
                                            {dropdownOpen && (
                                                <motion.div
                                                    className="nav-dropdown-panel"
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                                >
                                                    {item.children.map((child) => {
                                                        const locked = child.auth && !isAuthed;
                                                        return (
                                                            <button
                                                                key={child.path}
                                                                className={`nav-dropdown-item${location.pathname === child.path ? " active" : ""}`}
                                                                onClick={() => go(child)}
                                                            >
                                                                <span>{child.label}</span>
                                                                {locked && renderLock()}
                                                            </button>
                                                        );
                                                    })}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            }

                            const locked = item.auth && !isAuthed;
                            return (
                                <button
                                    key={item.path}
                                    className={`topnav-link${location.pathname === item.path ? " active" : ""}`}
                                    onClick={() => go(item)}
                                >
                                    {item.label}
                                    {locked && renderLock()}
                                </button>
                            );
                        })}
                    </nav>
                </div>
                <AccountWidget variant="on-accent" />
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
                                <img src="/logo.png" alt="Logo" className="drawer-logo" />
                                <span className="drawer-title">Culinary Craft</span>
                                <button
                                    className="drawer-close"
                                    aria-label="Close menu"
                                    onClick={() => setOpen(false)}
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <nav className="drawer-links">
                                {NAV_ITEMS.map((item) => {
                                    if (item.children) {
                                        const groupActive = isGroupActive(item);
                                        return (
                                            <div key={item.label} className="drawer-group">
                                                <button
                                                    className={`drawer-link drawer-group-toggle${groupActive ? " active" : ""}`}
                                                    onClick={() => setDrawerGroupOpen((v) => !v)}
                                                    aria-expanded={drawerGroupOpen}
                                                >
                                                    <span>{item.label}</span>
                                                    <ChevronDown
                                                        size={15}
                                                        strokeWidth={2.2}
                                                        className={`drawer-chevron${drawerGroupOpen ? " open" : ""}`}
                                                    />
                                                </button>
                                                <AnimatePresence initial={false}>
                                                    {drawerGroupOpen && (
                                                        <motion.div
                                                            className="drawer-sublinks"
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                                        >
                                                            {[{ label: "Explore Home", path: item.path }, ...item.children].map((child) => {
                                                                const locked = child.auth && !isAuthed;
                                                                return (
                                                                    <button
                                                                        key={child.path}
                                                                        className={`drawer-link drawer-sublink${location.pathname === child.path ? " active" : ""}`}
                                                                        onClick={() => go(child)}
                                                                    >
                                                                        <span>{child.label}</span>
                                                                        {locked && (
                                                                            <span className="drawer-lock">
                                                                                <Lock size={13} strokeWidth={2} />
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    }

                                    const locked = item.auth && !isAuthed;
                                    return (
                                        <button
                                            key={item.path}
                                            className={`drawer-link${location.pathname === item.path ? " active" : ""}`}
                                            onClick={() => go(item)}
                                        >
                                            <span>{item.label}</span>
                                            {locked && (
                                                <span className="drawer-lock">
                                                    <Lock size={13} strokeWidth={2} />
                                                </span>
                                            )}
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
