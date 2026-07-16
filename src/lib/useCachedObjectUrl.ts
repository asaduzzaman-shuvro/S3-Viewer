"use client";

import { useEffect, useState } from "react";
import { getBlob, putBlob, remove } from "./blobCache";

interface Options {
  cacheKey: string;
  remoteUrl: string;
}

interface Result {
  /** blob: URL on a cache hit / after storing; the direct remote URL on fallback. */
  src: string | null;
  loading: boolean;
  fromCache: boolean;
  /** True when the byte fetch failed (e.g. CORS) and we fell back to the remote URL. */
  error: boolean;
  /** Evict this key and re-download from the remote (S3) — for "Fetch from remote". */
  refresh: () => void;
}

interface Resolved {
  key: string;
  nonce: number;
  src: string;
  fromCache: boolean;
  error: boolean;
}

/**
 * Serve a file from the client-side blob cache when present, otherwise fetch it
 * directly from S3 (the presigned `remoteUrl`), display it, and store it for next
 * time. If the byte fetch fails (e.g. the bucket has no CORS policy yet), we fall
 * back to loading the remote URL directly so the preview never breaks.
 */
export function useCachedObjectUrl({ cacheKey, remoteUrl }: Options): Result {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  // Bumped by refresh() to force the effect to re-run and re-download.
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    (async () => {
      // 1. Cache hit → serve from local blob.
      const cached = await getBlob(cacheKey);
      if (!active) return;
      if (cached) {
        objectUrl = URL.createObjectURL(cached);
        setResolved({ key: cacheKey, nonce, src: objectUrl, fromCache: true, error: false });
        return;
      }

      // 2. Miss → fetch straight from S3, display, and store.
      try {
        const res = await fetch(remoteUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setResolved({ key: cacheKey, nonce, src: objectUrl, fromCache: false, error: false });
        // Store after painting; failures here are non-fatal.
        void putBlob(cacheKey, blob);
      } catch {
        // 3. Fetch/CORS failure → fall back to the direct remote URL (uncached).
        if (!active) return;
        setResolved({ key: cacheKey, nonce, src: remoteUrl, fromCache: false, error: true });
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cacheKey, remoteUrl, nonce]);

  function refresh() {
    void remove(cacheKey).then(() => setNonce((n) => n + 1));
  }

  // Only surface a result that matches the current key + nonce; otherwise we're
  // still loading (deps changed or a refresh is in flight).
  const ready = resolved !== null && resolved.key === cacheKey && resolved.nonce === nonce;
  return {
    src: ready ? resolved.src : null,
    loading: !ready,
    fromCache: ready ? resolved.fromCache : false,
    error: ready ? resolved.error : false,
    refresh,
  };
}
