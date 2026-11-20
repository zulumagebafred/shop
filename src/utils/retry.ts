export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const NON_RETRYABLE_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'failed-precondition',
  'not-found',
  'already-exists',
  'out-of-range',
]);

export function isRetryableFirebaseError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return true;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') {
    const clean = code.replace(/^firestore\//, '');
    if (NON_RETRYABLE_CODES.has(clean)) {
      return false;
    }
  }
  const msg = (error as { message?: unknown }).message;
  if (typeof msg === 'string' && /permission|missing or insufficient permissions/i.test(msg)) {
    return false;
  }
  return true;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? 300);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 3000);
  const shouldRetry = options.shouldRetry ?? isRetryableFirebaseError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      const exp = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(Math.random() * 140);
      const delay = Math.min(maxDelayMs, exp + jitter);
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
