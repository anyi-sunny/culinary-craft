import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Settings2, NotebookPen } from "lucide-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import JsonLd from "../seo/JsonLd";
import { useProfile } from "../profile/profileContext";
import { usePageMeta, SITE_URL } from "../../lib/usePageMeta";
import { blogMetaDescription, blogPostJsonLd } from "../../lib/seo";
import { fetchBlogPost, fetchAdminBlogPost } from "../../lib/blogApiClient";
import BlogEditor from "./BlogEditor";
import { formatPostDate } from "./postDate";
import "./blog.css";

/**
 * One blog post, full page at /blog/:slug.
 *
 * Guests read published posts through the open endpoint. The author reads
 * through the admin endpoint instead, so an unpublished draft is previewable
 * at its real URL before it goes live.
 */
export default function BlogPost() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { profile, profileLoading } = useProfile();
    const isAdmin = Boolean(profile?.isAdmin);

    const [post, setPost] = useState(null);
    const [status, setStatus] = useState("loading"); // loading | ready | missing | error
    const [editing, setEditing] = useState(false);

    // Bumping this refetches; the effect below owns the actual request.
    const [fetchKey, setFetchKey] = useState(0);

    useEffect(() => {
        // Wait for the profile so an admin's first load already knows to use
        // the admin route — otherwise their own draft would flash "not found".
        if (profileLoading) return undefined;
        let cancelled = false;
        (async () => {
            try {
                // Admins go through the admin route so their own drafts
                // resolve; if that fails, the public read still applies.
                const loaded = isAdmin
                    ? await fetchAdminBlogPost(slug).catch(() => fetchBlogPost(slug))
                    : await fetchBlogPost(slug);
                if (cancelled) return;
                setPost(loaded);
                setStatus("ready");
            } catch (err) {
                if (!cancelled) setStatus(err.status === 404 ? "missing" : "error");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [slug, isAdmin, profileLoading, fetchKey]);

    const reload = () => {
        setStatus("loading");
        setFetchKey((k) => k + 1);
    };

    const canonical = `${SITE_URL}/blog/${slug}`;
    usePageMeta(
        status === "ready"
            ? {
                  title: post.title,
                  description: blogMetaDescription(post),
                  path: `/blog/${slug}`,
                  image: post.coverImage || undefined,
              }
            : { title: status === "missing" ? "Post Not Found" : null }
    );

    return (
        <SplashTransition>
            <div className="page blog-post-page">
                <TopNav />

                {status === "ready" && (
                    <JsonLd id="blog-jsonld" data={blogPostJsonLd(post, canonical)} />
                )}

                <div className="blog-post-shell">
                    <button className="blog-back" onClick={() => navigate("/blog")}>
                        <ArrowLeft size={16} strokeWidth={2.2} />
                        All posts
                    </button>

                    {status === "loading" && (
                        <div className="blog-post-card">
                            <p className="blog-editor-hint">Loading…</p>
                        </div>
                    )}

                    {status === "missing" && (
                        <div className="blog-empty blog-post-card">
                            <NotebookPen size={30} strokeWidth={1.5} />
                            <h3>This post isn't here</h3>
                            <p>It may have been removed, or the link may be wrong.</p>
                            <button className="btn btn-secondary" onClick={() => navigate("/blog")}>
                                Back to the blog
                            </button>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="blog-empty blog-post-card">
                            <p>Could not load this post just now.</p>
                            <button className="btn btn-secondary" onClick={reload}>
                                Try again
                            </button>
                        </div>
                    )}

                    {status === "ready" && (
                        <article className="blog-post-card">
                            {post.coverImage && (
                                <img
                                    src={post.coverImage}
                                    alt=""
                                    className="blog-post-cover"
                                />
                            )}

                            <div className="blog-post-inner">
                                <div className="blog-post-head">
                                    <div>
                                        {!post.published && (
                                            <span className="blog-post-draft">Draft preview</span>
                                        )}
                                        <h1>{post.title}</h1>
                                        <p className="blog-post-byline">
                                            {[formatPostDate(post), post.authorUsername]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            className="blog-post-edit"
                                            onClick={() => setEditing(true)}
                                        >
                                            <Settings2 size={16} strokeWidth={2} />
                                            Edit
                                        </button>
                                    )}
                                </div>

                                {post.subtitle && (
                                    <p className="blog-post-dek">{post.subtitle}</p>
                                )}

                                <div className="blog-body">
                                    <ReactMarkdown>{post.body || ""}</ReactMarkdown>
                                </div>
                            </div>
                        </article>
                    )}
                </div>

                {editing && (
                    <BlogEditor
                        slug={slug}
                        onClose={() => setEditing(false)}
                        onSaved={() => {
                            setEditing(false);
                            reload();
                        }}
                        onDeleted={() => {
                            setEditing(false);
                            navigate("/blog");
                        }}
                    />
                )}
            </div>
        </SplashTransition>
    );
}
