import React from 'react';
import { useNavigate } from 'react-router-dom';
import './../App.css'; 
import SplashTransition from './SplashTransition';

function Welcome() {
  const navigate = useNavigate();

  return (
    <SplashTransition>
        <div className="welcome-container">
        <div className="welcome-content">
            <h1 className="welcome-title">Culinary Craft</h1>
            <p className="welcome-subtitle">Your AI-powered kitchen architect.</p>
            
            <div className="button-group">
            <button 
                className="primary-btn" 
                onClick={() => navigate('/chat')}
            >
                Start Crafting
            </button>
            
            <button 
                className="secondary-btn" 
                onClick={() => navigate('/explore')}
            >
                Explore Recipes
            </button>
            </div>
        </div>
        </div>
    </SplashTransition>
  );
}

export default Welcome;