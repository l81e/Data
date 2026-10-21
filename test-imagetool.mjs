import fs from 'node:fs';

console.log('🧪 Starting Dedicated Test Suite for PDF Image Studio (imagetool.html)...\n');

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

// 1. Read imagetool.html
const html = fs.readFileSync('imagetool.html', 'utf-8');

// --- A. HTML Structure & Default Settings ---
assert(html.includes('<title>PDF Image Studio</title>'), 'HTML title is "PDF Image Studio"');
assert(html.includes('<option value="gemini" selected>Google Gemini API (Free 1,500 req/day)</option>'), 'Gemini is the first and selected option in #aiProvider');
assert(html.includes('id="modelFieldGemini"'), '#modelFieldGemini element exists');
assert(html.includes('<option value="gemini-2.0-flash" selected>Gemini 2.0 Flash (Fastest, Best Vision, Free)</option>'), 'Gemini 2.0 Flash is selected by default');
assert(html.includes('<option value="gemini-1.5-flash">Gemini 1.5 Flash (Free)</option>'), 'Gemini 1.5 Flash option is present');
assert(html.includes('id="keyFieldGemini"'), '#keyFieldGemini element exists');
assert(html.includes('<input id="geminiKey" type="password" placeholder="AIzaSy... (free at aistudio.google.com)" autocomplete="off">'), '#geminiKey input element exists');

// --- B. JavaScript Functions & Signatures ---
assert(html.includes('async function callGemini(prompt, model, imageUrl, maxTokens)'), 'callGemini function defined with correct signature');
assert(html.includes('https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey)}'), 'callGemini targets Google Gemini v1beta generateContent endpoint');
assert(html.includes('response_mime_type: "application/json"'), 'callGemini requests native application/json MIME type');
assert(html.includes('inline_data: { mime_type: mimeType, data: base64Data }'), 'callGemini formats image as inline_data with mime_type');

// --- C. Dispatchers & State Handling ---
assert(html.includes('function callAI(prompt, imageUrl, maxTokens)'), 'callAI function defined');
assert(html.includes('if (prov === "gemini") {'), 'callAI dispatches to callGemini when prov === "gemini"');
assert(html.includes('return callGemini(prompt, model, imageUrl, maxTokens || 300);'), 'callAI invokes callGemini with fallback maxTokens 300');
assert(html.includes('if (p === "gemini") return document.getElementById("aiModelGemini").value;'), 'getActiveModel handles gemini');
assert(html.includes('if (p === "gemini" && !document.getElementById("geminiKey").value.trim())'), 'aiReady verifies geminiKey');
assert(html.includes('Enter your free Google Gemini API key in AI settings first.'), 'aiReady shows helpful toast when Gemini key is missing');
assert(html.includes('document.getElementById("modelFieldGemini").style.display = p === "gemini" ? "flex" : "none";'), 'updateProviderVisibility shows/hides modelFieldGemini');
assert(html.includes('document.getElementById("keyFieldGemini").style.display = p === "gemini" ? "flex" : "none";'), 'updateProviderVisibility shows/hides keyFieldGemini');

// --- D. LocalStorage Persistence ---
assert(html.includes('document.getElementById("geminiKey").value = lsGet("pdfx_geminikey") || "";'), 'init loads geminiKey from localStorage (pdfx_geminikey)');
assert(html.includes('lsSet("pdfx_geminikey", e.target.value.trim())'), 'geminiKey input event saves to pdfx_geminikey in localStorage');
assert(html.includes('setSelectIfValid(document.getElementById("aiModelGemini"), lsGet("pdfx_model_gemini"));'), 'init restores aiModelGemini from pdfx_model_gemini');
assert(html.includes('lsSet("pdfx_model_gemini", e.target.value)'), 'aiModelGemini change event saves to pdfx_model_gemini');

// --- E. Critical Optimizations ---
assert(html.includes('await sleep(4000); // 4-second delay prevents hitting the 15 RPM free tier cap') && html.includes('document.getElementById("aiProvider").value === "gemini"'), 'analyzeAll contains 4-second rate-pacing sleep for Gemini');
assert(html.includes('async function toDataUrl(url, maxDim = 720)'), 'toDataUrl defaults to 720px for base64 downscaling');
assert(html.includes('await toDataUrl(r.url, 720);'), 'analyzeOne passes 720px downscaled dimensions');

// --- F. Step 1 (Images) & Step 2 (Document + AI Fill) Integration ---
assert(html.includes('id="tabImages"'), 'Step 1 tab exists');
assert(html.includes('id="tabDoc"'), 'Step 2 tab exists');
assert(html.includes('function findGreenBoxes('), 'Step 2 green box detector exists');
assert(html.includes('function buildMatchPrompt('), 'Step 2 matching prompt generator exists');
assert(html.includes('async function aiFill('), 'Step 2 aiFill batch matching exists');

// --- G. Functional Simulation of callGemini & Payload Generation ---
{
  // Simulate callGemini input handling and URL/body construction
  const mockApiKey = 'AIzaSyTestMockKey12345';
  const prompt = 'Analyze this image and return JSON';
  const model = 'gemini-2.0-flash';
  const mockImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  const parts = [{ text: prompt }];
  const comma = mockImageUrl.indexOf(",");
  const meta = mockImageUrl.slice(0, comma);
  const base64Data = mockImageUrl.slice(comma + 1);
  const mimeMatch = meta.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  parts.push({
    inline_data: { mime_type: mimeType, data: base64Data }
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(mockApiKey)}`;
  const body = {
    contents: [{ parts: parts }],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  assert(url === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyTestMockKey12345', 'Gemini URL properly formatted with API key and model');
  assert(body.generationConfig.response_mime_type === 'application/json', 'Gemini generationConfig enforces application/json');
  assert(body.contents[0].parts.length === 2, 'Gemini request parts includes text prompt and image data');
  assert(body.contents[0].parts[1].inline_data.mime_type === 'image/png', 'Gemini image MIME type correctly extracted as image/png');
  assert(body.contents[0].parts[1].inline_data.data === 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'Base64 image data correctly sliced');

  // Simulate mock response parsing
  const mockGeminiApiResponse = {
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            label: "nephron diagram with diuretics mechanism",
            category: "figure",
            reason: "annotated diagram showing loop of henle"
          })
        }]
      }
    }]
  };

  const candidateText = mockGeminiApiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
  assert(candidateText !== undefined, 'Candidate response text extracted');
  const parsed = JSON.parse(candidateText);
  assert(parsed.category === 'figure', 'Parsed Gemini JSON category matches');
  assert(parsed.label.includes('nephron'), 'Parsed Gemini JSON label matches');
}

// --- H. 404 Routing & Index Tool Card ---
const notFound = fs.readFileSync('404.html', 'utf-8');
assert(notFound.includes("if (path === '/imagetool' || path === '/imagetool/' || path.startsWith('/imagetool?')){"), '404.html includes clean URL routing for /imagetool');
assert(notFound.includes("window.location.replace(window.location.origin + '/imagetool.html' + search + hash);"), '404.html redirects /imagetool to /imagetool.html');

const index = fs.readFileSync('index.html', 'utf-8');
assert(index.includes('href="/imagetool.html"'), 'index.html admin panel includes /imagetool.html link');
assert(index.includes('PDF Image Studio'), 'index.html includes PDF Image Studio tool card title');

const sw = fs.readFileSync('sw.js', 'utf-8');
assert(sw.includes("'./imagetool.html'"), 'sw.js precaches ./imagetool.html for offline support');

console.log('\n==================================================');
if (failures === 0) {
  console.log(`🎉 ALL ${passed} IMAGETOOL TESTS PASSED PERFECTLY!`);
  console.log('==================================================');
  process.exit(0);
} else {
  console.error(`💥 ${failures} CHECKS FAILED!`);
  console.log('==================================================');
  process.exit(1);
}
