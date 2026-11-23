import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  LogOut,
  MailCheck,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { formatPrice, siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import {
  AppPage,
  ReferralPayoutMethod,
  ReferralSaleStatus,
} from '../types/fragrance';
import { sanitizePromoCode } from '../utils/sanitize';

interface ReferralDashboardPageProps {
  onNavigate: (page: AppPage) => void;
  onNotify: (title: string, subtitle: string) => void;
}

const PAYOUT_LABELS: Record<ReferralPayoutMethod, string> = {
  momo: 'MTN MoMo',
  bank: 'Bank EFT',
  'store-credit': 'In-Store Fragrance Credit',
};

export const ReferralDashboardPage: React.FC<ReferralDashboardPageProps> = ({
  onNavigate,
  onNotify,
}) => {
  const {
    user,
    authReady,
    setPartnerPortalActive,
    partnerProfile,
    partnerProfileLoading,
    partnerReferral,
    partnerSales,
    partnerSalesLoading,
    submitPartnerApplication,
    updatePartnerProfile,
    resendOwnerVerificationEmail,
    refreshAuthUser,
    signOutOwner,
  } = useStore();

  useEffect(() => {
    setPartnerPortalActive(true);
    return () => setPartnerPortalActive(false);
  }, [setPartnerPortalActive]);

  // Onboarding / Settings Form State
  const [displayName, setDisplayName] = useState('');
  const [socialHandle, setSocialHandle] = useState('');
  const [requestedCode, setRequestedCode] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<ReferralPayoutMethod>('momo');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);

  // Dashboard interactive filters & copy feedback
  const [statusFilter, setStatusFilter] = useState<'all' | ReferralSaleStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  useEffect(() => {
    if (partnerProfile) {
      setDisplayName(partnerProfile.displayName);
      setSocialHandle(partnerProfile.socialHandle);
      setRequestedCode(partnerProfile.requestedCode);
      setPayoutMethod(partnerProfile.payoutMethod);
      setPayoutAccount(partnerProfile.payoutAccount);
    } else if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [partnerProfile, user]);

  const activeCode = partnerProfile?.assignedCode?.trim() ?? '';

  const [approvalBannerDismissed, setApprovalBannerDismissed] = useState(false);
  useEffect(() => {
    if (!partnerProfile?.uid || !activeCode) {
      setApprovalBannerDismissed(false);
      return;
    }
    try {
      const ackKey = `aurahut_partner_approved_ack_${partnerProfile.uid}_${activeCode}`;
      setApprovalBannerDismissed(localStorage.getItem(ackKey) === '1');
    } catch {
      setApprovalBannerDismissed(false);
    }
  }, [partnerProfile?.uid, activeCode]);

  const handleDismissApprovalBanner = () => {
    setApprovalBannerDismissed(true);
    if (!partnerProfile?.uid || !activeCode) return;
    try {
      localStorage.setItem(
        `aurahut_partner_approved_ack_${partnerProfile.uid}_${activeCode}`,
        '1'
      );
    } catch {
      // Ignore storage failures
    }
  };

  const stats = useMemo(() => {
    let salesCount = 0;
    let totalNetVolume = 0;
    let owedAmount = 0;
    let confirmedOwed = 0;
    let pendingOwed = 0;
    let paidOut = 0;

    for (const sale of partnerSales) {
      if (sale.commissionStatus === 'cancelled') continue;
      salesCount += 1;
      totalNetVolume += sale.netOrderAmount;
      if (sale.commissionStatus === 'confirmed') {
        confirmedOwed += sale.commissionAmount;
        owedAmount += sale.commissionAmount;
      } else if (sale.commissionStatus === 'pending') {
        pendingOwed += sale.commissionAmount;
        owedAmount += sale.commissionAmount;
      } else if (sale.commissionStatus === 'paid') {
        paidOut += sale.commissionAmount;
      }
    }

    return {
      salesCount,
      totalNetVolume,
      owedAmount,
      confirmedOwed,
      pendingOwed,
      paidOut,
    };
  }, [partnerSales]);

  const filteredSales = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return partnerSales.filter((sale) => {
      if (statusFilter !== 'all' && sale.commissionStatus !== statusFilter) {
        return false;
      }
      if (q) {
        const hay = `${sale.orderSummary} ${sale.customerRef}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [partnerSales, statusFilter, searchTerm]);

  const shareUrl = useMemo(() => {
    if (!activeCode || typeof window === 'undefined') return '';
    return `${window.location.origin}/?ref=${encodeURIComponent(activeCode)}`;
  }, [activeCode]);

  const shareCaption = useMemo(() => {
    if (!activeCode) return '';
    const perkLine =
      partnerReferral &&
      partnerReferral.followerDiscountType === 'percentage' &&
      partnerReferral.followerDiscountValue > 0
        ? ` and enjoy ${partnerReferral.followerDiscountValue}% OFF your order`
        : partnerReferral &&
          partnerReferral.followerDiscountType === 'fixed' &&
          partnerReferral.followerDiscountValue > 0
        ? ` and enjoy ${formatPrice(partnerReferral.followerDiscountValue)} OFF your order`
        : '';
    return `Shop authentic Arabian perfumes at ${siteConfig.brandName} (Manzini & Mbabane)! Use my referral code ${activeCode} or order directly through my link${perkLine}: ${shareUrl}`;
  }, [activeCode, partnerReferral, shareUrl]);

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      onNotify('Referral Link Copied', shareUrl);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard permission denials
    }
  };

  const handleCopyCaption = async () => {
    if (!shareCaption) return;
    try {
      await navigator.clipboard.writeText(shareCaption);
      setCopiedCaption(true);
      onNotify('Promo Caption Copied', `Ready to paste on TikTok, Instagram, or WhatsApp.`);
      window.setTimeout(() => setCopiedCaption(false), 2000);
    } catch {
      // Ignore clipboard permission denials
    }
  };

  const handleSubmitOnboardingOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanedCode = sanitizePromoCode(requestedCode);
    if (!displayName.trim()) {
      setFormError('Enter your creator or display name.');
      return;
    }
    if (cleanedCode.length < 2) {
      setFormError('Preferred referral code must be at least 2 letters or numbers.');
      return;
    }

    setFormBusy(true);
    try {
      const payload = {
        displayName: displayName.trim(),
        socialHandle: socialHandle.trim(),
        requestedCode: cleanedCode,
        payoutMethod,
        payoutAccount: payoutAccount.trim(),
      };
      if (!partnerProfile) {
        await submitPartnerApplication(payload);
        onNotify(
          'Application Submitted',
          `Requested code ${cleanedCode}. Our store team will review and activate it shortly.`
        );
      } else {
        await updatePartnerProfile(payload);
        setEditingSettings(false);
        onNotify('Partner Details Saved', 'Your payout and contact preferences are updated.');
      }
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Unable to save your partner profile.'
      );
    } finally {
      setFormBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutOwner();
    onNavigate('referral-auth');
  };

  if (!authReady || partnerProfileLoading) {
    return (
      <div className="min-h-[75vh] bg-[#F6F6F7] flex items-center justify-center text-xs uppercase tracking-[0.2em] text-[#666666]">
        Loading Partner Dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[75vh] bg-[#F6F6F7] py-16 px-4">
        <div className="max-w-lg mx-auto bg-white border border-[#E5E5E5] rounded-3xl p-8 text-center space-y-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#666666] font-semibold">
            {siteConfig.brandName} · Partner Portal
          </p>
          <h1 className="text-2xl font-bold text-[#0A0A0A]">
            Sign In to View Your Referral Dashboard
          </h1>
          <p className="text-sm text-[#525252] leading-relaxed">
            Access your trackable referral link, customer order attribution ledger, and MTN MoMo / EFT payout totals.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('referral-auth')}
              className="px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold uppercase tracking-wider"
            >
              Sign In or Join Program
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-5 py-3 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] text-xs font-semibold uppercase tracking-wider"
            >
              Back to Store
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user.emailVerified) {
    return (
      <div className="min-h-[75vh] bg-[#F6F6F7] py-16 px-4">
        <div className="max-w-lg mx-auto bg-white border border-[#E5E5E5] rounded-3xl p-8 space-y-5">
          <div className="w-11 h-11 rounded-2xl bg-[#FEF9C3] border border-[#FDE047] flex items-center justify-center text-[#0A0A0A]">
            <MailCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-[#0A0A0A]">
              Verify Your Email First
            </h1>
            <p className="text-sm text-[#525252]">
              Signed in as <strong className="text-[#0A0A0A]">{user.email}</strong>. Verify your inbox link before submitting your referral profile.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => void refreshAuthUser()}
              className="px-5 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Status</span>
            </button>
            <button
              type="button"
              onClick={() => void resendOwnerVerificationEmail()}
              className="px-5 py-3 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] text-xs font-semibold uppercase tracking-wider"
            >
              Resend Email
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="px-4 py-3 text-xs text-[#525252] hover:text-[#0A0A0A] underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // First-time authenticated creator -> Onboarding application form
  if (!partnerProfile) {
    return (
      <div className="bg-[#F6F6F7] min-h-[82vh] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#525252] hover:text-[#0A0A0A]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Store</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#525252] hover:text-[#0A0A0A]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out ({user.email})</span>
            </button>
          </div>

          <form
            onSubmit={handleSubmitOnboardingOrUpdate}
            className="bg-white border border-[#E5E5E5] rounded-3xl p-7 sm:p-10 space-y-6"
          >
            <div className="border-b border-[#E5E5E5] pb-5 space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#666666] font-semibold">
                Creator Onboarding · Step 1 of 1
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
                Apply for Your Referral Code
              </h1>
              <p className="text-sm text-[#525252]">
                Tell us your social handle, preferred code, and how you want to receive commission payouts. Once our store team approves your profile, your live dashboard activates automatically.
              </p>
            </div>

            {formError && (
              <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="app-display-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                >
                  Full Name or Brand Name *
                </label>
                <input
                  id="app-display-name"
                  type="text"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Nomsa Dlamini"
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="app-social-handle"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                >
                  TikTok / Instagram Handle
                </label>
                <input
                  id="app-social-handle"
                  type="text"
                  maxLength={100}
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  placeholder="e.g. @nomsaglow · TikTok"
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="app-requested-code"
                className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
              >
                Preferred Referral Code *
              </label>
              <input
                id="app-requested-code"
                type="text"
                required
                maxLength={32}
                value={requestedCode}
                onChange={(e) => setRequestedCode(e.target.value.toUpperCase())}
                placeholder="e.g. NOMSA10"
                className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm font-mono uppercase focus:outline-none focus:border-[#0A0A0A]"
              />
              <p className="text-[11px] text-[#666666]">
                Letters, numbers, dashes or underscores only. Example link:{' '}
                <span className="font-mono">
                  ?ref={sanitizePromoCode(requestedCode) || 'YOURCODE'}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="app-payout-method"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                >
                  Preferred Payout Method
                </label>
                <select
                  id="app-payout-method"
                  value={payoutMethod}
                  onChange={(e) =>
                    setPayoutMethod(e.target.value as ReferralPayoutMethod)
                  }
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                >
                  <option value="momo">MTN MoMo</option>
                  <option value="bank">Bank EFT (Eswatini)</option>
                  <option value="store-credit">In-Store Fragrance Credit</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="app-payout-account"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                >
                  Payout Number / Account Note
                </label>
                <input
                  id="app-payout-account"
                  type="text"
                  maxLength={160}
                  value={payoutAccount}
                  onChange={(e) => setPayoutAccount(e.target.value)}
                  placeholder={
                    payoutMethod === 'momo'
                      ? 'e.g. 76xx xxxx (Registered Name)'
                      : payoutMethod === 'bank'
                      ? 'Bank name & account holder'
                      : 'Preferred store branch (Manzini / Mbabane)'
                  }
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={formBusy}
              className="w-full py-3.5 px-6 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-[0.14em]"
            >
              {formBusy ? 'Submitting Application...' : 'Submit Partner Application'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F6F6F7] min-h-[85vh] pb-16">
      {/* Partner Workspace Header */}
      <header className="bg-[#0A0A0A] text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/65">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="inline-flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Storefront</span>
              </button>
              <span aria-hidden="true">·</span>
              <span>{siteConfig.brandName} Partner Dashboard</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  partnerProfile.status === 'active'
                    ? 'text-[#FACC15] font-semibold'
                    : 'text-white/85 font-semibold'
                }
              >
                {partnerProfile.status === 'active'
                  ? 'Active Partner'
                  : partnerProfile.status === 'paused'
                  ? 'Paused'
                  : 'Application Pending Review'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold text-white">
              {partnerProfile.displayName}
            </h1>

            <p className="text-xs sm:text-sm text-white/70 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{partnerProfile.email}</span>
              {partnerProfile.socialHandle && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{partnerProfile.socialHandle}</span>
                </>
              )}
              {activeCode && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[#FACC15] font-semibold">
                    Code: {activeCode}
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeCode && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2.5 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] transition-colors text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                <span>{copiedLink ? 'Link Copied' : `Copy ?ref=${activeCode}`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setEditingSettings((prev) => !prev)}
              className="px-4 py-2.5 rounded-full border border-white/25 text-white hover:bg-white/10 transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{editingSettings ? 'Close Settings' : 'Payout Settings'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="px-4 py-2.5 rounded-full border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Pending Review / Paused Status Banner */}
        {partnerProfile.status === 'pending' && !activeCode && (
          <section className="bg-[#FFFBEB] border border-[#FCD34D] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#92400E]">
                <Clock className="w-4 h-4" />
                <span>Application Received · Awaiting Store Activation</span>
              </p>
              <h2 className="text-xl font-bold text-[#0A0A0A]">
                Requested Code: <span className="font-mono">{partnerProfile.requestedCode}</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#525252] max-w-2xl leading-relaxed">
                Our team reviews new partner applications and assigns your official commission rate and shareable referral code. You can update your handle, requested code, or payout method below anytime while pending.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingSettings(true)}
              className="shrink-0 px-5 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
            >
              Update Application
            </button>
          </section>
        )}

        {partnerProfile.status === 'active' && activeCode && !approvalBannerDismissed && (
          <section className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#065F46]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Application Approved · Partner Account Active</span>
              </p>
              <h2 className="text-lg sm:text-xl font-bold text-[#0A0A0A]">
                You&apos;re approved! Share code{' '}
                <span className="font-mono">{activeCode}</span> to start earning
              </h2>
              <p className="text-xs sm:text-sm text-[#065F46]/90 max-w-2xl leading-relaxed">
                Confirmed for <strong className="text-[#0A0A0A]">{partnerProfile.email}</strong>.
                {partnerReferral
                  ? ` Your commission rate is ${
                      partnerReferral.commissionType === 'percentage'
                        ? `${partnerReferral.commissionValue}%`
                        : formatPrice(partnerReferral.commissionValue)
                    } per verified sale.`
                  : ' Your custom storefront referral link and live ledger are ready below.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Referral Link'}</span>
              </button>
              <button
                type="button"
                onClick={handleDismissApprovalBanner}
                className="px-3.5 py-2.5 text-xs font-medium text-[#065F46] underline"
              >
                Dismiss
              </button>
            </div>
          </section>
        )}

        {partnerProfile.status === 'paused' && (
          <section className="bg-white border border-[#D4D4D4] rounded-3xl p-6 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#525252]">
              Account Status: Paused
            </p>
            <p className="text-sm text-[#525252]">
              Your partner code is currently paused by the store team. Any historical confirmed or paid commission records remain visible below.
            </p>
          </section>
        )}

        {/* Collapsible Payout & Profile Settings Editor */}
        {editingSettings && (
          <form
            onSubmit={handleSubmitOnboardingOrUpdate}
            className="bg-white border border-[#0A0A0A] rounded-3xl p-6 sm:p-8 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#666666] font-semibold">
                  Partner Profile &amp; Settlement
                </p>
                <h2 className="text-xl font-bold text-[#0A0A0A]">
                  Edit Contact &amp; Payout Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingSettings(false)}
                className="text-xs underline text-[#525252] hover:text-[#0A0A0A]"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider">
                  Social Handle
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={socialHandle}
                  onChange={(e) => setSocialHandle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider">
                  Payout Method
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) =>
                    setPayoutMethod(e.target.value as ReferralPayoutMethod)
                  }
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                >
                  <option value="momo">MTN MoMo</option>
                  <option value="bank">Bank EFT</option>
                  <option value="store-credit">In-Store Credit</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider">
                  Payout Account / MoMo
                </label>
                <input
                  type="text"
                  maxLength={160}
                  value={payoutAccount}
                  onChange={(e) => setPayoutAccount(e.target.value)}
                  placeholder="76xx xxxx"
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>

            {!activeCode && (
              <div className="max-w-xs space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider">
                  Requested Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={requestedCode}
                  onChange={(e) => setRequestedCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm font-mono uppercase focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formBusy}
                className="px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 text-xs font-semibold uppercase tracking-wider"
              >
                {formBusy ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </form>
        )}

        {/* Active / Linked Code Workspace */}
        {activeCode && (
          <>
            {/* 4-Column Tabular KPI Strip */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                <span className="block text-[11px] uppercase tracking-wider text-[#737373] font-medium">
                  Commission Rate
                </span>
                <span className="mt-1.5 block text-2xl font-bold text-[#0A0A0A] tabular-nums">
                  {partnerReferral
                    ? partnerReferral.commissionType === 'percentage'
                      ? `${partnerReferral.commissionValue}%`
                      : formatPrice(partnerReferral.commissionValue)
                    : '—'}
                </span>
                <span className="mt-1 block text-xs text-[#525252]">
                  {partnerReferral
                    ? partnerReferral.followerDiscountType === 'percentage' &&
                      partnerReferral.followerDiscountValue > 0
                      ? `Followers get ${partnerReferral.followerDiscountValue}% Off`
                      : partnerReferral.followerDiscountType === 'fixed' &&
                        partnerReferral.followerDiscountValue > 0
                      ? `Followers get ${formatPrice(
                          partnerReferral.followerDiscountValue
                        )} Off`
                      : 'Tracking link (no discount)'
                    : 'Syncing commission terms'}
                </span>
              </div>

              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                <span className="block text-[11px] uppercase tracking-wider text-[#737373] font-medium">
                  Referred Sales
                </span>
                <span className="mt-1.5 block text-2xl font-bold text-[#0A0A0A] tabular-nums">
                  {formatPrice(stats.totalNetVolume)}
                </span>
                <span className="mt-1 block text-xs text-[#525252] tabular-nums">
                  {stats.salesCount} verified order{stats.salesCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                <span className="block text-[11px] uppercase tracking-wider text-[#737373] font-medium">
                  Commission Owed
                </span>
                <span className="mt-1.5 block text-2xl font-bold text-[#0A0A0A] tabular-nums">
                  {formatPrice(stats.owedAmount)}
                </span>
                <span className="mt-1 block text-xs text-[#525252] tabular-nums">
                  {formatPrice(stats.confirmedOwed)} confirmed
                  {stats.pendingOwed > 0
                    ? ` · ${formatPrice(stats.pendingOwed)} pending`
                    : ''}
                </span>
              </div>

              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
                <span className="block text-[11px] uppercase tracking-wider text-[#737373] font-medium">
                  Paid Out Total
                </span>
                <span className="mt-1.5 block text-2xl font-bold text-[#166534] tabular-nums">
                  {formatPrice(stats.paidOut)}
                </span>
                <span className="mt-1 block text-xs text-[#525252]">
                  {PAYOUT_LABELS[partnerProfile.payoutMethod]}
                  {partnerProfile.payoutAccount ? ` · ${partnerProfile.payoutAccount}` : ''}
                </span>
              </div>
            </section>

            {/* Shareable Creator Kit */}
            <section className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-2">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#525252]">
                  <Sparkles className="w-3.5 h-3.5 text-[#0A0A0A]" />
                  <span>Your Creator Share Kit</span>
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                  Share Your Link or Code:{' '}
                  <span className="font-mono">{activeCode}</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
                  Paste your link in your TikTok bio, Instagram Stories, or WhatsApp statuses. Orders submitted with your code are verified by our Manzini &amp; Mbabane team before appearing in your ledger.
                </p>
              </div>

              <div className="lg:col-span-7 space-y-3">
                <div className="p-3.5 bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wider text-[#737373] font-semibold">
                      Personal Referral URL
                    </span>
                    <span className="block text-xs sm:text-sm font-mono text-[#0A0A0A] truncate">
                      {shareUrl}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="shrink-0 px-4 py-2 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>

                <div className="p-3.5 bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wider text-[#737373] font-semibold">
                      Ready-to-Post Social Caption
                    </span>
                    <p className="text-xs text-[#262626] line-clamp-2 mt-0.5">
                      {shareCaption}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCaption}
                    className="shrink-0 px-4 py-2 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-[#0A0A0A] text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5"
                  >
                    {copiedCaption ? (
                      <Check className="w-3.5 h-3.5 text-[#166534]" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCaption ? 'Copied' : 'Copy Caption'}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Verified Commission & Sales Ledger */}
            <section className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                    Verified Sales &amp; Commission Ledger ({filteredSales.length})
                  </h2>
                  <p className="text-xs text-[#666666] mt-0.5">
                    Updated automatically when store staff confirm WhatsApp or in-store referral orders.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filter orders..."
                      className="pl-8 pr-3 py-1.5 border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A] w-44"
                    />
                  </div>

                  <select
                    aria-label="Filter commission status"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as 'all' | ReferralSaleStatus)
                    }
                    className="px-3 py-1.5 border border-[#D4D4D4] rounded-xl bg-white text-xs font-medium focus:outline-none focus:border-[#0A0A0A]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="confirmed">Confirmed (Owed)</option>
                    <option value="paid">Paid Out</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {partnerSalesLoading ? (
                <p className="text-sm text-[#666666] py-8 text-center">
                  Loading commission ledger...
                </p>
              ) : filteredSales.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-[#D4D4D4] rounded-2xl">
                  <Wallet className="w-6 h-6 mx-auto text-[#737373]" />
                  <p className="text-base font-bold text-[#0A0A0A]">
                    {partnerSales.length === 0
                      ? 'No Verified Referral Sales Yet'
                      : 'No Matching Orders'}
                  </p>
                  <p className="text-xs text-[#666666] max-w-md mx-auto">
                    {partnerSales.length === 0
                      ? `Share your link ?ref=${activeCode} on social media. As soon as our store confirms WhatsApp orders from your followers, your earnings appear here.`
                      : 'Clear your status filter or search query to view all referred sales.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E5E5] text-[11px] uppercase tracking-wider text-[#737373]">
                        <th className="py-3 pr-4 font-semibold">Date</th>
                        <th className="py-3 pr-4 font-semibold">Order Summary</th>
                        <th className="py-3 pr-4 font-semibold text-right">Net Order</th>
                        <th className="py-3 pr-4 font-semibold text-right">Commission</th>
                        <th className="py-3 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F2] text-sm">
                      {filteredSales.map((sale) => {
                        const statusLabel =
                          sale.commissionStatus === 'paid'
                            ? 'Paid Out'
                            : sale.commissionStatus === 'confirmed'
                            ? 'Confirmed · Owed'
                            : sale.commissionStatus === 'cancelled'
                            ? 'Cancelled'
                            : 'Pending';
                        const dotColor =
                          sale.commissionStatus === 'paid'
                            ? 'bg-[#16A34A]'
                            : sale.commissionStatus === 'confirmed'
                            ? 'bg-[#0A0A0A]'
                            : sale.commissionStatus === 'cancelled'
                            ? 'bg-[#DC2626]'
                            : 'bg-[#D97706]';

                        return (
                          <tr key={sale.id} className="hover:bg-[#FAFAFA]">
                            <td className="py-3.5 pr-4 text-xs text-[#525252] whitespace-nowrap tabular-nums">
                              {new Date(sale.createdAtMs).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 pr-4">
                              <p className="font-medium text-[#0A0A0A]">
                                {sale.orderSummary}
                              </p>
                              <p className="text-[11px] text-[#737373]">
                                {sale.source === 'checkout'
                                  ? 'WhatsApp Checkout'
                                  : 'Manual / In-Store'}
                                {sale.customerRef ? ` · ${sale.customerRef}` : ''}
                              </p>
                            </td>
                            <td className="py-3.5 pr-4 text-right font-medium text-[#0A0A0A] tabular-nums whitespace-nowrap">
                              {formatPrice(sale.netOrderAmount)}
                            </td>
                            <td className="py-3.5 pr-4 text-right font-bold text-[#0A0A0A] tabular-nums whitespace-nowrap">
                              {formatPrice(sale.commissionAmount)}
                            </td>
                            <td className="py-3.5 text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0A0A0A]">
                                <span
                                  aria-hidden="true"
                                  className={`w-2 h-2 rounded-full ${dotColor}`}
                                />
                                <span>{statusLabel}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};
