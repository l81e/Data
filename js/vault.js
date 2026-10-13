/* =============================================================================
   MedicineBank Clinical Portal — Sovereign IndexedDB Vault Manager (mb_synaptic_vault)
   Unified Version 3, Zero-Collision Scoped Media Resolution, and FSRS Progress Persistence
   ============================================================================= */

(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    const exports = factory();
    Object.assign(global, exports);
    global.MBI_VAULT = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const IDB_NAME = 'mb_synaptic_vault';
  const IDB_VERSION = 3;

  let idbPromise = null;
  const inMemoryMediaCache = new Map();

  /**
   * Sanitizes vault media store to purge legacy unscoped keys and prevent cross-deck bleed.
   */
  async function sanitizeVault(db) {
    if (!db || !db.objectStoreNames.contains('media')) return;
    try {
      const tx = db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      const req = store.getAllKeys();
      const keys = await new Promise(res => {
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      });

      let purgedCount = 0;
      for (const key of keys) {
        if (typeof key === 'string' && !key.includes(':::')) {
          store.delete(key);
          purgedCount++;
        }
      }
      if (purgedCount > 0) {
        console.log(`IndexedDB vault media sanitized: Purged ${purgedCount} legacy un-scoped collisions.`);
      }
    } catch (e) {
      console.warn('Vault sanitization deferred:', e);
    }
  }

  /**
   * Opens the unified mb_synaptic_vault IndexedDB instance.
   */
  function openVault() {
    if (idbPromise) return idbPromise;
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not supported in this environment'));
    }

    idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('decks')) {
          db.createObjectStore('decks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cards')) {
          db.createObjectStore('cards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'name' });
        }
      };

      req.onsuccess = async () => {
        const db = req.result;
        try {
          await sanitizeVault(db);
        } catch (e) {}
        resolve(db);
      };

      req.onerror = () => {
        idbPromise = null;
        reject(req.error);
      };
    });

    return idbPromise;
  }

  function scopeCardId(deckId, cardId) {
    return `${deckId}:::${cardId}`;
  }

  function scopeMediaKey(deckId, filename) {
    let clean = filename;
    try { clean = decodeURIComponent(filename); } catch (e) {}
    clean = clean.trim().replace(/^.*[\\\/]/, '');
    return `${deckId}:::${clean}`;
  }

  /**
   * Persists card review progress (FSRS-5 metrics) into IndexedDB.
   */
  async function persistCardReview(card, activeDeckId) {
    if (!card) return;
    try {
      const db = await openVault();
      const tx = db.transaction('cards', 'readwrite');
      const cardStore = tx.objectStore('cards');
      const origId = card.originalId || card.id;
      const deckId = card.deckId || activeDeckId || 'local-deck';
      const scopedCardId = scopeCardId(deckId, origId);

      cardStore.put({
        ...card,
        id: scopedCardId,
        originalId: origId,
        deckId: deckId
      });

      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = rej;
      });

      // Broadcast update to sync curriculum cards
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('mb_vault_channel');
          bc.postMessage({ type: 'CARD_UPDATED', deckId, cardId: scopedCardId });
          bc.close();
        } catch (e) {}
      }
    } catch (e) {
      console.warn('persistCardReview error:', e);
    }
  }

  /**
   * Resolves media blob URL strictly scoped to the specified deck.
   * ZERO-TOLERANCE MEDIA ISOLATION: Never falls back to unscoped global keys.
   */
  async function getMediaBlobUrl(filename, deckId) {
    if (!filename || !deckId) return null;
    let clean = filename;
    try { clean = decodeURIComponent(filename); } catch (e) {}
    clean = clean.trim().replace(/^.*[\\\/]/, '');

    const scopedKey = `${deckId}:::${clean}`;
    const scopedKeyLower = `${deckId}:::${clean.toLowerCase()}`;

    // Strictly scoped in-memory cache lookup
    if (inMemoryMediaCache.has(scopedKey)) return inMemoryMediaCache.get(scopedKey);
    if (inMemoryMediaCache.has(scopedKeyLower)) return inMemoryMediaCache.get(scopedKeyLower);

    try {
      const db = await openVault();
      const tx = db.transaction('media', 'readonly');
      const store = tx.objectStore('media');

      // Strictly scoped IndexedDB lookup (exact case)
      const reqScoped = store.get(scopedKey);
      const resScoped = await new Promise(r => {
        reqScoped.onsuccess = () => r(reqScoped.result);
        reqScoped.onerror = () => r(null);
      });
      if (resScoped && resScoped.blob) {
        const url = URL.createObjectURL(resScoped.blob);
        inMemoryMediaCache.set(scopedKey, url);
        inMemoryMediaCache.set(scopedKeyLower, url);
        return url;
      }

      // Strictly scoped IndexedDB lookup (lowercase)
      const reqScopedLower = store.get(scopedKeyLower);
      const resScopedLower = await new Promise(r => {
        reqScopedLower.onsuccess = () => r(reqScopedLower.result);
        reqScopedLower.onerror = () => r(null);
      });
      if (resScopedLower && resScopedLower.blob) {
        const url = URL.createObjectURL(resScopedLower.blob);
        inMemoryMediaCache.set(scopedKey, url);
        inMemoryMediaCache.set(scopedKeyLower, url);
        return url;
      }

      // STRICT ZERO-TOLERANCE MEDIA ISOLATION:
      // No un-scoped global fallbacks or cross-deck borrowing allowed.
    } catch (e) {}

    return null;
  }

  /**
   * Cleans all memory blob URLs upon deck switch or session conclusion.
   */
  function revokeAndClearMediaCache() {
    for (const url of inMemoryMediaCache.values()) {
      try {
        if (typeof url === 'string' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      } catch (e) {}
    }
    inMemoryMediaCache.clear();
  }

  /**
   * Stop Sign Session Bookmarks
   */
  function saveStopSignBookmark(deckId, cardIndex, totalCards) {
    if (!deckId) return;
    try {
      const payload = {
        deckId,
        index: cardIndex,
        total: totalCards,
        timestamp: Date.now()
      };
      localStorage.setItem(`mb_stopsign_${deckId}`, JSON.stringify(payload));

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('mb_vault_channel');
        bc.postMessage({ type: 'BOOKMARK_UPDATED', deckId, index: cardIndex, total: totalCards });
        bc.close();
      }
    } catch (e) {}
  }

  function getStopSignBookmark(deckId) {
    if (!deckId) return null;
    try {
      const raw = localStorage.getItem(`mb_stopsign_${deckId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearStopSignBookmark(deckId) {
    if (!deckId) return;
    try {
      localStorage.removeItem(`mb_stopsign_${deckId}`);
    } catch (e) {}
  }

  return {
    IDB_NAME,
    IDB_VERSION,
    inMemoryMediaCache,
    openVault,
    sanitizeVault,
    scopeCardId,
    scopeMediaKey,
    persistCardReview,
    getMediaBlobUrl,
    revokeAndClearMediaCache,
    saveStopSignBookmark,
    getStopSignBookmark,
    clearStopSignBookmark
  };
});
