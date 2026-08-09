import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./profile.css";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

/**
 * First-login prompt: pick a unique username and enter a real name.
 * Shown automatically by ProfileProvider when no profile record exists.
 */
export default function CompleteProfileModal({
    open,
    email,
    saveProfile,
    onDone,
    onDismiss,
}) {
    const [username, setUsername] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        const trimmedUsername = username.trim();
        const trimmedName = name.trim();

        if (!USERNAME_RE.test(trimmedUsername)) {
            setError(
                "Usernames are 3-20 characters: letters, numbers, dots, dashes or underscores."
            );
            return;
        }
        if (!trimmedName) {
            setError("Please enter your name.");
            return;
        }

        setSaving(true);
        setError("");
        try {
            await saveProfile({
                username: trimmedUsername,
                name: trimmedName,
                email,
            });
            onDone();
        } catch (err) {
            setError(
                err.status === 409
                    ? "That username is already taken — try another."
                    : "Something went wrong saving your profile. Please try again."
            );
        } finally {
            setSaving(false);
        }
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
                >
                    <motion.div
                        className="profile-modal"
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 14, scale: 0.98 }}
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <h2>Finish setting up your profile</h2>
                        <p className="profile-modal-sub">
                            Pick a unique username and tell us your name — it only takes a
                            moment.
                        </p>

                        <label className="profile-field-label" htmlFor="setup-username">
                            Username
                        </label>
                        <input
                            id="setup-username"
                            className="profile-input"
                            placeholder="e.g. sunny_chef"
                            value={username}
                            maxLength={20}
                            onChange={(e) => setUsername(e.target.value)}
                            autoFocus
                        />

                        <label className="profile-field-label" htmlFor="setup-name">
                            Your name
                        </label>
                        <input
                            id="setup-name"
                            className="profile-input"
                            placeholder="e.g. Sunny Anderson"
                            value={name}
                            maxLength={60}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && submit()}
                        />

                        {error && <p className="profile-error">{error}</p>}

                        <div className="profile-modal-actions">
                            <button
                                className="btn btn-primary"
                                onClick={submit}
                                disabled={saving}
                            >
                                {saving ? "Saving..." : "Save profile"}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={onDismiss}
                                disabled={saving}
                            >
                                Later
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
