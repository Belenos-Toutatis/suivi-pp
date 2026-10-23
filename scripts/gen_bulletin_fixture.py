#!/usr/bin/env python3
"""Fabrique test/fixtures/bulletin-mbn-invente.pdf : un faux PDF des bulletins d'une classe, exporté de
Mon Bureau Numérique, à la MISE EN PAGE relevée sur le vrai (description masquée du 2026-10-23 : positions
en mm depuis le haut à gauche, tailles en pt). Noms INVENTÉS — dépôt public.

Ce qu'il exerce : l'en-tête de page qui dit l'élève, un bulletin sur deux pages (l'appréciation de SVT
continue en haut de la page 2), le professeur sur deux lignes, deux matières de la même discipline
(ALLEMAND, ALLEMAND BILINGUE), une matière inconnue (ESPAGNOL LV2), « Non renseigné », les rangées
« Pôle… » et « Autres matières », les moyennes et le programme à ignorer, « Communication avec la
famille » qui finit le tableau, un second exemplaire identique (un par responsable légal), un nom
composé, un élève inconnu de la classe.

Sans dépendance : un PDF minimal écrit à la main (Helvetica, WinAnsiEncoding, flux non compressés)."""

OUT = 'test/fixtures/bulletin-mbn-invente.pdf'
MM = 72 / 25.4
W, H = 595.28, 841.89


def esc(t):
    return t.encode('cp1252').replace(b'\\', b'\\\\').replace(b'(', b'\\(').replace(b')', b'\\)')


class Page:
    def __init__(self):
        self.ops = []

    def t(self, x, y, txt, size=7):
        self.ops.append(b'BT /F1 %.1f Tf %.2f %.2f Td (' % (size, x * MM, H - y * MM) + esc(txt) + b') Tj ET')


def entete(pg, nom, n, total):
    pg.t(70, 8, f'{nom} (5C) - Premier semestre (2025 - 2026)', 8)
    pg.t(8, 292, f'{nom} - 5C', 8)
    pg.t(189, 292, f'Page {n} sur {total}', 8)


def premiere(pg, nom, resp):
    pg.t(8, 12, f'Madame : {resp}', 10)
    pg.t(8, 17, '12 rue des Lilas', 10)
    pg.t(8, 23, '68000 Colmar', 10)
    pg.t(36, 47, 'Année scolaire : 2025 – 2026', 8)
    pg.t(41, 50, 'Bilan Premier semestre', 8)
    pg.t(38, 55, nom, 12)
    pg.t(42, 59, 'Né(e) le : 01/02/2013', 8)
    pg.t(34, 67, 'Professeur principal : M. ALPHA', 8)
    pg.t(40, 71, 'Classe de 5C (25 élèves)', 8)
    pg.t(74, 83, "Suivi des acquis scolaires de l'élève", 10)
    tete_tableau(pg, 89)


def tete_tableau(pg, y):
    pg.t(52, y, 'Principaux éléments du', 8); pg.t(95, y, 'Acquisitions, progrès et difficultés éventuelles', 8)
    pg.t(183, y, 'Moy.', 8); pg.t(194, y, 'Moy.', 8)
    pg.t(52, y + 3, 'programme travaillés durant', 8); pg.t(182, y + 3, 'élève', 8); pg.t(192, y + 3, 'classe', 8)
    pg.t(52, y + 6, 'la période', 8)


def pole(pg, y, nom):
    pg.t(9, y, nom, 8); pg.t(185, y, '13,4', 8); pg.t(195, y, '14,1', 8)


def matiere(pg, y, nom, profs, appr, prog='- un thème du programme'):
    pg.t(9, y, nom, 8)
    pg.t(52, y, prog, 7)
    pg.t(186, y, '12,5', 8); pg.t(195, y, '13,0', 8)
    for i, p in enumerate(profs):
        pg.t(9, y + 3 * (i + 1), p, 6)
    for i, a in enumerate(appr):
        pg.t(95, y + 3 * i, a, 7)


def communication(pg, y):
    pg.t(79, y, 'Communication avec la famille', 10)
    pg.t(10, y + 7, 'Retards : 2', 8)
    pg.t(10, y + 10, 'Absences justifiées : 1 demi-journée(s)', 8)


pages = []

# ── MARTIN Léa : deux pages ──
p = Page(); entete(p, 'MARTIN Léa', 1, 2); premiere(p, 'MARTIN Léa', 'MARTIN')
pole(p, 100, 'Pôle littéraire')
matiere(p, 105, 'FRANÇAIS', ['Mme ROSE (5C)'], ["Des résultats satisfaisants. Léa participe volontiers à l'oral", "mais doit soigner l'orthographe."])
matiere(p, 113, 'HISTOIRE-GEOGRAPHIE EMC', ['M. CEDRE (5C)'], ['Travail sérieux et régulier.'])
matiere(p, 120, 'ALLEMAND', ['Mme IF (5C-ALL)'], ['Bonne participation.'])
matiere(p, 128, 'ALLEMAND BILINGUE', ['Mme IF (5C-BIL)'], ['Très bon semestre en section bilingue.'])
pole(p, 137, 'Pôle scientifique')
matiere(p, 142, 'MATHÉMATIQUES', ['Mme PIN, Mme SAULE, Mme', 'FRENE (5C)'], ['Non renseigné'])
matiere(p, 154, 'ESPAGNOL LV2', ['M. OLIVO (5C-ESP)'], ['Muy bien, sigue así.'])
matiere(p, 262, 'SCIENCES VIE & TERRE', ['M. CHENE (5C)'], ["Un semestre encourageant : Léa s'investit davantage", 'en travaux pratiques et'])
pages.append(p)
p = Page(); entete(p, 'MARTIN Léa', 2, 2); tete_tableau(p, 22)
p.t(95, 33, "progresse nettement à l'écrit.", 7)
matiere(p, 38, 'ÉD.PHYSIQUE & SPORT.', ['M. BOULEAU (5C)'], ['Non renseigné'], prog='Non renseigné')
pole(p, 47, 'Autres matières')
matiere(p, 52, 'ENS.RELIG.CATHOLIQUE', ['Mme ORME (5C-CATH (1))'], ['Bonne écoute.'])
communication(p, 64)
pages.append(p)

# ── DUBOIS Hugo : une page, en deux exemplaires (un par responsable légal) ──
for resp in ('DUBOIS', 'LEROY'):
    p = Page(); entete(p, 'DUBOIS Hugo', 1, 1); premiere(p, 'DUBOIS Hugo', resp)
    pole(p, 100, 'Pôle littéraire')
    matiere(p, 105, 'FRANÇAIS', ['Mme ROSE (5C)'], ["Hugo doit fournir plus d'efforts : leçons non apprises."])
    pole(p, 112, 'Pôle scientifique')
    matiere(p, 117, 'MATHÉMATIQUES', ['Mme PIN (5C)'], ['Excellent travail, résultats très solides.'])
    communication(p, 130)
    pages.append(p)

# ── BERNARD-PETIT Chloé Anne : un nom composé ──
p = Page(); entete(p, 'BERNARD-PETIT Chloé Anne', 1, 1); premiere(p, 'BERNARD-PETIT Chloé Anne', 'BERNARD')
pole(p, 100, 'Pôle littéraire')
matiere(p, 105, 'FRANÇAIS', ['Mme ROSE (5C)'], ['Très bon semestre.'])
communication(p, 116)
pages.append(p)

# ── INCONNU Zoé : pas dans la classe ──
p = Page(); entete(p, 'INCONNU Zoé', 1, 1); premiere(p, 'INCONNU Zoé', 'INCONNU')
matiere(p, 105, 'FRANÇAIS', ['Mme ROSE (5C)'], ['Assez bien.'])
pages.append(p)

# ── Le PDF ──
objs = []
def obj(b):
    objs.append(b); return len(objs)

cat = obj(b'')
pgs = obj(b'')
font = obj(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
kids = []
for pg in pages:
    data = b'\n'.join(pg.ops)
    c = obj(b'<< /Length %d >>\nstream\n' % len(data) + data + b'\nendstream')
    kids.append(obj(b'<< /Type /Page /Parent %d 0 R /MediaBox [0 0 %.2f %.2f] /Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>' % (pgs, W, H, font, c)))
objs[cat - 1] = b'<< /Type /Catalog /Pages %d 0 R >>' % pgs
objs[pgs - 1] = b'<< /Type /Pages /Kids [%s] /Count %d >>' % (b' '.join(b'%d 0 R' % k for k in kids), len(kids))

out = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
offs = []
for i, b in enumerate(objs, 1):
    offs.append(len(out))
    out += b'%d 0 obj\n' % i + b + b'\nendobj\n'
x = len(out)
out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1)
for o in offs:
    out += b'%010d 00000 n \n' % o
out += b'trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, cat, x)
open(OUT, 'wb').write(bytes(out))
print(OUT, len(pages), 'pages')
