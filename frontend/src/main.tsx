import { DebugMenu } from './components/DebugMenu';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import './style.css';

// Auth sits inside the router so every page shares the same restored login.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {import.meta.env.DEV && <DebugMenu />}
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
