// Auditeur à INJECTER dans la page (navigateur de test) : contraste WCAG sur chaque
// nœud portant du texte, débordement horizontal du body, texte tronqué sans infobulle,
// erreurs JS collectées par le gestionnaire global. Méthode décrite dans CLAUDE.md
// (Design system → Méthode d'audit du contraste). Usage : coller dans la console,
// puis `__audit.run('libellé')` dans chaque état ; `__audit.report()` à la fin.
(() => {
  const parse = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const over = (t, b) => { const a = t.a + b.a * (1 - t.a); if (!a) return { r: 0, g: 0, b: 0, a: 0 };
    const k = x => (t[x] * t.a + b[x] * b.a * (1 - t.a)) / a; return { r: k('r'), g: k('g'), b: k('b'), a }; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05); };
  // Fond effectif : on remonte les parents tant que le fond est transparent, en cumulant l'opacité.
  const bgOf = el => {
    let node = el, acc = null, opacity = 1;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      opacity *= +cs.opacity || 1;
      const c = parse(cs.backgroundColor);
      // Un DÉGRADÉ (background-image) sous le texte, avant tout fond plein : ses couleurs sont rendues à part, et le
      // contraste est mesuré contre la PIRE d'entre elles (sinon l'auditeur voyait le fond du parent : faux écarts).
      // ⚠️ Pas un dégradé RÉPÉTÉ : c'est un motif (les lignes Seyès d'1 px du cahier), pas un aplat — le prendre pour
      // un fond faisait 563 faux écarts dans Suivi PP (texte « sur » une ligne de 1 px). Le fond est alors la couleur.
      if (!acc && /gradient\(/.test(cs.backgroundImage) && !/repeating-/.test(cs.backgroundImage)) {
        const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(x => x && x.a >= 0.999);
        if (stops.length) return { bg: stops[0], opacity, stops };
      }
      // ⚠️ Composition « par-dessus » qui GARDE l'alpha (2026-10-10) : deux fonds translucides empilés (une pastille
      // rgba(…, .17) dans une case rgba(…, .17)) donnaient un fond OPAQUE de la couleur pure — `blend` rend a = 1 —, et
      // l'auditeur mesurait du texte rose pâle sur du rose vif là où l'écran montre du sombre (faux écarts, fiches de suivi).
      if (c && c.a > 0) { acc = acc ? over(acc, c) : c; if (acc.a >= 0.999) break; }
      node = node.parentElement;
    }
    const root = parse(getComputedStyle(document.documentElement).backgroundColor) || parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    acc = acc ? (acc.a < 1 ? blend(acc, root) : acc) : root;
    return { bg: acc, opacity };
  };
  const visible = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const ownText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
  const state = { results: [] };
  // `papier` : la zone d'impression #pa est mesurée aussi (règles @media print réinjectées à l'écran).
  function run(label, papier) {
    const out = { label, contrast: [], overflow: null, hidden: [], errors: (window.__suiviPPErrors || []).length, nodes: 0 };
    // ⚠️ clientWidth, pas innerWidth : en émulation mobile, la fenêtre s'élargit d'elle-même à
    // la largeur du contenu (innerWidth 414 pour 375), et un débordement passait inaperçu.
    const largeur = Math.min(innerWidth, document.documentElement.clientWidth);
    out.overflow = document.documentElement.scrollWidth > largeur + 1 ? `${document.documentElement.scrollWidth} px pour ${largeur}` : null;
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest(papier ? 'script, style' : '#pa, script, style')) continue;
      const txt = ownText(el) || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'date', 'file', 'range', 'color'].includes(el.type) ? el.value : '');
      const cs = getComputedStyle(el);
      // Texte tronqué : ellipse ou overflow caché qui rogne réellement, sans infobulle ni title parent. Un texte réservé aux
      // lecteurs d'écran (boîte d'un pixel, « sr-only ») n'est pas tronqué : il est caché exprès.
      if (txt && cs.overflow !== 'visible' && el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 2 && !el.title && !el.closest('[title]') && el.tagName !== 'SELECT' && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
        out.hidden.push({ tag: el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : ''), txt: txt.slice(0, 50), w: el.clientWidth, sw: el.scrollWidth });
      }
      if (!txt) continue;
      if (el.matches(':disabled, [disabled], [aria-disabled="true"]') || el.closest(':disabled, [disabled]')) continue;   // exemption assumée (cf. CLAUDE.md)
      const fg0 = parse(cs.color); if (!fg0) continue;
      const { bg: bg0, opacity, stops } = bgOf(el);
      // fond en dégradé : la couleur du dégradé qui contraste le MOINS avec le texte
      const bg = stops ? stops.reduce((m, x) => ratio(blend({ ...fg0, a: fg0.a * opacity }, x), x) < ratio(blend({ ...fg0, a: fg0.a * opacity }, m), m) ? x : m) : bg0;
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
