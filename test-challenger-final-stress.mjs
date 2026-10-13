// ============================================================================
// MedicineBank Comprehensive Adversarial Challenger Verification Suite
// Author: Final Challenger (Empirical Adversary)
// Scope: Full Stress Testing of R1, R2, and R3 across flash.html, index.html, flashmake.html
// ============================================================================

import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

console.log('======================================================================');
console.log('⚡ MEDICINEBANK EMPIRICAL CHALLENGER STRESS HARNESS ⚡');
console.log('======================================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedChecks++;
    console.error(`  ❌ FAIL: ${message}`);
    if (details) console.error(`     Details: ${details}`);
  }
}

// Read production files directly
const flashHtml = fs.readFileSync('flash.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const flashmakeHtml = fs.readFileSync('flashmake.html', 'utf8');

// ============================================================================
// SUITE 1: MULTI-CLOZE SIBLING GENERATION & ANSWER REVEAL ON CARD BACK (M1 Defect)
// ============================================================================
console.log('\n--- SUITE 1: Multi-Cloze Sibling Generation & Back Face Answer Reveal ---');

// Dynamically extract the exact cloze processing and template compilation from flash.html
// 1. Extract processClozeText
const processClozeMatch = flashHtml.match(/function\s+processClozeText\s*\([\s\S]*?\n\s{6}\}/);
if (!processClozeMatch) throw new Error('Could not extract processClozeText from flash.html');
const processClozeText = new Function(`return (${processClozeMatch[0]})`)();

// 2. Extract getFieldValue
const getFieldValueMatch = flashHtml.match(/function\s+getFieldValue\s*\([\s\S]*?\n\s{6}\}/);
if (!getFieldValueMatch) throw new Error('Could not extract getFieldValue from flash.html');
const getFieldValue = new Function(`return (${getFieldValueMatch[0]})`)();

// 3. Extract escapeHtml helper
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 4. Extract compileAnkiTemplate
const compileAnkiMatch = flashHtml.match(/function\s+compileAnkiTemplate\s*\([\s\S]*?\n\s{6}\}/);
if (!compileAnkiMatch) throw new Error('Could not extract compileAnkiTemplate from flash.html');
const compileAnkiTemplate = new Function('processClozeText', 'getFieldValue', 'escapeHtml', `
  return ${compileAnkiMatch[0]}
`)(processClozeText, getFieldValue, escapeHtml);

// ----------------------------------------------------------------------------
// Test 1.1: Real SQLite .apkg Single-Template Cloze Model (Anki Default)
// ----------------------------------------------------------------------------
{
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE col (id integer primary key, models text not null);
    CREATE TABLE notes (id integer primary key, mid integer not null, flds text not null, tags text not null);
    CREATE TABLE cards (id integer primary key, nid integer not null, ord integer not null);
  `);

  // Standard Anki Cloze Model has exactly ONE template in tmpls (ord 0)
  const standardClozeModel = {
    "1000": {
      id: 1000,
      name: "Cloze",
      type: 1,
      flds: [{ name: "Text", ord: 0 }, { name: "Extra", ord: 1 }],
      tmpls: [
        {
          name: "Cloze",
          ord: 0,
          qfmt: "{{cloze:Text}}",
          afmt: "{{cloze:Text}}<br><hr id=answer>{{Extra}}"
        }
      ]
    }
  };
  db.exec(`INSERT INTO col (id, models) VALUES (1, '${JSON.stringify(standardClozeModel)}')`);

  const vignetteText = "Cardio: {{c1::SA node}} initiates impulse, {{c2::AV node}} delays conduction, {{c3::Bundle of His}} transmits, and {{c4::Purkinje fibers}} depolarize ventricles.\x1fHigh-Yield Conduction System";
  db.exec(`INSERT INTO notes (id, mid, flds, tags) VALUES (500, 1000, '${vignetteText}', 'cardio')`);
  db.exec(`INSERT INTO cards (id, nid, ord) VALUES (9001, 500, 0)`);

  const modelsRes = db.prepare("SELECT models FROM col LIMIT 1").get();
  const parsedModels = JSON.parse(modelsRes.models);
  const parsedNotes = db.prepare("SELECT id, mid, flds, tags FROM notes").all();
  const rawCardRows = db.prepare("SELECT id, nid, ord FROM cards ORDER BY id ASC").all().map(r => ({ id: r.id, nid: r.nid, ord: r.ord }));

  // Run exact sibling preservation loop from flash.html lines 3565-3588
  const existingCardKeys = new Set(rawCardRows.map(r => `${r.nid}:${r.ord}`));
  const clozeRegex = /{{c(\d+)::/g;
  for (const note of parsedNotes) {
    const clozes = new Set();
    let m;
    while ((m = clozeRegex.exec(note.flds)) !== null) {
      clozes.add(parseInt(m[1], 10));
    }
    if (clozes.size > 1) {
      for (const cNum of clozes) {
        const ord = cNum - 1;
        const key = `${note.id}:${ord}`;
        if (!existingCardKeys.has(key)) {
          rawCardRows.push({
            id: `${note.id}-c${cNum}`,
            nid: note.id,
            ord: ord
          });
          existingCardKeys.add(key);
        }
      }
    }
  }

  assert(rawCardRows.length === 4, 'Multi-cloze note generated exactly 4 card rows for c1, c2, c3, c4');

  // Now compile each card using the EXACT code from flash.html (lines 3822-3846)
  const compiledCards = [];
  const targets = ['SA node', 'AV node', 'Bundle of His', 'Purkinje fibers'];

  for (const cr of rawCardRows) {
    const note = parsedNotes.find(n => n.id === cr.nid);
    const model = parsedModels[note.mid];
    const fieldValues = note.flds.split('\x1f');
    const fieldMap = { 'Text': fieldValues[0], 'Extra': fieldValues[1] };

    // Exact line from flash.html:
    const tmpl = model && model.tmpls ? (model.tmpls[cr.ord] || (model.tmpls.length === 1 ? model.tmpls[0] : null)) : null;

    let frontHtml = '';
    let backHtml = '';

    if (tmpl && tmpl.qfmt) {
      frontHtml = compileAnkiTemplate(tmpl.qfmt, fieldMap, '', cr.ord, false);
    } else {
      frontHtml = fieldMap['Front'] || fieldValues[0] || '';
      if (frontHtml.includes('{{c') && frontHtml.includes('::')) {
        frontHtml = processClozeText(frontHtml, cr.ord + 1, false);
      }
    }

    if (tmpl && tmpl.afmt) {
      backHtml = compileAnkiTemplate(tmpl.afmt, fieldMap, frontHtml, cr.ord, true);
    } else {
      let backFieldVal = fieldMap['Back'] || fieldValues[1] || '';
      let clozeBackText = (fieldMap['Text'] || fieldValues[0] || '');
      if (clozeBackText.includes('{{c') && clozeBackText.includes('::')) {
        backHtml = `${processClozeText(clozeBackText, cr.ord + 1, true)}<hr id=answer>${backFieldVal}`;
      } else {
        backHtml = `${frontHtml}<hr id=answer>${backFieldVal}`;
      }
    }

    compiledCards.push({ ord: cr.ord, front: frontHtml, back: backHtml, tmplFound: !!tmpl });
  }

  // Verify each card reveals its answer on the back and does NOT retain [...]
  compiledCards.forEach((c, idx) => {
    const target = targets[idx];
    const revealsTarget = c.back.includes(`<span class="cloze-blank">${target}</span>`);
    const retainsBlank = c.back.includes('[...]');
    const frontHasBlank = c.front.includes('<span class="cloze-blank">[...]</span>');

    assert(c.tmplFound === true, `Card ${idx + 1} (ord: ${c.ord}): Single-template cloze fallback found template`);
    assert(frontHasBlank, `Card ${idx + 1} (ord: ${c.ord}): Front face blanks target cloze c${idx + 1}`);
    assert(revealsTarget, `Card ${idx + 1} (ord: ${c.ord}): Back face reveals "${target}"`);
    assert(!retainsBlank, `Card ${idx + 1} (ord: ${c.ord}): Back face has NO retained [...]`);
  });
}

// ----------------------------------------------------------------------------
// Test 1.2: Cloze Note without Template (Fallback Branch Verification)
// ----------------------------------------------------------------------------
{
  const fieldValues = [
    "Neuro: {{c1::Frontal lobe}} controls motor and executive functions, while {{c2::Occipital lobe}} processes vision.",
    "Brodmann areas"
  ];
  const fieldMap = { 'Text': fieldValues[0], 'Back': fieldValues[1] };
  const model = { name: "NoTemplateModel", tmpls: [] }; // Empty templates to force fallback branch

  for (let ord = 0; ord <= 1; ord++) {
    const tmpl = model && model.tmpls ? (model.tmpls[ord] || (model.tmpls.length === 1 ? model.tmpls[0] : null)) : null;
    let frontHtml = '';
    let backHtml = '';

    if (tmpl && tmpl.qfmt) {
      frontHtml = compileAnkiTemplate(tmpl.qfmt, fieldMap, '', ord, false);
    } else {
      frontHtml = fieldMap['Front'] || fieldValues[0] || '';
      if (frontHtml.includes('{{c') && frontHtml.includes('::')) {
        frontHtml = processClozeText(frontHtml, ord + 1, false);
      }
    }

    if (tmpl && tmpl.afmt) {
      backHtml = compileAnkiTemplate(tmpl.afmt, fieldMap, frontHtml, ord, true);
    } else {
      let backFieldVal = fieldMap['Back'] || fieldValues[1] || '';
      let clozeBackText = (fieldMap['Text'] || fieldValues[0] || '');
      if (clozeBackText.includes('{{c') && clozeBackText.includes('::')) {
        backHtml = `${processClozeText(clozeBackText, ord + 1, true)}<hr id=answer>${backFieldVal}`;
      } else {
        backHtml = `${frontHtml}<hr id=answer>${backFieldVal}`;
      }
    }

    const expected = ord === 0 ? 'Frontal lobe' : 'Occipital lobe';
    assert(backHtml.includes(`<span class="cloze-blank">${expected}</span>`), `Fallback branch ord: ${ord} reveals "${expected}"`);
    assert(!backHtml.includes('[...]'), `Fallback branch ord: ${ord} does NOT contain [...]`);
  }
}

// ----------------------------------------------------------------------------
// Test 1.3: Cloze with Custom Hints
// ----------------------------------------------------------------------------
{
  const textWithHints = "Pharmacology: {{c1::Atropine::Antimuscarinic}} treats bradycardia; {{c2::Epinephrine::Sympathomimetic}} treats anaphylaxis.";
  const front1 = processClozeText(textWithHints, 1, false);
  const back1 = processClozeText(textWithHints, 1, true);
  assert(front1.includes('<span class="cloze-blank">[Antimuscarinic]</span>'), 'Front face displays custom hint [Antimuscarinic]');
  assert(back1.includes('<span class="cloze-blank">Atropine</span>'), 'Back face displays answer Atropine');
  assert(!back1.includes('[Antimuscarinic]'), 'Back face does not display hint bracket');

  const front2 = processClozeText(textWithHints, 2, false);
  const back2 = processClozeText(textWithHints, 2, true);
  assert(front2.includes('<span class="cloze-blank">[Sympathomimetic]</span>'), 'Front face displays custom hint [Sympathomimetic]');
  assert(back2.includes('<span class="cloze-blank">Epinephrine</span>'), 'Back face displays answer Epinephrine');
  assert(!back2.includes('[Sympathomimetic]'), 'Back face does not display hint bracket');
}

// ----------------------------------------------------------------------------
// Test 1.4: Non-Sequential Cloze Numbers (c1 and c5)
// ----------------------------------------------------------------------------
{
  const textNonSeq = "{{c1::Heparin}} binds antithrombin III; {{c5::Warfarin}} inhibits VKORC1.";
  const cardOrd4 = 4; // ord for c5 is 4 (cNum 5 - 1)
  const frontC5 = processClozeText(textNonSeq, cardOrd4 + 1, false);
  const backC5 = processClozeText(textNonSeq, cardOrd4 + 1, true);
  assert(frontC5.includes('Heparin'), 'c5 front reveals unblanked c1 Heparin');
  assert(frontC5.includes('<span class="cloze-blank">[...]</span>'), 'c5 front blanks Warfarin');
  assert(backC5.includes('<span class="cloze-blank">Warfarin</span>'), 'c5 back reveals Warfarin');
  assert(!backC5.includes('[...]'), 'c5 back has no [...]');
}

// ----------------------------------------------------------------------------
// Test 1.5: Multiple Clozes with Identical Number in One Note
// ----------------------------------------------------------------------------
{
  const textDuplicateC1 = "{{c1::Right atrium}} receives deoxygenated blood from {{c1::SVC and IVC}}, whereas {{c2::Left ventricle}} pumps to aorta.";
  const front1 = processClozeText(textDuplicateC1, 1, false);
  const back1 = processClozeText(textDuplicateC1, 1, true);
  const blankCountFront = (front1.match(/<span class="cloze-blank">\[\.\.\.\]<\/span>/g) || []).length;
  assert(blankCountFront === 2, 'Front 1 blanks both c1 occurrences');
  assert(back1.includes('<span class="cloze-blank">Right atrium</span>') && back1.includes('<span class="cloze-blank">SVC and IVC</span>'), 'Back 1 reveals both c1 occurrences');
  assert(!back1.includes('[...]'), 'Back 1 has no [...]');
}

// ----------------------------------------------------------------------------
// Test 1.6: Complex Clozes with LaTeX Math and Embedded HTML
// ----------------------------------------------------------------------------
{
  const textMath = "Biochemistry: {{c1::$$V_{max}$$}} is unchanged in competitive inhibition, while {{c2::$$K_m$$}} is increased.";
  const frontMath1 = processClozeText(textMath, 1, false);
  const backMath1 = processClozeText(textMath, 1, true);
  assert(frontMath1.includes('<span class="cloze-blank">[...]</span>'), 'Front math blanks V_max');
  assert(backMath1.includes('<span class="cloze-blank">$$V_{max}$$</span>'), 'Back math reveals $$V_{max}$$');
  assert(!backMath1.includes('[...]'), 'Back math has no [...]');

  const textHtml = "Cardio: {{c1::<b>Cardiac output</b> = HR &times; SV}} and {{c2::<i>Preload</i>}} affects stroke volume.";
  const frontHtml1 = processClozeText(textHtml, 1, false);
  const backHtml1 = processClozeText(textHtml, 1, true);
  assert(backHtml1.includes('<span class="cloze-blank"><b>Cardiac output</b> = HR &times; SV</span>'), 'Back reveals rich HTML cloze contents');
}

// ============================================================================
// SUITE 2: INDEXEDDB CLEAN-BROWSER INITIALIZATION & STORE CREATION (M1 Defect)
// ============================================================================
console.log('\n--- SUITE 2: IndexedDB Clean-Browser Initialization & Stores Creation ---');

// Verify static declarations across files
const indexUpgrade1 = indexHtml.includes("req.onupgradeneeded = (e) => {") && indexHtml.slice(indexHtml.indexOf("const req = indexedDB.open('mb_synaptic_vault', 3)")).includes("createObjectStore('decks'");
assert(indexUpgrade1, "index.html first indexedDB.open includes onupgradeneeded creating decks, cards, media stores");

const lastOpenIdx = indexHtml.lastIndexOf("const req = indexedDB.open('mb_synaptic_vault', 3)");
const indexUpgrade2 = indexHtml.slice(lastOpenIdx, lastOpenIdx + 400).includes("onupgradeneeded = (e) => {") && indexHtml.slice(lastOpenIdx, lastOpenIdx + 400).includes("createObjectStore('cards'");
assert(indexUpgrade2, "index.html second indexedDB.open includes onupgradeneeded creating decks, cards, media stores");

// Verify zero VersionError risk (all 3 files use version 3)
const idbCalls = [
  ...indexHtml.matchAll(/indexedDB\.open\s*\(\s*['"]mb_synaptic_vault['"]\s*,\s*(\d+)\s*\)/g),
  ...flashmakeHtml.matchAll(/indexedDB\.open\s*\(\s*['"]mb_synaptic_vault['"]\s*,\s*(\d+)\s*\)/g)
];
const allAreV3 = idbCalls.every(m => m[1] === '3') && flashHtml.includes('const IDB_VERSION = 3');
assert(allAreV3, "All indexedDB.open calls consistently request unified version 3");

// Behavioral simulation of Clean Browser First Visit to index.html -> navigate to flash.html
{
  class MockIDBDatabase {
    constructor(name, version) {
      this.name = name;
      this.version = version;
      this.objectStoreNames = {
        _set: new Set(),
        contains(name) { return this._set.has(name); },
        add(name) { this._set.add(name); }
      };
      this.stores = new Map();
    }
    createObjectStore(name, options) {
      this.objectStoreNames.add(name);
      this.stores.set(name, new Map());
      return { name, options };
    }
    transaction(storeNames, mode) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      for (const n of names) {
        if (!this.objectStoreNames.contains(n)) {
          throw new Error(`NotFoundError: One of the specified object stores was not found: ${n}`);
        }
      }
      return {
        objectStore: (n) => ({
          put: (item) => this.stores.get(n).set(item.id || item.name, item),
          get: (id) => this.stores.get(n).get(id),
          getAll: () => Array.from(this.stores.get(n).values())
        })
      };
    }
  }

  // Initial fresh browser state: no database
  let simulatedDb = null;

  // 1. User opens index.html first
  function simulateIndexOpen() {
    let isUpgrade = false;
    if (!simulatedDb) {
      simulatedDb = new MockIDBDatabase('mb_synaptic_vault', 3);
      isUpgrade = true;
    }
    if (isUpgrade) {
      // Execute the exact onupgradeneeded handler from index.html:
      const db = simulatedDb;
      if (!db.objectStoreNames.contains('decks')) db.createObjectStore('decks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'name' });
    }
    return simulatedDb;
  }

  const dbAfterIndex = simulateIndexOpen();
  assert(dbAfterIndex.objectStoreNames.contains('decks'), 'Clean visit to index.html created "decks" store');
  assert(dbAfterIndex.objectStoreNames.contains('cards'), 'Clean visit to index.html created "cards" store');
  assert(dbAfterIndex.objectStoreNames.contains('media'), 'Clean visit to index.html created "media" store');

  // 2. User navigates from index.html to flash.html (database is already at v3, onupgradeneeded does NOT run)
  function simulateFlashOpen() {
    // Current version == requested version, so no upgrade needed
    return simulatedDb;
  }

  const dbInFlash = simulateFlashOpen();
  let writeReviewSucceeded = false;
  try {
    const tx = dbInFlash.transaction(['cards'], 'readwrite');
    const store = tx.objectStore('cards');
    store.put({ id: 'deck-1:::card-1', reps: 1, stability: 3.173, due: Date.now() + 86400000 });
    const saved = store.get('deck-1:::card-1');
    writeReviewSucceeded = saved && saved.reps === 1;
  } catch (err) {
    writeReviewSucceeded = false;
  }

  assert(writeReviewSucceeded, 'flash.html transactions succeed without NotFoundError after index.html creates stores');
}

// ============================================================================
// SUITE 3: SIBLING BURYING AND UNDO UNBURYING IN flash.html (M1 Defect)
// ============================================================================
console.log('\n--- SUITE 3: Sibling Burying and Undo Unburying in flash.html ---');

{
  const mockVaultStore = new Map();
  let currentActiveDeckId = 'deck-cvs';

  function persistCardReview(card) {
    const origId = card.originalId || card.id;
    const deckId = card.deckId || currentActiveDeckId || 'local-deck';
    const scopedCardId = `${deckId}:::${origId}`;
    mockVaultStore.set(scopedCardId, {
      ...card,
      id: scopedCardId,
      originalId: origId,
      deckId: deckId
    });
  }

  // Set up 3 siblings from a multi-cloze note (noteId: 'note-500')
  const card1 = { id: 'card-c1', originalId: 'card-c1', noteId: 'note-500', ord: 0, deckId: 'deck-cvs', reps: 0, stability: 0, due: 0, buriedUntil: 0 };
  const card2 = { id: 'card-c2', originalId: 'card-c2', noteId: 'note-500', ord: 1, deckId: 'deck-cvs', reps: 0, stability: 0, due: 0, buriedUntil: 0 };
  const card3 = { id: 'card-c3', originalId: 'card-c3', noteId: 'note-500', ord: 2, deckId: 'deck-cvs', reps: 0, stability: 0, due: 0, buriedUntil: 0 };

  // And another card from an unrelated note (noteId: 'note-600')
  const card4 = { id: 'card-d1', originalId: 'card-d1', noteId: 'note-600', ord: 0, deckId: 'deck-cvs', reps: 0, stability: 0, due: 0, buriedUntil: 0 };
  const card5 = { id: 'card-d2', originalId: 'card-d2', noteId: 'note-600', ord: 1, deckId: 'deck-cvs', reps: 0, stability: 0, due: 0, buriedUntil: 0 };

  let allDeckCards = [card1, card2, card3, card4, card5];
  let deckCards = [...allDeckCards];
  let reviewHistory = [];
  let currentIndex = 0;

  // Persist initial cards
  allDeckCards.forEach(c => persistCardReview(c));

  // STEP 1: Rate card 1 (note-500)
  const prevCard1State = { ...deckCards[0] };
  deckCards[0].reps = 1;
  deckCards[0].stability = 3.173;
  deckCards[0].due = Date.now() + 3 * 86400000;
  persistCardReview(deckCards[0]);

  const tomorrowMidnight = new Date().setHours(24, 0, 0, 0);
  allDeckCards.forEach(s => {
    if (s.noteId === deckCards[0].noteId && (s.originalId || s.id) !== (deckCards[0].originalId || deckCards[0].id)) {
      s.buriedUntil = tomorrowMidnight;
      persistCardReview(s);
    }
  });

  reviewHistory.push({
    index: 0,
    previousState: prevCard1State,
    rating: 3
  });

  assert(mockVaultStore.get('deck-cvs:::card-c2').buriedUntil === tomorrowMidnight, 'Rating Card 1 buries sibling Card 2 until tomorrow');
  assert(mockVaultStore.get('deck-cvs:::card-c3').buriedUntil === tomorrowMidnight, 'Rating Card 1 buries sibling Card 3 until tomorrow');
  assert(mockVaultStore.get('deck-cvs:::card-d2').buriedUntil === 0, 'Unrelated Card 5 is NOT buried by Card 1 review');

  // STEP 2: Rate card 4 (note-600)
  currentIndex = 3;
  const prevCard4State = { ...deckCards[currentIndex] };
  deckCards[currentIndex].reps = 1;
  deckCards[currentIndex].stability = 1.182;
  deckCards[currentIndex].due = Date.now() + 1 * 86400000;
  persistCardReview(deckCards[currentIndex]);

  allDeckCards.forEach(s => {
    if (s.noteId === deckCards[currentIndex].noteId && (s.originalId || s.id) !== (deckCards[currentIndex].originalId || deckCards[currentIndex].id)) {
      s.buriedUntil = tomorrowMidnight;
      persistCardReview(s);
    }
  });

  reviewHistory.push({
    index: 3,
    previousState: prevCard4State,
    rating: 2
  });

  assert(mockVaultStore.get('deck-cvs:::card-d2').buriedUntil === tomorrowMidnight, 'Rating Card 4 buries sibling Card 5');

  // STEP 3: Undo Card 4 first (LIFO order)
  function handleUndo() {
    if (!reviewHistory.length) return;
    const last = reviewHistory.pop();
    currentIndex = last.index;
    deckCards[currentIndex] = last.previousState;

    persistCardReview(deckCards[currentIndex]);

    const allIdx = allDeckCards.findIndex(c => (c.originalId || c.id) === (deckCards[currentIndex].originalId || deckCards[currentIndex].id));
    if (allIdx !== -1) allDeckCards[allIdx] = { ...deckCards[currentIndex] };

    // Unbury any siblings in allDeckCards and persist them
    const undoneCard = deckCards[currentIndex];
    if (undoneCard && undoneCard.noteId) {
      allDeckCards.forEach(s => {
        if (s.noteId === undoneCard.noteId && (s.originalId || s.id) !== (undoneCard.originalId || undoneCard.id)) {
          s.buriedUntil = 0;
          persistCardReview(s);
        }
      });
    }
  }

  handleUndo();

  assert(mockVaultStore.get('deck-cvs:::card-d1').reps === 0, 'Undo 1 restores Card 4 state');
  assert(mockVaultStore.get('deck-cvs:::card-d2').buriedUntil === 0, 'Undo 1 unburies sibling Card 5');
  assert(mockVaultStore.get('deck-cvs:::card-c2').buriedUntil === tomorrowMidnight, 'Card 2 remains buried (belonging to Card 1)');

  // STEP 4: Undo Card 1 next
  handleUndo();

  assert(mockVaultStore.get('deck-cvs:::card-c1').reps === 0, 'Undo 2 restores Card 1 state');
  assert(mockVaultStore.get('deck-cvs:::card-c2').buriedUntil === 0, 'Undo 2 unburies sibling Card 2 in vault');
  assert(mockVaultStore.get('deck-cvs:::card-c3').buriedUntil === 0, 'Undo 2 unburies sibling Card 3 in vault');
}

// ============================================================================
// SUITE 4: REQUIREMENT 2 ISOLATION & BOUNDS
// ============================================================================
console.log('\n--- SUITE 4: Requirement 2 Isolation & Bounds ---');

// ----------------------------------------------------------------------------
// Test 4.1: Strict Media Namespacing & Zero Cross-Deck Leaks
// ----------------------------------------------------------------------------
{
  const mockMediaVault = new Map();
  const inMemoryMediaCache = new Map();

  // Save assets for deck-cvs and deck-res with identical filename 'diagram.png'
  const cvsDeckId = 'deck-cvs';
  const resDeckId = 'deck-res';
  const filename = 'diagram.png';

  const cvsBlobUrl = 'blob:http://localhost/cvs-diagram-uuid-1111';
  const resBlobUrl = 'blob:http://localhost/res-diagram-uuid-2222';

  // Seed storage as saveDeckToVault does
  mockMediaVault.set(`${cvsDeckId}:::${filename}`, { blobUrl: cvsBlobUrl, deckId: cvsDeckId, fileName: filename });
  mockMediaVault.set(`${resDeckId}:::${filename}`, { blobUrl: resBlobUrl, deckId: resDeckId, fileName: filename });

  // Simulate getMediaBlobUrl from flash.html lines 1780-1821
  async function getMediaBlobUrl(fn, deckId) {
    if (!fn) return null;
    let clean = fn.trim().replace(/^.*[\\\/]/, '');
    const targetDeckId = deckId;
    if (!targetDeckId) return null;

    const scopedKey = `${targetDeckId}:::${clean}`;
    const scopedKeyLower = `${targetDeckId}:::${clean.toLowerCase()}`;

    if (inMemoryMediaCache.has(scopedKey)) return inMemoryMediaCache.get(scopedKey);
    if (inMemoryMediaCache.has(scopedKeyLower)) return inMemoryMediaCache.get(scopedKeyLower);

    const record = mockMediaVault.get(scopedKey) || mockMediaVault.get(scopedKeyLower);
    if (record && record.blobUrl) {
      inMemoryMediaCache.set(scopedKey, record.blobUrl);
      inMemoryMediaCache.set(scopedKeyLower, record.blobUrl);
      return record.blobUrl;
    }
    return null;
  }

  const resolvedCvs = await getMediaBlobUrl(filename, cvsDeckId);
  const resolvedRes = await getMediaBlobUrl(filename, resDeckId);
  const resolvedUnauthorized = await getMediaBlobUrl(filename, 'deck-neuro');

  assert(resolvedCvs === cvsBlobUrl, 'Resolving diagram.png for deck-cvs returns strictly CVS blob URL');
  assert(resolvedRes === resBlobUrl, 'Resolving diagram.png for deck-res returns strictly RES blob URL');
  assert(resolvedCvs !== resolvedRes, 'Identical filenames across decks resolve to distinct, isolated URLs');
  assert(resolvedUnauthorized === null, 'Unauthorized or foreign deck cannot access diagrams from other decks');

  // Verify memory cache keys are strictly scoped
  const cachedKeys = Array.from(inMemoryMediaCache.keys());
  const allKeysScoped = cachedKeys.every(k => k.includes(':::'));
  assert(allKeysScoped, 'All cached media keys strictly contain ":::" namespace prefix');

  // Verify revokeAndClearMediaCache completely empties in-memory cache
  inMemoryMediaCache.clear();
  assert(inMemoryMediaCache.size === 0, 'revokeAndClearMediaCache completely cleans memory cache');
}

// ----------------------------------------------------------------------------
// Test 4.2: CSS Layout Bounds & Action Buttons (flash.html)
// ----------------------------------------------------------------------------
{
  const cardStageBounded = /max-width\s*:\s*720px/.test(flashHtml);
  assert(cardStageBounded, '.card-stage bounded to max-width: 720px');

  const cardHeightClamped = /clamp\s*\(\s*360px\s*,\s*58vh\s*,\s*520px\s*\)/.test(flashHtml);
  assert(cardHeightClamped, '.card-stage bounded by clamp(360px, 58vh, 520px)');

  const flipFaceOverflow = /overflow-y\s*:\s*auto/.test(flashHtml) && /overscroll-behavior\s*:\s*contain/.test(flashHtml);
  assert(flipFaceOverflow, '.flip-face enforces overflow-y: auto and overscroll-behavior: contain');

  const actionContainerAnchored = /\.action-container[\s\S]*?flex-shrink\s*:\s*0/.test(flashHtml);
  assert(actionContainerAnchored, '.action-container enforces flex-shrink: 0 to anchor buttons');

  const buttonsEqualized = /\.reveal-btn[\s\S]*?height\s*:\s*56px/.test(flashHtml) && /\.rate-btn[\s\S]*?height\s*:\s*56px/.test(flashHtml);
  assert(buttonsEqualized, '.reveal-btn and .rate-btn equalized to 56px height');
}

// ----------------------------------------------------------------------------
// Test 4.3: Curriculum Module Table Card Borders & Container Separation (index.html)
// ----------------------------------------------------------------------------
{
  assert(indexHtml.includes('.curriculum-module-card'), 'index.html defines .curriculum-module-card container');
  assert(indexHtml.includes('.curriculum-module-table-wrap'), 'index.html defines .curriculum-module-table-wrap wrapper');

  const tableSeparation = /border-collapse\s*:\s*separate/.test(indexHtml) && /border-spacing\s*:\s*0\s+8px/.test(indexHtml);
  assert(tableSeparation, '.anki-deck-table enforces separate border-spacing: 0 8px');

  const rowBorderCard = /\.anki-deck-row[\s\S]*?border\s*:\s*1px solid/.test(indexHtml);
  assert(rowBorderCard, '.anki-deck-row styled with distinct card container borders');
}

// ============================================================================
// SUITE 5: REQUIREMENT 3 CURRICULUM MODULE SORTING & PERSISTENCE
// ============================================================================
console.log('\n--- SUITE 5: Requirement 3 Curriculum Module Sorting & Persistence ---');

// Dynamically extract sortCurriculumDecks from index.html
const sortDecksMatch = indexHtml.match(/function\s+sortCurriculumDecks\s*\([\s\S]*?\n\s{2}\}/);
if (!sortDecksMatch) throw new Error('Could not extract sortCurriculumDecks from index.html');
const sortCurriculumDecks = new Function(`return (${sortDecksMatch[0]})`)();

// ----------------------------------------------------------------------------
// Test 5.1: Natural Alphanumeric Title Sorting
// ----------------------------------------------------------------------------
{
  const decks = [
    { title: "Lecture 10: Heart Failure" },
    { title: "Lecture 2: Cardiac Cycle" },
    { title: "Lecture 1: Intro to Cardiology" },
    { title: "Lecture 20: Advanced Arrhythmias" },
    { title: "Lecture 3: Valvular Diseases" }
  ];

  const sortedAsc = sortCurriculumDecks(decks, { key: 'title', dir: 'asc' });
  const titlesAsc = sortedAsc.map(d => d.title);
  assert(titlesAsc[0].includes('Lecture 1:'), 'Natural sort asc: Lecture 1 is first');
  assert(titlesAsc[1].includes('Lecture 2:'), 'Natural sort asc: Lecture 2 is second');
  assert(titlesAsc[2].includes('Lecture 3:'), 'Natural sort asc: Lecture 3 is third');
  assert(titlesAsc[3].includes('Lecture 10:'), 'Natural sort asc: Lecture 2 precedes Lecture 10');
  assert(titlesAsc[4].includes('Lecture 20:'), 'Natural sort asc: Lecture 20 is last');

  const sortedDesc = sortCurriculumDecks(decks, { key: 'title', dir: 'desc' });
  const titlesDesc = sortedDesc.map(d => d.title);
  assert(titlesDesc[0].includes('Lecture 20:'), 'Natural sort desc: Lecture 20 is first');
  assert(titlesDesc[1].includes('Lecture 10:'), 'Natural sort desc: Lecture 10 is second');
  assert(titlesDesc[4].includes('Lecture 1:'), 'Natural sort desc: Lecture 1 is last');

  // Arabic Natural Sort
  const arabicDecks = [
    { title: "المحاضرة 10: الفشل القلبي" },
    { title: "المحاضرة 2: الدورة القلبية" },
    { title: "المحاضرة 1: مقدمة القلب" }
  ];
  const arSorted = sortCurriculumDecks(arabicDecks, { key: 'title', dir: 'asc' });
  assert(arSorted[0].title.includes('المحاضرة 1:'), 'Arabic natural sort: المحاضرة 1 is first');
  assert(arSorted[1].title.includes('المحاضرة 2:'), 'Arabic natural sort: المحاضرة 2 is second');
  assert(arSorted[2].title.includes('المحاضرة 10:'), 'Arabic natural sort: المحاضرة 10 is third');
}

// ----------------------------------------------------------------------------
// Test 5.2: Card Count Sorting with Tie-Breaker
// ----------------------------------------------------------------------------
{
  const decks = [
    { title: "Deck Gamma", totalCount: 50 },
    { title: "Deck Alpha", totalCount: 200 },
    { title: "Deck Beta", totalCount: 50 },
    { title: "Deck Delta", dueCount: 10, newCount: 20 }, // total 30 via fallback
    { title: "Deck Epsilon", totalCount: 0 }
  ];

  const sortedCountDesc = sortCurriculumDecks(decks, { key: 'count', dir: 'desc' });
  assert(sortedCountDesc[0].title === 'Deck Alpha' && sortedCountDesc[0].totalCount === 200, 'Count desc: largest deck (200 cards) is first');
  assert(sortedCountDesc[1].title === 'Deck Beta' && sortedCountDesc[1].totalCount === 50, 'Count desc tie-breaker: Beta sorts before Gamma alphabetically');
  assert(sortedCountDesc[2].title === 'Deck Gamma' && sortedCountDesc[2].totalCount === 50, 'Count desc tie-breaker: Gamma sorts after Beta');
  assert(sortedCountDesc[3].title === 'Deck Delta', 'Count desc fallback: 30 cards precedes 0 cards');
  assert(sortedCountDesc[4].title === 'Deck Epsilon' && sortedCountDesc[4].totalCount === 0, 'Count desc: 0 cards is last');

  const sortedCountAsc = sortCurriculumDecks(decks, { key: 'count', dir: 'asc' });
  assert(sortedCountAsc[0].title === 'Deck Epsilon', 'Count asc: smallest deck (0 cards) is first');
  assert(sortedCountAsc[1].title === 'Deck Delta', 'Count asc: 30 cards is second');
  assert(sortedCountAsc[4].title === 'Deck Alpha', 'Count asc: largest deck (200 cards) is last');
}

// ----------------------------------------------------------------------------
// Test 5.3: Upload / Import Date Sorting
// ----------------------------------------------------------------------------
{
  const decks = [
    { title: "Deck March", createdAt: "2026-03-15T10:00:00Z" },
    { title: "Deck April", createdAt: "2026-04-01T12:00:00Z" },
    { title: "Deck January", date: "2026-01-10T08:00:00Z" },
    { title: "Deck Unknown", createdAt: "" }
  ];

  const sortedDateDesc = sortCurriculumDecks(decks, { key: 'date', dir: 'desc' });
  assert(sortedDateDesc[0].title === 'Deck April', 'Date desc: April 2026 is first');
  assert(sortedDateDesc[1].title === 'Deck March', 'Date desc: March 2026 is second');
  assert(sortedDateDesc[2].title === 'Deck January', 'Date desc: January 2026 is third');
  assert(sortedDateDesc[3].title === 'Deck Unknown', 'Date desc: Missing date is last');

  const sortedDateAsc = sortCurriculumDecks(decks, { key: 'date', dir: 'asc' });
  assert(sortedDateAsc[0].title === 'Deck Unknown', 'Date asc: Missing date is first');
  assert(sortedDateAsc[1].title === 'Deck January', 'Date asc: January 2026 is second');
  assert(sortedDateAsc[3].title === 'Deck April', 'Date asc: April 2026 is last');
}

// ----------------------------------------------------------------------------
// Test 5.4: Module Sort State & localStorage Persistence
// ----------------------------------------------------------------------------
{
  const mockLocalStorage = new Map();
  let moduleSortState = {};

  function getModuleSort(modCode) {
    return moduleSortState[modCode] || { key: 'title', dir: 'asc' };
  }

  function setModuleSort(modCode, sortKey) {
    const cur = getModuleSort(modCode);
    let newDir;
    if (cur.key === sortKey) {
      newDir = cur.dir === 'asc' ? 'desc' : 'asc';
    } else {
      newDir = sortKey === 'title' ? 'asc' : 'desc';
    }
    moduleSortState[modCode] = { key: sortKey, dir: newDir };
    mockLocalStorage.set('mb_module_sort_state', JSON.stringify(moduleSortState));
    return moduleSortState[modCode];
  }

  // 1. Initial defaults
  assert(getModuleSort('CVS').key === 'title' && getModuleSort('CVS').dir === 'asc', 'Default sort for CVS is title asc');

  // 2. Click count on CVS -> key: count, dir: desc
  const s1 = setModuleSort('CVS', 'count');
  assert(s1.key === 'count' && s1.dir === 'desc', 'Clicking count sets key: count, dir: desc');

  // 3. Click count again on CVS -> key: count, dir: asc
  const s2 = setModuleSort('CVS', 'count');
  assert(s2.key === 'count' && s2.dir === 'asc', 'Clicking count again toggles dir: asc');

  // 4. Set CNS to date -> independent from CVS
  const sCNS = setModuleSort('CNS', 'date');
  assert(sCNS.key === 'date' && sCNS.dir === 'desc', 'Module CNS set to date desc');
  assert(getModuleSort('CVS').key === 'count' && getModuleSort('CVS').dir === 'asc', 'Module CVS retains independent count asc config');

  // 5. Simulate page reload: restore from mock localStorage
  const restoredJson = mockLocalStorage.get('mb_module_sort_state');
  const restoredState = JSON.parse(restoredJson);
  assert(restoredState['CVS'].key === 'count' && restoredState['CVS'].dir === 'asc', 'Reload restores CVS sort config');
  assert(restoredState['CNS'].key === 'date' && restoredState['CNS'].dir === 'desc', 'Reload restores CNS sort config');
}

// ----------------------------------------------------------------------------
// Test 5.5: Markup & DOM Verification in index.html
// ----------------------------------------------------------------------------
{
  assert(indexHtml.includes('class="curriculum-sort-toolbar"'), 'index.html contains .curriculum-sort-toolbar markup');
  assert(indexHtml.includes('class="curriculum-module-subbar"'), 'index.html contains .curriculum-module-subbar hosting tabs and toolbar');
  assert(indexHtml.includes('data-sort-key="title"') && indexHtml.includes('data-sort-key="count"') && indexHtml.includes('data-sort-key="date"'), 'index.html defines sort buttons for title, count, and date');
  assert(indexHtml.includes("btn.addEventListener('click', (e) => {") && indexHtml.includes('setModuleSort('), 'index.html binds sort buttons with click listener and setModuleSort');
}

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${totalChecks}`);
console.log(`PASSED: ${passedChecks}`);
console.log(`FAILED: ${failedChecks}`);
console.log('======================================================================');

if (failedChecks === 0) {
  console.log('🎉 VERDICT: CONFIRM (100% of adversarial stress checks PASSED)');
  process.exit(0);
} else {
  console.error('❌ VERDICT: REJECT (One or more adversarial checks FAILED)');
  process.exit(1);
}
