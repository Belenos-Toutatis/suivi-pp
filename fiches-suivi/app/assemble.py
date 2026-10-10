"""Assemble l'application des fiches de suivi — une source, deux livraisons (2026-10-10) :
  1. « Fiche de suivi collective.html » : la version AUTONOME, pour les collègues (un seul fichier, qui s'enregistre lui-même) ;
  2. la version INTÉGRÉE à Suivi PP (onglet 📋 Suivis), rangée compressée dans « suivi pp.html », entre les marqueurs
     FICHES-SUIVI-DEBUT et FICHES-SUIVI-FIN. Suivi PP la décompresse (DecompressionStream deflate-raw), y pose ses propres
     polices à la place de /*POLICES-HOTE*/ et la charge dans un cadre (srcdoc).
Usage : python3 fiches-suivi/app/assemble.py             (les deux)
        python3 fiches-suivi/app/assemble.py --autonome  (la version autonome seulement : suivi pp.html n'est pas touché)
⚠️ Écrire dans suivi pp.html change Suivi PP : APP_VERSION et APP_BUILD_DATE sont à avancer avant de pousser."""
import base64, hashlib, pathlib, sys, zlib
d = pathlib.Path(__file__).parent
edt = (d / "edt_demo.min.json").read_text().strip()
js = "\n".join((d / f).read_text() for f in ("core.js", "demo.js", "ui.js", "sections.js", "tuto.js")).replace("/*EDT_DEMO*/null", edt)
# les données du suivi sont rangées dans ce bloc (vide au départ) ; la page se recopie elle-même en l'y remplaçant
bloc = '<script id="donnees-suivi" type="application/json">null</script>\n'
capture = "const PAGE_SOURCE = document.documentElement.outerHTML;   // la page telle qu'elle a été chargée (avant tout affichage)\n"
# apparence de Suivi PP (2026-10-10) : ses polices (polices.css, générées par scripts/gen_fonts.py --fiches) et ses couleurs
# (theme.css), APRÈS la feuille de style de l'application, qu'elles complètent
tete = (d / "head.html").read_text()
assert tete.count("</head>") == 1 and tete.count('<html lang="fr">') == 1


def page(polices, integree=False):
    t = tete.replace("</head>", '<style id="polices">\n' + polices + '</style>\n<style id="theme">\n' + (d / "theme.css").read_text() + "</style>\n</head>")
    if integree:   # marquée dès le départ : rien de ce qui est propre à la version autonome ne s'affiche, même un instant
        t = t.replace('<html lang="fr">', '<html lang="fr" data-hote="suivi-pp" class="integree">')
    return t + bloc + "<script>\n" + capture + js + "\ninit();\n</script>\n</body>\n</html>\n"


html = page((d / "polices.css").read_text())
out = d / "Fiche de suivi collective.html"
out.write_text(html)
print(out, len(html))

if "--autonome" not in sys.argv:
    integ = page("/*POLICES-HOTE*/\n", True).encode("utf-8")
    c = zlib.compressobj(9, zlib.DEFLATED, -15)          # deflate « brut », ce que lit DecompressionStream('deflate-raw')
    z = c.compress(integ) + c.flush()
    b64 = base64.b64encode(z).decode()
    emp = hashlib.sha256(integ).hexdigest()[:16]
    suivi = d.parent.parent / "suivi pp.html"
    s = suivi.read_text(encoding="utf-8")
    debut, fin = "<!-- FICHES-SUIVI-DEBUT", "<!-- FICHES-SUIVI-FIN -->"
    nouveau = (f"{debut} : l'application des fiches de suivi (fiches-suivi/), version intégrée, compressée (deflate brut, base64) — "
               f"écrite par fiches-suivi/app/assemble.py, NE PAS MODIFIER À LA MAIN -->\n"
               f'<script type="application/octet-stream" id="fiches-suivi-app" data-octets="{len(integ)}" data-empreinte="{emp}">{b64}</script>\n{fin}')
    if debut in s:
        a, b = s.index(debut), s.index(fin) + len(fin)
        s = s[:a] + nouveau + s[b:]
    else:   # première fois : juste avant le script de l'application (le harnais des tests prend le DERNIER script)
        ancre = '<div id="app-version-tag"'
        assert s.count(ancre) == 1
        i = s.index("<script>", s.index(ancre))
        s = s[:i] + nouveau + "\n\n" + s[i:]
    suivi.write_text(s, encoding="utf-8")
    print(suivi, f"version intégrée : {len(integ)} octets, {len(b64)} en base64 compressé, empreinte {emp}")
