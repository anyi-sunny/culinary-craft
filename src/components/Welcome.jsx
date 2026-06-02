import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthenticator, Authenticator } from '@aws-amplify/ui-react'; // 1. Add Amplify Imports
import '@aws-amplify/ui-react/styles.css';
import './../App.css'; 
import SplashTransition from './SplashTransition';

function Welcome() {
  const navigate = useNavigate();

  // 2. Add Auth Hook & Modal State
  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const formFields = {
    signIn: {
      username: {
        label: 'Email',
        placeholder: 'Enter your email',
        type: 'email', // Ensures mobile keyboard shows @ symbol
        isRequired: true,
      },
    },
    signUp: {
      username: {
        label: 'Email',
        placeholder: 'Enter your email',
        type: 'email',
        isRequired: true,
        order: 1, // Forces this to be the first field
      },
      password: {
        label: 'Password',
        placeholder: 'Enter your password',
        isRequired: true,
        order: 2,
      },
      confirm_password: {
        label: 'Confirm Password',
        placeholder: 'Please confirm your password',
        order: 3,
      }
    },
    forgotPassword: {
      username: {
        label: 'Email',
        placeholder: 'Enter your email',
      },
    },
  };

  return (
    <SplashTransition>
        <div className="welcome-container">
            
            {/* 3. NEW: Top Right Login Button */}
            {authStatus === 'authenticated' ? (
                <div className="welcome-user-badge">
                    Welcome back! 👋
                </div>
            ) : (
                <button 
                    className="welcome-login-btn" 
                    onClick={() => setIsLoginModalOpen(true)}
                >
                    Login / Sign Up
                </button>
            )}

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

            {/* 4. NEW: Login Modal (Same logic as Chat) */}
            {isLoginModalOpen && (
                <div className="modal-overlay">
                    <div 
                        className="modal-content" 
                        style={{ 
                            width: 'fit-content',
                            maxWidth: '95vw',
                            padding: '0', 
                            position: 'relative',
                            overflow: 'hidden',
                            color: 'black' 
                        }}
                    >
                        <button 
                            onClick={() => setIsLoginModalOpen(false)} 
                            style={{ 
                                position: 'absolute', 
                                top: '10px', 
                                right: '10px', 
                                zIndex: 10,
                                background: 'white', 
                                border: '1px solid #ddd', 
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666'
                            }}
                        >
                            ✖
                        </button>
                        <Authenticator formFields={formFields}>
                            {({ signOut, user }) => {
                                // Close modal automatically when login finishes
                                useEffect(() => {
                                    setIsLoginModalOpen(false);
                                }, []);
                                return null; 
                            }}
                        </Authenticator>
                    </div>
                </div>
            )}
        </div>
    </SplashTransition>
  );
}

export default Welcome;