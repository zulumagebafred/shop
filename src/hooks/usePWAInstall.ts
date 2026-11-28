import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallListener = () => void;

let capturedPrompt: BeforeInstallPromptEvent | null = null;
let capturedInstalled = false;
let captureInitialized = false;
let adminUnlocked = false;
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
 * Returns true when the current URL looks like an admin/portal launch.
 * Used to decide whether to capture `beforeinstallprompt`.
 */
function isAdminContext(): boolean {
  if (typeof window === 'undefined') return false;
  // Already running as an installed standalone PWA — always allow
  if (detectStandaloneMode()) return true;
  // Explicitly unlocked by admin auth
  if (adminUnlocked) return true;
  const search = window.location.search.toLowerCase();
  if (search.includes('app=admin')) return true;
  const hash = window.location.hash.toLowerCase();
  if (hash && hash !== '#' && hash !== '#referral-dashboard' && hash !== '#referral-auth' && hash !== '#partners') return true;
  return false;
}

/**
 * Call this once the user has been authenticated as admin.
 * Unlocks PWA install prompt capture so the install button appears.
 */
export function unlockPWAInstallForAdmin(): void {
  adminUnlocked = true;
  // If we suppressed a prompt earlier the browser won't re-fire it, but
  // the button will switch to the manual guide which is fine.
  notifyListeners();
}

/**
 * Reset admin unlock when signing out.
 */
export function lockPWAInstall(): void {
  adminUnlocked = false;
  capturedPrompt = null;
  notifyListeners();
}

/**
 * Starts capturing `beforeinstallprompt` immediately on app boot so even
 * lazy-loaded views (like AdminDashboardPage) never miss the browser event.
 * The prompt is only intercepted when the user is in an admin context
 * (admin URL or already authenticated). Normal storefront visitors will
 * NOT see an install prompt.
 */
export function initPWAInstallCapture(): void {
  if (typeof window === 'undefined' || captureInitialized) return;
  captureInitialized = true;
  capturedInstalled = detectStandaloneMode();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    if (!isAdminContext()) {
      // Let the browser's default behaviour run — which is to suppress the
      // install banner for non-admin visitors (since we don't call
      // preventDefault, the browser won't show the mini-infobar either
      // unless the user manually triggers it via browser menu).
      return;
    }
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
    isInstallable: Boolean(deferredPrompt) && adminUnlocked,
    isInstalled,
    isIOS: isIOS && adminUnlocked,
    install,
  };
}
