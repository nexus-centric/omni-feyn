// Tiny DOM helpers.
type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, any> | null;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') (el as any).value = v;
    else if (k === 'checked') (el as any).checked = !!v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function svg(markup: string): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGElement;
}

export function toast(msg: string) {
  const el = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2200);
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/** Score trend as a small inline SVG line chart. */
export function trendChart(scores: number[], w = 320, hgt = 90): SVGElement {
  if (scores.length < 2) return svg(`<svg class="trend" viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Chưa đủ dữ liệu"><text x="${w / 2}" y="${hgt / 2}" text-anchor="middle">Cần ít nhất 2 lượt nói</text></svg>`);
  const pad = 10;
  const pts = scores.map((s, i) => [pad + (i / (scores.length - 1)) * (w - 2 * pad), hgt - pad - (s / 100) * (hgt - 2 * pad)]);
  const line = pts.map((p) => p.join(',')).join(' ');
  const area = `${pad},${hgt - pad} ${line} ${w - pad},${hgt - pad}`;
  return svg(`<svg class="trend" viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Xu hướng điểm">
    <line x1="${pad}" x2="${w - pad}" y1="${hgt - pad - 0.7 * (hgt - 2 * pad)}" y2="${hgt - pad - 0.7 * (hgt - 2 * pad)}" class="goal"/>
    <polygon points="${area}" class="area"/><polyline points="${line}" class="line"/>
    ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5"><title>Lượt ${i + 1}: ${scores[i]}</title></circle>`).join('')}
  </svg>`);
}
