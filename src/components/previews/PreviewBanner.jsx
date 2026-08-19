import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAuthModal } from '../auth/authModalContext';
import './PreviewBanner.css';

/**
 * Banner shown on the logged-out previews of gated pages (Create Recipe,
 * Inventory, Shopping List). Explains that the data below is an example
 * and offers the login modal as the way in.
 */
const PreviewBanner = ({ message }) => {
    const { requireLogin } = useAuthModal();

    return (
        <div className="preview-banner" role="note">
            <span className="preview-banner-icon" aria-hidden="true">
                <Sparkles size={16} strokeWidth={2} />
            </span>
            <p className="preview-banner-text">
                <strong>You're viewing a preview.</strong> {message}
            </p>
            <button className="btn btn-primary preview-banner-cta" onClick={requireLogin}>
                Log in or sign up
            </button>
        </div>
    );
};

export default PreviewBanner;
