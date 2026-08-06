import React from 'react';
import { motion } from 'framer-motion';

/**
 * Soft page fade between routes. Replaces the old sliding splash curtain —
 * the page simply dissolves through the cream background, which reads
 * calmer with the smooth-scroll feel of the app.
 */
const SplashTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

export default SplashTransition;
