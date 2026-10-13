# MedicineBank Clinical Flashcard Workstation — E2E Testing Infrastructure

**Document Version**: 1.0.0  
**Target Runner**: `test-verification.mjs` (Pure Node.js ESM, Zero Dependencies)  
**Author**: E2E Test Suite Engineer (`test_writer_1`)  
**Scope**: Verification Track across Tiers 1–4 covering Requirements 1, 2, and 3 (`PROJECT.md`)  

---

## 1. Executive Summary & Testing Track Architecture

The MedicineBank clinical flashcards platform requires authentic Anki fidelity, strict container and media isolation, and rich curriculum categorization. To guarantee defect-free delivery without brittle browser dependencies, the testing infrastructure employs a high-velocity, deterministic, pure Node.js ES Modules runner (`test-verification.mjs`).

### Core Design Principles
1. **Zero External Dependencies**: Executable with native `node test-verification.mjs` using only standard library modules (`node:fs`, `node:path`).
2. **Sub-Second Execution**: Full multi-suite suite executes in under 200ms, enabling instantaneous feedback loops during development and pre-commit checks.
3. **Deterministic & Isolated**: Every test fixture is self-contained with explicit synthetic state; no global mutation bleed or execution-order dependencies.
4. **Authoritative Output Derivation**: Expected outputs are derived mathematically from the official FSRS-5 specifications, Anki 2.1 scheduling standards, W3C CSS Clamp rules, and Unicode natural sorting algorithms.
5. **Four-Tier Verification Model**: Structured into four progressive tiers guaranteeing static contract compliance, algorithmic correctness, combinatorial robustness, and realistic clinical workload handling.

---

## 2. Four-Tier Verification Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 4: Real-World Workloads & End-to-End Session Simulation           │
│ Multi-day study sessions, multi-module curricula, cross-deck workflows  │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Pairwise Combinatorial & State Integration                     │
│ Orthogonal interaction matrices, persistence schemas, cache lifecycles │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Algorithmic Unit Verification & Mathematical Properties        │
│ FSRS-5 equations, dual card parsing, sibling burying, sorting logic    │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 1: Static Contracts, Syntactic Correctness & Security Invariants  │
│ DOM structure, CSS layout bounds, IDB schema, sanitization, ARIA       │
└────────────────────────────────────────────────────────────────────────┘
```

### Tier 1: Static Contracts & Syntactic Invariants
- Validates markup existence, CSS clamp boundaries, semantic roles (`role="toolbar"`, `role="contentinfo"`), ARIA accessibility, and security invariants (zero unsanitized injections, strict RLS).
- Inspects client files (`index.html`, `flash.html`, `flashmake.html`, `schema.sql`) for required interfaces and unified IndexedDB version (`mb_synaptic_vault` v3).

### Tier 2: Algorithmic Unit Verification
- Executes mathematical and logical functions in isolated Node.js ESM sandboxes.
- Verifies FSRS-5 continuous stability, difficulty clamping, retrievability decay, dual card sibling extraction, cloze syntax processing, and multi-criteria sorting comparators.

### Tier 3: Pairwise Combinatorial & State Integration
- Systematically covers orthogonal dimensions using all-pairs combinatorial principles.
- Tests combinations of card statuses, study modes, sorting criteria, direction vectors, and cache hit/miss scenarios.
- Verifies persistence state roundtripping via `localStorage` and `mb_synaptic_vault` IndexedDB schemas.

### Tier 4: Real-World Workloads & Session Simulation
- Simulates complete student workflows:
  - Multi-semester, multi-module medical curriculum hierarchies (CVS, CNS, RES, GIT, etc.).
  - Complex clinical vignette cards with multiple clozes and bilingual titles.
  - Multi-day spaced repetition workflows: reviewing cards, burying sibling cards, advancing simulated calendar time to next day, and verifying unburying and queue reconstitution.

---

## 3. Formal Testing Methodologies

The test track formalizes test design using four established software engineering methodologies:

### 3.1 Category-Partition Method

Decomposes each system requirement into functional categories, parameters, and disjoint equivalence partitions:

#### Spaced Repetition & Dual Cards (R1)
| Category | Parameter | Partitions / Equivalence Classes |
|---|---|---|
| **Card Type** | `note.type` | 1. Basic (Front/Back) $\rightarrow$ Dual cards (ord 0: forward, ord 1: reversed)<br>2. Cloze with single cloze ($c_1$) $\rightarrow$ Single card (ord 0)<br>3. Cloze with multiple clozes ($c_1, c_2, \dots, c_k$) $\rightarrow$ $k$ sibling cards<br>4. Single-field / malformed note $\rightarrow$ Graceful fallback |
| **Review Rating** | `rating` | 1. Again (1) $\rightarrow$ Lapse incremented, interval = 10 min, $S = 0.4072$<br>2. Hard (2) $\rightarrow$ Interval = 1 day, $S = 1.1829$<br>3. Good (3) $\rightarrow$ Interval = 3–4 days, $S = 3.1730$<br>4. Easy (4) $\rightarrow$ Interval = 15–16 days, $S = 15.6910$ |
| **Due Status** | `card.due` vs `now` | 1. Overdue (`due < now`)<br>2. Due today (`due <= now`)<br>3. Future due (`due > now`)<br>4. Unreviewed / New (`reps === 0`, `due === 0`) |
| **Study Mode** | `isCramMode` | 1. Daily Queue (`false`) $\rightarrow$ Filtered by `due <= now` + `dailyNewLimit`<br>2. Cram All (`true`) $\rightarrow$ All cards admitted unconditionally |
| **Sibling State** | `buriedUntil` | 1. Buried (`buriedUntil > now`) $\rightarrow$ Omitted from Daily Queue<br>2. Unburied (`buriedUntil <= now` or undefined) $\rightarrow$ Eligible for Daily Queue |

#### Media & Container Isolation (R2)
| Category | Parameter | Partitions / Equivalence Classes |
|---|---|---|
| **Media Key** | `scopedKey` | 1. Scoped matching active deck (`${deckId}:::${filename}`)<br>2. Scoped matching other deck (`${otherDeckId}:::${filename}`)<br>3. URL-encoded filename (`image%201.png`)<br>4. Data URL or external link (`data:image/svg...`) |
| **Stage Geometry**| Viewport Dimensions | 1. Mobile viewport (width $\le$ 480px, height $\le$ 700px)<br>2. Tablet / Laptop (width 768px–1024px, height 800px)<br>3. Desktop widescreen (width $\ge$ 1440px, height $\ge$ 900px) |
| **Card Content** | Text & Diagram Volume | 1. Minimal text (1–2 lines)<br>2. Standard vignette with diagram<br>3. Overflow content (multi-paragraph clinical case with multiple SVGs) |

#### Curriculum Sorting & Categorization (R3)
| Category | Parameter | Partitions / Equivalence Classes |
|---|---|---|
| **Sort Criterion**| `sortKey` | 1. Title / Alphabetical (`'title'`)<br>2. Total Card Count (`'count'`)<br>3. Upload / Import Date (`'date'`) |
| **Sort Direction**| `sortDir` | 1. Ascending (`'asc'`)<br>2. Descending (`'desc'`) |
| **Subject Scope** | `activeSubject` | 1. All Subjects (`'all'`)<br>2. Specific Subject (e.g. `'Physiology'`, `'Pharmacology'`) |
| **Title Format**  | `deck.title` | 1. Alphanumeric English with numeric prefixes ("Lecture 2", "Lecture 10")<br>2. Arabic Unicode titles ("علم الأمراض", "عناية مركزة")<br>3. Mixed bilingual / symbols |

---

### 3.2 Boundary Value Analysis (BVA)

Focuses testing effort on edge cases, limits, and domain extrema:

| Boundary Domain | Boundary Value | Test Case Rationale |
|---|---|---|
| `dailyNewLimit` | $N = 0$ | Extreme minimum: Zero new cards admitted; queue presents strictly due cards. |
| `dailyNewLimit` | $N = 1$ | Minimal boundary: Exactly 1 new card admitted. |
| `dailyNewLimit` | $N = 20$ | Default standard Anki daily quota. |
| `dailyNewLimit` | $N \ge \text{totalNewCards}$ | Upper saturation: More quota than available new cards; admits all available without error. |
| `due` Timestamp | $\text{due} = \text{now} - 1\text{ms}$ | Barely overdue; must be included in daily queue. |
| `due` Timestamp | $\text{due} = \text{now}$ | Exact equality boundary; must be included in daily queue. |
| `due` Timestamp | $\text{due} = \text{now} + 1\text{ms}$ | Future card boundary; must be strictly excluded from daily queue. |
| `buriedUntil` | $\text{buriedUntil} = \text{now} + 1\text{ms}$ | Currently buried; excluded from daily queue. |
| `buriedUntil` | $\text{buriedUntil} = \text{now}$ | Expiry moment; immediately available for review. |
| FSRS-5 Difficulty | $D < 1.0$ | Clamping boundary: Must clamp upward to $1.0$. |
| FSRS-5 Difficulty | $D > 10.0$ | Clamping boundary: Must clamp downward to $10.0$. |
| Card Stage Width | $\text{width} = 720\text{px}$ | Upper clamp boundary: Container never exceeds 720px width. |
| Card Stage Height | $\text{height} = 360\text{px} \dots 520\text{px}$ | Clamped height boundary via `clamp(360px, 58vh, 520px)`. |
| Action Button Height | $\text{height} = 56\text{px}$ | Equalized height preventing layout jump on flip. |
| Deck Card Count | $C = 0$ | Empty deck edge case; handles division-by-zero or sorting gracefully. |
| Card Count Ties | $C_A = C_B$ | Identical counts; must break tie using secondary natural alphabetical sort. |
| Upload Date Ties | $T_A = T_B$ | Identical or missing dates; must break tie using secondary alphabetical sort. |

---

### 3.3 Pairwise Combinatorial Testing (All-Pairs)

Guarantees that all pairwise interactions between orthogonal configuration parameters are tested:

#### Matrix 1: Card Eligibility $\times$ Study Mode
| Test # | Card Review Status | Sibling State | Study Mode | Expected Outcome |
|---|---|---|---|---|
| P1-1 | Overdue (`due < now`) | Unburied | Daily Queue | In Queue (Due) |
| P1-2 | Overdue (`due < now`) | Buried (`buriedUntil > now`) | Daily Queue | Excluded |
| P1-3 | Overdue (`due < now`) | Buried (`buriedUntil > now`) | Cram All | In Queue (Crammed) |
| P1-4 | Due Today (`due <= now`) | Unburied | Daily Queue | In Queue (Due) |
| P1-5 | Due Today (`due <= now`) | Buried (`buriedUntil > now`) | Daily Queue | Excluded |
| P1-6 | Due Today (`due <= now`) | Buried (`buriedUntil > now`) | Cram All | In Queue (Crammed) |
| P1-7 | Future (`due > now`) | Unburied | Daily Queue | Excluded |
| P1-8 | Future (`due > now`) | Unburied | Cram All | In Queue (Crammed) |
| P1-9 | New (`reps === 0`) within limit | Unburied | Daily Queue | In Queue (New) |
| P1-10 | New (`reps === 0`) beyond limit | Unburied | Daily Queue | Excluded |
| P1-11 | New (`reps === 0`) beyond limit | Unburied | Cram All | In Queue (Crammed) |
| P1-12 | New (`reps === 0`) within limit | Buried (`buriedUntil > now`) | Daily Queue | Excluded |

#### Matrix 2: Sorting Criteria $\times$ Direction $\times$ Subject Filter Scope
| Test # | Sort Key | Sort Direction | Subject Scope | Expected Ordering Behavior |
|---|---|---|---|---|
| P2-1 | `'title'` | `'asc'` | `'all'` | Alphanumeric A-Z across all decks |
| P2-2 | `'title'` | `'desc'` | `'all'` | Alphanumeric Z-A across all decks |
| P2-3 | `'title'` | `'asc'` | `'Physiology'` | Alphanumeric A-Z within Physiology |
| P2-4 | `'title'` | `'desc'` | `'Pharmacology'`| Alphanumeric Z-A within Pharmacology |
| P2-5 | `'count'` | `'desc'` | `'all'` | Highest card count first, secondary A-Z |
| P2-6 | `'count'` | `'asc'` | `'all'` | Lowest card count first, secondary A-Z |
| P2-7 | `'count'` | `'desc'` | `'Pathology'` | Highest card count first within Pathology |
| P2-8 | `'count'` | `'asc'` | `'Pathology'` | Lowest card count first within Pathology |
| P2-9 | `'date'` | `'desc'` | `'all'` | Newest import date first, secondary A-Z |
| P2-10 | `'date'` | `'asc'` | `'all'` | Oldest import date first, secondary A-Z |
| P2-11 | `'date'` | `'desc'` | `'Anatomy'` | Newest first within Anatomy |
| P2-12 | `'date'` | `'asc'` | `'Anatomy'` | Oldest first within Anatomy |

---

### 3.4 Real-World Workloads Simulation

Validates end-to-end user journeys using synthetic medical educational data:

1. **Curriculum Hierarchy Workload**:
   - Ingests a complete realistic curriculum hierarchy with 10 modules:
     - `CVS` (Cardiovascular System)
     - `CNS` (Central Nervous System)
     - `RES` (Respiratory System)
     - `GIT` (Gastrointestinal System)
     - `REN` (Renal System)
     - `MSK` (Musculoskeletal System)
     - `END/REP` (Endocrine & Reproductive System)
     - `HEM` (Hematology & Oncology)
     - `FND` (Foundational Medical Sciences)
   - Contains decks with multi-lingual titles, varying card counts (0 to 350 cards), and diverse upload dates.
   - Verifies real-time reordering when toggling between A-Z, Count, and Date, and verifies persistence when switching subject tabs and collapsing/expanding modules.

2. **Multi-Cloze Clinical Vignette Simulation**:
   - Note: "A 54-year-old male with acute chest pain is diagnosed with {{c1::Inferior STEMI}} caused by occlusion of the {{c2::Right Coronary Artery (RCA)}} leading to {{c3::AV nodal block}}."
   - Verifies generation of 3 distinct sibling cards with identical `noteId` and ordinals 0, 1, 2.
   - Sibling 1 blanks c1 and reveals c2/c3; Sibling 2 blanks c2 and reveals c1/c3; Sibling 3 blanks c3 and reveals c1/c2.
   - Simulates Day 1 review of Sibling 1 (rated Good):
     - Sibling 1 schedule updated (reps=1, interval=3d, due=Day 4).
     - Siblings 2 and 3 automatically buried until Day 2.
     - Verifies Day 1 queue immediately hides Siblings 2 and 3.
   - Advances time to Day 2:
     - Siblings 2 and 3 unbury and appear in Day 2 Daily Queue.
     - Sibling 1 remains scheduled for Day 4.

3. **Multi-Deck Media Namespacing & Collision Protection**:
   - Two distinct decks: `deck-cardio-cvs` and `deck-neuro-cns`.
   - Both decks include an image named `ecg-reading.png`, but each has completely different binary content and medical meaning.
   - Namespaced storage:
     - `deck-cardio-cvs:::ecg-reading.png`
     - `deck-neuro-cns:::ecg-reading.png`
   - Opening `deck-cardio-cvs` resolves only its ECG image; switching to `deck-neuro-cns` clears memory cache and resolves only its EEG/ECG image.
   - Verifies zero cross-deck image leakage.

---

## 4. Test Suite Mapping

All automated tests are consolidated inside `test-verification.mjs`:

| Section | Scope | Methodologies Used | Checks Count |
|---|---|---|---|
| **Sections 1–32** | Core System Baseline (KaTeX, FSRS-5 math, Protobuf media manifest, Zstandard, Cloze algorithm, Theme, Footer, Layout) | Static contracts, unit tests | 225 checks |
| **Suite 33** | **Requirement 1**: Spaced Repetition Fidelity, Dual Cards & Due Queue | Category-Partition, BVA, Real-World Simulation | Comprehensive |
| **Suite 34** | **Requirement 2**: Strict Deck & Card Container Isolation & Constant Ratio | BVA, Category-Partition, Namespacing Simulation | Comprehensive |
| **Suite 35** | **Requirement 3**: Curriculum Module Deck Categorization & Sorting System | Pairwise Combinatorial, BVA, Real-World Workload | Comprehensive |

---

## 5. Test Execution & Verification

### Running the Verification Suite
Execute from the project root directory:
```bash
node test-verification.mjs
```

### Expected Output
```text
🧪 Starting Verification Suite for l81e/Data PR...
...
🎉 ALL <TOTAL> VERIFICATION CHECKS PASSED PERFECTLY!
==================================================
```
Exit code `0` indicates 100% passing checks. Any failure produces `❌ FAIL: <reason>` and exits with code `1`.
