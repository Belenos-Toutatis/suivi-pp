# -*- coding: utf-8 -*-
"""Génère les icônes de Suivi PP — identité « carnet du prof ».

Le dessin reprend LITTÉRALEMENT le favicon SVG déjà dans l'app (page claire,
filet rouge de marge, lignes Seyès) : une icône qui ne ressemble pas à l'écran
qu'elle ouvre est une icône qu'on ne reconnaît pas dans une grille de 30.
"""
from PIL import Image, ImageDraw
import os

NAVY  = (26, 37, 47)     # #1a252f — theme_color de l'app
PAPER = (244, 246, 250)  # #f4f6fa — background_color
RED   = (176, 61, 46)    # #b03d2e — le filet de marge
RULE  = (100, 118, 141)  # lignes : assombries par rapport au favicon (#c8d2e0),
                         # invisibles autrement à 48 px sur un écran d'accueil.

def draw(size, inset_ratio, corner_ratio):
    """inset_ratio : marge navy autour de la page, en fraction du côté.
       corner_ratio : rayon des coins arrondis (0 = carré plein, pour maskable/iOS)."""
    S = 4  # supersampling : on dessine 4× trop grand puis on réduit → bords lisses
    n = size * S
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Fond
    if corner_ratio > 0:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * corner_ratio), fill=NAVY)
    else:
        d.rectangle([0, 0, n - 1, n - 1], fill=NAVY)

    # La page
    m = int(n * inset_ratio)
    px0, py0, px1, py1 = m, m, n - m, n - m
    pw = px1 - px0
    d.rounded_rectangle([px0, py0, px1, py1], radius=int(pw * 0.09), fill=PAPER)

    # Filet rouge de marge, à 24 % de la largeur de page
    rx = px0 + int(pw * 0.24)
    rw = max(2, int(pw * 0.045))
    pad = int(pw * 0.10)
    d.rounded_rectangle([rx, py0 + pad, rx + rw, py1 - pad], radius=rw // 2, fill=RED)

    # Lignes Seyès : trois pleines + une courte (comme le favicon)
    lx0 = rx + int(pw * 0.10)
    lx1 = px1 - pad
    th = max(2, int(pw * 0.055))
    for i, frac in enumerate([0.22, 0.42, 0.62, 0.82]):
        y = py0 + int(pw * frac)
        end = lx1 if i < 3 else lx0 + int((lx1 - lx0) * 0.55)
        d.rounded_rectangle([lx0, y, end, y + th], radius=th // 2, fill=RULE)

    return img.resize((size, size), Image.LANCZOS)

# ⚠️ icons/ est à la RACINE du projet, pas à côté de ce script.
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons')
os.makedirs(out, exist_ok=True)

# « any » : coins arrondis à nous, l'OS n'y touche pas.
for s in (192, 512):
    draw(s, 0.11, 0.22).save(os.path.join(out, 'icon-%d.png' % s))

# « maskable » : l'OS rogne dans un cercle de 80 % du côté. Tout le dessin doit
# tenir dans ce cercle, donc la page rétrécit beaucoup et le fond va bord à bord.
for s in (192, 512):
    draw(s, 0.215, 0).save(os.path.join(out, 'icon-maskable-%d.png' % s))

# iOS applique SON masque arrondi : lui donner des coins transparents les
# afficherait en noir. Carré plein, donc.
draw(180, 0.15, 0).convert('RGB').save(os.path.join(out, 'apple-touch-icon-180.png'))

for f in sorted(os.listdir(out)):
    im = Image.open(os.path.join(out, f))
    print('%-28s %s %s %d octets' % (f, im.size, im.mode,
          os.path.getsize(os.path.join(out, f))))
