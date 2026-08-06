import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Wraps the app with Lenis inertial smooth scrolling.
 * The low lerp value gives scrolling a soft, trailing feel so the page
 * decelerates gently instead of stopping abruptly.
 *
 * Inner scrollable regions (chat log, modals) must opt out with the
 * `data-lenis-prevent` attribute so their native scrolling still works.
 */
export default function SmoothScroll({ children }) {
    useEffect(() => {
        const lenis = new Lenis({
            lerp: 0.08,
            wheelMultiplier: 0.9,
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
