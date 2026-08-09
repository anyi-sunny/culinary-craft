/**
 * Profile avatar options.
 *
 * Drop icon images into `public/profile-icons/` and list their filenames
 * here — the profile page's icon picker renders straight from this array.
 * Source icons are black on transparent; CSS (`filter: brightness(0)
 * invert(1)`) renders them white over the chosen background color.
 */
export const PROFILE_ICONS = [
    'bumblebee.png',
    'coffee.png',
    'drumstick.png',
    'icecream.png',
    'pasta.png',
    'pizza.png',
    'rice.png',
];

export const ICON_BG_COLORS = [
    '#b9663f', // copper (accent)
    '#8a4a2e', // deep copper
    '#d29268', // light copper
    '#5f7259', // sage
    '#4a5d6e', // slate blue
    '#7a6c5d', // taupe
    '#a97155', // caramel
    '#5e3523', // espresso
];

export const iconUrl = (filename) => `/profile-icons/${filename}`;
