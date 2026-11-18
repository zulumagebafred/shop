# AuraHut Co. Firestore Security Specification

## 1. Data Invariants
1. **Owner & Admin Catalogue Mutation**: Only an authenticated, email-verified AuraHut Co. administrator (`zulumagebafred@gmail.com`, `tese.khumalo@gmail.com`) or an admin registered in `/admins/{uid}` by the primary owner may create, update, or delete documents in `/perfumes`, `/hampers`, `/coupons`, `/campaigns`, `/combos`, `/layeringIdeas`, `/weeklySpecials`, or `/admins`.
2. **Identity & Timestamp Integrity**: Every created document must bind `ownerUid == request.auth.uid` and `createdAt == request.time`, `updatedAt == request.time` (or `updatedAt == request.time` for singleton config docs). On updates, `ownerUid` and `createdAt` are immutable, and `updatedAt == request.time` is enforced.
3. **Zero Coupon Scraping**: Unauthenticated storefront guests may perform single-document `get` lookups on `/coupons/{couponId}` only when they know an exact valid coupon code ID, but `list` queries on `/coupons` and `/weeklySpecials` are strictly forbidden to non-owners.
4. **Strict Shape & Size Bounds**: Every string field enforces `.size()` limits, enums (`category`, `availability`, `discountType`, `appliesTo`, `role`) are strictly allowlisted, arrays (`notes.*`, `sizes`, `availableBranches`, `itemsIncluded`, `under500Ids`, `under800Ids`, `womenUnder500Ids`, `womenUnder800Ids`, `menUnder500Ids`, `menUnder800Ids`) are bounded (`availableBranches` limited to `['manzini', 'mbabane']` and max 2 items), optional boolean `isUnboxed` is strictly typed, `twoPackPrice <= fourPackPrice` and `hamperPrice <= regularPrice` are enforced, and shadow keys are rejected via `keys().hasAll(...)` + `keys().hasOnly(...)` + `affectedKeys().hasOnly(...)`.

## 2. Adversarial ("Dirty Dozen") Test Vectors
1. Unauthenticated `create` on `/perfumes/test-1` -> DENIED (`!isAdmin()`).
2. Signed-in non-owner user (`attacker@example.com`) `create` on `/perfumes/test-1` -> DENIED (`!isAdmin()`).
3. Unverified email matching owner (`email_verified: false`) `update` on `/campaigns/active-special` or `/weeklySpecials/active-5ml` -> DENIED (`request.auth.token.email_verified == true` fails).
4. Owner attempting to inject ghost field `isVerified: true` into `/perfumes/p1` or `/weeklySpecials/active-5ml` -> DENIED (`keys().hasOnly(...)`).
5. Owner attempting to inject >2000 char description into `/perfumes/p1` -> DENIED (`.size() <= 2000`).
6. Owner attempting to inject invalid document ID `../etc/passwd` -> DENIED (`isValidId`).
7. Non-owner attempting `list` query on `/coupons` or `/weeklySpecials` -> DENIED (`allow list: if isOwnerEmail()`).
8. Owner attempting `create` on `/coupons/SAVE10` with `code: "SAVE20"` mismatch -> DENIED (`incoming().code == couponId`).
9. Owner attempting percentage coupon `discountValue: 110` (>95%) -> DENIED.
10. Non-owner attempting to register themselves in `/admins/{uid}` -> DENIED (`allow create: if isOwnerEmail()`).
11. Owner attempting update with spoofed `createdAt` or `ownerUid` change -> DENIED (`incoming().createdAt == existing().createdAt` & `affectedKeys().hasOnly(...)`).
12. Owner attempting update with client-fabricated `updatedAt` timestamp or `twoPackPrice > fourPackPrice` -> DENIED (`incoming().updatedAt == request.time`).
