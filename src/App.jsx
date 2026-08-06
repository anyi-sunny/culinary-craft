import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Welcome from './components/Welcome';
import Chat from './components/chat/Chat';
import Explore from './components/explore/Explore';
import RecipeDetail from './components/explore/RecipeDetail';
import MyRecipes from './components/myrecipes/MyRecipes';
import Favorites from './components/favorites/Favorites';
import Inventory from './components/inventory/Inventory';
import ShoppingList from './components/shopping/ShoppingList';
import Footer from './components/Footer';
import SmoothScroll from './components/SmoothScroll';
import './App.css';

// We need a helper component to use the 'useLocation' hook
function AnimatedRoutes() {
  const location = useLocation();

  return (
    // mode="wait" tells it to finish the "exit" animation before starting the new "enter" one
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Welcome />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/my-recipes" element={<MyRecipes />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/shopping-list" element={<ShoppingList />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <SmoothScroll>
        <AnimatedRoutes />
        <Footer />
      </SmoothScroll>
    </Router>
  );
}

export default App;
