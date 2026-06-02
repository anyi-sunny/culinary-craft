import React from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import RecipeGrid from "../explore/RecipeGrid";
import { useRecipes } from "../../lib/useRecipes";
import { useAuthModal } from "../auth/authModalContext";
import { isOwner } from "../../lib/recipeUtils";
import "../explore/Explore.css";

export default function MyRecipes() {
    const { authStatus, user } = useAuthenticator((ctx) => [ctx.authStatus, ctx.user]);
    const userId = user?.userId || null;
    const { requireLogin } = useAuthModal();
    const { recipes, loading, refresh, toggleHeart, removeRecipe } = useRecipes();

    const mine = recipes.filter((r) => isOwner(r, userId));

    return (
        <SplashTransition>
            <div className="page">
                <TopNav />
                {authStatus !== "authenticated" ? (
                    <div className="gate">
                        <div className="gate-emoji">📖</div>
                        <h2>Your recipe book</h2>
                        <p>Log in to see and edit the recipes you've created.</p>
                        <button className="btn btn-primary" onClick={requireLogin}>
                            Log in
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="page-head">
                            <h1>My Recipes</h1>
                            <p className="page-sub">
                                Recipes you've created. Only you can edit or delete these.
                            </p>
                        </div>
                        <RecipeGrid
                            recipes={mine}
                            loading={loading}
                            userId={userId}
                            onRequireLogin={requireLogin}
                            onToggleHeart={(r) => toggleHeart(r, userId)}
                            onDelete={removeRecipe}
                            onRefresh={refresh}
                            emptyText="You haven't created any recipes yet. Start crafting!"
                        />
                    </>
                )}
            </div>
        </SplashTransition>
    );
}
