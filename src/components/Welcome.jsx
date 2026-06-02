import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthenticator } from '@aws-amplify/ui-react';
import AccountWidget from './auth/AccountWidget';
import './../App.css';
import SplashTransition from './SplashTransition';

function Welcome() {
  const navigate = useNavigate();
  const { authStatus } = useAuthenticator((ctx) => [ctx.authStatus]);
  const isAuthed = authStatus === 'authenticated';

  return (
    <SplashTransition>
      <div className="welcome-container">
        {/* Consistent login status, top-right */}
        <div className="welcome-account">
          <AccountWidget variant="on-accent" />
        </div>

        <div className="welcome-content">
          <h1 className="welcome-title">Culinary Craft</h1>
          <p className="welcome-subtitle">Your AI-powered kitchen architect.</p>

          <div className="button-group">
            <button className="primary-btn" onClick={() => navigate('/chat')}>
              Start Crafting
            </button>
            <button className="secondary-btn" onClick={() => navigate('/explore')}>
              Explore Recipes
            </button>
          </div>

          {isAuthed && (
            <div className="welcome-quicklinks">
              <button onClick={() => navigate('/my-recipes')}>📖 My Recipes</button>
              <button onClick={() => navigate('/favorites')}>❤️ Favorites</button>
            </div>
          )}
        </div>
      </div>
    </SplashTransition>
  );
}

export default Welcome;
