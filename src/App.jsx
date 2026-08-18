import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Welcome from './components/Welcome';
import About from './components/about/About';
import BlogPost from './components/blog/BlogPost';
import Chat from './components/chat/Chat';
import UploadRecipe from './components/upload/UploadRecipe';
import Explore from './components/explore/Explore';
import ExploreHub from './components/explore/ExploreHub';
import RecipeDetail from './components/explore/RecipeDetail';
import MyRecipes from './components/myrecipes/MyRecipes';
import Favorites from './components/favorites/Favorites';
import Inventory from './components/inventory/Inventory';
import ShoppingList from './components/shopping/ShoppingList';
import Profile from './components/profile/Profile';
import PublicProfile from './components/profile/PublicProfile';
import { ProfileProvider } from './components/profile/ProfileProvider';
import Footer from './components/Footer';
import SmoothScroll from './components/SmoothScroll';
import { scrollToTop } from './lib/lenis';
import './App.css';

// We need a helper component to use the 'useLocation' hook
function AnimatedRoutes() {
  const location = useLocation();

  // /about and /blog are two tabs of the same page, so they share one
  // animation key: switching tabs re-renders in place instead of replaying
  // the full page crossfade (and, with no exit, without resetting scroll).
  const transitionKey =
    location.pathname === '/blog' ? '/about' : location.pathname;

  return (
    // mode="wait" tells it to finish the "exit" animation before starting the new "enter" one.
    // Resetting scroll in onExitComplete lands exactly between the fades, so
    // the jump to the top happens while no page is visible.
    <AnimatePresence mode="wait" onExitComplete={scrollToTop}>
      <Routes location={location} key={transitionKey}>
        <Route path="/" element={<Welcome />} />
        <Route path="/about" element={<About />} />
        <Route path="/blog" element={<About />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/upload-recipe" element={<UploadRecipe />} />
        <Route path="/explore" element={<ExploreHub />} />
        <Route path="/explore/all" element={<Explore />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/my-recipes" element={<MyRecipes />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/shopping-list" element={<ShoppingList />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/chef/:username" element={<PublicProfile />} />
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
