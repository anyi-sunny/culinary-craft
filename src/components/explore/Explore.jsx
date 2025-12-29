import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import { useNavigate } from 'react-router-dom';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import SplashTransition from '../SplashTransition';
import RecipeCard from './card/RecipeCard';
import RecipeModal from './modal/RecipeModal';
import './Explore.css';

const dbClient = new DynamoDBClient({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});
const docClient = DynamoDBDocumentClient.from(dbClient);

function Explore() {
    const navigate = useNavigate();
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // 1. Move fetchRecipes OUT of useEffect so it's a reusable function
    // We use useCallback so the function identity stays the same
    const fetchRecipes = useCallback(async () => {
        try {
        const command = new ScanCommand({
            TableName: "CulinaryCraftBackendStack-RecipesTable058A1F33-1GRXYSW38KE1I",
        });
        const response = await docClient.send(command);
        setRecipes(response.Items || []);
        } catch (err) {
        console.error("Error fetching recipes:", err);
        } finally {
        setLoading(false);
        }
    }, []);

    const filteredRecipes = recipes.filter(recipe => {
    const name = (recipe.recipe_name || recipe.title || "").toLowerCase();
    const ingredients = (recipe.ingredients || "").toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || ingredients.includes(searchQuery.toLowerCase());
    });

  // 2. Initial load
  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleDelete = async (recipe) => {
    const recipeName = recipe.recipe_name || recipe.title || "this recipe";
    const confirmed = window.confirm(`Are you sure you want to delete "${recipeName}"?`);
    
    if (confirmed) {
        try {
        const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
        const command = new DeleteCommand({
            TableName: "CulinaryCraftBackendStack-RecipesTable058A1F33-1GRXYSW38KE1I",
            Key: { recipeId: recipe.recipeId }
        });

        await docClient.send(command);
        // UI update so user doesn't have to wait for a refresh
        setRecipes(prev => prev.filter(r => r.recipeId !== recipe.recipeId));
        
        } catch (err) {
        console.error("Delete failed:", err);
        alert("Failed to delete recipe.");
        }
    }
  };

  return (
    <SplashTransition>
        <div className="explore-container">
            <header className="explore-header">
                <button onClick={() => navigate('/')} className="back-btn">← Home</button>
                <h1>Recipe Collection</h1>
                <div className="search-actions-container">
                    <div className="search-container">
                    <input
                        type="text"
                        placeholder="Search by name or ingredient..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button className="clear-search" onClick={() => setSearchQuery('')}>×</button>
                    )}
                    </div>

                    <button 
                    className="start-crafting-btn" 
                    onClick={() => navigate('/chat')}
                    >
                    Start Crafting
                    </button>
                </div>
            </header>

        <div className="recipe-grid">
            {loading ? (
                <p className="loading-text">Loading...</p>
            ) : filteredRecipes.length === 0 ? (
                <div className="empty-state">
                <p>{searchQuery ? "No matches found for your search." : "No recipes found."}</p>
                </div>
            ) : (
                filteredRecipes.map((recipe, index) => (
                <RecipeCard 
                    key={recipe.recipeId || index} 
                    recipe={recipe} 
                    onClick={() => setSelectedRecipe(recipe)}
                    onDelete={handleDelete} 
                />
                ))
            )}
        </div>

            {selectedRecipe && (
            <RecipeModal 
                recipe={selectedRecipe} 
                onClose={() => setSelectedRecipe(null)} 
                onRefresh={() => {
                fetchRecipes(); // Refresh the grid
                setSelectedRecipe(null); // Close the modal so they see the updated card
                }}
            />
            )}
        </div>
        </SplashTransition>
    );
}

export default Explore;