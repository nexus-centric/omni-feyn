// Checks named books in the topic bank against the Open Library catalogue (title + author match).
// A third element gives the catalogue title of the original work when it differs
// (Norman's book first appeared as The Psychology of Everyday Things; Piketty wrote in French).
// Usage: node scripts/verify-books.mjs  (network required). Writes tmp/books-check.json.
import { writeFileSync } from 'node:fs';
const BOOKS = [
  ['Nineteen Eighty-Four', 'George Orwell'], ['Animal Farm', 'George Orwell'], ['The Alchemist', 'Paulo Coelho'],
  ['The Psychology of Money', 'Morgan Housel'], ['Atomic Habits', 'James Clear'], ['The Black Swan', 'Nassim Nicholas Taleb'],
  ['Influence', 'Robert B. Cialdini'], ['The Phoenix Project', 'Gene Kim'], ['Factfulness', 'Hans Rosling'], ['Deep Work', 'Cal Newport'],
  ['The Design of Everyday Things', 'Donald A. Norman', 'The Psychology of Everyday Things'], ['Freakonomics', 'Steven D. Levitt'], ["Man's Search for Meaning", 'Viktor E. Frankl'],
  ['Sapiens', 'Yuval Noah Harari'], ['Guns, Germs, and Steel', 'Jared Diamond'], ['The Selfish Gene', 'Richard Dawkins'],
  ['Accelerate', 'Nicole Forsgren'], ['Nudge', 'Richard H. Thaler'], ['Why Nations Fail', 'Daron Acemoglu'],
  ['Designing Data-Intensive Applications', 'Martin Kleppmann'], ['The Mythical Man-Month', 'Frederick P. Brooks'],
  ['The Wealth of Nations', 'Adam Smith'], ['On the Origin of Species', 'Charles Darwin'], ['The Structure of Scientific Revolutions', 'Thomas S. Kuhn'],
  ['Gödel, Escher, Bach', 'Douglas R. Hofstadter'], ['Capital in the Twenty-First Century', 'Thomas Piketty', 'Le capital au XXIe siècle'],
];
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const out = [];
for (const [title, author, lookup = title] of BOOKS) {
  const surname = author.split(' ').pop();
  const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(lookup)}&author=${encodeURIComponent(surname)}&limit=5&fields=key,title,author_name,first_publish_year`;
  const r = await fetch(url, { headers: { 'User-Agent': 'omni-feyn content check (local script)' } });
  const j = await r.json();
  const byAuthor = (j.docs || []).filter((d) => (d.author_name || []).some((a) => norm(a).includes(norm(surname))));
  const hit = byAuthor.find((d) => norm(d.title) === norm(lookup)) || byAuthor.find((d) => norm(d.title).startsWith(norm(lookup).split(' ').slice(0, 3).join(' ')));
  out.push({ title, author, lookup, ok: !!hit, olTitle: hit?.title, olAuthors: hit?.author_name, firstPublishYear: hit?.first_publish_year, work: hit ? `https://openlibrary.org${hit.key}` : null });
  await new Promise((res) => setTimeout(res, 400));
}
writeFileSync('tmp/books-check.json', JSON.stringify(out, null, 2));
for (const b of out) console.log(b.ok ? 'OK ' : 'MISS', b.title, '|', b.author, '|', b.olTitle, '|', (b.olAuthors || []).join(', '), '|', b.firstPublishYear, '|', b.work);
