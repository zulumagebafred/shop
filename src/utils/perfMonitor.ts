export interface FirestoreReadEvent {
  op: string;
  docsRead: number;
  durationMs: number;
  cacheHit: boolean;
  timestamp: number;
}

export interface AuraHutPerfSnapshot {
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number;
  inpMs: number | null;
  firestoreReads: number;
  firestoreOps: number;
  firestoreCacheHits: number;
  recentEvents: FirestoreReadEvent[];
}

declare global {
  interface Window {
    __AURAHUT_PERF__?: AuraHutPerfSnapshot;
  }
}

const perfState: AuraHutPerfSnapshot = {
  fcpMs: null,
  lcpMs: null,
  cls: 0,
  inpMs: null,
  firestoreReads: 0,
  firestoreOps: 0,
  firestoreCacheHits: 0,
  recentEvents: [],
};

let initialized = false;

export function recordFirestoreRead(
  op: string,
  docsRead: number,
  durationMs: number,
  cacheHit = false
): void {
  perfState.firestoreOps += 1;
  if (cacheHit) {
    perfState.firestoreCacheHits += 1;
  } else {
    perfState.firestoreReads += Math.max(0, docsRead);
  }
  perfState.recentEvents.push({
    op,
    docsRead,
    durationMs: Math.round(durationMs),
    cacheHit,
    timestamp: Date.now(),
  });
  if (perfState.recentEvents.length > 40) {
    perfState.recentEvents.shift();
  }
  if (typeof window !== 'undefined') {
    window.__AURAHUT_PERF__ = perfState;
  }
}

export function initPerfMonitoring(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.__AURAHUT_PERF__ = perfState;

  if (typeof PerformanceObserver === 'undefined') return;

  try {
    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          perfState.fcpMs = Math.round(entry.startTime);
        }
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
  } catch {
    // Unsupported browser metric
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        perfState.lcpMs = Math.round(last.startTime);
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // Unsupported browser metric
  }

  try {
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput && typeof shift.value === 'number') {
          perfState.cls = Math.round((perfState.cls + shift.value) * 10000) / 10000;
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // Unsupported browser metric
  }
}
