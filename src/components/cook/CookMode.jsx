import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, X, Play, Pause, BellOff, Plus, Minus, Check } from "lucide-react";
import { buildSlides, formatClock } from "../../lib/cookModeUtils";
import "./CookMode.css";

/**
 * Full-screen step-by-step cooking slideshow.
 *
 * Forward: click anywhere (except buttons), ArrowRight, or Enter.
 * Back: ArrowLeft or the on-screen back arrow.
 * Timed steps get a timer (start/pause, +1/+5/+10) that rings until
 * dismissed, counting up how long it has been ringing.
 */
export default function CookMode({ recipe, onExit, onFinish }) {
    const slides = useMemo(() => buildSlides(recipe), [recipe]);

    const [idx, setIdx] = useState(0);
    // idx -> { remaining, running, ringing, over }
    const [timers, setTimers] = useState(() => {
        const initial = {};
        slides.forEach((s, i) => {
            if (s.timerSeconds) {
                initial[i] = { remaining: s.timerSeconds, running: false, ringing: false, over: 0 };
            }
        });
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

    const advance = useCallback(() => {
        setIdx((i) => Math.min(i + 1, slides.length - 1));
    }, [slides.length]);
    const goBack = useCallback(() => {
        setIdx((i) => Math.max(i - 1, 0));
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "ArrowRight" || e.key === "Enter") {
                e.preventDefault();
                advance();
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                goBack();
            } else if (e.key === "Escape") {
                onExit();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [advance, goBack, onExit]);

    // One global 1s tick drives every timer (they keep running across slides).
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

    const setTimer = (i, patch) =>
        setTimers((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));

    const addMinutes = (i, mins) =>
        setTimers((prev) => {
            const tm = prev[i];
            return {
                ...prev,
                [i]: {
                    ...tm,
                    remaining: tm.remaining + mins * 60,
                    // Adding time while ringing silences the alarm and resumes.
                    ringing: false,
                    over: 0,
                    running: tm.ringing ? true : tm.running,
                },
            };
        });

    const subtractMinutes = (i, mins) =>
        setTimers((prev) => {
            const tm = prev[i];
            const remaining = Math.max(0, tm.remaining - mins * 60);
            return {
                ...prev,
                [i]: {
                    ...tm,
                    remaining,
                    // Subtracting down to zero just stops — no alarm.
                    running: remaining === 0 ? false : tm.running,
                },
            };
        });

    // Any button press must never double as "advance".
    const onSurfaceClick = (e) => {
        if (e.target.closest("button, a, input")) return;
        if (idx < slides.length - 1) advance();
    };

    const slide = slides[idx];
    const timer = timers[idx];
    const isLast = idx === slides.length - 1;
    const stepNumber = idx; // slide 0 is ingredients

    return (
        <div className="cook-mode" onClick={onSurfaceClick} data-lenis-prevent>
            <div className="cook-topbar">
                <span className="cook-progress">
                    {slide.type === "ingredients"
                        ? "Ingredients"
                        : `Step ${stepNumber} of ${slides.length - 1}`}
                </span>
                <button className="cook-exit" onClick={onExit}>
                    <X size={15} strokeWidth={2.2} />
                    Exit Cook Mode
                </button>
            </div>

            <div className="cook-stage">
                {slide.type === "ingredients" ? (
                    <div className="cook-card">
                        <h1>Gather your ingredients</h1>
                        <ul className="cook-ingredients">
                            {slide.items.map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="cook-card">
                        <p className="cook-step-label">Step {stepNumber}</p>
                        <h1 className="cook-step-text">{slide.text}</h1>

                        {slide.timerSeconds && timer && (
                            <div className="cook-timer">
                                <div className={`cook-timer-clock${timer.ringing ? " ringing" : ""}`}>
                                    {timer.ringing
                                        ? `+${formatClock(timer.over)}`
                                        : formatClock(timer.remaining)}
                                </div>
                                {timer.ringing ? (
                                    <button
                                        className="cook-timer-btn cook-timer-btn--dismiss"
                                        onClick={() => setTimer(idx, { ringing: false, over: 0 })}
                                    >
                                        <BellOff size={15} strokeWidth={2.2} /> Dismiss
                                    </button>
                                ) : (
                                    <button
                                        className="cook-timer-btn cook-timer-btn--primary"
                                        onClick={() =>
                                            setTimer(idx, { running: !timer.running })
                                        }
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
                                {!timer.ringing &&
                                    [1, 5, 10].map((m) => (
                                        <button
                                            key={`sub-${m}`}
                                            className="cook-timer-btn"
                                            onClick={() => subtractMinutes(idx, m)}
                                            disabled={timer.remaining === 0}
                                        >
                                            <Minus size={13} strokeWidth={2.4} />
                                            {m} min
                                        </button>
                                    ))}
                                {[1, 5, 10].map((m) => (
                                    <button
                                        key={`add-${m}`}
                                        className="cook-timer-btn"
                                        onClick={() => addMinutes(idx, m)}
                                    >
                                        <Plus size={13} strokeWidth={2.4} />
                                        {m} min
                                    </button>
                                ))}
                            </div>
                        )}

                        {isLast && (
                            <button className="cook-finish-btn" onClick={onFinish}>
                                <Check size={18} strokeWidth={2.4} /> Finish Cooking
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="cook-bottombar">
                <button
                    className="cook-back"
                    onClick={goBack}
                    disabled={idx === 0}
                    aria-label="Previous step"
                >
                    <ArrowLeft size={20} strokeWidth={2.2} />
                </button>
                <span className="cook-hint">
                    {isLast
                        ? "That's the last step"
                        : "Click anywhere, press Enter or → to continue"}
                </span>
                <div className="cook-dots">
                    {slides.map((_, i) => (
                        <span key={i} className={`cook-dot${i === idx ? " active" : ""}`} />
                    ))}
                </div>
            </div>
        </div>
    );
}
