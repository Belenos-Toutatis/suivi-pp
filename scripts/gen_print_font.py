#!/usr/bin/env python3
"""Régénère le bloc @font-face « Latin Modern Roman » de suivi pp.html.

La police des IMPRESSIONS (demande de l'utilisateur, 2026-09-30 : « j'aime bien que les
documents soient imprimés avec la police Latin Modern »). Embarquée en base64 comme les
trois autres : l'app doit imprimer pareil sur tous les postes, hors-ligne, sans dépendre
d'une installation TeX. Sous-ensemble latin (français compris) pour limiter le poids.

Source : les .otf de TeX Live (paquet lm), GUST Font License — redistribution libre.
Usage : python3 scripts/gen_print_font.py [dossier des otf]
Remplace ce qui se trouve entre les marqueurs /* LM-DEBUT */ et /* LM-FIN */.
"""
import base64, io, pathlib, sys
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/usr/share/texmf/fonts/opentype/public/lm')
HTML = pathlib.Path(__file__).resolve().parent.parent / 'suivi pp.html'
UNICODES = 'U+0020-007E,U+00A0-00FF,U+0152-0153,U+0178,U+2010-2027,U+2030-203A,U+20AC,U+2192,U+2212,U+2264-2265,U+00D7'
VARIANTES = [('regular', 'normal', 400), ('bold', 'normal', 700), ('italic', 'italic', 400), ('bolditalic', 'italic', 700)]

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

blocs = []
for nom, style, poids in VARIANTES:
    data = woff2(SRC / f'lmroman10-{nom}.otf')
    blocs.append("@font-face {\n  font-family: 'Latin Modern Roman';\n"
                 f"  font-style: {style};\n  font-weight: {poids};\n  font-display: swap;\n"
                 f"  src: url(data:font/woff2;base64,{base64.b64encode(data).decode()}) format('woff2');\n}}")
txt = HTML.read_text(encoding='utf-8')
a, b = txt.index('/* LM-DEBUT */'), txt.index('/* LM-FIN */')
HTML.write_text(txt[:a] + '/* LM-DEBUT */\n' + '\n'.join(blocs) + '\n' + txt[b:], encoding='utf-8')
print('Latin Modern Roman : 4 variantes, ' + ', '.join(f'{n}' for n, _, _ in VARIANTES))
