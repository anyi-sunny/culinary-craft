import React from "react";
import { motion } from "framer-motion";
import "./FeatureShowcase.css";

/**
 * Scroll-triggered feature walkthrough on the landing page.
 *
 * Each entry is one feature block: a set of step images that fade in with a
 * stagger once scrolled into view, followed by a one-line subtext. To add the
 * next feature, drop its images into public/landing-step-through/ and append
 * a block here — the section grows automatically.
 */
const FEATURES = [
    {
        id: "create-recipe",
        images: ["step1.png", "step2.png", "step3.png", "step4.png"],
        subtext: "Create or adjust any recipe that caters perfectly to your needs.",
    },
];

const imageUrl = (file) => `/landing-step-through/${file}`;

export default function FeatureShowcase() {
    return (
        <div className="feature-showcase">
            {FEATURES.map((feature) => (
                <div key={feature.id} className="feature-block">
                    <div className="feature-images">
                        {feature.images.map((img, idx) => (
                            <motion.div
                                key={img}
                                className="feature-image-frame"
                                initial={{ opacity: 0, y: 26 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.35 }}
                                transition={{
                                    duration: 0.8,
                                    delay: idx * 0.22,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                            >
                                <img
                                    src={imageUrl(img)}
                                    alt={`Recipe creation step ${idx + 1}`}
                                    loading="lazy"
                                />
                            </motion.div>
                        ))}
                    </div>
                    <motion.p
                        className="feature-subtext"
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{
                            duration: 0.8,
                            delay: feature.images.length * 0.22,
                            ease: [0.22, 1, 0.36, 1],
                        }}
                    >
                        {feature.subtext}
                    </motion.p>
                </div>
            ))}
        </div>
    );
}
