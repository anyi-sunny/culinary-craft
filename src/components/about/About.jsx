import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import { usePageMeta } from "../../lib/usePageMeta";
import DeveloperStory from "./DeveloperStory";
import BlogList from "../blog/BlogList";
import "./About.css";
import "../blog/blog.css";

const TABS = [
    { key: "about", label: "About the Developer", path: "/about" },
    { key: "blog", label: "Blog", path: "/blog" },
];

const HEADINGS = {
    about: {
        title: "The Story Behind Culinary Craft",
        sub: "Why a (graduated!) college student's fridge turned into an app",
    },
    blog: {
        title: "From the Kitchen",
        sub: "Cooking notes, half-finished experiments, and how the app is coming along",
    },
};

const META = {
    about: {
        title: "About",
        description:
            "The story behind Culinary Craft — why a home cook built an AI recipe app, and the engineering underneath it.",
    },
    blog: {
        title: "Blog",
        description:
            "Notes from the kitchen — what I'm cooking, what I'm learning, and how Culinary Craft is coming along.",
    },
};

/**
 * The About page, in two tabs: the developer story and the blog.
 *
 * The tab lives in the URL (/about and /blog) rather than in state, so both
 * halves are linkable, prerenderable and back-button friendly. Both routes
 * render this same component, and AnimatedRoutes gives them a shared
 * animation key, so switching tabs doesn't replay the page crossfade.
 */
function About() {
    const navigate = useNavigate();
    const location = useLocation();
    const active = location.pathname.startsWith("/blog") ? "blog" : "about";

    usePageMeta(META[active]);

    return (
        <SplashTransition>
            <div className="page about-page">
                <TopNav />

                <div className="page-head">
                    <h1>{HEADINGS[active].title}</h1>
                    <p className="page-sub">{HEADINGS[active].sub}</p>
                </div>

                <div className="about-tabs" role="tablist">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            role="tab"
                            aria-selected={active === tab.key}
                            className={`about-tab${active === tab.key ? " active" : ""}`}
                            onClick={() => navigate(tab.path)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {active === "blog" ? <BlogList /> : <DeveloperStory />}
            </div>
        </SplashTransition>
    );
}

export default About;
