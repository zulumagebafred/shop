import { formatPrice, siteConfig } from '../config/siteConfig';
import {
  ReferralCommissionType,
  ReferralFollowerDiscountType,
} from '../types/fragrance';

export interface PartnerApprovalEmailParams {
  toEmail: string;
  displayName: string;
  assignedCode: string;
  commissionType: ReferralCommissionType;
  commissionValue: number;
  followerDiscountType: ReferralFollowerDiscountType;
  followerDiscountValue: number;
  origin?: string;
}

export interface PartnerApprovalEmailContent {
  toEmail: string;
  subject: string;
  body: string;
  mailtoUrl: string;
  referralLink: string;
  dashboardLink: string;
  commissionSummary: string;
  followerPerkSummary: string;
}

export type PartnerEmailDispatchResult =
  | {
      status: 'sent' | 'manual-ready';
      content: PartnerApprovalEmailContent;
    }
  | {
      status: 'failed';
      error: string;
      content: PartnerApprovalEmailContent;
    };

function getSafeOrigin(explicitOrigin?: string): string {
  if (explicitOrigin && explicitOrigin.trim()) return explicitOrigin.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://aurahut.co';
}

export function buildPartnerApprovalEmailContent(
  params: PartnerApprovalEmailParams
): PartnerApprovalEmailContent {
  const origin = getSafeOrigin(params.origin);
  const code = params.assignedCode.trim().toUpperCase();
  const referralLink = `${origin}/?ref=${encodeURIComponent(code)}`;
  const dashboardLink = `${origin}/#referral-dashboard`;

  const commissionSummary =
    params.commissionType === 'percentage'
      ? `${params.commissionValue}% per verified order`
      : `${formatPrice(params.commissionValue)} per verified order`;

  const followerPerkSummary =
    params.followerDiscountType === 'percentage' && params.followerDiscountValue > 0
      ? `${params.followerDiscountValue}% OFF for your followers`
      : params.followerDiscountType === 'fixed' && params.followerDiscountValue > 0
      ? `${formatPrice(params.followerDiscountValue)} OFF for your followers`
      : 'Tracked referral link (no order discount)';

  const subject = `Your ${siteConfig.brandName} Referral Partner Code (${code}) Is Approved!`;

  const body = [
    `Hi ${params.displayName || 'Partner'},`,
    '',
    `Great news — your ${siteConfig.brandName} Creator Partner application has been approved!`,
    '',
    'Here are your active partner details:',
    `• Approved Promo Code: ${code}`,
    `• Commission Rate: ${commissionSummary}`,
    `• Follower Benefit: ${followerPerkSummary}`,
    `• Your Shareable Storefront Link: ${referralLink}`,
    `• Your Partner Dashboard: ${dashboardLink}`,
    '',
    'How to get started:',
    '1. Share your link or promo code on TikTok, Instagram, or WhatsApp.',
    '2. Customers automatically get linked to you when ordering through your link or entering your code at checkout.',
    '3. Sign in to your Partner Dashboard anytime with this email address to track referred orders, commissions owed, and payouts.',
    '',
    `Welcome to the ${siteConfig.brandName} family!`,
    `${siteConfig.brandName} — Manzini & Mbabane, Eswatini`,
  ].join('\n');

  const mailtoUrl = `mailto:${encodeURIComponent(params.toEmail.trim())}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return {
    toEmail: params.toEmail.trim(),
    subject,
    body,
    mailtoUrl,
    referralLink,
    dashboardLink,
    commissionSummary,
    followerPerkSummary,
  };
}

export function isAutoPartnerEmailConfigured(): boolean {
  return false;
}

export async function dispatchPartnerApprovalEmail(
  params: PartnerApprovalEmailParams
): Promise<PartnerEmailDispatchResult> {
  const content = buildPartnerApprovalEmailContent(params);
  return { status: 'manual-ready', content };
}
