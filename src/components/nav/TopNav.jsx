import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { X, Lock, ChevronDown } from "lucide-react";
import AccountWidget from "../auth/AccountWidget";
import { useAuthModal } from "../auth/authModalContext";
import "./TopNav.css";

// Group entries (with `children`) render as dropdowns. The rule: a group
// trigger only opens its menu — navigation always happens through an
// explicit item, which is why the Explore hub is its own child link.
const NAV_ITEMS = [
    { label: "Home", path: "/" },
    {
        label: "Create Recipe",
        children: [
            { label: "Build & Refine", path: "/chat" },
            { label: "Upload & Save", path: "/upload-recipe", auth: true },
        ],
    },
    {
        label: "Explore Recipes",
        children: [
            { label: "Explore", path: "/explore" },
            { label: "All Published", path: "/explore/all" },
            { label: "Saved", path: "/favorites", auth: true },
            { label: "My Creations", path: "/my-recipes", auth: true },
        ],
    },
    { label: "Inventory", path: "/inventory", auth: true },
    { label: "Shopping List", path: "/shopping-list", auth: true },
    // The blog is the About page's second tab, so /blog and every post under
    // it should keep this link lit.
    { label: "About", path: "/about", activePrefixes: ["/blog"] },
];

export default function TopNav({ title = "Culinary Craft", overlay = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    // Which desktop dropdown group is open (its label), if any.
    const [openGroup, setOpenGroup] = useState(null);
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
    const groupRefs = useRef({});

    const isGroupActive = (group) =>
        group.children.some((child) => location.pathname === child.path);
    // A link is lit on its own path, plus any sub-section it owns (e.g.
    // About stays lit across /blog and /blog/:slug).
    const isItemActive = (item) =>
        location.pathname === item.path ||
        (item.activePrefixes || []).some((prefix) =>
            location.pathname.startsWith(prefix)
        );
    // Children that carry router state share a path with a sibling (both
    // /chat) — only the stateless one lights up for that path.
    const isChildActive = (child) => location.pathname === child.path && !child.state;

    // Desktop dropdowns open on hover; a short close delay bridges the
    // pointer gap between the trigger and the panel.
    const closeTimerRef = useRef(null);
    const openDropdown = (label) => {
        clearTimeout(closeTimerRef.current);
        setOpenGroup(label);
    };
    const scheduleDropdownClose = () => {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => setOpenGroup(null), 180);
    };
    useEffect(() => () => clearTimeout(closeTimerRef.current), []);

    // Expand the drawer groups whose pages are open.
    const [drawerOpenGroups, setDrawerOpenGroups] = useState(() =>
        Object.fromEntries(
            NAV_ITEMS.filter((item) => item.children).map((item) => [
                item.label,
                isGroupActive(item),
            ])
        )
    );
    const toggleDrawerGroup = (label) =>
        setDrawerOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

    // Close the drawer and dropdown on Escape.
    useEffect(() => {
        if (!open && !openGroup) return;
        const onKey = (e) => {
            if (e.key === "Escape") {
                setOpen(false);
                setOpenGroup(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, openGroup]);

    // Close the open desktop dropdown when clicking anywhere else.
    useEffect(() => {
        if (!openGroup) return;
        const onClick = (e) => {
            const panel = groupRefs.current[openGroup];
            if (panel && !panel.contains(e.target)) {
                setOpenGroup(null);
            }
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [openGroup]);

    const go = (link) => {
        setOpen(false);
        setOpenGroup(null);
        if (link.auth && !isAuthed) {
            requireLogin();
            return;
        }
        navigate(link.path, link.state ? { state: link.state } : undefined);
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
                                const isOpen = openGroup === item.label;
                                return (
                                    <div
                                        key={item.label}
                                        className="nav-dropdown"
                                        ref={(el) => (groupRefs.current[item.label] = el)}
                                        onMouseEnter={() => openDropdown(item.label)}
                                        onMouseLeave={scheduleDropdownClose}
                                    >
                                        <button
                                            className={`topnav-link${groupActive ? " active" : ""}${isOpen ? " open" : ""}`}
                                            onClick={() => (isOpen ? setOpenGroup(null) : openDropdown(item.label))}
                                            aria-expanded={isOpen}
                                        >
                                            {item.label}
                                            <ChevronDown size={14} strokeWidth={2.2} className="nav-chevron" />
                                        </button>
                                        <AnimatePresence>
                                            {isOpen && (
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
                                                                key={child.label}
                                                                className={`nav-dropdown-item${isChildActive(child) ? " active" : ""}`}
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
                                    className={`topnav-link${isItemActive(item) ? " active" : ""}`}
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
                                        const groupOpen = drawerOpenGroups[item.label];
                                        return (
                                            <div key={item.label} className="drawer-group">
                                                <button
                                                    className={`drawer-link drawer-group-toggle${groupActive ? " active" : ""}`}
                                                    onClick={() => toggleDrawerGroup(item.label)}
                                                    aria-expanded={groupOpen}
                                                >
                                                    <span>{item.label}</span>
                                                    <ChevronDown
                                                        size={15}
                                                        strokeWidth={2.2}
                                                        className={`drawer-chevron${groupOpen ? " open" : ""}`}
                                                    />
                                                </button>
                                                <AnimatePresence initial={false}>
                                                    {groupOpen && (
                                                        <motion.div
                                                            className="drawer-sublinks"
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                                                        >
                                                            {item.children.map((child) => {
                                                                const locked = child.auth && !isAuthed;
                                                                return (
                                                                    <button
                                                                        key={child.label}
                                                                        className={`drawer-link drawer-sublink${isChildActive(child) ? " active" : ""}`}
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
                                            className={`drawer-link${isItemActive(item) ? " active" : ""}`}
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
