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
const identityPoolId = import.meta.env.VITE_IDENTITY_POOL_ID;
const userPoolId = import.meta.env.VITE_USER_POOL_ID;
const clientId = import.meta.env.VITE_CLIENT_ID;

console.log('🔧 Amplify config:');
console.log('  identityPoolId:', identityPoolId);
console.log('  userPoolId:', userPoolId);
console.log('  clientId:', clientId);

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: userPoolId,
      userPoolClientId: clientId,
      identityPoolId: identityPoolId,
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