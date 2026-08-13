import React, { useEffect, useRef } from "react";
import { ADSENSE_CLIENT } from "../../lib/ads";

/**
 * A single AdSense <ins> unit. Pushes to the adsbygoogle queue exactly once
 * per mount (StrictMode double-invokes effects, and re-pushing an already
 * filled slot throws), and swallows failures so an unfilled ad — e.g. on
 * localhost, or before the slot ID is real — never breaks the page.
 */
export default function AdUnit({ slot, format = "auto", className = "" }) {
    const pushedRef = useRef(false);

    useEffect(() => {
        if (pushedRef.current) return;
        pushedRef.current = true;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.warn("AdSense unit failed to load:", err);
        }
    }, []);

    return (
        <ins
            className={`adsbygoogle ${className}`.trim()}
            style={{ display: "block", width: "100%", height: "100%" }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={slot}
            data-ad-format={format}
            data-full-width-responsive="false"
        />
    );
}
