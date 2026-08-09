import React, { useMemo } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import RecipeCarousel from "./RecipeCarousel";
import { useRecipes } from "../../lib/useRecipes";
import { useAuthModal } from "../auth/authModalContext";
import { isOwner, isHearted, heartedByList } from "../../lib/recipeUtils";
import "./Explore.css";

/**
 * Explore Recipes hub: carousel rows that preview each collection.
 * Featured surfaces the most-saved recipes; the remaining rows preview
 * All Recipes, Saved and My Recipes with links to their full pages.
 */
function ExploreHub() {
    const { user } = useAuthenticator((ctx) => [ctx.user]);
    const userId = user?.userId || null;
    const { requireLogin } = useAuthModal();
    const { recipes, loading, toggleHeart } = useRecipes();

    const featured = useMemo(
        () =>
            [...recipes].sort(
                (a, b) => heartedByList(b).length - heartedByList(a).length
            ),
        [recipes]
    );
    const saved = useMemo(
        () => recipes.filter((r) => isHearted(r, userId)),
        [recipes, userId]
    );
    const mine = useMemo(
        () => recipes.filter((r) => isOwner(r, userId)),
        [recipes, userId]
    );

    const handleHeart = (recipe) => {
        if (!userId) {
            requireLogin();
            return;
        }
        toggleHeart(recipe, userId);
    };

    return (
        <SplashTransition>
            <div className="page explore-hub-page">
                <TopNav />
                <div className="page-head">
                    <h1>Explore Recipes</h1>
                    <p className="page-sub">
                        A taste of everything — dive into any collection for the full spread.
                    </p>
                </div>

                <RecipeCarousel
                    title="Featured"
                    recipes={featured}
                    loading={loading}
                    viewMorePath="/explore/all"
                    userId={userId}
                    onToggleHeart={handleHeart}
                />
                <RecipeCarousel
                    title="All Recipes"
                    recipes={recipes}
                    loading={loading}
                    viewMorePath="/explore/all"
                    userId={userId}
                    onToggleHeart={handleHeart}
                />
                {userId && (
                    <>
                        <RecipeCarousel
                            title="Saved"
                            recipes={saved}
                            viewMorePath="/favorites"
                            userId={userId}
                            onToggleHeart={handleHeart}
                        />
                        <RecipeCarousel
                            title="My Recipes"
                            recipes={mine}
                            viewMorePath="/my-recipes"
                            userId={userId}
                            onToggleHeart={handleHeart}
                        />
                    </>
                )}
            </div>
        </SplashTransition>
    );
}

export default ExploreHub;
