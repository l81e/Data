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
    if (out.includes('qshape') || out.includes('ashape') || out.includes('image-occlusion') || out.includes('io-wrapper')) {
      out = renderImageOcclusionOverlay(out, cardOrd, isBack, fieldMap);
    }

    return out;
  }

  /**
   * Universal Image Occlusion parser supporting:
   * 1. Anki 23.10+ / 24+ Native Image Occlusion notes with {{c1::image-occlusion:rect:...}} and <canvas id="image-occlusion-canvas">
   * 2. Anki 2.0 / AnKing SVG overlay notes (<svg><rect class="qshape">...</svg>)
   */
  function renderImageOcclusionOverlay(html, cardOrd, isBack, fieldMap = {}) {
    if (!html) return '';
    let res = html;

    // 1. Native Anki Image Occlusion (Anki 23.10+ / 24+)
    const occlusionField = (fieldMap && typeof getFieldValue === 'function' ? getFieldValue(fieldMap, 'Occlusion') : (fieldMap ? fieldMap['Occlusion'] : '')) || '';
    if (occlusionField && /image-occlusion:rect/i.test(occlusionField)) {
      const clozeRegex = /{{c(\d+)::(image-occlusion:[^}]+)}}/g;
      let m;
      const rects = [];
      while ((m = clozeRegex.exec(occlusionField)) !== null) {
        rects.push({ cNum: parseInt(m[1], 10), spec: m[2] });
      }

      if (rects.length > 0) {
        const targetNum = cardOrd + 1;
        const rectSvgElements = [];

        for (const { cNum, spec } of rects) {
          const parts = spec.split(':');
          const props = {};
          for (let i = 2; i < parts.length; i++) {
            const eqIdx = parts[i].indexOf('=');
            if (eqIdx !== -1) {
              const k = parts[i].substring(0, eqIdx);
              const v = parseFloat(parts[i].substring(eqIdx + 1));
              if (!isNaN(v)) props[k] = v;
            }
          }

          const x = (props.left !== undefined ? props.left : 0) * 1000;
          const y = (props.top !== undefined ? props.top : 0) * 1000;
          const w = (props.width !== undefined ? props.width : 0) * 1000;
          const h = (props.height !== undefined ? props.height : 0) * 1000;

          let transformAttr = '';
          if (props.angle !== undefined) {
            let deg = props.angle;
            if (deg > 360) deg = deg / 100;
            const cx = x + w / 2;
            const cy = y + h / 2;
            transformAttr = ` transform="rotate(${deg} ${cx.toFixed(1)} ${cy.toFixed(1)})"`;
          }

          const isTarget = cNum === targetNum;
          let cls = 'ashape';
          if (isTarget) {
            cls = isBack ? 'qshape io-box io-revealed' : 'qshape io-box';
          }
          rectSvgElements.push(
            `<rect class="${cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6"${transformAttr} />`
          );
        }

        const overlaySvg = `<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;" role="img" aria-label="Anatomical Image Occlusion Overlay">${rectSvgElements.join('')}</svg>`;

        if (res.includes('image-occlusion-wrapper') || res.includes('Anatomical Image Occlusion Overlay')) {
          // Overlay already synthesized from {{FrontSide}}
          if (isBack) {
            res = res.replace(/class=["']([^"']*\b(?:qshape|io-box)\b[^"']*)["']/gi, 'class="$1 io-revealed"');
          }
        } else if (res.includes('image-occlusion-container')) {
          res = res.replace(/<div\b[^>]*\bid=["']image-occlusion-container["'][^>]*>/i, '<div id="image-occlusion-wrapper" class="image-occlusion-wrap">');
          res = res.replace(/<canvas\b[^>]*\bid=["']image-occlusion-canvas["'][^>]*><\/canvas>/i, overlaySvg);
        } else if (res.includes('image-occlusion-canvas')) {
          res = res.replace(/<canvas\b[^>]*\bid=["']image-occlusion-canvas["'][^>]*><\/canvas>/i, overlaySvg);
        } else if (/<img\b/i.test(res)) {
          res = res.replace(/(<img\b[^>]*>)/i, `<div id="image-occlusion-wrapper" class="image-occlusion-wrap">$1${overlaySvg}</div>`);
        }

        res = res.replace(/<div id="err"[^>]*>[\s\S]*?<\/div>/gi, '');
        res = res.replace(/<canvas\b[^>]*>[\s\S]*?<\/canvas>/gi, '');

        if (res.includes('id="toggle"') || res.includes('id=\'toggle\'')) {
          res = res.replace(/<button\b[^>]*\bid=["']toggle["'][^>]*>([\s\S]*?)<\/button>/gi, '<button type="button" id="toggle" class="io-toggle-masks-btn">$1</button>');
        }

        return res;
      }
    }

    // 2. Legacy / AnKing SVG Overlay Image Occlusion
    res = res.replace(/<svg\b([^>]*?)>/gi, (match, attrs) => {
      if (!/viewBox=/i.test(attrs)) {
        const wMatch = attrs.match(/\bwidth=["']?(\d+(?:\.\d+)?)/i);
        const hMatch = attrs.match(/\bheight=["']?(\d+(?:\.\d+)?)/i);
        if (wMatch && hMatch) {
          return `<svg ${attrs} viewBox="0 0 ${wMatch[1]} ${hMatch[1]}" preserveAspectRatio="xMidYMid meet">`;
        }
      }
      return match;
    });

    // If on back face, reveal target occlusion box
    if (isBack) {
      res = res.replace(/class=["']([^"']*\b(?:qshape|io-box)\b[^"']*)["']/gi, 'class="$1 io-revealed"');
    }
    return res;
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
