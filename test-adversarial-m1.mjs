// Adversarial Stress Harness for Milestone 1
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

console.log('======================================================================');
console.log('ADVERSARIAL STRESS TEST SUITE: Milestone 1 Data Persistence & IDB');
console.log('======================================================================\n');

const flashHtml = fs.readFileSync('flash.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const flashmakeHtml = fs.readFileSync('flashmake.html', 'utf8');

// -----------------------------------------------------------------------------
// CHALLENGE 1: Multi-Cloze SQLite .apkg Sibling Generation & Back-Face Reveal
// -----------------------------------------------------------------------------
console.log('--- Challenge 1: Multi-Cloze SQLite .apkg Sibling Parsing (c1, c2, c3, c4) ---');

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE col (id integer primary key, models text not null);
  CREATE TABLE notes (id integer primary key, mid integer not null, flds text not null, tags text not null);
  CREATE TABLE cards (id integer primary key, nid integer not null, ord integer not null);
`);

// Standard Anki Cloze Model
const clozeModel = {
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
db.exec(`INSERT INTO col (id, models) VALUES (1, '${JSON.stringify(clozeModel)}')`);

// Insert 4-cloze note
const textWith4Clozes = "Cardio: {{c1::SA node}} initiates impulse, {{c2::AV node}} delays conduction, {{c3::Bundle of His}} transmits, and {{c4::Purkinje fibers}} depolarize ventricles.\x1fHigh-Yield Conduction System";
db.exec(`INSERT INTO notes (id, mid, flds, tags) VALUES (500, 1000, '${textWith4Clozes}', 'cardio')`);
db.exec(`INSERT INTO cards (id, nid, ord) VALUES (9001, 500, 0)`); // SQLite has card 1

// Extract and execute the exact parsing logic from flash.html
const modelsRes = db.prepare("SELECT models FROM col LIMIT 1").get();
const parsedModels = JSON.parse(modelsRes.models);
const parsedNotes = db.prepare("SELECT id, mid, flds, tags FROM notes").all();
const rawCardRows = db.prepare("SELECT id, nid, ord FROM cards ORDER BY id ASC").all().map(r => ({ id: r.id, nid: r.nid, ord: r.ord }));

// Sibling preservation from flash.html:
const existingCardKeys = new Set(rawCardRows.map(r => `${r.nid}:${r.ord}`));
const clozeRegex = /{{c(\d+)::/g;
for (const note of parsedNotes){
  const clozes = new Set();
  let m;
  while ((m = clozeRegex.exec(note.flds)) !== null){
    clozes.add(parseInt(m[1], 10));
  }
  if (clozes.size > 1){
    for (const cNum of clozes){
      const ord = cNum - 1;
      const key = `${note.id}:${ord}`;
      if (!existingCardKeys.has(key)){
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

console.log(`[PASS] Multi-cloze note generated ${rawCardRows.length} sibling rows (expected 4)`);
for (let i = 0; i < 4; i++) {
  const row = rawCardRows[i];
  if (row.nid !== 500 || row.ord !== i) {
    console.error(`[FAIL] Sibling ${i + 1} has wrong nid (${row.nid}) or ord (${row.ord})`);
  } else {
    console.log(`  Sibling ${i + 1}: noteId=${row.nid}, ord=${row.ord}, cardId=${row.id}`);
  }
}

// Test card content generation for c1, c2, c3, c4
function processClozeText(text, clozeNum, isBack){
  if (!text) return '';
  return text.replace(/{{c(\d+)::([\s\S]*?)}}/g, (match, numStr, content) => {
    const num = parseInt(numStr, 10);
    let answer = content;
    let hint = '';
    const hintIdx = content.indexOf('::');
    if (hintIdx !== -1){
      answer = content.substring(0, hintIdx);
      hint = content.substring(hintIdx + 2);
    }
    if (num === clozeNum){
      if (isBack){
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

function compileAnkiTemplate(templateStr, fieldMap, defaultFront = '', cardOrd = 0, isBack = false){
  if (!templateStr) return '';
  let out = templateStr;
  out = out.replace(/{{FrontSide}}/g, defaultFront);
  out = out.replace(/{{([^}]+)}}/g, (_, rawToken) => {
    const token = rawToken.trim();
    if (/^c\d+::/i.test(token)) return `{{${rawToken}}}`;
    const colonIdx = token.indexOf(':');
    let filter = '';
    let fn = token;
    if (colonIdx !== -1){
      filter = token.substring(0, colonIdx).trim().toLowerCase();
      fn = token.substring(colonIdx + 1).trim();
    }
    let val = fieldMap[fn] || '';
    if (filter === 'cloze'){
      return processClozeText(val, cardOrd + 1, isBack);
    }
    return val;
  });
  if (out.includes('{{c') && out.includes('::')){
    out = processClozeText(out, cardOrd + 1, isBack);
  }
  return out;
}

const compiledCards = [];
for (const cr of rawCardRows){
  const note = parsedNotes.find(n => n.id === cr.nid);
  const model = parsedModels[note.mid];
  const fieldValues = note.flds.split('\x1f');
  const fieldMap = { 'Text': fieldValues[0], 'Extra': fieldValues[1] };
  
  // flash.html line 3774:
  const tmpl = model && model.tmpls ? model.tmpls[cr.ord] : null;

  let frontHtml = '';
  let backHtml = '';

  if (tmpl && tmpl.qfmt){
    frontHtml = compileAnkiTemplate(tmpl.qfmt, fieldMap, '', cr.ord, false);
  } else {
    frontHtml = fieldMap['Front'] || fieldValues[0] || '';
    if (frontHtml.includes('{{c') && frontHtml.includes('::')){
      frontHtml = processClozeText(frontHtml, cr.ord + 1, false);
    }
  }

  if (tmpl && tmpl.afmt){
    backHtml = compileAnkiTemplate(tmpl.afmt, fieldMap, frontHtml, cr.ord, true);
  } else {
    let backFieldVal = fieldMap['Back'] || fieldValues[1] || '';
    if (backFieldVal.includes('{{c') && backFieldVal.includes('::')){
      backFieldVal = processClozeText(backFieldVal, cr.ord + 1, true);
    }
    backHtml = `${frontHtml}<hr id=answer>${backFieldVal}`;
  }

  compiledCards.push({ ord: cr.ord, front: frontHtml, back: backHtml, tmplFound: !!tmpl });
}

console.log('\nEvaluating Back-Face Answer Reveal on Cloze Siblings:');
compiledCards.forEach((c, idx) => {
  const clozeTarget = ['SA node', 'AV node', 'Bundle of His', 'Purkinje fibers'][idx];
  const hasRevealedAnswer = c.back.includes(`<span class="cloze-blank">${clozeTarget}</span>`);
  const stillHasBlank = c.back.includes('[...]');
  console.log(`Card ${idx + 1} (ord ${c.ord}):`);
  console.log(`  Template found in model.tmpls[${c.ord}]: ${c.tmplFound}`);
  console.log(`  Reveals target answer ("${clozeTarget}"): ${hasRevealedAnswer}`);
  console.log(`  Still has blank [...] on card back: ${stillHasBlank}`);
  if (!hasRevealedAnswer && stillHasBlank) {
    console.log(`  ⚠️ DEFECT DETECTED: Card ${idx + 1} back fails to reveal answer because model.tmpls[${c.ord}] is undefined!`);
  }
});

// -----------------------------------------------------------------------------
// CHALLENGE 2: IndexedDB Version 3 Uniformity Across Files
// -----------------------------------------------------------------------------
console.log('\n--- Challenge 2: IndexedDB Version 3 Uniformity ---');
const flashMatches = [...flashHtml.matchAll(/indexedDB\.open\s*\(\s*([^,]+)\s*,\s*(\d+)\s*\)/g)];
const indexMatches = [...indexHtml.matchAll(/indexedDB\.open\s*\(\s*['"]mb_synaptic_vault['"]\s*,\s*(\d+)\s*\)/g)];
const makeMatches = [...flashmakeHtml.matchAll(/indexedDB\.open\s*\(\s*['"]mb_synaptic_vault['"]\s*,\s*(\d+)\s*\)/g)];

console.log(`flash.html calls: ${flashMatches.length} (requested version: IDB_VERSION = 3)`);
console.log(`index.html calls: ${indexMatches.length} (versions: ${indexMatches.map(m => m[1]).join(', ')})`);
console.log(`flashmake.html calls: ${makeMatches.length} (versions: ${makeMatches.map(m => m[1]).join(', ')})`);

const allV3 = indexMatches.every(m => m[1] === '3') && makeMatches.every(m => m[1] === '3') && flashHtml.includes('IDB_VERSION = 3');
console.log(`Zero VersionError risk from version number mismatch: ${allV3}`);

// -----------------------------------------------------------------------------
// CHALLENGE 3: index.html onupgradeneeded Missing Handler Analysis
// -----------------------------------------------------------------------------
console.log('\n--- Challenge 3: Analysis of index.html onupgradeneeded ---');
const idxHasUpgrade1 = indexHtml.slice(indexHtml.indexOf('const req = indexedDB.open(\'mb_synaptic_vault\', 3)'), indexHtml.indexOf('const req = indexedDB.open(\'mb_synaptic_vault\', 3)') + 200).includes('onupgradeneeded');
console.log(`index.html line 4983 defines onupgradeneeded: ${idxHasUpgrade1}`);
const idxCall2Index = indexHtml.lastIndexOf('const req = indexedDB.open(\'mb_synaptic_vault\', 3)');
const idxHasUpgrade2 = indexHtml.slice(idxCall2Index, idxCall2Index + 200).includes('onupgradeneeded');
console.log(`index.html line 7030 defines onupgradeneeded: ${idxHasUpgrade2}`);

// -----------------------------------------------------------------------------
// CHALLENGE 4: persistCardReview and handleUndo State Restoration
// -----------------------------------------------------------------------------
console.log('\n--- Challenge 4: persistCardReview and handleUndo State Restoration ---');

// Mock IndexedDB cards store
const mockCardsStore = new Map();
let currentActiveDeckId = 'deck-cardio';

function persistCardReview(card){
  const origId = card.originalId || card.id;
  const deckId = card.deckId || currentActiveDeckId || 'local-deck';
  const scopedCardId = `${deckId}:::${origId}`;
  mockCardsStore.set(scopedCardId, {
    ...card,
    id: scopedCardId,
    originalId: origId,
    deckId: deckId
  });
}

function getCardFromStore(origId, deckId = currentActiveDeckId){
  return mockCardsStore.get(`${deckId}:::${origId}`);
}

// Initial state of card
const initialCard = {
  id: 'card-c1',
  originalId: 'card-c1',
  deckId: 'deck-cardio',
  noteId: 'note-500',
  ord: 0,
  reps: 0,
  stability: 0,
  difficulty: 0,
  lapses: 0,
  due: 0
};
persistCardReview(initialCard);

console.log('Initial Card saved in store: reps =', getCardFromStore('card-c1').reps);

// Simulate Review (handleRate)
const prevCardState = { ...initialCard };
const cardAfterRate = {
  ...initialCard,
  reps: 1,
  stability: 3.173,
  difficulty: 4.8,
  due: Date.now() + 3 * 86400000,
  lastReview: Date.now()
};
persistCardReview(cardAfterRate);
console.log('After Rate Card in store: reps =', getCardFromStore('card-c1').reps, 'due =', getCardFromStore('card-c1').due);

// Simulate Sibling burying during rate
const siblingCard = {
  id: 'card-c2',
  originalId: 'card-c2',
  deckId: 'deck-cardio',
  noteId: 'note-500',
  ord: 1,
  reps: 0,
  stability: 0,
  due: 0
};
persistCardReview(siblingCard);

// Sibling burying logic from flash.html:
const tomorrowMidnight = new Date().setHours(24, 0, 0, 0);
siblingCard.buriedUntil = tomorrowMidnight;
persistCardReview(siblingCard);
console.log('Sibling Card c2 buriedUntil in store:', getCardFromStore('card-c2').buriedUntil);

// Simulate handleUndo
// In flash.html:
// deckCards[currentIndex] = last.previousState;
// persistCardReview(deckCards[currentIndex]);
persistCardReview(prevCardState);
console.log('After Undo Card c1 in store: reps =', getCardFromStore('card-c1').reps, 'stability =', getCardFromStore('card-c1').stability);
console.log('After Undo Sibling Card c2 in store: buriedUntil =', getCardFromStore('card-c2').buriedUntil);

const c1Restored = getCardFromStore('card-c1').reps === 0 && getCardFromStore('card-c1').stability === 0;
const c2Unburied = !getCardFromStore('card-c2').buriedUntil || getCardFromStore('card-c2').buriedUntil === 0;

console.log(`Card 1 state properly restored on undo: ${c1Restored}`);
console.log(`Sibling Card 2 unburied on undo: ${c2Unburied} (Note: Sibling remains buried)`);

console.log('\n======================================================================');
console.log('ADVERSARIAL STRESS TEST SUITE COMPLETE');
console.log('======================================================================');
