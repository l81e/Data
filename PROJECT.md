# Project: MedicineBank Authentic Anki Fidelity, Container Isolation & Module Categorization

## Architecture
- **Spaced Repetition & Dual Cards Engine**: Implemented in `flash.html` and `flashmake.html`. FSRS-5 neural scheduler with 19 parameters calculating stability, difficulty, retrievability, and intervals. Note-to-card parsing generating forward and reversed dual card siblings (preserving `noteId` and `ord`). Sibling burying until next day. Daily queue filtering (`due <= today` + `dailyNewLimit`) and instant "Cram All / Free Study" mode.
- **Sovereign Storage Layer**: IndexedDB `mb_synaptic_vault` unified at version 3 across `flash.html`, `flashmake.html`, and `index.html`. Persisting cards, reviews, notes, and media blobs. Scoped keys (`deckId:::originalId` for cards, `deckId:::filename` for media).
- **Container Isolation & Stage Bounds**: Flashcard study view clamped to `max-width: 720px;`, height bounded with `clamp(360px, 58vh, 520px);`, internal scrolling (`overflow-y: auto;`) on card faces, and equalized action button heights (56px) preventing layout shifts. Curriculum module decks styled with discrete container borders and vertical separation.
- **Curriculum Categorization & Sorting**: Inside `index.html` curriculum module bodies, a dedicated subbar container hosting subject tabs and a compact sorting toolbar. Multi-criteria sorting (Alphabetical A-Z/Z-A, Card count High/Low, Upload/import date Newest/Oldest) with real-time reordering and persistence across tab switches and accordion toggles via `localStorage`.
- **Verification Infrastructure**: `test-verification.mjs` automated verification suite (pure Node.js ESM), extended with comprehensive test suites for R1 (Suite 33), R2 (Suite 34), and R3 (Suite 35).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dual Cards (Siblings) | Support forward & reversed card siblings from basic and cloze notes with independent review states (`noteId`, `ord`, independent `due`, `stability`, `difficulty`, `reps`). | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Sibling Burying | Automatic sibling burying upon reviewing a card (burying reversed siblings until next day). | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Daily Study Queue | Default study queue presenting only Due cards (`due <= today`) + configurable daily New card limit (default 20). | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Cram All / Free Study Mode | Instant toggle in flashcard header to study all cards regardless of due date and without sibling burying. | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Persistent FSRS-5 Reviews | Persist updated FSRS-5 metrics (`stability`, `difficulty`, `reps`, `lapses`, `lastReview`, `due`) to `mb_synaptic_vault` IndexedDB on every rating and undo so progress survives reloads. | M1 | ORIGINAL_REQUEST §R1 |
| 6 | IndexedDB Version Unification | Unify `mb_synaptic_vault` version to 3 across `flash.html`, `flashmake.html`, and `index.html` to eliminate `VersionError`. | M1 | ORIGINAL_REQUEST §R1, R2 |
| 7 | Strict Media & Card Namespacing | Enforce `${deckId}:::${filename}` namespacing in IndexedDB and in-memory caches to eliminate image/audio bleeding across decks. | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Media Rehydration & Audio Support | Add `data-filename` and `data-deck-id` to image and audio tags, ensuring persistent rehydration across page reloads. | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Flashcard Constant Aspect Ratio & Clamp | Lock card dimensions to `max-width: 720px;`, height clamp (`clamp(360px, 58vh, 520px)`), internal scrolling, and eliminate button layout shift (56px equalized). | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Module Deck Container Boundaries | Render curriculum module deck list items with distinct isolated visual boundaries, border card styling, and separation. | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Module Sorting Toolbar Markup | Equip every curriculum module body with a dedicated compact sorting toolbar next to subject tabs. | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Multi-Criteria Sorting Comparators | Instant real-time sorting for Alphabetical (A-Z / Z-A), Card count (high to low / low to high), and Upload/import date (newest first / oldest first). | M3 | ORIGINAL_REQUEST §R3 |
| 13 | Module Sorting State Persistence | Persist sorting selection per module across tab switches, accordion collapse/expand toggles, and page reloads via `localStorage`. | M3 | ORIGINAL_REQUEST §R3 |
| 14 | E2E Test Suite & Infrastructure | Implement comprehensive automated test verification in `test-verification.mjs` (Tiers 1-4: Suites 33, 34, 35) passing 100%. | M4 | ORIGINAL_REQUEST §Test Verification |
| 15 | Adversarial Coverage Hardening | White-box stress-testing and adversarial coverage hardening (Tier 5) on all new engines and edge cases. | M4 | Project Pattern Tier 5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Authentic Anki Spaced Repetition & Dual Cards Engine | Implement FSRS-5 review persistence, due dates, dual card siblings, sibling burying, daily queue & cram mode, unify IDB v3. | none | PLANNED |
| M2 | Strict Deck & Card Container Isolation & Constant Ratio | Enforce `deckId:::filename` media namespacing, audio rehydration, 720px width clamp, height clamping, 56px action button alignment, and module deck card borders. | M1 | PLANNED |
| M3 | Curriculum Module Deck Categorization & Sorting System | Add module sorting toolbar in index.html, real-time multi-criteria comparators, state persistence across tabs/toggles. | M2 | PLANNED |
| M4 | Integration, Full E2E Test Verification & Adversarial Hardening | Verify 100% pass of test suite (Tiers 1-4) via `TEST_READY.md`, run adversarial stress-testing (Tier 5), and forensic integrity audit. | M1, M2, M3, E2E Track | PLANNED |

## Interface Contracts
### FSRS-5 & Review State (`flash.html` ↔ `mb_synaptic_vault`)
- `card` schema:
  - `id`: string (`card-${origId}` or `${deckId}:::${origId}`)
  - `noteId`: string (stable identifier grouping sibling cards)
  - `ord`: number (0 for Card 1 / forward, 1 for Card 2 / reversed)
  - `stability`: number (FSRS stability $S$)
  - `difficulty`: number (FSRS difficulty $D$, 1.0 to 10.0)
  - `reps`: number (integer count of successful reviews)
  - `lapses`: number (integer count of 'Again' ratings)
  - `lastReview`: number (timestamp in ms)
  - `due`: number (timestamp in ms when card is next due: `now + intervalDays * 86400000`)
  - `buriedUntil`: number (optional timestamp until which sibling is buried)
- `persistCardReview(card)`:
  - Returns `Promise<void>`, writes updated card object to `mb_synaptic_vault` store `cards` using scoped key.
- `buildStudyQueue(cards, { isCramMode, dailyNewLimit })`:
  - Returns `{ queue: Card[], dueCount: number, newCount: number }`.

### Media Namespacing (`flash.html` ↔ `mb_synaptic_vault`)
- Scoped media key: `${deckId}:::${cleanFilename}`
- Cache key: `${deckId}:::${cleanFilename}`
- `getMediaBlobUrl(filename, deckId)`: Returns `Promise<string | null>`, looks up scoped key first and never leaks cross-deck media.

### Curriculum Module Sorting (`index.html`)
- `moduleSortState[moduleCode] = { key: 'title' | 'count' | 'date', dir: 'asc' | 'desc' }`
- Synchronized with `localStorage.getItem('mb_module_sort_state')`
- Real-time comparator sorting `moduleDecks` array before table rendering in `renderCurriculumExplorer()`.

## Code Layout
- `flash.html`: FSRS engine, review persistence, dual card sibling generation, sibling burying, daily study queue, cram toggle, media namespacing (`deckId:::filename`), card stage CSS (max 720px, clamped height, 56px action buttons).
- `flashmake.html`: Deck generator, dual card templates (`ord: 0`, `ord: 1`), scoped card IDs, `IDB_VERSION = 3`.
- `index.html`: Curriculum module sorting subbar, sort comparators, sort state persistence, deck container borders, `IDB_VERSION = 3` sync.
- `test-verification.mjs`: Automated verification suite containing all regression tests and new test suites (Suites 33, 34, 35).
- `PROJECT.md`: Project master architecture, feature inventory, milestones, contracts, and code layout.
- `TEST_INFRA.md`: E2E test track specification, coverage matrix, and test architecture.
- `TEST_READY.md`: Signal and summary of complete E2E test suite.
