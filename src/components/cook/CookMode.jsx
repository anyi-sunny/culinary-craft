import React, { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, X, Play, Pause, BellOff, Plus, Minus, Check } from "lucide-react";
import { buildTracks, formatClock } from "../../lib/cookModeUtils";
import "./CookMode.css";

/**
 * Full-screen step-by-step cooking slideshow, styled like an open book:
 * slide text sits flat on the background, and on wide screens a multi-part
 * recipe shows two phases side by side separated by a single spine line.
 *
 * Multi-part recipes get one track per phase ("Cupcake Batter", "Vanilla
 * Icing"), named by a persistent About/Blog-style tab strip (narrow screens
 * use it to switch pages; wide screens to focus, and — with 3+ phases — to
 * swap a hidden phase in). Clicking a page focuses it; the unfocused page
 * dims a hint. Each page carries its own top nav row: back/forward arrows
 * flanking the "Step x of y" label and progress dots.
 *
 * Forward: click the (focused) page, ArrowRight, or Enter.
 * Back: ArrowLeft or the on-page back arrow.
 * Timed steps get a timer (start/pause, +1/+5/+10) that rings until
 * dismissed, counting up how long it has been ringing. Timers keep running
 * on tracks you're not looking at; a ringing hidden track pulses its tab.
 */

function useMediaQuery(query) {
    const subscribe = useCallback(
        (onChange) => {
            const mq = window.matchMedia(query);
            mq.addEventListener("change", onChange);
            return () => mq.removeEventListener("change", onChange);
        },
        [query]
    );
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/**
 * Split button flanking the timer clock: the main segment applies the
 * current amount ("− 5 min"), the separate chevron segment opens a small
 * menu to change how much each press adds or subtracts.
 */
function TimerAdjust({ sign, onApply, disabled }) {
    const [amount, setAmount] = useState(5);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const Icon = sign === "-" ? Minus : Plus;

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (!ref.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    return (
        <div className="cook-timer-adjust" ref={ref}>
            <button
                className="cook-timer-adjust-main"
                onClick={() => onApply(amount)}
                disabled={disabled}
                aria-label={`${sign === "-" ? "Subtract" : "Add"} ${amount} minutes`}
            >
                <Icon size={13} strokeWidth={2.4} />
                {amount} min
            </button>
            <button
                className="cook-timer-adjust-toggle"
                onClick={() => setOpen((o) => !o)}
                disabled={disabled}
                aria-label={`Choose how many minutes to ${sign === "-" ? "subtract" : "add"}`}
                aria-expanded={open}
            >
                <ChevronDown size={13} strokeWidth={2.4} />
            </button>
            {open && (
                <div className="cook-timer-adjust-menu">
                    {[1, 5, 10].map((m) => (
                        <button
                            key={m}
                            className={m === amount ? "selected" : ""}
                            onClick={() => {
                                setAmount(m);
                                setOpen(false);
                            }}
                        >
                            {sign === "-" ? "−" : "+"}{m} min
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** The slide content itself — one step (or the ingredients overview). */
function SlideCard({ slide, timer, showFinish, onFinish, onSetTimer, onAddMinutes, onSubtractMinutes }) {
    if (slide.type === "ingredients") {
        return (
            <div className="cook-card">
                <h1>Gather your ingredients</h1>
                <ul className="cook-ingredients">
                    {slide.items.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
                {showFinish && (
                    <button className="cook-finish-btn" onClick={onFinish}>
                        <Check size={18} strokeWidth={2.4} /> Finish Cooking
                    </button>
                )}
            </div>
        );
    }
    return (
        <div className="cook-card">
            <p className="cook-step-label">Step {slide.stepNumber}</p>
            <h1 className="cook-step-text">{slide.text}</h1>

            {slide.ingredientRefs?.length > 0 && (
                <div className="cook-step-ings">
                    <p className="cook-step-ings-label">In this step</p>
                    <ul>
                        {slide.ingredientRefs.map((line, i) => (
                            <li key={i}>{line}</li>
                        ))}
                    </ul>
                </div>
            )}

            {slide.timerSeconds && timer && (
                <div className="cook-timer">
                    <div className="cook-timer-row">
                        <TimerAdjust
                            sign="-"
                            onApply={onSubtractMinutes}
                            disabled={timer.remaining === 0}
                        />
                        <div className={`cook-timer-clock${timer.ringing ? " ringing" : ""}`}>
                            {timer.ringing ? `+${formatClock(timer.over)}` : formatClock(timer.remaining)}
                        </div>
                        <TimerAdjust sign="+" onApply={onAddMinutes} />
                    </div>
                    {timer.ringing ? (
                        <button
                            className="cook-timer-btn cook-timer-btn--dismiss"
                            onClick={() => onSetTimer({ ringing: false, over: 0 })}
                        >
                            <BellOff size={15} strokeWidth={2.2} /> Dismiss
                        </button>
                    ) : (
                        <button
                            className="cook-timer-btn cook-timer-btn--primary"
                            onClick={() => onSetTimer({ running: !timer.running })}
                            disabled={timer.remaining === 0}
                        >
                            {timer.running ? (
                                <>
                                    <Pause size={15} strokeWidth={2.2} /> Pause
                                </>
                            ) : (
                                <>
                                    <Play size={15} strokeWidth={2.2} /> Start
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {showFinish && (
                <button className="cook-finish-btn" onClick={onFinish}>
                    <Check size={18} strokeWidth={2.4} /> Finish Cooking
                </button>
            )}
        </div>
    );
}

function progressLabel(track, idx) {
    const slide = track.slides[idx];
    return slide.type === "ingredients" ? "Ingredients" : `Step ${slide.stepNumber} of ${track.stepCount}`;
}

export default function CookMode({ recipe, onExit, onFinish }) {
    const tracks = useMemo(() => buildTracks(recipe), [recipe]);
    const multi = tracks.length > 1;
    const isWide = useMediaQuery("(min-width: 960px)");
    // A track with no steps at all (rare) still needs Finish reachable.
    const anySteps = tracks.some((t) => t.stepCount > 0);

    // One slide position per track; keys "track:slide" for the timers.
    const [idxs, setIdxs] = useState(() => tracks.map(() => 0));
    const [activeTrack, setActiveTrack] = useState(0);
    // The other visible track in the wide two-page layout (last active).
    const [coTrack, setCoTrack] = useState(multi ? 1 : null);
    const [timers, setTimers] = useState(() => {
        const initial = {};
        tracks.forEach((t, ti) =>
            t.slides.forEach((s, si) => {
                if (s.timerSeconds) {
                    initial[`${ti}:${si}`] = { remaining: s.timerSeconds, running: false, ringing: false, over: 0 };
                }
            })
        );
        return initial;
    });

    const audioCtxRef = useRef(null);

    // The page behind cook mode: jump to the very top (so the navbar sits
    // exactly in the 64px strip we leave for it) and freeze its scrolling
    // while cook mode is open. Inner slides still scroll on their own.
    useEffect(() => {
        window.scrollTo(0, 0);
        const prevBody = document.body.style.overflow;
        const prevHtml = document.documentElement.style.overflowY;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflowY = "hidden";
        return () => {
            document.body.style.overflow = prevBody;
            document.documentElement.style.overflowY = prevHtml;
        };
    }, []);

    const setTrackIdx = useCallback((ti, fn) => {
        setIdxs((prev) => prev.map((v, i) => (i === ti ? fn(v) : v)));
    }, []);
    const advance = useCallback(
        (ti) => setTrackIdx(ti, (i) => Math.min(i + 1, tracks[ti].slides.length - 1)),
        [setTrackIdx, tracks]
    );
    const goBack = useCallback((ti) => setTrackIdx(ti, (i) => Math.max(i - 1, 0)), [setTrackIdx]);

    // Focus a track: on the wide layout the previously focused page stays
    // visible as the dimmed one, so picking a hidden phase swaps out the
    // least-recently-used page.
    const selectTrack = useCallback(
        (ti) => {
            if (ti === activeTrack) return;
            setCoTrack(activeTrack);
            setActiveTrack(ti);
        },
        [activeTrack]
    );

    // Keyboard navigation drives the focused track.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "ArrowRight" || e.key === "Enter") {
                e.preventDefault();
                advance(activeTrack);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                goBack(activeTrack);
            } else if (e.key === "Escape") {
                onExit();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [advance, goBack, onExit, activeTrack]);

    // One global 1s tick drives every timer (they keep running across
    // slides and across tracks you're not looking at).
    useEffect(() => {
        const t = setInterval(() => {
            setTimers((prev) => {
                let changed = false;
                const next = { ...prev };
                for (const k of Object.keys(next)) {
                    const tm = next[k];
                    if (tm.running && tm.remaining > 0) {
                        const remaining = tm.remaining - 1;
                        next[k] =
                            remaining === 0
                                ? { ...tm, remaining: 0, running: false, ringing: true }
                                : { ...tm, remaining };
                        changed = true;
                    } else if (tm.ringing) {
                        next[k] = { ...tm, over: tm.over + 1 };
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []);

    // Alarm: beep once a second while any timer is ringing, until dismissed.
    const anyRinging = Object.values(timers).some((t) => t.ringing);
    useEffect(() => {
        if (!anyRinging) return;
        const beep = () => {
            try {
                if (!audioCtxRef.current) {
                    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                }
                const ctx = audioCtxRef.current;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.value = 880;
                gain.gain.setValueAtTime(0.0001, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
                osc.connect(gain).connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.5);
            } catch {
                // Audio unavailable — timer still shows the ringing state.
            }
        };
        beep();
        const loop = setInterval(beep, 1000);
        return () => clearInterval(loop);
    }, [anyRinging]);

    const setTimer = (key, patch) => setTimers((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

    const addMinutes = (key, mins) =>
        setTimers((prev) => {
            const tm = prev[key];
            return {
                ...prev,
                [key]: {
                    ...tm,
                    remaining: tm.remaining + mins * 60,
                    // Adding time while ringing silences the alarm and resumes.
                    ringing: false,
                    over: 0,
                    running: tm.ringing ? true : tm.running,
                },
            };
        });

    const subtractMinutes = (key, mins) =>
        setTimers((prev) => {
            const tm = prev[key];
            const remaining = Math.max(0, tm.remaining - mins * 60);
            return {
                ...prev,
                [key]: {
                    ...tm,
                    remaining,
                    // Subtracting down to zero just stops — no alarm.
                    running: remaining === 0 ? false : tm.running,
                },
            };
        });

    // A ringing timer on a track that isn't on screen pulses its tab.
    const trackRinging = (ti) =>
        Object.entries(timers).some(([k, tm]) => tm.ringing && k.startsWith(`${ti}:`));

    if (!tracks.length) return null;

    const visible = multi
        ? isWide
            ? [activeTrack, coTrack].filter((ti) => ti != null).sort((a, b) => a - b)
            : [activeTrack]
        : [0];
    const trackName = (ti) => tracks[ti].name || `Phase ${ti + 1}`;
    const isLastActive = idxs[activeTrack] === tracks[activeTrack].slides.length - 1;

    const renderTab = (ti) => (
        <button
            key={ti}
            role="tab"
            aria-selected={activeTrack === ti}
            className={`cook-tab${activeTrack === ti ? " active" : ""}`}
            onClick={() => selectTrack(ti)}
        >
            {trackName(ti)}
            {trackRinging(ti) && !visible.includes(ti) && (
                <span className="cook-tab-ring" aria-label="Timer ringing" />
            )}
        </button>
    );
    // Wide spread: each visible page's tab sits left-aligned over its own
    // page column; any hidden phases (3+ parts) queue up behind a thin
    // separator at the end of the strip.
    const hiddenTracks = tracks.map((_, ti) => ti).filter((ti) => !visible.includes(ti));

    const hint = multi
        ? isWide
            ? "Click a page to focus it — Enter or → moves the focused phase along"
            : "Switch phases with the tabs above — Enter or → moves this phase along"
        : isLastActive
          ? "That's the last step"
          : "Click anywhere, press Enter or → to continue";

    return (
        <div className="cook-mode" data-lenis-prevent>
            <div className="cook-topbar">
                <span className="cook-progress">{recipe?.title || "Cook Mode"}</span>
                <button className="cook-exit" onClick={onExit}>
                    <X size={15} strokeWidth={2.2} />
                    Exit Cook Mode
                </button>
            </div>

            {/* Phase names live only here — the tab strip stays on screen in
                both the wide and single-page views. */}
            {multi &&
                (isWide ? (
                    <div className="cook-tabs cook-tabs--split" role="tablist">
                        {visible.map((ti, col) => (
                            <div className={`cook-tabs-col${ti === activeTrack ? "" : " dim"}`} key={ti}>
                                {renderTab(ti)}
                                {col === visible.length - 1 && hiddenTracks.length > 0 && (
                                    <div className="cook-tabs-rest">{hiddenTracks.map((hi) => renderTab(hi))}</div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="cook-tabs" role="tablist">
                        {tracks.map((_, ti) => renderTab(ti))}
                    </div>
                ))}

            <div className={`cook-stage cook-stage--pages${multi && isWide ? " cook-stage--split" : ""}`}>
                {visible.map((ti) => {
                    const track = tracks[ti];
                    const idx = idxs[ti];
                    const active = ti === activeTrack;
                    const key = `${ti}:${idx}`;
                    const isLast = idx === track.slides.length - 1;
                    const slide = track.slides[idx];
                    return (
                        <section
                            key={ti}
                            className={`cook-page${active ? " active" : ""}`}
                            onClick={(e) => {
                                if (e.target.closest("button, a, input")) return;
                                if (!active) {
                                    // First click focuses; it never doubles as "advance".
                                    selectTrack(ti);
                                    return;
                                }
                                advance(ti);
                            }}
                        >
                            <div className="cook-pagenav">
                                <span className="cook-pagenav-label">{progressLabel(track, idx)}</span>
                                <div className="cook-pagenav-row">
                                    <button
                                        className="cook-arrow"
                                        onClick={() => {
                                            selectTrack(ti);
                                            goBack(ti);
                                        }}
                                        disabled={idx === 0}
                                        aria-label={multi ? `Previous step of ${trackName(ti)}` : "Previous step"}
                                    >
                                        <ChevronLeft size={18} strokeWidth={2.4} />
                                    </button>
                                    <div className="cook-dots">
                                        {track.slides.map((_, i) => (
                                            <span key={i} className={`cook-dot${i === idx ? " active" : ""}`} />
                                        ))}
                                    </div>
                                    <button
                                        className="cook-arrow"
                                        onClick={() => {
                                            selectTrack(ti);
                                            advance(ti);
                                        }}
                                        disabled={isLast}
                                        aria-label={multi ? `Next step of ${trackName(ti)}` : "Next step"}
                                    >
                                        <ChevronRight size={18} strokeWidth={2.4} />
                                    </button>
                                </div>
                            </div>
                            <div className="cook-page-body">
                                <SlideCard
                                    slide={slide}
                                    timer={timers[key]}
                                    showFinish={isLast && (slide.type === "step" || !anySteps)}
                                    onFinish={onFinish}
                                    onSetTimer={(patch) => setTimer(key, patch)}
                                    onAddMinutes={(m) => addMinutes(key, m)}
                                    onSubtractMinutes={(m) => subtractMinutes(key, m)}
                                />
                            </div>
                        </section>
                    );
                })}
            </div>

            <div className="cook-bottombar">
                <span className="cook-hint">{hint}</span>
            </div>
        </div>
    );
}
