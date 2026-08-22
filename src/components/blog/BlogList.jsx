import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PenLine, NotebookPen } from "lucide-react";
import { useProfile } from "../profile/profileContext";
import { fetchBlogPosts, fetchAdminBlogPosts } from "../../lib/blogApiClient";
import BlogPostCard from "./BlogPostCard";
import BlogEditor from "./BlogEditor";

/**
 * The Blog tab on the About page: every published post as a card, newest
 * first. The author (and only the author) additionally sees drafts, a
 * "Write a post" button, and a settings button on each card — all of which
 * hang off `profile.isAdmin`, which the backend derives and re-checks on
 * every write.
 */
export default function BlogList() {
    const navigate = useNavigate();
    const { profile } = useProfile();
    const isAdmin = Boolean(profile?.isAdmin);

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    // null = closed, "new" = create, a slug = edit that post
    const [editing, setEditing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setPosts(isAdmin ? await fetchAdminBlogPosts() : await fetchBlogPosts());
        } catch (err) {
            console.error("Error loading blog posts:", err);
            setError("Could not load the blog just now. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="blog-content">
            {isAdmin && (
                <div className="blog-admin-bar">
                    <button className="btn btn-primary" onClick={() => setEditing("new")}>
                        <PenLine size={16} strokeWidth={2.2} />
                        Write a post
                    </button>
                </div>
            )}

            {loading ? (
                <div className="blog-grid">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div className="blog-card blog-card-skeleton" key={`skeleton-${i}`}>
                            <div className="blog-card-media" />
                            <div className="blog-card-body">
                                <span className="skeleton-line short" />
                                <span className="skeleton-line" />
                                <span className="skeleton-line" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="blog-empty fade-in">
                    <p>{error}</p>
                    <button className="btn btn-secondary" onClick={load}>
                        Try again
                    </button>
                </div>
            ) : posts.length === 0 ? (
                <div className="blog-empty fade-in">
                    <NotebookPen size={30} strokeWidth={1.5} />
                    <h3>No posts yet</h3>
                    <p>
                        {isAdmin
                            ? "Write the first one — it'll show up here as a card."
                            : "Nothing published yet. Check back soon for notes from the kitchen."}
                    </p>
                </div>
            ) : (
                <div className="blog-grid fade-in-stagger">
                    {posts.map((post) => (
                        <BlogPostCard
                            key={post.slug}
                            post={post}
                            onOpen={() => navigate(`/blog/${post.slug}`)}
                            onEdit={isAdmin ? () => setEditing(post.slug) : undefined}
                        />
                    ))}
                </div>
            )}

            {editing && (
                <BlogEditor
                    slug={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        load();
                    }}
                    onDeleted={() => {
                        setEditing(null);
                        load();
                    }}
                />
            )}
        </div>
    );
}
