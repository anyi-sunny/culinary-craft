import React from 'react';
import { motion } from 'framer-motion';

const SplashTransition = ({ children }) => {
  return (
    <>
      {children}
      
      {/* The "Splash" Curtain */}
      <motion.div
        className="splash-curtain"
        initial={{ y: "100%" }}     // Start hidden at the bottom
        animate={{ y: "100%" }}     // Stay at bottom normally
        exit={{ y: "0%" }}          // Slide UP to cover screen when leaving
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
      
      {/* The "Reveal" Curtain (for the incoming page) */}
      <motion.div
        className="splash-curtain"
        initial={{ y: "0%" }}       // Start covering the screen
        animate={{ y: "-100%" }}    // Slide UP to reveal content
        transition={{ duration: 0.5, ease: "easeInOut", delay: 0.1 }} // Slight delay
      />
    </>
  );
};

export default SplashTransition;