import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChefHat, BookOpen, Compass } from "lucide-react";
import "./profile.css";

/**
 * Once-per-session greeting for returning users, with quick jumps into
 * the three main flows.
 */
export default function WelcomeBackModal({ open, profile, onClose }) {
    const navigate = useNavigate();

    const firstName =
        (profile?.name || "").trim().split(/\s+/)[0] || profile?.username || "Chef";

    const go = (path) => {
        onClose();
        navigate(path);
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="profile-modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="profile-modal welcome-back-modal"
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 14, scale: 0.98 }}
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="profile-modal-close"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>

                        <h2>Welcome back, {firstName}</h2>
                        <p className="profile-modal-sub">
                            Good to see you again. Where shall we pick up?
                        </p>

                        <div className="welcome-back-actions">
                            <button className="welcome-back-action" onClick={() => go("/chat")}>
                                <ChefHat size={20} strokeWidth={1.8} />
                                <span className="welcome-back-action-label">Create a Recipe</span>
                                <span className="welcome-back-action-sub">
                                    Chat with the Culinary Architect
                                </span>
                            </button>
                            <button
                                className="welcome-back-action"
                                onClick={() => go("/my-recipes")}
                            >
                                <BookOpen size={20} strokeWidth={1.8} />
                                <span className="welcome-back-action-label">My Recipes</span>
                                <span className="welcome-back-action-sub">
                                    Your creations, all in one place
                                </span>
                            </button>
                            <button
                                className="welcome-back-action"
                                onClick={() => go("/explore")}
                            >
                                <Compass size={20} strokeWidth={1.8} />
                                <span className="welcome-back-action-label">Explore Recipes</span>
                                <span className="welcome-back-action-sub">
                                    Browse the whole collection
                                </span>
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
