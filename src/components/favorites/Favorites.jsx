import { Bookmark } from "lucide-react";
import { isHearted } from "../../lib/recipeUtils";
import FilteredRecipePage from "../explore/FilteredRecipePage";

export default function Favorites() {
    return (
        <FilteredRecipePage
            filterFn={isHearted}
            gateIcon={<Bookmark size={36} strokeWidth={1.6} />}
            gateTitle="Your saved recipes"
            gateDescription="Log in to save and revisit the recipes you love."
            pageTitle="Saved"
            pageSubtitle="Every recipe you've saved, in one place."
            emptyText="Nothing saved yet. Tap the bookmark on any recipe to keep it here."
        />
    );
}
