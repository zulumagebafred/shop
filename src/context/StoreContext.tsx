import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  EmailAuthProvider,
  User,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { fragranceCatalogue } from '../data/catalogue';
import {
  OWNER_EMAIL,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  Coupon,
  FragranceProduct,
  SpecialCampaign,
} from '../types/fragrance';

export const DEFAULT_CAMPAIGN: SpecialCampaign = {
  title: 'Black Friday Specials',
  badgeText: 'BLACK FRIDAY',
  subtitle:
    'Selected Arabian extraits and hand-poured discovery decants crafted for lasting daily wear.',
  announcementText:
    'Black Friday Specials — Limited savings on curated Arabian fragrances & decants.',
  promoCodeHint: '',
  endsAt: '',
  enabled: false,
};

export type PerfumeInput = Omit<FragranceProduct, 'id' | 'slug'> & {
  id?: string;
  slug?: string;
};

export type CouponInput = Omit<Coupon, 'id'>;

interface StoreContextValue {
  // Auth
  user: User | null;
  authReady: boolean;
  isOwner: boolean;
  signInOwnerWithGoogle: () => Promise<void>;
  signInOwnerWithPassword: (loginInput: string, password: string) => Promise<void>;
  sendOwnerPasswordReset: (loginInput: string) => Promise<string>;
  resendOwnerVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<boolean>;
  setOwnerPasswordCredential: (newPassword: string) => Promise<void>;
  signOutOwner: () => Promise<void>;

  // Live Catalogue & Specials
  perfumes: FragranceProduct[];
  livePerfumes: FragranceProduct[];
  usingSampleFallback: boolean;
  catalogueLoading: boolean;
  catalogueError: string | null;
  campaign: SpecialCampaign;
  coupons: Coupon[];
  couponsLoading: boolean;

  // Storefront Coupon Validation
  lookupCouponByCode: (
    rawCode: string
  ) => Promise<{ coupon: Coupon | null; error?: string }>;

  // Owner CRUD Actions
  savePerfume: (input: PerfumeInput, existingId?: string) => Promise<string>;
  deletePerfume: (perfumeId: string) => Promise<void>;
  togglePerfumeSpecial: (
    perfume: FragranceProduct,
    onSpecial: boolean,
    specialDiscountPercent?: number,
    specialLabel?: string
  ) => Promise<void>;
  importStarterCatalogue: () => Promise<number>;
  saveCoupon: (input: CouponInput, isEdit?: boolean) => Promise<void>;
  toggleCouponActive: (coupon: Coupon) => Promise<void>;
  deleteCoupon: (code: string) => Promise<void>;
  saveCampaign: (campaign: SpecialCampaign) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function slugifyId(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || `perfume-${Date.now()}`;
}

function sanitizeCouponCode(raw: string): string {
  return raw
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 32);
}

export function resolveAdminLoginEmail(loginInput: string): string {
  const cleaned = loginInput.trim().toLowerCase();
  if (!cleaned) return OWNER_EMAIL;
  if (cleaned.includes('@')) return cleaned;
  if (cleaned === 'zulumageba' || cleaned === 'zulumagebafred') return OWNER_EMAIL;
  return `${cleaned}@gmail.com`;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);

  const [livePerfumes, setLivePerfumes] = useState<FragranceProduct[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<SpecialCampaign>(DEFAULT_CAMPAIGN);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);

  const isOwner = useMemo(() => {
    void authRevision;
    return Boolean(
      user &&
        user.emailVerified &&
        user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()
    );
  }, [user, authRevision]);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAuthRevision((r) => r + 1);
    });
    return unsubscribe;
  }, []);

  // 2. Public Perfumes Listener
  useEffect(() => {
    const q = query(
      collection(db, 'perfumes'),
      where('availability', 'in', ['In Stock', 'Low Stock', 'Out of Stock', 'Pre-Order'])
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: FragranceProduct[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            slug: typeof d.slug === 'string' ? d.slug : docSnap.id,
            isSampleListing: Boolean(d.isSampleListing),
            name: String(d.name ?? ''),
            brand: String(d.brand ?? ''),
            category: d.category === 'Men' || d.category === 'Women' ? d.category : 'Unisex',
            concentration: String(d.concentration ?? 'Eau de Parfum'),
            description: String(d.description ?? ''),
            image: String(d.image ?? ''),
            notes: {
              top: Array.isArray(d.notes?.top) ? d.notes.top.map(String) : [],
              heart: Array.isArray(d.notes?.heart) ? d.notes.heart.map(String) : [],
              base: Array.isArray(d.notes?.base) ? d.notes.base.map(String) : [],
            },
            sizes: Array.isArray(d.sizes)
              ? d.sizes.map((s) => ({
                  size: s.size,
                  price: typeof s.price === 'number' ? s.price : null,
                  available: Boolean(s.available),
                }))
              : [],
            availability: d.availability ?? 'In Stock',
            featured: Boolean(d.featured),
            bestseller: Boolean(d.bestseller),
            onSpecial: Boolean(d.onSpecial),
            specialLabel: typeof d.specialLabel === 'string' ? d.specialLabel : '',
            specialDiscountPercent:
              typeof d.specialDiscountPercent === 'number'
                ? d.specialDiscountPercent
                : 0,
          };
        });
        items.sort((a, b) => a.name.localeCompare(b.name));
        setLivePerfumes(items);
        setCatalogueError(null);
        setCatalogueLoading(false);
      },
      (error) => {
        setCatalogueLoading(false);
        setCatalogueError(
          error instanceof Error ? error.message : 'Unable to sync live catalogue.'
        );
        try {
          handleFirestoreError(error, OperationType.LIST, 'perfumes');
        } catch {
          // Diagnostic error already logged inside handleFirestoreError
        }
      }
    );
    return unsubscribe;
  }, [isOwner]);

  // 3. Public Campaign Listener (Black Friday / Seasonal Special)
  useEffect(() => {
    const ref = doc(db, 'campaigns', 'active-special');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setCampaign({
            title: String(d.title ?? DEFAULT_CAMPAIGN.title),
            badgeText: String(d.badgeText ?? DEFAULT_CAMPAIGN.badgeText),
            subtitle: String(d.subtitle ?? DEFAULT_CAMPAIGN.subtitle),
            announcementText: String(d.announcementText ?? ''),
            promoCodeHint: String(d.promoCodeHint ?? ''),
            endsAt: String(d.endsAt ?? ''),
            enabled: Boolean(d.enabled),
          });
        } else {
          setCampaign(DEFAULT_CAMPAIGN);
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'campaigns/active-special');
        } catch {
          // Diagnostic error already logged inside handleFirestoreError
        }
      }
    );
    return unsubscribe;
  }, []);

  // 4. Owner-Only Coupons Listener
  useEffect(() => {
    if (!authReady || !isOwner) {
      setCoupons([]);
      setCouponsLoading(false);
      return;
    }

    setCouponsLoading(true);
    const q = query(collection(db, 'coupons'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Coupon[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            code: String(d.code ?? docSnap.id),
            description: String(d.description ?? ''),
            discountType: d.discountType === 'fixed' ? 'fixed' : 'percentage',
            discountValue: Number(d.discountValue ?? 0),
            minOrderAmount: Number(d.minOrderAmount ?? 0),
            appliesTo:
              d.appliesTo === 'specials' || d.appliesTo === 'full-bottles'
                ? d.appliesTo
                : 'all',
            active: Boolean(d.active),
          };
        });
        items.sort((a, b) => a.code.localeCompare(b.code));
        setCoupons(items);
        setCouponsLoading(false);
      },
      (error) => {
        setCouponsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'coupons');
        } catch {
          // Diagnostic error already logged inside handleFirestoreError
        }
      }
    );

    return unsubscribe;
  }, [authReady, isOwner]);

  const usingSampleFallback = !catalogueLoading && livePerfumes.length === 0;
  const perfumes = livePerfumes.length > 0 ? livePerfumes : fragranceCatalogue;

  const signInOwnerWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInOwnerWithPassword = async (loginInput: string, password: string) => {
    const email = resolveAdminLoginEmail(loginInput);
    if (!password) {
      throw new Error('Please enter your admin password.');
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const sendOwnerPasswordReset = async (loginInput: string): Promise<string> => {
    const email = resolveAdminLoginEmail(loginInput);
    await sendPasswordResetEmail(auth, email);
    return email;
  };

  const resendOwnerVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('Sign in first before sending verification email.');
    }
    await sendEmailVerification(auth.currentUser);
  };

  const refreshAuthUser = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    setUser(auth.currentUser);
    setAuthRevision((r) => r + 1);
    return Boolean(auth.currentUser.emailVerified);
  };

  const setOwnerPasswordCredential = async (newPassword: string) => {
    const current = auth.currentUser;
    if (!current || !current.email) {
      throw new Error('You must be signed in as the store owner.');
    }
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const hasPasswordProvider = current.providerData.some(
      (p) => p.providerId === 'password'
    );
    if (hasPasswordProvider) {
      await updatePassword(current, newPassword);
    } else {
      const cred = EmailAuthProvider.credential(current.email, newPassword);
      await linkWithCredential(current, cred);
    }
    setAuthRevision((r) => r + 1);
  };

  const signOutOwner = async () => {
    await signOut(auth);
  };

  const lookupCouponByCode = async (
    rawCode: string
  ): Promise<{ coupon: Coupon | null; error?: string }> => {
    const code = sanitizeCouponCode(rawCode);
    if (code.length < 2) {
      return { coupon: null, error: 'Enter a valid coupon code (letters/numbers).' };
    }
    const path = `coupons/${code}`;
    try {
      const snap = await getDoc(doc(db, 'coupons', code));
      if (!snap.exists()) {
        return { coupon: null, error: `Coupon code "${code}" was not found.` };
      }
      const d = snap.data();
      const coupon: Coupon = {
        id: snap.id,
        code: String(d.code ?? snap.id),
        description: String(d.description ?? ''),
        discountType: d.discountType === 'fixed' ? 'fixed' : 'percentage',
        discountValue: Number(d.discountValue ?? 0),
        minOrderAmount: Number(d.minOrderAmount ?? 0),
        appliesTo:
          d.appliesTo === 'specials' || d.appliesTo === 'full-bottles'
            ? d.appliesTo
            : 'all',
        active: Boolean(d.active),
      };
      if (!coupon.active) {
        return { coupon: null, error: `Coupon "${code}" is not active right now.` };
      }
      return { coupon };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  };

  const requireOwnerUid = (): string => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isOwner) {
      throw new Error('Owner authorization required.');
    }
    return uid;
  };

  const savePerfume = async (
    input: PerfumeInput,
    existingId?: string
  ): Promise<string> => {
    const ownerUid = requireOwnerUid();
    const id = existingId || `${slugifyId(input.name)}-${Date.now().toString(36)}`;
    const slug = (input.slug?.trim() || slugifyId(`${input.brand}-${input.name}`)).slice(0, 160);

    const cleanName = input.name.trim().slice(0, 140);
    const cleanBrand = input.brand.trim().slice(0, 100);
    if (!cleanName) {
      throw new Error('Perfume name is required.');
    }
    if (!cleanBrand) {
      throw new Error('Perfume house / brand is required.');
    }

    const sanitizedSizes = input.sizes
      .slice(0, 12)
      .map((s) => ({
        size: String(s.size ?? '').trim().slice(0, 24),
        price:
          s.price !== null &&
          s.price !== undefined &&
          Number.isFinite(Number(s.price)) &&
          Number(s.price) >= 0
            ? Math.min(100000, Number(s.price))
            : null,
        available: Boolean(s.available),
      }))
      .filter((s) => s.size.length > 0);

    if (sanitizedSizes.length === 0) {
      throw new Error('At least one bottle size must be configured.');
    }

    const cleanNotes = (arr: string[]) =>
      arr
        .map((n) => n.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 10);

    const parsedDiscount = Number(input.specialDiscountPercent ?? 0);
    const safeDiscount = Number.isFinite(parsedDiscount)
      ? Math.min(90, Math.max(0, parsedDiscount))
      : 0;

    const cleanDescription = (
      input.description.trim() ||
      `${cleanName} by ${cleanBrand} — curated Arabian fragrance.`
    ).slice(0, 2000);

    const ref = doc(db, 'perfumes', id);
    const path = `perfumes/${id}`;

    const basePayload = {
      slug,
      isSampleListing: Boolean(input.isSampleListing),
      name: cleanName,
      brand: cleanBrand,
      category: input.category,
      concentration: (input.concentration.trim() || 'Eau de Parfum').slice(0, 100),
      description: cleanDescription,
      image: input.image.trim().slice(0, 500),
      notes: {
        top: cleanNotes(input.notes.top),
        heart: cleanNotes(input.notes.heart),
        base: cleanNotes(input.notes.base),
      },
      sizes: sanitizedSizes,
      availability: input.availability,
      featured: Boolean(input.featured),
      bestseller: Boolean(input.bestseller),
      onSpecial: Boolean(input.onSpecial),
      specialLabel: (input.specialLabel ?? '').trim().slice(0, 60),
      specialDiscountPercent: safeDiscount,
      updatedAt: serverTimestamp(),
    };

    try {
      if (existingId) {
        await setDoc(ref, basePayload, { merge: true });
      } else {
        await setDoc(ref, {
          ...basePayload,
          ownerUid,
          createdAt: serverTimestamp(),
        });
      }
      return id;
    } catch (error) {
      handleFirestoreError(
        error,
        existingId ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  };

  const togglePerfumeSpecial = async (
    perfume: FragranceProduct,
    onSpecial: boolean,
    specialDiscountPercent?: number,
    specialLabel?: string
  ): Promise<void> => {
    requireOwnerUid();
    const path = `perfumes/${perfume.id}`;
    try {
      await setDoc(
        doc(db, 'perfumes', perfume.id),
        {
          onSpecial,
          specialDiscountPercent: Math.min(
            90,
            Math.max(
              0,
              specialDiscountPercent ?? perfume.specialDiscountPercent ?? 0
            )
          ),
          specialLabel: (
            specialLabel ??
            perfume.specialLabel ??
            campaign.badgeText ??
            'Special Offer'
          )
            .trim()
            .slice(0, 60),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deletePerfume = async (perfumeId: string): Promise<void> => {
    requireOwnerUid();
    const path = `perfumes/${perfumeId}`;
    try {
      await deleteDoc(doc(db, 'perfumes', perfumeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const importStarterCatalogue = async (): Promise<number> => {
    const ownerUid = requireOwnerUid();
    const batch = writeBatch(db);
    try {
      for (const item of fragranceCatalogue) {
        const ref = doc(db, 'perfumes', item.id);
        batch.set(ref, {
          slug: item.slug.slice(0, 160),
          isSampleListing: true,
          name: item.name.slice(0, 140),
          brand: item.brand.slice(0, 100),
          category: item.category,
          concentration: item.concentration.slice(0, 100),
          description: item.description.slice(0, 2000),
          image: item.image.slice(0, 500),
          notes: {
            top: item.notes.top.slice(0, 10),
            heart: item.notes.heart.slice(0, 10),
            base: item.notes.base.slice(0, 10),
          },
          sizes: item.sizes.slice(0, 12),
          availability: item.availability,
          featured: item.featured,
          bestseller: item.bestseller,
          onSpecial: false,
          specialLabel: '',
          specialDiscountPercent: 0,
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      return fragranceCatalogue.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'perfumes');
    }
  };

  const saveCoupon = async (input: CouponInput, isEdit = false): Promise<void> => {
    const ownerUid = requireOwnerUid();
    const code = sanitizeCouponCode(input.code);
    if (code.length < 2) {
      throw new Error('Coupon code must be at least 2 characters (A-Z, 0-9, -, _).');
    }
    const maxVal = input.discountType === 'percentage' ? 95 : 50000;
    const discountValue = Math.min(maxVal, Math.max(1, Number(input.discountValue)));
    const minOrderAmount = Math.min(100000, Math.max(0, Number(input.minOrderAmount || 0)));

    const ref = doc(db, 'coupons', code);
    const path = `coupons/${code}`;
    const existingSnap = isEdit ? await getDoc(ref) : null;

    try {
      if (isEdit && existingSnap?.exists()) {
        await setDoc(
          ref,
          {
            description: input.description.trim().slice(0, 200),
            discountType: input.discountType,
            discountValue,
            minOrderAmount,
            appliesTo: input.appliesTo,
            active: Boolean(input.active),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await setDoc(ref, {
          code,
          description: input.description.trim().slice(0, 200),
          discountType: input.discountType,
          discountValue,
          minOrderAmount,
          appliesTo: input.appliesTo,
          active: Boolean(input.active),
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(
        error,
        isEdit ? OperationType.UPDATE : OperationType.CREATE,
        path
      );
    }
  };

  const toggleCouponActive = async (coupon: Coupon): Promise<void> => {
    requireOwnerUid();
    const path = `coupons/${coupon.code}`;
    try {
      await setDoc(
        doc(db, 'coupons', coupon.code),
        {
          active: !coupon.active,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteCoupon = async (code: string): Promise<void> => {
    requireOwnerUid();
    const clean = sanitizeCouponCode(code);
    const path = `coupons/${clean}`;
    try {
      await deleteDoc(doc(db, 'coupons', clean));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const saveCampaign = async (next: SpecialCampaign): Promise<void> => {
    const ownerUid = requireOwnerUid();
    const ref = doc(db, 'campaigns', 'active-special');
    const path = 'campaigns/active-special';
    try {
      const existing = await getDoc(ref);
      const rawEndsAt = String(next.endsAt ?? '').trim();
      const parsedEnd = rawEndsAt ? new Date(rawEndsAt) : null;
      const cleanEndsAt =
        parsedEnd && !Number.isNaN(parsedEnd.getTime())
          ? parsedEnd.toISOString().slice(0, 64)
          : '';

      const payload = {
        title: (next.title.trim() || 'Special Offers').slice(0, 100),
        badgeText: (next.badgeText.trim() || 'SPECIAL').slice(0, 40),
        subtitle: next.subtitle.trim().slice(0, 400),
        announcementText: next.announcementText.trim().slice(0, 240),
        promoCodeHint: sanitizeCouponCode(next.promoCodeHint).slice(0, 32),
        endsAt: cleanEndsAt,
        enabled: Boolean(next.enabled),
        updatedAt: serverTimestamp(),
      };
      if (existing.exists()) {
        await setDoc(ref, payload, { merge: true });
      } else {
        await setDoc(ref, { ...payload, ownerUid });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const value: StoreContextValue = {
    user,
    authReady,
    isOwner,
    signInOwnerWithGoogle,
    signInOwnerWithPassword,
    sendOwnerPasswordReset,
    resendOwnerVerificationEmail,
    refreshAuthUser,
    setOwnerPasswordCredential,
    signOutOwner,
    perfumes,
    livePerfumes,
    usingSampleFallback,
    catalogueLoading,
    catalogueError,
    campaign,
    coupons,
    couponsLoading,
    lookupCouponByCode,
    savePerfume,
    deletePerfume,
    togglePerfumeSpecial,
    importStarterCatalogue,
    saveCoupon,
    toggleCouponActive,
    deleteCoupon,
    saveCampaign,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside a StoreProvider.');
  }
  return ctx;
}
