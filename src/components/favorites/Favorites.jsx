import React from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import RecipeGrid from "../explore/RecipeGrid";
import { useRecipes } from "../../lib/useRecipes";
import { useAuthModal } from "../auth/authModalContext";
import { isHearted } from "../../lib/recipeUtils";
import "../explore/Explore.css";

export default function Favorites() {
    const { authStatus, user } = useAuthenticator((ctx) => [ctx.authStatus, ctx.user]);
    const userId = user?.userId || null;
    const { requireLogin } = useAuthModal();
    const { recipes, loading, refresh, toggleHeart, removeRecipe } = useRecipes();

    const favorites = recipes.filter((r) => isHearted(r, userId));

    return (
        <SplashTransition>
            <div className="page">
                <TopNav />
                {authStatus !== "authenticated" ? (
                    <div className="gate">
                        <div className="gate-emoji">❤️</div>
                        <h2>Your favorites</h2>
                        <p>Log in to save and revisit the recipes you love.</p>
                        <button className="btn btn-primary" onClick={requireLogin}>
                            Log in
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="page-head">
                            <h1>Favorites</h1>
                            <p className="page-sub">Every recipe you've hearted, in one place.</p>
                        </div>
                        <RecipeGrid
                            recipes={favorites}
                            loading={loading}
                            userId={userId}
                            onRequireLogin={requireLogin}
                            onToggleHeart={(r) => toggleHeart(r, userId)}
                            onDelete={removeRecipe}
                            onRefresh={refresh}
                            emptyText="No favorites yet. Tap the heart on any recipe to save it here."
                        />
                    </>
                )}
            </div>
        </SplashTransition>
    );
}
