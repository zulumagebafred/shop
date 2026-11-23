import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initPWAInstallCapture } from './hooks/usePWAInstall';
import { initPerfMonitoring } from './utils/perfMonitor';
import './index.css';

initPerfMonitoring();
initPWAInstallCapture();
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

