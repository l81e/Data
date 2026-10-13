# Pull Request: Comprehensive Modularization, Security Hardening, PWA Sovereignty & FSRS-5 Clinical Workstation

**Target Repository**: `l81e/Data:main`  
**Deployment**: `https://data.medicinebank.org`  
**Status**: Ready for Merge (100% Verification Gate Passing: 673 automated checks, 0 errors, 0 warnings)

---

## 🎯 Executive Summary & Mission

This pull request delivers an end-to-end refactoring, security hardening, modular architecture extraction, and feature enhancement across the entire **MedicineBank Data** codebase (`data.medicinebank.org`).

All updates maintain **100% backward compatibility with static hosting (GitHub Pages)** without introducing any build-time toolchain dependencies, while achieving full sovereign offline capability via a Stale-While-Revalidate Service Worker and IndexedDB v3 vault.

---

## 📊 Summary of Architectural Transformations

| Dimension | Legacy Implementation | Refactored & Hardened Architecture |
| :--- | :--- | :--- |
| **Code Architecture** | Monolithic HTML files with duplicated CSS/JS | Modular shared assets: `css/theme.css`, `js/supabaseClient.js`, `js/i18n.js`, `js/vault.js`, `js/ankiParser.js` |
| **Theme System** | Copied CSS color variables in 3 files | Unified 7 clinical themes in `css/theme.css` with inline `<head>` FOUC prevention |
| **Security & Admin Auth** | Client-side plaintext passcode string | Cryptographic SHA-256 password hash verification; zero plaintext credentials in client code |
| **Database Schema** | Metadata packed into JSON string inside `caption` | Normalized columns (`module_code`, `subject_name`, `semester`, `card_count`) with composite index `idx_materials_hierarchy` |
| **Supabase RLS** | Permissive public policies | Strict RLS: public `SELECT` on published rows; mutations (`INSERT`, `UPDATE`, `DELETE`) locked to verified `is_admin_or_editor()` roles |
| **Offline Usability (PWA)** | Dependent on browser cache & network | Sovereign PWA: `manifest.json` and Stale-While-Revalidate `sw.js` precaching 15 core assets |
| **IndexedDB Media Isolation** | Potential filename collision between decks | Composite namespacing (`${deckId}:::${filename}`) in `mb_synaptic_vault` v3 preventing cross-deck media leakage |
| **Card Formatting** | Basic text and KaTeX | Multi-cloze with hints (`{{c1::ans::hint}}`), SVG Image Occlusion (`.io-box`), and auto-play audio `[sound:...]` |
| **Deck Builder Studio** | TSV only, single cards | TSV/CSV/Markdown table import; forward/reverse sibling pairs sharing `noteId` for daily burying |
| **Test Coverage** | 36 initial checks | 673 verification checks across 41 suites + 107 adversarial stress tests (100% passing) |

---

## 🛠️ Detailed File Changes

### 1. Shared Modular Assets (`css/` & `js/`)
- **`css/theme.css`**:
  - Unified design system containing all 7 themes: Dark (Obsidian), Light (Clinical Ivory), Maroon, Blue, Orange, Champagne, and Brown.
  - Custom scrollbar styling with OS arrow suppression.
- **`js/supabaseClient.js`**:
  - Centralized Supabase initialization, storage bucket configurations, and schema metadata parsing (`parseMaterialMeta`).
  - Seamless backward compatibility: parses normalized columns if available, gracefully falling back to legacy JSON strings inside `caption`.
- **`js/i18n.js`**:
  - Centralized bilingual Arabic/English dictionary and DOM translator (`applyLanguage`, `data-en`, `data-ar`, `dir` toggle).
- **`js/vault.js`**:
  - Sovereign IndexedDB manager (`mb_synaptic_vault`, schema v3) unifying `decks`, `cards`, and `media` stores.
  - Namespaced media keys (`${deckId}:::${filename}`) and memory cleanup (`revokeAndClearMediaCache`).
  - Stop Sign session bookmark storage and resumption badge formatting.
- **`js/ankiParser.js`**:
  - Universal parser supporting Anki 2.1 SQLite (`collection.anki2`, `collection.anki21`), Zstandard-compressed `collection.anki21b` via `fzstd`, Protobuf and JSON media maps.
  - Multi-cloze extraction with back-face reveal and hint stripping.
  - SVG Image Occlusion mask overlay generator.

### 2. Database & Security Hardening (`schema.sql` & `index.html`)
- **Normalized Schema**:
  - Added `module_code text`, `subject_name text`, `semester int DEFAULT 1`, and `card_count int DEFAULT 0` to `materials` table.
  - Created composite index `idx_materials_hierarchy` on `(module_code, subject_name, semester)`.
- **Row-Level Security (RLS)**:
  - Created helper function `is_admin_or_editor()`.
  - Restricted `INSERT`, `UPDATE`, and `DELETE` on `materials` and `lectures` to authenticated admin/editor users while retaining open `SELECT` for public study.
- **Zero-Plaintext Secret Storage**:
  - Removed plaintext admin passcodes from `index.html`. Admin mode unlocks via secure SHA-256 cryptographic hash comparison.

### 3. Curriculum Explorer (`index.html`)
- Added fast debounced (120ms) subsequence fuzzy search across titles, codes, subjects, and notes.
- Maintained 3-tier sort persistence (Natural Alphabetical, Card Count, Upload Date) with UI indicators.
- Live progress integration with `mb_synaptic_vault` displaying card counts and Stop Sign resume badges (e.g., `🛑 Resuming at Card 14/45`).
- Head updated with shared `css/theme.css`, `js/` modules, `manifest.json`, and service worker registration.

### 4. Clinical Study Station (`flash.html`)
- **Image Occlusion (IO)**: Interactive SVG mask overlays (`.io-box`, `.qshape`, `.io-revealed`) for AnKing and First Aid anatomy/histology cards.
- **Audio & Media**: Automatic playback on card reveal for `[sound:filename.ext]`, visual audio scrubbers, and `R` keyboard shortcut for replay.
- **Ergonomics & Controls**:
  - Added shortcut `0` to reset image zoom/pan.
  - Preserved authentic 19-parameter FSRS-5 scheduler, customizable retention targets (70%–97%), and intra-session lapse queue recycling.
- Linked shared modules and registered `sw.js`.

### 5. Deck Builder & Studio (`flashmake.html`)
- **Multi-Format Bulk Importer**: Supports TSV, CSV (comma-separated), and Markdown tables (`| Q | A |`).
- **Dual / Reversed Card Synthesis**: Generates paired forward and reverse cards sharing identical `noteId` and discrete `ord` (0, 1) for daily sibling burying.
- **Direct `.apkg` Compiler**: Creates valid Anki 2.1 SQLite databases and ZIP packages in-browser.
- Linked shared modules and registered `sw.js`.

### 6. PWA & Offline Sovereignty (`sw.js` & `manifest.json`)
- **`manifest.json`**: Standalone PWA web manifest with clinical icons, medical colors, and Arabic/English language declarations.
- **`sw.js`**: Stale-While-Revalidate caching strategy precaching core application assets (`index.html`, `flash.html`, `flashmake.html`, CSS, JS, fonts, and vendor CDNs).
- 100% offline study capability: students can open cached decks and review cards without an internet connection.

---

## 🧪 Verification & Test Results

All verification suites execute cleanly in Node.js with **0 errors and 0 warnings**:

```bash
node test-verification.mjs
```
```text
==================================================
🎉 ALL 673 VERIFICATION CHECKS PASSED PERFECTLY!
==================================================
```

```bash
node test-challenger-final-stress.mjs
```
```text
======================================================================
TOTAL CHECKS: 107
PASSED: 107
FAILED: 0
======================================================================
🎉 VERDICT: CONFIRM (100% of adversarial stress checks PASSED)
```

### Verification Coverage Highlights:
- **Suite 1–39**: Baseline regression prevention (FSRS-5 mathematics, KaTeX parsing, 4-direction gestures, media rehydration, stop signs, sibling burying, IDB v3 uniformity).
- **Suite 40**: Modular architecture asset existence, CSS theme tokens, HTML module imports, schema normalization DDL, RLS policies, and database fallback parser.
- **Suite 41**: FSRS-5 retention benchmarks (85% vs 90% vs 95%), cloze hints and back reveals, template conditionals, image occlusion classes, IDB key namespacing, manifest properties, and 100% service worker precache asset existence on disk.
- **Strict Institutional Independence**: Zero mentions of legacy project names across entire repository.
