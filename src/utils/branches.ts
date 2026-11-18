import { BranchId, FragranceProduct } from '../types/fragrance';

export const ALL_BRANCH_IDS: readonly BranchId[] = ['manzini', 'mbabane'];

export function normalizeBranches(raw: unknown): BranchId[] {
  if (!Array.isArray(raw)) return [];
  const valid = new Set<BranchId>();
  for (const item of raw) {
    if (item === 'manzini' || item === 'mbabane') {
      valid.add(item);
    }
  }
  return ALL_BRANCH_IDS.filter((id) => valid.has(id));
}

export function getAvailableBranches(product: FragranceProduct): BranchId[] {
  if (product.availability === 'Out of Stock') {
    return [];
  }
  if (Array.isArray(product.availableBranches)) {
    return normalizeBranches(product.availableBranches);
  }
  return [...ALL_BRANCH_IDS];
}

export function isAvailableAtBranch(
  product: FragranceProduct,
  branchId: BranchId
): boolean {
  return getAvailableBranches(product).includes(branchId);
}

export function getSingleBranchExclusive(
  product: FragranceProduct
): BranchId | null {
  const branches = getAvailableBranches(product);
  if (branches.length === 1) {
    return branches[0];
  }
  return null;
}

export function formatBranchName(branchId: BranchId): string {
  return branchId === 'manzini' ? 'Manzini' : 'Mbabane';
}

export function getBranchAvailabilityLabel(product: FragranceProduct): string {
  const branches = getAvailableBranches(product);
  if (branches.length === 0) return 'Out of Stock';
  if (branches.length === 2) return 'Manzini & Mbabane';
  return `${formatBranchName(branches[0])} Only`;
}
