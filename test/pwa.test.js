// Installabilité de la PWA — manifeste, icônes réelles sur le disque, service worker.
//
// ⚠️ Le piège de fond : un manifeste est du texte, et du texte se vérifie facilement —
// mais Chrome et Android n'installent l'app que si les FICHIERS d'icônes existent
// vraiment et font les dimensions annoncées. Un manifeste qui déclare une icône 512×512
// en pointant une image de 48 px passe toute relecture visuelle du JSON et fait échouer
// l'installation en silence, sans erreur nulle part dans la console. C'est exactement le
// genre de défaut que ce projet traque (cf. les icônes de groupe et le badge invisibles,
// trouvés par la mesure et pas par la lecture du code). D'où le test n°5 : on lit les
// vrais octets PNG, pas seulement la chaîne "512x512" du JSON.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// ⚠️ Le nom du fichier de l'app contient un espace ("suivi pp.html") : path.join gère
// l'espace tel quel, contrairement à une URL ou une commande shell non protégée.
const APP_PATH = path.join(ROOT, 'suivi pp.html');
const MANIFEST_PATH = path.join(ROOT, 'manifest.json');
const SW_PATH = path.join(ROOT, 'sw.js');

const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf8');
const swSrc = fs.readFileSync(SW_PATH, 'utf8');
const appSrc = fs.readFileSync(APP_PATH, 'utf8');

// Le JSON peut être invalide ou incomplet au moment où ce fichier est écrit (le
// manifeste est en cours de construction en parallèle) : on parse une fois ici, avec
// repli sur `null`, pour que les tests suivants échouent proprement au lieu de faire
// planter le CHARGEMENT du module de test (ce qui masquerait tous les autres fichiers
// de test derrière une seule erreur de syntaxe JSON).
let manifest = null;
let manifestParseError = null;
try {
  manifest = JSON.parse(manifestRaw);
} catch (e) {
  manifestParseError = e;
}

// `icons` peut ne pas exister encore : tableau vide plutôt qu'un crash, pour que les
// tests qui en dépendent échouent avec un message clair au lieu d'une exception brute.
const icons = (manifest && Array.isArray(manifest.icons)) ? manifest.icons : [];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Largeur/hauteur RÉELLES d'un PNG, lues dans le chunk IHDR — pas dans le nom du
// fichier, pas dans le manifeste. IHDR est toujours le premier chunk, juste après les
// 8 octets de signature : longueur (4) + type "IHDR" (4) + largeur (4) + hauteur (4),
// donc largeur aux octets 16..19 et hauteur aux octets 20..23, en 32 bits big-endian.
function _pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('manifest.json est du JSON valide et porte toutes les clés requises, aucune vide', () => {
  assert.equal(manifestParseError, null,
    `manifest.json ne parse pas : ${manifestParseError && manifestParseError.message}`);
  const clesRequises = [
    'id', 'name', 'short_name', 'description', 'scope', 'start_url',
    'display', 'background_color', 'theme_color', 'icons',
  ];
  const manquantesOuVides = clesRequises.filter(cle => {
    if (!manifest || !Object.prototype.hasOwnProperty.call(manifest, cle)) return true;
    const v = manifest[cle];
    if (v === null || v === undefined || v === '') return true;
    if (Array.isArray(v) && v.length === 0) return true;
    return false;
  });
  assert.deepStrictEqual(manquantesOuVides, [], `clés manquantes ou vides : ${manquantesOuVides.join(', ')}`);
});

test('display vaut "standalone"', () => {
  // C'est ce qui retire la barre d'adresse à l'ouverture ; "browser" rendrait
  // l'installation aussi inutile qu'un simple signet.
  assert.equal(manifest && manifest.display, 'standalone');
});

test('au moins une icône 192×192 ET une 512×512 de purpose "any"', () => {
  // Critère minimal d'installabilité de Chrome : sans ces deux tailles en "any",
  // l'invite d'installation ne s'affiche pas du tout, sans message d'erreur visible.
  const purposeInclut = (ic, valeur) => String((ic && ic.purpose) || 'any').split(/\s+/).includes(valeur);
  const has192Any = icons.some(ic => ic && ic.sizes === '192x192' && purposeInclut(ic, 'any'));
  const has512Any = icons.some(ic => ic && ic.sizes === '512x512' && purposeInclut(ic, 'any'));
  assert.ok(has192Any, 'aucune icône 192×192 de purpose "any"');
  assert.ok(has512Any, 'aucune icône 512×512 de purpose "any"');
});

test('au moins une icône "maskable" en 512×512', () => {
  // Sans elle, Android rogne l'icône carrée dans un cercle (ou une autre forme du
  // launcher) et coupe le dessin sur les bords — le défaut ne se voit qu'après
  // installation réelle sur un téléphone, jamais dans un navigateur de bureau.
  const purposeInclut = (ic, valeur) => String((ic && ic.purpose) || '').split(/\s+/).includes(valeur);
  const hasMaskable512 = icons.some(ic => ic && ic.sizes === '512x512' && purposeInclut(ic, 'maskable'));
  assert.ok(hasMaskable512, 'aucune icône 512×512 de purpose "maskable"');
});

test('⚠️ chaque icône du manifeste existe sur le disque, est un vrai PNG, et ses dimensions mesurées correspondent à "sizes" déclaré', () => {
  // LE test qui compte. Un manifeste qui déclare 512x512 en pointant une image de 48 px
  // passe les quatre tests précédents (ils ne lisent que du texte) et fait échouer
  // l'installation en silence. On lit ici les vrais octets du fichier.
  assert.ok(icons.length > 0, 'aucune icône déclarée dans le manifeste — rien à vérifier');
  const problemes = [];
  for (const ic of icons) {
    const rel = ic && ic.src;
    if (!rel) { problemes.push('entrée icons[] sans "src"'); continue; }
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { problemes.push(`${rel} : fichier introuvable`); continue; }
    const buf = fs.readFileSync(abs);
    if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
      problemes.push(`${rel} : signature PNG absente (pas un PNG, ou fichier tronqué)`);
      continue;
    }
    const attendu = String(ic.sizes || '');
    const m = attendu.match(/^(\d+)x(\d+)$/);
    if (!m) { problemes.push(`${rel} : "sizes" illisible (${JSON.stringify(ic.sizes)})`); continue; }
    const { w, h } = _pngSize(buf);
    const wAttendu = Number(m[1]);
    const hAttendu = Number(m[2]);
    if (w !== wAttendu || h !== hAttendu) {
      problemes.push(`${rel} : manifeste déclare ${attendu}, fichier mesure ${w}x${h}`);
    }
  }
  assert.deepStrictEqual(problemes, [], problemes.join(' ; '));
});

test('le fichier de l\'app déclare <link rel="manifest"> ET <link rel="apple-touch-icon"> vers un fichier réel', () => {
  // iOS ignore TOTALEMENT les icônes du manifeste JSON : sans ce lien dédié, l'ajout à
  // l'écran d'accueil sur iPhone récupère une capture de la page comme icône.
  const linkTags = [...appSrc.matchAll(/<link\b[^>]*>/g)].map(m => m[0]);
  const manifestLink = linkTags.find(t => /rel="manifest"/.test(t));
  assert.ok(manifestLink, '<link rel="manifest"> absent du fichier de l\'app');

  const appleLink = linkTags.find(t => /rel="apple-touch-icon"/.test(t));
  assert.ok(appleLink, '<link rel="apple-touch-icon"> absent du fichier de l\'app');
  if (appleLink) {
    const href = appleLink.match(/href="([^"]+)"/);
    assert.ok(href, '<link rel="apple-touch-icon"> sans attribut href');
    if (href) {
      const abs = path.join(ROOT, href[1]);
      assert.ok(fs.existsSync(abs), `fichier pointé par apple-touch-icon introuvable : ${href[1]}`);
    }
  }
});

test('sw.js précharge dans FILES toutes les icônes du manifeste, plus manifest.json', () => {
  // Une icône absente du cache rend l'app installée SANS icône après le premier
  // lancement hors-ligne : le service worker sert l'app depuis le cache, mais le
  // fichier d'icône, jamais mis en cache, renvoie une 503 — l'écran d'accueil affiche
  // alors une icône générique ou cassée, et rien dans les tests de contenu ne le verrait.
  const m = swSrc.match(/FILES\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(m, 'tableau FILES introuvable dans sw.js');
  const filesListe = m ? [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map(mm => mm[1] ?? mm[2]) : [];

  assert.ok(filesListe.includes('manifest.json'), 'manifest.json absent de FILES');

  const manquants = icons
    .map(ic => ic && ic.src)
    .filter(Boolean)
    .filter(src => !filesListe.includes(src));
  assert.deepStrictEqual(manquants, [], `icônes absentes de FILES : ${manquants.join(', ')}`);
});

test('méta-test : _pngSize détecte bien une fausse taille dans un IHDR truqué', () => {
  // ⚠️ Sans ce méta-test, une erreur de décalage d'octets dans _pngSize rendrait la
  // garantie n°5 silencieusement vacante : le détecteur pourrait ne jamais rien
  // détecter, et rien dans la suite ne le signalerait (même principe que les
  // méta-tests des purges en cascade : un test balayant qui ne voit jamais rien de
  // faux n'est pas une garantie, c'est un silence).
  const faux = Buffer.alloc(33);
  PNG_SIGNATURE.copy(faux, 0);
  faux.writeUInt32BE(13, 8);       // longueur du chunk IHDR (toujours 13)
  faux.write('IHDR', 12, 'ascii'); // type de chunk
  faux.writeUInt32BE(48, 16);      // largeur TRUQUÉE : 48, pas la vraie taille annoncée
  faux.writeUInt32BE(48, 20);      // hauteur TRUQUÉE : 48
  const { w, h } = _pngSize(faux);
  assert.deepStrictEqual({ w, h }, { w: 48, h: 48 });
});
