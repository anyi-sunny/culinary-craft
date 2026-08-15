import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import "./FeatureShowcase.css";

/**
 * Scroll-triggered feature walkthrough on the landing page.
 *
 * Each entry is one feature block: a descriptor line on top of a slideshow
 * that steps through the feature's screenshots, auto-advancing until the
 * user takes over with the arrows or dots. To add the next feature, drop its
 * images into a folder under public/ and append a block here.
 *
 * Blocks sit side by side on wide screens and stack (with a short separator
 * line between them) on narrow ones — see FeatureShowcase.css.
 */
const FEATURES = [
    {
        id: "create-recipe",
        dir: "landing-step-through",
        images: ["step1.png", "step2.png", "step3.png", "step4.png"],
        subtext: "Create any recipe imaginable that caters perfectly to your needs.",
        altPrefix: "Recipe creation step",
    },
    {
        id: "improve-recipe",
        dir: "landing-2",
        images: ["landing21.png", "landing22.png", "landing23.png", "landing24.png"],
        subtext: "Iterate on an existing recipe on this site or upload one of your own to improve!",
        altPrefix: "Recipe improvement step",
    },
];

const AUTO_ADVANCE_MS = 2500;

const imageUrl = (feature, file) => `/${feature.dir}/${file}`;

function Chevron({ direction }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {direction === "left" ? (
                <polyline points="14.5 6 8.5 12 14.5 18" />
            ) : (
                <polyline points="9.5 6 15.5 12 9.5 18" />
            )}
        </svg>
    );
}

function FeatureSlideshow({ feature }) {
    const [index, setIndex] = useState(0);
    const [autoPlaying, setAutoPlaying] = useState(true);
    const count = feature.images.length;

    useEffect(() => {
        if (!autoPlaying) return undefined;
        const timer = setInterval(
            () => setIndex((current) => (current + 1) % count),
            AUTO_ADVANCE_MS
        );
        return () => clearInterval(timer);
    }, [autoPlaying, count]);

    const goTo = (target) => {
        setAutoPlaying(false);
        setIndex(((target % count) + count) % count);
    };

    return (
        <div className="feature-slideshow">
            <div className="feature-image-frame feature-slide-frame">
                {feature.images.map((img, idx) => (
                    <img
                        key={img}
                        src={imageUrl(feature, img)}
                        alt={`${feature.altPrefix} ${idx + 1}`}
                        className={idx === index ? "is-active" : ""}
                    />
                ))}
            </div>
            <div className="feature-slide-controls">
                <button
                    type="button"
                    className="feature-slide-arrow"
                    aria-label="Previous step"
                    onClick={() => goTo(index - 1)}
                >
                    <Chevron direction="left" />
                </button>
                <div className="feature-slide-dots">
                    {feature.images.map((img, idx) => (
                        <button
                            key={img}
                            type="button"
                            className={`feature-slide-dot${idx === index ? " is-active" : ""}`}
                            aria-label={`Go to step ${idx + 1}`}
                            onClick={() => goTo(idx)}
                        />
                    ))}
                </div>
                <button
                    type="button"
                    className="feature-slide-arrow"
                    aria-label="Next step"
                    onClick={() => goTo(index + 1)}
                >
                    <Chevron direction="right" />
                </button>
            </div>
        </div>
    );
}

export default function FeatureShowcase() {
    return (
        <div className="feature-showcase">
            {FEATURES.map((feature, blockIdx) => (
                <React.Fragment key={feature.id}>
                    {blockIdx > 0 && <hr className="feature-separator" />}
                    <motion.div
                        className="feature-block"
                        initial={{ opacity: 0, y: 26 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.35 }}
                        transition={{
                            duration: 0.8,
                            delay: blockIdx * 0.15,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                    >
                        <p className="feature-subtext">{feature.subtext}</p>
                        <FeatureSlideshow feature={feature} />
                    </motion.div>
                </React.Fragment>
            ))}
        </div>
    );
}
