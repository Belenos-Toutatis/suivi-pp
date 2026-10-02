#!/usr/bin/env python3
"""Régénère les blocs @font-face embarqués de suivi pp.html (base64, sous-ensemble latin).

Deux familles, au CHOIX de l'utilisateur dans 💾 Données → Réglages (2026-09-30) :
  - Andika            — police de l'ÉCRAN par défaut (SIL, conçue pour la lecture) ;
  - Latin Modern Roman — police de l'IMPRESSION par défaut (celle de ses documents LaTeX).
Chacune peut servir à l'écran comme au papier. Embarquées : l'app doit s'afficher et
imprimer pareil sur tous les postes, hors-ligne, sans rien installer.

Licences : Andika — SIL Open Font License 1.1 ; Latin Modern — GUST Font License.
Toutes deux autorisent la redistribution, y compris en sous-ensemble.

Usage : python3 scripts/gen_fonts.py          (tout)
        python3 scripts/gen_fonts.py --ods    (seulement la police des .ods : la sortie woff2
                                               varie d'une version de fontTools à l'autre)
Chaque famille remplace ce qui se trouve entre ses deux marqueurs (/* LM-DEBUT */ … /* LM-FIN */,
/* ANDIKA-DEBUT */ … /* ANDIKA-FIN */).

Et (2026-10-02, demande de l'utilisateur : « inclus Andika dans le fichier ») : Andika en
TrueType, pour l'INCLURE dans la feuille d'avis .ods (/* ODS-ANDIKA-DEBUT */ … /* ODS-ANDIKA-FIN */).
⚠️ En TTF et non en woff2 : c'est ce que LibreOffice et Collabora savent lire dans un .ods.
Déjà compressé en deflate (avec CRC et taille) : l'app le pose tel quel dans l'archive.
"""
import base64, io, pathlib, sys, zlib
from fontTools import subset
from fontTools.ttLib import TTFont

HTML = pathlib.Path(__file__).resolve().parent.parent / 'suivi pp.html'
UNICODES = 'U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2010-2027,U+2030-203A,U+20AC,U+2190-2193,U+2212,U+2260,U+2264-2265,U+00D7,U+2026'
VARIANTES = [('normal', 400), ('normal', 700), ('italic', 400), ('italic', 700)]
FAMILLES = {
    'LM': ('Latin Modern Roman', '/usr/share/texmf/fonts/opentype/public/lm/lmroman10-{}.otf',
           ['regular', 'bold', 'italic', 'bolditalic']),
    'ANDIKA': ('Andika', '/usr/share/fonts/truetype/andika/Andika-{}.ttf',
               ['Regular', 'Bold', 'Italic', 'BoldItalic']),
}

def woff2(path):
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga']
    font = TTFont(str(path))
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = 'woff2'
    font.save(buf)
    return buf.getvalue()

txt = HTML.read_text(encoding='utf-8')
for cle, (famille, motif, fichiers) in ([] if '--ods' in sys.argv else FAMILLES.items()):
    blocs, poids_total = [], 0
    for (style, poids), f in zip(VARIANTES, fichiers):
        data = woff2(motif.format(f))
        poids_total += len(data)
        blocs.append(f"@font-face {{\n  font-family: '{famille}';\n  font-style: {style};\n  font-weight: {poids};\n"
                     f"  font-display: swap;\n  src: url(data:font/woff2;base64,{base64.b64encode(data).decode()}) format('woff2');\n}}")
    a, b = txt.index(f'/* {cle}-DEBUT */'), txt.index(f'/* {cle}-FIN */')
    txt = txt[:a] + f'/* {cle}-DEBUT */\n' + '\n'.join(blocs) + '\n' + txt[b:]
    print(f'{famille} : 4 variantes, {poids_total // 1024} Ko')

def ttf_deflate(path):
    opts = subset.Options()
    opts.layout_features = ['kern', 'liga']
    font = TTFont(str(path))
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=subset.parse_unicodes(UNICODES))
    sub.subset(font)
    # ⚠️ Métriques verticales RESSERRÉES (ligne de 1,61 em → 1,24 em) : à l'ouverture,
    # LibreOffice et Collabora calculent la hauteur optimale des lignes AVANT d'activer la
    # police incluse, avec une police de repli (Liberation, DejaVu : ~1,15 em). Avec les
    # métriques d'origine d'Andika, les noms sortaient rognés de leur ligne. 2040 / −500
    # couvrent encore les capitales accentuées (2030) et les jambages (−490).
    upm = font['head'].unitsPerEm
    asc, desc = round(2040 * upm / 2048), round(500 * upm / 2048)
    font['hhea'].ascent, font['hhea'].descent, font['hhea'].lineGap = asc, -desc, 0
    os2 = font['OS/2']
    os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = asc, -desc, 0
    os2.usWinAscent, os2.usWinDescent = asc, desc
    os2.fsSelection |= 1 << 7          # USE_TYPO_METRICS
    buf = io.BytesIO()
    font.save(buf)
    data = buf.getvalue()
    c = zlib.compressobj(9, zlib.DEFLATED, -15)
    return data, c.compress(data) + c.flush()

entrees, total = [], 0
for (style, poids), f in zip(VARIANTES, FAMILLES['ANDIKA'][2]):
    data, z = ttf_deflate(FAMILLES['ANDIKA'][1].format(f))
    total += len(z)
    entrees.append(f"  {{ fichier: 'Andika-{f}.ttf', style: '{style}', poids: '{'bold' if poids == 700 else 'normal'}', "
                   f"crc: 0x{zlib.crc32(data):08x}, taille: {len(data)}, b64: '{base64.b64encode(z).decode()}' }},")
a, b = txt.index('/* ODS-ANDIKA-DEBUT */'), txt.index('/* ODS-ANDIKA-FIN */')
txt = txt[:a] + '/* ODS-ANDIKA-DEBUT */\nconst _ODS_ANDIKA = [\n' + '\n'.join(entrees) + '\n];\n' + txt[b:]
print(f'Andika pour les .ods : 4 variantes TTF, {total // 1024} Ko compressés')
HTML.write_text(txt, encoding='utf-8')
