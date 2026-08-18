import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import TopNav from './nav/TopNav';
import FeatureShowcase from './FeatureShowcase';
import './../App.css';
import './Welcome.css';
import SplashTransition from './SplashTransition';
import { usePageMeta } from '../lib/usePageMeta';

function Welcome() {
  usePageMeta();
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

        {/* Online recipe book: explore/published/saved/creations screenshots */}
        <section className="welcome-book">
          <div className="welcome-book-content">
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2>Your Online Recipe Book</h2>
              <p className="welcome-book-text">
                Explore all our recipes published by users like you, view your
                favorites, and see all your creations
              </p>
            </motion.div>

            <motion.div
              className="welcome-book-row"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.35 }}
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.12 } },
              }}
            >
              {['explore', 'published', 'saved', 'creations'].map((name) => (
                <motion.img
                  key={name}
                  className="welcome-book-image"
                  src={`/explore/${name}.png`}
                  alt={`${name.charAt(0).toUpperCase() + name.slice(1)} view of the recipe book`}
                  loading="lazy"
                  variants={{
                    hidden: { opacity: 0, y: 18 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                    },
                  }}
                />
              ))}
            </motion.div>
          </div>
        </section>

        {/* Origin story teaser -> full story on /about */}
        <section className="welcome-story">
          <motion.div
            className="welcome-story-content"
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="welcome-story-eyebrow">The story behind the app</p>
            <h2>Why I Built Culinary Craft</h2>
            <p className="welcome-story-text">
              Would you believe me if I told you that my journey to making the 
              perfect batch of banana bread led me to create this? I may be biased, 
              but I think this story is worth reading and my banana bread recipe 
              is totally worth trying. I hope you enjoy both!
            </p>
            <button
              className="welcome-story-link"
              onClick={() => navigate('/about')}
            >
              Read more
              <ArrowRight size={16} strokeWidth={2.2} />
            </button>
          </motion.div>
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
