import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import RecipeCard from "./card/RecipeCard";
import SkeletonRecipeCard from "./card/SkeletonRecipeCard";
import { recipePath } from "../../lib/recipeUtils";
import "./RecipeCarousel.css";

const MAX_ITEMS = 8;
const MAX_SPEED = 900; // px/s at the far edge of the hover zone
const DEAD_ZONE = 0.12; // half-width of the central no-scroll zone (0..0.5)
const MOBILE_AUTO_MS = 3500;

const visibleForWidth = (w) => {
    if (w >= 1200) return 4;
    if (w >= 900) return 3;
    if (w >= 600) return 2;
    return 1;
};

/**
 * Recipe carousel row for the explore hub (first 8 recipes, circular).
 *
 * Desktop: no autonomous motion. Hovering toward either end steers the
 * carousel in that direction — the further from center, the faster — and
 * the middle of the row is a dead zone. Cards scale by their distance from
 * the row's center (middlemost largest).
 *
 * Mobile: side arrows step one card at a time. Rows auto-advance slide by
 * slide until the user presses an arrow, which stops auto-play for that row.
 */
export default function RecipeCarousel({
    title,
    recipes,
    loading = false,
    viewMorePath,
    userId,
    onCardClick,
    onToggleHeart,
    onTogglePublish,
}) {
    const navigate = useNavigate();
    const items = useMemo(() => recipes.slice(0, MAX_ITEMS), [recipes]);

    const [visible, setVisible] = useState(() => visibleForWidth(window.innerWidth));
    useEffect(() => {
        const onResize = () => setVisible(visibleForWidth(window.innerWidth));
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const isMobile = visible === 1;
    const canRotate = items.length > visible;

    const viewportRef = useRef(null);
    const trackRef = useRef(null);
    const offsetRef = useRef(0);
    const velRef = useRef(0);

    // ---- Desktop: hover-edge steering + center-distance scaling ----
    const updateScales = useCallback(() => {
        const vp = viewportRef.current;
        const track = trackRef.current;
        if (!vp || !track) return;
        const vpRect = vp.getBoundingClientRect();
        const cx = vpRect.left + vpRect.width / 2;
        for (const cell of track.children) {
            const inner = cell.firstChild;
            if (!inner) continue;
            const r = cell.getBoundingClientRect();
            const d = Math.abs(r.left + r.width / 2 - cx) / r.width;
            const scale = Math.max(0.9, 1.07 - 0.085 * d);
            inner.style.transform = `scale(${scale.toFixed(4)})`;
        }
    }, []);

    useEffect(() => {
        if (isMobile || !canRotate || loading) return;
        const track = trackRef.current;
        offsetRef.current = 0;
        velRef.current = 0;
        if (track) track.style.transform = "translateX(0px)";

        let running = true;
        let last = performance.now();
        let raf;
        const tick = (now) => {
            if (!running) return;
            const dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            if (track && velRef.current !== 0) {
                const half = track.scrollWidth / 2;
                if (half > 0) {
                    offsetRef.current =
                        ((offsetRef.current + velRef.current * dt) % half + half) % half;
                    track.style.transform = `translateX(${-offsetRef.current}px)`;
                }
            }
            updateScales();
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            running = false;
            cancelAnimationFrame(raf);
            if (track) {
                track.style.transform = "";
                for (const cell of track.children) {
                    if (cell.firstChild) cell.firstChild.style.transform = "";
                }
            }
        };
    }, [isMobile, canRotate, loading, items.length, visible, updateScales]);

    const onMouseMove = (e) => {
        if (isMobile || !canRotate) return;
        const vp = viewportRef.current;
        if (!vp) return;
        const r = vp.getBoundingClientRect();
        const fromCenter = (e.clientX - r.left) / r.width - 0.5;
        const abs = Math.abs(fromCenter);
        if (abs <= DEAD_ZONE) {
            velRef.current = 0;
            return;
        }
        const t = Math.min(1, (abs - DEAD_ZONE) / (0.5 - DEAD_ZONE));
        // Linear ramp: responsive as soon as the pointer leaves the dead zone.
        velRef.current = Math.sign(fromCenter) * t * MAX_SPEED;
    };
    const onMouseLeave = () => {
        velRef.current = 0;
    };

    // ---- Mobile: arrows + auto slide-by-slide until first interaction ----
    const [mIndex, setMIndex] = useState(items.length);
    const [mAnimate, setMAnimate] = useState(true);
    const autoStoppedRef = useRef(false);

    // Re-center in the middle copy (both directions get runway) whenever the
    // item set or layout mode changes — adjusted during render per React docs.
    const [mResetKey, setMResetKey] = useState(`${items.length}|${isMobile}`);
    const resetKeyNow = `${items.length}|${isMobile}`;
    if (mResetKey !== resetKeyNow) {
        setMResetKey(resetKeyNow);
        setMIndex(items.length);
    }

    useEffect(() => {
        if (!isMobile || !canRotate || loading) return;
        const timer = setInterval(() => {
            if (!autoStoppedRef.current) setMIndex((i) => i + 1);
        }, MOBILE_AUTO_MS);
        return () => clearInterval(timer);
    }, [isMobile, canRotate, loading]);

    const stepMobile = (dir) => {
        autoStoppedRef.current = true;
        setMIndex((i) => i + dir);
    };

    const onMobileTransitionEnd = () => {
        setMIndex((i) => {
            if (i >= items.length * 2 - 1) {
                setMAnimate(false);
                return i - items.length;
            }
            if (i <= 0) {
                setMAnimate(false);
                return i + items.length;
            }
            return i;
        });
    };

    useEffect(() => {
        if (mAnimate) return;
        const raf = requestAnimationFrame(() =>
            requestAnimationFrame(() => setMAnimate(true))
        );
        return () => cancelAnimationFrame(raf);
    }, [mAnimate]);

    if (!loading && items.length === 0) return null;

    const track = canRotate ? [...items, ...items] : items;
    const cellBasis = `${100 / visible}%`;

    const trackStyle =
        isMobile && canRotate
            ? {
                  transform: `translateX(-${mIndex * 100}%)`,
                  transition: mAnimate
                      ? "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)"
                      : "none",
              }
            : undefined;

    return (
        <section className="carousel-row">
            <div className="carousel-head">
                <h2>{title}</h2>
                {viewMorePath && (
                    <button
                        className="view-more-btn"
                        onClick={() => navigate(viewMorePath)}
                    >
                        View more
                        <ArrowRight size={15} strokeWidth={2.2} />
                    </button>
                )}
            </div>

            <div
                className="carousel-viewport"
                ref={viewportRef}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
            >
                <div
                    className={`carousel-track${loading ? "" : " fade-in-stagger"}`}
                    ref={trackRef}
                    style={trackStyle}
                    onTransitionEnd={isMobile ? onMobileTransitionEnd : undefined}
                >
                    {loading
                        ? Array.from({ length: visible }).map((_, i) => (
                              <div
                                  key={`skeleton-${i}`}
                                  className="carousel-cell"
                                  style={{ flexBasis: cellBasis }}
                              >
                                  <div className="carousel-cell-inner">
                                      <SkeletonRecipeCard />
                                  </div>
                              </div>
                          ))
                        : track.map((recipe, i) => (
                              <div
                                  key={`${recipe.recipeId || "r"}-${i}`}
                                  className="carousel-cell"
                                  style={{ flexBasis: cellBasis }}
                              >
                                  <div className="carousel-cell-inner">
                                      <RecipeCard
                                          recipe={recipe}
                                          userId={userId}
                                          onClick={() =>
                                              onCardClick
                                                  ? onCardClick(recipe)
                                                  : navigate(recipePath(recipe))
                                          }
                                          onToggleHeart={onToggleHeart}
                                          onTogglePublish={onTogglePublish}
                                      />
                                  </div>
                              </div>
                          ))}
                </div>

                {isMobile && canRotate && !loading && (
                    <>
                        <button
                            className="carousel-arrow carousel-arrow--left"
                            onClick={() => stepMobile(-1)}
                            aria-label="Previous recipe"
                        >
                            <ChevronLeft size={20} strokeWidth={2.2} />
                        </button>
                        <button
                            className="carousel-arrow carousel-arrow--right"
                            onClick={() => stepMobile(1)}
                            aria-label="Next recipe"
                        >
                            <ChevronRight size={20} strokeWidth={2.2} />
                        </button>
                    </>
                )}
            </div>
        </section>
    );
}
