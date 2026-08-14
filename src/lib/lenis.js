// Registry for the app's single Lenis instance (created by SmoothScroll).
// Lives outside the component file so non-component modules can reset the
// scroll without tripping react-refresh's only-export-components rule.

let lenisInstance = null;

/** SmoothScroll registers its instance here (and null on unmount). */
export function registerLenis(lenis) {
    lenisInstance = lenis;
}

/**
 * Jump straight to the top of the page, skipping the smooth-scroll easing.
 * Route changes call this between the old page's exit fade and the new
 * page's entrance (see AnimatedRoutes), so every page opens at the top.
 */
export function scrollToTop() {
    if (lenisInstance) {
        lenisInstance.scrollTo(0, { immediate: true, force: true });
    } else {
        window.scrollTo(0, 0);
    }
}
