import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import TopNav from './nav/TopNav';
import FeatureShowcase from './FeatureShowcase';
import './../App.css';
import './Welcome.css';
import SplashTransition from './SplashTransition';

function Welcome() {
  const navigate = useNavigate();

  return (
    <SplashTransition>
      <div className="welcome-page">
        {/* Standard navbar in overlay mode: transparent (white text) over
            the hero, solid espresso once the user scrolls. */}
        <TopNav overlay />

        {/* Hero Section with Video */}
        <section className="welcome-hero">
          <video className="welcome-video" autoPlay muted loop playsInline>
            <source src="/vecteezy_colorful-vegetables-stir-frying-in-a-modern-kitchen_73857683.mp4" type="video/mp4" />
          </video>
          <div className="welcome-hero-overlay" />

          <div className="welcome-hero-content">
            <h1 className="welcome-title">Culinary Craft</h1>
            <p className="welcome-hero-subtitle">Your AI-powered kitchen architect.</p>

            <div className="button-group">
              <button className="primary-btn" onClick={() => navigate('/chat')}>
                Start Crafting
              </button>
              <button className="secondary-btn" onClick={() => navigate('/explore')}>
                Explore Recipes
              </button>
            </div>
          </div>

          {/* Scroll Arrow */}
          <motion.button
            className="scroll-arrow"
            onClick={() => {
              const sloganSection = document.querySelector('.welcome-slogan');
              sloganSection?.scrollIntoView({ behavior: 'smooth' });
            }}
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ y: -5 }}
            aria-label="Scroll to next section"
          >
            <ChevronDown size={26} strokeWidth={1.8} />
          </motion.button>

          {/* Video Attribution */}
          <div className="video-attribution">
            <a href="https://www.vecteezy.com/free-videos/cooking" target="_blank" rel="noopener noreferrer">
              Cooking Stock Videos by Vecteezy
            </a>
          </div>
        </section>

        {/* Slogan + feature walkthrough */}
        <section className="welcome-slogan">
          <div className="welcome-slogan-content">
            <h2>Your AI Powered Culinary Assistant</h2>
          </div>
          <FeatureShowcase />
        </section>

        {/* CTA Section */}
        <section className="welcome-cta">
          <div className="welcome-cta-content">
            <h2>Ready to Create Something Delicious?</h2>
            <p>Start your culinary journey today</p>

            <div className="button-group">
              <button className="primary-btn" onClick={() => navigate('/chat')}>
                Start Crafting
              </button>
              <button className="secondary-btn" onClick={() => navigate('/explore')}>
                Explore Recipes
              </button>
            </div>
          </div>
        </section>
      </div>
    </SplashTransition>
  );
}

export default Welcome;
