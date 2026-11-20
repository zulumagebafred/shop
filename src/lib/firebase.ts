import { initializeApp } from 'firebase/app';
import {
  AppCheck,
  ReCaptchaV3Provider,
  initializeAppCheck,
} from 'firebase/app-check';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  Firestore,
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { sha256Hex } from '../utils/hash';

const AUTHORIZED_ADMIN_EMAIL_HASHES: readonly string[] = [
  '9f9b2c72f5e513087cb580c0a6a015654358d1d59af2a94ba519457cf3319ecc',
  '9f0173b593e519fce62ecce9daaf062f40b57770b75aa3198e655622c9395810',
];

export function isAuthorizedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return AUTHORIZED_ADMIN_EMAIL_HASHES.includes(sha256Hex(normalized));
}

const app = initializeApp(firebaseConfig);

function getRecaptchaSiteKey(): string {
  const envKey =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_RECAPTCHA_SITE_KEY
      ? String(import.meta.env.VITE_RECAPTCHA_SITE_KEY).trim()
      : '';
  const configKey = String(
    (firebaseConfig as { recaptchaSiteKey?: string }).recaptchaSiteKey ?? ''
  ).trim();
  return envKey || configKey;
}

function initOptionalAppCheck(): AppCheck | null {
  if (typeof window === 'undefined') return null;
  const siteKey = getRecaptchaSiteKey();
  if (!siteKey) return null;
  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    return null;
  }
}

/**
 * Firebase App Check client instance (monitoring-safe: initializes only when
 * a reCAPTCHA v3 site key is supplied via VITE_RECAPTCHA_SITE_KEY or
 * firebase-applet-config.json, and fails open if blocked on a client browser).
 */
export const appCheck: AppCheck | null = initOptionalAppCheck();
export const appCheckConfigured: boolean = Boolean(getRecaptchaSiteKey());

function createFirestoreClient(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db: Firestore = createFirestoreClient();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ? '[redacted]' : null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const CONNECTION_CHECK_SESSION_KEY = 'aurahut_conn_checked_v1';

async function testConnection() {
  try {
    if (
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(CONNECTION_CHECK_SESSION_KEY)
    ) {
      return;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(CONNECTION_CHECK_SESSION_KEY, '1');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
