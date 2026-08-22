import React, { useState } from "react";

/**
 * <img> that stays invisible until the file has actually loaded, then fades
 * in (`.img-fade` / `.loaded` in index.css) — so slow network images ease in
 * instead of popping. Images already in the browser cache are complete by the
 * time the ref runs, so they reveal immediately without a re-fade.
 */
export default function FadeImage({ className = "", ...props }) {
    const [loaded, setLoaded] = useState(false);
    return (
        <img
            ref={(img) => {
                if (img?.complete) setLoaded(true);
            }}
            onLoad={() => setLoaded(true)}
            className={`img-fade${loaded ? " loaded" : ""}${className ? ` ${className}` : ""}`}
            {...props}
        />
    );
}
