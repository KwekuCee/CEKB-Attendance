import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ToastProvider } from './context/ToastContext';
import { MobileOpeningScreen } from './components/MobileOpeningScreen';
import { MaintenanceGate } from './components/MaintenanceGate';
import './index.css';

const DeveloperPortal = lazy(() => import('./components/DeveloperPortal'));

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');

const isDeveloper = window.location.pathname.replace(/\/+$/, '') === '/developer';

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
          </MobileOpeningScreen>
        </MaintenanceGate>
      )}
    </ToastProvider>
  </StrictMode>,
);
