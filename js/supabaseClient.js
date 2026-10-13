/* =============================================================================
   MedicineBank Clinical Portal — Supabase Client & Database Architecture
   Centralized Client, Bucket Config, and Normalized Schema Parsers
   ============================================================================= */

(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    const exports = factory();
    Object.assign(global, exports);
    global.MBI_SUPABASE = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SUPABASE_URL = 'https://igfooetzorzhhvpakgqa.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZm9vZXR6b3J6aGh2cGFrZ3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5ODg2NTksImV4cCI6MjEwNDU2NDY1OX0.1XLeeRi4KFJptk73JKx_vs0FlO5EXM17KIyFSaKWLCA';
  const MATERIALS_BUCKET = 'materials';
  const MAX_FLASH_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

  let clientInstance = null;

  function getSupabaseClient() {
    if (clientInstance) return clientInstance;
    const globalSupabase = (typeof window !== 'undefined' && window.supabase) ? window.supabase : null;
    if (globalSupabase && typeof globalSupabase.createClient === 'function') {
      try {
        clientInstance = globalSupabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch (err) {
        console.warn('Supabase client initialization warning:', err);
      }
    }
    return clientInstance;
  }

  /**
   * Cleans technical JSON payloads and metadata tags out of captions for clinical presentation.
   */
  function extractHumanCaption(caption) {
    if (!caption) return '';
    const str = String(caption).trim();
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const parsed = JSON.parse(str);
        return parsed.notes || parsed.note || parsed.humanCaption || parsed.title || '';
      } catch (e) {
        return '';
      }
    }
    // Clean regex metadata tags like [module:CVS] or module: CVS
    return str
      .replace(/\[?(?:module|subject|semester|cards?|count):\s*[^\]\n\r]+\]?/gi, '')
      .trim();
  }

  /**
   * Normalizes material schema: parses dedicated columns with seamless JSON caption fallback.
   */
  function parseMaterialMeta(material) {
    if (!material) {
      return { moduleCode: '', subjectName: '', semester: 1, cardCount: 0, humanCaption: '' };
    }

    // Direct normalized database columns
    let moduleCode = material.module_code || material.moduleCode || '';
    let subjectName = material.subject_name || material.subjectName || '';
    let semester = material.semester != null ? parseInt(material.semester, 10) : null;
    let cardCount = material.card_count != null ? parseInt(material.card_count, 10) : null;

    let jsonMeta = {};
    if (material.caption && typeof material.caption === 'string' && material.caption.trim().startsWith('{')) {
      try {
        jsonMeta = JSON.parse(material.caption.trim());
      } catch (e) {
        jsonMeta = {};
      }
    }

    // Fallback to JSON caption fields if columns are unset
    if (!moduleCode && jsonMeta.module) moduleCode = jsonMeta.module;
    if (!subjectName && jsonMeta.subject) subjectName = jsonMeta.subject;
    if (semester == null && jsonMeta.semester != null) semester = parseInt(jsonMeta.semester, 10);
    if (cardCount == null && jsonMeta.cards != null) cardCount = parseInt(jsonMeta.cards, 10);
    if (cardCount == null && jsonMeta.card_count != null) cardCount = parseInt(jsonMeta.card_count, 10);

    // Regex fallback for inline text captions (e.g., "module: CVS subject: Pharmacology semester: 1")
    if (material.caption && typeof material.caption === 'string') {
      if (!moduleCode) {
        const m = material.caption.match(/module:\s*([A-Za-z0-9\s\/\-_]+)/i);
        if (m) moduleCode = m[1].trim();
      }
      if (!subjectName) {
        const m = material.caption.match(/subject:\s*([A-Za-z0-9\s\/\-_]+)/i);
        if (m) subjectName = m[1].trim();
      }
      if (semester == null) {
        const m = material.caption.match(/semester:\s*([12])/i);
        if (m) semester = parseInt(m[1], 10);
      }
    }

    return {
      moduleCode: moduleCode || '',
      subjectName: subjectName || '',
      semester: semester || 1,
      cardCount: cardCount || 0,
      humanCaption: extractHumanCaption(material.caption)
    };
  }

  return {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    MATERIALS_BUCKET,
    MAX_FLASH_UPLOAD_BYTES,
    getSupabaseClient,
    extractHumanCaption,
    parseMaterialMeta
  };
});
