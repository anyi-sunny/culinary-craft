import React from "react";
import { motion } from "framer-motion";
import { CircleCheck, ArrowRight } from "lucide-react";
import AdUnit from "./AdUnit";
import { AD_SLOT_RECIPE_SAVED } from "../../lib/ads";
import "./RecipeSavedModal.css";

/**
 * Shown right after a recipe saves, before navigating to the detail page.
 * Carries one ad plus a supporter note; the continue button is available
 * immediately (never delayed or obscured — required for AdSense compliance),
 * and the copy must never ask users to click the ad.
 */
export default function RecipeSavedModal({ onContinue }) {
    return (
        <div className="modal-overlay">
            <motion.div
                className="modal-content saved-modal"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                data-lenis-prevent
            >
                <div className="saved-modal-check">
                    <CircleCheck size={30} strokeWidth={1.8} />
                </div>
                <h2>Recipe Saved!</h2>
                <p className="saved-modal-sub">
                    Ads like this one help keep Culinary Craft free for everyone.
                </p>

                <div className="saved-modal-ad">
                    <AdUnit slot={AD_SLOT_RECIPE_SAVED} />
                    <span className="saved-modal-ad-label">Advertisement</span>
                </div>

                <button className="btn btn-primary saved-modal-continue" onClick={onContinue}>
                    Continue to your recipe
                    <ArrowRight size={16} strokeWidth={2.2} />
                </button>
            </motion.div>
        </div>
    );
}
