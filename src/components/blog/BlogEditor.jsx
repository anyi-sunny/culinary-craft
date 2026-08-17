import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { X, Trash2, ImagePlus, Eye, PenLine } from "lucide-react";
import { useProfile } from "../profile/profileContext";
import { validateImage, uploadImageToS3 } from "../../lib/imageUtils";
import {
    fetchAdminBlogPost,
    createBlogPost,
    updateBlogPost,
    deleteBlogPost,
} from "../../lib/blogApiClient";
import { formatPostDate } from "./postDate";

const EMPTY = { title: "", subtitle: "", body: "", coverImage: "", published: false };

/**
 * The post editor — admin only, and enforced as such server-side.
 *
 * Create (`slug` null) or edit an existing post. The slug is assigned by the
 * backend from the title when the post is first created and never changes
 * afterwards, so published links keep working through any number of retitles;
 * the editor shows it read-only for existing posts.
 */
export default function BlogEditor({ slug, onClose, onSaved, onDeleted }) {
    const { profile } = useProfile();
    const [post, setPost] = useState(EMPTY);
    const [loading, setLoading] = useState(Boolean(slug));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [dirty, setDirty] = useState(false);
    const imageInputRef = useRef(null);

    useEffect(() => {
        if (!slug) return;
        let cancelled = false;
        (async () => {
            try {
                const loaded = await fetchAdminBlogPost(slug);
                if (!cancelled) setPost({ ...EMPTY, ...loaded });
            } catch (err) {
                console.error("Error loading post:", err);
                if (!cancelled) setError("Could not load that post.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [slug]);

    // Escape closes, matching the app's other modals.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") requestClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });


    const update = (patch) => {
        setPost((p) => ({ ...p, ...patch }));
        setDirty(true);
    };

    const requestClose = () => {
        if (dirty && !window.confirm("Discard your unsaved changes to this post?")) return;
        onClose();
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setUploading(true);
        try {
            await validateImage(file);
            const imageUrl = await uploadImageToS3(file, profile?.userId);
            update({ coverImage: imageUrl });
        } catch (err) {
            setError(err.message || "Could not upload that image.");
        } finally {
            setUploading(false);
            if (imageInputRef.current) imageInputRef.current.value = "";
        }
    };

    const save = async () => {
        const title = post.title.trim();
        if (!title) {
            setError("Give the post a title first.");
            return;
        }
        setSaving(true);
        setError("");
        try {
            const fields = {
                title,
                subtitle: post.subtitle.trim(),
                body: post.body,
                coverImage: post.coverImage || "",
                published: post.published,
            };
            const saved = slug
                ? await updateBlogPost(slug, fields)
                : await createBlogPost(fields);
            setDirty(false);
            onSaved(saved);
        } catch (err) {
            console.error("Error saving post:", err);
            setError(
                err.status === 403
                    ? "Only the site author can publish posts."
                    : err.message || "Could not save the post."
            );
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        setSaving(true);
        try {
            await deleteBlogPost(slug);
            onDeleted();
        } catch (err) {
            console.error("Error deleting post:", err);
            setError(err.message || "Could not delete the post.");
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={requestClose}>
            <div
                className="modal-content blog-editor"
                onClick={(e) => e.stopPropagation()}
                /* data-lenis-prevent: Lenis drives page scrolling, so without
                   it wheel events over the modal scroll the page behind it */
                data-lenis-prevent
            >
                <div className="blog-editor-head">
                    <h2>{slug ? "Edit post" : "New post"}</h2>
                    <button className="close-btn" aria-label="Close" onClick={requestClose}>
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="blog-editor-body">
                        <p className="blog-editor-hint">Loading post…</p>
                    </div>
                ) : (
                    <div className="blog-editor-body">
                        <label className="blog-field">
                            <span>Title</span>
                            <input
                                type="text"
                                value={post.title}
                                maxLength={140}
                                placeholder="What's this one about?"
                                onChange={(e) => update({ title: e.target.value })}
                            />
                        </label>

                        <label className="blog-field">
                            <span>Subtitle <em>(optional — shown on the card)</em></span>
                            <input
                                type="text"
                                value={post.subtitle}
                                maxLength={300}
                                placeholder="A line to draw people in"
                                onChange={(e) => update({ subtitle: e.target.value })}
                            />
                        </label>

                        <div className="blog-field">
                            <span>Cover photo</span>
                            <div className="blog-cover">
                                {post.coverImage ? (
                                    <img src={post.coverImage} alt="" className="blog-cover-img" />
                                ) : (
                                    <div className="blog-cover-empty">
                                        <ImagePlus size={26} strokeWidth={1.6} />
                                        <span>No cover photo yet</span>
                                    </div>
                                )}
                            </div>
                            <div className="blog-cover-actions">
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleImageSelect}
                                    style={{ display: "none" }}
                                />
                                <button
                                    className="btn btn-secondary"
                                    disabled={uploading}
                                    onClick={() => imageInputRef.current?.click()}
                                >
                                    {uploading
                                        ? "Uploading…"
                                        : post.coverImage
                                          ? "Replace photo"
                                          : "Upload photo"}
                                </button>
                                {post.coverImage && (
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => update({ coverImage: "" })}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="blog-field">
                            <div className="blog-field-head">
                                <span>Post</span>
                                <button
                                    className="blog-preview-toggle"
                                    onClick={() => setPreview((v) => !v)}
                                >
                                    {preview ? (
                                        <>
                                            <PenLine size={14} strokeWidth={2.2} /> Write
                                        </>
                                    ) : (
                                        <>
                                            <Eye size={14} strokeWidth={2.2} /> Preview
                                        </>
                                    )}
                                </button>
                            </div>
                            {preview ? (
                                <div className="blog-body blog-editor-preview">
                                    {post.body.trim() ? (
                                        <ReactMarkdown>{post.body}</ReactMarkdown>
                                    ) : (
                                        <p className="blog-editor-hint">Nothing written yet.</p>
                                    )}
                                </div>
                            ) : (
                                <textarea
                                    className="blog-editor-textarea"
                                    value={post.body}
                                    maxLength={60000}
                                    placeholder={
                                        "Write in Markdown.\n\n## A heading\n\nA paragraph, with **bold** and *italic* and [a link](https://example.com).\n\n- a list item\n- another one"
                                    }
                                    onChange={(e) => update({ body: e.target.value })}
                                />
                            )}
                            <p className="blog-editor-hint">
                                Markdown: <code>##</code> heading, <code>**bold**</code>,{" "}
                                <code>*italic*</code>, <code>- list</code>,{" "}
                                <code>[text](url)</code>
                            </p>
                        </div>

                        {slug && (
                            <p className="blog-editor-hint">
                                Lives at <code>/blog/{slug}</code>
                                {post.publishedAt
                                    ? ` — published ${formatPostDate(post)}`
                                    : " once you publish it"}
                                . The address is fixed, so renaming the post won't break
                                links to it.
                            </p>
                        )}

                        {error && <p className="blog-editor-error">{error}</p>}
                    </div>
                )}

                <div className="blog-editor-foot">
                    {slug ? (
                        confirmDelete ? (
                            <div className="blog-delete-confirm">
                                <span>Delete for good?</span>
                                <button className="btn btn-danger" disabled={saving} onClick={remove}>
                                    Delete
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => setConfirmDelete(false)}
                                >
                                    Keep
                                </button>
                            </div>
                        ) : (
                            <button
                                className="btn btn-ghost blog-delete-btn"
                                onClick={() => setConfirmDelete(true)}
                            >
                                <Trash2 size={15} strokeWidth={2} />
                                Delete
                            </button>
                        )
                    ) : (
                        <span />
                    )}

                    <div className="blog-editor-actions">
                        <label className="blog-publish-toggle">
                            <input
                                type="checkbox"
                                checked={post.published}
                                onChange={(e) => update({ published: e.target.checked })}
                            />
                            <span>Published</span>
                        </label>
                        <button className="btn btn-secondary" onClick={requestClose}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            disabled={saving || loading || uploading}
                            onClick={save}
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
