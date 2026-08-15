import React, { useMemo, useState } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import RecipeCarousel from "./RecipeCarousel";
import RecipeModal from "./modal/RecipeModal";
import { useRecipes } from "../../lib/useRecipes";
import { useAuthModal } from "../auth/authModalContext";
import { isOwner, isHearted, heartedByList, isPublished } from "../../lib/recipeUtils";
import { usePageMeta } from "../../lib/usePageMeta";
import "./Explore.css";

/**
 * Explore Recipes hub: carousel rows that preview each collection.
 * Featured surfaces the most-saved recipes; the remaining rows preview
 * All Recipes, Saved and My Recipes with links to their full pages.
 */
function ExploreHub() {
    usePageMeta({
        title: "Explore Recipes",
        description:
            "Browse featured and most-saved recipes created by the Culinary Craft community.",
    });
    const { user } = useAuthenticator((ctx) => [ctx.user]);
    const userId = user?.userId || null;
    const { requireLogin } = useAuthModal();
    const { recipes, loading, refresh, toggleHeart, togglePublish, removeRecipe } =
        useRecipes();

    // Card clicks open the recipe modal (like the Explore grid) instead of
    // jumping straight to the full page. Kept as an id so the modal always
    // renders the live copy of the recipe (hearts update in place).
    const [selectedId, setSelectedId] = useState(null);
    const selected = selectedId
        ? recipes.find((r) => r.recipeId === selectedId)
        : null;

    // Featured and All Recipes are public rows: they show published recipes
    // only, even though the fetch includes the viewer's own private ones.
    const publicRecipes = useMemo(() => recipes.filter(isPublished), [recipes]);

    const featured = useMemo(
        () =>
            [...publicRecipes].sort(
                (a, b) => heartedByList(b).length - heartedByList(a).length
            ),
        [publicRecipes]
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
                    onCardClick={(r) => setSelectedId(r.recipeId)}
                    onToggleHeart={handleHeart}
                />
                <RecipeCarousel
                    title="All Recipes"
                    recipes={publicRecipes}
                    loading={loading}
                    viewMorePath="/explore/all"
                    userId={userId}
                    onCardClick={(r) => setSelectedId(r.recipeId)}
                    onToggleHeart={handleHeart}
                />
                {userId && (
                    <>
                        <RecipeCarousel
                            title="Saved"
                            recipes={saved}
                            viewMorePath="/favorites"
                            userId={userId}
                            onCardClick={(r) => setSelectedId(r.recipeId)}
                            onToggleHeart={handleHeart}
                        />
                        <RecipeCarousel
                            title="My Recipes"
                            recipes={mine}
                            viewMorePath="/my-recipes"
                            userId={userId}
                            onCardClick={(r) => setSelectedId(r.recipeId)}
                            onToggleHeart={handleHeart}
                            onTogglePublish={togglePublish}
                        />
                    </>
                )}

                {selected && (
                    <RecipeModal
                        recipe={selected}
                        userId={userId}
                        onRequireLogin={requireLogin}
                        onToggleHeart={handleHeart}
                        onTogglePublish={togglePublish}
                        onDelete={(r, uid) => removeRecipe(r, uid)}
                        onClose={() => setSelectedId(null)}
                        onRefresh={() => {
                            refresh();
                            setSelectedId(null);
                        }}
                    />
                )}
            </div>
        </SplashTransition>
    );
}

export default ExploreHub;
