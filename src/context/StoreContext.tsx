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
  starterCombos,
  starterLayeringIdeas,
} from '../data/combosAndLayering';
import {
  OWNER_EMAIL,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  ComboDeal,
  Coupon,
  FragranceProduct,
  LayeringIdea,
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
export type ComboInput = Omit<ComboDeal, 'id'>;
export type LayeringIdeaInput = Omit<LayeringIdea, 'id'>;

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
  campaignLoading: boolean;
  coupons: Coupon[];
  couponsLoading: boolean;

  // Combos & Layering
  combos: ComboDeal[];
  liveCombos: ComboDeal[];
  usingSampleCombos: boolean;
  combosLoading: boolean;
  layeringIdeas: LayeringIdea[];
  liveLayeringIdeas: LayeringIdea[];
  usingSampleLayering: boolean;
  layeringLoading: boolean;

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
  saveComboDeal: (input: ComboInput, existingId?: string) => Promise<string>;
  deleteComboDeal: (comboId: string) => Promise<void>;
  saveLayeringIdea: (input: LayeringIdeaInput, existingId?: string) => Promise<string>;
  deleteLayeringIdea: (ideaId: string) => Promise<void>;
  importStarterCombosAndLayering: () => Promise<number>;
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

const CAMPAIGN_CACHE_KEY = 'aurahut_campaign_cache_v1';
const PERFUMES_CACHE_KEY = 'aurahut_perfumes_cache_v1';
const COMBOS_CACHE_KEY = 'aurahut_combos_cache_v1';
const LAYERING_CACHE_KEY = 'aurahut_layering_cache_v1';

function readCachedCampaign(): SpecialCampaign | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SpecialCampaign>;
    if (typeof parsed.enabled !== 'boolean') return null;
    return {
      title: String(parsed.title ?? DEFAULT_CAMPAIGN.title),
      badgeText: String(parsed.badgeText ?? DEFAULT_CAMPAIGN.badgeText),
      subtitle: String(parsed.subtitle ?? DEFAULT_CAMPAIGN.subtitle),
      announcementText: String(parsed.announcementText ?? ''),
      promoCodeHint: String(parsed.promoCodeHint ?? ''),
      endsAt: String(parsed.endsAt ?? ''),
      enabled: parsed.enabled,
    };
  } catch {
    return null;
  }
}

function normalizeAndDedupeSizes(
  rawSizes: unknown
): { size: string; price: number | null; available: boolean }[] {
  if (!Array.isArray(rawSizes)) return [];
  const byKey = new Map<
    string,
    { size: string; price: number | null; available: boolean }
  >();

  for (const entry of rawSizes) {
    if (!entry || typeof entry !== 'object') continue;
    const s = entry as { size?: unknown; price?: unknown; available?: unknown };
    const cleanSize = String(s.size ?? '').trim().slice(0, 24);
    if (!cleanSize) continue;
    const parsedPrice =
      s.price !== null &&
      s.price !== undefined &&
      Number.isFinite(Number(s.price)) &&
      Number(s.price) >= 0
        ? Math.min(100000, Number(s.price))
        : null;
    const available = Boolean(s.available);
    const dedupeKey = cleanSize.toLowerCase();
    const existing = byKey.get(dedupeKey);

    if (!existing) {
      byKey.set(dedupeKey, { size: cleanSize, price: parsedPrice, available });
    } else {
      const nextAvailable = existing.available || available;
      const nextPrice =
        parsedPrice !== null && (available || existing.price === null)
          ? parsedPrice
          : existing.price;
      byKey.set(dedupeKey, {
        size: existing.size,
        price: nextPrice,
        available: nextAvailable,
      });
    }
  }

  return Array.from(byKey.values());
}

function readCachedPerfumes(): FragranceProduct[] {
  try {
    const raw = localStorage.getItem(PERFUMES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (parsed as FragranceProduct[]).map((item) => ({
        ...item,
        sizes: normalizeAndDedupeSizes(item.sizes),
      }));
    }
  } catch {
    // Ignore cache parse errors
  }
  return [];
}

function readCachedCombos(): ComboDeal[] {
  try {
    const raw = localStorage.getItem(COMBOS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ComboDeal[];
  } catch {
    // Ignore cache parse errors
  }
  return [];
}

function readCachedLayering(): LayeringIdea[] {
  try {
    const raw = localStorage.getItem(LAYERING_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as LayeringIdea[];
  } catch {
    // Ignore cache parse errors
  }
  return [];
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const initialCachedPerfumes = useMemo(() => readCachedPerfumes(), []);
  const initialCachedCampaign = useMemo(() => readCachedCampaign(), []);
  const initialCachedCombos = useMemo(() => readCachedCombos(), []);
  const initialCachedLayering = useMemo(() => readCachedLayering(), []);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);

  const [livePerfumes, setLivePerfumes] = useState<FragranceProduct[]>(initialCachedPerfumes);
  const [catalogueLoading, setCatalogueLoading] = useState(initialCachedPerfumes.length === 0);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<SpecialCampaign>(
    initialCachedCampaign ?? DEFAULT_CAMPAIGN
  );
  const [campaignLoading, setCampaignLoading] = useState(initialCachedCampaign === null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);

  const [liveCombos, setLiveCombos] = useState<ComboDeal[]>(initialCachedCombos);
  const [combosLoading, setCombosLoading] = useState(initialCachedCombos.length === 0);
  const [liveLayeringIdeas, setLiveLayeringIdeas] = useState<LayeringIdea[]>(initialCachedLayering);
  const [layeringLoading, setLayeringLoading] = useState(initialCachedLayering.length === 0);

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
            sizes: normalizeAndDedupeSizes(d.sizes),
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
        try {
          if (items.length > 0) {
            localStorage.setItem(PERFUMES_CACHE_KEY, JSON.stringify(items));
          } else {
            localStorage.removeItem(PERFUMES_CACHE_KEY);
          }
        } catch {
          // Ignore storage quota errors
        }
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
    const safetyTimer = window.setTimeout(() => {
      setCatalogueLoading(false);
    }, 2500);
    return () => {
      unsubscribe();
      window.clearTimeout(safetyTimer);
    };
  }, [isOwner]);

  // 3. Public Campaign Listener (Black Friday / Seasonal Special)
  useEffect(() => {
    const ref = doc(db, 'campaigns', 'active-special');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const nextCampaign: SpecialCampaign = snap.exists()
          ? (() => {
              const d = snap.data();
              return {
                title: String(d.title ?? DEFAULT_CAMPAIGN.title),
                badgeText: String(d.badgeText ?? DEFAULT_CAMPAIGN.badgeText),
                subtitle: String(d.subtitle ?? DEFAULT_CAMPAIGN.subtitle),
                announcementText: String(d.announcementText ?? ''),
                promoCodeHint: String(d.promoCodeHint ?? ''),
                endsAt: String(d.endsAt ?? ''),
                enabled: Boolean(d.enabled),
              };
            })()
          : DEFAULT_CAMPAIGN;
        setCampaign(nextCampaign);
        setCampaignLoading(false);
        try {
          localStorage.setItem(CAMPAIGN_CACHE_KEY, JSON.stringify(nextCampaign));
        } catch {
          // Ignore storage quota errors
        }
      },
      (error) => {
        setCampaignLoading(false);
        try {
          handleFirestoreError(error, OperationType.GET, 'campaigns/active-special');
        } catch {
          // Diagnostic error already logged inside handleFirestoreError
        }
      }
    );
    const safetyTimer = window.setTimeout(() => {
      setCampaignLoading(false);
    }, 2500);
    return () => {
      unsubscribe();
      window.clearTimeout(safetyTimer);
    };
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

  // 5. Public Combos Listener
  useEffect(() => {
    const combosQuery = isOwner
      ? query(collection(db, 'combos'))
      : query(collection(db, 'combos'), where('active', '==', true));

    const unsubscribe = onSnapshot(
      combosQuery,
      (snapshot) => {
        const items: ComboDeal[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            title: String(d.title ?? ''),
            subtitle: String(d.subtitle ?? ''),
            perfumeNames: Array.isArray(d.perfumeNames)
              ? d.perfumeNames.map(String)
              : [],
            sizeLabel: String(d.sizeLabel ?? ''),
            regularPrice: Number(d.regularPrice ?? 0),
            comboPrice: Number(d.comboPrice ?? 0),
            tag: String(d.tag ?? ''),
            featured: Boolean(d.featured),
            active: Boolean(d.active),
          };
        });
        items.sort((a, b) => Number(b.featured) - Number(a.featured));
        setLiveCombos(items);
        setCombosLoading(false);
        try {
          if (items.length > 0) {
            localStorage.setItem(COMBOS_CACHE_KEY, JSON.stringify(items));
          } else {
            localStorage.removeItem(COMBOS_CACHE_KEY);
          }
        } catch {
          // Ignore storage quota errors
        }
      },
      (error) => {
        setCombosLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'combos');
        } catch {
          // Diagnostic error logged
        }
      }
    );

    const safetyTimer = window.setTimeout(() => {
      setCombosLoading(false);
    }, 2500);

    return () => {
      unsubscribe();
      window.clearTimeout(safetyTimer);
    };
  }, [isOwner]);

  // 6. Public Layering Ideas Listener
  useEffect(() => {
    const layeringQuery = isOwner
      ? query(collection(db, 'layeringIdeas'))
      : query(collection(db, 'layeringIdeas'), where('active', '==', true));

    const unsubscribe = onSnapshot(
      layeringQuery,
      (snapshot) => {
        const items: LayeringIdea[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            title: String(d.title ?? ''),
            vibe: String(d.vibe ?? ''),
            basePerfumeName: String(d.basePerfumeName ?? ''),
            topPerfumeName: String(d.topPerfumeName ?? ''),
            sprayRatio: String(d.sprayRatio ?? ''),
            occasion: String(d.occasion ?? ''),
            whyItWorks: String(d.whyItWorks ?? ''),
            active: Boolean(d.active),
          };
        });
        items.sort((a, b) => a.title.localeCompare(b.title));
        setLiveLayeringIdeas(items);
        setLayeringLoading(false);
        try {
          if (items.length > 0) {
            localStorage.setItem(LAYERING_CACHE_KEY, JSON.stringify(items));
          } else {
            localStorage.removeItem(LAYERING_CACHE_KEY);
          }
        } catch {
          // Ignore storage quota errors
        }
      },
      (error) => {
        setLayeringLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'layeringIdeas');
        } catch {
          // Diagnostic error logged
        }
      }
    );

    const safetyTimer = window.setTimeout(() => {
      setLayeringLoading(false);
    }, 2500);

    return () => {
      unsubscribe();
      window.clearTimeout(safetyTimer);
    };
  }, [isOwner]);

  const usingSampleFallback = !catalogueLoading && livePerfumes.length === 0;
  const perfumes = livePerfumes.length > 0 ? livePerfumes : fragranceCatalogue;
  const usingSampleCombos = !combosLoading && liveCombos.length === 0;
  const combos = liveCombos.length > 0 ? liveCombos : starterCombos;
  const usingSampleLayering = !layeringLoading && liveLayeringIdeas.length === 0;
  const layeringIdeas =
    liveLayeringIdeas.length > 0 ? liveLayeringIdeas : starterLayeringIdeas;

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

    const sanitizedSizes = normalizeAndDedupeSizes(input.sizes.slice(0, 12));

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

  const saveComboDeal = async (
    input: ComboInput,
    existingId?: string
  ): Promise<string> => {
    const ownerUid = requireOwnerUid();
    const cleanTitle = input.title.trim().slice(0, 140);
    if (!cleanTitle) {
      throw new Error('Combo title is required.');
    }
    const cleanNames = input.perfumeNames
      .map((n) => n.trim().slice(0, 140))
      .filter(Boolean)
      .slice(0, 6);
    if (cleanNames.length < 2) {
      throw new Error('Include at least 2 perfume names in a combo bundle.');
    }
    const cleanSize = (input.sizeLabel.trim() || '2 × Bottles').slice(0, 60);
    const regularPrice = Math.min(100000, Math.max(0, Number(input.regularPrice || 0)));
    const comboPrice = Math.min(regularPrice, Math.max(0, Number(input.comboPrice || 0)));

    const id = existingId || `combo-${slugifyId(cleanTitle)}-${Date.now().toString(36)}`;
    const ref = doc(db, 'combos', id);
    const path = `combos/${id}`;

    const mutablePayload = {
      title: cleanTitle,
      subtitle: input.subtitle.trim().slice(0, 300),
      perfumeNames: cleanNames,
      sizeLabel: cleanSize,
      regularPrice,
      comboPrice,
      tag: input.tag.trim().slice(0, 40),
      featured: Boolean(input.featured),
      active: Boolean(input.active),
      updatedAt: serverTimestamp(),
    };

    try {
      if (existingId) {
        await setDoc(ref, mutablePayload, { merge: true });
      } else {
        await setDoc(ref, {
          ...mutablePayload,
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

  const deleteComboDeal = async (comboId: string): Promise<void> => {
    requireOwnerUid();
    const path = `combos/${comboId}`;
    try {
      await deleteDoc(doc(db, 'combos', comboId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const saveLayeringIdea = async (
    input: LayeringIdeaInput,
    existingId?: string
  ): Promise<string> => {
    const ownerUid = requireOwnerUid();
    const cleanTitle = input.title.trim().slice(0, 140);
    const cleanBase = input.basePerfumeName.trim().slice(0, 140);
    const cleanTop = input.topPerfumeName.trim().slice(0, 140);
    if (!cleanTitle || !cleanBase || !cleanTop) {
      throw new Error('Title, Base Perfume, and Topper Perfume are required.');
    }

    const id = existingId || `layer-${slugifyId(cleanTitle)}-${Date.now().toString(36)}`;
    const ref = doc(db, 'layeringIdeas', id);
    const path = `layeringIdeas/${id}`;

    const mutablePayload = {
      title: cleanTitle,
      vibe: (input.vibe.trim() || 'Signature Blend').slice(0, 60),
      basePerfumeName: cleanBase,
      topPerfumeName: cleanTop,
      sprayRatio: (input.sprayRatio.trim() || '2 sprays base · 2 sprays top').slice(0, 80),
      occasion: input.occasion.trim().slice(0, 120),
      whyItWorks: (
        input.whyItWorks.trim() ||
        `${cleanBase} anchors the skin while ${cleanTop} adds luminous projection.`
      ).slice(0, 500),
      active: Boolean(input.active),
      updatedAt: serverTimestamp(),
    };

    try {
      if (existingId) {
        await setDoc(ref, mutablePayload, { merge: true });
      } else {
        await setDoc(ref, {
          ...mutablePayload,
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

  const deleteLayeringIdea = async (ideaId: string): Promise<void> => {
    requireOwnerUid();
    const path = `layeringIdeas/${ideaId}`;
    try {
      await deleteDoc(doc(db, 'layeringIdeas', ideaId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const importStarterCombosAndLayering = async (): Promise<number> => {
    const ownerUid = requireOwnerUid();
    const batch = writeBatch(db);
    try {
      for (const item of starterCombos) {
        batch.set(doc(db, 'combos', item.id), {
          title: item.title.slice(0, 140),
          subtitle: item.subtitle.slice(0, 300),
          perfumeNames: item.perfumeNames.slice(0, 6),
          sizeLabel: item.sizeLabel.slice(0, 60),
          regularPrice: item.regularPrice,
          comboPrice: item.comboPrice,
          tag: item.tag.slice(0, 40),
          featured: item.featured,
          active: item.active,
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const idea of starterLayeringIdeas) {
        batch.set(doc(db, 'layeringIdeas', idea.id), {
          title: idea.title.slice(0, 140),
          vibe: idea.vibe.slice(0, 60),
          basePerfumeName: idea.basePerfumeName.slice(0, 140),
          topPerfumeName: idea.topPerfumeName.slice(0, 140),
          sprayRatio: idea.sprayRatio.slice(0, 80),
          occasion: idea.occasion.slice(0, 120),
          whyItWorks: idea.whyItWorks.slice(0, 500),
          active: idea.active,
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      return starterCombos.length + starterLayeringIdeas.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'combos');
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
    campaignLoading,
    coupons,
    couponsLoading,
    combos,
    liveCombos,
    usingSampleCombos,
    combosLoading,
    layeringIdeas,
    liveLayeringIdeas,
    usingSampleLayering,
    layeringLoading,
    lookupCouponByCode,
    savePerfume,
    deletePerfume,
    togglePerfumeSpecial,
    importStarterCatalogue,
    saveCoupon,
    toggleCouponActive,
    deleteCoupon,
    saveCampaign,
    saveComboDeal,
    deleteComboDeal,
    saveLayeringIdea,
    deleteLayeringIdea,
    importStarterCombosAndLayering,
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
