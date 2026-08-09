import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import './index.css'
import App from './App.jsx'

// 1. Import Amplify libraries
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { AuthModalProvider } from './components/auth/AuthModalProvider';

// 2. Configure Amplify (Move this here from App.jsx so it runs first)
// Note: no identityPoolId — the frontend never talks to AWS services
// directly (everything goes through the backend API), and configuring the
// identity pool made every fetchAuthSession call hit cognito-identity for
// credentials nobody uses (visible as 400s in the console).
const userPoolId = import.meta.env.VITE_USER_POOL_ID;
const clientId = import.meta.env.VITE_CLIENT_ID;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: userPoolId,
      userPoolClientId: clientId,
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 3. Wrap App in the Provider */}
    <Authenticator.Provider>
      <AuthModalProvider>
        <App />
      </AuthModalProvider>
    </Authenticator.Provider>
  </StrictMode>,
)