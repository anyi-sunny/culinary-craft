import { isHearted } from "../../lib/recipeUtils";
import FilteredRecipePage from "../explore/FilteredRecipePage";

export default function Favorites() {
    return (
        <FilteredRecipePage
            filterFn={isHearted}
            gateEmoji="❤️"
            gateTitle="Your favorites"
            gateDescription="Log in to save and revisit the recipes you love."
            pageTitle="Favorites"
            pageSubtitle="Every recipe you've hearted, in one place."
            emptyText="No favorites yet. Tap the heart on any recipe to save it here."
        />
    );
}
