import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import AccountWidget from './auth/AccountWidget';
import './../App.css';
import './Welcome.css';
import SplashTransition from './SplashTransition';

const NAV_LINKS = [
  { label: "Create Recipe", path: "/chat" },
  {
    label: "Explore Recipes",
    children: [
      { label: "All", path: "/explore" },
      { label: "Saved", path: "/favorites" },
      { label: "My Creations", path: "/my-recipes" },
    ],
  },
  { label: "Inventory", path: "/inventory" },
  { label: "Shopping List", path: "/shopping-list" },
];

function Welcome() {
  const navigate = useNavigate();
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
  const isAuthed = authStatus === 'authenticated';
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [navOpaque, setNavOpaque] = useState(false);
  const drawerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuOpen && drawerRef.current && !drawerRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const scrollTop = window.scrollY;
        setNavOpaque(scrollTop > 50);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigateTo = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <SplashTransition>
      <div className="welcome-page" ref={containerRef}>
        {/* Fixed Navigation Bar */}
        <nav className={`welcome-navbar ${navOpaque ? 'opaque' : ''}`}>
          <div className="welcome-nav-content">
            <div className="welcome-nav-left">
              {isAuthed && (
                <button
                  className="welcome-hamburger"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Toggle menu"
                >
                  <span />
                  <span />
                  <span />
                </button>
              )}
              {navOpaque && <span className="welcome-nav-title">Culinary Craft</span>}
            </div>
            <div className="welcome-account">
              <AccountWidget variant={navOpaque ? 'default' : 'on-accent'} />
            </div>
          </div>
        </nav>

        {/* Hamburger Menu */}
        <AnimatePresence>
          {isAuthed && menuOpen && (
            <>
              <motion.div
                className="welcome-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
              />
              <motion.nav
                ref={drawerRef}
                className="welcome-drawer"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.28 }}
              >
                {NAV_LINKS.map((link) => {
                  if (link.children) {
                    return (
                      <div key={link.label} className="drawer-item-group">
                        <button
                          className="drawer-item drawer-item-toggle"
                          onClick={() => setExploreOpen((v) => !v)}
                          aria-expanded={exploreOpen}
                        >
                          <span>{link.label}</span>
                          <ChevronDown
                            size={15}
                            strokeWidth={2.2}
                            className={`drawer-item-chevron${exploreOpen ? ' open' : ''}`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {exploreOpen && (
                            <motion.div
                              className="drawer-item-sublinks"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                            >
                              {link.children.map((child) => (
                                <button
                                  key={child.path}
                                  className="drawer-item drawer-item-sub"
                                  onClick={() => navigateTo(child.path)}
                                >
                                  {child.label}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={link.path}
                      className="drawer-item"
                      onClick={() => navigateTo(link.path)}
                    >
                      {link.label}
                    </button>
                  );
                })}
              </motion.nav>
            </>
          )}
        </AnimatePresence>

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

        {/* Slogan Section */}
        <section className="welcome-slogan">
          <div className="welcome-slogan-content">
            <h2>Your AI Powered Cooking, Baking, and Meal Planning Assistant</h2>
            <p>
              Transform your kitchen with intelligent recipe creation, personalized suggestions, and seamless meal planning—all powered by advanced AI technology.
            </p>
          </div>
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
