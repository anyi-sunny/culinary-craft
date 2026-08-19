// Curated common-kitchen staples for the "Add Suggested Items" modal.
// Icons come from @tabler/icons-react (stroke style matches lucide, which the
// rest of the app uses). Tabler has no icon for some foods, so a few entries
// borrow the closest visual match; CATEGORY_FALLBACK_ICONS covers anything
// left without one.
import {
    IconApple,
    IconAvocado,
    IconBanana,
    IconBottle,
    IconBowl,
    IconBowlSpoon,
    IconBread,
    IconCarrot,
    IconCheese,
    IconCoffee,
    IconCookie,
    IconCube,
    IconDroplet,
    IconEgg,
    IconFish,
    IconFlask,
    IconGrain,
    IconLeaf,
    IconLemon,
    IconMeat,
    IconMilk,
    IconMushroom,
    IconPackage,
    IconPepper,
    IconPlant,
    IconSalad,
    IconSalt,
    IconSausage,
    IconSeedling,
    IconSoup,
    IconWheat,
} from '@tabler/icons-react';

export const CATEGORY_FALLBACK_ICONS = {
    produce: IconSalad,
    seasoning: IconSalt,
    baking: IconWheat,
    dairy: IconMilk,
    meat: IconMeat,
    pantry: IconPackage,
};

export const SUGGESTED_ITEMS = [
    // Produce
    { name: 'Garlic', category: 'produce', icon: IconSeedling },
    { name: 'Yellow Onions', category: 'produce', icon: IconPlant },
    { name: 'Tomatoes', category: 'produce', icon: IconApple },
    { name: 'Potatoes', category: 'produce', icon: IconAvocado },
    { name: 'Carrots', category: 'produce', icon: IconCarrot },
    { name: 'Lemons', category: 'produce', icon: IconLemon },
    { name: 'Bananas', category: 'produce', icon: IconBanana },
    { name: 'Leafy Greens', category: 'produce', icon: IconSalad },
    { name: 'Mushrooms', category: 'produce', icon: IconMushroom },
    { name: 'Fresh Herbs', category: 'produce', icon: IconLeaf },

    // Seasoning & Spices
    { name: 'Salt', category: 'seasoning', icon: IconSalt },
    { name: 'Black Pepper', category: 'seasoning', icon: IconPepper },
    { name: 'Garlic Powder', category: 'seasoning', icon: IconSeedling },
    { name: 'Onion Powder', category: 'seasoning', icon: IconPlant },
    { name: 'Paprika', category: 'seasoning', icon: IconPepper },
    { name: 'Ground Cumin', category: 'seasoning', icon: IconFlask },
    { name: 'Chili Powder', category: 'seasoning', icon: IconPepper },
    { name: 'Dried Oregano', category: 'seasoning', icon: IconLeaf },
    { name: 'Ground Cinnamon', category: 'seasoning', icon: IconFlask },
    { name: 'Bay Leaves', category: 'seasoning', icon: IconLeaf },

    // Baking Supplies
    { name: 'All-Purpose Flour', category: 'baking', icon: IconWheat },
    { name: 'Granulated Sugar', category: 'baking', icon: IconCube },
    { name: 'Brown Sugar', category: 'baking', icon: IconCube },
    { name: 'Baking Powder', category: 'baking', icon: IconFlask },
    { name: 'Baking Soda', category: 'baking', icon: IconFlask },
    { name: 'Vanilla Extract', category: 'baking', icon: IconDroplet },
    { name: 'Chocolate Chips', category: 'baking', icon: IconCookie },
    { name: 'Honey', category: 'baking', icon: IconDroplet },

    // Dairy & Eggs
    { name: 'Eggs', category: 'dairy', icon: IconEgg },
    { name: 'Milk', category: 'dairy', icon: IconMilk },
    { name: 'Butter', category: 'dairy', icon: IconPackage },
    { name: 'Cheddar Cheese', category: 'dairy', icon: IconCheese },
    { name: 'Parmesan Cheese', category: 'dairy', icon: IconCheese },
    { name: 'Greek Yogurt', category: 'dairy', icon: IconBowl },
    { name: 'Heavy Cream', category: 'dairy', icon: IconBottle },
    { name: 'Cream Cheese', category: 'dairy', icon: IconCheese },

    // Meat & Protein
    { name: 'Chicken Breast', category: 'meat', icon: IconMeat },
    { name: 'Ground Beef', category: 'meat', icon: IconMeat },
    { name: 'Bacon', category: 'meat', icon: IconSausage },
    { name: 'Sausage', category: 'meat', icon: IconSausage },
    { name: 'Salmon', category: 'meat', icon: IconFish },
    { name: 'Shrimp', category: 'meat', icon: IconFish },
    { name: 'Tofu', category: 'meat', icon: IconCube },
    { name: 'Canned Tuna', category: 'meat', icon: IconFish },

    // Pantry Staples
    { name: 'Olive Oil', category: 'pantry', icon: IconBottle },
    { name: 'Vegetable Oil', category: 'pantry', icon: IconBottle },
    { name: 'White Rice', category: 'pantry', icon: IconGrain },
    { name: 'Pasta', category: 'pantry', icon: IconBowlSpoon },
    { name: 'Bread', category: 'pantry', icon: IconBread },
    { name: 'Chicken Stock', category: 'pantry', icon: IconSoup },
    { name: 'Canned Tomatoes', category: 'pantry', icon: IconPackage },
    { name: 'Soy Sauce', category: 'pantry', icon: IconBottle },
    { name: 'Vinegar', category: 'pantry', icon: IconFlask },
    { name: 'Rolled Oats', category: 'pantry', icon: IconWheat },
    { name: 'Peanut Butter', category: 'pantry', icon: IconPackage },
    { name: 'Coffee', category: 'pantry', icon: IconCoffee },
];
