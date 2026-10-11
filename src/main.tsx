import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { MobileOpeningScreen } from './components/MobileOpeningScreen';
import { MaintenanceGate } from './components/MaintenanceGate';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import './index.css';

const DeveloperPortal = lazy(() => import('./components/DeveloperPortal'));

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');

const isDeveloper = window.location.pathname.replace(/\/+$/, '') === '/developer';

// Suppress unhandled rejections and errors originating from browser extensions (e.g. MetaMask, Phantom)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = (typeof reason === 'string' ? reason : reason?.message || '') + '';
  const stack = (reason?.stack || '') + '';
  if (
    msg.toLowerCase().includes('metamask') ||
    msg.toLowerCase().includes('ethereum') ||
    stack.includes('chrome-extension://') ||
    stack.includes('moz-extension://')
  ) {
    event.preventDefault();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      {isDeveloper ? (
        <Suspense fallback={null}>
          <DeveloperPortal />
        </Suspense>
      ) : (
        <MaintenanceGate>
          <MobileOpeningScreen>
            <App />
            <PWAInstallPrompt />
          </MobileOpeningScreen>
        </MaintenanceGate>
      )}
    </ToastProvider>
  </StrictMode>,
);
