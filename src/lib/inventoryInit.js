// Initialize predefined categories for a user
import * as apiClient from './inventoryApiClient';

/**
 * Check if user has already initialized their categories
 */
export async function hasUserCategories(_userId) {
    try {
        const categories = await apiClient.fetchCategories();
        return categories && categories.length > 0;
    } catch (err) {
        console.error('Error checking user categories:', err);
        return false;
    }
}

/**
 * Seed predefined categories for a new user (idempotent)
 */
export async function initializeUserCategories(userId) {
    try {
        const hasCategories = await hasUserCategories(userId);
        if (hasCategories) {
            console.log('Categories already initialized for user:', userId);
            return;
        }

        console.log('Initializing predefined categories for user:', userId);
        await apiClient.initializeCategories();
        console.log('Successfully initialized predefined categories');
    } catch (err) {
        console.error('Error initializing categories:', err);
        // Don't throw - this is non-critical initialization
    }
}
