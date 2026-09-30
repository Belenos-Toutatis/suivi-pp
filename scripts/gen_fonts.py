#!/usr/bin/env python3
"""Régénère les blocs @font-face embarqués de suivi pp.html (base64, sous-ensemble latin).

Deux familles, au CHOIX de l'utilisateur dans 💾 Données → Réglages (2026-09-30) :
  - Andika            — police de l'ÉCRAN par défaut (SIL, conçue pour la lecture) ;
  - Latin Modern Roman — police de l'IMPRESSION par défaut (celle de ses documents LaTeX).
Chacune peut servir à l'écran comme au papier. Embarquées : l'app doit s'afficher et
imprimer pareil sur tous les postes, hors-ligne, sans rien installer.

Licences : Andika — SIL Open Font License 1.1 ; Latin Modern — GUST Font License.
Toutes deux autorisent la redistribution, y compris en sous-ensemble.

Usage : python3 scripts/gen_fonts.py
Chaque famille remplace ce qui se trouve entre ses deux marqueurs (/* LM-DEBUT */ … /* LM-FIN */,
/* ANDIKA-DEBUT */ … /* ANDIKA-FIN */).
"""
import base64, io, pathlib
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
for cle, (famille, motif, fichiers) in FAMILLES.items():
    blocs, poids_total = [], 0
    for (style, poids), f in zip(VARIANTES, fichiers):
        data = woff2(motif.format(f))
        poids_total += len(data)
        blocs.append(f"@font-face {{\n  font-family: '{famille}';\n  font-style: {style};\n  font-weight: {poids};\n"
                     f"  font-display: swap;\n  src: url(data:font/woff2;base64,{base64.b64encode(data).decode()}) format('woff2');\n}}")
    a, b = txt.index(f'/* {cle}-DEBUT */'), txt.index(f'/* {cle}-FIN */')
    txt = txt[:a] + f'/* {cle}-DEBUT */\n' + '\n'.join(blocs) + '\n' + txt[b:]
    print(f'{famille} : 4 variantes, {poids_total // 1024} Ko')
HTML.write_text(txt, encoding='utf-8')
