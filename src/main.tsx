import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

import { AuthProvider } from '@/context/AuthProvider';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import FirebaseInit from '@/components/FirebaseInit'; // Adatta il percorso se necessario

const appComponent = (
  <React.StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <FirebaseInit />
        <App />
        <Toaster />
      </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>
);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento #root non trovato');
}

createRoot(rootElement).render(appComponent);