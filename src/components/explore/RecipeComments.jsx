import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { getComments, addComment } from "../../lib/commentsApi";
import "./RecipeComments.css";

const TABS = [
    { key: "feedback", label: "Feedback" },
    { key: "question", label: "Questions" },
];

/**
 * Two-tab comment card under the full recipe view.
 * Feedback: impressions from people who cooked it. Questions: open Q&A.
 * The recipe's creator gets a colored "Creator" tag next to their username.
 *
 * focusRequest: {tab, ts} — set by the finish-cooking popup to jump here.
 */
export default function RecipeComments({ recipe, userId, onRequireLogin, focusRequest }) {
    const [tab, setTab] = useState("feedback");
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState("");
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState("");
    const rootRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const list = await getComments(recipe.recipeId);
                if (!cancelled) setComments(list);
            } catch (err) {
                console.error("Error loading comments:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [recipe.recipeId]);

    useEffect(() => {
        if (!focusRequest) return;
        setTab(focusRequest.tab);
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 600);
        return () => clearTimeout(t);
    }, [focusRequest]);

    const visible = comments
        .filter((c) => c.type === tab)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const post = async () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (!userId) {
            onRequireLogin?.();
            return;
        }
        setPosting(true);
        setError("");
        try {
            const saved = await addComment(recipe.recipeId, tab, trimmed);
            setComments((prev) => [...prev, saved]);
            setText("");
        } catch (err) {
            setError(err.message || "Could not post your comment.");
        } finally {
            setPosting(false);
        }
    };

    const formatWhen = (iso) => {
        const d = new Date(iso);
        return Number.isNaN(d.getTime())
            ? ""
            : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    };

    return (
        <section className="recipe-comments" ref={rootRef}>
            <div className="comments-tabs" role="tablist">
                {TABS.map(({ key, label }) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        className={`comments-tab${tab === key ? " active" : ""}`}
                        onClick={() => setTab(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className={`comments-list${loading ? "" : " fade-in-stagger"}`}>
                {loading ? (
                    <p className="comments-empty">Loading comments…</p>
                ) : visible.length === 0 ? (
                    <p className="comments-empty">
                        {tab === "feedback"
                            ? "No feedback yet — cook it and be the first!"
                            : "No questions yet. Ask away!"}
                    </p>
                ) : (
                    visible.map((c) => (
                        <div key={c.commentId} className="comment">
                            <div className="comment-meta">
                                <span className="comment-username">{c.username}</span>
                                {c.userId === recipe.ownerId && (
                                    <span className="comment-creator-badge">Creator</span>
                                )}
                                <span className="comment-date">{formatWhen(c.createdAt)}</span>
                            </div>
                            <p className="comment-text">{c.text}</p>
                        </div>
                    ))
                )}
            </div>

            <div className="comment-composer">
                <textarea
                    ref={inputRef}
                    rows={2}
                    placeholder={
                        tab === "feedback"
                            ? "Share how it turned out, tweaks you made..."
                            : "Ask a question about this recipe..."
                    }
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            post();
                        }
                    }}
                    data-lenis-prevent
                />
                <button
                    className="comment-post-btn"
                    onClick={post}
                    disabled={posting || !text.trim()}
                    aria-label="Post comment"
                >
                    <Send size={15} strokeWidth={2.2} />
                    {posting ? "Posting…" : "Post"}
                </button>
            </div>
            {error && <p className="comments-error">{error}</p>}
        </section>
    );
}
