import React from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import SplashTransition from "../SplashTransition";
import TopNav from "../nav/TopNav";
import RecipeGrid from "./RecipeGrid";
import { useRecipes } from "../../lib/useRecipes";
import { useAuthModal } from "../auth/authModalContext";
import "./Explore.css";

/**
 * Reusable filtered recipe page component for MyRecipes, Favorites, etc.
 * Accepts filter function and UI configuration as props to avoid duplication.
 */
export default function FilteredRecipePage({
  filterFn,
  gateEmoji,
  gateTitle,
  gateDescription,
  pageTitle,
  pageSubtitle,
  emptyText,
}) {
  const { authStatus, user } = useAuthenticator((ctx) => [ctx.authStatus, ctx.user]);
  const userId = user?.userId || null;
  const { requireLogin } = useAuthModal();
  const { recipes, loading, refresh, toggleHeart, removeRecipe } = useRecipes();

  const filtered = recipes.filter((r) => filterFn(r, userId));

  return (
    <SplashTransition>
      <div className="page">
        <TopNav />
        {authStatus !== "authenticated" ? (
          <div className="gate">
            <div className="gate-emoji">{gateEmoji}</div>
            <h2>{gateTitle}</h2>
            <p>{gateDescription}</p>
            <button className="btn btn-primary" onClick={requireLogin}>
              Log in
            </button>
          </div>
        ) : (
          <>
            <div className="page-head">
              <h1>{pageTitle}</h1>
              <p className="page-sub">{pageSubtitle}</p>
            </div>
            <RecipeGrid
              recipes={filtered}
              loading={loading}
              userId={userId}
              onRequireLogin={requireLogin}
              onToggleHeart={(r) => toggleHeart(r, userId)}
              onDelete={(r, uid) => removeRecipe(r, uid)}
              onRefresh={refresh}
              emptyText={emptyText}
            />
          </>
        )}
      </div>
    </SplashTransition>
  );
}
