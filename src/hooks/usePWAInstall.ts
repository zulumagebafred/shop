import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallListener = () => void;

let capturedPrompt: BeforeInstallPromptEvent | null = null;
let capturedInstalled = false;
let captureInitialized = false;
const listeners = new Set<InstallListener>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function detectStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Starts capturing `beforeinstallprompt` immediately on app boot so even
 * lazy-loaded views (like AdminDashboardPage) never miss the browser event.
 */
export function initPWAInstallCapture(): void {
  if (typeof window === 'undefined' || captureInitialized) return;
  captureInitialized = true;
  capturedInstalled = detectStandaloneMode();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener('appinstalled', () => {
    capturedInstalled = true;
    capturedPrompt = null;
    notifyListeners();
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => capturedPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(
    () => capturedInstalled || detectStandaloneMode()
  );
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    initPWAInstallCapture();

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const syncFromStore = () => {
      setDeferredPrompt(capturedPrompt);
      setIsInstalled(capturedInstalled || detectStandaloneMode());
    };

    syncFromStore();
    listeners.add(syncFromStore);

    const mql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      capturedInstalled = detectStandaloneMode();
      syncFromStore();
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleDisplayModeChange);
    }

    return () => {
      listeners.delete(syncFromStore);
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handleDisplayModeChange);
      }
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      capturedInstalled = true;
      capturedPrompt = null;
      notifyListeners();
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}
