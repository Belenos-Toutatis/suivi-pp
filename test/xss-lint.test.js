// Lint anti-XSS (statique) — garde-fou contre les régressions.
//
// Échoue si une donnée utilisateur à HAUTE confiance (nom / prénom d'élève, titre ou
// libellé de document, libellé d'option, remarque du PP, note d'un retour, motif de
// nullité d'un bulletin, nom figé d'un candidat…) est interpolée EN CLAIR dans un
// fragment HTML, sans passer par un échappeur (`_escAttr`, `_escName`, `_escJsAttr`)
// ni par le tagged template `_html`.
//
// Heuristique volontairement PRÉCISE (peu de faux positifs) :
//   - la ligne contient un tag HTML `<lettre` ;
//   - l'interpolation est un accès DIRECT à un champ (`${a.b.prenom}`), pas un appel
//     de fonction (segment sans `(` → exclut `_escName(...)`) ;
//   - le segment ne mentionne pas `_esc`.
//
// Repris de « plan de classe.html », champs adaptés au modèle de Suivi PP.
// ⚠️ Tout nouveau champ de texte libre du modèle s'ajoute à CHAMPS ci-dessous.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CHAMPS = ['nom', 'prenom', 'titre', 'label', 'remarque', 'note', 'description',
                'motifNul', 'nomTitulaire', 'nomSuppleant', 'annee'];

test('XSS-lint : aucune donnée utilisateur interpolée en clair dans un fragment HTML', () => {
  const file = path.join(__dirname, '..', 'suivi pp.html');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const SEG = new RegExp(`\\$\\{[^}()]*\\.(${CHAMPS.join('|')})\\b[^}()]*\\}`, 'g');
  // Variante avec appel : `.nom` suivi de `.toUpperCase()` dans la même interpolation —
  // le motif principal exclut les parenthèses et raterait ce cas.
  const SEG_CALL = new RegExp(`\\$\\{[^}]*\\.(nom|prenom|titre)\\b[^}]*\\.(toUpperCase|toLowerCase|trim)\\(\\)[^}]*\\}`, 'g');
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (/^\s*(\/\/|\*|<!--)/.test(L)) continue;  // ligne de commentaire → ignorée
    if (!/<[a-zA-Z]/.test(L)) continue;          // doit ressembler à un fragment HTML
    for (const RE of [SEG, SEG_CALL]) {
      RE.lastIndex = 0;
      let m;
      while ((m = RE.exec(L))) {
        if (/_esc/.test(m[0])) continue;         // déjà échappé
        findings.push(`L${i + 1}: ${m[0].trim()}  →  ${L.trim().slice(0, 120)}`);
      }
    }
  }
  assert.deepEqual(findings, [],
    'Interpolation de donnée utilisateur non échappée dans un fragment HTML '
    + '(utiliser _escName / _escAttr, ou le tagged template _html) :\n' + findings.join('\n'));
});

test('MÉTA-TEST : le lint repère bien une interpolation fautive', () => {
  // Sans ce test, une régression du motif (mauvaise regex, mauvais champ) rendrait le
  // lint vert et vide de sens sur un fichier pourtant vulnérable.
  const L = '  el.innerHTML = `<td>${stu.prenom} ${stu.nom}</td>`;';
  const SEG = new RegExp(`\\$\\{[^}()]*\\.(${CHAMPS.join('|')})\\b[^}()]*\\}`, 'g');
  const hits = L.match(SEG) || [];
  assert.equal(hits.length, 2, 'le motif doit voir les deux interpolations non échappées');
  const OK = '  el.innerHTML = `<td>${_escName(stu.prenom)}</td>`;';
  assert.equal((OK.match(SEG) || []).length, 0, 'une interpolation échappée ne doit pas être signalée');
});
