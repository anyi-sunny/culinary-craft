import React from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import RecipeGrid from "./RecipeGrid";
import { useRecipes } from "../../lib/useRecipes";
import { useAuthModal } from "../auth/authModalContext";
import "./Explore.css";

function Explore() {
    const { user } = useAuthenticator((ctx) => [ctx.user]);
    const userId = user?.userId || null;
    const { requireLogin } = useAuthModal();
    const { recipes, loading, refresh, toggleHeart, removeRecipe } = useRecipes();

    return (
        <SplashTransition>
            <div className="page">
                <TopNav />
                <div className="page-head">
                    <h1>Recipe Collection</h1>
                    <p className="page-sub">
                        Browse every creation — heart your favorites or remix any recipe with AI.
                    </p>
                </div>

                <RecipeGrid
                    recipes={recipes}
                    loading={loading}
                    userId={userId}
                    onRequireLogin={requireLogin}
                    onToggleHeart={(r) => toggleHeart(r, userId)}
                    onDelete={(r, uid) => removeRecipe(r, uid)}
                    onRefresh={refresh}
                    emptyText="No recipes yet. Start crafting one!"
                />
            </div>
        </SplashTransition>
    );
}

export default Explore;
