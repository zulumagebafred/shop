# AuraHut Co. Firestore Security Specification

## 1. Data Invariants
1. **Owner-Only Catalogue Mutation**: Only an authenticated, email-verified Owner (`zulumagebafred@gmail.com`) or an admin registered in `/admins/{uid}` by that owner may create, update, or delete documents in `/perfumes`, `/coupons`, `/campaigns`, or `/admins`.
2. **Identity & Timestamp Integrity**: Every created document must bind `ownerUid == request.auth.uid` and `createdAt == request.time`, `updatedAt == request.time`. On updates, `ownerUid` and `createdAt` are immutable, and `updatedAt == request.time` is enforced.
3. **Zero Coupon Scraping**: Unauthenticated storefront guests may perform single-document `get` lookups on `/coupons/{couponId}` only when they know an exact valid coupon code ID, but `list` queries on `/coupons` are strictly forbidden to non-owners.
4. **Strict Shape & Size Bounds**: Every string field enforces `.size()` limits, enums (`category`, `availability`, `discountType`, `appliesTo`, `role`) are strictly allowlisted, arrays (`notes.*`, `sizes`) are bounded, and shadow keys are rejected via `keys().hasAll(...)` + `keys().hasOnly(...)` + `affectedKeys().hasOnly(...)`.

## 2. Adversarial ("Dirty Dozen") Test Vectors
1. Unauthenticated `create` on `/perfumes/test-1` -> DENIED (`!isAdmin()`).
2. Signed-in non-owner user (`attacker@example.com`) `create` on `/perfumes/test-1` -> DENIED (`!isAdmin()`).
3. Unverified email matching owner (`email_verified: false`) `update` on `/campaigns/active-special` -> DENIED (`request.auth.token.email_verified == true` fails).
4. Owner attempting to inject ghost field `isVerified: true` into `/perfumes/p1` -> DENIED (`keys().hasOnly(...)`).
5. Owner attempting to inject >2000 char description into `/perfumes/p1` -> DENIED (`.size() <= 2000`).
6. Owner attempting to inject invalid document ID `../etc/passwd` -> DENIED (`isValidId`).
7. Non-owner attempting `list` query on `/coupons` to scrape all promo codes -> DENIED (`allow list: if isOwnerEmail()`).
8. Owner attempting `create` on `/coupons/SAVE10` with `code: "SAVE20"` mismatch -> DENIED (`incoming().code == couponId`).
9. Owner attempting percentage coupon `discountValue: 110` (>95%) -> DENIED.
10. Non-owner attempting to register themselves in `/admins/{uid}` -> DENIED (`allow create: if isOwnerEmail()`).
11. Owner attempting update with spoofed `createdAt` or `ownerUid` change -> DENIED (`incoming().createdAt == existing().createdAt` & `affectedKeys().hasOnly(...)`).
12. Owner attempting update with client-fabricated `updatedAt` timestamp -> DENIED (`incoming().updatedAt == request.time`).
