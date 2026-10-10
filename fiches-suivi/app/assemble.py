"""Assemble l'application en un seul fichier HTML autonome."""
import pathlib
d = pathlib.Path(__file__).parent
edt = (d / "edt_demo.min.json").read_text().strip()
js = "\n".join((d / f).read_text() for f in ("core.js", "demo.js", "ui.js", "sections.js", "tuto.js")).replace("/*EDT_DEMO*/null", edt)
# les données du suivi sont rangées dans ce bloc (vide au départ) ; la page se recopie elle-même en l'y remplaçant
bloc = '<script id="donnees-suivi" type="application/json">null</script>\n'
capture = "const PAGE_SOURCE = document.documentElement.outerHTML;   // la page telle qu'elle a été chargée (avant tout affichage)\n"
# apparence de Suivi PP (2026-10-10) : ses polices (polices.css, générées par scripts/gen_fonts.py --fiches) et ses couleurs
# (theme.css), APRÈS la feuille de style de l'application, qu'elles complètent
tete = (d / "head.html").read_text()
assert tete.count("</head>") == 1
tete = tete.replace("</head>", '<style id="polices">\n' + (d / "polices.css").read_text() + '</style>\n<style id="theme">\n' + (d / "theme.css").read_text() + "</style>\n</head>")
html = tete + bloc + "<script>\n" + capture + js + "\ninit();\n</script>\n</body>\n</html>\n"
out = d / "Fiche de suivi collective.html"
out.write_text(html)
print(out, len(html))
