import React, { useMemo } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import RecipeGrid from "./RecipeGrid";
import { useRecipes } from "../../lib/useRecipes";
import { useAuthModal } from "../auth/authModalContext";
import { isPublished } from "../../lib/recipeUtils";
import "./Explore.css";

function Explore() {
    const { user } = useAuthenticator((ctx) => [ctx.user]);
    const userId = user?.userId || null;
    const { requireLogin } = useAuthModal();
    const { recipes, loading, refresh, toggleHeart, togglePublish, removeRecipe } = useRecipes();

    // The fetch also returns the caller's own unpublished recipes (for My
    // Creations); Explore only ever shows what's been published.
    const published = useMemo(() => recipes.filter(isPublished), [recipes]);

    return (
        <SplashTransition>
            <div className="page">
                <TopNav />
                <div className="page-head">
                    <h1>All Recipes</h1>
                    <p className="page-sub">
                        Browse creations from all users — save the ones you love or remix any recipe with AI.
                    </p>
                </div>

                <RecipeGrid
                    recipes={published}
                    loading={loading}
                    userId={userId}
                    onRequireLogin={requireLogin}
                    onToggleHeart={(r) => toggleHeart(r, userId)}
                    onTogglePublish={togglePublish}
                    onDelete={(r, uid) => removeRecipe(r, uid)}
                    onRefresh={refresh}
                    emptyText="No recipes yet. Start crafting one!"
                    showAds
                />
            </div>
        </SplashTransition>
    );
}

export default Explore;
