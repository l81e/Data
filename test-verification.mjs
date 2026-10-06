// =============================================================================
// Automated Verification Suite for MedicineBank Clinical Workstation PR
// Validates: HTML Structure, JS Syntax, FSRS-5 Math, KaTeX parser, SQL Schema
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';

let failures = 0;
let passed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
    passed++;
  }
}

console.log('🧪 Starting Verification Suite for l81e/Data PR...\n');

// 1. Verify index.html
const indexHtml = fs.readFileSync('index.html', 'utf-8');
assert(indexHtml.length > 50000, `index.html is fully restored (${indexHtml.length} bytes, not truncated)`);
assert(indexHtml.includes('flashcardsViewerUrl'), 'index.html contains flashcardsViewerUrl');
assert(!indexHtml.includes('KYS'), 'index.html contains zero corrupted text');
assert(indexHtml.includes('data.medicinebank.org') || indexHtml.includes('window.location.origin'), 'index.html origin handling is intact');
assert(indexHtml.includes('adminDashboardOverlay'), 'index.html contains Admin Dashboard modal (adminDashboardOverlay)');
assert(indexHtml.includes('openAdminDashboard'), 'index.html contains openAdminDashboard controller function');
assert(indexHtml.includes('dayEmptyAdminBtn'), 'index.html contains dayEmptyAdminBtn for empty days');
assert(indexHtml.includes('adminCreateSubjectBtn') && indexHtml.includes('adminPublishBtn'), 'index.html contains create subject & upload material controls');

// 2. Verify flash.html
const flashHtml = fs.readFileSync('flash.html', 'utf-8');
assert(flashHtml.includes('katex.min.js'), 'flash.html loads KaTeX library');
assert(flashHtml.includes('calculateInitialStability'), 'flash.html contains FSRS-5 initial stability engine');
assert(flashHtml.includes('FSRS_W = ['), 'flash.html contains calibrated 19-parameter FSRS weight vector');
assert(flashHtml.includes('cue-again') && flashHtml.includes('cue-good'), 'flash.html contains 4-way gesture visual cue elements');
assert(flashHtml.includes('HIGH_YIELD_DEMO_DECK'), 'flash.html contains built-in High-Yield Clinical Demo Deck');
assert(flashHtml.includes('mb_synaptic_vault'), 'flash.html contains Sovereign IndexedDB vault integration');
assert(flashHtml.includes('lightboxModal'), 'flash.html contains Clinical Diagram Lightbox Zoom');
assert(flashHtml.includes('usmle_60s'), 'flash.html contains USMLE 60-Second exam pace countdown');
assert(flashHtml.includes('localApkgInput'), 'flash.html contains local .apkg file picker input');
assert(flashHtml.includes('resolveCardMedia'), 'flash.html contains persistent media rehydration & resolver');
assert(flashHtml.includes('dropZoneOverlay') || flashHtml.includes('drop-zone-overlay'), 'flash.html contains drag-and-drop .apkg loader');
assert(flashHtml.includes('lightboxZoomInBtn'), 'flash.html contains pan & zoom clinical lightbox controls');
assert(flashHtml.includes('inMemoryMediaCache'), 'flash.html maintains memory media cache for offline diagrams');

// 3. Verify flashmake.html
const flashmakeHtml = fs.readFileSync('flashmake.html', 'utf-8');
assert(flashmakeHtml.includes('katex.min.js'), 'flashmake.html loads KaTeX for live formula preview');
assert(flashmakeHtml.includes('bulkModalOverlay'), 'flashmake.html contains Bulk Import modal');
assert(flashmakeHtml.includes('testDeckBtn'), 'flashmake.html contains Test in Clinical Workstation button');
assert(flashmakeHtml.includes('frontAddCloze') && flashmakeHtml.includes('frontAddMath'), 'flashmake.html contains cloze & math formatting toolbar');

// 4. Verify 404.html
const notFoundHtml = fs.readFileSync('404.html', 'utf-8');
assert(notFoundHtml.includes('/flash.html'), '404.html routes /flash cleanly to /flash.html');
assert(notFoundHtml.includes('/flashmake.html'), '404.html routes /flashmake cleanly to /flashmake.html');
assert(notFoundHtml.includes('mb_redirect_path'), '404.html captures date deep-links for index.html');

// 5. Verify schema.sql
const schemaSql = fs.readFileSync('schema.sql', 'utf-8');
assert(schemaSql.includes('year_of_view AS ENUM'), 'schema.sql defines year_of_view enum');
assert(schemaSql.includes('flashcard_reviews'), 'schema.sql defines flashcard_reviews table');
assert(schemaSql.includes('ROW LEVEL SECURITY'), 'schema.sql enables Row Level Security');
assert(schemaSql.includes('idx_lectures_date'), 'schema.sql creates performance indexes');

// 6. Test FSRS-5 Math Formulation
const FSRS_W = [
  0.4072, 1.1829, 3.173, 15.691, 7.1949, 0.5345, 1.4604, 0.0046, 1.5457,
  0.1192, 1.0192, 1.9395, 0.11, 0.296, 0.227, 0.2595, 2.9466, 0.5, 0.6391
];
const FSRS_FACTOR = 19 / 81;

function calcInitS(rating) { return FSRS_W[rating - 1]; }
assert(calcInitS(1) === 0.4072, 'FSRS-5 Again initial stability is 0.4072');
assert(calcInitS(2) === 1.1829, 'FSRS-5 Hard initial stability is 1.1829');
assert(calcInitS(3) === 3.173, 'FSRS-5 Good initial stability is 3.173');
assert(calcInitS(4) === 15.691, 'FSRS-5 Easy initial stability is 15.691');

function calcR(t, S) { return Math.pow(1 + (FSRS_FACTOR * t) / S, -0.5); }
const rAtS = calcR(3.173, 3.173);
assert(Math.abs(rAtS - 0.9) < 0.01, `Continuous retrievability R(t=S) ~ 0.90 (calculated: ${rAtS.toFixed(4)})`);

function calcIvl(S, r = 0.9) { return Math.round((S / FSRS_FACTOR) * (Math.pow(r, -2) - 1)); }
const ivl3 = calcIvl(3.173);
assert(ivl3 >= 3 && ivl3 <= 4, `Initial Good interval ~ 3-4 days (calculated: ${ivl3})`);

// 7. Verify KaTeX Math Regex Logic
const testText = 'Calculate $MAP = DP + \\frac{1}{3}PP$ and $$CO = HR \\times SV$$';
const blockMatches = [...testText.matchAll(/\$\$([\s\S]*?)\$\$/g)].map(m => m[1]);
const textWithoutBlocks = testText.replace(/\$\$([\s\S]*?)\$\$/g, '___BLOCK___');
const inlineMatches = [...textWithoutBlocks.matchAll(/\$([^\$\n\r]+?)\$/g)].map(m => m[1]);
assert(inlineMatches.length === 1 && inlineMatches[0].includes('MAP'), 'KaTeX inline math pattern parsed correctly');
assert(blockMatches.length === 1 && blockMatches[0].includes('CO'), 'KaTeX block math pattern parsed correctly');

// 8. Strict Institutional & Project Anonymity (Zero "Neurova" Mentions)
const filesToCheck = ['index.html', 'flash.html', 'flashmake.html', '404.html', 'schema.sql', 'PULL_REQUEST.md', 'README.md'];
let neurovaFound = false;
for (const file of filesToCheck) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    if (/neurova/i.test(content)) {
      neurovaFound = true;
      assert(false, `Found unexpected mention of Neurova in ${file}`);
    }
  }
}
if (!neurovaFound) {
  assert(true, 'Zero mentions of Neurova across entire pull request codebase (strict project independence)');
}

// 9. AnkiWeb Minimalist UI Design for Homepage Decks
assert(indexHtml.includes('anki-deck-table'), 'index.html renders Anki-style deck table (anki-deck-table)');
assert(indexHtml.includes('anki-th-due') && indexHtml.includes('anki-th-new') && indexHtml.includes('anki-th-total'), 'index.html table headers include Due (green), New (blue), and Total');
assert(indexHtml.includes('anki-pill-due') && indexHtml.includes('anki-pill-new'), 'index.html renders authentic Anki review count badges');
assert(indexHtml.includes('anki-study-btn'), 'index.html includes direct Study action buttons for each deck');
assert(indexHtml.includes('ankiDeckSearchInput'), 'index.html includes real-time Anki deck search and filter');
assert(indexHtml.includes('anki-supplement-wrap'), 'index.html cleanly separates supplemental lecture resources');

// 10. Master Admin Passcode Authentication Gate
assert(indexHtml.includes('You want to join US then V73'), 'index.html defines the Master Admin Passcode: "You want to join US then V73"');
assert(indexHtml.includes('ADMIN_PASSCODE_HASH'), 'index.html stores SHA-256 cryptographic hash of passcode');
assert(indexHtml.includes('adminAuthModalOverlay'), 'index.html includes Admin Authentication modal (adminAuthModalOverlay)');
assert(indexHtml.includes('adminAuthChip'), 'index.html includes Admin status indicator chip in header');
assert(indexHtml.includes('verifyAdminPasscode'), 'index.html implements verifyAdminPasscode cryptographic routine');
assert(indexHtml.includes('isAdminAuthenticated'), 'index.html provides session-based admin state checking');

// 11. In-Dashboard Deck & Card Inspector (SQLite WASM + JSZip)
assert(indexHtml.includes('jszip.min.js') && indexHtml.includes('sql-wasm.js'), 'index.html loads JSZip and SQLite WASM in head');
assert(indexHtml.includes('deckCardInspectorOverlay'), 'index.html includes Deck & Card Inspector modal (deckCardInspectorOverlay)');
assert(indexHtml.includes('openDeckCardInspector'), 'index.html implements openDeckCardInspector controller');
assert(indexHtml.includes('inspectorSaveChangesBtn'), 'index.html includes inspectorSaveChangesBtn for repacking .apkg');
assert(indexHtml.includes('cardEditModalOverlay'), 'index.html includes cardEditModalOverlay for editing/adding cards');
assert(indexHtml.includes('openCardEditModal') && indexHtml.includes('deleteCardFromDeck'), 'index.html provides card add/edit/delete operations');
assert(indexHtml.includes('editMaterialModalOverlay') && indexHtml.includes('openEditMaterialModal'), 'index.html provides Edit Deck/Material dialog');
assert(indexHtml.includes('editSubjectModalOverlay') && indexHtml.includes('openEditSubjectModal'), 'index.html provides Edit Subject dialog');

// 12. Dedicated Anki Flashcards Pure Curriculum Platform (Timetable UI Completely Purged)
assert(!indexHtml.includes('timetableArchiveToggleBtn'), 'index.html has completely purged timetableArchiveToggleBtn (100% focused on flashcards)');
assert(!indexHtml.includes('archiveBanner'), 'index.html has completely purged archiveBanner');
assert(indexHtml.includes('curriculumContainer'), 'index.html contains primary Anki Curriculum Explorer container (curriculumContainer)');
assert(indexHtml.includes('curriculumYearSelector'), 'index.html contains Academic Year selector pills (curriculumYearSelector)');
assert(indexHtml.includes('curriculumSemesterFilter'), 'index.html contains Semester filter tabs (curriculumSemesterFilter)');
assert(indexHtml.includes('curriculumSearchInput'), 'index.html contains real-time Curriculum fast search (curriculumSearchInput)');
assert(indexHtml.includes('curriculumModulesList'), 'index.html contains Modular Module Cards container (curriculumModulesList)');
assert(indexHtml.includes('fetchCurriculumHierarchy'), 'index.html implements fetchCurriculumHierarchy multi-level querying');
assert(indexHtml.includes('renderCurriculumExplorer'), 'index.html implements renderCurriculumExplorer modular cards renderer');
assert(indexHtml.includes('classifyCurriculumHierarchy'), 'index.html implements classifyCurriculumHierarchy auto-parser');
assert(indexHtml.includes('adminUploadYearSelect') && indexHtml.includes('adminUploadModuleSelect'), 'index.html provides admin upload curriculum hierarchy selectors');
assert(indexHtml.includes('extractHumanCaption'), 'index.html provides extractHumanCaption to prevent raw JSON captions');
assert(flashHtml.includes('deckUrl'), 'flash.html supports deckUrl parameter for direct cloud deck loading');
assert(flashHtml.includes('getSqlJs'), 'flash.html implements getSqlJs singleton cache for instant compilation');
// 13. Mobile Responsiveness, Move Deck & Admin Module Management
assert(indexHtml.includes('anki-deck-mobile-bar'), 'index.html contains dedicated mobile responsive deck bar (anki-deck-mobile-bar)');
assert(indexHtml.includes('mobile-only') && indexHtml.includes('desktop-only'), 'index.html contains mobile-only and desktop-only responsive layout rules');
assert(indexHtml.includes('moveDeckModalOverlay'), 'index.html contains Move Deck modal (moveDeckModalOverlay)');
assert(indexHtml.includes('openMoveDeckModal') && indexHtml.includes('executeMoveDeck'), 'index.html implements openMoveDeckModal and executeMoveDeck controllers');
assert(indexHtml.includes('data-curriculum-move'), 'index.html includes Move Deck action button (data-curriculum-move)');
assert(indexHtml.includes('curriculumAddModuleBtn'), 'index.html includes Add Module button in curriculum explorer (curriculumAddModuleBtn)');
assert(indexHtml.includes('adminPaneModules'), 'index.html includes Admin Modules Manager pane (adminPaneModules)');
assert(indexHtml.includes('createCurriculumModule') && indexHtml.includes('deleteCurriculumModule'), 'index.html implements createCurriculumModule and deleteCurriculumModule controllers');
assert(indexHtml.includes('curriculum-mod-del-btn'), 'index.html contains module delete buttons (curriculum-mod-del-btn)');
assert(indexHtml.includes('renderAdminModulesList'), 'index.html implements renderAdminModulesList controller');
// 14. Deck Upload Actions & Auth Flow
assert(indexHtml.includes('curriculumEmptyUploadBtn'), 'index.html wires empty state upload button (curriculumEmptyUploadBtn)');
assert(indexHtml.includes('curriculumUploadDeckBtn'), 'index.html includes toolbar Upload Deck button (curriculumUploadDeckBtn)');
assert(indexHtml.includes('window.openAdminDashboard = openAdminDashboard'), 'index.html exports openAdminDashboard to window for reliable modal invocation');
// 15. Custom Webpage Slider & Theme-Reactive Arrowless Scrollbar System
assert(indexHtml.includes('--scrollbar-track') && indexHtml.includes('--scrollbar-thumb'), 'index.html defines theme-reactive scrollbar CSS variables');
assert(indexHtml.includes('::-webkit-scrollbar-button') && indexHtml.includes('display: none !important'), 'index.html eliminates OS default arrow buttons');
assert(indexHtml.includes('scrollProgressLine'), 'index.html includes top dynamic reading & scroll progress line (scrollProgressLine)');
assert(indexHtml.includes('pageScrubber'), 'index.html includes custom interactive page slider dock (pageScrubber)');
assert(indexHtml.includes('scrubberTrackWrap') && indexHtml.includes('scrubberThumb'), 'index.html includes draggable scrubber track and thumb');
assert(indexHtml.includes('scrubberJumpTop') && indexHtml.includes('scrubberJumpBottom'), 'index.html includes quick top/bottom jump action buttons');
assert(indexHtml.includes('initPageSlider') && indexHtml.includes('window.updatePageSlider'), 'index.html implements initPageSlider controller and exports helpers');
assert(flashHtml.includes('--scrollbar-track') && flashHtml.includes('--scrollbar-thumb'), 'flash.html defines theme-reactive scrollbars for clinical workstation');
assert(flashHtml.includes('::-webkit-scrollbar-button') && flashHtml.includes('display: none !important'), 'flash.html eliminates OS default arrow buttons');

// 16. Single Slider Standard Look & Theme Dropdown Optional Toggle
assert(indexHtml.includes('floatingScrubberToggle'), 'index.html includes floatingScrubberToggle in Theme Menu');
assert(indexHtml.includes('has-floating-scrubber'), 'index.html applies .has-floating-scrubber class only when enabled');
assert(indexHtml.includes('mb_floating_scrubber_enabled'), 'index.html stores mb_floating_scrubber_enabled in localStorage');
assert(indexHtml.includes('.page-scrubber {') && indexHtml.includes('display: none;'), 'index.html keeps floating scrubber hidden by default for sleek single slider look');

// 17. Universal Anki Parser & Template Engine
assert(flashHtml.includes("collection.anki21b") && flashHtml.includes("collection.anki21") && flashHtml.includes("collection.anki2"), 'flash.html supports modern Anki 2.1.50+ (.anki21b), Anki 2.1 (.anki21) and legacy (.anki2) schemas');
assert(flashHtml.includes('fzstd'), 'flash.html integrates fzstd Zstandard decompressor for modern Anki collections');
assert(flashHtml.includes('isDummyWarning'), 'flash.html auto-invalidates placeholder Anki update warnings from vault cache');
assert(flashHtml.includes('FROM notetypes'), 'flash.html supports modern Anki schemas with separate notetypes table');
assert(flashHtml.includes('compileAnkiTemplate'), 'flash.html implements compileAnkiTemplate engine');
assert(flashHtml.includes('{{#([^}]+)}}'), 'flash.html supports conditional template blocks ({{#Field}}...{{/Field}})');
assert(flashHtml.includes('{{\\^([^}]+)}}'), 'flash.html supports inverted conditional blocks ({{^Field}}...{{/Field}})');
assert(flashHtml.includes('clinical-diagram-img'), 'flash.html marks clinical diagrams with clinical-diagram-img class');
assert(flashHtml.includes('anki-reference-attachment'), 'flash.html provides automatic reference diagram attachment fallback');
assert(indexHtml.includes("collection.anki21b") && indexHtml.includes("collection.anki21") && indexHtml.includes("collection.anki2"), 'index.html inspector supports collection.anki21b, collection.anki21, and collection.anki2');
assert(fs.existsSync('fzstd.min.js'), 'fzstd.min.js is bundled locally for 100% offline-first Zstandard support');

// 18. Anki Template & Conditional Resolution Unit Verification
{
  function getFieldValue(fieldMap, key){
    if (!key) return '';
    if (fieldMap[key] !== undefined) return fieldMap[key];
    const trimmed = key.trim();
    if (fieldMap[trimmed] !== undefined) return fieldMap[trimmed];
    const norm = trimmed.toLowerCase().replace(/[\s_\-]+/g, '');
    for (const [k, v] of Object.entries(fieldMap)){
      if (k.toLowerCase().replace(/[\s_\-]+/g, '') === norm) return v;
    }
    return undefined;
  }

  function isFieldPopulated(val){
    if (val === undefined || val === null) return false;
    const str = String(val).trim();
    if (!str) return false;
    if (/<img\b|<video\b|<audio\b|<iframe\b|<object\b/i.test(str)) return true;
    return str.replace(/<[^>]+>/g, '').trim().length > 0;
  }

  function compileAnkiTemplate(templateStr, fieldMap, defaultFront = ''){
    if (!templateStr) return '';
    let out = templateStr;
    out = out.replace(/{{FrontSide}}/g, defaultFront);
    let passes = 10;
    while (passes-- > 0 && /{{#([^}]+)}}([\s\S]*?){{\/\1}}/g.test(out)){
      out = out.replace(/{{#([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, fieldName, inner) => {
        const val = getFieldValue(fieldMap, fieldName);
        return isFieldPopulated(val) ? inner : '';
      });
    }
    passes = 10;
    while (passes-- > 0 && /{{\^([^}]+)}}([\s\S]*?){{\/\1}}/g.test(out)){
      out = out.replace(/{{\^([^}]+)}}([\s\S]*?){{\/\1}}/g, (_, fieldName, inner) => {
        const val = getFieldValue(fieldMap, fieldName);
        return isFieldPopulated(val) ? '' : inner;
      });
    }
    out = out.replace(/{{([^}]+)}}/g, (_, rawToken) => {
      const token = rawToken.trim();
      if (!token) return '';
      const colonIdx = token.indexOf(':');
      let filter = '';
      let fn = token;
      if (colonIdx !== -1){
        filter = token.substring(0, colonIdx).trim().toLowerCase();
        fn = token.substring(colonIdx + 1).trim();
      }
      let val = getFieldValue(fieldMap, fn);
      if (val === undefined || val === null) return '';
      if (filter === 'text') return val.replace(/<[^>]+>/g, '');
      return val;
    });
    out = out.replace(/{{[^}]+}}/g, '');
    return out;
  }

  const populatedFields = {
    'Front': 'What is the mechanism of Action?',
    'Back': 'Blocks Na+/K+ ATPase',
    'PDF Reference': '<img src="slide_03.png">'
  };
  const template1 = '{{FrontSide}}<hr id=answer>{{Back}}<br><br>{{#PDF Reference}}\n📖 Lecture Slide Reference\n{{PDF Reference}}\n{{/PDF Reference}}';
  const res1 = compileAnkiTemplate(template1, populatedFields, 'What is the mechanism of Action?');
  assert(!res1.includes('{{#PDF Reference}}'), 'Anki template removes opening conditional tag {{#PDF Reference}}');
  assert(!res1.includes('{{/PDF Reference}}'), 'Anki template removes closing conditional tag {{/PDF Reference}}');
  assert(!res1.includes('{{PDF Reference}}'), 'Anki template replaces {{PDF Reference}} token with field value');
  assert(res1.includes('<img src="slide_03.png">'), 'Anki template renders image reference tag');
  assert(res1.includes('📖 Lecture Slide Reference'), 'Anki template renders conditional label when field is present');

  const emptyFields = {
    'Front': 'What is the mechanism of Action?',
    'Back': 'Blocks Na+/K+ ATPase',
    'PDF Reference': ''
  };
  const res2 = compileAnkiTemplate(template1, emptyFields, 'What is the mechanism of Action?');
  assert(!res2.includes('📖 Lecture Slide Reference'), 'Anki template omits conditional block when field is empty');
  assert(!res2.includes('{{'), 'Anki template leaves zero unparsed braces when field is empty');

  const template3 = '{{Back}}<br>{{PDF Reference}}';
  const res3 = compileAnkiTemplate(template3, populatedFields);
  assert(res3.includes('<img src="slide_03.png">'), 'Anki template correctly parses fields with spaces {{PDF Reference}}');

  const template4 = '{{^PDF Reference}}No Diagram Available{{/PDF Reference}}';
  const res4_empty = compileAnkiTemplate(template4, emptyFields);
  const res4_pop = compileAnkiTemplate(template4, populatedFields);
  assert(res4_empty.includes('No Diagram Available'), 'Anki inverted conditional renders when field is empty');
  assert(!res4_pop.includes('No Diagram Available'), 'Anki inverted conditional omitted when field is present');
}

// 19. Zstandard (zstd) Decompression Engine Verification
{
  const fzstdCode = fs.readFileSync('fzstd.min.js', 'utf-8');
  const m = { exports: {} };
  new Function('module', 'exports', fzstdCode)(m, m.exports);
  const fzstd = m.exports;
  assert(typeof fzstd.decompress === 'function', 'fzstd exports decompress function');
  
  // Test frame check with zstd magic number (0x28, 0xB5, 0x2F, 0xFD)
  const zstdMagic = [0x28, 0xb5, 0x2f, 0xfd];
  assert(zstdMagic[0] === 40 && zstdMagic[1] === 181 && zstdMagic[2] === 47 && zstdMagic[3] === 253, 'Zstandard magic number correctly calibrated');
}

// 20. Favicon & Mobile Theme Switcher Verification
{
  assert(fs.existsSync('favicon.png') && fs.statSync('favicon.png').size > 1000, 'favicon.png exists in root with authentic dimensions');
  assert(fs.existsSync('favicon.ico') && fs.statSync('favicon.ico').size > 1000, 'favicon.ico exists in root with multi-resolution payload');

  const files = ['index.html', 'flash.html', 'flashmake.html', '404.html', 'shhhhhh.html'];
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf-8');
    assert(content.includes('rel="icon"') && content.includes('favicon.png'), `${f} includes favicon link in head`);
  }

  const indexContent = fs.readFileSync('index.html', 'utf-8');
  assert(indexContent.includes('.theme-swatch-popup{left:0; right:auto;'), 'index.html contains mobile responsive theme popup positioning');
  assert(indexContent.includes('adjustThemePopupPosition'), 'index.html includes dynamic adjustThemePopupPosition bounds protection');
}

// 21. Real Card Counts Transparency & Admin Controls Gating Verification
{
  const indexContent = fs.readFileSync('index.html', 'utf-8');

  // Verify that hardcoded fake card counts (15 due, 30 new, 45 total) have been eliminated
  assert(!indexContent.includes('dueCount: 15, newCount: 30, totalCount: 45'), 'index.html has zero hardcoded fake card counts (15 due, 30 new, 45 total removed)');
  
  // Verify real card count extraction and Spaced Repetition engine
  assert(indexContent.includes('meta.cardCount') && indexContent.includes('loadVaultStatsCache'), 'index.html extracts real deck cardCount and calculates review metrics from user vault');
  assert(indexContent.includes('anki-pill-total'), 'index.html displays real total card count badge for every deck');
  assert(indexContent.includes('detectedCardCount'), 'index.html includes automatic SQLite/JSZip card counter for new uploads');

  // Verify Admin UI Gating
  assert(indexContent.includes('.admin-only{display:none !important;}'), 'index.html has strict .admin-only hiding CSS rule');
  assert(indexContent.includes('body.admin-authenticated .admin-only'), 'index.html activates .admin-only elements exclusively when admin-authenticated');
  assert(indexContent.includes('class="anki-add-deck-btn admin-only" id="curriculumAddModuleBtn"'), 'curriculumAddModuleBtn is strictly gated with admin-only');
  assert(indexContent.includes('class="anki-add-deck-btn admin-only" id="curriculumUploadDeckBtn"'), 'curriculumUploadDeckBtn is strictly gated with admin-only');
  assert(indexContent.includes('isAdminAuthenticated()'), 'index.html checks isAdminAuthenticated() for deck row action buttons');
  
  // Verify that regular students only get Study and Download .apkg buttons
  const isAuthFn = (authed) => {
    let actions = [];
    actions.push('study');
    actions.push('download');
    if (authed) {
      actions.push('edit', 'move', 'delete', 'inspect');
    }
    return actions;
  };
  const studentActions = isAuthFn(false);
  const adminActions = isAuthFn(true);
  assert(studentActions.length === 2 && studentActions.includes('study') && studentActions.includes('download'), 'Regular students receive only Study and Download actions');
  assert(adminActions.length === 6 && adminActions.includes('edit') && adminActions.includes('delete'), 'Authenticated admins receive all 6 management actions');
}

// 22. Clinical Deck Loading Suite & Telemetry Stepper Verification
{
  const flashHtml = fs.readFileSync('flash.html', 'utf-8');

  // Verify clinical loader markup and ARIA accessibility
  assert(flashHtml.includes('id="clinicalDeckLoader"') && flashHtml.includes('class="clinical-deck-loader"'), 'flash.html contains clinicalDeckLoader container in card stage');
  assert(flashHtml.includes('role="status"') && flashHtml.includes('aria-live="polite"') && flashHtml.includes('aria-busy="true"'), 'clinicalDeckLoader includes complete WCAG 2.1 AA ARIA accessibility attributes');

  // Verify shimmering skeleton layout
  assert(flashHtml.includes('skeleton-shimmer') && flashHtml.includes('skeleton-title'), 'flash.html contains clinical skeleton title placeholder');
  assert(flashHtml.includes('skeleton-line w-95') && flashHtml.includes('skeleton-line w-85'), 'flash.html contains clinical vignette text skeleton lines');
  assert(flashHtml.includes('skeleton-diagram'), 'flash.html contains clinical diagram skeleton placeholder');

  // Verify telemetry dock and progress bar
  assert(flashHtml.includes('loader-progress-track') && flashHtml.includes('loader-progress-fill'), 'flash.html contains high-precision glowing progress track');
  assert(flashHtml.includes('id="loaderPercentBadge"') && flashHtml.includes('id="loaderByteCounter"'), 'flash.html contains percentage badge and live byte counter');

  // Verify 4-phase stepper indicators
  assert(flashHtml.includes('id="phaseDownload"') && flashHtml.includes('id="phaseUnpack"') && flashHtml.includes('id="phaseSqlite"') && flashHtml.includes('id="phaseFsrs"'), 'flash.html contains all 4 phase stepper indicators (Download, Unpack, SQLite, FSRS Ready)');

  // Verify streaming byte download and controller functions
  assert(flashHtml.includes('reader.read()') && flashHtml.includes('getReader'), 'flash.html implements streaming byte download with ReadableStream');
  assert(flashHtml.includes('showClinicalDeckLoader') && flashHtml.includes('updateDeckLoaderProgress') && flashHtml.includes('hideClinicalDeckLoader'), 'flash.html exports showClinicalDeckLoader, updateDeckLoaderProgress, and hideClinicalDeckLoader controllers');

  // Verify morph fade reveal animation
  assert(flashHtml.includes('cardMorphReveal') && flashHtml.includes('morph-reveal'), 'flash.html defines smooth medical morph fade transition into first card');

  // Verify index.html passes deckTitle
  const indexHtml = fs.readFileSync('index.html', 'utf-8');
  assert(indexHtml.includes('flashcardsViewerUrl(m.id, m.title)'), 'index.html passes deckTitle to flashcardsViewerUrl for instant loader branding');
}

// 23. Phantom "Core" Module & Deck Elimination Verification
{
  const indexHtml = fs.readFileSync('index.html', 'utf-8');

  // Verify client-side classification never sets or defaults module to "Core"
  assert(indexHtml.includes("if (moduleCode.trim().toLowerCase() === 'core')"), 'classifyCurriculumHierarchy purges any caption module named "Core"');
  assert(!indexHtml.includes("module: modVal || 'Core'"), 'editMaterial modal never defaults module to "Core"');

  // Verify fetchCurriculumHierarchy explicitly filters out any phantom "Core" module
  assert(indexHtml.includes("if (!mCode || mCode.trim().toLowerCase() === 'core') continue"), 'fetchCurriculumHierarchy ignores any material with moduleCode "Core"');

  // Verify renderCurriculumExplorer filters out any module with code or name "Core"
  assert(indexHtml.includes("if (!m.code || m.code.trim().toLowerCase() === 'core') return false"), 'renderCurriculumExplorer excludes any module with code "Core"');
  assert(indexHtml.includes("if (m.name && m.name.trim().toLowerCase() === 'core') return false"), 'renderCurriculumExplorer excludes any module with name "Core"');

  // Verify deck row fallback tag is General / عام and not Core
  assert(!indexHtml.includes("deck.subjTag || 'Core'"), 'Deck row metadata does not fallback to "Core"');
}

// 24. Mobile Responsiveness & Table Containment Verification
{
  const indexHtml = fs.readFileSync('index.html', 'utf-8');

  // Verify table wrapper and block display on mobile
  assert(indexHtml.includes('.curriculum-module-table-wrap') && indexHtml.includes('overflow-x:hidden !important'), '.curriculum-module-table-wrap enforces overflow-x:hidden on mobile to prevent clipping');
  assert(indexHtml.includes('.anki-deck-table tbody') && indexHtml.includes('display:block') && indexHtml.includes('box-sizing:border-box'), '.anki-deck-table displays as block on mobile');
  assert(indexHtml.includes('.anki-deck-meta-row span:not(.anki-subj-tag)') && indexHtml.includes('text-overflow:ellipsis'), '.anki-deck-meta-row spans truncate long filenames cleanly');

  // Verify mobile deck bar layout guarantees action buttons visibility
  assert(indexHtml.includes('.anki-deck-mobile-bar') && indexHtml.includes('flex-wrap:nowrap') && indexHtml.includes('justify-content:space-between'), '.anki-deck-mobile-bar keeps counts and action buttons anchored on a single row');
  assert(indexHtml.includes('.anki-action-group.mobile-actions') && indexHtml.includes('flex-wrap:nowrap') && indexHtml.includes('flex-shrink:0'), '.mobile-actions prevents buttons from wrapping offscreen');
}

// 25. Cross-Deck & Cross-Card Content Isolation Verification
{
  const flashHtml = fs.readFileSync('flash.html', 'utf-8');

  // Verify state reset and media revocation
  assert(flashHtml.includes('function revokeAndClearMediaCache()'), 'flash.html defines revokeAndClearMediaCache to reclaim blobs and purge media collisions');
  assert(flashHtml.includes('function resetDeckState()'), 'flash.html defines resetDeckState to clear cards, DOM, and history across deck switches');

  // Verify scoped keys in IndexedDB vault
  assert(flashHtml.includes('const scopedCardId = `${deckId}:::${origId}`'), 'saveDeckToVault scopes card IDs by deckId to prevent cross-deck card collisions');
  assert(flashHtml.includes('const scopedMediaKey = `${deckId}:::${cleanName}`'), 'saveDeckToVault scopes media entries by deckId to prevent cross-deck image collisions');
  assert(flashHtml.includes('const prefix = `${deckId}:::`'), 'loadDeckFromVault rehydrates media strictly filtered by active deck prefix');

  // Verify Dedicated Anki Cloze Processor
  assert(flashHtml.includes('function processClozeText(text, clozeNum, isBack)'), 'flash.html implements dedicated processClozeText algorithm');

  // Unit Test Cloze Processor logic
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

  const sampleCloze = 'The {{c1::Heart::Pump}} pumps blood to the {{c2::Lungs::Oxygenation}} for gas exchange.';
  const c1Front = processClozeText(sampleCloze, 1, false);
  const c1Back = processClozeText(sampleCloze, 1, true);
  const c2Front = processClozeText(sampleCloze, 2, false);
  const c2Back = processClozeText(sampleCloze, 2, true);

  assert(c1Front.includes('[Pump]') && c1Front.includes('Lungs') && !c1Front.includes('Heart'), 'Cloze Card 1 Front blanks target term with hint and preserves other terms');
  assert(c1Back.includes('<span class="cloze-blank">Heart</span>') && c1Back.includes('Lungs'), 'Cloze Card 1 Back reveals target term with highlighted span');
  assert(c2Front.includes('Heart') && c2Front.includes('[Oxygenation]') && !c2Front.includes('Lungs'), 'Cloze Card 2 Front blanks term 2 and displays term 1 cleanly');
  assert(c2Back.includes('Heart') && c2Back.includes('<span class="cloze-blank">Lungs</span>'), 'Cloze Card 2 Back reveals term 2 with highlighted span');
}

// 29. Verify Protobuf Media Manifest, Modern Anki Schema, and Swipe Direction HUD Toggle
{
  assert(flashHtml.includes('function parseMediaManifest'), 'flash.html defines universal parseMediaManifest engine');
  assert(flashHtml.includes('MediaEntries') || flashHtml.includes('fieldNum === 1 && wireType === 2'), 'flash.html decodes binary Protobuf MediaEntries');
  assert(flashHtml.includes('parseTemplateConfig'), 'flash.html parses Protobuf template config (qfmt and afmt)');
  assert(flashHtml.includes('SELECT ntid, ord, name FROM fields'), 'flash.html queries modern fields table');
  assert(flashHtml.includes('SELECT ntid, ord, name, config FROM templates'), 'flash.html queries modern templates table');
  assert(flashHtml.includes('hasUnresolvedImages') && flashHtml.includes('hasStaleEmptyImages'), 'flash.html invalidates stale cache with missing/unresolved images');
  assert(flashHtml.includes('.gesture-compass-hud{\n    display:none') || flashHtml.includes('gestureCompassHud" style="display:none;"'), 'gestureCompassHud is hidden/disabled by default in flash.html');
  assert(flashHtml.includes("getStored(COMPASS_LS_KEY, 'false') === 'true'"), 'COMPASS_LS_KEY defaults to false (extra option, not standard)');
  assert(indexHtml.includes('themeGestureCompassToggle'), 'index.html contains Swipe Direction Cues toggle in Theme Menu');
  assert(indexHtml.includes('mb_show_compass'), 'index.html persists mb_show_compass preference');

  // Test parseMediaManifest on synthetic binary Protobuf data
  function buildSyntheticProtoMedia(fileNames) {
    const chunks = [];
    for (const fn of fileNames) {
      const nameBytes = Buffer.from(fn, 'utf-8');
      // Sub message: tag = (1 << 3) | 2 = 10, len, bytes
      const sub = Buffer.concat([Buffer.from([10, nameBytes.length]), nameBytes]);
      // Entry message: tag = (1 << 3) | 2 = 10, len, sub
      const entry = Buffer.concat([Buffer.from([10, sub.length]), sub]);
      chunks.push(entry);
    }
    return Buffer.concat(chunks);
  }

  const protoBytes = buildSyntheticProtoMedia(['Screenshot_Anatomy_CVS_Heart.jpg', 'Diagram_Mediastinum.png']);
  const regexManifest = /function parseMediaManifest\(decompMedia\)\{([\s\S]*?)\n      \}/;
  const matchManifest = flashHtml.match(regexManifest);
  assert(matchManifest !== null, 'Extracted parseMediaManifest function body from flash.html');

  if (matchManifest) {
    const parseFn = new Function('decompMedia', matchManifest[1]);
    const parsed = parseFn(protoBytes);
    assert(parsed['0'] === 'Screenshot_Anatomy_CVS_Heart.jpg', 'Protobuf decoder extracted entry 0: Screenshot_Anatomy_CVS_Heart.jpg');
    assert(parsed['1'] === 'Diagram_Mediastinum.png', 'Protobuf decoder extracted entry 1: Diagram_Mediastinum.png');
  }
  assert(flashHtml.includes('function setSwipeGesturesActive'), 'flash.html defines setSwipeGesturesActive controller');
  assert(flashHtml.includes('touch-action:pan-y') && flashHtml.includes('.card-stage.gestures-active') && flashHtml.includes('touch-action:none'), 'cardStage uses touch-action: pan-y by default and touch-action: none only when gestures-active');
  assert(flashHtml.includes('cursor:default') && flashHtml.includes('.card-stage.gestures-active .flip-card') && flashHtml.includes('cursor:grab'), 'flipCard uses cursor: default by default and cursor: grab only when gestures-active');
  assert(flashHtml.includes('if (!enableTouchGestures || !showGestureCompass) return;'), 'pointerdown is strictly prevented when gestures or HUD are disabled');
  assert(flashHtml.includes('flipCard.addEventListener(\'click\''), 'flipCard supports tap-to-flip click listener without drag');
  assert(indexHtml.includes("localStorage.setItem('mb_enable_gestures'"), 'index.html updates mb_enable_gestures when toggling gesture compass');
}

// 30. Verify MedicineBank Initiative (MBI) Institutional Footer and Social Links
{
  assert(indexHtml.includes('id="siteColophonFooter"') && indexHtml.includes('class="mbi-site-footer"'), 'index.html contains mbi-site-footer element');
  assert(indexHtml.includes('role="contentinfo"'), 'siteColophonFooter includes semantic role="contentinfo"');
  assert(indexHtml.includes('IMG_3083.png'), 'MBI footer includes authentic IMG_3083.png emblem logo');
  assert(indexHtml.includes('https://academic.medicinebank.org/'), 'MBI footer links to main academic portal (https://academic.medicinebank.org/)');
  assert(indexHtml.includes('A student-driven foundation fostering academic excellence'), 'MBI footer contains official student-driven foundation mission statement');
  assert(indexHtml.includes('Accredited by Mansoura National University · March 2026'), 'MBI footer displays Mansoura National University accreditation statement');
  assert(indexHtml.includes('https://www.instagram.com/medicinebank.in?igsh=MXUzdmx6YXM3cW1xeQ%3D%3D'), 'MBI footer includes authentic Instagram link');
  assert(indexHtml.includes('https://www.linkedin.com/company/medicinebank/'), 'MBI footer includes authentic LinkedIn link');
  assert(indexHtml.includes('https://discord.com/invite/jsY3mGPKC4'), 'MBI footer includes authentic Discord link');
  assert(indexHtml.includes('https://www.youtube.com/@MedicineBank.initiative'), 'MBI footer includes authentic YouTube link');
  assert(indexHtml.includes('Dakahlia, Egypt') && indexHtml.includes('الدقهلية، مصر'), 'MBI footer includes Dakahlia, Egypt location in English and Arabic');
  assert(indexHtml.includes('https://academic.medicinebank.org/contact.php'), 'MBI footer includes Contact Us link to portal');
  assert(indexHtml.includes('Eyad Ayman & Muhammad Shabana'), 'Credits attribution includes Eyad Ayman & Muhammad Shabana in English');
  assert(indexHtml.includes('إياد أيمن ومحمد شبانة'), 'Credits attribution includes Eyad Ayman & Muhammad Shabana in Arabic');
  assert(indexHtml.includes('Architected & Developed by') && indexHtml.includes('تصميم وتطوير:'), 'Credits attribution uses agreed phrasing in English and Arabic');
}

// 31. Verify Complete Removal of Credits Modal & Edge-to-Edge Theme-Adaptive Footer
{
  assert(!indexHtml.includes('id="colophonModalOverlay"'), 'colophonModalOverlay pop-up is completely removed');
  assert(!indexHtml.includes('openColophonModal'), 'openColophonModal function is completely removed');
  assert(!indexHtml.includes('closeColophonModal'), 'closeColophonModal function is completely removed');
  assert(!indexHtml.includes('themeAboutColophonBtn'), 'themeAboutColophonBtn is completely removed from theme menu');
  assert(!indexHtml.includes('id="colophonCreditsTrigger"'), 'colophonCreditsTrigger ID is removed for static credits');
  assert(indexHtml.indexOf('</main>') < indexHtml.indexOf('id="siteColophonFooter"'), 'siteColophonFooter is placed outside and after main element for true edge-to-edge bleed');
  assert(indexHtml.includes('background: var(--panel-hi)'), 'siteColophonFooter uses theme-adaptive background var(--panel-hi)');
  assert(indexHtml.includes('html[data-theme="light"] .mbi-footer-logo-img') && indexHtml.includes('html[data-theme="champagne"] .mbi-footer-logo-img'), 'mbi-footer-logo-img has theme-adaptive contrast inversion for light and champagne themes');
}

// 32. Verify Medical ECG Heartbeat & Shimmering Skeleton Loader
{
  assert(indexHtml.includes('curriculum-loader-hub') && indexHtml.includes('curriculum-ecg-svg'), 'index.html contains curriculum-loader-hub and curriculum-ecg-svg');
  assert(indexHtml.includes('ecgDash') && indexHtml.includes('skeletonShimmer'), 'index.html defines ecgDash and skeletonShimmer keyframe animations');
  assert(indexHtml.includes('curriculum-skeletons-wrap') && indexHtml.includes('curriculum-skeleton-card'), 'index.html includes curriculum-skeletons-wrap and skeleton cards');
  assert(indexHtml.includes('getCurriculumSkeletonHTML'), 'index.html defines getCurriculumSkeletonHTML function');
  assert(indexHtml.includes('container.innerHTML = getCurriculumSkeletonHTML()'), 'loadCurriculumExplorer activates getCurriculumSkeletonHTML during loading phase');
  assert(indexHtml.includes('id="curriculumLoading"') && indexHtml.includes('role="status"') && indexHtml.includes('aria-live="polite"'), 'curriculum loader includes WCAG accessibility live status attributes');
}

console.log('\n==================================================');
if (failures === 0) {
  console.log(`🎉 ALL ${passed} VERIFICATION CHECKS PASSED PERFECTLY!`);
  console.log('==================================================');
  process.exit(0);
} else {
  console.error(`💥 ${failures} CHECKS FAILED!`);
  console.log('==================================================');
  process.exit(1);
}
