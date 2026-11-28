import { useEffect, useState } from 'react';
import { matchesPrivatePortalSlug } from '../config/siteConfig';

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
  if (new URLSearchParams(search).get('app')?.toLowerCase() === 'admin') return true;
  return (
    matchesPrivatePortalSlug(window.location.pathname) ||
    matchesPrivatePortalSlug(window.location.hash)
  );
}

/**
 * Call this once the user has been authenticated as admin.
 * Unlocks PWA install prompt capture and restores the manifest link
 * so the install button and browser install option appear.
 */
export function unlockPWAInstallForAdmin(): void {
  adminUnlocked = true;
  restoreManifest();
  notifyListeners();
}

/**
 * Reset admin unlock when signing out and hide manifest on non-admin routes.
 */
export function lockPWAInstall(): void {
  adminUnlocked = false;
  capturedPrompt = null;
  if (!detectStandaloneMode()) {
    hideManifest();
  }
  notifyListeners();
}

/**
 * Remove the `<link rel="manifest">` from the DOM so the browser
 * does NOT consider the page installable (no address-bar install icon).
 * Called on boot for non-admin pages.
 */
function hideManifest(): void {
  if (typeof document === 'undefined') return;
  const link = document.querySelector('link[rel="manifest"]');
  if (link) link.remove();
}

/**
 * Re-inject `<link rel="manifest">` so the browser sees the PWA as
 * installable again. Called when admin authenticates.
 */
function restoreManifest(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[rel="manifest"]')) return;
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = '/manifest.webmanifest';
  document.head.appendChild(link);
}

/**
 * Starts capturing `beforeinstallprompt` immediately on app boot so even
 * lazy-loaded views (like AdminDashboardPage) never miss the browser event.
 *
 * On non-admin pages the manifest `<link>` is stripped from the DOM so
 * the browser's address-bar install icon never appears.
 * The prompt is always intercepted (`preventDefault`) to suppress the
 * browser's mini-infobar, but only stored when the user is in an admin
 * context.
 */
export function initPWAInstallCapture(): void {
  if (typeof window === 'undefined' || captureInitialized) return;
  captureInitialized = true;
  capturedInstalled = detectStandaloneMode();

  // Strip manifest for storefront visitors so the browser install icon
  // does not show in the address bar.
  const syncManifestVisibility = () => {
    if (isAdminContext()) {
      restoreManifest();
    } else {
      hideManifest();
    }
  };

  syncManifestVisibility();
  window.addEventListener('hashchange', syncManifestVisibility);
  window.addEventListener('popstate', syncManifestVisibility);

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Always prevent the browser's default mini-infobar
    e.preventDefault();
    if (isAdminContext()) {
      capturedPrompt = e as BeforeInstallPromptEvent;
      notifyListeners();
    }
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
