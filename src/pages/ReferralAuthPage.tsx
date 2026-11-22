import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Link2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import { AppPage } from '../types/fragrance';

interface ReferralAuthPageProps {
  onNavigate: (page: AppPage) => void;
  onNotify: (title: string, subtitle: string) => void;
}

type AuthMode = 'signin' | 'signup';

function extractAuthErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') {
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Switch to Sign In or reset your password.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Incorrect email or password. Try again or reset your password.';
    }
    if (code === 'auth/user-not-found') {
      return 'No partner account found for that email. Switch to Join Program to sign up.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters long.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in was closed before finishing.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Please wait a moment and try again.';
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export const ReferralAuthPage: React.FC<ReferralAuthPageProps> = ({
  onNavigate,
  onNotify,
}) => {
  const {
    user,
    authReady,
    signInPartnerWithGoogle,
    signInPartnerWithPassword,
    signUpPartnerWithPassword,
    sendPartnerPasswordReset,
    resendOwnerVerificationEmail,
    refreshAuthUser,
    signOutOwner,
  } = useStore();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showResetBox, setShowResetBox] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authReady && user && user.emailVerified) {
      onNavigate('referral-dashboard');
    }
  }, [authReady, user, onNavigate]);

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      await signInPartnerWithGoogle();
      onNotify('Signed In', 'Welcome to the AuraHut Co. Creator Partner Program.');
    } catch (err) {
      setErrorMsg(extractAuthErrorMessage(err, 'Unable to sign in with Google.'));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUpPartnerWithPassword(displayName, email, password);
        setStatusMsg(
          'Account created. We sent a verification link to your email — verify it, then click Refresh Status below.'
        );
        onNotify(
          'Verification Email Sent',
          'Check your inbox to verify your email and open your Partner Dashboard.'
        );
      } else {
        await signInPartnerWithPassword(email, password);
      }
    } catch (err) {
      setErrorMsg(
        extractAuthErrorMessage(
          err,
          mode === 'signup'
            ? 'Unable to create your partner account.'
            : 'Unable to sign in.'
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      const sentTo = await sendPartnerPasswordReset(resetEmail || email);
      setStatusMsg(`Password reset link sent to ${sentTo}. Check your inbox or spam folder.`);
      setShowResetBox(false);
    } catch (err) {
      setErrorMsg(extractAuthErrorMessage(err, 'Unable to send password reset email.'));
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      await resendOwnerVerificationEmail();
      setStatusMsg('Verification email re-sent. Open the link in your inbox, then refresh below.');
    } catch (err) {
      setErrorMsg(extractAuthErrorMessage(err, 'Could not resend verification email.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setBusy(true);
    try {
      const verified = await refreshAuthUser();
      if (verified) {
        onNotify('Email Verified', 'Opening your Partner Dashboard.');
        onNavigate('referral-dashboard');
      } else {
        setErrorMsg('Email is not verified yet. Open the verification link in your inbox first.');
      }
    } catch (err) {
      setErrorMsg(extractAuthErrorMessage(err, 'Unable to refresh verification state.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#F6F6F7] min-h-[82vh] py-10 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#525252] hover:text-[#0A0A0A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Storefront</span>
          </button>

          <span className="text-[11px] uppercase tracking-[0.18em] text-[#666666] font-medium">
            {siteConfig.brandName} · Partner Portal
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Left Program Overview Panel */}
          <section className="lg:col-span-6 bg-[#0A0A0A] text-white rounded-3xl p-7 sm:p-10 flex flex-col justify-between gap-8 border border-white/10">
            <div className="space-y-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#FACC15] font-semibold">
                Creator &amp; Ambassador Program · Eswatini
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.08] text-white [text-wrap:balance]">
                Share Authentic Arabian Scents. Earn Verified Commission.
              </h1>
              <p className="text-sm text-white/75 leading-relaxed max-w-lg">
                Sign up for an AuraHut Co. Partner account to request your custom referral code, share your trackable storefront link on TikTok or Instagram, and monitor confirmed sales and MoMo payouts in real time.
              </p>
            </div>

            <div className="space-y-4 border-t border-white/15 pt-6">
              <div className="flex items-start gap-3.5">
                <span className="w-7 h-7 rounded-lg bg-white/10 text-[#FACC15] text-xs font-bold tabular-nums inline-flex items-center justify-center shrink-0">
                  01
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Create Account &amp; Request Your Code
                  </h2>
                  <p className="text-xs text-white/65 leading-relaxed mt-0.5">
                    Submit your social handle, preferred promo code, and MoMo or EFT payout preference in under a minute.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="w-7 h-7 rounded-lg bg-white/10 text-[#FACC15] text-xs font-bold tabular-nums inline-flex items-center justify-center shrink-0">
                  02
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Share Your ?ref=CODE Link &amp; Captions
                  </h2>
                  <p className="text-xs text-white/65 leading-relaxed mt-0.5">
                    Followers who tap your link receive automatic code attribution (and any follower discount set by our team) at WhatsApp checkout.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5">
                <span className="w-7 h-7 rounded-lg bg-white/10 text-[#FACC15] text-xs font-bold tabular-nums inline-flex items-center justify-center shrink-0">
                  03
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Track Confirmed Orders &amp; Payouts
                  </h2>
                  <p className="text-xs text-white/65 leading-relaxed mt-0.5">
                    Every sale verified by our Manzini &amp; Mbabane store team updates your private commission ledger immediately.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/15 text-left">
              <div>
                <TrendingUp className="w-4 h-4 text-[#FACC15] mb-1.5" />
                <span className="block text-xs font-semibold text-white">Live Ledger</span>
                <span className="text-[11px] text-white/60">Confirmed &amp; paid sales</span>
              </div>
              <div>
                <Link2 className="w-4 h-4 text-[#FACC15] mb-1.5" />
                <span className="block text-xs font-semibold text-white">Auto ?ref Link</span>
                <span className="text-[11px] text-white/60">24h checkout memory</span>
              </div>
              <div>
                <ShieldCheck className="w-4 h-4 text-[#FACC15] mb-1.5" />
                <span className="block text-xs font-semibold text-white">MoMo &amp; EFT</span>
                <span className="text-[11px] text-white/60">Local Eswatini payouts</span>
              </div>
            </div>
          </section>

          {/* Right Authentication Card */}
          <section className="lg:col-span-6 bg-white border border-[#E5E5E5] rounded-3xl p-7 sm:p-10 flex flex-col justify-center">
            {!authReady ? (
              <div className="py-16 text-center text-xs uppercase tracking-[0.2em] text-[#666666]">
                Checking session...
              </div>
            ) : user && !user.emailVerified ? (
              <div className="space-y-5">
                <div className="w-11 h-11 rounded-2xl bg-[#FEF9C3] border border-[#FDE047] flex items-center justify-center text-[#0A0A0A]">
                  <MailCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#666666] font-semibold">
                    Step 2 · Email Verification Required
                  </p>
                  <h2 className="text-2xl font-bold text-[#0A0A0A]">
                    Verify Your Email Address
                  </h2>
                  <p className="text-sm text-[#525252] leading-relaxed">
                    You are signed in as <strong className="text-[#0A0A0A]">{user.email}</strong>. Click the verification link sent to your inbox to activate your Referral Partner Dashboard.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                    {errorMsg}
                  </div>
                )}
                {statusMsg && (
                  <div className="p-3 bg-[#ECFDF5] border border-[#10B981] rounded-xl text-xs text-[#065F46] font-medium">
                    {statusMsg}
                  </div>
                )}

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRefreshVerification}
                    className="w-full py-3.5 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                    <span>I&apos;ve Verified — Open Dashboard</span>
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleResendVerification}
                    className="w-full py-3 px-5 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-wider"
                  >
                    Resend Verification Email
                  </button>

                  <button
                    type="button"
                    onClick={() => void signOutOwner()}
                    className="w-full py-2 text-xs text-[#525252] hover:text-[#0A0A0A] underline"
                  >
                    Sign Out &amp; Use Another Account
                  </button>
                </div>
              </div>
            ) : user && user.emailVerified ? (
              <div className="space-y-5">
                <div className="w-11 h-11 rounded-2xl bg-[#ECFDF5] border border-[#10B981] flex items-center justify-center text-[#065F46]">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-[#0A0A0A]">
                    Signed In as {user.displayName || user.email}
                  </h2>
                  <p className="text-sm text-[#525252]">
                    Your verified partner session is ready.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('referral-dashboard')}
                  className="w-full py-3.5 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2"
                >
                  <span>Go to Partner Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Sign In / Join Program Mode Switch */}
                <div className="flex p-1 bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl">
                  <button
                    type="button"
                    aria-pressed={mode === 'signin'}
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                      setStatusMsg(null);
                      setShowResetBox(false);
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 ${
                      mode === 'signin'
                        ? 'bg-[#0A0A0A] text-white'
                        : 'text-[#525252] hover:text-[#0A0A0A]'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === 'signup'}
                    onClick={() => {
                      setMode('signup');
                      setErrorMsg(null);
                      setStatusMsg(null);
                      setShowResetBox(false);
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 ${
                      mode === 'signup'
                        ? 'bg-[#0A0A0A] text-white'
                        : 'text-[#525252] hover:text-[#0A0A0A]'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Join Program</span>
                  </button>
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
                    {mode === 'signin' ? 'Partner Sign In' : 'Create Partner Account'}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#525252] mt-1">
                    {mode === 'signin'
                      ? 'Access your referral link, sales ledger, and commission payout status.'
                      : 'Sign up first, then submit your social handle and preferred promo code.'}
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                    {errorMsg}
                  </div>
                )}
                {statusMsg && (
                  <div className="p-3 bg-[#ECFDF5] border border-[#10B981] rounded-xl text-xs text-[#065F46] font-medium">
                    {statusMsg}
                  </div>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogleAuth}
                  className="w-full py-3 px-4 rounded-xl border border-[#D4D4D4] hover:border-[#0A0A0A] bg-white text-[#0A0A0A] disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2.5"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.31 0 3.25 2.69 1.26 6.61l3.67 2.85C5.8 6.89 8.65 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.17-2 3.71-4.94 3.71-8.7z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M4.93 14.54A7.05 7.05 0 0 1 4.56 12c0-.88.15-1.73.37-2.54L1.26 6.61A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l3.67-2.85z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.88c-1.08.72-2.45 1.16-4.22 1.16-3.35 0-6.2-1.89-7.07-4.83l-3.67 2.85C3.25 21.31 7.31 24 12 24z"
                    />
                  </svg>
                  <span>
                    {mode === 'signin' ? 'Continue with Google' : 'Sign Up with Google'}
                  </span>
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-[#E5E5E5]" />
                  <span className="shrink-0 px-3 text-[11px] uppercase tracking-[0.16em] text-[#737373]">
                    or with email
                  </span>
                  <div className="flex-grow border-t border-[#E5E5E5]" />
                </div>

                {showResetBox ? (
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="partner-reset-email"
                        className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                      >
                        Account Email Address
                      </label>
                      <input
                        id="partner-reset-email"
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="flex-1 py-3 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 text-xs font-semibold uppercase tracking-wider"
                      >
                        {busy ? 'Sending...' : 'Send Reset Link'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetBox(false)}
                        className="px-4 py-3 rounded-full border border-[#D4D4D4] text-xs font-medium text-[#525252] hover:text-[#0A0A0A]"
                      >
                        Back
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    {mode === 'signup' && (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="partner-signup-name"
                          className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                        >
                          Full Name or Creator Name
                        </label>
                        <input
                          id="partner-signup-name"
                          type="text"
                          required
                          maxLength={120}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g. Nomsa Dlamini"
                          className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label
                        htmlFor="partner-auth-email"
                        className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                      >
                        Email Address
                      </label>
                      <input
                        id="partner-auth-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="creator@example.com"
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="partner-auth-password"
                          className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                        >
                          Password
                        </label>
                        {mode === 'signin' && (
                          <button
                            type="button"
                            onClick={() => {
                              setResetEmail(email);
                              setShowResetBox(true);
                              setErrorMsg(null);
                            }}
                            className="text-[11px] font-medium text-[#525252] hover:text-[#0A0A0A] underline"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <input
                        id="partner-auth-password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete={
                          mode === 'signin' ? 'current-password' : 'new-password'
                        }
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          mode === 'signin'
                            ? 'Enter your password'
                            : 'Minimum 6 characters'
                        }
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-3.5 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2"
                    >
                      <span>
                        {busy
                          ? 'Please wait...'
                          : mode === 'signin'
                          ? 'Sign In to Dashboard'
                          : 'Create Partner Account'}
                      </span>
                      {!busy && <ArrowRight className="w-4 h-4" />}
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
