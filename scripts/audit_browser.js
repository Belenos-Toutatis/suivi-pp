// Auditeur à INJECTER dans la page (navigateur de test) : contraste WCAG sur chaque
// nœud portant du texte, débordement horizontal du body, texte tronqué sans infobulle,
// erreurs JS collectées par le gestionnaire global. Méthode décrite dans CLAUDE.md
// (Design system → Méthode d'audit du contraste). Usage : coller dans la console,
// puis `__audit.run('libellé')` dans chaque état ; `__audit.report()` à la fin.
(() => {
  const parse = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05); };
  // Fond effectif : on remonte les parents tant que le fond est transparent, en cumulant l'opacité.
  const bgOf = el => {
    let node = el, acc = null, opacity = 1;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      opacity *= +cs.opacity || 1;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { if (!acc) acc = c; else acc = blend(acc, c); if (acc.a >= 1) break; }
      node = node.parentElement;
    }
    const root = parse(getComputedStyle(document.documentElement).backgroundColor) || parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    acc = acc ? (acc.a < 1 ? blend(acc, root) : acc) : root;
    return { bg: acc, opacity };
  };
  const visible = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
  const state = { results: [] };
  function run(label) {
    const out = { label, contrast: [], overflow: null, hidden: [], errors: (window.__suiviPPErrors || []).length, nodes: 0 };
    out.overflow = document.documentElement.scrollWidth > innerWidth + 1 ? `${document.documentElement.scrollWidth} px pour ${innerWidth}` : null;
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('#pa, script, style')) continue;
      const txt = ownText(el) || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'date', 'file', 'range', 'color'].includes(el.type) ? el.value : '');
      const cs = getComputedStyle(el);
      // Texte tronqué : ellipse ou overflow caché qui rogne réellement, sans infobulle ni title parent.
      if (txt && cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 2 && !el.title && !el.closest('[title]') && el.tagName !== 'SELECT' && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
        out.hidden.push({ tag: el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : ''), txt: txt.slice(0, 50), w: el.clientWidth, sw: el.scrollWidth });
      }
      if (!txt) continue;
      if (el.matches(':disabled, [disabled], [aria-disabled="true"]') || el.closest(':disabled, [disabled]')) continue;   // exemption assumée (cf. CLAUDE.md)
      const fg0 = parse(cs.color); if (!fg0) continue;
      const { bg, opacity } = bgOf(el);
      const fg = blend({ ...fg0, a: fg0.a * opacity }, bg);
      const r = ratio(fg, bg);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      const large = size >= 24 || (size >= 18.66 && bold);
      const seuil = large ? 3 : 4.5;
      out.nodes++;
      if (r < seuil) {
        const key = (el.tagName + '.' + el.className + '|' + cs.color + '|' + txt.slice(0, 20));
        if (seen.has(key)) continue; seen.add(key);
        out.contrast.push({ ratio: +r.toFixed(2), seuil, tag: el.tagName + (el.className ? '.' + String(el.className).split(' ').slice(0, 2).join('.') : ''), txt: txt.slice(0, 40), fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})` });
      }
    }
    state.results.push(out);
    return out;
  }
  function report() {
    const bad = state.results.filter(r => r.contrast.length || r.overflow || r.hidden.length);
    return { etats: state.results.length, nodes: state.results.reduce((n, r) => n + r.nodes, 0), defauts: bad.map(r => ({ label: r.label, contrast: r.contrast, overflow: r.overflow, hidden: r.hidden })), erreursJS: (window.__suiviPPErrors || []).map(e => String(e.message || e).slice(0, 160)) };
  }
  window.__audit = { run, report, reset: () => { state.results = []; } };
  // Transitions neutralisées : une puce saisie à mi-parcours produit de faux écarts.
  const st = document.createElement('style'); st.id = '__audit_notrans'; st.textContent = '*{transition:none!important;animation:none!important}'; document.head.appendChild(st);
  return 'audit prêt';
})();
