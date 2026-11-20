# AuraHut Co. Firestore Security Specification

## 1. Data Invariants
1. **Owner & Admin Catalogue Mutation**: Only an authenticated, email-verified AuraHut Co. administrator or an admin registered in `/admins/{uid}` by the primary owner may create, update, or delete documents in `/perfumes`, `/hampers`, `/coupons`, `/campaigns`, `/combos`, `/layeringIdeas`, `/weeklySpecials`, `/referrals`, `/publicReferrals`, `/referralSales`, or `/admins`.
2. **Identity & Timestamp Integrity**: Every created document must bind `ownerUid == request.auth.uid` (except strictly validated guest checkout attributions in `/referralAttributions`) and `createdAt == request.time`, `updatedAt == request.time` (or `updatedAt == request.time` for singleton config docs). On updates, `ownerUid` and `createdAt` are immutable, and `updatedAt == request.time` is enforced.
3. **Zero Coupon & Private Referral Exposure**:
   - Unauthenticated storefront guests may perform single-document `get` lookups on `/coupons/{couponId}` and `/publicReferrals/{referralId}` ONLY when the target document exists AND has `active == true`. Paused/inactive coupons and referral codes are denied even on direct `get`.
   - `/referrals/{referralId}` contains private creator commission rates (`commissionType`, `commissionValue`), `payoutNote`, and `ownerUid`, and is strictly readable and writable by verified store owners/admins only (`allow get, list: if isOwnerEmail()`).
   - `list` queries on `/coupons`, `/referrals`, `/publicReferrals`, `/referralAttributions`, `/referralSales`, and `/weeklySpecials` are strictly forbidden to non-owners.
4. **Referral Attribution & Commission Integrity**:
   - Storefront checkouts may only create a single new `/referralAttributions/{attributionId}` record when `!exists(...)`, `status == 'pending'`, `convertedSaleId == ''`, `ownerUid == 'guest-checkout'`, `createdAt == request.time`, `updatedAt == request.time`, and `/publicReferrals/{referralCode}.active == true`.
   - `/referralAttributions` records contain NO `commissionAmount` or `commissionStatus` fields and cannot be read, listed, updated, or deleted by non-owners.
   - `/referralSales/{saleId}` is strictly locked to verified store owners/admins for all reads and writes (`create`, `update`, `delete`). Guests cannot create or alter commission amounts, `commissionStatus`, or sales totals. Verified admins review attributions and authoritatively compute/confirm `referralSales` payouts.
5. **Immutable Admin Audit Trail**: Only verified admins may list, get, or append `/auditLogs/{logId}` documents. Each entry must bind `ownerUid == request.auth.uid`, `actorEmail.lower() == request.auth.token.email.lower()`, `createdAt == request.time`, bounded `changes` list (`<= 12` entries), and strict immutability (`allow update, delete: if false`).
6. **Strict Shape & Size Bounds**: Every string field enforces `.size()` limits, enums (`category`, `availability`, `discountType`, `appliesTo`, `role`, `commissionType`, `followerDiscountType`, `commissionStatus`, `source`, `status`, `action`, `section`) are strictly allowlisted, arrays (`notes.*`, `sizes`, `availableBranches`, `itemsIncluded`, `perfumeNames`, `under500Ids`, `under800Ids`, `womenUnder500Ids`, `womenUnder800Ids`, `menUnder500Ids`, `menUnder800Ids`, `changes`) validate bounds and multiple element indices, optional boolean `isUnboxed` is strictly typed, `twoPackPrice <= fourPackPrice` and `hamperPrice <= regularPrice` are enforced, and shadow keys are rejected via `keys().hasAll(...)` + `keys().hasOnly(...)` + `affectedKeys().hasOnly(...)`.

## 2. Adversarial ("Dirty Dozen") Test Vectors
1. Unauthenticated `create` on `/perfumes/test-1`, `/referralSales/sale-1`, or `/auditLogs/log-1` -> DENIED (`!isAdmin()`).
2. Signed-in non-owner user (`attacker@example.com`) `create` on `/perfumes/test-1`, `get` on `/referrals/NOMSA10`, or `list` on `/auditLogs` -> DENIED (`!isAdmin()` / `!isOwnerEmail()`).
3. Unverified email matching owner (`email_verified: false`) `update` on `/campaigns/active-special` or `/weeklySpecials/active-5ml` -> DENIED (`request.auth.token.email_verified == true` fails).
4. Owner attempting to inject ghost field `isVerified: true` into `/perfumes/p1` or `/auditLogs/log-1` -> DENIED (`keys().hasOnly(...)`).
5. Public guest attempting `get` on a paused `/coupons/OLD10` (`active: false`) or paused `/publicReferrals/PAUSE10` -> DENIED (`existing().active == true` fails).
6. Public guest attempting `get` on `/referrals/NOMSA10` (private commission profile) or `/referralAttributions/ra-1` -> DENIED (`!isOwnerEmail()`).
7. Guest attempting to overwrite an existing `/referralAttributions/ra-1`, submit `status: 'converted'`, or pass `commissionAmount` -> DENIED (`!exists(...)`, `keys().hasOnly(...)`, `status == 'pending'`).
8. Non-owner attempting `list` query on `/coupons`, `/referrals`, `/publicReferrals`, `/referralAttributions`, `/referralSales`, `/weeklySpecials`, or `/auditLogs` -> DENIED (`allow list: if isOwnerEmail()`).
9. Owner attempting `create` on `/coupons/SAVE10` with `code: "SAVE20"` mismatch (or `/publicReferrals/NOMSA10` mismatch) -> DENIED (`incoming().code == id`).
10. Admin attempting to spoof `actorEmail` in `/auditLogs/log-1` or update/delete an existing audit log -> DENIED (`actorEmail.lower() == request.auth.token.email.lower()` & `allow update, delete: if false`).
11. Owner attempting update with spoofed `createdAt` or `ownerUid` change -> DENIED (`incoming().createdAt == existing().createdAt` & `affectedKeys().hasOnly(...)`).
12. Owner attempting update with client-fabricated `updatedAt` timestamp or `twoPackPrice > fourPackPrice` -> DENIED (`incoming().updatedAt == request.time`).
