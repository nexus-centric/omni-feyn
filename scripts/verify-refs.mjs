// Resolves the research references cited in docs/content-sources.md: DOIs through the Crossref API
// and institutional pages by HTTP status plus page title (to catch soft 404 pages).
// Usage: node scripts/verify-refs.mjs  (network required). Writes tmp/refs-check.json.
import { writeFileSync } from 'node:fs';
const DOIS = [
  '10.1177/0956797618761661', '10.1177/1745691616652873', '10.1177/0956797614553946', '10.1177/0956797610383437',
  '10.1126/science.aac4716', '10.1037/a0010932', '10.1126/science.159.3810.56', '10.1287/trsc.1050.0127',
  '10.1088/0031-9120/4/3/312', '10.1038/srep37665', '10.1214/ss/1177009869', '10.1175/1520-0469(1963)020<0130:DNF>2.0.CO;2',
  '10.1038/2870', '10.1037/amp0000401', '10.1111/j.1539-6053.2009.01038.x',
  '10.1016/j.neubiorev.2017.07.006', '10.1126/science.136.3520.953', '10.1038/201993a0', '10.1002/ejsp.674',
  '10.1088/1367-2630/10/3/033001',
];
const PAGES = [
  'https://www.epa.gov/heatislands', 'https://www.swpc.noaa.gov/phenomena/aurora',
  'https://www.nssl.noaa.gov/education/svrwx101/lightning/', 'https://plato.stanford.edu/entries/paradox-simpson/',
  'https://oceanservice.noaa.gov/facts/whysalty.html',
];
const UA = { 'User-Agent': 'omni-feyn content check (local script)' };
const out = { checkedAt: new Date().toISOString(), dois: [], pages: [] };
for (const doi of DOIS) {
  const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: UA });
  const m = r.ok ? (await r.json()).message : null;
  const year = m?.issued?.['date-parts']?.[0]?.[0];
  out.dois.push({ doi, status: r.status, title: m?.title?.[0], firstAuthor: m?.author?.[0]?.family, year, journal: m?.['container-title']?.[0] });
  await new Promise((res) => setTimeout(res, 300));
}
for (const url of PAGES) {
  try {
    const r = await fetch(url, { headers: { ...UA, 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    const html = await r.text();
    const title = (html.match(/<title[^>]*>([^<]*)/i)?.[1] || '').trim().replace(/\s+/g, ' ');
    out.pages.push({ url, status: r.status, title, soft404: /not found|404/i.test(title) });
  } catch (e) { out.pages.push({ url, status: 0, error: String(e) }); }
}
writeFileSync('tmp/refs-check.json', JSON.stringify(out, null, 2));
for (const d of out.dois) console.log(d.status, d.doi, '|', d.firstAuthor, d.year, '|', (d.title || '').slice(0, 90), '|', d.journal);
for (const p of out.pages) console.log(p.status, p.soft404 ? 'SOFT404' : 'ok', p.url, '|', p.title);
