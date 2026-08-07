import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Wraps the app with Lenis inertial smooth scrolling.
 * The lerp keeps a hint of softness while staying close to the user's
 * actual scroll input — higher values track the wheel more directly.
 *
 * Inner scrollable regions (chat log, modals) must opt out with the
 * `data-lenis-prevent` attribute so their native scrolling still works.
 */
export default function SmoothScroll({ children }) {
    useEffect(() => {
        const lenis = new Lenis({
            lerp: 0.18,
            wheelMultiplier: 1,
            smoothWheel: true,
        });

        let rafId;
        const raf = (time) => {
            lenis.raf(time);
            rafId = requestAnimationFrame(raf);
        };
        rafId = requestAnimationFrame(raf);

        return () => {
            cancelAnimationFrame(rafId);
            lenis.destroy();
        };
    }, []);

    return children;
}
