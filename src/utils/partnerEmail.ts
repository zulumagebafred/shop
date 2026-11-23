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
      status: 'sent';
      content: PartnerApprovalEmailContent;
    }
  | {
      status: 'unconfigured';
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

function getEmailJsConfig(): {
  serviceId: string;
  templateId: string;
  publicKey: string;
} | null {
  if (typeof import.meta === 'undefined' || !import.meta.env) return null;
  const serviceId = String(import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '').trim();
  const templateId = String(import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '').trim();
  const publicKey = String(import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? '').trim();
  if (!serviceId || !templateId || !publicKey) return null;
  return { serviceId, templateId, publicKey };
}

export function isAutoPartnerEmailConfigured(): boolean {
  return getEmailJsConfig() !== null;
}

export async function dispatchPartnerApprovalEmail(
  params: PartnerApprovalEmailParams
): Promise<PartnerEmailDispatchResult> {
  const content = buildPartnerApprovalEmailContent(params);
  const emailJs = getEmailJsConfig();

  if (!emailJs) {
    return { status: 'unconfigured', content };
  }

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: emailJs.serviceId,
        template_id: emailJs.templateId,
        user_id: emailJs.publicKey,
        template_params: {
          to_email: content.toEmail,
          to_name: params.displayName || 'Partner',
          partner_name: params.displayName || 'Partner',
          referral_code: params.assignedCode.trim().toUpperCase(),
          commission_summary: content.commissionSummary,
          follower_perk: content.followerPerkSummary,
          referral_link: content.referralLink,
          dashboard_link: content.dashboardLink,
          brand_name: siteConfig.brandName,
          subject: content.subject,
          message: content.body,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        status: 'failed',
        error: errorText || `Email service returned HTTP ${response.status}`,
        content,
      };
    }

    return { status: 'sent', content };
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Network error sending confirmation email',
      content,
    };
  }
}
