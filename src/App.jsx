import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Welcome from './components/Welcome';
import Chat from './components/chat/Chat';
import Explore from './components/explore/Explore';
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
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;