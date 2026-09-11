const fs = require('fs');
const { loadApp } = require('../test/harness.js');
const app = loadApp();
const ev = c => app.__TESTEVAL(c);
const html = fs.readFileSync(require('path').join(__dirname, '..', 'suivi pp.html'), 'utf8');
// 1) Tous les noms de fonctions appelés dans des handlers inline (HTML statique + templates JS)
const names = new Set();
for (const m of html.matchAll(/on(?:click|change|input|keydown|keyup|blur|focus|toggle|pointerdown|pointermove|pointerup|submit|dblclick)="([^"]*)"/g)) {
  for (const f of m[1].matchAll(/(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(/g)) names.add(f[1]);
}
const skip = new Set(['if','event','this','document','window','String','Number','parseInt','Math','setTimeout','CSS','Array','Object','JSON','Date','console','encodeURIComponent','confirm','alert','prompt','requestAnimationFrame','Promise','Boolean']);
const missing = [...names].filter(n => !skip.has(n)).filter(n => { try { return ev(`typeof ${n}`) !== 'function'; } catch (e) { return true; } });
console.log('handlers inline :', names.size, 'manquants :', missing);
// 2) ids appelés par getElementById dans le JS, absents du HTML statique
const ids = new Set([...html.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const absent = [...ids].filter(i => !htmlIds.has(i) && !html.includes(`id="${i}"`) && !html.includes(`id='${i}'`));
console.log('ids getElementById :', ids.size, 'absents du HTML statique (peut-être dynamiques) :', absent);
// 3) Fonctions définies mais jamais référencées
const defs = [...html.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/gm)].map(m => m[1]);
const unused = defs.filter(n => (html.match(new RegExp('(?<![\w$])' + n.replace(/\$/g, '\$') + '(?![\w$])', 'g')) || []).length < 2);
console.log('fonctions définies :', defs.length, 'jamais référencées :', unused);
// 4) Doublons de définition
const dup = defs.filter((n, i) => defs.indexOf(n) !== i);
console.log('définies deux fois :', [...new Set(dup)]);
