// Google AdSense configuration.
//
// The client ID identifies the AdSense account (sp-devs.com — subdomains are
// covered automatically). Each placement needs a real ad-unit slot ID created
// in AdSense → Ads → By ad unit → "Display ads"; until the placeholders below
// are replaced, the units simply render unfilled and the styled fallback shows.
//
// POLICY NOTE: never add copy that asks, hints, or thanks users for clicking
// ads ("click to support us", arrows pointing at ads, etc.). Google treats
// that as invalid click activity and permanently bans the account. Saying ads
// keep the site free is fine; soliciting clicks is not.
export const ADSENSE_CLIENT = "ca-pub-4507892303194666";

export const AD_SLOT_EXPLORE_CARD = "3186068518"; // "Explore Card" display unit
export const AD_SLOT_RECIPE_SAVED = "7603825674"; // "Recipe Saved" display unit

// How many recipe cards appear between ads in the Explore grid.
export const AD_CARD_INTERVAL = 6;
