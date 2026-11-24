import {
  BranchId,
  ComboDeal,
  Coupon,
  FragranceProduct,
  GiftHamper,
  InfluencerReferral,
  LayeringIdea,
  SizeOption,
  SpecialCampaign,
  WeeklyFiveMlSpecial,
} from '../types/fragrance';
import { formatBranchName, getAvailableBranches, normalizeBranches } from './branches';

function formatBranchesSummary(
  branches: BranchId[] | undefined,
  availability: string
): string {
  if (availability === 'Out of Stock') return 'None';
  const list: BranchId[] = branches ? normalizeBranches(branches) : ['manzini', 'mbabane'];
  if (list.length === 0) return 'None';
  if (list.length === 2) return 'Manzini & Mbabane';
  return `${formatBranchName(list[0])} Only`;
}

function clampChange(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}...` : cleaned;
}

export function sanitizeAuditChanges(lines: string[]): string[] {
  return lines
    .map(clampChange)
    .filter((line) => line.length > 0)
    .slice(0, 12);
}

export function deriveAdminUsername(
  email?: string | null,
  displayName?: string | null
): string {
  const cleanDisplay = (displayName ?? '').trim();
  if (cleanDisplay) return cleanDisplay.slice(0, 80);
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (cleanEmail.includes('@')) {
    const local = cleanEmail.split('@')[0]?.trim();
    if (local) return local.slice(0, 80);
  }
  return cleanEmail ? cleanEmail.slice(0, 80) : 'admin';
}

function fmtPrice(val: number | null | undefined): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return 'Unpriced';
  return `E${val.toFixed(0)}`;
}

function fmtBool(val: boolean | undefined): string {
  return val ? 'Yes' : 'No';
}

function fmtList(arr: string[]): string {
  if (!arr || arr.length === 0) return 'None';
  return arr.join(', ');
}

function formatSizesMap(sizes: SizeOption[]): Map<string, SizeOption> {
  const map = new Map<string, SizeOption>();
  for (const s of sizes) {
    map.set(s.size.trim().toLowerCase(), s);
  }
  return map;
}

export function buildPerfumeDiff(
  prev: FragranceProduct | undefined,
  next: {
    name: string;
    brand: string;
    category: string;
    concentration: string;
    availability: string;
    availableBranches?: ('manzini' | 'mbabane')[];
    description: string;
    image: string;
    notes: { top: string[]; heart: string[]; base: string[] };
    sizes: SizeOption[];
    featured: boolean;
    bestseller: boolean;
    isUnboxed?: boolean;
    isNewArrival?: boolean;
    onSpecial?: boolean;
    specialLabel?: string;
    specialDiscountType?: 'percentage' | 'fixed';
    specialDiscountPercent?: number;
    specialDiscountAmount?: number;
  }
): string[] {
  const describeSpecial = (entry: {
    specialDiscountType?: 'percentage' | 'fixed';
    specialDiscountPercent?: number;
    specialDiscountAmount?: number;
  }): string => {
    if (entry.specialDiscountType === 'fixed') {
      return `-E${entry.specialDiscountAmount ?? 0}`;
    }
    return `${entry.specialDiscountPercent ?? 0}% Off`;
  };

  if (!prev) {
    const activeSizes = next.sizes
      .filter((s) => s.available)
      .map((s) => `${s.size} (${fmtPrice(s.price)})`)
      .join(', ');
    return sanitizeAuditChanges([
      `Brand: ${next.brand} · Category: ${next.category}`,
      `Availability: ${next.availability} · Stores: ${formatBranchesSummary(
        next.availableBranches,
        next.availability
      )}`,
      activeSizes ? `Sizes: ${activeSizes}` : 'No active sizes',
      next.onSpecial
        ? `On Special: ${describeSpecial(next)} (${next.specialLabel || 'Special'})`
        : '',
      next.isUnboxed ? 'Marked as Unboxed Perfume' : '',
      next.isNewArrival ? 'Marked as New Arrival' : '',
    ]);
  }

  const changes: string[] = [];
  if (prev.name !== next.name) changes.push(`Name: "${prev.name}" → "${next.name}"`);
  if (prev.brand !== next.brand) changes.push(`Brand: ${prev.brand} → ${next.brand}`);
  if (prev.category !== next.category) changes.push(`Category: ${prev.category} → ${next.category}`);
  if (prev.concentration !== next.concentration) {
    changes.push(`Concentration: ${prev.concentration} → ${next.concentration}`);
  }
  if (prev.availability !== next.availability) {
    changes.push(`Availability: ${prev.availability} → ${next.availability}`);
  }

  const prevBranches = formatBranchesSummary(getAvailableBranches(prev), prev.availability);
  const nextBranches = formatBranchesSummary(next.availableBranches, next.availability);
  if (prevBranches !== nextBranches) {
    changes.push(`Stores: ${prevBranches} → ${nextBranches}`);
  }

  // Size pricing & availability diff
  const prevSizes = formatSizesMap(prev.sizes);
  const nextSizes = formatSizesMap(next.sizes);
  const allKeys = Array.from(new Set([...prevSizes.keys(), ...nextSizes.keys()]));
  const sizeDeltas: string[] = [];
  for (const key of allKeys) {
    const a = prevSizes.get(key);
    const b = nextSizes.get(key);
    if (!a && b) {
      sizeDeltas.push(`Added ${b.size} (${fmtPrice(b.price)}${b.available ? '' : ', unavailable'})`);
    } else if (a && !b) {
      sizeDeltas.push(`Removed ${a.size}`);
    } else if (a && b) {
      const priceChanged = a.price !== b.price;
      const availChanged = a.available !== b.available;
      if (priceChanged || availChanged) {
        const beforeStr = `${fmtPrice(a.price)}${a.available ? '' : ' [off]'}`;
        const afterStr = `${fmtPrice(b.price)}${b.available ? '' : ' [off]'}`;
        sizeDeltas.push(`${b.size}: ${beforeStr} → ${afterStr}`);
      }
    }
  }
  for (const d of sizeDeltas.slice(0, 5)) {
    changes.push(d);
  }
  if (sizeDeltas.length > 5) {
    changes.push(`+${sizeDeltas.length - 5} more size adjustments`);
  }

  if (Boolean(prev.onSpecial) !== Boolean(next.onSpecial)) {
    changes.push(
      `On Special: ${fmtBool(prev.onSpecial)} → ${fmtBool(next.onSpecial)}${
        next.onSpecial ? ` (${describeSpecial(next)})` : ''
      }`
    );
  } else if (
    next.onSpecial &&
    ((prev.specialDiscountType ?? 'percentage') !== (next.specialDiscountType ?? 'percentage') ||
      prev.specialDiscountPercent !== next.specialDiscountPercent ||
      (prev.specialDiscountAmount ?? 0) !== (next.specialDiscountAmount ?? 0) ||
      (prev.specialLabel ?? '') !== (next.specialLabel ?? ''))
  ) {
    changes.push(
      `Special Offer: ${describeSpecial(prev)} (${prev.specialLabel || '—'}) → ${describeSpecial(
        next
      )} (${next.specialLabel || '—'})`
    );
  }

  if (Boolean(prev.featured) !== Boolean(next.featured)) {
    changes.push(`Featured: ${fmtBool(prev.featured)} → ${fmtBool(next.featured)}`);
  }
  if (Boolean(prev.isUnboxed) !== Boolean(next.isUnboxed)) {
    changes.push(`Unboxed: ${fmtBool(prev.isUnboxed)} → ${fmtBool(next.isUnboxed)}`);
  }
  if (Boolean(prev.isNewArrival) !== Boolean(next.isNewArrival)) {
    changes.push(`New Arrival: ${fmtBool(prev.isNewArrival)} → ${fmtBool(next.isNewArrival)}`);
  }
  if (prev.description !== next.description) {
    changes.push('Updated fragrance description');
  }
  if (prev.image !== next.image) {
    changes.push('Updated product photo URL');
  }
  if (
    fmtList(prev.notes.top) !== fmtList(next.notes.top) ||
    fmtList(prev.notes.heart) !== fmtList(next.notes.heart) ||
    fmtList(prev.notes.base) !== fmtList(next.notes.base)
  ) {
    changes.push('Updated fragrance notes pyramid');
  }

  if (changes.length === 0) {
    changes.push('Saved perfume details (no field differences detected)');
  }
  return sanitizeAuditChanges(changes);
}

export function buildCampaignDiff(
  prev: SpecialCampaign,
  next: SpecialCampaign
): string[] {
  const changes: string[] = [];
  if (prev.enabled !== next.enabled) {
    changes.push(`Campaign Status: ${prev.enabled ? 'Live' : 'Paused'} → ${next.enabled ? 'Live' : 'Paused'}`);
  }
  if ((prev.heroMode ?? 'auto') !== (next.heroMode ?? 'auto')) {
    changes.push(`Hero Showcase Mode: ${prev.heroMode ?? 'auto'} → ${next.heroMode ?? 'auto'}`);
  }
  if (prev.title !== next.title) {
    changes.push(`Title: "${prev.title}" → "${next.title}"`);
  }
  if (prev.badgeText !== next.badgeText) {
    changes.push(`Badge: "${prev.badgeText}" → "${next.badgeText}"`);
  }
  if ((prev.newArrivalsTitle ?? 'New Arrivals') !== (next.newArrivalsTitle ?? 'New Arrivals')) {
    changes.push(
      `New Arrivals Title: "${prev.newArrivalsTitle ?? 'New Arrivals'}" → "${next.newArrivalsTitle ?? 'New Arrivals'}"`
    );
  }
  if ((prev.newArrivalsBadge ?? 'JUST LANDED') !== (next.newArrivalsBadge ?? 'JUST LANDED')) {
    changes.push(
      `New Arrivals Badge: "${prev.newArrivalsBadge ?? 'JUST LANDED'}" → "${next.newArrivalsBadge ?? 'JUST LANDED'}"`
    );
  }
  if ((prev.newArrivalsSubtitle ?? '') !== (next.newArrivalsSubtitle ?? '')) {
    changes.push('Updated New Arrivals hero subtitle');
  }
  if (prev.endsAt !== next.endsAt) {
    changes.push(
      `Countdown End: ${prev.endsAt ? new Date(prev.endsAt).toLocaleString() : 'None'} → ${
        next.endsAt ? new Date(next.endsAt).toLocaleString() : 'None'
      }`
    );
  }
  if (prev.promoCodeHint !== next.promoCodeHint) {
    changes.push(`Promo Hint: "${prev.promoCodeHint || 'None'}" → "${next.promoCodeHint || 'None'}"`);
  }
  if (prev.announcementText !== next.announcementText) {
    changes.push(`Announcement Banner updated`);
  }
  if (prev.subtitle !== next.subtitle) {
    changes.push(`Campaign Subtitle updated`);
  }
  if (changes.length === 0) {
    changes.push('Saved seasonal campaign configuration');
  }
  return sanitizeAuditChanges(changes);
}

export function buildWeeklySpecialDiff(
  prev: WeeklyFiveMlSpecial,
  next: WeeklyFiveMlSpecial,
  resolvePerfumeName: (id: string) => string
): string[] {
  const changes: string[] = [];
  if (prev.enabled !== next.enabled) {
    changes.push(
      `Weekly 5ml Special: ${prev.enabled ? 'Active' : 'Paused'} → ${next.enabled ? 'Active' : 'Paused'}`
    );
  }
  if (prev.autoRotateWeekly !== next.autoRotateWeekly) {
    changes.push(
      `Auto-Rotate Weekly: ${fmtBool(prev.autoRotateWeekly)} → ${fmtBool(next.autoRotateWeekly)}`
    );
  }
  if (prev.fourPackPrice !== next.fourPackPrice || prev.twoPackPrice !== next.twoPackPrice) {
    changes.push(
      `Bundle Pricing: 4-pack ${fmtPrice(prev.fourPackPrice)} / 2-pack ${fmtPrice(
        prev.twoPackPrice
      )} → 4-pack ${fmtPrice(next.fourPackPrice)} / 2-pack ${fmtPrice(next.twoPackPrice)}`
    );
  }
  if (prev.seedOffset !== next.seedOffset) {
    changes.push(`Rotation Seed Offset: ${prev.seedOffset} → ${next.seedOffset}`);
  }

  const fmtIds = (ids: string[]) =>
    ids.length > 0 ? ids.map(resolvePerfumeName).join(' & ') : 'Auto';

  if (prev.womenUnder500Ids.join(',') !== next.womenUnder500Ids.join(',')) {
    changes.push(`Women Under E500: ${fmtIds(next.womenUnder500Ids)}`);
  }
  if (prev.womenUnder800Ids.join(',') !== next.womenUnder800Ids.join(',')) {
    changes.push(`Women Under E800: ${fmtIds(next.womenUnder800Ids)}`);
  }
  if (prev.menUnder500Ids.join(',') !== next.menUnder500Ids.join(',')) {
    changes.push(`Men Under E500: ${fmtIds(next.menUnder500Ids)}`);
  }
  if (prev.menUnder800Ids.join(',') !== next.menUnder800Ids.join(',')) {
    changes.push(`Men Under E800: ${fmtIds(next.menUnder800Ids)}`);
  }
  if (prev.exclusiveEnabled !== next.exclusiveEnabled) {
    changes.push(
      `Exclusive 5ml Special: ${prev.exclusiveEnabled ? 'Active' : 'Paused'} → ${
        next.exclusiveEnabled ? 'Active' : 'Paused'
      }`
    );
  }
  if (prev.exclusiveTitle !== next.exclusiveTitle) {
    changes.push(`Exclusive Title: ${prev.exclusiveTitle} → ${next.exclusiveTitle}`);
  }
  if (
    prev.exclusiveBundleEnabled !== next.exclusiveBundleEnabled ||
    prev.exclusiveBundlePrice !== next.exclusiveBundlePrice
  ) {
    changes.push(
      `Exclusive Bundle: ${
        next.exclusiveBundleEnabled ? fmtPrice(next.exclusiveBundlePrice) : 'Disabled'
      }`
    );
  }
  const fmtExclusive = (items: WeeklyFiveMlSpecial['exclusiveItems']) =>
    items.length > 0
      ? items
          .map((it) => `${resolvePerfumeName(it.perfumeId)} (${fmtPrice(it.customPrice)})`)
          .join(', ')
      : 'None';
  if (fmtExclusive(prev.exclusiveItems ?? []) !== fmtExclusive(next.exclusiveItems ?? [])) {
    changes.push(`Exclusive 5ml Picks: ${fmtExclusive(next.exclusiveItems ?? [])}`);
  }

  if (changes.length === 0) {
    changes.push('Saved Weekly 5ml Special lineup');
  }
  return sanitizeAuditChanges(changes);
}

export function buildCouponDiff(
  prev: Coupon | undefined,
  next: Omit<Coupon, 'id'>
): string[] {
  if (!prev) {
    return sanitizeAuditChanges([
      `Discount: ${
        next.discountType === 'percentage'
          ? `${next.discountValue}% Off`
          : `${fmtPrice(next.discountValue)} Off`
      }`,
      `Applies to: ${next.appliesTo} · Min Order: ${fmtPrice(next.minOrderAmount)}`,
      `Status: ${next.active ? 'Active' : 'Inactive'}`,
      next.description ? `Description: ${next.description}` : '',
    ]);
  }
  const changes: string[] = [];
  if (
    prev.discountType !== next.discountType ||
    prev.discountValue !== next.discountValue
  ) {
    const beforeD =
      prev.discountType === 'percentage'
        ? `${prev.discountValue}%`
        : fmtPrice(prev.discountValue);
    const afterD =
      next.discountType === 'percentage'
        ? `${next.discountValue}%`
        : fmtPrice(next.discountValue);
    changes.push(`Discount: ${beforeD} → ${afterD}`);
  }
  if (prev.minOrderAmount !== next.minOrderAmount) {
    changes.push(
      `Min Order: ${fmtPrice(prev.minOrderAmount)} → ${fmtPrice(next.minOrderAmount)}`
    );
  }
  if (prev.appliesTo !== next.appliesTo) {
    changes.push(`Scope: ${prev.appliesTo} → ${next.appliesTo}`);
  }
  if (prev.active !== next.active) {
    changes.push(`Status: ${prev.active ? 'Active' : 'Inactive'} → ${next.active ? 'Active' : 'Inactive'}`);
  }
  if (prev.description !== next.description) {
    changes.push(`Description updated`);
  }
  if (changes.length === 0) changes.push('Updated coupon settings');
  return sanitizeAuditChanges(changes);
}

export function buildReferralDiff(
  prev: InfluencerReferral | undefined,
  next: Omit<InfluencerReferral, 'id'>
): string[] {
  if (!prev) {
    return sanitizeAuditChanges([
      `Influencer: ${next.influencerName}${next.socialHandle ? ` (${next.socialHandle})` : ''}`,
      `Commission: ${
        next.commissionType === 'percentage'
          ? `${next.commissionValue}% per sale`
          : `${fmtPrice(next.commissionValue)} per sale`
      }`,
      `Follower Perk: ${
        next.followerDiscountType === 'none'
          ? 'Track only (no discount)'
          : next.followerDiscountType === 'percentage'
          ? `${next.followerDiscountValue}% Off`
          : `${fmtPrice(next.followerDiscountValue)} Off`
      }`,
      `Status: ${next.active ? 'Active' : 'Paused'}`,
    ]);
  }
  const changes: string[] = [];
  if (prev.influencerName !== next.influencerName) {
    changes.push(`Influencer Name: "${prev.influencerName}" → "${next.influencerName}"`);
  }
  if (prev.socialHandle !== next.socialHandle) {
    changes.push(`Handle: "${prev.socialHandle || 'None'}" → "${next.socialHandle || 'None'}"`);
  }
  if (
    prev.commissionType !== next.commissionType ||
    prev.commissionValue !== next.commissionValue
  ) {
    const beforeC =
      prev.commissionType === 'percentage'
        ? `${prev.commissionValue}%`
        : fmtPrice(prev.commissionValue);
    const afterC =
      next.commissionType === 'percentage'
        ? `${next.commissionValue}%`
        : fmtPrice(next.commissionValue);
    changes.push(`Commission: ${beforeC} → ${afterC}`);
  }
  if (
    prev.followerDiscountType !== next.followerDiscountType ||
    prev.followerDiscountValue !== next.followerDiscountValue
  ) {
    const fmtF = (t: string, v: number) =>
      t === 'none' ? 'None' : t === 'percentage' ? `${v}% Off` : `${fmtPrice(v)} Off`;
    changes.push(
      `Follower Perk: ${fmtF(prev.followerDiscountType, prev.followerDiscountValue)} → ${fmtF(
        next.followerDiscountType,
        next.followerDiscountValue
      )}`
    );
  }
  if (prev.payoutNote !== next.payoutNote) {
    changes.push('Updated payout note');
  }
  if (prev.active !== next.active) {
    changes.push(`Status: ${prev.active ? 'Active' : 'Paused'} → ${next.active ? 'Active' : 'Paused'}`);
  }
  if (changes.length === 0) changes.push('Updated influencer referral settings');
  return sanitizeAuditChanges(changes);
}

export function buildComboDiff(
  prev: ComboDeal | undefined,
  next: Omit<ComboDeal, 'id'>
): string[] {
  if (!prev) {
    return sanitizeAuditChanges([
      `Perfumes: ${next.perfumeNames.join(' + ')}`,
      `Size: ${next.sizeLabel}`,
      `Price: ${fmtPrice(next.comboPrice)} (Regular ${fmtPrice(next.regularPrice)})`,
      `Featured: ${fmtBool(next.featured)} · Active: ${fmtBool(next.active)}`,
    ]);
  }
  const changes: string[] = [];
  if (prev.title !== next.title) changes.push(`Title: "${prev.title}" → "${next.title}"`);
  if (prev.perfumeNames.join('+') !== next.perfumeNames.join('+')) {
    changes.push(`Perfumes: ${prev.perfumeNames.join(' + ')} → ${next.perfumeNames.join(' + ')}`);
  }
  if (prev.sizeLabel !== next.sizeLabel) {
    changes.push(`Size Label: ${prev.sizeLabel} → ${next.sizeLabel}`);
  }
  if (prev.comboPrice !== next.comboPrice || prev.regularPrice !== next.regularPrice) {
    changes.push(
      `Price: ${fmtPrice(prev.comboPrice)} (reg ${fmtPrice(prev.regularPrice)}) → ${fmtPrice(
        next.comboPrice
      )} (reg ${fmtPrice(next.regularPrice)})`
    );
  }
  if (prev.active !== next.active) {
    changes.push(`Active: ${fmtBool(prev.active)} → ${fmtBool(next.active)}`);
  }
  if (prev.featured !== next.featured) {
    changes.push(`Featured: ${fmtBool(prev.featured)} → ${fmtBool(next.featured)}`);
  }
  if (changes.length === 0) changes.push('Updated combo deal details');
  return sanitizeAuditChanges(changes);
}

export function buildLayeringDiff(
  prev: LayeringIdea | undefined,
  next: Omit<LayeringIdea, 'id'>
): string[] {
  if (!prev) {
    return sanitizeAuditChanges([
      `Pair: ${next.basePerfumeName} + ${next.topPerfumeName}`,
      `Spray Ratio: ${next.sprayRatio}`,
      `Vibe: ${next.vibe} · Active: ${fmtBool(next.active)}`,
    ]);
  }
  const changes: string[] = [];
  if (prev.title !== next.title) changes.push(`Title: "${prev.title}" → "${next.title}"`);
  if (
    prev.basePerfumeName !== next.basePerfumeName ||
    prev.topPerfumeName !== next.topPerfumeName
  ) {
    changes.push(
      `Pair: ${prev.basePerfumeName} + ${prev.topPerfumeName} → ${next.basePerfumeName} + ${next.topPerfumeName}`
    );
  }
  if (prev.sprayRatio !== next.sprayRatio) {
    changes.push(`Ratio: ${prev.sprayRatio} → ${next.sprayRatio}`);
  }
  if (prev.active !== next.active) {
    changes.push(`Active: ${fmtBool(prev.active)} → ${fmtBool(next.active)}`);
  }
  if (changes.length === 0) changes.push('Updated layering idea details');
  return sanitizeAuditChanges(changes);
}

export function buildHamperDiff(
  prev: GiftHamper | undefined,
  next: Omit<GiftHamper, 'id'>
): string[] {
  if (!prev) {
    return sanitizeAuditChanges([
      `Occasion: ${next.occasion} · Availability: ${next.availability}`,
      `Price: ${fmtPrice(next.hamperPrice)} (Regular ${fmtPrice(next.regularPrice)})`,
      `Items (${next.itemsIncluded.length}): ${next.itemsIncluded.join(', ')}`,
      `Active: ${fmtBool(next.active)}`,
    ]);
  }
  const changes: string[] = [];
  if (prev.title !== next.title) changes.push(`Title: "${prev.title}" → "${next.title}"`);
  if (prev.occasion !== next.occasion) {
    changes.push(`Occasion: ${prev.occasion} → ${next.occasion}`);
  }
  if (prev.availability !== next.availability) {
    changes.push(`Availability: ${prev.availability} → ${next.availability}`);
  }
  if (prev.hamperPrice !== next.hamperPrice || prev.regularPrice !== next.regularPrice) {
    changes.push(
      `Price: ${fmtPrice(prev.hamperPrice)} (reg ${fmtPrice(prev.regularPrice)}) → ${fmtPrice(
        next.hamperPrice
      )} (reg ${fmtPrice(next.regularPrice)})`
    );
  }
  if (prev.itemsIncluded.join('|') !== next.itemsIncluded.join('|')) {
    changes.push(`Items updated (${next.itemsIncluded.length} included)`);
  }
  if (prev.active !== next.active) {
    changes.push(`Active: ${fmtBool(prev.active)} → ${fmtBool(next.active)}`);
  }
  if (prev.featured !== next.featured) {
    changes.push(`Featured: ${fmtBool(prev.featured)} → ${fmtBool(next.featured)}`);
  }
  if (changes.length === 0) changes.push('Updated gift hamper details');
  return sanitizeAuditChanges(changes);
}
