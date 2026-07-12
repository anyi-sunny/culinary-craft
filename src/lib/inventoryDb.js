// Single source of truth for inventory operations via backend API
import * as apiClient from './inventoryApiClient';

export const PREDEFINED_CATEGORIES = [
    { id: 'produce', label: 'Produce' },
    { id: 'seasoning', label: 'Seasoning & Spices' },
    { id: 'baking', label: 'Baking Supplies' },
    { id: 'dairy', label: 'Dairy & Eggs' },
    { id: 'meat', label: 'Meat & Protein' },
    { id: 'pantry', label: 'Pantry Staples' },
    { id: 'appliances', label: 'Kitchen Appliances' },
    { id: 'tools', label: 'Kitchen Tools' },
];

/** Fetch all inventory items for a specific user. */
export async function fetchUserInventory(userId) {
    try {
        return await apiClient.fetchInventoryItems();
    } catch (err) {
        console.error('Error fetching user inventory:', err);
        return [];
    }
}

/** Fetch inventory items filtered by category. */
export async function fetchInventoryByCategory(userId, category) {
    try {
        const items = await apiClient.fetchInventoryItems();
        return items.filter(item => item.category === category);
    } catch (err) {
        console.error('Error fetching inventory by category:', err);
        return [];
    }
}

/** Add a new inventory item. */
export async function addInventoryItem(userId, item) {
    try {
        return await apiClient.addInventoryItem(
            item.name,
            item.category,
            item.quantity || '',
            item.unit || '',
            item.notes || ''
        );
    } catch (err) {
        console.error('Error adding inventory item:', err);
        throw err;
    }
}

/** Update an existing inventory item. */
export async function updateInventoryItem(userId, itemId, updates) {
    try {
        await apiClient.updateInventoryItem(
            itemId,
            updates.quantity !== undefined ? updates.quantity : null,
            updates.notes !== undefined ? updates.notes : null
        );
    } catch (err) {
        console.error('Error updating inventory item:', err);
        throw err;
    }
}

/** Delete an inventory item. */
export async function deleteInventoryItem(userId, itemId) {
    try {
        await apiClient.deleteInventoryItem(itemId);
    } catch (err) {
        console.error('Error deleting inventory item:', err);
        throw err;
    }
}

/** Fetch all user-created categories. */
export async function fetchUserCategories(userId) {
    try {
        const categories = await apiClient.fetchCategories();
        // Filter to only custom categories (not predefined)
        return categories.filter(cat => !cat.isPredefined);
    } catch (err) {
        console.error('Error fetching user categories:', err);
        return [];
    }
}

/** Add a custom category. */
export async function addCustomCategory(userId, category) {
    try {
        return await apiClient.addCategory(category.name, category.description || '');
    } catch (err) {
        console.error('Error adding custom category:', err);
        throw err;
    }
}

/** Delete a custom category. */
export async function deleteCustomCategory(userId, categoryId) {
    // Note: Backend doesn't support deleting categories yet, but the pattern is here for future use
    try {
        throw new Error("Category deletion not yet supported via API");
    } catch (err) {
        console.error('Error deleting custom category:', err);
        throw err;
    }
}
