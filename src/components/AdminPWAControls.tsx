import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AdminPWAInstallButtonProps {
  variant?: 'header' | 'card';
  onInstalled?: () => void;
}

export const AdminPWAInstallButton: React.FC<AdminPWAInstallButtonProps> = ({
  variant = 'header',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        const accepted = await install();
        if (accepted) {
          onInstalled?.();
        }
      } finally {
        setInstalling(false);
      }
      return;
    }
    setShowGuideModal(true);
  };

  const buttonClass =
    variant === 'header'
      ? isInstallable
        ? 'inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FACC15] hover:bg-[#FDE047] text-[#0A0A0A] text-xs font-bold rounded-full transition-colors whitespace-nowrap shrink-0'
        : 'inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#FACC15]/55 hover:border-[#FACC15] text-[#FACC15] hover:bg-[#FACC15]/10 text-xs font-semibold rounded-full transition-colors whitespace-nowrap shrink-0'
      : isInstallable
      ? 'w-full py-3 px-4 rounded-full bg-[#FACC15] hover:bg-[#FDE047] text-[#0A0A0A] text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors'
      : 'w-full py-2.5 px-4 rounded-full border border-[#D4D4D4] hover:border-[#0A0A0A] text-[#0A0A0A] text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors';

  const label = installing
    ? 'Installing...'
    : isInstallable
    ? 'Install Admin App'
    : isIOS
    ? 'Install on iPhone / iPad'
    : 'Install Admin App';

  return (
    <>
      <button
        type="button"
        disabled={installing}
        onClick={handleClick}
        className={buttonClass}
        title="Install AuraHut Co. Owner Admin on your home screen or desktop"
      >
        {isIOS && !isInstallable ? (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className={variant === 'header' && !isInstallable ? 'hidden md:inline' : ''}>
          {label}
        </span>
        {variant === 'header' && !isInstallable && (
          <span className="md:hidden">Install</span>
        )}
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install AuraHut Admin App"
          onClick={() => setShowGuideModal(false)}
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white text-[#0A0A0A] border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0A0A0A] border border-black overflow-hidden shrink-0">
                  <img
                    src="/pwa-192x192.png"
                    alt="AuraHut Admin Icon"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#737373]">
                    Installable Admin App
                  </p>
                  <h3 className="text-lg font-bold text-[#0A0A0A]">
                    AuraHut Co. Owner Admin
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="p-1.5 rounded-full text-[#525252] hover:bg-[#F4F4F5] hover:text-[#0A0A0A]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-4 space-y-2.5 text-xs text-[#303030] leading-relaxed">
                <p className="font-semibold text-[#0A0A0A] flex items-center gap-1.5">
                  <Share className="w-3.5 h-3.5" />
                  <span>Install on iPhone or iPad (Safari):</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    Make sure you opened this Admin Portal directly in <strong>Safari</strong> (not inside a preview iframe).
                  </li>
                  <li>
                    Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-4 space-y-2.5 text-xs text-[#303030] leading-relaxed">
                <p className="font-semibold text-[#0A0A0A]">
                  Install on Android, Windows, or Mac (Chrome / Edge):
                </p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    If viewing inside an embedded preview, open the Admin Portal in its own browser tab first.
                  </li>
                  <li>
                    Click the <strong>Install app</strong> icon in your browser address bar, or open the browser menu (⋮) and choose <strong>Add to Home screen / Install AuraHut Co. Owner Admin</strong>.
                  </li>
                  <li>
                    Once installed, the app icon launches straight into the Store Admin Console in standalone full-screen mode.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 px-4 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const AdminOfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-50 max-w-[calc(100vw-1.5rem)] flex items-center gap-2 rounded-full bg-[#0A0A0A] border border-[#FACC15] px-3.5 sm:px-4 py-2 text-xs font-semibold text-white shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#FACC15] shrink-0" aria-hidden="true" />
      <span className="truncate">Offline Mode — Cached admin view</span>
    </div>
  );
};
