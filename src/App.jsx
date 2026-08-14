import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Welcome from './components/Welcome';
import About from './components/about/About';
import Chat from './components/chat/Chat';
import Explore from './components/explore/Explore';
import ExploreHub from './components/explore/ExploreHub';
import RecipeDetail from './components/explore/RecipeDetail';
import MyRecipes from './components/myrecipes/MyRecipes';
import Favorites from './components/favorites/Favorites';
import Inventory from './components/inventory/Inventory';
import ShoppingList from './components/shopping/ShoppingList';
import Profile from './components/profile/Profile';
import { ProfileProvider } from './components/profile/ProfileProvider';
import Footer from './components/Footer';
import SmoothScroll from './components/SmoothScroll';
import { scrollToTop } from './lib/lenis';
import './App.css';

// We need a helper component to use the 'useLocation' hook
function AnimatedRoutes() {
  const location = useLocation();

  return (
    // mode="wait" tells it to finish the "exit" animation before starting the new "enter" one.
    // Resetting scroll in onExitComplete lands exactly between the fades, so
    // the jump to the top happens while no page is visible.
    <AnimatePresence mode="wait" onExitComplete={scrollToTop}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Welcome />} />
        <Route path="/about" element={<About />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/explore" element={<ExploreHub />} />
        <Route path="/explore/all" element={<Explore />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/my-recipes" element={<MyRecipes />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/shopping-list" element={<ShoppingList />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <ProfileProvider>
        <SmoothScroll>
          <AnimatedRoutes />
          <Footer />
        </SmoothScroll>
      </ProfileProvider>
    </Router>
  );
}

export default App;
