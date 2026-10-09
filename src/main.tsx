import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { MobileOpeningScreen } from './components/MobileOpeningScreen';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      <MobileOpeningScreen>
        <App />
      </MobileOpeningScreen>
    </ToastProvider>
  </StrictMode>,
);

