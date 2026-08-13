import { BookOpen } from "lucide-react";
import { isOwner } from "../../lib/recipeUtils";
import FilteredRecipePage from "../explore/FilteredRecipePage";

export default function MyRecipes() {
    return (
        <FilteredRecipePage
            filterFn={isOwner}
            gateIcon={<BookOpen size={36} strokeWidth={1.6} />}
            gateTitle="Your recipe book"
            gateDescription="Log in to see and edit the recipes you've created."
            pageTitle="My Creations"
            pageSubtitle="Recipes you've created. Only you can edit or delete these — publish one to share it on Explore."
            emptyText="You haven't created any recipes yet. Start crafting!"
        />
    );
}
