// Transcribe tests/fixtures/prep-vi.wav with several Whisper models in headless Chromium (WASM) and report WER.
// Usage: node scripts/asr-bench.mjs [model ...]   (starts its own Vite dev server on port 4180)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';

const REF = 'Theo tôi, lạm phát là khi giá cả tăng đều theo thời gian. Vì tiền in ra nhiều hơn lượng hàng hoá. Ví dụ, giá xăng và giá thịt đều tăng. Tóm lại, ngân hàng trung ương phải tăng lãi suất để kiểm soát lạm phát.';
const models = process.argv.slice(2).length ? process.argv.slice(2) : ['onnx-community/whisper-base', 'onnx-community/whisper-small', 'huuquyet/PhoWhisper-small'];
const norm = (s) => s.normalize('NFC').toLowerCase().replace(/ho[àá]/g, 'hoá').replace(/óa/g, 'oá').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
function wer(ref, hyp) {
  const r = norm(ref), h = norm(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
}
// No HMR or file watching, so editing sources during a long run cannot reload the page.
const server = await createServer({ server: { port: 4180, strictPort: true, hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4180/tests/bench/asr-bench.html');
await page.waitForFunction(() => window.ready);
const out = [];
for (const m of models) {
  try {
    const r = await page.evaluate((m) => window.bench(m), m);
    r.wer = Math.round(wer(REF, r.text) * 1000) / 10;
    out.push(r); console.log(JSON.stringify(r));
  } catch (e) { out.push({ model: m, error: String(e) }); console.log(m, 'ERROR', String(e).slice(0, 300)); }
}
mkdirSync('tmp', { recursive: true });
writeFileSync(process.env.BENCH_OUT || 'tmp/asr-bench.json', JSON.stringify({ reference: REF, results: out, errors }, null, 2));
await browser.close(); await server.close();
