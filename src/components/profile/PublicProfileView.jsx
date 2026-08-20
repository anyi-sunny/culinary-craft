import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthenticator } from "@aws-amplify/ui-react";
import RecipeCard from "../explore/card/RecipeCard";
import AdCard from "../ads/AdCard";
import { useRecipes } from "../../lib/useRecipes";
import { useAuthModal } from "../auth/authModalContext";
import { heartedByList, isPublished, recipePath } from "../../lib/recipeUtils";
import { ICON_BG_COLORS, iconUrl } from "../../lib/profileIcons";
import "../explore/Explore.css"; // .recipe-grid
import "./profile.css";

const memberSince = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

/**
 * What a chef's profile looks like to everyone else: avatar, username and
 * stats only (never email or real name), with their five most-saved published
 * recipes below — recipes nobody has saved yet stay off the list entirely.
 * Rendered by the public /chef/:username page and by the "Public Preview"
 * tab on the owner's own profile.
 */
export default function PublicProfileView({ profile }) {
    const navigate = useNavigate();
    const { user } = useAuthenticator((ctx) => [ctx.user]);
    const viewerId = user?.userId || null;
    const { requireLogin } = useAuthModal();
    const { recipes, loading, toggleHeart } = useRecipes();

    const chefId = profile?.userId;

    const publishedByChef = useMemo(
        () => recipes.filter((r) => r.ownerId === chefId && isPublished(r)),
        [recipes, chefId]
    );

    // Top five by save count; recipes with zero saves never make the cut.
    const topSaved = useMemo(
        () =>
            publishedByChef
                .filter((r) => heartedByList(r).length > 0)
                .sort((a, b) => heartedByList(b).length - heartedByList(a).length)
                .slice(0, 5),
        [publishedByChef]
    );

    const savesReceived = publishedByChef.reduce(
        (sum, r) => sum + heartedByList(r).length,
        0
    );

    const handleHeart = (recipe) => {
        if (!viewerId) {
            requireLogin();
            return;
        }
        toggleHeart(recipe, viewerId);
    };

    const bg = profile?.iconBg || ICON_BG_COLORS[0];
    const monogram = (profile?.username || "C").trim().charAt(0).toUpperCase();

    return (
        <div className="public-profile">
            {/* Public chef card — username and stats only */}
            <section className="profile-card profile-card--public">
                <div className="profile-avatar" style={{ background: bg }}>
                    {profile?.icon ? (
                        <img src={iconUrl(profile.icon)} alt="" />
                    ) : (
                        <span className="profile-avatar-monogram">{monogram}</span>
                    )}
                </div>
                <p className="profile-card-username">@{profile?.username}</p>

                <div className="profile-stats">
                    <div className="profile-stat">
                        <span className="profile-stat-value">{publishedByChef.length}</span>
                        <span className="profile-stat-label">Recipes shared</span>
                    </div>
                    <div className="profile-stat">
                        <span className="profile-stat-value">{savesReceived}</span>
                        <span className="profile-stat-label">Saves</span>
                    </div>
                </div>
                <p className="public-profile-member">
                    Member since {memberSince(profile?.createdAt)}
                </p>
            </section>

            {/* Their five most-saved recipes (plus a supporting ad). When no
                recipe has a save yet, only the ad shows — no empty-state
                filler on someone's public page. */}
            {topSaved.length > 0 && (
                <h2 className="public-profile-heading">Most Saved Recipes</h2>
            )}
            {!loading && (
                <div className="recipe-grid public-profile-grid">
                    {topSaved.map((recipe) => (
                        <RecipeCard
                            key={recipe.recipeId}
                            recipe={recipe}
                            userId={viewerId}
                            onClick={() => navigate(recipePath(recipe))}
                            onToggleHeart={handleHeart}
                        />
                    ))}
                    <AdCard />
                </div>
            )}
        </div>
    );
}
