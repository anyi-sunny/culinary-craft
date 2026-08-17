import React from "react";
import { motion } from "framer-motion";
import { Settings2, ArrowRight } from "lucide-react";
import { getPlaceholderGradient } from "../../lib/imageUtils";
import { formatPostDate } from "./postDate";

/**
 * One post in the blog grid. Clicking anywhere opens the full post; the
 * settings button (admin only) opens the editor instead, so it has to stop
 * the click from reaching the card.
 */
export default function BlogPostCard({ post, onOpen, onEdit }) {
    const date = formatPostDate(post);

    return (
        <motion.article
            className="blog-card"
            whileHover={{ y: -6 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={onOpen}
        >
            <div
                className="blog-card-media"
                style={
                    post.coverImage
                        ? undefined
                        : { background: getPlaceholderGradient(post.slug) }
                }
            >
                {post.coverImage ? (
                    <img src={post.coverImage} alt="" className="blog-card-img" />
                ) : (
                    <span className="blog-card-monogram">
                        {(post.title || "?").trim().charAt(0).toUpperCase()}
                    </span>
                )}

                {!post.published && <span className="blog-card-draft">Draft</span>}

                {onEdit && (
                    <button
                        className="blog-card-settings"
                        aria-label={`Edit ${post.title}`}
                        title="Edit this post"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                    >
                        <Settings2 size={16} strokeWidth={2} />
                    </button>
                )}
            </div>

            <div className="blog-card-body">
                {date && <p className="blog-card-date">{date}</p>}
                <h3 className="blog-card-title">{post.title}</h3>
                {post.excerpt && <p className="blog-card-excerpt">{post.excerpt}</p>}
                <span className="blog-card-more">
                    Read post
                    <ArrowRight size={15} strokeWidth={2.2} />
                </span>
            </div>
        </motion.article>
    );
}
