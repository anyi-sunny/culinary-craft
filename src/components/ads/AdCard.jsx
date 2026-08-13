import React from "react";
import AdUnit from "./AdUnit";
import { AD_SLOT_EXPLORE_CARD } from "../../lib/ads";
import "./AdCard.css";

/**
 * An ad slotted into the Explore grid with the same silhouette as a recipe
 * card: the ad fills the media area and the body carries a short supporter
 * note. Deliberately NOT clickable as a card (no onClick, no hover lift) —
 * the only interactive surface is the ad itself, and the "Advertisement"
 * label keeps it clearly distinguishable from recipes, both of which AdSense
 * policy requires.
 */
export default function AdCard() {
    return (
        <article className="recipe-card ad-card">
            <div className="card-media ad-card-media">
                <AdUnit slot={AD_SLOT_EXPLORE_CARD} />
                <span className="ad-card-label">Advertisement</span>
            </div>
            <div className="card-body">
                <h3 className="card-title ad-card-title">
                    This ad keeps Culinary Craft free!
                </h3>
                <p className="ad-card-note">
                    Ads here are selected and vetted by Google. They help cover the
                    costs of running this site so it stays free for everyone.
                    <span className="ad-card-signoff">
                        — sincerely, a recent postgrad
                    </span>
                </p>
            </div>
        </article>
    );
}
