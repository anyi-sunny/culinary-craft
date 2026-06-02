import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 1. Import Amplify libraries
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';

// 2. Configure Amplify (Move this here from App.jsx so it runs first)
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_CLIENT_ID
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 3. Wrap App in the Provider */}
    <Authenticator.Provider>
      <App />
    </Authenticator.Provider>
  </StrictMode>,
)