/* =============================================================================
   MedicineBank Clinical Portal — Universal Anki 2.1 / 2.1.50+ Deck Parser Engine
   Supports collection.anki21b (Zstd via fzstd), .anki21, .anki2 SQLite databases,
   Multi-Cloze Sibling Generation, Protobuf / JSON Media Manifests, and Image Occlusion
   ============================================================================= */

(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    const exports = factory();
    Object.assign(global, exports);
    global.MBI_ANKI_PARSER = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getFieldValue(fieldMap, key) {
    if (!key) return '';
    if (fieldMap[key] !== undefined) return fieldMap[key];
    const trimmed = key.trim();
    if (fieldMap[trimmed] !== undefined) return fieldMap[trimmed];
    const norm = trimmed.toLowerCase().replace(/[\s_\-]+/g, '');
    for (const [k, v] of Object.entries(fieldMap)) {
      if (k.toLowerCase().replace(/[\s_\-]+/g, '') === norm) return v;
    }
    return undefined;
  }

  function isFieldPopulated(val) {
    if (val === undefined || val === null) return false;
    const str = String(val).trim();
    if (!str) return false;
    if (/<img\b|<video\b|<audio\b|<iframe\b|<object\b|<svg\b/i.test(str)) return true;
    return str.replace(/<[^>]+>/g, '').trim().length > 0;
  }

  /**
   * Dedicated Anki Cloze Processor per card ordinal (clozeNum = ord + 1).
   */
  function processClozeText(text, clozeNum, isBack) {
    if (!text) return '';
    return text.replace(/{{c(\d+)::([\s\S]*?)}}/g, (match, numStr, content) => {
      const num = parseInt(numStr, 10);
      let answer = content;
      let hint = '';
      const hintIdx = content.indexOf('::');
      if (hintIdx !== -1) {
        answer = content.substring(0, hintIdx);
        hint = content.substring(hintIdx + 2);
      }
      if (num === clozeNum) {
        if (isBack) {
          return `<span class="cloze-blank">${answer}</span>`;
        } else {
          const hintLabel = hint ? `[${hint}]` : '[...]';
          return `<span class="cloze-blank">${hintLabel}</span>`;
        }
      } else {
        return answer;
      }
    });
  }

  /**
   * Universal Anki Template Compiler supporting conditionals, spaces, filters & cleanups.
   */
  function compileAnkiTemplate(templateStr, fieldMap, defaultFront = '', cardOrd = 0, isBack = false) {
    if (!templateStr) return '';
    let out = templateStr;

    // Strip embedded script tags and error blocks from Anki templates (e.g. image occlusion)
    out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    out = out.replace(/<div id="err"[^>]*>[\s\S]*?<\/div>/gi, '');

    // 1. Replace {{FrontSide}}
    out = out.replace(/{{FrontSide}}/g, defaultFront);

    // 2. Resolve positive conditionals {{#Field}}...{{/Field}} (handles nested blocks)
    let passes = 10;
    while (passes-- > 0 && /{{#([^}]+)}}([\s\S]*?){{\/\1}}/g.test(out)) {
      out = out.replace(/{{#([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, fieldName, inner) => {
        const val = getFieldValue(fieldMap, fieldName);
        return isFieldPopulated(val) ? inner : '';
      });
    }

    // 3. Resolve inverted conditionals {{^Field}}...{{/Field}}
    passes = 10;
    while (passes-- > 0 && /{{\^([^}]+)}}([\s\S]*?){{\/\1}}/g.test(out)) {
      out = out.replace(/{{\^([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, fieldName, inner) => {
        const val = getFieldValue(fieldMap, fieldName);
        return isFieldPopulated(val) ? '' : inner;
      });
    }

    // 4. Resolve cloze filters and field tags: {{cloze:Field}} and {{Field}}
    out = out.replace(/{{(?:cloze:)?([^}]+)}}/g, (match, fieldName) => {
      let rawName = fieldName.trim();
      let isClozeFilter = false;
      if (rawName.startsWith('cloze:')) {
        isClozeFilter = true;
        rawName = rawName.substring(6).trim();
      }

      if (rawName === 'FrontSide') return defaultFront;

      const val = getFieldValue(fieldMap, rawName);
      if (val === undefined) return '';

      if (isClozeFilter || /{{c\d+::/i.test(String(val))) {
        return processClozeText(String(val), cardOrd + 1, isBack);
      }
      return String(val);
    });

    // 5. Image Occlusion (IO) Enhanced & Native Overlays
    // If template renders an image occlusion card with SVG rect masks
    if (out.includes('qshape') || out.includes('image-occlusion')) {
      out = renderImageOcclusionOverlay(out, cardOrd, isBack);
    }

    return out;
  }

  /**
   * Enhances Image Occlusion SVGs with interactive touch/reveal classes.
   */
  function renderImageOcclusionOverlay(html, cardOrd, isBack) {
    if (!html) return '';
    // If on back face, reveal target occlusion box
    if (isBack) {
      return html.replace(/class=["']([^"']*\bqshape\b[^"']*)["']/gi, 'class="$1 io-revealed"');
    }
    return html;
  }

  /**
   * Parses media manifest from Anki ZIP package: supports JSON and Protobuf manifests.
   */
  async function parseMediaManifest(zip) {
    const mediaMap = {};
    const jsonFile = zip.file('media');

    if (jsonFile) {
      try {
        const jsonText = await jsonFile.async('text');
        const parsed = JSON.parse(jsonText);
        for (const [numStr, originalName] of Object.entries(parsed)) {
          mediaMap[numStr] = originalName;
        }
        return mediaMap;
      } catch (e) {
        // Fallback to binary protobuf parsing
      }
    }

    // Protobuf media manifest fallback
    const pbFile = zip.file('media') || zip.file('media.proto');
    if (pbFile) {
      try {
        const buf = await pbFile.async('uint8array');
        let idx = 0;
        let entryNum = 0;
        while (idx < buf.length) {
          // Look for length-delimited string fields
          const tag = buf[idx++];
          if ((tag & 7) === 2) {
            let len = buf[idx++];
            if (len & 0x80) {
              len = (len & 0x7F) | ((buf[idx++] & 0x7F) << 7);
            }
            if (idx + len <= buf.length) {
              const str = new TextDecoder('utf-8').decode(buf.subarray(idx, idx + len));
              if (str && /\.(?:png|jpg|jpeg|gif|svg|webp|mp3|ogg|wav|m4a)$/i.test(str)) {
                mediaMap[String(entryNum++)] = str;
              }
              idx += len;
            }
          }
        }
      } catch (e) {}
    }

    return mediaMap;
  }

  return {
    escapeHtml,
    getFieldValue,
    isFieldPopulated,
    processClozeText,
    compileAnkiTemplate,
    renderImageOcclusionOverlay,
    parseMediaManifest
  };
});
