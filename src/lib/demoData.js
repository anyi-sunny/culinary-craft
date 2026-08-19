// Example data behind the logged-out previews of the gated pages
// (Create Recipe, Inventory, Shopping List). Purely presentational —
// nothing here is ever written to the backend.

// Inventory preview: a believable, well-stocked kitchen spread across
// every predefined category so the grouped-chip layout reads at a glance.
export const DEMO_INVENTORY_ITEMS = [
    { itemId: 'demo-prod-1', name: 'Roma Tomatoes', category: 'produce', quantity: '6', unit: '' },
    { itemId: 'demo-prod-2', name: 'Baby Spinach', category: 'produce', quantity: '1', unit: 'bag' },
    { itemId: 'demo-prod-3', name: 'Garlic', category: 'produce', quantity: '2', unit: 'heads' },
    { itemId: 'demo-prod-4', name: 'Lemons', category: 'produce', quantity: '3', unit: '' },
    { itemId: 'demo-seas-1', name: 'Smoked Paprika', category: 'seasoning', quantity: '', unit: '' },
    { itemId: 'demo-seas-2', name: 'Ground Cumin', category: 'seasoning', quantity: '', unit: '' },
    { itemId: 'demo-seas-3', name: 'Fresh Thyme', category: 'seasoning', quantity: '1', unit: 'bunch' },
    { itemId: 'demo-bake-1', name: 'All-Purpose Flour', category: 'baking', quantity: '2', unit: 'kg' },
    { itemId: 'demo-bake-2', name: 'Brown Sugar', category: 'baking', quantity: '500', unit: 'g' },
    { itemId: 'demo-bake-3', name: 'Vanilla Extract', category: 'baking', quantity: '', unit: '' },
    { itemId: 'demo-dair-1', name: 'Unsalted Butter', category: 'dairy', quantity: '250', unit: 'g' },
    { itemId: 'demo-dair-2', name: 'Parmesan', category: 'dairy', quantity: '1', unit: 'wedge' },
    { itemId: 'demo-dair-3', name: 'Large Eggs', category: 'dairy', quantity: '12', unit: '' },
    { itemId: 'demo-meat-1', name: 'Chicken Thighs', category: 'meat', quantity: '1.5', unit: 'lbs' },
    { itemId: 'demo-meat-2', name: 'Salmon Fillets', category: 'meat', quantity: '2', unit: '' },
    { itemId: 'demo-pant-1', name: 'Arborio Rice', category: 'pantry', quantity: '1', unit: 'kg' },
    { itemId: 'demo-pant-2', name: 'Olive Oil', category: 'pantry', quantity: '', unit: '' },
    { itemId: 'demo-pant-3', name: 'Canned Chickpeas', category: 'pantry', quantity: '2', unit: 'cans' },
];

// Shopping list preview: shows the recipe linkage the feature is built
// around — single-recipe items, a shared item pulled by two recipes,
// an unlinked "other" item, and a couple already checked off so the
// progress bar has something to show.
export const DEMO_SHOPPING_LIST = [
    {
        id: 'demo-shop-1', name: 'Salmon fillets', quantity: '2', unit: '',
        isLinked: true, linkedRecipes: [{ name: 'Honey Garlic Salmon' }],
        checked: false, addedToInventory: false,
    },
    {
        id: 'demo-shop-2', name: 'Fresh ginger', quantity: '1', unit: 'knob',
        isLinked: true, linkedRecipes: [{ name: 'Honey Garlic Salmon' }],
        checked: true, addedToInventory: false,
    },
    {
        id: 'demo-shop-3', name: 'Heavy cream', quantity: '1', unit: 'cup',
        isLinked: true,
        linkedRecipes: [{ name: 'Creamy Tuscan Chicken' }, { name: 'Mushroom Alfredo' }],
        checked: false, addedToInventory: false,
    },
    {
        id: 'demo-shop-4', name: 'Arborio rice', quantity: '1', unit: 'kg',
        isLinked: true, linkedRecipes: [{ name: 'Lemon Risotto' }],
        checked: false, addedToInventory: false,
    },
    {
        id: 'demo-shop-5', name: 'Sun-dried tomatoes', quantity: '1', unit: 'jar',
        isLinked: true, linkedRecipes: [{ name: 'Creamy Tuscan Chicken' }],
        checked: true, addedToInventory: false,
    },
    {
        id: 'demo-shop-6', name: 'Paper towels', quantity: '', unit: '',
        isLinked: false, checked: false, addedToInventory: false,
    },
];

// Create Recipe preview: a short example conversation showing the
// describe-then-refine loop the chat is built around.
export const DEMO_CHAT_MESSAGES = [
    {
        role: 'user',
        content: "I've got salmon fillets and a bag of spinach. Something cozy for dinner tonight?",
    },
    {
        role: 'assistant',
        content: `Cozy it is. Here's what I'd make:

## Lemon Butter Salmon over Wilted Spinach

**Ingredients**
- 2 salmon fillets
- 1 bag baby spinach
- 3 tbsp unsalted butter
- 1 lemon (zest + juice)
- 2 cloves garlic, minced
- Salt and black pepper

**Instructions**
1. Pat the salmon dry and season generously with salt and pepper.
2. Sear skin-side down in 1 tbsp butter over medium-high heat, 4 minutes. Flip and cook 2 minutes more.
3. Rest the salmon; in the same pan, melt the remaining butter with the garlic, then wilt the spinach.
4. Finish with lemon zest and juice, and serve the salmon over the greens.

Want me to make it dairy-free, or add a starchy side to round it out?`,
    },
    {
        role: 'user',
        content: 'Can you make it dairy-free and add a side?',
    },
    {
        role: 'assistant',
        content: `Easy swap — olive oil browns beautifully in place of the butter, and a quick garlic couscous cooks in the time the salmon rests.

I've updated the recipe: **olive oil** replaces the butter throughout, and a new **Garlic Couscous** component joins the dish (couscous, hot water, olive oil, a pinch of cumin — fluffed with a fork after 5 minutes).

When it looks right to you, hit the green **Save** button and it goes straight into My Creations.`,
    },
];
